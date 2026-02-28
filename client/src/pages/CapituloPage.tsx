import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, ArrowLeft, AlignJustify, MousePointer } from "lucide-react";
import { Button } from "@/components/ui/button";
import AscenderLoader from "@/components/AscenderLoader";

type Modo = "scroll" | "click";

export default function CapituloPage() {
  const { obraId, capId } = useParams<{ obraId: string; capId: string }>();
  const [, navigate] = useLocation();
  const [modo, setModo] = useState<Modo>(() =>
    (localStorage.getItem("asc_leitor_modo") as Modo) ?? "scroll"
  );
  const [paginaAtual, setPaginaAtual] = useState(0);
  const [cabecalhoVisivel, setCabecalhoVisivel] = useState(true);
  const [lastScroll, setLastScroll] = useState(0);

  const { data: capitulo, isLoading } = trpc.capitulos.getById.useQuery(
    { id: parseInt(capId) }, { enabled: !!capId }
  );
  const { data: todosCapitulos = [] } = trpc.capitulos.listByObra.useQuery(
    { obraId: parseInt(obraId) }, { enabled: !!obraId }
  );
  const registrarView = trpc.capitulos.registrarView.useMutation();

  useEffect(() => {
    if (capId) registrarView.mutate({ capituloId: parseInt(capId) });
  }, [capId]);

  const paginas: string[] = capitulo?.paginas ? JSON.parse(capitulo.paginas) : [];
  const aprovados = (todosCapitulos as any[])
    .filter((c) => c.status === "aprovado")
    .sort((a, b) => a.numero - b.numero);
  const idx = aprovados.findIndex((c) => c.id === parseInt(capId));
  const capAnterior = aprovados[idx - 1];
  const capProximo = aprovados[idx + 1];

  useEffect(() => {
    if (modo !== "scroll") return;
    const handler = () => {
      const curr = window.scrollY;
      setCabecalhoVisivel(curr < lastScroll || curr < 80);
      setLastScroll(curr);
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
    navigate(`/obra/${obraId}/capitulo/${cap.id}`);
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
            onClick={() => navigate(`/obra/${obraId}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <p className="flex-1 text-sm text-white/70 truncate font-medium">
            Cap. {capitulo.numero}{capitulo.title ? ` — ${capitulo.title}` : ""}
          </p>
          <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-1">
            {(["scroll", "click"] as Modo[]).map((m) => (
              <button key={m} onClick={() => trocarModo(m)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${modo === m ? "bg-primary text-white" : "text-white/50 hover:text-white"}`}>
                {m === "scroll" ? <AlignJustify className="w-3 h-3" /> : <MousePointer className="w-3 h-3" />}
                {m === "scroll" ? "Scroll" : "Click"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="pt-12">
        {paginas.length === 0 ? (
          <div className="flex items-center justify-center min-h-[60vh] text-white/30 text-sm">
            Nenhuma página disponível.
          </div>
        ) : modo === "scroll" ? (
          /* ── MODO SCROLL ── */
          <div className="flex flex-col items-center">
            {paginas.map((url, i) => (
              <img key={i} src={url} alt={`Página ${i + 1}`}
                className="w-full max-w-2xl block"
                loading={i < 2 ? "eager" : "lazy"}
              />
            ))}
          </div>
        ) : (
          /* ── MODO CLICK ── */
          <div className="relative flex items-center justify-center min-h-[calc(100vh-3rem)]">
            <img src={paginas[paginaAtual]} alt={`Página ${paginaAtual + 1}`}
              className="max-h-[calc(100vh-3rem)] max-w-full object-contain"
            />
            {/* Zonas de clique invisíveis */}
            <button className="absolute left-0 top-0 w-1/3 h-full"
              onClick={() => setPaginaAtual((p) => Math.max(p - 1, 0))} />
            <button className="absolute right-0 top-0 w-1/3 h-full"
              onClick={() => setPaginaAtual((p) => Math.min(p + 1, paginas.length - 1))} />

            {/* Barra inferior */}
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
        <div className="flex items-center gap-3 p-4 max-w-xl mx-auto mt-6 mb-16">
          <Button variant="outline" className="flex-1 border-border text-white/60 hover:text-white"
            disabled={!capAnterior} onClick={() => capAnterior && irCapitulo(capAnterior)}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Cap. {capAnterior?.numero ?? "—"}
          </Button>
          <Button variant="outline" className="border-border text-white/60 hover:text-white px-4"
            onClick={() => navigate(`/obra/${obraId}`)}>
            Voltar
          </Button>
          <Button variant="outline" className="flex-1 border-border text-white/60 hover:text-white"
            disabled={!capProximo} onClick={() => capProximo && irCapitulo(capProximo)}>
            Cap. {capProximo?.numero ?? "—"} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
