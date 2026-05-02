// worker/src/routes/tasks.ts
import { Hono } from "hono";
import { z } from "zod";
import { sql, eq, or, and } from "drizzle-orm";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { requireAdmin } from "../middleware/auth";
import { extractMentions } from "../lib/sanitize-rich-text";
import {
  insertTaskTagSchema,
  insertTaskTagMemberSchema,
  insertTaskAreaSchema,
  insertTaskAreaMemberSchema,
  insertTaskSchema,
  insertTaskCommentSchema,
  insertTaskReactionSchema,
  insertTaskAttachmentSchema,
  insertTaskTemplateSchema,
  tasks,
  type Task,
} from "../../../shared/schema";

import {
  sendMeetingInviteEmail,
  sendSharedAreaInviteEmail,
  sendMentionNotificationEmail,
} from "../lib/email";

const tasksRouter = new Hono<AppEnv>();

async function getUserAccessibleAreaIds(
  userId: string,
  storage: ReturnType<typeof getStorage>,
): Promise<string[]> {
  const areas = await storage.getTaskAreas(userId);
  return areas.map((a) => a.id);
}

// ============== TASK AREAS / TASK TAGS ==============

// GET /api/task-tags
tasksRouter.get("/api/task-tags", async (c) => {
  const { userId } = c.get("user");
  const storage = getStorage(c.get("db"));
  const scope = c.req.query("scope") || undefined;
  const areas = await storage.getTaskAreas(userId);
  const filtered = scope ? areas.filter((a) => a.scope === scope) : areas;
  return c.json(filtered);
});

// GET /api/task-tags/default
tasksRouter.get("/api/task-tags/default", async (c) => {
  const { userId } = c.get("user");
  const storage = getStorage(c.get("db"));
  const scope = c.req.query("scope");

  const userTags = await storage.getTaskAreas(userId);
  const defaultTag = userTags.find(
    (t) => t.isDefault === true && (!scope || t.scope === scope),
  );

  return c.json(defaultTag || null);
});

// GET /api/task-tags/:id
tasksRouter.get("/api/task-tags/:id", async (c) => {
  const { userId } = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const area = await storage.getTaskArea(id);
  if (!area) return c.json({ error: "Area not found" }, 404);
  const accessibleIds = await getUserAccessibleAreaIds(userId, storage);
  if (!accessibleIds.includes(area.id)) {
    return c.json({ error: "Access denied" }, 403);
  }
  return c.json(area);
});

