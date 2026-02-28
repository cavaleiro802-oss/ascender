import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuid } from "uuid";

// ─── Validação de variáveis de ambiente ───────────────────────────────────────
const R2_VARS = {
  endpoint: process.env.R2_ENDPOINT,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  publicUrl: process.env.R2_PUBLIC_URL,
  bucket: process.env.R2_BUCKET ?? "ascender-imagens",
};

// R2 configurado apenas se TODAS as variáveis estiverem presentes
export const R2_ATIVO = !!(R2_VARS.endpoint && R2_VARS.accessKeyId && R2_VARS.secretAccessKey && R2_VARS.publicUrl);

if (!R2_ATIVO) {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ R2 não configurado em produção! Defina R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY e R2_PUBLIC_URL.");
    process.exit(1);
  } else {
    console.warn("⚠️  R2 não configurado — rotas de upload desabilitadas em desenvolvimento.");
  }
}

// ─── Cliente R2 (só inicializa se configurado) ────────────────────────────────
const r2 = R2_ATIVO ? new S3Client({
  region: "auto",
  endpoint: R2_VARS.endpoint!,
  credentials: {
    accessKeyId: R2_VARS.accessKeyId!,
    secretAccessKey: R2_VARS.secretAccessKey!,
  },
}) : null;

// Tipos permitidos
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE_MB = 10;

// ─── Gerar URL pré-assinada para upload direto do browser ────────────────────
export async function gerarUrlUpload(opts: {
  pasta: "capas" | "paginas" | "avatars";
  tipo: string;
  tamanho: number;
}): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  if (!R2_ATIVO || !r2) throw new Error("Serviço de upload não configurado.");
  if (!ALLOWED_TYPES.includes(opts.tipo)) throw new Error("Tipo de arquivo não permitido. Use JPG, PNG ou WebP.");
  if (opts.tamanho > MAX_SIZE_MB * 1024 * 1024) throw new Error(`Arquivo muito grande. Máximo ${MAX_SIZE_MB}MB.`);

  const ext = opts.tipo.split("/")[1].replace("jpeg", "jpg");
  const key = `${opts.pasta}/${uuid()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: R2_VARS.bucket,
    Key: key,
    ContentType: opts.tipo,
    ContentLength: opts.tamanho,
  });

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });
  const publicUrl = `${R2_VARS.publicUrl}/${key}`;

  return { uploadUrl, publicUrl, key };
}

// ─── Deletar arquivo do R2 ────────────────────────────────────────────────────
export async function deletarArquivo(key: string) {
  if (!R2_ATIVO || !r2) return;
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_VARS.bucket, Key: key }));
  } catch (e) {
    console.error("[R2] Erro ao deletar:", key, e);
  }
}

export function extrairKey(url: string): string | null {
  if (!url || !R2_VARS.publicUrl) return null;
  return url.replace(`${R2_VARS.publicUrl}/`, "") || null;
}
