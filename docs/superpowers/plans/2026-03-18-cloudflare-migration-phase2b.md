# Cloudflare Migration Phase 2B — Simple Routes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate 9 Express routes (40 handlers) and 3 supporting AI services to Hono Workers, completing the "simple routes" sub-phase of the Cloudflare migration.

**Architecture:** Each Express route translates to a Hono route file. Business logic is preserved via `getStorage(c.get("db"))` factory calls to reuse the existing `DatabaseStorage` class (~269 methods). Services that use `process.env` are refactored to receive `env` from Hono context. SSE streaming uses the Web Streams API (`ReadableStream`).

**Tech Stack:** Hono, Drizzle ORM, Zod, SendPulse (email, from Phase 2A), bwip-js (barcode), OpenRouter API, Firecrawl API, Open-Meteo API

**Spec:** `docs/superpowers/specs/2026-03-17-cloudflare-migration-phase2-design.md`

**Branch:** `feat/cloudflare-migration-phase2b` (from `develop`)

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `worker/src/lib/storage.ts` | Re-export `getStorage` + `IStorage` from `server/storage.ts` for Worker consumption |
| `worker/src/routes/notifications.ts` | 8 handlers — CRUD notifications + preferences |
| `worker/src/routes/slas.ts` | 5 handlers — CRUD SLA rules |
| `worker/src/routes/updates.ts` | 4 handlers — CRUD changelog |
| `worker/src/routes/flowcharts.ts` | 6 handlers — CRUD flowcharts + permission checks |
| `worker/src/routes/cep.ts` | 2 handlers — ViaCEP + Correios coverage check |
| `worker/src/routes/users.ts` | 5 handlers — CRUD users + SendPulse email |
| `worker/src/routes/labels.ts` | 3 handlers — barcode generation (bwip-js) |
| `worker/src/routes/dev-tools.ts` | 2 handlers — SQL proxy + file export stream |
| `worker/src/services/external-data.ts` | Weather data via Open-Meteo (pure functions, no secrets) |
| `worker/src/services/firecrawl.service.ts` | Firecrawl pricing scraper (factory, receives `env`) |
| `worker/src/services/openrouter.ts` | OpenRouter chat/title/models (factory, receives `storage` + `env`) |
| `worker/src/routes/ai.ts` | 4 handlers — SSE chat, title, firecrawl test, models |

**Modify:**

| File | Change |
|---|---|
| `worker/src/index.ts` | Mount 9 new routes |
| `worker/src/middleware/auth.ts` | Add public routes (SLAs GET, updates GET, CEP, labels POST) |
| `worker/wrangler.toml` | Add `DEV_TOOLS_TOKEN` as Cloudflare secret (not var) |
| `worker/package.json` | Add `bwip-js` dependency |

---

## Chunk 1: Storage Integration

### Task 1: Create Worker storage bridge

Creates a type-safe bridge that wraps `getStorage` from `server/storage.ts`, casting the Worker's `Database` type (neon-http driver) to the server's `Database` type (node-postgres driver). Both are Drizzle ORM instances with identical query APIs, but TypeScript considers them incompatible types.

**Files:**
- Create: `worker/src/lib/storage.ts`

- [ ] **Step 1: Create the storage bridge file**

```typescript
// worker/src/lib/storage.ts
//
// Bridge: re-exports getStorage from server/storage.ts with type cast.
// The server's Database type (drizzle-orm/node-postgres) differs from
// the Worker's Database type (drizzle-orm/neon-http) at the TS level,
// but both expose identical Drizzle query APIs at runtime.
//
import { getStorage as _getStorage } from "../../../server/storage";
import type { IStorage } from "../../../server/storage";
import type { Database } from "./db";

export function getStorage(db: Database): IStorage {
  return _getStorage(db as any);
}

export type { IStorage };
```

- [ ] **Step 2: Verify the Worker bundles successfully**

Run: `cd worker && npx wrangler deploy --dry-run --outdir=dist-test 2>&1 | tail -20`

