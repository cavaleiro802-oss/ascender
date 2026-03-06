import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  BookOpen, ChevronRight, Eye, Flame, Heart,
  MessageSquare, Send, Star, Trash2, Pencil, X, Check,
} from "lucide-react";
import { useState, useEffect } from "react";
import AscenderLoader from "@/components/AscenderLoader";
import { useLocation, useParams } from "wouter";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

function kk(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

function parseGenres(genres?: string | null): string[] {
  if (!genres) return [];
  try {
    const parsed = JSON.parse(genres);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

const ANDAMENTO_CONFIG = {
  em_andamento: { label: "Em Andamento", cls: "border-green-500/50 text-green-400 bg-green-500/10" },
  iato:         { label: "Iato",         cls: "border-yellow-500/50 text-yellow-400 bg-yellow-500/10" },
  finalizado:   { label: "Finalizado",   cls: "border-blue-500/50 text-blue-400 bg-blue-500/10" },
} as const;

const GENRES_LIST = [
  "Novel", "Manhwar", "Manga", "Ação", "Aventura", "Comédia", "Drama", "Fantasia",
  "Horror", "Mistério", "Romance", "Sci-Fi", "Slice of Life", "Culinaria",
  "Supernatural", "Esportes", "Histórico", "Psicológico", "Ecchi",
];

export default function ObraPage() {
  const { id } = useParams<{ id: string }>();
  const obraId = parseInt(id ?? "0");
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [comment, setComment] = useState("");
  const [editando, setEditando] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSynopsis, setEditSynopsis] = useState("");
  const [editAndamento, setEditAndamento] = useState<"em_andamento" | "iato" | "finalizado">("em_andamento");
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const utils = trpc.useUtils();

  const { data: obra, isLoading } = trpc.obras.byId.useQuery({ id: obraId });
  const { data: capitulos = [] } = trpc.capitulos.list.useQuery({ obraId });
  const { data: comentarios = [] } = trpc.comentarios.list.useQuery({ obraId });
  const { data: curtidaCount = 0 } = trpc.curtidas.count.useQuery({ obraId });
  const { data: isCurtido } = trpc.curtidas.status.useQuery({ obraId }, { enabled: isAuthenticated });
  const { data: isFav } = trpc.favoritos.status.useQuery({ obraId }, { enabled: isAuthenticated });

  const incrementViews = trpc.obras.incrementViews.useMutation();
  const toggleCurtida = trpc.curtidas.toggle.useMutation({
    onSuccess: () => {
      utils.curtidas.count.invalidate({ obraId });
      utils.curtidas.status.invalidate({ obraId });
    },
  });
  const toggleFav = trpc.favoritos.toggle.useMutation({
    onSuccess: () => utils.favoritos.status.invalidate({ obraId }),
  });
  const addComentario = trpc.comentarios.create.useMutation({
    onSuccess: () => {
      utils.comentarios.list.invalidate({ obraId });
      toast.success("Comentário adicionado!");
    },
  });
  const deleteComentario = trpc.comentarios.delete.useMutation({
    onSuccess: () => utils.comentarios.list.invalidate({ obraId }),
  });
  const updateObra = trpc.obras.update.useMutation({
    onSuccess: () => {
      utils.obras.byId.invalidate({ id: obraId });
      setEditando(false);
      toast.success("Obra atualizada!");
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (obraId) incrementViews.mutate({ id: obraId });
  }, [obraId]);

  const isAdmin = user?.role === "admin_senhor" || user?.role === "admin_supremo";
  const isSupreme = user?.role === "admin_supremo";
  const isTranslator = user?.role === "tradutor_aprendiz" || user?.role === "tradutor_oficial" || isAdmin;
  const isOwnerOrAdmin = isTranslator && (obra?.authorId === user?.id || isAdmin);
  const genres = parseGenres(obra?.genres);
  const andamento = (obra as any)?.andamento as keyof typeof ANDAMENTO_CONFIG | undefined;
  const andamentoInfo = andamento ? ANDAMENTO_CONFIG[andamento] : null;

  function abrirEdicao() {
    if (!obra) return;
    setEditTitle(obra.title);
    setEditSynopsis(obra.synopsis ?? "");
    setEditAndamento((obra as any).andamento ?? "em_andamento");
    setEditGenres(parseGenres(obra.genres));
    setEditando(true);
  }

  function toggleEditGenre(g: string) {
    setEditGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : prev.length < 5 ? [...prev, g] : prev
    );
  }

  function salvarEdicao() {
    if (!editTitle.trim()) return toast.error("Título obrigatório.");
    updateObra.mutate({
      id: obraId,
      title: editTitle.trim(),
      synopsis: editSynopsis.trim() || undefined,
      andamento: editAndamento,
      genres: editGenres,
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Topbar />
        <AscenderLoader inline text="Carregando obra..." />
      </div>
    );
  }

  if (!obra) {
    return (
      <div className="min-h-screen">
        <Topbar />
        <div className="container py-12 text-center">
          <p className="text-muted-foreground">Obra não encontrada.</p>
          <Button className="mt-4" onClick={() => navigate("/")}>Voltar ao catálogo</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="container py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <span className="cursor-pointer hover:text-white" onClick={() => navigate("/")}>Catálogo</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white/80">{obra.title}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Cover + Actions */}
          <div className="lg:col-span-1">
            <div className="w-full aspect-[3/4] max-w-xs mx-auto lg:mx-0 rounded-xl overflow-hidden border border-border mb-4">
              {obra.coverUrl ? (
                <img src={obra.coverUrl} alt={obra.title} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full bg-secondary flex items-center justify-center">
                  <BookOpen className="w-16 h-16 text-primary/50" />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {capitulos.length > 0 && (
                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
                  onClick={() => navigate(`/obra/${obraId}/capitulo/${capitulos[0].id}`)}
                >
                  <BookOpen className="w-4 h-4 mr-1.5" />
                  Começar a ler
                </Button>
              )}
              {isAuthenticated ? (
                <>
                  <Button
                    variant="outline"
                    className={`w-full border-border bg-transparent ${isFav ? "text-yellow-400 border-yellow-400/40" : "text-white/60"}`}
                    onClick={() => toggleFav.mutate({ obraId })}
                  >
                    <Star className={`w-4 h-4 mr-1.5 ${isFav ? "fill-yellow-400" : ""}`} />
                    {isFav ? "Favoritado" : "Favoritar"}
                  </Button>
                  <Button
                    variant="outline"
                    className={`w-full border-border bg-transparent ${isCurtido ? "text-red-400 border-red-400/40" : "text-white/60"}`}
                    onClick={() => toggleCurtida.mutate({ obraId })}
                  >
                    <Heart className={`w-4 h-4 mr-1.5 ${isCurtido ? "fill-red-400" : ""}`} />
                    {kk(curtidaCount)} curtidas
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-border bg-transparent text-white/60"
                  onClick={() => navigate("/login")}
                >
                  <Heart className="w-4 h-4 mr-1.5" />
                  {kk(curtidaCount)} curtidas
                </Button>
              )}

              {/* Botão editar — só admin_supremo */}
              {isSupreme && (
                <Button
                  variant="outline"
                  className="w-full border-border bg-transparent text-white/60 hover:text-white"
                  onClick={abrirEdicao}
                >
                  <Pencil className="w-4 h-4 mr-1.5" />
                  Editar Obra
                </Button>
              )}
            </div>

            {/* Stats */}
            <div className="asc-card p-4 mt-4 space-y-2">
              {andamentoInfo && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${andamentoInfo.cls}`}>
                    {andamentoInfo.label}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Visualizações</span>
                <span className="flex items-center gap-1 text-white/80">
                  <Eye className="w-3.5 h-3.5" />{kk(obra.viewsTotal ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Esta semana</span>
                <span className="flex items-center gap-1 text-orange-400">
                  <Flame className="w-3.5 h-3.5" />{kk(obra.viewsWeek ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Capítulos</span>
                <span className="text-white/80">{capitulos.length}</span>
              </div>
              {obra.originalAuthor && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Autor original</span>
                  <span className="text-white/80 text-right max-w-[120px] truncate">{obra.originalAuthor}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Details */}
          <div className="lg:col-span-2 space-y-6">

            {/* Painel de edição */}
            {editando && isSupreme && (
              <div className="asc-card p-5 space-y-4 border-primary/30">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">✏️ Editar Obra</h2>
                  <button onClick={() => setEditando(false)} className="text-white/40 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Título</label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                    className="bg-secondary border-border text-white" maxLength={255} />
                </div>
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Sinopse</label>
                  <textarea value={editSynopsis} onChange={(e) => setEditSynopsis(e.target.value)}
                    rows={3} maxLength={2000}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-white text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-white/60 mb-1.5 block">Status</label>
                  <div className="flex gap-2 flex-wrap">
                    {(Object.entries(ANDAMENTO_CONFIG) as [keyof typeof ANDAMENTO_CONFIG, any][]).map(([val, cfg]) => (
                      <button key={val} onClick={() => setEditAndamento(val)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                          editAndamento === val ? cfg.cls : "bg-transparent border-border text-white/50 hover:text-white"
                        }`}>
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/60 mb-1.5 block">Gêneros (máx. 5)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {GENRES_LIST.map((g) => (
                      <button key={g} onClick={() => toggleEditGenre(g)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                          editGenres.includes(g)
                            ? "bg-primary border-primary text-white"
                            : "bg-transparent border-border text-white/50 hover:text-white"
                        }`}>
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-primary text-white" onClick={salvarEdicao} disabled={updateObra.isPending}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Salvar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-white/60" onClick={() => setEditando(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Title & genres */}
            <div>
              <h1 className="text-2xl font-black text-white mb-2">{obra.title}</h1>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {andamentoInfo && (
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${andamentoInfo.cls}`}>
                    {andamentoInfo.label}
                  </span>
                )}
                {genres.map((g) => (
                  <span key={g} className="asc-badge asc-badge-red">{g}</span>
                ))}
              </div>
              {obra.synopsis && (
                <p className="text-sm text-muted-foreground leading-relaxed">{obra.synopsis}</p>
              )}
            </div>

            {/* Chapters */}
            <div className="asc-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Capítulos ({capitulos.length})
                </h2>
                {isOwnerOrAdmin && (
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-white text-xs"
                    onClick={() => navigate(`/obra/${obraId}/novo-capitulo`)}>
                    + Novo Capítulo
                  </Button>
                )}
              </div>
              {capitulos.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum capítulo disponível ainda.</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                  {capitulos.map((cap) => (
                    <div key={cap.id}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group"
                      onClick={() => navigate(`/obra/${obraId}/capitulo/${cap.id}`)}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-8 text-right font-mono">{cap.numero}</span>
                        <span className="text-sm text-white/80 group-hover:text-white transition-colors">
                          {cap.title || `Capítulo ${cap.numero}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Eye className="w-3 h-3" />{kk(cap.viewsTotal ?? 0)}
                        <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="asc-card p-4">
              <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Comentários ({comentarios.length})
              </h2>
              {isAuthenticated ? (
                <div className="mb-4 space-y-1">
                  <div className="flex gap-2">
                    <Textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, 500))}
                      placeholder="Escreva um comentário..."
                      className="bg-secondary border-border text-white placeholder:text-muted-foreground resize-none text-sm"
                      rows={2} maxLength={500} />
                    <Button size="icon" className="bg-primary hover:bg-primary/90 text-white flex-shrink-0 self-end"
                      onClick={() => addComentario.mutate({ obraId, content: comment })}
                      disabled={!comment.trim() || addComentario.isPending}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className={`text-xs text-right ${comment.length >= 480 ? "text-yellow-400" : "text-muted-foreground"}`}>
                    {comment.length}/500
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">
                  <span className="text-primary cursor-pointer hover:underline" onClick={() => navigate("/login")}>
                    Faça login
                  </span>{" "}para comentar.
                </p>
              )}
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {comentarios.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Seja o primeiro a comentar!</p>
                ) : (
                  comentarios.map((c: any) => (
                    <div key={c.id} className="flex gap-3 group">
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center text-xs font-bold text-primary">
                        {(c.autorId ?? "?").toString().slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">
                          Usuário #{c.autorId} • {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                        <p className="text-sm text-white/80">{c.content}</p>
                      </div>
                      {isAdmin && (
                        <Button size="icon" variant="ghost"
                          className="w-7 h-7 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                          onClick={() => deleteComentario.mutate({ id: c.id })}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

