/**
 * report-claude-usage.ts
 *
 * Script local que cada desenvolvedor roda 1x ao dia para reportar
 * o consumo de tokens do Claude Code ao painel Git Analytics.
 *
 * Uso:
 *   npx tsx script/report-claude-usage.ts
 *
 * Configuração (variáveis de ambiente ou editar as constantes abaixo):
 *   CLAUDE_DEV_NAME     — nome do desenvolvedor (ex: "Matheus Mundstock")
 *   CLAUDE_USAGE_SECRET — secret compartilhado (ver .env do servidor)
 *   APP_URL             — URL do backend (ex: https://home.renovsmart.com.br)
 */

import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import http from "http";

// ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────
const DEVELOPER_NAME  = process.env.CLAUDE_DEV_NAME     || "Matheus Mundstock";
const USAGE_SECRET    = process.env.CLAUDE_USAGE_SECRET  || "495c9359ca573a28192f853ea343fb8d88aa5743424ca410b3b0c2122e5bae56";
const API_BASE        = process.env.APP_URL              || "https://home.renovsmart.com.br";
const SOURCE_MACHINE  = os.hostname();
// ─────────────────────────────────────────────────────────────────────────────

interface DayUsage {
  inputTokens:         number;
  outputTokens:        number;
  cacheCreationTokens: number;
  cacheReadTokens:     number;
  totalTokens:         number;
}

function parseClaudeDir(): Map<string, DayUsage> {
  const claudeDir = path.join(os.homedir(), ".claude", "projects");
  const byDay = new Map<string, DayUsage>();

  if (!fs.existsSync(claudeDir)) {
    console.warn(`Diretório não encontrado: ${claudeDir}`);
    return byDay;
  }

  const projectDirs = fs.readdirSync(claudeDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => path.join(claudeDir, d.name));

  let filesRead = 0;
  let messagesProcessed = 0;

  for (const projectDir of projectDirs) {
    const jsonlFiles = fs.readdirSync(projectDir)
      .filter(f => f.endsWith(".jsonl"))
      .map(f => path.join(projectDir, f));

    for (const filePath of jsonlFiles) {
      filesRead++;
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

          const day = timestamp.substring(0, 10); // "YYYY-MM-DD"

          const existing = byDay.get(day) || {
            inputTokens: 0, outputTokens: 0,
            cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 0,
          };

          existing.inputTokens          += usage.input_tokens                    || 0;
          existing.outputTokens         += usage.output_tokens                   || 0;
          existing.cacheCreationTokens  += usage.cache_creation_input_tokens     || 0;
          existing.cacheReadTokens      += usage.cache_read_input_tokens         || 0;
          existing.totalTokens = existing.inputTokens + existing.outputTokens
                               + existing.cacheCreationTokens + existing.cacheReadTokens;

          byDay.set(day, existing);
          messagesProcessed++;
        } catch {
          // linha inválida — ignorar
        }
      }
    }
  }

  console.log(`Lidos: ${filesRead} arquivos, ${messagesProcessed} mensagens processadas`);
  return byDay;
}

function postJSON(url: string, body: object, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === "https:";
    const lib = isHttps ? https : http;

    const req = lib.request({
      hostname: parsedUrl.hostname,
      port:     parsedUrl.port || (isHttps ? 443 : 80),
      path:     parsedUrl.pathname + parsedUrl.search,
      method:   "POST",
      headers:  {
        "Content-Type":          "application/json",
        "Content-Length":        Buffer.byteLength(payload),
        ...headers,
      },
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve({ status: res.statusCode || 0, body: data }));
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log(`\n=== Claude Code Usage Reporter ===`);
  console.log(`Dev:     ${DEVELOPER_NAME}`);
  console.log(`Machine: ${SOURCE_MACHINE}`);
  console.log(`API:     ${API_BASE}\n`);

  const byDay = parseClaudeDir();

  if (byDay.size === 0) {
    console.log("Nenhum dado de uso encontrado. Encerrando.");
    return;
  }

  // Ordenar dias e mostrar resumo
  const sortedDays = [...byDay.keys()].sort();
  console.log(`Dias com dados: ${sortedDays.length}`);
  console.log("Últimos 7 dias:");
  for (const day of sortedDays.slice(-7)) {
    const u = byDay.get(day)!;
    console.log(`  ${day}: ${u.totalTokens.toLocaleString()} tokens (in:${u.inputTokens.toLocaleString()} out:${u.outputTokens.toLocaleString()} cache_create:${u.cacheCreationTokens.toLocaleString()} cache_read:${u.cacheReadTokens.toLocaleString()})`);
  }

  console.log("\nEnviando para o servidor...");
  let success = 0;
  let errors  = 0;

  for (const [day, usage] of byDay) {
    try {
      const result = await postJSON(
        `${API_BASE}/api/git-analytics/claude-code-usage`,
        {
          developerName:        DEVELOPER_NAME,
          reportDate:           day,
          inputTokens:          usage.inputTokens,
          outputTokens:         usage.outputTokens,
          cacheCreationTokens:  usage.cacheCreationTokens,
          cacheReadTokens:      usage.cacheReadTokens,
          totalTokens:          usage.totalTokens,
          sourceMachine:        SOURCE_MACHINE,
        },
        { "x-claude-usage-secret": USAGE_SECRET }
      );

      if (result.status === 200) {
        success++;
      } else {
        errors++;
        console.error(`  ✗ ${day}: HTTP ${result.status} — ${result.body}`);
      }
    } catch (err: any) {
      errors++;
      console.error(`  ✗ ${day}: ${err.message}`);
    }
  }

  console.log(`\nConcluído: ${success} dias enviados com sucesso, ${errors} erros.`);

  if (errors === 0) {
    // Resumo do dia de hoje
    const today = new Date().toISOString().substring(0, 10);
    const todayUsage = byDay.get(today);
    if (todayUsage) {
      console.log(`\nHoje (${today}): ${todayUsage.totalTokens.toLocaleString()} tokens`);
    }
  }
}

main().catch(err => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
