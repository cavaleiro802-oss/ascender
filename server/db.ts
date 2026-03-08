import { and, desc, eq, like, sql, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import crypto from "crypto";
import {
  InsertUser, sessoes, capitulos, comentarios, curtidas, favoritos,
  historicoAdm, historicoLeitura, notificacoes, obras, obraTransferRequests,
  featureFlags, pedidosCargo, publicLinks, reports, users,
  lojaItens, usuarioItens, moedasTransacoes,
} from "../drizzle/schema";
import * as schema from "../drizzle/schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;
let _db: Db | null = null;

export async function getDb() {
  if (!_db) {
    try {
      const connectionString = process.env.DATABASE_URL;
      if (connectionString) {
        const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
        _db = drizzle(pool, { schema });
        console.log("[Database] Conectado via PostgreSQL");
      } else { console.warn("[Database] DATABASE_URL não definida"); }
    } catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const db = await getDb(); if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod", "displayName", "avatarUrl"] as const;
  for (const f of textFields) {
    const v = user[f];
    if (v !== undefined) { values[f] = v ?? null; updateSet[f] = v ?? null; }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === (process.env.OWNER_OPEN_ID ?? "")) { values.role = "admin_supremo"; updateSet.role = "admin_supremo"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet as any });
}
export async function getUserByOpenId(openId: string) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
export async function getUserById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}
export async function listUsers(page = 1, limit = 30, search?: string, role?: string) {
  const db = await getDb(); if (!db) return [];
  let query = db.select().from(users).$dynamic();
  const conditions: any[] = [];
  if (search) {
    const numId = parseInt(search);
    if (!isNaN(numId)) conditions.push(eq(users.id, numId));
    else conditions.push(like(users.name, `%${search}%`));
  }
  if (role) conditions.push(eq(users.role, role as any));
  if (conditions.length > 0) query = query.where(and(...conditions));
  return query.orderBy(desc(users.createdAt)).limit(limit).offset((page - 1) * limit);
}
export async function updateUserRole(userId: number, role: string) {
  const db = await getDb(); if (!db) return;
  await db.update(users).set({ role: role as any, updatedAt: new Date() }).where(eq(users.id, userId));
}
export async function banUser(userId: number, banned: boolean, total = false) {
  const db = await getDb(); if (!db) return;
  if (total) await db.update(users).set({ bannedTotal: banned, updatedAt: new Date() }).where(eq(users.id, userId));
  else await db.update(users).set({ banned, updatedAt: new Date() }).where(eq(users.id, userId));
}
export async function updateUserProfile(userId: number, data: { displayName?: string; avatarUrl?: string }) {
  const db = await getDb(); if (!db) return;
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (data.displayName !== undefined) set.displayName = data.displayName || null;
  if (data.avatarUrl !== undefined) set.avatarUrl = data.avatarUrl || null;
  await db.update(users).set(set as any).where(eq(users.id, userId));
}
export async function updateUserCosmeticos(userId: number, cosmeticos: Record<string, any>) {
  const db = await getDb(); if (!db) return;
  await db.update(users).set({ cosmeticos: JSON.stringify(cosmeticos), updatedAt: new Date() }).where(eq(users.id, userId));
}

