import { 
  type User, type InsertUser,
  type Ticket, type InsertTicket,
  type TicketResponsavel, type InsertTicketResponsavel,
  type TicketComment, type InsertTicketComment,
  type Project, type InsertProject,
  type KanbanColumn, type InsertKanbanColumn,
  type KanbanCard, type InsertKanbanCard,
  type KanbanComment, type InsertKanbanComment,
  type Objective, type InsertObjective,
  type KeyResult, type InsertKeyResult,
  type KeyResultUpdate, type InsertKeyResultUpdate,
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
  type SlaRule, type InsertSlaRule,
  type PricingDevice, type InsertPricingDevice,
  type PricingPriceHistory, type InsertPricingPriceHistory,
  type PricingAlert, type InsertPricingAlert,
  type MetaArea, type InsertMetaArea,
  type Meta, type InsertMeta,
  type MetaCheckin, type InsertMetaCheckin,
  type KnowledgeDocument, type InsertKnowledgeDocument,
  type KnowledgeDocumentVersion, type InsertKnowledgeDocumentVersion,
  type KnowledgeAuditLog, type InsertKnowledgeAuditLog,
  type KnowledgeFavorite, type InsertKnowledgeFavorite,
  type AiConversation, type InsertAiConversation,
  type AiMessage, type InsertAiMessage,
  users, tickets, ticketResponsaveis, ticketComments, projects, kanbanColumns, kanbanCards, kanbanComments,
  objectives, keyResults, keyResultUpdates, shipments, shipmentEvents, settings, taskAreas, taskAreaMembers,
  tasks, taskComments, taskReactions, taskAttachments, taskTemplates, logisticOperators,
  collectionRequests, logisticaReversaPedidos, logisticaReversaEventos, slaRules,
  pricingDevices, pricingPriceHistory, pricingAlerts,
  metaAreas, metas, metaCheckins,
  knowledgeDocuments, knowledgeDocumentVersions, knowledgeAuditLogs, knowledgeFavorites,
  aiConversations, aiMessages
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

  // Ticket Responsaveis (Assignment Rules)
  getTicketResponsaveis(): Promise<TicketResponsavel[]>;
  getTicketResponsavel(id: string): Promise<TicketResponsavel | undefined>;
  getTicketResponsavelByRule(categoria: string, tipo: string): Promise<TicketResponsavel[]>;
  createTicketResponsavel(data: InsertTicketResponsavel): Promise<TicketResponsavel>;
  updateTicketResponsavel(id: string, data: Partial<TicketResponsavel>): Promise<TicketResponsavel | undefined>;
  deleteTicketResponsavel(id: string): Promise<boolean>;
  findResponsavelForTicket(categoria: string, tipo: string): Promise<string | null>;

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
  getKeyResult(id: string): Promise<KeyResult | undefined>;
  getKeyResults(): Promise<KeyResult[]>;
  getKeyResultsByObjective(objectiveId: string): Promise<KeyResult[]>;
  createKeyResult(kr: InsertKeyResult): Promise<KeyResult>;
  updateKeyResult(id: string, data: Partial<KeyResult>): Promise<KeyResult | undefined>;
  deleteKeyResult(id: string): Promise<boolean>;

  // Key Result Updates (Check-ins)
  getKeyResultUpdates(keyResultId: string): Promise<KeyResultUpdate[]>;
  createKeyResultUpdate(update: InsertKeyResultUpdate): Promise<KeyResultUpdate>;

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

  // SLA Rules
  getSlaRules(): Promise<SlaRule[]>;
  getSlaRule(id: string): Promise<SlaRule | undefined>;
  getSlaRuleByTipoAndPrioridade(tipo: string, prioridade: string): Promise<SlaRule | undefined>;
  createSlaRule(rule: InsertSlaRule): Promise<SlaRule>;
  updateSlaRule(id: string, data: Partial<SlaRule>): Promise<SlaRule | undefined>;
  deleteSlaRule(id: string): Promise<boolean>;

  // Pricing Devices
  getPricingDevice(id: string): Promise<PricingDevice | undefined>;
  getPricingDevices(filters?: { categoryId?: string; manufacturerName?: string; isActive?: boolean }): Promise<PricingDevice[]>;
  createPricingDevice(device: InsertPricingDevice): Promise<PricingDevice>;
  updatePricingDevice(id: string, data: Partial<PricingDevice>): Promise<PricingDevice | undefined>;
  deletePricingDevice(id: string): Promise<boolean>;

  // Pricing Price History
  getPricingPriceHistory(deviceId: string, startDate?: Date, endDate?: Date): Promise<PricingPriceHistory[]>;
  createPricingPriceHistory(history: InsertPricingPriceHistory): Promise<PricingPriceHistory>;

  // Pricing Alerts
  getPricingAlerts(userId?: string): Promise<PricingAlert[]>;
  getPricingAlert(id: string): Promise<PricingAlert | undefined>;
  createPricingAlert(alert: InsertPricingAlert): Promise<PricingAlert>;
  updatePricingAlert(id: string, data: Partial<PricingAlert>): Promise<PricingAlert | undefined>;
  deletePricingAlert(id: string): Promise<boolean>;

  // Meta Areas
  getMetaAreas(): Promise<MetaArea[]>;
  getMetaArea(id: string): Promise<MetaArea | undefined>;
  getMetaAreaByName(name: string): Promise<MetaArea | undefined>;
  createMetaArea(area: InsertMetaArea): Promise<MetaArea>;
  updateMetaArea(id: string, data: Partial<MetaArea>): Promise<MetaArea | undefined>;
  deleteMetaArea(id: string): Promise<boolean>;

  // Metas (Goals)
  getMetas(filters?: { month?: string; areaId?: string; responsibleId?: string }): Promise<Meta[]>;
  getMeta(id: string): Promise<Meta | undefined>;
  createMeta(meta: InsertMeta): Promise<Meta>;
  updateMeta(id: string, data: Partial<Meta>): Promise<Meta | undefined>;
  deleteMeta(id: string): Promise<boolean>;

  // Meta Check-ins
  getMetaCheckins(metaId: string): Promise<MetaCheckin[]>;
  createMetaCheckin(checkin: InsertMetaCheckin): Promise<MetaCheckin>;

  // Knowledge Base Documents
  getKnowledgeDocuments(filters?: { area?: string; tipo?: string; status?: string; search?: string }): Promise<KnowledgeDocument[]>;
  getKnowledgeDocument(id: string): Promise<KnowledgeDocument | undefined>;
  createKnowledgeDocument(doc: InsertKnowledgeDocument): Promise<KnowledgeDocument>;
  updateKnowledgeDocument(id: string, data: Partial<KnowledgeDocument>): Promise<KnowledgeDocument | undefined>;
  deleteKnowledgeDocument(id: string): Promise<boolean>;
  getKnowledgeDocumentStats(): Promise<{ total: number; byTipo: Record<string, number>; byArea: Record<string, number>; byStatus: Record<string, number> }>;

  // Knowledge Document Versions
  getKnowledgeDocumentVersions(documentId: string): Promise<KnowledgeDocumentVersion[]>;
  createKnowledgeDocumentVersion(version: InsertKnowledgeDocumentVersion): Promise<KnowledgeDocumentVersion>;

  // Knowledge Audit Logs
  getKnowledgeAuditLogs(documentId: string): Promise<KnowledgeAuditLog[]>;
  createKnowledgeAuditLog(log: InsertKnowledgeAuditLog): Promise<KnowledgeAuditLog>;

  // Knowledge Favorites
  getKnowledgeFavorites(userId: string): Promise<KnowledgeFavorite[]>;
  getKnowledgeFavorite(userId: string, documentId: string): Promise<KnowledgeFavorite | undefined>;
  createKnowledgeFavorite(favorite: InsertKnowledgeFavorite): Promise<KnowledgeFavorite>;
  deleteKnowledgeFavorite(id: string): Promise<boolean>;

  // AI Conversations
  getAiConversations(userId: string): Promise<AiConversation[]>;
  getAiConversation(id: string): Promise<AiConversation | undefined>;
  createAiConversation(conversation: InsertAiConversation): Promise<AiConversation>;
  updateAiConversation(id: string, data: Partial<AiConversation>): Promise<AiConversation | undefined>;
  deleteAiConversation(id: string): Promise<boolean>;

  // AI Messages
  getAiMessages(conversationId: string): Promise<AiMessage[]>;
  createAiMessage(message: InsertAiMessage): Promise<AiMessage>;
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
    // Generate sequential code like CHA-0001
    const allTickets = await db.select().from(tickets);
    const nextNumber = allTickets.length + 1;
    const code = `CHA-${String(nextNumber).padStart(4, '0')}`;
    
    const [ticket] = await db.insert(tickets).values({ ...insertTicket, code }).returning();
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

  // Ticket Responsaveis (Assignment Rules)
  async getTicketResponsaveis(): Promise<TicketResponsavel[]> {
    return await db.select().from(ticketResponsaveis);
  }
  async getTicketResponsavel(id: string): Promise<TicketResponsavel | undefined> {
    const [resp] = await db.select().from(ticketResponsaveis).where(eq(ticketResponsaveis.id, id));
    return resp;
  }
  async getTicketResponsavelByRule(categoria: string, tipo: string): Promise<TicketResponsavel[]> {
    return await db.select().from(ticketResponsaveis).where(
      and(
        eq(ticketResponsaveis.categoria, categoria),
        eq(ticketResponsaveis.tipo, tipo),
        eq(ticketResponsaveis.ativo, true)
      )
    );
  }
  async createTicketResponsavel(data: InsertTicketResponsavel): Promise<TicketResponsavel> {
    const [resp] = await db.insert(ticketResponsaveis).values(data).returning();
    return resp;
  }
  async updateTicketResponsavel(id: string, data: Partial<TicketResponsavel>): Promise<TicketResponsavel | undefined> {
    const [resp] = await db.update(ticketResponsaveis).set(data).where(eq(ticketResponsaveis.id, id)).returning();
    return resp;
  }
  async deleteTicketResponsavel(id: string): Promise<boolean> {
    const result = await db.delete(ticketResponsaveis).where(eq(ticketResponsaveis.id, id)).returning();
    return result.length > 0;
  }
  async findResponsavelForTicket(categoria: string, tipo: string): Promise<string | null> {
    const rules = await this.getTicketResponsavelByRule(categoria, tipo);
    if (rules.length === 0) return null;
    
    if (rules.length === 1) {
      return rules[0].usuarioResponsavelId;
    }
    
    const allTickets = await this.getTickets();
    const openTicketCounts = new Map<string, number>();
    
    for (const rule of rules) {
      const count = allTickets.filter(t => 
        t.assigneeId === rule.usuarioResponsavelId && 
        t.status !== 'closed' && t.status !== 'resolved'
      ).length;
      openTicketCounts.set(rule.usuarioResponsavelId, count);
    }
    
    let minCount = Infinity;
    let selectedResponsavel = rules[0].usuarioResponsavelId;
    const entries = Array.from(openTicketCounts.entries());
    for (const entry of entries) {
      const userId = entry[0];
      const count = entry[1];
      if (count < minCount) {
        minCount = count;
        selectedResponsavel = userId;
      }
    }
    
    return selectedResponsavel;
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
    // Generate sequential code like PRO-0001
    const allProjects = await db.select().from(projects);
    const nextNumber = allProjects.length + 1;
    const code = `PRO-${String(nextNumber).padStart(4, '0')}`;
    
    const [project] = await db.insert(projects).values({ ...insertProject, code }).returning();
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
  async getKeyResult(id: string): Promise<KeyResult | undefined> {
    const [kr] = await db.select().from(keyResults).where(eq(keyResults.id, id));
    return kr;
  }
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
    const updateData = { ...data, updatedAt: new Date() };
    const [kr] = await db.update(keyResults).set(updateData).where(eq(keyResults.id, id)).returning();
    return kr;
  }
  async deleteKeyResult(id: string): Promise<boolean> {
    const result = await db.delete(keyResults).where(eq(keyResults.id, id)).returning();
    return result.length > 0;
  }

  // Key Result Updates (Check-ins)
  async getKeyResultUpdates(keyResultId: string): Promise<KeyResultUpdate[]> {
    return await db.select().from(keyResultUpdates).where(eq(keyResultUpdates.keyResultId, keyResultId));
  }
  async createKeyResultUpdate(update: InsertKeyResultUpdate): Promise<KeyResultUpdate> {
    const [u] = await db.insert(keyResultUpdates).values(update).returning();
    return u;
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
    let baseQuery = db.select().from(tasks);
    const conditions = [];
    if (filters?.areaId) conditions.push(eq(tasks.areaId, filters.areaId));
    if (filters?.status) conditions.push(eq(tasks.status, filters.status));
    if (filters?.assigneeId) conditions.push(eq(tasks.assigneeId, filters.assigneeId));
    if (filters?.createdBy) conditions.push(eq(tasks.createdBy, filters.createdBy));
    if (filters?.type) conditions.push(eq(tasks.type, filters.type));
    
    if (conditions.length > 0) {
      return await baseQuery.where(and(...conditions));
    }
    return await baseQuery;
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
    if (type) {
      return await db.select().from(taskTemplates).where(eq(taskTemplates.type, type));
    }
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
    const allRequests = await this.getCollectionRequests();
    return {
      totalRequests: allRequests.length,
      totalValue: 12500, // Mock
      onTimeRate: 98,
      savings: 15,
      pendingRequests: allRequests.filter(r => r.status === "pending").length,
      deliveredRequests: allRequests.filter(r => r.status === "delivered").length,
    };
  }

  // SLA Rules
  async getSlaRules(): Promise<SlaRule[]> {
    return await db.select().from(slaRules);
  }
  async getSlaRule(id: string): Promise<SlaRule | undefined> {
    const [rule] = await db.select().from(slaRules).where(eq(slaRules.id, id));
    return rule;
  }
  async getSlaRuleByTipoAndPrioridade(tipo: string, prioridade: string): Promise<SlaRule | undefined> {
    const [rule] = await db.select().from(slaRules).where(
      and(
        eq(slaRules.tipo, tipo),
        eq(slaRules.prioridade, prioridade),
        eq(slaRules.ativo, true)
      )
    );
    return rule;
  }
  async createSlaRule(rule: InsertSlaRule): Promise<SlaRule> {
    const [created] = await db.insert(slaRules).values(rule).returning();
    return created;
  }
  async updateSlaRule(id: string, data: Partial<SlaRule>): Promise<SlaRule | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(slaRules).set(updateData).where(eq(slaRules.id, id)).returning();
    return updated;
  }
  async deleteSlaRule(id: string): Promise<boolean> {
    const result = await db.delete(slaRules).where(eq(slaRules.id, id)).returning();
    return result.length > 0;
  }

  // Pricing Devices
  async getPricingDevice(id: string): Promise<PricingDevice | undefined> {
    const [device] = await db.select().from(pricingDevices).where(eq(pricingDevices.id, id));
    return device;
  }
  async getPricingDevices(filters?: { categoryId?: string; manufacturerName?: string; isActive?: boolean }): Promise<PricingDevice[]> {
    let query = db.select().from(pricingDevices);
    const conditions: any[] = [];
    if (filters?.categoryId) {
      conditions.push(eq(pricingDevices.categoryId, filters.categoryId));
    }
    if (filters?.manufacturerName) {
      conditions.push(eq(pricingDevices.manufacturerName, filters.manufacturerName));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(pricingDevices.isActive, filters.isActive));
    }
    if (conditions.length > 0) {
      return await db.select().from(pricingDevices).where(and(...conditions));
    }
    return await db.select().from(pricingDevices);
  }
  async createPricingDevice(device: InsertPricingDevice): Promise<PricingDevice> {
    const [created] = await db.insert(pricingDevices).values(device).returning();
    return created;
  }
  async updatePricingDevice(id: string, data: Partial<PricingDevice>): Promise<PricingDevice | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(pricingDevices).set(updateData).where(eq(pricingDevices.id, id)).returning();
    return updated;
  }
  async deletePricingDevice(id: string): Promise<boolean> {
    const result = await db.delete(pricingDevices).where(eq(pricingDevices.id, id)).returning();
    return result.length > 0;
  }

  // Pricing Price History
  async getPricingPriceHistory(deviceId: string, startDate?: Date, endDate?: Date): Promise<PricingPriceHistory[]> {
    return await db.select().from(pricingPriceHistory).where(eq(pricingPriceHistory.deviceId, deviceId));
  }
  async createPricingPriceHistory(history: InsertPricingPriceHistory): Promise<PricingPriceHistory> {
    const [created] = await db.insert(pricingPriceHistory).values(history).returning();
    return created;
  }

  // Pricing Alerts
  async getPricingAlerts(userId?: string): Promise<PricingAlert[]> {
    if (userId) {
      return await db.select().from(pricingAlerts).where(eq(pricingAlerts.userId, userId));
    }
    return await db.select().from(pricingAlerts);
  }
  async getPricingAlert(id: string): Promise<PricingAlert | undefined> {
    const [alert] = await db.select().from(pricingAlerts).where(eq(pricingAlerts.id, id));
    return alert;
  }
  async createPricingAlert(alert: InsertPricingAlert): Promise<PricingAlert> {
    const [created] = await db.insert(pricingAlerts).values(alert).returning();
    return created;
  }
  async updatePricingAlert(id: string, data: Partial<PricingAlert>): Promise<PricingAlert | undefined> {
    const [updated] = await db.update(pricingAlerts).set(data).where(eq(pricingAlerts.id, id)).returning();
    return updated;
  }
  async deletePricingAlert(id: string): Promise<boolean> {
    const result = await db.delete(pricingAlerts).where(eq(pricingAlerts.id, id)).returning();
    return result.length > 0;
  }

  // Meta Areas
  async getMetaAreas(): Promise<MetaArea[]> {
    return await db.select().from(metaAreas).where(eq(metaAreas.archived, false));
  }
  async getMetaArea(id: string): Promise<MetaArea | undefined> {
    const [area] = await db.select().from(metaAreas).where(eq(metaAreas.id, id));
    return area;
  }
  async getMetaAreaByName(name: string): Promise<MetaArea | undefined> {
    const [area] = await db.select().from(metaAreas).where(
      and(
        sql`LOWER(${metaAreas.name}) = LOWER(${name})`,
        eq(metaAreas.archived, false)
      )
    );
    return area;
  }
  async createMetaArea(area: InsertMetaArea): Promise<MetaArea> {
    const [created] = await db.insert(metaAreas).values(area).returning();
    return created;
  }
  async updateMetaArea(id: string, data: Partial<MetaArea>): Promise<MetaArea | undefined> {
    const [updated] = await db.update(metaAreas).set(data).where(eq(metaAreas.id, id)).returning();
    return updated;
  }
  async deleteMetaArea(id: string): Promise<boolean> {
    const result = await db.delete(metaAreas).where(eq(metaAreas.id, id)).returning();
    return result.length > 0;
  }

  // Metas (Goals)
  async getMetas(filters?: { month?: string; areaId?: string; responsibleId?: string }): Promise<Meta[]> {
    const conditions = [];
    if (filters?.month) {
      conditions.push(eq(metas.month, filters.month));
    }
    if (filters?.areaId) {
      conditions.push(eq(metas.areaId, filters.areaId));
    }
    if (filters?.responsibleId) {
      conditions.push(eq(metas.responsibleId, filters.responsibleId));
    }
    if (conditions.length > 0) {
      return await db.select().from(metas).where(and(...conditions));
    }
    return await db.select().from(metas);
  }
  async getMeta(id: string): Promise<Meta | undefined> {
    const [meta] = await db.select().from(metas).where(eq(metas.id, id));
    return meta;
  }
  async createMeta(meta: InsertMeta): Promise<Meta> {
    const [created] = await db.insert(metas).values(meta).returning();
    return created;
  }
  async updateMeta(id: string, data: Partial<Meta>): Promise<Meta | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(metas).set(updateData).where(eq(metas.id, id)).returning();
    return updated;
  }
  async deleteMeta(id: string): Promise<boolean> {
    const result = await db.delete(metas).where(eq(metas.id, id)).returning();
    return result.length > 0;
  }

  // Meta Check-ins
  async getMetaCheckins(metaId: string): Promise<MetaCheckin[]> {
    return await db.select().from(metaCheckins).where(eq(metaCheckins.metaId, metaId));
  }
  async createMetaCheckin(checkin: InsertMetaCheckin): Promise<MetaCheckin> {
    const [created] = await db.insert(metaCheckins).values(checkin).returning();
    return created;
  }

  // Knowledge Base Documents
  async getKnowledgeDocuments(filters?: { area?: string; tipo?: string; status?: string; search?: string }): Promise<KnowledgeDocument[]> {
    const conditions = [];
    if (filters?.area) {
      conditions.push(eq(knowledgeDocuments.area, filters.area));
    }
    if (filters?.tipo) {
      conditions.push(eq(knowledgeDocuments.tipo, filters.tipo));
    }
    if (filters?.status) {
      conditions.push(eq(knowledgeDocuments.status, filters.status));
    }
    if (filters?.search) {
      const searchTerm = `%${filters.search.toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${knowledgeDocuments.titulo}) LIKE ${searchTerm}`,
          sql`LOWER(${knowledgeDocuments.nomeArquivo}) LIKE ${searchTerm}`,
          sql`LOWER(${knowledgeDocuments.conteudo}) LIKE ${searchTerm}`,
          sql`LOWER(${knowledgeDocuments.tags}) LIKE ${searchTerm}`
        )
      );
    }
    if (conditions.length > 0) {
      return await db.select().from(knowledgeDocuments).where(and(...conditions)).orderBy(sql`${knowledgeDocuments.createdAt} DESC`);
    }
    return await db.select().from(knowledgeDocuments).orderBy(sql`${knowledgeDocuments.createdAt} DESC`);
  }

  async getKnowledgeDocument(id: string): Promise<KnowledgeDocument | undefined> {
    const [doc] = await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, id));
    return doc;
  }

  async createKnowledgeDocument(doc: InsertKnowledgeDocument): Promise<KnowledgeDocument> {
    const { id, ...data } = doc as any;
    const [created] = await db.insert(knowledgeDocuments).values(data).returning();
    return created;
  }

  async updateKnowledgeDocument(id: string, data: Partial<KnowledgeDocument>): Promise<KnowledgeDocument | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(knowledgeDocuments).set(updateData).where(eq(knowledgeDocuments.id, id)).returning();
    return updated;
  }

  async deleteKnowledgeDocument(id: string): Promise<boolean> {
    const result = await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, id)).returning();
    return result.length > 0;
  }

  async getKnowledgeDocumentStats(): Promise<{ total: number; byTipo: Record<string, number>; byArea: Record<string, number>; byStatus: Record<string, number> }> {
    const docs = await this.getKnowledgeDocuments();
    const byTipo: Record<string, number> = {};
    const byArea: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    docs.forEach(doc => {
      byTipo[doc.tipo] = (byTipo[doc.tipo] || 0) + 1;
      byArea[doc.area] = (byArea[doc.area] || 0) + 1;
      byStatus[doc.status] = (byStatus[doc.status] || 0) + 1;
    });

    return { total: docs.length, byTipo, byArea, byStatus };
  }

  // Knowledge Document Versions
  async getKnowledgeDocumentVersions(documentId: string): Promise<KnowledgeDocumentVersion[]> {
    return await db.select().from(knowledgeDocumentVersions).where(eq(knowledgeDocumentVersions.documentId, documentId)).orderBy(sql`${knowledgeDocumentVersions.createdAt} DESC`);
  }

  async createKnowledgeDocumentVersion(version: InsertKnowledgeDocumentVersion): Promise<KnowledgeDocumentVersion> {
    const [created] = await db.insert(knowledgeDocumentVersions).values(version).returning();
    return created;
  }

  // Knowledge Audit Logs
  async getKnowledgeAuditLogs(documentId: string): Promise<KnowledgeAuditLog[]> {
    return await db.select().from(knowledgeAuditLogs).where(eq(knowledgeAuditLogs.documentId, documentId)).orderBy(sql`${knowledgeAuditLogs.createdAt} DESC`);
  }

  async createKnowledgeAuditLog(log: InsertKnowledgeAuditLog): Promise<KnowledgeAuditLog> {
    const [created] = await db.insert(knowledgeAuditLogs).values(log).returning();
    return created;
  }

  // Knowledge Favorites
  async getKnowledgeFavorites(userId: string): Promise<KnowledgeFavorite[]> {
    return await db.select().from(knowledgeFavorites).where(eq(knowledgeFavorites.userId, userId));
  }

  async getKnowledgeFavorite(userId: string, documentId: string): Promise<KnowledgeFavorite | undefined> {
    const [fav] = await db.select().from(knowledgeFavorites).where(
      and(eq(knowledgeFavorites.userId, userId), eq(knowledgeFavorites.documentId, documentId))
    );
    return fav;
  }

  async createKnowledgeFavorite(favorite: InsertKnowledgeFavorite): Promise<KnowledgeFavorite> {
    const [created] = await db.insert(knowledgeFavorites).values(favorite).returning();
    return created;
  }

  async deleteKnowledgeFavorite(id: string): Promise<boolean> {
    const result = await db.delete(knowledgeFavorites).where(eq(knowledgeFavorites.id, id)).returning();
    return result.length > 0;
  }

  // AI Conversations
  async getAiConversations(userId: string): Promise<AiConversation[]> {
    return await db.select().from(aiConversations).where(eq(aiConversations.userId, userId)).orderBy(sql`${aiConversations.updatedAt} DESC`);
  }

  async getAiConversation(id: string): Promise<AiConversation | undefined> {
    const [conv] = await db.select().from(aiConversations).where(eq(aiConversations.id, id));
    return conv;
  }

  async createAiConversation(conversation: InsertAiConversation): Promise<AiConversation> {
    const [created] = await db.insert(aiConversations).values(conversation).returning();
    return created;
  }

  async updateAiConversation(id: string, data: Partial<AiConversation>): Promise<AiConversation | undefined> {
    const [updated] = await db.update(aiConversations).set({ ...data, updatedAt: new Date() }).where(eq(aiConversations.id, id)).returning();
    return updated;
  }

  async deleteAiConversation(id: string): Promise<boolean> {
    await db.delete(aiMessages).where(eq(aiMessages.conversationId, id));
    const result = await db.delete(aiConversations).where(eq(aiConversations.id, id)).returning();
    return result.length > 0;
  }

  // AI Messages
  async getAiMessages(conversationId: string): Promise<AiMessage[]> {
    return await db.select().from(aiMessages).where(eq(aiMessages.conversationId, conversationId)).orderBy(sql`${aiMessages.createdAt} ASC`);
  }

  async createAiMessage(message: InsertAiMessage): Promise<AiMessage> {
    const [created] = await db.insert(aiMessages).values(message).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
