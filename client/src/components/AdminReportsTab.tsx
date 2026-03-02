import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const TIPO_LABELS: Record<string, string> = {
  imagem_faltando: "🖼️ Imagem faltando",
  cap_nao_carrega: "⚠️ Capítulo não carrega",
  erro_traducao: "✏️ Erro na tradução",
  outro: "📝 Outro",
};

export default function AdminReportsTab() {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const [showResolved, setShowResolved] = useState(false);

  const { data: reports = [], isLoading } = trpc.admin.listReports.useQuery({
    page,
    resolved: showResolved,
  });

  const resolveReportMutation = trpc.admin.resolveReport.useMutation({
    onSuccess: () => {
      utils.admin.listReports.invalidate();
      toast.success(showResolved ? "Denúncia reaberta!" : "Denúncia resolvida!");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="asc-card p-8 text-center text-muted-foreground">
        Carregando denúncias...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => { setShowResolved(false); setPage(1); }}
          className={!showResolved ? "bg-primary text-white" : "bg-secondary text-white/60 border-border border"}
        >
          Pendentes
        </Button>
        <Button
          size="sm"
          onClick={() => { setShowResolved(true); setPage(1); }}
          className={showResolved ? "bg-primary text-white" : "bg-secondary text-white/60 border-border border"}
        >
          Resolvidas
        </Button>
      </div>

      {reports.length === 0 ? (
        <div className="asc-card p-8 text-center text-muted-foreground">
          Nenhuma denúncia {showResolved ? "resolvida" : "pendente"} no momento.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="asc-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="asc-badge asc-badge-red">
                      {TIPO_LABELS[report.tipo] ?? report.tipo}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Capítulo #{report.capituloId} • Obra #{report.obraId}
                    </span>
                  </div>
                  {report.descricao && (
                    <p className="text-sm text-white/80 mb-2">{report.descricao}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Usuário #{report.userId} • {new Date(report.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>

                <div className="flex-shrink-0">
                  {!showResolved ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Resolver
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">Resolver Denúncia</AlertDialogTitle>
                          <AlertDialogDescription>
                            Confirma que esse problema foi verificado e resolvido?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="flex gap-3 justify-end">
                          <AlertDialogCancel className="border-border bg-transparent text-white/60">
                            Cancelar
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => resolveReportMutation.mutate({ reportId: report.id, resolved: true })}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Sim, resolver
                          </AlertDialogAction>
                        </div>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500/40 text-red-400 hover:bg-red-500/10 bg-transparent"
                      onClick={() => resolveReportMutation.mutate({ reportId: report.id, resolved: false })}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Reabrir
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginação */}
      <div className="flex gap-2 justify-center pt-2">
        <Button
          size="sm"
          variant="outline"
          className="border-border bg-transparent text-white/60"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
        >
          ← Anterior
        </Button>
        <span className="px-4 py-2 text-sm text-muted-foreground">Página {page}</span>
        <Button
          size="sm"
          variant="outline"
          className="border-border bg-transparent text-white/60"
          onClick={() => setPage(page + 1)}
          disabled={reports.length < 30}
        >
          Próxima →
        </Button>
      </div>
    </div>
  );
}
