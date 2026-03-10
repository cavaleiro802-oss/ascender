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
// Mais rápido, sem timeout, sem limite de RAM no servidor
const PARALELO = 8; // uploads simultâneos por cap

export async function uploadPaginas(
  files: File[],
  onProgress?: (atual: number, total: number) => void
): Promise<UploadResult[]> {
  // 1. Pedir as presigned URLs pro servidor (uma chamada só)
  const res = await fetch("/api/upload/presign", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      arquivos: files.map((f) => ({ tipo: f.type || "image/jpeg", tamanho: f.size })),
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao obter URLs de upload.");
  }

  const { urls } = await res.json() as {
    urls: Array<{ uploadUrl: string; publicUrl: string; key: string }>;
  };

  // 2. Fazer upload direto do browser → R2 em paralelo (PARALELO por vez)
  const results: UploadResult[] = new Array(files.length);
  let concluidos = 0;

  for (let i = 0; i < files.length; i += PARALELO) {
    const lote = files.slice(i, i + PARALELO);
    const lotUrls = urls.slice(i, i + PARALELO);

    await Promise.all(
      lote.map(async (file, j) => {
        const { uploadUrl, publicUrl, key } = lotUrls[j];
        const idx = i + j;

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "image/jpeg" },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error(`Falha ao enviar imagem ${idx + 1} (HTTP ${uploadRes.status}).`);
        }

        results[idx] = { publicUrl, key };
        concluidos++;
        onProgress?.(concluidos, files.length);
      })
    );
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
