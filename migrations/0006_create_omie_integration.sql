-- Migration: 0006_create_omie_integration.sql
-- Criação das tabelas para integração com API Omie (ERP)

-- Tabela de configuração
CREATE TABLE IF NOT EXISTS omie_config (
  id SERIAL PRIMARY KEY,
  app_key VARCHAR(255) NOT NULL,
  app_secret VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Inserir credenciais padrão (serão substituídas pelas reais)
INSERT INTO omie_config (app_key, app_secret, is_active) 
VALUES ('3512564154099', 'e7036f3b188d5b658319e2f97a62fcca', true)
ON CONFLICT DO NOTHING;

-- Tabela de logs de sincronização
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

-- Índices para otimização de consultas
CREATE INDEX IF NOT EXISTS idx_omie_sync_category ON omie_sync_log(category);
CREATE INDEX IF NOT EXISTS idx_omie_sync_status ON omie_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_omie_sync_synced_at ON omie_sync_log(synced_at DESC);
