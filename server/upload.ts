import { Router } from "express";
import { gerarUrlUpload } from "./r2";
import { checkRateLimit, LIMITS } from "./rateLimit";
import { getSessao, getUserByOpenId } from "./db";

const uploadRouter = Router();

// ─── Roles que podem fazer upload de conteúdo (capa/páginas) ─────────────────
const ROLES_TRADUTOR = ["tradutor_aprendiz", "tradutor_oficial", "admin", "admin_supremo"];

// ✅ Corrigido: usa sessionId → getSessao → getUserByOpenId
async function getUser(req: any) {
  const sessionId = req.cookies?.["asc_session"];
  if (!sessionId || typeof sessionId !== "string" || sessionId.length !== 64) return null;
  const sessao = await getSessao(sessionId);
  if (!sessao) return null;
  return getUserByOpenId(sessao.openId);
}

// ─── Upload de capa (somente Tradutor+) ──────────────────────────────────────
uploadRouter.post("/capa", async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Faça login primeiro." });
    if (user.banned || user.bannedTotal) return res.status(403).json({ error: "Conta suspensa." });
    if (!ROLES_TRADUTOR.includes(user.role)) {
      return res.status(403).json({ error: "Somente tradutores podem enviar capas." });
    }
    const rl = checkRateLimit({ key: `upload:${user.id}`, ...LIMITS.upload });
    if (!rl.allowed) return res.status(429).json({ error: `Muitos uploads. Tente em ${rl.retryAfterSec}s.` });

    // ✅ Validar body antes de usar
    const { tipo, tamanho } = req.body;
    if (!tipo || typeof tipo !== "string") return res.status(400).json({ error: "Tipo de arquivo obrigatório." });
    if (!tamanho || typeof tamanho !== "number") return res.status(400).json({ error: "Tamanho de arquivo obrigatório." });

    const result = await gerarUrlUpload({ pasta: "capas", tipo, tamanho });
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Upload de páginas (somente Tradutor+) ───────────────────────────────────
uploadRouter.post("/paginas", async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Faça login primeiro." });
    if (user.banned || user.bannedTotal) return res.status(403).json({ error: "Conta suspensa." });
    // ✅ Somente tradutores podem fazer upload de páginas
    if (!ROLES_TRADUTOR.includes(user.role)) {
      return res.status(403).json({ error: "Somente tradutores podem enviar páginas." });
    }

    const rl = checkRateLimit({ key: `upload:${user.id}`, ...LIMITS.upload });
    if (!rl.allowed) return res.status(429).json({ error: `Muitos uploads. Tente em ${rl.retryAfterSec}s.` });

    const { arquivos } = req.body as { arquivos: { tipo: string; tamanho: number }[] };
    if (!Array.isArray(arquivos) || arquivos.length === 0) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }
    if (arquivos.length > 100) {
      return res.status(400).json({ error: "Máximo de 100 páginas por capítulo." });
    }

    const urls = await Promise.all(
      arquivos.map((a) => gerarUrlUpload({ pasta: "paginas", tipo: a.tipo, tamanho: a.tamanho }))
    );
    res.json({ urls });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Upload de avatar (qualquer usuário logado) ───────────────────────────────
uploadRouter.post("/avatar", async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Faça login primeiro." });
    if (user.bannedTotal) return res.status(403).json({ error: "Conta suspensa." });
    const rl = checkRateLimit({ key: `upload:${user.id}`, ...LIMITS.upload });
    if (!rl.allowed) return res.status(429).json({ error: `Muitos uploads. Tente em ${rl.retryAfterSec}s.` });

    // ✅ Validar body antes de usar
    const { tipo, tamanho } = req.body;
    if (!tipo || typeof tipo !== "string") return res.status(400).json({ error: "Tipo de arquivo obrigatório." });
    if (!tamanho || typeof tamanho !== "number") return res.status(400).json({ error: "Tamanho de arquivo obrigatório." });

    const result = await gerarUrlUpload({ pasta: "avatars", tipo, tamanho });
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default uploadRouter;
