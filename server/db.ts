import { and, desc, eq, like, sql, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import crypto from "crypto"; // ✅ import no topo, não no meio do arquivo
import {
  InsertUser,
  sessoes,
  capitulos,
  comentarios,
  curtidas,
  favoritos,
  historicoAdm,
  historicoLeitura,
  notificacoes,
  obras,
  pedidosCargo,
  publicLinks,
  reports,
  users,
} from "../drizzle/schema";
let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const db = await getDb();
  if (!db) return;
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
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function listUsers(page = 1, limit = 30, search?: string, role?: string) {
  const db = await getDb();
  if (!db) return [];
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
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role: role as any, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function banUser(userId: number, banned: boolean, total = false) {
  const db = await getDb();
  if (!db) return;
  if (total) {
    await db.update(users).set({ bannedTotal: banned, updatedAt: new Date() }).where(eq(users.id, userId));
  } else {
    await db.update(users).set({ banned, updatedAt: new Date() }).where(eq(users.id, userId));
  }
}

export async function updateUserProfile(userId: number, data: { displayName?: string; avatarUrl?: string }) {
  const db = await getDb();
  if (!db) return;
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (data.displayName !== undefined) set.displayName = data.displayName || null;
  if (data.avatarUrl !== undefined) set.avatarUrl = data.avatarUrl || null;
  await db.update(users).set(set as any).where(eq(users.id, userId));
}

// ─── Pedidos de Cargo ────────────────────────────────────────────────────────
export async function criarPedidoCargo(data: { userId: number; tipo: "quero_aprender" | "posso_ajudar"; mensagem?: string }) {
  const db = await getDb();
  if (!db) return;
  // Atualiza timestamp do último pedido no usuário
  await db.update(users).set({ ultimoPedidoCargo: new Date() }).where(eq(users.id, data.userId));
  await db.insert(pedidosCargo).values({ ...data, status: "pendente" });
}

export async function listPedidosCargo(page = 1, status?: "pendente" | "aprovado" | "rejeitado") {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(pedidosCargo).$dynamic();
  if (status) query = query.where(eq(pedidosCargo.status, status));
  return query.orderBy(desc(pedidosCargo.createdAt)).limit(30).offset((page - 1) * 30);
}

export async function avaliarPedidoCargo(data: {
  pedidoId: number;
  adminId: number;
  status: "aprovado" | "rejeitado";
  resposta?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const pedido = await db.select().from(pedidosCargo).where(eq(pedidosCargo.id, data.pedidoId)).limit(1);
  if (!pedido[0]) return;

  await db.update(pedidosCargo).set({
    status: data.status,
    adminId: data.adminId,
    respostaAdmin: data.resposta || null,
    avaliadoEm: new Date(),
  }).where(eq(pedidosCargo.id, data.pedidoId));

  // Se aprovado, promove o cargo automaticamente
  if (data.status === "aprovado") {
    const novoRole = pedido[0].tipo === "quero_aprender" ? "tradutor_aprendiz" : "tradutor_oficial";
    await db.update(users).set({ role: novoRole, updatedAt: new Date() }).where(eq(users.id, pedido[0].userId));

    // Notificação de aprovação + link do telegram
    const telegramLink = await getPublicLink("telegram");
    const msgTelegram = telegramLink ? `\n\nAcesse nosso grupo: ${telegramLink.value}` : "";
    await criarNotificacao({
      userId: pedido[0].userId,
      tipo: "cargo_aprovado",
      titulo: "🎉 Pedido aprovado! Bem-vindo à equipe!",
      mensagem: `Seu pedido foi aprovado! Você agora é ${novoRole === "tradutor_aprendiz" ? "Tradutor Aprendiz" : "Tradutor Oficial"}.${msgTelegram}`,
    });
  } else {
    // Notificação de rejeição com prazo de 10 dias
    await criarNotificacao({
      userId: pedido[0].userId,
      tipo: "cargo_rejeitado",
      titulo: "Pedido não aprovado desta vez",
      mensagem: `Infelizmente seu pedido não foi aprovado agora. ${data.resposta ? data.resposta : "Estamos sem capacidade de administrar novos tradutores no momento."} Você pode tentar novamente em 10 dias.`,
    });
  }
}

// ─── Notificações ────────────────────────────────────────────────────────────
export async function criarNotificacao(data: { userId: number; tipo: "cargo_aprovado" | "cargo_rejeitado" | "bem_vindo_equipe"; titulo: string; mensagem: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notificacoes).values(data);
}

export async function listNotificacoes(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notificacoes).where(eq(notificacoes.userId, userId)).orderBy(desc(notificacoes.createdAt)).limit(20);
}

export async function marcarNotificacaoLida(notifId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notificacoes).set({ lida: true }).where(and(eq(notificacoes.id, notifId), eq(notificacoes.userId, userId)));
}

export async function countNotificacoesNaoLidas(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(notificacoes)
    .where(and(eq(notificacoes.userId, userId), eq(notificacoes.lida, false)));
  return result[0]?.count ?? 0;
}

// ─── Obras ───────────────────────────────────────────────────────────────────
export async function listObras(opts: { status?: string; genre?: string; search?: string; sort?: "hot" | "recent" | "most"; page?: number; limit?: number; }) {
  const db = await getDb();
  if (!db) return [];
  const { status = "aprovada", genre, search, sort = "recent", page = 1, limit = 20 } = opts;
  let query = db.select().from(obras).$dynamic();
  const conditions = [eq(obras.status, status as any)];
  if (search) conditions.push(like(obras.title, `%${search}%`));
  if (genre) conditions.push(like(obras.genres, `%${genre}%`));
  query = query.where(and(...conditions));
  if (sort === "hot") query = query.orderBy(desc(obras.viewsWeek));
  else if (sort === "most") query = query.orderBy(desc(obras.viewsTotal));
  else query = query.orderBy(desc(obras.updatedAt));
  return query.limit(limit).offset((page - 1) * limit);
}

export async function listObrasByAuthor(authorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(obras).where(eq(obras.authorId, authorId)).orderBy(desc(obras.updatedAt)).limit(50);
}

export async function getObraById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(obras).where(eq(obras.id, id)).limit(1);
  return result[0];
}