// ─── Pedidos de Cargo ────────────────────────────────────────────────────────
export async function criarPedidoCargo(data: { userId: number; tipo: "quero_aprender" | "posso_ajudar"; mensagem?: string }) {
  const db = await getDb(); if (!db) return;
  await db.update(users).set({ ultimoPedidoCargo: new Date() }).where(eq(users.id, data.userId));
  await db.insert(pedidosCargo).values({ ...data, status: "pendente" });
}
export async function listPedidosCargo(page = 1, status?: "pendente" | "aprovado" | "rejeitado") {
  const db = await getDb(); if (!db) return [];
  let query = db.select().from(pedidosCargo).$dynamic();
  if (status) query = query.where(eq(pedidosCargo.status, status));
  return query.orderBy(desc(pedidosCargo.createdAt)).limit(30).offset((page - 1) * 30);
}
export async function avaliarPedidoCargo(data: { pedidoId: number; adminId: number; status: "aprovado" | "rejeitado"; resposta?: string; }) {
  const db = await getDb(); if (!db) return;
  const pedido = await db.select().from(pedidosCargo).where(eq(pedidosCargo.id, data.pedidoId)).limit(1);
  if (!pedido[0]) return;
  await db.update(pedidosCargo).set({ status: data.status, adminId: data.adminId, respostaAdmin: data.resposta || null, avaliadoEm: new Date() }).where(eq(pedidosCargo.id, data.pedidoId));
  if (data.status === "aprovado") {
    const novoRole = pedido[0].tipo === "quero_aprender" ? "tradutor_aprendiz" : "tradutor_oficial";
    await db.update(users).set({ role: novoRole, updatedAt: new Date() }).where(eq(users.id, pedido[0].userId));
    // Conceder itens de cargo automaticamente
    await concederItensDeCargo(pedido[0].userId, novoRole);
    const tradutorLink = await getPublicLink("tradutorPraCima");
    const msgLink = tradutorLink ? `\n\nAcesse nosso grupo: ${tradutorLink.value}` : "";
    await criarNotificacao({ userId: pedido[0].userId, tipo: "cargo_aprovado", titulo: "🎉 Pedido aprovado! Bem-vindo à equipe!", mensagem: `Seu pedido foi aprovado! Você agora é ${novoRole === "tradutor_aprendiz" ? "Tradutor Aprendiz" : "Tradutor Oficial"}.${msgLink}` });
  } else {
    await criarNotificacao({ userId: pedido[0].userId, tipo: "cargo_rejeitado", titulo: "Pedido não aprovado desta vez", mensagem: `Infelizmente seu pedido não foi aprovado agora. ${data.resposta ? data.resposta : "Estamos sem capacidade de administrar novos tradutores no momento."} Você pode tentar novamente em 10 dias.` });
  }
}

// ─── Notificações ────────────────────────────────────────────────────────────
export async function criarNotificacao(data: { userId: number; tipo: "cargo_aprovado" | "cargo_rejeitado" | "bem_vindo_equipe" | "resposta_comentario"; titulo: string; mensagem: string }) {
  const db = await getDb(); if (!db) return;
  await db.insert(notificacoes).values(data);
}
export async function listNotificacoes(userId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(notificacoes).where(eq(notificacoes.userId, userId)).orderBy(desc(notificacoes.createdAt)).limit(20);
}
export async function marcarNotificacaoLida(notifId: number, userId: number) {
  const db = await getDb(); if (!db) return;
  await db.update(notificacoes).set({ lida: true }).where(and(eq(notificacoes.id, notifId), eq(notificacoes.userId, userId)));
}
export async function countNotificacoesNaoLidas(userId: number) {
  const db = await getDb(); if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(notificacoes).where(and(eq(notificacoes.userId, userId), eq(notificacoes.lida, false)));
  return result[0]?.count ?? 0;
}

