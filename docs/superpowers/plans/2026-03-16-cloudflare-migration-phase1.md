# Cloudflare Migration Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Cloudflare Worker (Hono) with JWT auth, Neon serverless DB, and 2 proof-of-concept routes (auth + settings), deployed to `homeapi-dev.renovsmart.com.br`.

**Architecture:** New `worker/` directory at project root containing a Hono app. Uses `@neondatabase/serverless` + `drizzle-orm/neon-http` for per-request DB. JWT via Web Crypto API (HS256). R2 bucket binding configured but not wired to routes yet (Phase 2).

**Tech Stack:** Hono, @neondatabase/serverless, drizzle-orm/neon-http, Web Crypto API (PBKDF2/HS256), Cloudflare Workers, wrangler

**Spec:** `docs/superpowers/specs/2026-03-16-cloudflare-migration-design.md`

---

## Chunk 1: Worker Scaffold + DB + Crypto Libs

### Task 1: Initialize Worker Project

**Files:**
- Create: `worker/package.json`
- Create: `worker/tsconfig.json`
- Create: `worker/wrangler.toml`
- Create: `worker/src/index.ts`

- [ ] **Step 1: Create `worker/package.json`**

```json
{
  "name": "renov-home-api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "deploy:dev": "wrangler deploy --env dev"
  },
  "dependencies": {
    "hono": "^4.7.0",
    "@neondatabase/serverless": "^1.0.0",
    "drizzle-orm": "^0.39.3",
    "zod": "^3.24.2",
    "zod-validation-error": "^3.4.0",
    "drizzle-zod": "^0.7.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250306.0",
    "wrangler": "^4.0.0",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Create `worker/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ESNext"],
    "types": ["@cloudflare/workers-types"],
    "paths": {
      "@shared/*": ["../shared/*"]
    },
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  },
  "include": ["src/**/*.ts", "../shared/**/*.ts"]
}
```

- [ ] **Step 3: Create `worker/wrangler.toml`**

```toml
name = "renov-home-api"
main = "src/index.ts"
compatibility_date = "2025-09-01"
compatibility_flags = ["nodejs_compat"]

[placement]
mode = "smart"

[[r2_buckets]]
binding = "ATTACHMENTS"
bucket_name = "renov-home-attachments"

[vars]
APP_URL = "https://home-next.renovsmart.com.br"
CORS_ORIGIN = "https://home-next.renovsmart.com.br"

[env.dev]
name = "renov-home-api-dev"
[env.dev.vars]
APP_URL = "https://home-dev.renovsmart.com.br"
CORS_ORIGIN = "https://home-dev.renovsmart.com.br"

[[env.dev.r2_buckets]]
binding = "ATTACHMENTS"
bucket_name = "renov-home-attachments-dev"
```

- [ ] **Step 4: Create minimal `worker/src/index.ts`**

```typescript
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
```

- [ ] **Step 5: Install dependencies**

Run: `cd worker && npm install`
Expected: `node_modules/` created, no errors

- [ ] **Step 6: Verify it compiles**

Run: `cd worker && npx wrangler dev --local --port 8787`
Expected: Worker starts locally on port 8787

- [ ] **Step 7: Test health endpoint**

Run: `curl http://localhost:8787/api/health`
Expected: `{"status":"ok","timestamp":"..."}`

- [ ] **Step 8: Commit**

```bash
git add worker/package.json worker/tsconfig.json worker/wrangler.toml worker/src/index.ts worker/package-lock.json
git commit -m "feat(worker): scaffold Hono worker project with health check"
```

---

### Task 2: Database Connection Layer

**Files:**
- Create: `worker/src/lib/db.ts`

- [ ] **Step 1: Create `worker/src/lib/db.ts`**

```typescript
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../shared/schema";

export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle({ client: sql, schema });
}

export type Database = ReturnType<typeof createDb>;
```

- [ ] **Step 2: Wire DB into the Hono app via middleware**

Modify `worker/src/index.ts` — add a DB middleware that creates a per-request DB instance and stores it in context:

```typescript
// Add to index.ts after app creation
import { createDb } from "./lib/db";

// Add 'db' to Variables type:
// db: Database;

app.use("*", async (c, next) => {
  const db = createDb(c.env.DATABASE_URL);
  c.set("db", db);
  await next();
});
```

Update the `Variables` type to include `db`:

