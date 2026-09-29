-- SLA por tipo × gravidade com os prazos de resolução do Freshdesk (horas úteis, seg–sex 9h–18h).
--
-- Gravidade: low = Baixo, medium = Médio, high = Alto, critical = Crítico (campo impact do
-- chamado). Só insere as combinações que ainda não têm regra, para não sobrescrever o que
-- já tiver sido ajustado em Configurações. Idempotente.

INSERT INTO sla_rules (tipo, prioridade, sla_horas, ativo)
SELECT v.tipo, v.prioridade, v.sla_horas, true
FROM (VALUES
  ('bug', 'low', 64),
  ('bug', 'medium', 24),
  ('bug', 'high', 8),
  ('bug', 'critical', 2),
  ('requisicao', 'low', 64),
  ('requisicao', 'medium', 32),
  ('requisicao', 'high', 16),
  ('requisicao', 'critical', 8),
  ('duvida', 'low', 64),
  ('duvida', 'medium', 40),
  ('duvida', 'high', 24),
  ('duvida', 'critical', 16),
  ('melhoria', 'low', 180),
  ('melhoria', 'medium', 135),
  ('melhoria', 'high', 90),
  ('melhoria', 'critical', 54)
) AS v(tipo, prioridade, sla_horas)
WHERE NOT EXISTS (
  SELECT 1 FROM sla_rules r
  WHERE r.tipo = v.tipo AND r.prioridade = v.prioridade AND r.tenant_id IS NULL
);
