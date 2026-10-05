-- Respostas por e-mail viram comentários do chamado (worker/src/lib/inbound-email.ts).
--
-- ticket_comments.source: 'app' (tela) ou 'email' (resposta recebida pelo Gmail).
-- ticket_comments.inbound_email_id: id da mensagem no Gmail; único, garante que a mesma
--   resposta nunca vire dois comentários, mesmo se a marcação no Gmail falhar.
-- inbound_email_log: uma linha por mensagem lida da caixa (processada, ignorada ou com erro),
--   para o painel de Configurações → E-mail e para não reprocessar.
-- Idempotente.

ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app';
ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS inbound_email_id text;
CREATE UNIQUE INDEX IF NOT EXISTS ticket_comments_inbound_email_id_unique
  ON ticket_comments (inbound_email_id) WHERE inbound_email_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS inbound_email_log (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id text NOT NULL,
  ticket_id varchar,
  comment_id varchar,
  from_email text,
  subject text,
  status text NOT NULL,
  reason text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS inbound_email_log_gmail_message_id_unique
  ON inbound_email_log (gmail_message_id);
CREATE INDEX IF NOT EXISTS inbound_email_log_created_at_idx ON inbound_email_log (created_at);
