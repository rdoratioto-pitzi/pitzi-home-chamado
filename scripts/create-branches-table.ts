import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function createBranchesTable() {
  if (!db) {
    console.error("❌ Database não conectado");
    process.exit(1);
  }
  
  console.log("Criando tabela git_branches...");
  
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS git_branches (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR,
        repository_id VARCHAR NOT NULL,
        name TEXT NOT NULL,
        sha TEXT NOT NULL,
        is_default BOOLEAN DEFAULT false,
        is_protected BOOLEAN DEFAULT false,
        ahead_by INTEGER DEFAULT 0,
        behind_by INTEGER DEFAULT 0,
        has_open_pr BOOLEAN DEFAULT false,
        last_commit_at TIMESTAMP,
        last_commit_author TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ git_branches criada");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

createBranchesTable();
