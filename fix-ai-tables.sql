DROP TABLE IF EXISTS ai_prompt_executions CASCADE;
DROP TABLE IF EXISTS ai_plans CASCADE;
DROP TABLE IF EXISTS ai_models CASCADE;

CREATE TABLE ai_models (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  custo_input_por_mm DECIMAL(10,4),
  custo_output_por_mm DECIMAL(10,4),
  config JSONB DEFAULT '{}',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ai_plans (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  requisito TEXT NOT NULL,
  arquivo_origem TEXT NOT NULL,
  prompts JSONB NOT NULL DEFAULT '[]',
  modelo_id VARCHAR REFERENCES ai_models(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  arquivos_modificados TEXT[] DEFAULT '{}',
  custo_total DECIMAL(10,4) DEFAULT 0,
  tempo_total_segundos INTEGER DEFAULT 0,
  erros_encontrados JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE ai_prompt_executions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plan_id VARCHAR REFERENCES ai_plans(id) ON DELETE CASCADE NOT NULL,
  ordem INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tentativas INTEGER DEFAULT 0,
  codigo_gerado TEXT,
  arquivos_criados TEXT[] DEFAULT '{}',
  erros_encontrados JSONB DEFAULT '[]',
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  custo DECIMAL(10,4) DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

INSERT INTO ai_models (nome, provider, model_id, custo_input_por_mm, custo_output_por_mm, config) VALUES
  ('Minimax M2.5', 'openrouter', 'minimax/minimax-01', 0.50, 0.50, '{"temperature": 0, "max_tokens": 8192}'),
  ('DeepSeek R1', 'openrouter', 'deepseek/deepseek-r1', 0.55, 0.55, '{"temperature": 0, "max_tokens": 8192}'),
  ('Claude Sonnet 4', 'anthropic', 'claude-sonnet-4-20250514', 3.00, 15.00, '{"temperature": 0, "max_tokens": 8192}'),
  ('Gemini Flash 2', 'openrouter', 'google/gemini-flash-2.0', 0.075, 0.30, '{"temperature": 0, "max_tokens": 8192}');
