import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { upsertUser, criarSessao, deletarSessao, getUserByOpenId } from "./db";
import { checkRateLimit, LIMITS } from "./rateLimit";
import crypto from "crypto";

const authRouter = Router();

if (!process.env.GOOGLE_CLIENT_ID) {
  console.error("❌ GOOGLE_CLIENT_ID não definida!");
}
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error("❌ SESSION_SECRET ausente ou fraca!");
  if (process.env.NODE_ENV === "production") process.exit(1);
}

const REDIRECT_URI = ${process.env.SITE_URL}/api/auth/google/callback;

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

// ─── Inicia fluxo OAuth ───────────────────────────────────────────────────────
authRouter.get("/google", (req, res) => {
  const url = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: ["profile", "email"],
    prompt: "select_account",
  });
  res.redirect(url);
});

// ─── Callback do Google ───────────────────────────────────────────────────────
authRouter.get("/google/callback", async (req, res) => {
  try {
    const ip = req.ip ?? "unknown";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
    const rl = checkRateLimit({ key: login:${ipHash}, ...LIMITS.login });
    if (!rl.allowed) return res.status(429).send("Muitas tentativas.");

    const { code } = req.query;
    if (!code || typeof code !== "string") return res.status(400).send("Código ausente.");

    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.sub) return res.status(401).send("Token inválido.");

    const openId = google_${payload.sub};

    await upsertUser({
      openId,
      name: payload.name ?? null,
      email: payload.email ?? null,
      loginMethod: "google",
      lastSignedIn: new Date(),
    });

    const userSalvo = await getUserByOpenId(openId);
    if (!userSalvo) throw new Error("Falha ao recuperar usuário.");

    const sessionId = await criarSessao(openId, userSalvo.id, ipHash);

    res.cookie("asc_session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.redirect("/");
  } catch (e) {
    console.error("[Auth] Erro no callback:", e);
    res.redirect("/login?erro=falha_login");
  }
});

// ─── Login com token direto (mantido para compatibilidade) ────────────────────
authRouter.post("/login/google", async (req, res) => {
  try {
    const ip = req.ip ?? "unknown";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
    const rl = checkRateLimit({ key: login:${ipHash}, ...LIMITS.login });
    if (!rl.allowed) return res.status(429).json({ error: Muitas tentativas. Aguarde ${rl.retryAfterSec}s. });

    const { credential } = req.body;
    if (!credential || typeof credential !== "string") return res.status(400).json({ error: "Token ausente." });

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) return res.status(401).json({ error: "Token inválido." });

    const openId = google_${payload.sub};
    await upsertUser({ openId, name: payload.name ?? null, email: payload.email ?? null, loginMethod: "google", lastSignedIn: new Date() });

    const userSalvo = await getUserByOpenId(openId);
    if (!userSalvo) throw new Error("Falha ao recuperar usuário.");

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

export default authRouter;
