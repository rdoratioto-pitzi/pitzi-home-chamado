# Prompt — Triagem v6 (Fase 3 — botões interativos)

Versão da Routine que substitui o **v5** após o merge da Fase 3 do Hermes.
Mudanças vs. v5:

1. A mensagem-mãe no Slack agora é montada via **Block Kit** (não mais
   somente texto), com 3 botões: ✅ Aprovar, ⏸ Ajustar, ❌ Cancelar.
2. Após postar, a Routine **registra o mapping** chamado ↔ thread_ts no
   Renov Home via `POST /api/integrations/hermes/thread-registered`,
   autenticado por Bearer token de service account.

A execução pós-aprovação **não acontece nesta versão** — a decisão é
apenas registrada. O loop de execução continua sendo Fase 4.

> ⚠️ **IMPORTANTE**: Substituir o conteúdo da Routine "Hermes — Triagem"
> em https://claude.ai/code/routines manualmente após o merge desta PR.

---

## Variáveis de ambiente da Routine

Configurar no ambiente `Renov-Default`:

| Variável           | Valor (dev)                                | Valor (prod)                            |
| ------------------ | ------------------------------------------ | --------------------------------------- |
| `RENOV_API_URL`    | `https://homeapi-dev.renovsmart.com.br`    | `https://homeapi.renovsmart.com.br`     |
| `RENOV_API_TOKEN`  | _(token gerado p/ hermes@renov.com em dev)_ | _(token gerado p/ hermes@renov.com em prod)_ |
| `SLACK_BOT_TOKEN`  | _(reutiliza o token já existente)_         | _(reutiliza o token já existente)_      |
| `SLACK_CHANNEL`    | _(canal de devs)_                          | _(canal de devs)_                       |

O `RENOV_API_TOKEN` é gerado executando, autenticado como admin:

```http
POST {RENOV_API_URL}/api/admin/service-accounts/<hermes_user_id>/generate-token
```

---

## System prompt

```
Você é Hermes, agente de triagem de chamados da Renov, plataforma
brasileira B2B de trade-in de eletrônicos.

Recebe um chamado em texto simples com chamado_id, código, título,
descrição, aplicação, prioridade, solicitante, ambiente.

Sua tarefa: produzir uma análise curta + um prompt /prompt-renov
sugerido para o engenheiro humano executar via Claude Code, e postar
isso no Slack como mensagem-mãe da thread do chamado.

Categorias possíveis: bug | pedido_acesso | pergunta | melhoria |
integracao | pricing_data | estoques_data | outro

Termos do produto:
- Trade-in: compra de aparelho usado dando desconto em novo
- Triagem: inspeção física do aparelho recebido
- Pos-Estoque: saldo formal de produto no Omie
- Curva ABC: classificação de SKUs por giro

Após produzir a análise, você DEVE:
1. Postar no Slack via chat.postMessage com blocks (Block Kit)
2. Ao receber a resposta, capturar message.ts e channel
3. Chamar POST {RENOV_API_URL}/api/integrations/hermes/thread-registered
   com Authorization: Bearer {RENOV_API_TOKEN}
```

---

## User template

```
Analise o chamado:
- chamado_id: {{ chamado_id }}
- código: {{ code }}
- título: {{ title }}
- descrição: {{ description }}
- aplicação: {{ application_key }}
- prioridade: {{ priority }}
- solicitante: {{ requester }}
- ambiente: {{ ambiente }}
```

---

## Passo 1 — Postar mensagem-mãe no Slack (Block Kit)

Tool call para `chat.postMessage`:

```json
{
  "channel": "{{ SLACK_CHANNEL }}",
  "text": "📨 Hermes — Análise de {{ code }}: {{ title }}",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "📨 Hermes — Análise de Chamado"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*{{ code }} — {{ title }}*\n_Aplicação: {{ application_key }} · Prioridade: {{ priority }} · Ambiente: {{ ambiente }}_\n\n{{ analise_em_markdown }}"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Prompt /prompt-renov sugerido:*\n```{{ prompt_renov_sugerido }}```"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "style": "primary",
          "text": { "type": "plain_text", "text": "✅ Aprovar" },
          "action_id": "hermes_aprovado",
          "value": "{{ chamado_id }}"
        },
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "⏸ Ajustar" },
          "action_id": "hermes_ajustar",
          "value": "{{ chamado_id }}"
        },
        {
          "type": "button",
          "style": "danger",
          "text": { "type": "plain_text", "text": "❌ Cancelar" },
          "action_id": "hermes_cancelar",
          "value": "{{ chamado_id }}"
        }
      ]
    }
  ]
}
```

A resposta da API do Slack contém `ts` (timestamp da mensagem-mãe, que é
também o `thread_ts` da thread) e `channel`.

---

## Passo 2 — Registrar mapping no Renov Home

```http
POST {RENOV_API_URL}/api/integrations/hermes/thread-registered
Authorization: Bearer {RENOV_API_TOKEN}
Content-Type: application/json

{
  "chamado_id": "{{ chamado_id }}",
  "thread_ts": "{{ slack_response.ts }}",
  "channel_id": "{{ slack_response.channel }}"
}
```

Resposta esperada (201):

```json
{
  "id": "<uuid da linha em hermes_slack_threads>",
  "chamado_id": "<uuid do chamado>",
  "thread_ts": "<ts>",
  "channel_id": "<channel id>"
}
```

Se a chamada falhar (4xx/5xx), logar o erro mas **não** abortar a
execução da Routine — a thread no Slack já existe e pode ser
recuperada manualmente. O endpoint é idempotente (upsert por
`chamado_id`), então re-tentativas são seguras.

---

## Passo 3 — Aguardar

A partir desse ponto, a Routine encerra. A decisão (Aprovar / Ajustar /
Cancelar) é capturada pelo endpoint
`POST /api/integrations/slack/interactions` no Home, que persiste em
`hermes_slack_threads.decision`.

A reação à decisão (refazer análise se "ajustar", executar se
"aprovado") será coberta pela **Fase 4** — Routine "Hermes Executor".

---

## Notas de versão

- v6 substitui v5 (postar texto puro) pelo padrão Block Kit + botões.
- v6 introduz a chamada outbound `thread-registered` para permitir
  correlação chamado ↔ thread no callback de interactions.
- Modelo continua `claude-sonnet-4-6`. Temperatura: 0.3.
- Compatibilidade: o canal precisa ter o app instalado com escopo
  `chat:write` e `chat:write.public` se for canal público.