export async function createObra(data: { title: string; synopsis?: string; genres?: string[]; coverUrl?: string; authorId: number; originalAuthor?: string; status: "em_espera" | "aprovada"; }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(obras).values({ ...data, genres: data.genres ? JSON.stringify(data.genres) : null });
  return result[0];
}

export async function updateObraStatus(obraId: number, status: "em_espera" | "aprovada" | "rejeitada") {
  const db = await getDb();
  if (!db) return;
  await db.update(obras).set({ status, updatedAt: new Date() }).where(eq(obras.id, obraId));
}

export async function updateObraAuthor(obraId: number, authorId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(obras).set({ authorId, updatedAt: new Date() }).where(eq(obras.id, obraId));
}

export async function incrementObraViews(obraId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(obras).set({ viewsTotal: sql`${obras.viewsTotal} + 1`, viewsWeek: sql`${obras.viewsWeek} + 1`, updatedAt: new Date() }).where(eq(obras.id, obraId));
}

export async function resetWeeklyViews() {
  const db = await getDb();
  if (!db) return;
  await db.update(obras).set({ viewsWeek: 0 });
}

export async function listPendingObras() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(obras).where(eq(obras.status, "em_espera")).orderBy(obras.createdAt);
}

// ─── Capítulos ───────────────────────────────────────────────────────────────
export async function listCapitulos(obraId: number, includeAll = false) {
  const db = await getDb();
  if (!db) return [];
  const conds = [eq(capitulos.obraId, obraId)];
  if (!includeAll) conds.push(eq(capitulos.status, "aprovado"));
  return db.select().from(capitulos).where(and(...conds)).orderBy(capitulos.numero);
}

