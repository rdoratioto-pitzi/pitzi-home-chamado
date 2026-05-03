-- Fase 1 Hermes — service account + storage do hash do Bearer token
--
-- Este script é IDEMPOTENTE e deve ser aplicado manualmente no Neon
-- SQL Editor (dev e prod). Não rodar via `npm run db:push`.
--
-- O que faz:
--   1. Adiciona colunas `api_token_hash` e `api_token_expires_at` em users
--   2. Insere o usuário hermes@renov.com como service account
--   3. Marca o usuário como admin para que possa comentar em tickets

-- 1) Colunas para Bearer token de service account ---------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS api_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS api_token_expires_at TIMESTAMP;

-- 2) Service account Hermes -------------------------------------------------
-- Insere apenas se ainda não existir; permite reaplicar a migration sem
-- duplicar nem sobrescrever dados.
INSERT INTO users (
  id,
  tenant_id,
  name,
  email,
  password,
  status,
  auth_method,
  is_admin,
  area_negocio,
  perfil_acesso,
  module_permissions
)
SELECT
  gen_random_uuid(),
  NULL,
  'Hermes (Agente)',
  'hermes@renov.com',
  NULL,
  'active',
  'token',
  true,
  'TI',
  'agente',
  '{"chamados":true,"projetos":true,"tarefas":true,"okrs":true,"metas":true,"fluxogramas":true,"diagramas":true,"logistica":true,"triagem":true,"pricing":true,"conhecimento":true,"apis":true,"configuracoes":false,"updates":true,"estoques":true,"avaliacoes":true,"comercial":true,"apoio_vendas":true}'
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'hermes@renov.com'
);
