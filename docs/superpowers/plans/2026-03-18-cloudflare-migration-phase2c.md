# Cloudflare Migration Phase 2C — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate 6 Express routes (OKRs, Metas, Knowledge Base, Integrations, Tickets, Git Analytics) plus supporting services to Hono Workers.

**Architecture:** 1:1 migration from Express to Hono, following the same pattern established in Phases 2A/2B. Each Express route file becomes a `new Hono<AppEnv>()` instance mounted at the root. Storage access via `getStorage(c.get("db"))`, email via SendPulse functions from `worker/src/lib/email.ts`. Two new services: `github-sync.ts` (dependency-injected copy) and `github-webhook.ts` (Web Crypto signature validation).

**Tech Stack:** Hono, Drizzle ORM (via storage bridge), SendPulse REST API, GitHub API, Web Crypto API, Zod

**Spec:** `docs/superpowers/specs/2026-03-18-cloudflare-migration-phase2c-design.md`

---

## File Structure

**Create (8 files):**
| File | Responsibility |
|------|---------------|
| `worker/src/routes/okrs.ts` | 12 endpoints — Objectives + Key Results CRUD, check-ins with progress calculation |
| `worker/src/routes/metas.ts` | 12 endpoints — Meta Areas (soft delete) + Metas CRUD, check-ins |
| `worker/src/routes/knowledge.ts` | 13 endpoints — Knowledge documents CRUD, versions, audit logs, favorites |
| `worker/src/routes/integrations.ts` | 11 endpoints — RenovSmart proxy, AI evaluation proxy, logística reversa webhook, estoque proxy |
| `worker/src/routes/tickets.ts` | 16 endpoints — Tickets CRUD, comments, auto-assignment, 6 email types, CSAT analytics |
| `worker/src/routes/git-analytics.ts` | 22 endpoints — Repos, commits, PRs, security alerts, branches, stats, sync, webhook |
| `worker/src/services/github-sync.ts` | GitHub sync service with dependency injection (replaces `process.env` + global `storage`) |
| `worker/src/lib/github-webhook.ts` | GitHub webhook signature validation using Web Crypto API |

**Modify (2 files):**
| File | Changes |
|------|---------|
| `worker/src/index.ts` | Import + mount 6 routes, add `GITHUB_WEBHOOK_SECRET` to Bindings type |
| `worker/src/middleware/auth.ts` | Add public routes for integrations + github webhook |

---

## Migration Pattern Reference

Every route follows this conversion pattern (from existing Phase 2A/2B routes):

```typescript
// Express pattern:
router.get("/api/foo", requireAuth, async (req, res) => {
  const { userId, isAdmin } = getSessionUser(req);
  const storage = storage; // global import
  const items = await storage.getFoo();
  res.json(items);
});

// Hono pattern:
foo.get("/api/foo", async (c) => {
  const user = c.get("user");                    // set by authMiddleware
  const storage = getStorage(c.get("db"));       // per-request DB
  const items = await storage.getFoo();
  return c.json(items);
});
```

Key differences:
- `req.params.id` → `c.req.param("id")`
- `req.query.foo` → `c.req.query("foo")`
- `req.body` → `await c.req.json()`
- `getSessionUser(req).userId` → `c.get("user").userId`
- `getSessionUser(req).isAdmin` → `c.get("user").role === "admin"`
- `res.json(data)` → `return c.json(data)`
- `res.status(201).json(data)` → `return c.json(data, 201)`
- `res.status(204).send()` → `return c.body(null, 204)`
- Email calls: Express `sendFoo(ticket, user)` → Worker `sendFoo(c.env, storage, ticket, user)`

---

### Task 1: OKRs Route

**Files:**
- Create: `worker/src/routes/okrs.ts`

**Context:** Source is `server/routes/okrs.ts` (235 lines, 12 endpoints). Pure storage CRUD with access control via `JSON.parse(kr.responsibleIds)` and progress calculation for check-ins.

- [ ] **Step 1: Create the OKRs route file**

```typescript
// worker/src/routes/okrs.ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import {
  insertObjectiveSchema,
  insertKeyResultSchema,
  insertKeyResultUpdateSchema,
} from "@shared/schema";

const okrs = new Hono<AppEnv>();

// ============== OBJECTIVES ==============

// GET /api/objectives
okrs.get("/api/objectives", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const objectives = await storage.getObjectives();

  if (user.role === "admin") return c.json(objectives);

  const keyResults = await storage.getKeyResults();
  const filtered = objectives.filter((obj) => {
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
  return c.json(filtered);
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in `worker/src/routes/okrs.ts`

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/okrs.ts
git commit -m "feat(worker): migrate OKRs route to Hono (Phase 2C)"
```

---

### Task 2: Metas Route

**Files:**
- Create: `worker/src/routes/metas.ts`

**Context:** Source is `server/routes/metas.ts` (197 lines, 12 endpoints). Meta areas use soft delete (archive). Check-in creation updates parent meta's `currentValue`.

- [ ] **Step 1: Create the Metas route file**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in `worker/src/routes/metas.ts`

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/metas.ts
git commit -m "feat(worker): migrate Metas route to Hono (Phase 2C)"
```

---

### Task 3: Knowledge Base Route

**Files:**
- Create: `worker/src/routes/knowledge.ts`

**Context:** Source is `server/routes/knowledge.ts` (172 lines, 13 endpoints). Creator-or-admin access control. Two endpoints return 501 (not implemented). Favorites toggle.

- [ ] **Step 1: Create the Knowledge Base route file**

```typescript
// worker/src/routes/knowledge.ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import {
  insertKnowledgeDocumentSchema,
  insertKnowledgeDocumentVersionSchema,
} from "@shared/schema";

const knowledge = new Hono<AppEnv>();

// GET /api/knowledge/documents
knowledge.get("/api/knowledge/documents", async (c) => {
  const storage = getStorage(c.get("db"));
  const query = c.req.query("query");
  const tag = c.req.query("tag");
  const area = c.req.query("area");
  const author = c.req.query("author");
  const status = c.req.query("status");
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");
  const favoritesOnly = c.req.query("favoritesOnly");

  const filters = {
    query: query || undefined,
    tag: tag || undefined,
    area: area || undefined,
    author: author || undefined,
    status: status || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    favoritesOnly: favoritesOnly === "true",
  };

  const documents = await storage.getKnowledgeDocuments(filters);
  return c.json(documents);
});

// GET /api/knowledge/documents/:id
knowledge.get("/api/knowledge/documents/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const document = await storage.getKnowledgeDocument(c.req.param("id"));
  if (!document) return c.json({ error: "Document not found or access denied" }, 404);
  if ((document as any).createdBy !== user.userId && user.role !== "admin") {
    return c.json({ error: "Access denied" }, 403);
  }
  return c.json(document);
});

// POST /api/knowledge/documents
knowledge.post("/api/knowledge/documents", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const validated = insertKnowledgeDocumentSchema.parse({
    ...body,
    createdBy: user.userId,
  });
  const newDocument = await storage.createKnowledgeDocument(validated);
  return c.json(newDocument, 201);
});

// PUT /api/knowledge/documents/:id
knowledge.put("/api/knowledge/documents/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const document = await storage.getKnowledgeDocument(id);
  if (
    !document ||
    ((document as any).createdBy !== user.userId && user.role !== "admin")
  ) {
    return c.json({ error: "Access denied" }, 403);
  }
  const body = await c.req.json();
  const validated = insertKnowledgeDocumentSchema.partial().parse(body);
  const updatedDocument = await storage.updateKnowledgeDocument(id, validated);
  if (!updatedDocument) return c.json({ error: "Document not found" }, 404);
  return c.json(updatedDocument);
});

// DELETE /api/knowledge/documents/:id
knowledge.delete("/api/knowledge/documents/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const document = await storage.getKnowledgeDocument(id);
  if (
    !document ||
    ((document as any).createdBy !== user.userId && user.role !== "admin")
  ) {
    return c.json({ error: "Access denied" }, 403);
  }
  const deleted = await storage.deleteKnowledgeDocument(id);
  if (!deleted) return c.json({ error: "Document not found" }, 404);
  return c.body(null, 204);
});

// GET /api/knowledge/documents/:id/versions
knowledge.get("/api/knowledge/documents/:id/versions", async (c) => {
  const storage = getStorage(c.get("db"));
  const versions = await storage.getKnowledgeDocumentVersions(c.req.param("id"));
  return c.json(versions);
});

