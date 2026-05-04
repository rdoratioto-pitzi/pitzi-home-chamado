# Hermes — Fase 3: Botões Interativos (Configuração pós-merge)

Esta fase introduz o **approval gate humano** no Slack: o Hermes posta
uma mensagem-mãe na thread do chamado com 3 botões (Aprovar, Ajustar,
Cancelar) e o Renov Home registra a decisão em `hermes_slack_threads`.

A execução real pós-aprovação **continua sendo feita manualmente** —
isso é escopo da Fase 4.

---

## Checklist do Matheus (após merge da PR)

### 1. Aplicar migration no Neon — DEV

Ambiente: branch `development` no Neon SQL Editor. Conteúdo do arquivo
[`migrations/0015_hermes_slack_threads.sql`](../../../migrations/0015_hermes_slack_threads.sql).

```sql
CREATE TABLE IF NOT EXISTS hermes_slack_threads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id          UUID NOT NULL UNIQUE
                      REFERENCES tickets(id) ON DELETE CASCADE,
  thread_ts           TEXT NOT NULL,
  channel_id          TEXT NOT NULL,
  decision            TEXT,
  decision_by_user_id TEXT,
  decision_at         TIMESTAMP,
  ajuste_feedback     TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hermes_slack_threads_chamado_idx
  ON hermes_slack_threads(chamado_id);
```

Validar:

```sql
SELECT count(*) FROM hermes_slack_threads;          -- deve retornar 0
\d hermes_slack_threads                             -- ver colunas + FK
```

### 2. Configurar Interactivity & Shortcuts no Slack

App: **Hermes** em https://api.slack.com/apps.

1. Em **Interactivity & Shortcuts**:
   - Toggle **Interactivity = On**
   - **Request URL** = `https://homeapi-dev.renovsmart.com.br/api/integrations/slack/interactions`
   - Salvar
2. Verificar em **OAuth & Permissions** que o bot tem os escopos:
   - `chat:write`
   - `chat:write.public` (se canal público)
   - `views:write` (necessário para abrir o modal de "Ajustar")
3. Reinstalar o app no workspace se algum escopo foi adicionado.

> O Slack faz uma chamada de teste para a Request URL ao salvar — se
> o endpoint responder 200 com signature válida, OK. Se receber 401, a
> SLACK_SIGNING_SECRET no Worker está errada.

### 3. Confirmar `SLACK_SIGNING_SECRET` no Worker

```bash
cd worker
npx wrangler secret list --env=""              # produção
npx wrangler secret list --env=dev             # dev
```

Deve aparecer `SLACK_SIGNING_SECRET`. Se não, setar:

```bash
npx wrangler secret put SLACK_SIGNING_SECRET --env=dev
```

(o valor vem de **Basic Information → App Credentials → Signing Secret**
no painel do Slack App).

### 4. Atualizar prompt da Routine para v6

Routine: **Hermes — Triagem** em https://claude.ai/code/routines.

1. Substituir todo o conteúdo do prompt pelo arquivo
   [`docs/agents/hermes/prompts/triage-v6.md`](prompts/triage-v6.md).
2. No ambiente **Renov-Default**, criar/atualizar variáveis:
   - `RENOV_API_URL` = `https://homeapi-dev.renovsmart.com.br`
   - `RENOV_API_TOKEN` = _token gerado para `hermes@renov.com` em dev_

Para gerar o token (autenticado como admin via cookie de sessão):

```bash
curl -X POST \
  https://homeapi-dev.renovsmart.com.br/api/admin/service-accounts/<hermes_user_id>/generate-token \
  -H "Cookie: renov.sid=<sessão admin>"
```

Resposta inclui o `token` em plaintext **uma única vez**.

### 5. Plano de teste E2E em Dev

1. Criar um chamado novo em https://home-dev.renovsmart.com.br/workspace/chamados:
   - Título: "Teste Fase 3 Hermes"
   - Aplicação: Renov Home
   - Tipo: Bug
2. Aguardar (≤ 30s) — Hermes deve postar mensagem-mãe no canal de devs
   com 3 botões.
