import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, ChevronLeft, ChevronRight, ChevronDown,
  Flame, Clock, Eye, Loader2,
} from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

const GENRES = [
  "Ação", "Aventura", "Comédia", "Drama", "Fantasia",
  "Horror", "Mistério", "Romance", "Sci-Fi", "Slice of Life",
];

const CAROUSEL_SIZE = 20;
const INITIAL_RECENT = 12;
const LOAD_MORE = 12;

// ─── Badge NOVO: capítulo publicado há menos de 24h ──────────────────────────
function isNovo(dateStr: string | Date) {
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000;
}

// ─── Card estilo NexusToons ───────────────────────────────────────────────────
function ObraCard({ obra, onClick }: { obra: any; onClick: () => void }) {
  const caps = obra.ultimosCapitulos ?? [];
  const genres: string[] = obra.genres ? JSON.parse(obra.genres) : [];

  return (
    <div onClick={onClick}
      className="asc-card overflow-hidden cursor-pointer group transition-all duration-200 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10">
      {/* Capa */}
      <div className="relative aspect-[3/4] bg-secondary overflow-hidden">
        {obra.coverUrl ? (
          <img src={obra.coverUrl} alt={obra.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-secondary to-black/60 flex items-center justify-center">
            <span className="text-4xl opacity-20">📚</span>
          </div>
        )}
        {/* Badge gênero */}
        {genres[0] && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-2 py-1.5">
            <span className="text-[10px] text-white/80 font-medium">{genres[0]}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2">
        <p className="text-xs font-bold text-white leading-tight line-clamp-1 mb-1.5">{obra.title}</p>
        {caps.length > 0 ? (
          <div className="space-y-1">
            {caps.slice(0, 3).map((cap: any) => (
              <div key={cap.id}
                className="flex items-center justify-between text-[10px]"
                onClick={(e) => e.stopPropagation()}>
                <span className="text-white/60 truncate">Cap. {cap.numero}</span>
                {isNovo(cap.createdAt) ? (
                  <span className="bg-primary text-white text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0">NOVO</span>
                ) : (
                  <span className="text-white/30 flex-shrink-0">
                    {new Date(cap.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">Sem capítulos</p>
        )}
      </div>
    </div>
  );
}

// ─── Carrossel com setas ──────────────────────────────────────────────────────
function Carrossel({ obras, titulo, icone, onObraClick }: {
  obras: any[];
  titulo: string;
  icone: React.ReactNode;
  onObraClick: (id: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const SCROLL_AMOUNT = 320;

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -SCROLL_AMOUNT : SCROLL_AMOUNT, behavior: "smooth" });
  }

  if (obras.length === 0) return null;

  return (
    <section className="relative">
      <div className="flex items-center gap-2 mb-3">
        {icone}
        <h2 className="text-lg font-black text-white">{titulo}</h2>
        <span className="text-xs text-muted-foreground">{obras.length} obras</span>
      </div>

      <div className="relative group">
        {/* Seta esquerda */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-8 h-8 bg-black/80 border border-border rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/80 shadow-lg">
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Cards */}
        <div ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {obras.map((obra) => (
            <div key={obra.id} className="flex-shrink-0 w-36 sm:w-40">
              <ObraCard obra={obra} onClick={() => onObraClick(obra.id)} />
            </div>
          ))}
        </div>

        {/* Seta direita */}
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-8 h-8 bg-black/80 border border-border rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/80 shadow-lg">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Home() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState<string | undefined>();
  const [recentLimit, setRecentLimit] = useState(INITIAL_RECENT);
  const [loadingMore, setLoadingMore] = useState(false);
  const debouncedSearch = useDebounce(search, 350);

  const { data: hotObras = [] } = trpc.obras.list.useQuery({ sort: "hot", limit: CAROUSEL_SIZE });
  const { data: mostObras = [] } = trpc.obras.list.useQuery({ sort: "most", limit: CAROUSEL_SIZE });
  const { data: recentObras = [], isLoading } = trpc.obras.list.useQuery({
    sort: "recent",
    search: debouncedSearch || undefined,
    genre,
    limit: 200,
  });

  const visibleRecent = recentObras.slice(0, recentLimit);
  const hasMore = recentObras.length > recentLimit;

  function goObra(id: number) { navigate(`/obra/${id}`); }

  function loadMore() {
    setLoadingMore(true);
    setTimeout(() => { setRecentLimit((p) => p + LOAD_MORE); setLoadingMore(false); }, 250);
  }

  const buscando = !!(debouncedSearch || genre);

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="container py-6 space-y-10">

        {/* Busca + gêneros */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input value={search}
              onChange={(e) => { setSearch(e.target.value); setRecentLimit(INITIAL_RECENT); }}
              placeholder="Buscar obra ou autor..."
              className="pl-9 bg-secondary border-border text-white placeholder:text-muted-foreground" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {GENRES.map((g) => (
              <button key={g}
                onClick={() => { setGenre(genre === g ? undefined : g); setRecentLimit(INITIAL_RECENT); }}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  genre === g ? "bg-primary border-primary text-white" : "bg-transparent border-border text-white/60 hover:border-white/40 hover:text-white"
                }`}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Carrosséis — só aparecem sem busca ativa */}
        {!buscando && (
          <>
            <Carrossel obras={hotObras} titulo="Em Alta" icone={<Flame className="w-5 h-5 text-orange-400" />} onObraClick={goObra} />
            <Carrossel obras={mostObras} titulo="Mais Lidos" icone={<Eye className="w-5 h-5 text-blue-400" />} onObraClick={goObra} />
          </>
        )}

        {/* Lançamentos / Busca */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-black text-white">
              {buscando ? "Resultados" : "Lançamentos"}
            </h2>
            {recentObras.length > 0 && (
              <span className="text-xs text-muted-foreground">{recentObras.length} obra{recentObras.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : visibleRecent.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-muted-foreground">
                {debouncedSearch ? `Nada encontrado para "${debouncedSearch}"` : "Nenhuma obra publicada ainda."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {visibleRecent.map((obra) => (
                  <ObraCard key={obra.id} obra={obra} onClick={() => goObra(obra.id)} />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-8">
                  <Button variant="outline" onClick={loadMore} disabled={loadingMore}
                    className="border-border text-white/70 hover:text-white hover:bg-white/5 gap-2 px-10 py-5">
                    {loadingMore
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <ChevronDown className="w-4 h-4" />}
                    {loadingMore ? "Carregando..." : `Ver mais — ${recentObras.length - recentLimit} obras`}
                  </Button>
                </div>
              )}

              {!hasMore && recentObras.length > INITIAL_RECENT && (
                <p className="text-center text-xs text-muted-foreground mt-6">
                  ✓ Todas as {recentObras.length} obras exibidas
                </p>
              )}
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
