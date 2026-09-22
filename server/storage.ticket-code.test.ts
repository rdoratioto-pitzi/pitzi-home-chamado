// Teste de integração da numeração de chamados contra um Postgres real.
// Só roda com TEST_DATABASE_URL apontando para um banco DESCARTÁVEL com o schema aplicado:
//   docker run -d --name chamados-pg -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:16
//   DATABASE_URL=postgres://postgres:test@localhost:55432/postgres npx drizzle-kit push --force
//   TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/postgres npx vitest run server/storage.ticket-code.test.ts
// O teste apaga todos os registros da tabela tickets.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { DatabaseStorage } from "./storage";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("createTicket — numeração", () => {
  let pool: pg.Pool;
  let storage: DatabaseStorage;

  const newTicket = (title: string) => ({
    title,
    description: "teste",
    category: "geral",
    requesterId: "req-1",
  });

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: url, max: 20 });
    storage = new DatabaseStorage(drizzle(pool, { schema }));
  });
  beforeEach(async () => {
    await pool.query("DELETE FROM tickets");
    await pool.query("ALTER SEQUENCE ticket_code_seq RESTART WITH 1");
  });
  afterAll(async () => {
    await pool?.end();
  });

  it("não reutiliza o código do último chamado após exclusão", async () => {
    const a = await storage.createTicket(newTicket("a") as any);
    const b = await storage.createTicket(newTicket("b") as any);
    expect([a.code, b.code]).toEqual(["CHA-0001", "CHA-0002"]);

    await pool.query("DELETE FROM tickets WHERE id = $1", [b.id]);
    const c = await storage.createTicket(newTicket("c") as any);
    expect(c.code).toBe("CHA-0003");
  });

  it("passa de 9999 sem truncar", async () => {
    await pool.query("SELECT setval('ticket_code_seq', 9999)");
    const t = await storage.createTicket(newTicket("t") as any);
    expect(t.code).toBe("CHA-10000");
  });

  it("realinha a sequence quando ela está atrás dos códigos existentes", async () => {
    await pool.query(
      "INSERT INTO tickets (code, title, description, category, requester_id) VALUES ('CHA-0001', 'x', 'x', 'geral', 'r'), ('CHA-0007', 'x', 'x', 'geral', 'r'), ('CHM-500', 'x', 'x', 'geral', 'r')",
    );
    const t = await storage.createTicket(newTicket("t") as any);
    expect(t.code).toBe("CHA-0008");
  });

  it("criações simultâneas geram códigos distintos", async () => {
    const created = await Promise.all(
      Array.from({ length: 100 }, (_, i) => storage.createTicket(newTicket(`t${i}`) as any)),
    );
    const codes = created.map((t) => t.code);
    expect(new Set(codes).size).toBe(100);
  });
});
