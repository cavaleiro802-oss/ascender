import { TRPCError } from "@trpc/server";
import { z } from "zod";
import crypto from "crypto";
import { checkRateLimit, LIMITS } from "./rateLimit";
import { protectedProcedure, publicProcedure, router } from "./trpc";
import {
  avaliarPedidoCargo, banUser, countCapitulosAguardando, countCurtidas,
  countNotificacoesNaoLidas, createCapitulo, createComentario, createObra,
  createReport, criarNotificacao, criarPedidoCargo, deletarSessao, deleteComentario,
  deleteCapitulo, getCapituloById, getComentarioById, getCurtida, getFavorito, getHistoricoLeitura, updateCapituloNumero,
  getObraById, getPublicLink, getPlatformStats, getUserById, getUserByOpenId,
  incrementCapituloViews, incrementObraViews, listCapitulos, listComentarios,
  listFavoritos, listHistoricoAdm, listNotificacoes, listObras, listObrasByAuthor,
  listPedidosCargo, listPendingCapitulos, listPendingObras, listReports, listUsers,
  logAdm, marcarNotificacaoLida, resolveReport, setPublicLink, toggleCurtida,
  toggleFavorito, updateCapituloStatus, updateObraAuthor, updateObraStatus,
  updateObra, updateUserProfile, updateUserRole, upsertHistoricoLeitura,
  // Loja
  listLojaItens, createLojaItem, updateLojaItem, listUsuarioItens,
  comprarItem, equiparItem, desequiparItem, getMoedasUsuario, adicionarMoedas,
} from "./db";

// ─── Helpers de permissão ─────────────────────────────────────────────────────
const ROLE_LEVEL: Record<string, number> = {
  usuario: 0, tradutor_aprendiz: 1, tradutor_oficial: 2,
  criador: 3, admin_senhor: 4, admin_supremo: 5,
};
function roleLevel(role: string)          { return ROLE_LEVEL[role] ?? 0; }
function isAdmin(role: string)            { return roleLevel(role) >= 4; }
function isSupremeAdmin(role: string)     { return role === "admin_supremo"; }
function isTranslatorOrAbove(role: string){ return roleLevel(role) >= 1; }
function isOfficialOrAbove(role: string)  { return roleLevel(role) >= 2; }
function canInteract(user: any) {
  if (user.bannedTotal) throw new TRPCError({ code: "FORBIDDEN", message: "Sua conta foi suspensa." });
  if (user.banned)      throw new TRPCError({ code: "FORBIDDEN", message: "Você está impedido de interagir no momento." });
}

