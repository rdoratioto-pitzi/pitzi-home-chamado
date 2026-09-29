// Teste de integração do runner de migrations. Só roda com TEST_DATABASE_URL (banco DESCARTÁVEL);
// cria e apaga as tabelas schema_migrations e mig_test_*.
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import pg from "pg";
import { runMigrations, splitStatements } from "./migrate";

const url = process.env.TEST_DATABASE_URL;

describe("splitStatements", () => {
  it("ignora comentários (inclusive com ;) e separa comandos", () => {
    const sql = "-- passo 1;\nSELECT 1;\n-- SELECT x;\nCREATE INDEX a\n  ON t (c);\n";
    expect(splitStatements(sql)).toEqual(["SELECT 1", "CREATE INDEX a\n  ON t (c)"]);
  });
});

describe.skipIf(!url)("runMigrations", () => {
  const client = new pg.Client({ connectionString: url });
  let dir: string;
  const write = (name: string, sql: string) => fs.writeFileSync(path.join(dir, name), sql);
  const silent = { log: () => {} };

  beforeEach(async () => {
    if (!(client as any)._connected) {
      await client.connect();
      (client as any)._connected = true;
    }
    await client.query("DROP TABLE IF EXISTS schema_migrations, mig_test_a, mig_test_b, mig_test_c");
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "migrations-"));
  });
  afterAll(async () => {
    await client.query("DROP TABLE IF EXISTS schema_migrations, mig_test_a, mig_test_b, mig_test_c");
    await client.end();
  });

  it("registra a linha de base sem executar e aplica só as posteriores", async () => {
    write("0001_legacy.sql", "THIS IS NOT SQL;");
    write("0016_legacy.sql", "THIS IS NOT SQL EITHER;");
    write("0019_create_a.sql", "CREATE TABLE mig_test_a (id int);");
    write("notes.sql", "THIS IS IGNORED;");

    const first = await runMigrations(client, dir, silent);
    expect(first.baselined).toEqual(["0001_legacy.sql", "0016_legacy.sql"]);
    expect(first.applied).toEqual(["0019_create_a.sql"]);

    const second = await runMigrations(client, dir, silent);
    expect(second.applied).toEqual([]);
  });

  it("falha desfaz o arquivo inteiro e não o registra", async () => {
    write("0019_bad.sql", "CREATE TABLE mig_test_b (id int);\nSELECT * FROM tabela_inexistente;");
    await expect(runMigrations(client, dir, silent)).rejects.toThrow(/0019_bad\.sql/);
    const { rows } = await client.query("SELECT to_regclass('mig_test_b') AS t");
    expect(rows[0].t).toBeNull();
    const registered = await client.query("SELECT 1 FROM schema_migrations WHERE name = '0019_bad.sql'");
    expect(registered.rowCount).toBe(0);
  });

  it("executa arquivos no-transaction comando a comando (CREATE INDEX CONCURRENTLY)", async () => {
    write(
      "0019_concurrent.sql",
      "-- migrate:no-transaction\nCREATE TABLE mig_test_c (id int);\n-- comentário;\nCREATE INDEX CONCURRENTLY mig_test_c_idx ON mig_test_c (id);\n",
    );
    const result = await runMigrations(client, dir, silent);
    expect(result.applied).toEqual(["0019_concurrent.sql"]);
    const { rows } = await client.query("SELECT to_regclass('mig_test_c_idx') AS i");
    expect(rows[0].i).not.toBeNull();
  });

  it("dry-run não altera nada", async () => {
    write("0019_create_a.sql", "CREATE TABLE mig_test_a (id int);");
    const result = await runMigrations(client, dir, { ...silent, dryRun: true });
    expect(result.pending).toEqual(["0019_create_a.sql"]);
    const { rows } = await client.query("SELECT to_regclass('mig_test_a') AS t");
    expect(rows[0].t).toBeNull();
  });
});
