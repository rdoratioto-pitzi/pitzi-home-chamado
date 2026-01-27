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
} from "@shared/schema";
import { randomUUID } from "crypto";

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
  updateKanbanColumn(id: string, data: Partial<KanbanColumn>): Promise<KanbanColumn | undefined>;
  deleteKanbanColumn(id: string): Promise<boolean>;

  // Kanban Cards
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private tickets: Map<string, Ticket>;
  private ticketComments: Map<string, TicketComment>;
  private projects: Map<string, Project>;
  private kanbanColumns: Map<string, KanbanColumn>;
  private kanbanCards: Map<string, KanbanCard>;
  private kanbanComments: Map<string, KanbanComment>;
  private objectives: Map<string, Objective>;
  private keyResults: Map<string, KeyResult>;
  private shipments: Map<string, Shipment>;
  private shipmentEvents: Map<string, ShipmentEvent>;
  private settings: Map<string, Setting>;

  constructor() {
    this.users = new Map();
    this.tickets = new Map();
    this.ticketComments = new Map();
    this.projects = new Map();
    this.kanbanColumns = new Map();
    this.kanbanCards = new Map();
    this.kanbanComments = new Map();
    this.objectives = new Map();
    this.keyResults = new Map();
    this.shipments = new Map();
    this.shipmentEvents = new Map();
    this.settings = new Map();

    this.seedData();
  }

  private seedData() {
    // Seed admin user
    const adminUser: User = {
      id: "admin",
      name: "Administrador",
      email: "admin@renov.com",
      password: null,
      role: "admin",
      status: "active",
      authMethod: "email",
      avatarUrl: null,
      createdAt: new Date(),
    };
    this.users.set(adminUser.id, adminUser);

    // Seed sample tickets
    const sampleTickets: Ticket[] = [
      {
        id: randomUUID(),
        title: "Problema de acesso ao sistema ERP",
        description: "Não consigo acessar o módulo de relatórios desde ontem. Aparece erro de permissão.",
        category: "ti",
        priority: "high",
        status: "open",
        requesterId: "admin",
        assigneeId: null,
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(),
        dueDate: null,
      },
      {
        id: randomUUID(),
        title: "Solicitação de novo equipamento",
        description: "Preciso de um monitor adicional para aumentar a produtividade.",
        category: "ti",
        priority: "low",
        status: "in_progress",
        requesterId: "admin",
        assigneeId: "admin",
        createdAt: new Date(Date.now() - 172800000),
        updatedAt: new Date(),
        dueDate: null,
      },
      {
        id: randomUUID(),
        title: "Atualização de dados cadastrais",
        description: "Preciso atualizar meu endereço no sistema de RH.",
        category: "rh",
        priority: "medium",
        status: "resolved",
        requesterId: "admin",
        assigneeId: "admin",
        createdAt: new Date(Date.now() - 259200000),
        updatedAt: new Date(),
        dueDate: null,
      },
    ];
    sampleTickets.forEach(t => this.tickets.set(t.id, t));

    // Seed sample projects
    const sampleProject: Project = {
      id: randomUUID(),
      name: "Lançamento Renov 2.0",
      description: "Projeto de lançamento da nova versão da plataforma Renov com melhorias de UX e novas funcionalidades.",
      status: "active",
      ownerId: "admin",
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 86400000),
      createdAt: new Date(),
    };
    this.projects.set(sampleProject.id, sampleProject);

    // Seed columns for the project
    const columns = ["Backlog", "Em Andamento", "Revisão", "Concluído"];
    columns.forEach((name, index) => {
      const column: KanbanColumn = {
        id: randomUUID(),
        projectId: sampleProject.id,
        name,
        order: index,
      };
      this.kanbanColumns.set(column.id, column);
    });

    // Seed sample OKRs
    const currentYear = new Date().getFullYear();
    const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
    const cycle = `${currentYear} Q${currentQuarter}`;

    const sampleObjective: Objective = {
      id: randomUUID(),
      title: "Aumentar a satisfação do cliente",
      description: "Melhorar a experiência do usuário e reduzir o tempo de resposta ao suporte",
      ownerId: "admin",
      level: "company",
      cycle,
      status: "on_track",
      createdAt: new Date(),
    };
    this.objectives.set(sampleObjective.id, sampleObjective);

    const sampleKRs: KeyResult[] = [
      {
        id: randomUUID(),
        objectiveId: sampleObjective.id,
        title: "Atingir NPS de 80 pontos",
        targetValue: 80,
        currentValue: 65,
        unit: "pontos",
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        objectiveId: sampleObjective.id,
        title: "Reduzir tempo médio de resposta para 4 horas",
        targetValue: 4,
        currentValue: 6,
        unit: "horas",
        createdAt: new Date(),
      },
    ];
    sampleKRs.forEach(kr => this.keyResults.set(kr.id, kr));

    // Seed sample shipments
    const sampleShipments: Shipment[] = [
      {
        id: randomUUID(),
        trackingCode: "BR123456789SP",
        origin: "São Paulo, SP",
        destination: "Rio de Janeiro, RJ",
        status: "in_transit",
        carrier: "Correios",
        weight: "2.5 kg",
        dimensions: "30x20x15 cm",
        estimatedDelivery: new Date(Date.now() + 3 * 86400000),
        actualDelivery: null,
        notes: null,
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        trackingCode: "BR987654321MG",
        origin: "Belo Horizonte, MG",
        destination: "Curitiba, PR",
        status: "delivered",
        carrier: "Jadlog",
        weight: "1.2 kg",
        dimensions: "20x15x10 cm",
        estimatedDelivery: new Date(Date.now() - 86400000),
        actualDelivery: new Date(Date.now() - 43200000),
        notes: "Entregue ao porteiro",
        createdAt: new Date(Date.now() - 172800000),
        updatedAt: new Date(),
      },
    ];
    sampleShipments.forEach(s => this.shipments.set(s.id, s));
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id, createdAt: new Date() };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...data };
    this.users.set(id, updated);
    return updated;
  }

  // Tickets
  async getTicket(id: string): Promise<Ticket | undefined> {
    return this.tickets.get(id);
  }

  async getTickets(): Promise<Ticket[]> {
    return Array.from(this.tickets.values()).sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    const id = randomUUID();
    const ticket: Ticket = { 
      ...insertTicket, 
      id, 
      createdAt: new Date(), 
      updatedAt: new Date() 
    };
    this.tickets.set(id, ticket);
    return ticket;
  }

  async updateTicket(id: string, data: Partial<Ticket>): Promise<Ticket | undefined> {
    const ticket = this.tickets.get(id);
    if (!ticket) return undefined;
    const updated = { ...ticket, ...data, updatedAt: new Date() };
    this.tickets.set(id, updated);
    return updated;
  }

  async deleteTicket(id: string): Promise<boolean> {
    return this.tickets.delete(id);
  }

  // Ticket Comments
  async getTicketComments(ticketId: string): Promise<TicketComment[]> {
    return Array.from(this.ticketComments.values())
      .filter(c => c.ticketId === ticketId)
      .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
  }

  async createTicketComment(insertComment: InsertTicketComment): Promise<TicketComment> {
    const id = randomUUID();
    const comment: TicketComment = { ...insertComment, id, createdAt: new Date() };
    this.ticketComments.set(id, comment);
    return comment;
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const project: Project = { ...insertProject, id, createdAt: new Date() };
    this.projects.set(id, project);
    
    // Create default columns
    const defaultColumns = ["Backlog", "Em Andamento", "Revisão", "Concluído"];
    defaultColumns.forEach((name, order) => {
      const column: KanbanColumn = { id: randomUUID(), projectId: id, name, order };
      this.kanbanColumns.set(column.id, column);
    });
    
    return project;
  }

  async updateProject(id: string, data: Partial<Project>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    const updated = { ...project, ...data };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    // Delete related columns and cards
    Array.from(this.kanbanColumns.values())
      .filter(c => c.projectId === id)
      .forEach(c => this.kanbanColumns.delete(c.id));
    Array.from(this.kanbanCards.values())
      .filter(c => c.projectId === id)
      .forEach(c => this.kanbanCards.delete(c.id));
    return this.projects.delete(id);
  }

  // Kanban Columns
  async getKanbanColumns(projectId: string): Promise<KanbanColumn[]> {
    return Array.from(this.kanbanColumns.values())
      .filter(c => c.projectId === projectId)
      .sort((a, b) => a.order - b.order);
  }

  async createKanbanColumn(insertColumn: InsertKanbanColumn): Promise<KanbanColumn> {
    const id = randomUUID();
    const column: KanbanColumn = { ...insertColumn, id };
    this.kanbanColumns.set(id, column);
    return column;
  }

  async updateKanbanColumn(id: string, data: Partial<KanbanColumn>): Promise<KanbanColumn | undefined> {
    const column = this.kanbanColumns.get(id);
    if (!column) return undefined;
    const updated = { ...column, ...data };
    this.kanbanColumns.set(id, updated);
    return updated;
  }

  async updateKanbanColumn(id: string, data: Partial<KanbanColumn>): Promise<KanbanColumn | undefined> {
    const column = this.kanbanColumns.get(id);
    if (!column) return undefined;
    const updated = { ...column, ...data };
    this.kanbanColumns.set(id, updated);
    return updated;
  }

  async deleteKanbanColumn(id: string): Promise<boolean> {
    // Delete related cards
    Array.from(this.kanbanCards.values())
      .filter(c => c.columnId === id)
      .forEach(c => this.kanbanCards.delete(c.id));
    return this.kanbanColumns.delete(id);
  }

  // Kanban Cards
  async getKanbanCards(projectId: string): Promise<KanbanCard[]> {
    return Array.from(this.kanbanCards.values())
      .filter(c => c.projectId === projectId)
      .sort((a, b) => a.order - b.order);
  }

  async createKanbanCard(insertCard: InsertKanbanCard): Promise<KanbanCard> {
    const id = randomUUID();
    const card: KanbanCard = { ...insertCard, id, createdAt: new Date() };
    this.kanbanCards.set(id, card);
    return card;
  }

  async updateKanbanCard(id: string, data: Partial<KanbanCard>): Promise<KanbanCard | undefined> {
    const card = this.kanbanCards.get(id);
    if (!card) return undefined;
    const updated = { ...card, ...data };
    this.kanbanCards.set(id, updated);
    return updated;
  }

  async deleteKanbanCard(id: string): Promise<boolean> {
    // Delete related comments
    Array.from(this.kanbanComments.values())
      .filter(c => c.cardId === id)
      .forEach(c => this.kanbanComments.delete(c.id));
    return this.kanbanCards.delete(id);
  }

  // Kanban Comments
  async getKanbanComments(cardId: string): Promise<KanbanComment[]> {
    return Array.from(this.kanbanComments.values())
      .filter(c => c.cardId === cardId)
      .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
  }

  async createKanbanComment(insertComment: InsertKanbanComment): Promise<KanbanComment> {
    const id = randomUUID();
    const comment: KanbanComment = { ...insertComment, id, createdAt: new Date() };
    this.kanbanComments.set(id, comment);
    return comment;
  }

  // Objectives
  async getObjective(id: string): Promise<Objective | undefined> {
    return this.objectives.get(id);
  }

  async getObjectives(): Promise<Objective[]> {
    return Array.from(this.objectives.values()).sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async createObjective(insertObjective: InsertObjective): Promise<Objective> {
    const id = randomUUID();
    const objective: Objective = { ...insertObjective, id, createdAt: new Date() };
    this.objectives.set(id, objective);
    return objective;
  }

  async updateObjective(id: string, data: Partial<Objective>): Promise<Objective | undefined> {
    const objective = this.objectives.get(id);
    if (!objective) return undefined;
    const updated = { ...objective, ...data };
    this.objectives.set(id, updated);
    return updated;
  }

  async deleteObjective(id: string): Promise<boolean> {
    // Delete related key results
    Array.from(this.keyResults.values())
      .filter(kr => kr.objectiveId === id)
      .forEach(kr => this.keyResults.delete(kr.id));
    return this.objectives.delete(id);
  }

  // Key Results
  async getKeyResults(): Promise<KeyResult[]> {
    return Array.from(this.keyResults.values());
  }

  async getKeyResultsByObjective(objectiveId: string): Promise<KeyResult[]> {
    return Array.from(this.keyResults.values())
      .filter(kr => kr.objectiveId === objectiveId);
  }

  async createKeyResult(insertKR: InsertKeyResult): Promise<KeyResult> {
    const id = randomUUID();
    const kr: KeyResult = { ...insertKR, id, createdAt: new Date() };
    this.keyResults.set(id, kr);
    return kr;
  }

  async updateKeyResult(id: string, data: Partial<KeyResult>): Promise<KeyResult | undefined> {
    const kr = this.keyResults.get(id);
    if (!kr) return undefined;
    const updated = { ...kr, ...data };
    this.keyResults.set(id, updated);
    return updated;
  }

  async deleteKeyResult(id: string): Promise<boolean> {
    return this.keyResults.delete(id);
  }

  // Shipments
  async getShipment(id: string): Promise<Shipment | undefined> {
    return this.shipments.get(id);
  }

  async getShipments(): Promise<Shipment[]> {
    return Array.from(this.shipments.values()).sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async createShipment(insertShipment: InsertShipment): Promise<Shipment> {
    const id = randomUUID();
    const shipment: Shipment = { 
      ...insertShipment, 
      id, 
      createdAt: new Date(), 
      updatedAt: new Date() 
    };
    this.shipments.set(id, shipment);
    return shipment;
  }

  async updateShipment(id: string, data: Partial<Shipment>): Promise<Shipment | undefined> {
    const shipment = this.shipments.get(id);
    if (!shipment) return undefined;
    const updated = { ...shipment, ...data, updatedAt: new Date() };
    this.shipments.set(id, updated);
    
    // Create event for status change
    if (data.status && data.status !== shipment.status) {
      const event: ShipmentEvent = {
        id: randomUUID(),
        shipmentId: id,
        status: data.status,
        location: null,
        description: `Status alterado para ${data.status}`,
        timestamp: new Date(),
      };
      this.shipmentEvents.set(event.id, event);
    }
    
    return updated;
  }

  async deleteShipment(id: string): Promise<boolean> {
    // Delete related events
    Array.from(this.shipmentEvents.values())
      .filter(e => e.shipmentId === id)
      .forEach(e => this.shipmentEvents.delete(e.id));
    return this.shipments.delete(id);
  }

  // Shipment Events
  async getShipmentEvents(shipmentId: string): Promise<ShipmentEvent[]> {
    return Array.from(this.shipmentEvents.values())
      .filter(e => e.shipmentId === shipmentId)
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
  }

  async createShipmentEvent(insertEvent: InsertShipmentEvent): Promise<ShipmentEvent> {
    const id = randomUUID();
    const event: ShipmentEvent = { ...insertEvent, id };
    this.shipmentEvents.set(id, event);
    return event;
  }

  // Settings
  async getSetting(key: string): Promise<Setting | undefined> {
    return Array.from(this.settings.values()).find(s => s.key === key);
  }

  async getSettings(): Promise<Setting[]> {
    return Array.from(this.settings.values());
  }

  async setSetting(key: string, value: string): Promise<Setting> {
    const existing = await this.getSetting(key);
    if (existing) {
      const updated = { ...existing, value, updatedAt: new Date() };
      this.settings.set(existing.id, updated);
      return updated;
    }
    const id = randomUUID();
    const setting: Setting = { id, key, value, updatedAt: new Date() };
    this.settings.set(id, setting);
    return setting;
  }
}

export const storage = new MemStorage();
