import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { uploadCapa } from "@/lib/upload";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ImagePlus, Loader2, Upload } from "lucide-react";

const GENRES = [
  "Ação", "Aventura", "Comédia", "Drama", "Fantasia",
  "Horror", "Mistério", "Romance", "Sci-Fi", "Slice of Life",
  "Supernatural", "Esportes", "Histórico", "Psicológico", "Ecchi",
];

export default function NovaObraPage() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [originalAuthor, setOriginalAuthor] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const criar = trpc.obras.create.useMutation({
    onSuccess: (obra) => {
      toast.success("Obra enviada! Aguardando aprovação do admin.");
      navigate(`/obra/${obra.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen">
        <Topbar />
        <div className="container py-20 text-center text-muted-foreground">
          Faça login para enviar uma obra.
        </div>
      </div>
    );
  }

  const canPost = user?.role !== "usuario";
  if (!canPost) {
    return (
      <div className="min-h-screen">
        <Topbar />
        <div className="container py-20 text-center">
          <p className="text-4xl mb-4">🔒</p>
          <p className="text-white font-bold mb-2">Acesso restrito a tradutores</p>
          <p className="text-muted-foreground text-sm">Solicite o cargo de tradutor no menu do seu perfil.</p>
        </div>
      </div>
    );
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 10MB.");
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  function toggleGenre(g: string) {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : prev.length < 5 ? [...prev, g] : prev
    );
  }

  async function handleSubmit() {
    if (!title.trim()) return toast.error("Título obrigatório.");
    if (selectedGenres.length === 0) return toast.error("Selecione pelo menos 1 gênero.");

    setUploading(true);
    try {
      let coverUrl: string | undefined;
      let coverKey: string | undefined;

      if (coverFile) {
        const result = await uploadCapa(coverFile);
        coverUrl = result.publicUrl;
        coverKey = result.key;
      }

      await criar.mutateAsync({
        title: title.trim(),
        synopsis: synopsis.trim() || undefined,
        originalAuthor: originalAuthor.trim() || undefined,
        genres: selectedGenres,
        coverUrl,
        coverKey,
      });
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar obra.");
    } finally {
      setUploading(false);
    }
  }

  const isLoading = uploading || criar.isPending;

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="container py-8 max-w-2xl">
        <h1 className="text-2xl font-black text-white mb-6">📚 Nova Obra</h1>

        <div className="space-y-6">

          {/* Capa */}
          <div>
            <Label className="text-white/80 mb-2 block">Capa da Obra</Label>
            <div
              onClick={() => fileRef.current?.click()}
              className="relative cursor-pointer group"
            >
              {coverPreview ? (
                <div className="relative w-40 h-56 rounded-xl overflow-hidden border-2 border-primary/50">
                  <img src={coverPreview} alt="Capa" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                </div>
              ) : (
                <div className="w-40 h-56 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 bg-secondary/30">
                  <ImagePlus className="w-8 h-8 text-white/30" />
                  <span className="text-xs text-muted-foreground">Clique para adicionar</span>
                  <span className="text-[10px] text-muted-foreground">JPG, PNG, WebP • máx 10MB</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
          </div>

          {/* Título */}
          <div>
            <Label className="text-white/80 mb-1.5 block">Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255}
              placeholder="Nome da obra" className="bg-secondary border-border text-white placeholder:text-muted-foreground" />
          </div>

          {/* Autor original */}
          <div>
            <Label className="text-white/80 mb-1.5 block">Autor Original</Label>
            <Input value={originalAuthor} onChange={(e) => setOriginalAuthor(e.target.value)} maxLength={255}
              placeholder="Nome do autor original" className="bg-secondary border-border text-white placeholder:text-muted-foreground" />
          </div>

          {/* Sinopse */}
          <div>
            <Label className="text-white/80 mb-1.5 block">Sinopse</Label>
            <textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} maxLength={2000} rows={4}
              placeholder="Descrição da obra..."
              className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-white placeholder:text-muted-foreground text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary" />
            <p className="text-xs text-muted-foreground mt-1">{synopsis.length}/2000</p>
          </div>

          {/* Gêneros */}
          <div>
            <Label className="text-white/80 mb-1.5 block">
              Gêneros * <span className="text-muted-foreground font-normal">(máx. 5)</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button key={g} onClick={() => toggleGenre(g)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    selectedGenres.includes(g)
                      ? "bg-primary border-primary text-white"
                      : "bg-transparent border-border text-white/60 hover:border-white/40 hover:text-white"
                  }`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <Button onClick={handleSubmit} disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-white h-11 text-base font-bold">
            {isLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {uploading ? "Enviando capa..." : "Salvando..."}</>
            ) : "Enviar para aprovação"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Sua obra será revisada por um administrador antes de ser publicada.
          </p>
        </div>
      </main>
    </div>
  );
}
