import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import Topbar from "@/components/Topbar";
import { ShoppingBag, Check, Loader2, ShoppingCart, Crown } from "lucide-react";
import { toast } from "sonner";

const TIPO_LABELS: Record<string, { label: string; icon: string }> = {
  moldura:        { label: "MOLDURAS",   icon: "🖼️" },
  banner:         { label: "BANNERS",    icon: "🎬" },
  cor_comentario: { label: "CORES",      icon: "🎨" },
  tag:            { label: "TAGS",       icon: "🏷️" },
};

const RARIDADE_CLS: Record<string, { label: string; cls: string }> = {
  comum:    { label: "Comum",    cls: "text-white/40"   },
  raro:     { label: "Raro",     cls: "text-blue-400"   },
  epico:    { label: "Épico",    cls: "text-purple-400" },
  lendario: { label: "Lendário", cls: "text-yellow-400" },
};

const VIP_PACOTES = [
  { id: "bronze", nome: "VIP Bronze",  dias: 30,  moedas: 500,  cor: "from-amber-700 to-amber-600",   borda: "border-amber-600/40", icone: "🥉" },
  { id: "prata",  nome: "VIP Prata",   dias: 60,  moedas: 900,  cor: "from-slate-400 to-slate-300",   borda: "border-slate-400/40", icone: "🥈" },
  { id: "ouro",   nome: "VIP Ouro",    dias: 90,  moedas: 1500, cor: "from-yellow-500 to-yellow-400", borda: "border-yellow-500/40", icone: "🥇" },
  { id: "diamante",nome: "VIP Diamante",dias: 180, moedas: 2500, cor: "from-cyan-400 to-blue-400",    borda: "border-cyan-400/40", icone: "💎" },
];

const MOEDAS_PACOTES = [
  { moedas: 100,  bonus: 0    },
  { moedas: 250,  bonus: 25   },
  { moedas: 600,  bonus: 100  },
  { moedas: 1400, bonus: 400  },
  { moedas: 3000, bonus: 1000 },
  { moedas: 7000, bonus: 3000 },
];

