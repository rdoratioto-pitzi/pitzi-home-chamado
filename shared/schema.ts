import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, decimal, jsonb, unique, bigint, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============== TENANTS (Multi-tenant) ==============
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  cnpj: text("cnpj"),
  logo: text("logo"),
  primaryColor: text("primary_color").default("#00A137"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// ============== USERS ==============
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password"),
  status: text("status").notNull().default("active"),
  authMethod: text("auth_method").notNull().default("email"),
  avatarUrl: text("avatar_url"),
  isAdmin: boolean("is_admin").default(false),
  areaNegocio: text("area_negocio"), // LAB, RH, COM, FIN, MKT, OPS, TI
  perfilAcesso: text("perfil_acesso"), // assistente, analista, gestor, diretor
  // Module permissions as JSON
  modulePermissions: text("module_permissions"), // JSON: { chamados: true, projetos: false, ... }
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Module permissions type
export type ModulePermissions = {
  chamados: boolean;
  projetos: boolean;
  tarefas: boolean;
  okrs: boolean;
  metas: boolean;
  fluxogramas: boolean;
  diagramas: boolean;
  logistica: boolean;
  pricing: boolean;
  conhecimento: boolean;
  apis: boolean;
  configuracoes: boolean;
  updates: boolean;
  estoques: boolean;
};

// ============== REFRESH TOKENS (JWT Auth) ==============
export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============== TICKETS (Chamados) ==============
export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  code: text("code").notNull(), // CHM-001, CHM-002, etc.
  title: text("title").notNull(),
  description: text("description").notNull(),
  attachments: text("attachments"), // JSON array of attachment URLs
  category: text("category").notNull(),
  type: text("type").notNull().default("bug"), // bug, melhoria, negocio
  location: text("location").notNull().default("outros"), // RS, RG, Dash, One, Home, Omie, Outros
  priority: text("priority").notNull().default("medium"),
  impact: text("impact").notNull().default("medio"), // baixo, medio, alto, critico
  status: text("status").notNull().default("open"), // open, in_progress, blocked, resolved, closed
  requesterId: varchar("requester_id").notNull(),
  assigneeId: varchar("assignee_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  dueDate: timestamp("due_date"),
  // Timestamp metrics
  dataAbertura: timestamp("data_abertura").defaultNow(),
  dataPrimeiraResposta: timestamp("data_primeira_resposta"),
  dataResolucao: timestamp("data_resolucao"),
  dataFechamento: timestamp("data_fechamento"),
  // Audit log for description edits
  descriptionLastEditedBy: varchar("description_last_edited_by"),
  descriptionLastEditedAt: timestamp("description_last_edited_at"),
  // CSAT - Satisfação do solicitante
  satisfactionRating: integer("satisfaction_rating"), // 1-5
  satisfactionComment: text("satisfaction_comment"),
  satisfactionCreatedAt: timestamp("satisfaction_created_at"),
});

export const insertTicketSchema = createInsertSchema(tickets).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;

// ============== TICKET RESPONSAVEIS (Assignment Rules) ==============
export const ticketResponsaveis = pgTable("ticket_responsaveis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  categoria: text("categoria").notNull(),
  tipo: text("tipo").notNull(),
  usuarioResponsavelId: varchar("usuario_responsavel_id").notNull(),
  ativo: boolean("ativo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTicketResponsavelSchema = createInsertSchema(ticketResponsaveis).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTicketResponsavel = z.infer<typeof insertTicketResponsavelSchema>;
export type TicketResponsavel = typeof ticketResponsaveis.$inferSelect;

// ============== TICKET COMMENTS ==============
export const ticketComments = pgTable("ticket_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  ticketId: varchar("ticket_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  attachments: text("attachments"), // JSON array of attachment URLs
  isInternal: boolean("is_internal").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTicketCommentSchema = createInsertSchema(ticketComments).omit({ id: true, createdAt: true });
export type InsertTicketComment = z.infer<typeof insertTicketCommentSchema>;
export type TicketComment = typeof ticketComments.$inferSelect;

// Ticket Comment with User data for JOIN queries
export type TicketCommentWithUser = typeof ticketComments.$inferSelect & {
  author: { id: string; name: string; email: string };
};

// ============== PROJECTS ==============
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  code: text("code").notNull().default(""), // PRO-0001, PRO-0002, etc.
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  visibility: text("visibility").notNull().default("private"),
  ownerId: varchar("owner_id").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

const baseInsertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export const insertProjectSchema = baseInsertProjectSchema.extend({
  startDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => 
    val ? (typeof val === 'string' ? new Date(val) : val) : null
  ),
  endDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => 
    val ? (typeof val === 'string' ? new Date(val) : val) : null
  ),
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// ============== PROJECT MEMBERS ==============
export const projectMembers = pgTable("project_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  projectId: varchar("project_id").notNull(),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull().default("viewer"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProjectMemberSchema = createInsertSchema(projectMembers).omit({ id: true, createdAt: true });
export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;
export type ProjectMember = typeof projectMembers.$inferSelect;

// ============== KANBAN COLUMNS ==============
export const kanbanColumns = pgTable("kanban_columns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  projectId: varchar("project_id").notNull(),
  name: text("name").notNull(),
  order: integer("order").notNull().default(0),
});

export const insertKanbanColumnSchema = createInsertSchema(kanbanColumns).omit({ id: true });
export type InsertKanbanColumn = z.infer<typeof insertKanbanColumnSchema>;
export type KanbanColumn = typeof kanbanColumns.$inferSelect;

// ============== KANBAN CARDS (Tasks) ==============
export const kanbanCards = pgTable("kanban_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  code: text("code").notNull(),
  columnId: varchar("column_id").notNull(),
  projectId: varchar("project_id").notNull(),
  title: text("title").notNull(),
  objectives: text("objectives"),
  development: text("development"),
  assigneeId: varchar("assignee_id"),
  reporterId: varchar("reporter_id"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  dueDate: timestamp("due_date"),
  tags: text("tags").array(),
  priority: text("priority").notNull().default("normal"),
  estimation: integer("estimation"),
  attachments: text("attachments").array(),
  order: integer("order").notNull().default(0),
  ticketId: varchar("ticket_id"),
  parentCardId: varchar("parent_card_id"),
  progress: integer("progress").default(0),
  checklist: text("checklist"),
  labelIds: text("label_ids"),
  status: text("status").notNull().default("todo"), // 'todo' | 'doing' | 'done'
  createdAt: timestamp("created_at").defaultNow(),
});

const baseInsertKanbanCardSchema = createInsertSchema(kanbanCards).omit({ id: true, createdAt: true });
export const insertKanbanCardSchema = baseInsertKanbanCardSchema.extend({
  startDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => 
    val ? (typeof val === 'string' ? new Date(val) : val) : null
  ),
  endDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => 
    val ? (typeof val === 'string' ? new Date(val) : val) : null
  ),
  dueDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => 
    val ? (typeof val === 'string' ? new Date(val) : val) : null
  ),
});
export type InsertKanbanCard = z.infer<typeof insertKanbanCardSchema>;
export type KanbanCard = typeof kanbanCards.$inferSelect;

