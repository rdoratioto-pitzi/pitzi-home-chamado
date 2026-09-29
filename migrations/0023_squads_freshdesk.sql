-- Grupos de atendimento seguem os Squads usados no Freshdesk.
--
-- SAP e Dados já existiam e passam a ser Squads. Suporte TI e Dev ficam desativados (não
-- somem: basta voltar active = true quando o sistema também atender TI interno).
-- Chamados antigos desses grupos continuam com a chave em tickets.category. Idempotente.

INSERT INTO support_groups (key, name, description, sort_order) VALUES
  ('consumidor', 'Consumidor', 'Atendimento a clientes finais: pedidos, sinistros e aparelhos', 1),
  ('financeiro', 'Financeiro', 'Cobranças, boletos, reembolsos e notas fiscais', 2),
  ('parceiros', 'Parceiros', 'Varejistas, operadoras e demais parceiros', 3),
  ('integracoes', 'Integrações', 'Integrações com parceiros e sistemas externos', 6),
  ('helpdesk', 'Helpdesk', 'Dúvidas e suporte geral', 7),
  ('backoffice', 'Backoffice', 'Operação interna e cadastros', 8)
ON CONFLICT (key) DO NOTHING;

UPDATE support_groups SET sort_order = 4, active = true WHERE key = 'sap';
UPDATE support_groups SET sort_order = 5, active = true WHERE key = 'dados';

UPDATE support_groups SET active = false, sort_order = 90 WHERE key = 'suporte-ti';
UPDATE support_groups SET active = false, sort_order = 91 WHERE key = 'dev';
