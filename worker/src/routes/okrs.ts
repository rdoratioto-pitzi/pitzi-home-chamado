// worker/src/routes/okrs.ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import {
  insertObjectiveSchema,
  insertKeyResultSchema,
  insertKeyResultUpdateSchema,
  insertInitiativeSchema,
  type Objective,
} from "../../../shared/schema";

type OkrNode = Objective & { children: OkrNode[] };

const PARENT_LEVEL_RULES: Record<string, string[]> = {
  company: ["area", "team"],
  area: ["team"],
  team: [],
};

function buildOkrTree(flatList: Objective[]): OkrNode[] {
  const map = new Map<string, OkrNode>();
  const roots: OkrNode[] = [];
  for (const obj of flatList) map.set(obj.id, { ...obj, children: [] });
  for (const node of map.values()) {
    if (node.parentOkrId && map.has(node.parentOkrId)) {
      map.get(node.parentOkrId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

async function validateParentOkr(
  storage: ReturnType<typeof getStorage>,
  parentOkrId: string,
  childLevel: string,
  childId?: string
): Promise<string | null> {
  if (childId && parentOkrId === childId) return "Um OKR não pode ser pai de si mesmo";
  const parent = await storage.getObjective(parentOkrId);
  if (!parent) return "Objetivo pai não encontrado";
  const allowed = PARENT_LEVEL_RULES[parent.level] ?? [];
  if (!allowed.includes(childLevel)) {
    return `Um objetivo de nível "${parent.level}" não pode ser pai de um objetivo de nível "${childLevel}"`;
  }
  return null;
}

const okrs = new Hono<AppEnv>();

// ============== OBJECTIVES ==============

// GET /api/objectives
okrs.get("/api/objectives", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const objectives = await storage.getObjectives();

  let list: Objective[];
  if (user.role === "admin") {
    list = objectives;
  } else {
    const keyResults = await storage.getKeyResults();
    list = objectives.filter((obj) => {
      if (obj.ownerId === user.userId) return true;
      return keyResults.some((kr) => {
        if (kr.objectiveId !== obj.id) return false;
        try {
          const ids =
            typeof kr.responsibleIds === "string"
              ? JSON.parse(kr.responsibleIds)
              : kr.responsibleIds;
          return Array.isArray(ids) && ids.includes(user.userId);
        } catch {
          return false;
        }
      });
    });
  }

  if (c.req.query("tree") === "true") return c.json(buildOkrTree(list));
  return c.json(list);
});

// GET /api/objectives/:id
okrs.get("/api/objectives/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const objective = await storage.getObjective(id);
  if (!objective) return c.json({ error: "Objective not found" }, 404);

  if (user.role !== "admin" && objective.ownerId !== user.userId) {
    const keyResults = await storage.getKeyResults();
    const hasAccess = keyResults.some((kr) => {
      if (kr.objectiveId !== objective.id) return false;
      try {
        const ids =
          typeof kr.responsibleIds === "string"
            ? JSON.parse(kr.responsibleIds)
            : kr.responsibleIds;
        return Array.isArray(ids) && ids.includes(user.userId);
      } catch {
        return false;
      }
    });
    if (!hasAccess) return c.json({ error: "Access denied" }, 403);
  }
  return c.json(objective);
});

// POST /api/objectives
okrs.post("/api/objectives", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const validated = insertObjectiveSchema.parse(body);
  if (validated.parentOkrId) {
    const err = await validateParentOkr(storage, validated.parentOkrId, validated.level);
    if (err) return c.json({ error: err }, 400);
  }
  const objective = await storage.createObjective(validated);
  return c.json(objective, 201);
});

// PATCH /api/objectives/:id
okrs.patch("/api/objectives/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const existing = await storage.getObjective(id);
  if (!existing) return c.json({ error: "Objective not found" }, 404);
  if (user.role !== "admin" && existing.ownerId !== user.userId) {
    return c.json({ error: "Access denied" }, 403);
  }
  const body = await c.req.json();
  const validated = insertObjectiveSchema.partial().parse(body);
  if (validated.parentOkrId) {
    const level = validated.level ?? existing.level;
    const err = await validateParentOkr(storage, validated.parentOkrId, level, id);
    if (err) return c.json({ error: err }, 400);
  }
  const objective = await storage.updateObjective(id, validated);
  if (!objective) return c.json({ error: "Objective not found" }, 404);
  return c.json(objective);
});

// DELETE /api/objectives/:id
okrs.delete("/api/objectives/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const objective = await storage.getObjective(id);
  if (!objective) return c.json({ error: "Objective not found" }, 404);
  if (user.role !== "admin" && objective.ownerId !== user.userId) {
    return c.json({ error: "Access denied" }, 403);
  }
  const deleted = await storage.deleteObjective(id);
  if (!deleted) return c.json({ error: "Objective not found" }, 404);
  return c.body(null, 204);
});

// ============== KEY RESULTS ==============

