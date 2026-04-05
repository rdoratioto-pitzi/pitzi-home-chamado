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

// ─── Health helpers ───────────────────────────────────────────────────────────
type HealthStatus = "on_track" | "at_risk" | "off_track";

const QUARTER_RANGES: Record<string, { start: Date; end: Date }> = {
  "2025-Q1": { start: new Date("2025-01-01"), end: new Date("2025-03-31") },
  "2025-Q2": { start: new Date("2025-04-01"), end: new Date("2025-06-30") },
  "2025-Q3": { start: new Date("2025-07-01"), end: new Date("2025-09-30") },
  "2025-Q4": { start: new Date("2025-10-01"), end: new Date("2025-12-31") },
  "2026-Q1": { start: new Date("2026-01-01"), end: new Date("2026-03-31") },
  "2026-Q2": { start: new Date("2026-04-01"), end: new Date("2026-06-30") },
  "2026-Q3": { start: new Date("2026-07-01"), end: new Date("2026-09-30") },
  "2026-Q4": { start: new Date("2026-10-01"), end: new Date("2026-12-31") },
};

function calcKrProgress(kr: { measurementType: string; startValue: string | null; targetValue: string; currentValue: string }): number {
  const start = parseFloat(kr.startValue ?? "0");
  const target = parseFloat(kr.targetValue);
  const current = parseFloat(kr.currentValue);
  let p: number;
  if (kr.measurementType === "decreasing") {
    p = target !== start ? ((start - current) / (start - target)) * 100 : 0;
  } else if (kr.measurementType === "binary") {
    p = current > 0 ? 100 : 0;
  } else {
    p = target !== start ? ((current - start) / (target - start)) * 100 : 0;
  }
  return Math.max(0, Math.min(100, p));
}

function normalizeCycle(cycle: string): string {
  return cycle.replace(" ", "-");
}

function calcHealthStatus(progressPercent: number, cycle: string): HealthStatus {
  const range = QUARTER_RANGES[normalizeCycle(cycle)];
  if (!range) return "on_track";
  const now = new Date();
  if (now < range.start) return "on_track";
  if (now > range.end) {
    if (progressPercent >= 70) return "on_track";
    if (progressPercent >= 40) return "at_risk";
    return "off_track";
  }
  const total = range.end.getTime() - range.start.getTime();
  const elapsed = now.getTime() - range.start.getTime();
  const timeElapsed = Math.min((elapsed / total) * 100, 100);
  if (progressPercent >= timeElapsed * 0.9) return "on_track";
  if (progressPercent >= timeElapsed * 0.6) return "at_risk";
  return "off_track";
}

function calcTimeElapsedPercent(cycle: string): number {
  const range = QUARTER_RANGES[normalizeCycle(cycle)];
  if (!range) return 0;
  const now = new Date();
  if (now <= range.start) return 0;
  if (now >= range.end) return 100;
  const total = range.end.getTime() - range.start.getTime();
  const elapsed = now.getTime() - range.start.getTime();
  return Math.min((elapsed / total) * 100, 100);
}

function calcObjectiveHealth(krStatuses: HealthStatus[]): HealthStatus {
  if (krStatuses.length === 0) return "on_track";
  if (krStatuses.includes("off_track")) return "off_track";
  if (krStatuses.includes("at_risk")) return "at_risk";
  return "on_track";
}

const okrs = new Hono<AppEnv>();

