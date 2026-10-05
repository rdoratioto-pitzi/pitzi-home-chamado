# Slack → chamado: configuração

Duas formas de abrir chamado pelo Slack:

- **`/chamado [texto]`** em qualquer canal ou DM: abre uma janela com Título, Descrição,
  Grupo e Tipo (técnicos e admins também escolhem a Gravidade). O solicitante é quem digitou.
- **Atalho de mensagem "Transformar em chamado"** (menu ⋯ da mensagem → *Mais ações*): leva a
  **conversa inteira** para o chamado. Pode ser usado em qualquer mensagem da thread:
  - a descrição recebe o texto da janela + "Conversa no Slack (#canal, N mensagens)", o link e
    todas as mensagens em ordem, com nome e horário (até ~30 mil caracteres; se passar, avisa
    que cortou e deixa o link);
  - os **anexos** da conversa (imagens, PDF, Office, txt, csv; até 10, de até 10 MB cada) vão
    para os anexos do chamado; os que não entram ficam listados na descrição;
  - o solicitante é **quem começou a conversa**. Só técnicos e admins transformam conversa
    começada por outra pessoa; qualquer pessoa pode transformar a própria;
  - depois de criado, o app responde na thread: "Virou o chamado CHA-XXXX".

A pessoa é reconhecida pelo e-mail do perfil do Slack. Quem ainda não tem cadastro e é de um
domínio liberado (`ALLOWED_GOOGLE_DOMAINS`, hoje `pitzi.com.br`) entra como **Usuário**, igual
ao primeiro login com Google.

## 1. Criar o app (admin do Slack)

1. Abra **https://api.slack.com/apps** → **Create New App** → **From a manifest**.
2. Escolha o workspace da Pitzi.
3. Cole um dos manifestos abaixo (aba **JSON** ou **YAML**) → **Next** → **Create**.

### Manifesto em JSON

```json
{
  "display_information": {
    "name": "Chamados Pitzi",
    "description": "Abra chamados e transforme conversas em chamados",
    "background_color": "#1933fc"
  },
  "features": {
    "bot_user": {
      "display_name": "Chamados Pitzi",
      "always_online": true
    },
    "shortcuts": [
      {
        "name": "Transformar em chamado",
        "type": "message",
        "callback_id": "transformar_em_chamado",
        "description": "Cria um chamado com esta conversa"
      }
    ],
    "slash_commands": [
      {
        "command": "/chamado",
        "url": "https://pitzi-home-api.rodrigo-doratioto.workers.dev/api/slack/commands",
        "description": "Abrir um chamado",
        "usage_hint": "[descreva o problema]",
        "should_escape": false
      }
    ]
  },
  "oauth_config": {
    "scopes": {
      "bot": [
        "commands",
        "chat:write",
        "chat:write.public",
        "users:read",
        "users:read.email",
        "channels:history",
        "groups:history",
        "im:history",
        "mpim:history",
        "files:read"
      ]
    }
  },
  "settings": {
    "interactivity": {
      "is_enabled": true,
      "request_url": "https://pitzi-home-api.rodrigo-doratioto.workers.dev/api/slack/interactions"
    },
    "org_deploy_enabled": false,
    "socket_mode_enabled": false,
    "token_rotation_enabled": false
  }
}
```

### Manifesto em YAML

```yaml
display_information:
  name: Chamados Pitzi
  description: Abra chamados e transforme conversas em chamados
  background_color: "#1933fc"
features:
  bot_user:
    display_name: Chamados Pitzi
    always_online: true
  slash_commands:
    - command: /chamado
      url: https://pitzi-home-api.rodrigo-doratioto.workers.dev/api/slack/commands
      description: Abrir um chamado
      usage_hint: "[descreva o problema]"
      should_escape: false
  shortcuts:
    - name: Transformar em chamado
      type: message
      callback_id: transformar_em_chamado
      description: Cria um chamado com esta conversa
oauth_config:
  scopes:
    bot:
      - commands
      - chat:write
      - chat:write.public
      - users:read
      - users:read.email
      - channels:history
      - groups:history
      - im:history
      - mpim:history
      - files:read
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
| `users:read`, `users:read.email` | reconhecer a pessoa pelo e-mail e mostrar os nomes na conversa |
| `channels:history`, `groups:history`, `im:history`, `mpim:history` | ler a conversa (thread) de canais públicos, privados, DMs e grupos |
| `files:read` | baixar os anexos da conversa para o chamado |

### App já criado? Atualizar o manifesto

1. **https://api.slack.com/apps** → **Chamados Pitzi** → menu **App Manifest**.
2. Apague o conteúdo, cole o manifesto em JSON acima → **Save Changes**.
3. Vai aparecer um aviso amarelo no topo pedindo para reinstalar: **Reinstall to Workspace** →
   **Permitir**. (O token `xoxb-` continua o mesmo; não precisa cadastrar de novo.)

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

## 4. Canais: convidar o app

Para **ler a conversa** de um canal (público ou privado), o app precisa estar no canal: no
canal, `/invite @Chamados Pitzi`. Sem o convite (ou sem as permissões de histórico), o atalho
avisa quem clicou e o chamado vai só com a mensagem escolhida e o link — o chamado é criado
normalmente.

A resposta "Virou o chamado…" funciona sem convite em canais públicos (`chat:write.public`); em
canais privados sem o app, ela vai só para quem clicou.

## 5. Testar

1. Em qualquer canal: `/chamado Impressora do 2º andar não imprime` → a janela abre já com o
   título → escolha o grupo → **Abrir chamado**. Chega uma mensagem "Chamado CHA-XXXX aberto ✅".
2. Numa conversa com respostas (thread), num canal com o app: ⋯ em qualquer mensagem →
   *Mais ações* → **Transformar em chamado**. A janela diz quem é o solicitante e quantas
   mensagens vão junto → **Abrir chamado**. No chamado, a descrição traz a conversa inteira e os
   anexos aparecem na lista de anexos.

## Limites

- Grupos com **campos personalizados obrigatórios** não abrem pelo Slack: a janela mostra um
  erro pedindo para abrir pelo sistema.
- A conversa é lida no momento do envio da janela (até 200 mensagens); o que for dito depois
  não entra no chamado.
- A conversa do chamado ainda não volta para a thread (fase 2: o chamado já guarda o canal e a
  thread de origem — `tickets.slack_channel_id`, `slack_thread_ts`, `slack_message_ts`).
- No Express local as rotas respondem 501; só funcionam no Worker de produção.