Expected: Bundle succeeds. The `server/storage.ts` imports `server/db.ts` which imports `pg` (node-postgres). With `nodejs_compat` enabled, `pg` should be resolvable. The `pg.Pool` constructor in `server/db.ts` runs at module init but is behind a `process.env.DATABASE_URL` guard — in Workers, this binding IS set, so the Pool will be created but never used (the factory pattern injects the Worker's neon-http db instead).

**If bundle fails on `pg` resolution:** Install `pg` in the Worker:
```bash
cd worker && npm install --save-dev pg @types/pg
```

**If bundle succeeds but Pool creation at module init causes runtime errors:** Add `pg` to esbuild externals. Create `worker/build.mjs`:
```javascript
// worker/build.mjs — only needed if pg causes runtime errors
import { build } from "esbuild";
build({ entryPoints: ["src/index.ts"], bundle: true, outdir: "dist", format: "esm", external: ["pg"] });
```
And update `wrangler.toml`:
```toml
[build]
command = "node build.mjs"
```

**Last resort fallback:** Replace the bridge with direct `DatabaseStorage` instantiation — each route does `import { DatabaseStorage } from "../../../server/storage"` and calls `new DatabaseStorage(c.get("db") as any)`.

- [ ] **Step 3: Clean up test output and commit**

```bash
rm -rf worker/dist-test
git add worker/src/lib/storage.ts
git commit -m "feat(worker): add storage bridge with Database type cast"
```

---

## Chunk 2: Pure CRUD Routes

### Task 2: Migrate notifications route (8 handlers)

**Files:**
- Create: `worker/src/routes/notifications.ts`

**Storage methods used:** `getNotificationPreferences`, `updateNotificationPreferences`, `markAllNotificationsRead`, `markNotificationRead`, `getUnreadNotificationCount`, `deleteNotification`, `getNotifications`, `clearNotifications`

- [ ] **Step 1: Create the notifications route file**

```typescript
// worker/src/routes/notifications.ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";

const notifications = new Hono<AppEnv>();

// GET /api/notifications/preferences
notifications.get("/api/notifications/preferences", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const preferences = await storage.getNotificationPreferences(user.userId);
  return c.json(preferences);
});

// PUT /api/notifications/preferences
notifications.put("/api/notifications/preferences", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const { emailNotificationsEnabled, pushNotificationsEnabled, emailPreferences } =
    await c.req.json();
  const preferences = await storage.updateNotificationPreferences(
    user.userId,
    emailNotificationsEnabled,
    pushNotificationsEnabled,
    emailPreferences,
  );
  return c.json(preferences);
});

// PUT /api/notifications/read-all
notifications.put("/api/notifications/read-all", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  await storage.markAllNotificationsRead(user.userId);
  return c.body(null, 204);
});

// PUT /api/notifications/:id/read
notifications.put("/api/notifications/:id/read", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  await storage.markNotificationRead(id, user.userId);
  return c.body(null, 204);
});

// GET /api/notifications/unread/count
notifications.get("/api/notifications/unread/count", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const count = await storage.getUnreadNotificationCount(user.userId);
  return c.json({ count });
});

// DELETE /api/notifications/:id
notifications.delete("/api/notifications/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  await storage.deleteNotification(id, user.userId);
  return c.body(null, 204);
});

// GET /api/notifications
notifications.get("/api/notifications", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const { limit, offset } = z
    .object({
      limit: z.coerce.number().int().min(1).max(100).default(10),
      offset: z.coerce.number().int().min(0).default(0),
    })
    .parse(c.req.query());
  const result = await storage.getNotifications(user.userId, limit, offset);
  return c.json(result);
});

// DELETE /api/notifications (clear all)
notifications.delete("/api/notifications", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  await storage.clearNotifications(user.userId);
  return c.body(null, 204);
});

export { notifications };
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/routes/notifications.ts
git commit -m "feat(worker): migrate notifications route (8 handlers)"
```

---

### Task 3: Migrate SLAs route (5 handlers)

**Files:**
- Create: `worker/src/routes/slas.ts`

**Storage methods used:** `getSlaRules`, `getSlaRule`, `createSlaRule`, `getSlaRuleByTipoAndPrioridade`, `updateSlaRule`, `deleteSlaRule`

**Note:** GET endpoints are public (no auth). POST/PUT/DELETE require admin.

- [ ] **Step 1: Create the SLAs route file**

```typescript
// worker/src/routes/slas.ts
import { Hono } from "hono";
import { z } from "zod";
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
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/routes/slas.ts
git commit -m "feat(worker): migrate SLAs route (5 handlers)"
```

---

### Task 4: Migrate updates/changelog route (4 handlers)

**Files:**
- Create: `worker/src/routes/updates.ts`

**Storage methods used:** `getUpdates`, `createUpdate`, `updateUpdate`, `deleteUpdate`

**Note:** GET is public. POST/PUT/DELETE require admin.

- [ ] **Step 1: Create the updates route file**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/routes/updates.ts
git commit -m "feat(worker): migrate updates/changelog route (4 handlers)"
```

---

### Task 5: Migrate flowcharts route (6 handlers)

**Files:**
- Create: `worker/src/routes/flowcharts.ts`

**Storage methods used:** `getFlowcharts`, `getFlowchartTemplates`, `getFlowchart`, `createFlowchart`, `updateFlowchart`, `deleteFlowchart`

**Note:** All endpoints require auth. Owner-based permission checks for edit/delete.

- [ ] **Step 1: Create the flowcharts route file**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/routes/flowcharts.ts
git commit -m "feat(worker): migrate flowcharts route (6 handlers)"
```

---

## Chunk 3: External API Routes

### Task 6: Migrate CEP route (2 handlers)

**Files:**
- Create: `worker/src/routes/cep.ts`

**Note:** Both endpoints are public (no auth, no storage). Pure `fetch()` passthrough to ViaCEP and Correios APIs.

- [ ] **Step 1: Create the CEP route file**

```typescript
// worker/src/routes/cep.ts
import { Hono } from "hono";
import type { AppEnv } from "../index";

const cep = new Hono<AppEnv>();

// GET /api/cep/:cep (public)
cep.get("/api/cep/:cep", async (c) => {
  const cepNum = c.req.param("cep").replace(/\D/g, "");
  const response = await fetch(`https://viacep.com.br/ws/${cepNum}/json/`);
  const data: any = await response.json();

  if (data.erro) {
    return c.json({ error: "CEP not found" }, 404);
  }

  return c.json({
    cep: data.cep,
    logradouro: data.logradouro,
    bairro: data.bairro,
    cidade: data.localidade,
    uf: data.uf,
    ddd: data.ddd,
  });
});

