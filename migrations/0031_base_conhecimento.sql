-- Base de Conhecimento: artigos de consulta para todos os usuários, que podem nascer de um
-- chamado encerrado (source_ticket_id). Tabela nova; knowledge_documents (biblioteca legada)
-- não é alterada. Um chamado gera no máximo um artigo. Idempotente.

CREATE TABLE IF NOT EXISTS knowledge_articles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar,
  title text NOT NULL,
  content text NOT NULL,
  group_key text,
  status text NOT NULL DEFAULT 'publicado',
  source_ticket_id varchar,
  author_id varchar NOT NULL,
  updated_by varchar,
  views integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_articles_source_ticket_unique
  ON knowledge_articles (source_ticket_id) WHERE source_ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS knowledge_articles_status_idx ON knowledge_articles (status);
