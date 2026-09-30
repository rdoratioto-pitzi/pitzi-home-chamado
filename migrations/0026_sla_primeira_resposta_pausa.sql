-- SLA de primeira resposta e pausa do relógio em "Aguardando solicitante".
--
-- sla_rules.primeira_resposta_horas: prazo em horas úteis para a primeira resposta ao
-- solicitante (NULL = sem meta). Valores do Freshdesk, só onde ainda não houver valor.
-- tickets.sla_pausado_em: início da pausa atual (status waiting_requester), NULL fora dela.
-- tickets.sla_pausa_minutos: minutos úteis já pausados, somados ao prazo de resolução.
-- Idempotente.

ALTER TABLE sla_rules ADD COLUMN IF NOT EXISTS primeira_resposta_horas numeric;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_pausado_em timestamp;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_pausa_minutos integer NOT NULL DEFAULT 0;

UPDATE sla_rules r
SET primeira_resposta_horas = v.horas
FROM (VALUES
  ('bug', 'critical', 0.5),
  ('bug', 'high', 2),
  ('bug', 'medium', 2),
  ('bug', 'low', 2),
  ('requisicao', 'critical', 2),
  ('requisicao', 'high', 2),
  ('requisicao', 'medium', 2),
  ('requisicao', 'low', 2),
  ('duvida', 'critical', 2),
  ('duvida', 'high', 2),
  ('duvida', 'medium', 2),
  ('duvida', 'low', 2),
  ('melhoria', 'critical', 36),
  ('melhoria', 'high', 36),
  ('melhoria', 'medium', 36),
  ('melhoria', 'low', 36)
) AS v(tipo, prioridade, horas)
WHERE r.tipo = v.tipo AND r.prioridade = v.prioridade AND r.tenant_id IS NULL
  AND r.primeira_resposta_horas IS NULL;

-- Chamados que já estão aguardando o solicitante começam a pausa agora.
UPDATE tickets SET sla_pausado_em = now()
WHERE status = 'waiting_requester' AND sla_pausado_em IS NULL;
