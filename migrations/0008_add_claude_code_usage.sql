-- Tabela para armazenar uso diário do Claude Code por desenvolvedor
-- Alimentada via script local que cada dev roda 1x ao dia
CREATE TABLE IF NOT EXISTS claude_code_usage_reports (
  id                     VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  developer_name         TEXT    NOT NULL,
  report_date            DATE    NOT NULL,
  input_tokens           BIGINT  NOT NULL DEFAULT 0,
  output_tokens          BIGINT  NOT NULL DEFAULT 0,
  cache_creation_tokens  BIGINT  NOT NULL DEFAULT 0,
  cache_read_tokens      BIGINT  NOT NULL DEFAULT 0,
  total_tokens           BIGINT  NOT NULL DEFAULT 0,
  source_machine         TEXT,
  reported_at            TIMESTAMP DEFAULT NOW(),
  UNIQUE (developer_name, report_date)
);

CREATE INDEX IF NOT EXISTS idx_claude_usage_developer ON claude_code_usage_reports (developer_name);
CREATE INDEX IF NOT EXISTS idx_claude_usage_date      ON claude_code_usage_reports (report_date);
