-- Fase 3 Hermes — mapping chamado <-> thread Slack <-> decisão humana
--
-- Este script é IDEMPOTENTE e deve ser aplicado manualmente no Neon
-- SQL Editor (dev e prod). Não rodar via `npm run db:push`.
--
-- O que faz:
--   1. Cria tabela hermes_slack_threads (1:1 com tickets)
--   2. Cria índice em chamado_id (UNIQUE garante 1 thread por chamado)

CREATE TABLE IF NOT EXISTS hermes_slack_threads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id          UUID NOT NULL UNIQUE
                      REFERENCES tickets(id) ON DELETE CASCADE,
  thread_ts           TEXT NOT NULL,
  channel_id          TEXT NOT NULL,
  decision            TEXT,
  decision_by_user_id TEXT,
  decision_at         TIMESTAMP,
  ajuste_feedback     TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hermes_slack_threads_chamado_idx
  ON hermes_slack_threads(chamado_id);
