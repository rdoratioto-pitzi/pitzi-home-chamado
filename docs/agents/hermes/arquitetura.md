# Arquitetura — Hermes

## Componentes

```
┌──────────────┐    ticket.created     ┌──────────────────┐
│  Renov.Home  │ ────────────────────▶ │ Anthropic Routine│
│   (Worker)   │      webhook out      │  (triage v4)     │
└──────┬───────┘                       └────────┬─────────┘
       │                                        │
       │   POST /api/tickets/:id/comments        ▼
       │   Authorization: Bearer <hermes>  ┌──────────────┐
       │ ◀──────────────────────────────── │  Slack App   │
       │                                    │   (Renov)    │
       │                                    └──────────────┘
       ▼
┌──────────────┐
│ Neon Postgres│  ← tabela users tem registro hermes@renov.com
└──────────────┘
```

## Atores

### Renov.Home (Worker Hono em produção, Express em dev)

- Em algum ponto futuro emite webhook outbound em `ticket.created` /
  `ticket.updated` para a URL pública da Routine.
- Recebe chamadas autenticadas por Bearer token nas mesmas rotas REST já
  existentes (`/api/tickets/...`, `/api/comments/...`). Hermes age como
  qualquer usuário admin do sistema, mas com identidade própria.

### Routine de triagem

- Hospedada na infraestrutura da Anthropic (Routines / Managed Agents).
- Recebe o JSON do ticket, classifica em uma das categorias do prompt
  `triage-v4` e decide:
  - **info**: posta resumo + sugestão como comentário interno
  - **action**: passa para o prompt `executor-v1`, que pode chamar a API
    do Home para alterar status, atribuir responsável, comentar, etc.

### Slack App

- Já existe na Renov para notificações gerais.
- Hermes empresta esse canal para entregar o output de triagem ao
  responsável e — em ações sensíveis — pedir aprovação humana antes do
  `executor-v1` acionar a API.

### Service account `hermes@renov.com`

- Linha na tabela `users` do banco Home.
- Campos relevantes:
  - `email = hermes@renov.com`
  - `name = Hermes (Agente)`
  - `is_admin = true` — necessário para postar comentários em qualquer
    chamado e para ler todos os tickets do tenant
  - `perfil_acesso = 'agente'` — marcador semântico (não tem regra de
    negócio associada ainda, mas torna fácil filtrar agentes nas queries
    e relatórios)
  - `auth_method = 'token'` — sinaliza que esse usuário não loga via
    e-mail/senha; só age via Bearer token
  - `password = NULL` — bloqueia login interativo
  - `api_token_hash` — coluna nova adicionada nesta fase, guarda o SHA-256
    do token Bearer ativo

## Fluxo de autenticação

1. Admin chama `POST /api/admin/service-accounts/:id/generate-token`.
2. Endpoint gera um token aleatório de 48 bytes em base64url e calcula
   `sha256(token)`.
3. Hash é gravado em `users.api_token_hash` (substitui qualquer hash
   anterior, efetivamente revogando o token antigo).
4. Token plaintext é retornado **uma única vez** na resposta. Não é
   armazenado em lugar nenhum no servidor.
5. A Routine recebe o token via configuração da Anthropic (Routine
   secrets) e o envia em `Authorization: Bearer <token>` em todas as
   chamadas para `https://homeapi.renovsmart.com.br/...`.
6. Em cada request, o middleware de auth aceita Bearer tokens, faz lookup
   pelo hash, carrega o usuário e injeta o contexto como se fosse uma
   sessão admin comum.

> O middleware de Bearer token **não é entregue na Fase 1**. Esta fase
> apenas cria o slot. A leitura/validação do header `Authorization` será
> implementada quando o webhook outbound estiver pronto (Fase 2).

## Decisões de design

### Por que service account em vez de API key dedicada?

Já existe a `VENUS_API_KEY` para o produto Venus, mas ela é uma chave
única sem identidade. Hermes precisa de:

- Audit trail por usuário (quem comentou neste ticket?)
- Possibilidade de revogar sem afetar outros integradores
- Aderência ao mesmo modelo de permissão (`isAdmin`, `modulePermissions`)
  já usado pelos demais usuários

Service account em `users` resolve os três pontos com zero código novo
no modelo de permissões.

### Por que armazenar apenas o hash?

Permite revogar o token sem ter que invalidar uma sessão JWT
distribuída. E garante que um vazamento da tabela `users` não exponha
credenciais utilizáveis — só hashes, que são inúteis sem o input.

### Por que expiração de 1 ano?

Token de service account é equivalente a uma chave de longa duração. A
rotação é manual, registrada em calendário operacional. Expiração curta
geraria fricção sem ganho de segurança real (já que o admin precisa
gerar e plugar na Routine manualmente — não há refresh automático).
