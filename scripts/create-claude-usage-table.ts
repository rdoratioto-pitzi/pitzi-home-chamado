import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function createTable() {
  if (!db) {
    console.error("❌ Database não conectado. Verifique DATABASE_URL no .env");
    process.exit(1);
  }

  console.log("Criando tabela claude_code_usage_reports...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS claude_code_usage_reports (
      id                     VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      developer_name         TEXT    NOT NULL,
      report_date            DATE    NOT NULL,
      input_tokens           BIGINT  NOT NULL DEFAULT 0,
      output_tokens          BIGINT  NOT NULL DEFAULT 0,
      cache_creation_tokens  BIGINT  NOT NULL DEFAULT 0,
      cache_read_tokens      BIGINT  NOT NULL DEFAULT 0,
      total_tokens           BIGINT  NOT NULL DEFAULT 0,
      source_machine         TEXT,
      reported_at            TIMESTAMP DEFAULT NOW(),
      UNIQUE (developer_name, report_date)
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_claude_usage_developer ON claude_code_usage_reports (developer_name)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_claude_usage_date      ON claude_code_usage_reports (report_date)`);

  console.log("✅ claude_code_usage_reports criada");
  process.exit(0);
}

createTable().catch(err => { console.error("❌", err); process.exit(1); });
