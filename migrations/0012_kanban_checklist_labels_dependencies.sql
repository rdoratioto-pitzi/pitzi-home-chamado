-- Migration: Kanban Labels, Checklist, Card Dependencies e Subtarefas em Tasks

-- 1. Adicionar campos checklist e labelIds nos kanban_cards
ALTER TABLE kanban_cards
  ADD COLUMN IF NOT EXISTS checklist text,
  ADD COLUMN IF NOT EXISTS label_ids text;

-- 2. Criar tabela de labels por projeto
CREATE TABLE IF NOT EXISTS kanban_labels (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar,
  project_id varchar NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamp DEFAULT now()
);

-- 3. Criar tabela de dependências entre cards
CREATE TABLE IF NOT EXISTS kanban_card_dependencies (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar,
  project_id varchar NOT NULL,
  blocking_card_id varchar NOT NULL,
  blocked_card_id varchar NOT NULL,
  created_at timestamp DEFAULT now(),
  UNIQUE(blocking_card_id, blocked_card_id)
);

-- 4. Adicionar campos de subtarefa e estimativa nas tasks
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS sub_task_parent_id varchar,
  ADD COLUMN IF NOT EXISTS estimation_hours integer,
  ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0;
