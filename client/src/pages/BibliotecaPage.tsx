import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { BookOpen, Clock, Star, Play } from "lucide-react";
import { useLocation } from "wouter";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import AscenderLoader from "@/components/AscenderLoader";

function parseGenres(genres?: string | null): string[] {
  if (!genres) return [];
  try {
    const parsed = JSON.parse(genres);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export default function BibliotecaPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  const { data: favoritos = [] } = trpc.favoritos.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: historico = [] } = trpc.leitura.history.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (loading) {
    return (
      <div className="min-h-screen">
        <Topbar />
        <AscenderLoader inline text="Carregando biblioteca..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen">
        <Topbar />
        <div className="container py-20 text-center">
          <BookOpen className="w-12 h-12 text-primary/40 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Sua Biblioteca Pessoal</h2>
          <p className="text-muted-foreground mb-6">
            Faça login para acessar seus favoritos e histórico de leitura.
          </p>
          <Button
            className="bg-primary hover:bg-primary/90 text-white"
            onClick={() => (window.location.href = getLoginUrl())}
          >
            Entrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Topbar />

      <main className="container py-6">
        <h1 className="text-2xl font-black text-white mb-6">Minha Biblioteca</h1>

        <Tabs defaultValue="favoritos">
          <TabsList className="bg-secondary border-border mb-6">
            <TabsTrigger value="favoritos" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <Star className="w-4 h-4 mr-1.5" />
              Favoritos ({favoritos.length})
            </TabsTrigger>
            <TabsTrigger value="historico" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <Clock className="w-4 h-4 mr-1.5" />
              Histórico ({historico.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="favoritos">
            {favoritos.length === 0 ? (
              <div className="asc-card p-12 text-center">
                <Star className="w-10 h-10 text-primary/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Você ainda não favoritou nenhuma obra.</p>
                <Button
                  className="mt-4 bg-primary hover:bg-primary/90 text-white"
                  onClick={() => navigate("/")}
                >
                  Explorar catálogo
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {favoritos.map((fav: any) => (
                  <FavCard key={fav.id} obraId={fav.obraId} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="historico">
            {historico.length === 0 ? (
              <div className="asc-card p-12 text-center">
                <Clock className="w-10 h-10 text-primary/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Seu histórico de leitura está vazio.</p>
                <Button
                  className="mt-4 bg-primary hover:bg-primary/90 text-white"
                  onClick={() => navigate("/")}
                >
                  Começar a ler
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {historico.map((h: any) => (
                  <HistoricoCard key={h.id} entry={h} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function FavCard({ obraId }: { obraId: number }) {
  const [, navigate] = useLocation();
  const { data: obra } = trpc.obras.byId.useQuery({ id: obraId });

  if (!obra) return (
    <div className="asc-card overflow-hidden animate-pulse">
      <div className="aspect-[3/4] bg-secondary/50" />
      <div className="p-2 space-y-1.5">
        <div className="h-3 bg-white/10 rounded w-3/4" />
        <div className="h-2 bg-white/5 rounded w-1/2" />
      </div>
    </div>
  );

  const genres = parseGenres(obra.genres);
  const caps = (obra as any).ultimosCapitulos ?? [];

  return (
    <div
      onClick={() => navigate(`/obra/${obraId}`)}
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
        {obra.tipo === "novel" && (
          <div className="absolute top-2 left-2">
            <span className="bg-amber-600/90 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg">📖 NOVEL</span>
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
              <div key={cap.id}
                className="flex items-center justify-between text-[10px] hover:bg-white/5 rounded px-1 -mx-1 transition-colors"
                onClick={(e) => { e.stopPropagation(); navigate(`/obra/${obraId}/capitulo/${cap.id}`); }}>
                <span className="text-white/60 truncate">Cap. {cap.numero}</span>
                <span className="text-white/30 flex-shrink-0">
                  {new Date(cap.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </span>
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

function HistoricoCard({ entry }: { entry: any }) {
  const [, navigate] = useLocation();
  const { data: obra } = trpc.obras.byId.useQuery({ id: entry.obraId });
  const { data: cap } = trpc.capitulos.byId.useQuery({ id: entry.capituloId });

  if (!obra || !cap) return null;

  return (
    <div
      className="asc-tile p-3 flex gap-3 items-center cursor-pointer"
      onClick={() => navigate(`/obra/${entry.obraId}/capitulo/${entry.capituloId}`)}
    >
      <div className="asc-cover w-10 h-14 flex-shrink-0 flex items-center justify-center">
        <BookOpen className="w-4 h-4 text-primary/60" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white/90 truncate">{obra.title}</p>
        <p className="text-xs text-muted-foreground mb-1.5">
          Cap. {cap.numero} — {cap.title || `Capítulo ${cap.numero}`}
        </p>
        <Progress value={entry.progresso} className="h-1" />
        <p className="text-xs text-muted-foreground mt-0.5">{entry.progresso}% lido</p>
      </div>
    </div>
  );
}
