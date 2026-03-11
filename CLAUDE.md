# Renov Home — Contexto para Claude Code

## Início de Sessão — Obrigatório
**Ao iniciar qualquer sessão neste projeto**, executar imediatamente:
1. Consultar Memory MCP: `mcp__memory__search_nodes` com query `"Matheus projeto renov"`
2. Usar o contexto recuperado durante toda a sessão

## Projeto
SaaS brasileiro de gestão operacional para empresas de reforma e construção.
Stack: React 18 + Vite + TanStack Query / Express + Node.js (TypeScript) / PostgreSQL + Drizzle ORM / Tailwind + shadcn/ui.

## Comandos Essenciais
```bash
npm run dev        # Inicia dev server (porta 5050)
npm run build      # Build de produção
npm run db:push    # Aplica migrations (drizzle-kit push)
npm run check      # TypeScript type check
```

## Arquivos-Chave
| Arquivo | Responsabilidade |
|---|---|
| `shared/schema.ts` | Schema central do banco (Drizzle ORM) |
| `server/storage.ts` | Camada de acesso a dados (~126KB) |
| `server/routes/` | 25+ rotas da API REST |
| `client/src/pages/` | 23+ páginas do frontend |
| `server/jobs/recurrence.job.ts` | Cron de reuniões recorrentes (todo :15) |

## Padrões Obrigatórios
- **TypeScript** em todo o código — sem `any` desnecessário
- **UI em PT-BR** — todos os textos, labels, mensagens de erro
- **Multi-tenant** — sempre filtrar por `tenantId` em queries de produção
- **Drizzle ORM** com `eq()` para filtros — nunca SQL raw
- **Zod** para validação de dados de entrada
- **shadcn/ui + Tailwind** para componentes — não criar do zero se já existe
- **Reuniões** usam `tasks` com `type="meeting_note"` e `meetingData` (JSON como TEXT)
- **Timezone** — sempre `America/Sao_Paulo` em jobs de recorrência

## Arquitetura de Decisão
- **Planejar antes de implementar** — usar `EnterPlanMode` para tasks não-triviais
- Erros pré-existentes em `storage.ts` (~L3144) e `recurrence.job.ts` (L332/341) são baseline — não reportar como regressão
- Reuniões recorrentes: pai tem `isRecurring=true`, filhos têm `parentTaskId` + `isRecurring=false`
- Templates ficam em `task_templates` (type="meeting")

## Documentação do Projeto
- Arquitetura completa: `docs/arquitetura/`
- Git workflow e PRs: `docs/governanca/git-workflow.md`
- Planos de módulos: `docs/modulos/`
- Agentes de IA: `docs/ai-agents/`

## MCPs Disponíveis
13 servidores configurados em `.mcp.json` — usar automaticamente conforme necessidade.
Documentação detalhada: `docs/MCPs/README.md`

| MCP | Quando usar |
|---|---|
| **github** | PRs, issues, branches, histórico de commits |
| **postgres** / **supabase** | Inspecionar banco, executar queries, migrations |
| **playwright** / **puppeteer** | Testes E2E, automação de browser, screenshots |
| **brave-search** / **firecrawl** | Pesquisa web, scraping de documentação |
| **memory** | Persistir decisões entre sessões — consultar ao iniciar sessão |
| **sequential-thinking** | Raciocínio estruturado para problemas complexos |
| **filesystem** | Navegação e leitura de arquivos do projeto |
| **reactbits** | Componentes React animados para referência |
| **pdf-reader** | Leitura de documentos PDF |
| **claude-context** | Busca semântica no codebase (requer setup Zilliz) |

## Time
| Pessoa | Papel |
|---|---|
| Matheus | CEO / Tech Lead — decisões de produto e arquitetura |
| Marcelo | CTO / Code Review — aprovação de PRs |
| Átila | Senior Developer |
| Juan | Developer |