// POST /api/task-tags
tasksRouter.post("/api/task-tags", async (c) => {
  const { userId } = c.get("user");
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const { memberIds, ...areaData } = body;

  try {
    const validated = insertTaskAreaSchema.parse({ ...areaData, ownerId: userId });

    if (validated.scope === "tasks" && validated.visibility === "public") {
      return c.json({ error: "Tarefas não podem ter visibilidade pública" }, 400);
    }

    const area = await storage.createTaskArea(validated);

    // Process shared area members and send invites
    if (
      memberIds &&
      Array.isArray(memberIds) &&
      memberIds.length > 0 &&
      validated.visibility === "shared"
    ) {
      const owner = await storage.getUser(validated.ownerId);

      for (const memberId of memberIds) {
        try {
          await storage.addTaskAreaMember({
            tagId: area.id,
            userId: memberId,
            role: "member",
          });

          const member = await storage.getUser(memberId);
          if (member && owner) {
            sendSharedAreaInviteEmail(c.env, member, area.name, area.id, owner.name).catch(console.error);

            storage
              .createNotification({
                userId: memberId,
                fromUserId: validated.ownerId,
                title: "Nova área compartilhada",
                message: `${owner.name} compartilhou a área "${area.name}" com você`,
                module: "tarefas",
                entityId: area.id,
                linkUrl: `/tarefas?area=${area.id}`,
              })
              .catch(console.error);
          }
        } catch (memberError) {
          console.error(
            `[api/task-areas] Error adding member ${memberId} to area ${area.id}:`,
            memberError,
          );
        }
      }
    }

    return c.json(area, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to create area" }, 400);
  }
});

// PUT /api/task-tags/:id
tasksRouter.put("/api/task-tags/:id", async (c) => {
  const { userId } = c.get("user");
  const isAdmin = c.get("user").role === "admin";
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const body = await c.req.json();
  const { memberIds, ...areaData } = body;

  try {
    const existing = await storage.getTaskArea(id);
    if (!existing) return c.json({ error: "Area not found" }, 404);
    if (!isAdmin && existing.ownerId !== userId) {
      return c.json({ error: "Access denied" }, 403);
    }

    const partialSchema = insertTaskAreaSchema.partial();
    const validated = partialSchema.parse(areaData);

    const effectiveScope = validated.scope || existing.scope;
    const effectiveVisibility = validated.visibility || existing.visibility;
    if (effectiveScope === "tasks" && effectiveVisibility === "public") {
      return c.json({ error: "Tarefas não podem ter visibilidade pública" }, 400);
    }

    const area = await storage.updateTaskArea(id, validated);
    if (!area) return c.json({ error: "Area not found" }, 404);

    // Process shared area members on update
    if (memberIds && Array.isArray(memberIds) && validated.visibility === "shared") {
      const owner = await storage.getUser(area.ownerId);
      const currentMembers = await storage.getTaskAreaMembers(area.id);
      const currentMemberUserIds = currentMembers.map((m) => m.userId);

      for (const memberId of memberIds) {
        if (!currentMemberUserIds.includes(memberId)) {
          try {
            await storage.addTaskAreaMember({
              tagId: area.id,
              userId: memberId,
              role: "member",
            });

            const member = await storage.getUser(memberId);
            if (member && owner) {
              sendSharedAreaInviteEmail(c.env, member, area.name, area.id, owner.name).catch(console.error);

              storage
                .createNotification({
                  userId: memberId,
                  fromUserId: area.ownerId,
                  title: "Nova área compartilhada",
                  message: `${owner.name} compartilhou a área "${area.name}" com você`,
                  module: "tarefas",
                  entityId: area.id,
                  linkUrl: `/tarefas?area=${area.id}`,
                })
                .catch(console.error);
            }
          } catch (memberError) {
            console.error(
              `[api/task-areas] Error adding member ${memberId} to area ${area.id}:`,
              memberError,
            );
          }
        }
      }

      // Remove members not in the new list
      for (const member of currentMembers) {
        if (!memberIds.includes(member.userId)) {
          await storage.removeTaskAreaMember(member.id);
        }
      }
    }

    return c.json(area);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to update area" }, 400);
  }
});

// DELETE /api/task-tags/:id
tasksRouter.delete("/api/task-tags/:id", async (c) => {
  const { userId } = c.get("user");
  const isAdmin = c.get("user").role === "admin";
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");

  const area = await storage.getTaskArea(id);
  if (!area) return c.json({ error: "Area not found" }, 404);
  if (!isAdmin && area.ownerId !== userId) {
    return c.json({ error: "Access denied" }, 403);
  }
  const deleted = await storage.deleteTaskArea(id);
  if (!deleted) return c.json({ error: "Area not found" }, 404);
  return c.body(null, 204);
});

// ============== TASK AREA MEMBERS ==============

// GET /api/task-tags/:id/members
tasksRouter.get("/api/task-tags/:id/members", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const members = await storage.getTaskAreaMembers(id);
  return c.json(members);
});

// POST /api/task-tags/:id/members
tasksRouter.post("/api/task-tags/:id/members", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const body = await c.req.json();

  try {
    const data = { ...body, tagId: id };
    const validated = insertTaskAreaMemberSchema.parse(data);
    const member = await storage.addTaskAreaMember(validated);
    return c.json(member, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to add member" }, 400);
  }
});

