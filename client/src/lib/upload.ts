import { useState } from "react";

export interface UploadResult {
  publicUrl: string;
  key: string;
}

// ─── Upload de capa (passa pelo servidor para compressão via sharp) ────────────
export async function uploadCapa(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload/capa", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao enviar capa");
  }
  return res.json();
}

// ─── Upload de avatar (passa pelo servidor) ────────────────────────────────────
export async function uploadAvatar(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload/avatar", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao enviar avatar");
  }
  return res.json();
}

// ─── Upload de páginas via presigned URL (browser → R2 direto) ───────────────
const PARALELO = 3; // conservador — evita throttle do R2
const TIMEOUT_MS = 60_000; // 60s por imagem antes de desistir

// fetch com timeout
async function fetchComTimeout(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function uploadPaginas(
  files: File[],
  onProgress?: (atual: number, total: number) => void
): Promise<UploadResult[]> {
  // 1. Pedir presigned URLs — com tratamento de erro legível
  let presignRes: Response;
  try {
    presignRes = await fetchComTimeout("/api/upload/presign", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        arquivos: files.map((f) => ({ tipo: f.type || "image/jpeg", tamanho: f.size })),
      }),
    }, 30_000);
  } catch (e: any) {
    if (e.name === "AbortError") throw new Error("Tempo esgotado ao conectar com o servidor.");
    throw new Error("Sem conexão com o servidor. Verifique sua internet.");
  }

  if (!presignRes.ok) {
    let msg = `Erro do servidor (${presignRes.status})`;
    try {
      const err = await presignRes.json();
      msg = err.error || msg;
    } catch {}
    throw new Error(msg);
  }

  const { urls } = await presignRes.json() as {
    urls: Array<{ uploadUrl: string; publicUrl: string; key: string }>;
  };

  // 2. Upload direto → R2 com retry automático (até 3 tentativas por imagem)
  const results: UploadResult[] = new Array(files.length);
  let concluidos = 0;

  async function enviarUm(file: File, uploadUrl: string, publicUrl: string, key: string, idx: number) {
    let lastErr = "";
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        const r = await fetchComTimeout(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "image/jpeg" },
          body: file,
        }, TIMEOUT_MS);
        if (r.ok) {
          results[idx] = { publicUrl, key };
          concluidos++;
          onProgress?.(concluidos, files.length);
          return;
        }
        lastErr = `HTTP ${r.status}`;
      } catch (e: any) {
        lastErr = e.name === "AbortError" ? "timeout" : e.message;
        if (tentativa < 3) await new Promise(r => setTimeout(r, 1000 * tentativa));
      }
    }
    throw new Error(`Imagem ${idx + 1} falhou após 3 tentativas (${lastErr}).`);
  }

  for (let i = 0; i < files.length; i += PARALELO) {
    const lote = files.slice(i, i + PARALELO);
    const lotUrls = urls.slice(i, i + PARALELO);
    await Promise.all(lote.map((file, j) => enviarUm(file, lotUrls[j].uploadUrl, lotUrls[j].publicUrl, lotUrls[j].key, i + j)));
  }

  return results;
}

// ─── Hook com estado ──────────────────────────────────────────────────────────
export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function uploadArquivo(
    file: File,
    tipo: "capa" | "avatar"
  ): Promise<UploadResult | null> {
    setUploading(true);
    setError(null);
    try {
      return await (tipo === "capa" ? uploadCapa(file) : uploadAvatar(file));
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function uploadCapitulo(files: File[]): Promise<UploadResult[] | null> {
    setUploading(true);
    setProgress(0);
    setError(null);
    try {
      return await uploadPaginas(files, (atual, total) => {
        setProgress(Math.round((atual / total) * 100));
      });
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  return { uploading, progress, error, uploadArquivo, uploadCapitulo };
}
