/**
 * Script de seed direto no banco — apenas para carga inicial.
 * Após reiniciar o servidor, usar script/report-claude-usage.ts normalmente.
 */
import fs from "fs";
import path from "path";
import os from "os";
import { db } from "../server/db";
import { claudeCodeUsageReports } from "@shared/schema";
import { sql } from "drizzle-orm";

const DEVELOPER_NAME = process.env.CLAUDE_DEV_NAME || "Matheus Mundstock";
const SOURCE_MACHINE = os.hostname();

function parseClaudeDir() {
  const claudeDir = path.join(os.homedir(), ".claude", "projects");
  const byDay = new Map<string, { inputTokens: number; outputTokens: number; cacheCreationTokens: number; cacheReadTokens: number; totalTokens: number }>();

  if (!fs.existsSync(claudeDir)) return byDay;

  const projectDirs = fs.readdirSync(claudeDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => path.join(claudeDir, d.name));

  let messages = 0;
  for (const projectDir of projectDirs) {
    const jsonlFiles = fs.readdirSync(projectDir)
      .filter(f => f.endsWith(".jsonl"))
      .map(f => path.join(projectDir, f));

    for (const filePath of jsonlFiles) {
      const lines = fs.readFileSync(filePath, "utf-8").split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.type !== "assistant") continue;
          const usage = obj.message?.usage;
          if (!usage) continue;
          const timestamp: string = obj.timestamp || obj.message?.timestamp;
          if (!timestamp) continue;
          const day = timestamp.substring(0, 10);
          const e = byDay.get(day) || { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 0 };
          e.inputTokens         += usage.input_tokens                 || 0;
          e.outputTokens        += usage.output_tokens                || 0;
          e.cacheCreationTokens += usage.cache_creation_input_tokens  || 0;
          e.cacheReadTokens     += usage.cache_read_input_tokens      || 0;
          e.totalTokens = e.inputTokens + e.outputTokens + e.cacheCreationTokens + e.cacheReadTokens;
          byDay.set(day, e);
          messages++;
        } catch {}
      }
    }
  }
  console.log(`${messages} mensagens processadas, ${byDay.size} dias`);
  return byDay;
}

async function main() {
  const byDay = parseClaudeDir();
  if (byDay.size === 0) { console.log("Sem dados."); process.exit(0); }

  console.log(`\nInserindo ${byDay.size} dias para "${DEVELOPER_NAME}"...`);
  let ok = 0;
  for (const [day, u] of byDay) {
    await db.insert(claudeCodeUsageReports).values({
      developerName:       DEVELOPER_NAME,
      reportDate:          day,
      inputTokens:         u.inputTokens,
      outputTokens:        u.outputTokens,
      cacheCreationTokens: u.cacheCreationTokens,
      cacheReadTokens:     u.cacheReadTokens,
      totalTokens:         u.totalTokens,
      sourceMachine:       SOURCE_MACHINE,
    }).onConflictDoUpdate({
      target: [claudeCodeUsageReports.developerName, claudeCodeUsageReports.reportDate],
      set: {
        inputTokens:         u.inputTokens,
        outputTokens:        u.outputTokens,
        cacheCreationTokens: u.cacheCreationTokens,
        cacheReadTokens:     u.cacheReadTokens,
        totalTokens:         u.totalTokens,
        sourceMachine:       SOURCE_MACHINE,
        reportedAt:          sql`NOW()`,
      },
    });
    console.log(`  ✓ ${day}: ${u.totalTokens.toLocaleString()} tokens`);
    ok++;
  }
  console.log(`\n✅ ${ok} dias inseridos com sucesso.`);
  process.exit(0);
}

main().catch(err => { console.error("❌", err); process.exit(1); });
