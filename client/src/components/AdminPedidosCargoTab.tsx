import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

export default function AdminPedidosCargoTab() {
  const [page, setPage] = useState(1);
  const [filtro, setFiltro] = useState<"pendente" | "aprovado" | "rejeitado">("pendente");
  const [pedidoSelecionado, setPedidoSelecionado] = useState<any>(null);
  const [acao, setAcao] = useState<"aprovado" | "rejeitado" | null>(null);
  const [resposta, setResposta] = useState("");

  const utils = trpc.useUtils();
  const { data: pedidos = [], isLoading } = trpc.admin.listPedidosCargo.useQuery({ page, status: filtro });

  const avaliar = trpc.admin.avaliarPedidoCargo.useMutation({
    onSuccess: () => {
      toast.success(acao === "aprovado" ? "Pedido aprovado! Cargo atribuído." : "Pedido rejeitado.");
      utils.admin.listPedidosCargo.invalidate();
      utils.admin.stats.invalidate();
      setPedidoSelecionado(null);
      setAcao(null);
      setResposta("");
    },
    onError: (e) => toast.error(e.message),
  });

  const TIPO_LABELS: Record<string, { label: string; icon: string; cargo: string }> = {
    quero_aprender: { label: "Quero Aprender", icon: "📚", cargo: "Tradutor Aprendiz" },
    posso_ajudar:   { label: "Posso Ajudar",   icon: "🌐", cargo: "Tradutor Oficial" },
  };

  return (
    <div>
      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        {(["pendente", "aprovado", "rejeitado"] as const).map((f) => (
          <Button key={f} size="sm" variant={filtro === f ? "default" : "outline"}
            className={filtro === f ? "bg-primary text-white" : "border-border text-white/60"}
            onClick={() => { setFiltro(f); setPage(1); }}>
            {f === "pendente" ? <Clock className="w-3.5 h-3.5 mr-1.5" /> : f === "aprovado" ? <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> : <XCircle className="w-3.5 h-3.5 mr-1.5" />}
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : pedidos.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-muted-foreground">Nenhum pedido {filtro} no momento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map((p: any) => {
            const info = TIPO_LABELS[p.tipo];
            return (
              <div key={p.id} className="asc-card p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{info?.icon}</span>
                    <span className="font-semibold text-white">{info?.label}</span>
                    <span className="asc-badge asc-badge-blue text-xs">→ {info?.cargo}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Usuário ID #{p.userId} • {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                  {p.mensagem && (
                    <p className="text-sm text-white/70 italic mt-1 line-clamp-2">"{p.mensagem}"</p>
                  )}
                  {p.respostaAdmin && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Resposta: <span className="text-white/60">{p.respostaAdmin}</span>
                    </p>
                  )}
                </div>

                {filtro === "pendente" && (
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1"
                      onClick={() => { setPedidoSelecionado(p); setAcao("aprovado"); }}>
                      <CheckCircle className="w-3.5 h-3.5" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 gap-1"
                      onClick={() => { setPedidoSelecionado(p); setAcao("rejeitado"); }}>
                      <XCircle className="w-3.5 h-3.5" /> Rejeitar
                    </Button>
                  </div>
                )}

                {filtro !== "pendente" && (
                  <span className={`asc-badge flex-shrink-0 ${filtro === "aprovado" ? "asc-badge-green" : "asc-badge-red"}`}>
                    {filtro === "aprovado" ? "✅ Aprovado" : "❌ Rejeitado"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Paginação */}
      {pedidos.length > 0 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="border-border text-white/60">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Página {page}</span>
          <Button size="sm" variant="outline" disabled={pedidos.length < 30} onClick={() => setPage(p => p + 1)} className="border-border text-white/60">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Dialog de confirmação */}
      <AlertDialog open={!!pedidoSelecionado} onOpenChange={(open) => { if (!open) { setPedidoSelecionado(null); setAcao(null); setResposta(""); } }}>
        <AlertDialogContent className="bg-card border-border text-white max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {acao === "aprovado" ? "✅ Aprovar pedido?" : "❌ Rejeitar pedido?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {acao === "aprovado"
                ? `O usuário #${pedidoSelecionado?.userId} receberá o cargo de ${TIPO_LABELS[pedidoSelecionado?.tipo]?.cargo} e será notificado com o link do Telegram.`
                : `O usuário #${pedidoSelecionado?.userId} será notificado e poderá tentar novamente em 10 dias.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-2">
            <label className="text-sm text-white/80 mb-1.5 block">
              Mensagem para o usuário <span className="text-muted-foreground">(opcional)</span>
            </label>
            <Textarea
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              placeholder={acao === "aprovado" ? "Ex: Bem-vindo à equipe! Aguardamos sua contribuição." : "Ex: Estamos sem capacidade no momento, tente novamente em breve."}
              className="bg-secondary border-border text-white placeholder:text-muted-foreground resize-none text-sm"
              rows={2}
              maxLength={500}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-white/70 bg-transparent hover:bg-white/5">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className={acao === "aprovado" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
              onClick={() => pedidoSelecionado && acao && avaliar.mutate({ pedidoId: pedidoSelecionado.id, status: acao, resposta: resposta || undefined })}>
              {acao === "aprovado" ? "Confirmar Aprovação" : "Confirmar Rejeição"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
