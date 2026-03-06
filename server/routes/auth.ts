import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { storage } from "../storage";
import { sendPasswordResetEmail } from "../email-service";

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

export function registerAuthRoutes(router: Router) {
  router.post("/api/auth/login", loginLimiter, async (req, res) => {
    try {
      const loginBodySchema = z.object({
        email: z.string().email("Email inválido"),
        password: z.string().min(1, "Senha é obrigatória"),
        rememberMe: z.boolean().optional().default(false),
      });

      const validated = loginBodySchema.parse(req.body);
      console.log(`[auth] Login attempt for: ${validated.email}, rememberMe: ${validated.rememberMe}`);
      const users = await storage.getUsers();
      const user = users.find(u => u.email.toLowerCase() === validated.email.toLowerCase());

      if (!user) {
        console.log(`[auth] User not found: ${validated.email}`);
        return res.status(401).json({ success: false, message: "Credenciais inválidas" });
      }

      console.log(`[auth] User found: ${user.email}, status: ${user.status}, isAdmin: ${user.isAdmin}`);
      if (user.password !== validated.password) {
        console.log(`[auth] Password mismatch for: ${user.email}`);
        return res.status(401).json({ success: false, message: "Credenciais inválidas" });
      }

      if (user.status !== "active") {
        console.log(`[auth] User inactive: ${user.email}`);
        return res.status(401).json({ success: false, message: "Sua conta está inativa. Entre em contato com o administrador." });
      }

      console.log(`[auth] Login successful for: ${user.email}, isAdmin: ${user.isAdmin}`);

      req.session.userId = user.id;
      req.session.isAdmin = user.isAdmin === true;

      // Sessão com rememberMe reduzida para 7 dias (antes era 30)
      if (validated.rememberMe) {
        req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000;
      } else {
        req.session.cookie.maxAge = 24 * 60 * 60 * 1000;
      }

      const sessionToken = `renov_${req.sessionID}_${Date.now()}`;

      res.json({
        success: true,
        token: sessionToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          modulePermissions: user.modulePermissions,
          isAdmin: user.isAdmin === true,
          status: user.status,
        }
      });
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
    try {
      const validated = forgotPasswordSchema.parse(req.body);
      console.log(`[auth] Password reset request for: ${validated.email}`);
      const users = await storage.getUsers();
      const user = users.find(u => u.email.toLowerCase() === validated.email.toLowerCase());

      if (!user) {
        console.log(`[auth] Password reset - user not found: ${validated.email}`);
        return res.json({ success: true, message: "Se o email estiver cadastrado, você receberá uma nova senha temporária." });
      }

      if (user.status !== "active") {
        console.log(`[auth] Password reset - user inactive: ${validated.email}`);
        return res.json({ success: true, message: "Se o email estiver cadastrado, você receberá uma nova senha temporária." });
      }

      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      let temporaryPassword = "";
      for (let i = 0; i < 8; i++) {
        temporaryPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      await storage.updateUser(user.id, { password: temporaryPassword });
      console.log(`[auth] Temporary password set for: ${validated.email}`);

      try {
        await sendPasswordResetEmail(user, temporaryPassword);
        console.log(`[auth] Password reset email sent to: ${validated.email}`);
      } catch (emailError) {
        console.error(`[auth] Failed to send password reset email:`, emailError);
        return res.status(500).json({ success: false, message: "Erro ao enviar o email. Tente novamente mais tarde." });
      }

      res.json({ success: true, message: "Se o email estiver cadastrado, você receberá uma nova senha temporária." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: "Email inválido" });
      }
      console.error("[auth] Password reset error:", error);
      res.status(500).json({ success: false, message: "Erro interno. Tente novamente mais tarde." });
    }
  });
}
