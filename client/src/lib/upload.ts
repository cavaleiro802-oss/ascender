import { useState } from "react";

interface UploadResult {
  publicUrl: string;
  key: string;
}

// ─── Upload de capa ───────────────────────────────────────────────────────────
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

// ─── Upload de múltiplas páginas ──────────────────────────────────────────────
export async function uploadPaginas(
  files: File[],
  onProgress?: (atual: number, total: number) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  const BATCH = 5;

  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const form = new FormData();
    batch.forEach((f) => form.append("files", f));

    const res = await fetch("/api/upload/paginas", {
      method: "POST",
      credentials: "include",
      body: form,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `Erro ao enviar páginas ${i + 1}–${i + batch.length}`);
    }

    const { urls } = await res.json() as { urls: UploadResult[] };
    urls.forEach((u, j) => { results[i + j] = u; });

    onProgress?.(Math.min(i + BATCH, files.length), files.length);
  }

  return results;
}

// ─── Upload de avatar ─────────────────────────────────────────────────────────
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

// ─── Hook para upload com estado ──────────────────────────────────────────────
export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function uploadArquivo(file: File, tipo: "capa" | "avatar"): Promise<UploadResult | null> {
    setUploading(true);
    setError(null);
    try {
      const fn = tipo === "capa" ? uploadCapa : uploadAvatar;
      return await fn(file);
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

