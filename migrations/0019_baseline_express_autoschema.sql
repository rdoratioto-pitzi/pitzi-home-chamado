-- Baseline das alterações que o Express aplicava ao iniciar (autoMigrateSchema em server/index.ts).
-- Todas idempotentes. Aplicadas pelo runner de migrations (scripts/migrate.ts); o Express não altera
-- mais o schema na inicialização.

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS satisfaction_rating integer;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS satisfaction_comment text;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS satisfaction_date timestamp;

ALTER TABLE prompts_library ADD COLUMN IF NOT EXISTS translated_content text;

ALTER TABLE prompts_library ADD COLUMN IF NOT EXISTS translated_at timestamp;

ALTER TABLE prompts_library ADD COLUMN IF NOT EXISTS is_translated boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS omie_config (
  id SERIAL PRIMARY KEY,
  app_key VARCHAR(255) NOT NULL,
  app_secret VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS omie_sync_log (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  status VARCHAR(50) NOT NULL,
  total_records INTEGER DEFAULT 0,
  request_params JSONB,
  response_data JSONB,
  error_message TEXT,
  synced_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_omie_sync_category ON omie_sync_log(category);

CREATE INDEX IF NOT EXISTS idx_omie_sync_status ON omie_sync_log(status);

CREATE INDEX IF NOT EXISTS idx_omie_sync_synced_at ON omie_sync_log(synced_at DESC);

ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS checklist text;

ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS label_ids text;

CREATE TABLE IF NOT EXISTS kanban_labels (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar,
  project_id varchar NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kanban_card_dependencies (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar,
  project_id varchar NOT NULL,
  blocking_card_id varchar NOT NULL,
  blocked_card_id varchar NOT NULL,
  created_at timestamp DEFAULT now()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sub_task_parent_id varchar;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimation_hours integer;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS flowcharts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar,
  title text NOT NULL,
  description text,
  owner_id varchar NOT NULL,
  visibility text NOT NULL DEFAULT 'private',
  nodes_data text,
  edges_data text,
  viewport text,
  permissions text,
  is_template boolean DEFAULT false,
  template_category text,
  thumbnail text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flowchart_versions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar,
  flowchart_id varchar NOT NULL,
  nodes_data text,
  edges_data text,
  viewport text,
  created_by varchar NOT NULL,
  version_label text,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flowchart_comments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar,
  flowchart_id varchar NOT NULL,
  author_id varchar NOT NULL,
  content text NOT NULL,
  parent_comment_id varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kanban_comments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar,
  card_id varchar NOT NULL,
  user_id varchar NOT NULL,
  content text NOT NULL,
  created_at timestamp DEFAULT now()
);

ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'todo';
