-- "Objeto da Requisição" do Freshdesk: objeto → ação → detalhe (shared/request-objects.ts).
-- Colunas opcionais; chamados existentes ficam com NULL. Idempotente.

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS request_object text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS request_action text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS request_detail text;