```typescript
import { type Database } from "./lib/db";

type Variables = {
  user: AuthUser;
  db: Database;
};
```

- [ ] **Step 3: Test DB connection via health check**

Update health endpoint in `worker/src/index.ts`:

```typescript
import { sql } from "drizzle-orm";

app.get("/api/health", async (c) => {
  try {
    const db = c.get("db");
    await db.execute(sql`SELECT 1`);
    return c.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
  } catch (error) {
    return c.json({ status: "error", db: "disconnected", timestamp: new Date().toISOString() }, 500);
  }
});
```

- [ ] **Step 4: Set local dev secret and test**

Run: `cd worker && echo "DATABASE_URL=<your-neon-dev-connection-string>" > .dev.vars`

Use the dev Neon connection string (ep-crimson-pond pooler). Never commit `.dev.vars`.

Add `.dev.vars` to `.gitignore` if not already there.

Run: `cd worker && npx wrangler dev --local --port 8787`
Then: `curl http://localhost:8787/api/health`
Expected: `{"status":"ok","db":"connected",...}`

- [ ] **Step 5: Commit**

```bash
git add worker/src/lib/db.ts worker/src/index.ts worker/.gitignore
git commit -m "feat(worker): add Neon serverless DB connection with per-request Drizzle"
```

---

### Task 3: PBKDF2 Password Hashing Utility

**Files:**
- Create: `worker/src/lib/crypto.ts`

- [ ] **Step 1: Create `worker/src/lib/crypto.ts`**

Uses Web Crypto API (native in Workers, zero dependencies):

```typescript
const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}

/**
 * Hash a password using PBKDF2-SHA256.
 * Returns: "pbkdf2:iterations:salt_hex:hash_hex"
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_LENGTH * 8,
  );
  return `pbkdf2:${PBKDF2_ITERATIONS}:${bufferToHex(salt.buffer)}:${bufferToHex(hash)}`;
}

/**
 * Verify a password against a PBKDF2 hash.
 * Also supports plaintext comparison for lazy migration.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  // PBKDF2 hashed password
  if (stored.startsWith("pbkdf2:")) {
    const [, iterStr, saltHex, hashHex] = stored.split(":");
    const iterations = parseInt(iterStr, 10);
    const salt = new Uint8Array(hexToBuffer(saltHex));
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const derivedHash = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256",
      },
      keyMaterial,
      KEY_LENGTH * 8,
    );
    const storedHash = new Uint8Array(hexToBuffer(hashHex));
    const derivedArray = new Uint8Array(derivedHash);
    if (storedHash.length !== derivedArray.length) {
      return { valid: false, needsRehash: false };
    }
    let diff = 0;
    for (let i = 0; i < storedHash.length; i++) {
      diff |= storedHash[i] ^ derivedArray[i];
    }
    return { valid: diff === 0, needsRehash: false };
  }

  // Plaintext password (legacy — lazy migration)
  const valid = password === stored;
  return { valid, needsRehash: valid };
}

/**
 * SHA-256 hash for refresh token storage.
 */
export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return bufferToHex(hash);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd worker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add worker/src/lib/crypto.ts
git commit -m "feat(worker): add PBKDF2 password hashing and SHA-256 utilities via Web Crypto"
```

---

### Task 4: JWT Utility (Sign, Verify, Cookies)

**Files:**
- Create: `worker/src/lib/jwt.ts`

- [ ] **Step 1: Create `worker/src/lib/jwt.ts`**

Uses Hono's built-in JWT helpers:

```typescript
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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd worker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add worker/src/lib/jwt.ts
git commit -m "feat(worker): add JWT sign/verify and cookie helpers (HS256)"
```

---

## Chunk 2: Middleware + Schema

### Task 5: Auth Middleware

**Files:**
- Create: `worker/src/middleware/auth.ts`

- [ ] **Step 1: Create `worker/src/middleware/auth.ts`**

