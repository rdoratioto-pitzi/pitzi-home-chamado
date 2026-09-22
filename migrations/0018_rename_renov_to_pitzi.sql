-- Renomeação Renov → Pitzi nos dados gravados
--
-- Este script é IDEMPOTENTE e deve ser aplicado manualmente (dev e depois prod),
-- NO MESMO DEPLOY do código que troca as chaves em shared/applications.ts:
--   npm run db:apply:dev -- -f migrations/0018_rename_renov_to_pitzi.sql
--
-- O que faz:
--   1. Chaves de aplicação renov-* → pitzi-* em tickets, projects e kanban_cards.
--      Sem isso, chamados/projetos antigos ficam com uma aplicação desconhecida.
--   2. E-mail da service account do Hermes (autentica por token; o e-mail é só
--      identificação). Mantém a migration 0014 idempotente após a troca do texto.

BEGIN;

UPDATE tickets      SET application_key = 'pitzi-' || substring(application_key from 7) WHERE application_key LIKE 'renov-%';
UPDATE projects     SET application_key = 'pitzi-' || substring(application_key from 7) WHERE application_key LIKE 'renov-%';
UPDATE kanban_cards SET application_key = 'pitzi-' || substring(application_key from 7) WHERE application_key LIKE 'renov-%';

UPDATE users SET email = 'hermes@pitzi.com.br'
WHERE email = 'hermes@renov.com'
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'hermes@pitzi.com.br');

COMMIT;

-- OPCIONAL — contas criadas pelo seed antigo. Trocar o e-mail muda o login de quem
-- usa essas contas; avalie antes. Se elas ainda tiverem a senha padrão, prefira
-- desativá-las (UPDATE users SET status = 'inactive' WHERE email IN (...)).
--
--   UPDATE users SET email = 'admin@pitzi.com.br' WHERE email = 'admin@renov.com.br';
