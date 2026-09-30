-- A gaveta do workspace passa a usar os comentários do chamado (ticket_comments).
-- Os comentários que foram escritos na gaveta (workspace_comentarios) entram no histórico
-- do chamado como NOTA INTERNA: não tinham controle de visibilidade e não viram e-mail.
-- A tabela antiga fica como está (tarefas ainda a usam). Idempotente: não duplica.

INSERT INTO ticket_comments (tenant_id, ticket_id, user_id, content, is_internal, created_at)
SELECT t.tenant_id, w.chamado_id, w.autor_id, w.texto, true, w.criado_em
FROM workspace_comentarios w
JOIN tickets t ON t.id = w.chamado_id
WHERE NOT EXISTS (
  SELECT 1 FROM ticket_comments tc
  WHERE tc.ticket_id = w.chamado_id
    AND tc.user_id = w.autor_id
    AND tc.content = w.texto
    AND tc.created_at IS NOT DISTINCT FROM w.criado_em
);