// ─── Obras ───────────────────────────────────────────────────────────────────
export async function listObras(opts: { status?: string; genre?: string; search?: string; sort?: "hot" | "recent" | "most"; page?: number; limit?: number; }) {
  const db = await getDb(); if (!db) return [];
  const { status = "aprovada", genre, search, sort = "recent", page = 1, limit = 20 } = opts;
  let query = db.select().from(obras).$dynamic();
  const conditions = [eq(obras.status, status as any)];
  if (search) conditions.push(like(obras.title, `%${search}%`));
  if (genre) conditions.push(like(obras.genres, `%${genre}%`));
  query = query.where(and(...conditions));
  if (sort === "hot") query = query.orderBy(desc(obras.viewsWeek));
  else if (sort === "most") query = query.orderBy(desc(obras.viewsTotal));
  else query = query.orderBy(desc(obras.updatedAt));
  const obrasList = await query.limit(limit).offset((page - 1) * limit);

  // Buscar últimos 3 capítulos aprovados de cada obra
  const obraIds = obrasList.map((o) => o.id);
  if (obraIds.length === 0) return [];

  const caps = await db
    .select({
      id: capitulos.id,
      obraId: capitulos.obraId,
      numero: capitulos.numero,
      title: capitulos.title,
      createdAt: capitulos.createdAt,
    })
    .from(capitulos)
    .where(and(
      sql`${capitulos.obraId} = ANY(ARRAY[${sql.join(obraIds.map(id => sql`${id}`), sql`, `)}]::int[])`,
      eq(capitulos.status, "aprovado")
    ))
    .orderBy(desc(capitulos.createdAt));

  // Agrupar 3 mais recentes por obra
  const capsPorObra: Record<number, typeof caps> = {};
  for (const cap of caps) {
    if (!capsPorObra[cap.obraId]) capsPorObra[cap.obraId] = [];
    if (capsPorObra[cap.obraId].length < 3) capsPorObra[cap.obraId].push(cap);
  }

  return obrasList.map((o) => ({
    ...o,
    ultimosCapitulos: capsPorObra[o.id] ?? [],
  }));
}
export async function listObrasByAuthor(authorId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(obras).where(eq(obras.authorId, authorId)).orderBy(desc(obras.updatedAt)).limit(50);
}
export async function getObraById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(obras).where(eq(obras.id, id)).limit(1);
  return result[0];
}
export async function createObra(data: { title: string; synopsis?: string; genres?: string[]; coverUrl?: string; authorId: number; originalAuthor?: string; status: "em_espera" | "aprovada"; andamento?: "em_andamento" | "iato" | "finalizado"; }) {
  const db = await getDb(); if (!db) throw new Error("DB unavailable");
  const result = await db.insert(obras).values({ ...data, genres: data.genres ? JSON.stringify(data.genres) : null }).returning();
  return result[0];
}
export async function updateObra(obraId: number, data: { title?: string; synopsis?: string; genres?: string[]; andamento?: "em_andamento" | "iato" | "finalizado"; coverUrl?: string; }) {
  const db = await getDb(); if (!db) return;
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (data.title !== undefined) set.title = data.title;
  if (data.synopsis !== undefined) set.synopsis = data.synopsis || null;
  if (data.genres !== undefined) set.genres = JSON.stringify(data.genres);
  if (data.andamento !== undefined) set.andamento = data.andamento;
  if (data.coverUrl !== undefined) set.coverUrl = data.coverUrl;
  await db.update(obras).set(set as any).where(eq(obras.id, obraId));
}
export async function updateObraStatus(obraId: number, status: "em_espera" | "aprovada" | "rejeitada") {
  const db = await getDb(); if (!db) return;
  await db.update(obras).set({ status, updatedAt: new Date() }).where(eq(obras.id, obraId));
}
export async function updateObraAuthor(obraId: number, authorId: number) {
  const db = await getDb(); if (!db) return;
  await db.update(obras).set({ authorId, updatedAt: new Date() }).where(eq(obras.id, obraId));
}
export async function incrementObraViews(obraId: number) {
  const db = await getDb(); if (!db) return;
  await db.update(obras).set({ viewsTotal: sql`${obras.viewsTotal} + 1`, viewsWeek: sql`${obras.viewsWeek} + 1`, updatedAt: new Date() }).where(eq(obras.id, obraId));
}
export async function resetWeeklyViews() {
  const db = await getDb(); if (!db) return;
  await db.update(obras).set({ viewsWeek: 0 });
}
export async function listPendingObras() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(obras).where(eq(obras.status, "em_espera")).orderBy(obras.createdAt);
}

