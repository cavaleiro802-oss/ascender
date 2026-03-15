import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  BookOpen, ChevronRight, Eye, Flame, Heart, MessageSquare,
  Send, Star, Trash2, Pencil, X, Check, Reply,
  ChevronLeft, Camera,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import AscenderLoader from "@/components/AscenderLoader";
import { useLocation, useParams } from "wouter";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { uploadCapa } from "@/lib/upload";

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
  em_andamento: { label: "Em Andamento", cls: "text-green-400 border-green-500/40 bg-green-500/10" },
  hiato:        { label: "Hiato",        cls: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10" },
  finalizado:   { label: "Finalizado",   cls: "text-blue-400 border-blue-500/40 bg-blue-500/10" },
} as const;

const GENRES_LIST = [
  "Novel","Manhwar","Manga","Ação","Aventura","Comédia","Drama","Fantasia",
  "Horror","Mistério","Romance","Sci-Fi","Slice of Life","Culinaria",
  "Supernatural","Esportes","Histórico","Psicológico","Ecchi",
];

const CAPS_PER_PAGE = 40;

function Comentario({
  c, isAdmin, userId, obraId, onReply, onDelete,
}: {
  c: any; isAdmin: boolean; userId?: number; obraId: number;
  onReply: (id: number, nome: string) => void;
  onDelete: (id: number) => void;
}) {
  const nome = c.autorNome || `Usuário #${c.autorId}`;
  const inicial = nome.slice(0, 1).toUpperCase();
  return (
    <div className="flex gap-3 group">
      <div className="w-8 h-8 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center text-xs font-bold text-primary mt-0.5">
        {c.autorAvatar ? (
          <img src={c.autorAvatar} alt={nome} className="w-full h-full object-cover rounded-full" />
        ) : inicial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-white/80">{nome}</span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(c.createdAt).toLocaleDateString("pt-BR")}
          </span>
        </div>
        {c.parentId && c.parentAutorNome && (
          <p className="text-[11px] text-primary/60 mb-1 flex items-center gap-1">
            <Reply className="w-3 h-3" /> respondendo @{c.parentAutorNome}
          </p>
        )}
        <p className="text-sm text-white/75 leading-relaxed">{c.content}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <button onClick={() => onReply(c.id, nome)}
            className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
            <Reply className="w-3 h-3" /> Responder
          </button>
          {isAdmin && (
            <button onClick={() => onDelete(c.id)}
              className="text-[11px] text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100">
              <Trash2 className="w-3 h-3" /> Deletar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ObraPage() {
  const { id } = useParams<{ id: string }>();
  const obraId = parseInt(id ?? "0");
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const coverFileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"capitulos" | "comentarios">("capitulos");
  const [capPage, setCapPage] = useState(0);
  const [sinopseExpandida, setSinopseExpandida] = useState(false);
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: number; nome: string } | null>(null);
  const [editando, setEditando] = useState(false);
  const [editandoNumCap, setEditandoNumCap] = useState<number | null>(null); // id do cap sendo editado
  const [novoNumero, setNovoNumero] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editSynopsis, setEditSynopsis] = useState("");
  const [editAndamento, setEditAndamento] = useState<keyof typeof ANDAMENTO_CONFIG>("em_andamento");
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const isAdmin = user?.role === "admin_senhor" || user?.role === "admin_supremo";
  const isSupreme = user?.role === "admin_supremo";
  const isTranslator = ["tradutor_aprendiz","tradutor_oficial","admin_senhor","admin_supremo"].includes(user?.role ?? "");

  const { data: obra, isLoading } = trpc.obras.byId.useQuery({ id: obraId });
  const { data: capitulos = [] } = trpc.capitulos.list.useQuery({ obraId, includeAll: isTranslator });
  const { data: comentarios = [] } = trpc.comentarios.list.useQuery({ obraId });
  const { data: curtidaCount = 0 } = trpc.curtidas.count.useQuery({ obraId });
  const { data: isCurtido } = trpc.curtidas.status.useQuery({ obraId }, { enabled: isAuthenticated });
  const { data: isFav } = trpc.favoritos.status.useQuery({ obraId }, { enabled: isAuthenticated });

  const incrementViews = trpc.obras.incrementViews.useMutation();
  const toggleCurtida = trpc.curtidas.toggle.useMutation({
    onSuccess: () => { utils.curtidas.count.invalidate({ obraId }); utils.curtidas.status.invalidate({ obraId }); },
  });
  const toggleFav = trpc.favoritos.toggle.useMutation({
    onSuccess: () => utils.favoritos.status.invalidate({ obraId }),
  });
  const addComentario = trpc.comentarios.create.useMutation({
    onSuccess: () => { utils.comentarios.list.invalidate({ obraId }); setComment(""); setReplyTo(null); toast.success("Comentário enviado!"); },
  });
  const deleteComentario = trpc.comentarios.delete.useMutation({
    onSuccess: () => utils.comentarios.list.invalidate({ obraId }),
  });
  const updateObra = trpc.obras.update.useMutation({
    onSuccess: () => { utils.obras.byId.invalidate({ id: obraId }); setEditando(false); toast.success("Obra atualizada!"); },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => { if (obraId) incrementViews.mutate({ id: obraId }); }, [obraId]);

  const updateNumCap = trpc.capitulos.updateNumero.useMutation({
    onSuccess: () => {
      utils.capitulos.list.invalidate({ obraId });
      setEditandoNumCap(null);
      setNovoNumero("");
      toast.success("Número atualizado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const isOwnerOrAdmin = isTranslator && (obra?.authorId === user?.id || isAdmin);
  const genres = parseGenres(obra?.genres);
  const andamento = (obra as any)?.andamento as keyof typeof ANDAMENTO_CONFIG | undefined;
  const andamentoInfo = andamento ? ANDAMENTO_CONFIG[andamento] : null;
  const totalCapPages = Math.ceil(capitulos.length / CAPS_PER_PAGE);
  const capsPage = capitulos.slice(capPage * CAPS_PER_PAGE, (capPage + 1) * CAPS_PER_PAGE);
  const comentariosRaiz = comentarios.filter((c: any) => !c.parentId);
  const respostasPor = (parentId: number) => comentarios.filter((c: any) => c.parentId === parentId);

  function abrirEdicao() {
    if (!obra) return;
    setEditTitle(obra.title);
    setEditSynopsis(obra.synopsis ?? "");
    setEditAndamento((obra as any).andamento ?? "em_andamento");
    setEditGenres(parseGenres(obra.genres));
    setEditCoverPreview(obra.coverUrl ?? null);
    setEditCoverFile(null);
    setEditando(true);
  }

  function handleEditCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Máximo 10MB."); return; }
    setEditCoverFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setEditCoverPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function salvarEdicao() {
    if (!editTitle.trim()) return toast.error("Título obrigatório.");
    setSavingEdit(true);
    try {
      let coverUrl = (obra as any)?.coverUrl;
      if (editCoverFile) {
        const r = await uploadCapa(editCoverFile);
        coverUrl = r.publicUrl;
      }
      await updateObra.mutateAsync({
        id: obraId,
        title: editTitle.trim(),
        synopsis: editSynopsis.trim() || undefined,
        andamento: editAndamento,
        genres: editGenres,
        coverUrl,
      });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar.");
    } finally {
      setSavingEdit(false);
    }
  }

  function toggleEditGenre(g: string) {
    setEditGenres((p) => p.includes(g) ? p.filter((x) => x !== g) : p.length < 5 ? [...p, g] : p);
  }

  function handleReply(id: number, nome: string) {
    setReplyTo({ id, nome });
    setActiveTab("comentarios");
    setTimeout(() => document.getElementById("comment-input")?.focus(), 100);
  }

  function enviarComentario() {
    if (!comment.trim()) return;
    addComentario.mutate({ obraId, content: comment, parentId: replyTo?.id });
  }

  if (isLoading) return <div className="min-h-screen"><Topbar /><AscenderLoader inline text="Carregando obra..." /></div>;
  if (!obra) return (
    <div className="min-h-screen"><Topbar />
      <div className="container py-12 text-center">
        <p className="text-muted-foreground">Obra não encontrada.</p>
        <Button className="mt-4" onClick={() => navigate("/")}>Voltar</Button>
      </div>
    </div>
  );

  const sinopse = obra.synopsis ?? "";
  const sinopseCorta = sinopse.length > 180;

  return (
    <div className="min-h-screen">
      <Topbar />

      {/* ── Hero ── */}
      <div className="relative w-full" style={{ paddingBottom: 107 }}>
        {/* Fundo blur — overflow-hidden pra não vazar */}
        <div className="w-full overflow-hidden" style={{ height: 280 }}>
          {obra.coverUrl ? (
            <img
              src={obra.coverUrl} alt=""
              className="w-full h-full object-cover object-top scale-110"
              style={{ filter: "blur(18px) brightness(0.25)" }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-zinc-900 to-background" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-background" />
        </div>

        {/* Capa centralizada — flutua abaixo do hero sem ser cortada */}
        <div className="absolute left-1/2 -translate-x-1/2 z-10" style={{ bottom: 0 }}>
          <div className="relative w-32 sm:w-40 aspect-[3/4] rounded-xl overflow-hidden border-2 border-border shadow-2xl shadow-black">
            {obra.coverUrl ? (
              <img src={obra.coverUrl} alt={obra.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-secondary flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-primary/50" />
              </div>
            )}
            {isSupreme && (
              <button onClick={() => coverFileRef.current?.click()}
                className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </button>
            )}
          </div>
        </div>
        <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={handleEditCoverChange} />
      </div>

      <main className="container max-w-2xl mx-auto pt-6 pb-10 px-4">

        {/* Título e info */}
        <div className="text-center mb-5">
          <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
            {genres[0] && (
              <span className="bg-primary text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                {genres[0]}
              </span>
            )}
            {andamentoInfo && (
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${andamentoInfo.cls}`}>
                {andamentoInfo.label}
              </span>
            )}
            {(obra as any).tipo === "novel" && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border border-purple-500/40 bg-purple-500/10 text-purple-300">
                📖 Novel
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 leading-tight">{obra.title}</h1>
          <p className="text-sm text-muted-foreground mb-1">
            <BookOpen className="w-3.5 h-3.5 inline mr-1" />
            {capitulos.length} cap{capitulos.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground mt-2">
            <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{kk((obra as any).viewsTotal ?? 0)}</span>
            <span className="flex items-center gap-1 text-orange-400"><Flame className="w-3.5 h-3.5" />{kk((obra as any).viewsWeek ?? 0)}</span>
          </div>
        </div>

        {/* Sinopse */}
        {sinopse && (
          <div className="text-center mb-5">
            <p className="text-sm text-white/60 leading-relaxed">
              {sinopseCorta && !sinopseExpandida ? sinopse.slice(0, 180) + "..." : sinopse}
            </p>
            {sinopseCorta && (
              <button onClick={() => setSinopseExpandida((p) => !p)}
                className="text-xs text-primary hover:text-primary/80 mt-1 transition-colors">
                {sinopseExpandida ? "Ver menos" : "Ver mais"}
              </button>
            )}
          </div>
        )}

        {/* Gêneros */}
        {genres.length > 0 && (
          <div className="flex gap-1.5 flex-wrap justify-center mb-5">
            {genres.map((g) => (
              <span key={g} className="px-2.5 py-0.5 rounded-full text-xs border border-border text-white/60 bg-white/5">{g}</span>
            ))}
          </div>
        )}

        {/* Botões principais */}
        <div className="flex gap-3 mb-6">
          {capitulos.length > 0 && (
            <Button className="flex-1 bg-white/10 hover:bg-primary border border-white/20 hover:border-primary text-white font-bold gap-2 transition-all"
              onClick={() => navigate(`/obra/${obraId}/capitulo/${capitulos[0].id}`)}>
              <BookOpen className="w-4 h-4" /> Começar a Ler
            </Button>
          )}
          {isAuthenticated ? (
            <Button variant="outline"
              className={`flex-1 border-border bg-transparent font-bold gap-2 ${isFav ? "text-yellow-400 border-yellow-400/40" : "text-white/70"}`}
              onClick={() => toggleFav.mutate({ obraId })}>
              <Star className={`w-4 h-4 ${isFav ? "fill-yellow-400" : ""}`} />
              {isFav ? "Favoritado" : "Favoritar"}
            </Button>
          ) : (
            <Button variant="outline" className="flex-1 border-border bg-transparent text-white/70 font-bold gap-2"
              onClick={() => navigate("/login")}>
              <Star className="w-4 h-4" /> Favoritar
            </Button>
          )}
        </div>

        {/* Curtidas + Editar */}
        <div className="flex gap-2 mb-8">
          {isAuthenticated ? (
            <Button variant="outline" size="sm"
              className={`border-border bg-transparent ${isCurtido ? "text-red-400 border-red-400/40" : "text-white/50"}`}
              onClick={() => toggleCurtida.mutate({ obraId })}>
              <Heart className={`w-3.5 h-3.5 mr-1 ${isCurtido ? "fill-red-400" : ""}`} />
              {kk(curtidaCount)}
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="border-border bg-transparent text-white/50"
              onClick={() => navigate("/login")}>
              <Heart className="w-3.5 h-3.5 mr-1" />{kk(curtidaCount)}
            </Button>
          )}
          {(obra as any).originalAuthor && (
            <span className="text-xs text-muted-foreground self-center ml-1">por {(obra as any).originalAuthor}</span>
          )}
          {isSupreme && (
            <Button variant="outline" size="sm"
              className="border-border bg-transparent text-white/50 hover:text-white ml-auto gap-1.5"
              onClick={abrirEdicao}>
              <Pencil className="w-3.5 h-3.5" /> Editar
            </Button>
          )}
        </div>

        {/* Painel de edição */}
        {editando && isSupreme && (
          <div className="asc-card p-5 mb-6 border-primary/20 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">✏️ Editar Obra</h3>
              <button onClick={() => setEditando(false)} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            {editCoverPreview && editCoverFile && (
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                <img src={editCoverPreview} className="w-12 h-16 object-cover rounded" alt="nova capa" />
                <div>
                  <p className="text-xs text-white/60">Nova capa selecionada</p>
                  <button onClick={() => { setEditCoverFile(null); setEditCoverPreview(obra.coverUrl ?? null); }}
                    className="text-xs text-red-400 hover:text-red-300 mt-0.5">Remover</button>
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-white/50 mb-1 block">Título</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-secondary border-border text-white" maxLength={255} />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Sinopse</label>
              <textarea value={editSynopsis} onChange={(e) => setEditSynopsis(e.target.value)} rows={3} maxLength={2000}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-white text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Status</label>
              <div className="flex gap-2 flex-wrap">
                {(Object.entries(ANDAMENTO_CONFIG) as [keyof typeof ANDAMENTO_CONFIG, any][]).map(([val, cfg]) => (
                  <button key={val} onClick={() => setEditAndamento(val)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${editAndamento === val ? cfg.cls : "border-border text-white/40 hover:text-white"}`}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Gêneros (máx. 5)</label>
              <div className="flex flex-wrap gap-1.5">
                {GENRES_LIST.map((g) => (
                  <button key={g} onClick={() => toggleEditGenre(g)}
                    className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${editGenres.includes(g) ? "bg-primary border-primary text-white" : "border-border text-white/40 hover:text-white"}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="bg-primary text-white" onClick={salvarEdicao} disabled={savingEdit}>
                <Check className="w-3.5 h-3.5 mr-1" />{savingEdit ? "Salvando..." : "Salvar"}
              </Button>
              <Button size="sm" variant="ghost" className="text-white/50" onClick={() => setEditando(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* Abas */}
        <div className="flex border-b border-border mb-5">
          {[
            { key: "capitulos", label: `Capítulos (${capitulos.length})`, icon: <BookOpen className="w-4 h-4" /> },
            { key: "comentarios", label: `Comentários (${comentarios.length})`, icon: <MessageSquare className="w-4 h-4" /> },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.key ? "border-primary text-white" : "border-transparent text-muted-foreground hover:text-white"
              }`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Capítulos */}
        {activeTab === "capitulos" && (
          <div className="space-y-1">
            {isOwnerOrAdmin && (
              <div className="flex justify-end mb-3">
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-white text-xs"
                  onClick={() => navigate(`/obra/${obraId}/novo-capitulo`)}>
                  + Novo Capítulo
                </Button>
              </div>
            )}
            {capitulos.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-10">Nenhum capítulo disponível ainda.</p>
            ) : (
              <>
                {capsPage.map((cap: any) => (
                  <div key={cap.id}
                    className="flex items-center justify-between px-3 py-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group border border-transparent hover:border-border/50"
                    onClick={() => navigate(`/obra/${obraId}/capitulo/${cap.id}`)}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {editandoNumCap === cap.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number" step="0.1" autoFocus
                            value={novoNumero}
                            onChange={(e) => setNovoNumero(e.target.value)}
                            className="w-16 text-xs bg-secondary border border-primary rounded px-1.5 py-0.5 text-white text-center"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && novoNumero) updateNumCap.mutate({ id: cap.id, numero: parseFloat(novoNumero) });
                              if (e.key === "Escape") { setEditandoNumCap(null); setNovoNumero(""); }
                            }}
                          />
                          <button onClick={() => novoNumero && updateNumCap.mutate({ id: cap.id, numero: parseFloat(novoNumero) })}
                            className="text-[10px] text-green-400 hover:text-green-300 font-bold">✓</button>
                          <button onClick={() => { setEditandoNumCap(null); setNovoNumero(""); }}
                            className="text-[10px] text-red-400 hover:text-red-300 font-bold">✕</button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground w-8 text-right font-mono">{cap.numero}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-white/80 group-hover:text-white transition-colors">
                          {cap.title || `Capítulo ${cap.numero}`}
                        </span>
                        {cap.status === "aguardando" && (
                          <span className="ml-2 text-[10px] text-yellow-400 font-semibold">⏳ Pendente</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Eye className="w-3 h-3" />{kk((cap as any).viewsTotal ?? 0)}
                      {isOwnerOrAdmin && editandoNumCap !== cap.id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditandoNumCap(cap.id); setNovoNumero(String(cap.numero)); }}
                          className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-primary transition-all ml-1"
                          title="Editar número">
                          ✏️
                        </button>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />
                    </div>
                  </div>
                ))}
                {totalCapPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <button onClick={() => setCapPage((p) => Math.max(0, p - 1))} disabled={capPage === 0}
                      className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-white/50 hover:text-white hover:border-white/40 disabled:opacity-30 transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: totalCapPages }, (_, i) => (
                      <button key={i} onClick={() => setCapPage(i)}
                        className={`w-8 h-8 rounded-full text-xs font-bold border transition-colors ${
                          capPage === i ? "bg-primary border-primary text-white" : "border-border text-white/50 hover:text-white hover:border-white/40"
                        }`}>
                        {i + 1}
                      </button>
                    ))}
                    <button onClick={() => setCapPage((p) => Math.min(totalCapPages - 1, p + 1))} disabled={capPage === totalCapPages - 1}
                      className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-white/50 hover:text-white hover:border-white/40 disabled:opacity-30 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab: Comentários */}
        {activeTab === "comentarios" && (
          <div className="space-y-5">
            {isAuthenticated ? (
              <div className="space-y-2">
                {replyTo && (
                  <div className="flex items-center gap-2 text-xs text-primary/70 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                    <Reply className="w-3.5 h-3.5" />
                    Respondendo @{replyTo.nome}
                    <button onClick={() => setReplyTo(null)} className="ml-auto text-white/40 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Textarea
                    id="comment-input"
                    value={comment}
                    onChange={(e) => setComment(e.target.value.slice(0, 500))}
                    placeholder={replyTo ? `Respondendo @${replyTo.nome}...` : "Escreva um comentário..."}
                    className="bg-secondary border-border text-white placeholder:text-muted-foreground resize-none text-sm"
                    rows={2}
                  />
                  <Button size="icon"
                    className="bg-primary hover:bg-primary/90 text-white flex-shrink-0 self-end"
                    onClick={enviarComentario}
                    disabled={!comment.trim() || addComentario.isPending}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <p className={`text-xs text-right ${comment.length >= 480 ? "text-yellow-400" : "text-muted-foreground"}`}>
                  {comment.length}/500
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                <span className="text-primary cursor-pointer hover:underline" onClick={() => navigate("/login")}>Faça login</span>{" "}para comentar.
              </p>
            )}
            <div className="space-y-4">
              {comentariosRaiz.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">Seja o primeiro a comentar!</p>
              ) : (
                comentariosRaiz.map((c: any) => (
                  <div key={c.id}>
                    <Comentario
                      c={c} isAdmin={isAdmin} userId={user?.id} obraId={obraId}
                      onReply={handleReply}
                      onDelete={(cid) => deleteComentario.mutate({ id: cid })}
                    />
                    {respostasPor(c.id).length > 0 && (
                      <div className="ml-11 mt-3 space-y-3 border-l-2 border-border/40 pl-4">
                        {respostasPor(c.id).map((r: any) => (
                          <Comentario key={r.id}
                            c={r} isAdmin={isAdmin} userId={user?.id} obraId={obraId}
                            onReply={handleReply}
                            onDelete={(cid) => deleteComentario.mutate({ id: cid })}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

