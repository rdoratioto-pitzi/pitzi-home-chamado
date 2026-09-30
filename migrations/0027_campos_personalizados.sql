-- Campos personalizados por grupo de atendimento (Configurações → Campos do chamado).
--
-- ticket_custom_fields: definição dos campos de cada grupo (group_key = support_groups.key,
-- que é o valor de tickets.category). tickets.custom_fields guarda os valores, indexados
-- pelo id do campo. Idempotente.

CREATE TABLE IF NOT EXISTS ticket_custom_fields (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar,
  group_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_custom_fields_group_idx ON ticket_custom_fields (group_key);

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS custom_fields jsonb;