// ─── Obras Router ─────────────────────────────────────────────────────────────
const obrasRouter = router({
  list: publicProcedure
    .input(z.object({
      genre:  z.string().optional(),
      search: z.string().max(100).optional(),
      sort:   z.enum(["hot", "recent", "most"]).optional(),
      page:   z.number().int().min(1).optional(),
      limit:  z.number().int().min(1).max(200).optional(),
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
    if (obra.status !== "aprovada") {
      const isAuthor    = ctx.user?.id === obra.authorId;
      const isAdminUser = ctx.user && isAdmin(ctx.user.role);
      if (!isAuthor && !isAdminUser) throw new TRPCError({ code: "NOT_FOUND" });
    }
    return obra;
  }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1), synopsis: z.string().optional(),
      genres: z.array(z.string()).optional(), coverUrl: z.string().optional(),
      coverKey: z.string().optional(),
      originalAuthor: z.string().optional(),
      tipo: z.enum(["manga", "novel"]).optional(),
      andamento: z.enum(["em_andamento", "hiato", "finalizado"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      canInteract(ctx.user);
      if (!isTranslatorOrAbove(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas tradutores podem criar obras." });
      const rl = checkRateLimit({ key: `criarObra:${ctx.user.id}`, ...LIMITS.criarObra });
      if (!rl.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Limite atingido. Tente em ${rl.retryAfterSec}s.` });
      const status = isOfficialOrAbove(ctx.user.role) ? "aprovada" : "em_espera";
      const obra = await createObra({ ...input, authorId: ctx.user.id, status });
      return { success: true, status, id: obra?.id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(), title: z.string().min(1).optional(), synopsis: z.string().optional(),
      genres: z.array(z.string()).optional(),
      andamento: z.enum(["em_andamento", "hiato", "finalizado"]).optional(),
      coverUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isSupremeAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o Admin Supremo pode editar obras." });
      const obra = await getObraById(input.id);
      if (!obra) throw new TRPCError({ code: "NOT_FOUND" });
      await updateObra(input.id, { title: input.title, synopsis: input.synopsis, genres: input.genres, andamento: input.andamento, coverUrl: input.coverUrl });
      await logAdm({ adminId: ctx.user.id, acao: "editar_obra", targetType: "obra", targetId: input.id });
      return { success: true };
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
      if (!isSupremeAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o Admin Supremo pode transferir autoria." });
      await updateObraAuthor(input.obraId, input.newAuthorId);
      await logAdm({ adminId: ctx.user.id, acao: "alterar_author_obra", detalhes: `Novo authorId: ${input.newAuthorId}`, targetType: "obra", targetId: input.obraId });
      return { success: true };
    }),

  incrementViews: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const ip     = (ctx.req as any).ip ?? "unknown";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
    const rl     = checkRateLimit({ key: `view:obra:${ipHash}:${input.id}`, ...LIMITS.view });
    if (!rl.allowed) return { skipped: true };
    await incrementObraViews(input.id);
    return { skipped: false };
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const cap = await getCapituloById(input.id);
      if (!cap) throw new TRPCError({ code: "NOT_FOUND" });
      await deleteCapitulo(input.id);
      await logAdm({ adminId: ctx.user.id, acao: "deletar_capitulo", targetType: "capitulo", targetId: input.id });
      return { success: true };
    }),

  searchByObra: protectedProcedure
    .input(z.object({ obraId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      return listCapitulos(input.obraId, true);
    }),

  pending: protectedProcedure.query(({ ctx }) => {
    if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
    return listPendingObras();
  }),

  minhas: protectedProcedure.query(({ ctx }) => {
    if (!isTranslatorOrAbove(ctx.user.role)) return [];
    return listObrasByAuthor(ctx.user.id);
  }),

  byTranslatorId: protectedProcedure
    .input(z.object({ translatorId: z.number() }))
    .query(({ ctx, input }) => {
      if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      return listObrasByAuthor(input.translatorId);
    }),
});

// ─── Capítulos Router ─────────────────────────────────────────────────────────
const capitulosRouter = router({
  list: publicProcedure
    .input(z.object({ obraId: z.number(), includeAll: z.boolean().optional() }))
    .query(({ ctx, input }) => {
      const podeVerTodos = input.includeAll && ctx.user && (isAdmin(ctx.user.role) || isTranslatorOrAbove(ctx.user.role));
      return listCapitulos(input.obraId, podeVerTodos ?? false);
    }),

  byId: publicProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const cap = await getCapituloById(input.id);
    if (!cap) throw new TRPCError({ code: "NOT_FOUND" });
    if (cap.status !== "aprovado") {
      const isAuthor    = ctx.user?.id === cap.authorId;
      const isAdminUser = ctx.user && isAdmin(ctx.user.role);
      if (!isAuthor && !isAdminUser) throw new TRPCError({ code: "NOT_FOUND" });
    }
    return cap;
  }),

  create: protectedProcedure
    .input(z.object({
      obraId: z.number(), numero: z.number(), title: z.string().optional(),
      paginas: z.array(z.string().url()).max(500).optional(),
      paginasKeys: z.array(z.string()).max(500).optional(),
      conteudo: z.string().max(500000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isTranslatorOrAbove(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const obra = await getObraById(input.obraId);
      if (!obra) throw new TRPCError({ code: "NOT_FOUND" });
      if (obra.authorId !== ctx.user.id && !isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o autor pode adicionar capítulos." });
      const rl = checkRateLimit({ key: `criarCap:${ctx.user.id}`, ...LIMITS.criarCapitulo });
      if (!rl.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Limite atingido. Tente em ${rl.retryAfterSec}s.` });
      if (ctx.user.role === "tradutor_aprendiz") {
        const aguardando = await countCapitulosAguardando(ctx.user.id);
        if (aguardando >= 10) throw new TRPCError({ code: "FORBIDDEN", message: "Você já tem 10 capítulos aguardando. Aguarde antes de enviar mais." });
      }
      // Validar conteúdo conforme tipo da obra
      if (obra.tipo === "novel") {
        if (!input.conteudo || input.conteudo.trim().length < 10) throw new TRPCError({ code: "BAD_REQUEST", message: "O conteúdo do capítulo é obrigatório para novels." });
      } else {
        if (!input.paginas || input.paginas.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Adicione pelo menos 1 página." });
      }
      const status = isOfficialOrAbove(ctx.user.role) ? "aprovado" : "aguardando";
      await createCapitulo({ obraId: input.obraId, authorId: ctx.user.id, numero: input.numero, title: input.title, paginas: input.paginas ? JSON.stringify(input.paginas) : undefined, paginasKeys: input.paginasKeys ? JSON.stringify(input.paginasKeys) : undefined, conteudo: input.conteudo, status });
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

  incrementViews: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const ip     = (ctx.req as any).ip ?? "unknown";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
    const rl     = checkRateLimit({ key: `view:cap:${ipHash}:${input.id}`, ...LIMITS.view });
    if (!rl.allowed) return { skipped: true };
    await incrementCapituloViews(input.id);
    return { skipped: false };
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const cap = await getCapituloById(input.id);
      if (!cap) throw new TRPCError({ code: "NOT_FOUND" });
      await deleteCapitulo(input.id);
      await logAdm({ adminId: ctx.user.id, acao: "deletar_capitulo", targetType: "capitulo", targetId: input.id });
      return { success: true };
    }),

  searchByObra: protectedProcedure
    .input(z.object({ obraId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      return listCapitulos(input.obraId, true);
    }),

  updateNumero: protectedProcedure
    .input(z.object({ id: z.number(), numero: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const cap = await getCapituloById(input.id);
      if (!cap) throw new TRPCError({ code: "NOT_FOUND" });
      const obra = await getObraById(cap.obraId);
      const isAuthor = obra?.authorId === ctx.user.id;
      const isAdminUser = isAdmin(ctx.user.role);
      if (!isAuthor && !isAdminUser) throw new TRPCError({ code: "FORBIDDEN" });
      await updateCapituloNumero(input.id, input.numero);
      return { success: true };
    }),

  pending: protectedProcedure.query(({ ctx }) => {
    if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
    return listPendingCapitulos();
  }),
});

// ─── Comentários Router ───────────────────────────────────────────────────────
const comentariosRouter = router({
  list: publicProcedure.input(z.object({ obraId: z.number() })).query(({ input }) => listComentarios(input.obraId)),

  listByCapitulo: publicProcedure
    .input(z.object({ capituloId: z.number() }))
    .query(({ input }) => listComentariosByCapitulo(input.capituloId)),

  create: protectedProcedure
    .input(z.object({ obraId: z.number(), capituloId: z.number().optional(), content: z.string().min(1).max(500), parentId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      canInteract(ctx.user);
      const rl = checkRateLimit({ key: `comentario:${ctx.user.id}`, ...LIMITS.comentario });
      if (!rl.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitos comentários. Aguarde ${rl.retryAfterSec}s.` });
      await createComentario({ obraId: input.obraId, capituloId: input.capituloId, autorId: ctx.user.id, content: input.content, parentId: input.parentId });
      // Notificar autor do comentário pai se for resposta
      if (input.parentId) {
        const pai = await getComentarioById(input.parentId);
        if (pai && pai.autorId !== ctx.user.id) {
          const obra = await getObraById(input.obraId);
          await criarNotificacao({
            userId: pai.autorId,
            tipo: "resposta_comentario",
            titulo: "💬 Alguém respondeu seu comentário",
            mensagem: `${ctx.user.displayName || ctx.user.name || "Alguém"} respondeu: "${input.content.slice(0, 80)}${input.content.length > 80 ? "..." : ""}" — em ${obra?.title ?? "uma obra"}`,
          });
        }
      }
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
  count:  publicProcedure.input(z.object({ obraId: z.number() })).query(({ input }) => countCurtidas(input.obraId)),
  status: protectedProcedure.input(z.object({ obraId: z.number() })).query(({ ctx, input }) => getCurtida(input.obraId, ctx.user.id).then((r) => !!r)),
  toggle: protectedProcedure.input(z.object({ obraId: z.number() })).mutation(({ ctx, input }) => { canInteract(ctx.user); return toggleCurtida(input.obraId, ctx.user.id); }),
});

// ─── Favoritos Router ─────────────────────────────────────────────────────────
const favoritosRouter = router({
  list:   protectedProcedure.query(({ ctx }) => listFavoritos(ctx.user.id)),
  status: protectedProcedure.input(z.object({ obraId: z.number() })).query(({ ctx, input }) => getFavorito(ctx.user.id, input.obraId).then((r) => !!r)),
  toggle: protectedProcedure.input(z.object({ obraId: z.number() })).mutation(({ ctx, input }) => { canInteract(ctx.user); return toggleFavorito(ctx.user.id, input.obraId); }),
});

// ─── Leitura Router ───────────────────────────────────────────────────────────
const leituraRouter = router({
  history: protectedProcedure.query(({ ctx }) => getHistoricoLeitura(ctx.user.id)),
  upsert:  protectedProcedure
    .input(z.object({ obraId: z.number(), capituloId: z.number(), progresso: z.number().min(0).max(100) }))
    .mutation(({ ctx, input }) => upsertHistoricoLeitura({ userId: ctx.user.id, ...input })),
});

// ─── Reports Router ───────────────────────────────────────────────────────────
const reportsRouter = router({
  create: protectedProcedure
    .input(z.object({ capituloId: z.number(), obraId: z.number(), tipo: z.enum(["imagem_faltando", "cap_nao_carrega", "erro_traducao", "outro"]), descricao: z.string().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.bannedTotal) throw new TRPCError({ code: "FORBIDDEN" });
      const rl = checkRateLimit({ key: `denuncia:${ctx.user.id}`, ...LIMITS.denuncia });
      if (!rl.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Limite atingido. Aguarde ${rl.retryAfterSec}s.` });
      await createReport({ capituloId: input.capituloId, obraId: input.obraId, userId: ctx.user.id, tipo: input.tipo, descricao: input.descricao });
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
      if (ctx.user.ultimoPedidoCargo) {
        const diasPassados = (Date.now() - new Date(ctx.user.ultimoPedidoCargo).getTime()) / (1000 * 60 * 60 * 24);
        if (diasPassados < 10) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Aguarde ${Math.ceil(10 - diasPassados)} dia(s) antes de fazer um novo pedido.` });
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
  list:          protectedProcedure.query(({ ctx }) => listNotificacoes(ctx.user.id)),
  countNaoLidas: protectedProcedure.query(({ ctx }) => countNotificacoesNaoLidas(ctx.user.id)),
  marcarLida:    protectedProcedure.input(z.object({ id: z.number() })).mutation(({ ctx, input }) => marcarNotificacaoLida(input.id, ctx.user.id)),
  marcarTodasLidas: protectedProcedure.mutation(async ({ ctx }) => {
    const notifs = await listNotificacoes(ctx.user.id);
    await Promise.all(notifs.filter((n: any) => !n.lida).map((n: any) => marcarNotificacaoLida(n.id, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Loja Router ──────────────────────────────────────────────────────────────
const lojaRouter = router({
  listItens: publicProcedure
    .input(z.object({ tipo: z.string().optional() }))
    .query(({ input }) => listLojaItens(input.tipo)),

  meusItens:     protectedProcedure.query(({ ctx }) => listUsuarioItens(ctx.user.id)),
  minhasMoedas:  protectedProcedure.query(({ ctx }) => getMoedasUsuario(ctx.user.id)),

  comprar: protectedProcedure
    .input(z.object({ itemId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      canInteract(ctx.user);
      const result = await comprarItem(ctx.user.id, input.itemId);
      return { success: true, item: result };
    }),

  equipar: protectedProcedure
    .input(z.object({ itemId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await equiparItem(ctx.user.id, input.itemId);
      return { success: true };
    }),

  desequipar: protectedProcedure
    .input(z.object({ itemId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await desequiparItem(ctx.user.id, input.itemId);
      return { success: true };
    }),

  // Admin supremo
  criarItem: protectedProcedure
    .input(z.object({
      nome:        z.string().min(1).max(100),
      descricao:   z.string().max(200).optional(),
      tipo:        z.enum(["moldura", "banner", "cor_comentario", "tag"]),
      raridade:    z.enum(["comum", "raro", "epico", "lendario"]).optional(),
      preco:       z.number().int().min(0),
      mediaUrl:    z.string().url(),
      mediaKey:    z.string().optional(),
      gratuito:    z.boolean().optional(),
      cargoMinimo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isSupremeAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const item = await createLojaItem(input);
      await logAdm({ adminId: ctx.user.id, acao: "criar_item_loja", detalhes: `${input.tipo}: ${input.nome}`, targetType: "loja_item", targetId: item.id });
      return { success: true, item };
    }),

  toggleItem: protectedProcedure
    .input(z.object({ id: z.number(), ativo: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!isSupremeAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      await updateLojaItem(input.id, { ativo: input.ativo });
      await logAdm({ adminId: ctx.user.id, acao: "toggle_item_loja", detalhes: input.ativo ? "Reativado" : "Desativado (raro)", targetType: "loja_item", targetId: input.id });
      return { success: true };
    }),

  adicionarMoedas: protectedProcedure
    .input(z.object({ userId: z.number(), valor: z.number().int().min(1), descricao: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!isSupremeAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      await adicionarMoedas(input.userId, input.valor, input.descricao ?? "Recarga manual pelo admin");
      await logAdm({ adminId: ctx.user.id, acao: "adicionar_moedas", detalhes: `+${input.valor} moedas para user #${input.userId}`, targetType: "usuario", targetId: input.userId });
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
    .input(z.object({ userId: z.number(), role: z.enum(["usuario", "tradutor_aprendiz", "tradutor_oficial", "criador", "admin_senhor", "admin_supremo"]) }))
    .mutation(async ({ ctx, input }) => {
      if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode alterar seu próprio cargo." });
      if (!isSupremeAdmin(ctx.user.role) && (input.role === "admin_senhor" || input.role === "admin_supremo")) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin Supremo pode promover a Admin." });
      if (input.role === "admin_supremo") throw new TRPCError({ code: "FORBIDDEN", message: "O cargo de Admin Supremo não pode ser atribuído por aqui." });
      await updateUserRole(input.userId, input.role);
      await logAdm({ adminId: ctx.user.id, acao: "alterar_role", detalhes: `Novo role: ${input.role}`, targetType: "usuario", targetId: input.userId });
      return { success: true };
    }),

  banUser: protectedProcedure
    .input(z.object({ userId: z.number(), banned: z.boolean(), total: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode banir a si mesmo." });
      const alvo = await getUserById(input.userId);
      if (alvo && isSupremeAdmin(alvo.role)) throw new TRPCError({ code: "FORBIDDEN", message: "O Admin Supremo não pode ser banido." });
      if (!isSupremeAdmin(ctx.user.role) && input.total) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o Admin Supremo pode aplicar banimento total." });
      await banUser(input.userId, input.banned, input.total ?? false);
      await logAdm({ adminId: ctx.user.id, acao: input.banned ? (input.total ? "banir_total" : "banir_suave") : "desbanir_usuario", targetType: "usuario", targetId: input.userId });
      return { success: true };
    }),

  logs: protectedProcedure
    .input(z.object({ page: z.number().optional() }))
    .query(({ ctx, input }) => {
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
      if (!isSupremeAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o Admin Supremo pode editar links públicos." });
      await setPublicLink(input.key, input.value);
      return { success: true };
    }),

  getPublicLink: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => { const result = await getPublicLink(input.key); return result ?? null; }),

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
    me:     publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const sessionId = ctx.req.cookies?.["asc_session"];
      if (sessionId && typeof sessionId === "string" && sessionId.length === 64) {
        await deletarSessao(sessionId).catch(() => {});
      }
      ctx.res.clearCookie("asc_session", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax" });
      return { success: true } as const;
    }),
    updateProfile: protectedProcedure
      .input(z.object({ displayName: z.string().max(100).optional(), avatarUrl: z.string().url().optional().or(z.literal("")) }))
      .mutation(async ({ ctx, input }) => { await updateUserProfile(ctx.user.id, input); return { success: true }; }),
  }),
  obras:        obrasRouter,
  capitulos:    capitulosRouter,
  comentarios:  comentariosRouter,
  curtidas:     curtidasRouter,
  favoritos:    favoritosRouter,
  leitura:      leituraRouter,
  reports:      reportsRouter,
  pedidoCargo:  pedidoCargoRouter,
  notificacoes: notificacoesRouter,
  admin:        adminRouter,
  loja:         lojaRouter,
});

export type AppRouter = typeof appRouter;
