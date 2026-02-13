import type { Express } from "express";
import { createServer, type Server } from "http";
import nodemailer from "nodemailer";
import { storage } from "./storage";
import {
  sendTicketCreatedEmail,
  sendTicketAssignedEmail,
  sendTicketStatusChangedEmail,
  sendTicketCommentEmail,
  sendMeetingInviteEmail,
  sendMentionNotificationEmail,
  sendSharedAreaInviteEmail,
  sendPasswordResetEmail
} from "./email-service";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import * as correiosService from "./correios-service";
import * as imeiInfoService from "./integrations/imei-info-service";
import bwipjs from "bwip-js";
import { streamChatCompletion, generateTitle, fetchOpenRouterModels } from "./openrouter";
import {
  insertUserSchema,
  insertTicketSchema,
  insertTicketResponsavelSchema,
  insertTicketCommentSchema,
  insertProjectSchema,
  insertKanbanColumnSchema,
  insertKanbanCardSchema,
  insertKanbanCommentSchema,
  insertObjectiveSchema,
  insertKeyResultSchema,
  insertKeyResultUpdateSchema,
  insertShipmentSchema,
  insertShipmentEventSchema,
  insertTaskTagSchema,
  insertTaskTagMemberSchema,
  insertTaskAreaSchema,
  insertTaskAreaMemberSchema,
  insertTaskSchema,
  insertTaskCommentSchema,
  insertTaskReactionSchema,
  insertTaskAttachmentSchema,
  insertTaskTemplateSchema,
  insertLogisticOperatorSchema,
  insertCollectionRequestSchema,
  insertLogisticaReversaPedidoSchema,
  insertLogisticaReversaEventoSchema,
  insertSlaRuleSchema,
  insertMetaAreaSchema,
  insertMetaSchema,
  insertMetaCheckinSchema,
  insertKnowledgeDocumentSchema,
  insertKnowledgeDocumentVersionSchema,
  insertKnowledgeAuditLogSchema,
  insertKnowledgeFavoriteSchema,
  insertAiConversationSchema,
  insertAiMessageSchema,
  insertNotificationSchema,
  insertUpdateSchema,
  insertImeiInfoAlertSchema,
} from "@shared/schema";
import { z } from "zod";
import { sql } from "drizzle-orm";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  function getSessionUser(req: any) {
    if (!req.session?.userId) throw new Error("Não autenticado");
    return { userId: req.session.userId!, isAdmin: req.session.isAdmin === true };
  }

  async function getUserAccessibleAreaIds(userId: string): Promise<string[]> {
    const areas = await storage.getTaskAreas(userId);
    return areas.map(a => a.id);
  }

  async function getUserAccessibleProjectIds(userId: string): Promise<string[]> {
    const allProjects = await storage.getProjects();
    const userMemberships = await storage.getProjectMembersByUser(userId);
    const memberProjectIds = new Set(userMemberships.map(m => m.projectId));
    const accessibleIds: string[] = [];
    for (const project of allProjects) {
      if (project.ownerId === userId || project.visibility === "public" || (project.visibility === "shared" && memberProjectIds.has(project.id))) {
        accessibleIds.push(project.id);
      }
    }
    return accessibleIds;
  }

  // ============== AUTH ==============
  app.post("/api/auth/login", async (req, res) => {
    try {
      const loginBodySchema = z.object({
        email: z.string().email(),
        password: z.string().min(1),
        rememberMe: z.boolean().optional().default(false),
      });
      const validated = loginBodySchema.parse(req.body);
      const users = await storage.getUsers();
      const user = users.find(u => u.email.toLowerCase() === validated.email.toLowerCase());

      if (!user || user.password !== validated.password || user.status !== "active") {
        return res.status(401).json({ success: false, message: "Credenciais inválidas" });
      }

      req.session.userId = user.id;
      req.session.isAdmin = user.isAdmin === true;
      req.session.cookie.maxAge = validated.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

      res.json({ success: true, user });
    } catch (error) {
      res.status(500).json({ success: false, message: "Erro interno" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ authenticated: false });
    const user = await storage.getUser(req.session.userId);
    if (!user || user.status !== "active") return res.status(401).json({ authenticated: false });
    res.json({ authenticated: true, user });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.clearCookie("renov.sid").json({ success: true }));
  });

  // ============== USERS ==============
  app.get("/api/users", async (req, res) => {
    const usersList = await storage.getUsers();
    res.json(usersList);
  });

  // ============== TICKETS ==============
  app.get("/api/tickets", async (req, res) => {
    const ticketsList = await storage.getTickets();
    res.json(ticketsList);
  });

  // ============== TASK TAGS (Areas) ==============
  app.get("/api/task-tags", async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const tags = await storage.getTaskTags(userId);
      res.json(tags);
    } catch (e) {
      res.status(500).json({ error: "Erro ao buscar tags" });
    }
  });

  // ============== TASKS ==============
  app.get("/api/tasks", async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const filters: any = { ...req.query };
      const tasksList = await storage.getTasks(filters);
      res.json(tasksList);
    } catch (e) {
      res.status(500).json({ error: "Erro ao buscar tarefas" });
    }
  });

  registerObjectStorageRoutes(app);

  return httpServer;
}
