import { initTRPC, TRPCError } from "@trpc/server";
import { Context } from "./context";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Faça login para continuar." });
  // ✅ Bloqueia banimento total E banimento suave em todas as rotas protegidas
  if (ctx.user.bannedTotal) throw new TRPCError({ code: "FORBIDDEN", message: "Sua conta foi suspensa permanentemente." });
  if (ctx.user.banned) throw new TRPCError({ code: "FORBIDDEN", message: "Sua conta está suspensa temporariamente." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
