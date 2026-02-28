import { Request, Response } from "express";
import { getSessao, getUserByOpenId } from "./db";

export async function createContext({ req, res }: { req: Request; res: Response }) {
  let user = null;

  const sessionId = req.cookies?.["asc_session"];
  if (sessionId && typeof sessionId === "string" && sessionId.length === 64) {
    try {
      const sessao = await getSessao(sessionId);
      if (sessao) {
        user = await getUserByOpenId(sessao.openId) ?? null;
      }
    } catch (e) {
      // ✅ Loga o erro em vez de engolir silenciosamente
      console.error("[Context] Erro ao buscar sessão — banco offline?", e);
      // Continua como anônimo para não derrubar o site inteiro
      // Rotas protegidas vão retornar UNAUTHORIZED normalmente
    }
  }

  return { req, res, user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
