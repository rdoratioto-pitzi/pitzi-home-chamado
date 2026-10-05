# Slack → chamado: configuração

Duas formas de abrir chamado pelo Slack:

- **`/chamado [texto]`** em qualquer canal ou DM: abre uma janela com Título, Descrição,
  Grupo e Tipo (técnicos e admins também escolhem a Gravidade). O solicitante é quem digitou.
- **Criar chamado** (menu ⋯ da mensagem → *Mais ações*): cria imediatamente com texto,
  autor, título automático e grupo padrão. Não abre formulário. Mantém o callback
  `transformar_em_chamado` para compatibilidade.
- **Criar chamado avançado**: abre o formulário existente com o texto preenchido,
  callback `criar_chamado_avancado`. O solicitante é o autor; só técnicos/admins
  podem criar a partir de mensagens de outra pessoa do mesmo tenant.

A confirmação e os botões Assumir, Em atendimento, Resolver e Ver chamado ficam na thread.
As ações validam conta ativa, módulo chamados, workspace, tenant e acesso ao chamado.
Sem e-mail no Slack, é necessário um vínculo prévio por `users.slack_user_id`; um autor
sem vínculo e sem e-mail é recusado, sem inventar uma identidade.

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
    - name: Criar chamado
      type: message
      callback_id: transformar_em_chamado
      description: Cria um chamado automaticamente a partir desta mensagem
    - name: Criar chamado avançado
      type: message
      callback_id: criar_chamado_avancado
      description: Abre o formulário com o texto desta mensagem
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

## 5. Banco e configuração obrigatória

Aplique as migrations `0036_chamados_slack_message_link.sql` e `0037_slack_thread_notes.sql`
pelo runner existente, antes de publicar o Worker. A primeira guarda workspace, autor e
permalink e cria índice único por workspace + canal + timestamp. A segunda deduplica notas.

Defina `SLACK_ALLOWED_TEAM_ID` com o ID real do workspace (ou `SLACK_ALLOWED_TEAM_IDS`
com IDs separados por vírgula). Sem essa configuração, o workspace é confirmado
pelo `auth.test` do token do bot instalado; falhas dessa confirmação são recusadas.
Renomeie o atalho existente para **Criar chamado**, conservando o callback, e adicione o
atalho avançado do manifesto. `/chamado` continua abrindo o formulário existente.

## 6. Sincronização opcional

Por padrão fica desligada. Para ativar, defina `SLACK_THREAD_SYNC_ENABLED=true` e cadastre
Event Subscriptions no endpoint `/api/slack/events` do mesmo Worker, com os eventos
`message.channels` e, se necessário, `message.groups`; adicione os escopos correspondentes
`channels:history` / `groups:history` e reinstale o app. O bot precisa participar dos canais.
A verificação de URL exige assinatura; eventos exigem também workspace autorizado.

Respostas humanas de usuários com acesso ao ticket são registradas como notas internas.
Mensagens originais, bots e subtipos de edição/exclusão são ignorados. Cada timestamp gera
no máximo uma nota por ticket, mesmo com retries da Event API.

Comentários públicos criados pela tela do sistema voltam à thread. Notas internas só voltam
se `SLACK_INTERNAL_NOTES_TO_THREAD_ENABLED=true`: ative apenas em canais cuja audiência
possa ler essas notas. A origem `slack` não é reenviada e mensagens do bot são ignoradas,
evitando loops. Falhas de envio são registradas; não há fila automática de reenvio.

## 7. Testar

1. Mensagem "Não consigo conectar na VPN" → **Criar chamado**: nenhum modal;
   ticket criado e confirmação na thread com botões.
2. Repetir o clique: aviso do chamado existente, sem duplicação.
3. **Criar chamado avançado** e `/chamado`: formulário preservado.
4. Técnico com acesso: assumir, colocar em atendimento e resolver.
5. Com sync ativado: resposta humana vira nota interna uma vez; bots não criam notas.

Os testes usam Slack Web API simulada e `TEST_DATABASE_URL` apontando para um banco
**descartável** com schema e migrations aplicados.

Limites: anexos não são copiados. Grupos com campos personalizados obrigatórios podem
recusar a criação rápida; o erro orienta o usuário ao fluxo avançado/sistema. Express local
continua retornando 501 para a integração. O deploy, as migrations em produção e a alteração
do manifesto são etapas separadas dos testes locais.
