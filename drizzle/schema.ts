import {
  integer, pgEnum, pgTable, text, timestamp,
  varchar, boolean, bigint, uniqueIndex, index,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", [
  "usuario", "tradutor_aprendiz", "tradutor_oficial",
  "criador", "admin_senhor", "admin_supremo",
]);
export const obraStatusEnum    = pgEnum("obra_status",    ["em_espera", "aprovada", "rejeitada"]);
export const obraAndamentoEnum = pgEnum("obra_andamento", ["em_andamento", "iato", "finalizado"]);
export const capStatusEnum     = pgEnum("cap_status",     ["aguardando", "aprovado", "rejeitado"]);
export const reportTipoEnum    = pgEnum("report_tipo",    ["imagem_faltando", "cap_nao_carrega", "erro_traducao", "outro"]);
export const pedidoTipoEnum    = pgEnum("pedido_tipo",    ["quero_aprender", "posso_ajudar"]);
export const pedidoStatusEnum  = pgEnum("pedido_status",  ["pendente", "aprovado", "rejeitado"]);
export const notifTipoEnum     = pgEnum("notif_tipo",     ["cargo_aprovado", "cargo_rejeitado", "bem_vindo_equipe", "resposta_comentario"]);
export const transferStatusEnum = pgEnum("transfer_status", ["pendente", "aprovado", "rejeitado"]);

// Loja
export const lojaItemTipoEnum  = pgEnum("loja_item_tipo", ["moldura", "banner", "cor_comentario", "tag"]);
export const lojaItemRaridadeEnum = pgEnum("loja_item_raridade", ["comum", "raro", "epico", "lendario"]);

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:                integer("id").primaryKey().generatedAlwaysAsIdentity(),
  openId:            varchar("openId",      { length: 64  }).notNull().unique(),
  name:              text("name"),
  email:             varchar("email",       { length: 320 }),
  loginMethod:       varchar("loginMethod", { length: 64  }),
  role:              roleEnum("role").default("usuario").notNull(),
  banned:            boolean("banned").default(false).notNull(),
  bannedTotal:       boolean("bannedTotal").default(false).notNull(),
  displayName:       varchar("displayName", { length: 100 }),
  avatarUrl:         text("avatarUrl"),
  cosmeticos:        text("cosmeticos"),    // JSON: { molduraId, bannerId, corComentario, tagId } ativos
  moedas:            integer("moedas").default(0).notNull(),
  ultimoPedidoCargo: timestamp("ultimoPedidoCargo"),
  createdAt:         timestamp("createdAt").defaultNow().notNull(),
  updatedAt:         timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn:      timestamp("lastSignedIn").defaultNow().notNull(),
}, (t) => ({
  emailIdx: index("users_email_idx").on(t.email),
}));

export type User       = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Obras ────────────────────────────────────────────────────────────────────
export const obras = pgTable("obras", {
  id:             integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title:          varchar("title",          { length: 255 }).notNull(),
  synopsis:       text("synopsis"),
  genres:         text("genres"),
  coverUrl:       text("coverUrl"),
  coverKey:       varchar("coverKey",       { length: 500 }),
  authorId:       integer("authorId").notNull(),
  originalAuthor: varchar("originalAuthor", { length: 255 }),
  status:         obraStatusEnum("status").default("em_espera").notNull(),
  andamento:      obraAndamentoEnum("andamento").default("em_andamento").notNull(),
  locked:         boolean("locked").default(false).notNull(),
  viewsTotal:     bigint("viewsTotal", { mode: "number" }).default(0).notNull(),
  viewsWeek:      bigint("viewsWeek",  { mode: "number" }).default(0).notNull(),
  createdAt:      timestamp("createdAt").defaultNow().notNull(),
  updatedAt:      timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  viewsWeekIdx:  index("obras_views_week_idx").on(t.viewsWeek),
  viewsTotalIdx: index("obras_views_total_idx").on(t.viewsTotal),
  statusIdx:     index("obras_status_idx").on(t.status),
  authorIdx:     index("obras_author_idx").on(t.authorId),
  updatedIdx:    index("obras_updated_idx").on(t.updatedAt),
}));
export type Obra = typeof obras.$inferSelect;

