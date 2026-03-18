// worker/src/routes/updates.ts
import { Hono } from "hono";
import { insertUpdateSchema } from "../../../shared/schema";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";

const updates = new Hono<AppEnv>();

// GET /api/updates (public)
updates.get("/api/updates", async (c) => {
  const storage = getStorage(c.get("db"));
  const result = await storage.getUpdates();
  return c.json(result);
});

// POST /api/updates (admin)
updates.post("/api/updates", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const validated = insertUpdateSchema.parse(await c.req.json());
  const newUpdate = await storage.createUpdate(validated);
  return c.json(newUpdate, 201);
});

// PUT /api/updates/:id (admin)
updates.put("/api/updates/:id", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const validated = insertUpdateSchema.partial().parse(await c.req.json());
  const updated = await storage.updateUpdate(c.req.param("id"), validated);
  if (!updated) return c.json({ error: "Update not found" }, 404);
  return c.json(updated);
});

// DELETE /api/updates/:id (admin)
updates.delete("/api/updates/:id", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const deleted = await storage.deleteUpdate(c.req.param("id"));
  if (!deleted) return c.json({ error: "Update not found" }, 404);
  return c.body(null, 204);
});

export { updates };
