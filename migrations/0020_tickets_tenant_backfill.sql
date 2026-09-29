-- Fase 0 ITSM — isolamento entre tenants nos chamados
--
-- As rotas passam a comparar o tenant do chamado com o de quem acessa (NULL casa com NULL).
-- Chamados antigos foram gravados com tenant_id NULL; aqui eles herdam o tenant do
-- solicitante, e os comentários herdam o do chamado. Numa instalação de um tenant só
-- (usuários com tenant_id NULL) nada muda. Idempotente: só preenche o que está NULL.

UPDATE tickets t
SET tenant_id = u.tenant_id
FROM users u
WHERE t.requester_id = u.id
  AND t.tenant_id IS NULL
  AND u.tenant_id IS NOT NULL;

UPDATE ticket_comments tc
SET tenant_id = t.tenant_id
FROM tickets t
WHERE tc.ticket_id = t.id
  AND tc.tenant_id IS NULL
  AND t.tenant_id IS NOT NULL;