// GET /api/cep/:cep/cobertura (public)
cep.get("/api/cep/:cep/cobertura", async (c) => {
  const cepNum = c.req.param("cep").replace(/\D/g, "");
  if (cepNum.length !== 8) {
    return c.json({ coberto: false, erro: "CEP deve ter 8 dígitos" }, 400);
  }

  const viacepResponse = await fetch(`https://viacep.com.br/ws/${cepNum}/json/`);
  const viacepData: any = await viacepResponse.json();

  if (viacepData.erro) {
    return c.json({ coberto: false, erro: "CEP não encontrado. Verifique o número informado." });
  }

  const cepDestino = "04575020";

  try {
    const correiosCalcUrl = `http://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx?nCdEmpresa=&sDsSenha=&nCdServico=04510&sCepOrigem=${cepNum}&sCepDestino=${cepDestino}&nVlPeso=1&nCdFormato=1&nVlComprimento=20&nVlAltura=10&nVlLargura=15&nVlDiametro=0&sCdMaoPropria=N&nVlValorDeclarado=0&sCdAvisoRecebimento=N&StrRetorno=xml`;

    const correiosResponse = await fetch(correiosCalcUrl, {
      signal: AbortSignal.timeout(8000),
    });

    if (correiosResponse.ok) {
      const xmlText = await correiosResponse.text();

      const hasError =
        xmlText.includes("<Erro>") &&
        !xmlText.includes("<Erro>0</Erro>") &&
        !xmlText.includes("<Erro></Erro>");
      const errorMatch = xmlText.match(/<MsgErro>(.*?)<\/MsgErro>/);
      const cepNotCovered =
        errorMatch?.[1]?.toLowerCase().includes("não atend") ||
        errorMatch?.[1]?.toLowerCase().includes("localidade") ||
        (xmlText.includes("CEP de origem") && xmlText.includes("inválido"));

      if (hasError && cepNotCovered) {
        return c.json({
          coberto: false,
          erro: `CEP ${cepNum} não possui cobertura dos Correios para serviços de entrega/coleta. ${errorMatch?.[1] || ""}`.trim(),
        });
      }
    }
  } catch {
    console.log("CEP coverage calc check unavailable, falling back to ViaCEP validation");
  }

  return c.json({
    coberto: true,
    cidade: viacepData.localidade,
    uf: viacepData.uf,
    mensagem: `CEP ${cepNum} está na área de cobertura dos Correios.`,
  });
});

