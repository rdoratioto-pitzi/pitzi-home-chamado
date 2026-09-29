# ADR 0001 — Backend principal: Worker (Hono)

Data: 22/09/2026 · Status: aceita (Fase 0)

## Contexto

O projeto tem dois backends com rotas equivalentes:

- `worker/` — Cloudflare Worker com Hono. É o único com deploy automatizado
  (`.github/workflows/deploy-worker.yml`) e o que roda em produção.
- `server/` — Express. Roda localmente (`npm run dev`) e não tem deploy configurado.

A regra atual ("toda rota em `server/routes/` deve ser espelhada em `worker/src/routes/`")
duplica regras de negócio e já produziu divergências de autenticação, autorização e
contratos entre os dois.

## Decisão

1. **O Worker é o backend de produção e a referência de comportamento.** Regras novas
   de negócio e de acesso são implementadas primeiro para ele.
2. **Regras compartilhadas ficam em `shared/` ou em `server/storage.ts`**, que os dois
   backends já importam (ex.: `shared/ticket-comments.ts`, `shared/password.ts`,
   `shared/tenant.ts`, `shared/module-routes.ts`). Rotas cuidam só de HTTP.
3. **Os módulos ITSM (Fase 1 em diante) existem apenas no Worker**, sob `/api/v1`.
   O Express não recebe espelho dessas rotas.
4. **O Express segue como ambiente local para os módulos atuais** até ser substituído
   por `wrangler dev`. Correções de segurança que dependem só de `storage`/`shared`
   valem nos dois; as que dependem do middleware do Worker (sessão por `sid`,
   isolamento de tenant, permissões de módulo) valem só no Worker.

## Consequências

- Testes de regras de negócio miram o Worker e as funções de `shared/`/`storage`.
- O Express não deve ser exposto publicamente: parte dos controles da Fase 0 não existe nele.
- Mudanças de schema seguem a regra de migrations do `CLAUDE.md` (`npm run db:migrate`).
