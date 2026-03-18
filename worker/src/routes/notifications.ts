// worker/src/routes/notifications.ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";

const notifications = new Hono<AppEnv>();

// GET /api/notifications/preferences
notifications.get("/api/notifications/preferences", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const preferences = await storage.getNotificationPreferences(user.userId);
  return c.json(preferences);
});

// PUT /api/notifications/preferences
notifications.put("/api/notifications/preferences", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const { emailNotificationsEnabled, pushNotificationsEnabled, emailPreferences } =
    await c.req.json();
  const preferences = await storage.updateNotificationPreferences(
    user.userId,
    emailNotificationsEnabled,
    pushNotificationsEnabled,
    emailPreferences,
  );
  return c.json(preferences);
});

// PUT /api/notifications/read-all
notifications.put("/api/notifications/read-all", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  await storage.markAllNotificationsRead(user.userId);
  return c.body(null, 204);
});

// PUT /api/notifications/:id/read
notifications.put("/api/notifications/:id/read", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  await storage.markNotificationRead(id, user.userId);
  return c.body(null, 204);
});

// GET /api/notifications/unread/count
notifications.get("/api/notifications/unread/count", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const count = await storage.getUnreadNotificationCount(user.userId);
  return c.json({ count });
});

// DELETE /api/notifications/:id
notifications.delete("/api/notifications/:id", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  await storage.deleteNotification(id, user.userId);
  return c.body(null, 204);
});

// GET /api/notifications
notifications.get("/api/notifications", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  const { limit, offset } = z
    .object({
      limit: z.coerce.number().int().min(1).max(100).default(10),
      offset: z.coerce.number().int().min(0).default(0),
    })
    .parse(c.req.query());
  const result = await storage.getNotifications(user.userId, limit, offset);
  return c.json(result);
});

// DELETE /api/notifications (clear all)
notifications.delete("/api/notifications", async (c) => {
  const user = c.get("user");
  const storage = getStorage(c.get("db"));
  await storage.clearNotifications(user.userId);
  return c.body(null, 204);
});

export { notifications };
