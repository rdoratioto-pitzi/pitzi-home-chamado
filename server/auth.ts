import type { Request, Response, NextFunction } from "express";
import session from "express-session";
import type { Express } from "express";

declare module "express-session" {
  interface SessionData {
    userId: string;
    isAdmin: boolean;
  }
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  modulePermissions: unknown;
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const PUBLIC_ROUTES = [
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/me",
];

import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export function setupSession(app: Express) {
  const isProduction = process.env.NODE_ENV === "production";
  
  // Em produção, SESSION_SECRET é obrigatório
  if (isProduction && !process.env.SESSION_SECRET) {
    throw new Error("CRITICAL: SESSION_SECRET must be set in production environment");
  }
  
  // Fallback apenas para desenvolvimento
  const sessionSecret = process.env.SESSION_SECRET || "dev-only-fallback-change-in-production";

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      name: "renov.sid",
      store: new MemoryStore({
        checkPeriod: 86400000 // prune expired entries every 24h
      }),
      cookie: {
        httpOnly: true,
        secure: isProduction,
        maxAge: 24 * 60 * 60 * 1000, // 24 horas - sessão padrão reduzida para segurança
        sameSite: "lax",
        path: "/",
      },
    })
  );

  // Sliding expiration: estende a sessão a cada atividade do usuário
  app.use((req, res, next) => {
    if (req.session?.userId && req.session.cookie) {
      req.session.touch();
    }
    next();
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api/")) {
    return next();
  }

  const isPublic = PUBLIC_ROUTES.some(
    (route) => req.path === route
  );
  if (isPublic) {
    return next();
  }

  if (req.method === "GET" && /^\/api\/settings\/(logo_url_light|logo_url_dark|favicon_url)$/.test(req.path)) {
    return next();
  }

  // Permitir acesso ao endpoint de barcode sem autenticação (usado em tags img)
  if (req.method === "GET" && req.path.startsWith("/api/etiquetas/barcode/")) {
    return next();
  }

  if (!req.session?.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  next();
}