export { cep };
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/routes/cep.ts
git commit -m "feat(worker): migrate CEP route (2 handlers)"
```

---

### Task 7: Migrate users route (5 handlers)

**Files:**
- Create: `worker/src/routes/users.ts`

**Storage methods used:** `getUsers`, `getUser`, `createUser`, `updateUser`

**Email:** Uses `sendWelcomeEmail` and `sendPasswordResetEmail` from `worker/src/lib/email.ts` (created in Phase 2A).

**Note:** GET /api/users requires auth; all others require admin.

- [ ] **Step 1: Create the users route file**

```typescript
// worker/src/routes/users.ts
import { Hono } from "hono";
import { z } from "zod";
import { insertUserSchema } from "../../../shared/schema";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../lib/email";

const users = new Hono<AppEnv>();

// GET /api/users (auth)
users.get("/api/users", async (c) => {
  const storage = getStorage(c.get("db"));
  const allUsers = await storage.getUsers();
  allUsers.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const safeUsers = allUsers.map(({ password, ...user }) => user);
  return c.json(safeUsers);
});

// GET /api/users/:id (admin)
users.get("/api/users/:id", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const user = await storage.getUser(c.req.param("id"));
  if (!user) return c.json({ error: "User not found" }, 404);
  const { password, ...safeUser } = user;
  return c.json(safeUser);
});

// POST /api/users (admin)
users.post("/api/users", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const validated = insertUserSchema.parse(await c.req.json());
  const user = await storage.createUser(validated);

  if (validated.password) {
    const emailResult = await sendWelcomeEmail(c.env, user, validated.password);
    if (!emailResult.success) {
      console.error("Failed to send welcome email:", emailResult.error);
    }
  }

  return c.json(user, 201);
});

// PATCH /api/users/:id (admin)
users.patch("/api/users/:id", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const validated = insertUserSchema.partial().parse(await c.req.json());
  const user = await storage.updateUser(c.req.param("id"), validated);
  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json(user);
});

// POST /api/users/:id/reset-password (admin)
users.post("/api/users/:id/reset-password", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const user = await storage.getUser(c.req.param("id"));
  if (!user) return c.json({ error: "User not found" }, 404);

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let temporaryPassword = "";
  for (let i = 0; i < 8; i++) {
    temporaryPassword += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  await storage.updateUser(user.id, { password: temporaryPassword });

  try {
    await sendPasswordResetEmail(c.env, user, temporaryPassword);
  } catch (emailError) {
    console.error("[users] Failed to send password reset email:", emailError);
  }

  return c.json({ success: true, temporaryPassword });
});

export { users };
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/routes/users.ts
git commit -m "feat(worker): migrate users route (5 handlers, SendPulse email)"
```

---

## Chunk 4: Specialized Routes

### Task 8: Migrate labels route (3 handlers, bwip-js)

**Files:**
- Create: `worker/src/routes/labels.ts`
- Modify: `worker/package.json` — add `bwip-js` dependency

**Note:** All endpoints are public. Uses `bwip-js` for Code128 barcode generation. With `nodejs_compat` enabled in wrangler.toml, `bwip-js` should work since it uses `Buffer` and canvas-like operations that are supported.

- [ ] **Step 1: Add bwip-js dependency**

Run: `cd worker && npm install bwip-js`

- [ ] **Step 2: Create the labels route file**

```typescript
// worker/src/routes/labels.ts
import { Hono } from "hono";
import { z } from "zod";
import * as bwipjs from "bwip-js";
import type { AppEnv } from "../index";

const labels = new Hono<AppEnv>();

const labelDataSchema = z.object({
  imei: z.string().min(1).max(50),
  deviceDescription: z.string().min(1).max(200),
  deviceErpCode: z.string().min(1).max(50),
  triador: z.string().min(1).max(100),
});

async function generateBarcodeBuffer(imei: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: "code128",
    text: imei,
    scale: 2,
    height: 6,
    includetext: false,
    textxalign: "center",
  });
}

// POST /api/etiquetas/gerar-png (public)
labels.post("/api/etiquetas/gerar-png", async (c) => {
  const result = labelDataSchema.safeParse(await c.req.json());
  if (!result.success) {
    return c.json({ error: "Dados inválidos", details: result.error.errors }, 400);
  }

  const { imei, deviceDescription, deviceErpCode, triador } = result.data;
  const grading = deviceErpCode.length >= 2 ? deviceErpCode.slice(-2) : "??";

  const pngBuffer = await generateBarcodeBuffer(imei);
  const barcodeBase64 = pngBuffer.toString("base64");

  return c.json({
    success: true,
    label: {
      imei,
      deviceDescription,
      deviceErpCode,
      grading,
      triador,
      barcodeBase64: `data:image/png;base64,${barcodeBase64}`,
    },
  });
});