// ─── Capítulos ────────────────────────────────────────────────────────────────
export const capitulos = pgTable("capitulos", {
  id:          integer("id").primaryKey().generatedAlwaysAsIdentity(),
  obraId:      integer("obraId").notNull(),
  authorId:    integer("authorId").notNull(),
  numero:      integer("numero").notNull(),
  title:       varchar("title", { length: 255 }),
  paginas:     text("paginas"),
  paginasKeys: text("paginasKeys"),
  status:      capStatusEnum("status").default("aguardando").notNull(),
  viewsTotal:  bigint("viewsTotal", { mode: "number" }).default(0).notNull(),
  createdAt:   timestamp("createdAt").defaultNow().notNull(),
  updatedAt:   timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  obraIdx:       index("cap_obra_idx").on(t.obraId),
  statusIdx:     index("cap_status_idx").on(t.status),
  createdIdx:    index("cap_created_idx").on(t.createdAt),
  authorIdx:     index("cap_author_idx").on(t.authorId),
  obraNumeroUnq: uniqueIndex("cap_obra_numero_unq").on(t.obraId, t.numero),
}));
export type Capitulo = typeof capitulos.$inferSelect;

// ─── Transferência de Obra ────────────────────────────────────────────────────
export const obraTransferRequests = pgTable("obra_transfer_requests", {
  id:              integer("id").primaryKey().generatedAlwaysAsIdentity(),
  obraId:          integer("obraId").notNull(),
  requesterId:     integer("requesterId").notNull(),
  novoAuthorId:    integer("novoAuthorId").notNull(),
  status:          transferStatusEnum("status").default("pendente").notNull(),
  motivo:          text("motivo"),
  canceladoMotivo: text("canceladoMotivo"),
  decidedBy:       integer("decidedBy"),
  decidedAt:       timestamp("decidedAt"),
  createdAt:       timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  obraIdx:      index("transfer_obra_idx").on(t.obraId),
  requesterIdx: index("transfer_requester_idx").on(t.requesterId),
  statusIdx:    index("transfer_status_idx").on(t.status),
}));
export type ObraTransferRequest = typeof obraTransferRequests.$inferSelect;