// ─── Transferência de Obra ────────────────────────────────────────────────────
export async function solicitarTransferObra(data: { obraId: number; requesterId: number; novoAuthorId: number; motivo?: string; }) {
  const db = await getDb(); if (!db) return;
  await cancelarTransferSeObraMudou(data.obraId);
  const existente = await db.select().from(obraTransferRequests).where(and(eq(obraTransferRequests.obraId, data.obraId), eq(obraTransferRequests.status, "pendente"))).limit(1);
  if (existente[0]) throw new Error("Já existe um pedido de transferência pendente para esta obra.");
  await db.insert(obraTransferRequests).values({ ...data, status: "pendente" });
}
export async function cancelarTransferSeObraMudou(obraId: number) {
  const db = await getDb(); if (!db) return;
  const obra = await getObraById(obraId); if (!obra) return;
  const pendentes = await db.select().from(obraTransferRequests).where(and(eq(obraTransferRequests.obraId, obraId), eq(obraTransferRequests.status, "pendente")));
  for (const req of pendentes) {
    if (obra.updatedAt > req.createdAt) {
      await db.update(obraTransferRequests).set({ status: "rejeitado", canceladoMotivo: "Obra foi modificada antes da decisão.", decidedAt: new Date() }).where(eq(obraTransferRequests.id, req.id));
    }
  }
}
export async function decidirTransferObra(data: { requestId: number; decidedBy: number; status: "aprovado" | "rejeitado"; canceladoMotivo?: string; }) {
  const db = await getDb(); if (!db) return;
  const req = await db.select().from(obraTransferRequests).where(eq(obraTransferRequests.id, data.requestId)).limit(1);
  if (!req[0] || req[0].status !== "pendente") throw new Error("Request não encontrado ou já decidido.");
  await cancelarTransferSeObraMudou(req[0].obraId);
  const reqAtual = await db.select().from(obraTransferRequests).where(eq(obraTransferRequests.id, data.requestId)).limit(1);
  if (!reqAtual[0] || reqAtual[0].status !== "pendente") throw new Error("Request cancelado automaticamente pois a obra foi modificada.");
  await db.update(obraTransferRequests).set({ status: data.status, decidedBy: data.decidedBy, decidedAt: new Date(), canceladoMotivo: data.canceladoMotivo ?? null }).where(eq(obraTransferRequests.id, data.requestId));
  if (data.status === "aprovado") await updateObraAuthor(req[0].obraId, req[0].novoAuthorId);
}
export async function listTransferRequests(obraId?: number, status?: "pendente" | "aprovado" | "rejeitado") {
  const db = await getDb(); if (!db) return [];
  let query = db.select().from(obraTransferRequests).$dynamic();
  const conds: any[] = [];
  if (obraId) conds.push(eq(obraTransferRequests.obraId, obraId));
  if (status) conds.push(eq(obraTransferRequests.status, status));
  if (conds.length > 0) query = query.where(and(...conds));
  return query.orderBy(desc(obraTransferRequests.createdAt)).limit(50);
}

// ─── Feature Flags ────────────────────────────────────────────────────────────
export async function getFeatureFlag(key: string): Promise<boolean> {
  const db = await getDb(); if (!db) return false;
  const result = await db.select().from(featureFlags).where(eq(featureFlags.key, key)).limit(1);
  return result[0]?.enabled ?? false;
}
export async function setFeatureFlag(key: string, enabled: boolean) {
  const db = await getDb(); if (!db) return;
  await db.insert(featureFlags).values({ key, enabled, updatedAt: new Date() }).onConflictDoUpdate({ target: featureFlags.key, set: { enabled, updatedAt: new Date() } });
}
export async function listFeatureFlags() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(featureFlags).orderBy(featureFlags.key);
}

