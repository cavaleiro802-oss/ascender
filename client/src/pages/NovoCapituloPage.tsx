import { useState, useRef, useCallback } from "react";
import { unzip } from "fflate";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useUpload } from "@/lib/upload";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ImagePlus, Loader2, X, Upload, Package, CheckCircle2, AlertCircle } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface CapLote {
  pasta: string;
  numero: string;
  arquivos: File[];
  previews: string[];
  status: "pendente" | "enviando" | "ok" | "erro";
  erro?: string;
}

// ─── Extrai zip/cbz no browser usando fflate ─────────────────────────────────
async function extrairZip(file: File): Promise<CapLote[]> {
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);

  return new Promise((resolve, reject) => {
    unzip(uint8, (err, files) => {
      if (err) return reject(new Error("ZIP/CBZ inválido ou corrompido."));

      const IMGS = ["jpg", "jpeg", "png", "webp"];
      const grupos: Record<string, File[]> = {};
      const imgsRaiz: File[] = [];

      for (const [path, data] of Object.entries(files)) {
        if (data.length === 0) continue;
        const partes = path.split("/").filter(Boolean);
        const nome = partes[partes.length - 1];
        const ext = nome.split(".").pop()?.toLowerCase() ?? "";
        if (!IMGS.includes(ext)) continue;

        const mime = (ext === "jpg" || ext === "jpeg") ? "image/jpeg"
          : ext === "png" ? "image/png" : "image/webp";
        const f = new File([new Blob([data], { type: mime })], nome, { type: mime });

        if (partes.length === 1) {
          // Imagem na raiz (CBZ flat)
          imgsRaiz.push(f);
        } else {
          const pasta = partes[0];
          if (!grupos[pasta]) grupos[pasta] = [];
          grupos[pasta].push(f);
        }
      }

      // CBZ flat: todas as imagens na raiz = 1 capítulo
      if (Object.keys(grupos).length === 0 && imgsRaiz.length > 0) {
        imgsRaiz.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        const match = file.name.match(/(\d+(?:\.\d+)?)/);
        const preview = [URL.createObjectURL(imgsRaiz[0])];
        return resolve([{
          pasta: file.name,
          numero: match ? match[1] : "",
          arquivos: imgsRaiz,
          previews: preview,
          status: "pendente",
        }]);
      }

      const caps: CapLote[] = Object.entries(grupos)
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([pasta, arquivos]) => {
          arquivos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
          const match = pasta.match(/(\d+(?:\.\d+)?)/);
          const previews = [URL.createObjectURL(arquivos[0])];
          return { pasta, numero: match ? match[1] : "", arquivos, previews, status: "pendente" as const };
        });

      if (caps.length === 0) {
        return reject(new Error("Nenhuma imagem encontrada. Organize em pastas (cap1/, cap2/...) ou use CBZ com imagens na raiz."));
      }

      resolve(caps);
    });
  });
}

