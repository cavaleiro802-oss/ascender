import { useState } from "react";

interface UploadResult {
  publicUrl: string;
  key: string;
}

// ─── Upload de capa ───────────────────────────────────────────────────────────
export async function uploadCapa(file: File): Promise<UploadResult> {
  // 1. Pede URL pré-assinada ao servidor
  const res = await fetch("/api/upload/capa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ tipo: file.type, tamanho: file.size }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao preparar upload");
  }
  const { uploadUrl, publicUrl, key } = await res.json();

  // 2. Faz upload direto pro R2 (não passa pelo servidor)
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!uploadRes.ok) throw new Error("Erro ao enviar imagem para o servidor.");

  return { publicUrl, key };
}

// ─── Upload de múltiplas páginas ──────────────────────────────────────────────
export async function uploadPaginas(
  files: File[],
  onProgress?: (atual: number, total: number) => void
): Promise<UploadResult[]> {
  // 1. Pede URLs pré-assinadas para todas as páginas
  const res = await fetch("/api/upload/paginas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      arquivos: files.map((f) => ({ tipo: f.type, tamanho: f.size })),
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao preparar upload");
  }
  const { urls } = await res.json() as { urls: { uploadUrl: string; publicUrl: string; key: string }[] };

  // 2. Faz upload de cada página em paralelo (lotes de 5)
  const results: UploadResult[] = [];
  const BATCH = 5;

  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const batchUrls = urls.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (file, j) => {
        const { uploadUrl, publicUrl, key } = batchUrls[j];
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!uploadRes.ok) throw new Error(`Erro ao enviar página ${i + j + 1}`);
        results[i + j] = { publicUrl, key };
      })
    );

    onProgress?.(Math.min(i + BATCH, files.length), files.length);
  }

  return results;
}

// ─── Upload de avatar ─────────────────────────────────────────────────────────
export async function uploadAvatar(file: File): Promise<UploadResult> {
  const res = await fetch("/api/upload/avatar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ tipo: file.type, tamanho: file.size }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao preparar upload");
  }
  const { uploadUrl, publicUrl, key } = await res.json();

  await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });

  return { publicUrl, key };
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
      const result = await fn(file);
      return result;
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
      const results = await uploadPaginas(files, (atual, total) => {
        setProgress(Math.round((atual / total) * 100));
      });
      return results;
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