// ─── Capítulos ───────────────────────────────────────────────────────────────
export async function listCapitulos(obraId: number, includeAll = false) {
  const db = await getDb(); if (!db) return [];
  const conds = [eq(capitulos.obraId, obraId)];
  if (!includeAll) conds.push(eq(capitulos.status, "aprovado"));
  return db.select().from(capitulos).where(and(...conds)).orderBy(capitulos.numero);
}
export async function getCapituloById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(capitulos).where(eq(capitulos.id, id)).limit(1);
  return result[0];
}
export async function createCapitulo(data: { obraId: number; authorId: number; numero: number; title?: string; paginas?: string; paginasKeys?: string; status: "aguardando" | "aprovado"; }) {
  const db = await getDb(); if (!db) throw new Error("DB unavailable");
  const result = await db.insert(capitulos).values(data).returning();
  // Atualizar updatedAt da obra para aparecer no topo da home
  if (data.status === "aprovado") {
    await db.update(obras).set({ updatedAt: new Date() }).where(eq(obras.id, data.obraId));
  }
  return result[0];
}
export async function countCapitulosAguardando(authorId: number) {
  const db = await getDb(); if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(capitulos).where(and(eq(capitulos.authorId, authorId), eq(capitulos.status, "aguardando")));
  return result[0]?.count ?? 0;
}
export async function updateCapituloStatus(capId: number, status: "aguardando" | "aprovado" | "rejeitado") {
  const db = await getDb(); if (!db) return;
  await db.update(capitulos).set({ status, updatedAt: new Date() }).where(eq(capitulos.id, capId));
  // Se aprovado, sobe a obra no topo da home
  if (status === "aprovado") {
    const cap = await db.select({ obraId: capitulos.obraId }).from(capitulos).where(eq(capitulos.id, capId)).limit(1);
    if (cap[0]) await db.update(obras).set({ updatedAt: new Date() }).where(eq(obras.id, cap[0].obraId));
  }
}
export async function incrementCapituloViews(capId: number) {
  const db = await getDb(); if (!db) return;
  await db.update(capitulos).set({ viewsTotal: sql`${capitulos.viewsTotal} + 1` }).where(eq(capitulos.id, capId));
}
export async function listPendingCapitulos() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(capitulos).where(eq(capitulos.status, "aguardando")).orderBy(capitulos.createdAt);
}

// ─── Comentários ─────────────────────────────────────────────────────────────
export async function listComentarios(obraId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(comentarios).where(and(eq(comentarios.obraId, obraId), eq(comentarios.deleted, false))).orderBy(desc(comentarios.createdAt));
}
export async function getComentarioById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(comentarios).where(eq(comentarios.id, id)).limit(1);
  return result[0];
}
export async function createComentario(data: { obraId: number; autorId: number; content: string; parentId?: number }) {
  const db = await getDb(); if (!db) throw new Error("DB unavailable");
  const result = await db.insert(comentarios).values(data).returning();
  return result[0];
}
export async function deleteComentario(id: number) {
  const db = await getDb(); if (!db) return;
  await db.update(comentarios).set({ deleted: true }).where(eq(comentarios.id, id));
}

// ─── Curtidas ────────────────────────────────────────────────────────────────
export async function getCurtida(obraId: number, userId: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(curtidas).where(and(eq(curtidas.obraId, obraId), eq(curtidas.userId, userId))).limit(1);
  return result[0];
}
export async function countCurtidas(obraId: number) {
  const db = await getDb(); if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(curtidas).where(eq(curtidas.obraId, obraId));
  return result[0]?.count ?? 0;
}
export async function toggleCurtida(obraId: number, userId: number) {
  const existing = await getCurtida(obraId, userId);
  const db = await getDb(); if (!db) return false;
  if (existing) { await db.delete(curtidas).where(and(eq(curtidas.obraId, obraId), eq(curtidas.userId, userId))); return false; }
  else { await db.insert(curtidas).values({ obraId, userId }); return true; }
}

