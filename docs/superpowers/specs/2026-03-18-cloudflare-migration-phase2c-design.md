# Cloudflare Migration Phase 2C — Design Spec

## Goal

Migrate 6 Express routes (~1,958 lines, ~87 endpoints) to Hono Workers: OKRs, Metas, Knowledge Base, Integrations, Tickets, and Git Analytics. This phase covers all medium-complexity routes that depend primarily on storage CRUD, API proxying, email notifications, and GitHub integration.

## Architecture

Same 1:1 migration pattern established in Phases 2A and 2B: each Express route file becomes a `new Hono<AppEnv>()` instance mounted at the root. Storage access via the existing bridge (`worker/src/lib/storage.ts`), email via SendPulse functions already implemented in `worker/src/lib/email.ts`.

Two new services are introduced: `github-sync.ts` (copy from Express with dependency injection) and `github-webhook.ts` (new — webhook signature validation using Web Crypto API).

## Tech Stack

- Hono (HTTP framework for Workers)
- Drizzle ORM via storage bridge
- SendPulse REST API (email)
- GitHub API (sync service)
- Web Crypto API (webhook signature validation)
- Zod (request validation, schemas from `shared/schema.ts`)

---

## Routes

### 1. OKRs (`worker/src/routes/okrs.ts`)

**Source:** `server/routes/okrs.ts` (235 lines)
**Endpoints:** 12 (all authenticated)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/objectives` | requireAuth | Filters by owner/responsible for non-admins |
| GET | `/api/objectives/:id` | requireAuth | Access control via `responsibleIds` JSON parse |
| POST | `/api/objectives` | requireAuth | Validates with `insertObjectiveSchema` |
| PATCH | `/api/objectives/:id` | requireAuth | Owner or admin only |
| DELETE | `/api/objectives/:id` | requireAuth | Owner or admin only |
| GET | `/api/key-results` | requireAuth | List all |
| GET | `/api/key-results/:id` | requireAuth | Single KR |
| POST | `/api/key-results` | requireAuth | Validates with `insertKeyResultSchema` |
| PATCH | `/api/key-results/:id` | requireAuth | Partial update |
| DELETE | `/api/key-results/:id` | requireAuth | Hard delete |
| GET | `/api/key-results/:id/updates` | requireAuth | Lists check-ins with user info |
| POST | `/api/key-results/:id/updates` | requireAuth | Creates check-in, calculates progress, updates deadline status |

**Key logic:** Progress calculation supports `decreasing`, `binary`, `percentage`, `absolute`, `monetary`, `temporal` measurement types. Deadline status auto-updates to `overdue`, `at_risk`, or `on_track`.

**Dependencies:** Storage only (no external APIs).

### 2. Metas (`worker/src/routes/metas.ts`)

**Source:** `server/routes/metas.ts` (197 lines)
**Endpoints:** 12 (all authenticated)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/meta-areas` | requireAuth | List all areas |
| GET | `/api/meta-areas/:id` | requireAuth | Single area |
| POST | `/api/meta-areas` | requireAuth | Validates with `insertMetaAreaSchema` |
| PATCH | `/api/meta-areas/:id` | requireAuth | Partial update |
| DELETE | `/api/meta-areas/:id` | requireAuth | **Soft delete** (sets `archived: true`) |
| GET | `/api/metas` | requireAuth | Filters: month, areaId, responsibleId |
| GET | `/api/metas/:id` | requireAuth | Single meta |
| POST | `/api/metas` | requireAuth | Validates with `insertMetaSchema` |
| PATCH | `/api/metas/:id` | requireAuth | Partial update |
| DELETE | `/api/metas/:id` | requireAuth | Hard delete |
| GET | `/api/metas/:id/checkins` | requireAuth | Lists check-ins with user info |
| POST | `/api/metas/:id/checkins` | requireAuth | Creates check-in, updates `currentValue` |

**Key logic:** Meta area DELETE is a soft archive. Check-in creation updates the parent meta's `currentValue`.

**Dependencies:** Storage only.

### 3. Knowledge Base (`worker/src/routes/knowledge.ts`)

