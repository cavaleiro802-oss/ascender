import { TRPCError } from "@trpc/server";
import { z } from "zod";
import crypto from "crypto";
import { checkRateLimit, LIMITS } from "./rateLimit";



import { protectedProcedure, publicProcedure, router } from "./trpc";
import {
  avaliarPedidoCargo,
  banUser,
  countCapitulosAguardando,
  countCurtidas,
  countNotificacoesNaoLidas,
  createCapitulo,
  createComentario,
  createObra,
  createReport,
  criarPedidoCargo,
  deletarSessao,
  deleteComentario,
  getCapituloById,
  getCurtida,
  getFavorito,
  getHistoricoLeitura,
  getObraById,
  getPublicLink,
  getPlatformStats,
  getUserById,
  getUserByOpenId,
  incrementCapituloViews,
  incrementObraViews,
  listCapitulos,
  listComentarios,
  listFavoritos,
  listHistoricoAdm,
  listNotificacoes,
  listObras,
  listObrasByAuthor,
  listPedidosCargo,
  listPendingCapitulos,
  listPendingObras,
  listReports,
  listUsers,
  logAdm,
  marcarNotificacaoLida,
  resolveReport,
  setPublicLink,
  toggleCurtida,
  toggleFavorito,
  updateCapituloStatus,
  updateObraAuthor,
  updateObraStatus,
  updateUserProfile,
  updateUserRole,
  upsertHistoricoLeitura,
} from "./db";

// ─── Helpers de permissão ─────────────────────────────────────────────────────
const ROLE_LEVEL: Record<string, number> = {
  usuario: 0, tradutor_aprendiz: 1, tradutor_oficial: 2, admin: 3, admin_supremo: 4,
};
function roleLevel(role: string) { return ROLE_LEVEL[role] ?? 0; }
function isAdmin(role: string) { return roleLevel(role) >= 3; }
function isSupremeAdmin(role: string) { return role === "admin_supremo"; }
function isTranslatorOrAbove(role: string) { return roleLevel(role) >= 1; }
function isOfficialOrAbove(role: string) { return roleLevel(role) >= 2; }

// ✅ Verifica se usuário pode interagir (banimento suave bloqueia interações)
function canInteract(user: any) {
  if (user.bannedTotal) throw new TRPCError({ code: "FORBIDDEN", message: "Sua conta foi suspensa." });
  if (user.banned) throw new TRPCError({ code: "FORBIDDEN", message: "Você está impedido de interagir no momento." });
}

