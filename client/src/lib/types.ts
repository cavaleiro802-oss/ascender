// ─── Tipos compartilhados do frontend ────────────────────────────────────────

export interface Comentario {
  id: number;
  obraId: number;
  autorId: number;
  content: string;
  deleted: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}
