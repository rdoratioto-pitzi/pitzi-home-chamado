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
  // Backward compatibility
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
      if (project.ownerId === userId) {
        accessibleIds.push(project.id);
      } else if (project.visibility === "public") {
        accessibleIds.push(project.id);
      } else if (project.visibility === "shared" && memberProjectIds.has(project.id)) {
        accessibleIds.push(project.id);
      }
    }
    return accessibleIds;
  }

  function hasFlowchartAccess(flowchart: any, userId: string): boolean {
    if (flowchart.ownerId === userId) return true;
    if (flowchart.visibility === "shared") {
      if (flowchart.permissions) {
        try {
          const perms = typeof flowchart.permissions === 'string' ? JSON.parse(flowchart.permissions) : flowchart.permissions;
          if (perms && typeof perms === 'object' && userId in perms) return true;
        } catch { }
      }
    }
    return false;
  }

  // ============== AUTH ==============
  const loginSchema = z.object({
    email: z.string().email("Email inválido"),
    password: z.string().min(1, "Senha é obrigatória"),
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const loginBodySchema = z.object({
        email: z.string().email("Email inválido"),
        password: z.string().min(1, "Senha é obrigatória"),
        rememberMe: z.boolean().optional().default(false),
      });

      const validated = loginBodySchema.parse(req.body);
      console.log(`[auth] Login attempt for: ${validated.email}, rememberMe: ${validated.rememberMe}`);
      const users = await storage.getUsers();
      const user = users.find(u => u.email.toLowerCase() === validated.email.toLowerCase());

      if (!user) {
        console.log(`[auth] User not found: ${validated.email}`);
        return res.status(401).json({ success: false, message: "Credenciais inválidas" });
      }

      console.log(`[auth] User found: ${user.email}, status: ${user.status}, isAdmin: ${user.isAdmin}`);
      if (user.password !== validated.password) {
        console.log(`[auth] Password mismatch for: ${user.email}`);
        return res.status(401).json({ success: false, message: "Credenciais inválidas" });
      }

      if (user.status !== "active") {
        console.log(`[auth] User inactive: ${user.email}`);
        return res.status(401).json({ success: false, message: "Sua conta está inativa. Entre em contato com o administrador." });
      }

      console.log(`[auth] Login successful for: ${user.email}, isAdmin: ${user.isAdmin}`);

      req.session.userId = user.id;
      req.session.isAdmin = user.isAdmin === true;

      if (validated.rememberMe) {
        // Set session to 30 days if rememberMe is checked
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      } else {
        // Default session (e.g., 24 hours or browser close depending on store config)
        req.session.cookie.maxAge = 24 * 60 * 60 * 1000;
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          modulePermissions: user.modulePermissions,
          isAdmin: user.isAdmin === true,
          status: user.status,
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: "Dados inválidos", details: error.errors });
      }
      console.error("[auth] Login error:", error);
      res.status(500).json({ success: false, message: "Erro interno" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ authenticated: false });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.status !== "active") {
      req.session.destroy(() => { });
      return res.status(401).json({ authenticated: false });
    }
    res.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        modulePermissions: user.modulePermissions,
        isAdmin: user.isAdmin === true,
        status: user.status,
      },
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao fazer logout" });
      }
      res.clearCookie("renov.sid");
      res.json({ success: true });
    });
  });

  // ============== FORGOT PASSWORD ==============
  const forgotPasswordSchema = z.object({
    email: z.string().email("Email inválido"),
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const validated = forgotPasswordSchema.parse(req.body);
      console.log(`[auth] Password reset request for: ${validated.email}`);
      const users = await storage.getUsers();
      const user = users.find(u => u.email.toLowerCase() === validated.email.toLowerCase());

      if (!user) {
        console.log(`[auth] Password reset - user not found: ${validated.email}`);
        return res.json({ success: true, message: "Se o email estiver cadastrado, você receberá uma nova senha temporária." });
      }

      if (user.status !== "active") {
        console.log(`[auth] Password reset - user inactive: ${validated.email}`);
        return res.json({ success: true, message: "Se o email estiver cadastrado, você receberá uma nova senha temporária." });
      }

      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      let temporaryPassword = "";
      for (let i = 0; i < 8; i++) {
        temporaryPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      await storage.updateUser(user.id, { password: temporaryPassword });
      console.log(`[auth] Temporary password set for: ${validated.email}`);

      try {
        await sendPasswordResetEmail(user, temporaryPassword);
        console.log(`[auth] Password reset email sent to: ${validated.email}`);
      } catch (emailError) {
        console.error(`[auth] Failed to send password reset email:`, emailError);
        return res.status(500).json({ success: false, message: "Erro ao enviar o email. Tente novamente mais tarde." });
      }

      res.json({ success: true, message: "Se o email estiver cadastrado, você receberá uma nova senha temporária." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: "Email inválido" });
      }
      console.error("[auth] Password reset error:", error);
      res.status(500).json({ success: false, message: "Erro interno. Tente novamente mais tarde." });
    }
  });

  // ============== DASHBOARD STATS ==============
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const [tickets, projects, tasks, objectives, shipments, metas, pricingAlerts, knowledgeDocs] = await Promise.all([
        storage.getTickets(),
        storage.getProjects(),
        storage.getTasks({}),
        storage.getObjectives(),
        storage.getShipments(),
        storage.getMetas({}),
        storage.getPricingAlerts(),
        storage.getKnowledgeDocuments({ status: "aprovado" }),
      ]);

      if (isAdmin) {
        const openTickets = tickets.filter(t => t.status !== "closed").length;
        const activeProjects = projects.length;
        const pendingTasks = tasks.filter(t => t.type !== "meeting_note" && t.status !== "completed" && t.status !== "archived").length;
        const scheduledMeetings = tasks.filter(t => t.type === "meeting_note" && t.status !== "completed" && t.status !== "archived").length;
        const activeObjectives = objectives.length;
        const inTransitShipments = shipments.filter(s => s.status === "in_transit").length;
        const activeMetas = metas.filter(m => m.status !== "completed").length;
        const activeAlerts = pricingAlerts.filter(a => a.isActive).length;
        const approvedDocs = knowledgeDocs.length;

        return res.json({
          tickets: openTickets,
          projects: activeProjects,
          tasks: pendingTasks,
          meetings: scheduledMeetings,
          objectives: activeObjectives,
          logistica: inTransitShipments,
          metas: activeMetas,
          pricing: activeAlerts,
          conhecimento: approvedDocs,
        });
      }

      const userTickets = tickets.filter(t => t.requesterId === userId || t.assigneeId === userId);
      const openTickets = userTickets.filter(t => t.status !== "closed").length;

      const accessibleProjectIds = await getUserAccessibleProjectIds(userId);
      const activeProjects = accessibleProjectIds.length;

      const accessibleAreaIds = await getUserAccessibleAreaIds(userId);
      const userTasks = tasks.filter(t => !t.tagId || accessibleAreaIds.includes(t.tagId));
      const pendingTasks = userTasks.filter(t => t.type !== "meeting_note" && t.status !== "completed" && t.status !== "archived").length;
      const scheduledMeetings = userTasks.filter(t => t.type === "meeting_note" && t.status !== "completed" && t.status !== "archived").length;

      const keyResults = await storage.getKeyResults();
      const userObjectives = objectives.filter(obj => {
        if (obj.ownerId === userId) return true;
        return keyResults.some(kr => { if (kr.objectiveId !== obj.id) return false; try { const ids = typeof kr.responsibleIds === 'string' ? JSON.parse(kr.responsibleIds) : kr.responsibleIds; return Array.isArray(ids) && ids.includes(userId); } catch { return false; } });
      });
      const activeObjectives = userObjectives.length;

      const inTransitShipments = shipments.filter(s => s.status === "in_transit").length;
      const userMetas = metas.filter(m => m.responsibleId === userId);
      const activeMetas = userMetas.filter(m => m.status !== "completed").length;
      const activeAlerts = pricingAlerts.filter(a => a.isActive).length;
      const approvedDocs = knowledgeDocs.length;

      res.json({
        tickets: openTickets,
        projects: activeProjects,
        tasks: pendingTasks,
        meetings: scheduledMeetings,
        objectives: activeObjectives,
        logistica: inTransitShipments,
        metas: activeMetas,
        pricing: activeAlerts,
        conhecimento: approvedDocs,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // ============== USERS ==============
  app.get("/api/users", async (req, res) => {
    const users = await storage.getUsers();
    res.json(users);
  });

  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  });

  app.post("/api/users", async (req, res) => {
    try {
      const validated = insertUserSchema.parse(req.body);
      const user = await storage.createUser(validated);

      // Enviar e-mail de convite
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const info = await transporter.sendMail({
          from: `"Renov Home" <${process.env.SMTP_USER}>`,
          to: user.email,
          subject: "Bem-vindo ao Renov Home - Acesso ao Sistema",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
              <h2 style="color: #00A137;">Bem-vindo ao Renov Home</h2>
              <p>Olá <strong>${user.name}</strong>,</p>
              <p>Você foi cadastrado na plataforma interna de gestão da Renov.</p>
              <p>Abaixo estão suas informações de acesso:</p>
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Link:</strong> <a href="https://home.renovsmart.com.br/" style="color: #00A137;">home.renovsmart.com.br</a></p>
                <p style="margin: 5px 0 0 0;"><strong>E-mail:</strong> ${user.email}</p>
                <p style="margin: 5px 0 0 0;"><strong>Senha inicial:</strong> ${validated.password}</p>
              </div>
              <p>Recomendamos que você altere sua senha após o primeiro acesso.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 12px; color: #777;">Este é um e-mail automático, por favor não responda.</p>
            </div>
          `,
        });
        console.log("Email de convite enviado: %s", info.messageId);
      } catch (emailError) {
        console.error("Erro ao enviar email de convite:", emailError);
      }

      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const partialSchema = insertUserSchema.partial();
      const validated = partialSchema.parse(req.body);
      const user = await storage.updateUser(req.params.id, validated);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update user" });
    }
  });

  app.post("/api/users/:id/reset-password", async (req, res) => {
    try {
      const { isAdmin } = getSessionUser(req);
      if (!isAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }

      const user = await storage.getUser(req.params.id);
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

  // ============== TICKETS ==============
  app.get("/api/tickets", async (req, res) => {
    const tickets = await storage.getTickets();
    res.json(tickets);
  });

  app.get("/api/tickets/:id", async (req, res) => {
    const ticket = await storage.getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    res.json(ticket);
  });

  app.post("/api/tickets", async (req, res) => {
    try {
      const data = { ...req.body };
      // Preencher solicitante automaticamente se não enviado
      if (!data.requesterId && req.user) {
        data.requesterId = req.user.id;
      }
      const validated = insertTicketSchema.parse(data);

      if (!validated.assigneeId && validated.category && validated.type) {
        const autoAssignee = await storage.findResponsavelForTicket(validated.category, validated.type);
        if (autoAssignee) {
          validated.assigneeId = autoAssignee;
        }
      }

      const ticket = await storage.createTicket(validated);

      const requester = await storage.getUser(ticket.requesterId);
      const assignee = ticket.assigneeId ? await storage.getUser(ticket.assigneeId) : null;

      if (requester) {
        sendTicketCreatedEmail(ticket, requester, assignee || null).catch(console.error);
      }

      if (assignee && assignee.id !== ticket.requesterId) {
        sendTicketAssignedEmail(ticket, assignee).catch(console.error);
      }

      if (ticket.assigneeId && ticket.assigneeId !== ticket.requesterId) {
        storage.createNotification({
          userId: ticket.assigneeId,
          fromUserId: ticket.requesterId,
          title: "Novo chamado atribuído",
          message: `O chamado "${ticket.title}" (${ticket.code}) foi criado e atribuído a você`,
          module: "chamados",
          entityId: ticket.id,
          linkUrl: `/chamados?ticket=${ticket.id}`,
        }).catch(console.error);
      }

      res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create ticket" });
    }
  });

  app.patch("/api/tickets/:id", async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const oldTicket = await storage.getTicket(req.params.id);
      if (!oldTicket) return res.status(404).json({ error: "Ticket not found" });
      if (!isAdmin && oldTicket.requesterId !== userId && oldTicket.assigneeId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Auto-fill timestamp fields based on status changes
      const updateData: any = { ...req.body };
      if (req.body.status && req.body.status !== oldTicket.status) {
        if (req.body.status === "resolved" && !oldTicket.dataResolucao) {
          updateData.dataResolucao = new Date();
        }
        if (req.body.status === "closed" && !oldTicket.dataFechamento) {
          updateData.dataFechamento = new Date();
        }
      }

      // Handle date conversion for audit fields if present
      if (updateData.descriptionLastEditedAt) {
        updateData.descriptionLastEditedAt = new Date(updateData.descriptionLastEditedAt);
      }

      console.log("Updating ticket with data:", JSON.stringify(updateData, null, 2));

      const ticket = await storage.updateTicket(req.params.id, updateData);
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      if (req.body.status && req.body.status !== oldTicket.status) {
        const requester = await storage.getUser(ticket.requesterId);
        const assignee = ticket.assigneeId ? await storage.getUser(ticket.assigneeId) : null;
        if (requester) {
          sendTicketStatusChangedEmail(ticket, oldTicket.status, req.body.status, requester, assignee || null).catch(console.error);
        }
        const statusLabels: Record<string, string> = { open: "Aberto", in_progress: "Em andamento", resolved: "Resolvido", closed: "Fechado", pending: "Pendente" };
        const statusLabel = statusLabels[req.body.status] || req.body.status;
        if (ticket.requesterId) {
          storage.createNotification({
            userId: ticket.requesterId,
            title: "Status do chamado alterado",
            message: `O chamado "${ticket.title}" (${ticket.code || ''}) mudou para "${statusLabel}"`,
            module: "chamados",
            entityId: ticket.id,
            linkUrl: `/chamados?ticket=${ticket.id}`,
          }).catch(console.error);
        }
      }

      if (req.body.assigneeId && req.body.assigneeId !== oldTicket.assigneeId) {
        const assignee = await storage.getUser(req.body.assigneeId);
        if (assignee) {
          sendTicketAssignedEmail(ticket, assignee).catch(console.error);
        }
        storage.createNotification({
          userId: req.body.assigneeId,
          title: "Chamado atribuído a você",
          message: `O chamado "${ticket.title}" (${ticket.code || ''}) foi atribuído a você`,
          module: "chamados",
          entityId: ticket.id,
          linkUrl: `/chamados?ticket=${ticket.id}`,
        }).catch(console.error);
      }

      res.json(ticket);
    } catch (error) {
      console.error("Error updating ticket:", error);
      res.status(400).json({ error: "Failed to update ticket" });
    }
  });

  app.delete("/api/tickets/:id", async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    const ticket = await storage.getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (!isAdmin && ticket.requesterId !== userId && ticket.assigneeId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const deleted = await storage.deleteTicket(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Ticket not found" });
    res.status(204).send();
  });

  // Ticket Comments
  app.get("/api/tickets/:id/comments", async (req, res) => {
    const comments = await storage.getTicketComments(req.params.id);
    res.json(comments);
  });

  app.post("/api/tickets/:id/comments", async (req, res) => {
    try {
      const validated = insertTicketCommentSchema.parse({
        ...req.body,
        ticketId: req.params.id,
      });
      const comment = await storage.createTicketComment(validated);

      const ticket = await storage.getTicket(req.params.id);
      if (ticket) {
        // Set first response timestamp if assignee comments and it's not set yet
        if (ticket.assigneeId && comment.userId === ticket.assigneeId && !ticket.dataPrimeiraResposta) {
          await storage.updateTicket(ticket.id, { dataPrimeiraResposta: new Date() });
        }

        const commenter = await storage.getUser(comment.userId);
        const requester = await storage.getUser(ticket.requesterId);
        const assignee = ticket.assigneeId ? await storage.getUser(ticket.assigneeId) : null;

        if (commenter && requester) {
          sendTicketCommentEmail(ticket, comment, commenter, requester, assignee || null).catch(console.error);
        }

        if (requester && commenter && commenter.id !== requester.id) {
          storage.createNotification({
            userId: requester.id,
            fromUserId: commenter.id,
            title: "Novo comentário no chamado",
            message: `${commenter.name} comentou no chamado "${ticket.title}"`,
            module: "chamados",
            entityId: ticket.id,
            linkUrl: `/chamados?ticket=${ticket.id}`,
          }).catch(console.error);
        }
        if (assignee && commenter && commenter.id !== assignee.id && assignee.id !== requester?.id) {
          storage.createNotification({
            userId: assignee.id,
            fromUserId: commenter.id,
            title: "Novo comentário no chamado",
            message: `${commenter.name} comentou no chamado "${ticket.title}"`,
            module: "chamados",
            entityId: ticket.id,
            linkUrl: `/chamados?ticket=${ticket.id}`,
          }).catch(console.error);
        }

        // Process @mentions and send notifications
        const mentionMatches = validated.content.match(/@(\w+(?:\s+\w+)?)/g);
        if (mentionMatches) {
          const users = await storage.getUsers();

          for (const mention of mentionMatches) {
            const mentionedName = mention.slice(1).trim();
            const mentionedUser = users.find(u =>
              u.name.toLowerCase() === mentionedName.toLowerCase() && u.status === "active"
            );

            if (mentionedUser && commenter) {
              sendMentionNotificationEmail(
                mentionedUser,
                commenter.name,
                ticket.title,
                ticket.id,
                validated.content
              ).catch(console.error);
              storage.createNotification({
                userId: mentionedUser.id,
                fromUserId: commenter.id,
                title: "Menção em chamado",
                message: `${commenter.name} mencionou você em um comentário no chamado "${ticket.title}"`,
                module: "chamados",
                entityId: ticket.id,
                linkUrl: `/chamados?ticket=${ticket.id}`,
              }).catch(console.error);
            }
          }
        }
      }

      res.status(201).json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create comment" });
    }
  });

  // ============== TICKET RESPONSAVEIS (Assignment Rules) ==============
  app.get("/api/ticket-responsaveis", async (req, res) => {
    const responsaveis = await storage.getTicketResponsaveis();
    res.json(responsaveis);
  });

  app.get("/api/ticket-responsaveis/:id", async (req, res) => {
    const responsavel = await storage.getTicketResponsavel(req.params.id);
    if (!responsavel) return res.status(404).json({ error: "Responsavel not found" });
    res.json(responsavel);
  });

  app.post("/api/ticket-responsaveis", async (req, res) => {
    try {
      const validated = insertTicketResponsavelSchema.parse(req.body);
      const responsavel = await storage.createTicketResponsavel(validated);
      res.status(201).json(responsavel);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create responsavel" });
    }
  });

  app.patch("/api/ticket-responsaveis/:id", async (req, res) => {
    try {
      const partialSchema = insertTicketResponsavelSchema.partial();
      const validated = partialSchema.parse(req.body);
      const responsavel = await storage.updateTicketResponsavel(req.params.id, validated);
      if (!responsavel) return res.status(404).json({ error: "Responsavel not found" });
      res.json(responsavel);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update responsavel" });
    }
  });

  app.delete("/api/ticket-responsaveis/:id", async (req, res) => {
    const deleted = await storage.deleteTicketResponsavel(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Responsavel not found" });
    res.status(204).send();
  });

  app.get("/api/ticket-responsaveis/find/:categoria/:tipo", async (req, res) => {
    const responsavelId = await storage.findResponsavelForTicket(req.params.categoria, req.params.tipo);
    res.json({ responsavelId });
  });

  // ============== PROJECTS ==============
  app.get("/api/projects", async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    const projects = await storage.getProjects();
    if (isAdmin) return res.json(projects);
    const accessibleIds = await getUserAccessibleProjectIds(userId);
    const filtered = projects.filter(p => accessibleIds.includes(p.id));
    res.json(filtered);
  });

  app.get("/api/projects/:id", async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!isAdmin) {
      const accessibleIds = await getUserAccessibleProjectIds(userId);
      if (!accessibleIds.includes(project.id)) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    res.json(project);
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const { memberIds, ...projectData } = req.body;
      const validated = insertProjectSchema.parse(projectData);
      const project = await storage.createProject(validated);

      if (memberIds && Array.isArray(memberIds) && memberIds.length > 0 && validated.visibility === "shared") {
        for (const uid of memberIds) {
          try {
            await storage.addProjectMember({ projectId: project.id, userId: uid, role: "member" });
          } catch (e) {
            console.error(`Error adding member ${uid} to project ${project.id}:`, e);
          }
        }
      }

      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const existing = await storage.getProject(req.params.id);
      if (!existing) return res.status(404).json({ error: "Project not found" });
      if (!isAdmin && existing.ownerId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { memberIds, ...projectData } = req.body;
      const partialSchema = insertProjectSchema.partial();
      const validated = partialSchema.parse(projectData);
      const project = await storage.updateProject(req.params.id, validated);
      if (!project) return res.status(404).json({ error: "Project not found" });

      if (memberIds && Array.isArray(memberIds) && (validated.visibility === "shared" || existing.visibility === "shared")) {
        const currentMembers = await storage.getProjectMembers(req.params.id);
        const currentMemberIds = new Set(currentMembers.map(m => m.userId));
        const newMemberIds = new Set(memberIds as string[]);

        for (const uid of memberIds) {
          if (!currentMemberIds.has(uid)) {
            await storage.addProjectMember({ projectId: req.params.id, userId: uid, role: "member" });
          }
        }
        for (const member of currentMembers) {
          if (!newMemberIds.has(member.userId)) {
            await storage.removeProjectMember(member.id);
          }
        }
      }

      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!isAdmin && project.ownerId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const deleted = await storage.deleteProject(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Project not found" });
    res.status(204).send();
  });

  // Project Members
  app.get("/api/projects/:id/members", async (req, res) => {
    const members = await storage.getProjectMembers(req.params.id);
    res.json(members);
  });

  app.post("/api/projects/:id/members", async (req, res) => {
    try {
      const { userId: uid, role } = req.body;
      const member = await storage.addProjectMember({ projectId: req.params.id, userId: uid, role: role || "member" });
      res.status(201).json(member);
    } catch (error) {
      res.status(400).json({ error: "Failed to add member" });
    }
  });

  app.delete("/api/projects/:id/members/:memberId", async (req, res) => {
    const deleted = await storage.removeProjectMember(req.params.memberId);
    if (!deleted) return res.status(404).json({ error: "Member not found" });
    res.status(204).send();
  });

  // Project Columns
  app.get("/api/projects/:id/columns", async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    if (!isAdmin) {
      const accessibleIds = await getUserAccessibleProjectIds(userId);
      if (!accessibleIds.includes(req.params.id)) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    const columns = await storage.getKanbanColumns(req.params.id);
    res.json(columns);
  });

  // Project Cards
  app.get("/api/projects/:id/cards", async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    if (!isAdmin) {
      const accessibleIds = await getUserAccessibleProjectIds(userId);
      if (!accessibleIds.includes(req.params.id)) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    const cards = await storage.getKanbanCards(req.params.id);
    res.json(cards);
  });

  // ============== KANBAN COLUMNS ==============
  app.post("/api/columns", async (req, res) => {
    try {
      const validated = insertKanbanColumnSchema.parse(req.body);
      const column = await storage.createKanbanColumn(validated);
      res.status(201).json(column);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create column" });
    }
  });

  app.patch("/api/columns/:id", async (req, res) => {
    try {
      const partialSchema = insertKanbanColumnSchema.partial();
      const validated = partialSchema.parse(req.body);
      const column = await storage.updateKanbanColumn(req.params.id, validated);
      if (!column) return res.status(404).json({ error: "Column not found" });
      res.json(column);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update column" });
    }
  });


  app.delete("/api/columns/:id", async (req, res) => {
    const deleted = await storage.deleteKanbanColumn(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Column not found" });
    res.status(204).send();
  });

  // ============== KANBAN CARDS ==============
  app.get("/api/cards/:id", async (req, res) => {
    const card = await storage.getKanbanCard(req.params.id);
    if (!card) return res.status(404).json({ error: "Card not found" });
    res.json(card);
  });

  app.post("/api/cards", async (req, res) => {
    try {
      const validated = insertKanbanCardSchema.parse(req.body);
      const card = await storage.createKanbanCard(validated);

      const cardCreatorId = req.body.createdBy || req.body.reporterId;
      if (card.assigneeId && card.assigneeId !== cardCreatorId) {
        const creator = cardCreatorId ? await storage.getUser(cardCreatorId) : null;
        storage.createNotification({
          userId: card.assigneeId,
          fromUserId: cardCreatorId || undefined,
          title: "Novo card atribuído",
          message: `${creator?.name || 'Alguém'} atribuiu o card "${card.title}" a você`,
          module: "projetos",
          entityId: card.id,
          linkUrl: `/projetos/${card.projectId}`,
        }).catch(console.error);
      }
      if (card.reporterId && card.reporterId !== cardCreatorId && card.reporterId !== card.assigneeId) {
        const creator = cardCreatorId ? await storage.getUser(cardCreatorId) : null;
        storage.createNotification({
          userId: card.reporterId,
          fromUserId: cardCreatorId || undefined,
          title: "Você foi definido como relator",
          message: `${creator?.name || 'Alguém'} definiu você como relator do card "${card.title}"`,
          module: "projetos",
          entityId: card.id,
          linkUrl: `/projetos/${card.projectId}`,
        }).catch(console.error);
      }

      res.status(201).json(card);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create card" });
    }
  });

  app.patch("/api/cards/:id", async (req, res) => {
    try {
      const oldCard = await storage.getKanbanCard(req.params.id);
      const partialSchema = insertKanbanCardSchema.partial();
      const validated = partialSchema.parse(req.body);
      const card = await storage.updateKanbanCard(req.params.id, validated);
      if (!card) return res.status(404).json({ error: "Card not found" });

      const updatedBy = req.body.updatedBy || oldCard?.reporterId;
      if (validated.assigneeId && card.assigneeId && card.assigneeId !== oldCard?.assigneeId && card.assigneeId !== updatedBy) {
        const updater = updatedBy ? await storage.getUser(updatedBy) : null;
        storage.createNotification({
          userId: card.assigneeId,
          fromUserId: updatedBy || undefined,
          title: "Card atribuído a você",
          message: `${updater?.name || 'Alguém'} atribuiu o card "${card.title}" a você`,
          module: "projetos",
          entityId: card.id,
          linkUrl: `/projetos/${card.projectId}`,
        }).catch(console.error);
      }
      if (validated.reporterId && card.reporterId && card.reporterId !== oldCard?.reporterId && card.reporterId !== updatedBy && card.reporterId !== card.assigneeId) {
        const updater = updatedBy ? await storage.getUser(updatedBy) : null;
        storage.createNotification({
          userId: card.reporterId,
          fromUserId: updatedBy || undefined,
          title: "Você foi definido como relator",
          message: `${updater?.name || 'Alguém'} definiu você como relator do card "${card.title}"`,
          module: "projetos",
          entityId: card.id,
          linkUrl: `/projetos/${card.projectId}`,
        }).catch(console.error);
      }

      res.json(card);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update card" });
    }
  });

  app.delete("/api/cards/:id", async (req, res) => {
    const deleted = await storage.deleteKanbanCard(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Card not found" });
    res.status(204).send();
  });

  // Kanban Comments
  app.get("/api/cards/:id/comments", async (req, res) => {
    const comments = await storage.getKanbanComments(req.params.id);
    res.json(comments);
  });

  app.post("/api/cards/:id/comments", async (req, res) => {
    try {
      const validated = insertKanbanCommentSchema.parse({
        ...req.body,
        cardId: req.params.id,
      });
      const comment = await storage.createKanbanComment(validated);

      // Process @mentions and send notifications
      const mentionMatches = validated.content.match(/@(\w+(?:\s+\w+)?)/g);
      if (mentionMatches) {
        const card = await storage.getKanbanCard(req.params.id);
        const users = await storage.getUsers();
        const author = await storage.getUser(validated.userId);

        for (const mention of mentionMatches) {
          const mentionedName = mention.slice(1).trim();
          const mentionedUser = users.find(u =>
            u.name.toLowerCase() === mentionedName.toLowerCase() && u.status === "active"
          );

          if (mentionedUser && card && author) {
            sendMentionNotificationEmail(
              mentionedUser,
              author.name,
              card.title,
              card.id,
              validated.content
            ).catch(console.error);
            storage.createNotification({
              userId: mentionedUser.id,
              fromUserId: author.id,
              title: "Menção em card",
              message: `${author.name} mencionou você em um comentário no card "${card.title}"`,
              module: "projetos",
              entityId: card.id,
              linkUrl: `/projetos/${card.projectId}`,
            }).catch(console.error);
          }
        }
      }

      res.status(201).json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create comment" });
    }
  });

  // ============== OKRs ==============
  app.get("/api/objectives", async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const objectives = await storage.getObjectives();
      if (isAdmin) return res.json(objectives);
      const keyResults = await storage.getKeyResults();
      const filtered = objectives.filter(obj => {
        if (obj.ownerId === userId) return true;
        return keyResults.some(kr => { if (kr.objectiveId !== obj.id) return false; try { const ids = typeof kr.responsibleIds === 'string' ? JSON.parse(kr.responsibleIds) : kr.responsibleIds; return Array.isArray(ids) && ids.includes(userId); } catch { return false; } });
      });
      res.json(filtered);
    } catch (error) {
      console.error("Error fetching objectives:", error);
      res.status(500).json({ error: "Failed to fetch objectives" });
    }
  });

  app.get("/api/objectives/:id", async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const objective = await storage.getObjective(req.params.id);
      if (!objective) return res.status(404).json({ error: "Objective not found" });
      if (!isAdmin && objective.ownerId !== userId) {
        const keyResults = await storage.getKeyResults();
        const hasAccess = keyResults.some(kr => { if (kr.objectiveId !== objective.id) return false; try { const ids = typeof kr.responsibleIds === 'string' ? JSON.parse(kr.responsibleIds) : kr.responsibleIds; return Array.isArray(ids) && ids.includes(userId); } catch { return false; } });
        if (!hasAccess) return res.status(403).json({ error: "Access denied" });
      }
      res.json(objective);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch objective" });
    }
  });

  app.post("/api/objectives", async (req, res) => {
    try {
      const validated = insertObjectiveSchema.parse(req.body);
      const objective = await storage.createObjective(validated);
      res.status(201).json(objective);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create objective" });
    }
  });

  app.patch("/api/objectives/:id", async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const existing = await storage.getObjective(req.params.id);
      if (!existing) return res.status(404).json({ error: "Objective not found" });
      if (!isAdmin && existing.ownerId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const partialSchema = insertObjectiveSchema.partial();
      const validated = partialSchema.parse(req.body);
      const objective = await storage.updateObjective(req.params.id, validated);
      if (!objective) return res.status(404).json({ error: "Objective not found" });
      res.json(objective);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update objective" });
    }
  });

  app.delete("/api/objectives/:id", async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    const objective = await storage.getObjective(req.params.id);
    if (!objective) return res.status(404).json({ error: "Objective not found" });
    if (!isAdmin && objective.ownerId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const deleted = await storage.deleteObjective(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Objective not found" });
    res.status(204).send();
  });

  // ============== KEY RESULTS ==============
  app.get("/api/key-results", async (req, res) => {
    const keyResults = await storage.getKeyResults();
    res.json(keyResults);
  });

  app.post("/api/key-results", async (req, res) => {
    try {
      const validated = insertKeyResultSchema.parse(req.body);
      const kr = await storage.createKeyResult(validated);
      res.status(201).json(kr);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create key result" });
    }
  });

  app.patch("/api/key-results/:id", async (req, res) => {
    try {
      const partialSchema = insertKeyResultSchema.partial();
      const validated = partialSchema.parse(req.body);
      const kr = await storage.updateKeyResult(req.params.id, validated);
      if (!kr) return res.status(404).json({ error: "Key result not found" });
      res.json(kr);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update key result" });
    }
  });

  app.get("/api/key-results/:id", async (req, res) => {
    const kr = await storage.getKeyResult(req.params.id);
    if (!kr) return res.status(404).json({ error: "Key result not found" });
    res.json(kr);
  });

  app.delete("/api/key-results/:id", async (req, res) => {
    const deleted = await storage.deleteKeyResult(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Key result not found" });
    res.status(204).send();
  });

  // ============== KEY RESULT UPDATES (Check-ins) ==============
  app.get("/api/key-results/:id/updates", async (req, res) => {
    const updates = await storage.getKeyResultUpdates(req.params.id);
    const users = await storage.getUsers();

    const updatesWithUser = updates.map(update => ({
      ...update,
      user: users.find(u => u.id === update.userId)
    }));

    res.json(updatesWithUser);
  });

  app.post("/api/key-results/:id/updates", async (req, res) => {
    try {
      const kr = await storage.getKeyResult(req.params.id);
      if (!kr) return res.status(404).json({ error: "Key result not found" });

      const validated = insertKeyResultUpdateSchema.parse({
        ...req.body,
        keyResultId: req.params.id,
        previousValue: kr.currentValue,
      });

      // Calculate progress percentage based on measurement type
      const startVal = parseFloat(kr.startValue || "0");
      const targetVal = parseFloat(kr.targetValue || "100");
      const newVal = parseFloat(validated.newValue || "0");

      let progressPercentage: number;
      if (kr.measurementType === "decreasing") {
        // For decreasing: progress = (start - current) / (start - target) * 100
        progressPercentage = targetVal !== startVal ? ((startVal - newVal) / (startVal - targetVal)) * 100 : 0;
      } else if (kr.measurementType === "binary") {
        // For binary: 0 or 100
        progressPercentage = newVal > 0 ? 100 : 0;
      } else {
        // For percentage, absolute, monetary, temporal
        progressPercentage = targetVal !== startVal ? ((newVal - startVal) / (targetVal - startVal)) * 100 : 0;
      }

      // Clamp between 0 and 100
      progressPercentage = Math.max(0, Math.min(100, progressPercentage));

      const updateData = {
        ...validated,
        progressPercentage: String(progressPercentage),
      };

      const update = await storage.createKeyResultUpdate(updateData);

      // Update the key result current value and deadline status
      const now = new Date();
      let deadlineStatus = kr.deadlineStatus;
      if (kr.dueDate) {
        const dueDate = new Date(kr.dueDate);
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilDue < 0) {
          deadlineStatus = "overdue";
        } else if (daysUntilDue <= 7) {
          deadlineStatus = "at_risk";
        } else {
          deadlineStatus = "on_track";
        }
      }

      await storage.updateKeyResult(req.params.id, {
        currentValue: validated.newValue,
        deadlineStatus,
      });

      res.status(201).json(update);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating key result update:", error);
      res.status(400).json({ error: "Failed to create key result update" });
    }
  });

  // ============== SHIPMENTS ==============
  app.get("/api/shipments", async (req, res) => {
    const shipments = await storage.getShipments();
    res.json(shipments);
  });

  app.get("/api/shipments/:id", async (req, res) => {
    const shipment = await storage.getShipment(req.params.id);
    if (!shipment) return res.status(404).json({ error: "Shipment not found" });
    res.json(shipment);
  });

  app.post("/api/shipments", async (req, res) => {
    try {
      const validated = insertShipmentSchema.parse(req.body);
      const shipment = await storage.createShipment(validated);
      res.status(201).json(shipment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create shipment" });
    }
  });

  app.patch("/api/shipments/:id", async (req, res) => {
    try {
      const partialSchema = insertShipmentSchema.partial();
      const validated = partialSchema.parse(req.body);
      const shipment = await storage.updateShipment(req.params.id, validated);
      if (!shipment) return res.status(404).json({ error: "Shipment not found" });
      res.json(shipment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update shipment" });
    }
  });

  app.delete("/api/shipments/:id", async (req, res) => {
    const deleted = await storage.deleteShipment(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Shipment not found" });
    res.status(204).send();
  });

  // Shipment Events
  app.get("/api/shipments/:id/events", async (req, res) => {
    const events = await storage.getShipmentEvents(req.params.id);
    res.json(events);
  });

  app.post("/api/shipments/:id/events", async (req, res) => {
    try {
      const validated = insertShipmentEventSchema.parse({
        ...req.body,
        shipmentId: req.params.id,
      });
      const event = await storage.createShipmentEvent(validated);
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create event" });
    }
  });

  // ============== SETTINGS ==============
  app.get("/api/settings", async (req, res) => {
    const settings = await storage.getSettings();
    res.json(settings);
  });

  app.get("/api/settings/:key", async (req, res) => {
    try {
      const setting = await storage.getSetting(req.params.key);
      if (!setting) return res.status(404).json({ error: "Setting not found" });
      res.json(setting);
    } catch (error) {
      console.error(`Error fetching setting ${req.params.key}:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const schema = z.object({
        key: z.string().min(1),
        value: z.string(),
      });
      const { key, value } = schema.parse(req.body);
      const setting = await storage.setSetting(key, value);
      res.status(201).json(setting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error saving setting:", error);
      res.status(400).json({ error: "Failed to save setting" });
    }
  });

  // ============== TASK AREAS ==============
  app.get("/api/task-tags", async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    const scope = (req.query.scope as string) || undefined;
    const areas = await storage.getTaskAreas(userId);
    const filtered = scope ? areas.filter(a => a.scope === scope) : areas;
    res.json(filtered);
  });

  app.get("/api/task-tags/:id", async (req, res) => {
    const { userId } = getSessionUser(req);
    const area = await storage.getTaskArea(req.params.id);
    if (!area) return res.status(404).json({ error: "Area not found" });
    const accessibleIds = await getUserAccessibleAreaIds(userId);
    if (!accessibleIds.includes(area.id)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(area);
  });

  app.post("/api/task-tags", async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const { memberIds, ...areaData } = req.body;
      const validated = insertTaskAreaSchema.parse({ ...areaData, ownerId: userId });
      // Tarefas scope cannot have public visibility
      if (validated.scope === "tasks" && validated.visibility === "public") {
        return res.status(400).json({ error: "Tarefas não podem ter visibilidade pública" });
      }
      const area = await storage.createTaskArea(validated);

      // Process shared area members and send invites
      if (memberIds && Array.isArray(memberIds) && memberIds.length > 0 && validated.visibility === "shared") {
        const owner = await storage.getUser(validated.ownerId);

        for (const userId of memberIds) {
          try {
            // Create area member
            await storage.addTaskAreaMember({
                tagId: area.id,
              userId,
              role: "member"
            });

            const member = await storage.getUser(userId);
            if (member && owner) {
              sendSharedAreaInviteEmail(
                member,
                area.name,
                area.id,
                owner.name
              ).catch(err => console.error(`[api/task-areas] Error sending email to ${member.email}:`, err));

              storage.createNotification({
                userId,
                fromUserId: validated.ownerId,
                title: "Nova área compartilhada",
                message: `${owner.name} compartilhou a área "${area.name}" com você`,
                module: "tarefas",
                entityId: area.id,
                linkUrl: `/tarefas?area=${area.id}`,
              }).catch(console.error);
            }
          } catch (memberError) {
            console.error(`[api/task-areas] Error adding member ${userId} to area ${area.id}:`, memberError);
          }
        }
      }

      res.status(201).json(area);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create area" });
    }
  });

  app.put("/api/task-tags/:id", async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const existing = await storage.getTaskArea(req.params.id);
      if (!existing) return res.status(404).json({ error: "Area not found" });
      if (!isAdmin && existing.ownerId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { memberIds, ...areaData } = req.body;
      const partialSchema = insertTaskAreaSchema.partial();
      const validated = partialSchema.parse(areaData);
      // Tarefas scope cannot have public visibility
      const effectiveScope = validated.scope || existing.scope;
      const effectiveVisibility = validated.visibility || existing.visibility;
      if (effectiveScope === "tasks" && effectiveVisibility === "public") {
        return res.status(400).json({ error: "Tarefas não podem ter visibilidade pública" });
      }
      const area = await storage.updateTaskArea(req.params.id, validated);
      if (!area) return res.status(404).json({ error: "Area not found" });

      // Process shared area members on update
      if (memberIds && Array.isArray(memberIds) && validated.visibility === "shared") {
        const owner = await storage.getUser(area.ownerId);
        const currentMembers = await storage.getTaskAreaMembers(area.id);
        const currentMemberUserIds = currentMembers.map(m => m.userId);

        for (const userId of memberIds) {
          if (!currentMemberUserIds.includes(userId)) {
            try {
              // Add new member
              await storage.addTaskAreaMember({
                tagId: area.id,
                userId,
                userId,
                role: "member"
              });

              const member = await storage.getUser(userId);
              if (member && owner) {
                sendSharedAreaInviteEmail(
                  member,
                  area.name,
                  area.id,
                  owner.name
                ).catch(err => console.error(`[api/task-areas] Error sending email to ${member.email}:`, err));

                storage.createNotification({
                  userId,
                  fromUserId: area.ownerId,
                  title: "Nova área compartilhada",
                  message: `${owner.name} compartilhou a área "${area.name}" com você`,
                  module: "tarefas",
                  entityId: area.id,
                  linkUrl: `/tarefas?area=${area.id}`,
                }).catch(console.error);
              }
            } catch (memberError) {
              console.error(`[api/task-areas] Error adding member ${userId} to area ${area.id}:`, memberError);
            }
          }
        }

        // Optional: Remove members not in the new list
        for (const member of currentMembers) {
          if (!memberIds.includes(member.userId)) {
            await storage.removeTaskAreaMember(member.id);
          }
        }
      }

      res.json(area);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update area" });
    }
  });
  return httpServer;
}