**Source:** `server/routes/knowledge.ts` (172 lines)
**Endpoints:** 13 (all authenticated)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/knowledge/documents` | requireAuth | Multi-filter: query, tag, area, author, status, dates, favoritesOnly |
| GET | `/api/knowledge/documents/:id` | requireAuth | Creator or admin only |
| POST | `/api/knowledge/documents` | requireAuth | Sets `createdBy` to current user |
| PUT | `/api/knowledge/documents/:id` | requireAuth | Creator or admin only |
| DELETE | `/api/knowledge/documents/:id` | requireAuth | Creator or admin only |
| GET | `/api/knowledge/documents/:id/versions` | requireAuth | List versions |
| POST | `/api/knowledge/documents/:id/versions` | requireAuth | Create version with `createdBy` |
| GET | `/api/knowledge/documents/:docId/versions/:verId` | requireAuth | Single version |
| POST | `/api/knowledge/documents/:docId/versions/:verId/revert` | requireAuth | **Returns 501** (not implemented) |
| DELETE | `/api/knowledge/documents/:docId/versions/:verId` | requireAuth | **Returns 501** (not implemented) |
| GET | `/api/knowledge/documents/:id/audit-logs` | requireAuth | Audit trail |
| POST | `/api/knowledge/documents/:id/toggle-favorite` | requireAuth | Toggle favorite on/off |
| GET | `/api/knowledge/favorites` | requireAuth | User's favorites list |

**Key logic:** Access control is creator-or-admin. Two endpoints return 501 (revert and delete version) — preserved as-is.

**Dependencies:** Storage only.

### 4. Integrations (`worker/src/routes/integrations.ts`)

**Source:** `server/routes/integrations.ts` (270 lines)
**Endpoints:** 11 (mostly public)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/integrations/relatorio-pedidos/test-connection` | public | Tests RenovSmart API connection |
| GET | `/api/integrations/relatorio-pedidos/orders/advanced` | public | Proxy with 16 query params |
| POST | `/api/logistica-reversa/eventos` | public | Webhook receiver, validates with Zod |
| GET | `/api/avaliacoes-ia/resumo` | public | AI evaluation proxy |
| GET | `/api/avaliacoes-ia/evolucao` | public | AI evaluation proxy |
| GET | `/api/avaliacoes-ia/evolucao-categoria` | public | AI evaluation proxy |
| GET | `/api/avaliacoes-ia/dispositivos` | public | AI evaluation proxy |
| GET | `/api/avaliacoes-ia/detalhes` | public | AI evaluation proxy |
| GET | `/api/avaliacoes-ia/categorias` | public | AI evaluation proxy |
| GET | `/api/avaliacoes-ia/assertividade-fotos` | public | AI evaluation proxy |
| GET | `/api/estoques` | public | Estoque proxy |

**Key logic:** All `avaliacoes-ia` endpoints use a shared `fetchAiEvaluation` helper. `RS_API_BASE_URL` and `RS_API_TOKEN` are hardcoded constants (same as Express).

**Dependencies:** `fetch` (native in Workers), storage (for logística reversa webhook only).

### 5. Tickets (`worker/src/routes/tickets.ts`)

