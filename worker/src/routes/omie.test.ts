import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const service = {
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
};

vi.mock("../services/omie.service", () => ({ getOmieService: () => service }));
vi.mock("../services/estoque-pos-cache", () => ({ getCachedPosEstoque: vi.fn() }));

const { omie } = await import("./omie");

function buildApp(role: string) {
  const app = new Hono<any>();
  app.use("*", async (c, next) => {
    c.set("user", { userId: "u1", role });
    c.set("db", {});
    await next();
  });
  app.route("/", omie);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  service.getConfig.mockResolvedValue({ app_key: "123", app_secret: "segredo-muito-longo-abcd", is_active: true });
  service.updateConfig.mockResolvedValue(undefined);
});

describe("Worker /api/omie/config", () => {
  it("GET nunca devolve o app_secret real", async () => {
    const res = await buildApp("admin").request("/api/omie/config");
    const body = (await res.json()) as any;
    expect(body.data.app_secret).not.toContain("segredo");
    expect(body.data.app_secret.endsWith("abcd")).toBe(true);
  });

  it("POST exige admin", async () => {
    const res = await buildApp("user").request("/api/omie/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ app_key: "k", app_secret: "s".repeat(32) }),
    });
    expect(res.status).toBe(403);
    expect(service.updateConfig).not.toHaveBeenCalled();
  });
});