export default function LojaPage() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [filtro, setFiltro] = useState("todos");
  const [comprando, setComprando] = useState<number | null>(null);

  const { data: itens = [], isLoading } = trpc.loja.listItens.useQuery(
    { tipo: filtro !== "todos" && filtro !== "vip" && filtro !== "moedas" ? filtro : undefined }
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

  const meuItemMap    = new Map((meusItens as any[]).map((i) => [i.itemId, i]));
  const itensVisiveis = (itens as any[]).filter((i) => i.ativo);

  const FILTROS = [
    { key: "todos",   label: "TODOS",   icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { key: "vip",     label: "VIP",     icon: <Crown className="w-3.5 h-3.5 text-yellow-400" /> },
    { key: "moedas",  label: "MOEDAS",  icon: <span>🪙</span> },
    ...Object.entries(TIPO_LABELS).map(([k, v]) => ({ key: k, label: v.label, icon: <span>{v.icon}</span> })),
  ];

  return (
    <div className="min-h-screen bg-black">
      <Topbar />

      {/* Hero */}
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

      {/* Filtros */}
      <div className="overflow-x-auto px-4 pb-4" style={{ scrollbarWidth: "none" }}>
        <div className="flex gap-2 w-max">
          {FILTROS.map(({ key, label, icon }) => (
            <button key={key} onClick={() => setFiltro(key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all whitespace-nowrap ${
                filtro === key
                  ? key === "vip"    ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400"
                  : key === "moedas" ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400"
                  : "bg-white/15 border-white/20 text-white"
                  : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10"
              }`}>
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      <main className="container max-w-screen-xl mx-auto px-4 pb-16">

        {/* VIP */}
        {filtro === "vip" && (
          <div className="space-y-4">
            <p className="text-white/40 text-sm">Pacotes VIP exclusivos — em breve com benefícios reais!</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {VIP_PACOTES.map((pkg) => (
                <div key={pkg.id} className={`rounded-2xl border ${pkg.borda} bg-white/5 p-4 flex flex-col gap-3`}>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pkg.cor} flex items-center justify-center text-2xl shadow-lg`}>
                    {pkg.icone}
                  </div>
                  <div>
                    <p className="text-white font-black text-sm">{pkg.nome}</p>
                    <p className="text-white/40 text-xs">{pkg.dias} dias</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400 text-sm">🪙</span>
                    <span className="text-white font-black">{pkg.moedas.toLocaleString()}</span>
                  </div>
                  <button onClick={() => toast.info("VIP em breve! 🚀")}
                    className={`w-full py-2.5 rounded-xl bg-gradient-to-r ${pkg.cor} text-white text-xs font-black uppercase tracking-wider opacity-80 hover:opacity-100 transition-opacity`}>
                    Em Breve
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Moedas */}
        {filtro === "moedas" && (
          <div className="space-y-4">
            <p className="text-white/40 text-sm">Adquira moedas para comprar itens exclusivos.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {MOEDAS_PACOTES.map((pkg) => (
                <div key={pkg.moedas} className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🪙</span>
                    <span className="text-white font-black text-xl">{pkg.moedas.toLocaleString()}</span>
                  </div>
                  {pkg.bonus > 0 && (
                    <span className="text-[11px] text-green-400 font-bold">+{pkg.bonus} bônus</span>
                  )}
                  <button onClick={() => toast.info("Pagamentos em breve! 🚀")}
                    className="w-full py-2.5 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-400 text-sm font-black transition-colors mt-1">
                    Em Breve
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-white/20 text-center pt-2">Pagamentos via Pix e cartão — em breve!</p>
          </div>
        )}

        {/* Itens da loja */}
        {filtro !== "vip" && filtro !== "moedas" && (
          isLoading ? (
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
                    }`}>
                    {/* Preview */}
                    <div className="relative w-full aspect-square bg-[#0a0a0a] overflow-hidden">
                      {item.mediaUrl ? (
                        isVideo
                          ? <video src={item.mediaUrl} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                          : <img src={item.mediaUrl} alt={item.nome} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#0a0a0a]" />
                      )}
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
                      {!item.gratuito && (
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-400 text-sm">🪙</span>
                          <span className="text-white font-black text-sm">{item.preco}</span>
                        </div>
                      )}
                      {!isAuthenticated ? (
                        <button disabled className="mt-auto w-full py-2 rounded-xl bg-white/5 text-white/30 text-xs font-bold uppercase">Login</button>
                      ) : tenho ? (
                        <button onClick={() => equipado ? desequipar.mutate({ itemId: item.id }) : equipar.mutate({ itemId: item.id })}
                          className={`mt-auto w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
                            equipado ? "bg-primary/20 text-primary border border-primary/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                                     : "bg-white/10 text-white hover:bg-primary hover:text-white"
                          }`}>
                          {equipado ? "✓ Equipado" : "Equipar"}
                        </button>
                      ) : (
                        <div className="flex gap-1.5 mt-auto">
                          <button disabled={semMoedas || comprando === item.id}
                            onClick={() => { setComprando(item.id); comprar.mutate({ itemId: item.id }); }}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
                              semMoedas ? "bg-white/5 text-white/20 cursor-not-allowed" : "bg-white/10 text-white hover:bg-white/20"
                            }`}>
                            {comprando === item.id ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : semMoedas ? "Sem moedas" : "Comprar"}
                          </button>
                          <button disabled={semMoedas || comprando === item.id}
                            onClick={() => { setComprando(item.id); comprar.mutate({ itemId: item.id }); }}
                            className={`w-10 rounded-xl flex items-center justify-center transition-colors ${
                              semMoedas ? "bg-white/5 text-white/20 cursor-not-allowed" : "bg-white/10 text-white hover:bg-primary"
                            }`}>
                            <ShoppingCart className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </main>
    </div>
  );
}
