-- Fase 0 ITSM — numeração segura dos chamados (CHA-0001)
-- migrate:no-transaction
--
-- Este script é IDEMPOTENTE e é aplicado pelo runner (npm run db:migrate), que o
-- deploy executa ANTES de publicar o Worker. Sem transação por causa do CONCURRENTLY.
--
-- Contexto: createTicket gerava o código contando os registros + 1, o que repete
-- códigos após exclusões e em criações simultâneas. Agora o número vem da sequence
-- ticket_code_seq, e o índice único impede que um código repetido seja gravado.
--
-- PASSO 1 — sequence alinhada ao maior código CHA-NNNN existente.
-- Nunca volta a sequence para trás, então pode ser reexecutado.

CREATE SEQUENCE IF NOT EXISTS ticket_code_seq;

SELECT setval('ticket_code_seq', greatest(
  (SELECT last_value FROM ticket_code_seq),
  (SELECT coalesce(max(substring(code from '^CHA-([0-9]+)$')::bigint), 0) FROM tickets),
  1
));

-- PASSO 2 — verificar duplicados já existentes. Se retornar linhas, o índice do
-- passo 3 NÃO será criado: renumere os duplicados (mantendo o mais antigo com o
-- código original; os demais podem receber 'CHA-' || lpad(nextval('ticket_code_seq')::text, 4, '0'))
-- antes de continuar.
--
--   SELECT code, count(*), array_agg(id ORDER BY created_at) AS ids
--   FROM tickets GROUP BY code HAVING count(*) > 1;
--
-- PASSO 3 — criar o índice sem bloquear escritas. CONCURRENTLY não roda dentro
-- de transação: execute este comando isoladamente. Se ele falhar no meio, o
-- Postgres deixa um índice INVALID que o IF NOT EXISTS pularia; remova-o com
--   DROP INDEX CONCURRENTLY IF EXISTS tickets_code_unique;
-- e execute de novo.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS tickets_code_unique ON tickets (code);
