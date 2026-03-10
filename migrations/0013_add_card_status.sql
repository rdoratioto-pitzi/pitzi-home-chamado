-- Migration: Adiciona campo status nos kanban_cards
-- Status separado da coluna: 'todo' | 'doing' | 'done'
-- Cards existentes recebem 'todo' como padrão

ALTER TABLE kanban_cards
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'todo';