// ─── Obras Router ─────────────────────────────────────────────────────────────
const obrasRouter = router({
  list: publicProcedure
    .input(z.object({
      genre: z.string().optional(),
      search: z.string().max(100).optional(),
      sort: z.enum(["hot", "recent", "most"]).optional(),
      page: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(50).optional(), // ✅ máximo 50 por requisição
    }))
    .query(({ input }) => listObras({ ...input, status: "aprovada" })),

  listAll: protectedProcedure
    .input(z.object({ status: z.enum(["em_espera", "aprovada", "rejeitada"]).optional(), page: z.number().optional() }))
    .query(({ ctx, input }) => {
      if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      return listObras({ ...input, status: input.status });
    }),

  byId: publicProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const obra = await getObraById(input.id);
    if (!obra) throw new TRPCError({ code: "NOT_FOUND" });
    // ✅ Obras não aprovadas só visíveis para o autor ou admin
    if (obra.status !== "aprovada") {
      const user = ctx.user;
      const isAuthor = user?.id === obra.authorId;
      const isAdminUser = user && isAdmin(user.role);
      if (!isAuthor && !isAdminUser) throw new TRPCError({ code: "NOT_FOUND" });
    }
    return obra;
  }),

  create: protectedProcedure
    .input(z.object({ title: z.string().min(1), synopsis: z.string().optional(), genres: z.array(z.string()).optional(), coverUrl: z.string().optional(), originalAuthor: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      canInteract(ctx.user);
      if (!isTranslatorOrAbove(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas tradutores podem criar obras." });
      // ✅ Rate limit: 3 obras por dia
      const rl = checkRateLimit({ key: `criarObra:${ctx.user.id}`, ...LIMITS.criarObra });
      if (!rl.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Limite de criação atingido. Tente em ${rl.retryAfterSec}s.` });
      const status = isOfficialOrAbove(ctx.user.role) ? "aprovada" : "em_espera";
      await createObra({ ...input, authorId: ctx.user.id, status });
      return { success: true, status };
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["aprovada", "rejeitada"]) }))
    .mutation(async ({ ctx, input }) => {
      if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      await updateObraStatus(input.id, input.status);
      await logAdm({ adminId: ctx.user.id, acao: input.status === "aprovada" ? "aprovar_obra" : "rejeitar_obra", targetType: "obra", targetId: input.id });
      return { success: true };
    }),

  changeAuthor: protectedProcedure
    .input(z.object({ obraId: z.number(), newAuthorId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // ✅ Só Admin Supremo pode transferir autoria de obra
      if (!isSupremeAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o Admin Supremo pode transferir autoria." });
      await updateObraAuthor(input.obraId, input.newAuthorId);
      await logAdm({ adminId: ctx.user.id, acao: "alterar_author_obra", detalhes: `Novo authorId: ${input.newAuthorId}`, targetType: "obra", targetId: input.obraId });
      return { success: true };
    }),

  incrementViews: publicProcedure.input(z.object({ id: z.number() })).mutation(({ ctx, input }) => {
    const ip = (ctx.req as any).ip ?? "unknown";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
    const rl = checkRateLimit({ key: `view:obra:${ipHash}:${input.id}`, ...LIMITS.view });
    if (!rl.allowed) return { skipped: true };
    return incrementObraViews(input.id);
  }),
  pending: protectedProcedure.query(({ ctx }) => { if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" }); return listPendingObras(); }),
  minhas: protectedProcedure.query(({ ctx }) => { if (!isTranslatorOrAbove(ctx.user.role)) return []; return listObrasByAuthor(ctx.user.id); }),
});

// ─── Capítulos Router ─────────────────────────────────────────────────────────
const capitulosRouter = router({
  // ✅ includeAll só para autor/admin — público vê apenas aprovados
  list: publicProcedure.input(z.object({ obraId: z.number(), includeAll: z.boolean().optional() })).query(({ ctx, input }) => {
    const podeVerTodos = input.includeAll && ctx.user && (isAdmin(ctx.user.role) || isTranslatorOrAbove(ctx.user.role));
    return listCapitulos(input.obraId, podeVerTodos ?? false);
  }),
  byId: publicProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const cap = await getCapituloById(input.id);
    if (!cap) throw new TRPCError({ code: "NOT_FOUND" });
    // ✅ Capítulos não aprovados só visíveis para o autor ou admin
    if (cap.status !== "aprovado") {
      const user = ctx.user;
      const isAuthor = user?.id === cap.authorId;
      const isAdminUser = user && isAdmin(user.role);
      if (!isAuthor && !isAdminUser) throw new TRPCError({ code: "NOT_FOUND" });
    }
    return cap;
  }),

  create: protectedProcedure
    .input(z.object({
      obraId: z.number(),
      numero: z.number(),
      title: z.string().optional(),
      paginas: z.array(z.string().url()).min(1).max(100),
      paginasKeys: z.array(z.string()).min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      canInteract(ctx.user);
      if (!isTranslatorOrAbove(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const obra = await getObraById(input.obraId);
      if (!obra) throw new TRPCError({ code: "NOT_FOUND" });
      if (obra.authorId !== ctx.user.id && !isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o autor da obra pode adicionar capítulos." });
      // ✅ Rate limit: 10 capítulos por hora
      const rl = checkRateLimit({ key: `criarCap:${ctx.user.id}`, ...LIMITS.criarCapitulo });
      if (!rl.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Limite de capítulos atingido. Tente em ${rl.retryAfterSec}s.` });
      // ✅ Limite de 10 capítulos aguardando para tradutor_aprendiz
      if (ctx.user.role === "tradutor_aprendiz") {
        const aguardando = await countCapitulosAguardando(ctx.user.id);
        if (aguardando >= 10) throw new TRPCError({ code: "FORBIDDEN", message: "Você já tem 10 capítulos aguardando aprovação. Aguarde antes de enviar mais." });
      }
      const status = isOfficialOrAbove(ctx.user.role) ? "aprovado" : "aguardando";
      await createCapitulo({
        obraId: input.obraId,
        authorId: ctx.user.id,
        numero: input.numero,
        title: input.title,
        paginas: JSON.stringify(input.paginas),
        paginasKeys: JSON.stringify(input.paginasKeys),
        status,
      });
      return { success: true, status };
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["aprovado", "rejeitado"]) }))
    .mutation(async ({ ctx, input }) => {
      if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      await updateCapituloStatus(input.id, input.status);
      await logAdm({ adminId: ctx.user.id, acao: input.status === "aprovado" ? "aprovar_capitulo" : "rejeitar_capitulo", targetType: "capitulo", targetId: input.id });
      return { success: true };
    }),

  incrementViews: publicProcedure.input(z.object({ id: z.number() })).mutation(({ ctx, input }) => {
    const ip = (ctx.req as any).ip ?? "unknown";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
    const rl = checkRateLimit({ key: `view:cap:${ipHash}:${input.id}`, ...LIMITS.view });
    if (!rl.allowed) return { skipped: true };
    return incrementCapituloViews(input.id);
  }),
  pending: protectedProcedure.query(({ ctx }) => { if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" }); return listPendingCapitulos(); }),
});

