
import { Router } from "express";
import multer from "multer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuid } from "uuid";
import sharp from "sharp";
import { checkRateLimit, LIMITS } from "./rateLimit";
import { getSessao, getUserByOpenId } from "./db";

const uploadRouter = Router();

const ROLES_TRADUTOR = ["tradutor_aprendiz", "tradutor_oficial", "admin_senhor", "admin_supremo"];
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB por arquivo

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET ?? "ascender-imagens";
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

// ─── Multer (só usado para capa/avatar que passam pelo servidor) ──────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Tipo de arquivo não permitido. Use JPG, PNG ou WebP."));
  },
});

async function getUser(req: any) {
  const sessionId = req.cookies?.["asc_session"];
  if (!sessionId || typeof sessionId !== "string" || sessionId.length !== 64) return null;
  const sessao = await getSessao(sessionId);
  if (!sessao) return null;
  return getUserByOpenId(sessao.openId);
}

async function enviarParaR2(buffer: Buffer, mimetype: string, pasta: string) {
  const ext = mimetype.split("/")[1].replace("jpeg", "jpg");
  const key = `${pasta}/${uuid()}.${ext}`;
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
  }));
  return { key, publicUrl: `${PUBLIC_URL}/${key}` };
}

// ─── POST /api/upload/capa ────────────────────────────────────────────────────
uploadRouter.post("/capa", upload.single("file"), async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Faça login primeiro." });
    if (user.banned || user.bannedTotal) return res.status(403).json({ error: "Conta suspensa." });
    if (!ROLES_TRADUTOR.includes(user.role)) return res.status(403).json({ error: "Somente tradutores podem enviar capas." });

    const rl = checkRateLimit({ key: `upload:${user.id}`, ...LIMITS.upload });
    if (!rl.allowed) return res.status(429).json({ error: `Muitos uploads. Tente em ${rl.retryAfterSec}s.` });

    if (!req.file) return res.status(400).json({ error: "Arquivo obrigatório." });

    // Compressão da capa via sharp
    const buffer = await sharp(req.file.buffer)
      .jpeg({ quality: 85 })
      .toBuffer();

    const result = await enviarParaR2(buffer, "image/jpeg", "capas");
    res.json(result);
  } catch (e: any) {
    console.error("[Upload capa] erro:", e.message);
    res.status(400).json({ error: e.message });
  }
});

// ─── POST /api/upload/avatar ──────────────────────────────────────────────────
uploadRouter.post("/avatar", upload.single("file"), async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Faça login primeiro." });
    if (user.bannedTotal) return res.status(403).json({ error: "Conta suspensa." });

    const rl = checkRateLimit({ key: `upload:${user.id}`, ...LIMITS.upload });
    if (!rl.allowed) return res.status(429).json({ error: `Muitos uploads. Tente em ${rl.retryAfterSec}s.` });

    if (!req.file) return res.status(400).json({ error: "Arquivo obrigatório." });

    const result = await enviarParaR2(req.file.buffer, req.file.mimetype, "avatars");
    res.json(result);
  } catch (e: any) {
    console.error("[Upload avatar] erro:", e.message);
    res.status(400).json({ error: e.message });
  }
});

// ─── POST /api/upload/presign ─────────────────────────────────────────────────
// Gera URLs pré-assinadas para upload DIRETO do browser → R2
// Body: { arquivos: Array<{ tipo: string; tamanho: number }> }
// Retorna: { urls: Array<{ uploadUrl: string; publicUrl: string; key: string }> }
uploadRouter.post("/presign", async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Faça login primeiro." });
    if (user.banned || user.bannedTotal) return res.status(403).json({ error: "Conta suspensa." });
    if (!ROLES_TRADUTOR.includes(user.role)) return res.status(403).json({ error: "Somente tradutores podem enviar páginas." });

    const rl = checkRateLimit({ key: `upload:${user.id}`, ...LIMITS.upload });
    if (!rl.allowed) return res.status(429).json({ error: `Muitos uploads. Tente em ${rl.retryAfterSec}s.` });

    const { arquivos, obraId, numeroCapitulo } = req.body as {
      arquivos: Array<{ tipo: string; tamanho: number }>;
      obraId?: number;
      numeroCapitulo?: number;
    };

    if (!Array.isArray(arquivos) || arquivos.length === 0) {
      return res.status(400).json({ error: "Lista de arquivos obrigatória." });
    }
    if (arquivos.length > 500) {
      return res.status(400).json({ error: "Máximo de 500 imagens por vez." });
    }

    // Valida cada arquivo antes de gerar URLs
    // Aceita também image/webp gerado pelo canvas do browser
    const TIPOS_ACEITOS = [...ALLOWED_TYPES, "image/webp"];
    for (const a of arquivos) {
      if (!TIPOS_ACEITOS.includes(a.tipo)) {
        return res.status(400).json({ error: `Tipo não permitido: ${a.tipo}. Use JPG, PNG ou WebP.` });
      }
      if (a.tamanho > MAX_SIZE) {
        return res.status(400).json({ error: `Arquivo muito grande (máx 50MB por imagem).` });
      }
    }

    // Gera uma presigned URL por imagem com path organizado
    // Estrutura: obras/obraId/cap-numero/UUID.webp (UUID evita colisão entre uploads simultâneos)
    const pasta = obraId && numeroCapitulo !== undefined
      ? `obras/${obraId}/cap-${numeroCapitulo}`
      : `paginas`;

    const urls = await Promise.all(
      arquivos.map(async (a, idx) => {
        const ext = a.tipo === "image/webp" ? "webp" : a.tipo.split("/")[1].replace("jpeg", "jpg");
        const pagNum = String(idx + 1).padStart(3, "0");
        const key = `${pasta}/${pagNum}-${uuid()}.${ext}`;
        const command = new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          ContentType: a.tipo,
          ContentLength: a.tamanho,
        });
        const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 600 });
        return { uploadUrl, publicUrl: `${PUBLIC_URL}/${key}`, key };
      })
    );

    res.json({ urls });
  } catch (e: any) {
    console.error("[Presign] erro:", e.message);
    res.status(500).json({ error: e.message });
  }
});


// ─── POST /api/upload/loja ────────────────────────────────────────────────────
// Upload de mídia para itens da loja (molduras, banners, etc)
uploadRouter.post("/loja", multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }).single("file"), async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Faça login primeiro." });
    if (user.role !== "admin_supremo") return res.status(403).json({ error: "Acesso restrito." });

    if (!req.file) return res.status(400).json({ error: "Arquivo obrigatório." });

    const ext = req.file.mimetype.split("/")[1]?.replace("jpeg", "jpg") || "webp";
    const key = `molduras/${uuid()}.${ext}`;

    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    const url = `${PUBLIC_URL}/${key}`;
    res.json({ url, key });
  } catch (e: any) {
    console.error("[Upload Loja] erro:", e.message);
    res.status(500).json({ error: e.message });
  }
});

export default uploadRouter;