// ─── Feature Flags ────────────────────────────────────────────────────────────
export const featureFlags = pgTable("feature_flags", {
  key:       varchar("key", { length: 100 }).notNull().unique(),
  enabled:   boolean("enabled").default(false).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type FeatureFlag = typeof featureFlags.$inferSelect;

// ─── Views Registro ───────────────────────────────────────────────────────────
export const viewsRegistro = pgTable("views_registro", {
  id:         integer("id").primaryKey().generatedAlwaysAsIdentity(),
  capituloId: integer("capituloId").notNull(),
  userId:     integer("userId"),
  ipHash:     varchar("ipHash", { length: 64 }),
  viewedAt:   timestamp("viewedAt").defaultNow().notNull(),
}, (t) => ({
  userCapIdx: index("view_user_cap_idx").on(t.userId,  t.capituloId),
  ipCapIdx:   index("view_ip_cap_idx").on(t.ipHash,   t.capituloId),
  capIdx:     index("view_cap_idx").on(t.capituloId),
}));

// ─── Comentários ──────────────────────────────────────────────────────────────
export const comentarios = pgTable("comentarios", {
  id:        integer("id").primaryKey().generatedAlwaysAsIdentity(),
  obraId:    integer("obraId").notNull(),
  autorId:   integer("autorId").notNull(),
  parentId:  integer("parentId"),   // null = raiz, id = resposta
  content:   text("content").notNull(),
  deleted:   boolean("deleted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  obraIdx:    index("com_obra_idx").on(t.obraId),
  createdIdx: index("com_created_idx").on(t.createdAt),
  autorIdx:   index("com_autor_idx").on(t.autorId),
  parentIdx:  index("com_parent_idx").on(t.parentId),
}));

// ─── Curtidas ─────────────────────────────────────────────────────────────────
export const curtidas = pgTable("curtidas", {
  id:        integer("id").primaryKey().generatedAlwaysAsIdentity(),
  obraId:    integer("obraId").notNull(),
  userId:    integer("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  unq: uniqueIndex("curtida_obra_user_unq").on(t.obraId, t.userId),
}));

// ─── Favoritos ────────────────────────────────────────────────────────────────
export const favoritos = pgTable("favoritos", {
  id:        integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:    integer("userId").notNull(),
  obraId:    integer("obraId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  unq: uniqueIndex("fav_user_obra_unq").on(t.userId, t.obraId),
}));

// ─── Histórico de Leitura ─────────────────────────────────────────────────────
export const historicoLeitura = pgTable("historico_leitura", {
  id:         integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:     integer("userId").notNull(),
  obraId:     integer("obraId").notNull(),
  capituloId: integer("capituloId").notNull(),
  progresso:  integer("progresso").default(0).notNull(),
  updatedAt:  timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  userIdx:    index("hist_user_idx").on(t.userId),
  userCapUnq: uniqueIndex("hist_user_cap_unq").on(t.userId, t.capituloId),
}));

// ─── Histórico ADM ────────────────────────────────────────────────────────────
export const historicoAdm = pgTable("historico_adm", {
  id:         integer("id").primaryKey().generatedAlwaysAsIdentity(),
  adminId:    integer("adminId").notNull(),
  acao:       varchar("acao",       { length: 100 }).notNull(),
  detalhes:   text("detalhes"),
  targetType: varchar("targetType", { length: 50  }),
  targetId:   integer("targetId"),
  createdAt:  timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  createdIdx: index("adm_created_idx").on(t.createdAt),
}));

// ─── Public Links ─────────────────────────────────────────────────────────────
export const publicLinks = pgTable("public_links", {
  id:        integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key:       varchar("key", { length: 100 }).notNull().unique(),
  value:     text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reports = pgTable("reports", {
  id:         integer("id").primaryKey().generatedAlwaysAsIdentity(),
  capituloId: integer("capituloId").notNull(),
  obraId:     integer("obraId").notNull(),
  userId:     integer("userId").notNull(),
  tipo:       reportTipoEnum("tipo").notNull(),
  descricao:  text("descricao"),
  resolvido:  boolean("resolvido").default(false).notNull(),
  createdAt:  timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  unq:          uniqueIndex("report_user_cap_unq").on(t.userId, t.capituloId),
  resolvidoIdx: index("report_resolvido_idx").on(t.resolvido),
}));
export type Report = typeof reports.$inferSelect;

// ─── Pedidos de Cargo ─────────────────────────────────────────────────────────
export const pedidosCargo = pgTable("pedidos_cargo", {
  id:            integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:        integer("userId").notNull(),
  tipo:          pedidoTipoEnum("tipo").notNull(),
  mensagem:      text("mensagem"),
  status:        pedidoStatusEnum("status").default("pendente").notNull(),
  adminId:       integer("adminId"),
  respostaAdmin: text("respostaAdmin"),
  createdAt:     timestamp("createdAt").defaultNow().notNull(),
  avaliadoEm:    timestamp("avaliadoEm"),
}, (t) => ({
  statusIdx: index("pedido_status_idx").on(t.status),
  userIdx:   index("pedido_user_idx").on(t.userId),
}));

// ─── Sessões ──────────────────────────────────────────────────────────────────
export const sessoes = pgTable("sessoes", {
  id:        varchar("id", { length: 64 }).primaryKey(),
  userId:    integer("userId").notNull(),
  openId:    varchar("openId", { length: 64 }).notNull(),
  criadaEm:  timestamp("criadaEm").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  ip:        varchar("ip", { length: 64 }),
}, (t) => ({
  userIdx:    index("sessao_user_idx").on(t.userId),
  expiresIdx: index("sessao_expires_idx").on(t.expiresAt),
}));

// ─── Notificações ─────────────────────────────────────────────────────────────
export const notificacoes = pgTable("notificacoes", {
  id:        integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:    integer("userId").notNull(),
  tipo:      notifTipoEnum("tipo").notNull(),
  titulo:    varchar("titulo",  { length: 200 }).notNull(),
  mensagem:  text("mensagem").notNull(),
  lida:      boolean("lida").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userLidaIdx: index("notif_user_lida_idx").on(t.userId, t.lida),
}));

