import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import Topbar from "@/components/Topbar";
import { ShoppingBag, Check, Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

const TIPO_LABELS: Record<string, { label: string; icon: string }> = {
  moldura:        { label: "MOLDURAS",        icon: "🖼️" },
  banner:         { label: "BANNERS",         icon: "🎬" },
  cor_comentario: { label: "CORES",           icon: "🎨" },
  tag:            { label: "TAGS",            icon: "🏷️" },
};

const RARIDADE_CLS: Record<string, { label: string; cls: string }> = {
  comum:    { label: "Comum",    cls: "text-white/40"   },
  raro:     { label: "Raro",     cls: "text-blue-400"   },
  epico:    { label: "Épico",    cls: "text-purple-400" },
  lendario: { label: "Lendário", cls: "text-yellow-400" },
};

export default function LojaPage() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [filtro, setFiltro] = useState("todos");
  const [comprando, setComprando] = useState<number | null>(null);

  const { data: itens = [], isLoading } = trpc.loja.listItens.useQuery(
    { tipo: filtro !== "todos" ? filtro : undefined }
  );
  const { data: meusItens = [] }  = trpc.loja.meusItens.useQuery(undefined, { enabled: isAuthenticated });
  const { data: moedas = 0 }      = trpc.loja.minhasMoedas.useQuery(undefined, { enabled: isAuthenticated });

  const comprar    = trpc.loja.comprar.useMutation({
    onSuccess: () => { utils.loja.meusItens.invalidate(); utils.loja.minhasMoedas.invalidate(); toast.success("Item comprado!"); setComprando(null); },
    onError:   (e) => { toast.error(e.message); setComprando(null); },
  });
  const equipar    = trpc.loja.equipar.useMutation({
    onSuccess: () => { utils.loja.meusItens.invalidate(); toast.success("Item equipado!"); },
    onError:   (e) => toast.error(e.message),
  });
  const desequipar = trpc.loja.desequipar.useMutation({
    onSuccess: () => { utils.loja.meusItens.invalidate(); toast.success("Item removido!"); },
    onError:   (e) => toast.error(e.message),
  });

  const meuItemMap   = new Map((meusItens as any[]).map((i) => [i.itemId, i]));
  const itensVisiveis = (itens as any[]).filter((i) => i.ativo);

  return (
    <div className="min-h-screen bg-black">
      <Topbar />

      {/* Hero da loja */}
      <div className="flex flex-col items-center pt-10 pb-6 px-4">
        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
          <ShoppingBag className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-black text-white tracking-widest uppercase mb-1">Loja</h1>
        <p className="text-xs text-white/40 uppercase tracking-[0.3em] font-semibold">Personalize sua experiência</p>

        {isAuthenticated && (
          <div className="mt-4 flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-5 py-2">
            <span className="text-yellow-400">🪙</span>
            <span className="text-yellow-400 font-black text-base">{moedas}</span>
            <span className="text-yellow-400/50 text-xs">moedas</span>
          </div>
        )}
      </div>

      {/* Filtros com scroll horizontal */}
      <div className="overflow-x-auto px-4 pb-4" style={{ scrollbarWidth: "none" }}>
        <div className="flex gap-2 w-max">
          <button
            onClick={() => setFiltro("todos")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all whitespace-nowrap ${
              filtro === "todos"
                ? "bg-white/15 border-white/20 text-white"
                : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10"
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" /> TODOS
          </button>
          {Object.entries(TIPO_LABELS).map(([key, { label, icon }]) => (
            <button
              key={key}
              onClick={() => setFiltro(key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all whitespace-nowrap ${
                filtro === key
                  ? "bg-white/15 border-white/20 text-white"
                  : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10"
              }`}
            >
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>
      </div>

      <main className="container max-w-screen-xl mx-auto px-4 pb-16">
        {filtro === "moedas" ? (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span className="text-yellow-400">🪙</span> Comprar Moedas
            </h2>
            <p className="text-white/40 text-sm">Adquira moedas para comprar itens exclusivos na loja.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { moedas: 100,  preco: "R$ 5,00",  bonus: "" },
                { moedas: 250,  preco: "R$ 10,00", bonus: "+25 bônus" },
                { moedas: 600,  preco: "R$ 20,00", bonus: "+100 bônus" },
                { moedas: 1400, preco: "R$ 40,00", bonus: "+400 bônus" },
                { moedas: 3000, preco: "R$ 75,00", bonus: "+1000 bônus" },
                { moedas: 7000, preco: "R$150,00", bonus: "+3000 bônus" },
              ].map((pkg) => (
                <div key={pkg.moedas} className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🪙</span>
                    <span className="text-white font-black text-xl">{pkg.moedas.toLocaleString()}</span>
                  </div>
                  {pkg.bonus && <span className="text-[11px] text-green-400 font-bold">{pkg.bonus}</span>}
                  <button
                    onClick={() => toast.info("Pagamentos em breve! 🚀")}
                    className="w-full py-2.5 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-400 text-sm font-black transition-colors mt-1">
                    {pkg.preco}
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-white/20 text-center pt-2">Pagamentos via Pix e cartão — em breve!</p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-white/30" />
          </div>
        ) : itensVisiveis.length === 0 ? (
          <div className="flex flex-col items-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-white/20" />
            </div>
            <p className="text-white/40 font-bold text-lg">Nenhum item disponível</p>
            <p className="text-white/20 text-sm">Novos itens chegando em breve!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {itensVisiveis.map((item: any) => {
              const meuItem  = meuItemMap.get(item.id);
              const tenho    = !!meuItem;
              const equipado = meuItem?.equipado;
              const rar      = RARIDADE_CLS[item.raridade] ?? RARIDADE_CLS.comum;
              const isVideo  = item.mediaUrl?.match(/\.(mp4|webm)$/i);
              const semMoedas = isAuthenticated && !item.gratuito && !tenho && moedas < item.preco;

              return (
                <div key={item.id}
                  className={`rounded-2xl overflow-hidden flex flex-col bg-[#111] border transition-all duration-200 ${
                    equipado ? "border-primary/60" : "border-white/8 hover:border-white/15"
                  }`}
                >
                  {/* Preview — quadrado */}
                  <div className="relative w-full aspect-square bg-[#0a0a0a] overflow-hidden">
                    {isVideo ? (
                      <video src={item.mediaUrl} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                    ) : (
                      <img src={item.mediaUrl} alt={item.nome} className="w-full h-full object-cover" />
                    )}
                    {/* Ícone tipo */}
                    <div className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-black/60 backdrop-blur flex items-center justify-center text-sm">
                      {TIPO_LABELS[item.tipo]?.icon ?? "🎁"}
                    </div>
                    {equipado && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    {item.gratuito && (
                      <div className="absolute bottom-2 left-2 bg-green-500/90 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Grátis
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 flex flex-col gap-2.5 flex-1">
                    <div>
                      <p className="text-sm font-black text-white uppercase leading-tight line-clamp-1">{item.nome}</p>
                      <p className={`text-[10px] font-semibold mt-0.5 ${rar.cls}`}>{rar.label}</p>
                    </div>

                    {/* Preço */}
                    {!item.gratuito && (
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400 text-sm">🪙</span>
                        <span className="text-white font-black text-sm">{item.preco}</span>
                      </div>
                    )}

                    {/* Botões */}
                    {!isAuthenticated ? (
                      <div className="flex gap-1.5 mt-auto">
                        <button disabled className="flex-1 py-2 rounded-xl bg-white/5 text-white/30 text-xs font-bold uppercase">
                          Login
                        </button>
                      </div>
                    ) : tenho ? (
                      <button
                        onClick={() => equipado ? desequipar.mutate({ itemId: item.id }) : equipar.mutate({ itemId: item.id })}
                        className={`mt-auto w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
                          equipado
                            ? "bg-primary/20 text-primary border border-primary/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                            : "bg-white/10 text-white hover:bg-primary hover:text-white"
                        }`}
                      >
                        {equipado ? "✓ Equipado" : "Equipar"}
                      </button>
                    ) : (
                      <div className="flex gap-1.5 mt-auto">
                        <button
                          disabled={semMoedas || comprando === item.id}
                          onClick={() => { setComprando(item.id); comprar.mutate({ itemId: item.id }); }}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
                            semMoedas
                              ? "bg-white/5 text-white/20 cursor-not-allowed"
                              : "bg-white/10 text-white hover:bg-white/20"
                          }`}
                        >
                          {comprando === item.id ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : semMoedas ? "Sem moedas" : "Comprar"}
                        </button>
                        <button
                          disabled={semMoedas || comprando === item.id}
                          onClick={() => { setComprando(item.id); comprar.mutate({ itemId: item.id }); }}
                          className={`w-10 rounded-xl flex items-center justify-center transition-colors ${
                            semMoedas ? "bg-white/5 text-white/20 cursor-not-allowed" : "bg-white/10 text-white hover:bg-primary"
                          }`}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
