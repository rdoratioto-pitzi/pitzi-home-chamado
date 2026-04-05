import { Router } from "express";
import { storage } from "../storage";
import {
  insertObjectiveSchema,
  insertKeyResultSchema,
  insertKeyResultUpdateSchema,
  insertInitiativeSchema,
  type Objective,
} from "@shared/schema";
import { getSessionUser, requireAuth } from "../middleware/auth";
import { z } from "zod";

type OkrNode = Objective & { children: OkrNode[] };

// Objectives only support 'company' level going forward; 'area' and 'team' kept for DB compat
const PARENT_LEVEL_RULES: Record<string, string[]> = {
  company: ["area", "team"],
  area: ["team"],
  team: [],
};

function buildOkrTree(flatList: Objective[]): OkrNode[] {
  const map = new Map<string, OkrNode>();
  const roots: OkrNode[] = [];

  for (const obj of flatList) {
    map.set(obj.id, { ...obj, children: [] });
  }

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
  parentOkrId: string,
  childLevel: string,
  childId?: string
): Promise<string | null> {
  if (childId && parentOkrId === childId) {
    return "Um OKR não pode ser pai de si mesmo";
  }

  const parent = await storage.getObjective(parentOkrId);
  if (!parent) {
    return "Objetivo pai não encontrado";
  }

  const allowedChildren = PARENT_LEVEL_RULES[parent.level] ?? [];
  if (!allowedChildren.includes(childLevel)) {
    return `Um objetivo de nível "${parent.level}" não pode ser pai de um objetivo de nível "${childLevel}"`;
  }

  return null;
}

// ─── Health helpers (replica de client/src/lib/okr-health.ts para uso no backend) ───
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
  // Normaliza "2026 Q2" → "2026-Q2"
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

