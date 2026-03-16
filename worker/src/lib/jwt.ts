import { sign, verify } from "hono/jwt";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import type { Context } from "hono";
import type { AppEnv, AuthUser } from "../index";

const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";

type AccessPayload = {
  userId: string;
  tenantId: string | null;
  role: "admin" | "user";
  exp: number;
};

type RefreshPayload = {
  userId: string;
  exp: number;
};

export async function signAccessToken(
  user: AuthUser,
  secret: string,
): Promise<string> {
  const payload: AccessPayload = {
    userId: user.userId,
    tenantId: user.tenantId,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 2 * 60 * 60, // 2 hours
  };
  return sign(payload, secret, "HS256");
}

export async function signRefreshToken(
  userId: string,
  secret: string,
  rememberMe: boolean,
): Promise<string> {
  const duration = rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60; // 7d or 24h
  const payload: RefreshPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + duration,
  };
  return sign(payload, secret, "HS256");
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<AccessPayload | null> {
  try {
    return (await verify(token, secret, "HS256")) as AccessPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string,
  secret: string,
): Promise<RefreshPayload | null> {
  try {
    return (await verify(token, secret, "HS256")) as RefreshPayload;
  } catch {
    return null;
  }
}

export function setAuthCookies(
  c: Context<AppEnv>,
  accessToken: string,
  refreshToken: string,
  rememberMe: boolean,
) {
  const isProduction = c.env.APP_URL.startsWith("https://");
  const domain = ".renovsmart.com.br";
  const refreshMaxAge = rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60;

  // Access token cookie
  setCookie(c, ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "Lax",
    domain,
    path: "/",
    maxAge: 2 * 60 * 60,
  });

  // Refresh token cookie — path covers both /refresh and /logout
  setCookie(c, REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "Lax",
    domain,
    path: "/api/auth/",
    maxAge: refreshMaxAge,
  });
}

export function clearAuthCookies(c: Context<AppEnv>) {
  const domain = ".renovsmart.com.br";
  deleteCookie(c, ACCESS_TOKEN_COOKIE, { domain, path: "/" });
  deleteCookie(c, REFRESH_TOKEN_COOKIE, { domain, path: "/api/auth/" });
}

export function getAccessTokenFromCookie(c: Context<AppEnv>): string | null {
  return getCookie(c, ACCESS_TOKEN_COOKIE) ?? null;
}

export function getRefreshTokenFromCookie(c: Context<AppEnv>): string | null {
  return getCookie(c, REFRESH_TOKEN_COOKIE) ?? null;
}
