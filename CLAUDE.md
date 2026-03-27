# Renov Home — Contexto para Claude Code

## ⚡ Início de Sessão — Executar Imediatamente

1. Ler `docs/governanca/git-workflow.md` — regras de branch e PR
2. Verificar branch atual: `git branch --show-current`
3. Se não estiver em `develop`, perguntar ao usuário antes de prosseguir

## Projeto

Plataforma brasileira de **trade-in de dispositivos eletrônicos** (B2B).
Conecta redes de varejo e operadoras de telecom para avaliação de dispositivos
e desconto imediato em novas compras. Produto principal: Renov Home (gestão interna).

Stack: React 18 + Vite + TanStack Query / Express + Node.js (TypeScript) /
PostgreSQL + Drizzle ORM / Tailwind + shadcn/ui

## Comandos Essenciais

```bash
npm run dev        # Dev server — porta 5050
npm run build      # Build produção
npm run db:push    # Migrations (drizzle-kit push)
npm run check      # TypeScript type check
# Reiniciar tudo:
pkill -f tsx && pkill -f vite && npm run dev
```

## 🔴 Git Workflow — REGRAS OBRIGATÓRIAS

### Branch — SEMPRE a partir de develop

```bash
git checkout develop
git pull origin develop
git checkout -b tipo/REN-XXX-descricao-curta
```

**NUNCA** criar branch a partir de `main`.
**NUNCA** fazer push direto em `main` ou `develop`.

### Convenção de nomes de branch

```
feat/REN-123-nome-da-feature
fix/REN-456-descricao-do-bug
refactor/REN-789-modulo-afetado
chore/REN-000-descricao
```

### Commits — Conventional Commits

```
feat(estoques): adiciona curva ABC por categoria
fix(tickets): corrige filtro de status duplicado
refactor(pricing): extrai lógica de cálculo para service
```

### PR — SEMPRE contra develop

```bash
gh pr create --base develop \
  --title "feat(modulo): título" \
  --body "## O que foi feito\n...\n## Como testar\n..." \
  --reviewer marcelo-maciel
```

**NUNCA** abrir PR contra `main`.
Reviewer obrigatório: **Marcelo (CTO)** — sem aprovação dele, não fazer merge.

### Checklist antes de abrir PR

- [ ] Branch criada a partir de `develop` — verificar com `git log --oneline develop..HEAD`
- [ ] Testado localmente em `http://localhost:5050`
- [ ] Sem `console.log` esquecidos
- [ ] Sem arquivos `.env` commitados
- [ ] Título segue conventional commits
- [ ] Reviewer: @marcelo adicionado

## Deployment

- This project deploys to Cloudflare (Workers + Pages + R2). Always distinguish between dev and prod environments.
- Before deploying, verify which environment (dev/prod) is targeted. Never deploy to production without explicit confirmation.
- Check wrangler.toml route configuration and ensure secrets are set for the target environment before deploying.

## Bug Fixes

- After applying any fix, verify there are no regressions by building the project and testing affected functionality.
- When fixing multiple issues in one session, fix and verify ONE at a time before moving to the next.
- Never remove or change existing ViewBag/data population, filter logic, or namespace imports without confirming the impact.

## Interaction Style

- When asked to plan or brainstorm, engage in dialogue FIRST before exploring the codebase. Ask clarifying questions rather than autonomously reading dozens of files.
- Do not over-explore. If the user wants a conversation, have a conversation.

## Arquivos-Chave

| Arquivo                         | Responsabilidade                        |
| ------------------------------- | --------------------------------------- |
| `shared/schema.ts`              | Schema central do banco (Drizzle ORM)   |
| `server/storage.ts`             | Camada de acesso a dados (~126KB)       |
| `server/routes/`                | 25+ rotas da API REST                   |
| `client/src/pages/`             | 23+ páginas do frontend                 |
| `server/jobs/recurrence.job.ts` | Cron de reuniões recorrentes (todo :15) |

## Padrões Obrigatórios

- **TypeScript** em todo código — sem `any` desnecessário
- **UI em PT-BR** — textos, labels, mensagens de erro
- **Multi-tenant** — sempre filtrar por `tenantId` em queries
- **Drizzle ORM** com `eq()` para filtros — nunca SQL raw
- **Zod** para validação de dados de entrada
- **shadcn/ui + Tailwind** — não criar componentes do zero se já existe
- **Reuniões** usam `tasks` com `type="meeting_note"` e `meetingData` (JSON como TEXT)
- **Timezone** — sempre `America/Sao_Paulo` em jobs de recorrência

## Módulo Estoques — Contexto Atual (Prioridade #1)

