// worker/src/routes/uploads.ts
import { Hono } from "hono";
import type { AppEnv } from "../index";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

async function signUploadToken(key: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(key));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function verifyUploadToken(key: string, token: string, secret: string): Promise<boolean> {
  const expected = await signUploadToken(key, secret);
  return token === expected;
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

  const key = `${user.tenantId}/uploads/${crypto.randomUUID()}-${name}`;
  const token = await signUploadToken(key, c.env.JWT_SECRET);
  const uploadURL = `${c.env.API_URL}/api/uploads/put/${encodeURIComponent(key)}?token=${encodeURIComponent(token)}`;
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

  const valid = await verifyUploadToken(key, token, c.env.JWT_SECRET);
  if (!valid) {
    return c.json({ error: "Invalid upload token" }, 403);
  }

  const contentType = c.req.header("Content-Type") || "application/octet-stream";
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

  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("ETag", object.httpEtag);

  return new Response(object.body, { headers });
});

// DELETE /api/uploads/* — Remove file from R2
uploads.delete("/api/uploads/*", async (c) => {
  const key = decodeURIComponent(c.req.path.replace("/api/uploads/", ""));
  const bucket = c.env.ATTACHMENTS;

  await bucket.delete(key);
  return c.json({ success: true });
});

export { uploads };
