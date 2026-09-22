// Teste de integração: senhas nunca são gravadas em texto puro.
// Mesmo preparo de server/storage.ticket-code.test.ts (banco DESCARTÁVEL com o schema aplicado).
// O teste apaga os usuários de e-mail @storage-test.local.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { DatabaseStorage } from "./storage";
import { verifyPassword } from "@shared/password";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("storage — senhas", () => {
  let pool: pg.Pool;
  let storage: DatabaseStorage;
  const storedPassword = async (id: string) =>
    (await pool.query("SELECT password FROM users WHERE id = $1", [id])).rows[0].password as string;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    storage = new DatabaseStorage(drizzle(pool, { schema }));
    await pool.query("DELETE FROM users WHERE email LIKE '%@storage-test.local'");
  });
  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email LIKE '%@storage-test.local'");
    await pool?.end();
  });

  it("createUser e updateUser gravam hash, não texto puro", async () => {
    const user = await storage.createUser({ name: "A", email: "a@storage-test.local", password: "primeira" } as any);
    const first = await storedPassword(user.id);
    expect(first.startsWith("pbkdf2:")).toBe(true);
    expect((await verifyPassword("primeira", first)).valid).toBe(true);

    await storage.updateUser(user.id, { password: "segunda" });
    const second = await storedPassword(user.id);
    expect(second.startsWith("pbkdf2:")).toBe(true);
    expect((await verifyPassword("segunda", second)).valid).toBe(true);
  });

  it("não aplica hash duas vezes e não mexe na senha quando ela não é enviada", async () => {
    const user = await storage.createUser({ name: "B", email: "b@storage-test.local", password: "x" } as any);
    const hash = await storedPassword(user.id);
    await storage.updateUser(user.id, { password: hash });
    expect(await storedPassword(user.id)).toBe(hash);
    await storage.updateUser(user.id, { name: "B2" });
    expect(await storedPassword(user.id)).toBe(hash);
  });
});
