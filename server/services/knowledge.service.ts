// Base de Conhecimento: casos de uso usados pelo Worker e pelo Express. Regras de quem pode o
// quê ficam em shared/knowledge.ts; aqui entram storage, tenant e o chamado de origem.
import type { KnowledgeArticle, KnowledgeArticleWithAuthor } from "../../shared/schema";
import { sameTenant } from "../../shared/tenant";
import {
  articleInputSchema,
  articleUpdateSchema,
  buildArticleDraftFromTicket,
  canCreateArticle,
  canCreateFromTicket,
  canEditArticle,
  canViewArticle,
  isKnowledgeStaff,
  type KnowledgeViewer,
} from "../../shared/knowledge";
import type { IStorage } from "../storage";
import { canViewTicket, getQueueViewer, type QueueActor } from "./ticket-queue.service";
import { isTechnician } from "../../shared/user-type";

export type KnowledgeActor = QueueActor;

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string; articleId?: string };

export async function getKnowledgeViewer(storage: IStorage, actor: KnowledgeActor): Promise<KnowledgeViewer> {
  const [queue, user] = await Promise.all([getQueueViewer(storage, actor), storage.getUser(actor.userId)]);
  return { userId: actor.userId, isAdmin: actor.isAdmin, groupKeys: queue.groupKeys, isTechnician: isTechnician(user) };
}

function inTenant(actor: KnowledgeActor, article: { tenantId: string | null }): boolean {
  return actor.tenantId === undefined || sameTenant(article.tenantId, actor.tenantId);
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Dados inválidos";
}

/** Grupo informado precisa existir e estar ativo (mesma regra da abertura de chamado). */
async function validGroup(storage: IStorage, groupKey: string | null | undefined): Promise<boolean> {
  if (!groupKey) return true;
  return !!(await storage.getActiveSupportGroupByKey(groupKey));
}

export async function listArticles(
  storage: IStorage,
  actor: KnowledgeActor,
  query: { q?: string; group?: string; suggest?: boolean; limit?: number },
): Promise<{ items: KnowledgeArticleWithAuthor[]; canCreate: boolean }> {
  const viewer = await getKnowledgeViewer(storage, actor);
  const items = await storage.searchKnowledgeArticles({
    tenantId: actor.tenantId,
    q: query.q,
    groupKey: query.group || undefined,
    viewer: { userId: actor.userId, isAdmin: actor.isAdmin },
    publishedOnly: query.suggest === true,
    limit: query.limit,
  });
  return { items, canCreate: canCreateArticle(viewer) };
}

export async function getArticle(
  storage: IStorage,
  actor: KnowledgeActor,
  id: string,
): Promise<
  | { ok: true; article: KnowledgeArticleWithAuthor; canEdit: boolean; sourceTicket: { id: string; code: string } | null }
  | Fail
> {
  const article = await storage.getKnowledgeArticle(id);
  if (!article || !inTenant(actor, article)) return { ok: false, status: 404, error: "Artigo não encontrado" };
  const viewer = await getKnowledgeViewer(storage, actor);
  if (!canViewArticle(viewer, article)) return { ok: false, status: 404, error: "Artigo não encontrado" };

  // O chamado de origem só aparece para a equipe que também consegue abrir o chamado.
  let sourceTicket: { id: string; code: string } | null = null;
  if (article.sourceTicketId && isKnowledgeStaff(viewer)) {
    const ticket = await storage.getTicket(article.sourceTicketId);
    if (ticket && (await canViewTicket(storage, actor, ticket))) sourceTicket = { id: ticket.id, code: ticket.code };
  }
  if (article.status === "publicado") await storage.incrementKnowledgeArticleViews(article.id);
  return { ok: true, article, canEdit: canEditArticle(viewer, article), sourceTicket };
}

/** Sugestão de artigo a partir do chamado, ou o artigo que já existe para ele. */
export async function draftFromTicket(
  storage: IStorage,
  actor: KnowledgeActor,
  ticketId: string,
): Promise<
  | { ok: true; existingArticleId: string | null; draft: { title: string; groupKey: string | null; content: string } | null }
  | Fail