// PATCH /api/task-area-members/:id
tasksRouter.patch("/api/task-area-members/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const body = await c.req.json();

  try {
    const partialSchema = insertTaskAreaMemberSchema.partial();
    const validated = partialSchema.parse(body);
    const member = await storage.updateTaskAreaMember(id, validated);
    if (!member) return c.json({ error: "Member not found" }, 404);
    return c.json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to update member" }, 400);
  }
});

// DELETE /api/task-area-members/:id
tasksRouter.delete("/api/task-area-members/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const deleted = await storage.removeTaskAreaMember(id);
  if (!deleted) return c.json({ error: "Member not found" }, 404);
  return c.body(null, 204);
});

// ============== TASK TAGS - DEFAULT & REORDER ==============

// POST /api/task-tags/:id/set-default
tasksRouter.post("/api/task-tags/:id/set-default", async (c) => {
  const { userId } = c.get("user");
  const isAdmin = c.get("user").role === "admin";
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const { scope } = await c.req.json();

  const tag = await storage.getTaskArea(id);
  if (!tag) {
    return c.json({ error: "Tag não encontrada" }, 404);
  }

  if (!isAdmin && tag.ownerId !== userId) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  // Remover padrão de todas as tags do usuário no mesmo escopo
  const userTags = await storage.getTaskAreas(userId);
  const tagsOfSameScope = userTags.filter((t) => t.scope === (scope || tag.scope));

  for (const t of tagsOfSameScope) {
    if (t.isDefault) {
      await storage.updateTaskArea(t.id, { isDefault: false });
    }
  }

  // Definir esta tag como padrão
  await storage.updateTaskArea(id, { isDefault: true });

  return c.json({ success: true, message: "Tag definida como padrão" });
});

// DELETE /api/task-tags/:id/set-default
tasksRouter.delete("/api/task-tags/:id/set-default", async (c) => {
  const { userId } = c.get("user");
  const isAdmin = c.get("user").role === "admin";
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");

  const tag = await storage.getTaskArea(id);
  if (!tag) {
    return c.json({ error: "Tag não encontrada" }, 404);
  }

  if (!isAdmin && tag.ownerId !== userId) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  await storage.updateTaskArea(id, { isDefault: false });

  return c.json({ success: true, message: "Tag removida como padrão" });
});

// POST /api/task-tags/reorder
tasksRouter.post("/api/task-tags/reorder", async (c) => {
  const { userId } = c.get("user");
  const isAdmin = c.get("user").role === "admin";
  const storage = getStorage(c.get("db"));
  const { tagIds } = await c.req.json();

  if (!Array.isArray(tagIds)) {
    return c.json({ error: "tagIds deve ser um array" }, 400);
  }

  for (let i = 0; i < tagIds.length; i++) {
    const tag = await storage.getTaskArea(tagIds[i]);
    if (!tag) continue;

    if (!isAdmin && tag.ownerId !== userId) {
      continue;
    }

    await storage.updateTaskArea(tagIds[i], { displayOrder: i });
  }

  return c.json({ success: true, message: "Ordem das tags atualizada" });
});

// ============== TASKS ==============

