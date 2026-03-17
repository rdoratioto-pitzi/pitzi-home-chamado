# Cloudflare Migration Phase 2A — Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the infrastructure foundation (storage factory, email service, client auth, Pages) so sub-fases 2B-2D are mechanical Express-to-Hono translations.

**Architecture:** Refactor `storage.ts` with factory pattern for Worker per-request DB. Replace nodemailer with SendPulse REST API. Replace localStorage/Bearer auth with cookie-based AuthProvider. Set up Cloudflare Pages for frontend hosting.

**Tech Stack:** Hono, Drizzle ORM, SendPulse API, React Context, Cloudflare Pages, Vite

**Spec:** `docs/superpowers/specs/2026-03-17-cloudflare-migration-phase2-design.md`

**Branch:** Create `feat/cloudflare-migration-phase2a` from `develop`

---

## Chunk 1: Storage Factory

### Task 1: Export Database type from `server/db.ts`

**Files:**
- Modify: `server/db.ts`

- [ ] **Step 1: Add Database type export**

```typescript
// Add after the `export const db = ...` line (line 20):
export type Database = NonNullable<typeof db>;
```

This type is needed by `storage.ts` for the constructor parameter.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run check`
Expected: PASS (no new errors)

- [ ] **Step 3: Commit**

```bash
git add server/db.ts
git commit -m "refactor(storage): export Database type from db.ts"
```

---

### Task 2: Add constructor parameter to DatabaseStorage

**Files:**
- Modify: `server/storage.ts:85,454-456,3398-3400`

The class is at line 454. The `db` import is at line 85. The singleton export is at line 3400.

- [ ] **Step 1: Change db import to named alias**

In `server/storage.ts`, line 85, change:
```typescript
import { db } from "./db";
```
to:
```typescript
import { db as defaultDb, type Database } from "./db";
```

- [ ] **Step 2: Add constructor to DatabaseStorage class**

At line 454, change:
```typescript
export class DatabaseStorage implements IStorage {
  // In-memory storage for updates when database is not available
  private mockUpdates: Update[] = [];
```
to:
```typescript
export class DatabaseStorage implements IStorage {
  // In-memory storage for updates when database is not available
  private mockUpdates: Update[] = [];

