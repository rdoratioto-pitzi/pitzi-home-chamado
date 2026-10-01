import { Router } from "express";
import { isTechnician } from "@shared/user-type";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { storage } from "../storage";
import { hashPassword, verifyPassword } from "@shared/password";
import { passwordResetUrl, sendPasswordResetLinkEmail } from "../email-service";
import { db } from "../db";
import {
  INACTIVE_ACCOUNT_MESSAGE,
  USE_GOOGLE_MESSAGE,
  allowedGoogleDomains,
  canUsePasswordLogin,
  googleLoginClientId,
  passwordLoginMode,
  publicAuthConfig,
  type AuthPolicyEnv,
} from "@shared/auth-policy";
import { GoogleTokenInvalid, verifyGoogleIdToken } from "@shared/google-id-token";
import { findOrProvisionGoogleUser } from "../services/google-login.service";
import type { User } from "@shared/schema";

// Rate limiter para tentativas de login - protege contra força bruta
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas por janela
  message: { success: false, message: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para recuperação de senha
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 solicitações por hora
  message: { success: false, message: "Muitas solicitações. Tente novamente em 1 hora." },
  standardHeaders: true,
  legacyHeaders: false,
});

// process.env é lido a cada chamada (mesmo objeto), então mudanças no .env valem após reiniciar.
const authEnv = process.env as AuthPolicyEnv;

// Mesmo contrato do Worker (worker/src/routes/auth.ts); política em shared/auth-policy.ts.
function sessionResponse(req: any, res: any, user: User, rememberMe: boolean) {
  req.session.userId = user.id;
  req.session.isAdmin = user.isAdmin === true;
  req.session.cookie.maxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  res.json({
    success: true,
    token: `renov_${req.sessionID}_${Date.now()}`,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      modulePermissions: user.modulePermissions,
      isAdmin: user.isAdmin === true,
      isTechnician: isTechnician(user),
      status: user.status,
    },
  });
}

export function registerAuthRoutes(router: Router) {
  router.get("/api/auth/config", (_req, res) => {
    res.json(publicAuthConfig(authEnv));
  });

  router.post("/api/auth/google", loginLimiter, async (req, res) => {
    const clientId = googleLoginClientId(authEnv);
    if (!clientId) return res.status(503).json({ success: false, message: "Login com Google ainda não configurado." });
    if (!db) return res.status(500).json({ success: false, message: "Database not available" });
    const credential = typeof req.body?.credential === "string" ? req.body.credential : "";
    if (credential.length < 20) return res.status(400).json({ success: false, message: "Credencial do Google ausente." });
    try {
      const identity = await verifyGoogleIdToken(credential, { clientId, allowedDomains: allowedGoogleDomains(authEnv) });
      const result = await findOrProvisionGoogleUser(db, identity);
      if (!result.ok) return res.status(403).json({ success: false, message: INACTIVE_ACCOUNT_MESSAGE });
      sessionResponse(req, res, result.user, req.body?.rememberMe === true);
    } catch (error) {
      if (error instanceof GoogleTokenInvalid) {
        return res.status(401).json({ success: false, message: "Não foi possível validar o login com Google.", reason: error.reason });
      }
      console.error("[auth] Google login error:", error);
      res.status(502).json({ success: false, message: "Não foi possível validar o login com Google." });
    }
  });

  router.post("/api/auth/login", loginLimiter, async (req, res) => {
    if (passwordLoginMode(authEnv) === "off") {
      return res.status(403).json({ success: false, message: USE_GOOGLE_MESSAGE, code: "use_google" });
    }
    try {
      const loginBodySchema = z.object({
        email: z.string().email("Email inválido"),
        password: z.string().min(1, "Senha é obrigatória"),
        rememberMe: z.boolean().optional().default(false),
      });

      const validated = loginBodySchema.parse(req.body);
      const users = await storage.getUsers();
      const user = users.find(u => u.email.toLowerCase() === validated.email.toLowerCase());

      if (!user || !user.password) {
        return res.status(401).json({ success: false, message: "Credenciais inválidas" });
      }

      const { valid, needsRehash } = await verifyPassword(validated.password, user.password);
      if (!valid) {
        return res.status(401).json({ success: false, message: "Credenciais inválidas" });
      }
      if (needsRehash) {
        await storage.updateUser(user.id, { password: await hashPassword(validated.password) });
      }

      if (user.status !== "active") {
        return res.status(401).json({ success: false, message: "Sua conta está inativa. Entre em contato com o administrador." });
      }
      if (!canUsePasswordLogin(authEnv, user)) {
        return res.status(403).json({ success: false, message: USE_GOOGLE_MESSAGE, code: "use_google" });
      }

      sessionResponse(req, res, user, validated.rememberMe);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: "Dados inválidos", details: error.errors });
      }
      console.error("[auth] Login error:", error);
      res.status(500).json({ success: false, message: "Erro interno" });
    }
  });

  router.get("/api/auth/me", async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ authenticated: false });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.status !== "active") {
      req.session.destroy(() => { });
      return res.status(401).json({ authenticated: false });
    }
    res.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        modulePermissions: user.modulePermissions,
        isAdmin: user.isAdmin === true,
        isTechnician: isTechnician(user),
        status: user.status,
      },
    });
  });

  router.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao fazer logout" });
      }
      res.clearCookie("renov.sid");
      res.json({ success: true });
    });
  });

  const forgotPasswordSchema = z.object({
    email: z.string().email("Email inválido"),
  });

  router.post("/api/auth/forgot-password", forgotPasswordLimiter, async (req, res) => {
    // Sempre a mesma resposta, para não revelar quais e-mails existem.
    const successMsg = "Se o email estiver cadastrado, você receberá um link para redefinir a senha.";
    try {
      const validated = forgotPasswordSchema.parse(req.body);
      const user = await storage.getUserByEmail(validated.email);
      if (!user || user.status !== "active" || !canUsePasswordLogin(authEnv, user)) {
        return res.json({ success: true, message: successMsg });
      }

      // Não altera a senha: gera um link de uso único. Acima do limite por hora, não envia.
      const token = await storage.createPasswordResetToken(user.id);
      if (token) {
        sendPasswordResetLinkEmail(user, passwordResetUrl(token)).catch((error) =>
          console.error("[auth] Failed to send password reset email:", error),
        );
      }
      res.json({ success: true, message: successMsg });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: "Email inválido" });
      }
      console.error("[auth] Password reset error:", error);
      res.status(500).json({ success: false, message: "Erro interno. Tente novamente mais tarde." });
    }
  });

  const resetPasswordSchema = z.object({
    token: z.string().min(20),
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
  });

  router.post("/api/auth/reset-password", forgotPasswordLimiter, async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
    }
    const ok = await storage.resetPasswordWithToken(parsed.data.token, parsed.data.password);
    if (!ok) {
      return res.status(400).json({ success: false, message: "Link inválido ou expirado. Solicite um novo." });
    }
    res.json({ success: true, message: "Senha redefinida. Entre com a nova senha." });
  });
}
