// Rate limiter em memória — simples e eficaz para o tamanho do projeto
// Para escala maior, trocar por Redis

interface RateEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateEntry>();

// Limpa entradas expiradas a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

export function checkRateLimit(opts: {
  key: string;          // identificador único (IP, userId, etc.)
  maxRequests: number;  // máximo de requisições
  windowMs: number;     // janela de tempo em ms
}): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = store.get(opts.key);

  if (!entry || entry.resetAt < now) {
    store.set(opts.key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (entry.count >= opts.maxRequests) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return { allowed: true, retryAfterSec: 0 };
}

// ─── Limites configurados ─────────────────────────────────────────────────────
export const LIMITS = {
  // Comentários: 5 por minuto por usuário
  comentario: { maxRequests: 10, windowMs: 60_000 },
  // Denúncias: 3 por hora por usuário
  denuncia: { maxRequests: 3, windowMs: 60 * 60_000 },
  // Criar obra: 3 por dia por usuário
  criarObra: { maxRequests: 3, windowMs: 24 * 60 * 60_000 },
  // Criar capítulo: 10 por hora por usuário
  criarCapitulo: { maxRequests: 10, windowMs: 60 * 60_000 },
  // Upload de imagem: 30 por hora por usuário
  upload: { maxRequests: 30, windowMs: 60 * 60_000 },
  // Login: 10 tentativas por 15 minutos por IP
  login: { maxRequests: 10, windowMs: 15 * 60_000 },
  // Views: 1 por capítulo por IP a cada 1 hora
  view: { maxRequests: 1, windowMs: 60 * 60_000 },
};