export async function getCapituloById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(capitulos).where(eq(capitulos.id, id)).limit(1);
  return result[0];
}

export async function createCapitulo(data: { obraId: number; authorId: number; numero: number; title?: string; paginas?: string; paginasKeys?: string; status: "aguardando" | "aprovado"; }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(capitulos).values(data);
  return result[0];
}

// ✅ Conta capítulos aguardando aprovação de um autor específico
export async function countCapitulosAguardando(authorId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(capitulos)
    .where(and(eq(capitulos.authorId, authorId), eq(capitulos.status, "aguardando")));
  return result[0]?.count ?? 0;
}

export async function updateCapituloStatus(capId: number, status: "aguardando" | "aprovado" | "rejeitado") {
  const db = await getDb();
  if (!db) return;
  await db.update(capitulos).set({ status, updatedAt: new Date() }).where(eq(capitulos.id, capId));
}

export async function incrementCapituloViews(capId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(capitulos).set({ viewsTotal: sql`${capitulos.viewsTotal} + 1` }).where(eq(capitulos.id, capId));
}

export async function listPendingCapitulos() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(capitulos).where(eq(capitulos.status, "aguardando")).orderBy(capitulos.createdAt);
}

// ─── Comentários ─────────────────────────────────────────────────────────────
export async function listComentarios(obraId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(comentarios).where(and(eq(comentarios.obraId, obraId), eq(comentarios.deleted, false))).orderBy(desc(comentarios.createdAt));
}

export async function createComentario(data: { obraId: number; autorId: number; content: string; }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(comentarios).values(data);
  return result[0];
}

export async function deleteComentario(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(comentarios).set({ deleted: true }).where(eq(comentarios.id, id));
}

// ─── Curtidas ────────────────────────────────────────────────────────────────
export async function getCurtida(obraId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(curtidas).where(and(eq(curtidas.obraId, obraId), eq(curtidas.userId, userId))).limit(1);
  return result[0];
}

export async function countCurtidas(obraId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(curtidas).where(eq(curtidas.obraId, obraId));
  return result[0]?.count ?? 0;
}

export async function toggleCurtida(obraId: number, userId: number) {
  const existing = await getCurtida(obraId, userId);
  const db = await getDb();
  if (!db) return false;
  if (existing) { await db.delete(curtidas).where(and(eq(curtidas.obraId, obraId), eq(curtidas.userId, userId))); return false; }
  else { await db.insert(curtidas).values({ obraId, userId }); return true; }
}

// ─── Favoritos ───────────────────────────────────────────────────────────────
export async function listFavoritos(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(favoritos).where(eq(favoritos.userId, userId)).orderBy(desc(favoritos.createdAt));
}

export async function getFavorito(userId: number, obraId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(favoritos).where(and(eq(favoritos.userId, userId), eq(favoritos.obraId, obraId))).limit(1);
  return result[0];
}

export async function toggleFavorito(userId: number, obraId: number) {
  const existing = await getFavorito(userId, obraId);
  const db = await getDb();
  if (!db) return false;
  if (existing) { await db.delete(favoritos).where(and(eq(favoritos.userId, userId), eq(favoritos.obraId, obraId))); return false; }
  else { await db.insert(favoritos).values({ userId, obraId }); return true; }
}

// ─── Histórico de Leitura ────────────────────────────────────────────────────
export async function getHistoricoLeitura(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(historicoLeitura).where(eq(historicoLeitura.userId, userId)).orderBy(desc(historicoLeitura.updatedAt));
}

export async function upsertHistoricoLeitura(data: { userId: number; obraId: number; capituloId: number; progresso: number; }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(historicoLeitura).values(data).onDuplicateKeyUpdate({ set: { progresso: data.progresso } });
}

