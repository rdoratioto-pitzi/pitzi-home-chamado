import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============== USERS ==============
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password"),
  role: text("role").notNull().default("user"),
  status: text("status").notNull().default("active"),
  authMethod: text("auth_method").notNull().default("email"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ============== TICKETS (Chamados) ==============
export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  requesterId: varchar("requester_id").notNull(),
  assigneeId: varchar("assignee_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  dueDate: timestamp("due_date"),
});

export const insertTicketSchema = createInsertSchema(tickets).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;

// ============== TICKET COMMENTS ==============
export const ticketComments = pgTable("ticket_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  isInternal: boolean("is_internal").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTicketCommentSchema = createInsertSchema(ticketComments).omit({ id: true, createdAt: true });
export type InsertTicketComment = z.infer<typeof insertTicketCommentSchema>;
export type TicketComment = typeof ticketComments.$inferSelect;

// ============== PROJECTS ==============
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
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

// ============== KANBAN COLUMNS ==============
export const kanbanColumns = pgTable("kanban_columns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  code: text("code").notNull(), // Alphanumeric code (e.g., REN-01)
  columnId: varchar("column_id").notNull(),
  projectId: varchar("project_id").notNull(),
  title: text("title").notNull(),
  objectives: text("objectives"), // Renamed from description
  development: text("development"), // New descriptive field
  assigneeId: varchar("assignee_id"),
  reporterId: varchar("reporter_id"), // Relator
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  dueDate: timestamp("due_date"),
  tags: text("tags").array(),
  priority: text("priority").notNull().default("normal"), // "muito_urgente", "urgente", "normal"
  estimation: integer("estimation"), // Hours
  attachments: text("attachments").array(),
  order: integer("order").notNull().default(0),
  ticketId: varchar("ticket_id"),
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

// ============== KANBAN COMMENTS ==============
export const kanbanComments = pgTable("kanban_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cardId: varchar("card_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKanbanCommentSchema = createInsertSchema(kanbanComments).omit({ id: true, createdAt: true });
export type InsertKanbanComment = z.infer<typeof insertKanbanCommentSchema>;
export type KanbanComment = typeof kanbanComments.$inferSelect;

// ============== OKRs ==============
export const objectives = pgTable("objectives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  objectiveId: varchar("objective_id").notNull(),
  title: text("title").notNull(),
  targetValue: integer("target_value").notNull(),
  currentValue: integer("current_value").notNull().default(0),
  unit: text("unit"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKeyResultSchema = createInsertSchema(keyResults).omit({ id: true, createdAt: true });
export type InsertKeyResult = z.infer<typeof insertKeyResultSchema>;
export type KeyResult = typeof keyResults.$inferSelect;

// ============== LOGISTICS ==============
export const shipments = pgTable("shipments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSettingSchema = createInsertSchema(settings).omit({ id: true, updatedAt: true });
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;
