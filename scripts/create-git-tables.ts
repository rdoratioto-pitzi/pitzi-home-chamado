import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function createTables() {
  if (!db) {
    console.error("❌ Database não conectado. Verifique DATABASE_URL no .env");
    process.exit(1);
  }
  
  console.log("Criando tabelas do Git Analytics...");
  
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS git_repositories (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR,
        github_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        full_name TEXT NOT NULL,
        owner TEXT NOT NULL,
        default_branch TEXT DEFAULT 'main',
        is_active BOOLEAN DEFAULT true,
        sync_enabled BOOLEAN DEFAULT true,
        last_sync_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ git_repositories criada");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS git_commits (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR,
        repository_id VARCHAR NOT NULL,
        sha TEXT NOT NULL UNIQUE,
        message TEXT NOT NULL,
        full_message TEXT,
        author_name TEXT NOT NULL,
        author_email TEXT,
        author_avatar_url TEXT,
        commit_type TEXT DEFAULT 'improvement',
        branch TEXT,
        pr_number INTEGER,
        files_changed INTEGER DEFAULT 0,
        additions INTEGER DEFAULT 0,
        deletions INTEGER DEFAULT 0,
        committed_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ git_commits criada");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS git_pull_requests (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR,
        repository_id VARCHAR NOT NULL,
        github_pr_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        author_name TEXT NOT NULL,
        author_avatar_url TEXT,
        status TEXT DEFAULT 'open',
        pr_type TEXT DEFAULT 'improvement',
        source_branch TEXT,
        target_branch TEXT,
        commits_count INTEGER DEFAULT 0,
        additions INTEGER DEFAULT 0,
        deletions INTEGER DEFAULT 0,
        reviewers TEXT,
        labels TEXT,
        created_at TIMESTAMP,
        merged_at TIMESTAMP,
        closed_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ git_pull_requests criada");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS git_security_alerts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR,
        repository_id VARCHAR NOT NULL,
        github_alert_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        severity TEXT NOT NULL,
        package_name TEXT NOT NULL,
        package_ecosystem TEXT,
        vulnerable_version TEXT,
        patched_version TEXT,
        status TEXT DEFAULT 'open',
        is_direct_dependency BOOLEAN DEFAULT false,
        cve_id TEXT,
        ghsa_id TEXT,
        created_at TIMESTAMP,
        dismissed_at TIMESTAMP,
        fixed_at TIMESTAMP
      )
    `);
    console.log("✅ git_security_alerts criada");

    console.log("🎉 Todas as tabelas criadas com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao criar tabelas:", error);
    process.exit(1);
  }
}

createTables();