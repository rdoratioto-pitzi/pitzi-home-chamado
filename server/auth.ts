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

export function setupSession(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || "renov-home-session-secret-dev-fallback";
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      name: "renov.sid",
      cookie: {
        httpOnly: true,
        secure: isProduction,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );
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

  if (!req.session?.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  next();
}