// ─── Favoritos ───────────────────────────────────────────────────────────────
export async function listFavoritos(userId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(favoritos).where(eq(favoritos.userId, userId)).orderBy(desc(favoritos.createdAt));
}
export async function getFavorito(userId: number, obraId: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(favoritos).where(and(eq(favoritos.userId, userId), eq(favoritos.obraId, obraId))).limit(1);
  return result[0];
}
export async function toggleFavorito(userId: number, obraId: number) {
  const existing = await getFavorito(userId, obraId);
  const db = await getDb(); if (!db) return false;
  if (existing) { await db.delete(favoritos).where(and(eq(favoritos.userId, userId), eq(favoritos.obraId, obraId))); return false; }
  else { await db.insert(favoritos).values({ userId, obraId }); return true; }
}

// ─── Histórico de Leitura ────────────────────────────────────────────────────
export async function getHistoricoLeitura(userId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(historicoLeitura).where(eq(historicoLeitura.userId, userId)).orderBy(desc(historicoLeitura.updatedAt));
}
export async function upsertHistoricoLeitura(data: { userId: number; obraId: number; capituloId: number; progresso: number; }) {
  const db = await getDb(); if (!db) return;
  await db.insert(historicoLeitura).values(data).onConflictDoUpdate({ target: [historicoLeitura.userId, historicoLeitura.capituloId], set: { progresso: data.progresso, updatedAt: new Date() } });
}

// ─── Histórico ADM ───────────────────────────────────────────────────────────
export async function logAdm(data: { adminId: number; acao: string; detalhes?: string; targetType?: string; targetId?: number; }) {
  const db = await getDb(); if (!db) return;
  await db.insert(historicoAdm).values(data);
}
export async function listHistoricoAdm(page = 1, limit = 50) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(historicoAdm).orderBy(desc(historicoAdm.createdAt)).limit(limit).offset((page - 1) * limit);
}

// ─── Stats ───────────────────────────────────────────────────────────────────
export async function getPlatformStats() {
  const db = await getDb(); if (!db) return null;
  const [[totalObras], [totalCaps], [totalUsers], [pendingObras], [pendingCaps], [pendingPedidos]] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(obras).where(eq(obras.status, "aprovada")),
    db.select({ count: sql<number>`count(*)` }).from(capitulos).where(eq(capitulos.status, "aprovado")),
    db.select({ count: sql<number>`count(*)` }).from(users),
    db.select({ count: sql<number>`count(*)` }).from(obras).where(eq(obras.status, "em_espera")),
    db.select({ count: sql<number>`count(*)` }).from(capitulos).where(eq(capitulos.status, "aguardando")),
    db.select({ count: sql<number>`count(*)` }).from(pedidosCargo).where(eq(pedidosCargo.status, "pendente")),
  ]);
  return { totalObras: totalObras?.count ?? 0, totalCaps: totalCaps?.count ?? 0, totalUsers: totalUsers?.count ?? 0, pendingObras: pendingObras?.count ?? 0, pendingCaps: pendingCaps?.count ?? 0, pendingPedidos: pendingPedidos?.count ?? 0 };
}

// ─── Links Públicos ──────────────────────────────────────────────────────────
export async function getPublicLink(key: string) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(publicLinks).where(eq(publicLinks.key, key)).limit(1);
  return result[0];
}
export async function setPublicLink(key: string, value: string) {
  const db = await getDb(); if (!db) return;
  await db.insert(publicLinks).values({ key, value }).onConflictDoUpdate({ target: publicLinks.key, set: { value, updatedAt: new Date() } });
}

// ─── Reports ─────────────────────────────────────────────────────────────────
export async function createReport(data: { capituloId: number; obraId: number; userId: number; tipo: "imagem_faltando" | "cap_nao_carrega" | "erro_traducao" | "outro"; descricao?: string; }) {
  const db = await getDb(); if (!db) return;
  await db.insert(reports).values(data);
}
export async function listReports(page = 1, limit = 30, resolved?: boolean) {
  const db = await getDb(); if (!db) return [];
  let query = db.select().from(reports).$dynamic();
  const conditions: any[] = [];
  if (resolved !== undefined) conditions.push(eq(reports.resolvido, resolved));
  if (conditions.length > 0) query = query.where(and(...conditions));
  return query.orderBy(desc(reports.createdAt)).limit(limit).offset((page - 1) * limit);
}
export async function resolveReport(reportId: number, resolved: boolean) {
  const db = await getDb(); if (!db) return;
  await db.update(reports).set({ resolvido: resolved }).where(eq(reports.id, reportId));
}

