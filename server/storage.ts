import { 
  type User, type InsertUser,
  type Ticket, type InsertTicket,
  type TicketComment, type InsertTicketComment,
  type Project, type InsertProject,
  type KanbanColumn, type InsertKanbanColumn,
  type KanbanCard, type InsertKanbanCard,
  type KanbanComment, type InsertKanbanComment,
  type Objective, type InsertObjective,
  type KeyResult, type InsertKeyResult,
  type Shipment, type InsertShipment,
  type ShipmentEvent, type InsertShipmentEvent,
  type Setting, type InsertSetting,
  type TaskArea, type InsertTaskArea,
  type TaskAreaMember, type InsertTaskAreaMember,
  type Task, type InsertTask,
  type TaskComment, type InsertTaskComment,
  type TaskReaction, type InsertTaskReaction,
  type TaskAttachment, type InsertTaskAttachment,
  type TaskTemplate, type InsertTaskTemplate,
  type LogisticOperator, type InsertLogisticOperator,
  type CollectionRequest, type InsertCollectionRequest,
  type LogisticaReversaPedido, type InsertLogisticaReversaPedido,
  type LogisticaReversaEvento, type InsertLogisticaReversaEvento,
  type LogisticsDashboardStats,
  users, tickets, ticketComments, projects, kanbanColumns, kanbanCards, kanbanComments,
  objectives, keyResults, shipments, shipmentEvents, settings, taskAreas, taskAreaMembers,
  tasks, taskComments, taskReactions, taskAttachments, taskTemplates, logisticOperators,
  collectionRequests, logisticaReversaPedidos, logisticaReversaEventos
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;

  // Tickets
  getTicket(id: string): Promise<Ticket | undefined>;
  getTickets(): Promise<Ticket[]>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicket(id: string, data: Partial<Ticket>): Promise<Ticket | undefined>;
  deleteTicket(id: string): Promise<boolean>;

  // Ticket Comments
  getTicketComments(ticketId: string): Promise<TicketComment[]>;
  createTicketComment(comment: InsertTicketComment): Promise<TicketComment>;

  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getProjects(): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Kanban Columns
  getKanbanColumns(projectId: string): Promise<KanbanColumn[]>;
  createKanbanColumn(column: InsertKanbanColumn): Promise<KanbanColumn>;
  updateKanbanColumn(id: string, data: Partial<KanbanColumn>): Promise<KanbanColumn | undefined>;
  deleteKanbanColumn(id: string): Promise<boolean>;

  // Kanban Cards
  getKanbanCard(id: string): Promise<KanbanCard | undefined>;
  getKanbanCards(projectId: string): Promise<KanbanCard[]>;
  createKanbanCard(card: InsertKanbanCard): Promise<KanbanCard>;
  updateKanbanCard(id: string, data: Partial<KanbanCard>): Promise<KanbanCard | undefined>;
  deleteKanbanCard(id: string): Promise<boolean>;

  // Kanban Comments
  getKanbanComments(cardId: string): Promise<KanbanComment[]>;
  createKanbanComment(comment: InsertKanbanComment): Promise<KanbanComment>;

  // Objectives
  getObjective(id: string): Promise<Objective | undefined>;
  getObjectives(): Promise<Objective[]>;
  createObjective(objective: InsertObjective): Promise<Objective>;
  updateObjective(id: string, data: Partial<Objective>): Promise<Objective | undefined>;
  deleteObjective(id: string): Promise<boolean>;

  // Key Results
  getKeyResults(): Promise<KeyResult[]>;
  getKeyResultsByObjective(objectiveId: string): Promise<KeyResult[]>;
  createKeyResult(kr: InsertKeyResult): Promise<KeyResult>;
  updateKeyResult(id: string, data: Partial<KeyResult>): Promise<KeyResult | undefined>;
  deleteKeyResult(id: string): Promise<boolean>;

  // Shipments
  getShipment(id: string): Promise<Shipment | undefined>;
  getShipments(): Promise<Shipment[]>;
  createShipment(shipment: InsertShipment): Promise<Shipment>;
  updateShipment(id: string, data: Partial<Shipment>): Promise<Shipment | undefined>;
  deleteShipment(id: string): Promise<boolean>;

  // Shipment Events
  getShipmentEvents(shipmentId: string): Promise<ShipmentEvent[]>;
  createShipmentEvent(event: InsertShipmentEvent): Promise<ShipmentEvent>;

  // Settings
  getSetting(key: string): Promise<Setting | undefined>;
  getSettings(): Promise<Setting[]>;
  setSetting(key: string, value: string): Promise<Setting>;

  // Task Areas
  getTaskArea(id: string): Promise<TaskArea | undefined>;
  getTaskAreas(userId: string): Promise<TaskArea[]>;
  createTaskArea(area: InsertTaskArea): Promise<TaskArea>;
  updateTaskArea(id: string, data: Partial<TaskArea>): Promise<TaskArea | undefined>;
  deleteTaskArea(id: string): Promise<boolean>;

  // Task Area Members
  getTaskAreaMembers(areaId: string): Promise<TaskAreaMember[]>;
  addTaskAreaMember(member: InsertTaskAreaMember): Promise<TaskAreaMember>;
  updateTaskAreaMember(id: string, data: Partial<TaskAreaMember>): Promise<TaskAreaMember | undefined>;
  removeTaskAreaMember(id: string): Promise<boolean>;

  // Tasks
  getTask(id: string): Promise<Task | undefined>;
  getTasks(filters?: { areaId?: string; status?: string; assigneeId?: string; createdBy?: string; type?: string }): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<Task>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;

  // Task Comments
  getTaskComments(taskId: string): Promise<TaskComment[]>;
  getTaskComment(id: string): Promise<TaskComment | undefined>;
  createTaskComment(comment: InsertTaskComment): Promise<TaskComment>;
  updateTaskComment(id: string, data: Partial<TaskComment>): Promise<TaskComment | undefined>;
  deleteTaskComment(id: string): Promise<boolean>;

  // Task Reactions
  getTaskReactions(commentId: string): Promise<TaskReaction[]>;
  addTaskReaction(reaction: InsertTaskReaction): Promise<TaskReaction>;
  removeTaskReaction(id: string): Promise<boolean>;

  // Task Attachments
  getTaskAttachments(taskId: string): Promise<TaskAttachment[]>;
  addTaskAttachment(attachment: InsertTaskAttachment): Promise<TaskAttachment>;
  removeTaskAttachment(id: string): Promise<boolean>;

  // Task Templates
  getTaskTemplates(type?: string): Promise<TaskTemplate[]>;
  getTaskTemplate(id: string): Promise<TaskTemplate | undefined>;
  createTaskTemplate(template: InsertTaskTemplate): Promise<TaskTemplate>;

  // Logistic Operators
  getLogisticOperator(id: string): Promise<LogisticOperator | undefined>;
  getLogisticOperators(): Promise<LogisticOperator[]>;
  createLogisticOperator(operator: InsertLogisticOperator): Promise<LogisticOperator>;
  updateLogisticOperator(id: string, data: Partial<LogisticOperator>): Promise<LogisticOperator | undefined>;
  deleteLogisticOperator(id: string): Promise<boolean>;

  // Collection Requests
  getCollectionRequest(id: string): Promise<CollectionRequest | undefined>;
  getCollectionRequests(): Promise<CollectionRequest[]>;
  createCollectionRequest(request: InsertCollectionRequest): Promise<CollectionRequest>;
  updateCollectionRequest(id: string, data: Partial<CollectionRequest>): Promise<CollectionRequest | undefined>;
  deleteCollectionRequest(id: string): Promise<boolean>;

  // Logistica Reversa Pedidos
  getLogisticaReversaPedido(id: string): Promise<LogisticaReversaPedido | undefined>;
  getLogisticaReversaPedidos(): Promise<LogisticaReversaPedido[]>;
  createLogisticaReversaPedido(pedido: InsertLogisticaReversaPedido): Promise<LogisticaReversaPedido>;
  updateLogisticaReversaPedido(id: string, data: Partial<LogisticaReversaPedido>): Promise<LogisticaReversaPedido | undefined>;
  deleteLogisticaReversaPedido(id: string): Promise<boolean>;

  // Logistica Reversa Eventos
  getLogisticaReversaEventos(pedidoId: string): Promise<LogisticaReversaEvento[]>;
  createLogisticaReversaEvento(evento: InsertLogisticaReversaEvento): Promise<LogisticaReversaEvento>;

  // Dashboard Stats
  getLogisticsDashboardStats(): Promise<LogisticsDashboardStats>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  // Tickets
  async getTicket(id: string): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
    return ticket;
  }
  async getTickets(): Promise<Ticket[]> {
    return await db.select().from(tickets);
  }
  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    const [ticket] = await db.insert(tickets).values(insertTicket).returning();
    return ticket;
  }
  async updateTicket(id: string, data: Partial<Ticket>): Promise<Ticket | undefined> {
    const [ticket] = await db.update(tickets).set(data).where(eq(tickets.id, id)).returning();
    return ticket;
  }
  async deleteTicket(id: string): Promise<boolean> {
    const result = await db.delete(tickets).where(eq(tickets.id, id)).returning();
    return result.length > 0;
  }

  // Ticket Comments
  async getTicketComments(ticketId: string): Promise<TicketComment[]> {
    return await db.select().from(ticketComments).where(eq(ticketComments.ticketId, ticketId));
  }
  async createTicketComment(insertComment: InsertTicketComment): Promise<TicketComment> {
    const [comment] = await db.insert(ticketComments).values(insertComment).returning();
    return comment;
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }
  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(insertProject).returning();
    return project;
  }
  async updateProject(id: string, data: Partial<Project>): Promise<Project | undefined> {
    const [project] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
    return project;
  }
  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  // Kanban Columns
  async getKanbanColumns(projectId: string): Promise<KanbanColumn[]> {
    return await db.select().from(kanbanColumns).where(eq(kanbanColumns.projectId, projectId));
  }
  async createKanbanColumn(insertColumn: InsertKanbanColumn): Promise<KanbanColumn> {
    const [column] = await db.insert(kanbanColumns).values(insertColumn).returning();
    return column;
  }
  async updateKanbanColumn(id: string, data: Partial<KanbanColumn>): Promise<KanbanColumn | undefined> {
    const [column] = await db.update(kanbanColumns).set(data).where(eq(kanbanColumns.id, id)).returning();
    return column;
  }
  async deleteKanbanColumn(id: string): Promise<boolean> {
    const result = await db.delete(kanbanColumns).where(eq(kanbanColumns.id, id)).returning();
    return result.length > 0;
  }

  // Kanban Cards
  async getKanbanCard(id: string): Promise<KanbanCard | undefined> {
    const [card] = await db.select().from(kanbanCards).where(eq(kanbanCards.id, id));
    return card;
  }
  async getKanbanCards(projectId: string): Promise<KanbanCard[]> {
    return await db.select().from(kanbanCards).where(eq(kanbanCards.projectId, projectId));
  }
  async createKanbanCard(insertCard: InsertKanbanCard): Promise<KanbanCard> {
    const [card] = await db.insert(kanbanCards).values(insertCard).returning();
    return card;
  }
  async updateKanbanCard(id: string, data: Partial<KanbanCard>): Promise<KanbanCard | undefined> {
    const [card] = await db.update(kanbanCards).set(data).where(eq(kanbanCards.id, id)).returning();
    return card;
  }
  async deleteKanbanCard(id: string): Promise<boolean> {
    const result = await db.delete(kanbanCards).where(eq(kanbanCards.id, id)).returning();
    return result.length > 0;
  }

  // Kanban Comments
  async getKanbanComments(cardId: string): Promise<KanbanComment[]> {
    return await db.select().from(kanbanComments).where(eq(kanbanComments.cardId, cardId));
  }
  async createKanbanComment(insertComment: InsertKanbanComment): Promise<KanbanComment> {
    const [comment] = await db.insert(kanbanComments).values(insertComment).returning();
    return comment;
  }

  // Objectives
  async getObjective(id: string): Promise<Objective | undefined> {
    const [obj] = await db.select().from(objectives).where(eq(objectives.id, id));
    return obj;
  }
  async getObjectives(): Promise<Objective[]> {
    return await db.select().from(objectives);
  }
  async createObjective(insertObjective: InsertObjective): Promise<Objective> {
    const [obj] = await db.insert(objectives).values(insertObjective).returning();
    return obj;
  }
  async updateObjective(id: string, data: Partial<Objective>): Promise<Objective | undefined> {
    const [obj] = await db.update(objectives).set(data).where(eq(objectives.id, id)).returning();
    return obj;
  }
  async deleteObjective(id: string): Promise<boolean> {
    const result = await db.delete(objectives).where(eq(objectives.id, id)).returning();
    return result.length > 0;
  }

  // Key Results
  async getKeyResults(): Promise<KeyResult[]> {
    return await db.select().from(keyResults);
  }
  async getKeyResultsByObjective(objectiveId: string): Promise<KeyResult[]> {
    return await db.select().from(keyResults).where(eq(keyResults.objectiveId, objectiveId));
  }
  async createKeyResult(insertKR: InsertKeyResult): Promise<KeyResult> {
    const [kr] = await db.insert(keyResults).values(insertKR).returning();
    return kr;
  }
  async updateKeyResult(id: string, data: Partial<KeyResult>): Promise<KeyResult | undefined> {
    const [kr] = await db.update(keyResults).set(data).where(eq(keyResults.id, id)).returning();
    return kr;
  }
  async deleteKeyResult(id: string): Promise<boolean> {
    const result = await db.delete(keyResults).where(eq(keyResults.id, id)).returning();
    return result.length > 0;
  }

  // Shipments
  async getShipment(id: string): Promise<Shipment | undefined> {
    const [s] = await db.select().from(shipments).where(eq(shipments.id, id));
    return s;
  }
  async getShipments(): Promise<Shipment[]> {
    return await db.select().from(shipments);
  }
  async createShipment(insertShipment: InsertShipment): Promise<Shipment> {
    const [s] = await db.insert(shipments).values(insertShipment).returning();
    return s;
  }
  async updateShipment(id: string, data: Partial<Shipment>): Promise<Shipment | undefined> {
    const [s] = await db.update(shipments).set(data).where(eq(shipments.id, id)).returning();
    return s;
  }
  async deleteShipment(id: string): Promise<boolean> {
    const result = await db.delete(shipments).where(eq(shipments.id, id)).returning();
    return result.length > 0;
  }

  // Shipment Events
  async getShipmentEvents(shipmentId: string): Promise<ShipmentEvent[]> {
    return await db.select().from(shipmentEvents).where(eq(shipmentEvents.shipmentId, shipmentId));
  }
  async createShipmentEvent(insertEvent: InsertShipmentEvent): Promise<ShipmentEvent> {
    const [e] = await db.insert(shipmentEvents).values(insertEvent).returning();
    return e;
  }

  // Settings
  async getSetting(key: string): Promise<Setting | undefined> {
    const [s] = await db.select().from(settings).where(eq(settings.key, key));
    return s;
  }
  async getSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }
  async setSetting(key: string, value: string): Promise<Setting> {
    const existing = await this.getSetting(key);
    if (existing) {
      const [updated] = await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(settings).values({ key, value }).returning();
    return created;
  }

  // Task Areas
  async getTaskArea(id: string): Promise<TaskArea | undefined> {
    const [a] = await db.select().from(taskAreas).where(eq(taskAreas.id, id));
    return a;
  }
  async getTaskAreas(userId: string): Promise<TaskArea[]> {
    // Basic shared logic for MVP
    return await db.select().from(taskAreas);
  }
  async createTaskArea(insertArea: InsertTaskArea): Promise<TaskArea> {
    const [a] = await db.insert(taskAreas).values(insertArea).returning();
    return a;
  }
  async updateTaskArea(id: string, data: Partial<TaskArea>): Promise<TaskArea | undefined> {
    const [a] = await db.update(taskAreas).set(data).where(eq(taskAreas.id, id)).returning();
    return a;
  }
  async deleteTaskArea(id: string): Promise<boolean> {
    const result = await db.delete(taskAreas).where(eq(taskAreas.id, id)).returning();
    return result.length > 0;
  }

  // Task Area Members
  async getTaskAreaMembers(areaId: string): Promise<TaskAreaMember[]> {
    return await db.select().from(taskAreaMembers).where(eq(taskAreaMembers.areaId, areaId));
  }
  async addTaskAreaMember(member: InsertTaskAreaMember): Promise<TaskAreaMember> {
    const [m] = await db.insert(taskAreaMembers).values(member).returning();
    return m;
  }
  async updateTaskAreaMember(id: string, data: Partial<TaskAreaMember>): Promise<TaskAreaMember | undefined> {
    const [m] = await db.update(taskAreaMembers).set(data).where(eq(taskAreaMembers.id, id)).returning();
    return m;
  }
  async removeTaskAreaMember(id: string): Promise<boolean> {
    const result = await db.delete(taskAreaMembers).where(eq(taskAreaMembers.id, id)).returning();
    return result.length > 0;
  }

  // Tasks
  async getTask(id: string): Promise<Task | undefined> {
    const [t] = await db.select().from(tasks).where(eq(tasks.id, id));
    return t;
  }
  async getTasks(filters?: { areaId?: string; status?: string; assigneeId?: string; createdBy?: string; type?: string }): Promise<Task[]> {
    let query = db.select().from(tasks);
    // Simple filter handling
    return await query;
  }
  async createTask(task: InsertTask): Promise<Task> {
    const [t] = await db.insert(tasks).values(task).returning();
    return t;
  }
  async updateTask(id: string, data: Partial<Task>): Promise<Task | undefined> {
    const [t] = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning();
    return t;
  }
  async deleteTask(id: string): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    return result.length > 0;
  }

  // Task Comments
  async getTaskComments(taskId: string): Promise<TaskComment[]> {
    return await db.select().from(taskComments).where(eq(taskComments.taskId, taskId));
  }
  async getTaskComment(id: string): Promise<TaskComment | undefined> {
    const [c] = await db.select().from(taskComments).where(eq(taskComments.id, id));
    return c;
  }
  async createTaskComment(comment: InsertTaskComment): Promise<TaskComment> {
    const [c] = await db.insert(taskComments).values(comment).returning();
    return c;
  }
  async updateTaskComment(id: string, data: Partial<TaskComment>): Promise<TaskComment | undefined> {
    const [c] = await db.update(taskComments).set(data).where(eq(taskComments.id, id)).returning();
    return c;
  }
  async deleteTaskComment(id: string): Promise<boolean> {
    const result = await db.delete(taskComments).where(eq(taskComments.id, id)).returning();
    return result.length > 0;
  }

  // Task Reactions
  async getTaskReactions(commentId: string): Promise<TaskReaction[]> {
    return await db.select().from(taskReactions).where(eq(taskReactions.commentId, commentId));
  }
  async addTaskReaction(reaction: InsertTaskReaction): Promise<TaskReaction> {
    const [r] = await db.insert(taskReactions).values(reaction).returning();
    return r;
  }
  async removeTaskReaction(id: string): Promise<boolean> {
    const result = await db.delete(taskReactions).where(eq(taskReactions.id, id)).returning();
    return result.length > 0;
  }

  // Task Attachments
  async getTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
    return await db.select().from(taskAttachments).where(eq(taskAttachments.taskId, taskId));
  }
  async addTaskAttachment(attachment: InsertTaskAttachment): Promise<TaskAttachment> {
    const [a] = await db.insert(taskAttachments).values(attachment).returning();
    return a;
  }
  async removeTaskAttachment(id: string): Promise<boolean> {
    const result = await db.delete(taskAttachments).where(eq(taskAttachments.id, id)).returning();
    return result.length > 0;
  }

  // Task Templates
  async getTaskTemplates(type?: string): Promise<TaskTemplate[]> {
    return await db.select().from(taskTemplates);
  }
  async getTaskTemplate(id: string): Promise<TaskTemplate | undefined> {
    const [t] = await db.select().from(taskTemplates).where(eq(taskTemplates.id, id));
    return t;
  }
  async createTaskTemplate(template: InsertTaskTemplate): Promise<TaskTemplate> {
    const [t] = await db.insert(taskTemplates).values(template).returning();
    return t;
  }

  // Logistic Operators
  async getLogisticOperator(id: string): Promise<LogisticOperator | undefined> {
    const [o] = await db.select().from(logisticOperators).where(eq(logisticOperators.id, id));
    return o;
  }
  async getLogisticOperators(): Promise<LogisticOperator[]> {
    return await db.select().from(logisticOperators);
  }
  async createLogisticOperator(operator: InsertLogisticOperator): Promise<LogisticOperator> {
    const [o] = await db.insert(logisticOperators).values(operator).returning();
    return o;
  }
  async updateLogisticOperator(id: string, data: Partial<LogisticOperator>): Promise<LogisticOperator | undefined> {
    const [o] = await db.update(logisticOperators).set(data).where(eq(logisticOperators.id, id)).returning();
    return o;
  }
  async deleteLogisticOperator(id: string): Promise<boolean> {
    const result = await db.delete(logisticOperators).where(eq(logisticOperators.id, id)).returning();
    return result.length > 0;
  }

  // Collection Requests
  async getCollectionRequest(id: string): Promise<CollectionRequest | undefined> {
    const [r] = await db.select().from(collectionRequests).where(eq(collectionRequests.id, id));
    return r;
  }
  async getCollectionRequests(): Promise<CollectionRequest[]> {
    return await db.select().from(collectionRequests);
  }
  async createCollectionRequest(request: InsertCollectionRequest): Promise<CollectionRequest> {
    const [r] = await db.insert(collectionRequests).values(request).returning();
    return r;
  }
  async updateCollectionRequest(id: string, data: Partial<CollectionRequest>): Promise<CollectionRequest | undefined> {
    const [r] = await db.update(collectionRequests).set(data).where(eq(collectionRequests.id, id)).returning();
    return r;
  }
  async deleteCollectionRequest(id: string): Promise<boolean> {
    const result = await db.delete(collectionRequests).where(eq(collectionRequests.id, id)).returning();
    return result.length > 0;
  }

  // Logistica Reversa Pedidos
  async getLogisticaReversaPedido(id: string): Promise<LogisticaReversaPedido | undefined> {
    const [p] = await db.select().from(logisticaReversaPedidos).where(eq(logisticaReversaPedidos.id, id));
    return p;
  }
  async getLogisticaReversaPedidos(): Promise<LogisticaReversaPedido[]> {
    return await db.select().from(logisticaReversaPedidos);
  }
  async createLogisticaReversaPedido(pedido: InsertLogisticaReversaPedido): Promise<LogisticaReversaPedido> {
    const [p] = await db.insert(logisticaReversaPedidos).values(pedido).returning();
    return p;
  }
  async updateLogisticaReversaPedido(id: string, data: Partial<LogisticaReversaPedido>): Promise<LogisticaReversaPedido | undefined> {
    const [p] = await db.update(logisticaReversaPedidos).set(data).where(eq(logisticaReversaPedidos.id, id)).returning();
    return p;
  }
  async deleteLogisticaReversaPedido(id: string): Promise<boolean> {
    const result = await db.delete(logisticaReversaPedidos).where(eq(logisticaReversaPedidos.id, id)).returning();
    return result.length > 0;
  }

  // Logistica Reversa Eventos
  async getLogisticaReversaEventos(pedidoId: string): Promise<LogisticaReversaEvento[]> {
    return await db.select().from(logisticaReversaEventos).where(eq(logisticaReversaEventos.pedidoId, pedidoId));
  }
  async createLogisticaReversaEvento(evento: InsertLogisticaReversaEvento): Promise<LogisticaReversaEvento> {
    const [e] = await db.insert(logisticaReversaEventos).values(evento).returning();
    return e;
  }

  // Dashboard Stats
  async getLogisticsDashboardStats(): Promise<LogisticsDashboardStats> {
    return {
      totalRequests: 0,
      totalValue: 0,
      onTimeRate: 0,
      savings: 0,
      pendingRequests: 0,
      deliveredRequests: 0
    };
  }
}

export const storage = new DatabaseStorage();
