import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

export default function PedidoCargoModal({ onClose }: Props) {
  const [tipo, setTipo] = useState<"quero_aprender" | "posso_ajudar" | null>(null);
  const [mensagem, setMensagem] = useState("");

  const { data: meuPedido } = trpc.pedidoCargo.meuPedidoRecente.useQuery();

  const enviar = trpc.pedidoCargo.criar.useMutation({
    onSuccess: () => {
      toast.success("Pedido enviado! Aguarde a avaliação da equipe.");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  // Verifica se ainda está no cooldown de 10 dias
  const emCooldown = meuPedido && meuPedido.bloqueadoAte && new Date(meuPedido.bloqueadoAte) > new Date();
  const diasRestantes = emCooldown
    ? Math.ceil((new Date(meuPedido.bloqueadoAte!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  const temPedidoPendente = meuPedido?.status === "pendente";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-black text-white">✏️ Quero ser Tradutor</h2>
          <Button variant="ghost" size="icon" className="text-white/60 hover:text-white" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {/* Cooldown ativo */}
          {emCooldown ? (
            <div className="text-center py-4">
              <p className="text-4xl mb-3">⏳</p>
              <p className="text-white font-semibold mb-1">Aguarde um pouquinho</p>
              <p className="text-muted-foreground text-sm">
                Você poderá fazer um novo pedido em <span className="text-primary font-bold">{diasRestantes} dia{diasRestantes !== 1 ? "s" : ""}</span>.
              </p>
            </div>
          ) : temPedidoPendente ? (
            <div className="text-center py-4">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-white font-semibold mb-1">Pedido em análise</p>
              <p className="text-muted-foreground text-sm">
                Você já tem um pedido pendente. Aguarde a avaliação da equipe!
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Escolha como você quer contribuir com o ASCENDER:
              </p>

              {/* Opções */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTipo("quero_aprender")}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    tipo === "quero_aprender"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 bg-secondary"
                  }`}
                >
                  <p className="text-2xl mb-2">📚</p>
                  <p className="font-bold text-white text-sm">Quero Aprender</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Estou começando e quero aprender a traduzir
                  </p>
                </button>

                <button
                  onClick={() => setTipo("posso_ajudar")}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    tipo === "posso_ajudar"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 bg-secondary"
                  }`}
                >
                  <p className="text-2xl mb-2">🌐</p>
                  <p className="font-bold text-white text-sm">Posso Ajudar</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Já tenho experiência (mesmo que seja Google Tradutor!)
                  </p>
                </button>
              </div>

              {/* Mensagem opcional */}
              {tipo && (
                <div>
                  <label className="text-sm text-white/80 mb-1.5 block">
                    Conte um pouco sobre você <span className="text-muted-foreground">(opcional)</span>
                  </label>
                  <Textarea
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    placeholder="Ex: Tenho experiência com japonês, adoro mangás de fantasia..."
                    className="bg-secondary border-border text-white placeholder:text-muted-foreground resize-none text-sm"
                    rows={3}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-right">{mensagem.length}/500</p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                ⚠️ Você pode enviar apenas 1 pedido a cada 10 dias.
              </p>

              <Button
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
                disabled={!tipo || enviar.isPending}
                onClick={() => tipo && enviar.mutate({ tipo, mensagem: mensagem || undefined })}
              >
                {enviar.isPending ? "Enviando..." : "Enviar Pedido"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
