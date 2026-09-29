// worker/src/routes/uploads.ts
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { timingSafeEqualStr } from "../lib/crypto";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
const UPLOAD_URL_TTL_SECONDS = 15 * 60;

// Tipos exibidos inline; qualquer outro (HTML, SVG, scripts...) é servido como download.
const INLINE_CONTENT_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf",
]);

// A assinatura cobre chave, validade e Content-Type: a URL de upload expira e não aceita outro tipo.
async function signUploadToken(key: string, expires: number, contentType: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const payload = `${key}\n${expires}\n${contentType}`;
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function verifyUploadToken(
  key: string, expires: number, contentType: string, token: string, secret: string,
): Promise<boolean> {
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  const expected = await signUploadToken(key, expires, contentType, secret);
  return timingSafeEqualStr(token, expected);
}

/** Nome de arquivo sem separadores de caminho nem caracteres de controle. */
function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  return base.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200) || "arquivo";
}

const uploads = new Hono<AppEnv>();

// POST /api/uploads/request-url — Generate signed PUT URL for R2
uploads.post("/api/uploads/request-url", async (c) => {
  const user = c.get("user");
  const { name, size, contentType } = await c.req.json<{
    name: string;
    size?: number;
    contentType?: string;
  }>();

  if (!name) {
    return c.json({ error: "Missing required field: name" }, 400);
  }

  if (size && size > MAX_UPLOAD_SIZE) {
    return c.json({ error: `File too large. Max size: ${MAX_UPLOAD_SIZE / 1024 / 1024}MB` }, 400);
  }

  const key = `${user.tenantId}/uploads/${crypto.randomUUID()}-${safeFileName(name)}`;
  const expires = Math.floor(Date.now() / 1000) + UPLOAD_URL_TTL_SECONDS;
  const signedType = contentType || "application/octet-stream";
  const token = await signUploadToken(key, expires, signedType, c.env.JWT_SECRET);
  const uploadURL = `${c.env.API_URL}/api/uploads/put/${encodeURIComponent(key)}?expires=${expires}&token=${encodeURIComponent(token)}`;
  const objectPath = `/objects/${key}`;

  return c.json({
    uploadURL,
    objectPath,
    metadata: { name, size, contentType },
  });
});

// PUT /api/uploads/put/* — Receive file and store in R2 (HMAC-signed token auth)
uploads.put("/api/uploads/put/*", async (c) => {
  const key = decodeURIComponent(c.req.path.replace("/api/uploads/put/", ""));
  const token = c.req.query("token");

  if (!token) {
    return c.json({ error: "Missing upload token" }, 401);
  }

  const contentType = c.req.header("Content-Type") || "application/octet-stream";
  const expires = Number(c.req.query("expires"));
  const valid = await verifyUploadToken(key, expires, contentType, token, c.env.JWT_SECRET);
  if (!valid) {
    return c.json({ error: "Invalid upload token" }, 403);
  }
  const body = await c.req.arrayBuffer();

  if (body.byteLength > MAX_UPLOAD_SIZE) {
    return c.json({ error: `File too large. Max size: ${MAX_UPLOAD_SIZE / 1024 / 1024}MB` }, 400);
  }

  const bucket = c.env.ATTACHMENTS;
  await bucket.put(key, body, {
    httpMetadata: { contentType },
  });

  return c.json({ success: true, path: `/objects/${key}` });
});

// GET /objects/* — Serve files from R2
uploads.get("/objects/*", async (c) => {
  const key = c.req.path.replace("/objects/", "");
  const bucket = c.env.ATTACHMENTS;

  const object = await bucket.get(key);
  if (!object) {
    return c.json({ error: "Object not found" }, 404);
  }

  const contentType = object.httpMetadata?.contentType || "application/octet-stream";
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("ETag", object.httpEtag);
  // Conteúdo enviado por usuários nunca executa na origem da API.
  headers.set("X-Content-Type-Options", "nosniff");
  const baseType = contentType.split(";")[0].trim().toLowerCase();
  if (baseType !== "application/pdf") {
    // O visualizador de PDF do navegador não abre sob CSP sandbox; os demais tipos ficam isolados.
    headers.set("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
  }
  if (!INLINE_CONTENT_TYPES.has(baseType)) {
    headers.set("Content-Disposition", "attachment");
  }

  return new Response(object.body, { headers });
});

// DELETE /api/uploads/* — Remove file from R2
uploads.delete("/api/uploads/*", async (c) => {
  const user = c.get("user");
  const key = decodeURIComponent(c.req.path.replace("/api/uploads/", ""));
  // Só remove arquivos do próprio tenant (a chave começa com o tenantId de quem enviou).
  if (!key.startsWith(`${user.tenantId}/`) || key.includes("..")) {
    return c.json({ error: "Acesso negado" }, 403);
  }
  const bucket = c.env.ATTACHMENTS;

  await bucket.delete(key);
  return c.json({ success: true });
});

export { uploads };