> {
  const ticket = await storage.getTicket(ticketId);
  if (!ticket || !(await canViewTicket(storage, actor, ticket))) {
    return { ok: false, status: 404, error: "Chamado não encontrado" };
  }
  const viewer = await getKnowledgeViewer(storage, actor);
  if (!canCreateFromTicket(viewer, ticket)) {
    return { ok: false, status: 403, error: "Sem permissão para criar artigo a partir deste chamado" };
  }
  const existing = await storage.getKnowledgeArticleBySourceTicket(ticket.id);
  if (existing) return { ok: true, existingArticleId: existing.id, draft: null };
  const comments = await storage.getTicketComments(ticket.id);
  return { ok: true, existingArticleId: null, draft: buildArticleDraftFromTicket(ticket, comments) };
}

export async function createArticle(
  storage: IStorage,
  actor: KnowledgeActor,
  body: unknown,
): Promise<{ ok: true; article: KnowledgeArticle } | Fail> {
  const parsed = articleInputSchema.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, error: firstIssue(parsed.error) };
  const input = parsed.data;
  const viewer = await getKnowledgeViewer(storage, actor);
  if (!canCreateArticle(viewer)) return { ok: false, status: 403, error: "Sem permissão para criar artigos" };
  if (!(await validGroup(storage, input.groupKey))) return { ok: false, status: 400, error: "Grupo de atendimento inválido" };

  if (input.sourceTicketId) {
    const ticket = await storage.getTicket(input.sourceTicketId);
    if (!ticket || !(await canViewTicket(storage, actor, ticket))) {
      return { ok: false, status: 404, error: "Chamado não encontrado" };
    }
    if (!canCreateFromTicket(viewer, ticket)) {
      return { ok: false, status: 403, error: "Sem permissão para criar artigo a partir deste chamado" };
    }
    const existing = await storage.getKnowledgeArticleBySourceTicket(ticket.id);
    if (existing) return { ok: false, status: 409, error: "Este chamado já virou artigo", articleId: existing.id };
  }

  const article = await storage.createKnowledgeArticle({
    tenantId: actor.tenantId ?? null,
    title: input.title,
    content: input.content,
    groupKey: input.groupKey ?? null,
    status: input.status,
    sourceTicketId: input.sourceTicketId ?? null,
    authorId: actor.userId,
    updatedBy: actor.userId,
  });
  return { ok: true, article };
}

async function loadEditable(
  storage: IStorage,
  actor: KnowledgeActor,
  id: string,
): Promise<{ ok: true; article: KnowledgeArticle } | Fail> {
  const article = await storage.getKnowledgeArticle(id);
  if (!article || !inTenant(actor, article)) return { ok: false, status: 404, error: "Artigo não encontrado" };
  const viewer = await getKnowledgeViewer(storage, actor);
  if (!canViewArticle(viewer, article)) return { ok: false, status: 404, error: "Artigo não encontrado" };
  if (!canEditArticle(viewer, article)) return { ok: false, status: 403, error: "Só o autor ou um administrador pode alterar este artigo" };
  return { ok: true, article };
}

export async function updateArticle(
  storage: IStorage,
  actor: KnowledgeActor,
  id: string,
  body: unknown,
): Promise<{ ok: true; article: KnowledgeArticle } | Fail> {
  const parsed = articleUpdateSchema.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, error: firstIssue(parsed.error) };
  const current = await loadEditable(storage, actor, id);
  if (!current.ok) return current;
  const input = parsed.data;
  if (input.groupKey !== undefined && input.groupKey !== current.article.groupKey && !(await validGroup(storage, input.groupKey))) {
    return { ok: false, status: 400, error: "Grupo de atendimento inválido" };
  }
  const article = await storage.updateKnowledgeArticle(id, {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.content !== undefined && { content: input.content }),
    ...(input.groupKey !== undefined && { groupKey: input.groupKey ?? null }),
    ...(input.status !== undefined && { status: input.status }),
    updatedBy: actor.userId,
  });
  if (!article) return { ok: false, status: 404, error: "Artigo não encontrado" };
  return { ok: true, article };
}

export async function deleteArticle(
  storage: IStorage,
  actor: KnowledgeActor,
  id: string,
): Promise<{ ok: true } | Fail> {
  const current = await loadEditable(storage, actor, id);
  if (!current.ok) return current;
  await storage.deleteKnowledgeArticle(id);
  return { ok: true };
}
