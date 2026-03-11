-- Migration: Create Estoques Tables
-- Date: 2026-03-06
-- Purpose: Criar tabelas do módulo Estoques

-- ============================================
-- Tabela: estoques_contagens
-- ============================================
CREATE TABLE IF NOT EXISTS estoques_contagens (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id),
    codigo TEXT NOT NULL UNIQUE,
    responsavel_id VARCHAR(255) NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'em_andamento',
    data_inicio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_fim TIMESTAMP WITH TIME ZONE,
    total_itens_contados INTEGER DEFAULT 0,
    total_itens_sistema INTEGER,
    divergencia INTEGER,
    acuracidade DECIMAL(5,2),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estoques_contagens_tenant_id ON estoques_contagens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_estoques_contagens_status ON estoques_contagens(status);
CREATE INDEX IF NOT EXISTS idx_estoques_contagens_codigo ON estoques_contagens(codigo);

-- ============================================
-- Tabela: estoques_contagem_itens
-- ============================================
CREATE TABLE IF NOT EXISTS estoques_contagem_itens (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    contagem_id VARCHAR(255) NOT NULL REFERENCES estoques_contagens(id) ON DELETE CASCADE,
    imei TEXT NOT NULL,
    codigo_erp TEXT,
    modelo TEXT,
    categoria TEXT,
    marca TEXT,
    metodo_leitura TEXT NOT NULL,
    contado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    contado_por VARCHAR(255) NOT NULL REFERENCES users(id),
    UNIQUE(contagem_id, imei)
);

CREATE INDEX IF NOT EXISTS idx_estoques_contagem_itens_contagem_id ON estoques_contagem_itens(contagem_id);
CREATE INDEX IF NOT EXISTS idx_estoques_contagem_itens_imei ON estoques_contagem_itens(imei);
CREATE INDEX IF NOT EXISTS idx_estoques_contagem_itens_codigo_erp ON estoques_contagem_itens(codigo_erp);

-- ============================================
-- Tabela: estoques_contagem_logs
-- ============================================
CREATE TABLE IF NOT EXISTS estoques_contagem_logs (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    contagem_id VARCHAR(255) NOT NULL REFERENCES estoques_contagens(id),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    acao TEXT NOT NULL,
    imei TEXT,
    detalhes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estoques_contagem_logs_contagem_id ON estoques_contagem_logs(contagem_id);
CREATE INDEX IF NOT EXISTS idx_estoques_contagem_logs_user_id ON estoques_contagem_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_estoques_contagem_logs_created_at ON estoques_contagem_logs(created_at);

-- ============================================
-- Tabela: estoques_contagem_divergencias
-- ============================================
CREATE TABLE IF NOT EXISTS estoques_contagem_divergencias (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    contagem_id VARCHAR(255) NOT NULL REFERENCES estoques_contagens(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    imei TEXT,
    codigo_erp TEXT,
    modelo TEXT,
    categoria TEXT,
    marca TEXT,
    ultima_movimentacao TIMESTAMP WITH TIME ZONE,
    possivel_causa TEXT,
    status_analise TEXT DEFAULT 'pendente',
    observacao_analise TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estoques_contagem_divergencias_contagem_id ON estoques_contagem_divergencias(contagem_id);
CREATE INDEX IF NOT EXISTS idx_estoques_contagem_divergencias_tipo ON estoques_contagem_divergencias(tipo);
CREATE INDEX IF NOT EXISTS idx_estoques_contagem_divergencias_status_analise ON estoques_contagem_divergencias(status_analise);

-- ============================================
-- Tabela: estoques_ajustes
-- ============================================
CREATE TABLE IF NOT EXISTS estoques_ajustes (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    contagem_id VARCHAR(255) NOT NULL REFERENCES estoques_contagens(id),
    divergencia_id VARCHAR(255) REFERENCES estoques_contagem_divergencias(id),
    tipo_ajuste TEXT NOT NULL,
    imei TEXT,
    codigo_erp TEXT,
    quantidade INTEGER,
    justificativa TEXT NOT NULL,
    aprovado_por VARCHAR(255) REFERENCES users(id),
    aprovado_em TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estoques_ajustes_contagem_id ON estoques_ajustes(contagem_id);
CREATE INDEX IF NOT EXISTS idx_estoques_ajustes_divergencia_id ON estoques_ajustes(divergencia_id);
CREATE INDEX IF NOT EXISTS idx_estoques_ajustes_tipo_ajuste ON estoques_ajustes(tipo_ajuste);

-- ============================================
-- Adicionar constraints de chave estrangeira para tenant_id (já existe)
-- ============================================