```typescript
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../index";
import { verifyAccessToken, getAccessTokenFromCookie } from "../lib/jwt";

/** Routes that require NO authentication at all */
const PUBLIC_ROUTES: Array<{ method: string; path: string | RegExp }> = [
  { method: "POST", path: "/api/auth/login" },
  { method: "POST", path: "/api/auth/forgot-password" },
  { method: "POST", path: "/api/auth/refresh" },
  { method: "POST", path: "/api/auth/logout" },
  { method: "GET", path: "/api/health" },
  { method: "GET", path: /^\/api\/settings\/(logo_url_light|logo_url_dark|favicon_url)$/ },
  { method: "GET", path: /^\/api\/etiquetas\/barcode\// },
];

/** Routes with optional auth (return null user if not authenticated) */
const OPTIONAL_AUTH_ROUTES = [
  { method: "GET", path: "/api/auth/me" },
];

/** Routes authenticated by secret header instead of JWT */
const SECRET_AUTH_ROUTES = [
  { method: "POST", path: "/api/git-analytics/claude-code-usage" },
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
    const secret = c.req.header("X-Claude-Usage-Secret");
    if (secret !== c.env.CLAUDE_USAGE_SECRET) {
      return c.json({ error: "Nao autorizado" }, 401);
    }
    return next();
  }

  // Try to extract and verify access token
  const token = getAccessTokenFromCookie(c);

  // Optional auth routes — proceed even without token
  if (matchesRoute(method, path, OPTIONAL_AUTH_ROUTES)) {
    if (token) {
      const payload = await verifyAccessToken(token, c.env.JWT_SECRET);
      if (payload) {
        c.set("user", {
          userId: payload.userId,
          tenantId: payload.tenantId,
          role: payload.role,
        });
      }
    }
    return next();
  }

  // All other routes — require valid access token
  if (!token) {
    return c.json({ error: "Nao autenticado" }, 401);
  }

  const payload = await verifyAccessToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: "Token expirado ou invalido" }, 401);
  }

  c.set("user", {
    userId: payload.userId,
    tenantId: payload.tenantId,
    role: payload.role,
  });

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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd worker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add worker/src/middleware/auth.ts
git commit -m "feat(worker): add JWT auth middleware with public/optional/secret route support"
```

---

### Task 6: CORS Middleware

**Files:**
- Create: `worker/src/middleware/cors.ts`

- [ ] **Step 1: Create `worker/src/middleware/cors.ts`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/middleware/cors.ts
git commit -m "feat(worker): add CORS middleware with credentials support"
```

---

### Task 7: Error Handler Middleware

**Files:**
- Create: `worker/src/middleware/error-handler.ts`

- [ ] **Step 1: Create `worker/src/middleware/error-handler.ts`**

```typescript
import type { ErrorHandler } from "hono";
import type { AppEnv } from "../index";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  console.error(`[${c.req.method}] ${c.req.path}:`, err);

  if (err instanceof ZodError) {
    const validationError = fromZodError(err);
    return c.json(
      { success: false, message: "Dados invalidos", details: validationError.message },
      400,
    );
  }

  return c.json(
    { success: false, message: "Erro interno do servidor" },
    500,
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/middleware/error-handler.ts
git commit -m "feat(worker): add error handler middleware with Zod support"
```

---

### Task 8: Add `refresh_tokens` Table to Schema

**Files:**
- Modify: `shared/schema.ts` (add table after `users` definition, around line 60)

- [ ] **Step 1: Add `refreshTokens` table to `shared/schema.ts`**

Add after the `users` table and its types (after `export type ModulePermissions`):

```typescript
// ============== REFRESH TOKENS (JWT Auth) ==============
export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

- [ ] **Step 2: Push schema to dev database**

Run: `npm run db:push`
Expected: Table `refresh_tokens` created in dev Neon database

- [ ] **Step 3: Commit**

```bash
git add shared/schema.ts
git commit -m "feat(schema): add refresh_tokens table for JWT auth"
```

---

### Task 9: Wire All Middleware into Hono App

**Files:**
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Update `worker/src/index.ts` with full middleware stack**

Replace the full file:

```typescript
import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { createDb, type Database } from "./lib/db";
import { createCorsMiddleware } from "./middleware/cors";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error-handler";

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
  db: Database;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

const app = new Hono<AppEnv>();

// Error handler
app.onError(errorHandler);

// CORS
app.use("*", createCorsMiddleware());

// Per-request DB
app.use("*", async (c, next) => {
  const db = createDb(c.env.DATABASE_URL);
  c.set("db", db);
  await next();
});

// Auth
app.use("/api/*", authMiddleware);

// Health check
app.get("/api/health", async (c) => {
  try {
    const db = c.get("db");
    await db.execute(sql`SELECT 1`);
    return c.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
  } catch {
    return c.json({ status: "error", db: "disconnected", timestamp: new Date().toISOString() }, 500);
  }
});

export default app;
```

- [ ] **Step 2: Verify everything compiles**

Run: `cd worker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Test locally**

Run: `cd worker && npx wrangler dev --local --port 8787`
Then: `curl http://localhost:8787/api/health`
Expected: `{"status":"ok","db":"connected",...}`

- [ ] **Step 4: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(worker): wire CORS, auth, DB, and error handler middleware"
```

---

## Chunk 3: Auth Routes

### Task 10: Auth Routes — Login, Me, Refresh, Logout, Forgot-Password

**Files:**
- Create: `worker/src/routes/auth.ts`
- Modify: `worker/src/index.ts` (import and mount auth routes)

- [ ] **Step 1: Create `worker/src/routes/auth.ts`**

```typescript
import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { users, refreshTokens } from "../../shared/schema";
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

  const { valid, needsRehash } = await verifyPassword(body.password, user.password);
  if (!valid) {
    return c.json({ success: false, message: "Credenciais invalidas" }, 401);
  }

  if (user.status !== "active") {
    return c.json({ success: false, message: "Sua conta esta inativa. Entre em contato com o administrador." }, 401);
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
    sameSite: "Lax",
    domain: ".renovsmart.com.br",
    path: "/",
    maxAge: 2 * 60 * 60,
  });

  return c.json({ success: true });
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

  // TODO Phase 2: send email with temporaryPassword via email service
  // For now, log it (remove in production)
  console.log(`[forgot-password] Temp password for ${user.email}: ${temporaryPassword}`);

  return c.json({ success: true, message: successMsg });
});