**Source:** `server/routes/tickets.ts` (557 lines)
**Endpoints:** 16 (all authenticated)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/tickets` | requireAuth | Admin sees all, users see own (requester/assignee) |
| GET | `/api/tickets/:id` | requireAuth | Access control: requester, assignee, or admin |
| POST | `/api/tickets` | requireAuth | Auto-assignment by category/type, email + notification |
| PATCH | `/api/tickets/:id` | requireAuth | Status transitions, date tracking, email + notification |
| DELETE | `/api/tickets/:id` | requireAuth | Access control |
| GET | `/api/tickets/:id/comments` | requireAuth | Access control |
| POST | `/api/tickets/:id/comments` | requireAuth | Email, mentions, notifications, first-response tracking |
| GET | `/api/ticket-responsaveis` | requireAuth | List auto-assignment rules |
| GET | `/api/ticket-responsaveis/:id` | requireAuth | Single rule |
| POST | `/api/ticket-responsaveis` | requireAdmin | Create rule |
| PATCH | `/api/ticket-responsaveis/:id` | requireAdmin | Update rule |
| DELETE | `/api/ticket-responsaveis/:id` | requireAdmin | Delete rule |
| GET | `/api/ticket-responsaveis/find/:cat/:tipo` | requireAuth | Find matching rule |
| GET | `/api/tickets/csat/analytics` | requireAuth + admin check | CSAT dashboard: overview, distribution, trend, top responsibles |
| PATCH | `/api/tickets/:id/satisfaction` | requireAuth | Submit CSAT rating (requester only, closed/resolved only) |

**Key logic:**
- Auto-assignment via `storage.findResponsavelForTicket(category, type)`
- 6 email types: created, assigned, status changed, comment, mention, CSAT
- CSAT analytics computed in-route (no separate service)
- Status transitions set `dataResolucao`/`dataFechamento` dates
- Non-admin users restricted to allowed fields on PATCH

**Email functions (all already in worker/lib/email.ts):**
- `sendTicketCreatedEmail(env, storage, ticket, requester, assignee)`
- `sendTicketAssignedEmail(env, storage, ticket, assignee)`
- `sendTicketStatusChangedEmail(env, storage, ticket, oldStatus, newStatus, requester, assignee)`
- `sendTicketCommentEmail(env, storage, ticket, comment, commenter, requester, assignee)`
- `sendMentionNotificationEmail(env, storage, mentionedUser, commenterName, ticketTitle, ticketId, content)`
- `sendCSATReceivedEmail(env, storage, ticket, rating, comment, assignee)`

**Email caller pattern:** Worker email functions require `(env: EmailEnv, storage: IStorage, ...)` as the first two parameters (unlike Express which calls them directly). In each route handler, extract `env` from `c.env` and `storage` from `getStorage(c.get("db"))`.

**Dependencies:** Storage, email (SendPulse).

### 6. Git Analytics (`worker/src/routes/git-analytics.ts`)

**Source:** `server/routes/git-analytics.ts` (525 lines)
**Endpoints:** 19 (mostly authenticated, 1 secret-auth, 1 webhook-signed)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/git-analytics/repositories` | requireAuth | List repos |
| GET | `/api/git-analytics/repositories/:id` | requireAuth | Single repo |
| POST | `/api/git-analytics/repositories` | requireAuth | Create with `insertGitRepositorySchema` |
| PUT | `/api/git-analytics/repositories/:id` | requireAuth | Update repo |
| DELETE | `/api/git-analytics/repositories/:id` | requireAuth | Delete repo |
| GET | `/api/git-analytics/commits` | requireAuth | Multi-filter + pagination |
| GET | `/api/git-analytics/pull-requests` | requireAuth | Multi-filter + pagination |
| GET | `/api/git-analytics/security-alerts` | requireAuth | Filter by severity/status |
| GET | `/api/git-analytics/pending-branches` | requireAuth | Branches ahead without PR |
| GET | `/api/git-analytics/branches` | requireAuth | List branches |
| GET | `/api/git-analytics/stats` | requireAuth | Dashboard aggregations |
| GET | `/api/git-analytics/developer-tokens` | requireAuth | OpenRouter + Claude Code usage |
| GET | `/api/git-analytics/developer-stats` | requireAuth | Per-developer stats |
| GET | `/api/git-analytics/commits-by-day` | requireAuth | Volume chart data |
| GET | `/api/git-analytics/prs-by-day` | requireAuth | Volume chart data |
| GET | `/api/git-analytics/commits-by-month` | requireAuth | Volume chart data |
| GET | `/api/git-analytics/prs-by-month` | requireAuth | Volume chart data |
| POST | `/api/git-analytics/sync` | requireAuth | Sync one or all repos |
| POST | `/api/git-analytics/sync-period` | requireAuth | Sync specific date range |
| POST | `/api/git-analytics/add-repository` | requireAuth | Add + initial sync |
| GET | `/api/git-analytics/sync-status` | requireAuth | Diagnostic endpoint |
| POST | `/api/git-analytics/claude-code-usage` | secret | `X-Claude-Usage-Secret` header |
| POST | `/api/git-analytics/github-webhook` | webhook signature | **New** — receives GitHub push events, validates `X-Hub-Signature-256` |