// POST /api/knowledge/documents/:id/versions
knowledge.post("/api/knowledge/documents/:id/versions", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const documentId = c.req.param("id");
  const body = await c.req.json();
  const validated = insertKnowledgeDocumentVersionSchema.parse({
    ...body,
    documentId,
    createdBy: user.userId,
  });
  const version = await storage.createKnowledgeDocumentVersion(validated);
  return c.json(version, 201);
});

// GET /api/knowledge/documents/:documentId/versions/:versionId
knowledge.get("/api/knowledge/documents/:documentId/versions/:versionId", async (c) => {
  const storage = getStorage(c.get("db"));
  const documentId = c.req.param("documentId");
  const versionId = c.req.param("versionId");
  const versions = await storage.getKnowledgeDocumentVersions(documentId);
  const version = versions.find((v) => v.id === versionId);
  if (!version) return c.json({ error: "Document version not found" }, 404);
  return c.json(version);
});

// POST /api/knowledge/documents/:documentId/versions/:versionId/revert — NOT IMPLEMENTED
knowledge.post(
  "/api/knowledge/documents/:documentId/versions/:versionId/revert",
  async (c) => {
    return c.json({ error: "Not Implemented: Revert Document Version" }, 501);
  }
);

// DELETE /api/knowledge/documents/:documentId/versions/:versionId — NOT IMPLEMENTED
knowledge.delete(
  "/api/knowledge/documents/:documentId/versions/:versionId",
  async (c) => {
    return c.json({ error: "Not Implemented: Delete Document Version" }, 501);
  }
);

// GET /api/knowledge/documents/:id/audit-logs
knowledge.get("/api/knowledge/documents/:id/audit-logs", async (c) => {
  const storage = getStorage(c.get("db"));
  const logs = await storage.getKnowledgeAuditLogs(c.req.param("id"));
  return c.json(logs);
});

// POST /api/knowledge/documents/:id/toggle-favorite
knowledge.post("/api/knowledge/documents/:id/toggle-favorite", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const documentId = c.req.param("id");
  const { isFavorite } = await c.req.json();

  if (isFavorite) {
    const existing = await storage.getKnowledgeFavorite(user.userId, documentId);
    if (!existing) {
      await storage.createKnowledgeFavorite({ userId: user.userId, documentId });
    }
  } else {
    const existing = await storage.getKnowledgeFavorite(user.userId, documentId);
    if (existing) {
      await storage.deleteKnowledgeFavorite(existing.id);
    }
  }
  return c.json({ success: true });
});

// GET /api/knowledge/favorites
knowledge.get("/api/knowledge/favorites", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const favorites = await storage.getKnowledgeFavorites(user.userId);
  return c.json(favorites);
});

export { knowledge };
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in `worker/src/routes/knowledge.ts`

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/knowledge.ts
git commit -m "feat(worker): migrate Knowledge Base route to Hono (Phase 2C)"
```

---

### Task 4: Integrations Route

**Files:**
- Create: `worker/src/routes/integrations.ts`

**Context:** Source is `server/routes/integrations.ts` (270 lines, 11 endpoints). All public (no auth). Hardcoded API constants. Shared `fetchAiEvaluation` helper for 7 endpoints. `fetchEstoque` helper. Logística reversa webhook with Zod validation.

- [ ] **Step 1: Create the Integrations route file**

```typescript
// worker/src/routes/integrations.ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { insertLogisticaReversaEventoSchema } from "@shared/schema";

const integrations = new Hono<AppEnv>();

const RS_API_BASE_URL = "https://dash.renovsmart.com.br/api";
const RS_API_TOKEN = "Renov123";

// ============== HELPERS ==============

async function fetchAiEvaluation(endpoint: string, query: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  Object.keys(query).forEach((key) => {
    const value = query[key];
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else if (value) {
      params.append(key, value);
    }
  });

  const url = `${RS_API_BASE_URL}/avaliacoes-ia/${endpoint}`;
  const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;

  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${RS_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Não autenticado na API externa via backend");
    }
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      throw new Error(json.message || json.error || `API error: ${response.status}`);
    } catch {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
  }
  return response.json();
}

async function fetchEstoque(query: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  Object.keys(query).forEach((key) => {
    const value = query[key];
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else if (value) {
      params.append(key, value);
    }
  });

  const url = `${RS_API_BASE_URL}/estoques`;
  const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;

  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${RS_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("Não autenticado na API externa via backend");
    if (response.status === 403) throw new Error("Token de acesso inválido");
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      throw new Error(json.message || json.error || `API error: ${response.status}`);
    } catch {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
  }
  return response.json();
}

// ============== RELATÓRIO PEDIDOS ==============

