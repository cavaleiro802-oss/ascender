import { cfPagina, cfAvatar } from "@/lib/imageUtils";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, ArrowLeft, AlignJustify, MousePointer, MessageCircle, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AscenderLoader from "@/components/AscenderLoader";
import { useAuth } from "@/hooks/useAuth";

type Modo = "scroll" | "click";

export default function CapituloPage() {
  const { slug, numero } = useParams<{ slug: string; numero: string }>();
  const [, navigate] = useLocation();
  const [modo, setModo] = useState<Modo>(() =>
    (localStorage.getItem("asc_leitor_modo") as Modo) ?? "scroll"
  );
  const [paginaAtual, setPaginaAtual] = useState(0);
  const [cabecalhoVisivel, setCabecalhoVisivel] = useState(true);
  const [textoComentario, setTextoComentario] = useState("");
  const [lastScroll, setLastScroll] = useState(0);

  const { data: capitulo, isLoading } = trpc.capitulos.bySlugAndNumero.useQuery(
    { slug: slug ?? "", numero: parseFloat(numero ?? "0") }, { enabled: !!slug && !!numero }
  );
  const obraId = capitulo?.obraId;
  const capId  = capitulo?.id;
  const { data: todosCapitulos = [] } = trpc.capitulos.list.useQuery(
    { obraId: obraId ?? 0 }, { enabled: !!obraId }
  );
  const registrarView = trpc.capitulos.incrementViews.useMutation();
  const { user, isAuthenticated } = useAuth();
  const registrarHistorico = trpc.leitura.update.useMutation();
  const hasRegisteredHistory = useRef(false);

  useEffect(() => {
    if (capId) {
      registrarView.mutate({ id: capId });
      hasRegisteredHistory.current = false;
    }
  }, [slug, numero]);

  // [9] Registrar no histórico quando chegar ao fim (modo scroll = scroll para baixo; modo click = última página)
  function registrarLeitura() {
    if (!isAuthenticated || hasRegisteredHistory.current || !capId || !obraId) return;
    hasRegisteredHistory.current = true;
    registrarHistorico.mutate({
      capituloId: capId ?? 0,
      obraId: obraId ?? 0,
      progresso: 100,
    });
  }

  const paginas: string[] = capitulo?.paginas ? JSON.parse(capitulo.paginas) : [];
  const isNovel = !!(capitulo as any)?.conteudo && paginas.length === 0;

  // Incluir aprovado + aguardando (para tradutor_oficial e admins verem seus caps)
  const capsVisiveis = (todosCapitulos as any[])
    .filter((c) => c.status === "aprovado" || c.status === "aguardando")
    .sort((a, b) => a.numero - b.numero);
  const idx = capsVisiveis.findIndex((c) => c.id === capId);
  const capAnterior = capsVisiveis[idx - 1];
  const capProximo = capsVisiveis[idx + 1];

  useEffect(() => {
    if (modo !== "scroll") return;
    const handler = () => {
      const curr = window.scrollY;
      setCabecalhoVisivel(curr < lastScroll || curr < 80);
      setLastScroll(curr);
      // [9] Detectar fim da página
      const scrollBottom = window.scrollY + window.innerHeight;
      const pageHeight = document.documentElement.scrollHeight;
      if (scrollBottom >= pageHeight - 200) registrarLeitura();
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [modo, lastScroll]);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (modo !== "click") return;
    if (e.key === "ArrowRight") setPaginaAtual((p) => Math.min(p + 1, paginas.length - 1));
    if (e.key === "ArrowLeft") setPaginaAtual((p) => Math.max(p - 1, 0));
  }, [modo, paginas.length]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  function trocarModo(m: Modo) {
    setModo(m);
    localStorage.setItem("asc_leitor_modo", m);
    setPaginaAtual(0);
    window.scrollTo(0, 0);
  }

  function irCapitulo(cap: any) {
    navigate(`/obra/${slug}/capitulo/${cap.numero}`);
    setPaginaAtual(0);
    window.scrollTo(0, 0);
  }

  if (isLoading) return <AscenderLoader />;
  if (!capitulo) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white/50">
      Capítulo não encontrado.
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white select-none">

      {/* Cabeçalho flutuante */}
      <header className={`fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur border-b border-white/10 transition-transform duration-300 ${cabecalhoVisivel ? "translate-y-0" : "-translate-y-full"}`}>
        <div className="container flex items-center gap-3 h-12">
          <Button size="icon" variant="ghost" className="text-white/60 hover:text-white shrink-0"
            onClick={() => navigate(`/obra/${slug}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <p className="flex-1 text-sm text-white/70 truncate font-medium">
            Cap. {capitulo.numero}{capitulo.title ? ` — ${capitulo.title}` : ""}
          </p>
          <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-1">
            {!isNovel && (["scroll", "click"] as Modo[]).map((m) => (
              <button key={m} onClick={() => trocarModo(m)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${modo === m ? "bg-primary text-white" : "text-white/50 hover:text-white"}`}>
                {m === "scroll" ? <AlignJustify className="w-3 h-3" /> : <MousePointer className="w-3 h-3" />}
                {m === "scroll" ? "Scroll" : "Click"}
              </button>
            ))}
            {isNovel && (
              <span className="px-2.5 py-1 text-xs font-medium text-white/40">📖 Novel</span>
            )}
          </div>
        </div>
      </header>

      <div className="pt-12">
        {isNovel ? (
          <div className="max-w-2xl mx-auto px-5 py-8 pb-24">
            <div className="prose prose-invert prose-lg max-w-none">
              {((capitulo as any).conteudo as string).split("\n").map((paragrafo, i) =>
                paragrafo.trim() === "" ? (
                  <div key={i} className="h-4" />
                ) : (
                  <p key={i} className="text-white/85 leading-relaxed text-base mb-0">{paragrafo}</p>
                )
              )}
            </div>
          </div>
        ) : paginas.length === 0 ? (
          <div className="flex items-center justify-center min-h-[60vh] text-white/30 text-sm">
            Nenhuma página disponível.
          </div>
        ) : modo === "scroll" ? (
          <div className="flex flex-col items-center">
            {paginas.map((url, i) => (
              <img key={i} src={cfPagina(url)} alt={`Página ${i + 1}`}
                className="w-full max-w-2xl block"
                loading={i < 2 ? "eager" : "lazy"}
              />
            ))}
          </div>
        ) : (
          <div className="relative flex items-center justify-center min-h-[calc(100vh-3rem)]">
            <img src={cfPagina(paginas[paginaAtual])} alt={`Página ${paginaAtual + 1}`}
              className="max-h-[calc(100vh-3rem)] max-w-full object-contain"
            />
            {/* [6] Clicar na imagem só troca PÁGINA, nunca capítulo */}
            <button className="absolute left-0 top-0 w-1/3 h-full"
              onClick={() => setPaginaAtual((p) => Math.max(p - 1, 0))} />
            <button className="absolute right-0 top-0 w-1/3 h-full"
              onClick={() => {
                if (paginaAtual < paginas.length - 1) {
                  setPaginaAtual((p) => p + 1);
                } else {
                  // [9] Chegou na última página — registrar histórico mas NÃO avançar capítulo automaticamente
                  registrarLeitura();
                }
              }} />

            <div className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none">
              <div className="flex items-center gap-3 bg-black/80 backdrop-blur rounded-full px-5 py-2.5 border border-white/10 pointer-events-auto">
                <button onClick={() => setPaginaAtual((p) => Math.max(p - 1, 0))}
                  disabled={paginaAtual === 0}
                  className="text-white/70 hover:text-white disabled:opacity-25 transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-white/70 min-w-[70px] text-center tabular-nums">
                  {paginaAtual + 1} / {paginas.length}
                </span>
                <button onClick={() => setPaginaAtual((p) => Math.min(p + 1, paginas.length - 1))}
                  disabled={paginaAtual === paginas.length - 1}
                  className="text-white/70 hover:text-white disabled:opacity-25 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navegação entre capítulos */}
        <div className="flex items-center gap-3 p-4 max-w-xl mx-auto mt-6 mb-6">
          <Button variant="outline" className="flex-1 border-border text-white/60 hover:text-white"
            disabled={!capAnterior} onClick={() => capAnterior && irCapitulo(capAnterior)}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Cap. {capAnterior?.numero ?? "—"}
          </Button>
          <Button variant="outline" className="border-border text-white/60 hover:text-white px-4"
            onClick={() => navigate(`/obra/${slug}`)}>
            Voltar
          </Button>
          <Button variant="outline" className="flex-1 border-border text-white/60 hover:text-white"
            disabled={!capProximo} onClick={() => capProximo && irCapitulo(capProximo)}>
            Cap. {capProximo?.numero ?? "—"} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* [8] Comentários do capítulo */}
        <ComentariosCapitulo
          capituloId={parseInt(capId)}
          obraId={parseInt(obraId)}
        />
      </div>
    </div>
  );
}

