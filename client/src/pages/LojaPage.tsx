import { useLocation } from "wouter";
import Topbar from "@/components/Topbar";
import { ShoppingBag, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LojaPage() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="container max-w-2xl mx-auto py-20 px-4 text-center">
        <div className="asc-card p-10 flex flex-col items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-600/20 border border-primary/20 flex items-center justify-center">
            <ShoppingBag className="w-10 h-10 text-primary" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-primary uppercase tracking-widest">Em Breve</span>
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-3xl font-black text-white mb-3">Loja ASCENDER</h1>
            <p className="text-white/50 text-sm leading-relaxed max-w-md mx-auto">
              Molduras animadas, banners de comentário, tags exclusivas e muito mais.
              Personalize sua experiência na plataforma.
            </p>
          </div>
          <Button onClick={() => navigate("/")} variant="outline" className="border-border text-white/60 hover:text-white">
            Voltar ao Início
          </Button>
        </div>
      </main>
    </div>
  );
}
