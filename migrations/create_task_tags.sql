-- Criar tabela task_tags se não existir
CREATE TABLE IF NOT EXISTS task_tags (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenantId VARCHAR,
  name TEXT NOT NULL,
  description TEXT,
  ownerId VARCHAR NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  scope TEXT NOT NULL DEFAULT 'tasks',
  color TEXT DEFAULT '#00A137',
  icon TEXT DEFAULT 'folder',
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Criar tabela task_tag_members se não existir
CREATE TABLE IF NOT EXISTS task_tag_members (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenantId VARCHAR,
  tagId VARCHAR NOT NULL,
  userId VARCHAR NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  createdAt TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (tagId) REFERENCES taskTags(id) ON DELETE CASCADE
);

-- Verificar tabelas criadas
SELECT 'task_tags' as table_name, COUNT(*) as row_count FROM task_tags
UNION ALL
SELECT 'task_tag_members', COUNT(*) FROM task_tag_members;
