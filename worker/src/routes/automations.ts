// worker/src/routes/automations.ts
// Respostas prontas e automações de chamados. Leitura das respostas para qualquer usuário
// logado (a caixa de comentário usa); o resto é para admin ou para quem tem a permissão
// "campos_chamado". Regras em server/services/automations.service.ts e shared/automations.ts.
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { canManageTicketFields } from "../../../shared/permissions";
import { requireTicketFieldsManager } from "./ticket-fields";
import {
  createAutomationRule,
  createCannedResponse,
  filterCannedResponses,
  updateAutomationRule,
  updateCannedResponse,
} from "../../../server/services/automations.service";

export const automations = new Hono<AppEnv>();

automations.get("/api/canned-responses", async (c) => {
  const user = c.get("user");
  const manager = canManageTicketFields({ isAdmin: user.role === "admin", modulePermissions: user.modulePermissions });
  const all = await getStorage(c.get("db")).getCannedResponses();
  return c.json(filterCannedResponses(all, {
    includeInactive: manager && c.req.query("all") === "1",
    group: c.req.query("group"),
  }));
});

automations.post("/api/canned-responses", requireTicketFieldsManager, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const result = await createCannedResponse(getStorage(c.get("db")), body, { userId: user.userId, tenantId: user.tenantId ?? null });
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.response, 201);
});

automations.put("/api/canned-responses/:id", requireTicketFieldsManager, async (c) => {
  const body = await c.req.json().catch(() => null);
  const result = await updateCannedResponse(getStorage(c.get("db")), c.req.param("id"), body);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.response);
});

automations.delete("/api/canned-responses/:id", requireTicketFieldsManager, async (c) => {
  const deleted = await getStorage(c.get("db")).deleteCannedResponse(c.req.param("id"));
  if (!deleted) return c.json({ error: "Resposta não encontrada" }, 404);
  return c.body(null, 204);
});

automations.get("/api/automations", requireTicketFieldsManager, async (c) => {
  return c.json(await getStorage(c.get("db")).getAutomationRules());
});

automations.post("/api/automations", requireTicketFieldsManager, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const result = await createAutomationRule(getStorage(c.get("db")), body, { userId: user.userId, tenantId: user.tenantId ?? null });
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.rule, 201);
});

automations.put("/api/automations/:id", requireTicketFieldsManager, async (c) => {
  const body = await c.req.json().catch(() => null);
  const result = await updateAutomationRule(getStorage(c.get("db")), c.req.param("id"), body);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.rule);
});

automations.delete("/api/automations/:id", requireTicketFieldsManager, async (c) => {
  const deleted = await getStorage(c.get("db")).deleteAutomationRule(c.req.param("id"));
  if (!deleted) return c.json({ error: "Automação não encontrada" }, 404);
  return c.body(null, 204);
});
