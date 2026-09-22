import { describe, it, expect } from "vitest";
import { generateTemporaryPassword, hashPassword, isPasswordHash, verifyPassword, withoutPassword } from "./password";

describe("password", () => {
  it("hash verifica a senha correta e recusa a errada", async () => {
    const hash = await hashPassword("correta");
    expect(isPasswordHash(hash)).toBe(true);
    expect(hash).not.toContain("correta");
    expect(await verifyPassword("correta", hash)).toEqual({ valid: true, needsRehash: false });
    expect((await verifyPassword("errada", hash)).valid).toBe(false);
  });

  it("senha legada em texto puro é aceita uma vez e marcada para rehash", async () => {
    expect(await verifyPassword("antiga", "antiga")).toEqual({ valid: true, needsRehash: true });
  });

  it("senha temporária tem o tamanho pedido e varia", () => {
    const a = generateTemporaryPassword();
    expect(a).toHaveLength(12);
    expect(generateTemporaryPassword()).not.toBe(a);
  });

  it("withoutPassword remove o campo", () => {
    expect(withoutPassword({ id: "1", password: "x" })).toEqual({ id: "1" });
  });
});
