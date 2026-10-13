import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { securityHeadersMiddleware } from "./security-headers";

describe("cabeçalhos de segurança", () => {
  const app = new Hono();
  app.use("*", securityHeadersMiddleware);
  app.get("/json", (c) => c.json({ ok: true }));
  app.get("/powered", (c) => { c.header("X-Powered-By", "Express"); return c.text("x"); });
  app.get("/com-nosniff", (c) => { c.header("X-Content-Type-Options", "nosniff; custom"); return c.text("x"); });

  it("adiciona nosniff e remove X-Powered-By", async () => {
    const res = await app.request("/json");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const powered = await app.request("/powered");
    expect(powered.headers.get("X-Powered-By")).toBeNull();
  });

  it("não sobrescreve um X-Content-Type-Options já definido", async () => {
    const res = await app.request("/com-nosniff");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff; custom");
  });
});