// ─── Histórico ADM ───────────────────────────────────────────────────────────
export async function logAdm(data: { adminId: number; acao: string; detalhes?: string; targetType?: string; targetId?: number; }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(historicoAdm).values(data);
}

export async function listHistoricoAdm(page = 1, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(historicoAdm).orderBy(desc(historicoAdm.createdAt)).limit(limit).offset((page - 1) * limit);
}

// ─── Stats ───────────────────────────────────────────────────────────────────
export async function getPlatformStats() {
  const db = await getDb();
  if (!db) return null;
  const [[totalObras], [totalCaps], [totalUsers], [pendingObras], [pendingCaps], [pendingPedidos]] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(obras).where(eq(obras.status, "aprovada")),
    db.select({ count: sql<number>`count(*)` }).from(capitulos).where(eq(capitulos.status, "aprovado")),
    db.select({ count: sql<number>`count(*)` }).from(users),
    db.select({ count: sql<number>`count(*)` }).from(obras).where(eq(obras.status, "em_espera")),
    db.select({ count: sql<number>`count(*)` }).from(capitulos).where(eq(capitulos.status, "aguardando")),
    db.select({ count: sql<number>`count(*)` }).from(pedidosCargo).where(eq(pedidosCargo.status, "pendente")),
  ]);
  return {
    totalObras: totalObras?.count ?? 0,
    totalCaps: totalCaps?.count ?? 0,
    totalUsers: totalUsers?.count ?? 0,
    pendingObras: pendingObras?.count ?? 0,
    pendingCaps: pendingCaps?.count ?? 0,
    pendingPedidos: pendingPedidos?.count ?? 0,
  };
}

// ─── Links Públicos ──────────────────────────────────────────────────────────
export async function getPublicLink(key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(publicLinks).where(eq(publicLinks.key, key)).limit(1);
  return result[0];
}

export async function setPublicLink(key: string, value: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(publicLinks).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
}

// ─── Reports ─────────────────────────────────────────────────────────────────
export async function createReport(data: { capituloId: number; obraId: number; userId: number; tipo: "imagem_faltando" | "cap_nao_carrega" | "erro_traducao" | "outro"; descricao?: string; }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(reports).values(data);
}

export async function listReports(page = 1, limit = 30, resolved?: boolean) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(reports).$dynamic();
  const conditions: any[] = [];
  if (resolved !== undefined) conditions.push(eq(reports.resolvido, resolved));
  if (conditions.length > 0) query = query.where(and(...conditions));
  return query.orderBy(desc(reports.createdAt)).limit(limit).offset((page - 1) * limit);
}

export async function resolveReport(reportId: number, resolved: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(reports).set({ resolvido: resolved }).where(eq(reports.id, reportId));
}

// ─── Sessões ──────────────────────────────────────────────────────────────────

const SESSAO_DIAS = 30;

export async function criarSessao(openId: string, userId: number, ip?: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const id = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSAO_DIAS * 24 * 60 * 60 * 1000);
  await db.insert(sessoes).values({ id, userId, openId, expiresAt, ip: ip ?? null });
  return id;
}

export async function getSessao(sessionId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(sessoes).where(eq(sessoes.id, sessionId)).limit(1);
  const sessao = result[0];
  if (!sessao) return null;
  // Verifica expiração
  if (sessao.expiresAt < new Date()) {
    await db.delete(sessoes).where(eq(sessoes.id, sessionId));
    return null;
  }
  return sessao;
}

export async function deletarSessao(sessionId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(sessoes).where(eq(sessoes.id, sessionId));
}

export async function deletarSessoesUsuario(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(sessoes).where(eq(sessoes.userId, userId));
}

// Limpa sessões expiradas — chamar periodicamente
export async function limparSessoesExpiradas() {
  const db = await getDb();
  if (!db) return;
  await db.delete(sessoes).where(lt(sessoes.expiresAt, new Date()));
}

