import { Router } from "express";
import { storage } from "../storage";
import { requireAuth, getSessionUser } from "../middleware/auth";
import { z } from "zod";

export function registerNotificationRoutes(router: Router): void {
  // ============== NOTIFICATIONS ==============
  router.get("/api/notifications/preferences", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const preferences = await storage.getNotificationPreferences(userId);
      res.json(preferences);
    } catch (error: any) {
      console.error("Error fetching notification preferences:", error);
      res.status(error.status || 500).json({ error: error.message || "Failed to fetch notification preferences" });
    }
  });

  router.put("/api/notifications/preferences", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const { emailNotificationsEnabled, pushNotificationsEnabled } = req.body;
      const preferences = await storage.updateNotificationPreferences(
        userId,
        emailNotificationsEnabled,
        pushNotificationsEnabled
      );
      res.json(preferences);
    } catch (error: any) {
      console.error("Error updating notification preferences:", error);
      res.status(error.status || 500).json({ error: error.message || "Failed to update notification preferences" });
    }
  });

  router.put("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      await storage.markAllNotificationsRead(userId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error marking all notifications as read:", error);
      res.status(error.status || 500).json({ error: error.message || "Failed to mark all notifications as read" });
    }
  });

  router.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const id = req.params.id as string;
      await storage.markNotificationRead(id, userId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
      res.status(error.status || 500).json({ error: error.message || "Failed to mark notification as read" });
    }
  });

  router.get("/api/notifications/unread/count", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error: any) {
      console.error("Error fetching unread notification count:", error);
      res.status(error.status || 500).json({ error: error.message || "Failed to fetch unread notification count" });
    }
  });

  router.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const id = req.params.id as string;
      await storage.deleteNotification(id, userId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting notification:", error);
      res.status(error.status || 500).json({ error: error.message || "Failed to delete notification" });
    }
  });

  router.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const { limit, offset } = z.object({
        limit: z.coerce.number().int().min(1).max(100).default(10),
        offset: z.coerce.number().int().min(0).default(0),
      }).parse(req.query);

      const notifications = await storage.getNotifications(userId, limit, offset);
      res.json(notifications);
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
      res.status(error.status || 500).json({ error: error.message || "Failed to fetch notifications" });
    }
  });

  router.delete("/api/notifications", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      await storage.clearNotifications(userId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error clearing notifications:", error);
      res.status(error.status || 500).json({ error: error.message || "Failed to clear notifications" });
    }
  });
}
