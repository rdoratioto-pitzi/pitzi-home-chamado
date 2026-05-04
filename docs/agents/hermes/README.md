# Hermes — Agente de Triagem e Execução de Chamados

> Agente baseado em Claude que recebe eventos de chamados (tickets) do
> Renov.Home, faz triagem inicial e — quando aplicável — executa ações
> diretamente via API usando uma service account dedicada.

## Status

| Fase | Descrição | Estado |
|------|-----------|--------|
| 1 | Documentação + service account + endpoint de token | ✅ Mergeada |
| 2 | Webhook outbound `ticket.created` → Routine de triagem | 🟡 Em andamento (PR atual) |
| 3 | Loop de execução autônoma com aprovação humana | ⬜ Pendente |
| 4 | Integração com Slack App (notificação + aprovação) | ⬜ Pendente |

## Visão geral

Hermes nasce como uma combinação de três peças:

1. **Routines da Anthropic** — orquestra os prompts de triagem e execução,
   recebendo o contexto do chamado via webhook do Renov.Home.
2. **Slack App da Renov** — entrega o resultado da triagem ao canal/DM
   apropriado e captura aprovações humanas para ações executáveis.
3. **Service account `hermes@renovsmart.com.br`** — credencial técnica do agente
   no banco do Home. É o "usuário" que aparece como autor de comentários
   em chamados quando Hermes age, e é dela que sai o token Bearer usado
   nas chamadas autenticadas para a API do Home.

A separação garante que toda ação do agente é rastreável (audit trail no
banco), revogável (basta desativar o usuário ou rotacionar o token) e
dentro do mesmo modelo de permissões do restante da plataforma.

## Documentos relacionados

- [arquitetura.md](./arquitetura.md) — diagrama de componentes e fluxo de dados
- [auth.md](./auth.md) — modelo de autenticação Bearer e rotação de token
- [spike-results.md](./spike-results.md) — resultados das execuções v1 → v4-exec
- [aprendizados.md](./aprendizados.md) — limitações e workarounds descobertos
- [prompts/triage-v4.md](./prompts/triage-v4.md) — prompt de triagem em uso
- [prompts/executor-v1.md](./prompts/executor-v1.md) — prompt de execução
- [configuracao-fase2.md](./configuracao-fase2.md) — como ligar o webhook outbound em dev/prod

## Escopo desta fase (Fase 2)

A Fase 2 conecta o ponto de criação de chamado à Routine Hermes:

- `server/services/hermes-trigger.service.ts` (Express) e
  `worker/src/services/hermes-trigger.service.ts` (Worker) são acionados
  por hook fire-and-forget na rota `POST /api/tickets`.
- Disparo só ocorre se `type === 'bug'` e `applicationKey ∈ {renov-home,
  renov-hub, venus}`. `pitzi-duda` é explicitamente bloqueada.
- Em caso de falha de rede, timeout ou config ausente, o serviço loga e
  retorna; a criação do chamado **nunca** é afetada.

Ainda fora de escopo (Fase 3+):

- Consumir resposta da Routine e postar análise no Slack.
- Approval gate (`@Hermes aprovado`) e tabela `hermes_slack_threads`.
- Routine Executor que chama a API do Home com Bearer token da Fase 1.
