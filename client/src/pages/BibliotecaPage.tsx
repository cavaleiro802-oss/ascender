import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { BookOpen, Clock, Star } from "lucide-react";
import { useLocation } from "wouter";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import AscenderLoader from "@/components/AscenderLoader";

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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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

  if (!obra) return null;

  return (
    <div
      className="asc-tile p-3 flex gap-3 items-start cursor-pointer"
      onClick={() => navigate(`/obra/${obraId}`)}
    >
      <div className="asc-cover w-12 h-16 flex-shrink-0 flex items-center justify-center">
        <BookOpen className="w-5 h-5 text-primary/60" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white/90 line-clamp-2 mb-1">{obra.title}</p>
        <p className="text-xs text-muted-foreground">{obra.status === "aprovada" ? "Disponível" : obra.status}</p>
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