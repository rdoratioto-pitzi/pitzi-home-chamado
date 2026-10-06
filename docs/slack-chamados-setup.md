# Slack → chamado: configuração

Três formas de abrir chamado pelo Slack:

- **`/chamado [texto]`** em qualquer canal ou DM: abre uma janela com Título, Descrição,
  Grupo e Tipo (técnicos e admins também escolhem a Gravidade). O solicitante é quem digitou.
  O comando do Slack só recebe o texto digitado — não sabe em qual thread a pessoa estava —,
  então ele **não** leva conversa; para isso use os atalhos de mensagem abaixo.
- **Criar chamado** (menu ⋯ da mensagem → *Conectar-se a apps* / *Mais ações*): cria na hora,
  sem janela, no grupo padrão. Callback `transformar_em_chamado` (mantido por compatibilidade).
- **Criar chamado avançado**: abre o formulário (grupo, tipo, gravidade) com o texto
  preenchido. Callback `criar_chamado_avancado`.

**Conversa inteira:** nos dois atalhos, se a mensagem faz parte de uma thread (é a raiz com
respostas ou uma resposta), o chamado leva **a thread toda** (até 200 mensagens): cabeçalho
"Conversa no Slack (#canal, N mensagens)", link, e cada mensagem como "**Nome** (dd/mm HH:mm):
texto" na ordem, com menções convertidas em nomes. Os **anexos** da conversa (imagens, PDF,
Office, txt, csv — até 10 arquivos de até 10 MB) são importados para o chamado; os outros ficam
listados na descrição. O **solicitante é quem começou a conversa** (autor da raiz); só
técnicos/admins transformam conversa iniciada por outra pessoa. A mesma conversa não vira dois
chamados (a chave é canal + mensagem raiz). No avançado, a conversa é lida no envio da janela.

A confirmação e os botões Assumir, Em atendimento, Resolver e Ver chamado ficam na thread. Se o
app não estiver no canal, a confirmação (com o link) vai por **DM** para quem clicou, com a
dica de convidar o app. As ações validam conta ativa, módulo chamados, workspace, tenant e
acesso ao chamado.

A pessoa é reconhecida pelo e-mail do perfil do Slack. Quem ainda não tem cadastro e é de um
domínio liberado (`ALLOWED_GOOGLE_DOMAINS`, hoje `pitzi.com.br`) entra como **Usuário**, igual
ao primeiro login com Google. Sem e-mail no Slack, é necessário um vínculo prévio por
`users.slack_user_id`; um autor sem vínculo e sem e-mail é recusado.

## 1. Criar ou atualizar o app (admin do Slack)

**App novo:** **https://api.slack.com/apps** → **Create New App** → **From a manifest** →
workspace da Pitzi → cole o manifesto (aba JSON) → **Next** → **Create**.

**App já criado ("Chamados Pitzi"):** **https://api.slack.com/apps** → *Chamados Pitzi* →
**App Manifest** → aba JSON → apague tudo e cole o manifesto → **Save Changes** → no aviso
amarelo, **Reinstall to Workspace** → **Permitir**. O token `xoxb-` continua o mesmo.

```json
{
  "display_information": {
    "name": "Chamados Pitzi",
    "description": "Abra chamados e transforme conversas em chamados",
    "background_color": "#1933fc"
  },
  "features": {
    "bot_user": { "display_name": "Chamados Pitzi", "always_online": true },
    "shortcuts": [
      { "name": "Criar chamado", "type": "message", "callback_id": "transformar_em_chamado", "description": "Cria um chamado com esta conversa" },
      { "name": "Criar chamado avançado", "type": "message", "callback_id": "criar_chamado_avancado", "description": "Abre o formulário com esta conversa" }
    ],
    "slash_commands": [
      { "command": "/chamado", "url": "https://pitzi-home-api.rodrigo-doratioto.workers.dev/api/slack/commands", "description": "Abrir um chamado", "usage_hint": "[descreva o problema]", "should_escape": false }
    ]
  },
  "oauth_config": {
    "scopes": {
      "bot": ["commands", "chat:write", "chat:write.public", "users:read", "users:read.email", "channels:history", "groups:history", "im:history", "mpim:history", "files:read", "im:write"]
    }
  },
  "settings": {
    "interactivity": { "is_enabled": true, "request_url": "https://pitzi-home-api.rodrigo-doratioto.workers.dev/api/slack/interactions" },
    "org_deploy_enabled": false,
    "socket_mode_enabled": false,
    "token_rotation_enabled": false
  }
}
```

O mesmo em YAML:

