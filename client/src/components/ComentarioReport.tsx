import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Flag } from "lucide-react";

interface ComentarioReportProps {
  capituloId: number;
  obraId: number;
  comentarioId: number;
}

export default function ComentarioReport({
  capituloId,
  obraId,
  comentarioId,
}: ComentarioReportProps) {
  const { isAuthenticated } = useAuth();
  const [reportType, setReportType] = useState("outro");
  const [description, setDescription] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createReportMutation = trpc.reports.create.useMutation();

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      alert("Você precisa estar logado para reportar.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createReportMutation.mutateAsync({
        capituloId,
        obraId,
        tipo: reportType as "imagem_faltando" | "cap_nao_carrega" | "erro_traducao" | "outro",
        descricao: description || undefined,
      });
      alert("Relatório enviado com sucesso!");
      setIsOpen(false);
      setReportType("outro");
      setDescription("");
    } catch (error) {
      console.error("Erro ao enviar relatório:", error);
      alert("Erro ao enviar relatório. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-red-500 gap-1"
          title="Reportar problema"
        >
          <Flag className="w-3.5 h-3.5" />
          Reportar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-background border-border">
        <AlertDialogHeader>
          <AlertDialogTitle>Reportar Problema no Capítulo</AlertDialogTitle>
          <AlertDialogDescription>
            Ajude-nos a melhorar informando qual é o problema que você encontrou.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Tipo de Problema</label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border-border">
                <SelectItem value="imagem_faltando">Imagem faltando</SelectItem>
                <SelectItem value="cap_nao_carrega">Capítulo não carrega</SelectItem>
                <SelectItem value="erro_traducao">Erro na tradução</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Descrição (opcional)</label>
            <Textarea
              placeholder="Descreva o problema em detalhes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-background border-border resize-none"
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? "Enviando..." : "Enviar Relatório"}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