export { auth };
```

- [ ] **Step 2: Mount auth routes in `worker/src/index.ts`**

Add before `export default app;`:

```typescript
import { auth } from "./routes/auth";

// Mount routes
app.route("/", auth);
```

- [ ] **Step 3: Verify compilation**

Run: `cd worker && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Test login locally**

Run: `cd worker && npx wrangler dev --local --port 8787`

Set dev secrets first in `.dev.vars`:
```
JWT_SECRET=dev-jwt-secret-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production
```

Then test:
```bash
# Login with existing dev user
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}' \
  -v 2>&1 | grep -E "(Set-Cookie|{)"

# Expected: Set-Cookie headers with access_token and refresh_token
# Expected body: { "success": true, "user": { ... } }
```

- [ ] **Step 5: Test /api/auth/me**

```bash
# Using the access_token cookie from login response:
curl http://localhost:8787/api/auth/me \
  -H "Cookie: access_token=<token_from_login>"

# Expected: { "authenticated": true, "user": { ... } }
```

- [ ] **Step 6: Commit**

```bash
git add worker/src/routes/auth.ts worker/src/index.ts
git commit -m "feat(worker): implement JWT auth routes (login, me, refresh, logout, forgot-password)"
```

---

## Chunk 4: Settings Route + Deploy

### Task 11: Settings Route (Proof of Concept)

**Files:**
- Create: `worker/src/routes/settings.ts`
- Modify: `worker/src/index.ts` (mount settings routes)

- [ ] **Step 1: Create `worker/src/routes/settings.ts`**

```typescript
import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { settings as settingsTable } from "../../shared/schema";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../index";

const settings = new Hono<AppEnv>();

settings.get("/api/settings", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const rows = user?.tenantId
    ? await db.select().from(settingsTable).where(eq(settingsTable.tenantId, user.tenantId))
    : await db.select().from(settingsTable);
  return c.json(rows);
});

settings.get("/api/settings/:key", async (c) => {
  const db = c.get("db");
  const key = c.req.param("key");
  const user = c.get("user");

  const conditions = [eq(settingsTable.key, key)];
  // tenantId filter for authenticated non-public requests
  if (user?.tenantId) {
    conditions.push(eq(settingsTable.tenantId, user.tenantId));
  }

  const [setting] = await db
    .select()
    .from(settingsTable)
    .where(and(...conditions))
    .limit(1);

  if (!setting) {
    return c.json({ error: "Setting not found" }, 404);
  }
  return c.json(setting);
});

settings.post("/api/settings", requireAdmin, async (c) => {
  const body = z.object({
    key: z.string().min(1),
    value: z.string(),
  }).parse(await c.req.json());

  const db = c.get("db");
  const user = c.get("user");

  const tenantFilter = user.tenantId
    ? and(eq(settingsTable.key, body.key), eq(settingsTable.tenantId, user.tenantId))
    : eq(settingsTable.key, body.key);

  const [existing] = await db
    .select()
    .from(settingsTable)
    .where(tenantFilter)
    .limit(1);

  if (existing) {
    await db.update(settingsTable).set({ value: body.value }).where(tenantFilter);
  } else {
    await db.insert(settingsTable).values({ key: body.key, value: body.value, tenantId: user.tenantId });
  }

  const [setting] = await db
    .select()
    .from(settingsTable)
    .where(tenantFilter)
    .limit(1);

  return c.json(setting, 201);
});

export { settings };
```

