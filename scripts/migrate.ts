// Runner de migrations versionadas: aplica migrations/NNNN_*.sql ainda não registradas em
// schema_migrations, em ordem, e registra cada uma. Substitui o `drizzle-kit push --force`
// do deploy, que alterava o schema sem histórico nem revisão.
//
//   npm run db:migrate              aplica as pendentes (DATABASE_URL)
//   npm run db:migrate -- --dry-run lista as pendentes sem aplicar
//
// Regras:
// - Arquivos até BASELINE (inclusive) foram aplicados antes do runner existir: na primeira
//   execução são registrados como aplicados, sem rodar.
// - Cada arquivo roda numa transação junto com o seu registro. Arquivos com a linha
//   `-- migrate:no-transaction` (ex.: CREATE INDEX CONCURRENTLY) rodam comando a comando.
// - Um arquivo já aplicado não roda de novo, mesmo que seja editado (o runner avisa).
import fs from "fs";
import path from "path";
import crypto from "crypto";
import pg from "pg";

export const BASELINE = "0016";
const FILE_PATTERN = /^(\d{4})_.+\.sql$/;
const LOCK_KEY = 727_001; // pg_advisory_lock: impede duas execuções simultâneas

export interface MigrationResult {
  baselined: string[];
  applied: string[];
  pending: string[];
}

function checksum(sql: string): string {
  return crypto.createHash("sha256").update(sql).digest("hex");
}

/** Comandos de um arquivo, sem linhas de comentário. */
export function splitStatements(sql: string): string[] {
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return withoutComments
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function runMigrations(
  client: pg.ClientBase,
  dir: string,
  { dryRun = false, log = console.log }: { dryRun?: boolean; log?: (msg: string) => void } = {},
): Promise<MigrationResult> {
  const files = fs.readdirSync(dir).filter((f) => FILE_PATTERN.test(f)).sort();
  const result: MigrationResult = { baselined: [], applied: [], pending: [] };

  await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL,
        baseline boolean NOT NULL DEFAULT false,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);

    const { rows } = await client.query<{ name: string; checksum: string }>(
      "SELECT name, checksum FROM schema_migrations",
    );
    const applied = new Map(rows.map((r) => [r.name, r.checksum]));

    if (applied.size === 0) {
      for (const file of files.filter((f) => f.slice(0, 4) <= BASELINE)) {
        const sql = fs.readFileSync(path.join(dir, file), "utf8");
        if (!dryRun) {
          await client.query(
            "INSERT INTO schema_migrations (name, checksum, baseline) VALUES ($1, $2, true)",
            [file, checksum(sql)],
          );
        }
        applied.set(file, checksum(sql));
        result.baselined.push(file);
      }
      if (result.baselined.length) log(`[migrate] linha de base: ${result.baselined.length} arquivos até ${BASELINE}`);
    }

    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      const known = applied.get(file);
      if (known !== undefined) {
        if (known !== checksum(sql)) log(`[migrate] aviso: ${file} mudou depois de aplicado (não será reaplicado)`);
        continue;
      }
      result.pending.push(file);
      if (dryRun) continue;

      log(`[migrate] aplicando ${file}`);
      if (/^--\s*migrate:no-transaction\s*$/m.test(sql)) {
        for (const statement of splitStatements(sql)) await client.query(statement);
        await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [file, checksum(sql)]);
      } else {
        await client.query("BEGIN");
        try {
          await client.query(sql);
          await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [file, checksum(sql)]);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw new Error(`[migrate] falha em ${file}: ${(error as Error).message}`);
        }
      }
      result.applied.push(file);
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
  }
  return result;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definido");
  const dryRun = process.argv.includes("--dry-run");
  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const result = await runMigrations(client, path.resolve(import.meta.dirname, "../migrations"), { dryRun });
    if (dryRun) console.log(`[migrate] pendentes: ${result.pending.join(", ") || "nenhuma"}`);
    else console.log(`[migrate] aplicadas: ${result.applied.length}`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename ?? "")) {
  main().catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  });
}
