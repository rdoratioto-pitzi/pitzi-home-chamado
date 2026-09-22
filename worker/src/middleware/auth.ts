import type { Context, MiddlewareHandler } from "hono";
import type { AppEnv } from "../index";
import { verifyAccessToken, getAccessTokenFromCookie, getBearerToken } from "../lib/jwt";
import { secretMatches } from "../lib/crypto";
import { loadActiveSession } from "../lib/sessions";

/** Routes that require NO authentication at all */
const PUBLIC_ROUTES: Array<{ method: string; path: string | RegExp }> = [
  { method: "POST", path: "/api/auth/login" },
  { method: "POST", path: "/api/auth/forgot-password" },
  { method: "POST", path: "/api/auth/refresh" },
  { method: "POST", path: "/api/auth/logout" },
  { method: "GET", path: "/api/health" },
  { method: "GET", path: /^\/api\/settings\/(logo_url_light|logo_url_dark|favicon_url)$/ },
  { method: "GET", path: /^\/api\/etiquetas\/barcode\// },
  // Phase 2B public routes
  { method: "GET", path: "/api/slas" },
  { method: "GET", path: /^\/api\/slas\/[^/]+$/ },
  { method: "GET", path: "/api/updates" },
  { method: "GET", path: /^\/api\/cep\// },
  { method: "POST", path: "/api/etiquetas/gerar-png" },
  { method: "POST", path: "/api/etiquetas/imprimir" },
  // Webhook de logística reversa (X-Webhook-Secret validado in-route).
  // Os proxies de relatório de pedidos, avaliações IA e estoques exigem login.
  { method: "POST", path: "/api/logistica-reversa/eventos" },
  // Phase 2C public routes — GitHub webhook (signature validated in-route)
  { method: "POST", path: "/api/git-analytics/github-webhook" },
  // Phase 3 — Hermes endpoints (autenticação custom validada in-route)
  { method: "POST", path: "/api/integrations/hermes/thread-registered" }, // Bearer token
  { method: "POST", path: "/api/integrations/hermes/execution-update" }, // Bearer token (Fase 4)
  { method: "POST", path: "/api/integrations/slack/interactions" }, // Slack signature
  // Phase 3 — Upload routes (PUT is self-authenticated via HMAC token)
  { method: "PUT", path: /^\/api\/uploads\/put\// },
  { method: "GET", path: /^\/objects\// },
];

/** Routes with optional auth (return null user if not authenticated) */
const OPTIONAL_AUTH_ROUTES = [
  { method: "GET", path: "/api/auth/me" },
];

/** Routes authenticated by secret header instead of JWT */
const SECRET_AUTH_ROUTES = [
  { method: "POST", path: "/api/git-analytics/claude-code-usage" },
];

/** Routes authenticated by X-API-Key header */
const API_KEY_ROUTES: Array<{ method: string; path: string | RegExp }> = [
  { method: "GET", path: "/api/external/chamados" },
];

function matchesRoute(
  method: string,
  path: string,
  routes: Array<{ method: string; path: string | RegExp }>,
): boolean {
  return routes.some((r) => {
    if (r.method !== method) return false;
    if (typeof r.path === "string") return path === r.path;
    return r.path.test(path);
  });
}

// Token válido não basta: a sessão precisa existir e o usuário estar ativo. Papel e tenant
// vêm do banco, não do token, para que mudanças valham na próxima requisição.
// Tokens sem sid (emitidos antes desta regra) são recusados; o frontend renova via refresh.
async function resolveUser(c: Context<AppEnv>, token: string) {
  const payload = await verifyAccessToken(token, c.env.JWT_SECRET);
  if (!payload?.sid) return null;
  return loadActiveSession(c.get("db"), payload.userId, payload.sid);
}

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const method = c.req.method;
  const path = c.req.path;

  // Skip non-API routes
  if (!path.startsWith("/api/")) {
    return next();
  }

  // Public routes — no auth needed
  if (matchesRoute(method, path, PUBLIC_ROUTES)) {
    return next();
  }

  // Secret-authenticated routes
  if (matchesRoute(method, path, SECRET_AUTH_ROUTES)) {
    if (!secretMatches(c.req.header("X-Claude-Usage-Secret"), c.env.CLAUDE_USAGE_SECRET)) {
      return c.json({ error: "Nao autorizado" }, 401);
    }
    return next();
  }

  // API-key authenticated routes (Venus external access)
  if (matchesRoute(method, path, API_KEY_ROUTES)) {
    const apiKey = c.req.header("X-API-Key");
    const expectedKey = c.env.VENUS_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      return c.json({ error: "API key invalida ou ausente" }, 401);
    }
    return next();
  }

  // Aceita cookie OU Authorization: Bearer — necessário para CORS cross-domain
  // onde browsers modernos bloqueiam cookies SameSite=None de terceiros.
  const token = getAccessTokenFromCookie(c) || getBearerToken(c.req.header("Authorization"));

  // Optional auth routes — proceed even without token
  if (matchesRoute(method, path, OPTIONAL_AUTH_ROUTES)) {
    const user = token ? await resolveUser(c, token) : null;
    if (user) c.set("user", user);
    return next();
  }

  // All other routes — require valid access token
  if (!token) {
    return c.json({ error: "Nao autenticado" }, 401);
  }

  const user = await resolveUser(c, token);
  if (!user) {
    return c.json({ error: "Sessao expirada ou encerrada" }, 401);
  }
  c.set("user", user);

  return next();
};

/** Middleware to require admin role */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user");
  if (!user || user.role !== "admin") {
    return c.json({ error: "Acesso negado" }, 403);
  }
  return next();
};
