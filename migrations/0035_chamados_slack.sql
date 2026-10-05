-- Chamados abertos pelo Slack (/chamado e atalho "Transformar em chamado").
-- Guarda o canal e a thread da mensagem de origem, para a fase 2 (sincronizar a conversa
-- do chamado com a thread). Colunas opcionais; chamados existentes ficam com NULL. Idempotente.

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS slack_channel_id text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS slack_thread_ts text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS slack_message_ts text;
