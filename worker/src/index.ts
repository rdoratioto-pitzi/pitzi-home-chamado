import { Hono } from "hono";

type Bindings = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  CORS_ORIGIN: string;
  APP_URL: string;
  ATTACHMENTS: R2Bucket;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_FROM: string;
  OPENROUTER_API_KEY: string;
  CORREIOS_USUARIO: string;
  CORREIOS_SENHA: string;
  CORREIOS_CARTAO_POSTAGEM: string;
  CORREIOS_COD_ADMINISTRATIVO: string;
  CORREIOS_TOKEN: string;
  CORREIOS_HOMOLOGACAO: string;
  FIRECRAWL_API_KEY: string;
  CLAUDE_USAGE_SECRET: string;
  GITHUB_TOKEN: string;
};

export type AuthUser = {
  userId: string;
  tenantId: string | null;
  role: "admin" | "user";
};

type Variables = {
  user: AuthUser;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

const app = new Hono<AppEnv>();

app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