// GET /api/tasks
tasksRouter.get("/api/tasks", async (c) => {
  const { userId } = c.get("user");
  const storage = getStorage(c.get("db"));

  const accessibleAreaIds = await getUserAccessibleAreaIds(userId, storage);

  // Construir query segura
  const conditions = [];

  const tagId = c.req.query("tagId");
  const status = c.req.query("status");
  const assigneeId = c.req.query("assignee_id");
  const createdBy = c.req.query("created_by");
  const type = c.req.query("type");

  if (tagId) conditions.push(eq(tasks.tagId, tagId));
  if (status) conditions.push(eq(tasks.status, status));
  if (assigneeId) conditions.push(eq(tasks.assigneeId, assigneeId));
  if (createdBy) conditions.push(eq(tasks.createdBy, createdBy));
  if (type) conditions.push(eq(tasks.type, type));

  // FILTRO DE SEGURANÇA CRÍTICO
  const securityConditions = [
    // 1. Próprias tarefas (incluindo privadas)
    eq(tasks.createdBy, userId),

    // 2. Tarefas atribuídas ao usuário, mas NÃO privadas de outros
    and(
      eq(tasks.assigneeId, userId),
      sql`${tasks.createdBy} = ${userId} OR ${tasks.visibility} != 'private'`,
    ),
  ];

  // 3. TODAS as tarefas em áreas acessíveis
  if (accessibleAreaIds.length > 0) {
    securityConditions.push(
      or(...accessibleAreaIds.map((areaId) => eq(tasks.tagId, areaId))),
    );
  }

  // 4. Tarefas públicas
  securityConditions.push(eq(tasks.visibility, "public"));

  conditions.push(or(...securityConditions));

  const userTasks = (await storage.getTasksWithConditions(
    and(...(conditions || [])),
  )) as Task[];

  // Filtrar por multi-assignee em memória
  const multiAssigneeTasks = (await storage.getTasksWithConditions(
    and(
      sql`${tasks.assigneeIds} IS NOT NULL`,
      or(sql`${tasks.visibility} != 'private'`, eq(tasks.createdBy, userId)),
    ),
  )) as Task[];

  const filteredMultiAssignee = multiAssigneeTasks.filter((t: Task) => {
    if (!t.assigneeIds) return false;
    if (t.visibility === "private" && t.createdBy !== userId) {
      if (t.tagId && accessibleAreaIds.includes(t.tagId)) {
        // Usuário tem acesso à tag, pode ver a tarefa
      } else {
        return false;
      }
    }
    try {
      const ids =
        typeof t.assigneeIds === "string"
          ? JSON.parse(t.assigneeIds)
          : t.assigneeIds;
      return Array.isArray(ids) && ids.includes(userId);
    } catch {
      return false;
    }
  });

  // Combinar resultados sem duplicatas
  const taskMap = new Map<string, Task>();
  userTasks.forEach((t: Task) => taskMap.set(t.id, t));
  multiAssigneeTasks.forEach((t: Task) => taskMap.set(t.id, t));
  const finalTasks = Array.from(taskMap.values());

  return c.json(finalTasks);
});

// GET /api/tasks/:id
tasksRouter.get("/api/tasks/:id", async (c) => {
  const { userId } = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");

  const task = await storage.getTask(id);
  if (!task) return c.json({ error: "Task not found" }, 404);

  // Se for o criador, sempre tem acesso
  if (task.createdBy === userId) {
    return c.json(task);
  }

  // Se for privada e não for o criador, verificar se tem acesso à tag
  if (task.visibility === "private") {
    if (task.tagId) {
      const accessibleAreaIds = await getUserAccessibleAreaIds(userId, storage);
      if (accessibleAreaIds.includes(task.tagId)) {
        return c.json(task);
      }
    }
    return c.json({ error: "Access denied - private task" }, 403);
  }

  // Se for pública, permitir acesso
  if (task.visibility === "public") {
    return c.json(task);
  }

  // Se for compartilhada (shared), verificar acesso à área
  if (task.visibility === "shared" && task.tagId) {
    const accessibleAreaIds = await getUserAccessibleAreaIds(userId, storage);
    if (accessibleAreaIds.includes(task.tagId)) {
      return c.json(task);
    }
  }

  // Verificar se está atribuída ao usuário (exceto privadas)
  if (task.assigneeId === userId && task.visibility !== "private") {
    return c.json(task);
  }

  // Verificar multi-assignee
  if (task.assigneeIds && task.visibility !== "private") {
    try {
      const ids =
        typeof task.assigneeIds === "string"
          ? JSON.parse(task.assigneeIds)
          : task.assigneeIds;
      if (Array.isArray(ids) && ids.includes(userId)) {
        return c.json(task);
      }
    } catch {
      // ignore parse errors
    }
  }

  return c.json({ error: "Access denied" }, 403);
});

