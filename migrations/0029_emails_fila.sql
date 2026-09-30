-- Fila de e-mails (outbox): cada e-mail automático vira uma linha aqui antes de ser enviado.
--
-- O Worker grava a linha, tenta enviar logo em seguida (waitUntil) e o cron de 5 em 5 minutos
-- repete as que falharam, com espera crescente (máximo 5 tentativas). status:
-- pending → sending → sent | failed; skipped = não enviado de propósito (destinatário sem
-- e-mail ou inativo). message_id_header guarda o Message-ID enviado (thread do chamado).
-- Idempotente.

CREATE TABLE IF NOT EXISTS email_outbox (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar,
  event text NOT NULL,
  ticket_id varchar,
  to_email text NOT NULL DEFAULT '',
  to_user_id varchar,
  subject text NOT NULL,
  html text NOT NULL,
  text text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamp NOT NULL DEFAULT now(),
  last_error text,
  provider text,
  provider_message_id text,
  message_id_header text,
  thread_root_id text,
  created_at timestamp NOT NULL DEFAULT now(),
  sent_at timestamp
);

CREATE INDEX IF NOT EXISTS email_outbox_pending_idx ON email_outbox (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS email_outbox_created_idx ON email_outbox (created_at DESC);
CREATE INDEX IF NOT EXISTS email_outbox_ticket_idx ON email_outbox (ticket_id);