// ============== KANBAN LABELS ==============
export const kanbanLabels = pgTable("kanban_labels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  projectId: varchar("project_id").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKanbanLabelSchema = createInsertSchema(kanbanLabels).omit({ id: true, createdAt: true });
export type InsertKanbanLabel = z.infer<typeof insertKanbanLabelSchema>;
export type KanbanLabel = typeof kanbanLabels.$inferSelect;

// ============== KANBAN CARD DEPENDENCIES ==============
export const kanbanCardDependencies = pgTable("kanban_card_dependencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  projectId: varchar("project_id").notNull(),
  blockingCardId: varchar("blocking_card_id").notNull(),
  blockedCardId: varchar("blocked_card_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKanbanCardDependencySchema = createInsertSchema(kanbanCardDependencies).omit({ id: true, createdAt: true });
export type InsertKanbanCardDependency = z.infer<typeof insertKanbanCardDependencySchema>;
export type KanbanCardDependency = typeof kanbanCardDependencies.$inferSelect;

// ============== KANBAN COMMENTS ==============
export const kanbanComments = pgTable("kanban_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  cardId: varchar("card_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKanbanCommentSchema = createInsertSchema(kanbanComments).omit({ id: true, createdAt: true });
export type InsertKanbanComment = z.infer<typeof insertKanbanCommentSchema>;
export type KanbanComment = typeof kanbanComments.$inferSelect;

// Kanban Comment with User data for JOIN queries
export type KanbanCommentWithUser = typeof kanbanComments.$inferSelect & {
  author: { id: string; name: string; email: string };
};

// ============== OKRs ==============
export const objectives = pgTable("objectives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  title: text("title").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").notNull(),
  level: text("level").notNull().default("company"),
  cycle: text("cycle").notNull(),
  status: text("status").notNull().default("on_track"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertObjectiveSchema = createInsertSchema(objectives).omit({ id: true, createdAt: true });
export type InsertObjective = z.infer<typeof insertObjectiveSchema>;
export type Objective = typeof objectives.$inferSelect;

export const keyResults = pgTable("key_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  objectiveId: varchar("objective_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  // Measurement type: percentage, absolute, monetary, temporal, binary, decreasing
  measurementType: text("measurement_type").notNull().default("percentage"),
  // For absolute/monetary/temporal: starting value
  startValue: decimal("start_value"),
  // Target value (can be decimal for percentages, monetary, temporal)
  targetValue: decimal("target_value").notNull(),
  // Current value
  currentValue: decimal("current_value").notNull().default("0"),
  // Unit label (%, R$, horas, dias, etc.)
  unit: text("unit"),
  // Multiple responsible users (JSON array of user IDs)
  responsibleIds: text("responsible_ids"),
  // Estimated completion date
  dueDate: timestamp("due_date"),
  // Status based on deadline: on_track, at_risk, overdue
  deadlineStatus: text("deadline_status").default("on_track"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

const baseInsertKeyResultSchema = createInsertSchema(keyResults).omit({ id: true, createdAt: true, updatedAt: true });
export const insertKeyResultSchema = baseInsertKeyResultSchema.extend({
  dueDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => 
    val ? (typeof val === 'string' ? new Date(val) : val) : null
  ),
  startValue: z.union([z.string(), z.number(), z.null()]).optional().transform(val => 
    val !== null && val !== undefined ? String(val) : null
  ),
  targetValue: z.union([z.string(), z.number()]).transform(val => String(val)),
  currentValue: z.union([z.string(), z.number()]).optional().transform(val => 
    val !== null && val !== undefined ? String(val) : "0"
  ),
});
export type InsertKeyResult = z.infer<typeof insertKeyResultSchema>;
export type KeyResult = typeof keyResults.$inferSelect;

// ============== KEY RESULT UPDATES (Check-ins) ==============
export const keyResultUpdates = pgTable("key_result_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  keyResultId: varchar("key_result_id").notNull(),
  userId: varchar("user_id").notNull(),
  // Previous and new values for tracking changes
  previousValue: decimal("previous_value"),
  newValue: decimal("new_value").notNull(),
  // Progress percentage at this update
  progressPercentage: decimal("progress_percentage"),
  // Comment/description of the update
  comment: text("comment"),
  // Evidence links (JSON array of URLs)
  evidenceLinks: text("evidence_links"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKeyResultUpdateSchema = createInsertSchema(keyResultUpdates).omit({ id: true, createdAt: true });
export type InsertKeyResultUpdate = z.infer<typeof insertKeyResultUpdateSchema>;
export type KeyResultUpdate = typeof keyResultUpdates.$inferSelect;

// ============== LOGISTICS ==============
export const shipments = pgTable("shipments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  trackingCode: text("tracking_code").notNull().unique(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  status: text("status").notNull().default("pending"),
  carrier: text("carrier"),
  weight: text("weight"),
  dimensions: text("dimensions"),
  estimatedDelivery: timestamp("estimated_delivery"),
  actualDelivery: timestamp("actual_delivery"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertShipmentSchema = createInsertSchema(shipments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShipment = z.infer<typeof insertShipmentSchema>;
export type Shipment = typeof shipments.$inferSelect;

export const shipmentEvents = pgTable("shipment_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  shipmentId: varchar("shipment_id").notNull(),
  status: text("status").notNull(),
  location: text("location"),
  description: text("description"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertShipmentEventSchema = createInsertSchema(shipmentEvents).omit({ id: true });
export type InsertShipmentEvent = z.infer<typeof insertShipmentEventSchema>;
export type ShipmentEvent = typeof shipmentEvents.$inferSelect;

// ============== SETTINGS ==============
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSettingSchema = createInsertSchema(settings).omit({ id: true, updatedAt: true });
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;

// ============== TAREFAS MODULE - TAGS (formerly AREAS) ==============
export const taskTags = pgTable("task_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").notNull(),
  visibility: text("visibility").notNull().default("private"),
  scope: text("scope").notNull().default("tasks"),
  color: text("color").default("#00A137"),
  icon: text("icon").default("folder"),
  isDefault: boolean("is_default").default(false),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTaskTagSchema = createInsertSchema(taskTags).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTaskTag = z.infer<typeof insertTaskTagSchema>;
export type TaskTag = typeof taskTags.$inferSelect;

// Backward compatibility aliases (deprecated, will be removed in future versions)
export const taskAreas = taskTags;
export const insertTaskAreaSchema = insertTaskTagSchema;
export type InsertTaskArea = InsertTaskTag;
export type TaskArea = TaskTag;

// ============== TAREFAS MODULE - TAG MEMBERS (formerly AREA MEMBERS) ==============
export const taskTagMembers = pgTable("task_tag_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  tagId: varchar("tag_id").notNull(),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull().default("viewer"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTaskTagMemberSchema = createInsertSchema(taskTagMembers).omit({ id: true, createdAt: true });
export type InsertTaskTagMember = z.infer<typeof insertTaskTagMemberSchema>;
export type TaskTagMember = typeof taskTagMembers.$inferSelect;

// Backward compatibility aliases (deprecated, will be removed in future versions)
export const taskAreaMembers = taskTagMembers;
export const insertTaskAreaMemberSchema = insertTaskTagMemberSchema;
export type InsertTaskAreaMember = InsertTaskTagMember;
export type TaskAreaMember = TaskTagMember;

// ============== TAREFAS MODULE - TASKS ==============
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  tagId: varchar("tag_id"),
  title: text("title").notNull(),
  description: text("description"),
  attachments: text("attachments"), // JSON array of attachment URLs
  type: text("type").notNull().default("task"),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  assigneeId: varchar("assignee_id"),
  assigneeIds: text("assignee_ids"), // JSON array of user IDs for multi-assignee
  dueDate: timestamp("due_date"),
  createdBy: varchar("created_by").notNull(),
  meetingData: text("meeting_data"),
  order: integer("order").notNull().default(0),
  // Recurrence fields
  isRecurring: boolean("is_recurring").default(false),
  recurrenceType: text("recurrence_type"), // "daily" | "weekly"
  recurrenceWeekdays: text("recurrence_weekdays"), // JSON array of weekday numbers [1,2,3,4,5] for Mon-Fri
  recurrenceEndDate: timestamp("recurrence_end_date"),
  parentTaskId: varchar("parent_task_id"), // Reference to template/parent for recurring instances
  subTaskParentId: varchar("sub_task_parent_id"), // Reference to parent task for manual subtask hierarchy
  estimationHours: integer("estimation_hours"), // Estimated hours for the task
  progress: integer("progress").default(0), // Progress percentage 0-100
  visibility: text("visibility").notNull().default("private"), // 'private' | 'shared' | 'public'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

const baseInsertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskSchema = baseInsertTaskSchema.extend({
  dueDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => 
    val ? (typeof val === 'string' ? new Date(val) : val) : null
  ),
  recurrenceEndDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => 
    val ? (typeof val === 'string' ? new Date(val) : val) : null
  ),
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// ============== TAREFAS MODULE - TASK COMMENTS ==============
export const taskComments = pgTable("task_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  taskId: varchar("task_id").notNull(),
  authorId: varchar("author_id").notNull(),
  content: text("content").notNull(),
  parentCommentId: varchar("parent_comment_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTaskCommentSchema = createInsertSchema(taskComments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type TaskComment = typeof taskComments.$inferSelect;

// Task Comment with User data for JOIN queries
export type TaskCommentWithUser = typeof taskComments.$inferSelect & {
  user: { id: string; name: string; email: string };
};

// ============== TAREFAS MODULE - TASK REACTIONS ==============
export const taskReactions = pgTable("task_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  commentId: varchar("comment_id").notNull(),
  userId: varchar("user_id").notNull(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTaskReactionSchema = createInsertSchema(taskReactions).omit({ id: true, createdAt: true });
export type InsertTaskReaction = z.infer<typeof insertTaskReactionSchema>;
export type TaskReaction = typeof taskReactions.$inferSelect;

// ============== TAREFAS MODULE - TASK ATTACHMENTS ==============
export const taskAttachments = pgTable("task_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  taskId: varchar("task_id").notNull(),
  uploadedBy: varchar("uploaded_by").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  fileType: text("file_type"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTaskAttachmentSchema = createInsertSchema(taskAttachments).omit({ id: true, createdAt: true });
export type InsertTaskAttachment = z.infer<typeof insertTaskAttachmentSchema>;
export type TaskAttachment = typeof taskAttachments.$inferSelect;

// ============== TAREFAS MODULE - TEMPLATES ==============
export const taskTemplates = pgTable("task_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  name: text("name").notNull(),
  type: text("type").notNull(),
  structure: text("structure").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTaskTemplateSchema = createInsertSchema(taskTemplates).omit({ id: true, createdAt: true });
export type InsertTaskTemplate = z.infer<typeof insertTaskTemplateSchema>;
export type TaskTemplate = typeof taskTemplates.$inferSelect;

// ============== LOGISTIC OPERATORS ==============
export const logisticOperators = pgTable("logistic_operators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  razaoSocial: text("razao_social").notNull(),
  cnpj: text("cnpj").notNull(),
  contato: text("contato"),
  email: text("email").notNull(),
  telefone: text("telefone"),
  ativo: boolean("ativo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLogisticOperatorSchema = createInsertSchema(logisticOperators).omit({ id: true, createdAt: true });
export type InsertLogisticOperator = z.infer<typeof insertLogisticOperatorSchema>;
export type LogisticOperator = typeof logisticOperators.$inferSelect;

// ============== COLLECTION REQUESTS ==============
export const collectionRequests = pgTable("collection_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  origem: text("origem").notNull(),
  destino: text("destino").notNull(),
  peso: text("peso").notNull(),
  cubagem: text("cubagem").notNull(),
  status: text("status").notNull().default("pending"),
  operatorId: varchar("operator_id"),
  valorEstimado: text("valor_estimado"),
  prazoEstimado: integer("prazo_estimado"),
  observacao: text("observacao"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCollectionRequestSchema = createInsertSchema(collectionRequests).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCollectionRequest = z.infer<typeof insertCollectionRequestSchema>;
export type CollectionRequest = typeof collectionRequests.$inferSelect;

// ============== LOGISTICA REVERSA - PEDIDOS ==============
export const logisticaReversaPedidos = pgTable("logistica_reversa_pedidos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  numeroPedido: text("numero_pedido"),
  numeroEtiqueta: text("numero_etiqueta"),
  tipo: text("tipo").notNull(), // A = Autorização, C = Coleta, CA = Coleta Simultânea
  codigoServico: text("codigo_servico").notNull(),
  status: text("status").notNull().default("solicitado"),
  idCliente: text("id_cliente"),
  prazo: text("prazo"),
  remetenteNome: text("remetente_nome"),
  remetenteCep: text("remetente_cep"),
  remetenteEndereco: text("remetente_endereco"),
  remetenteCidade: text("remetente_cidade"),
  remetenteUf: text("remetente_uf"),
  remetenteEmail: text("remetente_email"),
  remetenteTelefone: text("remetente_telefone"),
  remetenteDdd: text("remetente_ddd"),
  destinatarioNome: text("destinatario_nome"),
  destinatarioCep: text("destinatario_cep"),
  destinatarioEndereco: text("destinatario_endereco"),
  destinatarioCidade: text("destinatario_cidade"),
  destinatarioUf: text("destinatario_uf"),
  observacao: text("observacao"),
  // Itens a coletar (JSON array)
  itensColeta: text("itens_coleta"), // JSON array: [{descricao, quantidade, valorUnitario, imei}]
  tipoEmbalagem: text("tipo_embalagem"),
  valorDeclarado: text("valor_declarado"),
  adicionalAnac: boolean("adicional_anac").default(false),
  custoEstimado: text("custo_estimado"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLogisticaReversaPedidoSchema = createInsertSchema(logisticaReversaPedidos).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLogisticaReversaPedido = z.infer<typeof insertLogisticaReversaPedidoSchema>;
export type LogisticaReversaPedido = typeof logisticaReversaPedidos.$inferSelect;

// ============== LOGISTICA REVERSA - EVENTOS ==============
export const logisticaReversaEventos = pgTable("logistica_reversa_eventos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  pedidoId: varchar("pedido_id").notNull(),
  status: text("status").notNull(),
  descricao: text("descricao"),
  dataEvento: timestamp("data_evento").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLogisticaReversaEventoSchema = createInsertSchema(logisticaReversaEventos).omit({ id: true, createdAt: true, dataEvento: true });
export type InsertLogisticaReversaEvento = z.infer<typeof insertLogisticaReversaEventoSchema>;
export type LogisticaReversaEvento = typeof logisticaReversaEventos.$inferSelect;

// ============== API INTEGRATIONS ==============
export const apiIntegrations = pgTable("api_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  name: text("name").notNull(),
  category: text("category").notNull(), // correios, internal, operators
  description: text("description"),
  baseUrl: text("base_url"),
  status: text("status").notNull().default("aguardando_credenciais"), // ativo, inativo, aguardando_credenciais, em_desenvolvimento
  documentation: text("documentation"), // Markdown documentation
  endpoints: text("endpoints"), // JSON array of endpoints
  credentialsConfigured: boolean("credentials_configured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertApiIntegrationSchema = createInsertSchema(apiIntegrations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApiIntegration = z.infer<typeof insertApiIntegrationSchema>;
export type ApiIntegration = typeof apiIntegrations.$inferSelect;

// ============== FREIGHT SIMULATIONS ==============
export const freightSimulations = pgTable("freight_simulations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  cidadeOrigem: text("cidade_origem").notNull(),
  cidadeDestino: text("cidade_destino").notNull(),
  peso: text("peso").notNull(),
  volume: text("volume").notNull(),
  resultados: text("resultados"), // JSON array of quotes
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFreightSimulationSchema = createInsertSchema(freightSimulations).omit({ id: true, createdAt: true });
export type InsertFreightSimulation = z.infer<typeof insertFreightSimulationSchema>;
export type FreightSimulation = typeof freightSimulations.$inferSelect;

// ============== SLA RULES ==============
export const slaRules = pgTable("sla_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  tipo: text("tipo").notNull(), // bug, melhoria
  prioridade: text("prioridade").notNull(), // low, medium, high, critical
  slaHoras: decimal("sla_horas").notNull(), // SLA in hours
  ativo: boolean("ativo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSlaRuleSchema = createInsertSchema(slaRules).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSlaRule = z.infer<typeof insertSlaRuleSchema>;
export type SlaRule = typeof slaRules.$inferSelect;

// ============== PRICING DEVICES (Monitored Devices) ==============
export const pricingDevices = pgTable("pricing_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  categoryId: text("category_id").notNull(), // iPhone or Smartphone category UUID
  categoryName: text("category_name").notNull(), // iPhone, Smartphone
  manufacturerName: text("manufacturer_name").notNull(), // Apple, Samsung
  modelName: text("model_name").notNull(), // iPhone 11, Galaxy S25
  storage: integer("storage").notNull(), // 128, 256, etc
  condition: text("condition").default("novo"), // novo, seminovo, usado
  imageUrl: text("image_url"),
  specs: text("specs"), // JSON with technical specs
  releaseDate: timestamp("release_date"),
  isActive: boolean("is_active").default(true),
  lastScrapedAt: timestamp("last_scraped_at"), // Data do último scraping
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPricingDeviceSchema = createInsertSchema(pricingDevices).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPricingDevice = z.infer<typeof insertPricingDeviceSchema>;
export type PricingDevice = typeof pricingDevices.$inferSelect;

// ============== PRICING PRICE HISTORY ==============
export const pricingPriceHistory = pgTable("pricing_price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  deviceId: varchar("device_id").notNull(),
  date: timestamp("date").notNull(),
  minPrice: decimal("min_price"),
  avgPrice: decimal("avg_price"),
  maxPrice: decimal("max_price"),
  sampleCount: integer("sample_count").default(0),
  source: text("source").default("scraping"), // scraping, manual, api
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPricingPriceHistorySchema = createInsertSchema(pricingPriceHistory).omit({ id: true, createdAt: true });
export type InsertPricingPriceHistory = z.infer<typeof insertPricingPriceHistorySchema>;
export type PricingPriceHistory = typeof pricingPriceHistory.$inferSelect;

// ============== PRICING ALERTS ==============
export const pricingAlerts = pgTable("pricing_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  userId: varchar("user_id").notNull(),
  deviceId: varchar("device_id").notNull(),
  alertType: text("alert_type").notNull(), // price_drop, price_rise
  thresholdPercent: decimal("threshold_percent").notNull(), // X%
  isActive: boolean("is_active").default(true),
  lastTriggered: timestamp("last_triggered"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPricingAlertSchema = createInsertSchema(pricingAlerts).omit({ id: true, createdAt: true });
export type InsertPricingAlert = z.infer<typeof insertPricingAlertSchema>;
export type PricingAlert = typeof pricingAlerts.$inferSelect;

// ============== PRICING SCRAPED DATA (Concurrent Prices) ==============
export const pricingScrapedData = pgTable("pricing_scraped_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  deviceId: varchar("device_id").notNull(), // Reference to pricingDevices
  categoryId: text("category_id").notNull(),
  manufacturerName: text("manufacturer_name").notNull(),
  modelName: text("model_name").notNull(),
  storage: integer("storage").notNull(),
  // Dados do scraping
  rawId: text("raw_id"), // ID do scraping na API externa
  source: text("source").notNull(), // google_shopping, etc
  productId: text("product_id"),
  productUrl: text("product_url"),
  title: text("title"),
  priceText: text("price_text"),
  extractedPrice: decimal("extracted_price"),
  rating: integer("rating"),
  reviews: integer("reviews"),
  thumbnail: text("thumbnail"),
  fromCache: boolean("from_cache").default(false),
  scrapedAt: timestamp("scraped_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPricingScrapedDataSchema = createInsertSchema(pricingScrapedData).omit({ id: true, createdAt: true });
export type InsertPricingScrapedData = z.infer<typeof insertPricingScrapedDataSchema>;
export type PricingScrapedData = typeof pricingScrapedData.$inferSelect;

// ============== HELPER TYPES ==============
export type LogisticaReversaPedidoWithEventos = LogisticaReversaPedido & {
  eventos?: LogisticaReversaEvento[];
};

export type LogisticsDashboardStats = {
  totalRequests: number;
  totalValue: number;
  onTimeRate: number;
  savings: number;
  pendingRequests: number;
  deliveredRequests: number;
};

export type ItemColeta = {
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  imei?: string;
};

export type FreightQuote = {
  operador: string;
  servico: string;
  prazo: string;
  valor: number;
};

export type ApiEndpoint = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  description: string;
};

// ============== METAS (Goals) MODULE ==============

// Areas de Negócio for Metas
export const metaAreas = pgTable("meta_areas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  name: text("name").notNull(),
  color: text("color").notNull().default("#00A137"),
  archived: boolean("archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMetaAreaSchema = createInsertSchema(metaAreas).omit({ id: true, createdAt: true });
export type InsertMetaArea = z.infer<typeof insertMetaAreaSchema>;
export type MetaArea = typeof metaAreas.$inferSelect;

// Metas (Goals)
export const metas = pgTable("metas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  title: text("title").notNull(),
  description: text("description"),
  areaId: varchar("area_id").notNull(),
  responsibleId: varchar("responsible_id").notNull(),
  // Measurement type (reused from OKRs): percentage, absolute, monetary, binary
  measurementType: text("measurement_type").notNull().default("percentage"),
  // Target value
  targetValue: decimal("target_value").notNull(),
  // Current value
  currentValue: decimal("current_value").notNull().default("0"),
  // Unit label (%, R$, unidades, etc.)
  unit: text("unit"),
  // Month in format YYYY-MM
  month: text("month").notNull(),
  // Status: on_track, at_risk, overdue, completed
  status: text("status").notNull().default("on_track"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

const baseInsertMetaSchema = createInsertSchema(metas).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMetaSchema = baseInsertMetaSchema.extend({
  targetValue: z.union([z.string(), z.number()]).transform(val => String(val)),
  currentValue: z.union([z.string(), z.number()]).optional().transform(val => 
    val !== null && val !== undefined ? String(val) : "0"
  ),
});
export type InsertMeta = z.infer<typeof insertMetaSchema>;
export type Meta = typeof metas.$inferSelect;

// Meta Check-ins (progress updates)
export const metaCheckins = pgTable("meta_checkins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  metaId: varchar("meta_id").notNull(),
  userId: varchar("user_id").notNull(),
  previousValue: decimal("previous_value").notNull(),
  newValue: decimal("new_value").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

const baseInsertMetaCheckinSchema = createInsertSchema(metaCheckins).omit({ id: true, createdAt: true });
export const insertMetaCheckinSchema = baseInsertMetaCheckinSchema.extend({
  previousValue: z.union([z.string(), z.number()]).transform(val => String(val)),
  newValue: z.union([z.string(), z.number()]).transform(val => String(val)),
});
export type InsertMetaCheckin = z.infer<typeof insertMetaCheckinSchema>;
export type MetaCheckin = typeof metaCheckins.$inferSelect;

// ============== BIBLIOTECA ==============

// Main documents table
export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  // Naming convention fields: [Area][Tipo][Titulo][Versao][Data]
  area: text("area").notNull(), // LAB, RH, COM, FIN, MKT, OPS, TI, etc.
  tipo: text("tipo").notNull(), // politica, pop, fluxograma, mapa_cargo, template, checklist, faq
  titulo: text("titulo").notNull(), // Sem acentos/caracteres especiais
  versao: text("versao").notNull().default("V1"), // V1, V2, V3...
  dataMesAno: text("data_mes_ano").notNull(), // YYYY-MM format
  // Auto-generated standardized name
  nomeArquivo: text("nome_arquivo").notNull(), // LAB_POP104_Titulo_V1_2025-12
  // Content and metadata
  conteudo: text("conteudo"), // Rich text content
  tags: text("tags"), // JSON array of tags for search
  // Attachments stored as JSON array
  anexos: text("anexos"), // JSON: [{fileName, fileUrl, fileSize, fileType}]
  // Status workflow
  status: text("status").notNull().default("rascunho"), // rascunho, em_analise, aprovado, arquivado
  // Approval tracking
  aprovadoPor: varchar("aprovado_por"),
  aprovadoEm: timestamp("aprovado_em"),
  rejeitadoPor: varchar("rejeitado_por"),
  rejeitadoEm: timestamp("rejeitado_em"),
  motivoRejeicao: text("motivo_rejeicao"),
  // Permissions
  visibilidade: text("visibilidade").notNull().default("todos"), // todos, departamento, funcoes
  permissoesVisualizacao: text("permissoes_visualizacao"), // JSON: departamentos ou funções específicas
  // Owner and tracking
  criadorId: varchar("criador_id").notNull(),
  ultimaEdicaoPor: varchar("ultima_edicao_por"),
  ultimaEdicaoEm: timestamp("ultima_edicao_em"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertKnowledgeDocumentSchema = createInsertSchema(knowledgeDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKnowledgeDocument = z.infer<typeof insertKnowledgeDocumentSchema>;
export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;

// Version history for documents
export const knowledgeDocumentVersions = pgTable("knowledge_document_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  documentId: varchar("document_id").notNull(),
  versao: text("versao").notNull(), // V1, V2, etc
  conteudo: text("conteudo"),
  anexos: text("anexos"),
  alteradoPor: varchar("alterado_por").notNull(),
  resumoAlteracoes: text("resumo_alteracoes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKnowledgeDocumentVersionSchema = createInsertSchema(knowledgeDocumentVersions).omit({ id: true, createdAt: true });
export type InsertKnowledgeDocumentVersion = z.infer<typeof insertKnowledgeDocumentVersionSchema>;
export type KnowledgeDocumentVersion = typeof knowledgeDocumentVersions.$inferSelect;

// Audit trail for all document actions
export const knowledgeAuditLogs = pgTable("knowledge_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  documentId: varchar("document_id").notNull(),
  userId: varchar("user_id").notNull(),
  acao: text("acao").notNull(), // criou, editou, visualizou, enviou_aprovacao, aprovou, rejeitou, restaurou
  detalhes: text("detalhes"), // Optional additional info
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKnowledgeAuditLogSchema = createInsertSchema(knowledgeAuditLogs).omit({ id: true, createdAt: true });
export type InsertKnowledgeAuditLog = z.infer<typeof insertKnowledgeAuditLogSchema>;
export type KnowledgeAuditLog = typeof knowledgeAuditLogs.$inferSelect;

// User favorites
export const knowledgeFavorites = pgTable("knowledge_favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  userId: varchar("user_id").notNull(),
  documentId: varchar("document_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKnowledgeFavoriteSchema = createInsertSchema(knowledgeFavorites).omit({ id: true, createdAt: true });
export type InsertKnowledgeFavorite = z.infer<typeof insertKnowledgeFavoriteSchema>;
export type KnowledgeFavorite = typeof knowledgeFavorites.$inferSelect;

// Helper types for Knowledge Base
export type KnowledgeDocumentAnexo = {
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
};

export type KnowledgeDocumentWithDetails = KnowledgeDocument & {
  criador?: User;
  aprovador?: User;
  favorito?: boolean;
};

// ============== FLUXOGRAMAS MODULE ==============
export const flowcharts = pgTable("flowcharts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  title: text("title").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").notNull(),
  visibility: text("visibility").notNull().default("private"),
  nodesData: text("nodes_data"), // JSON array of React Flow nodes
  edgesData: text("edges_data"), // JSON array of React Flow edges
  viewport: text("viewport"), // JSON { x, y, zoom }
  permissions: text("permissions"), // JSON: { userId: "view"|"edit"|"comment" }
  isTemplate: boolean("is_template").default(false),
  templateCategory: text("template_category"),
  thumbnail: text("thumbnail"),
  source: text("source").notNull().default("reactflow"), // "reactflow" | "excalidraw"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFlowchartSchema = createInsertSchema(flowcharts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFlowchart = z.infer<typeof insertFlowchartSchema>;
export type Flowchart = typeof flowcharts.$inferSelect;

export const flowchartVersions = pgTable("flowchart_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  flowchartId: varchar("flowchart_id").notNull(),
  versionNumber: integer("version_number").notNull().default(1),
  createdBy: varchar("created_by").notNull(),
  snapshotJson: text("snapshot_json").notNull(), // JSON: { nodes, edges, viewport }
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFlowchartVersionSchema = createInsertSchema(flowchartVersions).omit({ id: true, createdAt: true });
export type InsertFlowchartVersion = z.infer<typeof insertFlowchartVersionSchema>;
export type FlowchartVersion = typeof flowchartVersions.$inferSelect;

export const flowchartComments = pgTable("flowchart_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  flowchartId: varchar("flowchart_id").notNull(),
  userId: varchar("user_id").notNull(),
  nodeId: varchar("node_id"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFlowchartCommentSchema = createInsertSchema(flowchartComments).omit({ id: true, createdAt: true });
export type InsertFlowchartComment = z.infer<typeof insertFlowchartCommentSchema>;
export type FlowchartComment = typeof flowchartComments.$inferSelect;

// ============== AI CHAT ==============
export const aiConversations = pgTable("ai_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  userId: varchar("user_id").notNull(),
  title: text("title").default("Nova conversa"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAiConversationSchema = createInsertSchema(aiConversations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiConversation = z.infer<typeof insertAiConversationSchema>;
export type AiConversation = typeof aiConversations.$inferSelect;

export const aiMessages = pgTable("ai_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  conversationId: varchar("conversation_id").notNull(),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiMessageSchema = createInsertSchema(aiMessages).omit({ id: true, createdAt: true });
export type InsertAiMessage = z.infer<typeof insertAiMessageSchema>;
export type AiMessage = typeof aiMessages.$inferSelect;

// ============== NOTIFICATIONS ==============
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  userId: varchar("user_id").notNull(),
  fromUserId: varchar("from_user_id"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  module: text("module").notNull(),
  entityId: varchar("entity_id"),
  linkUrl: text("link_url").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// ============== NOTIFICATION PREFERENCES ==============
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  tenantId: varchar("tenant_id"),
  emailEnabled: boolean("email_enabled").default(true),
  pushEnabled: boolean("push_enabled").default(true),
  // Preferências granulares por tipo de notificação (JSON)
  emailPreferences: text("email_preferences").default(JSON.stringify({
    ticket_new: true,
    ticket_assigned: true,
    ticket_status: true,
    ticket_comment: true,
    mention: true,
    task_assigned: true,
    project_card_assigned: true,
    project_card_status: true,
    project_update: true,
    meeting_invite: true,
    flowchart_collaborator: true,
    okr_update: true,
    shipment_update: true,
  })),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type NotificationPreferencesRow = typeof notificationPreferences.$inferSelect;

// ============== AI SPACES (Espaços) ==============
export const aiSpaces = pgTable("ai_spaces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  color: text("color").default("#00A137"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiSpaceSchema = createInsertSchema(aiSpaces).omit({ id: true, createdAt: true });
export type InsertAiSpace = z.infer<typeof insertAiSpaceSchema>;
export type AiSpace = typeof aiSpaces.$inferSelect;

// ============== AI SPACE CONVERSATIONS (link between spaces and conversations) ==============
export const aiSpaceConversations = pgTable("ai_space_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: varchar("space_id").notNull(),
  conversationId: varchar("conversation_id").notNull(),
});

export const insertAiSpaceConversationSchema = createInsertSchema(aiSpaceConversations).omit({ id: true });
export type InsertAiSpaceConversation = z.infer<typeof insertAiSpaceConversationSchema>;
export type AiSpaceConversation = typeof aiSpaceConversations.$inferSelect;

// ============== UPDATES / NEWS ==============
export const updates = pgTable("updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  version: text("version").notNull(), // e.g., "v2.1.0"
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("feature"), // feature, bugfix, improvement, announcement
  source: text("source"), // e.g., "Sistema", "Integração", "Manutenção"
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  createdBy: varchar("created_by"),
  commitHash: text("commit_hash"),
  author: text("author").default("Equipe técnica"),
});

export const insertUpdateSchema = createInsertSchema(updates).omit({ id: true, createdAt: true, updatedAt: true, publishedAt: true });
export type InsertUpdate = z.infer<typeof insertUpdateSchema>;
export type Update = typeof updates.$inferSelect;

// ============== PROMPTS LIBRARY (Biblioteca de Prompts Claude Code) ==============
export const promptsLibrary = pgTable("prompts_library", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  // Categorização
  category: text("category").notNull(), // development-team, development-tools, programming-languages, database
  subcategory: text("subcategory").notNull(), // frontend-developer, code-reviewer, etc
  name: text("name").notNull(), // nome do arquivo sem extensão
  // Conteúdo
  title: text("title").notNull(), // título formatado em português
  description: text("description").notNull(), // descrição resumida da finalidade
  content: text("content").notNull(), // conteúdo completo do prompt
  // Metadados do prompt
  tools: text("tools"), // JSON array de ferramentas disponíveis
  model: text("model"), // modelo recomendado (sonnet, haiku, etc)
  // Origem e sincronização
  sourceUrl: text("source_url"), // link para o arquivo no GitHub
  githubRepo: text("github_repo").notNull().default("davila7/claude-code-templates"),
  githubPath: text("github_path").notNull(), // caminho completo no repo
  lastSyncedAt: timestamp("last_synced_at").defaultNow(),
  // Status e uso
  isActive: boolean("is_active").default(true),
  usageCount: integer("usage_count").default(0),
  // Traduções (para prompts que terão versão PT-BR)
  isTranslated: boolean("is_translated").default(false),
  originalLanguage: text("original_language").default("en"),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Tradução
  translatedContent: text('translated_content'),
  translatedAt: timestamp('translated_at'),
});

export const insertPromptLibrarySchema = createInsertSchema(promptsLibrary).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true, 
  lastSyncedAt: true,
  usageCount: true 
});
export type InsertPromptLibrary = z.infer<typeof insertPromptLibrarySchema>;
export type PromptLibrary = typeof promptsLibrary.$inferSelect;

// ============== PROMPT USER FAVORITES (Favoritos dos Usuários) ==============
export const promptUserFavorites = pgTable("prompt_user_favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  userId: varchar("user_id").notNull(),
  promptId: varchar("prompt_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPromptUserFavoriteSchema = createInsertSchema(promptUserFavorites).omit({ id: true, createdAt: true });
export type InsertPromptUserFavorite = z.infer<typeof insertPromptUserFavoriteSchema>;
export type PromptUserFavorite = typeof promptUserFavorites.$inferSelect;

// Helper types for Prompts
export type PromptWithFavorite = PromptLibrary & {
  isFavorite?: boolean;
  favoriteId?: string;
};

// Categorias de prompts disponíveis
export const PROMPT_CATEGORIES = [
  { id: "development-team", label: "Equipe de Desenvolvimento", icon: "Users" },
  { id: "development-tools", label: "Ferramentas de Desenvolvimento", icon: "Wrench" },
  { id: "programming-languages", label: "Linguagens de Programação", icon: "Code" },
  { id: "database", label: "Banco de Dados", icon: "Database" },
] as const;

export type PromptCategory = typeof PROMPT_CATEGORIES[number]["id"];

// ============== GIT ANALYTICS ==============

// Repositórios GitHub conectados
export const gitRepositories = pgTable("git_repositories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  githubId: integer("github_id").notNull(),
  name: text("name").notNull(),                    // ex: "Renov.Home"
  fullName: text("full_name").notNull(),           // ex: "Renov-BD/Renov.Home"
  owner: text("owner").notNull(),                  // ex: "Renov-BD"
  defaultBranch: text("default_branch").default("main"),
  isActive: boolean("is_active").default(true),
  syncEnabled: boolean("sync_enabled").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGitRepositorySchema = createInsertSchema(gitRepositories).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGitRepository = z.infer<typeof insertGitRepositorySchema>;
export type GitRepository = typeof gitRepositories.$inferSelect;

// Commits sincronizados do GitHub
export const gitCommits = pgTable("git_commits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  repositoryId: varchar("repository_id").notNull(),
  sha: text("sha").notNull().unique(),
  message: text("message").notNull(),
  fullMessage: text("full_message"),               // Mensagem completa com body
  authorName: text("author_name").notNull(),
  authorEmail: text("author_email"),
  authorAvatarUrl: text("author_avatar_url"),
  commitType: text("commit_type").default("improvement"), // feature, bugfix, improvement, docs, refactor, security
  branch: text("branch"),
  prNumber: integer("pr_number"),                  // PR associado, se houver
  filesChanged: integer("files_changed").default(0),
  additions: integer("additions").default(0),
  deletions: integer("deletions").default(0),
  committedAt: timestamp("committed_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGitCommitSchema = createInsertSchema(gitCommits).omit({ id: true, createdAt: true });
export type InsertGitCommit = z.infer<typeof insertGitCommitSchema>;
export type GitCommit = typeof gitCommits.$inferSelect;

// Pull Requests sincronizados do GitHub
export const gitPullRequests = pgTable("git_pull_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  repositoryId: varchar("repository_id").notNull(),
  githubPrNumber: integer("github_pr_number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  authorName: text("author_name").notNull(),
  authorAvatarUrl: text("author_avatar_url"),
  status: text("status").default("open"),          // open, merged, closed
  prType: text("pr_type").default("improvement"),  // feature, bugfix, improvement, docs, refactor, security
  sourceBranch: text("source_branch"),
  targetBranch: text("target_branch"),
  commitsCount: integer("commits_count").default(0),
  additions: integer("additions").default(0),
  deletions: integer("deletions").default(0),
  reviewers: text("reviewers"),                    // JSON array
  labels: text("labels"),                          // JSON array
  createdAt: timestamp("created_at"),
  mergedAt: timestamp("merged_at"),
  closedAt: timestamp("closed_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGitPullRequestSchema = createInsertSchema(gitPullRequests).omit({ id: true, updatedAt: true });
export type InsertGitPullRequest = z.infer<typeof insertGitPullRequestSchema>;
export type GitPullRequest = typeof gitPullRequests.$inferSelect;

// Alertas de segurança (Dependabot)
export const gitSecurityAlerts = pgTable("git_security_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  repositoryId: varchar("repository_id").notNull(),
  githubAlertNumber: integer("github_alert_number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull(),            // critical, high, medium, low
  packageName: text("package_name").notNull(),
  packageEcosystem: text("package_ecosystem"),     // npm, pip, etc
  vulnerableVersion: text("vulnerable_version"),
  patchedVersion: text("patched_version"),
  status: text("status").default("open"),          // open, dismissed, fixed
  isDirectDependency: boolean("is_direct_dependency").default(false),
  cveId: text("cve_id"),
  ghsaId: text("ghsa_id"),
  createdAt: timestamp("created_at"),
  dismissedAt: timestamp("dismissed_at"),
  fixedAt: timestamp("fixed_at"),
});

export const insertGitSecurityAlertSchema = createInsertSchema(gitSecurityAlerts).omit({ id: true });
export type InsertGitSecurityAlert = z.infer<typeof insertGitSecurityAlertSchema>;
export type GitSecurityAlert = typeof gitSecurityAlerts.$inferSelect;

// Branches
export const gitBranches = pgTable("git_branches", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: varchar("tenant_id"),
  repositoryId: varchar("repository_id").notNull(),
  name: text("name").notNull(),
  sha: text("sha").notNull(),
  isDefault: boolean("is_default").default(false),
  isProtected: boolean("is_protected").default(false),
  aheadBy: integer("ahead_by").default(0),
  behindBy: integer("behind_by").default(0),
  hasOpenPR: boolean("has_open_pr").default(false),
  lastCommitAt: timestamp("last_commit_at"),
  lastCommitAuthor: text("last_commit_author"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGitBranchSchema = createInsertSchema(gitBranches);
export type InsertGitBranch = z.infer<typeof insertGitBranchSchema>;
export type GitBranch = typeof gitBranches.$inferSelect;

// =====================================================
// AI Dev System V2
// =====================================================

// Modelos AI disponíveis
export const aiModels = pgTable("ai_models", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  nome: text("nome").notNull().unique(),
  provider: text("provider").notNull(),
  modelId: text("model_id").notNull(),
  custoInputPorMm: decimal("custo_input_por_mm", { precision: 10, scale: 4 }),
  custoOutputPorMm: decimal("custo_output_por_mm", { precision: 10, scale: 4 }),
  config: jsonb("config").$type<{
    temperature?: number;
    max_tokens?: number;
    [key: string]: any;
  }>().default({}),
  ativo: boolean("ativo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAiModelSchema = createInsertSchema(aiModels);
export type InsertAiModel = z.infer<typeof insertAiModelSchema>;
export type AiModel = typeof aiModels.$inferSelect;

// Plans executados
export const aiPlans = pgTable("ai_plans", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  titulo: text("titulo").notNull(),
  requisito: text("requisito").notNull(),
  arquivoOrigem: text("arquivo_origem").notNull(),
  prompts: jsonb("prompts").$type<Array<{
    ordem: number;
    titulo: string;
    prompt: string;
  }>>().notNull().default([]),
  modeloId: varchar("modelo_id").references(() => aiModels.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"),
  arquivosModificados: text("arquivos_modificados").array().default([]),
  custoTotal: decimal("custo_total", { precision: 10, scale: 4 }).default("0"),
  tempoTotalSegundos: integer("tempo_total_segundos").default(0),
  errosEncontrados: jsonb("erros_encontrados").$type<Array<{
    fase: string;
    erro: string;
    tentativa: number;
  }>>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const insertAiPlanSchema = createInsertSchema(aiPlans);
export type InsertAiPlan = z.infer<typeof insertAiPlanSchema>;
export type AiPlan = typeof aiPlans.$inferSelect;

// Execução de cada prompt
export const aiPromptExecutions = pgTable("ai_prompt_executions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  planId: varchar("plan_id").references(() => aiPlans.id, { onDelete: "cascade" }).notNull(),
  ordem: integer("ordem").notNull(),
  titulo: text("titulo").notNull(),
  prompt: text("prompt").notNull(),
  status: text("status").notNull().default("pending"),
  tentativas: integer("tentativas").default(0),
  codigoGerado: text("codigo_gerado"),
  arquivosCriados: text("arquivos_criados").array().default([]),
  errosEncontrados: jsonb("erros_encontrados").$type<Array<{
    mensagem: string;
    stack?: string;
    tentativa: number;
  }>>().default([]),
  tokensInput: integer("tokens_input").default(0),
  tokensOutput: integer("tokens_output").default(0),
  custo: decimal("custo", { precision: 10, scale: 4 }).default("0"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const insertAiPromptExecutionSchema = createInsertSchema(aiPromptExecutions);
export type InsertAiPromptExecution = z.infer<typeof insertAiPromptExecutionSchema>;
export type AiPromptExecution = typeof aiPromptExecutions.$inferSelect;

// ============== ESTOQUES MODULE ==============

// Enums as constants for frontend usage
export const CONTAGEM_STATUS = ['em_andamento', 'finalizada', 'em_analise', 'aprovada'] as const;
export const METODO_LEITURA = ['barcode', 'manual'] as const;
export const TIPO_DIVERGENCIA = ['falta', 'sobra'] as const;
export const TIPO_AJUSTE = ['entrada', 'saida', 'transferencia'] as const;

export type ContagemStatus = typeof CONTAGEM_STATUS[number];
export type MetodoLeitura = typeof METODO_LEITURA[number];
export type TipoDivergencia = typeof TIPO_DIVERGENCIA[number];
export type TipoAjuste = typeof TIPO_AJUSTE[number];

// Tabelas

// 1. estoquesContagens (contagens de estoque - cabeçalho)
export const estoquesContagens = pgTable("estoques_contagens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  codigo: text("codigo").notNull().unique(),
  responsavelId: varchar("responsavel_id").references(() => users.id),
  status: text("status").notNull().default("em_andamento"),
  dataInicio: timestamp("data_inicio").defaultNow(),
  dataFim: timestamp("data_fim"),
  totalItensContados: integer("total_itens_contados").default(0),
  totalItensSistema: integer("total_itens_sistema"),
  divergencia: integer("divergencia"),
  acuracidade: decimal("acuracidade", { precision: 5, scale: 2 }),
  observacoes: text("observacoes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEstoquesContagemSchema = createInsertSchema(estoquesContagens).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEstoquesContagem = z.infer<typeof insertEstoquesContagemSchema>;
export type EstoquesContagem = typeof estoquesContagens.$inferSelect;

// 2. estoquesContagemItens (itens contados - detalhe)
export const estoquesContagemItens = pgTable("estoques_contagem_itens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contagemId: varchar("contagem_id").references(() => estoquesContagens.id, { onDelete: "cascade" }),
  imei: text("imei").notNull(),
  codigoErp: text("codigo_erp"),
  modelo: text("modelo"),
  categoria: text("categoria"),
  marca: text("marca"),
  metodoLeitura: text("metodo_leitura").notNull(),
  contadoEm: timestamp("contado_em").defaultNow(),
  contadoPor: varchar("contado_por").references(() => users.id),
}, (table) => ({
  uniqContagemImei: unique().on(table.contagemId, table.imei),
}));

export const insertEstoquesContagemItemSchema = createInsertSchema(estoquesContagemItens).omit({ id: true, contadoEm: true });
export type InsertEstoquesContagemItem = z.infer<typeof insertEstoquesContagemItemSchema>;
export type EstoquesContagemItem = typeof estoquesContagemItens.$inferSelect;

// 3. estoquesContagemLogs (auditoria)
export const estoquesContagemLogs = pgTable("estoques_contagem_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contagemId: varchar("contagem_id").references(() => estoquesContagens.id),
  userId: varchar("user_id").references(() => users.id),
  acao: text("acao").notNull(),
  imei: text("imei"),
  detalhes: jsonb("detalhes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEstoquesContagemLogSchema = createInsertSchema(estoquesContagemLogs).omit({ id: true, createdAt: true });
export type InsertEstoquesContagemLog = z.infer<typeof insertEstoquesContagemLogSchema>;
export type EstoquesContagemLog = typeof estoquesContagemLogs.$inferSelect;

// 4. estoquesContagemDivergencias (divergências encontradas)
export const estoquesContagemDivergencias = pgTable("estoques_contagem_divergencias", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contagemId: varchar("contagem_id").references(() => estoquesContagens.id, { onDelete: "cascade" }),
  tipo: text("tipo").notNull(),
  imei: text("imei"),
  codigoErp: text("codigo_erp"),
  modelo: text("modelo"),
  categoria: text("categoria"),
  marca: text("marca"),
  ultimaMovimentacao: timestamp("ultima_movimentacao"),
  possivelCausa: text("possivel_causa"),
  statusAnalise: text("status_analise").default("pendente"),
  observacaoAnalise: text("observacao_analise"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEstoquesContagemDivergenciaSchema = createInsertSchema(estoquesContagemDivergencias).omit({ id: true, createdAt: true });
export type InsertEstoquesContagemDivergencia = z.infer<typeof insertEstoquesContagemDivergenciaSchema>;
export type EstoquesContagemDivergencia = typeof estoquesContagemDivergencias.$inferSelect;

// 5. estoquesAjustes (ajustes de inventário)
export const estoquesAjustes = pgTable("estoques_ajustes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contagemId: varchar("contagem_id").references(() => estoquesContagens.id),
  divergenciaId: varchar("divergencia_id").references(() => estoquesContagemDivergencias.id),
  tipoAjuste: text("tipo_ajuste").notNull(),
  imei: text("imei"),
  codigoErp: text("codigo_erp"),
  quantidade: integer("quantidade"),
  justificativa: text("justificativa").notNull(),
  aprovadoPor: varchar("aprovado_por").references(() => users.id),
  aprovadoEm: timestamp("aprovado_em"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEstoquesAjusteSchema = createInsertSchema(estoquesAjustes).omit({ id: true, createdAt: true });
export type InsertEstoquesAjuste = z.infer<typeof insertEstoquesAjusteSchema>;
export type EstoquesAjuste = typeof estoquesAjustes.$inferSelect;

// ─── Claude Code Usage Reports ───────────────────────────────────────────────
// Alimentada via script local (scripts/report-claude-usage.ts) que cada dev roda 1x/dia
export const claudeCodeUsageReports = pgTable("claude_code_usage_reports", {
  id:                   varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  developerName:        text("developer_name").notNull(),
  reportDate:           date("report_date").notNull(),
  inputTokens:          bigint("input_tokens", { mode: "number" }).notNull().default(0),
  outputTokens:         bigint("output_tokens", { mode: "number" }).notNull().default(0),
  cacheCreationTokens:  bigint("cache_creation_tokens", { mode: "number" }).notNull().default(0),
  cacheReadTokens:      bigint("cache_read_tokens", { mode: "number" }).notNull().default(0),
  totalTokens:          bigint("total_tokens", { mode: "number" }).notNull().default(0),
  sourceMachine:        text("source_machine"),
  reportedAt:           timestamp("reported_at").defaultNow(),
}, (table) => ({
  uniqDevDate: unique().on(table.developerName, table.reportDate),
}));

export const insertClaudeCodeUsageSchema = createInsertSchema(claudeCodeUsageReports).omit({ id: true, reportedAt: true });
export type InsertClaudeCodeUsage = z.infer<typeof insertClaudeCodeUsageSchema>;
export type ClaudeCodeUsageReport = typeof claudeCodeUsageReports.$inferSelect;

