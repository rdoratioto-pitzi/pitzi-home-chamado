-- Migration: Adicionar campos de tradução na tabela prompts_library
-- Data: 2026-02-21

ALTER TABLE prompts_library 
ADD COLUMN IF NOT EXISTS translated_content TEXT,
ADD COLUMN IF NOT EXISTS translated_at TIMESTAMP;

-- Comentário: translated_content armazena a versão traduzida para PT-BR
-- Comentário: translated_at registra quando a tradução foi feita
