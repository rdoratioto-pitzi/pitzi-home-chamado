# Migração Renov Home: Replit → Cloudflare + Neon

**Data:** 2026-03-16
**Status:** Aprovado
**Autor:** Marcelo + Claude

---

## 1. Contexto

O Renov Home roda hoje no Replit (autoscale) com Neon PostgreSQL. A migração para Cloudflare visa:
- Eliminar dependência do Replit
- Melhor performance (edge network, Smart Placement)
- Custo menor para tráfego baixo e esporádico (pay-per-request)
- Uploads via Cloudflare R2 (S3-compatible)
- Auth modernizado (JWT substituindo sessions)

## 2. Decisões de Arquitetura

| Decisão | Escolha | Motivo |
|---|---|---|
| Framework API | **Hono** (substituir Express) | Nativo para Workers, ~14KB, API similar ao Express |
| Frontend hosting | **Cloudflare Pages** | CDN global grátis, deploy atômico, separado do Worker |
| API hosting | **Cloudflare Worker** + Smart Placement | Serverless, posicionado perto do Neon (us-east-1) |
| Auth | **JWT** (access 2h + refresh 7d) | Stateless, ideal para Workers, sem session store |
| Uploads | **Cloudflare R2** com presigned URLs | S3-compatible, integração nativa via bindings |
| Database | **Neon PostgreSQL** (mantém) | Já funciona, driver serverless disponível |
| Database driver | **@neondatabase/serverless** | HTTP-based, sem TCP/pool, otimizado para Workers |
| Cron jobs | **Desabilitados na fase 1** | Não são críticos, reativados via Cron Triggers na fase 5 |
| Senhas | **Web Crypto PBKDF2** (migrar de plaintext) | Workers não suportam bcrypt (native bindings); PBKDF2 é nativo via Web Crypto API |

## 3. Arquitetura

```
                    renovsmart.com.br (Cloudflare DNS)
                           │
              ┌────────────┴────────────┐
              │                         │
    home-next.renovsmart.com.br  homeapi.renovsmart.com.br
              │                         │
     ┌────────┴────────┐      ┌────────┴────────┐
     │  Cloudflare     │      │  Cloudflare     │
     │  Pages          │      │  Worker (Hono)  │
     │  React SPA      │      │  Smart Placement│
     └─────────────────┘      └────────┬────────┘
                                       │
                        ┌──────────────┼──────────────┐
                        │              │              │
                   Neon PostgreSQL  Cloudflare R2  SMTP
                   (us-east-1)     (attachments)  (email)
```

### Domínios por ambiente

| Ambiente | Front (Pages) | API (Worker) | Neon |
|---|---|---|---|
| Produção atual (Replit) | `home.renovsmart.com.br` | — | `ep-wispy-grass` |
| Produção CF | `home-next.renovsmart.com.br` | `homeapi.renovsmart.com.br` | `ep-wispy-grass` |
| Develop CF | `home-dev.renovsmart.com.br` | `homeapi-dev.renovsmart.com.br` | `ep-crimson-pond` |

Produção Replit continua ativa durante toda a migração. Cutover via DNS swap.

## 4. Autenticação JWT

### Fluxo de login

```
Client                    Worker (Hono)                  Neon
  │                            │                          │
  ├─ POST /api/auth/login ────►│                          │
  │  { email, password }       ├─ SELECT user ───────────►│
  │                            │◄─ user row ──────────────┤
  │                            ├─ PBKDF2.verify(password)   │
  │                            ├─ gera access JWT (2h)     │
  │                            ├─ gera refresh JWT (7d)    │
  │◄─ Set-Cookie: access_token │                          │
  │   Set-Cookie: refresh_token│                          │
  │   (httpOnly, secure, lax)  │                          │
```

### Tokens

| Token | Duração | Storage | Payload |
|---|---|---|---|
| Access | 2h | Cookie `httpOnly`, `secure`, `sameSite=lax`, `domain=.renovsmart.com.br` | `{ userId, tenantId, role }` |
| Refresh | 7d | Cookie `httpOnly`, `secure`, `sameSite=lax`, `path=/api/auth/refresh` | `{ userId }` |

### Propagação de tenant

O login resolve `tenantId` a partir da tabela `users` (coluna `tenantId` já existe). O JWT access token carrega `{ userId, tenantId, role }` onde `role` mapeia do campo `isAdmin` atual (`isAdmin: true` → `role: "admin"`, caso contrário `role: "user"`). O middleware auth extrai esses campos e disponibiliza via `c.get("user")` — todas as rotas usam `c.get("user").tenantId` para filtros multi-tenant.

