# Integração Slack — Renov Home

> Status: **Fase 1 (de 4)** — fundação outbound. Mensagens são enviadas do
> Renov Home para o Slack quando eventos acontecem nos módulos Workspace
> (Chamados + Projetos + Atividades). Eventos inbound (slash commands,
> botões interativos) virão na Fase 2.

## 1. Visão geral

Quando essa integração está ativa, o canal `#devs-renov` (workspace Pitzi)
recebe automaticamente:

| Evento | Tipo de mensagem |
|---|---|
| Novo chamado criado (`CHA-XXXX`) | Mensagem-mãe no canal |
| Chamado atribuído | Reply na thread + reação 🙋 + DM ao responsável |
| Chamado fechado | Reply na thread + reação ✅ |
| Novo projeto criado (`PRO-XXXX`) | Mensagem-mãe (somente se `visibility ≠ private`) |
| Nova atividade criada (`PRO-XXXX·TN`) | Reply na thread do projeto pai |
| Atividade movida no kanban | Reply na thread do projeto pai |
| Atividade concluída | Reply na thread do projeto pai |
| Chamado/atividade prioridade crítica/urgente | Mensagem extra com `<!here>` ou DM |

### Hierarquia de mensagens (decisão arquitetural)

- Cada **chamado (`CHA-XXXX`)** → mensagem-mãe própria.
- Cada **projeto (`PRO-XXXX`)** → mensagem-mãe própria.
- Cada **atividade (`PRO-XXXX·TN`)** → **sempre** reply na thread do projeto pai.
  Atividades NUNCA criam mensagem-mãe própria.
- Atualizações (atribuição, status, fechamento) → sempre reply na thread da
  mensagem-mãe.

A tabela `slack_thread_mapping` garante a idempotência (1 entidade = 1 thread).

### Política de visibilidade

Projetos com `visibility = 'private'` **NÃO** geram mensagem no canal público
`#devs-renov`. Atividades em projetos privados também não vazam (caem no
silêncio porque o projeto pai não tem mapping).

### Mapeamento de usuários

Como todas as contas do Slack são corporativas Pitzi (`@pitzi.com.br`) e os
usuários do Renov Home têm o mesmo email, o match é automático via
`users.lookupByEmail`. O Slack User ID é cacheado em `users.slack_user_id`
após a primeira resolução para evitar lookups repetidos.

## 2. Criar a Slack App

