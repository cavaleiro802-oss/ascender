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

// Tipos de mídia — ficam separados dos gêneros
const TIPOS_MIDIA = ["Manga", "Manhwa", "Manhua", "Novel", "Light Novel", "Webtoon", "HQ", "Quadrinhos"];

// Gêneros literários
const GENRES = [
  "Ação", "Aventura", "Comédia", "Drama", "Fantasia", "Horror",
  "Mistério", "Romance", "Sci-Fi", "Slice of Life", "Culinária",
  "Supernatural", "Esportes", "Histórico", "Psicológico", "Ecchi",
  "Isekai", "Shounen", "Shoujo", "Seinen", "Josei", "Yaoi", "Yuri",
  "Mahou Shoujo", "Mecha", "Policial", "Corrida", "Artes Marciais",
  "Reencarnação", "Sistema", "Harem", "Vilã", "Dungeons",
];

const ANDAMENTO_OPTIONS = [
  { value: "em_andamento", label: "▶ Em Andamento", cls: "border-green-500/50 text-green-400 bg-green-500/10" },
  { value: "hiato",        label: "⏸ Hiato",        cls: "border-yellow-500/50 text-yellow-400 bg-yellow-500/10" },
  { value: "finalizado",   label: "✓ Finalizado",   cls: "border-blue-500/50 text-blue-400 bg-blue-500/10" },
];

export default function NovaObraPage() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [originalAuthor, setOriginalAuthor] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [andamento, setAndamento] = useState<"em_andamento" | "hiato" | "finalizado">("em_andamento");
  const [tipo, setTipo] = useState<"manga" | "novel">("manga");
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
    const reader = new FileReader();
    reader.onload = (ev) => setCoverPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
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
        andamento,
        tipo,
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

          {/* Tipo de obra */}
          <div>
            <Label className="text-white/80 mb-2 block">Tipo de Obra *</Label>
            <div className="flex gap-3">
              <button
                onClick={() => setTipo("manga")}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center gap-1 ${
                  tipo === "manga"
                    ? "border-primary bg-primary/10 text-white"
                    : "border-border bg-secondary/30 text-white/40 hover:border-white/30 hover:text-white/70"
                }`}
              >
                <span className="text-2xl">🖼️</span>
                Manga / Manhwa
                <span className="text-[10px] font-normal opacity-60">Capítulos com imagens</span>
              </button>
              <button
                onClick={() => setTipo("novel")}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center gap-1 ${
                  tipo === "novel"
                    ? "border-primary bg-primary/10 text-white"
                    : "border-border bg-secondary/30 text-white/40 hover:border-white/30 hover:text-white/70"
                }`}
              >
                <span className="text-2xl">📖</span>
                Novel / Light Novel
                <span className="text-[10px] font-normal opacity-60">Capítulos em texto</span>
              </button>

            </div>
          </div>

          {/* Capa */}
          <div>
            <Label className="text-white/80 mb-2 block">Capa da Obra</Label>
            <div onClick={() => fileRef.current?.click()} className="relative cursor-pointer group">
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

          {/* Status de andamento */}
          <div>
            <Label className="text-white/80 mb-1.5 block">Status da Obra</Label>
            <div className="flex gap-2 flex-wrap">
              {ANDAMENTO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAndamento(opt.value as any)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    andamento === opt.value
                      ? opt.cls
                      : "bg-transparent border-border text-white/50 hover:border-white/40 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo de Mídia + Gêneros */}
          <div>
            <Label className="text-white/80 mb-1.5 block">
              Gêneros * <span className="text-muted-foreground font-normal">(máx. 5)</span>
            </Label>

            {/* Linha 1: Tipos de mídia */}
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1.5 mt-1">Tipo de Mídia</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {TIPOS_MIDIA.map((g) => (
                <button key={g} onClick={() => toggleGenre(g)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    selectedGenres.includes(g)
                      ? "bg-purple-600 border-purple-500 text-white"
                      : "bg-transparent border-purple-800/50 text-purple-300/60 hover:border-purple-500/60 hover:text-purple-200"
                  }`}>
                  {g}
                </button>
              ))}
            </div>

            {/* Divisor */}
            <div className="border-t border-border/50 my-2" />

            {/* Linha 2: Gêneros */}
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1.5 mt-3">Gêneros</p>
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

