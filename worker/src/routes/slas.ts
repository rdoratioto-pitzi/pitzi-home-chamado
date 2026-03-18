// worker/src/routes/slas.ts
import { Hono } from "hono";
import { insertSlaRuleSchema } from "../../../shared/schema";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";

const slas = new Hono<AppEnv>();

// GET /api/slas (public)
slas.get("/api/slas", async (c) => {
  const storage = getStorage(c.get("db"));
  const rules = await storage.getSlaRules();
  return c.json(rules);
});

// GET /api/slas/:id (public)
slas.get("/api/slas/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const rule = await storage.getSlaRule(c.req.param("id"));
  if (!rule) return c.json({ error: "SLA rule not found" }, 404);
  return c.json(rule);
});

// POST /api/slas (admin)
slas.post("/api/slas", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const validated = insertSlaRuleSchema.parse(await c.req.json());

  const existing = await storage.getSlaRuleByTipoAndPrioridade(
    validated.tipo,
    validated.prioridade,
  );
  if (existing) {
    return c.json(
      {
        error: "conflict",
        message: `Já existe uma regra de SLA para ${validated.tipo} com prioridade ${validated.prioridade}`,
      },
      409,
    );
  }

  const rule = await storage.createSlaRule(validated);
  return c.json(rule, 201);
});

// PUT /api/slas/:id (admin)
slas.put("/api/slas/:id", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const validated = insertSlaRuleSchema.partial().parse(await c.req.json());

  if (validated.tipo && validated.prioridade) {
    const existing = await storage.getSlaRuleByTipoAndPrioridade(
      validated.tipo,
      validated.prioridade,
    );
    if (existing && existing.id !== c.req.param("id")) {
      return c.json(
        {
          error: "conflict",
          message: `Já existe uma regra de SLA para ${validated.tipo} com prioridade ${validated.prioridade}`,
        },
        409,
      );
    }
  }

  const rule = await storage.updateSlaRule(c.req.param("id"), validated);
  if (!rule) return c.json({ error: "SLA rule not found" }, 404);
  return c.json(rule);
});

// DELETE /api/slas/:id (admin)
slas.delete("/api/slas/:id", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const deleted = await storage.deleteSlaRule(c.req.param("id"));
  if (!deleted) return c.json({ error: "SLA rule not found" }, 404);
  return c.body(null, 204);
});

export { slas };
