# Documentação — Renov Home

> Documentação central do projeto. Ponto de entrada para devs e assistentes de IA.

**Repositório:** https://github.com/Renov-BD/Renov.Home
**Stack:** React + Vite · Express/Node.js · PostgreSQL · Drizzle ORM · Tailwind + shadcn/ui

---

## Estrutura

```
docs/
├── QUICK-START.md          → Contexto essencial em 5 minutos
├── arquitetura/            → Stack, módulos, contexto e integrações
├── governanca/             → Git workflow, PRs, convenções
├── modulos/                → Planos e docs de features específicas
├── ai-agents/              → Guias de uso dos agentes de IA (Max, Claude, etc.)
└── archive/                → Documentação antiga / legado
```

---

## Início Rápido

1. **[QUICK-START.md](QUICK-START.md)** — comece aqui (devs e IAs)
2. **[arquitetura/01-arquitetura.md](arquitetura/01-arquitetura.md)** — stack técnico completo
3. **[arquitetura/02-modulos.md](arquitetura/02-modulos.md)** — visão geral de todos os módulos

---

## Arquitetura

| Arquivo | Conteúdo |
|---------|----------|
| [00-contexto.md](arquitetura/00-contexto.md) | Empresa, missão, filosofia "Vibe Coding" |
| [01-arquitetura.md](arquitetura/01-arquitetura.md) | Stack técnico e estrutura de pastas |
| [02-modulos.md](arquitetura/02-modulos.md) | Overview de todos os módulos do sistema |
| [04-apis-integracao.md](arquitetura/04-apis-integracao.md) | Integrações externas (Omie, Correios, OpenRouter...) |

---

## Governança

| Arquivo | Conteúdo |
|---------|----------|
| [03-governanca.md](governanca/03-governanca.md) | Processo de PRs, code review, filosofia |
| [git-workflow.md](governanca/git-workflow.md) | Branches, commits, regras críticas |

---

## Módulos / Features

Documentação de planos de implementação e melhorias por módulo:

| Arquivo | Módulo |
|---------|--------|
| [reunioes-implementation-plan.md](modulos/reunioes-implementation-plan.md) | Reuniões recorrentes e templates |
| [csat-implementation-plan.md](modulos/csat-implementation-plan.md) | Avaliação de satisfação (CSAT) |
| [omie-integration.md](modulos/omie-integration.md) | Integração Omie ERP |
| [authentication-ui-improvements.md](modulos/authentication-ui-improvements.md) | Melhorias de UI na autenticação |

---

## Agentes de IA

Guias para uso dos agentes autônomos de desenvolvimento:

| Arquivo | Conteúdo |
|---------|----------|
| [ai-agents/README.md](ai-agents/README.md) | Visão geral do sistema de agentes |
| [ai-agents/guia-uso-diario.md](ai-agents/guia-uso-diario.md) | Workflow diário: criar planos e executar |
| [ai-agents/troubleshooting.md](ai-agents/troubleshooting.md) | Problemas comuns e soluções |
| [ai-agents/feedback-aprendizados.md](ai-agents/feedback-aprendizados.md) | Erros anteriores e lições aprendidas |
| [ai-agents/heartbeat.md](ai-agents/heartbeat.md) | Status e health check dos agentes |
| [ai-agents/openclaw-prompts/](ai-agents/openclaw-prompts/) | Templates de prompts para OpenClaw |

---

## Informações Essenciais

### Stack
- **Frontend:** React 18 + TypeScript + Vite + TanStack Query
- **Backend:** Express.js + Node.js (TypeScript)
- **Database:** PostgreSQL via Drizzle ORM
- **UI:** Tailwind CSS + shadcn/ui
- **Timezone:** America/Sao_Paulo

### Time
| Nome | Papel |
|------|-------|
| Matheus | CEO / Tech Lead |
| Marcelo | CTO / Code Review |
| Átila | Senior Developer |
| Juan | Developer |

### Branches
- `main` — produção (protegida)
- `develop` — base de desenvolvimento
- `feature/nome` — features

---

**Última atualização:** Março 2026
