import { Comentario } from "@/lib/types";
import { User, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import ComentarioReport from "./ComentarioReport";

interface ComentarioItemProps {
  comentario: Comentario & { autor?: { displayName?: string; avatarUrl?: string } };
  obraId: number;
  capituloId: number;
  canDelete?: boolean;
}

export default function ComentarioItem({
  comentario,
  obraId,
  capituloId,
  canDelete = false,
}: ComentarioItemProps) {
  const { user } = useAuth();
  const deleteComentarioMutation = trpc.comentarios.delete.useMutation();

  const handleDelete = async () => {
    if (confirm("Tem certeza que deseja deletar este comentário?")) {
      try {
        await deleteComentarioMutation.mutateAsync({ id: comentario.id });
      } catch (error) {
        console.error("Erro ao deletar comentário:", error);
      }
    }
  };

  const autorName = comentario.autor?.displayName || "Usuário Anônimo";
  const autorAvatar = comentario.autor?.avatarUrl;

  return (
    <div className="asc-card p-4 mb-3">
      {/* Autor Info */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {autorAvatar ? (
            <img src={autorAvatar} alt={autorName} className="w-full h-full object-cover" />
          ) : (
            <User className="w-5 h-5 text-white" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{autorName}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(comentario.createdAt).toLocaleDateString("pt-BR", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      {/* Conteúdo */}
      <p className="text-sm text-white/90 mb-3 whitespace-pre-wrap">{comentario.content}</p>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <ComentarioReport capituloId={capituloId} obraId={obraId} comentarioId={comentario.id} />
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-muted-foreground hover:text-red-500 gap-1"
            title="Deletar comentário"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Deletar
          </Button>
        )}
      </div>
    </div>
  );
}