```yaml
display_information:
  name: Chamados Pitzi
  description: Abra chamados e transforme conversas em chamados
  background_color: "#1933fc"
features:
  bot_user:
    display_name: Chamados Pitzi
    always_online: true
  shortcuts:
    - name: Criar chamado
      type: message
      callback_id: transformar_em_chamado
      description: Cria um chamado com esta conversa
    - name: Criar chamado avançado
      type: message
      callback_id: criar_chamado_avancado
      description: Abre o formulário com esta conversa
  slash_commands:
    - command: /chamado
      url: https://pitzi-home-api.rodrigo-doratioto.workers.dev/api/slack/commands
      description: Abrir um chamado
      usage_hint: "[descreva o problema]"
      should_escape: false
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
      - im:write
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
| `commands` | `/chamado` e os atalhos de mensagem |
| `chat:write` | avisos e a resposta na thread |
| `chat:write.public` | responder na thread de canais **públicos** sem convite |
| `users:read`, `users:read.email` | reconhecer a pessoa pelo e-mail e mostrar os nomes na conversa |
| `channels:history`, `groups:history`, `im:history`, `mpim:history` | ler a conversa (thread) em canais públicos, privados, DMs e grupos de DM |
| `files:read` | baixar os anexos da conversa |
| `im:write` | mandar a confirmação por DM quando o app não está no canal |

## 2. Instalar e copiar as chaves (só na primeira vez)

1. No app, **Install App** → **Install to Workspace** → **Permitir**.
2. Copie o **Bot User OAuth Token** (começa com `xoxb-`), em *OAuth & Permissions*.
3. Copie o **Signing Secret**, em *Basic Information* → *App Credentials* → **Show**.

## 3. Cadastrar as chaves no Worker (só na primeira vez)

Na pasta `worker/` (o comando pede o valor; ele não aparece na tela):

```bash
set -a; . ~/.cloudflare-token; set +a
npx wrangler secret put SLACK_BOT_TOKEN        # cole o xoxb-...
npx wrangler secret put SLACK_SIGNING_SECRET   # cole o Signing Secret
```

## 4. Convidar o app nos canais

Para **ler a conversa** o app precisa estar no canal — inclusive nos **públicos** (o histórico
só é lido de canais em que o app está). Em cada canal onde for usar os atalhos:
`/invite @Chamados Pitzi`.

Sem o convite: o chamado é criado só com a mensagem clicada (quem clicou recebe um aviso
explicando), e a confirmação "chamado aberto" vai por DM para quem clicou.

## 5. Banco e configuração

Migrations `0035`–`0037` (campos Slack no chamado, índice único por workspace + canal +
mensagem e deduplicação das notas da sincronização). Nenhuma migration nova para a conversa
inteira.

Defina `SLACK_ALLOWED_TEAM_ID` com o ID real do workspace (ou `SLACK_ALLOWED_TEAM_IDS`
com IDs separados por vírgula). Sem essa configuração, o workspace é confirmado
pelo `auth.test` do token do bot instalado; falhas dessa confirmação são recusadas.

## 6. Sincronização opcional (thread ↔ chamado)

Por padrão fica desligada. Para ativar, defina `SLACK_THREAD_SYNC_ENABLED=true` e cadastre
Event Subscriptions no endpoint `/api/slack/events` do mesmo Worker, com os eventos
`message.channels` e, se necessário, `message.groups` (os escopos de histórico já estão no
manifesto acima) e reinstale o app. O bot precisa participar dos canais.
A verificação de URL exige assinatura; eventos exigem também workspace autorizado.

Respostas humanas **novas** na thread (depois de criado o chamado), de usuários com acesso ao
chamado, viram notas internas. A conversa que já existia entra na descrição na criação.
Mensagens originais, bots e subtipos de edição/exclusão são ignorados. Cada timestamp gera
no máximo uma nota por chamado, mesmo com retries da Event API.

Comentários públicos criados pela tela do sistema voltam à thread. Notas internas só voltam
se `SLACK_INTERNAL_NOTES_TO_THREAD_ENABLED=true`: ative apenas em canais cuja audiência
possa ler essas notas. A origem `slack` não é reenviada e mensagens do bot são ignoradas,
evitando loops. Falhas de envio são registradas; não há fila automática de reenvio.

## 7. Testar

1. Numa thread com respostas e um print, **Criar chamado** em qualquer mensagem: chamado com
   a conversa inteira, o solicitante é quem começou, o print anexado e confirmação na thread.
2. Clicar de novo em outra resposta da mesma thread: aviso do chamado existente, sem duplicar.
3. **Criar chamado avançado** numa resposta: a janela mostra quem é o solicitante; no envio, a
   conversa vai junto.
4. Canal privado sem o app: a confirmação chega por DM.
5. Técnico com acesso: assumir, colocar em atendimento e resolver pelos botões.
6. Com sync ativado: resposta humana nova vira nota interna uma vez; bots não criam notas.

Os testes usam Slack Web API simulada e `TEST_DATABASE_URL` apontando para um banco
**descartável** com schema e migrations aplicados.

Limites: até 200 mensagens por thread e nomes de até 40 pessoas; descrição cortada em ~30 mil
caracteres (com aviso e link). Imagens embutidas em blocos ricos que não são arquivos não vêm.
Grupos com campos personalizados obrigatórios podem recusar a criação rápida; o erro orienta
ao fluxo avançado/sistema. Express local continua retornando 501 para a integração.