// ─── Comentários Router ───────────────────────────────────────────────────────
const comentariosRouter = router({
  list: publicProcedure.input(z.object({ obraId: z.number() })).query(({ input }) => listComentarios(input.obraId)),
  create: protectedProcedure
    .input(z.object({ obraId: z.number(), content: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      canInteract(ctx.user);
      // ✅ Rate limit: 10 comentários por minuto
      const rl = checkRateLimit({ key: `comentario:${ctx.user.id}`, ...LIMITS.comentario });
      if (!rl.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitos comentários. Aguarde ${rl.retryAfterSec}s.` });
      await createComentario({ ...input, autorId: ctx.user.id });
      return { success: true };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      await deleteComentario(input.id);
      await logAdm({ adminId: ctx.user.id, acao: "deletar_comentario", targetType: "comentario", targetId: input.id });
      return { success: true };
    }),
});

// ─── Curtidas Router ──────────────────────────────────────────────────────────
const curtidasRouter = router({
  count: publicProcedure.input(z.object({ obraId: z.number() })).query(({ input }) => countCurtidas(input.obraId)),
  status: protectedProcedure.input(z.object({ obraId: z.number() })).query(({ ctx, input }) => getCurtida(input.obraId, ctx.user.id).then((r) => !!r)),
  toggle: protectedProcedure.input(z.object({ obraId: z.number() })).mutation(({ ctx, input }) => {
    canInteract(ctx.user); // ✅ banimento suave bloqueia curtidas
    return toggleCurtida(input.obraId, ctx.user.id);
  }),
});

// ─── Favoritos Router ─────────────────────────────────────────────────────────
const favoritosRouter = router({
  list: protectedProcedure.query(({ ctx }) => listFavoritos(ctx.user.id)),
  status: protectedProcedure.input(z.object({ obraId: z.number() })).query(({ ctx, input }) => getFavorito(ctx.user.id, input.obraId).then((r) => !!r)),
  toggle: protectedProcedure.input(z.object({ obraId: z.number() })).mutation(({ ctx, input }) => {
    canInteract(ctx.user); // ✅ banimento suave bloqueia favoritos
    return toggleFavorito(ctx.user.id, input.obraId);
  }),
});

// ─── Leitura Router ───────────────────────────────────────────────────────────
const leituraRouter = router({
  history: protectedProcedure.query(({ ctx }) => getHistoricoLeitura(ctx.user.id)),
  upsert: protectedProcedure
    .input(z.object({ obraId: z.number(), capituloId: z.number(), progresso: z.number().min(0).max(100) }))
    .mutation(({ ctx, input }) => upsertHistoricoLeitura({ ...input, userId: ctx.user.id })),
});

// ─── Reports Router ───────────────────────────────────────────────────────────
const reportsRouter = router({
  create: protectedProcedure
    .input(z.object({ capituloId: z.number(), obraId: z.number(), tipo: z.enum(["imagem_faltando", "cap_nao_carrega", "erro_traducao", "outro"]), descricao: z.string().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.bannedTotal) throw new TRPCError({ code: "FORBIDDEN" });
      // ✅ Rate limit: 3 denúncias por hora
      const rl = checkRateLimit({ key: `denuncia:${ctx.user.id}`, ...LIMITS.denuncia });
      if (!rl.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Limite de denúncias atingido. Aguarde ${rl.retryAfterSec}s.` });
      await createReport({ ...input, userId: ctx.user.id });
      return { success: true };
    }),
});