// POST /api/etiquetas/imprimir (public)
labels.post("/api/etiquetas/imprimir", async (c) => {
  const result = labelDataSchema.safeParse(await c.req.json());
  if (!result.success) {
    return c.json({ error: "Dados inválidos", details: result.error.errors }, 400);
  }

  const { imei, deviceDescription, deviceErpCode, triador } = result.data;
  const grading = deviceErpCode.length >= 2 ? deviceErpCode.slice(-2) : "??";

  const zpl = `^XA\r\n^CI28\r\n^PW800\r\n^LL400\r\n^LH10,10\r\n\r\n^FO600,20^A0N,80,80^FD${grading}^FS\r\n\r\n^FO30,110^A0N,32,32^FB740,2,0,C,0^FD${deviceDescription}^FS\r\n\r\n^FO30,180^A0N,28,28^FDCod: ${deviceErpCode}^FS\r\n\r\n^FO30,220^A0N,20,20^FDIMEI: ${imei}^FS\r\n\r\n^FO30,250^A0N,20,20^FDTriador: ${triador}^FS\r\n\r\n^FO150,290^BY2^BCN,70,Y,N,N^FD${imei}^FS\r\n\r\n^XZ`;

  return c.json({ success: true, zpl, message: "ZPL generated successfully." });
});

// GET /api/etiquetas/barcode/:imei (public — already in auth PUBLIC_ROUTES)
labels.get("/api/etiquetas/barcode/:imei", async (c) => {
  const imei = c.req.param("imei");

  if (!imei || imei.length < 1 || imei.length > 50) {
    return c.json({ error: "Código inválido. Deve ter entre 1 e 50 caracteres." }, 400);
  }

  const pngBuffer = await bwipjs.toBuffer({
    bcid: "code128",
    text: imei,
    scale: 2,
    height: 8,
    includetext: false,
    textxalign: "center",
  });

  return new Response(pngBuffer, {
    headers: { "Content-Type": "image/png" },
  });
});

export { labels };
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/labels.ts worker/package.json worker/package-lock.json
git commit -m "feat(worker): migrate labels route (3 handlers, bwip-js barcode)"
```

---

### Task 9: Migrate dev-tools route (2 handlers, admin-only)

**Files:**
- Create: `worker/src/routes/dev-tools.ts`

**Note:** Express original has NO auth — spec says to add `requireAdmin`. Replaces `axios` with `fetch()`. Replaces `response.data.pipe(res)` with `response.body` passthrough (`ReadableStream`). Hardcoded token `"Renov123"` moved to env var `DEV_TOOLS_TOKEN`.

- [ ] **Step 1: Create the dev-tools route file**

```typescript
// worker/src/routes/dev-tools.ts
import { Hono } from "hono";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../index";

const devTools = new Hono<AppEnv>();

const EXTERNAL_API_BASE = "https://dash.renovsmart.com.br/api/sql";

// POST /api/dev/sql-execute (admin — security fix: was unprotected)
devTools.post("/api/dev/sql-execute", requireAdmin, async (c) => {
  const { query } = await c.req.json();
  if (!query) {
    return c.json({ error: "Query is required" }, 400);
  }

  const token = c.env.DEV_TOOLS_TOKEN;
  if (!token) {
    return c.json({ error: "DEV_TOOLS_TOKEN not configured" }, 500);
  }

  const response = await fetch(`${EXTERNAL_API_BASE}/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    try {
      return c.json(JSON.parse(errorData), response.status as any);
    } catch {
      return c.json({ error: "External API Error", details: errorData }, response.status as any);
    }
  }

  const data = await response.json();
  return c.json(data);
});

// POST /api/dev/sql-export (admin — security fix: was unprotected)
devTools.post("/api/dev/sql-export", requireAdmin, async (c) => {
  const { query, format } = await c.req.json();
  if (!query) {
    return c.json({ error: "Query is required" }, 400);
  }

  const token = c.env.DEV_TOOLS_TOKEN;
  if (!token) {
    return c.json({ error: "DEV_TOOLS_TOKEN not configured" }, 500);
  }

  const response = await fetch(`${EXTERNAL_API_BASE}/export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, format }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    try {
      return c.json(JSON.parse(errorText), response.status as any);
    } catch {
      return c.json(
        { error: "External API Error", details: errorText },
        response.status as any,
      );
    }
  }

  // Stream the file response directly to client
  const contentType = response.headers.get("Content-Type") || "application/octet-stream";
  const contentDisposition =
    response.headers.get("Content-Disposition") ||
    `attachment; filename=export.${format === "csv" ? "csv" : "xlsx"}`;

  return new Response(response.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition,
    },
  });
});

