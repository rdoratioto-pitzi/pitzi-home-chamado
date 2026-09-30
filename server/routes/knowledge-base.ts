// Espelho Express de worker/src/routes/knowledge-base.ts (Base de Conhecimento).
import type { Request, Response, Router } from "express";
import { storage } from "../storage";
import { getSessionUser, requireAuth } from "../middleware/auth";
import {
  createArticle,
  deleteArticle,
  draftFromTicket,
  getArticle,
  listArticles,
  updateArticle,
  type KnowledgeActor,
} from "../services/knowledge.service";

// Express local não tem isolamento de tenant (tenantId undefined), como a fila do grupo.
function actorOf(req: Request): KnowledgeActor {
  const { userId, isAdmin } = getSessionUser(req);
  return { userId, isAdmin };
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function param(req: Request, name: string): string {
  const value = req.params[name] as string | string[];
  return Array.isArray(value) ? value[0] : value;
}

async function run(res: Response, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
}

export function registerKnowledgeArticleRoutes(router: Router) {
  router.get("/api/conhecimento/artigos", requireAuth, (req, res) => run(res, async () => {
    const limit = Number(req.query.limite);
    res.json(await listArticles(storage, actorOf(req), {
      q: str(req.query.q),
      group: str(req.query.grupo),
      suggest: req.query.sugestao === "1",
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    }));
  }));

  router.get("/api/conhecimento/artigos/:id", requireAuth, (req, res) => run(res, async () => {
    const result = await getArticle(storage, actorOf(req), param(req, "id"));
    if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
    res.json({ ...result.article, canEdit: result.canEdit, sourceTicket: result.sourceTicket });
  }));

  router.get("/api/conhecimento/chamados/:ticketId/rascunho", requireAuth, (req, res) => run(res, async () => {
    const result = await draftFromTicket(storage, actorOf(req), param(req, "ticketId"));
    if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
    res.json({ existingArticleId: result.existingArticleId, draft: result.draft });
  }));

  router.post("/api/conhecimento/artigos", requireAuth, (req, res) => run(res, async () => {
    const result = await createArticle(storage, actorOf(req), req.body);
    if (!result.ok) { res.status(result.status).json({ error: result.error, articleId: result.articleId }); return; }
    res.status(201).json(result.article);
  }));

  router.put("/api/conhecimento/artigos/:id", requireAuth, (req, res) => run(res, async () => {
    const result = await updateArticle(storage, actorOf(req), param(req, "id"), req.body);
    if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
    res.json(result.article);
  }));

  router.delete("/api/conhecimento/artigos/:id", requireAuth, (req, res) => run(res, async () => {
    const result = await deleteArticle(storage, actorOf(req), param(req, "id"));
    if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
    res.status(204).end();
  }));
}