// ─── Pedido de Cargo Router ───────────────────────────────────────────────────
const pedidoCargoRouter = router({
  criar: protectedProcedure
    .input(z.object({ tipo: z.enum(["quero_aprender", "posso_ajudar"]), mensagem: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "usuario") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas usuários comuns podem solicitar cargo." });
      if (ctx.user.bannedTotal || ctx.user.banned) throw new TRPCError({ code: "FORBIDDEN", message: "Sua conta está suspensa." });

      // Verifica cooldown de 10 dias
      if (ctx.user.ultimoPedidoCargo) {
        const diasPassados = (Date.now() - new Date(ctx.user.ultimoPedidoCargo).getTime()) / (1000 * 60 * 60 * 24);
        if (diasPassados < 10) {
          const diasRestantes = Math.ceil(10 - diasPassados);
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Aguarde ${diasRestantes} dia(s) antes de fazer um novo pedido.` });
        }
      }

      await criarPedidoCargo({ userId: ctx.user.id, tipo: input.tipo, mensagem: input.mensagem });
      return { success: true };
    }),

  meuPedidoRecente: protectedProcedure.query(async ({ ctx }) => {
    const pedidos = await listPedidosCargo(1, "pendente");
    const meu = pedidos.find((p: any) => p.userId === ctx.user.id);
    const bloqueadoAte = ctx.user.ultimoPedidoCargo
      ? new Date(new Date(ctx.user.ultimoPedidoCargo).getTime() + 10 * 24 * 60 * 60 * 1000)
      : null;
    return { status: meu?.status ?? null, bloqueadoAte };
  }),
});

// ─── Notificações Router ──────────────────────────────────────────────────────
const notificacoesRouter = router({
  list: protectedProcedure.query(({ ctx }) => listNotificacoes(ctx.user.id)),
  countNaoLidas: protectedProcedure.query(({ ctx }) => countNotificacoesNaoLidas(ctx.user.id)),
  marcarLida: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => marcarNotificacaoLida(input.id, ctx.user.id)),
  marcarTodasLidas: protectedProcedure.mutation(async ({ ctx }) => {
    const notifs = await listNotificacoes(ctx.user.id);
    await Promise.all(notifs.filter((n: any) => !n.lida).map((n: any) => marcarNotificacaoLida(n.id, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Admin Router ─────────────────────────────────────────────────────────────
const adminRouter = router({
  users: protectedProcedure
    .input(z.object({ page: z.number().optional(), search: z.string().optional(), role: z.string().optional() }))
    .query(({ ctx, input }) => {
      if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      return listUsers(input.page ?? 1, 30, input.search, input.role);
    }),

  setRole: protectedProcedure
    .input(z.object({ userId: z.number(), role: z.enum(["usuario", "tradutor_aprendiz", "tradutor_oficial", "admin", "admin_supremo"]) }))
    .mutation(async ({ ctx, input }) => {
      if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      // ✅ Não pode promover a si mesmo
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode alterar seu próprio cargo." });
      if (!isSupremeAdmin(ctx.user.role) && (input.role === "admin" || input.role === "admin_supremo")) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin Supremo pode promover a Admin." });
      if (input.role === "admin_supremo") throw new TRPCError({ code: "FORBIDDEN", message: "O cargo de Admin Supremo não pode ser atribuído por aqui." });
      await updateUserRole(input.userId, input.role);
      await logAdm({ adminId: ctx.user.id, acao: "alterar_role", detalhes: `Novo role: ${input.role}`, targetType: "usuario", targetId: input.userId });
      return { success: true };
    }),

  banUser: protectedProcedure
    .input(z.object({ userId: z.number(), banned: z.boolean(), total: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      // ✅ Não pode banir a si mesmo
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode banir a si mesmo." });
      // ✅ Não pode banir Admin Supremo
      const alvo = await getUserById(input.userId);
      if (alvo && isSupremeAdmin(alvo.role)) throw new TRPCError({ code: "FORBIDDEN", message: "O Admin Supremo não pode ser banido." });
      await banUser(input.userId, input.banned, input.total ?? false);
      await logAdm({ adminId: ctx.user.id, acao: input.banned ? (input.total ? "banir_total" : "banir_suave") : "desbanir_usuario", targetType: "usuario", targetId: input.userId });
      return { success: true };
    }),

  logs: protectedProcedure.input(z.object({ page: z.number().optional() })).query(({ ctx, input }) => {
    if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
    return listHistoricoAdm(input.page ?? 1);
  }),

  stats: protectedProcedure.query(({ ctx }) => {
    if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
    return getPlatformStats();
  }),

  setPublicLink: protectedProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // ✅ Só Admin Supremo pode editar links públicos (Discord, Telegram, etc)
      if (!isSupremeAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o Admin Supremo pode editar links públicos." });
      await setPublicLink(input.key, input.value);
      return { success: true };
    }),

  getPublicLink: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const result = await getPublicLink(input.key);
      return result ?? null;
    }),

  listReports: protectedProcedure
    .input(z.object({ page: z.number().optional(), resolved: z.boolean().optional() }))
    .query(({ ctx, input }) => {
      if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      return listReports(input.page ?? 1, 30, input.resolved);
    }),

  resolveReport: protectedProcedure
    .input(z.object({ reportId: z.number(), resolved: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      await resolveReport(input.reportId, input.resolved);
      return { success: true };
    }),

  // ✅ Pedidos de cargo no painel admin
  listPedidosCargo: protectedProcedure
    .input(z.object({ page: z.number().optional(), status: z.enum(["pendente", "aprovado", "rejeitado"]).optional() }))
    .query(({ ctx, input }) => {
      if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      return listPedidosCargo(input.page ?? 1, input.status);
    }),

  avaliarPedidoCargo: protectedProcedure
    .input(z.object({ pedidoId: z.number(), status: z.enum(["aprovado", "rejeitado"]), resposta: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      await avaliarPedidoCargo({ pedidoId: input.pedidoId, adminId: ctx.user.id, status: input.status, resposta: input.resposta });
      await logAdm({ adminId: ctx.user.id, acao: `pedido_cargo_${input.status}`, targetType: "usuario", targetId: input.pedidoId });
      return { success: true };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    // ✅ Logout unificado — invalida sessão no banco E limpa cookie
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const sessionId = ctx.req.cookies?.["asc_session"];
      if (sessionId && typeof sessionId === "string" && sessionId.length === 64) {
        await deletarSessao(sessionId).catch(() => {});
      }
      ctx.res.clearCookie("asc_session", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      });
      return { success: true } as const;
    }),
    updateProfile: protectedProcedure
      .input(z.object({ displayName: z.string().max(100).optional(), avatarUrl: z.string().url().optional().or(z.literal("")) }))
      .mutation(async ({ ctx, input }) => {
        await updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),
  }),
  obras: obrasRouter,
  capitulos: capitulosRouter,
  comentarios: comentariosRouter,
  curtidas: curtidasRouter,
  favoritos: favoritosRouter,
  leitura: leituraRouter,
  reports: reportsRouter,
  pedidoCargo: pedidoCargoRouter,
  notificacoes: notificacoesRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
