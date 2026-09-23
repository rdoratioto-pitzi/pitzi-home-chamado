-- Fase 1 ITSM — grupos de atendimento
--
-- O chamado passa a ser direcionado a um grupo (Suporte TI, SAP, Dados, Dev) em vez de
-- uma categoria livre. A chave do grupo fica em tickets.category, e as regras de
-- ticket_responsaveis usam a mesma chave em "categoria". Membros definem a fila de cada
-- grupo. Idempotente.

CREATE TABLE IF NOT EXISTS support_groups (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_group_members (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id varchar NOT NULL REFERENCES support_groups(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id varchar,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS support_group_members_user_idx ON support_group_members (user_id);

INSERT INTO support_groups (key, name, description, sort_order) VALUES
  ('suporte-ti', 'Suporte TI', 'Computadores, acessos, rede e sistemas internos', 1),
  ('sap', 'SAP', 'Processos e acessos no SAP', 2),
  ('dados', 'Dados', 'Relatórios, dashboards e bases de dados', 3),
  ('dev', 'Dev', 'Erros e melhorias nos sistemas desenvolvidos pela Pitzi', 4)
ON CONFLICT (key) DO NOTHING;