3. Verificar no Neon (dev):
   ```sql
   SELECT * FROM hermes_slack_threads
   ORDER BY created_at DESC LIMIT 1;
   ```
   Deve haver uma linha com `chamado_id` igual ao do ticket recém-criado,
   `thread_ts` e `channel_id` preenchidos, `decision = NULL`.
4. Clicar em **✅ Aprovar** na thread do Slack.
5. Reply automático na thread: _"✅ Aprovado por @matheus. Hermes irá
   executar nos próximos passos."_
6. Reconsultar a tabela:
   ```sql
   SELECT decision, decision_by_user_id, decision_at FROM hermes_slack_threads
   WHERE chamado_id = '<id>';
   ```
   `decision = 'aprovado'`, `decision_by_user_id` ≠ NULL, `decision_at` ≠ NULL.
7. Repetir o fluxo num segundo chamado clicando em **⏸ Ajustar**:
   - Slack abre modal pedindo o feedback
   - Submeter "preciso de mais detalhes"
   - Reply na thread: _"⏸ Ajuste solicitado por @matheus: preciso de mais detalhes"_
   - `decision = 'ajustar'`, `ajuste_feedback = 'preciso de mais detalhes'`.
8. Repetir num terceiro chamado clicando em **❌ Cancelar**:
   - Reply: _"❌ Cancelado por @matheus. Atendimento encerrado."_
   - `decision = 'cancelado'`.

### 6. Promover para Prod

Se 5 está OK:

1. Aplicar `migrations/0015_hermes_slack_threads.sql` no Neon **prod**
   (branch `production`).
2. Mudar **Request URL** no Slack App para
   `https://homeapi.renovsmart.com.br/api/integrations/slack/interactions`.

   > Atenção: o Slack só permite **uma** Request URL por app. Para manter
   > dev e prod simultâneos é necessário criar um segundo Slack App
   > apontando para dev. Por enquanto, alternar manualmente é aceitável.
3. Atualizar `RENOV_API_URL` na Routine para
   `https://homeapi.renovsmart.com.br` e `RENOV_API_TOKEN` para o
   token de produção.
4. Repetir o teste E2E em prod com um chamado real (ou de teste
   marcado).

---

## Endpoints expostos

| Método | Path                                              | Auth                | Origem chamada                       |
| ------ | ------------------------------------------------- | ------------------- | ------------------------------------ |
| POST   | `/api/integrations/hermes/thread-registered`      | Bearer (service acc.) | Routine Hermes (após postar Slack)  |
| POST   | `/api/integrations/slack/interactions`            | Slack signature     | Slack (block_actions, view_submission) |

URLs públicas:

- Dev:  `https://homeapi-dev.renovsmart.com.br`
- Prod: `https://homeapi.renovsmart.com.br`

---

## Troubleshooting

- **Botão clicado, sem reply na thread**: ver logs do Worker
  (`wrangler tail --env=dev`). Pode ser que `SLACK_BOT_TOKEN` esteja
  ausente ou que `mapping não encontrado` (Routine não chamou
  `thread-registered`).
- **401 ao Slack salvar Request URL**: `SLACK_SIGNING_SECRET` errado
  no Worker. Comparar com Slack App → Basic Information.
- **Routine recebe 401 ao chamar `thread-registered`**: token expirou
  (TTL = 1 ano) ou foi rotacionado. Gerar novo via
  `/api/admin/service-accounts/<id>/generate-token` e atualizar a
  variável `RENOV_API_TOKEN` no ambiente da Routine.
- **Modal não abre ao clicar em "Ajustar"**: falta o escopo
  `views:write` no Slack App ou o `trigger_id` expirou (vale 3s).

---

## O que NÃO está nesta fase

- Execução real após "Aprovar" (escopo da Fase 4: Routine "Hermes
  Executor" que escuta a tabela `hermes_slack_threads` ou recebe
  webhook do Home quando `decision = 'aprovado'`).
- Re-análise automática após "Ajustar" — por enquanto o feedback fica
  só registrado em `ajuste_feedback`.
- UI no Renov Home mostrando o histórico de decisões do Hermes.