### Tabela refresh_tokens (nova)

```typescript
// Drizzle schema (adicionar em shared/schema.ts)
export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),  // hash SHA-256 do refresh token
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### Regras
- Senhas migradas de plaintext para **Web Crypto PBKDF2** (script one-time para hashear existentes)
  - Script roda antes do cutover, no mesmo banco Neon compartilhado
  - Durante migração: login tenta PBKDF2 verify primeiro; se falhar, tenta comparação plaintext, e se acertar, faz hash e atualiza a senha no banco (migração lazy)
  - Após cutover: remover fallback plaintext
- `POST /api/auth/refresh` — valida refresh token, emite novo access token
- `POST /api/auth/logout` — limpa cookies + deleta refresh token do banco
- Revogação: refresh token salvo em tabela `refresh_tokens` (hash SHA-256). Deletado no logout/troca de senha
- Access token de 2h expira naturalmente (sem blocklist)
- Middleware Hono: toda rota protegida valida access JWT
- Client: interceptor no fetch — 401 → tenta refresh → falha → redireciona para login
- `rememberMe`: quando `true`, refresh token dura 7d; quando `false`, dura 24h. Access token sempre 2h

### Rotas públicas (sem access JWT obrigatório)

As seguintes rotas devem ser isentas do middleware de access JWT no Hono:

**Totalmente abertas (sem auth):**
- `POST /api/auth/login`
- `POST /api/auth/forgot-password` — endpoint de forgot-password **deve hashear a senha temporária** com PBKDF2 antes de salvar (hoje salva plaintext)
- `GET /api/settings/(logo_url_light|logo_url_dark|favicon_url)`
- `GET /api/etiquetas/barcode/:id`
- `GET /api/health`

**Requerem refresh cookie (não access JWT):**
- `POST /api/auth/refresh` — valida refresh token cookie, emite novo access JWT
- `POST /api/auth/logout` — valida refresh token cookie, deleta do banco, limpa cookies

**Opcionalmente autenticada:**
- `GET /api/auth/me` — retorna user se autenticado, `null` se não

**Auth por secret (não JWT):**
- `POST /api/git-analytics/claude-code-usage` — autenticada via header `X-Claude-Usage-Secret`

### Dados do usuário pós-login

Com cookies `httpOnly`, o client não consegue decodificar o JWT. O fluxo para obter dados do usuário:
1. `POST /api/auth/login` → Set-Cookie headers + **response body**: `{ success: true, user: { id, name, email, tenantId, role, isAdmin, modulePermissions, status } }` (sem `token` — cookies são automáticos)
2. Para verificações subsequentes (reload da página), o client chama `GET /api/auth/me` que retorna os mesmos dados do `user`
3. O client armazena esses dados em estado React (context/store), não em localStorage
4. `client/src/lib/permissions.ts` (`getCurrentUser()`) deve ser atualizado para ler do React context em vez de localStorage

## 5. Uploads — Cloudflare R2

### Fluxo

```
Client (Uppy)                Worker (Hono)              R2 Bucket
  │                              │                         │
  ├─ POST /api/uploads/request ─►│                         │
  │  { filename, contentType }   ├─ gera presigned PUT URL─►│
  │◄─ { uploadUrl, key } ───────┤                         │
  │                              │                         │
  ├─ PUT uploadUrl ─────────────────────────────────────────►│
  │  (upload direto ao R2)       │                         │
  │                              │                         │
  ├─ POST /api/uploads/confirm ─►│                         │
  │  { key }                     ├─ verifica existência ───►│
  │                              ├─ salva referência no DB  │
  │◄─ { url } ──────────────────┤                         │