// POST /api/tasks
tasksRouter.post("/api/tasks", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();

  try {
    const validated = insertTaskSchema.parse(body);
    const task = await storage.createTask(validated);

    // meetingData is stored as JSON in a TEXT field
    if (task.type === "meeting_note") {
      let meetingData: {
        date?: string;
        time?: string;
        participants?: string[];
        externalParticipants?: string[];
      } | null = null;

      try {
        meetingData =
          typeof task.meetingData === "string"
            ? JSON.parse(task.meetingData)
            : (task.meetingData as unknown as typeof meetingData);
      } catch {
        meetingData = null;
      }

      if (meetingData?.date && meetingData?.time) {
        const organizer = task.createdBy ? await storage.getUser(task.createdBy) : null;
        const participantIds = meetingData.participants || [];
        const validParticipants = (
          await Promise.all(participantIds.map((pid: string) => storage.getUser(pid)))
        ).filter(Boolean) as any[];
        const externalEmails = meetingData.externalParticipants || [];

        if (organizer) {
          sendMeetingInviteEmail(c.env, storage, task, organizer, validParticipants, externalEmails).catch(console.error);
        }
      }
    }

    if (task.assigneeId && task.assigneeId !== task.createdBy) {
      const creator = await storage.getUser(task.createdBy);
      storage
        .createNotification({
          userId: task.assigneeId,
          fromUserId: task.createdBy,
          title: "Nova tarefa atribuída",
          message: `${creator?.name || "Alguém"} atribuiu a tarefa "${task.title}" a você`,
          module: "tarefas",
          entityId: task.id,
          linkUrl: `/tarefas/${task.id}`,
        })
        .catch(console.error);
    }

    if (task.assigneeIds && task.type !== "meeting_note") {
      try {
        const ids =
          typeof task.assigneeIds === "string"
            ? JSON.parse(task.assigneeIds)
            : task.assigneeIds;
        if (Array.isArray(ids)) {
          const creator = await storage.getUser(task.createdBy);
          for (const assigneeId of ids) {
            if (assigneeId !== task.createdBy && assigneeId !== task.assigneeId) {
              storage
                .createNotification({
                  userId: assigneeId,
                  fromUserId: task.createdBy,
                  title: "Nova tarefa atribuída",
                  message: `${creator?.name || "Alguém"} atribuiu a tarefa "${task.title}" a você`,
                  module: "tarefas",
                  entityId: task.id,
                  linkUrl: `/tarefas/${task.id}`,
                })
                .catch(console.error);
            }
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    if (task.type === "meeting_note") {
      let meetingParticipants: string[] = [];
      try {
        const md =
          typeof task.meetingData === "string"
            ? JSON.parse(task.meetingData)
            : task.meetingData;
        meetingParticipants = md?.participants || [];
      } catch {
        // ignore parse errors
      }
      const organizer = await storage.getUser(task.createdBy);
      for (const participantId of meetingParticipants) {
        if (participantId !== task.createdBy) {
          storage
            .createNotification({
              userId: participantId,
              fromUserId: task.createdBy,
              title: "Nova reunião agendada",
              message: `${organizer?.name || "Alguém"} convidou você para a reunião "${task.title}"`,
              module: "reunioes",
              entityId: task.id,
              linkUrl: `/reunioes/${task.id}`,
            })
            .catch(console.error);
        }
      }
    }

    return c.json(task, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to create task" }, 400);
  }
});

// PATCH /api/tasks/reorder
tasksRouter.patch("/api/tasks/reorder", async (c) => {
  const storage = getStorage(c.get("db"));
  const { updates } = await c.req.json();

  if (!Array.isArray(updates)) {
    return c.json({ error: "Updates must be an array" }, 400);
  }

  try {
    await Promise.all(
      updates.map((update: { id: string; order: number }) =>
        storage.updateTask(update.id, { order: update.order }),
      ),
    );

    return c.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    throw error;
  }
});

// PUT /api/tasks/:id
tasksRouter.put("/api/tasks/:id", async (c) => {
  const { userId: sessionUserId } = c.get("user");
  const isAdmin = c.get("user").role === "admin";
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const body = await c.req.json();

  try {
    const existingTask = await storage.getTask(id);
    if (!existingTask) return c.json({ error: "Task not found" }, 404);

    if (!isAdmin && existingTask.tagId) {
      const accessibleAreaIds = await getUserAccessibleAreaIds(sessionUserId, storage);
      if (!accessibleAreaIds.includes(existingTask.tagId)) {
        return c.json({ error: "Access denied to this task" }, 403);
      }
    }

    const partialSchema = insertTaskSchema.partial();
    const validated = partialSchema.parse(body);
    const task = await storage.updateTask(id, validated);
    if (!task) return c.json({ error: "Task not found" }, 404);

    if (validated.assigneeId && task && task.assigneeId) {
      const updatedBy = body.updatedBy || task.createdBy;
      if (task.assigneeId !== updatedBy && task.assigneeId !== existingTask.assigneeId) {
        const updater = await storage.getUser(updatedBy);
        storage
          .createNotification({
            userId: task.assigneeId,
            fromUserId: updatedBy,
            title: "Tarefa atribuída a você",
            message: `${updater?.name || "Alguém"} atribuiu a tarefa "${task.title}" a você`,
            module: "tarefas",
            entityId: task.id,
            linkUrl: `/tarefas/${task.id}`,
          })
          .catch(console.error);
      }
    }

    if (validated.assigneeIds) {
      try {
        const newIds =
          typeof validated.assigneeIds === "string"
            ? JSON.parse(validated.assigneeIds)
            : validated.assigneeIds;
        let oldIds: string[] = [];
        try {
          oldIds = existingTask.assigneeIds
            ? typeof existingTask.assigneeIds === "string"
              ? JSON.parse(existingTask.assigneeIds)
              : existingTask.assigneeIds
            : [];
        } catch {
          // ignore parse errors
        }
        if (Array.isArray(newIds)) {
          const oldSet = new Set(oldIds);
          const updatedBy = body.updatedBy || task!.createdBy;
          const updater = await storage.getUser(updatedBy);
          for (const assigneeId of newIds) {
            if (
              !oldSet.has(assigneeId) &&
              assigneeId !== updatedBy &&
              assigneeId !== task!.assigneeId
            ) {
              storage
                .createNotification({
                  userId: assigneeId,
                  fromUserId: updatedBy,
                  title: "Tarefa atribuída a você",
                  message: `${updater?.name || "Alguém"} atribuiu a tarefa "${task!.title}" a você`,
                  module: "tarefas",
                  entityId: task!.id,
                  linkUrl: `/tarefas/${task!.id}`,
                })
                .catch(console.error);
            }
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    return c.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to update task" }, 400);
  }
});

// PATCH /api/tasks/:id (partial update / inline editing)
tasksRouter.patch("/api/tasks/:id", async (c) => {
  const { userId: sessionUserId } = c.get("user");
  const isAdmin = c.get("user").role === "admin";
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const body = await c.req.json();

  if (!sessionUserId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const existingTask = await storage.getTask(id);
    if (!existingTask) {
      return c.json({ error: "Task not found" }, 404);
    }

    if (!isAdmin && existingTask.tagId) {
      const accessibleAreaIds = await getUserAccessibleAreaIds(sessionUserId, storage);
      if (!accessibleAreaIds.includes(existingTask.tagId)) {
        return c.json({ error: "Access denied to this task" }, 403);
      }
    }

    const partialSchema = insertTaskSchema.partial();
    const validated = partialSchema.parse(body);

    const task = await storage.updateTask(id, validated);

    if (!task) {
      return c.json({ error: "Task not found" }, 404);
    }
    return c.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to update task" }, 400);
  }
});

// DELETE /api/tasks/:id
tasksRouter.delete("/api/tasks/:id", async (c) => {
  const { userId } = c.get("user");
  const isAdmin = c.get("user").role === "admin";
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");

  const task = await storage.getTask(id);
  if (!task) return c.json({ error: "Task not found" }, 404);

  if (!isAdmin && task.tagId) {
    const accessibleAreaIds = await getUserAccessibleAreaIds(userId, storage);
    if (!accessibleAreaIds.includes(task.tagId)) {
      return c.json({ error: "Access denied to delete this task" }, 403);
    }
  }

  const scope = c.req.query("scope") || "single";
  if (scope === "all") {
    await storage.deleteTaskRecurrenceSeries(id);
  } else if (scope === "future") {
    await storage.deleteTaskRecurrenceFuture(id);
  } else {
    const deleted = await storage.deleteTask(id);
    if (!deleted) return c.json({ error: "Task not found" }, 404);
  }

  return c.body(null, 204);
});

// PATCH /api/tasks/:id/remove-recurrence
tasksRouter.patch("/api/tasks/:id/remove-recurrence", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");

  const task = await storage.getTask(id);
  if (!task) return c.json({ error: "Task not found" }, 404);

  const updated = await storage.removeTaskRecurrence(id);
  if (!updated) return c.json({ error: "Task not found" }, 404);
  return c.json(updated);
});

// ============== SUBTASKS ==============

// GET /api/tasks/:id/subtasks
tasksRouter.get("/api/tasks/:id/subtasks", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const subtasks = await storage.getSubTasks(id);
  return c.json(subtasks);
});

// ============== TASK COMMENTS ==============

// GET /api/tasks/:id/comments
tasksRouter.get("/api/tasks/:id/comments", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const comments = await storage.getTaskComments(id);
  return c.json(comments);
});

// POST /api/tasks/:id/comments
tasksRouter.post("/api/tasks/:id/comments", async (c) => {
  const { userId } = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const body = await c.req.json();

  try {
    const data = { ...body, taskId: id, authorId: userId, mentions: extractMentions(body?.content) };
    const validated = insertTaskCommentSchema.parse(data);
    const comment = await storage.createTaskComment(validated);

    // Process @mentions and send notifications
    const mentionMatches = validated.content.match(/@(\w+(?:\s+\w+)?)/g);
    if (mentionMatches) {
      const task = await storage.getTask(id);
      const users = await storage.getUsers();
      const author = await storage.getUser(validated.authorId);

      for (const mention of mentionMatches) {
        const mentionedName = mention.slice(1).trim();
        const mentionedUser = users.find(
          (u) => u.name.toLowerCase() === mentionedName.toLowerCase(),
        );

        if (mentionedUser && task && author) {
          sendMentionNotificationEmail(
            c.env, storage, mentionedUser, author.name, task.title, task.id, validated.content
          ).catch(console.error);

          storage
            .createNotification({
              userId: mentionedUser.id,
              fromUserId: author.id,
              title: "Menção em tarefa",
              message: `${author.name} mencionou você em um comentário na tarefa "${task.title}"`,
              module: "tarefas",
              entityId: task.id,
              linkUrl: `/tarefas/${task.id}`,
            })
            .catch(console.error);
        }
      }
    }

    return c.json(comment, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to create comment" }, 400);
  }
});

// PATCH /api/task-comments/:id
tasksRouter.patch("/api/task-comments/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const body = await c.req.json();

  try {
    const comment = await storage.updateTaskComment(id, {
      content: body.content,
      mentions: extractMentions(body.content),
    });
    if (!comment) return c.json({ error: "Comment not found" }, 404);
    return c.json(comment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    throw error;
  }
});

// DELETE /api/task-comments/:id
tasksRouter.delete("/api/task-comments/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const deleted = await storage.deleteTaskComment(id);
  if (!deleted) return c.json({ error: "Comment not found" }, 404);
  return c.body(null, 204);
});

// ============== TASK REACTIONS ==============

// GET /api/task-comments/:id/reactions
tasksRouter.get("/api/task-comments/:id/reactions", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const reactions = await storage.getTaskReactions(id);
  return c.json(reactions);
});

// POST /api/task-comments/:id/reactions
tasksRouter.post("/api/task-comments/:id/reactions", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const body = await c.req.json();

  try {
    const data = { ...body, commentId: id };
    const validated = insertTaskReactionSchema.parse(data);
    const reaction = await storage.addTaskReaction(validated);
    return c.json(reaction, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to add reaction" }, 400);
  }
});

// DELETE /api/task-reactions/:id
tasksRouter.delete("/api/task-reactions/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const deleted = await storage.removeTaskReaction(id);
  if (!deleted) return c.json({ error: "Reaction not found" }, 404);
  return c.body(null, 204);
});

// ============== TASK ATTACHMENTS ==============

// GET /api/tasks/:id/attachments
tasksRouter.get("/api/tasks/:id/attachments", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const attachments = await storage.getTaskAttachments(id);
  return c.json(attachments);
});

// POST /api/tasks/:id/attachments
tasksRouter.post("/api/tasks/:id/attachments", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const body = await c.req.json();

  try {
    const data = { ...body, taskId: id };
    const validated = insertTaskAttachmentSchema.parse(data);
    const attachment = await storage.addTaskAttachment(validated);
    return c.json(attachment, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    throw error;
  }
});

// DELETE /api/task-attachments/:id
tasksRouter.delete("/api/task-attachments/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const deleted = await storage.removeTaskAttachment(id);
  if (!deleted) return c.json({ error: "Attachment not found" }, 404);
  return c.body(null, 204);
});

// ============== TASK TEMPLATES ==============

// GET /api/task-templates
tasksRouter.get("/api/task-templates", async (c) => {
  const storage = getStorage(c.get("db"));
  const type = c.req.query("type") || undefined;
  const templates = await storage.getTaskTemplates(type);
  return c.json(templates);
});

// GET /api/task-templates/:id
tasksRouter.get("/api/task-templates/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const template = await storage.getTaskTemplate(id);
  if (!template) return c.json({ error: "Template not found" }, 404);
  return c.json(template);
});

