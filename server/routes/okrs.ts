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

export function registerOkrRoutes(router: Router) {
  const getId = (req: any) => req.params.id as string;

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