// ─── Sessões ──────────────────────────────────────────────────────────────────
const SESSAO_DIAS = 30;
export async function criarSessao(openId: string, userId: number, ip?: string): Promise<string> {
  const db = await getDb(); if (!db) throw new Error("DB unavailable");
  const id = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSAO_DIAS * 24 * 60 * 60 * 1000);
  await db.insert(sessoes).values({ id, userId, openId, expiresAt, ip: ip ?? null });
  return id;
}
export async function getSessao(sessionId: string) {
  const db = await getDb(); if (!db) return null;
  const result = await db.select().from(sessoes).where(eq(sessoes.id, sessionId)).limit(1);
  const sessao = result[0]; if (!sessao) return null;
  if (sessao.expiresAt < new Date()) { await db.delete(sessoes).where(eq(sessoes.id, sessionId)); return null; }
  return sessao;
}
export async function deletarSessao(sessionId: string) {
  const db = await getDb(); if (!db) return;
  await db.delete(sessoes).where(eq(sessoes.id, sessionId));
}
export async function deletarSessoesUsuario(userId: number) {
  const db = await getDb(); if (!db) return;
  await db.delete(sessoes).where(eq(sessoes.userId, userId));
}
export async function limparSessoesExpiradas() {
  const db = await getDb(); if (!db) return;
  await db.delete(sessoes).where(lt(sessoes.expiresAt, new Date()));
}

