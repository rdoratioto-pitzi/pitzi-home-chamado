import { Router } from "express";
import { randomBytes, createHash } from "crypto";
import { storage } from "../storage";
import { requireAdmin } from "../middleware/auth";

const TOKEN_BYTES = 48;
const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function registerServiceAccountRoutes(router: Router) {
  router.post(
    "/api/admin/service-accounts/:id/generate-token",
    requireAdmin,
    async (req, res) => {
      const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Service account não encontrada" });
      }

      if (user.authMethod !== "token") {
        return res.status(400).json({
          error: "Apenas usuários com auth_method='token' podem gerar Bearer token",
        });
      }

      const token = generateToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

      const updated = await storage.updateUser(user.id, {
        apiTokenHash: tokenHash,
        apiTokenExpiresAt: expiresAt,
      });

      if (!updated) {
        return res.status(500).json({ error: "Falha ao gravar hash do token" });
      }

      console.log(
        JSON.stringify({
          event: "service_account_token_generated",
          userId: user.id,
          actorId: req.session?.userId ?? null,
          expiresAt: expiresAt.toISOString(),
        }),
      );

      return res.json({
        userId: user.id,
        email: user.email,
        token,
        expiresAt: expiresAt.toISOString(),
      });
    },
  );
}
