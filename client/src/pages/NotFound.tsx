import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-background/80">
      <div className="text-center px-4">
        <div className="mb-6">
          <h1 className="text-6xl font-black text-primary mb-2">404</h1>
          <h2 className="text-2xl font-bold text-white mb-2">Página não encontrada</h2>
          <p className="text-muted-foreground mb-6">
            Desculpe, a página que você está procurando não existe ou foi movida.
          </p>
        </div>

        <div className="flex gap-3 justify-center flex-wrap">
          <Button onClick={() => navigate("/")} className="bg-primary hover:bg-primary/90">
            Voltar ao Início
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Voltar
          </Button>
        </div>
      </div>
    </div>
  );
}