// ============== DASHBOARD ==============
okrs.get("/api/okrs/dashboard", async (c) => {
  try {
    const user = c.get("user");
    const storage = getStorage(c.get("db"));
    const cycle = c.req.query("cycle") ?? "";

    const allObjectives = await storage.getObjectives();
    const allKeyResults = await storage.getKeyResults();
    const allInitiatives = await storage.getInitiatives();

    let cycleObjectives = allObjectives.filter((o) => o.cycle === cycle);

    if (user.role !== "admin") {
      cycleObjectives = cycleObjectives.filter((obj) => {
        if (obj.ownerId === user.userId) return true;
        return allKeyResults.some((kr) => {
          if (kr.objectiveId !== obj.id) return false;
          try {
            const ids = typeof kr.responsibleIds === "string"
              ? JSON.parse(kr.responsibleIds)
              : kr.responsibleIds;
            return Array.isArray(ids) && ids.includes(user.userId);
          } catch {
            return false;
          }
        });
      });
    }

    const objectiveIds = new Set(cycleObjectives.map((o) => o.id));
    const cycleKrs = allKeyResults.filter((kr) => objectiveIds.has(kr.objectiveId));
    const krIds = new Set(cycleKrs.map((kr) => kr.id));
    const cycleInitiatives = allInitiatives.filter((i) => krIds.has(i.keyResultId));

    const timeElapsed = calcTimeElapsedPercent(cycle);

    const krsWithHealth = cycleKrs.map((kr) => {
      const progress = calcKrProgress(kr);
      const health = calcHealthStatus(progress, cycle);
      return { kr, progress, health };
    });

    const objectiveSummaries = cycleObjectives.map((obj) => {
      const objKrs = krsWithHealth.filter((k) => k.kr.objectiveId === obj.id);
      const avgProgress = objKrs.length > 0
        ? objKrs.reduce((sum, k) => sum + k.progress, 0) / objKrs.length
        : 0;
      const health = calcObjectiveHealth(objKrs.map((k) => k.health));
      return {
        id: obj.id,
        title: obj.title,
        progressPercent: Math.round(avgProgress),
        healthStatus: health,
        keyResultsCount: objKrs.length,
        status: obj.status,
      };
    });

    const totalObjectives = objectiveSummaries.length;
    const avgProgress = totalObjectives > 0
      ? Math.round(objectiveSummaries.reduce((s, o) => s + o.progressPercent, 0) / totalObjectives)
      : 0;
    const byHealth = {
      on_track: objectiveSummaries.filter((o) => o.healthStatus === "on_track").length,
      at_risk: objectiveSummaries.filter((o) => o.healthStatus === "at_risk").length,
      off_track: objectiveSummaries.filter((o) => o.healthStatus === "off_track").length,
    };

    const atRiskKRs = krsWithHealth
      .filter((k) => k.health === "at_risk" || k.health === "off_track")
      .map((k) => {
        const obj = cycleObjectives.find((o) => o.id === k.kr.objectiveId);
        let ownerId: string | null = null;
        if (k.kr.responsibleIds) {
          try {
            const ids = typeof k.kr.responsibleIds === "string"
              ? JSON.parse(k.kr.responsibleIds)
              : k.kr.responsibleIds;
            ownerId = Array.isArray(ids) && ids.length > 0 ? ids[0] : null;
          } catch { /* ignore */ }
        }
        return {
          id: k.kr.id,
          title: k.kr.title,
          objectiveId: k.kr.objectiveId,
          objectiveTitle: obj?.title ?? "",
          progressPercent: Math.round(k.progress),
          expectedPercent: Math.round(timeElapsed),
          healthStatus: k.health as "at_risk" | "off_track",
          ownerId,
        };
      })
      .sort((a, b) => (b.expectedPercent - b.progressPercent) - (a.expectedPercent - a.progressPercent));

    const completedInitiatives = cycleInitiatives.filter((i) => i.completed).length;
    const now = new Date();
    const overdueInitiatives = cycleInitiatives
      .filter((i) => !i.completed && i.dueDate && new Date(i.dueDate) < now)
      .map((i) => {
        const kr = cycleKrs.find((k) => k.id === i.keyResultId);
        const obj = kr ? cycleObjectives.find((o) => o.id === kr.objectiveId) : undefined;
        return {
          id: i.id,
          title: i.title,
          keyResultId: i.keyResultId,
          keyResultTitle: kr?.title ?? "",
          objectiveTitle: obj?.title ?? "",
          dueDate: i.dueDate ? new Date(i.dueDate).toISOString() : "",
          ownerId: i.ownerId ?? null,
        };
      });

    return c.json({
      cycle,
      totalObjectives,
      avgProgress,
      byHealth,
      objectives: objectiveSummaries.sort((a, b) => a.progressPercent - b.progressPercent),
      initiatives: {
        total: cycleInitiatives.length,
        completed: completedInitiatives,
        completionRate: cycleInitiatives.length > 0
          ? Math.round((completedInitiatives / cycleInitiatives.length) * 100)
          : 0,
      },
      atRiskKRs,
      overdueInitiatives,
    });
  } catch (error) {
    console.error("Error fetching OKR dashboard:", error);
    return c.json({ error: "Failed to fetch OKR dashboard" }, 500);
  }
});

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
