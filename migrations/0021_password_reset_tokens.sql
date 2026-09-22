-- Fase 0 ITSM — redefinição de senha por link de uso único
--
-- O pedido público de "esqueci a senha" não altera mais a senha: gera um token
-- (guardado só como hash) com prazo de 30 minutos. A senha muda quando o usuário
-- abre o link e escolhe uma nova. Idempotente.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens (user_id, created_at);
