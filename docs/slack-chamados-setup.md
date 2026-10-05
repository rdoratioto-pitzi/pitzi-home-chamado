# Slack → chamado: configuração

Duas formas de abrir chamado pelo Slack:

- **`/chamado [texto]`** em qualquer canal ou DM: abre uma janela com Título, Descrição,
  Grupo e Tipo (técnicos e admins também escolhem a Gravidade). O solicitante é quem digitou.
- **Atalho de mensagem "Transformar em chamado"** (menu ⋯ da mensagem → *Mais ações*): mesma
  janela, já com o texto e o link da mensagem. O solicitante é o **autor da mensagem**. Só
  técnicos e admins usam o atalho em mensagem de outra pessoa; qualquer pessoa pode usar na
  própria mensagem. Depois de criado, o app responde na thread: "Virou o chamado CHA-XXXX".

A pessoa é reconhecida pelo e-mail do perfil do Slack. Quem ainda não tem cadastro e é de um
domínio liberado (`ALLOWED_GOOGLE_DOMAINS`, hoje `pitzi.com.br`) entra como **Usuário**, igual
ao primeiro login com Google.

## 1. Criar o app (admin do Slack)

1. Abra **https://api.slack.com/apps** → **Create New App** → **From a manifest**.
2. Escolha o workspace da Pitzi.
3. Cole o manifesto abaixo (aba **YAML**) → **Next** → **Create**.

```yaml
display_information:
  name: Chamados Pitzi
  description: Abra chamados da Central de Chamados direto pelo Slack.
  background_color: "#3b42de"
features:
  bot_user:
    display_name: Chamados Pitzi
    always_online: true
  slash_commands:
    - command: /chamado
      url: https://pitzi-home-api.rodrigo-doratioto.workers.dev/api/slack/commands
      description: Abrir um chamado
      usage_hint: "[descrição do problema]"
      should_escape: false
  shortcuts:
    - name: Transformar em chamado
      type: message
      callback_id: transformar_em_chamado
      description: Abre um chamado a partir desta mensagem
oauth_config:
  scopes:
    bot:
      - commands
      - chat:write
      - chat:write.public
      - users:read
      - users:read.email
settings:
  interactivity:
    is_enabled: true
    request_url: https://pitzi-home-api.rodrigo-doratioto.workers.dev/api/slack/interactions
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

Escopos:

| Escopo | Para quê |
|---|---|
| `commands` | `/chamado` e o atalho de mensagem |
| `chat:write` | avisos e a resposta na thread |
| `chat:write.public` | responder na thread de canais **públicos** sem precisar convidar o app |
| `users:read`, `users:read.email` | reconhecer a pessoa pelo e-mail |

## 2. Instalar e copiar as chaves

1. No app, **Install App** → **Install to Workspace** → **Permitir**.
2. Copie o **Bot User OAuth Token** (começa com `xoxb-`), em *OAuth & Permissions*.
3. Copie o **Signing Secret**, em *Basic Information* → *App Credentials*.

## 3. Cadastrar as chaves no Worker

Na pasta `worker/` (o comando pede o valor; ele não aparece na tela):

```bash
set -a; . ~/.cloudflare-token; set +a
npx wrangler secret put SLACK_BOT_TOKEN        # cole o xoxb-...
npx wrangler secret put SLACK_SIGNING_SECRET   # cole o Signing Secret
```

`SLACK_BOT_TOKEN` é o mesmo nome já usado pelas notificações de chamados no Slack
(`server/services/slack.service.ts`); se ele já existir, basta o `SLACK_SIGNING_SECRET`.

## 4. Canais privados

O app responde sozinho nas threads de canais públicos. Em **canais privados**, convide o app
uma vez: no canal, `/invite @Chamados Pitzi`. Sem o convite, o chamado é criado normalmente e o
aviso "Virou o chamado…" vai só para quem clicou (mensagem visível só para a pessoa).

## 5. Testar

1. Em qualquer canal: `/chamado Impressora do 2º andar não imprime` → a janela abre já com o
   título → escolha o grupo → **Abrir chamado**. Chega uma mensagem "Chamado CHA-XXXX aberto ✅".
2. Numa mensagem de outra pessoa: ⋯ → *Mais ações* → **Transformar em chamado** (com conta de
   técnico) → **Abrir chamado**. O app responde na thread com o número e o link.

## Limites (fase 1)

- Grupos com **campos personalizados obrigatórios** não abrem pelo Slack: a janela mostra um
  erro pedindo para abrir pelo sistema.
- Anexos e imagens da mensagem não são copiados; o link da mensagem original vai na descrição.
- A conversa do chamado ainda não volta para a thread (fase 2: o chamado já guarda o canal e a
  thread de origem — `tickets.slack_channel_id`, `slack_thread_ts`, `slack_message_ts`).
- No Express local as rotas respondem 501; só funcionam no Worker de produção.