```

### Configuração

```toml
# wrangler.toml
[[r2_buckets]]
binding = "ATTACHMENTS"
bucket_name = "renov-home-attachments"
```

### Rotas

| Rota | Ação |
|---|---|
| `POST /api/uploads/request` | Gera presigned URL para PUT direto no R2 |
| `POST /api/uploads/confirm` | Confirma upload, salva referência no banco |
| `GET /api/uploads/:key` | Gera presigned URL para GET (download) |
| `DELETE /api/uploads/:key` | Remove do R2 + referência no banco |

### Key format
`{tenantId}/{tipo}/{uuid}-{filename}` — ex: `tenant-1/devices/a1b2c3-foto.jpg`

### Substituição das rotas Replit Object Storage

As rotas atuais em `server/replit_integrations/object_storage/routes.ts` (`POST /api/uploads/request-url`, `PUT /api/uploads/local-put/:filename`, `GET /objects/*`) são **substituídas** pelas novas rotas R2 acima. O client (`ObjectUploader.tsx`) deve apontar para os novos endpoints. O diretório `server/replit_integrations/` inteiro é removido.

### Migração de arquivos existentes
Script one-time: lê do Replit Object Storage (via `@google-cloud/storage` SDK, conectando ao sidecar GCS) → copia para R2 → atualiza referências no banco. Volume pequeno (poucos arquivos, < 5MB cada). Script idempotente com retry.

## 6. Migração do Server (Express → Hono)

### Mapeamento

| Express | Hono |
|---|---|
| `req.body` | `await c.req.json()` |
| `req.params.id` | `c.req.param("id")` |
| `req.query.status` | `c.req.query("status")` |
| `res.json(data)` | `return c.json(data)` |
| `res.status(404).json()` | `return c.json(data, 404)` |
| `req.user` | `c.get("user")` (via JWT middleware) |
| `express-rate-limit` | Custom middleware com KV |
| `express.static()` | N/A (Pages serve o front) |

### Estrutura do Worker

```
worker/
├── src/
│   ├── index.ts              # Entry point — Hono app
│   ├── middleware/
│   │   ├── auth.ts           # JWT validation
│   │   ├── cors.ts           # CORS config
│   │   └── error-handler.ts  # Error middleware
│   ├── routes/               # 23 módulos (ver lista abaixo)
│   │   ├── auth.ts
│   │   ├── tickets.ts
│   │   ├── estoques.ts
│   │   └── ...
│   ├── services/             # Lógica de negócio (migrada)
│   │   ├── storage.ts
│   │   ├── omie.service.ts
│   │   └── ...
│   └── lib/
│       ├── db.ts             # Neon via @neondatabase/serverless
│       ├── r2.ts             # R2 helpers
│       └── jwt.ts            # Token utils
├── wrangler.toml
└── package.json
```

### Rotas a migrar vs. excluir

**Migrar (23 módulos):** auth, users, tickets, tasks, projects, shipments, estoques, omie, ai, integrations, settings, notifications, knowledge, okrs, metas, pricing, flowcharts, labels, slas, cep, updates, dev-tools, git-analytics

**Nota sobre auth refactor:** existem ~90 ocorrências de `getSessionUser`/`req.session?.userId` em ~12 route files, mais ~10 em `server/auth.ts` e middleware (total ~100). Cada uma deve ser substituída por `c.get("user")`. Trabalho mecânico mas volumoso — tratar como work item explícito na Fase 2.

### Database driver
- De: `pg` (node-postgres) com Pool persistente (criado uma vez no boot)
- Para: `@neondatabase/serverless` — driver HTTP otimizado para serverless
- Drizzle ORM continua funcionando, só troca o driver: `drizzle(neon(env.DATABASE_URL))`
- **Mudança arquitetural:** DB client criado por request a partir do `env` do Worker (não mais singleton). Módulos afetados:
  - `storage.ts` (3.379 linhas) — factory `getStorage(db)` que retorna o objeto storage
  - `omie.service.ts` — usa `pool.query()` direto (6 ocorrências), precisa receber db instance
  - `translate-prompts.service.ts` — cria seu próprio `new Pool()`, precisa receber db do contexto
  - Auto-migrations em `server/index.ts` (20+ raw SQL statements no boot) — extrair para Drizzle migrations ou script separado, não rodar por request

### O que NÃO muda
- `shared/schema.ts` — schema Drizzle intocado
- Validações Zod — intocadas
- Lógica de negócio em storage/services — funções internas continuam iguais (só muda como recebem o db)
- Templates de email — intocados

### Libs com risco de incompatibilidade Workers

| Lib | Uso | Risco | Fallback |
|---|---|---|---|
| `nodemailer` | Email — 2 instâncias: `server/email-service.ts` (principal) e `server/ai/services/email.service.ts` (AI) | Alto — depende de `net`/`tls` para SMTP | Migrar para API HTTP (Resend, Mailgun) ou Cloudflare Email Workers |
| `xlsx` | Export de planilhas | Médio — usa `fs`/`Buffer` | Testar com `nodejs_compat`; fallback: gerar CSV |
| `bwip-js` | Geração de barcodes (etiquetas) | Alto — usa canvas nativo | Testar; fallback: barcode via API externa |
| `xml2js` | Parsing XML (Correios, Omie) | Baixo — pure JS | Deve funcionar |

## 7. Frontend (Cloudflare Pages)

### Mudanças no client

| Item | Antes | Depois |
|---|---|---|
| API base URL | `/api/` (mesmo domínio) | `https://homeapi.renovsmart.com.br/api/` via `VITE_API_BASE_URL` |
| Auth | Cookie de sessão | Cookie JWT (mesmo root domain) |
| Uploads | Presigned URL Replit | Presigned URL R2 (mesma lib Uppy) |
| Vite plugins | `@replit/vite-plugin-*` — `runtimeErrorOverlay` (sempre ativo), `cartographer` e `devBanner` (condicionais ao `REPL_ID`) | Todos os 3 removidos |

### Refactor do auth no client (work item significativo)

O client atual usa `localStorage` + `Authorization: Bearer` header (via `client/src/lib/auth.ts` e `client/src/lib/queryClient.ts`). A migração para cookies `httpOnly` exige:

1. **Remover `client/src/lib/auth.ts`** — não há mais tokens em localStorage (inclui `saveAuth`, `getAuthToken`, `getAuthUser`, `clearAuth`, `migrateFromSessionStorage`)
2. **Atualizar `client/src/lib/permissions.ts`** — `getCurrentUser()` e `UserPermissions` não devem mais importar de `auth.ts`; ler do React context
3. **Remover injeção de `Authorization: Bearer`** do `fetchWithAuth()` e `apiRequest()` e `getQueryFn()` em `queryClient.ts` — cookies são enviados automaticamente pelo browser
4. **Manter `credentials: "include"`** — já existe no código atual, necessário para CORS cross-subdomain
5. **Reescrever interceptor 401**: request falha → chama `POST /api/auth/refresh` → retry → falha → redireciona para `/login`
6. **Atualizar `login.tsx`**: parar de chamar `saveAuth({ token, user })` — cookies vêm via Set-Cookie; salvar `user` no React context. Nota: `login.tsx` usa `fetchWithAuth` para o login, que será substituído por `fetch` direto com `credentials: "include"`

Nota: URLs hardcoded para `dash.renovsmart.com.br` em `client/src/pages/apis/` são endpoints de outro serviço (Renov Dash) e não são afetados pela migração.

### Deploy
- Build: `npm run build:client` → `dist/public/` (script novo a criar — o atual `npm run build` faz front+back junto)
- Conectar repo GitHub → auto-deploy `develop` (preview) e `main` (produção)

### O que NÃO muda
- React components, pages, hooks — intocados
- TanStack Query queries — intocadas (só muda base URL)
- Tailwind/shadcn — intocados
- Routing client-side — intocado

## 8. Infraestrutura e Deploy

### wrangler.toml

```toml
name = "renov-home-api"
main = "src/index.ts"
compatibility_date = "2025-09-01"
compatibility_flags = ["nodejs_compat"]

[placement]
mode = "smart"

[[r2_buckets]]
binding = "ATTACHMENTS"
bucket_name = "renov-home-attachments"

[vars]
APP_URL = "https://home-next.renovsmart.com.br"
CORS_ORIGIN = "https://home-next.renovsmart.com.br"
```

### Secrets (via `wrangler secret put`)
- `DATABASE_URL` — Neon connection string (diferente por ambiente)
- `JWT_SECRET` — chave de assinatura do access token (algoritmo: **HS256**)
- `JWT_REFRESH_SECRET` — chave de assinatura do refresh token (algoritmo: **HS256**)
- `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`
- `OPENROUTER_API_KEY`
- `CORREIOS_USUARIO`, `CORREIOS_SENHA`, `CORREIOS_CARTAO_POSTAGEM`, `CORREIOS_COD_ADMINISTRATIVO`, `CORREIOS_TOKEN`, `CORREIOS_HOMOLOGACAO` — integração Correios
- `FIRECRAWL_API_KEY` — web scraping service
- `CLAUDE_USAGE_SECRET` — auth para endpoint `/api/git-analytics/claude-code-usage`
- `GITHUB_TOKEN` (necessário a partir da Fase 5 para git-sync job)

### Pipeline de deploy

```
GitHub push
    │
    ├─► develop ──► Pages: home-dev.renovsmart.com.br
    │               Worker: homeapi-dev.renovsmart.com.br
    │
    └─► main ─────► Pages: home-next.renovsmart.com.br
                    Worker: homeapi.renovsmart.com.br
```

### Custo estimado (tráfego baixo)

| Recurso | Free tier | Estimativa |
|---|---|---|
| Workers | 100K requests/dia | Suficiente |
| Pages | Ilimitado | $0 |
| R2 | 10GB storage, 10M reads/mês | Suficiente |
| Custom domains | Incluído | $0 |
| **Total** | | **$0 — $5/mês** |

## 9. Fases da Migração

### Fase 1 — Fundação
- Criar projeto Worker (Hono) + Pages no Cloudflare
- Configurar R2 bucket `renov-home-attachments`
- Configurar domínios (home-next, home-dev, homeapi, homeapi-dev)
- Implementar auth JWT (PBKDF2 + access 2h + refresh 7d)
- Criar tabela `refresh_tokens`
- Adicionar `GET /api/health` (health check — status do DB)
- Migrar 1-2 rotas como prova de conceito (auth, settings)
- Deploy em `home-dev` — validar fluxo completo

### Fase 2 — Migração de rotas
- Migrar as 23 rotas Express → Hono (rota por rota)
- Substituir Replit Object Storage → R2 (presigned URLs)
- Adaptar client: API base URL, interceptor JWT
- Remover plugins Replit do Vite
- Deploy em `home-dev` — testar cada módulo

### Fase 3 — Validação
- Deploy em `home-next` (produção CF)
- Testar com dados reais (mesmo Neon de produção)
- Migrar arquivos do Replit Object Storage → R2 (script one-time)
- Validar: login, tickets, estoques, uploads, emails, Omie

### Fase 4 — Cutover
- DNS: `home.renovsmart.com.br` → Pages (Cloudflare)
- Desligar Replit
- Remover domínios temporários ou manter como alias
- **Nota:** usuários precisarão fazer login novamente após o cutover (JWT cookies ≠ session cookies do Replit)

### Fase 5 — Pós-migração
- Reativar cron jobs via Cloudflare Cron Triggers:
  - `recurrence.job` — reuniões recorrentes (a cada hora, minuto :15 — cron `15 * * * *`) — **essencial**. Também faz warm do cache Omie (`getCachedProdutos()`), que deve ser preservado
  - `git-sync.job` — sync de commits GitHub (a cada 6h) — nice-to-have (já usa GitHub REST API via `fetch()`, mas precisa adaptação: importa `db` como singleton e usa `process.env.GITHUB_TOKEN` — ajustar para receber DB via contexto e secret via env binding)
  - `prompts-sync.job` — sync de prompts IA (diário às 03:00) — nice-to-have (**requer rewrite completo**: usa `child_process.execSync` para `git clone` em `/tmp/`, incompatível com Workers; precisa migrar para GitHub Contents API)
- Rate limiting via Cloudflare KV (login: 5/15min, forgot-password: 3/hora)
- Monitoramento e alertas
- Remover fallback plaintext de senhas (após confirmar que todas foram migradas)

### Rollback
Em qualquer fase, `home.renovsmart.com.br` continua no Replit. Zero downtime, zero risco para usuários.

## 10. Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Bundle do Worker > 10MB | Baixa | Pages separado mantém bundle leve; monitorar com `wrangler deploy --dry-run` |
| Latência DB (Worker ↔ Neon) | Média | Smart Placement posiciona Worker perto do Neon us-east-1 |
| Libs Node incompatíveis com Workers | Média | `compatibility_date = "2025-09-01"` + `nodejs_compat`; testar xlsx, nodemailer, xml2js |
| Migração de uploads falha | Baixa | Volume pequeno; script idempotente com retry |
| CORS entre Pages e Worker | Baixa | Mesmo root domain; cookies com `domain=.renovsmart.com.br` |
| Cookie collision com Replit | Baixa | JWT cookies usam nomes distintos (`access_token`, `refresh_token`) vs. session cookie Replit (`renov.sid`). Sem conflito |
| nodemailer em Workers | Alta | Testar com `nodejs_compat`; fallback: API HTTP (Resend/Mailgun) ou Cloudflare Email Workers |
| CPU timeout (30s limit) | Baixa | Operações longas (Omie sync, exports grandes) podem exceder limite. Monitorar; se necessário, usar Cloudflare Queues para offload |
| Body size limit (free plan: 1MB) | Média | Express atual permite 50MB. Validar payloads grandes (dev-tools SQL, knowledge docs). Se necessário, usar Workers Paid ($5/mês, 100MB limit) |
| Cache warming sem boot event | Média | Omie cache (`getCachedProdutos`, `getCachedPosEstoque`) hoje roda no boot. Em Workers, usar cache on-first-request ou Cron Trigger dedicado |
| Logging sem persistência | Baixa | Workers logs são real-time apenas (`wrangler tail`). Fase 5: integrar Cloudflare Logpush para persistência |
