import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "./ui/button";
import { MessageCircle, X, Send, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABEL: Record<string, string> = {
  tradutor_aprendiz: "Aprendiz",
  tradutor_oficial:  "Oficial",
  criador:           "Criador",
  admin_senhor:      "Admin",
  admin_supremo:     "Supremo",
};

const ROLE_COLOR: Record<string, string> = {
  tradutor_aprendiz: "text-blue-400",
  tradutor_oficial:  "text-green-400",
  criador:           "text-yellow-400",
  admin_senhor:      "text-red-400",
  admin_supremo:     "text-purple-400",
};

function roleLevel(role: string) {
  const levels: Record<string, number> = {
    usuario: 0, tradutor_aprendiz: 1, tradutor_oficial: 2,
    criador: 3, admin_senhor: 4, admin_supremo: 5,
  };
  return levels[role] ?? 0;
}

export default function ChatWidget() {
  const { user, isAuthenticated } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [novasMensagens, setNovasMensagens] = useState(0);
  const [ultimoId, setUltimoId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const temAcesso = isAuthenticated && user && roleLevel(user.role) >= 1;
  const isAdmin = isAuthenticated && user && roleLevel(user.role) >= 4;

  const { data: mensagens = [] } = trpc.chat.mensagens.useQuery(undefined, {
    enabled: !!temAcesso,
    refetchInterval: aberto ? 10000 : 30000,
  });

  const enviar = trpc.chat.enviar.useMutation({
    onSuccess: () => {
      utils.chat.mensagens.invalidate();
      setTexto("");
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    onError: (e) => toast.error(e.message),
  });

  const deletar = trpc.chat.deletar.useMutation({
    onSuccess: () => utils.chat.mensagens.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  // Scroll para o fim quando abre ou chegam mensagens
  useEffect(() => {
    if (aberto) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [aberto, mensagens.length]);

  // Contar novas mensagens quando fechado
  useEffect(() => {
    if (!mensagens.length) return;
    const ultimo = mensagens[mensagens.length - 1];
    if (!aberto && ultimoId !== null && ultimo.id > ultimoId) {
      setNovasMensagens((n) => n + 1);
    }
    setUltimoId(ultimo.id);
  }, [mensagens]);

  // Zerar contador ao abrir
  useEffect(() => {
    if (aberto) setNovasMensagens(0);
  }, [aberto]);

  if (!temAcesso) return null;

  function handleEnviar() {
    const msg = texto.trim();
    if (!msg) return;
    enviar.mutate({ conteudo: msg });
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Janela do chat */}
      {aberto && (
        <div className="w-80 sm:w-96 bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ height: "420px" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/50">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              <span className="font-bold text-white text-sm">Chat da Equipe</span>
            </div>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-white/50 hover:text-white"
              onClick={() => setAberto(false)}>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {mensagens.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm mt-8">
                <p className="text-2xl mb-2">💬</p>
                <p>Nenhuma mensagem ainda.</p>
                <p className="text-xs mt-1">Seja o primeiro a falar!</p>
              </div>
            ) : (
              mensagens.map((msg: any) => {
                const isMe = msg.userId === user?.id;
                const nome = msg.nome || msg.nomeGoogle || "Usuário";
                return (
                  <div key={msg.id} className={`flex gap-2 group ${isMe ? "flex-row-reverse" : ""}`}>
                    {/* Avatar */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden bg-secondary">
                      {msg.avatarUrl ? (
                        <img src={msg.avatarUrl} alt={nome} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-white/50">
                          {nome[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    {/* Balão */}
                    <div className={`flex flex-col max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] font-bold ${ROLE_COLOR[msg.role] ?? "text-white/50"}`}>
                          {ROLE_LABEL[msg.role] ?? msg.role}
                        </span>
                        <span className="text-[10px] text-white/40">{nome}</span>
                      </div>
                      <div className={`px-3 py-2 rounded-2xl text-sm text-white leading-relaxed relative ${
                        isMe ? "bg-primary rounded-tr-sm" : "bg-secondary rounded-tl-sm"
                      }`}>
                        {msg.conteudo}
                        {/* Botão deletar (admin) */}
                        {isAdmin && (
                          <button
                            onClick={() => deletar.mutate({ id: msg.id })}
                            className="absolute -top-2 -right-2 bg-red-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-2.5 h-2.5 text-white" />
                          </button>
                        )}
                      </div>
                      <span className="text-[9px] text-white/25 mt-0.5">
                        {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-border bg-secondary/30 flex gap-2">
            <input
              ref={inputRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEnviar(); } }}
              placeholder="Mensagem..."
              maxLength={500}
              className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button
              size="icon"
              className="bg-primary hover:bg-primary/90 text-white flex-shrink-0"
              onClick={handleEnviar}
              disabled={!texto.trim() || enviar.isPending}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Botão flutuante */}
      <button
        onClick={() => setAberto((a) => !a)}
        className="w-14 h-14 bg-primary hover:bg-primary/90 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 relative"
      >
        {aberto ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
        {!aberto && novasMensagens > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {novasMensagens > 9 ? "9+" : novasMensagens}
          </span>
        )}
      </button>
    </div>
  );
}
