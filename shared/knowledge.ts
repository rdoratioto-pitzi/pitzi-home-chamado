// Base de Conhecimento — regras compartilhadas por Worker, Express e frontend.
//
// - Artigos publicados: visíveis para qualquer usuário ativo (do mesmo tenant).
// - Rascunhos: só o autor e os administradores.
// - Criar: administradores e "equipe" (quem é membro de pelo menos um grupo de atendimento).
// - Editar, despublicar e excluir: o autor e os administradores.
// - Criar a partir de um chamado: equipe que enxerga o chamado e não é o solicitante
//   (admin sempre pode). A solução sugerida usa só comentários públicos, nunca notas internas.
import { z } from "zod";

export const KNOWLEDGE_STATUSES = ["publicado", "rascunho"] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export interface KnowledgeViewer {
  userId: string;
  isAdmin: boolean;
  /** Chaves dos grupos de atendimento de que o usuário é membro. */
  groupKeys: readonly string[];
}

export interface KnowledgeArticleLike {
  authorId: string;
  status: string;
}

/** "Equipe": admin ou membro de algum grupo de atendimento. */
export function isKnowledgeStaff(viewer: KnowledgeViewer): boolean {
  return viewer.isAdmin || viewer.groupKeys.length > 0;
}

export function canCreateArticle(viewer: KnowledgeViewer): boolean {
  return isKnowledgeStaff(viewer);
}

export function canViewArticle(viewer: KnowledgeViewer, article: KnowledgeArticleLike): boolean {
  return article.status === "publicado" || viewer.isAdmin || article.authorId === viewer.userId;
}

export function canEditArticle(viewer: KnowledgeViewer, article: KnowledgeArticleLike): boolean {
  return viewer.isAdmin || article.authorId === viewer.userId;
}

/** O popup "virar artigo" é para quem atendeu, não para quem abriu o chamado. */
export function canCreateFromTicket(
  viewer: KnowledgeViewer,
  ticket: { requesterId: string },
): boolean {
  if (viewer.isAdmin) return true;
  return isKnowledgeStaff(viewer) && ticket.requesterId !== viewer.userId;
}

export const articleInputSchema = z.object({
  title: z.string().trim().min(1, "Informe o título").max(200, "Título muito longo"),
  content: z.string().trim().min(1, "Escreva o conteúdo do artigo").max(200_000, "Conteúdo muito longo"),
  groupKey: z.string().trim().min(1).nullish(),
  status: z.enum(KNOWLEDGE_STATUSES).default("publicado"),
  sourceTicketId: z.string().trim().min(1).nullish(),
});
export type ArticleInput = z.infer<typeof articleInputSchema>;

/**
 * Edição: todos os campos opcionais; o chamado de origem não muda depois de criado.
 * Sem .default() no status — omitir não pode republicar um rascunho.
 */
export const articleUpdateSchema = z.object({
  title: articleInputSchema.shape.title.optional(),
  content: articleInputSchema.shape.content.optional(),
  groupKey: articleInputSchema.shape.groupKey,
  status: z.enum(KNOWLEDGE_STATUSES).optional(),
});
export type ArticleUpdate = z.infer<typeof articleUpdateSchema>;

export interface DraftComment {
  content: string;
  userId: string;
  isInternal: boolean | null;
}

const HTML_TAG_RE = /<\/?[a-zA-Z][\s\S]*?>/;

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
}

/** Texto puro vira parágrafos; HTML (editor rico) segue como está. */
function asHtml(text: string): string {
  const value = (text ?? "").trim();
  if (!value) return "";
  if (HTML_TAG_RE.test(value)) return value;
  return value.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
}

/**
 * Rascunho do artigo a partir do chamado: problema = descrição; solução = comentários
 * públicos da equipe (quem não é o solicitante). Notas internas nunca entram.
 */
export function buildArticleDraftFromTicket(
  ticket: { title: string; description: string; category: string | null; requesterId: string },
  comments: readonly DraftComment[],
): { title: string; groupKey: string | null; content: string } {
  const solution = comments
    .filter((c) => c.isInternal !== true && c.userId !== ticket.requesterId)
    .map((c) => asHtml(c.content))
    .filter(Boolean);
  const problem = asHtml(ticket.description) || "<p>Descreva o problema.</p>";
  const content = [
    "<h2>Problema</h2>",
    problem,
    "<h2>Solução</h2>",
    solution.length ? solution.join("") : "<p>Descreva a solução aplicada.</p>",
  ].join("");
  return { title: ticket.title, groupKey: ticket.category || null, content };
}