  constructor(private db: Database = defaultDb!) {}
```

- [ ] **Step 3: Replace all `db.` references with `this.db.` inside the class**

This is a **mechanical bulk replacement** inside the class body (lines ~458 to ~3398). Rules:

1. Only replace `db.` that refers to the imported database — NOT `db` inside strings, variable names like `dbResult`, or destructured `{ db }`.
2. The pattern is: any `db.select(`, `db.insert(`, `db.update(`, `db.delete(`, `db.execute(`, `db.query.` → replace with `this.db.select(` etc.
3. Also replace the `if (!db)` guards (there are ~256 of them) with `if (!this.db)`.

**Approach:** Use search-and-replace in the class body:
- `db.select(` → `this.db.select(`
- `db.insert(` → `this.db.insert(`
- `db.update(` → `this.db.update(`
- `db.delete(` → `this.db.delete(`
- `db.execute(` → `this.db.execute(`
- `db.query.` → `this.db.query.`
- `if (!db)` → `if (!this.db)`
- `if(!db)` → `if (!this.db)`

**Nota:** `db.transaction(` nao existe atualmente em `storage.ts` (verificado). Se aparecer no futuro, tambem precisaria virar `this.db.transaction(`.

**Do NOT replace:**
- `db` inside `from "./db"` import (already changed to `defaultDb`)
- Variable names like `dbTicket`, `dbComment`, `dbResult`, etc.
- `db` in comments or strings
- `db` that is NOT a standalone identifier (e.g., `neondb`)

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run check`
Expected: PASS. If there are errors, they'll be from missed replacements or over-eager replacements. Fix individually.

- [ ] **Step 5: Commit**

```bash
git add server/storage.ts
git commit -m "refactor(storage): add db constructor param, replace db. with this.db."
```

---

### Task 3: Add `getStorage()` factory function

**Files:**
- Modify: `server/storage.ts:3398-3400`

- [ ] **Step 1: Add factory function after singleton**

At the end of `server/storage.ts`, after `export const storage = new DatabaseStorage();`:

```typescript
export const storage = new DatabaseStorage();

/**
 * Factory para criar instancia de storage com db especifico.
 * Usado pelo Worker (per-request db via Hono context).
 */
export function getStorage(db: Database): IStorage {
  return new DatabaseStorage(db);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Verify Express dev server starts**

Run: `npm run dev`
Expected: Server starts on port 5050 without errors. The `storage` singleton should use the default `db`.

Stop the server after confirming it starts.

- [ ] **Step 4: Commit**

```bash
git add server/storage.ts
git commit -m "feat(storage): add getStorage(db) factory for Worker per-request db"
```

---

## Chunk 2: Email Service (SendPulse)

### Task 4: Add SendPulse bindings to Worker

**Files:**
- Modify: `worker/src/index.ts:10-32` (Bindings type)
- Modify: `worker/wrangler.toml`
- Modify: `worker/.dev.vars`

- [ ] **Step 1: Add SendPulse bindings to the Bindings type**

In `worker/src/index.ts`, add to the `Bindings` type (after line 30):

```typescript
type Bindings = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  CORS_ORIGIN: string;
  APP_URL: string;
  ATTACHMENTS: R2Bucket;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_FROM: string;
  OPENROUTER_API_KEY: string;
  CORREIOS_USUARIO: string;
  CORREIOS_SENHA: string;
  CORREIOS_CARTAO_POSTAGEM: string;
  CORREIOS_COD_ADMINISTRATIVO: string;
  CORREIOS_TOKEN: string;
  CORREIOS_HOMOLOGACAO: string;
  FIRECRAWL_API_KEY: string;
  CLAUDE_USAGE_SECRET: string;
  GITHUB_TOKEN: string;
  // SendPulse (Phase 2A — replaces nodemailer)
  SENDPULSE_CLIENT_ID: string;
  SENDPULSE_CLIENT_SECRET: string;
  SENDPULSE_FROM_EMAIL: string;
  SENDPULSE_FROM_NAME: string;
};
```

- [ ] **Step 2: Add SendPulse vars to wrangler.toml**

In `worker/wrangler.toml`, add to `[vars]` section:

```toml
[vars]
APP_URL = "https://home-next.renovsmart.com.br"
CORS_ORIGIN = "https://home-next.renovsmart.com.br"
SENDPULSE_FROM_EMAIL = "noreply@renovsmart.com.br"
SENDPULSE_FROM_NAME = "Renov Home"
```

And to `[env.dev.vars]`:

```toml
[env.dev.vars]
APP_URL = "https://home-dev.renovsmart.com.br"
CORS_ORIGIN = "https://home-dev.renovsmart.com.br"
SENDPULSE_FROM_EMAIL = "noreply@renovsmart.com.br"
SENDPULSE_FROM_NAME = "Renov Home (Dev)"
```

The `SENDPULSE_CLIENT_ID` and `SENDPULSE_CLIENT_SECRET` are secrets — set via `wrangler secret put`, NOT in wrangler.toml.

**Nota:** Os bindings SMTP antigos (`SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`) sao mantidos no `Bindings` type durante a migracao (Express ainda usa). Remover ao final da 2A ou inicio da 2B, apos confirmar que SendPulse funciona.

- [ ] **Step 3: Add dev vars for local testing**

In `worker/.dev.vars`, add placeholder values:

```
SENDPULSE_CLIENT_ID=your-client-id-here
SENDPULSE_CLIENT_SECRET=your-client-secret-here
```

- [ ] **Step 4: Commit**

```bash
git add worker/src/index.ts worker/wrangler.toml worker/.dev.vars
git commit -m "feat(worker): add SendPulse bindings to Worker config"
```

---

### Task 5: Create ICS calendar utility

**Files:**
- Create: `worker/src/lib/ics.ts`

Source: Extract from `server/email-service.ts` lines 707-813. These are pure functions with zero dependencies.

- [ ] **Step 1: Create `worker/src/lib/ics.ts`**

Reproduz fielmente as funcoes de `server/email-service.ts` linhas 707-813. Usa `fromZonedTime` do `date-fns-tz` para conversao de timezone e suporta RRULE para reunioes recorrentes.

```typescript
/**
 * ICS Calendar generation utilities.
 * Faithful reproduction from server/email-service.ts (lines 707-813).
 * Depends on: date-fns-tz (already a project dependency, pure JS).
 */
import { fromZonedTime } from "date-fns-tz";

export function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

export function escapeICSParam(text: string): string {
  if (text.includes(",") || text.includes(";") || text.includes(":") || text.includes('"')) {
    return `"${text.replace(/"/g, '\\"')}"`;
  }
  return text;
}

export function foldICSLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let current = line;
  while (current.length > 75) {
    parts.push(current.substring(0, 75));
    current = " " + current.substring(75);
  }
  parts.push(current);
  return parts.join("\r\n");
}

interface MeetingICSInput {
  title: string;
  date: string;        // "YYYY-MM-DD"
  time: string;        // "HH:mm"
  location?: string;
  description?: string;
  organizerName: string;
  organizerEmail: string;
  isRecurring?: boolean;
  recurrenceType?: string;
  recurrenceWeekdays?: number[];
  recurrenceEndDate?: string;
}

export function generateICSContent(
  meeting: MeetingICSInput,
  attendees: { name: string; email: string }[]
): string {
  const uid = `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@renovhome.com.br`;
  const now = new Date();
  const SAO_PAULO_TZ = "America/Sao_Paulo";

  const [year, month, day] = meeting.date.split("-").map(Number);
  const [hour, minute] = meeting.time.split(":").map(Number);
  const localDateTime = new Date(year, month - 1, day, hour, minute, 0);
  const startUTC = fromZonedTime(localDateTime, SAO_PAULO_TZ);
  const endUTC = new Date(startUTC.getTime() + 60 * 60 * 1000);

  const formatDateUTC = (d: Date): string =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const dtStart = formatDateUTC(startUTC);
  const dtEnd = formatDateUTC(endUTC);

  const attendeeLines = attendees.map(
    (a) => `ATTENDEE;CN=${escapeICSParam(a.name)};RSVP=TRUE:mailto:${a.email}`
  );

  let rrule = "";
  if (meeting.isRecurring) {
    if (meeting.recurrenceType === "daily") {
      rrule = "RRULE:FREQ=DAILY";
    } else if (meeting.recurrenceType === "weekly" && meeting.recurrenceWeekdays?.length) {
      const days = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
      const dayList = meeting.recurrenceWeekdays.map((d) => days[d]).join(",");
      rrule = `RRULE:FREQ=WEEKLY;BYDAY=${dayList}`;
    }
    if (rrule && meeting.recurrenceEndDate) {
      const [ey, em, ed] = meeting.recurrenceEndDate.split("-").map(Number);
      const endLocalDateTime = new Date(ey, em - 1, ed, 23, 59, 59);
      const untilUTC = fromZonedTime(endLocalDateTime, SAO_PAULO_TZ);
      rrule += `;UNTIL=${formatDateUTC(untilUTC)}`;
    }
  }

  const rawLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Renov Home//Meeting Invite//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatDateUTC(now)}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICSText(meeting.title)}`,
    `LOCATION:${escapeICSText(meeting.location || "")}`,
    `DESCRIPTION:${escapeICSText(meeting.description || "")}`,
    `ORGANIZER;CN=${escapeICSParam(meeting.organizerName)}:mailto:${meeting.organizerEmail}`,
    ...attendeeLines,
    rrule,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((line) => line.length > 0);

  return rawLines.map((line) => foldICSLine(line)).join("\r\n");
}
```

**Dependencia:** Adicionar `date-fns-tz` ao `worker/package.json`:
```bash
cd worker && npm install date-fns-tz
```

- [ ] **Step 2: Verify TypeScript compiles**

Run (from worker dir): `cd worker && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add worker/src/lib/ics.ts
git commit -m "feat(worker): add ICS calendar utility (extracted from email-service)"
```

---

### Task 6: Create SendPulse email service

**Files:**
- Create: `worker/src/lib/email.ts`

This replaces `server/email-service.ts` (1,098 lines, 15 functions + helper). The core change: `nodemailer.sendMail()` → `fetch()` to SendPulse API.

- [ ] **Step 1: Read the original email-service.ts completely**

Read `server/email-service.ts` to understand all 15 exported functions, their parameters, and how they use `storage` and templates.

Also read `server/email-templates.ts` to understand the HTML builder functions — these are pure functions reused directly.

- [ ] **Step 2: Create `worker/src/lib/email.ts` — SendPulse transport + helper**

```typescript
/**
 * Email service using SendPulse SMTP API.
 * Replaces server/email-service.ts (nodemailer) for Cloudflare Workers.
 */
import type { Ticket, User, TicketComment, Task, KanbanCard, Project } from "../../../shared/schema";
// NOTA: import type-only do server — nao causa resolucao de runtime.
// Se o Worker tsconfig reclamar, extrair IStorage + EmailNotificationType para shared/.
import type { IStorage, EmailNotificationType } from "../../../server/storage";
import {
  emailTemplate,
  getTicketUrl,
  getProjectUrl,
  getStatusLabel,
  getPriorityLabel,
  formatDateTime,
  statusBadge,
  priorityBadge,
  statusTransition,
  actionBy,
  infoTable,
  sectionCard,
  commentBox,
  ctaButton,
} from "../../../server/email-templates";
import { generateICSContent } from "./ics";

// ─── SendPulse Transport ──────────────────────────────────────

interface SendPulseEnv {
  SENDPULSE_CLIENT_ID: string;
  SENDPULSE_CLIENT_SECRET: string;
  SENDPULSE_FROM_EMAIL: string;
  SENDPULSE_FROM_NAME: string;
  APP_URL: string;
}

// Cache best-effort: persiste entre requests no mesmo isolate,
// mas pode ser evicted a qualquer momento. Degrada gracefully
// para re-autenticar quando frio. OK para Workers.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getSendPulseToken(env: SendPulseEnv): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const res = await fetch("https://api.sendpulse.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: env.SENDPULSE_CLIENT_ID,
      client_secret: env.SENDPULSE_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    throw new Error(`SendPulse auth failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

interface SendMailOptions {
  to: Array<{ name: string; email: string }>;
  subject: string;
  html: string;
  attachments_binary?: Record<string, string>; // filename -> base64
}

async function sendMail(env: SendPulseEnv, options: SendMailOptions): Promise<void> {
  const token = await getSendPulseToken(env);

  const body: Record<string, unknown> = {
    email: {
      subject: options.subject,
      from: { name: env.SENDPULSE_FROM_NAME, email: env.SENDPULSE_FROM_EMAIL },
      to: options.to,
      html: options.html,
    },
  };

  if (options.attachments_binary) {
    (body.email as Record<string, unknown>).attachments_binary = options.attachments_binary;
  }

  const res = await fetch("https://api.sendpulse.com/smtp/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`SendPulse send failed: ${res.status} ${text}`);
  }
}

// ─── Preference Filter (private) ──────────────────────────────
// Returns string[] of allowed user IDs (matches original contract)

async function filterRecipientsByPreference(
  storage: IStorage,
  userIds: string[],
  notificationType: EmailNotificationType
): Promise<string[]> {
  const allowedIds: string[] = [];
  for (const userId of userIds) {
    const shouldSend = await storage.shouldSendEmail(userId, notificationType);
    if (shouldSend) allowedIds.push(userId);
  }
  return allowedIds;
}

function logEmailSent(type: string, recipients: string[], entityId?: string) {
  console.log(`[EMAIL] ${type} enviado`, {
    type, recipients: recipients.join(", "), entityId: entityId || "—",
    timestamp: new Date().toISOString(),
  });
}

function logEmailSkipped(type: string, reason: string, userId?: string) {
  console.log(`[EMAIL] ${type} ignorado: ${reason}`, { userId });
}

// ─── All 15 exported email functions ──────────────────────────
// Pattern: each adds (env: EmailEnv, ...) as first param.
// Functions using storage receive (env, storage, ...).
// Replace: transporter.sendMail({from,to,subject,html}) → sendMail(env, {to,subject,html})
// Replace: BASE_URL → env.APP_URL

export type EmailEnv = SendPulseEnv;

// ── SEM verificacao de preferencia (system emails) ──

// 1
export async function sendPasswordResetEmail(
  env: EmailEnv, user: User, temporaryPassword: string
): Promise<void> {
  const html = emailTemplate({
    title: "Redefinicao de Senha",
    greeting: `Ola ${user.name},`,
    body: `
      <p style="color:#334155;font-size:15px;line-height:1.6;">Recebemos uma solicitacao para redefinir sua senha no Renov Home.</p>
      ${sectionCard(`
        <div style="text-align:center;">
          <p style="color:#64748b;font-size:13px;margin:0 0 8px;">Sua nova senha temporaria</p>
          <p style="font-size:24px;font-weight:700;letter-spacing:3px;color:#1a1a2e;margin:0;padding:12px;background:white;border-radius:8px;">${temporaryPassword}</p>
        </div>
      `)}
      <p style="color:#334155;font-size:14px;line-height:1.6;">Use esta senha para acessar o sistema.</p>
    `,
    ctaText: "Acessar o Sistema",
    ctaUrl: `${env.APP_URL}/login`,
  });

  await sendMail(env, {
    to: [{ name: user.name, email: user.email }],
    subject: "Renov Home - Redefinicao de Senha",
    html,
  });
  logEmailSent("password_reset", [user.email]);
}

// 2
export async function sendWelcomeEmail(
  env: EmailEnv, user: User, initialPassword: string
): Promise<{ success: boolean; error?: string }> {
  // Implementer: read server/email-service.ts L120-170, translate template.
  // Same pattern as sendPasswordResetEmail — no preference filter.
  // Returns { success, error } (not void).
  throw new Error("TODO: implement from server/email-service.ts L120-170");
}

// ── COM verificacao de preferencia (notification emails) ──

// 3
export async function sendTicketCreatedEmail(
  env: EmailEnv, storage: IStorage,
  ticket: Ticket, requester: User, assignee: User | null
): Promise<void> {
  // Implementer: read server/email-service.ts L172-238.
  // Filters via: filterRecipientsByPreference(storage, [...], "ticket_new")
  throw new Error("TODO: implement from server/email-service.ts L172-238");
}

// 4
export async function sendTicketAssignedEmail(
  env: EmailEnv, storage: IStorage,
  ticket: Ticket, assignee: User
): Promise<void> {
  // read L240-296, filter "ticket_assigned"
  throw new Error("TODO: implement");
}

// 5
export async function sendTicketStatusChangedEmail(
  env: EmailEnv, storage: IStorage,
  ticket: Ticket, oldStatus: string, newStatus: string, changedBy: User
): Promise<void> {
  // read L297-356, filter "ticket_status"
  throw new Error("TODO: implement");
}

// 6
export async function sendTicketCommentEmail(
  env: EmailEnv, storage: IStorage,
  ticket: Ticket, comment: TicketComment, commenter: User, ticketRequester: User
): Promise<void> {
  // read L357-418, filter "ticket_comment"
  throw new Error("TODO: implement");
}

// 7
export async function sendCSATReceivedEmail(
  env: EmailEnv, storage: IStorage,
  ticket: Ticket, rating: number, comment: string | null, assignee: User
): Promise<void> {
  // read L419-473
  throw new Error("TODO: implement");
}

// 8
export async function sendCardStatusChangedEmail(
  env: EmailEnv, storage: IStorage,
  card: KanbanCard, project: Project, oldStatus: string, newStatus: string, changedBy: User
): Promise<void> {
  // read L474-539, filter "project_card_status"
  throw new Error("TODO: implement");
}

// 9
export async function sendCardAssignedEmail(
  env: EmailEnv, storage: IStorage,
  card: KanbanCard, project: Project, assignee: User, assignedBy: User
): Promise<void> {
  // read L540-594, filter "project_card_assigned"
  throw new Error("TODO: implement");
}

// 10
export async function sendProjectMemberAddedEmail(
  env: EmailEnv, storage: IStorage,
  project: Project, member: User, addedBy: User
): Promise<void> {
  // read L595-649, filter "project_update"
  throw new Error("TODO: implement");
}

// 11
export async function sendCardCommentEmail(
  env: EmailEnv, storage: IStorage,
  card: KanbanCard, project: Project, commentContent: string, commenter: User
): Promise<void> {
  // read L650-703, filter "project_card_status"
  throw new Error("TODO: implement");
}

// 12 — uses ICS attachment
export async function sendMeetingInviteEmail(
  env: EmailEnv, storage: IStorage,
  task: Task, organizer: User, participants: User[]
): Promise<void> {
  // read L816-941
  // Generate ICS: generateICSContent(meetingData, attendeesList)
  // Attach via: attachments_binary: { "invite.ics": btoa(icsContent) }
  // Filters via "meeting_invite"
  throw new Error("TODO: implement");
}

// 13 — NO preference filter (sends to all participants)
export async function sendMeetingUpdatedEmail(
  env: EmailEnv,
  task: Task, organizer: User, participants: User[]
): Promise<void> {
  // read L942-1020
  // Does NOT filter by preference — sends to ALL participants
  // No storage parameter needed for this function
  throw new Error("TODO: implement");
}

// 14
export async function sendMentionNotificationEmail(
  env: EmailEnv, storage: IStorage,
  mentionedUser: User, mentionerName: string, taskTitle: string, taskId: string
): Promise<void> {
  // read L1021-1062, filter "mention"
  throw new Error("TODO: implement");
}

// 15
export async function sendSharedAreaInviteEmail(
  env: EmailEnv, storage: IStorage,
  invitedUser: User, areaName: string, areaId: string, invitedBy: User
): Promise<void> {
  // read L1063-end
  throw new Error("TODO: implement");
}
```

**Para o implementer:** As 15 funcoes acima tem as assinaturas corretas com tipos exatos.
Funcoes 2-15 tem `throw new Error("TODO")` — o implementer DEVE:
1. Ler `server/email-service.ts` (1.098 linhas) para copiar o corpo de cada funcao
2. Ler `server/email-templates.ts` (340 linhas) — pure functions, reutilizadas via import
3. Substituir `transporter.sendMail({from,to,subject,html})` → `sendMail(env, {to:[{name,email}],subject,html})`
4. Substituir `BASE_URL` → `env.APP_URL`
5. `sendMeetingInviteEmail` usa `generateICSContent()` de `./ics.ts` e envia via `attachments_binary: { "invite.ics": btoa(icsContent) }`
6. `sendMeetingUpdatedEmail` NAO filtra por preferencia (envia para todos)
7. O `sendPasswordResetEmail` ja esta completo como referencia do padrao

**Nota sobre `server/ai/services/email.service.ts`:** Segunda instancia de nodemailer (69 linhas), usada apenas por AI agents. AI agents estao fora de escopo (spec secao 3.5). Nao migrar nesta sub-fase.

- [ ] **Step 3: Verify TypeScript compiles**

Run (from worker dir): `cd worker && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add worker/src/lib/email.ts
git commit -m "feat(worker): add SendPulse email service (15 functions)"
```

---

## Chunk 3: Client Auth — Core Infrastructure

### Task 7: Create AuthProvider and useAuth hook

**Files:**
- Create: `client/src/contexts/auth-context.tsx`

This is the NEW central auth state for the app. It replaces all localStorage-based auth.

- [ ] **Step 1: Create the AuthProvider**

```typescript
// client/src/contexts/auth-context.tsx
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { CurrentUser } from "@/lib/permissions";

interface AuthContextValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: CurrentUser) => void;
  logout: () => Promise<void>;
  updateUser: (partial: Partial<CurrentUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, check session via /api/auth/me
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.user) {
            const u = data.user;
            // Normalize isAdmin
            const adminValue = u.isAdmin ?? u.is_admin;
            u.isAdmin = adminValue === true || adminValue === "true" || adminValue === 1;
            setUser(u);
          }
        }
      } catch {
        // session invalid — stay logged out
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    checkSession();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback((u: CurrentUser) => {
    const adminValue = u.isAdmin ?? (u as any).is_admin;
    u.isAdmin = adminValue === true || adminValue === "true" || adminValue === 1;
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore — always clear local state
    }
    setUser(null);
    // Broadcast to other tabs
    try {
      const bc = new BroadcastChannel("renov-auth");
      bc.postMessage({ type: "logout" });
      bc.close();
    } catch {
      // BroadcastChannel not supported — ignore
    }
  }, []);

  const updateUser = useCallback((partial: Partial<CurrentUser>) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : null));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/contexts/auth-context.tsx
git commit -m "feat(auth): create AuthProvider + useAuth hook (cookie-based)"
```

---

### Task 8: Refactor `queryClient.ts` — remove Bearer, add API base URL

**Files:**
- Modify: `client/src/lib/queryClient.ts`

- [ ] **Step 1: Rewrite queryClient.ts**

Replace the entire file content:

```typescript
import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

let _handlingUnauthorized = false;

async function tryRefreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

function handleUnauthorized() {
  if (window.location.pathname === "/login") return;
  if (_handlingUnauthorized) return;
  _handlingUnauthorized = true;
  window.location.href = "/login";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) {
      handleUnauthorized();
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Wrapper para fetch que envia cookies automaticamente.
 * Substitui o antigo fetchWithAuth (que injetava Bearer token).
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;

  let response = await fetch(fullUrl, {
    ...options,
    credentials: "include",
    headers,
  });

  // On 401, try refresh token once, then retry
  if (response.status === 401 && !url.includes("/api/auth/")) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      response = await fetch(fullUrl, {
        ...options,
        credentials: "include",
        headers,
      });
    }
    if (response.status === 401) {
      handleUnauthorized();
    }
  }

  return response;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = {};

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;

  let res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // On 401, try refresh then retry
  if (res.status === 401 && !url.includes("/api/auth/")) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      res = await fetch(fullUrl, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;

    let res = await fetch(fullUrl, {
      credentials: "include",
    });

    // On 401, try refresh then retry
    if (res.status === 401 && !url.includes("/api/auth/")) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        res = await fetch(fullUrl, { credentials: "include" });
      }
    }

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      handleUnauthorized();
      throw new Error("401: Nao autenticado");
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
```

**Key changes:**
- Removed all `getAuthToken()` / `Authorization: Bearer` injection
- Added `API_BASE` prefix (from `VITE_API_BASE_URL`)
- Added `tryRefreshToken()` with auto-retry on 401
- Kept `fetchWithAuth` name to minimize caller changes (17 files import it)
- Removed import of `clearAuth` and `getAuthToken` from `@/lib/auth`

**Nota sobre 401 handling:** `handleUnauthorized()` faz redirect para `/login` mas nao limpa o estado do `AuthProvider` diretamente. Isso e intencional: ao carregar `/login`, o `AuthProvider.checkSession()` chama `GET /api/auth/me`, recebe 401 (cookie expirado), e mantem `user = null`. O fluxo e implicito mas correto — nao precisa de evento customizado.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run check`
Expected: May show errors in files still importing from `@/lib/auth` — that's expected and will be fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/queryClient.ts
git commit -m "refactor(auth): remove Bearer token, add cookie credentials + refresh retry"
```

---

### Task 9: Mark `permissions.ts` functions as deprecated (keep functional)

**Files:**
- Modify: `client/src/lib/permissions.ts`

**Estrategia:** NÃO quebrar `getCurrentUser()` agora — ela continua funcional lendo de localStorage durante a migracao. Apenas marcar como `@deprecated`. Apos Tasks 11-14 migrarem todos os callers para `useAuth()`, a Task 15 deleta `auth.ts` e a funcao ja nao sera mais chamada.

- [ ] **Step 1: Add deprecation annotations**

Add `@deprecated` JSDoc to `getCurrentUser()`, `hasModulePermission()`, and `isAdmin()`:

```typescript
/**
 * @deprecated Use useAuth().user instead. Will be removed after all callers migrate.
 */
export function getCurrentUser(): CurrentUser | null {
  // Keep existing implementation during migration
```

Nao mudar o corpo das funcoes — apenas adicionar `@deprecated`.

- [ ] **Step 2: Commit**

```bash
git add client/src/lib/permissions.ts
git commit -m "refactor(auth): deprecate getCurrentUser, hasModulePermission, isAdmin"
```

---

### Task 10: Rewrite `useAuthSync.ts` — BroadcastChannel

**Files:**
- Modify: `client/src/hooks/useAuthSync.ts`

- [ ] **Step 1: Rewrite with BroadcastChannel**

```typescript
/**
 * useAuthSync — Cross-tab auth sync via BroadcastChannel.
 * Replaces the old localStorage-based storage events.
 */
import { useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";

export function useAuthSync() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const auth = useAuth();

  // Listen for logout from other tabs
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("renov-auth");
      bc.onmessage = (event) => {
        if (event.data?.type === "logout") {
          queryClient.clear();
          if (window.location.pathname !== "/login") {
            setLocation("/login");
          }
        }
      };
    } catch {
      // BroadcastChannel not supported
    }

    return () => {
      bc?.close();
    };
  }, [queryClient, setLocation]);

  const logout = useCallback(async () => {
    await auth.logout();
    queryClient.clear();
    setLocation("/login");
  }, [auth, queryClient, setLocation]);

  return {
    logout,
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/hooks/useAuthSync.ts
git commit -m "refactor(auth): rewrite useAuthSync with BroadcastChannel"
```

---

## Chunk 4: Client Auth — Migration + Cleanup

### Task 11: Update ProtectedRoute to use useAuth

**Files:**
- Modify: `client/src/components/protected-route.tsx`

- [ ] **Step 1: Rewrite ProtectedRoute**

```typescript
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { getUserPermissions, type UserPermissions } from "@/lib/permissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: keyof UserPermissions;
}

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      setLocation("/login");
      return;
    }

    if (!requiredPermission) {
      setHasAccess(true);
      return;
    }

    if (user.isAdmin) {
      setHasAccess(true);
      return;
    }

    const permissions = getUserPermissions(user);
    if (permissions[requiredPermission]) {
      setHasAccess(true);
    } else {
      setLocation("/");
    }
  }, [requiredPermission, setLocation, user, isAuthenticated, isLoading]);

  if (isLoading || hasAccess === null) {
    return null;
  }

  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/protected-route.tsx
git commit -m "refactor(auth): update ProtectedRoute to use useAuth"
```

---

### Task 12: Update `login.tsx` — remove saveAuth, use auth.login()

**Files:**
- Modify: `client/src/pages/login.tsx`

- [ ] **Step 1: Add useAuth import and remove saveAuth usage**

At the top, add:
```typescript
import { useAuth } from "@/contexts/auth-context";
```

Inside `LoginPage()`, add:
```typescript
const auth = useAuth();
```

- [ ] **Step 2: Update onSubmit handler (around line 120-161)**

Replace the success block in `onSubmit`:

```typescript
if (result.success) {
  setLoginSuccess(true);

  // Login via context (cookies already set by server response)
  auth.login(result.user);

  // Show success animation before redirect
  setTimeout(() => {
    toast({ title: "Login realizado com sucesso!" });
    setLocation("/");
  }, 800);
}
```

Remove the old lines:
```typescript
// DELETE these:
const { saveAuth } = await import("@/lib/auth");
saveAuth({
  token: result.token || `session_${result.user.id}_${Date.now()}`,
  user: result.user
});
```

- [ ] **Step 3: Verify no remaining `@/lib/auth` imports in login.tsx**

Search for `@/lib/auth` in the file — should be zero after this change.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/login.tsx
git commit -m "refactor(auth): update login.tsx to use auth.login() context"
```

---

### Task 13: Migrate 8 files with local getCurrentUser() to useAuth()

**Files to modify (each has a local `getCurrentUser()` function reading from localStorage/sessionStorage):**

1. `client/src/components/app-sidebar.tsx` — also has 2 dynamic imports of `@/lib/auth` for `clearAuth`
2. `client/src/components/notification-bell.tsx`
3. `client/src/pages/fluxogramas/index.tsx`
4. `client/src/pages/fluxogramas/editor.tsx`
5. `client/src/pages/metas/index.tsx`
6. `client/src/pages/metas/gestao.tsx`
7. `client/src/pages/updates/index.tsx`
8. `client/src/pages/diagramas/index.tsx`

**For each file, the pattern is:**

- [ ] **Step 1: Read the file to find the local `getCurrentUser()` function**

It will look like:
```typescript
function getCurrentUser() {
  try {
    const userStr = localStorage.getItem("user_data") || sessionStorage.getItem("user");
    // ... parse and return
  } catch { return null; }
}
```

- [ ] **Step 2: Replace with useAuth()**

1. Add import at top: `import { useAuth } from "@/contexts/auth-context";`
2. Inside the component function, add: `const { user: currentUser } = useAuth();`
3. Delete the local `getCurrentUser()` function
4. Replace all calls to `getCurrentUser()` with `currentUser`
5. If the component uses the result in `useEffect` or other hooks, make sure `currentUser` is in the dependency array

**For `app-sidebar.tsx` specifically:**
- Also remove the 2 dynamic imports: `const { clearAuth } = await import("@/lib/auth");` (lines 329, 688)
- Replace with `auth.logout()` from `useAuth()`

- [ ] **Step 3: Verify TypeScript compiles after each file**

Run: `npm run check`

- [ ] **Step 4: Commit after all 8 files**

```bash
git add client/src/components/app-sidebar.tsx client/src/components/notification-bell.tsx \
  client/src/pages/fluxogramas/index.tsx client/src/pages/fluxogramas/editor.tsx \
  client/src/pages/metas/index.tsx client/src/pages/metas/gestao.tsx \
  client/src/pages/updates/index.tsx client/src/pages/diagramas/index.tsx
git commit -m "refactor(auth): migrate 8 files from local getCurrentUser to useAuth"
```

---

### Task 14: Migrate remaining getCurrentUser importers to useAuth

**Files:** ~20 files that import `getCurrentUser` from `@/lib/permissions`.

Run this search to find them all:
```bash
grep -rn "getCurrentUser" client/src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v "permissions.ts" | grep -v "auth-context.tsx"
```

For each file found:
1. Add `import { useAuth } from "@/contexts/auth-context";`
2. Replace `getCurrentUser()` calls with `useAuth().user` (or destructured `const { user } = useAuth()`)
3. If the file uses `hasModulePermission()` or `isAdmin()` from permissions.ts, replace with logic using `useAuth().user`
4. Remove the import of `getCurrentUser` from `@/lib/permissions` if no longer needed
5. Keep the import of `getUserPermissions` and `UserPermissions` type if still used

- [ ] **Step 1: Find and list all remaining files**

```bash
grep -rn "getCurrentUser" client/src/ --include="*.tsx" --include="*.ts"
```

- [ ] **Step 2: Migrate each file following the pattern above**

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -u client/src/
git commit -m "refactor(auth): migrate all getCurrentUser callers to useAuth"
```

---

### Task 15: Delete `client/src/lib/auth.ts` and wire AuthProvider in App.tsx

**Files:**
- Delete: `client/src/lib/auth.ts`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Verify no remaining imports of `@/lib/auth`**

```bash
grep -rn "@/lib/auth" client/src/ --include="*.tsx" --include="*.ts"
```

Expected: ZERO results. If any remain, fix them first.

- [ ] **Step 2: Delete `client/src/lib/auth.ts`**

```bash
rm client/src/lib/auth.ts
```

- [ ] **Step 3: Wrap App with AuthProvider**

In `client/src/App.tsx`, add the import:
```typescript
import { AuthProvider } from "@/contexts/auth-context";
```

**IMPORTANT:** O `App()` atual tem estrutura split — renderiza JSX diferente para login vs paginas autenticadas, e `useAuthSync()` e chamado no topo. O `AuthProvider` DEVE envolver ambos os branches para que `useAuth()` funcione em qualquer pagina.

A App function atual (linhas 415-467):
```typescript
function App() {
  const [location] = useLocation();
  const isLoginPage = location === "/login";
  useAuthSync(); // <-- usa useAuth() internamente

  if (isLoginPage) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>...</ThemeProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>...</ThemeProvider>
    </QueryClientProvider>
  );
}
```

**Problema:** `useAuthSync()` chama `useAuth()` que precisa de `AuthProvider` como ancestor. Mas `AuthProvider` esta DENTRO dos returns que vem DEPOIS do hook.

**Solucao:** Extrair o conteudo para um componente filho e colocar `AuthProvider` no topo:

```typescript
function AppContent() {
  const [location] = useLocation();
  const isLoginPage = location === "/login";
  useAuthSync();

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  if (isLoginPage) {
    return (
      <ThemeProvider>
        <TooltipProvider>
          <div className="flex h-screen w-full overflow-hidden">
            <main className="flex-1 overflow-auto">
              <Suspense fallback={null}>
                <Router />
              </Suspense>
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <TooltipProvider>
        <Suspense fallback={null}>
          <SidebarProvider style={sidebarStyle as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <main className="flex-1 overflow-auto">
                <Suspense fallback={null}>
                  <Router />
                </Suspense>
              </main>
            </div>
          </SidebarProvider>
        </Suspense>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

Assim `AuthProvider` envolve tudo, e `useAuthSync()` (que usa `useAuth()`) esta dentro dele.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run check`
Expected: PASS with zero references to deleted `auth.ts`

- [ ] **Step 5: Commit**

```bash
git rm client/src/lib/auth.ts
git add client/src/App.tsx client/src/contexts/auth-context.tsx
git commit -m "refactor(auth): delete auth.ts, wire AuthProvider in App.tsx"
```

---

## Chunk 5: Cloudflare Pages Setup

### Task 16: Remove Replit plugins from vite.config.ts

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Rewrite vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
```

**Changes:**
- Removed `runtimeErrorOverlay` import and usage
- Removed `cartographer` and `devBanner` conditional plugins
- Kept `server.fs` config (still useful for local dev security)

- [ ] **Step 2: Commit**

```bash
git add vite.config.ts
git commit -m "chore(vite): remove Replit plugins, simplify config for Pages"
```

---

### Task 17: Add `build:client` script and `.env` for VITE_API_BASE_URL

**Files:**
- Modify: `package.json` (root)
- Create: `client/.env.development`
- Create: `client/.env.production`

- [ ] **Step 1: Add build:client script to root package.json**

Add to the `"scripts"` section:

```json
"build:client": "cd client && vite build"
```

The existing `"build"` script uses a custom `scripts/build.ts` for the Express server bundle. The new `build:client` is specifically for Cloudflare Pages.

- [ ] **Step 2: Create env files for VITE_API_BASE_URL**

`client/.env.development`:
```
VITE_API_BASE_URL=
```

(Empty = same-origin, for local dev with proxy)

`client/.env.production`:
```
VITE_API_BASE_URL=https://homeapi.renovsmart.com.br
```

**Nota:** Confirmar com o time o dominio correto da API de producao. O `wrangler.toml` usa `APP_URL=https://home-next.renovsmart.com.br` que pode ser diferente do dominio da API. Ajustar conforme necessario.

**Note:** The dev environment URL will be set in Cloudflare Pages dashboard as a build environment variable: `VITE_API_BASE_URL=https://homeapi-dev.renovsmart.com.br`

- [ ] **Step 3: Add `.env*` files to .gitignore if not already there**

Check if `client/.env.production` should be committed or kept local. Since it contains no secrets (just a public URL), it can be committed.

- [ ] **Step 4: Verify client builds**

Run: `npm run build:client`
Expected: Vite builds successfully to `dist/public/`

- [ ] **Step 5: Commit**

```bash
git add package.json client/.env.development client/.env.production
git commit -m "feat(pages): add build:client script and API base URL env"
```

---

### Task 18: Cloudflare Pages configuration (manual steps)

This task involves Cloudflare Dashboard configuration — NOT code changes. Document for the team:

- [ ] **Step 1: Connect repo to Cloudflare Pages**

In Cloudflare Dashboard > Pages:
1. Create new project
2. Connect GitHub repo: `Renov-BD/Renov.Home` (or whatever the org/repo name is)
3. Framework preset: None (custom)
4. Build command: `npm run build:client`
5. Build output directory: `dist/public`
6. Root directory: `/` (root of the repo)
7. Environment variable: `VITE_API_BASE_URL=https://homeapi-dev.renovsmart.com.br`

- [ ] **Step 2: Configure custom domain**

In Pages project settings > Custom domains:
1. Add `home-dev.renovsmart.com.br` (preview/dev)
2. Future: `home-next.renovsmart.com.br` (production)

- [ ] **Step 3: Configure branch deployments**

1. Production branch: `main`
2. Preview branches: `develop`, `feat/*`

- [ ] **Step 4: Test deployment**

Push to develop and verify:
1. Pages builds successfully
2. `home-dev.renovsmart.com.br` loads the frontend
3. Login flow works end-to-end (Pages → Worker API → cookie → authenticated requests)

---

## Verification Checklist (end of 2A)

After all tasks are complete, verify these success criteria from the spec:

- [ ] `getStorage(db)` works in Worker AND `storage` singleton continues working in Express
- [ ] Email via SendPulse sends at least `sendWelcomeEmail` successfully
- [ ] Client does login via cookies, `GET /api/auth/me` returns user, logout clears session
- [ ] Pages deploys at `home-dev.renovsmart.com.br` and loads the frontend
- [ ] Full flow: Pages → login → dashboard works end-to-end

**Test commands:**

```bash
# TypeScript compiles
npm run check

# Client builds
npm run build:client

# Worker deploys (dry run)
cd worker && npx wrangler deploy --dry-run --env dev

# Express still works (verify manually)
npm run dev
```