export { devTools };
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/routes/dev-tools.ts
git commit -m "feat(worker): migrate dev-tools route (2 handlers, add requireAdmin)"
```

---

## Chunk 5: AI Services + Route

### Task 10: Copy external-data service (pure functions)

**Files:**
- Create: `worker/src/services/external-data.ts`

**Note:** This file is a direct copy of `server/external-data.ts`. It uses ONLY `fetch()` (Open-Meteo API — free, no key) and pure functions (city lookup, keyword matching). No `process.env`, no `storage`. Fully compatible with Workers.

- [ ] **Step 1: Create services directory and copy the external-data service**

Run (from project root):

```bash
mkdir -p worker/src/services
cp server/external-data.ts worker/src/services/external-data.ts
```

The file is ~372 lines of pure functions. No modifications needed.

- [ ] **Step 2: Commit**

```bash
git add worker/src/services/external-data.ts
git commit -m "feat(worker): copy external-data service (pure functions, Open-Meteo)"
```

---

### Task 11: Create firecrawl service factory

**Files:**
- Create: `worker/src/services/firecrawl.service.ts`

**Note:** Adapted from `server/firecrawl-service.ts`. Only change: `process.env.FIRECRAWL_API_KEY` replaced with `apiKey` parameter in `scrapeMercadoLivre()`. Pure functions (`detectPricingQuery`, `formatPricingContext`) stay unchanged.

- [ ] **Step 1: Create the firecrawl service file**

Copy `server/firecrawl-service.ts` to `worker/src/services/firecrawl.service.ts` and modify `scrapeMercadoLivre` to accept `apiKey` as a parameter:

```bash
cp server/firecrawl-service.ts worker/src/services/firecrawl.service.ts
```

Then edit `worker/src/services/firecrawl.service.ts`:

**Change** (around line 52-56):
```typescript
// FROM:
export async function scrapeMercadoLivre(
  query: string
): Promise<FirecrawlPricingResult | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;

