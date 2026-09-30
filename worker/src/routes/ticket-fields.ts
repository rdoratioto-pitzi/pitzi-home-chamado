// worker/src/routes/ticket-fields.ts
// Configurações → Campos do chamado: Objeto da Requisição e campos personalizados por grupo.
// Leitura para qualquer usuário logado (os formulários usam); escrita para admin ou para quem
// tem a permissão "campos_chamado". Regras em server/services/ticket-fields.service.ts.
import { Hono, type MiddlewareHandler } from "hono";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { canManageTicketFields } from "../../../shared/permissions";
import {
  createCustomField,
  getRequestObjectTree,
  saveRequestObjectTree,
  updateCustomField,
} from "../../../server/services/ticket-fields.service";

export const ticketFields = new Hono<AppEnv>();

export const requireTicketFieldsManager: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user");
  if (!user || !canManageTicketFields({ isAdmin: user.role === "admin", modulePermissions: user.modulePermissions })) {
    return c.json({ error: "Sem permissão para gerenciar os campos dos chamados" }, 403);
  }
  return next();
};

ticketFields.get("/api/ticket-fields/request-objects", async (c) => {
  return c.json(await getRequestObjectTree(getStorage(c.get("db"))));
});

ticketFields.put("/api/ticket-fields/request-objects", requireTicketFieldsManager, async (c) => {
  const body = await c.req.json().catch(() => null);
  const result = await saveRequestObjectTree(getStorage(c.get("db")), body);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.tree);
});

ticketFields.get("/api/ticket-fields/custom", async (c) => {
  return c.json(await getStorage(c.get("db")).getTicketCustomFields());
});

ticketFields.post("/api/ticket-fields/custom", requireTicketFieldsManager, async (c) => {
  const body = await c.req.json().catch(() => null);
  const result = await createCustomField(getStorage(c.get("db")), body, c.get("user").tenantId ?? null);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.field, 201);
});

ticketFields.put("/api/ticket-fields/custom/:id", requireTicketFieldsManager, async (c) => {
  const body = await c.req.json().catch(() => null);
  const result = await updateCustomField(getStorage(c.get("db")), c.req.param("id"), body);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.field);
});

// Excluir apaga só a definição; os valores já gravados nos chamados ficam no JSON e deixam de
// aparecer. Para esconder sem perder nada, desative o campo (PUT active=false).
ticketFields.delete("/api/ticket-fields/custom/:id", requireTicketFieldsManager, async (c) => {
  const deleted = await getStorage(c.get("db")).deleteTicketCustomField(c.req.param("id"));
  if (!deleted) return c.json({ error: "Campo não encontrado" }, 404);
  return c.body(null, 204);
});
