import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../index";

// Cabeçalhos de segurança em todas as respostas do Worker (achados do teste OWASP ZAP):
// - X-Content-Type-Options: nosniff — o navegador não "adivinha" o tipo do conteúdo.
// - sem X-Powered-By — não revela a tecnologia do servidor.
// Respostas que já definem seus próprios cabeçalhos (ex.: arquivos em /objects com CSP sandbox)
// não são sobrescritas.
export const securityHeadersMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  if (!c.res.headers.has("X-Content-Type-Options")) {
    c.res.headers.set("X-Content-Type-Options", "nosniff");
  }
  c.res.headers.delete("X-Powered-By");
};