// ─── Comentários do Capítulo ──────────────────────────────────────────────────
function ComentariosCapitulo({ capituloId, obraId }: { capituloId: number; obraId: number }) {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const { data: comentarios = [], isLoading } = trpc.comentarios.listByCapitulo.useQuery(
    { capituloId },
    { enabled: !!capituloId }
  );

  const criar = trpc.comentarios.create.useMutation({
    onSuccess: () => {
      utils.comentarios.listByCapitulo.invalidate({ capituloId });
      setTexto("");
      setEnviando(false);
    },
    onError: (e) => { alert(e.message); setEnviando(false); },
  });

  function enviar() {
    const t = texto.trim();
    if (!t || !isAuthenticated) return;
    setEnviando(true);
    criar.mutate({ obraId, capituloId, content: t });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-16">
      <div className="border-t border-white/10 pt-8">
        <h3 className="text-white font-bold text-base mb-5 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          Comentários ({comentarios.length})
        </h3>

        {/* Input de comentário */}
        {isAuthenticated ? (
          <div className="flex gap-2 mb-6">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && enviar()}
              placeholder="Escreva um comentário..."
              maxLength={500}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors"
            />
            <button
              onClick={enviar}
              disabled={!texto.trim() || enviando}
              className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-white rounded-xl px-4 py-2.5 transition-colors flex-shrink-0"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          <p className="text-white/30 text-sm mb-6 text-center py-4 border border-white/5 rounded-xl">
            Faça login para comentar
          </p>
        )}

        {/* Lista de comentários */}
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
        ) : comentarios.length === 0 ? (
          <p className="text-white/20 text-sm text-center py-8">Nenhum comentário ainda. Seja o primeiro!</p>
        ) : (
          <div className="space-y-3">
            {(comentarios as any[]).map((c) => {
              const cosmeticos = (() => { try { return JSON.parse(c.autorCosmeticos ?? "{}"); } catch { return {}; } })();
              const molduraUrl = cosmeticos?.moldura?.mediaUrl;
              const corComentario = cosmeticos?.cor_comentario?.mediaUrl;
              return (
                <div key={c.id} className="flex gap-3">
                  {/* Avatar com moldura */}
                  <div className="relative w-9 h-9 flex-shrink-0">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-primary/20 border border-primary/30">
                      {c.autorAvatar
                        ? <img src={cfAvatar(c.autorAvatar)} alt={c.autorNome} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-primary">{(c.autorNome?.[0] ?? "?").toUpperCase()}</div>
                      }
                    </div>
                    {molduraUrl && (
                      <img src={molduraUrl} alt="moldura" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ zIndex: 2, animation: "molduraGiro 8s linear infinite", transformOrigin: "center center" }} />
                    )}
                  </div>
                  {/* Balão do comentário */}
                  <div className="flex-1 bg-white/5 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-white/80">{c.autorNome ?? `Usuário #${c.autorId}`}</span>
                      <span className="text-[10px] text-white/20">
                        {new Date(c.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: corComentario ?? "rgba(255,255,255,0.82)" }}>{c.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