// POST /api/task-templates
tasksRouter.post("/api/task-templates", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();

  try {
    const validated = insertTaskTemplateSchema.parse(body);
    const template = await storage.createTaskTemplate(validated);
    return c.json(template, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.errors }, 400);
    }
    throw error;
  }
});

// PUT /api/task-templates/:id
tasksRouter.put("/api/task-templates/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const body = await c.req.json();
  const template = await storage.updateTaskTemplate(id, body);
  if (!template) return c.json({ error: "Template not found" }, 404);
  return c.json(template);
});

// POST /api/task-templates/:id/set-default
tasksRouter.post("/api/task-templates/:id/set-default", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const template = await storage.getTaskTemplate(id);
  if (!template) return c.json({ error: "Template not found" }, 404);
  const success = await storage.setDefaultTaskTemplate(template.id, template.type);
  if (!success) return c.json({ error: "Failed to set default template" }, 500);
  return c.json({ success: true });
});

// DELETE /api/task-templates/:id/set-default
tasksRouter.delete("/api/task-templates/:id/set-default", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const success = await storage.unsetDefaultTaskTemplate(id);
  if (!success) return c.json({ error: "Template not found" }, 404);
  return c.json({ success: true });
});

// DELETE /api/task-templates/:id
tasksRouter.delete("/api/task-templates/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const success = await storage.deleteTaskTemplate(id);
  if (!success) return c.json({ error: "Template not found" }, 404);
  return c.json({ success: true });
});

// ============== AREA TASKS (convenient endpoint) ==============

// GET /api/task-tags/:id/tasks
tasksRouter.get("/api/task-tags/:id/tasks", async (c) => {
  const { userId } = c.get("user");
  const storage = getStorage(c.get("db"));
  const tagId = c.req.param("id");

  const tag = await storage.getTaskTag(tagId);
  if (!tag) {
    return c.json({ error: "Tag não encontrada" }, 404);
  }

  const userAreas = await getUserAccessibleAreaIds(userId, storage);
  const hasAccess = userAreas.includes(tagId);

  if (!hasAccess) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  const tagTasks = await storage.getTasks({ tagId });
  return c.json(tagTasks);
});

export { tasksRouter as tasks };
