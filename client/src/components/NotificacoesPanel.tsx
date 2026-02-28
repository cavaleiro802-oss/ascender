import { trpc } from "@/lib/trpc";
import { Button } from "./ui/button";
import { X, Bell } from "lucide-react";

interface Props {
  onClose: () => void;
}

export default function NotificacoesPanel({ onClose }: Props) {
  const utils = trpc.useUtils();
  const { data: notifs = [], isLoading } = trpc.notificacoes.list.useQuery();

  const marcarLida = trpc.notificacoes.marcarLida.useMutation({
    onSuccess: () => {
      utils.notificacoes.list.invalidate();
      utils.notificacoes.countNaoLidas.invalidate();
    },
  });

  const marcarTodasLidas = trpc.notificacoes.marcarTodasLidas.useMutation({
    onSuccess: () => {
      utils.notificacoes.list.invalidate();
      utils.notificacoes.countNaoLidas.invalidate();
    },
  });

  const TIPO_ICONS: Record<string, string> = {
    cargo_aprovado: "🎉",
    cargo_rejeitado: "📋",
    bem_vindo_equipe: "👋",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 p-4 pt-20">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-white">Notificações</h2>
          </div>
          <div className="flex items-center gap-2">
            {notifs.some((n) => !n.lida) && (
              <button
                onClick={() => marcarTodasLidas.mutate()}
                className="text-xs text-primary hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
            <Button variant="ghost" size="icon" className="text-white/60 hover:text-white w-7 h-7" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1 p-2">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
          ) : notifs.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">Nenhuma notificação ainda.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {notifs.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    n.lida ? "bg-transparent hover:bg-white/5" : "bg-primary/10 hover:bg-primary/15 border border-primary/20"
                  }`}
                  onClick={() => !n.lida && marcarLida.mutate({ id: n.id })}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl flex-shrink-0">{TIPO_ICONS[n.tipo] ?? "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${n.lida ? "text-white/70" : "text-white"}`}>
                        {n.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.mensagem}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {new Date(n.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {!n.lida && <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
