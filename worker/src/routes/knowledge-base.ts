// worker/src/routes/knowledge-base.ts
// Base de Conhecimento (/api/conhecimento). Regras em shared/knowledge.ts e
// server/services/knowledge.service.ts. O HTML de "content" já chega sanitizado pelo
// middleware global de rich-text (worker/src/index.ts).
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import {
  createArticle,
  deleteArticle,
  draftFromTicket,
  getArticle,
  listArticles,
  updateArticle,
  type KnowledgeActor,
} from "../../../server/services/knowledge.service";

export const knowledgeBase = new Hono<AppEnv>();

function actorOf(user: AppEnv["Variables"]["user"]): KnowledgeActor {
  return { userId: user.userId, isAdmin: user.role === "admin", tenantId: user.tenantId ?? null };
}

// GET /api/conhecimento/artigos?q=&grupo=&sugestao=1&limite=
knowledgeBase.get("/api/conhecimento/artigos", async (c) => {
  const limit = Number(c.req.query("limite"));
  const result = await listArticles(getStorage(c.get("db")), actorOf(c.get("user")), {
    q: c.req.query("q"),
    group: c.req.query("grupo"),
    suggest: c.req.query("sugestao") === "1",
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
  });
  return c.json(result);
});

knowledgeBase.get("/api/conhecimento/artigos/:id", async (c) => {
  const result = await getArticle(getStorage(c.get("db")), actorOf(c.get("user")), c.req.param("id"));
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({ ...result.article, canEdit: result.canEdit, sourceTicket: result.sourceTicket });
});

// Sugestão de artigo para o popup ao encerrar o chamado.
knowledgeBase.get("/api/conhecimento/chamados/:ticketId/rascunho", async (c) => {
  const result = await draftFromTicket(getStorage(c.get("db")), actorOf(c.get("user")), c.req.param("ticketId"));
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({ existingArticleId: result.existingArticleId, draft: result.draft });
});

knowledgeBase.post("/api/conhecimento/artigos", async (c) => {
  const body = await c.req.json().catch(() => null);
  const result = await createArticle(getStorage(c.get("db")), actorOf(c.get("user")), body);
  if (!result.ok) return c.json({ error: result.error, articleId: result.articleId }, result.status);
  return c.json(result.article, 201);
});

knowledgeBase.put("/api/conhecimento/artigos/:id", async (c) => {
  const body = await c.req.json().catch(() => null);
  const result = await updateArticle(getStorage(c.get("db")), actorOf(c.get("user")), c.req.param("id"), body);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.article);
});

knowledgeBase.delete("/api/conhecimento/artigos/:id", async (c) => {
  const result = await deleteArticle(getStorage(c.get("db")), actorOf(c.get("user")), c.req.param("id"));
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.body(null, 204);
});
