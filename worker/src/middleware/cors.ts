import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../index";

export function createCorsMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const origin = c.env.CORS_ORIGIN;
    const handler = cors({
      origin,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "X-Claude-Usage-Secret"],
      credentials: true,
      maxAge: 86400,
    });
    return handler(c, next);
  };
}
