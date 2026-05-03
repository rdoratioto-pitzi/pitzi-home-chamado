// worker/src/routes/service-accounts.ts
import { Hono } from "hono";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";

const TOKEN_BYTES = 48;
const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

const HEX_TABLE = "0123456789abcdef";

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    out += HEX_TABLE[byte >> 4] + HEX_TABLE[byte & 0x0f];
  }
  return out;
}

function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

export const serviceAccounts = new Hono<AppEnv>();

serviceAccounts.post(
  "/api/admin/service-accounts/:id/generate-token",
  requireAdmin,
  async (c) => {
    const userId = c.req.param("id");
    const storage = getStorage(c.get("db"));

    const user = await storage.getUser(userId);
    if (!user) {
      return c.json({ error: "Service account não encontrada" }, 404);
    }

    if (user.authMethod !== "token") {
      return c.json(
        {
          error: "Apenas usuários com auth_method='token' podem gerar Bearer token",
        },
        400,
      );
    }

    const token = generateToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    const updated = await storage.updateUser(user.id, {
      apiTokenHash: tokenHash,
      apiTokenExpiresAt: expiresAt,
    });

    if (!updated) {
      return c.json({ error: "Falha ao gravar hash do token" }, 500);
    }

    const actor = c.get("user");
    console.log(
      JSON.stringify({
        event: "service_account_token_generated",
        userId: user.id,
        actorId: actor?.userId ?? null,
        expiresAt: expiresAt.toISOString(),
      }),
    );

    return c.json({
      userId: user.id,
      email: user.email,
      token,
      expiresAt: expiresAt.toISOString(),
    });
  },
);
