import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import crypto from "crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./context";
import authRouter from "./auth";
import uploadRouter from "./upload";
import { checkRateLimit } from "./rateLimit";
import { limparSessoesExpiradas } from "./db";

const isProd = process.env.NODE_ENV === "production";

// ─── Fail-fast: variáveis obrigatórias em produção ───────────────────────────
if (isProd) {
  const obrigatorias = [
    ["GOOGLE_CLIENT_ID", "Login Google não vai funcionar"],
    ["SITE_URL", "CORS vai bloquear todas as requisições"],
    ["DATABASE_URL", "Banco de dados inacessível"],
    ["SESSION_SECRET", "Sessões inseguras"],
  ];
  let temErro = false;
  for (const [varName, motivo] of obrigatorias) {
    if (!process.env[varName]) {
      console.error(`❌ ${varName} não definida — ${motivo}`);
      temErro = true;
    }
  }
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
    console.error("❌ SESSION_SECRET muito fraca — use 32+ caracteres aleatórios");
    temErro = true;
  }
  if (temErro) {
    console.error("\n⚠️  Servidor iniciando com configuração incompleta. Algumas funcionalidades podem não funcionar.\n");
  }
}

const app = express();
const PORT = parseInt(process.env.PORT || "3001");
const SITE_URL = process.env.SITE_URL ?? "";
const RAILWAY_URL =
  process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : "";

const ALLOWED_ORIGINS = isProd
  ? [SITE_URL, RAILWAY_URL].filter(Boolean)
  : ["http://localhost:5173", "http://localhost:3001"];

// ─── Helmet — headers de segurança ───────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      // ✅ SITE_URL e domínio do backend na connectSrc
      connectSrc: ["'self'", SITE_URL, "https://accounts.google.com"].filter(Boolean),
      imgSrc: ["'self'", "data:", "https://*.r2.dev", "lh3.googleusercontent.com"],
      scriptSrc: ["'self'", "https://accounts.google.com"],
      frameSrc: ["https://accounts.google.com"],
    },
  } : false,
}));

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    // ✅ Permite navegação normal do browser e healthchecks (sem Origin)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error("CORS: origem não permitida."));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// ─── Rate limit global por IP ─────────────────────────────────────────────────
app.use((req, res, next) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
  const rl = checkRateLimit({ key: `global:${ipHash}`, maxRequests: 300, windowMs: 60_000 });
  if (!rl.allowed) return res.status(429).json({ error: "Muitas requisições. Tente novamente em breve." });
  next();
});

// ─── Rotas ────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/upload", uploadRouter);
app.use("/trpc", createExpressMiddleware({ router: appRouter, createContext }));

// ─── Frontend em produção ─────────────────────────────────────────────────────
if (isProd) {
  const clientDist = path.join(process.cwd(), "dist/client");
  console.log("clientDist =", clientDist, "| exists?", require("fs").existsSync(clientDist));
  app.use(express.static(clientDist, { maxAge: "7d", etag: true }));
  app.get("*", (_req, res) => {
    const indexFile = path.join(clientDist, "index.html");
    if (require("fs").existsSync(indexFile)) {
      res.sendFile(indexFile);
    } else {
      res.status(404).send("Frontend não encontrado. Verifique o build.");
    }
  });
}

// ─── Erro global ──────────────────────────────────────────────────────────────
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("[Server]", err.message);
  res.status(err.status ?? 500).json({ error: err.message ?? "Erro interno." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ ASCENDER rodando na porta ${PORT} (${isProd ? "produção" : "desenvolvimento"})`);
  console.log(`   Banco:  ${process.env.DATABASE_URL ? "✅" : "⚠️  não definido"}`);
  console.log(`   R2:     ${process.env.R2_ENDPOINT ? "✅" : "⚠️  não configurado"}`);
  console.log(`   Google: ${process.env.GOOGLE_CLIENT_ID ? "✅" : "⚠️  não definido"}`);

  // Limpa sessões expiradas a cada 6 horas
  setInterval(() => {
    limparSessoesExpiradas().catch((e) => console.error("[Sessões] Erro ao limpar:", e));
  }, 6 * 60 * 60 * 1000);
});
