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
│   ├── routes/               # ~20 módulos (ver lista abaixo)
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

**Migrar (21 módulos):** auth, users, tickets, tasks, projects, shipments, estoques, omie, ai, integrations, settings, notifications, knowledge, okrs, metas, pricing, flowcharts, labels, slas, cep, updates

**Excluir (2 módulos):** dev-tools (development-only), git-analytics (depende de cron git-sync)

**Nota sobre auth refactor:** existem ~90 ocorrências de `getSessionUser`/`req.session?.userId` em ~14 route handlers. Cada uma deve ser substituída por `c.get("user")`. Trabalho mecânico mas volumoso — tratar como work item explícito na Fase 2.

### Database driver
- De: `pg` (node-postgres) com Pool persistente (criado uma vez no boot)
- Para: `@neondatabase/serverless` — driver HTTP otimizado para serverless
- Drizzle ORM continua funcionando, só troca o driver: `drizzle(neon(env.DATABASE_URL))`
- **Mudança arquitetural:** DB client criado por request a partir do `env` do Worker (não mais singleton). O `storage.ts` (3.379 linhas) precisa receber o Drizzle instance como parâmetro ou via contexto Hono, em vez de importar de um módulo global. Abordagem: criar factory `getStorage(db)` que retorna o objeto storage com todas as funções.

### O que NÃO muda
- `shared/schema.ts` — schema Drizzle intocado
- Validações Zod — intocadas
- Lógica de negócio em storage/services — funções internas continuam iguais (só muda como recebem o db)
- Templates de email — intocados

### Libs com risco de incompatibilidade Workers

| Lib | Uso | Risco | Fallback |
|---|---|---|---|
| `nodemailer` | Email (tickets, tarefas, password reset) | Alto — depende de `net`/`tls` para SMTP | Migrar para API HTTP (Resend, Mailgun) ou Cloudflare Email Workers |
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
| Vite plugins | `@replit/vite-plugin-*` (3 plugins — 1 ativo, 2 condicionais ao `REPL_ID`) | Removidos |

### Refactor do auth no client (work item significativo)

O client atual usa `localStorage` + `Authorization: Bearer` header (via `client/src/lib/auth.ts` e `client/src/lib/queryClient.ts`). A migração para cookies `httpOnly` exige:

1. **Remover `client/src/lib/auth.ts`** — não há mais tokens em localStorage
2. **Remover injeção de `Authorization: Bearer`** do `fetchWithAuth()` e `apiRequest()` em `queryClient.ts` — cookies são enviados automaticamente pelo browser
3. **Adicionar `credentials: "include"`** em todas as requests fetch (necessário para CORS cross-subdomain)
4. **Reescrever interceptor 401**: request falha → chama `POST /api/auth/refresh` → retry → falha → redireciona para `/login`
5. **Atualizar `login.tsx`**: response do login não retorna mais token no body, apenas Set-Cookie headers

Nota: URLs hardcoded para `dash.renovsmart.com.br` em `client/src/pages/apis/` são endpoints de outro serviço (Renov Dash) e não são afetados pela migração.

### Deploy
- Build: `npm run build:client` → `dist/public/`
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
- `JWT_SECRET` — chave de assinatura do access token
- `JWT_REFRESH_SECRET` — chave de assinatura do refresh token
- `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, `SMTP_PORT`
- `OPENROUTER_API_KEY`

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
- Migrar as 24 rotas Express → Hono (rota por rota)
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
  - `recurrence.job` — reuniões recorrentes (a cada 15min) — **essencial**
  - `git-sync.job` — sync de commits GitHub (a cada 6h) — nice-to-have (**requer rewrite completo**: usa `child_process`/filesystem para `git log`, incompatível com Workers; precisa migrar para GitHub API)
  - `prompts-sync.job` — sync de prompts IA (diário às 03:00) — nice-to-have
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
