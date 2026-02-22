-- Adicionar colunas às tags para suportar tag padrão e reordenação
-- Migration: 0004_add_tag_features.sql

-- Adicionar coluna is_default para marcar tag padrão
ALTER TABLE task_tags ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Adicionar coluna display_order para ordenação personalizada
ALTER TABLE task_tags ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_task_tags_is_default ON task_tags(is_default);
CREATE INDEX IF NOT EXISTS idx_task_tags_display_order ON task_tags(display_order);

-- Criar índice composto para queries comuns
CREATE INDEX IF NOT EXISTS idx_task_tags_owner_default ON task_tags(owner_id, is_default);
