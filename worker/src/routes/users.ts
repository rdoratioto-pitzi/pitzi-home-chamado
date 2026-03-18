// worker/src/routes/users.ts
import { Hono } from "hono";
import { insertUserSchema } from "../../../shared/schema";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../lib/email";

const users = new Hono<AppEnv>();

// GET /api/users (auth)
users.get("/api/users", async (c) => {
  const storage = getStorage(c.get("db"));
  const allUsers = await storage.getUsers();
  allUsers.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const safeUsers = allUsers.map(({ password, ...user }) => user);
  return c.json(safeUsers);
});

// GET /api/users/:id (admin)
users.get("/api/users/:id", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const user = await storage.getUser(c.req.param("id"));
  if (!user) return c.json({ error: "User not found" }, 404);
  const { password, ...safeUser } = user;
  return c.json(safeUser);
});

// POST /api/users (admin)
users.post("/api/users", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const validated = insertUserSchema.parse(await c.req.json());
  const user = await storage.createUser(validated);

  if (validated.password) {
    const emailResult = await sendWelcomeEmail(c.env, user, validated.password);
    if (!emailResult.success) {
      console.error("Failed to send welcome email:", emailResult.error);
    }
  }

  return c.json(user, 201);
});

// PATCH /api/users/:id (admin)
users.patch("/api/users/:id", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const validated = insertUserSchema.partial().parse(await c.req.json());
  const user = await storage.updateUser(c.req.param("id"), validated);
  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json(user);
});

// POST /api/users/:id/reset-password (admin)
users.post("/api/users/:id/reset-password", requireAdmin, async (c) => {
  const storage = getStorage(c.get("db"));
  const user = await storage.getUser(c.req.param("id"));
  if (!user) return c.json({ error: "User not found" }, 404);

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let temporaryPassword = "";
  for (let i = 0; i < 8; i++) {
    temporaryPassword += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  await storage.updateUser(user.id, { password: temporaryPassword });

  try {
    await sendPasswordResetEmail(c.env, user, temporaryPassword);
  } catch (emailError) {
    console.error("[users] Failed to send password reset email:", emailError);
  }

  return c.json({ success: true, temporaryPassword });
});

export { users };
