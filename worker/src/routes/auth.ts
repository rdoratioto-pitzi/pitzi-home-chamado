import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { users, refreshTokens } from "../../../shared/schema";
import { hashPassword, verifyPassword, sha256 } from "../lib/crypto";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  getRefreshTokenFromCookie,
} from "../lib/jwt";
import { setCookie } from "hono/cookie";
import type { AppEnv, AuthUser } from "../index";
import { sendPasswordResetEmail } from "../lib/email";

const auth = new Hono<AppEnv>();

// ─── POST /api/auth/login ───────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(1, "Senha e obrigatoria"),
  rememberMe: z.boolean().optional().default(false),
});

auth.post("/api/auth/login", async (c) => {
  const body = loginSchema.parse(await c.req.json());
  const db = c.get("db");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email.toLowerCase()))
    .limit(1);

  if (!user || !user.password) {
    return c.json({ success: false, message: "Credenciais invalidas" }, 401);
  }

  if (user.status !== "active") {
    return c.json({ success: false, message: "Credenciais invalidas" }, 401);
  }

  const { valid, needsRehash } = await verifyPassword(body.password, user.password);
  if (!valid) {
    return c.json({ success: false, message: "Credenciais invalidas" }, 401);
  }

  // Lazy migration: rehash plaintext password
  if (needsRehash) {
    const hashed = await hashPassword(body.password);
    await db.update(users).set({ password: hashed }).where(eq(users.id, user.id));
  }

  const authUser: AuthUser = {
    userId: user.id,
    tenantId: user.tenantId ?? null,
    role: user.isAdmin ? "admin" : "user",
  };

  const accessToken = await signAccessToken(authUser, c.env.JWT_SECRET);
  const refreshToken = await signRefreshToken(user.id, c.env.JWT_REFRESH_SECRET, body.rememberMe);

  // Store refresh token hash in DB
  const tokenHash = await sha256(refreshToken);
  const expiresAt = new Date(Date.now() + (body.rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000));
  await db.insert(refreshTokens).values({ userId: user.id, tokenHash, expiresAt });

  setAuthCookies(c, accessToken, refreshToken, body.rememberMe);

  return c.json({
    success: true,
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      tenantId: user.tenantId,
      role: user.isAdmin ? "admin" : "user",
      isAdmin: user.isAdmin === true,
      modulePermissions: user.modulePermissions,
      status: user.status,
    },
  });
});

// ─── GET /api/auth/me ───────────────────────────────────────────
auth.get("/api/auth/me", async (c) => {
  const authUser = c.get("user");
  if (!authUser) {
    return c.json({ authenticated: false });
  }

  const db = c.get("db");
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, authUser.userId))
    .limit(1);

  if (!user || user.status !== "active") {
    clearAuthCookies(c);
    return c.json({ authenticated: false });
  }

  return c.json({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      tenantId: user.tenantId,
      role: user.isAdmin ? "admin" : "user",
      isAdmin: user.isAdmin === true,
      modulePermissions: user.modulePermissions,
      status: user.status,
    },
  });
});

// ─── POST /api/auth/refresh ─────────────────────────────────────
auth.post("/api/auth/refresh", async (c) => {
  const token = getRefreshTokenFromCookie(c);
  if (!token) {
    return c.json({ success: false, message: "Refresh token ausente" }, 401);
  }

  const payload = await verifyRefreshToken(token, c.env.JWT_REFRESH_SECRET);
  if (!payload) {
    clearAuthCookies(c);
    return c.json({ success: false, message: "Refresh token invalido ou expirado" }, 401);
  }

  const db = c.get("db");
  const tokenHash = await sha256(token);

  // Verify token exists in DB
  const [storedToken] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!storedToken) {
    clearAuthCookies(c);
    return c.json({ success: false, message: "Refresh token revogado" }, 401);
  }

  // Get user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);

  if (!user || user.status !== "active") {
    clearAuthCookies(c);
    return c.json({ success: false, message: "Usuario inativo" }, 401);
  }

  // Issue new access token
  const authUser: AuthUser = {
    userId: user.id,
    tenantId: user.tenantId ?? null,
    role: user.isAdmin ? "admin" : "user",
  };
  const newAccessToken = await signAccessToken(authUser, c.env.JWT_SECRET);

  // Only set the access token cookie (refresh stays the same)
  const isProduction = c.env.APP_URL.startsWith("https://");
  setCookie(c, "access_token", newAccessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/",
    maxAge: 2 * 60 * 60,
  });

  return c.json({ success: true, accessToken: newAccessToken });
});

// ─── POST /api/auth/logout ──────────────────────────────────────
auth.post("/api/auth/logout", async (c) => {
  const token = getRefreshTokenFromCookie(c);

  if (token) {
    const db = c.get("db");
    const tokenHash = await sha256(token);
    await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
  }

  clearAuthCookies(c);
  return c.json({ success: true });
});

// ─── POST /api/auth/forgot-password ─────────────────────────────
const forgotPasswordSchema = z.object({
  email: z.string().email("Email invalido"),
});

auth.post("/api/auth/forgot-password", async (c) => {
  const body = forgotPasswordSchema.parse(await c.req.json());
  const db = c.get("db");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email.toLowerCase()))
    .limit(1);

  // Always return success to prevent email enumeration
  const successMsg = "Se o email estiver cadastrado, voce recebera uma nova senha temporaria.";

  if (!user || user.status !== "active") {
    return c.json({ success: true, message: successMsg });
  }

  // Generate temporary password (cryptographically secure)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const randomBytes = crypto.getRandomValues(new Uint8Array(8));
  let temporaryPassword = "";
  for (let i = 0; i < 8; i++) {
    temporaryPassword += chars.charAt(randomBytes[i] % chars.length);
  }

  // Hash before storing (fix: current code stores plaintext)
  const hashedTemp = await hashPassword(temporaryPassword);
  await db.update(users).set({ password: hashedTemp }).where(eq(users.id, user.id));

  sendPasswordResetEmail(c.env, user, temporaryPassword).catch((err) =>
    console.error("[AUTH] Falha ao enviar email de reset:", err)
  );

  return c.json({ success: true, message: successMsg });
});

export { auth };
