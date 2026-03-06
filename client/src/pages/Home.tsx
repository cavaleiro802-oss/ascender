import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, ChevronLeft, ChevronRight, ChevronDown,
  Flame, Clock, Eye, Loader2, BookOpen, Play, X, Swords,
} from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

const GENRES = [
  "Novel", "Manhwar", "Ação", "Aventura", "Comédia", "Drama", "Fantasia",
  "Mangá", "Horror", "Mistério", "Romance", "Sci-Fi", "Slice of Life", "Culinaria",
];

const CAROUSEL_SIZE = 20;
const INITIAL_RECENT = 12;
const LOAD_MORE = 12;
const HERO_INTERVAL = 5000;
const BANNER_INTERVAL_MS = 60 * 60 * 1000;

function isNovo(dateStr: string | Date) {
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000;
}

function parseGenres(genres?: string | null): string[] {
  if (!genres) return [];
  try {
    const parsed = JSON.parse(genres);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

// ─── Banner ASCENDER ──────────────────────────────────────────────────────────
function AscenderBanner({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation();
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 p-[1px]">
      {/* Borda gradiente animada */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/40 via-purple-500/30 to-primary/40 opacity-60" />
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#0d0010] via-[#110016] to-[#0a000d] p-5 sm:p-7">
        {/* Glow de fundo */}
        <div className="absolute top-0 left-1/4 w-64 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-48 h-24 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white/30 hover:text-white transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-5 relative z-10">
          {/* Ícone */}
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-purple-600/30 border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/20">
              <Swords className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
          </div>

          {/* Texto */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-xs text-primary/80 font-bold uppercase tracking-[0.2em] mb-1">
              ⚔ ASCENDER
            </p>
            <h3 className="text-white font-black text-base sm:text-xl leading-tight mb-1">
              Onde leitores se tornam tradutores
            </h3>
            <p className="text-white/40 text-xs hidden sm:block">
              Junte-se à comunidade e contribua com traduções
            </p>
          </div>

          {/* Botão */}
          <Button
            size="sm"
            className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 text-white font-bold flex-shrink-0 shadow-lg shadow-primary/30 border-0 px-4 sm:px-6"
            onClick={() => navigate("/perfil")}
          >
            Começar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Hero Banner ──────────────────────────────────────────────────────────────
function HeroBanner({ obras, onObraClick }: { obras: any[]; onObraClick: (id: number) => void }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (obras.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % obras.length), HERO_INTERVAL);
    return () => clearInterval(t);
  }, [obras.length]);

  if (obras.length === 0) return null;
  const obra = obras[idx];
  const genres = parseGenres(obra.genres);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl" style={{ minHeight: 300 }}>
      {/* BG blur */}
      <div className="absolute inset-0">
        {obra.coverUrl ? (
          <img src={obra.coverUrl} alt="" className="w-full h-full object-cover object-top scale-110 blur-md opacity-30" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/20" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex items-center gap-6 sm:gap-10 p-6 sm:p-10 lg:p-14" style={{ minHeight: 300 }}>
        {/* Cover */}
        <div className="flex-shrink-0 w-28 sm:w-40 lg:w-48 aspect-[3/4] rounded-xl overflow-hidden border-2 border-white/10 shadow-2xl shadow-black/60">
          {obra.coverUrl ? (
            <img src={obra.coverUrl} alt={obra.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-primary/50" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 max-w-xl">
          {genres[0] && (
            <span className="inline-block bg-primary text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest mb-3 shadow-lg shadow-primary/30">
              {genres[0]}
            </span>
          )}
          <h2 className="text-white font-black text-2xl sm:text-3xl lg:text-4xl leading-tight mb-3 line-clamp-2 drop-shadow-lg">
            {obra.title}
          </h2>
          {obra.synopsis && (
            <p className="text-white/50 text-sm leading-relaxed line-clamp-2 mb-4 hidden sm:block">
              {obra.synopsis}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-white/40 mb-5">
            <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />{obra.viewsTotal?.toLocaleString() ?? 0} views</span>
          </div>
          <Button
            className="bg-white/10 hover:bg-primary border border-white/20 hover:border-primary text-white font-bold gap-2.5 backdrop-blur-sm transition-all duration-300 shadow-lg px-6 py-5 text-sm"
            onClick={() => onObraClick(obra.id)}
          >
            <Play className="w-4 h-4 fill-white" />
            LER AGORA
          </Button>
        </div>
      </div>

      {/* Dots */}
      {obras.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {obras.slice(0, 6).map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? "w-8 bg-primary shadow-lg shadow-primary/50" : "w-1.5 bg-white/20 hover:bg-white/40"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card de obra ─────────────────────────────────────────────────────────────
function ObraCard({ obra, onClick }: { obra: any; onClick: () => void }) {
  const caps = obra.ultimosCapitulos ?? [];
  const genres = parseGenres(obra.genres);

  return (
    <div
      onClick={onClick}
      className="asc-card overflow-hidden cursor-pointer group transition-all duration-200 hover:border-primary/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10"
    >
      <div className="relative aspect-[3/4] bg-secondary overflow-hidden">
        {obra.coverUrl ? (
          <img
            src={obra.coverUrl}
            alt={obra.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-secondary to-black/60 flex items-center justify-center">
            <span className="text-4xl opacity-20">📚</span>
          </div>
        )}
        {genres[0] && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-2 py-1.5">
            <span className="text-[10px] text-white/80 font-medium">{genres[0]}</span>
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-xs font-bold text-white leading-tight line-clamp-1 mb-1.5">{obra.title}</p>
        {caps.length > 0 ? (
          <div className="space-y-1">
            {caps.slice(0, 3).map((cap: any) => (
              <div key={cap.id} className="flex items-center justify-between text-[10px]" onClick={(e) => e.stopPropagation()}>
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

// ─── Carrossel horizontal ─────────────────────────────────────────────────────
function Carrossel({ obras, titulo, icone, onObraClick }: {
  obras: any[];
  titulo: string;
  icone: React.ReactNode;
  onObraClick: (id: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const SCROLL_AMOUNT = 340;

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -SCROLL_AMOUNT : SCROLL_AMOUNT, behavior: "smooth" });
  }

  if (obras.length === 0) return null;

  return (
    <section className="relative">
      <div className="flex items-center gap-2.5 mb-4">
        {icone}
        <h2 className="text-base sm:text-lg font-black text-white">{titulo}</h2>
        <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">{obras.length}</span>
      </div>
      <div className="relative group">
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-9 h-9 bg-black/90 border border-border rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:border-primary shadow-xl"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {obras.map((obra) => (
            <div key={obra.id} className="flex-shrink-0 w-36 sm:w-40 lg:w-44">
              <ObraCard obra={obra} onClick={() => onObraClick(obra.id)} />
            </div>
          ))}
        </div>
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-9 h-9 bg-black/90 border border-border rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:border-primary shadow-xl"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Home() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState<string | undefined>();
  const [recentLimit, setRecentLimit] = useState(INITIAL_RECENT);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const debouncedSearch = useDebounce(search, 350);
  const isTranslator = isAuthenticated && user?.role !== "usuario";
  const buscando = !!(debouncedSearch || genre);

  useEffect(() => {
    const lastSeen = parseInt(localStorage.getItem("asc_banner_seen") ?? "0");
    if (Date.now() - lastSeen > BANNER_INTERVAL_MS) setShowBanner(true);
  }, []);

  function closeBanner() {
    localStorage.setItem("asc_banner_seen", String(Date.now()));
    setShowBanner(false);
  }

  const { data: hotObras = [] } = trpc.obras.list.useQuery({ sort: "hot", limit: CAROUSEL_SIZE });
  const { data: mostObras = [] } = trpc.obras.list.useQuery({ sort: "most", limit: CAROUSEL_SIZE });
  const { data: minhasObras = [] } = trpc.obras.minhas.useQuery(undefined, { enabled: isTranslator });
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

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="container py-6 space-y-8 max-w-screen-xl mx-auto">

        {/* Barra de busca — sempre no topo */}
        <div className="relative max-w-2xl mx-auto lg:mx-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setRecentLimit(INITIAL_RECENT); }}
            placeholder="Buscar obra ou autor..."
            className="pl-10 bg-secondary border-border text-white placeholder:text-muted-foreground h-11 rounded-xl"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setRecentLimit(INITIAL_RECENT); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filtros de gênero — só aparecem ao buscar */}
        {buscando && (
          <div className="flex gap-2 flex-wrap">
            {GENRES.map((g) => (
              <button
                key={g}
                onClick={() => { setGenre(genre === g ? undefined : g); setRecentLimit(INITIAL_RECENT); }}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  genre === g
                    ? "bg-primary border-primary text-white"
                    : "bg-transparent border-border text-white/60 hover:border-white/40 hover:text-white"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        {/* Conteúdo principal — só sem busca ativa */}
        {!buscando && (
          <>
            {/* Hero */}
            {hotObras.length > 0 && <HeroBanner obras={hotObras.slice(0, 6)} onObraClick={goObra} />}

            {/* Banner ASCENDER */}
            {showBanner && <AscenderBanner onClose={closeBanner} />}

            {/* Carrosséis */}
            {isTranslator && minhasObras.length > 0 && (
              <Carrossel
                obras={minhasObras}
                titulo="Minhas Obras"
                icone={<BookOpen className="w-5 h-5 text-purple-400" />}
                onObraClick={goObra}
              />
            )}
            <Carrossel obras={hotObras} titulo="Em Alta" icone={<Flame className="w-5 h-5 text-orange-400" />} onObraClick={goObra} />
            <Carrossel obras={mostObras} titulo="Mais Lidos" icone={<Eye className="w-5 h-5 text-blue-400" />} onObraClick={goObra} />
          </>
        )}

        {/* Lançamentos / Resultados */}
        <section>
          <div className="flex items-center gap-2.5 mb-5">
            <Clock className="w-5 h-5 text-green-400" />
            <h2 className="text-base sm:text-lg font-black text-white">
              {buscando ? "Resultados da busca" : "Lançamentos"}
            </h2>
            {recentObras.length > 0 && (
              <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                {recentObras.length} obra{recentObras.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : visibleRecent.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">🔍</p>
              <p className="text-white/60 font-semibold mb-1">
                {debouncedSearch ? `Nada encontrado para "${debouncedSearch}"` : "Nenhuma obra publicada ainda."}
              </p>
              {debouncedSearch && (
                <p className="text-white/30 text-sm">Tente outro termo ou remova os filtros</p>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4">
                {visibleRecent.map((obra) => (
                  <ObraCard key={obra.id} obra={obra} onClick={() => goObra(obra.id)} />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center mt-10">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="border-border text-white/70 hover:text-white hover:bg-white/5 gap-2 px-12 py-5 rounded-xl"
                  >
                    {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                    {loadingMore ? "Carregando..." : `Ver mais — ${recentObras.length - recentLimit} obras`}
                  </Button>
                </div>
              )}
              {!hasMore && recentObras.length > INITIAL_RECENT && (
                <p className="text-center text-xs text-muted-foreground mt-8">
                  ✓ Todas as {recentObras.length} obras exibidas
                </p>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
