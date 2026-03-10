import { Router } from "express";
import multer from "multer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

async function comprimirImagem(buffer: Buffer, mimetype: string, pasta: string): Promise<{ buffer: Buffer; mimetype: string }> {
  // Só comprime páginas de capítulo — capas e avatares mantém qualidade maior
  if (pasta === "paginas") {
    const comprimido = await sharp(buffer)
      .jpeg({ quality: 75, progressive: true })
      .toBuffer();
    return { buffer: comprimido, mimetype: "image/jpeg" };
  }
  if (pasta === "capas") {
    const comprimido = await sharp(buffer)
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
    return { buffer: comprimido, mimetype: "image/jpeg" };
  }
  return { buffer, mimetype };
}

async function enviarParaR2(buffer: Buffer, mimetype: string, pasta: string) {
  // Comprimir antes de enviar
  const { buffer: bufferFinal, mimetype: mimetypeFinal } = await comprimirImagem(buffer, mimetype, pasta);

  const ext = mimetypeFinal.split("/")[1].replace("jpeg", "jpg");
  const key = `${pasta}/${uuid()}.${ext}`;

  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: bufferFinal,
    ContentType: mimetypeFinal,
  }));

  return {
    key,
    publicUrl: `${PUBLIC_URL}/${key}`,
  };
}

uploadRouter.post("/capa", upload.single("file"), async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Faça login primeiro." });
    if (user.banned || user.bannedTotal) return res.status(403).json({ error: "Conta suspensa." });
    if (!ROLES_TRADUTOR.includes(user.role)) return res.status(403).json({ error: "Somente tradutores podem enviar capas." });

    const rl = checkRateLimit({ key: `upload:${user.id}`, ...LIMITS.upload });
    if (!rl.allowed) return res.status(429).json({ error: `Muitos uploads. Tente em ${rl.retryAfterSec}s.` });

    if (!req.file) return res.status(400).json({ error: "Arquivo obrigatório." });

    const result = await enviarParaR2(req.file.buffer, req.file.mimetype, "capas");
    res.json(result);
  } catch (e: any) {
    console.error("[Upload capa] erro:", e.message);
    res.status(400).json({ error: e.message });
  }
});

uploadRouter.post("/paginas", upload.array("files", 500), async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Faça login primeiro." });
    if (user.banned || user.bannedTotal) return res.status(403).json({ error: "Conta suspensa." });
    if (!ROLES_TRADUTOR.includes(user.role)) return res.status(403).json({ error: "Somente tradutores podem enviar páginas." });

    const rl = checkRateLimit({ key: `upload:${user.id}`, ...LIMITS.upload });
    if (!rl.allowed) return res.status(429).json({ error: `Muitos uploads. Tente em ${rl.retryAfterSec}s.` });

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: "Nenhum arquivo enviado." });

    const urls = await Promise.all(
      files.map((f) => enviarParaR2(f.buffer, f.mimetype, "paginas"))
    );

    res.json({ urls });
  } catch (e: any) {
    console.error("[Upload paginas] erro:", e.message);
    res.status(400).json({ error: e.message });
  }
});

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

export default uploadRouter;
