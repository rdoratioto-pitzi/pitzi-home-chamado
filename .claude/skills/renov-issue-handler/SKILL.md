---
name: renov-issue-handler
description: >
  Detecta e resolve proativamente issues (bugs e melhorias) abertas no repositorio
  Renov.Home. Use esta skill quando o usuario pedir para verificar chamados abertos,
  resolver bugs, implementar melhorias, ou quando mencionar "issues", "chamados",
  "bugs", "REN-", "Linear", "melhorias pendentes", "backlog", ou qualquer referencia
  a tarefas abertas no projeto. Tambem ativa quando o usuario pede para "assumir um
  chamado", "pegar uma task", "resolver issue", ou "verificar o que tem pendente".
license: Apache-2.0
compatibility: Requires git, gh CLI, and access to GitHub Issues / Linear API
metadata:
  author: renov-home-team
  version: "1.0"
allowed-tools: Bash(git:*) Bash(gh:*) Read Write Edit Glob Grep
---

# Renov Issue Handler

Skill para deteccao proativa e resolucao automatizada de bugs e melhorias no Renov.Home.

## Fluxo Completo

O fluxo segue 6 etapas obrigatorias, **sempre nesta ordem**:

### Etapa 1: Descoberta de Chamados

Buscar issues abertas no repositorio usando GitHub Issues e/ou Linear:

```bash
# GitHub Issues - buscar bugs e melhorias abertos
gh issue list --repo Renov-BD/Renov.Home --state open --label "bug" --json number,title,body,labels,assignees,createdAt
gh issue list --repo Renov-BD/Renov.Home --state open --label "enhancement" --json number,title,body,labels,assignees,createdAt

# Se Linear estiver disponivel via MCP, buscar tambem:
# Issues com status "Todo" ou "In Progress" do projeto Renov Home
```

Priorizar por:

1. Bugs criticos (label: `critical`, `urgent`, `P0`)
2. Bugs normais (label: `bug`)
3. Melhorias (label: `enhancement`, `improvement`)
4. Data de criacao (mais antigos primeiro)

### Etapa 2: Notificacao Imediata

Assim que identificar um chamado para trabalhar, **notificar o usuario IMEDIATAMENTE** com:

```
## Assumindo Chamado REN-XX / Issue #XX

**Titulo:** [titulo do chamado]
**Tipo:** Bug / Melhoria
**Prioridade:** Alta / Media / Baixa
**Descricao:** [resumo em 2-3 linhas]

Estou iniciando a investigacao. Vou analisar o codigo relacionado e apresentar
um plano de acao antes de fazer qualquer alteracao.
```

Atualizar o status da issue no GitHub:

```bash
gh issue comment [NUMBER] --body "Chamado assumido por Claude Agent. Investigacao em andamento."
```

### Etapa 3: Investigacao e Diagnostico

Investigar a causa raiz do problema:

1. **Ler a descricao completa** da issue (body, comentarios, screenshots)
2. **Localizar arquivos relacionados** usando Grep e Glob no codebase
3. **Entender o contexto** — ler os arquivos envolvidos completamente
4. **Identificar a causa raiz** para bugs, ou **mapear o escopo** para melhorias
5. **Verificar dependencias** — outros modulos/funcoes afetados

Arquivos-chave do Renov.Home para investigacao:

- `shared/schema.ts` — Schema central (Drizzle ORM)
- `server/storage.ts` — Camada de dados (~126KB)
- `server/routes/` — 25+ rotas REST
- `client/src/pages/` — 23+ paginas frontend
- `server/jobs/recurrence.job.ts` — Cron de reunioes

### Etapa 4: Apresentar Plano ao Usuario

**OBRIGATORIO: Nao executar nenhuma alteracao sem aprovacao.**

Apresentar plano estruturado:

```
## Plano de Acao — REN-XX / Issue #XX

### Diagnostico
[Explicacao clara da causa raiz ou escopo da melhoria]

### Arquivos Afetados
- `path/to/file1.ts` — [o que sera alterado]
- `path/to/file2.tsx` — [o que sera alterado]

### Alteracoes Propostas
1. [Alteracao 1 — descricao clara]
2. [Alteracao 2 — descricao clara]

### Riscos
- [Risco potencial e mitigacao]

### Estimativa de Impacto
- Arquivos modificados: X
- Linhas alteradas (aprox): Y

Aprovar para prosseguir?
```

**Aguardar aprovacao explicita do usuario antes da Etapa 5.**

### Etapa 5: Execucao

Apos aprovacao:

1. **Criar branch seguindo o padrao** (usar skill renov-git-workflow se disponivel):

   ```bash
   git checkout develop
   git pull origin develop
   # Para bugs:
   git checkout -b fix/REN-XX-descricao-curta
   # Para melhorias:
   git checkout -b feat/REN-XX-descricao-curta
   ```

2. **Implementar as alteracoes** conforme plano aprovado

3. **Validar:**
   - TypeScript sem erros: `npm run check`
   - Build funcional: `npm run build`
   - Sem `console.log` esquecidos
   - Sem arquivos `.env`
   - Textos da UI em PT-BR
   - Filtros com `tenantId` em queries (multi-tenant)

4. **Commitar seguindo Conventional Commits:**

   ```bash
   git add [arquivos especificos]
   git commit -m "fix(modulo): descricao do que foi corrigido

   Resolve #XX"
   ```

### Etapa 6: Entrega — Pull Request

Criar PR contra `develop`:

```bash
gh pr create --base develop \
  --title "fix(modulo): titulo descritivo" \
  --body "## O que foi feito
- [Descricao das alteracoes]

## Issue relacionada
Closes #XX

## Como testar
1. [Passo 1]
2. [Passo 2]

## Checklist
- [x] Branch criada a partir de develop
- [x] TypeScript sem erros (npm run check)
- [x] Build OK (npm run build)
- [x] Sem console.log esquecidos
- [x] UI em PT-BR
- [x] Multi-tenant (tenantId) respeitado" \
  --reviewer marcelo-maciel
```

Notificar o usuario:

```
## PR Entregue — REN-XX / Issue #XX

**PR:** [link do PR]
**Branch:** fix/REN-XX-descricao
**Reviewer:** @marcelo-maciel (obrigatorio)
**Status:** Aguardando review

Resumo das alteracoes:
- [bullet points]
```

## Regras Importantes

- **NUNCA** alterar codigo sem aprovacao do plano (Etapa 4)
- **NUNCA** fazer PR contra `main` — sempre contra `develop`
- **NUNCA** fazer merge sem aprovacao do Marcelo (CTO)
- **SEMPRE** notificar o usuario ao assumir um chamado
- **SEMPRE** seguir Conventional Commits
- **SEMPRE** validar TypeScript e build antes do PR
- Erros pre-existentes em `storage.ts` (~L3144) e `recurrence.job.ts` (L332/341) sao baseline — nao reportar como regressao
