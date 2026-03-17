# Fase 2 — Migracao Express -> Hono (Cloudflare Workers)

**Data:** 2026-03-17
**Status:** Revisado (v4 — 3 rounds de review, verificacao cruzada com codigo-fonte)
**Autor:** Marcelo + Claude
**Pre-requisito:** Fase 1 concluida (PR #115) — Worker Hono com auth + settings deployado em `homeapi-dev.renovsmart.com.br`

---

## 1. Contexto

A Fase 1 entregou o Worker Hono com 2 rotas PoC (auth, settings). A Fase 2 migra as 21 rotas Express restantes (23 total menos 2 ja migradas), refatora a camada de dados, substitui dependencias incompativeis com Workers, e adapta o client para o novo modelo de auth (cookies httpOnly).

**Escopo total:** 21 rotas (~311 handlers), 1 camada de dados (3.400 linhas, ~269 metodos), 1 email service (15 funcoes + templates), refactor do client auth (~35-40 arquivos afetados), e setup do Cloudflare Pages.

## 2. Decisoes de Arquitetura

| Decisao | Escolha | Motivo |
|---|---|---|
| Email service | **SendPulse** (API REST) | Conta ja existente; API HTTP compativel com Workers |
| storage.ts | **Factory pattern** (`getStorage(db)`) | Preserva logica testada, menor risco, refactor mecanico |
| bwip-js (barcode) | **Testar com `nodejs_compat`** | Testar antes de reescrever; se falhar, avaliar fallback |
| xlsx (planilhas) | **SheetJS mini** (`xlsx/dist/xlsx.mini.min.js`) | Versao sem `fs`, compativel com Workers |
| Client auth | **Refactor na sub-fase 2A** | Necessario para testar qualquer rota no Worker |
| Pages deploy | **Setup na sub-fase 2A** | Ambiente completo (Pages + Worker) desde o inicio |
| Cache Omie | **Tabelas no Neon** | Workers nao tem estado entre requests; banco e persistente |

## 3. Sub-fases

### 3.1. Sub-fase 2A — Infraestrutura

Prepara toda a base para que as sub-fases seguintes sejam traducao mecanica Express -> Hono.

#### 3.1.1. Factory `getStorage(db)`

**Problema:** `storage.ts` e uma classe `DatabaseStorage` que implementa `IStorage`. O `db` e importado como global de `server/db.ts`:

```typescript
// Hoje (server/storage.ts)
import { db } from "./db";

export class DatabaseStorage implements IStorage {
  async getTickets() {
    return db.select().from(tickets); // db global
  }
  // ~269 metodos
}
export const storage = new DatabaseStorage();
```

**Solucao:** Adicionar `db` como parametro do construtor, trocar todas as referencias internas de `db.` para `this.db.`:

```typescript
// Depois (server/storage.ts — retrocompativel com Express)
import { db as defaultDb } from "./db";

// Tipo Database derivado do retorno de drizzle()
// db em server/db.ts pode ser null; o tipo util e NonNullable<typeof db>
export type Database = NonNullable<typeof defaultDb>;

export class DatabaseStorage implements IStorage {
  constructor(private db: Database = defaultDb!) {}

  async getTickets() {
    return this.db.select().from(tickets); // this.db
  }
}

// Express continua funcionando (usa default)
export const storage = new DatabaseStorage();

// Worker usa factory
export function getStorage(db: Database): IStorage {
  return new DatabaseStorage(db);
}
```

**Nota sobre tipos:** O `db` em `server/db.ts` e `DrizzleInstance | null` (`export const db = pool ? drizzle(pool, { schema }) : null`). O tipo `Database` deve ser `NonNullable<typeof db>`. O Worker tem seu proprio tipo `Database` em `worker/src/lib/db.ts` (neon-http driver) — os dois tipos sao diferentes mas a interface `IStorage` abstrai isso. O Worker usa `getStorage()` com seu proprio db instance via `createDb()`.

**Escopo:** ~269 metodos precisam trocar `db.` por `this.db.`. Refactor interno da classe inteira. A interface `IStorage` e o contrato externo nao mudam. As ~256 guards `if (!db)` que existem nos metodos viram `if (!this.db)` — codigo legado que pode ser removido gradualmente.

**Retrocompatibilidade:** O Express continua importando `storage` (singleton com `db` default). O Worker usa `getStorage(c.get("db"))`. Ambos coexistem durante a migracao.

#### 3.1.2. Email service: nodemailer -> SendPulse

**Problema:** `email-service.ts` (1.098 linhas) exporta **15 funcoes de email** + helper de filtragem por preferencia. Usa `nodemailer` (SMTP). Importa `storage` como singleton (5 chamadas diretas a `storage.shouldSendEmail()`). Dependencia: `email-templates.ts` (340 linhas) com builders HTML, badges de status. Funcoes ICS calendar (`generateICSContent`, `escapeICSText`, `escapeICSParam`, `foldICSLine`) estao em `email-service.ts` (linhas 707-813), NAO em `email-templates.ts`.

**Segunda instancia de nodemailer:** `server/ai/services/email.service.ts` (69 linhas) — usado pelos AI agents. Deve ser migrada tambem para SendPulse ou removida se nenhuma rota Phase 2 a referencia.

**As 15 funcoes:**
1. `sendPasswordResetEmail`
2. `sendWelcomeEmail`
3. `sendTicketCreatedEmail`
4. `sendTicketAssignedEmail`
5. `sendTicketStatusChangedEmail`
6. `sendTicketCommentEmail`
7. `sendCSATReceivedEmail`
8. `sendCardStatusChangedEmail`
9. `sendCardAssignedEmail`
10. `sendProjectMemberAddedEmail`
11. `sendCardCommentEmail`
12. `sendMeetingInviteEmail`
13. `sendMeetingUpdatedEmail`
14. `sendMentionNotificationEmail`
15. `sendSharedAreaInviteEmail`

**Helper interno (nao exportado):** `filterRecipientsByPreference(userIds, notificationType)` — funcao privada do modulo que consulta preferencias do usuario no banco antes de enviar. Na migracao, recriar internamente no email service do Worker.

**Solucao:** Criar `worker/src/lib/email.ts` que:
- Substitui `nodemailer.sendMail()` por `fetch()` na API SMTP do SendPulse
- Preserva todas as 15 funcoes — assinatura muda para receber `storage: IStorage` (ou `db`) como primeiro parametro, ja que o email service precisa consultar preferencias via `storage.shouldSendEmail()`
- Reutiliza `email-templates.ts` (HTML builders sao pure functions, dependem apenas de `date-fns` e `date-fns-tz` — ambas pure JS, compativeis com Workers)
- Extrai funcoes ICS de `email-service.ts` (linhas 707-813) para `worker/src/lib/ics.ts` (pure functions, sem dependencia)
- `sendMeetingInviteEmail` envia ICS como attachment — verificar se a API SMTP do SendPulse suporta attachments inline (campo `attachments_binary` na API)
- `sendMeetingUpdatedEmail` NAO filtra por preferencia (envia para todos os participantes) — manter esse comportamento
- `filterRecipientsByPreference` recebe `storage: IStorage` como parametro

**API SendPulse SMTP:** `POST https://api.sendpulse.com/smtp/emails` com OAuth2 token. Autenticacao: `POST https://api.sendpulse.com/oauth/access_token` com `client_id` + `client_secret`.

**Novos secrets no wrangler.toml:**
- `SENDPULSE_CLIENT_ID`
- `SENDPULSE_CLIENT_SECRET`
- `SENDPULSE_FROM_EMAIL`
- `SENDPULSE_FROM_NAME`

**Novos bindings no `AppEnv.Bindings`:** Os 4 acima. Remover `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`.

#### 3.1.3. Client auth refactor

**Problema:** O client usa `localStorage` + header `Authorization: Bearer`. Nao existe React Context para auth. O Worker usa cookies `httpOnly` (browser envia automaticamente).

**Estado atual:**
- `client/src/lib/auth.ts` — `saveAuth()`, `getAuthToken()`, `getAuthUser()`, `clearAuth()`, `isAuthenticated()`, `updateAuthUser()`
- `client/src/lib/queryClient.ts` — `fetchWithAuth()` injeta `Authorization: Bearer`, 51 ocorrencias em 17 arquivos (concentradas no modulo `estoques`). Tambem exporta `apiRequest` e `getQueryFn` que usam `fetchWithAuth` internamente
- `client/src/lib/permissions.ts` — `getCurrentUser()` le de localStorage
- `client/src/hooks/useAuthSync.ts` — sync multi-tab via storage events
- `client/src/components/protected-route.tsx` — le de `getCurrentUser()` (localStorage)
- `client/src/pages/login.tsx` — chama `saveAuth({ token, user })`

**Solucao (8 passos):**

**Passo 1: Criar `AuthProvider` + `useAuth()`**

```typescript
// client/src/contexts/auth-context.tsx (novo)
interface AuthContextValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  login: (user: CurrentUser) => void;
  logout: () => void;
  updateUser: (user: Partial<CurrentUser>) => void;
}
```

Estado reativo em React (`useState`). Inicializa chamando `GET /api/auth/me` (nao localStorage).

**Passo 2: Atualizar `queryClient.ts`**

- `fetchWithAuth()` → renomear para `apiFetch()` (nao carrega mais token)
- Remover injecao de `Authorization: Bearer` header
- Manter `credentials: "include"` (envia cookies automaticamente)
- Reescrever interceptor 401: `POST /api/auth/refresh` → retry → falha → redirect `/login`
- Adicionar `VITE_API_BASE_URL` como prefixo de todas as URLs

**Passo 3: Atualizar `permissions.ts`**

- `getCurrentUser()` → recebe `user` como parametro (ou importa do context)
- Eliminar leitura direta de localStorage/sessionStorage

**Passo 4: Atualizar `useAuthSync.ts`**

- Remover logica de storage events (nao ha mais token em localStorage)
- Manter sync de logout entre tabs via `BroadcastChannel` API (mais limpo)

**Passo 5: Atualizar `ProtectedRoute`**

- Usar `useAuth()` em vez de `getCurrentUser()` de localStorage

**Passo 6: Atualizar `login.tsx`**

- Remover `saveAuth({ token, user })` — cookies vem via `Set-Cookie`
- Chamar `auth.login(result.user)` do context apos resposta do server
- Remover dynamic import de `@/lib/auth`

**Passo 7: Atualizar todos os arquivos com copia local de `getCurrentUser()`**

8 arquivos definem sua propria funcao `getCurrentUser()` local (NAO importada de permissions.ts) que le de `localStorage`/`sessionStorage`. Todos devem migrar para `useAuth()`:

- `client/src/components/app-sidebar.tsx` (L181)
- `client/src/components/notification-bell.tsx` (L26)
- `client/src/pages/fluxogramas/index.tsx` (L51)
- `client/src/pages/fluxogramas/editor.tsx` (L121)
- `client/src/pages/metas/index.tsx` (L193)
- `client/src/pages/metas/gestao.tsx` (L118)
- `client/src/pages/updates/index.tsx` (L55)
- `client/src/pages/diagramas/index.tsx` (L48)

**Passo 8: Remover `client/src/lib/auth.ts`**

Arquivo inteiro deletado. Todas as importacoes redirecionadas para `useAuth()`.

**Impacto (~35-40 arquivos unicos):**
- `fetchWithAuth`: 17 arquivos (51 ocorrencias) — renomear import para `apiFetch`. Mudanca interna na funcao, callers nao precisam mudar logica
- `getCurrentUser` importado de `@/lib/permissions`: ~20 arquivos — migrar para `useAuth()`
- `getCurrentUser` copia local: 8 arquivos (listados no passo 7) — substituir por `useAuth()`
- `@/lib/auth` imports: 3 arquivos (1 estatico: `useAuthSync.ts`, 2 dinamicos: `app-sidebar.tsx`, `login.tsx`) — eliminar
- Sobreposicao entre grupos: varios arquivos aparecem em mais de uma categoria

#### 3.1.4. Cloudflare Pages setup

**Tarefas:**
1. Criar script `build:client` no `package.json` raiz: `cd client && vite build` (output: `dist/public/`)
2. Remover plugins Replit do `vite.config.ts`: `runtimeErrorOverlay`, `cartographer`, `devBanner`
3. Adicionar variavel `VITE_API_BASE_URL` (ex: `https://homeapi-dev.renovsmart.com.br`)
4. Conectar repo GitHub ao Cloudflare Pages
5. Configurar dominio `home-dev.renovsmart.com.br` → Pages
6. Build command: `npm run build:client`
7. Output directory: `dist/public`
8. Branch: `develop` (preview), `main` (producao futura)

**Vite config atualizado:**
- Remover imports de `@replit/vite-plugin-*`
- Manter aliases (`@`, `@shared`, `@assets`)

### 3.2. Sub-fase 2B — Rotas simples (9 rotas, ~40 handlers)

Traducao mecanica Express → Hono. Cada rota:
1. Criar `worker/src/routes/<nome>.ts`
2. `new Hono<AppEnv>()`
3. Traduzir handlers (mapeamento Express → Hono do spec Fase 1, secao 6)
4. Usar `getStorage(c.get("db"))` para chamadas de dados
5. Montar no `worker/src/index.ts`

#### Rotas:

| Rota | Handlers | Notas especificas |
|---|---|---|
| **users** | 5 | `sendWelcomeEmail()` e `sendPasswordResetEmail()` via SendPulse |
| **notifications** | 8 | CRUD de preferencias + estado de leitura |
| **slas** | 5 | CRUD regras SLA |
| **cep** | 2 | Passthrough `fetch()` para ViaCEP e Correios |
| **flowcharts** | 6 | CRUD + checagem de permissao por usuario |
| **updates** | 4 | CRUD changelog |
| **labels** | 3 | `bwip-js` para Code128 barcode (PNG base64). Testar com `nodejs_compat`. Rota `GET /api/etiquetas/barcode/:imei` e publica (ja no middleware auth) |
| **dev-tools** | 2 | Proxy SQL para `dash.renovsmart.com.br`. **Adicionar `requireAdmin`** (hoje nao tem auth). Rota sql-export usa `axios` com `responseType: "stream"` (Node.js streams) — trocar por `fetch()` com `response.body` (ReadableStream) |
| **ai** | 4 | SSE streaming — adaptar de `res.write()` para `ReadableStream`. **Grafo de dependencias (nao linear):** `ai.ts` importa diretamente de `openrouter.ts` E de `firecrawl-service.ts`. `openrouter.ts` importa de `external-data.ts` e `firecrawl-service.ts`. Modulos que precisam de factory: `openrouter.ts` (importa `storage` singleton + usa `process.env.OPENROUTER_API_KEY` em 3 pontos), `firecrawl-service.ts` (usa `process.env.FIRECRAWL_API_KEY`). `external-data.ts` usa apenas `fetch()` nativo (API Open-Meteo, sem key). Mais complexo que aparenta |

#### Nota sobre SSE (ai.ts)

Express usa:
```typescript
res.setHeader("Content-Type", "text/event-stream");
res.write(`data: ${JSON.stringify(chunk)}\n\n`);
```

Hono/Workers usa:
```typescript
return new Response(
  new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.close();
    }
  }),
  { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } }
);
```

### 3.3. Sub-fase 2C — Rotas de negocio (7 rotas, ~99 handlers)

#### Rotas:

| Rota | Handlers | Notas especificas |
|---|---|---|
| **pricing** | 17 | Proxy para API RenovSmart externa via `fetch()`. Depende de `server/services/pricing-service.ts` (201 linhas) — usa `fetch()` com URL hardcoded, compativel com Workers sem alteracoes |
| **omie** | 12 | Integracao ERP. Requer refactor de `omie.service.ts` (ver abaixo) |
| **integrations** | 11 | APIs externas (RenovSmart, Logistica Reversa) via `fetch()` |
| **okrs** | 12 | CRUD + permissoes por usuario |
| **metas** | 12 | CRUD com soft deletes |
| **knowledge** | 13 | Versionamento de documentos, audit logging |
| **git-analytics** | 22 | Auth por secret `X-Claude-Usage-Secret` (ja no middleware Fase 1) |

#### Refactor `omie.service.ts`

**Problema:** Singleton `omieService` usa `pool.query()` direto (raw SQL) para `omie_config` e `omie_sync_log`. Tambem usa `axios` para chamadas API com retry.

**Solucao:** Factory `getOmieService(db, env)`:
```typescript
export function getOmieService(db: Database, env: { OMIE_APP_KEY?: string; OMIE_APP_SECRET?: string }) {
  return {
    async getConfig() { /* db.select()... */ },
    async callApi(endpoint, call, params) { /* fetch() com retry */ },
    async testConnection() { ... },
    async logSync(data) { /* db.insert()... */ },
    async getSyncLogs(category, limit) { /* db.select()... */ },
  };
}
```

- Trocar `pool.query()` por queries Drizzle (`db.select()`, `db.insert()`)
- Trocar `axios` por `fetch()` nativo
- Manter retry com backoff exponencial (3 tentativas)

#### Tabelas de cache Omie (novas)

**Adicionar ao `shared/schema.ts`:**

```typescript
export const omieProdutosCache = pgTable("omie_produtos_cache", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id"),
  data: text("data").notNull(), // JSON stringified array
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const omiePosEstoqueCache = pgTable("omie_pos_estoque_cache", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id"),
  data: text("data").notNull(), // JSON stringified Map entries
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Servicos refatorados:** `worker/src/services/estoque-cache.ts` e `worker/src/services/estoque-pos-cache.ts`:
- Ler do banco: `SELECT data, updated_at FROM omie_produtos_cache WHERE tenant_id = ?`
- Se `updated_at` < 60 minutos atras, retornar `data` parseado
- Se expirado, chamar API Omie, salvar no banco, retornar
- Em caso de erro na API, retornar cache expirado (fallback de resiliencia)

### 3.4. Sub-fase 2D — Rotas pesadas (5 rotas, ~173 handlers)

**Ordem de migracao (crescente em complexidade):**

#### 1. tickets (15 handlers)

- Email: `sendTicketCreatedEmail`, `sendTicketAssignedEmail`, `sendTicketStatusChangedEmail`, `sendTicketCommentEmail`, `sendCSATReceivedEmail` — via SendPulse (pronto da 2A)
- Auto-assignment logic
- SLA tracking
- Todas as chamadas via `getStorage(db).getTickets()` etc.

#### 2. projects (28 handlers)

- Email: `sendCardStatusChangedEmail`, `sendCardAssignedEmail`, `sendProjectMemberAddedEmail`, `sendCardCommentEmail`, `sendMentionNotificationEmail` — via SendPulse
- Kanban (columns, cards, assignments)
- Colaboracao (membros, roles)

#### 3. tasks (40 handlers)

- Email: `sendMeetingInviteEmail`, `sendMeetingUpdatedEmail`, `sendSharedAreaInviteEmail` — via SendPulse
- Hierarquia de tarefas (`parentTaskId`)
- Reunioes recorrentes: pai com `isRecurring=true`, filhos com `parentTaskId` + `isRecurring=false`
- `meetingData` armazenado como JSON em campo TEXT
- SQL conditions construidas manualmente em `tasks.ts` (usa `sql` template literals do Drizzle) — traduzir direto para Hono com `c.get("db")`

#### 4. shipments (47 handlers)

- Barcode: `bwip-js` (mesmo que labels — resultado do teste na 2B define abordagem)
- Correios API: `correiosService` (`server/correios-service.ts`) — chamadas HTTP via `xml2js` (pure JS). **Usa `process.env.CORREIOS_*` (6 ocorrencias)** — precisa factory pattern `getCorreiosService(env)` para receber secrets do Worker context. Tambem usa `xml2js` para SOAP XML (compativel com Workers)
- Logistic operators CRUD
- Collection requests CRUD
- Reverse logistics (Correios integration)
- Maior numero de handlers — trabalho volumoso mas mecanico

#### 5. estoques (43 handlers, 2.782 linhas)

- **Maior complexidade da migracao inteira**
- **Bypass de storage:** Importa `db` diretamente para ~20 queries Drizzle. Na migracao, todas usam `c.get("db")` do contexto Hono
- **XLSX:** Trocar `import * as XLSX from "xlsx"` por `import * as XLSX from "xlsx/dist/xlsx.mini.min.js"`. Verificar que `XLSX.utils.json_to_sheet()`, `XLSX.utils.book_new()`, `XLSX.write(wb, { type: "buffer" })` funcionam na versao mini (suportam)
- **Exports multi-sheet:** 2 endpoints geram workbooks com ate 6 sheets (resumo, categoria, itens, faltas, sobras, ajustes) — SheetJS mini suporta multi-sheet
- **Omie integration:** Usa `omieService` e cache services — ja refatorados na 2C
- **Helpers internos:** `extrairCategoria()`, `extrairMarca()` — pure functions, copiar direto
- **Bug conhecido (L1994):** `storage.createTask(...)` e chamado mas `storage` nunca e importado nesse arquivo. Endpoint `POST /api/estoques/aging/criar-tarefa` da `ReferenceError` em runtime. Corrigir durante a migracao usando `getStorage(c.get("db")).createTask(...)`

### 3.5. Fora de escopo (Phase 2)

| Item | Motivo | Quando |
|---|---|---|
| Upload routes (Replit Object Storage → R2) | `server/replit_integrations/object_storage/routes.ts` sera substituido pelas rotas R2 descritas no spec Fase 1 (secao 5). Nao e migracao 1:1 — e rewrite. Incluir na Fase 3 (validacao) ou como work item separado |
| `server/ai/agents/` (5 agentes: Atena, Hermes, Argos, Zeus, Hefesto) | Hefesto usa `child_process.exec` (incompativel). Nenhuma rota Phase 2 chama os agents diretamente. Reavaliar se AI features precisam dos agents na Fase 5 |
| `server/services/prompts-sync.service.ts` | Usa `execSync` para `git clone`. Chamado apenas por cron job. Fase 5 |
| `server/services/translate-prompts.service.ts` | Cria seu proprio `new Pool()`. Chamado apenas por cron. Fase 5 |
| Cron jobs (recurrence, git-sync, prompts-sync) | Fase 5 — Cloudflare Cron Triggers |
| Rate limiting (login, forgot-password) | Fase 5 — Cloudflare KV |

## 4. Mapeamento Express -> Hono (referencia rapida)

| Express | Hono |
|---|---|
| `req.body` | `await c.req.json()` |
| `req.params.id` | `c.req.param("id")` |
| `req.query.status` | `c.req.query("status")` |
| `res.json(data)` | `return c.json(data)` |
| `res.status(404).json()` | `return c.json(data, 404)` |
| `req.session.userId` / `getSessionUser(req)` | `c.get("user").userId` |
| `req.session.isAdmin` | `c.get("user").role === "admin"` |
| `storage.fn()` | `getStorage(c.get("db")).fn()` |
| `res.write()` (SSE) | `ReadableStream` + `controller.enqueue()` |
| `res.set("Content-Type", ...)` | `c.header("Content-Type", ...)` ou headers no `new Response()` |
| `res.send(buffer)` | `return new Response(buffer, { headers })` |

## 5. Novos bindings e secrets

**Adicionar ao `wrangler.toml` (vars/secrets):**

| Binding | Tipo | Sub-fase |
|---|---|---|
| `SENDPULSE_CLIENT_ID` | Secret | 2A |
| `SENDPULSE_CLIENT_SECRET` | Secret | 2A |
| `SENDPULSE_FROM_EMAIL` | Var | 2A |
| `SENDPULSE_FROM_NAME` | Var | 2A |
| `OPENROUTER_API_KEY` | Secret (ja existe) | 2B |
| `FIRECRAWL_API_KEY` | Secret (ja existe) | 2B |
| `CORREIOS_*` (6 secrets) | Secret (ja existem) | 2D |

**Remover:** `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`

## 6. Alteracoes em `shared/schema.ts`

| Alteracao | Sub-fase |
|---|---|
| `omieProdutosCache` table | 2C |
| `omiePosEstoqueCache` table | 2C |

A tabela `refreshTokens` ja foi adicionada na Fase 1.

## 7. Estrutura final do Worker (pos-Fase 2)

```
worker/
  src/
    index.ts                    # Entry point — Hono app + middleware stack
    middleware/
      auth.ts                   # JWT validation (Fase 1)
      cors.ts                   # CORS config (Fase 1)
      error-handler.ts          # Error middleware (Fase 1)
    routes/
      auth.ts                   # (Fase 1)
      settings.ts               # (Fase 1)
      users.ts                  # 2B
      notifications.ts          # 2B
      slas.ts                   # 2B
      cep.ts                    # 2B
      flowcharts.ts             # 2B
      updates.ts                # 2B
      labels.ts                 # 2B
      dev-tools.ts              # 2B
      ai.ts                     # 2B
      pricing.ts                # 2C
      omie.ts                   # 2C
      integrations.ts           # 2C
      okrs.ts                   # 2C
      metas.ts                  # 2C
      knowledge.ts              # 2C
      git-analytics.ts          # 2C
      tickets.ts                # 2D
      projects.ts               # 2D
      tasks.ts                  # 2D
      shipments.ts              # 2D
      estoques.ts               # 2D
    services/
      omie.service.ts           # 2C — factory getOmieService(db, env)
      estoque-cache.ts          # 2C — cache Omie produtos (Neon)
      estoque-pos-cache.ts      # 2C — cache Omie pos estoque (Neon)
      correios.service.ts       # 2D — factory getCorreiosService(env)
      pricing.service.ts        # 2C — copiar direto (sem factory, URL hardcoded)
      openrouter.ts             # 2B — factory getOpenRouterService(storage, env)
      firecrawl.service.ts      # 2B — factory getFirecrawlService(env)
      external-data.ts          # 2B — copiar direto (usa fetch nativo, sem env/secrets)
    lib/
      db.ts                     # (Fase 1) — Neon + Drizzle
      crypto.ts                 # (Fase 1) — PBKDF2 + SHA-256
      jwt.ts                    # (Fase 1) — sign/verify/cookies
      email.ts                  # 2A — SendPulse API REST
      ics.ts                    # 2A — ICS calendar generation (extraido de email-service.ts)
  wrangler.toml
  package.json
```

## 8. O que NAO muda

- `shared/schema.ts` — intocado (exceto novas tabelas de cache)
- Validacoes Zod nas rotas — intocadas
- Logica de negocio dentro de `storage.ts` — preservada via factory
- `email-templates.ts` — reutilizado (pure functions, sem dependencia Node)
- React components, pages, hooks (exceto auth-related) — intocados
- TanStack Query queries — intocadas (so muda base URL + remocao do Bearer header)
- Tailwind/shadcn — intocados
- Routing client-side — intocado

## 9. O que e removido

| Item | Motivo |
|---|---|
| `client/src/lib/auth.ts` | Substituido por `AuthProvider` + `useAuth()` |
| Plugins Replit no `vite.config.ts` | `runtimeErrorOverlay`, `cartographer`, `devBanner` |
| `nodemailer` como dependencia | Substituido por SendPulse API |
| Header `Authorization: Bearer` no client | Cookies sao automaticos |
| `localStorage` para tokens/user | Estado vive no React context |

## 10. Riscos e mitigacoes

| Risco | Probabilidade | Mitigacao |
|---|---|---|
| Factory storage.ts quebra Express | Baixa | Parametro default (`db = defaultDb!`) mantem retrocompatibilidade |
| bwip-js incompativel com Workers | Media | Testar na 2B (labels). Se falhar: barcode via API externa ou SVG-based lib |
| SheetJS mini falta funcionalidade | Baixa | `json_to_sheet` e `book_new` estao na versao mini. Testar export multi-sheet |
| SheetJS mini `XLSX.write(type: "buffer")` retorna tipo diferente | Baixa | Em Workers com `nodejs_compat`, `Buffer` e suportado. Testar que o output e valido como XLSX. Fallback: `type: "array"` (ArrayBuffer) |
| XLSX export excede body size limit (1MB free plan) | Media | Inventarios grandes podem gerar XLSX > 1MB. Monitorar tamanho. Se necessário: Workers Paid ($5/mês, 100MB) ou streaming via R2 presigned URL |
| Client auth refactor quebra fluxos | Media | Testar cada fluxo: login, refresh, logout, multi-tab, protected routes, permissions |
| SendPulse API rate limit | Baixa | Rate limit generoso (emails transacionais). Implementar retry com backoff |
| SendPulse ICS attachments | Media | `sendMeetingInviteEmail` envia ICS como attachment. Verificar campo `attachments_binary` na API SMTP do SendPulse |
| Bundle Worker > 10MB | Baixa | Monitorar com `wrangler deploy --dry-run`. SheetJS mini e ~300KB |
| 51 ocorrencias de fetchWithAuth em 17 arquivos + ~20 arquivos com getCurrentUser | Certo | Refactor mecanico — renomear import de fetchWithAuth, substituir getCurrentUser por useAuth(). Volume moderado, concentrado no modulo estoques e componentes de auth. Usar busca/replace global com validacao |
| SSE streaming diferente em Workers | Baixa | Padrao bem documentado; Hono tem helper `streamSSE()` |
| ai.ts grafo de dependencias | Media | `ai.ts` importa de `openrouter.ts` e `firecrawl-service.ts` diretamente (nao e cadeia linear). Precisa factory em 2 modulos: `openrouter.ts` (storage + 3x process.env.OPENROUTER_API_KEY), `firecrawl-service.ts` (1x process.env.FIRECRAWL_API_KEY). `external-data.ts` nao precisa de factory (usa fetch nativo sem secrets) |
| Services usam `process.env` | Media | `correios-service.ts` (6x), `openrouter.ts` (3x), `firecrawl-service.ts` (1x) usam `process.env.*`. Todos precisam factory pattern para receber `env` do Worker context |
| estoques.ts bypass de storage | N/A (conhecido) | Queries diretas traduzidas para usar `c.get("db")` do contexto Hono |
| dev-tools sem auth | N/A (correcao) | Adicionar `requireAdmin` na migracao |

## 11. Criterios de sucesso (por sub-fase)

### 2A
- [ ] `getStorage(db)` funciona no Worker E `storage` singleton continua funcionando no Express
- [ ] Email via SendPulse envia pelo menos `sendWelcomeEmail` com sucesso
- [ ] Client faz login via cookies, `GET /api/auth/me` retorna usuario, logout limpa sessao
- [ ] Pages deploya em `home-dev.renovsmart.com.br` e carrega o frontend
- [ ] Fluxo completo: Pages → login → dashboard funciona end-to-end

### 2B
- [ ] 9 rotas respondendo no Worker com dados corretos
- [ ] Labels: barcode PNG gerado com sucesso (ou fallback documentado)
- [ ] AI: SSE streaming funciona no browser (chat com resposta em tempo real)
- [ ] Dev-tools: protegido com `requireAdmin`

### 2C
- [ ] 7 rotas respondendo no Worker
- [ ] Omie: `callApi()` retorna dados, config salva no banco, sync logs funcionam
- [ ] Cache Omie: tabelas criadas, leitura/escrita funciona, TTL 60min respeitado
- [ ] Pricing: proxy para API RenovSmart retorna dados

### 2D
- [ ] 5 rotas respondendo no Worker
- [ ] Emails de notificacao (tickets, projects, tasks) enviados via SendPulse
- [ ] Export XLSX (estoques): download de planilha multi-sheet funciona
- [ ] Barcode (shipments): mesmo resultado do teste em labels
- [ ] Correios API: consulta de frete/rastreio funciona
- [ ] Reunioes recorrentes: criacao de filhos a partir de pai funciona

## 12. Ordem de execucao e dependencias

```
2A (infraestrutura)
 ├── storage factory
 ├── email SendPulse
 ├── client auth refactor
 └── Pages setup
      │
      ▼
2B (9 rotas simples) ──── depende de 2A
      │
      ▼
2C (7 rotas negocio) ──── depende de 2B (padrao estabelecido)
 ├── omie service refactor
 └── cache tables Neon
      │
      ▼
2D (5 rotas pesadas) ──── depende de 2C (omie service + cache prontos)
 └── tickets → projects → tasks → shipments → estoques
```

Cada sub-fase resulta em um PR separado contra `develop`.
