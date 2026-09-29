import type { MiddlewareHandler } from "hono";
import { isActiveApiPath } from "../../../shared/active-routes";

export const activeRoutesMiddleware: MiddlewareHandler = async (c, next) => {
  if (!isActiveApiPath(c.req.path)) return c.json({ error: "Módulo indisponível" }, 404);
  await next();
};
