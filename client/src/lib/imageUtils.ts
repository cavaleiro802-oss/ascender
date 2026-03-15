// ─── Utilitários de imagem — sem dependência de serviços pagos ────────────────
// Usa as URLs do R2 diretamente, com lazy loading e fallback

// Retorna a URL sem modificação (R2 + CDN Cloudflare gratuito já cuida do cache)
export function cfImagem(url: string | null | undefined): string {
  return url ?? "";
}

export const cfPagina = (url: string) => url ?? "";
export const cfCapa   = (url: string) => url ?? "";
export const cfAvatar = (url: string) => url ?? "";
export const cfBanner = (url: string) => url ?? "";
