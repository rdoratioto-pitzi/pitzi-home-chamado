-- Tipo de usuário: Técnico (atende chamados) ou Usuário (só abre e acompanha os seus).
-- Admin conta sempre como técnico (shared/user-type.ts). Novos cadastros nascem Usuário.
-- Todos os usuários ativos na data desta migration passam a ser técnicos. Idempotente:
-- a marcação inicial só roda quando a coluna é criada.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_technician'
  ) THEN
    ALTER TABLE users ADD COLUMN is_technician boolean NOT NULL DEFAULT false;
    UPDATE users SET is_technician = true WHERE status = 'active';
  END IF;
END $$;
