-- Equipamentos vindos do OCS Inventory e o equipamento de cada chamado.
CREATE TABLE IF NOT EXISTS assets (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar,
  source text NOT NULL DEFAULT 'ocs',
  external_id text NOT NULL,
  name text NOT NULL,
  serial text,
  user_label text,
  os_name text,
  cpu text,
  memory_mb integer,
  ip_address text,
  manufacturer text,
  model text,
  details jsonb,
  last_inventory_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS assets_source_external_unique
  ON assets (coalesce(tenant_id, ''), source, external_id);
CREATE INDEX IF NOT EXISTS assets_name_idx ON assets (name);

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS asset_id varchar;
CREATE INDEX IF NOT EXISTS tickets_asset_id_idx ON tickets (asset_id);