**Key logic:**
- `developer-tokens` endpoint fetches OpenRouter usage per-developer key + Claude Code DB usage
- Sync endpoints delegate to `github-sync.ts` service
- `claude-code-usage` uses secret header auth (already in `SECRET_AUTH_ROUTES`)

**`process.env` conversion:** The `sync-status` endpoint uses `process.env.GITHUB_TOKEN` and `process.env.NODE_ENV` — these must become `c.env.GITHUB_TOKEN` and a hardcoded `"production"` (or omitted). `GITHUB_TOKEN` already exists in the Worker Bindings type — no new wrangler secret needed.

**`openrouter-keys.ts` import:** Import from `../../../server/config/openrouter-keys` (relative from `worker/src/routes/`). This is a pure data module with no Node.js-specific imports — safe for Workers bundling.

**Dependencies:** Storage, `github-sync.ts` service, `openrouter-keys.ts` config.

---

## New Services

### `worker/src/services/github-sync.ts`

Copy of `server/services/github-sync.ts` with dependency injection:

```typescript
interface GitSyncDeps {
  storage: IStorage;
  githubToken: string;
}
```

All functions receive `deps` parameter instead of using `process.env.GITHUB_TOKEN` and `import { storage }`. Functions exported: `syncRepository`, `syncAllRepositories`, `syncRepositoryByPeriod`, `addRepository`.

### `worker/src/lib/github-webhook.ts`

New file — validates GitHub webhook signatures using Web Crypto API. This enables adding a `POST /api/git-analytics/github-webhook` endpoint that receives push events from GitHub, replacing the current manual sync flow.

```typescript
export async function verifyGitHubWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean>
```

Uses `crypto.subtle.importKey` + `crypto.subtle.sign` with HMAC SHA-256, compares with `X-Hub-Signature-256` header value.

The git-analytics route will include a new `POST /api/git-analytics/github-webhook` endpoint (public, validated by signature) that processes GitHub push events and triggers sync automatically.

---

## Auth Middleware Changes

Add to `PUBLIC_ROUTES` in `worker/src/middleware/auth.ts`:

```typescript
// Integrations — proxy endpoints (public)
{ method: "POST", path: "/api/integrations/relatorio-pedidos/test-connection" },
{ method: "GET", path: "/api/integrations/relatorio-pedidos/orders/advanced" },
{ method: "POST", path: "/api/logistica-reversa/eventos" },
{ method: "GET", path: /^\/api\/avaliacoes-ia\// },
{ method: "GET", path: "/api/estoques" },
```

Note: `/api/git-analytics/claude-code-usage` is already in `SECRET_AUTH_ROUTES`.

Add GitHub webhook to public routes (signature validated in-route):
```typescript
{ method: "POST", path: "/api/git-analytics/github-webhook" },
```

---

## Bindings Changes

Add to `Bindings` type in `worker/src/index.ts`:

```typescript
GITHUB_WEBHOOK_SECRET: string;
```

Manual steps after deploy:
- `wrangler secret put GITHUB_WEBHOOK_SECRET` (configure in GitHub repo webhook settings)

---

## File Summary

**Create (8 files):**
- `worker/src/routes/okrs.ts`
- `worker/src/routes/metas.ts`
- `worker/src/routes/knowledge.ts`
- `worker/src/routes/integrations.ts`
- `worker/src/routes/tickets.ts`
- `worker/src/routes/git-analytics.ts`
- `worker/src/services/github-sync.ts`
- `worker/src/lib/github-webhook.ts`

**Modify (2 files):**
- `worker/src/index.ts` — import + mount 6 routes, add `GITHUB_WEBHOOK_SECRET` to Bindings
- `worker/src/middleware/auth.ts` — add public routes for integrations

**Reuse (no changes):**
- `worker/src/lib/storage.ts` — existing bridge
- `worker/src/lib/email.ts` — 15 SendPulse functions
- `server/config/openrouter-keys.ts` — direct import (pure data)
- `shared/schema.ts` — Zod schemas