export function registerOkrRoutes(router: Router) {
  const getId = (req: any) => req.params.id as string;

  // ============== DASHBOARD ==============
  router.get("/api/okrs/dashboard", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const cycle = (req.query.cycle as string) || "";

      const allObjectives = await storage.getObjectives();
      const allKeyResults = await storage.getKeyResults();
      const allInitiatives = await storage.getInitiatives();

      // Filtrar objectives pelo cycle
      let cycleObjectives = allObjectives.filter((o) => o.cycle === cycle);

      // Aplicar filtro de permissão igual ao GET /api/objectives
      if (!isAdmin) {
        cycleObjectives = cycleObjectives.filter((obj) => {
          if (obj.ownerId === userId) return true;
          return allKeyResults.some((kr) => {
            if (kr.objectiveId !== obj.id) return false;
            try {
              const ids = typeof kr.responsibleIds === "string"
                ? JSON.parse(kr.responsibleIds)
                : kr.responsibleIds;
              return Array.isArray(ids) && ids.includes(userId);
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

      // KRs com progresso e health
      const krsWithHealth = cycleKrs.map((kr) => {
        const progress = calcKrProgress(kr);
        const health = calcHealthStatus(progress, cycle);
        return { kr, progress, health };
      });

      // Objectives com progresso e health
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

      // Stats gerais
      const totalObjectives = objectiveSummaries.length;
      const avgProgress = totalObjectives > 0
        ? Math.round(objectiveSummaries.reduce((s, o) => s + o.progressPercent, 0) / totalObjectives)
        : 0;
      const byHealth = {
        on_track: objectiveSummaries.filter((o) => o.healthStatus === "on_track").length,
        at_risk: objectiveSummaries.filter((o) => o.healthStatus === "at_risk").length,
        off_track: objectiveSummaries.filter((o) => o.healthStatus === "off_track").length,
      };

      // KRs fora do ritmo
      const atRiskKRs = krsWithHealth
        .filter((k) => k.health === "at_risk" || k.health === "off_track")
        .map((k) => {
          const obj = cycleObjectives.find((o) => o.id === k.kr.objectiveId);
          return {
            id: k.kr.id,
            title: k.kr.title,
            objectiveId: k.kr.objectiveId,
            objectiveTitle: obj?.title ?? "",
            progressPercent: Math.round(k.progress),
            expectedPercent: Math.round(timeElapsed),
            healthStatus: k.health as "at_risk" | "off_track",
            ownerId: k.kr.responsibleIds
              ? (() => {
                  try {
                    const ids = typeof k.kr.responsibleIds === "string"
                      ? JSON.parse(k.kr.responsibleIds)
                      : k.kr.responsibleIds;
                    return Array.isArray(ids) && ids.length > 0 ? ids[0] : null;
                  } catch {
                    return null;
                  }
                })()
              : null,
          };
        })
        .sort((a, b) => (b.expectedPercent - b.progressPercent) - (a.expectedPercent - a.progressPercent));

      // Initiatives stats
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
            dueDate: i.dueDate ? i.dueDate.toISOString() : "",
            ownerId: i.ownerId ?? null,
          };
        });

      res.json({
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
      res.status(500).json({ error: "Failed to fetch OKR dashboard" });
    }
  });

  // ============== OKRs ==============
  router.get("/api/objectives", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const objectives = await storage.getObjectives();

      let list: Objective[];
      if (isAdmin) {
        list = objectives;
      } else {
        const keyResults = await storage.getKeyResults();
        list = objectives.filter(obj => {
          if (obj.ownerId === userId) return true;
          return keyResults.some(kr => {
            if (kr.objectiveId !== obj.id) return false;
            try {
              const ids = typeof kr.responsibleIds === "string"
                ? JSON.parse(kr.responsibleIds)
                : kr.responsibleIds;
              return Array.isArray(ids) && ids.includes(userId);
            } catch {
              return false;
            }
          });
        });
      }

      if (req.query.tree === "true") {
        return res.json(buildOkrTree(list));
      }

      res.json(list);
    } catch (error) {
      console.error("Error fetching objectives:", error);
      res.status(500).json({ error: "Failed to fetch objectives" });
    }
  });

  router.get("/api/objectives/:id", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const objective = await storage.getObjective(getId(req));
      if (!objective) return res.status(404).json({ error: "Objective not found" });
      if (!isAdmin && objective.ownerId !== userId) {
        const keyResults = await storage.getKeyResults();
        const hasAccess = keyResults.some(kr => {
          if (kr.objectiveId !== objective.id) return false;
          try {
            const ids = typeof kr.responsibleIds === "string"
              ? JSON.parse(kr.responsibleIds)
              : kr.responsibleIds;
            return Array.isArray(ids) && ids.includes(userId);
          } catch {
            return false;
          }
        });
        if (!hasAccess) return res.status(403).json({ error: "Access denied" });
      }
      res.json(objective);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch objective" });
    }
  });

  router.post("/api/objectives", requireAuth, async (req, res) => {
    try {
      const validated = insertObjectiveSchema.parse(req.body);

      if (validated.parentOkrId) {
        const err = await validateParentOkr(validated.parentOkrId, validated.level ?? "company");
        if (err) return res.status(400).json({ error: err });
      }

      const objective = await storage.createObjective(validated);
      res.status(201).json(objective);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create objective" });
    }
  });

  router.patch("/api/objectives/:id", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const existing = await storage.getObjective(getId(req));
      if (!existing) return res.status(404).json({ error: "Objective not found" });
      if (!isAdmin && existing.ownerId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const partialSchema = insertObjectiveSchema.partial();
      const validated = partialSchema.parse(req.body);

      if (validated.parentOkrId) {
        const level = validated.level ?? existing.level;
        const err = await validateParentOkr(validated.parentOkrId, level, getId(req));
        if (err) return res.status(400).json({ error: err });
      }

      const objective = await storage.updateObjective(getId(req), validated);
      if (!objective) return res.status(404).json({ error: "Objective not found" });
      res.json(objective);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update objective" });
    }
  });

  router.delete("/api/objectives/:id", requireAuth, async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    const objective = await storage.getObjective(getId(req));
    if (!objective) return res.status(404).json({ error: "Objective not found" });
    if (!isAdmin && objective.ownerId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const deleted = await storage.deleteObjective(getId(req));
    if (!deleted) return res.status(404).json({ error: "Objective not found" });
    res.status(204).send();
  });

  // ============== KEY RESULTS ==============
  router.get("/api/key-results", requireAuth, async (req, res) => {
    const keyResults = await storage.getKeyResults();
    res.json(keyResults);
  });

  router.post("/api/key-results", requireAuth, async (req, res) => {
    try {
      const validated = insertKeyResultSchema.parse(req.body);
      const kr = await storage.createKeyResult(validated);
      res.status(201).json(kr);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create key result" });
    }
  });

  router.patch("/api/key-results/:id", requireAuth, async (req, res) => {
    try {
      const partialSchema = insertKeyResultSchema.partial();
      const validated = partialSchema.parse(req.body);
      const kr = await storage.updateKeyResult(getId(req), validated);
      if (!kr) return res.status(404).json({ error: "Key result not found" });
      res.json(kr);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update key result" });
    }
  });

  router.get("/api/key-results/:id", requireAuth, async (req, res) => {
    const kr = await storage.getKeyResult(getId(req));
    if (!kr) return res.status(404).json({ error: "Key result not found" });
    res.json(kr);
  });

  router.delete("/api/key-results/:id", requireAuth, async (req, res) => {
    const deleted = await storage.deleteKeyResult(getId(req));
    if (!deleted) return res.status(404).json({ error: "Key result not found" });
    res.status(204).send();
  });

  // ============== INITIATIVES ==============
  router.get("/api/initiatives", requireAuth, async (req, res) => {
    try {
      const keyResultId = req.query.keyResultId as string | undefined;
      const list = keyResultId
        ? await storage.getInitiativesByKeyResult(keyResultId)
        : await storage.getInitiatives();
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch initiatives" });
    }
  });

  router.post("/api/initiatives", requireAuth, async (req, res) => {
    try {
      const validated = insertInitiativeSchema.parse(req.body);
      const kr = await storage.getKeyResult(validated.keyResultId);
      if (!kr) return res.status(400).json({ error: "Key result não encontrado" });
      const initiative = await storage.createInitiative(validated);
      res.status(201).json(initiative);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create initiative" });
    }
  });

  router.patch("/api/initiatives/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getInitiative(req.params.id);
      if (!existing) return res.status(404).json({ error: "Initiative not found" });
      const partialSchema = insertInitiativeSchema.partial();
      const validated = partialSchema.parse(req.body);
      const initiative = await storage.updateInitiative(req.params.id, validated);
      if (!initiative) return res.status(404).json({ error: "Initiative not found" });
      res.json(initiative);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update initiative" });
    }
  });

  router.delete("/api/initiatives/:id", requireAuth, async (req, res) => {
    const existing = await storage.getInitiative(req.params.id);
    if (!existing) return res.status(404).json({ error: "Initiative not found" });
    const deleted = await storage.deleteInitiative(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Initiative not found" });
    res.status(204).send();
  });

  // ============== KEY RESULT UPDATES (Check-ins) ==============
  router.get("/api/key-results/:id/updates", requireAuth, async (req, res) => {
    const updates = await storage.getKeyResultUpdates(getId(req));
    const users = await storage.getUsers();

    const updatesWithUser = updates.map(update => ({
      ...update,
      user: users.find(u => u.id === update.userId),
    }));

    res.json(updatesWithUser);
  });

  router.post("/api/key-results/:id/updates", requireAuth, async (req, res) => {
    try {
      const kr = await storage.getKeyResult(getId(req));
      if (!kr) return res.status(404).json({ error: "Key result not found" });

      const validated = insertKeyResultUpdateSchema.parse({
        ...req.body,
        keyResultId: req.params.id,
        previousValue: kr.currentValue,
      });

      const startVal = parseFloat(kr.startValue || "0");
      const targetVal = parseFloat(kr.targetValue || "100");
      const newVal = parseFloat(validated.newValue || "0");

      let progressPercentage: number;
      if (kr.measurementType === "decreasing") {
        progressPercentage = targetVal !== startVal
          ? ((startVal - newVal) / (startVal - targetVal)) * 100
          : 0;
      } else if (kr.measurementType === "binary") {
        progressPercentage = newVal > 0 ? 100 : 0;
      } else {
        progressPercentage = targetVal !== startVal
          ? ((newVal - startVal) / (targetVal - startVal)) * 100
          : 0;
      }

      progressPercentage = Math.max(0, Math.min(100, progressPercentage));

      const updateData = {
        ...validated,
        progressPercentage: String(progressPercentage),
      };

      const update = await storage.createKeyResultUpdate(updateData);

      const now = new Date();
      let deadlineStatus = kr.deadlineStatus;
      if (kr.dueDate) {
        const dueDate = new Date(kr.dueDate);
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilDue < 0) {
          deadlineStatus = "overdue";
        } else if (daysUntilDue <= 7) {
          deadlineStatus = "at_risk";
        } else {
          deadlineStatus = "on_track";
        }
      }

      await storage.updateKeyResult(getId(req), {
        currentValue: validated.newValue,
        deadlineStatus,
      });

      res.status(201).json(update);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating key result update:", error);
      res.status(400).json({ error: "Failed to create key result update" });
    }
  });
}
