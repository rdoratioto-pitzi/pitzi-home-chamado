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
  sendSharedAreaInviteEmail
} from "./email-service";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import * as correiosService from "./correios-service";
import { streamChatCompletion, generateTitle } from "./openrouter";
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
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ============== AUTH ==============
  const loginSchema = z.object({
    email: z.string().email("Email inválido"),
    password: z.string().min(1, "Senha é obrigatória"),
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const validated = loginSchema.parse(req.body);
      console.log(`[auth] Login attempt for: ${validated.email}`);
      const users = await storage.getUsers();
      const user = users.find(u => u.email.toLowerCase() === validated.email.toLowerCase());
      
      if (!user) {
        console.log(`[auth] User not found: ${validated.email}`);
        return res.status(401).json({ success: false, message: "Credenciais inválidas" });
      }
      
      console.log(`[auth] User found: ${user.email}, status: ${user.status}, isAdmin: ${user.isAdmin}, password in DB: "${user.password}"`);
      if (user.password !== validated.password) {
        console.log(`[auth] Password mismatch for: ${user.email}. Expected: "${user.password}", Got: "${validated.password}"`);
        return res.status(401).json({ success: false, message: "Credenciais inválidas" });
      }
      
      if (user.status !== "active") {
        console.log(`[auth] User inactive: ${user.email}`);
        return res.status(401).json({ success: false, message: "Sua conta está inativa. Entre em contato com o administrador." });
      }
      
      console.log(`[auth] Login successful for: ${user.email}, isAdmin: ${user.isAdmin}`);
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
      res.status(500).json({ success: false, message: "Erro interno" });
    }
  });

  // ============== DASHBOARD STATS ==============
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
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

      const openTickets = tickets.filter(t => t.status !== "closed").length;
      const activeProjects = projects.length;
      const pendingTasks = tasks.filter(t => t.type !== "meeting_note" && t.status !== "completed" && t.status !== "archived").length;
      const scheduledMeetings = tasks.filter(t => t.type === "meeting_note" && t.status !== "completed" && t.status !== "archived").length;
      const activeObjectives = objectives.length;
      const inTransitShipments = shipments.filter(s => s.status === "in_transit").length;
      const activeMetas = metas.filter(m => m.status !== "completed").length;
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
                <p style="margin: 0;"><strong>Link:</strong> <a href="https://home.renovsmart.com.br" style="color: #00A137;">home.renovsmart.com.br</a></p>
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
      const validated = insertTicketSchema.parse(req.body);
      
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
      const oldTicket = await storage.getTicket(req.params.id);
      if (!oldTicket) return res.status(404).json({ error: "Ticket not found" });
      
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
      }
      
      if (req.body.assigneeId && req.body.assigneeId !== oldTicket.assigneeId) {
        const assignee = await storage.getUser(req.body.assigneeId);
        if (assignee) {
          sendTicketAssignedEmail(ticket, assignee).catch(console.error);
        }
      }
      
      res.json(ticket);
    } catch (error) {
      console.error("Error updating ticket:", error);
      res.status(400).json({ error: "Failed to update ticket" });
    }
  });

  app.delete("/api/tickets/:id", async (req, res) => {
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
    const projects = await storage.getProjects();
    res.json(projects);
  });

  app.get("/api/projects/:id", async (req, res) => {
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const validated = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(validated);
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
      const partialSchema = insertProjectSchema.partial();
      const validated = partialSchema.parse(req.body);
      const project = await storage.updateProject(req.params.id, validated);
      if (!project) return res.status(404).json({ error: "Project not found" });
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    const deleted = await storage.deleteProject(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Project not found" });
    res.status(204).send();
  });

  // Project Columns
  app.get("/api/projects/:id/columns", async (req, res) => {
    const columns = await storage.getKanbanColumns(req.params.id);
    res.json(columns);
  });

  // Project Cards
  app.get("/api/projects/:id/cards", async (req, res) => {
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

  app.patch("/api/columns/:id", async (req, res) => {
    try {
      const updated = await storage.updateKanbanColumn(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "Column not found" });
      res.json(updated);
    } catch (error) {
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
      const partialSchema = insertKanbanCardSchema.partial();
      const validated = partialSchema.parse(req.body);
      const card = await storage.updateKanbanCard(req.params.id, validated);
      if (!card) return res.status(404).json({ error: "Card not found" });
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
      const objectives = await storage.getObjectives();
      res.json(objectives);
    } catch (error) {
      console.error("Error fetching objectives:", error);
      res.status(500).json({ error: "Failed to fetch objectives" });
    }
  });

  app.get("/api/objectives/:id", async (req, res) => {
    try {
      const objective = await storage.getObjective(req.params.id);
      if (!objective) return res.status(404).json({ error: "Objective not found" });
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
  app.get("/api/task-areas", async (req, res) => {
    const userId = req.query.userId as string || "admin";
    const areas = await storage.getTaskAreas(userId);
    res.json(areas);
  });

  app.get("/api/task-areas/:id", async (req, res) => {
    const area = await storage.getTaskArea(req.params.id);
    if (!area) return res.status(404).json({ error: "Area not found" });
    res.json(area);
  });

  app.post("/api/task-areas", async (req, res) => {
    try {
      const { memberIds, ...areaData } = req.body;
      const validated = insertTaskAreaSchema.parse(areaData);
      const area = await storage.createTaskArea(validated);
      
      // Process shared area members and send invites
      if (memberIds && Array.isArray(memberIds) && memberIds.length > 0 && validated.visibility === "shared") {
        const owner = await storage.getUser(validated.ownerId);
        
        for (const userId of memberIds) {
          try {
            // Create area member
            await storage.addTaskAreaMember({
              areaId: area.id,
              userId,
              role: "member"
            });
            
            // Send email notification
            const member = await storage.getUser(userId);
            if (member && owner) {
              sendSharedAreaInviteEmail(
                member,
                area.name,
                area.id,
                owner.name
              ).catch(err => console.error(`[api/task-areas] Error sending email to ${member.email}:`, err));
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

  app.put("/api/task-areas/:id", async (req, res) => {
    try {
      const { memberIds, ...areaData } = req.body;
      const partialSchema = insertTaskAreaSchema.partial();
      const validated = partialSchema.parse(areaData);
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
                areaId: area.id,
                userId,
                role: "member"
              });

              // Send email notification only to new members
              const member = await storage.getUser(userId);
              if (member && owner) {
                sendSharedAreaInviteEmail(
                  member,
                  area.name,
                  area.id,
                  owner.name
                ).catch(err => console.error(`[api/task-areas] Error sending email to ${member.email}:`, err));
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

  app.delete("/api/task-areas/:id", async (req, res) => {
    const deleted = await storage.deleteTaskArea(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Area not found" });
    res.status(204).send();
  });

  // Task Area Members
  app.get("/api/task-areas/:id/members", async (req, res) => {
    const members = await storage.getTaskAreaMembers(req.params.id);
    res.json(members);
  });

  app.post("/api/task-areas/:id/members", async (req, res) => {
    try {
      const data = { ...req.body, areaId: req.params.id };
      const validated = insertTaskAreaMemberSchema.parse(data);
      const member = await storage.addTaskAreaMember(validated);
      res.status(201).json(member);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to add member" });
    }
  });

  app.patch("/api/task-area-members/:id", async (req, res) => {
    try {
      const partialSchema = insertTaskAreaMemberSchema.partial();
      const validated = partialSchema.parse(req.body);
      const member = await storage.updateTaskAreaMember(req.params.id, validated);
      if (!member) return res.status(404).json({ error: "Member not found" });
      res.json(member);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update member" });
    }
  });

  app.delete("/api/task-area-members/:id", async (req, res) => {
    const deleted = await storage.removeTaskAreaMember(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Member not found" });
    res.status(204).send();
  });

  // ============== TASKS ==============
  app.get("/api/tasks", async (req, res) => {
    const filters = {
      areaId: req.query.area_id as string | undefined,
      status: req.query.status as string | undefined,
      assigneeId: req.query.assignee_id as string | undefined,
      createdBy: req.query.created_by as string | undefined,
      type: req.query.type as string | undefined,
    };
    const tasks = await storage.getTasks(filters);
    res.json(tasks);
  });

  app.get("/api/tasks/:id", async (req, res) => {
    const task = await storage.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const validated = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(validated);
      
      if (task.type === "meeting_note") {
        let meetingData: {
          date?: string;
          time?: string;
          participants?: string[];
          externalParticipants?: string[];
        } | null = null;
        
        try {
          meetingData = typeof task.meetingData === 'string'
            ? JSON.parse(task.meetingData)
            : task.meetingData as unknown as typeof meetingData;
        } catch {
          meetingData = null;
        }
        
        if (meetingData?.date && meetingData?.time) {
          const organizer = await storage.getUser(task.createdBy);
          if (organizer) {
            const participantIds = meetingData.participants || [];
            const participants = await Promise.all(
              participantIds.map((id: string) => storage.getUser(id))
            );
            const validParticipants = participants.filter((p): p is NonNullable<typeof p> => p !== undefined);
            const externalEmails = meetingData.externalParticipants || [];
            
            sendMeetingInviteEmail(task, organizer, validParticipants, externalEmails).catch(console.error);
          }
        }
      }
      
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create task" });
    }
  });

  app.patch("/api/tasks/reorder", async (req, res) => {
    try {
      const { updates } = req.body;
      if (!Array.isArray(updates)) {
        return res.status(400).json({ error: "Updates must be an array" });
      }
      
      await Promise.all(
        updates.map(update => storage.updateTask(update.id, { order: update.order }))
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering tasks:", error);
      res.status(500).json({ error: "Failed to reorder tasks" });
    }
  });

  app.put("/api/tasks/:id", async (req, res) => {
    try {
      const partialSchema = insertTaskSchema.partial();
      const validated = partialSchema.parse(req.body);
      const task = await storage.updateTask(req.params.id, validated);
      if (!task) return res.status(404).json({ error: "Task not found" });
      res.json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    const deleted = await storage.deleteTask(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Task not found" });
    res.status(204).send();
  });

  // ============== TASK COMMENTS ==============
  app.get("/api/tasks/:id/comments", async (req, res) => {
    const comments = await storage.getTaskComments(req.params.id);
    res.json(comments);
  });

  app.post("/api/tasks/:id/comments", async (req, res) => {
    try {
      const data = { ...req.body, taskId: req.params.id };
      const validated = insertTaskCommentSchema.parse(data);
      const comment = await storage.createTaskComment(validated);
      
      // Process @mentions and send notifications
      const mentionMatches = validated.content.match(/@(\w+(?:\s+\w+)?)/g);
      if (mentionMatches) {
        const task = await storage.getTask(req.params.id);
        const users = await storage.getUsers();
        const author = await storage.getUser(validated.authorId);
        
        for (const mention of mentionMatches) {
          const mentionedName = mention.slice(1).trim();
          const mentionedUser = users.find(u => 
            u.name.toLowerCase() === mentionedName.toLowerCase()
          );
          
          if (mentionedUser && task && author) {
            sendMentionNotificationEmail(
              mentionedUser,
              author.name,
              task.title,
              task.id,
              validated.content
            ).catch(console.error);
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

  app.patch("/api/task-comments/:id", async (req, res) => {
    try {
      const comment = await storage.updateTaskComment(req.params.id, { content: req.body.content });
      if (!comment) return res.status(404).json({ error: "Comment not found" });
      res.json(comment);
    } catch (error) {
      res.status(400).json({ error: "Failed to update comment" });
    }
  });

  app.delete("/api/task-comments/:id", async (req, res) => {
    const deleted = await storage.deleteTaskComment(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Comment not found" });
    res.status(204).send();
  });

  // ============== TASK REACTIONS ==============
  app.get("/api/task-comments/:id/reactions", async (req, res) => {
    const reactions = await storage.getTaskReactions(req.params.id);
    res.json(reactions);
  });

  app.post("/api/task-comments/:id/reactions", async (req, res) => {
    try {
      const data = { ...req.body, commentId: req.params.id };
      const validated = insertTaskReactionSchema.parse(data);
      const reaction = await storage.addTaskReaction(validated);
      res.status(201).json(reaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to add reaction" });
    }
  });

  app.delete("/api/task-reactions/:id", async (req, res) => {
    const deleted = await storage.removeTaskReaction(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Reaction not found" });
    res.status(204).send();
  });

  // ============== TASK ATTACHMENTS ==============
  app.get("/api/tasks/:id/attachments", async (req, res) => {
    const attachments = await storage.getTaskAttachments(req.params.id);
    res.json(attachments);
  });

  app.post("/api/tasks/:id/attachments", async (req, res) => {
    try {
      const data = { ...req.body, taskId: req.params.id };
      const validated = insertTaskAttachmentSchema.parse(data);
      const attachment = await storage.addTaskAttachment(validated);
      res.status(201).json(attachment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to add attachment" });
    }
  });

  app.delete("/api/task-attachments/:id", async (req, res) => {
    const deleted = await storage.removeTaskAttachment(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Attachment not found" });
    res.status(204).send();
  });

  // ============== TASK TEMPLATES ==============
  app.get("/api/task-templates", async (req, res) => {
    const type = req.query.type as string | undefined;
    const templates = await storage.getTaskTemplates(type);
    res.json(templates);
  });

  app.get("/api/task-templates/:id", async (req, res) => {
    const template = await storage.getTaskTemplate(req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  });

  app.post("/api/task-templates", async (req, res) => {
    try {
      const validated = insertTaskTemplateSchema.parse(req.body);
      const template = await storage.createTaskTemplate(validated);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create template" });
    }
  });

  // ============== AREA TASKS (convenient endpoint) ==============
  app.get("/api/task-areas/:id/tasks", async (req, res) => {
    const tasks = await storage.getTasks({ areaId: req.params.id });
    res.json(tasks);
  });

  // ============== LOGISTICS DASHBOARD ==============
  app.get("/api/logistics/dashboard", async (req, res) => {
    const stats = await storage.getLogisticsDashboardStats();
    res.json(stats);
  });

  // ============== LOGISTIC OPERATORS ==============
  app.get("/api/logistic-operators", async (req, res) => {
    const operators = await storage.getLogisticOperators();
    res.json(operators);
  });

  app.get("/api/logistic-operators/:id", async (req, res) => {
    const operator = await storage.getLogisticOperator(req.params.id);
    if (!operator) return res.status(404).json({ error: "Operator not found" });
    res.json(operator);
  });

  app.post("/api/logistic-operators", async (req, res) => {
    try {
      const validated = insertLogisticOperatorSchema.parse(req.body);
      const operator = await storage.createLogisticOperator(validated);
      res.status(201).json(operator);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create operator" });
    }
  });

  app.patch("/api/logistic-operators/:id", async (req, res) => {
    try {
      const partialSchema = insertLogisticOperatorSchema.partial();
      const validated = partialSchema.parse(req.body);
      const operator = await storage.updateLogisticOperator(req.params.id, validated);
      if (!operator) return res.status(404).json({ error: "Operator not found" });
      res.json(operator);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update operator" });
    }
  });

  app.delete("/api/logistic-operators/:id", async (req, res) => {
    const deleted = await storage.deleteLogisticOperator(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Operator not found" });
    res.status(204).send();
  });

  // ============== COLLECTION REQUESTS ==============
  app.get("/api/collection-requests", async (req, res) => {
    const requests = await storage.getCollectionRequests();
    res.json(requests);
  });

  app.get("/api/collection-requests/:id", async (req, res) => {
    const request = await storage.getCollectionRequest(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    res.json(request);
  });

  app.post("/api/collection-requests", async (req, res) => {
    try {
      const validated = insertCollectionRequestSchema.parse(req.body);
      const request = await storage.createCollectionRequest(validated);
      res.status(201).json(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create request" });
    }
  });

  app.patch("/api/collection-requests/:id", async (req, res) => {
    try {
      const partialSchema = insertCollectionRequestSchema.partial();
      const validated = partialSchema.parse(req.body);
      const request = await storage.updateCollectionRequest(req.params.id, validated);
      if (!request) return res.status(404).json({ error: "Request not found" });
      res.json(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update request" });
    }
  });

  app.delete("/api/collection-requests/:id", async (req, res) => {
    const deleted = await storage.deleteCollectionRequest(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Request not found" });
    res.status(204).send();
  });

  // ============== LOGISTICA REVERSA ==============
  app.get("/api/logistica-reversa/pedidos", async (req, res) => {
    const pedidos = await storage.getLogisticaReversaPedidos();
    res.json(pedidos);
  });

  app.get("/api/logistica-reversa/pedidos/:id", async (req, res) => {
    const pedido = await storage.getLogisticaReversaPedido(req.params.id);
    if (!pedido) return res.status(404).json({ error: "Pedido not found" });
    res.json(pedido);
  });

  app.post("/api/logistica-reversa/solicitar", async (req, res) => {
    try {
      const { tipo, codigoServico, remetente, destinatario, observacao } = req.body;
      
      // Chama a API real dos Correios
      console.log('=== Solicitando Logística Reversa nos Correios ===');
      console.log('Tipo:', tipo);
      console.log('Serviço:', codigoServico);
      console.log('Remetente:', remetente?.nome);
      console.log('Destinatário:', destinatario?.nome);
      
      const correiosParams: correiosService.SolicitarPostagemReversaParams = {
        codigo_servico: codigoServico,
        destinatario: {
          nome: destinatario?.nome || 'RENOV SOLUCOES E SERVICOS LTDA',
          logradouro: destinatario?.logradouro || 'R LUIGI GALVANI',
          numero: destinatario?.numero || '200',
          complemento: destinatario?.complemento,
          bairro: destinatario?.bairro || 'CIDADE MONCOES',
          referencia: destinatario?.referencia,
          cidade: destinatario?.cidade || 'SAO PAULO',
          uf: destinatario?.uf || 'SP',
          cep: (destinatario?.cep || '04575020').replace(/\D/g, ''),
          ddd: destinatario?.ddd,
          telefone: destinatario?.telefone,
          email: destinatario?.email,
          ciencia_conteudo_proibido: 'S',
        },
        coletas_solicitadas: [{
          tipo: tipo as 'A' | 'C' | 'CA',
          remetente: {
            nome: remetente?.nome || '',
            logradouro: remetente?.logradouro || '',
            numero: remetente?.numero || 'S/N',
            complemento: remetente?.complemento,
            bairro: remetente?.bairro || '',
            cidade: remetente?.cidade || '',
            uf: remetente?.uf || '',
            cep: (remetente?.cep || '').replace(/\D/g, ''),
            referencia: remetente?.referencia,
            ddd: remetente?.ddd || '47',
            telefone: remetente?.telefone || '',
            email: remetente?.email || '',
            restricao_anac: 'N',
          },
          obj_col: [{
            item: 1,
            desc: observacao || 'Devolução de produto',
          }],
        }],
      };
      
      let numeroPedido: string;
      let numeroEtiqueta: string;
      let prazo: string;
      let correiosResponse: correiosService.SolicitarPostagemReversaResponse | null = null;
      
      try {
        correiosResponse = await correiosService.solicitarPostagemReversa(correiosParams);
        console.log('=== Resposta dos Correios ===');
        console.log('Status:', correiosResponse.status_processamento);
        console.log('Erro:', correiosResponse.cod_erro, correiosResponse.msg_erro);
        console.log('Resultados:', JSON.stringify(correiosResponse.resultado_solicitacao, null, 2));
        
        // Verifica se houve erro
        if (correiosResponse.cod_erro && correiosResponse.cod_erro !== '0' && correiosResponse.cod_erro !== '') {
          throw new Error(`Correios: ${correiosResponse.msg_erro || correiosResponse.cod_erro}`);
        }
        
        const resultado = correiosResponse.resultado_solicitacao[0];
        if (!resultado) {
          throw new Error('Correios: Nenhum resultado retornado');
        }
        
        // Verifica erro no resultado individual
        if (resultado.codigo_erro && resultado.codigo_erro !== '0' && resultado.codigo_erro !== '') {
          throw new Error(`Correios: ${resultado.descricao_erro || resultado.codigo_erro}`);
        }
        
        // Usa os valores reais retornados pelos Correios
        numeroPedido = resultado.numero_coleta || `LR${Date.now()}`;
        numeroEtiqueta = resultado.numero_etiqueta || '';
        prazo = resultado.prazo || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
        
        console.log('Número do Pedido:', numeroPedido);
        console.log('Número da Etiqueta:', numeroEtiqueta);
        console.log('Prazo:', prazo);
        
      } catch (correiosError: any) {
        console.error('=== Erro na API dos Correios ===');
        console.error(correiosError.message);
        
        // Retorna o erro para o usuário em vez de criar pedido falso
        return res.status(400).json({ 
          error: correiosError.message || 'Erro ao comunicar com os Correios',
          details: 'Verifique as credenciais e tente novamente'
        });
      }
      
      const pedidoData = {
        numeroPedido,
        numeroEtiqueta,
        tipo,
        codigoServico,
        status: "solicitado",
        idCliente: null,
        prazo,
        remetenteNome: remetente?.nome || null,
        remetenteCep: remetente?.cep || null,
        remetenteEndereco: remetente?.logradouro ? `${remetente.logradouro}, ${remetente.numero}` : null,
        remetenteCidade: remetente?.cidade || null,
        remetenteUf: remetente?.uf || null,
        remetenteEmail: remetente?.email || null,
        remetenteTelefone: remetente?.telefone || null,
        destinatarioNome: destinatario?.nome || null,
        destinatarioCep: destinatario?.cep || null,
        destinatarioEndereco: destinatario?.logradouro ? `${destinatario.logradouro}, ${destinatario.numero}` : null,
        destinatarioCidade: destinatario?.cidade || null,
        destinatarioUf: destinatario?.uf || null,
        observacao: observacao || null,
      };

      const pedido = await storage.createLogisticaReversaPedido(pedidoData);
      
      // Create initial event with Correios response info
      await storage.createLogisticaReversaEvento({
        pedidoId: pedido.id,
        status: "solicitado",
        descricao: `Pedido de logística reversa criado nos Correios. Etiqueta: ${numeroEtiqueta}`,
      });

      res.status(201).json({ 
        pedido, 
        success: true,
        correiosResponse: correiosResponse ? {
          status: correiosResponse.status_processamento,
          dataProcessamento: correiosResponse.data_processamento,
          horaProcessamento: correiosResponse.hora_processamento,
        } : null
      });
    } catch (error: any) {
      console.error('Erro ao criar pedido de logística reversa:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: error.message || "Failed to create reverse logistics request" });
    }
  });

  app.patch("/api/logistica-reversa/pedidos/:id", async (req, res) => {
    try {
      const partialSchema = insertLogisticaReversaPedidoSchema.partial();
      const validated = partialSchema.parse(req.body);
      const pedido = await storage.updateLogisticaReversaPedido(req.params.id, validated);
      if (!pedido) return res.status(404).json({ error: "Pedido not found" });
      res.json(pedido);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update pedido" });
    }
  });

  app.post("/api/logistica-reversa/cancelar/:id", async (req, res) => {
    try {
      const pedido = await storage.updateLogisticaReversaPedido(req.params.id, { status: "cancelado" });
      if (!pedido) return res.status(404).json({ error: "Pedido not found" });
      
      await storage.createLogisticaReversaEvento({
        pedidoId: pedido.id,
        status: "cancelado",
        descricao: "Pedido cancelado pelo usuário",
      });
      
      res.json({ pedido, success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to cancel pedido" });
    }
  });

  app.get("/api/logistica-reversa/pedidos/:id/eventos", async (req, res) => {
    const eventos = await storage.getLogisticaReversaEventos(req.params.id);
    res.json(eventos);
  });

  app.get("/api/logistica-reversa/stats", async (req, res) => {
    const pedidos = await storage.getLogisticaReversaPedidos();
    const stats = {
      total: pedidos.length,
      pendentes: pedidos.filter(p => p.status === "solicitado" || p.status === "aguardando_postagem").length,
      concluidos: pedidos.filter(p => p.status === "entregue").length,
      cancelados: pedidos.filter(p => p.status === "cancelado").length,
    };
    res.json(stats);
  });

  app.get("/api/logistica-reversa/servicos", async (req, res) => {
    res.json({
      servicos: [
        { codigo: "03301", nome: "PAC Reversa" },
        { codigo: "03247", nome: "SEDEX Reversa" },
      ],
      tipos: [
        { codigo: "A", nome: "Autorização de Postagem" },
        { codigo: "C", nome: "Coleta Domiciliar" },
        { codigo: "CA", nome: "Coleta Simultânea" },
      ],
      embalagens: [
        { codigo: "P", nome: "Pequena", dimensoes: "20x15x10cm", peso: 0.2 },
        { codigo: "M", nome: "Média", dimensoes: "30x25x15cm", peso: 0.4 },
        { codigo: "G", nome: "Grande", dimensoes: "40x30x20cm", peso: 0.6 },
      ],
    });
  });

  // ============== SLA RULES ==============
  app.get("/api/slas", async (req, res) => {
    const rules = await storage.getSlaRules();
    res.json(rules);
  });

  app.get("/api/slas/:id", async (req, res) => {
    const rule = await storage.getSlaRule(req.params.id);
    if (!rule) return res.status(404).json({ error: "SLA rule not found" });
    res.json(rule);
  });

  app.post("/api/slas", async (req, res) => {
    try {
      const validated = insertSlaRuleSchema.parse(req.body);
      
      const existing = await storage.getSlaRuleByTipoAndPrioridade(validated.tipo, validated.prioridade);
      if (existing) {
        return res.status(409).json({ 
          error: "conflict",
          message: `Já existe uma regra de SLA para ${validated.tipo} com prioridade ${validated.prioridade}`
        });
      }
      
      const rule = await storage.createSlaRule(validated);
      res.status(201).json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create SLA rule" });
    }
  });

  app.put("/api/slas/:id", async (req, res) => {
    try {
      const partialSchema = insertSlaRuleSchema.partial();
      const validated = partialSchema.parse(req.body);
      
      if (validated.tipo && validated.prioridade) {
        const existing = await storage.getSlaRuleByTipoAndPrioridade(validated.tipo, validated.prioridade);
        if (existing && existing.id !== req.params.id) {
          return res.status(409).json({ 
            error: "conflict",
            message: `Já existe uma regra de SLA para ${validated.tipo} com prioridade ${validated.prioridade}`
          });
        }
      }
      
      const rule = await storage.updateSlaRule(req.params.id, validated);
      if (!rule) return res.status(404).json({ error: "SLA rule not found" });
      res.json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update SLA rule" });
    }
  });

  app.delete("/api/slas/:id", async (req, res) => {
    const deleted = await storage.deleteSlaRule(req.params.id);
    if (!deleted) return res.status(404).json({ error: "SLA rule not found" });
    res.status(204).send();
  });

  // ============== CEP LOOKUP ==============
  app.get("/api/cep/:cep", async (req, res) => {
    try {
      const cep = req.params.cep.replace(/\D/g, "");
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        return res.status(404).json({ error: "CEP not found" });
      }
      
      res.json({
        cep: data.cep,
        logradouro: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        uf: data.uf,
        ddd: data.ddd,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to lookup CEP" });
    }
  });

  // ============== CORREIOS LOGISTICA REVERSA ==============
  
  // Get Correios configuration status
  app.get("/api/correios/config", async (req, res) => {
    try {
      const config = correiosService.getCorreiosConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to get Correios configuration" });
    }
  });

  // Solicitar Postagem Reversa (Authorization or Collection)
  app.post("/api/correios/solicitar-postagem-reversa", async (req, res) => {
    try {
      const result = await correiosService.solicitarPostagemReversa(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Correios solicitarPostagemReversa error:", error);
      res.status(500).json({ error: error.message || "Failed to request reverse posting" });
    }
  });

  // Cancelar Pedido
  app.post("/api/correios/cancelar-pedido", async (req, res) => {
    try {
      const result = await correiosService.cancelarPedido(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Correios cancelarPedido error:", error);
      res.status(500).json({ error: error.message || "Failed to cancel request" });
    }
  });

  // Acompanhar Pedido (by number)
  app.post("/api/correios/acompanhar-pedido", async (req, res) => {
    try {
      const result = await correiosService.acompanharPedido(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Correios acompanharPedido error:", error);
      res.status(500).json({ error: error.message || "Failed to track request" });
    }
  });

  // Acompanhar Pedido por Data
  app.post("/api/correios/acompanhar-pedido-por-data", async (req, res) => {
    try {
      const result = await correiosService.acompanharPedidoPorData(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Correios acompanharPedidoPorData error:", error);
      res.status(500).json({ error: error.message || "Failed to track requests by date" });
    }
  });

  // Revalidar Prazo Autorização de Postagem
  app.post("/api/correios/revalidar-prazo", async (req, res) => {
    try {
      const result = await correiosService.revalidarPrazoAutorizacaoPostagem(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Correios revalidarPrazoAutorizacaoPostagem error:", error);
      res.status(500).json({ error: error.message || "Failed to revalidate deadline" });
    }
  });

  // Solicitar Range de e-Tickets
  app.post("/api/correios/solicitar-range", async (req, res) => {
    try {
      const result = await correiosService.solicitarRange(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Correios solicitarRange error:", error);
      res.status(500).json({ error: error.message || "Failed to request e-ticket range" });
    }
  });

  // Calcular Dígito Verificador
  app.post("/api/correios/calcular-digito-verificador", async (req, res) => {
    try {
      const result = await correiosService.calcularDigitoVerificador(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Correios calcularDigitoVerificador error:", error);
      res.status(500).json({ error: error.message || "Failed to calculate check digit" });
    }
  });

  // Solicitar Postagem Simultânea
  app.post("/api/correios/solicitar-postagem-simultanea", async (req, res) => {
    try {
      const result = await correiosService.solicitarPostagemSimultanea(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Correios solicitarPostagemSimultanea error:", error);
      res.status(500).json({ error: error.message || "Failed to request simultaneous posting" });
    }
  });

  // ============== PRICING API PROXY (RenovSmart) ==============
  const RENOVSMART_API_BASE = "https://rp.renovsmart.com.br/api";

  app.get("/api/pricing/eligible-devices", async (req, res) => {
    try {
      const { categoryId, pageNumber = "1", pageSize = "100" } = req.query;
      if (!categoryId) {
        return res.json({ items: [], currentPage: 1, hasNextPage: false });
      }
      // Ensure we don't send undefined/null values in query string
      const params = new URLSearchParams();
      params.append("categoryId", String(categoryId));
      params.append("pageNumber", String(pageNumber));
      params.append("pageSize", String(pageSize));

      const url = `${RENOVSMART_API_BASE}/eligible-devices?${params.toString()}`;
      console.log(`Fetching RenovSmart API: ${url}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`RenovSmart eligible-devices returned ${response.status}: ${errorText}`);
        return res.json({ items: [], currentPage: 1, hasNextPage: false });
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Pricing eligible-devices error:", error);
      res.json({ items: [], currentPage: 1, hasNextPage: false });
    }
  });

  app.get("/api/pricing/search", async (req, res) => {
    try {
      const queryParams = new URLSearchParams(req.query as Record<string, string>).toString();
      const url = `${RENOVSMART_API_BASE}/search?${queryParams}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`RenovSmart search returned ${response.status}, returning empty result`);
        return res.json({ raw: { shopping_results: [] } });
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Pricing search error:", error);
      res.json({ raw: { shopping_results: [] } });
    }
  });

  app.get("/api/pricing/agg/by-device", async (req, res) => {
    try {
      const queryParams = new URLSearchParams(req.query as Record<string, string>).toString();
      const url = `${RENOVSMART_API_BASE}/agg/by-device?${queryParams}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`RenovSmart agg/by-device returned ${response.status}, returning empty result`);
        return res.json([]);
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Pricing agg/by-device error:", error);
      res.json([]);
    }
  });

  app.get("/api/pricing/eligible-devices/price", async (req, res) => {
    try {
      const queryParams = new URLSearchParams(req.query as Record<string, string>).toString();
      const url = `${RENOVSMART_API_BASE}/eligible-devices/price?${queryParams}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`RenovSmart eligible-devices/price returned ${response.status}, returning empty result`);
        return res.json({});
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Pricing eligible-devices/price error:", error);
      res.json({});
    }
  });

  // ============== LOCAL PRICING DEVICES API ==============
  
  // Get all local pricing devices
  app.get("/api/pricing/devices", async (req, res) => {
    try {
      const { categoryId, manufacturerName, isActive } = req.query;
      const filters: any = {};
      if (categoryId) filters.categoryId = categoryId as string;
      if (manufacturerName) filters.manufacturerName = manufacturerName as string;
      if (isActive !== undefined) filters.isActive = isActive === "true";
      const devices = await storage.getPricingDevices(filters);
      res.json(devices);
    } catch (error: any) {
      console.error("Get pricing devices error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single device
  app.get("/api/pricing/devices/:id", async (req, res) => {
    try {
      const device = await storage.getPricingDevice(req.params.id);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }
      res.json(device);
    } catch (error: any) {
      console.error("Get pricing device error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create device
  app.post("/api/pricing/devices", async (req, res) => {
    try {
      const device = await storage.createPricingDevice(req.body);
      res.status(201).json(device);
    } catch (error: any) {
      console.error("Create pricing device error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update device
  app.patch("/api/pricing/devices/:id", async (req, res) => {
    try {
      const device = await storage.updatePricingDevice(req.params.id, req.body);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }
      res.json(device);
    } catch (error: any) {
      console.error("Update pricing device error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete device
  app.delete("/api/pricing/devices/:id", async (req, res) => {
    try {
      const success = await storage.deletePricingDevice(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Device not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete pricing device error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get price history for a device
  app.get("/api/pricing/devices/:id/history", async (req, res) => {
    try {
      const history = await storage.getPricingPriceHistory(req.params.id);
      res.json(history);
    } catch (error: any) {
      console.error("Get pricing history error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add price history entry
  app.post("/api/pricing/devices/:id/history", async (req, res) => {
    try {
      const entry = await storage.createPricingPriceHistory({
        ...req.body,
        deviceId: req.params.id,
      });
      res.status(201).json(entry);
    } catch (error: any) {
      console.error("Create pricing history error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============== PRICING ALERTS API ==============
  
  app.get("/api/pricing/alerts", async (req, res) => {
    try {
      const { userId } = req.query;
      const alerts = await storage.getPricingAlerts(userId as string | undefined);
      res.json(alerts);
    } catch (error: any) {
      console.error("Get pricing alerts error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/pricing/alerts", async (req, res) => {
    try {
      const alert = await storage.createPricingAlert(req.body);
      res.status(201).json(alert);
    } catch (error: any) {
      console.error("Create pricing alert error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/pricing/alerts/:id", async (req, res) => {
    try {
      const alert = await storage.updatePricingAlert(req.params.id, req.body);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json(alert);
    } catch (error: any) {
      console.error("Update pricing alert error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/pricing/alerts/:id", async (req, res) => {
    try {
      const success = await storage.deletePricingAlert(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete pricing alert error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============== PRICING ANALYTICS API ==============
  
  // Get deflation indicators
  app.get("/api/pricing/analytics/deflation", async (req, res) => {
    try {
      const devices = await storage.getPricingDevices({ isActive: true });
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const deflationData: any[] = [];
      
      for (const device of devices) {
        const history = await storage.getPricingPriceHistory(device.id);
        if (history.length < 2) continue;
        
        // Sort by date
        const sorted = history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Calculate 30-day change
        const recent = sorted.filter(h => new Date(h.date) >= thirtyDaysAgo);
        if (recent.length < 2) continue;
        
        const oldestPrice = parseFloat(recent[0].avgPrice || "0");
        const newestPrice = parseFloat(recent[recent.length - 1].avgPrice || "0");
        const change = oldestPrice > 0 ? ((newestPrice - oldestPrice) / oldestPrice) * 100 : 0;
        
        // Calculate weekly variation
        const weekRecent = sorted.filter(h => new Date(h.date) >= sevenDaysAgo);
        let weeklyVariation = 0;
        if (weekRecent.length >= 2) {
          const weekOld = parseFloat(weekRecent[0].avgPrice || "0");
          const weekNew = parseFloat(weekRecent[weekRecent.length - 1].avgPrice || "0");
          weeklyVariation = weekOld > 0 ? ((weekNew - weekOld) / weekOld) * 100 : 0;
        }
        
        deflationData.push({
          deviceId: device.id,
          deviceName: `${device.manufacturerName} ${device.modelName} ${device.storage}GB`,
          manufacturerName: device.manufacturerName,
          categoryName: device.categoryName,
          currentPrice: newestPrice,
          priceChange30d: change,
          weeklyVariation,
        });
      }
      
      // Sort by price change (most negative = biggest drop)
      const sorted = deflationData.sort((a, b) => a.priceChange30d - b.priceChange30d);
      
      // Calculate averages
      const avgDeflation = deflationData.length > 0 
        ? deflationData.reduce((acc, d) => acc + d.priceChange30d, 0) / deflationData.length 
        : 0;
      
      const avgWeeklyVariation = deflationData.length > 0
        ? deflationData.reduce((acc, d) => acc + d.weeklyVariation, 0) / deflationData.length
        : 0;

      // Group by manufacturer
      const byManufacturer: Record<string, number[]> = {};
      deflationData.forEach(d => {
        if (!byManufacturer[d.manufacturerName]) byManufacturer[d.manufacturerName] = [];
        byManufacturer[d.manufacturerName].push(d.priceChange30d);
      });
      
      const deflationByBrand = Object.entries(byManufacturer).map(([brand, changes]) => ({
        brand,
        avgDeflation: changes.reduce((a, b) => a + b, 0) / changes.length,
      }));

      res.json({
        avgMonthlyDeflation: avgDeflation,
        avgWeeklyVariation,
        top10Drops: sorted.slice(0, 10),
        top10Rises: [...sorted].reverse().slice(0, 10),
        deflationByBrand,
        totalDevices: devices.length,
      });
    } catch (error: any) {
      console.error("Get deflation analytics error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============== METAS (Goals) API ==============
  
  // Meta Areas
  app.get("/api/meta-areas", async (req, res) => {
    try {
      const areas = await storage.getMetaAreas();
      res.json(areas);
    } catch (error: any) {
      console.error("Get meta areas error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/meta-areas/:id", async (req, res) => {
    try {
      const area = await storage.getMetaArea(req.params.id);
      if (!area) {
        return res.status(404).json({ error: "Area not found" });
      }
      res.json(area);
    } catch (error: any) {
      console.error("Get meta area error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/meta-areas", async (req, res) => {
    try {
      const parsed = insertMetaAreaSchema.parse(req.body);
      // Check for duplicate name
      const existing = await storage.getMetaAreaByName(parsed.name);
      if (existing) {
        return res.status(400).json({ error: "Já existe uma área com este nome" });
      }
      const area = await storage.createMetaArea(parsed);
      res.status(201).json(area);
    } catch (error: any) {
      console.error("Create meta area error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/meta-areas/:id", async (req, res) => {
    try {
      // If updating name, check for duplicates
      if (req.body.name) {
        const existing = await storage.getMetaAreaByName(req.body.name);
        if (existing && existing.id !== req.params.id) {
          return res.status(400).json({ error: "Já existe uma área com este nome" });
        }
      }
      const updated = await storage.updateMetaArea(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Area not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Update meta area error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/meta-areas/:id", async (req, res) => {
    try {
      // Check if there are metas linked to this area
      const metas = await storage.getMetas({ areaId: req.params.id });
      if (metas.length > 0) {
        // Archive instead of delete
        const updated = await storage.updateMetaArea(req.params.id, { archived: true });
        return res.json({ archived: true, area: updated });
      }
      const success = await storage.deleteMetaArea(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Area not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete meta area error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Metas
  app.get("/api/metas", async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.month) filters.month = req.query.month as string;
      if (req.query.areaId) filters.areaId = req.query.areaId as string;
      if (req.query.responsibleId) filters.responsibleId = req.query.responsibleId as string;
      const metas = await storage.getMetas(filters);
      res.json(metas);
    } catch (error: any) {
      console.error("Get metas error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/metas/:id", async (req, res) => {
    try {
      const meta = await storage.getMeta(req.params.id);
      if (!meta) {
        return res.status(404).json({ error: "Meta not found" });
      }
      res.json(meta);
    } catch (error: any) {
      console.error("Get meta error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/metas", async (req, res) => {
    try {
      const parsed = insertMetaSchema.parse(req.body);
      const meta = await storage.createMeta(parsed);
      res.status(201).json(meta);
    } catch (error: any) {
      console.error("Create meta error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/metas/:id", async (req, res) => {
    try {
      const updated = await storage.updateMeta(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Meta not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Update meta error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/metas/:id", async (req, res) => {
    try {
      const success = await storage.deleteMeta(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Meta not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete meta error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Meta Check-ins
  app.get("/api/metas/:id/checkins", async (req, res) => {
    try {
      const checkins = await storage.getMetaCheckins(req.params.id);
      res.json(checkins);
    } catch (error: any) {
      console.error("Get meta checkins error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/metas/:id/checkins", async (req, res) => {
    try {
      const meta = await storage.getMeta(req.params.id);
      if (!meta) {
        return res.status(404).json({ error: "Meta not found" });
      }
      
      const parsed = insertMetaCheckinSchema.parse({
        ...req.body,
        metaId: req.params.id,
        previousValue: meta.currentValue,
      });
      
      const checkin = await storage.createMetaCheckin(parsed);
      
      // Update meta's current value and status
      const targetValue = parseFloat(meta.targetValue || "100");
      const newValue = parseFloat(parsed.newValue);
      let status = "on_track";
      
      if (targetValue > 0) {
        const progress = (newValue / targetValue) * 100;
        if (progress >= 100) {
          status = "completed";
        } else if (progress < 50) {
          // Check if we're past day 15 of the month
          const today = new Date();
          if (today.getDate() > 15) {
            status = "overdue";
          }
        }
      }
      
      await storage.updateMeta(req.params.id, { 
        currentValue: parsed.newValue,
        status 
      });
      
      res.status(201).json(checkin);
    } catch (error: any) {
      console.error("Create meta checkin error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============== KNOWLEDGE BASE (Base de Conhecimento) ==============

  // Get all documents with filters
  app.get("/api/conhecimento", async (req, res) => {
    try {
      const { area, tipo, status, search } = req.query;
      const docs = await storage.getKnowledgeDocuments({
        area: area as string | undefined,
        tipo: tipo as string | undefined,
        status: status as string | undefined,
        search: search as string | undefined,
      });
      res.json(docs);
    } catch (error: any) {
      console.error("Get knowledge documents error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get document stats
  app.get("/api/conhecimento/stats", async (req, res) => {
    try {
      const stats = await storage.getKnowledgeDocumentStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Get knowledge stats error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single document
  app.get("/api/conhecimento/:id", async (req, res) => {
    try {
      const doc = await storage.getKnowledgeDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Log view action
      const userId = req.query.userId as string;
      if (userId) {
        await storage.createKnowledgeAuditLog({
          documentId: doc.id,
          userId,
          acao: "visualizou",
        });
      }
      
      res.json(doc);
    } catch (error: any) {
      console.error("Get knowledge document error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create new document
  app.post("/api/conhecimento", async (req, res) => {
    try {
      const parsed = insertKnowledgeDocumentSchema.parse(req.body);
      const doc = await storage.createKnowledgeDocument(parsed);
      
      // Log creation
      await storage.createKnowledgeAuditLog({
        documentId: doc.id,
        userId: doc.criadorId,
        acao: "criou",
      });
      
      // Create initial version
      await storage.createKnowledgeDocumentVersion({
        documentId: doc.id,
        versao: doc.versao,
        conteudo: doc.conteudo,
        anexos: doc.anexos,
        alteradoPor: doc.criadorId,
        resumoAlteracoes: "Versão inicial",
      });
      
      res.status(201).json(doc);
    } catch (error: any) {
      console.error("Create knowledge document error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Update document
  app.patch("/api/conhecimento/:id", async (req, res) => {
    try {
      const { userId, ...updateData } = req.body;
      
      const updated = await storage.updateKnowledgeDocument(req.params.id, {
        ...updateData,
        ultimaEdicaoPor: userId,
        ultimaEdicaoEm: new Date(),
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Log edit action
      if (userId) {
        await storage.createKnowledgeAuditLog({
          documentId: req.params.id,
          userId,
          acao: "editou",
        });
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error("Update knowledge document error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Send document for approval
  app.post("/api/conhecimento/:id/enviar-aprovacao", async (req, res) => {
    try {
      const { userId } = req.body;
      
      const updated = await storage.updateKnowledgeDocument(req.params.id, {
        status: "em_analise",
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      await storage.createKnowledgeAuditLog({
        documentId: req.params.id,
        userId,
        acao: "enviou_aprovacao",
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error("Send for approval error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Approve document (Admin only)
  app.post("/api/conhecimento/:id/aprovar", async (req, res) => {
    try {
      const { userId } = req.body;
      
      const updated = await storage.updateKnowledgeDocument(req.params.id, {
        status: "aprovado",
        aprovadoPor: userId,
        aprovadoEm: new Date(),
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      await storage.createKnowledgeAuditLog({
        documentId: req.params.id,
        userId,
        acao: "aprovou",
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error("Approve document error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reject document (Admin only)
  app.post("/api/conhecimento/:id/rejeitar", async (req, res) => {
    try {
      const { userId, motivo } = req.body;
      
      const updated = await storage.updateKnowledgeDocument(req.params.id, {
        status: "rascunho",
        rejeitadoPor: userId,
        rejeitadoEm: new Date(),
        motivoRejeicao: motivo,
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      await storage.createKnowledgeAuditLog({
        documentId: req.params.id,
        userId,
        acao: "rejeitou",
        detalhes: motivo,
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error("Reject document error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Archive document
  app.post("/api/conhecimento/:id/arquivar", async (req, res) => {
    try {
      const { userId } = req.body;
      
      const updated = await storage.updateKnowledgeDocument(req.params.id, {
        status: "arquivado",
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      await storage.createKnowledgeAuditLog({
        documentId: req.params.id,
        userId,
        acao: "arquivou",
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error("Archive document error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete document
  app.delete("/api/conhecimento/:id", async (req, res) => {
    try {
      const success = await storage.deleteKnowledgeDocument(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete knowledge document error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get document versions
  app.get("/api/conhecimento/:id/versoes", async (req, res) => {
    try {
      const versions = await storage.getKnowledgeDocumentVersions(req.params.id);
      res.json(versions);
    } catch (error: any) {
      console.error("Get document versions error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create new version
  app.post("/api/conhecimento/:id/versoes", async (req, res) => {
    try {
      const parsed = insertKnowledgeDocumentVersionSchema.parse({
        ...req.body,
        documentId: req.params.id,
      });
      
      const version = await storage.createKnowledgeDocumentVersion(parsed);
      
      // Update document's current version
      await storage.updateKnowledgeDocument(req.params.id, {
        versao: parsed.versao,
        conteudo: parsed.conteudo,
        anexos: parsed.anexos,
        ultimaEdicaoPor: parsed.alteradoPor,
        ultimaEdicaoEm: new Date(),
      });
      
      await storage.createKnowledgeAuditLog({
        documentId: req.params.id,
        userId: parsed.alteradoPor,
        acao: "editou",
        detalhes: `Nova versão: ${parsed.versao}`,
      });
      
      res.status(201).json(version);
    } catch (error: any) {
      console.error("Create document version error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Restore version (Admin only)
  app.post("/api/conhecimento/:id/versoes/:versionId/restaurar", async (req, res) => {
    try {
      const { userId } = req.body;
      const versions = await storage.getKnowledgeDocumentVersions(req.params.id);
      const version = versions.find(v => v.id === req.params.versionId);
      
      if (!version) {
        return res.status(404).json({ error: "Version not found" });
      }
      
      // Update document to this version
      const updated = await storage.updateKnowledgeDocument(req.params.id, {
        versao: version.versao,
        conteudo: version.conteudo,
        anexos: version.anexos,
        ultimaEdicaoPor: userId,
        ultimaEdicaoEm: new Date(),
      });
      
      await storage.createKnowledgeAuditLog({
        documentId: req.params.id,
        userId,
        acao: "restaurou",
        detalhes: `Restaurado para versão ${version.versao}`,
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error("Restore version error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get audit logs
  app.get("/api/conhecimento/:id/auditoria", async (req, res) => {
    try {
      const logs = await storage.getKnowledgeAuditLogs(req.params.id);
      res.json(logs);
    } catch (error: any) {
      console.error("Get audit logs error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get user favorites
  app.get("/api/conhecimento/favoritos/:userId", async (req, res) => {
    try {
      const favorites = await storage.getKnowledgeFavorites(req.params.userId);
      res.json(favorites);
    } catch (error: any) {
      console.error("Get favorites error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add favorite
  app.post("/api/conhecimento/:id/favoritar", async (req, res) => {
    try {
      const { userId } = req.body;
      
      // Check if already favorited
      const existing = await storage.getKnowledgeFavorite(userId, req.params.id);
      if (existing) {
        return res.status(400).json({ error: "Already favorited" });
      }
      
      const favorite = await storage.createKnowledgeFavorite({
        userId,
        documentId: req.params.id,
      });
      
      res.status(201).json(favorite);
    } catch (error: any) {
      console.error("Add favorite error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove favorite
  app.delete("/api/conhecimento/:docId/favoritar/:userId", async (req, res) => {
    try {
      const favorite = await storage.getKnowledgeFavorite(req.params.userId, req.params.docId);
      if (!favorite) {
        return res.status(404).json({ error: "Favorite not found" });
      }
      
      await storage.deleteKnowledgeFavorite(favorite.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Remove favorite error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);

  // ============== AI CHAT ROUTES ==============
  
  // Get all conversations for a user
  app.get("/api/ai/conversations/:userId", async (req, res) => {
    try {
      const conversations = await storage.getAiConversations(req.params.userId);
      res.json(conversations);
    } catch (error: any) {
      console.error("Get AI conversations error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new conversation
  app.post("/api/ai/conversations", async (req, res) => {
    try {
      const data = insertAiConversationSchema.parse(req.body);
      const conversation = await storage.createAiConversation(data);
      res.status(201).json(conversation);
    } catch (error: any) {
      console.error("Create AI conversation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update conversation (e.g., title)
  app.patch("/api/ai/conversations/:id", async (req, res) => {
    try {
      const conversation = await storage.updateAiConversation(req.params.id, req.body);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error: any) {
      console.error("Update AI conversation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete conversation
  app.delete("/api/ai/conversations/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAiConversation(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete AI conversation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get messages for a conversation
  app.get("/api/ai/conversations/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getAiMessages(req.params.id);
      res.json(messages);
    } catch (error: any) {
      console.error("Get AI messages error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stream chat completion
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const chatSchema = z.object({
        conversationId: z.string(),
        userId: z.string(),
        message: z.string().min(1).max(10000),
        isNewConversation: z.boolean().optional(),
        tenantId: z.string().optional(),
      });

      const parsed = chatSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.errors });
      }

      const { conversationId, userId, message, isNewConversation, tenantId } = parsed.data;

      // Create conversation if new
      let conversation;
      if (isNewConversation) {
        conversation = await storage.createAiConversation({
          userId,
          tenantId,
          title: "Nova conversa",
        });
      } else {
        conversation = await storage.getAiConversation(conversationId);
        if (!conversation) {
          return res.status(404).json({ error: "Conversation not found" });
        }
        // Verify conversation ownership
        if (conversation.userId !== userId) {
          return res.status(403).json({ error: "Access denied to this conversation" });
        }
      }

      const actualConversationId = isNewConversation ? conversation.id : conversationId;

      // Save user message
      await storage.createAiMessage({
        conversationId: actualConversationId,
        role: "user",
        content: message,
      });

      // Get conversation history
      const history = await storage.getAiMessages(actualConversationId);
      const messages = history.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Send conversation ID for new conversations
      if (isNewConversation) {
        res.write(`data: ${JSON.stringify({ type: "conversation_id", id: actualConversationId })}\n\n`);
      }

      let fullResponse = "";

      // Stream the response with user context for personalized responses
      try {
        for await (const chunk of streamChatCompletion(messages, { userId, tenantId })) {
          fullResponse += chunk;
          res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`);
        }
      } catch (streamError: any) {
        console.error("Stream error:", streamError);
        res.write(`data: ${JSON.stringify({ type: "error", error: streamError.message })}\n\n`);
        res.end();
        return;
      }

      // Save assistant message
      await storage.createAiMessage({
        conversationId: actualConversationId,
        role: "assistant",
        content: fullResponse,
      });

      // Generate title for new conversations
      if (isNewConversation) {
        const title = await generateTitle(message);
        await storage.updateAiConversation(actualConversationId, { title });
        res.write(`data: ${JSON.stringify({ type: "title", title })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("AI chat error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      } else {
        res.write(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`);
        res.end();
      }
    }
  });

  return httpServer;
}
