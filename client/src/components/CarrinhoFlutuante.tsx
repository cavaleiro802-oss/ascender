import { ShoppingBag } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function CarrinhoFlutuante() {
  const [location, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  // Não mostrar na própria página da loja
  if (location === "/loja") return null;

  return (
    <button
      onClick={() => navigate("/loja")}
      className="fixed bottom-6 right-6 z-50 group"
      aria-label="Abrir loja"
    >
      <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/30 flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:shadow-primary/50 group-active:scale-95">
        <ShoppingBag className="w-6 h-6 text-white" />
        {/* Brilho animado */}
        <span className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      {/* Tooltip */}
      <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-card border border-border text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        Loja ASCENDER
      </span>
    </button>
  );
}
