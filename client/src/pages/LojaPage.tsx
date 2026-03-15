import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import Topbar from "@/components/Topbar";
import { ShoppingBag, Coins, Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const TIPO_LABELS: Record<string, string> = {
  moldura: "🖼️ Moldura",
  banner: "🎬 Banner",
  cor_comentario: "🎨 Cor Comentário",
  tag: "🏷️ Tag",
};

const RARIDADE_CLS: Record<string, { label: string; cls: string; border: string }> = {
  comum:    { label: "Comum",    cls: "text-white/50",   border: "border-white/10"    },
  raro:     { label: "Raro",     cls: "text-blue-400",   border: "border-blue-500/30" },
  epico:    { label: "Épico",    cls: "text-purple-400", border: "border-purple-500/30"},
  lendario: { label: "Lendário", cls: "text-yellow-400", border: "border-yellow-500/40"},
};

export default function LojaPage() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [filtro, setFiltro] = useState("todos");
  const [comprando, setComprando] = useState<number | null>(null);

  const { data: itens = [], isLoading } = trpc.loja.listItens.useQuery(
    { tipo: filtro !== "todos" ? filtro : undefined }
  );
  const { data: meusItens = [] } = trpc.loja.meusItens.useQuery(undefined, { enabled: isAuthenticated });
  const { data: moedas = 0 } = trpc.loja.minhasMoedas.useQuery(undefined, { enabled: isAuthenticated });

  const comprar  = trpc.loja.comprar.useMutation({
    onSuccess: () => {
      utils.loja.meusItens.invalidate();
      utils.loja.minhasMoedas.invalidate();
      toast.success("Item comprado!");
      setComprando(null);
    },
    onError: (e) => { toast.error(e.message); setComprando(null); },
  });
  const equipar  = trpc.loja.equipar.useMutation({
    onSuccess: () => { utils.loja.meusItens.invalidate(); toast.success("Item equipado!"); },
    onError: (e) => toast.error(e.message),
  });
  const desequipar = trpc.loja.desequipar.useMutation({
    onSuccess: () => { utils.loja.meusItens.invalidate(); toast.success("Item removido!"); },
    onError: (e) => toast.error(e.message),
  });

  const meuItemMap = new Map(meusItens.map((i: any) => [i.itemId, i]));

  const itensVisiveis = (itens as any[]).filter((i) => i.ativo);

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="container py-6 max-w-screen-xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-black text-white">Loja ASCENDER</h1>
          </div>
          {isAuthenticated && (
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-2">
              <span className="text-yellow-400 text-lg">🪙</span>
              <span className="text-yellow-400 font-black text-lg">{moedas}</span>
              <span className="text-yellow-400/60 text-sm">moedas</span>
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 flex-wrap mb-6">
          {["todos", ...Object.keys(TIPO_LABELS)].map((t) => (
            <button key={t} onClick={() => setFiltro(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filtro === t
                  ? "bg-primary border-primary text-white"
                  : "bg-transparent border-border text-white/60 hover:border-white/40 hover:text-white"
              }`}>
              {t === "todos" ? "✨ Todos" : TIPO_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Grid de itens */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : itensVisiveis.length === 0 ? (
          <div className="asc-card p-16 text-center">
            <Sparkles className="w-10 h-10 text-primary/30 mx-auto mb-4" />
            <p className="text-white/40 font-semibold">Nenhum item disponível ainda.</p>
            <p className="text-white/20 text-sm mt-1">Novos itens chegando em breve!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {itensVisiveis.map((item: any) => {
              const meuItem   = meuItemMap.get(item.id);
              const tenho     = !!meuItem;
              const equipado  = meuItem?.equipado;
              const rar       = RARIDADE_CLS[item.raridade] ?? RARIDADE_CLS.comum;
              const isVideo   = item.mediaUrl?.match(/\.(mp4|webm)$/i);
              const semMoedas = isAuthenticated && moedas < item.preco && !item.gratuito;

              return (
                <div key={item.id}
                  className={`asc-card overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${equipado ? "border-primary/50 shadow-primary/10" : rar.border}`}>

                  {/* Preview */}
                  <div className="relative aspect-square bg-black/30 overflow-hidden">
                    {isVideo ? (
                      <video src={item.mediaUrl} className="w-full h-full object-contain" autoPlay muted loop playsInline />
                    ) : (
                      <img src={item.mediaUrl} alt={item.nome} className="w-full h-full object-contain p-2" />
                    )}
                    {equipado && (
                      <div className="absolute top-2 right-2 bg-primary rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {item.gratuito && (
                      <div className="absolute top-2 left-2 bg-green-600/90 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                        GRÁTIS
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <div>
                      <p className="text-sm font-bold text-white leading-tight line-clamp-1">{item.nome}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] font-bold ${rar.cls}`}>{rar.label}</span>
                        <span className="text-white/20 text-[10px]">·</span>
                        <span className="text-[10px] text-white/40">{TIPO_LABELS[item.tipo]}</span>
                      </div>
                    </div>

                    {/* Preço */}
                    <div className="text-sm font-black text-yellow-400">
                      {item.gratuito ? (
                        <span className="text-green-400">🎁 Gratuito</span>
                      ) : (
                        <span className="flex items-center gap-1">🪙 {item.preco}</span>
                      )}
                    </div>

                    {/* Botão */}
                    {!isAuthenticated ? (
                      <Button size="sm" variant="outline" className="border-border text-white/40 text-xs mt-auto" disabled>
                        Faça login
                      </Button>
                    ) : tenho ? (
                      <Button size="sm"
                        className={`text-xs mt-auto ${equipado ? "bg-primary/20 border border-primary/50 text-primary hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40" : "bg-primary hover:bg-primary/90 text-white"}`}
                        onClick={() => equipado ? desequipar.mutate({ itemId: item.id }) : equipar.mutate({ itemId: item.id })}>
                        {equipado ? "✓ Equipado — Remover" : "Equipar"}
                      </Button>
                    ) : (
                      <Button size="sm"
                        disabled={semMoedas || comprando === item.id}
                        className={`text-xs mt-auto ${semMoedas ? "opacity-40" : "bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 text-white"}`}
                        onClick={() => { setComprando(item.id); comprar.mutate({ itemId: item.id }); }}>
                        {comprando === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : semMoedas ? "Sem moedas" : "Comprar"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

