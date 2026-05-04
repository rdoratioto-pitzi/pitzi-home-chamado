-- Fase 4 Hermes — campos de execução pós-aprovação em hermes_slack_threads
--
-- Este script é IDEMPOTENTE e deve ser aplicado manualmente no Neon SQL Editor
-- (dev e prod). NÃO rodar via `npm run db:push`.
--
-- O que faz:
--   Adiciona colunas para rastrear o ciclo de vida da Routine "Hermes Executor"
--   disparada quando a aprovação humana acontece na thread Slack:
--     - execution_status        ('pending' | 'running' | 'success' | 'failed')
--     - execution_started_at    timestamp do disparo
--     - execution_completed_at  timestamp da conclusão (success ou failed)
--     - execution_pr_url        URL do PR aberto pela Routine
--     - execution_pr_number     número do PR aberto
--     - execution_error         mensagem de erro (apenas quando failed)
--     - execution_plan          snapshot do /prompt-renov gerado pela Triagem

ALTER TABLE hermes_slack_threads
  ADD COLUMN IF NOT EXISTS execution_status       TEXT,
  ADD COLUMN IF NOT EXISTS execution_started_at   TIMESTAMP,
  ADD COLUMN IF NOT EXISTS execution_completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS execution_pr_url       TEXT,
  ADD COLUMN IF NOT EXISTS execution_pr_number    INTEGER,
  ADD COLUMN IF NOT EXISTS execution_error        TEXT,
  ADD COLUMN IF NOT EXISTS execution_plan         TEXT;