// TO:
export async function scrapeMercadoLivre(
  query: string,
  apiKey?: string,
): Promise<FirecrawlPricingResult | null> {
```

This makes the function accept an explicit key while remaining backward-compatible with the Express server (which can still call it without the parameter, though Express won't use this Worker copy).

- [ ] **Step 2: Commit**

```bash
git add worker/src/services/firecrawl.service.ts
git commit -m "feat(worker): create firecrawl service with apiKey parameter"
```

---

### Task 12: Create openrouter service factory

**Files:**
- Create: `worker/src/services/openrouter.ts`

**Note:** Most complex service. Adapted from `server/openrouter.ts` (~472 lines). Key changes:
1. `process.env.OPENROUTER_API_KEY` → `apiKey` parameter
2. `import { storage } from "./storage"` → `storage: IStorage` parameter
3. Module-level caches (`cachedModels`, `cachedSystemPrompt`) kept at module level (persist within Worker isolate)
4. `Buffer.from()` works with `nodejs_compat`

- [ ] **Step 1: Create the openrouter service file**

Copy `server/openrouter.ts` to `worker/src/services/openrouter.ts` and apply targeted edits.

```bash
cp server/openrouter.ts worker/src/services/openrouter.ts
```

Then apply these **6 edits** to `worker/src/services/openrouter.ts` (use Edit tool with exact old_string → new_string):

**Edit 1 — Fix imports:**

old_string:
```typescript
import { storage } from "./storage";
import { getExternalDataContext, needsExternalData } from "./external-data";
import { detectPricingQuery, scrapeMercadoLivre, formatPricingContext } from "./firecrawl-service";
```

new_string:
```typescript
import type { IStorage } from "../lib/storage";
import { getExternalDataContext, needsExternalData } from "./external-data";
import { detectPricingQuery, scrapeMercadoLivre, formatPricingContext } from "./firecrawl.service";
```

**Edit 2 — `fetchOpenRouterModels` receives apiKey parameter:**

old_string:
```typescript
export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const now = Date.now();
  if (cachedModels && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedModels;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
```

new_string:
```typescript
export async function fetchOpenRouterModels(apiKey: string): Promise<OpenRouterModel[]> {
  const now = Date.now();
  if (cachedModels && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedModels;
  }

```

**Edit 3 — `getSystemPrompt` receives storage parameter:**

old_string:
```typescript
async function getSystemPrompt(options: ContextOptions = {}): Promise<string> {
```

new_string:
```typescript
async function getSystemPrompt(storage: IStorage, options: ContextOptions = {}): Promise<string> {
```

**Edit 4 — `streamChatCompletion` receives deps (required):**

old_string:
```typescript
export async function* streamChatCompletion(
  messages: Message[],
  options: ContextOptions = {},
  model: string = "google/gemini-2.0-flash-001",
  attachments?: Attachment[]
): AsyncGenerator<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const systemPrompt = await getSystemPrompt(options);
```

new_string:
```typescript
export async function* streamChatCompletion(
  messages: Message[],
  options: ContextOptions = {},
  model: string = "google/gemini-2.0-flash-001",
  attachments?: Attachment[],
  deps: { storage: IStorage; apiKey: string; firecrawlApiKey?: string },
): AsyncGenerator<string> {
  const { apiKey, storage, firecrawlApiKey } = deps;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const systemPrompt = await getSystemPrompt(storage, options);
```

**Edit 5 — `scrapeMercadoLivre` call passes firecrawlApiKey:**

old_string:
```typescript
        const pricingResult = await scrapeMercadoLivre(userQuery);
```

new_string:
```typescript
        const pricingResult = await scrapeMercadoLivre(userQuery, firecrawlApiKey);
```

**Edit 6 — `generateTitle` receives apiKey parameter:**

old_string:
```typescript
export async function generateTitle(userMessage: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
```

new_string:
```typescript
export async function generateTitle(userMessage: string, apiKey?: string): Promise<string> {
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/services/openrouter.ts
git commit -m "feat(worker): create openrouter service with injected deps"
```

---

### Task 13: Migrate AI route (4 handlers, SSE streaming)

**Files:**
- Create: `worker/src/routes/ai.ts`

**Note:** SSE streaming replaces `res.write()` with `ReadableStream + controller.enqueue()`. Uses the Worker services created in Tasks 10-12.

- [ ] **Step 1: Create the AI route file**

```typescript
// worker/src/routes/ai.ts
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { streamChatCompletion, generateTitle, fetchOpenRouterModels } from "../services/openrouter";
import { scrapeMercadoLivre } from "../services/firecrawl.service";

const ai = new Hono<AppEnv>();

// POST /api/ai/chat — SSE streaming
ai.post("/api/ai/chat", async (c) => {
  const { messages, model, attachments } = await c.req.json();
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const apiKey = c.env.OPENROUTER_API_KEY;
  const firecrawlApiKey = c.env.FIRECRAWL_API_KEY;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of streamChatCompletion(
          messages,
          { userId: user?.userId },
          model,
          attachments,
          { storage, apiKey, firecrawlApiKey },
        )) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error) {
        console.error("Error streaming chat completion:", error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
});

// POST /api/ai/title
ai.post("/api/ai/title", async (c) => {
  const { userMessage } = await c.req.json();
  if (!userMessage) {
    return c.json({ error: "userMessage is required" }, 400);
  }
  const title = await generateTitle(userMessage, c.env.OPENROUTER_API_KEY);
  return c.json({ title });
});

// GET /api/firecrawl/test
ai.get("/api/firecrawl/test", async (c) => {
  const query = c.req.query("query");
  if (!query) {
    return c.json({ error: "query parameter is required" }, 400);
  }
  console.log(`[Firecrawl Test] Testing with query: "${query}"`);
  const result = await scrapeMercadoLivre(query, c.env.FIRECRAWL_API_KEY);
  if (!result) {
    return c.json({ error: "Nenhum resultado encontrado ou erro na API Firecrawl" }, 404);
  }
  return c.json(result);
});

// GET /api/ai/openrouter-models
ai.get("/api/ai/openrouter-models", async (c) => {
  const models = await fetchOpenRouterModels(c.env.OPENROUTER_API_KEY);
  return c.json(models);
});

export { ai };
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/routes/ai.ts
git commit -m "feat(worker): migrate AI route (4 handlers, SSE streaming)"
```

---

## Chunk 6: Wiring

### Task 14: Update auth middleware for public routes

**Files:**
- Modify: `worker/src/middleware/auth.ts`

**Note:** Several of the migrated routes have public endpoints that need to bypass JWT auth. The barcode GET is already in PUBLIC_ROUTES. Need to add: SLAs GET, updates GET, CEP GET, labels POST.

- [ ] **Step 1: Add public routes to the auth middleware**

In `worker/src/middleware/auth.ts`, add to `PUBLIC_ROUTES` array:

```typescript
// Add after existing PUBLIC_ROUTES entries:
  { method: "GET", path: "/api/slas" },
  { method: "GET", path: /^\/api\/slas\/[^/]+$/ },
  { method: "GET", path: "/api/updates" },
  { method: "GET", path: /^\/api\/cep\// },
  { method: "POST", path: "/api/etiquetas/gerar-png" },
  { method: "POST", path: "/api/etiquetas/imprimir" },
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/middleware/auth.ts
git commit -m "feat(worker): add Phase 2B public routes to auth middleware"
```

---

### Task 15: Mount all routes and update wrangler config

**Files:**
- Modify: `worker/src/index.ts` — import and mount 9 routes
- Modify: `worker/wrangler.toml` — add `DEV_TOOLS_TOKEN` var

- [ ] **Step 1: Update index.ts to mount all routes**

Add imports after existing route imports:

```typescript
import { notifications } from "./routes/notifications";
import { slas } from "./routes/slas";
import { updates } from "./routes/updates";
import { flowcharts } from "./routes/flowcharts";
import { cep } from "./routes/cep";
import { users } from "./routes/users";
import { labels } from "./routes/labels";
import { devTools } from "./routes/dev-tools";
import { ai } from "./routes/ai";
```

Add route mounts after existing `app.route("/", settings);`:

```typescript
app.route("/", notifications);
app.route("/", slas);
app.route("/", updates);
app.route("/", flowcharts);
app.route("/", cep);
app.route("/", users);
app.route("/", labels);
app.route("/", devTools);
app.route("/", ai);
```

Add `DEV_TOOLS_TOKEN` to the `Bindings` type:

```typescript
DEV_TOOLS_TOKEN: string;
```

- [ ] **Step 2: Set DEV_TOOLS_TOKEN as a Cloudflare secret**

Do NOT add to `[vars]` in wrangler.toml (it's an auth token). Set via CLI:

```bash
cd worker && npx wrangler secret put DEV_TOOLS_TOKEN
# Enter value: Renov123 (or a stronger token)
```

For dev environment:
```bash
cd worker && npx wrangler secret put DEV_TOOLS_TOKEN --env dev
```

For local development, add to `worker/.dev.vars`:
```
DEV_TOOLS_TOKEN=Renov123
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/index.ts worker/wrangler.toml
git commit -m "feat(worker): mount 9 Phase 2B routes + add DEV_TOOLS_TOKEN"
```

---

### Task 16: Build verification

**Files:** None (verification only)

- [ ] **Step 1: Run dry-run deploy to verify bundle compiles**

```bash
cd worker && npx wrangler deploy --dry-run --outdir=dist-verify 2>&1
```

Expected: Bundle succeeds with no errors. Check output for:
- Bundle size (should be < 10MB; flag if > 5MB)
- No unresolved imports
- No TypeScript errors

**If `pg` import fails:** Add `pg` to `worker/package.json` devDependencies:
```bash
cd worker && npm install --save-dev pg @types/pg
```

**If bundle size is concerning:** Check with:
```bash
du -sh worker/dist-verify/
```

- [ ] **Step 2: Clean up and commit (if any fixes needed)**

```bash
rm -rf worker/dist-verify
```

- [ ] **Step 3: Push branch**

```bash
git push -u origin feat/cloudflare-migration-phase2b
```

---

## Summary

| Chunk | Tasks | Handlers | Key Risks |
|---|---|---|---|
| 1. Storage Integration | 1 | 0 | `pg` bundling with `server/storage.ts` |
| 2. Pure CRUD | 2-5 | 23 | None (mechanical translation) |
| 3. External APIs | 6-7 | 7 | SendPulse email signature match |
| 4. Specialized | 8-9 | 5 | `bwip-js` with `nodejs_compat`; stream passthrough |
| 5. AI Services + Route | 10-13 | 4 | SSE streaming; `openrouter.ts` dependency injection |
| 6. Wiring | 14-16 | 0 | Bundle size; public route auth bypass |
| **Total** | **16** | **39** | |

## Criterios de Sucesso (do spec Phase 2)

- [ ] 9 rotas respondendo no Worker com dados corretos
- [ ] Labels: barcode PNG gerado com sucesso (ou fallback documentado)
- [ ] AI: SSE streaming funciona no browser (chat com resposta em tempo real)
- [ ] Dev-tools: protegido com `requireAdmin`
