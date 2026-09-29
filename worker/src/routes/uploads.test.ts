import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

const settings: Record<string, string> = {};
vi.mock("../lib/storage", () => ({
  getStorage: () => ({ getSetting: async (key: string) => (settings[key] ? { key, value: settings[key] } : undefined) }),
}));
const { uploads } = await import("./uploads");

const objects = new Map<string, { body: string; contentType: string }>();
const bucket = {
  put: vi.fn(async (key: string, body: ArrayBuffer, opts: any) => {
    objects.set(key, { body: new TextDecoder().decode(body), contentType: opts.httpMetadata.contentType });
  }),
  get: vi.fn(async (key: string) => {
    const o = objects.get(key);
    return o ? { body: o.body, httpMetadata: { contentType: o.contentType }, httpEtag: '"e"' } : null;
  }),
  delete: vi.fn(async (key: string) => objects.delete(key)),
};
const env = { JWT_SECRET: "test-secret", API_URL: "https://api.test", ATTACHMENTS: bucket };

function buildApp(tenantId = "tenant-a") {
  const app = new Hono<any>();
  app.use("*", async (c, next) => {
    c.set("user", { userId: "u1", tenantId, role: "user" });
    c.set("db", {});
    await next();
  });
  app.route("/", uploads);
  return app;
}

async function requestUrl(name: string, contentType: string) {
  const res = await buildApp().request(
    "/api/uploads/request-url",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, contentType }) },
    env,
  );
  return (await res.json()) as { uploadURL: string; objectPath: string };
}

const put = (uploadURL: string, contentType: string, body = "conteudo") =>
  buildApp().request(uploadURL.replace("https://api.test", ""), { method: "PUT", headers: { "content-type": contentType }, body }, env);

// Lê um objeto como o frontend faz: pede a URL assinada e depois abre a URL.
async function signedGet(key: string, tenantId = "tenant-a") {
  const res = await buildApp(tenantId).request(`/api/uploads/signed-url?path=/objects/${key}`, {}, env);
  if (res.status !== 200) return res;
  const { url } = (await res.json()) as { url: string };
  return buildApp(tenantId).request(url.replace("https://api.test", ""), {}, env);
}

beforeEach(() => {
  for (const k of Object.keys(settings)) delete settings[k];
  objects.clear();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe("uploads", () => {
  it("upload válido grava o arquivo", async () => {
    const { uploadURL, objectPath } = await requestUrl("foto.png", "image/png");
    const res = await put(uploadURL, "image/png");
    expect(res.status).toBe(200);
    expect(objects.has(objectPath.replace("/objects/", ""))).toBe(true);
  });

  it("recusa upload com Content-Type diferente do assinado", async () => {
    const { uploadURL } = await requestUrl("foto.png", "image/png");
    const res = await put(uploadURL, "text/html");
    expect(res.status).toBe(403);
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it("recusa URL de upload expirada", async () => {
    const { uploadURL } = await requestUrl("foto.png", "image/png");
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    const res = await put(uploadURL, "image/png");
    expect(res.status).toBe(403);
  });

  it("remove separadores de caminho do nome do arquivo", async () => {
    const { objectPath } = await requestUrl("../../outro-tenant/x.png", "image/png");
    expect(objectPath).toMatch(/^\/objects\/tenant-a\/uploads\/[0-9a-f-]+-x\.png$/);
  });

  it("HTML é servido como download, isolado e sem sniffing", async () => {
    objects.set("tenant-a/uploads/p.html", { body: "<script>1</script>", contentType: "text/html" });
    const res = await signedGet("tenant-a/uploads/p.html");
    expect(res.headers.get("Content-Disposition")).toBe("attachment");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Security-Policy")).toContain("sandbox");
  });

  it("imagem e PDF continuam inline", async () => {
    objects.set("tenant-a/uploads/a.png", { body: "x", contentType: "image/png" });
    objects.set("tenant-a/uploads/a.pdf", { body: "x", contentType: "application/pdf" });
    const png = await signedGet("tenant-a/uploads/a.png");
    const pdf = await signedGet("tenant-a/uploads/a.pdf");
    expect(png.headers.get("Content-Disposition")).toBeNull();
    expect(pdf.headers.get("Content-Disposition")).toBeNull();
    expect(pdf.headers.get("Content-Security-Policy")).toBeNull();
  });

  it("não exclui arquivo de outro tenant", async () => {
    objects.set("tenant-b/uploads/x.png", { body: "x", contentType: "image/png" });
    const res = await buildApp("tenant-a").request("/api/uploads/tenant-b/uploads/x.png", { method: "DELETE" }, env);
    expect(res.status).toBe(403);
    expect(bucket.delete).not.toHaveBeenCalled();
  });

  it("exclui arquivo do próprio tenant", async () => {
    objects.set("tenant-a/uploads/x.png", { body: "x", contentType: "image/png" });
    const res = await buildApp("tenant-a").request("/api/uploads/tenant-a/uploads/x.png", { method: "DELETE" }, env);
    expect(res.status).toBe(200);
    expect(objects.has("tenant-a/uploads/x.png")).toBe(false);
  });

  it("leitura anônima sem assinatura responde 404", async () => {
    objects.set("tenant-a/uploads/x.png", { body: "x", contentType: "image/png" });
    const res = await buildApp().request("/objects/tenant-a/uploads/x.png", {}, env);
    expect(res.status).toBe(404);
  });

  it("URL assinada funciona e expira", async () => {
    objects.set("tenant-a/uploads/x.png", { body: "x", contentType: "image/png" });
    const res = await buildApp().request("/api/uploads/signed-url?path=/objects/tenant-a/uploads/x.png", {}, env);
    const { url } = (await res.json()) as { url: string };
    const path = url.replace("https://api.test", "");
    expect((await buildApp().request(path, {}, env)).status).toBe(200);
    expect((await buildApp().request(path.replace(/sig=[^&]+/, "sig=forjada"), {}, env)).status).toBe(404);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    expect((await buildApp().request(path, {}, env)).status).toBe(404);
  });

  it("não assina arquivo de outro tenant", async () => {
    const res = await buildApp("tenant-a").request("/api/uploads/signed-url?path=/objects/tenant-b/uploads/x.png", {}, env);
    expect(res.status).toBe(403);
  });

  it("logo configurado nas configurações continua público", async () => {
    objects.set("tenant-a/uploads/logo.png", { body: "x", contentType: "image/png" });
    settings.logo_url_light = "/objects/tenant-a/uploads/logo.png";
    const res = await buildApp().request("/objects/tenant-a/uploads/logo.png", {}, env);
    expect(res.status).toBe(200);
  });
});