// ─── Loja: Itens ──────────────────────────────────────────────────────────────
// Admin cadastra itens. tipo define onde aparece (moldura=avatar, banner=fundo comentário, etc)
// gratuito=true + cargoMinimo = item concedido automaticamente ao atingir o cargo
export const lojaItens = pgTable("loja_itens", {
  id:          integer("id").primaryKey().generatedAlwaysAsIdentity(),
  nome:        varchar("nome",        { length: 100 }).notNull(),
  descricao:   text("descricao"),
  tipo:        lojaItemTipoEnum("tipo").notNull(),
  raridade:    lojaItemRaridadeEnum("raridade").default("comum").notNull(),
  preco:       integer("preco").default(0).notNull(),         // em moedas; 0 = gratuito
  mediaUrl:    text("mediaUrl").notNull(),                    // URL R2 do gif/webp/mp4
  mediaKey:    varchar("mediaKey", { length: 500 }),          // chave R2
  ativo:       boolean("ativo").default(true).notNull(),      // visível na loja
  gratuito:    boolean("gratuito").default(false).notNull(),  // ganho automaticamente por cargo
  cargoMinimo: varchar("cargoMinimo", { length: 50 }),        // ex: "tradutor_aprendiz"
  createdAt:   timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  tipoIdx:     index("loja_tipo_idx").on(t.tipo),
  ativoIdx:    index("loja_ativo_idx").on(t.ativo),
}));
export type LojaItem = typeof lojaItens.$inferSelect;

// ─── Loja: Itens do Usuário ───────────────────────────────────────────────────
// Itens que o usuário possui (comprados ou ganhos por cargo)
// equipado=true significa que está ativo/exibindo no perfil/comentários
export const usuarioItens = pgTable("usuario_itens", {
  id:          integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:      integer("userId").notNull(),
  itemId:      integer("itemId").notNull(),
  equipado:    boolean("equipado").default(false).notNull(),
  origem:      varchar("origem", { length: 20 }).default("compra").notNull(), // "compra" | "cargo"
  createdAt:   timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userIdx:     index("uitem_user_idx").on(t.userId),
  unq:         uniqueIndex("uitem_user_item_unq").on(t.userId, t.itemId),
}));
export type UsuarioItem = typeof usuarioItens.$inferSelect;

// ─── Loja: Transações de Moedas ───────────────────────────────────────────────
// Histórico de todas as movimentações de moedas do usuário
export const moedasTransacoes = pgTable("moedas_transacoes", {
  id:        integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:    integer("userId").notNull(),
  valor:     integer("valor").notNull(),          // positivo = ganhou, negativo = gastou
  tipo:      varchar("tipo", { length: 50 }).notNull(), // "compra_item" | "recarga" | "cargo"
  descricao: text("descricao"),
  itemId:    integer("itemId"),                   // se foi compra de item
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("moedas_user_idx").on(t.userId),
}));
export type MoedasTransacao = typeof moedasTransacoes.$inferSelect;


