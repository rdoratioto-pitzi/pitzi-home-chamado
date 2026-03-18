// worker/src/routes/flowcharts.ts
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";

const flowcharts = new Hono<AppEnv>();

// GET /api/flowcharts
flowcharts.get("/api/flowcharts", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const source = c.req.query("source");

  const allFlowcharts = await storage.getFlowcharts(undefined, source);

  const filtered = allFlowcharts.filter((fc) => {
    if (fc.ownerId === user.userId) return true;
    if (fc.visibility === "public") return true;
    if (fc.permissions) {
      try {
        const perms = JSON.parse(fc.permissions);
        if (perms[user.userId]) return true;
      } catch {}
    }
    return false;
  });

  return c.json(filtered);
});

// GET /api/flowcharts/templates
flowcharts.get("/api/flowcharts/templates", async (c) => {
  const storage = getStorage(c.get("db"));
  const templates = await storage.getFlowchartTemplates();
  return c.json(templates);
});

// GET /api/flowcharts/:id
flowcharts.get("/api/flowcharts/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const flowchart = await storage.getFlowchart(c.req.param("id"));

  if (!flowchart) {
    return c.json({ error: "Fluxograma não encontrado" }, 404);
  }

  const hasAccess =
    flowchart.ownerId === user.userId ||
    flowchart.visibility === "public" ||
    (flowchart.permissions && JSON.parse(flowchart.permissions)[user.userId]);

  if (!hasAccess) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  return c.json(flowchart);
});

// POST /api/flowcharts
flowcharts.post("/api/flowcharts", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const { title, description, visibility, nodesData, edgesData, viewport, tenantId, source } =
    await c.req.json();

  const newFlowchart = await storage.createFlowchart({
    title,
    description,
    visibility: visibility || "private",
    ownerId: user.userId,
    tenantId: tenantId || null,
    nodesData: nodesData || null,
    edgesData: edgesData || null,
    viewport: viewport || null,
    isTemplate: false,
    source: source || "reactflow",
  });

  return c.json(newFlowchart, 201);
});

// PATCH /api/flowcharts/:id
flowcharts.patch("/api/flowcharts/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const flowchart = await storage.getFlowchart(id);

  if (!flowchart) {
    return c.json({ error: "Fluxograma não encontrado" }, 404);
  }
  if (flowchart.ownerId !== user.userId) {
    return c.json({ error: "Apenas o dono pode editar" }, 403);
  }

  const updated = await storage.updateFlowchart(id, await c.req.json());
  return c.json(updated);
});

// DELETE /api/flowcharts/:id
flowcharts.delete("/api/flowcharts/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const flowchart = await storage.getFlowchart(id);

  if (!flowchart) {
    return c.json({ error: "Fluxograma não encontrado" }, 404);
  }
  if (flowchart.ownerId !== user.userId) {
    return c.json({ error: "Apenas o dono pode excluir" }, 403);
  }

  await storage.deleteFlowchart(id);
  return c.body(null, 204);
});

export { flowcharts };
