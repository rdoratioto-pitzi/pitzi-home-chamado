-- Migration: Add CSAT (Satisfaction Rating) fields to tickets
-- Created: 2026-02-28

-- Add satisfaction rating fields to tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS satisfaction_rating INTEGER;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS satisfaction_comment TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS satisfaction_created_at TIMESTAMP;

-- Add comment to explain the fields
COMMENT ON COLUMN tickets.satisfaction_rating IS 'Rating de 1 a 5 estrelas para avaliação de satisfação';
COMMENT ON COLUMN tickets.satisfaction_comment IS 'Comentário opcional do solicitante sobre a avaliação';
COMMENT ON COLUMN tickets.satisfaction_created_at IS 'Data/hora em que a avaliação foi submetida';