// POST /api/integrations/relatorio-pedidos/test-connection (public)
integrations.post("/api/integrations/relatorio-pedidos/test-connection", async (c) => {
  try {
    const response = await fetch(
      `${RS_API_BASE_URL}/orders/advanced?imei=000000000000000`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${RS_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (response.ok) {
      return c.json({ connected: true, message: "Conexão estabelecida com sucesso" });
    }
    return c.json({
      connected: false,
      message: `Erro: ${response.status} ${response.statusText}`,
    });
  } catch (error: any) {
    return c.json({
      connected: false,
      message: error.message || "Falha ao conectar com a API",
    });
  }
});

// GET /api/integrations/relatorio-pedidos/orders/advanced (public)
integrations.get("/api/integrations/relatorio-pedidos/orders/advanced", async (c) => {
  const params = new URLSearchParams();
  const queryParams = [
    "imei", "voucher_code", "voucher_status", "customer_cpf",
    "created_start", "created_end", "used_start", "used_end",
    "category", "network", "seller_name", "regional",
    "filial", "store_type", "boost", "global_status",
  ];
  queryParams.forEach((param) => {
    const val = c.req.query(param);
    if (val) params.append(param, val);
  });
  const response = await fetch(
    `${RS_API_BASE_URL}/orders/advanced?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${RS_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!response.ok)
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  const data = await response.json();
  return c.json(data);
});

// ============== LOGÍSTICA REVERSA ==============

// POST /api/logistica-reversa/eventos (public)
integrations.post("/api/logistica-reversa/eventos", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const validated = insertLogisticaReversaEventoSchema.parse(body);
  const evento = await storage.createLogisticaReversaEvento(validated);
  return c.json(evento, 201);
});

// ============== AVALIAÇÕES IA ==============

const aiEndpoints = [
  "resumo", "evolucao", "evolucao-categoria", "dispositivos",
  "detalhes", "categorias", "assertividade-fotos",
] as const;

for (const endpoint of aiEndpoints) {
  integrations.get(`/api/avaliacoes-ia/${endpoint}`, async (c) => {
    const data = await fetchAiEvaluation(endpoint, c.req.query() as any);
    return c.json(data);
  });
}

// ============== ESTOQUES ==============

// GET /api/estoques (public)
integrations.get("/api/estoques", async (c) => {
  const data = await fetchEstoque(c.req.query() as any);
  return c.json(data);
});

export { integrations };
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in `worker/src/routes/integrations.ts`

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/integrations.ts
git commit -m "feat(worker): migrate Integrations route to Hono (Phase 2C)"
```

---

### Task 5: Tickets Route

**Files:**
- Create: `worker/src/routes/tickets.ts`

**Context:** Source is `server/routes/tickets.ts` (557 lines, 16 endpoints). Most complex route — auto-assignment, 6 email types, notifications, CSAT analytics, mention parsing. Email functions use Worker signature: `(env: EmailEnv, storage: IStorage, ...)`.

**Important:** The `requireAdmin` middleware from `worker/src/middleware/auth.ts` is used for ticket-responsaveis CUD endpoints. Import it.

- [ ] **Step 1: Create the Tickets route file**

```typescript
// worker/src/routes/tickets.ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { requireAdmin } from "../middleware/auth";
import {
  insertTicketSchema,
  insertTicketResponsavelSchema,
  insertTicketCommentSchema,
} from "@shared/schema";
import {
  sendTicketCreatedEmail,
  sendTicketAssignedEmail,
  sendTicketStatusChangedEmail,
  sendTicketCommentEmail,
  sendMentionNotificationEmail,
  sendCSATReceivedEmail,
} from "../lib/email";

const tickets = new Hono<AppEnv>();

// GET /api/tickets
tickets.get("/api/tickets", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));

  if (user.role === "admin") {
    const allTickets = await storage.getTickets();
    return c.json(allTickets);
  }
  const userTickets = await storage.getTickets({
    requesterId: user.userId,
    assigneeId: user.userId,
  });
  return c.json(userTickets);
});

// GET /api/tickets/:id
tickets.get("/api/tickets/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const ticket = await storage.getTicket(c.req.param("id"));
  if (!ticket) return c.json({ error: "Ticket not found" }, 404);
  if (
    user.role !== "admin" &&
    ticket.requesterId !== user.userId &&
    ticket.assigneeId !== user.userId
  ) {
    return c.json({ error: "Ticket not found" }, 404);
  }
  return c.json(ticket);
});

// POST /api/tickets
tickets.post("/api/tickets", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const env = c.env;
  const body = await c.req.json();
  const data = { ...body };

  if (user.role !== "admin" || !data.requesterId) {
    data.requesterId = user.userId;
  }

  const validated = insertTicketSchema.parse(data);

  // Auto-assignment
  if (!validated.assigneeId && validated.category && validated.type) {
    const autoAssignee = await storage.findResponsavelForTicket(
      validated.category,
      validated.type
    );
    if (autoAssignee) validated.assigneeId = autoAssignee;
  }

  const ticket = await storage.createTicket(validated);
  const requester = await storage.getUser(ticket.requesterId);
  const assignee = ticket.assigneeId ? await storage.getUser(ticket.assigneeId) : null;

  // Emails (fire-and-forget)
  if (requester) {
    sendTicketCreatedEmail(env, storage, ticket, requester, assignee || null).catch(
      console.error
    );
  }
  if (assignee && assignee.id !== ticket.requesterId) {
    sendTicketAssignedEmail(env, storage, ticket, assignee).catch(console.error);
  }

  // Notification
  if (ticket.assigneeId && ticket.assigneeId !== ticket.requesterId) {
    storage
      .createNotification({
        userId: ticket.assigneeId,
        fromUserId: ticket.requesterId,
        title: "Novo chamado atribuído",
        message: `O chamado "${ticket.title}" (${ticket.code}) foi criado e atribuído a você`,
        module: "chamados",
        entityId: ticket.id,
        linkUrl: `/chamados?ticket=${ticket.id}`,
      })
      .catch(console.error);
  }

  return c.json(ticket, 201);
});

// PATCH /api/tickets/:id
tickets.patch("/api/tickets/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const env = c.env;
  const id = c.req.param("id");
  const oldTicket = await storage.getTicket(id);
  if (!oldTicket) return c.json({ error: "Ticket not found" }, 404);

  if (
    user.role !== "admin" &&
    oldTicket.requesterId !== user.userId &&
    oldTicket.assigneeId !== user.userId
  ) {
    return c.json({ error: "Access denied" }, 403);
  }

  const body = await c.req.json();
  let updateData: any = { ...body };

  // Non-admin field restriction
  if (user.role !== "admin") {
    const allowedFields = [
      "status", "title", "description", "attachments",
      "location", "impact", "dueDate",
    ];
    const filteredData: any = {};
    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) filteredData[field] = updateData[field];
    });
    updateData = filteredData;
  }

  // Status transitions
  if (body.status && body.status !== oldTicket.status) {
    const finalAssigneeId = body.assigneeId || oldTicket.assigneeId;
    if (!finalAssigneeId && ["resolved", "closed", "blocked"].includes(body.status)) {
      return c.json(
        {
          error:
            "Não é possível alterar o status para '" +
            (body.status === "resolved"
              ? "Resolvido"
              : body.status === "closed"
                ? "Fechado"
                : "Bloqueado") +
            "' sem um responsável atribuído ao chamado.",
        },
        400
      );
    }
    if (body.status === "resolved" && !oldTicket.dataResolucao) {
      updateData.dataResolucao = new Date();
    }
    if (body.status === "closed" && !oldTicket.dataFechamento) {
      updateData.dataFechamento = new Date();
    }
  }

  if (updateData.descriptionLastEditedAt) {
    updateData.descriptionLastEditedAt = new Date(updateData.descriptionLastEditedAt);
  }

  const ticket = await storage.updateTicket(id, updateData);
  if (!ticket) return c.json({ error: "Ticket not found" }, 404);

  // Status change email + notification
  if (body.status && body.status !== oldTicket.status) {
    const requester = await storage.getUser(ticket.requesterId);
    const assignee = ticket.assigneeId ? await storage.getUser(ticket.assigneeId) : null;
    if (requester) {
      sendTicketStatusChangedEmail(
        env, storage, ticket, oldTicket.status, body.status, requester, assignee || null
      ).catch(console.error);
    }
    const statusLabels: Record<string, string> = {
      open: "Aberto", in_progress: "Em andamento", resolved: "Resolvido",
      closed: "Fechado", pending: "Pendente",
    };
    if (ticket.requesterId) {
      storage.createNotification({
        userId: ticket.requesterId,
        title: "Status do chamado alterado",
        message: `O chamado "${ticket.title}" (${ticket.code || ""}) mudou para "${statusLabels[body.status] || body.status}"`,
        module: "chamados",
        entityId: ticket.id,
        linkUrl: `/chamados?ticket=${ticket.id}`,
      }).catch(console.error);
    }
  }

  // Assignee change email + notification
  if (body.assigneeId && body.assigneeId !== oldTicket.assigneeId) {
    const assignee = await storage.getUser(body.assigneeId);
    if (assignee) {
      sendTicketAssignedEmail(env, storage, ticket, assignee).catch(console.error);
    }
    storage.createNotification({
      userId: body.assigneeId,
      title: "Chamado atribuído a você",
      message: `O chamado "${ticket.title}" (${ticket.code || ""}) foi atribuído a você`,
      module: "chamados",
      entityId: ticket.id,
      linkUrl: `/chamados?ticket=${ticket.id}`,
    }).catch(console.error);
  }

  return c.json(ticket);
});

// DELETE /api/tickets/:id
tickets.delete("/api/tickets/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const ticket = await storage.getTicket(id);
  if (!ticket) return c.json({ error: "Ticket not found" }, 404);
  if (
    user.role !== "admin" &&
    ticket.requesterId !== user.userId &&
    ticket.assigneeId !== user.userId
  ) {
    return c.json({ error: "Access denied" }, 403);
  }
  const deleted = await storage.deleteTicket(id);
  if (!deleted) return c.json({ error: "Ticket not found" }, 404);
  return c.body(null, 204);
});

// GET /api/tickets/:id/comments
tickets.get("/api/tickets/:id/comments", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const ticket = await storage.getTicket(id);
  if (!ticket) return c.json({ error: "Ticket not found" }, 404);
  if (
    user.role !== "admin" &&
    ticket.requesterId !== user.userId &&
    ticket.assigneeId !== user.userId
  ) {
    return c.json({ error: "Access denied" }, 403);
  }
  const comments = await storage.getTicketComments(id);
  return c.json(comments);
});

// POST /api/tickets/:id/comments
tickets.post("/api/tickets/:id/comments", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const env = c.env;
  const id = c.req.param("id");
  const ticket = await storage.getTicket(id);
  if (!ticket) return c.json({ error: "Ticket not found" }, 404);

  if (
    user.role !== "admin" &&
    ticket.requesterId !== user.userId &&
    ticket.assigneeId !== user.userId
  ) {
    return c.json({ error: "Access denied" }, 403);
  }

  const body = await c.req.json();
  const validated = insertTicketCommentSchema.parse({
    ...body,
    ticketId: id,
    userId: user.userId,
  });
  const comment = await storage.createTicketComment(validated);

  // First response tracking
  if (
    ticket.assigneeId &&
    comment.userId === ticket.assigneeId &&
    !ticket.dataPrimeiraResposta
  ) {
    await storage.updateTicket(ticket.id, { dataPrimeiraResposta: new Date() });
  }

  const commenter = await storage.getUser(comment.userId);
  const requester = await storage.getUser(ticket.requesterId);
  const assignee = ticket.assigneeId ? await storage.getUser(ticket.assigneeId) : null;

  // Comment email
  if (commenter && requester) {
    sendTicketCommentEmail(env, storage, ticket, comment, commenter, requester, assignee || null).catch(
      console.error
    );
  }

  // Notifications for requester and assignee
  if (requester && commenter && commenter.id !== requester.id) {
    storage.createNotification({
      userId: requester.id,
      fromUserId: commenter.id,
      title: "Novo comentário no chamado",
      message: `${commenter.name} comentou no chamado "${ticket.title}"`,
      module: "chamados",
      entityId: ticket.id,
      linkUrl: `/chamados?ticket=${ticket.id}`,
    }).catch(console.error);
  }
  if (
    assignee &&
    commenter &&
    commenter.id !== assignee.id &&
    assignee.id !== requester?.id
  ) {
    storage.createNotification({
      userId: assignee.id,
      fromUserId: commenter.id,
      title: "Novo comentário no chamado",
      message: `${commenter.name} comentou no chamado "${ticket.title}"`,
      module: "chamados",
      entityId: ticket.id,
      linkUrl: `/chamados?ticket=${ticket.id}`,
    }).catch(console.error);
  }

  // Mention handling
  const mentionMatches = validated.content.match(/@(\w+(?:\s+\w+)?)/g);
  if (mentionMatches) {
    const users = await storage.getUsers();
    for (const mention of mentionMatches) {
      const mentionedName = mention.slice(1).trim();
      const mentionedUser = users.find(
        (u) =>
          u.name.toLowerCase() === mentionedName.toLowerCase() &&
          u.status === "active"
      );
      if (mentionedUser && commenter) {
        sendMentionNotificationEmail(
          env, storage, mentionedUser, commenter.name, ticket.title, ticket.id, validated.content
        ).catch(console.error);
        storage.createNotification({
          userId: mentionedUser.id,
          fromUserId: commenter.id,
          title: "Menção em chamado",
          message: `${commenter.name} mencionou você em um comentário no chamado "${ticket.title}"`,
          module: "chamados",
          entityId: ticket.id,
          linkUrl: `/chamados?ticket=${ticket.id}`,
        }).catch(console.error);
      }
    }
  }

  return c.json(comment, 201);
});

// ============== TICKET RESPONSÁVEIS ==============

// GET /api/ticket-responsaveis
tickets.get("/api/ticket-responsaveis", async (c) => {
  const storage = getStorage(c.get("db"));
  return c.json(await storage.getTicketResponsaveis());
});

// GET /api/ticket-responsaveis/:id
tickets.get("/api/ticket-responsaveis/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const responsavel = await storage.getTicketResponsavel(c.req.param("id"));
  if (!responsavel) return c.json({ error: "Responsavel not found" }, 404);
  return c.json(responsavel);
});

// POST /api/ticket-responsaveis (admin only)
tickets.post("/api/ticket-responsaveis", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const validated = insertTicketResponsavelSchema.parse(body);
  const responsavel = await storage.createTicketResponsavel(validated);
  return c.json(responsavel, 201);
});

// PATCH /api/ticket-responsaveis/:id (admin only)
tickets.patch("/api/ticket-responsaveis/:id", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const validated = insertTicketResponsavelSchema.partial().parse(body);
  const responsavel = await storage.updateTicketResponsavel(
    c.req.param("id"),
    validated
  );
  if (!responsavel) return c.json({ error: "Responsavel not found" }, 404);
  return c.json(responsavel);
});

// DELETE /api/ticket-responsaveis/:id (admin only)
tickets.delete("/api/ticket-responsaveis/:id", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const deleted = await storage.deleteTicketResponsavel(c.req.param("id"));
  if (!deleted) return c.json({ error: "Responsavel not found" }, 404);
  return c.body(null, 204);
});

// GET /api/ticket-responsaveis/find/:categoria/:tipo
tickets.get("/api/ticket-responsaveis/find/:categoria/:tipo", async (c) => {
  const storage = getStorage(c.get("db"));
  const responsavelId = await storage.findResponsavelForTicket(
    c.req.param("categoria"),
    c.req.param("tipo")
  );
  return c.json({ responsavelId });
});

// ============== CSAT ==============

// GET /api/tickets/csat/analytics (admin only, checked in-route)
tickets.get("/api/tickets/csat/analytics", async (c) => {
  const user = c.get("user");
  if (user.role !== "admin") {
    return c.json({ error: "Apenas administradores podem acessar analytics" }, 403);
  }

  const storage = getStorage(c.get("db"));
  const allTickets = await storage.getTickets();
  const users = await storage.getUsers();

  const ticketsWithCSAT = allTickets.filter(
    (t) => t.satisfactionRating !== null && t.satisfactionRating !== undefined
  );

  const totalTickets = allTickets.filter(
    (t) => t.status === "resolved" || t.status === "closed"
  ).length;
  const totalEvaluations = ticketsWithCSAT.length;
  const evaluationRate =
    totalTickets > 0 ? (totalEvaluations / totalTickets) * 100 : 0;
  const averageRating =
    ticketsWithCSAT.length > 0
      ? ticketsWithCSAT.reduce((sum, t) => sum + (t.satisfactionRating || 0), 0) /
        ticketsWithCSAT.length
      : 0;

  const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: ticketsWithCSAT.filter((t) => t.satisfactionRating === rating).length,
    percentage:
      ticketsWithCSAT.length > 0
        ? (ticketsWithCSAT.filter((t) => t.satisfactionRating === rating).length /
            ticketsWithCSAT.length) *
          100
        : 0,
  }));

  const responsibleStats = users
    .map((u) => {
      const uTickets = ticketsWithCSAT.filter((t) => t.assigneeId === u.id);
      const avg =
        uTickets.length > 0
          ? uTickets.reduce((s, t) => s + (t.satisfactionRating || 0), 0) /
            uTickets.length
          : 0;
      return {
        userId: u.id,
        userName: u.name,
        totalEvaluations: uTickets.length,
        averageRating: Math.round(avg * 10) / 10,
        ratings: [1, 2, 3, 4, 5].map(
          (r) => uTickets.filter((t) => t.satisfactionRating === r).length
        ),
      };
    })
    .filter((s) => s.totalEvaluations > 0)
    .sort((a, b) => b.averageRating - a.averageRating);

  const negativeComments = ticketsWithCSAT
    .filter((t) => (t.satisfactionRating || 0) <= 2 && t.satisfactionComment)
    .map((t) => ({
      ticketId: t.id,
      ticketCode: t.code,
      ticketTitle: t.title,
      rating: t.satisfactionRating,
      comment: t.satisfactionComment,
      createdAt: t.satisfactionCreatedAt,
      assigneeId: t.assigneeId,
    }))
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )
    .slice(0, 10);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentEvaluations = ticketsWithCSAT
    .filter(
      (t) =>
        t.satisfactionCreatedAt &&
        new Date(t.satisfactionCreatedAt) >= thirtyDaysAgo
    )
    .sort(
      (a, b) =>
        new Date(a.satisfactionCreatedAt || 0).getTime() -
        new Date(b.satisfactionCreatedAt || 0).getTime()
    );

  const trendByDay: Record<string, { sum: number; count: number }> = {};
  recentEvaluations.forEach((t) => {
    const day = t.satisfactionCreatedAt
      ? new Date(t.satisfactionCreatedAt).toISOString().split("T")[0]
      : "unknown";
    if (!trendByDay[day]) trendByDay[day] = { sum: 0, count: 0 };
    trendByDay[day].sum += t.satisfactionRating || 0;
    trendByDay[day].count++;
  });
  const trend = Object.entries(trendByDay)
    .map(([date, data]) => ({
      date,
      rating: Math.round((data.sum / data.count) * 10) / 10,
      count: data.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return c.json({
    overview: {
      totalTickets,
      totalEvaluations,
      evaluationRate: Math.round(evaluationRate * 100) / 100,
      averageRating: Math.round(averageRating * 100) / 100,
    },
    ratingDistribution,
    topResponsibles: responsibleStats.slice(0, 5),
    negativeComments,
    trend,
  });
});

// PATCH /api/tickets/:id/satisfaction
tickets.patch("/api/tickets/:id/satisfaction", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const env = c.env;
  const id = c.req.param("id");
  const ticket = await storage.getTicket(id);

  if (!ticket) return c.json({ error: "Ticket not found" }, 404);
  if (ticket.requesterId !== user.userId) {
    return c.json({ error: "Apenas o solicitante pode avaliar este chamado" }, 403);
  }
  if (ticket.status !== "closed" && ticket.status !== "resolved") {
    return c.json(
      { error: "Apenas chamados fechados ou resolvidos podem ser avaliados" },
      400
    );
  }
  if (ticket.satisfactionRating !== null && ticket.satisfactionRating !== undefined) {
    return c.json({ error: "Este chamado já foi avaliado" }, 400);
  }

  const { rating, comment } = await c.req.json();
  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return c.json(
      { error: "Rating deve ser um número inteiro entre 1 e 5" },
      400
    );
  }
  if (comment && comment.length > 500) {
    return c.json(
      { error: "Comentário deve ter no máximo 500 caracteres" },
      400
    );
  }

  const updatedTicket = await storage.updateTicket(id, {
    satisfactionRating: rating,
    satisfactionComment: comment || null,
    satisfactionCreatedAt: new Date(),
  });
  if (!updatedTicket) return c.json({ error: "Ticket not found after update" }, 404);

  // CSAT email to assignee
  if (updatedTicket.assigneeId) {
    const assignee = await storage.getUser(updatedTicket.assigneeId);
    if (assignee) {
      sendCSATReceivedEmail(env, storage, updatedTicket, rating, comment || null, assignee).catch(
        console.error
      );
    }
  }

  // In-app notification
  if (updatedTicket.assigneeId && updatedTicket.assigneeId !== user.userId) {
    const starsText =
      rating === 5 ? "⭐⭐⭐⭐⭐" : rating === 4 ? "⭐⭐⭐⭐" : rating === 3 ? "⭐⭐⭐" : rating === 2 ? "⭐⭐" : "⭐";
    storage.createNotification({
      userId: updatedTicket.assigneeId,
      fromUserId: user.userId,
      title: "Avaliação de chamado recebida",
      message: `Seu atendimento no chamado "${ticket.title}" foi avaliado com ${starsText} (${rating}/5)`,
      module: "chamados",
      entityId: ticket.id,
      linkUrl: `/chamados?ticket=${ticket.id}`,
    }).catch(console.error);
  }

  return c.json(updatedTicket);
});

export { tickets };
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in `worker/src/routes/tickets.ts`

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/tickets.ts
git commit -m "feat(worker): migrate Tickets route to Hono (Phase 2C)"
```

---

### Task 6: GitHub Sync Service (Dependency Injection)

**Files:**
- Create: `worker/src/services/github-sync.ts`

**Context:** Source is `server/services/github-sync.ts` (463 lines). Uses `process.env.GITHUB_TOKEN` and global `storage` import. Must convert to dependency injection pattern: all exported functions receive `deps: GitSyncDeps` as first parameter. Internal helpers (`githubFetch`, `syncCommits`, etc.) also refactored to use `deps`.

- [ ] **Step 1: Create the GitHub sync service**

```typescript
// worker/src/services/github-sync.ts
import type { IStorage } from "../lib/storage";

export interface GitSyncDeps {
  storage: IStorage;
  githubToken: string;
}

const GITHUB_API = "https://api.github.com";

function detectCommitType(message: string): string {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.startsWith("feat") || lowerMessage.includes("feature")) return "feature";
  if (lowerMessage.startsWith("fix") || lowerMessage.includes("bugfix") || lowerMessage.includes("hotfix")) return "bugfix";
  if (lowerMessage.startsWith("docs") || lowerMessage.includes("documentation")) return "docs";
  if (lowerMessage.startsWith("refactor")) return "refactor";
  if (lowerMessage.startsWith("security") || lowerMessage.includes("vulnerab") || lowerMessage.includes("cve")) return "security";
  if (lowerMessage.startsWith("style") || lowerMessage.startsWith("chore") || lowerMessage.startsWith("perf") || lowerMessage.startsWith("improvement")) return "improvement";
  return "improvement";
}

async function githubFetch(endpoint: string, githubToken: string): Promise<any> {
  if (!githubToken) throw new Error("GITHUB_TOKEN não configurado");

  const response = await fetch(`${GITHUB_API}${endpoint}`, {
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Renov-Home-App",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }
  return response.json();
}

async function fetchCommitDetails(
  fullName: string,
  sha: string,
  githubToken: string
): Promise<{ filesChanged: number; additions: number; deletions: number }> {
  try {
    const details = await githubFetch(`/repos/${fullName}/commits/${sha}`, githubToken);
    const stats = details.stats || {};
    if (details.files && Array.isArray(details.files) && !stats.additions && !stats.deletions) {
      let additions = 0;
      let deletions = 0;
      for (const file of details.files) {
        additions += file.additions || 0;
        deletions += file.deletions || 0;
      }
      return { filesChanged: details.files.length, additions, deletions };
    }
    return {
      filesChanged: stats.total || 0,
      additions: stats.additions || 0,
      deletions: stats.deletions || 0,
    };
  } catch (error) {
    console.error(`[GitSync] Error fetching commit details for ${sha}:`, error);
    return { filesChanged: 0, additions: 0, deletions: 0 };
  }
}

async function fetchPRDetails(
  fullName: string,
  prNumber: number,
  githubToken: string
): Promise<{ commitsCount: number; additions: number; deletions: number }> {
  try {
    const files = await githubFetch(`/repos/${fullName}/pulls/${prNumber}/files?per_page=100`, githubToken);
    const commits = await githubFetch(`/repos/${fullName}/pulls/${prNumber}/commits?per_page=100`, githubToken);
    let additions = 0;
    let deletions = 0;
    if (Array.isArray(files)) {
      for (const file of files) {
        additions += file.additions || 0;
        deletions += file.deletions || 0;
      }
    }
    return { commitsCount: Array.isArray(commits) ? commits.length : 0, additions, deletions };
  } catch (error) {
    console.error(`[GitSync] Error fetching PR details for #${prNumber}:`, error);
    return { commitsCount: 0, additions: 0, deletions: 0 };
  }
}

async function syncCommits(
  deps: GitSyncDeps,
  repositoryId: string,
  fullName: string,
  since?: Date,
  until?: Date
): Promise<number> {
  console.log(`Syncing commits for ${fullName}...`);
  let allCommits: any[] = [];
  let page = 1;
  const perPage = 100;
  let hasMore = true;

  while (hasMore) {
    let url = `/repos/${fullName}/commits?per_page=${perPage}&page=${page}`;
    if (since) url += `&since=${since.toISOString()}`;
    if (until) url += `&until=${until.toISOString()}`;
    const commitsPage = await githubFetch(url, deps.githubToken);
    if (!Array.isArray(commitsPage) || commitsPage.length === 0) { hasMore = false; break; }
    allCommits = allCommits.concat(commitsPage);
    if (commitsPage.length < perPage || allCommits.length >= 5000) hasMore = false;
    else page++;
  }

  if (allCommits.length === 0) return 0;

  const commitDataList = [];
  const batchSize = 10;
  for (let i = 0; i < allCommits.length; i += batchSize) {
    const batch = allCommits.slice(i, i + batchSize);
    const batchWithStats = await Promise.all(
      batch.map(async (commit: any) => {
        const stats = await fetchCommitDetails(fullName, commit.sha, deps.githubToken);
        return {
          tenantId: null,
          repositoryId,
          sha: commit.sha,
          message: commit.commit.message.split("\n")[0].substring(0, 255),
          fullMessage: commit.commit.message,
          authorName: commit.commit.author?.name || commit.author?.login || "Unknown",
          authorEmail: commit.commit.author?.email || null,
          authorAvatarUrl: commit.author?.avatar_url || null,
          commitType: detectCommitType(commit.commit.message),
          branch: null,
          prNumber: null,
          filesChanged: stats.filesChanged,
          additions: stats.additions,
          deletions: stats.deletions,
          committedAt: new Date(commit.commit.author?.date || new Date()),
        };
      })
    );
    commitDataList.push(...batchWithStats);
  }

  return deps.storage.createGitCommitsBatch(commitDataList);
}

async function syncPullRequests(deps: GitSyncDeps, repositoryId: string, fullName: string): Promise<number> {
  try {
    const [openPRs, closedPRs] = await Promise.all([
      githubFetch(`/repos/${fullName}/pulls?state=open&per_page=100`, deps.githubToken),
      githubFetch(`/repos/${fullName}/pulls?state=closed&per_page=50&sort=updated&direction=desc`, deps.githubToken),
    ]);
    const allPRs = [...openPRs, ...closedPRs];
    let upserted = 0;
    for (const pr of allPRs) {
      const status = pr.merged_at ? "merged" : pr.state === "closed" ? "closed" : "open";
      const prDetails = await fetchPRDetails(fullName, pr.number, deps.githubToken);
      await deps.storage.upsertGitPullRequest({
        repositoryId,
        githubPrNumber: pr.number,
        title: pr.title,
        description: pr.body || "",
        authorName: pr.user?.login || "Unknown",
        authorAvatarUrl: pr.user?.avatar_url || null,
        status,
        prType: detectCommitType(pr.title),
        sourceBranch: pr.head?.ref || "",
        targetBranch: pr.base?.ref || "",
        commitsCount: prDetails.commitsCount,
        additions: prDetails.additions,
        deletions: prDetails.deletions,
        reviewers: JSON.stringify(pr.requested_reviewers?.map((r: any) => r.login) || []),
        labels: JSON.stringify(pr.labels?.map((l: any) => l.name) || []),
        createdAt: pr.created_at ? new Date(pr.created_at) : null,
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
        closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
      });
      upserted++;
    }
    return upserted;
  } catch (error) {
    console.error(`[GitSync] Error syncing PRs:`, error);
    return 0;
  }
}

async function syncSecurityAlerts(deps: GitSyncDeps, repositoryId: string, fullName: string): Promise<number> {
  try {
    const alerts = await githubFetch(`/repos/${fullName}/dependabot/alerts?state=open&per_page=100`, deps.githubToken);
    let upserted = 0;
    for (const alert of alerts) {
      await deps.storage.upsertGitSecurityAlert({
        repositoryId,
        githubAlertNumber: alert.number,
        title: alert.security_advisory?.summary || "Unknown vulnerability",
        description: alert.security_advisory?.description || "",
        severity: alert.security_advisory?.severity || "medium",
        packageName: alert.security_vulnerability?.package?.name || "unknown",
        packageEcosystem: alert.security_vulnerability?.package?.ecosystem || "",
        vulnerableVersion: alert.security_vulnerability?.vulnerable_version_range || "",
        patchedVersion: alert.security_vulnerability?.first_patched_version?.identifier || null,
        status: alert.state === "dismissed" ? "dismissed" : alert.fixed_at ? "fixed" : "open",
        isDirectDependency: alert.dependency?.scope === "runtime",
        cveId: alert.security_advisory?.cve_id || null,
        ghsaId: alert.security_advisory?.ghsa_id || null,
        createdAt: alert.created_at ? new Date(alert.created_at) : null,
        dismissedAt: alert.dismissed_at ? new Date(alert.dismissed_at) : null,
        fixedAt: alert.fixed_at ? new Date(alert.fixed_at) : null,
      });
      upserted++;
    }
    return upserted;
  } catch (error) {
    console.log(`[GitSync] Could not fetch security alerts (may not be enabled)`);
    return 0;
  }
}

async function syncBranches(deps: GitSyncDeps, repositoryId: string, fullName: string): Promise<number> {
  const branchesData = await githubFetch(`/repos/${fullName}/branches?per_page=100`, deps.githubToken);
  if (!Array.isArray(branchesData)) return 0;

  const openPRs = await githubFetch(`/repos/${fullName}/pulls?state=open&per_page=100`, deps.githubToken);
  const branchesWithPR = new Set(openPRs.map((pr: any) => pr.head.ref));
  const repoInfo = await githubFetch(`/repos/${fullName}`, deps.githubToken);
  const defaultBranch = repoInfo.default_branch || "main";

  let synced = 0;
  for (const branch of branchesData) {
    try {
      let aheadBy = 0;
      let behindBy = 0;
      if (branch.name !== defaultBranch) {
        try {
          const comparison = await githubFetch(`/repos/${fullName}/compare/${defaultBranch}...${branch.name}`, deps.githubToken);
          aheadBy = comparison.ahead_by || 0;
          behindBy = comparison.behind_by || 0;
        } catch { /* ignore */ }
      }

      let lastCommitAt = null;
      let lastCommitAuthor = null;
      try {
        const commits = await githubFetch(`/repos/${fullName}/commits?sha=${branch.name}&per_page=1`, deps.githubToken);
        if (commits.length > 0) {
          lastCommitAt = new Date(commits[0].commit.author?.date);
          lastCommitAuthor = commits[0].commit.author?.name || commits[0].author?.login;
        }
      } catch { /* ignore */ }

      await deps.storage.upsertGitBranch({
        tenantId: null,
        repositoryId,
        name: branch.name,
        sha: branch.commit.sha,
        isDefault: branch.name === defaultBranch,
        isProtected: branch.protected || false,
        aheadBy,
        behindBy,
        hasOpenPR: branchesWithPR.has(branch.name),
        lastCommitAt,
        lastCommitAuthor,
      });
      synced++;
    } catch (error) {
      console.error(`[GitSync] Error syncing branch ${branch.name}:`, error);
    }
  }
  return synced;
}

// ============== EXPORTED FUNCTIONS ==============

export async function syncRepository(deps: GitSyncDeps, repositoryId: string): Promise<void> {
  const repo = await deps.storage.getGitRepository(repositoryId);
  if (!repo) throw new Error(`Repository ${repositoryId} not found`);
  if (!repo.syncEnabled) {
    console.log(`[GitSync] Sync disabled for ${repo.fullName}`);
    return;
  }

  let since: Date | undefined;
  if (repo.lastSyncAt) {
    since = new Date(repo.lastSyncAt);
  } else {
    since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  }

  await Promise.all([
    syncCommits(deps, repositoryId, repo.fullName, since),
    syncPullRequests(deps, repositoryId, repo.fullName),
    syncSecurityAlerts(deps, repositoryId, repo.fullName),
    syncBranches(deps, repositoryId, repo.fullName),
  ]);

  await deps.storage.updateGitRepository(repositoryId, { lastSyncAt: new Date() });
}

export async function syncAllRepositories(deps: GitSyncDeps): Promise<void> {
  const repositories = await deps.storage.getGitRepositories();
  const activeRepos = repositories.filter((r) => r.isActive && r.syncEnabled);
  for (const repo of activeRepos) {
    try {
      await syncRepository(deps, repo.id);
    } catch (error) {
      console.error(`[GitSync] Error syncing ${repo.fullName}:`, error);
    }
  }
}

export async function syncRepositoryByPeriod(
  deps: GitSyncDeps,
  repositoryId: string,
  startDate: Date,
  endDate: Date
): Promise<{ commits: number; prs: number }> {
  const repo = await deps.storage.getGitRepository(repositoryId);
  if (!repo) throw new Error("Repository not found");

  const commits = await syncCommits(deps, repositoryId, repo.fullName, startDate, endDate);
  const prs = await syncPullRequests(deps, repositoryId, repo.fullName);
  await deps.storage.updateGitRepository(repositoryId, { lastSyncAt: new Date() });
  return { commits, prs };
}

export async function addRepository(deps: GitSyncDeps, fullName: string): Promise<any> {
  const repoInfo = await githubFetch(`/repos/${fullName}`, deps.githubToken);
  const existing = await deps.storage.getGitRepositoryByFullName(fullName);
  if (existing) return existing;

  const repo = await deps.storage.createGitRepository({
    githubId: repoInfo.id,
    name: repoInfo.name,
    fullName: repoInfo.full_name,
    owner: repoInfo.owner.login,
    defaultBranch: repoInfo.default_branch || "main",
    isActive: true,
    syncEnabled: true,
  });

  await syncRepository(deps, repo.id);
  return repo;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in `worker/src/services/github-sync.ts`

- [ ] **Step 3: Commit**

```bash
git add worker/src/services/github-sync.ts
git commit -m "feat(worker): add GitHub sync service with dependency injection (Phase 2C)"
```

---

### Task 7: GitHub Webhook Signature Validation

**Files:**
- Create: `worker/src/lib/github-webhook.ts`

**Context:** New utility — validates `X-Hub-Signature-256` header using Web Crypto API. Used by the git-analytics route's webhook endpoint.

- [ ] **Step 1: Create the webhook validation utility**

```typescript
// worker/src/lib/github-webhook.ts

/**
 * Validates GitHub webhook signatures using Web Crypto API.
 * Compares the X-Hub-Signature-256 header with HMAC SHA-256 of the payload.
 */
export async function verifyGitHubWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!signature || !signature.startsWith("sha256=")) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );

  const expectedSignature =
    "sha256=" +
    Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  // Constant-time comparison
  if (expectedSignature.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expectedSignature.length; i++) {
    result |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add worker/src/lib/github-webhook.ts
git commit -m "feat(worker): add GitHub webhook signature validation (Phase 2C)"
```

---

### Task 8: Git Analytics Route

**Files:**
- Create: `worker/src/routes/git-analytics.ts`

**Context:** Source is `server/routes/git-analytics.ts` (525 lines, 22 endpoints). Uses `github-sync.ts` service (dependency-injected), `openrouter-keys.ts` config (direct import from `server/config/`), `github-webhook.ts` for webhook validation. `process.env` references must become `c.env`. `claude-code-usage` endpoint auth is handled by `SECRET_AUTH_ROUTES` in auth middleware.

- [ ] **Step 1: Create the Git Analytics route file**

```typescript
// worker/src/routes/git-analytics.ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { verifyGitHubWebhookSignature } from "../lib/github-webhook";
import {
  syncRepository,
  syncAllRepositories,
  syncRepositoryByPeriod,
  addRepository,
} from "../services/github-sync";
import { insertGitRepositorySchema } from "@shared/schema";

const gitAnalytics = new Hono<AppEnv>();

// Helper to build GitSyncDeps from Hono context
function getSyncDeps(c: any) {
  return {
    storage: getStorage(c.get("db")),
    githubToken: c.env.GITHUB_TOKEN,
  };
}

// ============== REPOSITORIES ==============

gitAnalytics.get("/api/git-analytics/repositories", async (c) => {
  const storage = getStorage(c.get("db"));
  return c.json(await storage.getGitRepositories());
});

gitAnalytics.get("/api/git-analytics/repositories/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const repo = await storage.getGitRepository(c.req.param("id"));
  if (!repo) return c.json({ error: "Repositório não encontrado" }, 404);
  return c.json(repo);
});

gitAnalytics.post("/api/git-analytics/repositories", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const data = insertGitRepositorySchema.parse(body);
  const repo = await storage.createGitRepository(data);
  return c.json(repo, 201);
});

gitAnalytics.put("/api/git-analytics/repositories/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const updated = await storage.updateGitRepository(c.req.param("id"), body);
  if (!updated) return c.json({ error: "Repositório não encontrado" }, 404);
  return c.json(updated);
});

gitAnalytics.delete("/api/git-analytics/repositories/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const deleted = await storage.deleteGitRepository(c.req.param("id"));
  return c.json({ success: deleted });
});

// ============== COMMITS ==============

gitAnalytics.get("/api/git-analytics/commits", async (c) => {
  const storage = getStorage(c.get("db"));
  const { repositoryId, authorName, commitType, branch, startDate, endDate, limit, offset } = c.req.query() as Record<string, string>;

  const commits = await storage.getGitCommits({
    repositoryId,
    authorName,
    commitType,
    branch,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    limit: limit ? parseInt(limit) : 50,
    offset: offset ? parseInt(offset) : 0,
  });
  const total = await storage.countGitCommits({
    repositoryId,
    authorName,
    commitType,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  });
  return c.json({ commits, total });
});

// ============== PULL REQUESTS ==============

gitAnalytics.get("/api/git-analytics/pull-requests", async (c) => {
  const storage = getStorage(c.get("db"));
  const { repositoryId, authorName, status, prType, startDate, endDate, limit, offset } = c.req.query() as Record<string, string>;

  const pullRequests = await storage.getGitPullRequests({
    repositoryId,
    authorName,
    status,
    prType,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    limit: limit ? parseInt(limit) : 50,
    offset: offset ? parseInt(offset) : 0,
  });
  const total = await storage.countGitPullRequests({
    repositoryId,
    status,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  });
  return c.json({ pullRequests, total });
});

// ============== SECURITY ALERTS ==============

gitAnalytics.get("/api/git-analytics/security-alerts", async (c) => {
  const storage = getStorage(c.get("db"));
  const { repositoryId, severity, status } = c.req.query() as Record<string, string>;
  const alerts = await storage.getGitSecurityAlerts({ repositoryId, severity, status });
  return c.json(alerts);
});

// ============== BRANCHES ==============

gitAnalytics.get("/api/git-analytics/pending-branches", async (c) => {
  const storage = getStorage(c.get("db"));
  const repositoryId = c.req.query("repositoryId");
  return c.json(await storage.getPendingBranches(repositoryId as string));
});

gitAnalytics.get("/api/git-analytics/branches", async (c) => {
  const storage = getStorage(c.get("db"));
  const repositoryId = c.req.query("repositoryId");
  return c.json(await storage.getGitBranches(repositoryId as string));
});

// ============== STATS & CHARTS ==============

gitAnalytics.get("/api/git-analytics/stats", async (c) => {
  const storage = getStorage(c.get("db"));
  const { repositoryId, startDate, endDate, authorName } = c.req.query() as Record<string, string>;
  const stats = await storage.getGitAnalyticsStats({
    repositoryId,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    authorName,
  });
  return c.json(stats);
});

gitAnalytics.get("/api/git-analytics/developer-stats", async (c) => {
  const storage = getStorage(c.get("db"));
  const { repositoryId, startDate, endDate, authorName } = c.req.query() as Record<string, string>;
  const stats = await storage.getGitDeveloperStats({
    repositoryId,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    authorName,
  });
  return c.json(stats);
});

gitAnalytics.get("/api/git-analytics/commits-by-day", async (c) => {
  const storage = getStorage(c.get("db"));
  const { repositoryId, startDate, endDate } = c.req.query() as Record<string, string>;
  return c.json(await storage.getGitCommitsByDay({
    repositoryId,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  }));
});

gitAnalytics.get("/api/git-analytics/prs-by-day", async (c) => {
  const storage = getStorage(c.get("db"));
  const { repositoryId, startDate, endDate } = c.req.query() as Record<string, string>;
  return c.json(await storage.getGitPRsByDay({
    repositoryId,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  }));
});

gitAnalytics.get("/api/git-analytics/commits-by-month", async (c) => {
  const storage = getStorage(c.get("db"));
  const { repositoryId, startDate, endDate } = c.req.query() as Record<string, string>;
  return c.json(await storage.getGitCommitsByMonth({
    repositoryId,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  }));
});

gitAnalytics.get("/api/git-analytics/prs-by-month", async (c) => {
  const storage = getStorage(c.get("db"));
  const { repositoryId, startDate, endDate } = c.req.query() as Record<string, string>;
  return c.json(await storage.getGitPRsByMonth({
    repositoryId,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  }));
});

// ============== DEVELOPER TOKENS (OpenRouter + Claude Code) ==============

gitAnalytics.get("/api/git-analytics/developer-tokens", async (c) => {
  const storage = getStorage(c.get("db"));
  const { startDate: startDateStr, endDate: endDateStr } = c.req.query() as Record<string, string>;

  const now = new Date();
  const startDate = startDateStr ? new Date(startDateStr) : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = endDateStr ? new Date(endDateStr) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Import pure data module
  const { DEVELOPER_KEYS, getAllDevelopers } = await import("../../../server/config/openrouter-keys");

  // Claude Code usage from DB
  const claudeRows = await storage.getClaudeCodeUsageByPeriod(startDate, endDate);
  const claudeByDev: Record<string, { tokens: number; spend: number; keysCount: number }> = {};
  for (const row of claudeRows) {
    if (!claudeByDev[row.developerName]) {
      claudeByDev[row.developerName] = { tokens: 0, spend: 0, keysCount: 1 };
    }
    claudeByDev[row.developerName].tokens += row.totalTokens;
    claudeByDev[row.developerName].spend += (row.totalTokens / 1_000_000) * 9;
  }

  const allDevelopers = Array.from(
    new Set([...getAllDevelopers(), ...Object.keys(claudeByDev)])
  );

  const tokenUsage = await Promise.all(
    allDevelopers.map(async (developerName) => {
      const orKeys = DEVELOPER_KEYS[developerName] || [];
      let openrouterTokens = 0;
      let openrouterSpend = 0;
      let openrouterRequests = 0;

      for (const key of orKeys) {
        try {
          const statsResponse = await fetch("https://openrouter.ai/api/v1/auth/key", {
            headers: { Authorization: `Bearer ${key.apiKey}` },
          });
          if (statsResponse.ok) {
            const statsData = await statsResponse.json() as any;
            const usageMonthly = statsData.data?.usage_monthly || 0;
            openrouterTokens += Math.round(usageMonthly * 1000000);
            openrouterSpend += usageMonthly;
            openrouterRequests += 1;
          }
        } catch (error) {
          console.error(`Error fetching OpenRouter usage for ${key.keyName}:`, error);
        }
      }

      const claude = claudeByDev[developerName] || { tokens: 0, spend: 0, keysCount: 0 };
      return {
        developerName,
        totalTokens: openrouterTokens + claude.tokens,
        totalRequests: openrouterRequests + (claude.tokens > 0 ? 1 : 0),
        totalSpend: openrouterSpend + claude.spend,
        keysCount: orKeys.length + claude.keysCount,
        openrouterTokens,
        openrouterSpend,
        openrouterKeysCount: orKeys.length,
        anthropicTokens: claude.tokens,
        anthropicSpend: claude.spend,
        anthropicKeysCount: claude.keysCount,
      };
    })
  );

  return c.json(tokenUsage.sort((a, b) => b.totalTokens - a.totalTokens));
});

// ============== SYNC ==============

gitAnalytics.post("/api/git-analytics/sync", async (c) => {
  const deps = getSyncDeps(c);
  const body = await c.req.json();
  const repositoryId = body?.repositoryId || null;

  if (repositoryId) {
    await syncRepository(deps, repositoryId);
    return c.json({ success: true, message: "Repositório sincronizado com sucesso" });
  }
  await syncAllRepositories(deps);
  return c.json({ success: true, message: "Todos os repositórios sincronizados com sucesso" });
});

gitAnalytics.post("/api/git-analytics/sync-period", async (c) => {
  const deps = getSyncDeps(c);
  const { repositoryId, startDate, endDate } = await c.req.json();

  if (!startDate || !endDate) {
    return c.json({ error: "startDate e endDate são obrigatórios" }, 400);
  }

  if (repositoryId) {
    const result = await syncRepositoryByPeriod(deps, repositoryId, new Date(startDate), new Date(endDate));
    return c.json({ success: true, ...result });
  }

  const storage = getStorage(c.get("db"));
  const repos = await storage.getGitRepositories();
  let totalCommits = 0;
  let totalPRs = 0;
  for (const repo of repos) {
    if (repo.syncEnabled) {
      const result = await syncRepositoryByPeriod(deps, repo.id, new Date(startDate), new Date(endDate));
      totalCommits += result.commits;
      totalPRs += result.prs;
    }
  }
  return c.json({ success: true, commits: totalCommits, prs: totalPRs });
});

gitAnalytics.post("/api/git-analytics/add-repository", async (c) => {
  const deps = getSyncDeps(c);
  const { fullName } = await c.req.json();
  if (!fullName) {
    return c.json({ error: "fullName é obrigatório (ex: Renov-BD/Renov.Home)" }, 400);
  }
  const repo = await addRepository(deps, fullName);
  return c.json(repo, 201);
});

// ============== SYNC STATUS ==============

gitAnalytics.get("/api/git-analytics/sync-status", async (c) => {
  const storage = getStorage(c.get("db"));
  const hasToken = !!c.env.GITHUB_TOKEN;
  const repositories = await storage.getGitRepositories();
  const activeRepos = repositories.filter((r) => r.isActive && r.syncEnabled);

  let lastSyncRepo = null as any;
  let lastSyncTime = null as number | null;
  for (const repo of repositories) {
    if (repo.lastSyncAt) {
      const syncTime = new Date(repo.lastSyncAt).getTime();
      if (!lastSyncTime || syncTime > lastSyncTime) {
        lastSyncTime = syncTime;
        lastSyncRepo = repo;
      }
    }
  }

  return c.json({
    hasGitHubToken: hasToken,
    tokenPreview: hasToken ? `${c.env.GITHUB_TOKEN.substring(0, 8)}...` : null,
    totalRepositories: repositories.length,
    activeRepositories: activeRepos.length,
    lastSync: lastSyncRepo
      ? { repository: lastSyncRepo.fullName, lastSyncAt: lastSyncRepo.lastSyncAt }
      : null,
    environment: "production",
  });
});

// ============== CLAUDE CODE USAGE (secret auth — handled by middleware) ==============

gitAnalytics.post("/api/git-analytics/claude-code-usage", async (c) => {
  const storage = getStorage(c.get("db"));
  const bodySchema = z.object({
    developerName: z.string().min(1),
    reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    inputTokens: z.number().int().min(0),
    outputTokens: z.number().int().min(0),
    cacheCreationTokens: z.number().int().min(0),
    cacheReadTokens: z.number().int().min(0),
    totalTokens: z.number().int().min(0),
    sourceMachine: z.string().optional(),
  });

  const body = bodySchema.parse(await c.req.json());
  const report = await storage.upsertClaudeCodeUsage(body);
  console.log(`[claude-usage] ${body.developerName} @ ${body.reportDate}: ${body.totalTokens.toLocaleString()} tokens`);
  return c.json({ ok: true, report });
});

// ============== GITHUB WEBHOOK (public — signature validated in-route) ==============

gitAnalytics.post("/api/git-analytics/github-webhook", async (c) => {
  const signature = c.req.header("X-Hub-Signature-256") || "";
  const rawBody = await c.req.text();

  const webhookSecret = c.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return c.json({ error: "Webhook secret not configured" }, 500);
  }

  const isValid = await verifyGitHubWebhookSignature(rawBody, signature, webhookSecret);
  if (!isValid) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const event = c.req.header("X-GitHub-Event");
  const payload = JSON.parse(rawBody);

  if (event === "push") {
    const fullName = payload.repository?.full_name;
    if (fullName) {
      const deps = getSyncDeps(c);
      const storage = getStorage(c.get("db"));
      const repo = await storage.getGitRepositoryByFullName(fullName);
      if (repo && repo.syncEnabled) {
        // Fire-and-forget sync
        syncRepository(deps, repo.id).catch((err) =>
          console.error(`[Webhook] Sync failed for ${fullName}:`, err)
        );
      }
    }
  }

  return c.json({ ok: true, event });
});

export { gitAnalytics };
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in `worker/src/routes/git-analytics.ts`

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/git-analytics.ts
git commit -m "feat(worker): migrate Git Analytics route to Hono (Phase 2C)"
```

---

### Task 9: Wire Up — Modify index.ts and auth.ts

**Files:**
- Modify: `worker/src/index.ts` — add imports, mount routes, add `GITHUB_WEBHOOK_SECRET` binding
- Modify: `worker/src/middleware/auth.ts` — add public routes for integrations and webhook

- [ ] **Step 1: Update Bindings type in index.ts**

Add `GITHUB_WEBHOOK_SECRET: string;` to the `Bindings` type after `GITHUB_TOKEN`:

```typescript
// In worker/src/index.ts, add to Bindings type:
GITHUB_WEBHOOK_SECRET: string;
```

- [ ] **Step 2: Add route imports in index.ts**

Add these imports after the existing route imports (after `import { ai } from "./routes/ai";`):

```typescript
import { okrs } from "./routes/okrs";
import { metas } from "./routes/metas";
import { knowledge } from "./routes/knowledge";
import { integrations } from "./routes/integrations";
import { tickets } from "./routes/tickets";
import { gitAnalytics } from "./routes/git-analytics";
```

- [ ] **Step 3: Mount routes in index.ts**

Add route mounts after the existing `app.route("/", ai);` line:

```typescript
app.route("/", okrs);
app.route("/", metas);
app.route("/", knowledge);
app.route("/", integrations);
app.route("/", tickets);
app.route("/", gitAnalytics);
```

- [ ] **Step 4: Add public routes in auth.ts**

Add these entries to the `PUBLIC_ROUTES` array in `worker/src/middleware/auth.ts`, after the existing Phase 2B entries:

```typescript
// Phase 2C public routes — Integrations (all public proxy endpoints)
{ method: "POST", path: "/api/integrations/relatorio-pedidos/test-connection" },
{ method: "GET", path: "/api/integrations/relatorio-pedidos/orders/advanced" },
{ method: "POST", path: "/api/logistica-reversa/eventos" },
{ method: "GET", path: /^\/api\/avaliacoes-ia\// },
{ method: "GET", path: "/api/estoques" },
// Phase 2C public routes — GitHub webhook (signature validated in-route)
{ method: "POST", path: "/api/git-analytics/github-webhook" },
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add worker/src/index.ts worker/src/middleware/auth.ts
git commit -m "feat(worker): wire up Phase 2C routes in index.ts and auth middleware"
```

---

### Task 10: Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit --pretty`
Expected: Clean compilation with no errors in any `worker/src/` files

- [ ] **Step 2: Run Wrangler build (if available)**

Run: `cd worker && npx wrangler deploy --dry-run 2>&1 | tail -20`
Expected: Build succeeds (dry-run, no actual deploy)

- [ ] **Step 3: Verify all files exist**

Run: `ls -la worker/src/routes/okrs.ts worker/src/routes/metas.ts worker/src/routes/knowledge.ts worker/src/routes/integrations.ts worker/src/routes/tickets.ts worker/src/routes/git-analytics.ts worker/src/services/github-sync.ts worker/src/lib/github-webhook.ts`
Expected: All 8 files exist

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
# Only if previous steps required fixes
git add -A worker/src/
git commit -m "fix(worker): resolve Phase 2C build issues"
```
