// worker/src/routes/metas.ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import {
  insertMetaSchema,
  insertMetaAreaSchema,
  insertMetaCheckinSchema,
} from "@shared/schema";

const metas = new Hono<AppEnv>();

// ============== META AREAS ==============

// GET /api/meta-areas
metas.get("/api/meta-areas", async (c) => {
  const storage = getStorage(c.get("db"));
  const areas = await storage.getMetaAreas();
  return c.json(areas);
});

// GET /api/meta-areas/:id
metas.get("/api/meta-areas/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const area = await storage.getMetaArea(c.req.param("id"));
  if (!area) return c.json({ error: "Meta area not found" }, 404);
  return c.json(area);
});

// POST /api/meta-areas
metas.post("/api/meta-areas", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const validated = insertMetaAreaSchema.parse(body);
  const area = await storage.createMetaArea(validated);
  return c.json(area, 201);
});

// PATCH /api/meta-areas/:id
metas.patch("/api/meta-areas/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const validated = insertMetaAreaSchema.partial().parse(body);
  const area = await storage.updateMetaArea(c.req.param("id"), validated);
  if (!area) return c.json({ error: "Meta area not found" }, 404);
  return c.json(area);
});

// DELETE /api/meta-areas/:id — soft delete (archive)
metas.delete("/api/meta-areas/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const area = await storage.getMetaArea(id);
  if (!area) return c.json({ error: "Meta area not found" }, 404);
  const archived = await storage.updateMetaArea(id, { archived: true });
  if (!archived) return c.json({ error: "Meta area not found" }, 404);
  return c.json({ archived: true });
});

// ============== METAS ==============

// GET /api/metas
metas.get("/api/metas", async (c) => {
  const storage = getStorage(c.get("db"));
  const month = c.req.query("month");
  const areaId = c.req.query("areaId");
  const responsibleId = c.req.query("responsibleId");

  const filters: any = {};
  if (month) filters.month = month;
  if (areaId) filters.areaId = areaId;
  if (responsibleId) filters.responsibleId = responsibleId;

  const result = await storage.getMetas(
    Object.keys(filters).length > 0 ? filters : undefined
  );
  return c.json(result);
});

// GET /api/metas/:id
metas.get("/api/metas/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const meta = await storage.getMeta(c.req.param("id"));
  if (!meta) return c.json({ error: "Meta not found" }, 404);
  return c.json(meta);
});

// POST /api/metas
metas.post("/api/metas", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const validated = insertMetaSchema.parse(body);
  const meta = await storage.createMeta(validated);
  return c.json(meta, 201);
});

// PATCH /api/metas/:id
metas.patch("/api/metas/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const validated = insertMetaSchema.partial().parse(body);
  const meta = await storage.updateMeta(c.req.param("id"), validated);
  if (!meta) return c.json({ error: "Meta not found" }, 404);
  return c.json(meta);
});

// DELETE /api/metas/:id
metas.delete("/api/metas/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const deleted = await storage.deleteMeta(c.req.param("id"));
  if (!deleted) return c.json({ error: "Meta not found" }, 404);
  return c.body(null, 204);
});

// ============== META CHECK-INS ==============

// GET /api/metas/:id/checkins
metas.get("/api/metas/:id/checkins", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const checkins = await storage.getMetaCheckins(id);
  const users = await storage.getUsers();
  const checkinsWithUser = checkins.map((checkin) => ({
    ...checkin,
    user: users.find((u) => u.id === checkin.userId),
  }));
  return c.json(checkinsWithUser);
});

// POST /api/metas/:id/checkins
metas.post("/api/metas/:id/checkins", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const meta = await storage.getMeta(id);
  if (!meta) return c.json({ error: "Meta not found" }, 404);

  const body = await c.req.json();
  const validated = insertMetaCheckinSchema.parse({
    ...body,
    metaId: id,
    previousValue: meta.currentValue,
  });

  const checkin = await storage.createMetaCheckin(validated);
  await storage.updateMeta(id, { currentValue: validated.newValue });
  return c.json(checkin, 201);
});

export { metas };
