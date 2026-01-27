import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertTicketSchema, 
  insertTicketCommentSchema,
  insertProjectSchema,
  insertKanbanColumnSchema,
  insertKanbanCardSchema,
  insertKanbanCommentSchema,
  insertObjectiveSchema,
  insertKeyResultSchema,
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
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
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
      const ticket = await storage.createTicket(validated);
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
      const partialSchema = insertTicketSchema.partial();
      const validated = partialSchema.parse(req.body);
      const ticket = await storage.updateTicket(req.params.id, validated);
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      res.json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
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
      res.status(201).json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create comment" });
    }
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

  // ============== OBJECTIVES ==============
  app.get("/api/objectives", async (req, res) => {
    const objectives = await storage.getObjectives();
    res.json(objectives);
  });

  app.get("/api/objectives/:id", async (req, res) => {
    const objective = await storage.getObjective(req.params.id);
    if (!objective) return res.status(404).json({ error: "Objective not found" });
    res.json(objective);
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

  app.delete("/api/key-results/:id", async (req, res) => {
    const deleted = await storage.deleteKeyResult(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Key result not found" });
    res.status(204).send();
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
    const setting = await storage.getSetting(req.params.key);
    if (!setting) return res.status(404).json({ error: "Setting not found" });
    res.json(setting);
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
      const validated = insertTaskAreaSchema.parse(req.body);
      const area = await storage.createTaskArea(validated);
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
      const partialSchema = insertTaskAreaSchema.partial();
      const validated = partialSchema.parse(req.body);
      const area = await storage.updateTaskArea(req.params.id, validated);
      if (!area) return res.status(404).json({ error: "Area not found" });
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
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create task" });
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
      
      const numeroPedido = `LR${Date.now()}`;
      const numeroEtiqueta = `SV${Math.random().toString(36).substring(2, 11).toUpperCase()}BR`;
      
      const pedidoData = {
        numeroPedido,
        numeroEtiqueta,
        tipo,
        codigoServico,
        status: "solicitado",
        idCliente: null,
        prazo: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
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
      
      // Create initial event
      await storage.createLogisticaReversaEvento({
        pedidoId: pedido.id,
        status: "solicitado",
        descricao: "Pedido de logística reversa criado com sucesso",
      });

      res.status(201).json({ pedido, success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create reverse logistics request" });
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
        { codigo: "41076", nome: "PAC Reversa" },
        { codigo: "40010", nome: "SEDEX Reversa" },
        { codigo: "40215", nome: "SEDEX 10 Reversa" },
        { codigo: "40290", nome: "SEDEX 12 Reversa" },
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

  return httpServer;
}
