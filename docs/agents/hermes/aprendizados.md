# Aprendizados — Hermes

Limitações descobertas durante os spikes e workarounds adotados. Esses
itens são pontos de atenção para quem for trabalhar nas próximas fases.

## Sandbox bloqueando porta 5432 (Postgres direto)

Na máquina de desenvolvimento usada nos spikes, a sandbox do Claude Code
bloqueia conexões diretas à porta 5432, o que impedia testar alterações
no banco a partir do código do agente local.

**Workaround**: não conectar direto no Neon. O agente sempre consome a
API REST do Home (passando por Worker em prod / Express em dev), nunca o
banco. Essa restrição na verdade ajudou — manteve o desenho mais limpo,
com Hermes tratado como mais um cliente HTTP comum.

## tsc baseline com erros pré-existentes

`storage.ts` (~L3144) e `recurrence.job.ts` (L332/341) têm erros de
TypeScript que existiam antes do trabalho do agente. CLAUDE.md pede para
não tratar esses como regressão.

**Aprendizado**: ao validar o trabalho com `npx tsc --noEmit`, é
esperado ver esses erros pré-existentes. O critério de aceitação é "não
introduzir erros novos", e não "tsc limpo". Para PRs grandes, comparar
o output de `tsc` antes e depois.

## Dual runtime Express + Worker

Toda rota nova precisa ser espelhada em `server/routes/` (Express dev) e
em `worker/src/routes/` (Hono produção). Esquecer um dos dois causa 404
em prod.

**Aprendizado**: quando criar uma rota nova, abrir os dois arquivos
lado a lado. O Worker tem `requireAdmin` como `MiddlewareHandler` (Hono),
o Express tem como `(req, res, next)`. As implementações são diferentes
mas a semântica precisa ser idêntica.

## Email service account não recebe e-mail de boas-vindas

A função `sendWelcomeEmail` é chamada em `POST /api/users` quando o
usuário tem senha. Hermes não tem senha (`password = NULL`), então o
e-mail não é disparado — comportamento desejado.

**Aprendizado**: criar service accounts via `INSERT` direto na migration
em vez de via endpoint admin garante que nenhum side-effect (e-mail,
Slack DM de boas-vindas, etc.) é acionado.

## Token plaintext só aparece uma vez

Após a chamada do endpoint `generate-token`, o token plain só existe na
resposta HTTP. Se o admin perder, precisa gerar de novo (que invalida o
anterior). Não há "ver token atual".

**Aprendizado**: documentar fortemente no Slack/handover que o admin
deve copiar o token imediatamente para os secrets da Routine antes de
fechar a aba do navegador.

## Admin tem acesso a todos os tenants

Hermes tem `is_admin = true` e `tenant_id = NULL`. Em queries multi-tenant
isso significa que o agente vê todos os tickets independente de
tenantId. Esse é o comportamento esperado para a primeira versão (Renov
opera todos os tenants centralizadamente), mas se o produto evoluir para
isolamento mais forte, será preciso revisitar.
