import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { upsertUser, criarSessao, deletarSessao, getUserByOpenId } from "./db";
import { checkRateLimit, LIMITS } from "./rateLimit";
import crypto from "crypto";

const authRouter = Router();

// ─── Validação obrigatória de variáveis de ambiente ───────────────────────────
if (!process.env.GOOGLE_CLIENT_ID) {
  console.error("❌ GOOGLE_CLIENT_ID não definida — login Google não vai funcionar!");
}
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error("❌ SESSION_SECRET ausente ou fraca — defina uma string de 32+ caracteres no .env!");
  if (process.env.NODE_ENV === "production") process.exit(1); // Mata o servidor em produção
}

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── Login com Google ─────────────────────────────────────────────────────────
authRouter.post("/login/google", async (req, res) => {
  try {
    // Rate limit por IP
    const ip = req.ip ?? "unknown";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
    const rl = checkRateLimit({ key: `login:${ipHash}`, ...LIMITS.login });
    if (!rl.allowed) {
      return res.status(429).json({ error: `Muitas tentativas. Aguarde ${rl.retryAfterSec}s.` });
    }

    const { credential } = req.body;
    if (!credential || typeof credential !== "string") {
      return res.status(400).json({ error: "Token ausente." });
    }

    // ✅ Verificação REAL do token Google
    let payload: any;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ error: "Token inválido. Faça login novamente." });
    }

    if (!payload?.sub) {
      return res.status(401).json({ error: "Token sem identificador." });
    }

    const openId = `google_${payload.sub}`;

    await upsertUser({
      openId,
      name: payload.name ?? null,
      email: payload.email ?? null,
      loginMethod: "google",
      lastSignedIn: new Date(),
    });

    // ✅ Busca o usuário para ter o id real (upsertUser retorna void)
    const userSalvo = await getUserByOpenId(openId);
    if (!userSalvo) throw new Error("Falha ao recuperar usuário após login.");

    const sessionId = await criarSessao(openId, userSalvo.id, ipHash);

    res.cookie("asc_session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true });
  } catch (e) {
    console.error("[Auth] Erro no login:", e);
    res.status(500).json({ error: "Erro interno ao fazer login." });
  }
});

// Logout é feito via tRPC (trpc.auth.logout) que invalida sessão no banco.
// Rota Express removida para evitar duplicidade.

export default authRouter;