// ─── Loja ────────────────────────────────────────────────────────────────────
export async function listLojaItens(tipo?: string) {
  const db = await getDb(); if (!db) return [];
  let query = db.select().from(lojaItens).where(eq(lojaItens.ativo, true)).$dynamic();
  if (tipo) query = query.where(and(eq(lojaItens.ativo, true), eq(lojaItens.tipo, tipo as any)));
  return query.orderBy(lojaItens.tipo, lojaItens.preco);
}
export async function getLojaItemById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(lojaItens).where(eq(lojaItens.id, id)).limit(1);
  return result[0];
}
export async function createLojaItem(data: { nome: string; descricao?: string; tipo: "moldura" | "banner" | "cor_comentario" | "tag"; raridade?: "comum" | "raro" | "epico" | "lendario"; preco: number; mediaUrl: string; mediaKey?: string; gratuito?: boolean; cargoMinimo?: string; }) {
  const db = await getDb(); if (!db) throw new Error("DB unavailable");
  const result = await db.insert(lojaItens).values(data).returning();
  return result[0];
}
export async function updateLojaItem(id: number, data: Partial<{ nome: string; descricao: string; preco: number; ativo: boolean; raridade: string; }>) {
  const db = await getDb(); if (!db) return;
  await db.update(lojaItens).set(data as any).where(eq(lojaItens.id, id));
}
export async function listUsuarioItens(userId: number) {
  const db = await getDb(); if (!db) return [];
  // Retorna itens do usuário com dados do item, equipados primeiro
  return db.select().from(usuarioItens)
    .where(eq(usuarioItens.userId, userId))
    .orderBy(desc(usuarioItens.equipado), desc(usuarioItens.createdAt));
}
export async function getUsuarioItem(userId: number, itemId: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(usuarioItens).where(and(eq(usuarioItens.userId, userId), eq(usuarioItens.itemId, itemId))).limit(1);
  return result[0];
}
export async function comprarItem(userId: number, itemId: number) {
  const db = await getDb(); if (!db) throw new Error("DB unavailable");
  const item = await getLojaItemById(itemId);
  if (!item || !item.ativo) throw new Error("Item não encontrado.");
  const jaTemItem = await getUsuarioItem(userId, itemId);
  if (jaTemItem) throw new Error("Você já possui este item.");
  const user = await getUserById(userId);
  if (!user) throw new Error("Usuário não encontrado.");
  if ((user.moedas ?? 0) < item.preco) throw new Error("Moedas insuficientes.");
  // Debitar moedas
  await db.update(users).set({ moedas: sql`${users.moedas} - ${item.preco}`, updatedAt: new Date() }).where(eq(users.id, userId));
  // Registrar transação
  await db.insert(moedasTransacoes).values({ userId, valor: -item.preco, tipo: "compra_item", descricao: `Compra: ${item.nome}`, itemId });
  // Conceder item
  const result = await db.insert(usuarioItens).values({ userId, itemId, equipado: false, origem: "compra" }).returning();
  return result[0];
}
export async function equiparItem(userId: number, itemId: number) {
  const db = await getDb(); if (!db) return;
  const item = await getLojaItemById(itemId);
  if (!item) throw new Error("Item não encontrado.");
  const posse = await getUsuarioItem(userId, itemId);
  if (!posse) throw new Error("Você não possui este item.");
  // Desequipar outros do mesmo tipo
  const itensDoTipo = await db.select({ ui: usuarioItens, li: lojaItens })
    .from(usuarioItens)
    .where(eq(usuarioItens.userId, userId));
  // Simples: desequipar todos do mesmo tipo antes
  for (const { ui, li } of itensDoTipo as any[]) {
    if (li?.tipo === item.tipo && ui.equipado) {
      await db.update(usuarioItens).set({ equipado: false }).where(eq(usuarioItens.id, ui.id));
    }
  }
  await db.update(usuarioItens).set({ equipado: true }).where(and(eq(usuarioItens.userId, userId), eq(usuarioItens.itemId, itemId)));
  // Atualizar cosméticos ativos no usuário
  const user = await getUserById(userId);
  const cosmeticos = JSON.parse(user?.cosmeticos ?? "{}");
  cosmeticos[item.tipo] = { itemId, mediaUrl: item.mediaUrl };
  await updateUserCosmeticos(userId, cosmeticos);
}
export async function desequiparItem(userId: number, itemId: number) {
  const db = await getDb(); if (!db) return;
  const item = await getLojaItemById(itemId);
  if (!item) throw new Error("Item não encontrado.");
  await db.update(usuarioItens).set({ equipado: false }).where(and(eq(usuarioItens.userId, userId), eq(usuarioItens.itemId, itemId)));
  const user = await getUserById(userId);
  const cosmeticos = JSON.parse(user?.cosmeticos ?? "{}");
  delete cosmeticos[item.tipo];
  await updateUserCosmeticos(userId, cosmeticos);
}
export async function concederItensDeCargo(userId: number, cargo: string) {
  const db = await getDb(); if (!db) return;
  const itensGratuitos = await db.select().from(lojaItens)
    .where(and(eq(lojaItens.gratuito, true), eq(lojaItens.cargoMinimo, cargo), eq(lojaItens.ativo, true)));
  for (const item of itensGratuitos) {
    const jaTemItem = await getUsuarioItem(userId, item.id);
    if (!jaTemItem) {
      await db.insert(usuarioItens).values({ userId, itemId: item.id, equipado: false, origem: "cargo" });
    }
  }
}
export async function getMoedasUsuario(userId: number) {
  const db = await getDb(); if (!db) return 0;
  const user = await getUserById(userId);
  return user?.moedas ?? 0;
}
export async function adicionarMoedas(userId: number, valor: number, descricao: string) {
  const db = await getDb(); if (!db) return;
  await db.update(users).set({ moedas: sql`${users.moedas} + ${valor}`, updatedAt: new Date() }).where(eq(users.id, userId));
  await db.insert(moedasTransacoes).values({ userId, valor, tipo: "recarga", descricao });
}
