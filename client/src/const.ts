// ─── Constantes e helpers globais do frontend ────────────────────────────────

export const ROUTES = {
  home: "/",
  biblioteca: "/biblioteca",
  perfil: "/perfil",
  admin: "/admin",
  novaObra: "/nova-obra",
} as const;

/**
 * Retorna a URL de login com Google.
 * O login é feito via popup Google Identity no frontend — não há redirect.
 * Essa função existe para compatibilidade com os botões que fazem
 * window.location.href = getLoginUrl()
 */
export function getLoginUrl(): string {
  // Retorna a página atual — o clique no botão de login
  // abre o popup do Google diretamente via credentialResponse
  return window.location.href;
}