- Jornada em 2 fases: pré-estoque (Simples Remessa) → estoque ativo (pós-triagem)
- Dispositivos entram no estoque formal após triagem → trigger de entrada fiscal no Omie
- Omie API: usar `ListarPosEstoque` para saldo — NUNCA `ConsultarProduto` (retorna estoque=0)
- Coluna "Mês Trade-in" obrigatória em todas as tabelas do módulo
- KPIs: Volume, Tempo, Financeiro, Eficiência

## Arquitetura de Decisão

- **Planejar antes de implementar** — usar Plan Mode para tasks não-triviais
- Erros pré-existentes em `storage.ts` (~L3144) e `recurrence.job.ts` (L332/341) são
  baseline — não reportar como regressão
- Reuniões recorrentes: pai tem `isRecurring=true`, filhos têm `parentTaskId` + `isRecurring=false`
- Templates ficam em `task_templates` (type="meeting")

## Documentação do Projeto

- Arquitetura completa: `docs/arquitetura/`
- **Git workflow e PRs: `docs/governanca/git-workflow.md` — ler antes de qualquer commit**
- Planos de módulos: `docs/modulos/`
- Agentes de IA: `docs/ai-agents/`

## MCPs Disponíveis

Configurados em `.mcp.json` — usar automaticamente conforme necessidade.

| MCP                              | Quando usar                                     |
| -------------------------------- | ----------------------------------------------- |
| **github**                       | PRs, issues, branches, histórico de commits     |
| **linear**                       | Tasks, issues, status de projetos               |
| **postgres** / **supabase**      | Inspecionar banco, queries, migrations          |
| **playwright** / **puppeteer**   | Testes E2E, automação, screenshots              |
| **brave-search** / **firecrawl** | Pesquisa web, scraping de docs                  |
| **memory**                       | Persistir decisões entre sessões                |
| **sequential-thinking**          | Raciocínio estruturado para problemas complexos |
| **filesystem**                   | Navegação e leitura de arquivos                 |
| **reactbits**                    | Componentes React animados                      |
| **pdf-reader**                   | Leitura de PDFs                                 |

## Git Commands

NEVER use compound commands combining `cd` with `git` (e.g. `cd subdir && git status`).
Always use `git -C <path>` flag instead.
Examples:
- `git -C subdir status` instead of `cd subdir && git status`
- `git -C subdir add .` instead of `cd subdir && git add .`
- `git -C subdir commit -m "msg"` instead of `cd subdir && git commit -m "msg"`

## Módulo Workspace

Rota principal: `/workspace`
Sub-rotas: `/workspace/chamados` · `/workspace/projetos` · `/workspace` (todos)

Rotas legadas redirecionam automaticamente: `/chamados` → `/workspace/chamados` · `/projetos` → `/workspace/projetos`

**Componentes principais:**
- `client/src/pages/workspace/WorkspacePage.tsx` — orquestrador principal com tabs e topbar actions
- `client/src/components/workspace/KpiStrip.tsx` — KPIs (variant: `chamados` | `projetos` | `todos`)
- `client/src/components/workspace/WorkspaceTable.tsx` — tabela unificada com loading skeleton e responsividade
- `client/src/components/workspace/NovoItemModal.tsx` — modal de criação (chamado / tarefa / projeto)
- `client/src/components/workspace/VisaoEstrategica.tsx` — overlay estratégico de projetos
- `client/src/components/workspace/WorkspaceErrorBoundary.tsx` — error boundary com fallback PT-BR

**Novas tabelas:**
- `workspace_projetos` — projetos macro
- `workspace_tarefas` — tarefas dentro de projetos

**Endpoints REST:**
- `GET  /api/workspace/chamados?periodo=...`
- `GET  /api/workspace/projetos`
- `GET  /api/workspace/todos`
- `POST /api/workspace/chamados`
- `POST /api/workspace/tarefas`
- `POST /api/workspace/projetos`

**Prefixos de código:**
- Chamados: `CHA-XXXX` (usa ticket.code gerado pelo storage)
- Projetos: `PRO-XXX`
- Tarefas vinculadas: `PRO-XXX·TX` · Tarefas avulsas: `TAR-XXXX`

**Testes:**
- `server/routes/workspace.test.ts` — 6 testes de integração (vitest + supertest)
- Rodar: `npm test`

## Time

| Pessoa  | Papel                                                         |
| ------- | ------------------------------------------------------------- |
| Matheus | CEO / Tech Lead — decisões de produto e arquitetura           |
| Marcelo | CTO / Code Review — **aprovação obrigatória de todos os PRs** |
| Átila   | Senior Developer                                              |
| Juan    | Developer                                                     |
