-- Respostas prontas e automações de chamados (Configurações → Campos do chamado).
--
-- canned_responses: textos salvos que o atendente insere no comentário; group_key NULL vale
-- para todos os grupos. automation_rules: regras "quando/se/faça" (shared/automations.ts);
-- timeout_days só vale para o gatilho waiting_requester_timeout (dias corridos desde a entrada
-- em "Aguardando solicitante", conferido pelo cron do Worker). Idempotente.

CREATE TABLE IF NOT EXISTS canned_responses (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar,
  title text NOT NULL,
  body text NOT NULL,
  group_key text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_rules (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  trigger text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  timeout_days integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_by varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_rules_trigger_idx ON automation_rules (trigger) WHERE active;