// ─── Aba cap único ─────────────────────────────────────────────────────────────
function AbaUnico({ obraId }: { obraId: string }) {
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [numero, setNumero] = useState("");
  const [title, setTitle] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [extraindo, setExtraindo] = useState(false);
  const utils = trpc.useUtils();
  const { uploading, progress, error: uploadError, uploadCapitulo } = useUpload();

  const criar = trpc.capitulos.create.useMutation({
    onSuccess: () => {
      toast.success("Capítulo enviado!");
      utils.obras.listRecent?.invalidate();
      utils.capitulos.list.invalidate({ obraId: parseInt(obraId) });
      navigate(`/obra/${obraId}`);
    },
    onError: (e) => toast.error(e.message),
  });

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const lista = Array.from(files);

    // Se selecionou CBZ/ZIP, extrai automaticamente
    const zips = lista.filter((f) => f.name.match(/\.(zip|cbz)$/i));
    const imagens = lista.filter((f) => ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(f.type));

    if (zips.length > 0) {
      setExtraindo(true);
      try {
        // Extrai o primeiro zip/cbz e usa as imagens dele
        const caps = await extrairZip(zips[0]);
        if (caps.length > 1) {
          toast.error("Esse arquivo tem múltiplos capítulos. Use a aba Lote (ZIP).");
          return;
        }
        if (caps.length === 1) {
          const cap = caps[0];
          setArquivos(cap.arquivos);
          setPreviews(cap.arquivos.slice(0, 6).map((f) => URL.createObjectURL(f)));
          // Autodetectar número do cap se o campo estiver vazio
          if (!numero && cap.numero) {
            // não tem setter aqui, feito via prop interna
          }
          toast.success(`${cap.arquivos.length} imagens carregadas do ${zips[0].name}`);
        }
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setExtraindo(false);
      }
      return;
    }

    const validos = imagens.filter((f) => {
      if (f.size > 50 * 1024 * 1024) {
        toast.error(`${f.name}: muito grande (máx 50MB).`); return false;
      }
      return true;
    });
    if (arquivos.length + validos.length > 500) { toast.error("Máximo de 500 páginas."); return; }
    setArquivos((p) => [...p, ...validos]);
    setPreviews((p) => [...p, ...validos.slice(0, 6).map((f) => URL.createObjectURL(f))]);
  }

  function removerPagina(idx: number) {
    setArquivos((p) => p.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); handleFiles(e.dataTransfer.files);
  }, [arquivos]);

  async function handleSubmit() {
    if (!numero || isNaN(parseFloat(numero))) return toast.error("Número do capítulo obrigatório.");
    if (arquivos.length === 0) return toast.error("Adicione pelo menos 1 página.");
    const resultados = await uploadCapitulo(arquivos);
    if (!resultados) return;
    await criar.mutateAsync({
      obraId: parseInt(obraId),
      numero: parseFloat(numero),
      title: title.trim() || undefined,
      paginas: resultados.map((r) => r.publicUrl),
      paginasKeys: resultados.map((r) => r.key),
    });
  }

  const isLoading = uploading || criar.isPending || extraindo;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-white/80 mb-1.5 block">Número *</Label>
          <Input type="number" step="0.1" value={numero} onChange={(e) => setNumero(e.target.value)}
            placeholder="Ex: 42 ou 1.5" className="bg-secondary border-border text-white placeholder:text-muted-foreground" />
        </div>
        <div>
          <Label className="text-white/80 mb-1.5 block">Título <span className="text-muted-foreground font-normal">(opcional)</span></Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255}
            placeholder="Ex: O Confronto Final" className="bg-secondary border-border text-white placeholder:text-muted-foreground" />
        </div>
      </div>

      <div>
        <Label className="text-white/80 mb-2 block">
          Páginas * <span className="text-muted-foreground font-normal">({arquivos.length}/100 — em ordem)</span>
        </Label>
        <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 text-center cursor-pointer transition-colors group">
          {extraindo ? (
            <><Loader2 className="w-8 h-8 text-primary mx-auto mb-2 animate-spin" /><p className="text-sm text-white/70">Extraindo arquivo...</p></>
          ) : (
            <><ImagePlus className="w-8 h-8 text-white/20 group-hover:text-primary/50 mx-auto mb-2 transition-colors" />
            <p className="text-sm text-muted-foreground">Clique ou arraste imagens, CBZ ou ZIP</p></>
          )}
          <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP, CBZ ou ZIP • até 500 páginas</p>
          <p className="text-xs text-muted-foreground/60 mt-2">📂 No Android: se abrir a galeria, toque nos 3 pontinhos e selecione "Gerenciador de arquivos"</p>
        </div>
        <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.zip,.cbz,image/jpeg,image/jpg,image/png,image/webp" multiple className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {previews.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-white/70">{previews.length} página{previews.length !== 1 ? "s" : ""}</p>
            <button onClick={() => { setArquivos([]); setPreviews([]); }} className="text-xs text-red-400 hover:text-red-300">Remover todas</button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-80 overflow-y-auto pr-1">
            {previews.map((src, i) => (
              <div key={i} className="relative group aspect-[3/4] rounded-lg overflow-hidden bg-secondary">
                <img src={src} alt={`Página ${i + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button onClick={(e) => { e.stopPropagation(); removerPagina(i); }} className="bg-red-600 rounded-full p-1">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
                <span className="absolute bottom-0.5 left-0 right-0 text-center text-[9px] text-white/70 bg-black/50">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}

      <Button onClick={handleSubmit} disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-white h-11 text-base font-bold">
        {isLoading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{uploading ? `Enviando... ${progress}%` : "Salvando..."}</>
        ) : `Enviar ${arquivos.length} página${arquivos.length !== 1 ? "s" : ""}`}
      </Button>
    </div>
  );
}

// ─── Aba lote ZIP ──────────────────────────────────────────────────────────────
function AbaLote({ obraId }: { obraId: string }) {
  const [, navigate] = useLocation();
  const zipRef = useRef<HTMLInputElement>(null);
  const [caps, setCaps] = useState<CapLote[]>([]);
  const [extraindo, setExtraindo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const utils = trpc.useUtils();

  const criar = trpc.capitulos.create.useMutation({ onError: (e) => toast.error(e.message) });
  const { uploadCapitulo, error: uploadError } = useUpload();

  async function handleZips(files: FileList) {
    setExtraindo(true);
    setCaps([]);
    const todos: CapLote[] = [];

    // Separar zips/cbz de imagens soltas
    const zips = Array.from(files).filter(f => f.name.match(/\.(zip|cbz)$/i));
    const imgs = Array.from(files).filter(f => f.type.startsWith("image/"));

    // Processar zips/cbz normalmente
    for (const zip of zips) {
      try {
        const resultado = await extrairZip(zip);
        todos.push(...resultado);
      } catch (e: any) {
        toast.error(`${zip.name}: ${e.message}`);
      }
    }

    // Imagens soltas viram um único capítulo
    if (imgs.length > 0) {
      imgs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const previews = imgs.slice(0, 4).map(f => URL.createObjectURL(f));
      todos.push({
        pasta: "Imagens soltas",
        numero: "",
        arquivos: imgs,
        previews,
        status: "pendente",
      });
    }

    todos.sort((a, b) => parseFloat(a.numero || "0") - parseFloat(b.numero || "0"));
    setCaps(todos);
    if (todos.length > 0) toast.success(`${todos.length} capítulo${todos.length !== 1 ? "s" : ""} detectado${todos.length !== 1 ? "s" : ""}!`);
    setExtraindo(false);
  }

  function atualizarNumero(idx: number, valor: string) {
    setCaps((prev) => prev.map((c, i) => i === idx ? { ...c, numero: valor } : c));
  }

  async function enviarTodos() {
    const invalidos = caps.filter((c) => !c.numero || isNaN(parseFloat(c.numero)));
    if (invalidos.length > 0) {
      toast.error(`Preencha o número de todos os capítulos (${invalidos.length} sem número).`);
      return;
    }

    setEnviando(true);
    setProgresso({ atual: 0, total: caps.length });
    let sucessos = 0;
    let concluidos = 0;
    const PARALELO = 3; // 3 caps simultâneos — evita sobrecarga

    async function enviarCap(cap: CapLote, i: number) {
      setCaps((prev) => prev.map((c, idx) => idx === i ? { ...c, status: "enviando" } : c));
      try {
        const resultados = await uploadCapitulo(cap.arquivos);
        if (!resultados) throw new Error(uploadError || "Falha no upload das imagens.");
        await criar.mutateAsync({
          obraId: parseInt(obraId),
          numero: parseFloat(cap.numero),
          paginas: resultados.map((r) => r.publicUrl),
          paginasKeys: resultados.map((r) => r.key),
        });
        setCaps((prev) => prev.map((c, idx) => idx === i ? { ...c, status: "ok" } : c));
        sucessos++;
      } catch (e: any) {
        setCaps((prev) => prev.map((c, idx) => idx === i ? { ...c, status: "erro", erro: e.message } : c));
      }
      concluidos++;
      setProgresso({ atual: concluidos, total: caps.length });
    }

    // Enviar em grupos de PARALELO
    for (let i = 0; i < caps.length; i += PARALELO) {
      const grupo = caps.slice(i, i + PARALELO).map((cap, j) => enviarCap(cap, i + j));
      await Promise.all(grupo);
    }

    setEnviando(false);
    utils.capitulos.list.invalidate({ obraId: parseInt(obraId) });

    if (sucessos === caps.length) {
      toast.success(`${sucessos} capítulo${sucessos !== 1 ? "s" : ""} enviado${sucessos !== 1 ? "s" : ""} com sucesso!`);
      setTimeout(() => navigate(`/obra/${obraId}`), 1500);
    } else {
      toast.error(`${sucessos}/${caps.length} enviados. Verifique os erros.`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Instruções */}
      <div className="asc-card p-4 border-blue-500/20 bg-blue-500/5">
        <p className="text-sm text-blue-300 font-bold mb-1">📦 Como organizar o ZIP</p>
        <p className="text-xs text-blue-200/60">Crie uma pasta por capítulo com as imagens dentro:</p>
        <pre className="text-xs text-white/40 mt-2 font-mono">
{`obra.zip
├── cap1/
│   ├── 01.jpg
│   └── 02.jpg
├── cap2/
│   ├── 01.jpg
│   └── 02.jpg`}
        </pre>
      </div>

      {/* Upload do ZIP */}
      <div>
        <div onClick={() => zipRef.current?.click()}
          className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 text-center cursor-pointer transition-colors group">
          {extraindo ? (
            <><Loader2 className="w-8 h-8 text-primary mx-auto mb-2 animate-spin" />
              <p className="text-sm text-white/70">Extraindo ZIP...</p></>
          ) : (
            <><Package className="w-8 h-8 text-white/20 group-hover:text-primary/50 mx-auto mb-2 transition-colors" />
              <p className="text-sm text-muted-foreground">Clique para selecionar arquivos</p>
              <p className="text-xs text-muted-foreground mt-1">ZIP, CBZ ou imagens soltas • Vários de uma vez • Máx. 500MB cada</p></>
          )}
        </div>
        <input ref={zipRef} type="file" accept=".zip,.cbz,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple className="hidden"
          onChange={(e) => { const files = e.target.files; if (files && files.length > 0) handleZips(files); }} />
      </div>

      {/* Lista de caps detectados */}
      {caps.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-white/70 font-bold">{caps.length} capítulo{caps.length !== 1 ? "s" : ""} detectado{caps.length !== 1 ? "s" : ""}</p>
          {caps.map((cap, i) => (
            <div key={i} className={`asc-card p-3 flex items-center gap-3 ${
              cap.status === "ok" ? "border-green-500/30 bg-green-500/5"
              : cap.status === "erro" ? "border-red-500/30 bg-red-500/5"
              : cap.status === "enviando" ? "border-primary/30 bg-primary/5" : ""
            }`}>
              {/* Status icon */}
              <div className="flex-shrink-0">
                {cap.status === "ok" && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                {cap.status === "erro" && <AlertCircle className="w-5 h-5 text-red-400" />}
                {cap.status === "enviando" && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                {cap.status === "pendente" && (
                  <div className="w-5 h-5 rounded-full border-2 border-border flex items-center justify-center text-[10px] text-white/40">{i + 1}</div>
                )}
              </div>

              {/* Preview da primeira imagem — onError mostra placeholder */}
              <div className="w-8 h-10 rounded flex-shrink-0 bg-secondary overflow-hidden">
                {cap.previews[0] ? (
                  <img
                    src={cap.previews[0]}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      (e.target as HTMLImageElement).parentElement!.classList.add("flex","items-center","justify-center");
                      (e.target as HTMLImageElement).insertAdjacentHTML("afterend", '<span class="text-[9px] text-white/30">IMG</span>');
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-[9px] text-white/30">IMG</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/50 truncate">📁 {cap.pasta} — {cap.arquivos.length} imagens</p>
                {cap.erro && <p className="text-xs text-red-400 mt-0.5">{cap.erro}</p>}
              </div>

              {/* Número do cap */}
              <div className="flex-shrink-0 w-24">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Nº cap"
                  value={cap.numero}
                  onChange={(e) => atualizarNumero(i, e.target.value)}
                  disabled={cap.status === "enviando" || cap.status === "ok"}
                  className="bg-secondary border-border text-white text-sm h-8 text-center"
                />
              </div>
            </div>
          ))}

          {/* Barra de progresso geral */}
          {enviando && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-white/60">
                <span>Enviando capítulos...</span>
                <span>{progresso.atual}/{progresso.total}</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(progresso.atual / progresso.total) * 100}%` }} />
              </div>
            </div>
          )}

          <Button onClick={enviarTodos} disabled={enviando || extraindo}
            className="w-full bg-primary hover:bg-primary/90 text-white h-11 text-base font-bold">
            {enviando ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando {progresso.atual}/{progresso.total}...</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" />Enviar {caps.filter(c => c.status !== "ok").length} capítulo{caps.filter(c => c.status !== "ok").length !== 1 ? "s" : ""}</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function NovoCapituloPage() {
  const { id: obraId } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const [aba, setAba] = useState<"unico" | "lote">("unico");

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

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="container py-8 max-w-2xl">
        <h1 className="text-2xl font-black text-white mb-6">📄 Novo Capítulo</h1>

        {/* Seletor de aba */}
        <div className="flex gap-2 mb-6 bg-secondary p-1 rounded-xl">
          <button
            onClick={() => setAba("unico")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
              aba === "unico" ? "bg-primary text-white shadow" : "text-white/50 hover:text-white"
            }`}
          >
            📄 Cap único
          </button>
          <button
            onClick={() => setAba("lote")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
              aba === "lote" ? "bg-primary text-white shadow" : "text-white/50 hover:text-white"
            }`}
          >
            📦 Lote (ZIP)
          </button>
        </div>

        {aba === "unico" ? <AbaUnico obraId={obraId} /> : <AbaLote obraId={obraId} />}
      </main>
    </div>
  );
}