1. Vá para [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**.
2. Nome sugerido: `Renov Home`. Workspace: **Pitzi**.

### 2.1 Bot Token Scopes

Em **OAuth & Permissions** → **Scopes** → **Bot Token Scopes**, adicione:

| Scope | Por que precisa |
|---|---|
| `chat:write` | Postar mensagens em canais e threads |
| `chat:write.public` | Postar em canais públicos sem precisar adicionar o bot |
| `reactions:write` | Adicionar reações 🙋 ✅ |
| `users:read` | Listar usuários (helper para Fase 2) |
| `users:read.email` | Resolver Slack User ID a partir do email Pitzi |
| `im:write` | Enviar DMs aos responsáveis |

> Eventos e Slash Commands ficam para a Fase 2.

### 2.2 Instalar o app no workspace

**OAuth & Permissions** → **Install to Pitzi** → autorize.

Após instalar, o **Bot User OAuth Token** aparece (começa com `xoxb-…`).
Copie e salve — esse é o `SLACK_BOT_TOKEN`.

### 2.3 Adicionar o bot ao canal

No Slack:

```
/invite @Renov Home
```

executado dentro de `#devs-renov`. Sem isso, o bot pode postar mas não
consegue ler histórico (não importa para Fase 1 — só importa em Fase 2).

### 2.4 Pegar o Channel ID

No Slack desktop, clique no nome `#devs-renov` no topo do canal → ver
detalhes → role até o final → **Channel ID** (começa com `C…`). Esse é o
`SLACK_CHANNEL_DEVS`.

### 2.5 Signing Secret (opcional na Fase 1)

**Basic Information** → **App Credentials** → **Signing Secret**. Salve em
`SLACK_SIGNING_SECRET`. Será usado na Fase 2 para validar assinaturas de
eventos inbound.

## 3. Configurar variáveis de ambiente

### Desenvolvimento local (`.env`)

```bash
SLACK_BOT_TOKEN=xoxb-…
SLACK_SIGNING_SECRET=…
SLACK_CHANNEL_DEVS=C0XXXXXXX
SLACK_INTEGRATION_ENABLED=true
```

> O arquivo `.env` está no `.gitignore` — nunca commite credenciais reais.
> Use `.env.example` como referência (já contém placeholders).

### Produção / staging (Cloudflare Worker)

Os secrets do Worker são definidos via `wrangler`:

```bash
cd worker
wrangler secret put SLACK_BOT_TOKEN
wrangler secret put SLACK_SIGNING_SECRET
wrangler secret put SLACK_CHANNEL_DEVS
wrangler secret put SLACK_INTEGRATION_ENABLED
```

Para o ambiente `dev`:

```bash
wrangler secret put SLACK_BOT_TOKEN --env dev
# … repetir para os demais
```

Cada comando pede o valor via prompt (não fica no histórico).

## 4. Feature flag para rollback rápido

A variável `SLACK_INTEGRATION_ENABLED=false` desliga TODAS as notificações
Slack sem precisar mexer no token. Útil quando há um incidente ou ruído
excessivo no canal.

```bash
# Local
SLACK_INTEGRATION_ENABLED=false npm run dev

# Worker (produção)
wrangler secret put SLACK_INTEGRATION_ENABLED   # → false
```

Reverter: setar de volta para `true` ou remover a variável.

## 5. Testar localmente

Após preencher o `.env`:

```bash
npm run dev
```

1. Abrir [http://localhost:5050](http://localhost:5050)
2. Criar um chamado teste no módulo Workspace
3. Verificar mensagem em `#devs-renov` — deve mostrar `🎫 Novo chamado: CHA-XXXX`
4. Atribuir o chamado a um usuário Pitzi → reação 🙋 + reply na thread + DM
5. Mudar status para `resolved` → reação ✅ + reply na thread

**Logs:** todas as ações da integração saem com prefixo `[slack]` ou
`[slack-notifier]`. Filtre o stdout para diagnóstico.

## 6. Troubleshooting

| Sintoma | Causa provável | Como verificar |
|---|---|---|
| Nenhuma mensagem chega | `SLACK_INTEGRATION_ENABLED=false` ou token ausente | `grep "[slack]" logs` |
| `users_not_found` em DMs | Email do Renov ≠ email do Slack | Verificar `users.email` |
| `not_in_channel` | Bot não foi adicionado ao canal | Rodar `/invite @Renov Home` no canal |
| `channel_not_found` | `SLACK_CHANNEL_DEVS` errado | Pegar Channel ID novamente (passo 2.4) |
| Atividades não aparecem | Projeto pai não tem mapping (private ou pré-integração) | Esperado — política de visibilidade |
| Mensagem duplicada | Idempotência foi quebrada | Verificar `slack_thread_mapping` no DB |

## 7. Eventos cobertos por fase

### Fase 1 (atual)
- Outbound: criação/atribuição/fechamento de chamados, criação de projetos,
  criação/movimentação/conclusão de atividades.
- Idempotência via `slack_thread_mapping`.
- Política de visibilidade para projetos privados.

### Fase 2 (próxima)
- Inbound: slash commands (`/cha CHA-1234`, `/projeto PRO-005`).
- Botões interativos (atribuir, mudar status direto do Slack).
- Auto-detecção de códigos `CHA-XXXX` / `PRO-XXXX` em mensagens.

### Fase 3
- Cron jobs: resumo diário, alertas SLA, lembretes de stand-up.

### Fase 4
- Métricas de uso, refinamento, A/B testing de templates.

## 8. Referências

- [Slack Web API](https://api.slack.com/web)
- [Block Kit Builder](https://app.slack.com/block-kit-builder)
- Schema: `shared/schema.ts` → `slackThreadMapping`, `users.slackUserId`
- Services: `server/services/slack.service.ts`,
  `server/services/slack-templates.service.ts`,
  `server/services/slack-notifier.service.ts`