- [ ] **Step 2: Mount in `worker/src/index.ts`**

Add alongside the auth route import:

```typescript
import { settings } from "./routes/settings";

app.route("/", settings);
```

- [ ] **Step 3: Verify settings table exists in schema**

Check `shared/schema.ts` for the `settings` table definition. If it doesn't export `settings` directly, look for the actual table name and adjust the import.

Run: `grep -n "export const settings" shared/schema.ts` or `grep -n "pgTable.*settings" shared/schema.ts`

Adjust the import in `worker/src/routes/settings.ts` to match the actual export name.

- [ ] **Step 4: Test locally**

```bash
curl http://localhost:8787/api/settings
# Expected: array of settings

curl http://localhost:8787/api/settings/logo_url_light
# Expected: setting object or 404
```

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/settings.ts worker/src/index.ts
git commit -m "feat(worker): add settings routes as proof of concept"
```

---

### Task 12: Deploy to Cloudflare Dev Environment

**Files:**
- No new files — deployment steps

- [ ] **Step 1: Create R2 bucket (dev)**

```bash
cd worker
npx wrangler r2 bucket create renov-home-attachments-dev
```

Expected: Bucket created successfully

- [ ] **Step 2: Set secrets for dev environment**

```bash
cd worker
echo "<dev-database-url>" | npx wrangler secret put DATABASE_URL --env dev
echo "<generate-random-64-char-hex>" | npx wrangler secret put JWT_SECRET --env dev
echo "<generate-random-64-char-hex>" | npx wrangler secret put JWT_REFRESH_SECRET --env dev
```

Generate secrets with: `openssl rand -hex 32`

Set remaining secrets as needed (SMTP, Correios, etc. — can be done later as routes require them).

- [ ] **Step 3: Deploy to dev**

```bash
cd worker
npx wrangler deploy --env dev
```

Expected: Deployed to `renov-home-api-dev.<account>.workers.dev`

- [ ] **Step 4: Configure custom domain**

In Cloudflare Dashboard:
1. Go to Workers & Pages → `renov-home-api-dev`
2. Settings → Triggers → Custom Domains
3. Add `homeapi-dev.renovsmart.com.br`

Or via wrangler — add to `wrangler.toml` under `[env.dev]`:
```toml
[env.dev.routes]
pattern = "homeapi-dev.renovsmart.com.br/*"
```

- [ ] **Step 5: Test deployed health check**

```bash
curl https://homeapi-dev.renovsmart.com.br/api/health
# Expected: {"status":"ok","db":"connected",...}
```

- [ ] **Step 6: Test deployed login**

```bash
curl -X POST https://homeapi-dev.renovsmart.com.br/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<dev-user-email>","password":"<dev-user-password>"}' \
  -v 2>&1 | grep -E "(Set-Cookie|{)"
```

Expected: Set-Cookie headers + user JSON

- [ ] **Step 7: Commit any wrangler.toml changes**

```bash
git add worker/wrangler.toml
git commit -m "chore(worker): configure dev deployment and custom domain"
```

---

## What's Next

Phase 1 is complete when:
- [x] Worker runs on `homeapi-dev.renovsmart.com.br`
- [x] Health check returns DB connected
- [x] Login returns JWT cookies + user data
- [x] `/api/auth/me` validates access token and returns user
- [x] `/api/auth/refresh` issues new access token from refresh cookie
- [x] `/api/auth/logout` clears cookies and revokes refresh token
- [x] `/api/auth/forgot-password` hashes temp password (not plaintext)
- [x] Settings routes work as proof of concept

**Next plan:** `2026-03-16-cloudflare-migration-phase2.md` — Route migration (23 routes Express → Hono) + client auth refactor + R2 uploads + Vite cleanup.