// GET /api/key-results
okrs.get("/api/key-results", async (c) => {
  const storage = getStorage(c.get("db"));
  const keyResults = await storage.getKeyResults();
  return c.json(keyResults);
});

// GET /api/key-results/:id
okrs.get("/api/key-results/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const kr = await storage.getKeyResult(c.req.param("id"));
  if (!kr) return c.json({ error: "Key result not found" }, 404);
  return c.json(kr);
});

// POST /api/key-results
okrs.post("/api/key-results", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const validated = insertKeyResultSchema.parse(body);
  const kr = await storage.createKeyResult(validated);
  return c.json(kr, 201);
});

// PATCH /api/key-results/:id
okrs.patch("/api/key-results/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const validated = insertKeyResultSchema.partial().parse(body);
  const kr = await storage.updateKeyResult(c.req.param("id"), validated);
  if (!kr) return c.json({ error: "Key result not found" }, 404);
  return c.json(kr);
});

// DELETE /api/key-results/:id
okrs.delete("/api/key-results/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const deleted = await storage.deleteKeyResult(c.req.param("id"));
  if (!deleted) return c.json({ error: "Key result not found" }, 404);
  return c.body(null, 204);
});

// ============== INITIATIVES ==============

// GET /api/initiatives?keyResultId=... (keyResultId optional — returns all if omitted)
okrs.get("/api/initiatives", async (c) => {
  const storage = getStorage(c.get("db"));
  const keyResultId = c.req.query("keyResultId");
  const list = keyResultId
    ? await storage.getInitiativesByKeyResult(keyResultId)
    : await storage.getInitiatives();
  return c.json(list);
});

// POST /api/initiatives
okrs.post("/api/initiatives", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const validated = insertInitiativeSchema.parse(body);
  const kr = await storage.getKeyResult(validated.keyResultId);
  if (!kr) return c.json({ error: "Key result não encontrado" }, 400);
  const initiative = await storage.createInitiative(validated);
  return c.json(initiative, 201);
});

// PATCH /api/initiatives/:id
okrs.patch("/api/initiatives/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const existing = await storage.getInitiative(id);
  if (!existing) return c.json({ error: "Initiative not found" }, 404);
  const body = await c.req.json();
  const validated = insertInitiativeSchema.partial().parse(body);
  const initiative = await storage.updateInitiative(id, validated);
  if (!initiative) return c.json({ error: "Initiative not found" }, 404);
  return c.json(initiative);
});

// DELETE /api/initiatives/:id
okrs.delete("/api/initiatives/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const existing = await storage.getInitiative(id);
  if (!existing) return c.json({ error: "Initiative not found" }, 404);
  const deleted = await storage.deleteInitiative(id);
  if (!deleted) return c.json({ error: "Initiative not found" }, 404);
  return c.body(null, 204);
});

// ============== KEY RESULT UPDATES (Check-ins) ==============

// GET /api/key-results/:id/updates
okrs.get("/api/key-results/:id/updates", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const updates = await storage.getKeyResultUpdates(id);
  const users = await storage.getUsers();
  const updatesWithUser = updates.map((update) => ({
    ...update,
    user: users.find((u) => u.id === update.userId),
  }));
  return c.json(updatesWithUser);
});

// POST /api/key-results/:id/updates
okrs.post("/api/key-results/:id/updates", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const kr = await storage.getKeyResult(id);
  if (!kr) return c.json({ error: "Key result not found" }, 404);

  const body = await c.req.json();
  const validated = insertKeyResultUpdateSchema.parse({
    ...body,
    keyResultId: id,
    previousValue: kr.currentValue,
  });

  // Calculate progress percentage based on measurement type
  const startVal = parseFloat(kr.startValue || "0");
  const targetVal = parseFloat(kr.targetValue || "100");
  const newVal = parseFloat(validated.newValue || "0");

  let progressPercentage: number;
  if (kr.measurementType === "decreasing") {
    progressPercentage =
      targetVal !== startVal
        ? ((startVal - newVal) / (startVal - targetVal)) * 100
        : 0;
  } else if (kr.measurementType === "binary") {
    progressPercentage = newVal > 0 ? 100 : 0;
  } else {
    progressPercentage =
      targetVal !== startVal
        ? ((newVal - startVal) / (targetVal - startVal)) * 100
        : 0;
  }
  progressPercentage = Math.max(0, Math.min(100, progressPercentage));

  const update = await storage.createKeyResultUpdate({
    ...validated,
    progressPercentage: String(progressPercentage),
  });

  // Update deadline status
  const now = new Date();
  let deadlineStatus = kr.deadlineStatus;
  if (kr.dueDate) {
    const dueDate = new Date(kr.dueDate);
    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilDue < 0) deadlineStatus = "overdue";
    else if (daysUntilDue <= 7) deadlineStatus = "at_risk";
    else deadlineStatus = "on_track";
  }

  await storage.updateKeyResult(id, {
    currentValue: validated.newValue,
    deadlineStatus,
  });

  return c.json(update, 201);
});

export { okrs };
