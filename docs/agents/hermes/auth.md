# Auth — Service Account Hermes

## Endpoint

```
POST /api/admin/service-accounts/:id/generate-token
```

- **Auth**: requer sessão (Express) ou JWT (Worker) com `isAdmin = true` /
  `role = "admin"`.
- **Path param**: `:id` — UUID do usuário-service-account na tabela
  `users`. Apenas usuários com `auth_method = 'token'` podem gerar token
  por essa rota; tentar usar em um usuário humano comum retorna `400`.
- **Body**: vazio.
- **Resposta de sucesso (200)**:
  ```json
  {
    "userId": "uuid-do-hermes",
    "email": "hermes@renov.com",
    "token": "<plaintext-base64url-de-48-bytes>",
    "expiresAt": "2027-05-03T00:00:00.000Z"
  }
  ```
- **O campo `token` é retornado uma única vez**. Não fica armazenado em
  lugar algum no servidor — apenas o SHA-256 vai para
  `users.api_token_hash`.

## Comportamento

1. Carrega o usuário pelo `:id`.
2. Bloqueia se o usuário não existe (`404`) ou se não é service account
   (`auth_method !== 'token'` → `400`).
3. Gera token aleatório seguro (48 bytes via `crypto.getRandomValues` no
   Worker / `crypto.randomBytes` no Express), serializado em base64url.
4. Calcula `sha256(token)` em hex.
5. Atualiza `users.api_token_hash` e `users.api_token_expires_at` em uma
   única operação. Qualquer token anterior é silenciosamente revogado.
6. Retorna `{ userId, email, token, expiresAt }` ao admin.

## Uso pelo agente

```http
POST /api/tickets/abc-123/comments HTTP/1.1
Host: homeapi.renovsmart.com.br
Authorization: Bearer <plaintext-token>
Content-Type: application/json

{ "body": "Triagem automática: ..." }
```

> **Atenção**: o middleware que valida o header `Authorization: Bearer`
> e converte em sessão admin **não faz parte da Fase 1**. Esta fase
> entrega apenas a geração e o storage do hash. A validação será
> implementada quando o webhook outbound da Routine estiver pronto
> (Fase 2).

## Rotação

Para rotacionar:

1. Admin chama o endpoint novamente (mesmo `:id`).
2. Hash novo sobrescreve o antigo na mesma transação → token velho é
   imediatamente inválido.
3. Admin atualiza o secret na Routine da Anthropic com o token novo.

Não existe operação "listar tokens" porque só existe um por usuário.
Para revogar sem rotação, basta `UPDATE users SET api_token_hash = NULL,
api_token_expires_at = NULL WHERE id = '...'` no SQL Editor do Neon.

## Auditoria

Toda chamada de `generate-token` deve gerar uma linha em log estruturado
(`console.log` com `JSON.stringify`) no formato:

```json
{
  "event": "service_account_token_generated",
  "userId": "<id-hermes>",
  "actorId": "<id-do-admin>",
  "expiresAt": "..."
}
```

Como o Worker e o Express usam o mesmo formato, basta filtrar pelos logs
do Cloudflare ou da máquina dev para auditar.
