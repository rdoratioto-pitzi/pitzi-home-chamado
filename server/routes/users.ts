import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertUserSchema } from "@shared/schema";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { sendPasswordResetEmail, sendWelcomeEmail } from "../email-service";

export function registerUserRoutes(router: Router) {
  router.get("/api/users", requireAuth, async (req, res) => {
    const users = await storage.getUsers();
    // Sort alphabetically by name
    users.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const safeUsers = users.map(({ password, ...user }) => user);
    res.json(safeUsers);
  });

  router.get("/api/users/:id", requireAdmin, async (req, res) => {
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { password, ...safeUser } = user;
    res.json(safeUser);
  });

  router.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const validated = insertUserSchema.parse(req.body);
      const user = await storage.createUser(validated);

      if (validated.password) {
        const emailResult = await sendWelcomeEmail(user, validated.password);
        if (!emailResult.success) {
          console.error("Failed to send welcome email:", emailResult.error);
          // Continue with user creation even if email fails, but log the error
        }
      }

      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("[users] Error creating user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const partialSchema = insertUserSchema.partial();
      const validated = partialSchema.parse(req.body);
      const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const user = await storage.updateUser(userId, validated);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("[users] Error updating user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/api/users/:id/reset-password", requireAdmin, async (req, res) => {
    try {
      const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      let temporaryPassword = "";
      for (let i = 0; i < 8; i++) {
        temporaryPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      await storage.updateUser(user.id, { password: temporaryPassword });

      try {
        await sendPasswordResetEmail(user, temporaryPassword);
      } catch (emailError) {
        console.error(`[users] Failed to send password reset email:`, emailError);
      }

      res.json({ success: true, temporaryPassword });
    } catch (error) {
      console.error("[users] Password reset error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
