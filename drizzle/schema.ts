import {
  int, mysqlEnum, mysqlTable, text, timestamp,
  varchar, boolean, bigint, uniqueIndex, index,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["usuario", "tradutor_aprendiz", "tradutor_oficial", "admin", "admin_supremo"]).default("usuario").notNull(),
  banned: boolean("banned").default(false).notNull(),
  bannedTotal: boolean("bannedTotal").default(false).notNull(),
  displayName: varchar("displayName", { length: 100 }),
  avatarUrl: text("avatarUrl"),
  ultimoPedidoCargo: timestamp("ultimoPedidoCargo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (t) => ({
  emailIdx: index("users_email_idx").on(t.email),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const obras = mysqlTable("obras", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  synopsis: text("synopsis"),
  genres: text("genres"),
  coverUrl: text("coverUrl"),
  coverKey: varchar("coverKey", { length: 500 }),
  authorId: int("authorId").notNull(),
  originalAuthor: varchar("originalAuthor", { length: 255 }),
  status: mysqlEnum("status", ["em_espera", "aprovada", "rejeitada"]).default("em_espera").notNull(),
  locked: boolean("locked").default(false).notNull(),
  viewsTotal: bigint("viewsTotal", { mode: "number" }).default(0).notNull(),
  viewsWeek: bigint("viewsWeek", { mode: "number" }).default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  viewsWeekIdx: index("obras_views_week_idx").on(t.viewsWeek),
  viewsTotalIdx: index("obras_views_total_idx").on(t.viewsTotal),
  statusIdx: index("obras_status_idx").on(t.status),
  authorIdx: index("obras_author_idx").on(t.authorId),
  updatedIdx: index("obras_updated_idx").on(t.updatedAt),
}));

export type Obra = typeof obras.$inferSelect;

export const capitulos = mysqlTable("capitulos", {
  id: int("id").autoincrement().primaryKey(),
  obraId: int("obraId").notNull(),
  authorId: int("authorId").notNull(),
  numero: int("numero").notNull(),
  title: varchar("title", { length: 255 }),
  paginas: text("paginas"),       // JSON array de URLs públicas
  paginasKeys: text("paginasKeys"), // JSON array de keys R2 para deletar
  status: mysqlEnum("status", ["aguardando", "aprovado", "rejeitado"]).default("aguardando").notNull(),
  viewsTotal: bigint("viewsTotal", { mode: "number" }).default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  obraIdx: index("cap_obra_idx").on(t.obraId),
  statusIdx: index("cap_status_idx").on(t.status),
  createdIdx: index("cap_created_idx").on(t.createdAt),
  authorIdx: index("cap_author_idx").on(t.authorId),
}));

export type Capitulo = typeof capitulos.$inferSelect;

// ✅ Registro de views — proteção anti-spam de visualizações
export const viewsRegistro = mysqlTable("views_registro", {
  id: int("id").autoincrement().primaryKey(),
  capituloId: int("capituloId").notNull(),
  userId: int("userId"),
  ipHash: varchar("ipHash", { length: 64 }),
  viewedAt: timestamp("viewedAt").defaultNow().notNull(),
}, (t) => ({
  userCapIdx: index("view_user_cap_idx").on(t.userId, t.capituloId),
  ipCapIdx: index("view_ip_cap_idx").on(t.ipHash, t.capituloId),
  capIdx: index("view_cap_idx").on(t.capituloId),
}));

export const comentarios = mysqlTable("comentarios", {
  id: int("id").autoincrement().primaryKey(),
  obraId: int("obraId").notNull(),
  autorId: int("autorId").notNull(),
  content: text("content").notNull(),
  deleted: boolean("deleted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  obraIdx: index("com_obra_idx").on(t.obraId),
  createdIdx: index("com_created_idx").on(t.createdAt),
}));

export const curtidas = mysqlTable("curtidas", {
  id: int("id").autoincrement().primaryKey(),
  obraId: int("obraId").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  unq: uniqueIndex("curtida_obra_user_unq").on(t.obraId, t.userId),
}));

export const favoritos = mysqlTable("favoritos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  obraId: int("obraId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  unq: uniqueIndex("fav_user_obra_unq").on(t.userId, t.obraId),
}));

export const historicoLeitura = mysqlTable("historico_leitura", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  obraId: int("obraId").notNull(),
  capituloId: int("capituloId").notNull(),
  progresso: int("progresso").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdx: index("hist_user_idx").on(t.userId),
}));

export const historicoAdm = mysqlTable("historico_adm", {
  id: int("id").autoincrement().primaryKey(),
  adminId: int("adminId").notNull(),
  acao: varchar("acao", { length: 100 }).notNull(),
  detalhes: text("detalhes"),
  targetType: varchar("targetType", { length: 50 }),
  targetId: int("targetId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  createdIdx: index("adm_created_idx").on(t.createdAt),
}));

export const publicLinks = mysqlTable("public_links", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  capituloId: int("capituloId").notNull(),
  obraId: int("obraId").notNull(),
  userId: int("userId").notNull(),
  tipo: mysqlEnum("tipo", ["imagem_faltando", "cap_nao_carrega", "erro_traducao", "outro"]).notNull(),
  descricao: text("descricao"),
  resolvido: boolean("resolvido").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  // ✅ UNIQUE: impede spam de denúncia no mesmo capítulo
  unq: uniqueIndex("report_user_cap_unq").on(t.userId, t.capituloId),
  resolvidoIdx: index("report_resolvido_idx").on(t.resolvido),
}));

export type Report = typeof reports.$inferSelect;

export const pedidosCargo = mysqlTable("pedidos_cargo", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tipo: mysqlEnum("tipo", ["quero_aprender", "posso_ajudar"]).notNull(),
  mensagem: text("mensagem"),
  status: mysqlEnum("status", ["pendente", "aprovado", "rejeitado"]).default("pendente").notNull(),
  adminId: int("adminId"),
  respostaAdmin: text("respostaAdmin"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  avaliadoEm: timestamp("avaliadoEm"),
}, (t) => ({
  statusIdx: index("pedido_status_idx").on(t.status),
  userIdx: index("pedido_user_idx").on(t.userId),
}));

// ─── Sessões ──────────────────────────────────────────────────────────────────
export const sessoes = mysqlTable("sessoes", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  openId: varchar("openId", { length: 64 }).notNull(),
  criadaEm: timestamp("criadaEm").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  ip: varchar("ip", { length: 64 }),
}, (t) => ({
  userIdx: index("sessao_user_idx").on(t.userId),
  expiresIdx: index("sessao_expires_idx").on(t.expiresAt),
}));

// ─── Notificações ─────────────────────────────────────────────────────────────
export const notificacoes = mysqlTable("notificacoes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tipo: mysqlEnum("tipo", ["cargo_aprovado", "cargo_rejeitado", "bem_vindo_equipe"]).notNull(),
  titulo: varchar("titulo", { length: 200 }).notNull(),
  mensagem: text("mensagem").notNull(),
  lida: boolean("lida").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userLidaIdx: index("notif_user_lida_idx").on(t.userId, t.lida),
}));
