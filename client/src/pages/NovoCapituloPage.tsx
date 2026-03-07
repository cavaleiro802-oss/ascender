import { useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useUpload } from "@/lib/upload";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ImagePlus, Loader2, X, GripVertical, Upload } from "lucide-react";

export default function NovoCapituloPage() {
  const { id: obraId } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [numero, setNumero] = useState("");
  const [title, setTitle] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const { uploading, progress, error: uploadError, uploadCapitulo } = useUpload();

  const criar = trpc.capitulos.create.useMutation({
    onSuccess: () => {
      toast.success("Capítulo enviado! Aguardando aprovação.");
      navigate(`/obra/${obraId}`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAuthenticated || !user || user.role === "usuario") {
    return (
      <div className="min-h-screen">
        <Topbar />
        <div className="container py-20 text-center text-muted-foreground">
          Acesso restrito a tradutores.
        </div>
      </div>
    );
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const validos = Array.from(files).filter((f) => {
      if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(f.type)) {
        toast.error(`${f.name}: formato inválido.`);
        return false;
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name}: muito grande (máx 10MB).`);
        return false;
      }
      return true;
    });

    if (arquivos.length + validos.length > 100) {
      toast.error("Máximo de 100 páginas por capítulo.");
      return;
    }

    setArquivos((prev) => [...prev, ...validos]);
    setPreviews((prev) => [...prev, ...validos.map((f) => URL.createObjectURL(f))]);
  }

  function removerPagina(idx: number) {
    setArquivos((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [arquivos]);

  async function handleSubmit() {
    if (!numero || isNaN(parseInt(numero))) return toast.error("Número do capítulo obrigatório.");
    if (arquivos.length === 0) return toast.error("Adicione pelo menos 1 página.");

    const resultados = await uploadCapitulo(arquivos);
    if (!resultados) return;

    const paginas = resultados.map((r) => r.publicUrl);
    const paginasKeys = resultados.map((r) => r.key);

    await criar.mutateAsync({
      obraId: parseInt(obraId),
      numero: parseInt(numero),
      title: title.trim() || undefined,
      paginas,
      paginasKeys,
    });
  }

  const isLoading = uploading || criar.isPending;

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="container py-8 max-w-2xl">
        <h1 className="text-2xl font-black text-white mb-6">📄 Novo Capítulo</h1>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-white/80 mb-1.5 block">Número *</Label>
              <Input type="number" value={numero} onChange={(e) => setNumero(e.target.value)} min={1}
                placeholder="Ex: 42" className="bg-secondary border-border text-white placeholder:text-muted-foreground" />
            </div>
            <div>
              <Label className="text-white/80 mb-1.5 block">Título <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255}
                placeholder="Ex: O Confronto Final" className="bg-secondary border-border text-white placeholder:text-muted-foreground" />
            </div>
          </div>

          {/* Área de upload */}
          <div>
            <Label className="text-white/80 mb-2 block">
              Páginas * <span className="text-muted-foreground font-normal">({arquivos.length}/100 — em ordem)</span>
            </Label>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 text-center cursor-pointer transition-colors group"
            >
              <ImagePlus className="w-8 h-8 text-white/20 group-hover:text-primary/50 mx-auto mb-2 transition-colors" />
              <p className="text-sm text-muted-foreground">Clique ou arraste as imagens aqui</p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP • máx 10MB por imagem • até 100 páginas</p>
            </div>
            {/* accept com extensões em vez de image/* para abrir gerenciador de arquivos no Android */}
            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp" multiple className="hidden"
              onChange={(e) => handleFiles(e.target.files)} />
          </div>

          {/* Preview das páginas */}
          {previews.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-white/70">{previews.length} página{previews.length !== 1 ? "s" : ""}</p>
                <button onClick={() => { setArquivos([]); setPreviews([]); }}
                  className="text-xs text-red-400 hover:text-red-300">
                  Remover todas
                </button>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-80 overflow-y-auto pr-1">
                {previews.map((src, i) => (
                  <div key={i} className="relative group aspect-[3/4] rounded-lg overflow-hidden bg-secondary">
                    <img src={src} alt={`Página ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button onClick={(e) => { e.stopPropagation(); removerPagina(i); }}
                        className="bg-red-600 rounded-full p-1">
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                    <span className="absolute bottom-0.5 left-0 right-0 text-center text-[9px] text-white/70 bg-black/50">
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barra de progresso */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/70">Enviando páginas...</span>
                <span className="text-primary font-bold">{progress}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {uploadError && (
            <p className="text-sm text-red-400">{uploadError}</p>
          )}

          <Button onClick={handleSubmit} disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-white h-11 text-base font-bold">
            {isLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {uploading ? `Enviando... ${progress}%` : "Salvando..."}
              </>
            ) : `Enviar ${arquivos.length} página${arquivos.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </main>
    </div>
  );
}
