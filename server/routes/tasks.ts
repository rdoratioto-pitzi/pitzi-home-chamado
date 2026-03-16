import { Router, type Request } from "express";
import { storage } from "../storage";
import {
  sendMeetingInviteEmail,
  sendSharedAreaInviteEmail,
  sendMentionNotificationEmail,
} from "../email-service";
import {
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
} from "@shared/schema";
import { z } from "zod";
import { sql, eq, or, and, type SQL } from "drizzle-orm";
import { tasks, type Task } from "@shared/schema";
import { getSessionUser, requireAuth, requireAdmin } from "../middleware/auth";

type SessionUser = {
  userId: string;
  isAdmin: boolean;
};

export function registerTaskRoutes(router: Router) {
  const getId = (req: Request) => req.params.id as string;

  async function getUserAccessibleAreaIds(userId: string): Promise<string[]> {
    const areas = await storage.getTaskAreas(userId);
    return areas.map(a => a.id);
  }

  // ============== TASK AREAS / TASK TAGS ==============
  router.get("/api/task-tags", requireAuth, async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    const scope = (req.query.scope as string) || undefined;
    const areas = await storage.getTaskAreas(userId);
    const filtered = scope ? areas.filter(a => a.scope === scope) : areas;
    res.json(filtered);
  });

  // Buscar tag padrão - DEVE estar antes da rota /:id
  router.get("/api/task-tags/default", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const { scope } = req.query; // 'tasks' ou 'meetings'

      const userTags = await storage.getTaskAreas(userId);
      const defaultTag = userTags.find(t =>
        t.isDefault === true &&
        (!scope || t.scope === scope)
      );

      res.json(defaultTag || null);
    } catch (error) {
      console.error("Erro ao buscar tag padrão:", error);
      res.status(500).json({ error: "Erro ao buscar tag padrão" });
    }
  });

  router.get("/api/task-tags/:id", requireAuth, async (req, res) => {
    const { userId } = getSessionUser(req);
    const area = await storage.getTaskArea(getId(req));
    if (!area) return res.status(404).json({ error: "Area not found" });
    const accessibleIds = await getUserAccessibleAreaIds(userId);
    if (!accessibleIds.includes(area.id)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(area);
  });

  router.post("/api/task-tags", requireAuth, async (req, res) => {
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

  router.put("/api/task-tags/:id", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const existing = await storage.getTaskArea(getId(req));
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
      const area = await storage.updateTaskArea(getId(req), validated);
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

  // There were two identical PUT /api/task-tags/:id routes, keeping only one.
  // The first one had additional logic for `effectiveScope` and `effectiveVisibility` that seems correct.

  router.delete("/api/task-tags/:id", requireAuth, async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    const area = await storage.getTaskArea(getId(req));
    if (!area) return res.status(404).json({ error: "Area not found" });
    if (!isAdmin && area.ownerId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const deleted = await storage.deleteTaskArea(getId(req));
    if (!deleted) return res.status(404).json({ error: "Area not found" });
    res.status(204).send();
  });

  // Task Area Members
  router.get("/api/task-tags/:id/members", requireAuth, async (req, res) => {
    const members = await storage.getTaskAreaMembers(getId(req));
    res.json(members);
  });

  router.post("/api/task-tags/:id/members", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, tagId: getId(req) };
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

  router.patch("/api/task-area-members/:id", requireAuth, async (req, res) => {
    try {
      const partialSchema = insertTaskAreaMemberSchema.partial();
      const validated = partialSchema.parse(req.body);
      const member = await storage.updateTaskAreaMember(getId(req), validated);
      if (!member) return res.status(404).json({ error: "Member not found" });
      res.json(member);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update member" });
    }
  });

  router.delete("/api/task-area-members/:id", requireAuth, async (req, res) => {
    const deleted = await storage.removeTaskAreaMember(getId(req));
    if (!deleted) return res.status(404).json({ error: "Member not found" });
    res.status(204).send();
  });

  // ============== TASK TAGS - DEFAULT & REORDER ==============
  // Definir tag como padrão
  router.post("/api/task-tags/:id/set-default", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const id = getId(req);
      const { scope } = req.body; // 'tasks' ou 'meetings'

      // Verificar se a tag existe e pertence ao usuário
      const tag = await storage.getTaskArea(id);
      if (!tag) {
        return res.status(404).json({ error: "Tag não encontrada" });
      }

      if (!isAdmin && tag.ownerId !== userId) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      // Remover padrão de todas as tags do usuário no mesmo escopo
      const userTags = await storage.getTaskAreas(userId);
      const tagsOfSameScope = userTags.filter(t => t.scope === (scope || tag.scope));
      
      for (const t of tagsOfSameScope) {
        if (t.isDefault) {
          await storage.updateTaskArea(t.id, { isDefault: false });
        }
      }

      // Definir esta tag como padrão
      await storage.updateTaskArea(id, { isDefault: true });

      res.json({ success: true, message: "Tag definida como padrão" });
    } catch (error) {
      console.error("Erro ao definir tag padrão:", error);
      res.status(500).json({ error: "Erro ao definir tag padrão" });
    }
  });

  // Remover tag como padrão
  router.delete("/api/task-tags/:id/set-default", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const id = getId(req);

      const tag = await storage.getTaskArea(id);
      if (!tag) {
        return res.status(404).json({ error: "Tag não encontrada" });
      }

      if (!isAdmin && tag.ownerId !== userId) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      await storage.updateTaskArea(id, { isDefault: false });

      res.json({ success: true, message: "Tag removida como padrão" });
    } catch (error) {
      console.error("Erro ao remover tag padrão:", error);
      res.status(500).json({ error: "Erro ao remover tag padrão" });
    }
  });

  // Reordenar tags
  router.post("/api/task-tags/reorder", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const { tagIds, scope } = req.body; // Array de IDs na nova ordem

      if (!Array.isArray(tagIds)) {
        return res.status(400).json({ error: "tagIds deve ser um array" });
      }

      // Atualizar displayOrder de cada tag
      for (let i = 0; i < tagIds.length; i++) {
        const tag = await storage.getTaskArea(tagIds[i]);
        if (!tag) continue;
        
        // Verificar permissão
        if (!isAdmin && tag.ownerId !== userId) {
          continue; // Pular tags que não pertencem ao usuário
        }

        await storage.updateTaskArea(tagIds[i], { displayOrder: i });
      }

      res.json({ success: true, message: "Ordem das tags atualizada" });
    } catch (error) {
      console.error("Erro ao reordenar tags:", error);
      res.status(500).json({ error: "Erro ao reordenar tags" });
    }
  });

  // ============== TASKS ==============
  router.get("/api/tasks", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);

      // TODOS os usuários (incluindo admin) seguem a MESMA regra de segurança:
      // Admin NÃO tem acesso especial a itens privados de outros usuários

      // Regras de visibilidade:
      // - private: Apenas o criador vê
      // - shared: Criador + usuários em áreas acessíveis
      // - public: Todos veem

      const accessibleAreaIds = await getUserAccessibleAreaIds(userId);

      // Construir query segura
      const conditions = [];

      // Aplicar filtros de query string
      if (req.query.tagId) conditions.push(eq(tasks.tagId, req.query.tagId as string));
      if (req.query.status) conditions.push(eq(tasks.status, req.query.status as string));
      if (req.query.assignee_id) conditions.push(eq(tasks.assigneeId, req.query.assignee_id as string));
      if (req.query.created_by) conditions.push(eq(tasks.createdBy, req.query.created_by as string));
      if (req.query.type) conditions.push(eq(tasks.type, req.query.type as string));

      // FILTRO DE SEGURANÇA CRÍTICO:
      // Usuário (incluindo admin) vê apenas:
      // 1. Tarefas criadas por ele (todas, incluindo privadas)
      // 2. Tarefas atribuídas a ele (exceto privadas de outros)
      // 3. Tarefas compartilhadas (shared) em áreas acessíveis
      // 4. Tarefas públicas (public) de qualquer área
      const securityConditions = [
        // 1. Próprias tarefas (incluindo privadas) - sempre visíveis para o criador
        eq(tasks.createdBy, userId),

        // 2. Tarefas atribuídas ao usuário, mas NÃO privadas de outros
        and(
          eq(tasks.assigneeId, userId),
          sql`${tasks.createdBy} = ${userId} OR ${tasks.visibility} != 'private'`
        ),
      ];

      // 3. TODAS as tarefas em áreas acessíveis (tags compartilhadas onde o usuário é membro)
      // IMPORTANTE: Se o usuário tem acesso a uma tag, ele deve ver TODAS as reuniões/tarefas
      // dessa tag, independente da visibilidade da tarefa (private, shared ou public)
      if (accessibleAreaIds.length > 0) {
        securityConditions.push(
          or(...accessibleAreaIds.map(areaId => eq(tasks.tagId, areaId)))
        );
      }

      // 4. Tarefas públicas - todos podem ver
      securityConditions.push(eq(tasks.visibility, 'public'));

      conditions.push(or(...securityConditions));

      const userTasks = await storage.getTasksWithConditions(and(...(conditions || []))) as Task[];

      // Filtrar por multi-assignee em memória (não é possível fazer no SQL diretamente)
      // Inclui tarefas onde o usuário está na lista de assigneeIds E tem acesso à tag
      const multiAssigneeTasks = await storage.getTasksWithConditions(
        and(
          sql`${tasks.assigneeIds} IS NOT NULL`,
          or(
            sql`${tasks.visibility} != 'private'`,
            eq(tasks.createdBy, userId)
          )
        )
      ) as Task[];

      const filteredMultiAssignee = multiAssigneeTasks.filter((t: Task) => {
        if (!t.assigneeIds) return false;
        // Não incluir tarefas privadas de outros usuários, EXCETO se o usuário tem acesso à tag
        if (t.visibility === 'private' && t.createdBy !== userId) {
          // Verificar se o usuário tem acesso à tag da tarefa
          if (t.tagId && accessibleAreaIds.includes(t.tagId)) {
            // Usuário tem acesso à tag, pode ver a tarefa
          } else {
            return false;
          }
        }
        try {
          const ids = typeof t.assigneeIds === 'string' ? JSON.parse(t.assigneeIds) : t.assigneeIds;
          return Array.isArray(ids) && ids.includes(userId);
        } catch (e) { return false; }
      });

      // Combinar resultados sem duplicatas
      const taskMap = new Map<string, Task>();
      userTasks.forEach((t: Task) => taskMap.set(t.id, t));
      multiAssigneeTasks.forEach((t: Task) => taskMap.set(t.id, t));
      const finalTasks = Array.from(taskMap.values());

      res.json(finalTasks);
    } catch (error: any) {
      console.error("Erro ao buscar tarefas:", error);
      res.status(500).json({ error: "Erro ao buscar tarefas" });
    }
  });

  router.get("/api/tasks/:id", requireAuth, async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    const task = await storage.getTask(getId(req));
    if (!task) return res.status(404).json({ error: "Task not found" });

    // Verificar acesso seguindo as mesmas regras de visibilidade (incluindo admin)
    // Private: apenas o criador
    // Shared: criador + usuários em áreas acessíveis
    // Public: todos
    
    // Se for o criador, sempre tem acesso
    if (task.createdBy === userId) {
      return res.json(task);
    }

    // Se for privada e não for o criador, verificar se tem acesso à tag
    if (task.visibility === 'private') {
      // Verificar se o usuário tem acesso à tag da tarefa
      if (task.tagId) {
        const accessibleAreaIds = await getUserAccessibleAreaIds(userId);
        if (accessibleAreaIds.includes(task.tagId)) {
          return res.json(task); // Usuário é membro da tag, pode ver a tarefa
        }
      }
      return res.status(403).json({ error: "Access denied - private task" });
    }

    // Se for pública, permitir acesso
    if (task.visibility === 'public') {
      return res.json(task);
    }

    // Se for compartilhada (shared), verificar acesso à área
    if (task.visibility === 'shared' && task.tagId) {
      const accessibleAreaIds = await getUserAccessibleAreaIds(userId);
      if (accessibleAreaIds.includes(task.tagId)) {
        return res.json(task);
      }
    }

    // Verificar se está atribuída ao usuário (exceto privadas)
    if (task.assigneeId === userId && task.visibility !== 'private') {
      return res.json(task);
    }

    // Verificar multi-assignee
    if (task.assigneeIds && task.visibility !== 'private') {
      try {
        const ids = typeof task.assigneeIds === 'string' ? JSON.parse(task.assigneeIds) : task.assigneeIds;
        if (Array.isArray(ids) && ids.includes(userId)) {
          return res.json(task);
        }
      } catch (e) { }
    }

    return res.status(403).json({ error: "Access denied" });
  });

  router.post("/api/tasks", requireAuth, async (req, res) => {
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

      if (task.assigneeId && task.assigneeId !== task.createdBy) {
        const creator = await storage.getUser(task.createdBy);
        storage.createNotification({
          userId: task.assigneeId,
          fromUserId: task.createdBy,
          title: "Nova tarefa atribuída",
          message: `${creator?.name || 'Alguém'} atribuiu a tarefa "${task.title}" a você`,
          module: "tarefas",
          entityId: task.id,
          linkUrl: `/tarefas/${task.id}`,
        }).catch(console.error);
      }

      if (task.assigneeIds && task.type !== "meeting_note") {
        try {
          const ids = typeof task.assigneeIds === 'string' ? JSON.parse(task.assigneeIds) : task.assigneeIds;
          if (Array.isArray(ids)) {
            const creator = await storage.getUser(task.createdBy);
            for (const assigneeId of ids) {
              if (assigneeId !== task.createdBy && assigneeId !== task.assigneeId) {
                storage.createNotification({
                  userId: assigneeId,
                  fromUserId: task.createdBy,
                  title: "Nova tarefa atribuída",
                  message: `${creator?.name || 'Alguém'} atribuiu a tarefa "${task.title}" a você`,
                  module: "tarefas",
                  entityId: task.id,
                  linkUrl: `/tarefas/${task.id}`,
                }).catch(console.error);
              }
            }
          }
        } catch { }
      }

      if (task.type === "meeting_note") {
        let meetingParticipants: string[] = [];
        try {
          const md = typeof task.meetingData === 'string' ? JSON.parse(task.meetingData) : task.meetingData;
          meetingParticipants = md?.participants || [];
        } catch { }
        const organizer = await storage.getUser(task.createdBy);
        for (const participantId of meetingParticipants) {
          if (participantId !== task.createdBy) {
            storage.createNotification({
              userId: participantId,
              fromUserId: task.createdBy,
              title: "Nova reunião agendada",
              message: `${organizer?.name || 'Alguém'} convidou você para a reunião "${task.title}"`,
              module: "reunioes",
              entityId: task.id,
              linkUrl: `/reunioes/${task.id}`,
            }).catch(console.error);
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

  router.patch("/api/tasks/reorder", requireAuth, async (req, res) => {
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
      console.error("[tasks] Error reordering tasks:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.put("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const { userId: sessionUserId, isAdmin } = getSessionUser(req);
      const existingTask = await storage.getTask(getId(req));
      if (!existingTask) return res.status(404).json({ error: "Task not found" });
      if (!isAdmin && existingTask.tagId) {
        const accessibleAreaIds = await getUserAccessibleAreaIds(sessionUserId);
        if (!accessibleAreaIds.includes(existingTask.tagId)) {
          return res.status(403).json({ error: "Access denied to this task" });
        }
      }
      const partialSchema = insertTaskSchema.partial();
      const validated = partialSchema.parse(req.body);
      const task = await storage.updateTask(getId(req), validated);
      if (!task) return res.status(404).json({ error: "Task not found" });
      if (validated.assigneeId && task && task.assigneeId) {
        const updatedBy = req.body.updatedBy || task.createdBy;
        if (task.assigneeId !== updatedBy && task.assigneeId !== existingTask.assigneeId) {
          const updater = await storage.getUser(updatedBy);
          storage.createNotification({
            userId: task.assigneeId,
            fromUserId: updatedBy,
            title: "Tarefa atribuída a você",
            message: `${updater?.name || 'Alguém'} atribuiu a tarefa "${task.title}" a você`,
            module: "tarefas",
            entityId: task.id,
            linkUrl: `/tarefas/${task.id}`,
          }).catch(console.error);
        }
      }

      if (validated.assigneeIds) {
        try {
          const newIds = typeof validated.assigneeIds === 'string' ? JSON.parse(validated.assigneeIds) : validated.assigneeIds;
          let oldIds: string[] = [];
          try {
            oldIds = existingTask.assigneeIds
              ? (typeof existingTask.assigneeIds === 'string' ? JSON.parse(existingTask.assigneeIds) : existingTask.assigneeIds)
              : [];
          } catch { }
          if (Array.isArray(newIds)) {
            const oldSet = new Set(oldIds);
            const updatedBy = req.body.updatedBy || task!.createdBy;
            const updater = await storage.getUser(updatedBy);
            for (const assigneeId of newIds) {
              if (!oldSet.has(assigneeId) && assigneeId !== updatedBy && assigneeId !== task!.assigneeId) {
                storage.createNotification({
                  userId: assigneeId,
                  fromUserId: updatedBy,
                  title: "Tarefa atribuída a você",
                  message: `${updater?.name || 'Alguém'} atribuiu a tarefa "${task!.title}" a você`,
                  module: "tarefas",
                  entityId: task!.id,
                  linkUrl: `/tarefas/${task!.id}`,
                }).catch(console.error);
              }
            }
          }
        } catch { }
      }

      res.json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update task" });
    }
  });

  // PATCH route for partial task updates (inline editing)
  router.patch("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const { userId: sessionUserId, isAdmin } = getSessionUser(req);
      
      if (!sessionUserId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const existingTask = await storage.getTask(getId(req));
      if (!existingTask) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      if (!isAdmin && existingTask.tagId) {
        const accessibleAreaIds = await getUserAccessibleAreaIds(sessionUserId);
        if (!accessibleAreaIds.includes(existingTask.tagId)) {
          return res.status(403).json({ error: "Access denied to this task" });
        }
      }
      
      const partialSchema = insertTaskSchema.partial();
      const validated = partialSchema.parse(req.body);
      
      const task = await storage.updateTask(getId(req), validated);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error('❌ Erro ao atualizar tarefa:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update task" });
    }
  });

  router.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    const task = await storage.getTask(getId(req));
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (!isAdmin && task.tagId) {
      const accessibleAreaIds = await getUserAccessibleAreaIds(userId);
      if (!accessibleAreaIds.includes(task.tagId)) {
        return res.status(403).json({ error: "Access denied to delete this task" });
      }
    }
    const scope = (req.query.scope as string) || "single";
    if (scope === "all") {
      await storage.deleteTaskRecurrenceSeries(getId(req));
    } else if (scope === "future") {
      await storage.deleteTaskRecurrenceFuture(getId(req));
    } else {
      const deleted = await storage.deleteTask(getId(req));
      if (!deleted) return res.status(404).json({ error: "Task not found" });
    }
    res.status(204).send();
  });

  // Remove recorrência de uma instância específica sem excluir o registro
  router.patch("/api/tasks/:id/remove-recurrence", requireAuth, async (req, res) => {
    const task = await storage.getTask(getId(req));
    if (!task) return res.status(404).json({ error: "Task not found" });
    const updated = await storage.removeTaskRecurrence(getId(req));
    if (!updated) return res.status(404).json({ error: "Task not found" });
    res.json(updated);
  });

  // ============== TASK COMMENTS ==============
  router.get("/api/tasks/:id/subtasks", requireAuth, async (req, res) => {
    const subtasks = await storage.getSubTasks(getId(req));
    res.json(subtasks);
  });

  router.get("/api/tasks/:id/comments", requireAuth, async (req, res) => {
    const comments = await storage.getTaskComments(getId(req));
    res.json(comments);
  });

  router.post("/api/tasks/:id/comments", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const data = { ...req.body, taskId: getId(req), authorId: userId };
      const validated = insertTaskCommentSchema.parse(data);
      const comment = await storage.createTaskComment(validated);

      // Process @mentions and send notifications
      const mentionMatches = validated.content.match(/@(\w+(?:\s+\w+)?)/g);
      if (mentionMatches) {
        const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const task = await storage.getTask(taskId);
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
            storage.createNotification({
              userId: mentionedUser.id,
              fromUserId: author.id,
              title: "Menção em tarefa",
              message: `${author.name} mencionou você em um comentário na tarefa "${task.title}"`,
              module: "tarefas",
              entityId: task.id,
              linkUrl: `/tarefas/${task.id}`,
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

  router.patch("/api/task-comments/:id", requireAuth, async (req, res) => {
    try {
      const comment = await storage.updateTaskComment(getId(req), { content: req.body.content });
      if (!comment) return res.status(404).json({ error: "Comment not found" });
      res.json(comment);
    } catch (error) {
      console.error("[tasks] Error updating comment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.delete("/api/task-comments/:id", requireAuth, async (req, res) => {
    const deleted = await storage.deleteTaskComment(getId(req));
    if (!deleted) return res.status(404).json({ error: "Comment not found" });
    res.status(204).send();
  });

  // ============== TASK REACTIONS ==============
  router.get("/api/task-comments/:id/reactions", requireAuth, async (req, res) => {
    const reactions = await storage.getTaskReactions(getId(req));
    res.json(reactions);
  });

  router.post("/api/task-comments/:id/reactions", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, commentId: getId(req) };
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

  router.delete("/api/task-reactions/:id", requireAuth, async (req, res) => {
    const deleted = await storage.removeTaskReaction(getId(req));
    if (!deleted) return res.status(404).json({ error: "Reaction not found" });
    res.status(204).send();
  });

  // ============== TASK ATTACHMENTS ==============
  router.get("/api/tasks/:id/attachments", requireAuth, async (req, res) => {
    const attachments = await storage.getTaskAttachments(getId(req));
    res.json(attachments);
  });

  router.post("/api/tasks/:id/attachments", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, taskId: getId(req) };
      const validated = insertTaskAttachmentSchema.parse(data);
      const attachment = await storage.addTaskAttachment(validated);
      res.status(201).json(attachment);
    } catch (error) {
      console.error("[tasks] Error adding attachment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.delete("/api/task-attachments/:id", requireAuth, async (req, res) => {
    const deleted = await storage.removeTaskAttachment(getId(req));
    if (!deleted) return res.status(404).json({ error: "Attachment not found" });
    res.status(204).send();
  });

  // ============== TASK TEMPLATES ==============
  router.get("/api/task-templates", requireAuth, async (req, res) => {
    const type = req.query.type as string | undefined;
    const templates = await storage.getTaskTemplates(type);
    res.json(templates);
  });

  router.get("/api/task-templates/:id", requireAuth, async (req, res) => {
    const template = await storage.getTaskTemplate(getId(req));
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  });

  router.post("/api/task-templates", requireAuth, async (req, res) => {
    try {
      const validated = insertTaskTemplateSchema.parse(req.body);
      const template = await storage.createTaskTemplate(validated);
      res.status(201).json(template);
    } catch (error) {
      console.error("[tasks] Error creating template:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.put("/api/task-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.updateTaskTemplate(getId(req), req.body);
      if (!template) return res.status(404).json({ error: "Template not found" });
      res.json(template);
    } catch (error) {
      console.error("[tasks] Error updating template:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/api/task-templates/:id/set-default", requireAuth, async (req, res) => {
    try {
      const template = await storage.getTaskTemplate(getId(req));
      if (!template) return res.status(404).json({ error: "Template not found" });
      const success = await storage.setDefaultTaskTemplate(template.id, template.type);
      if (!success) return res.status(500).json({ error: "Failed to set default template" });
      res.json({ success: true });
    } catch (error) {
      console.error("[tasks] Error setting default template:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.delete("/api/task-templates/:id/set-default", requireAuth, async (req, res) => {
    try {
      const success = await storage.unsetDefaultTaskTemplate(getId(req));
      if (!success) return res.status(404).json({ error: "Template not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("[tasks] Error unsetting default template:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.delete("/api/task-templates/:id", requireAuth, async (req, res) => {
    const success = await storage.deleteTaskTemplate(getId(req));
    if (!success) return res.status(404).json({ error: "Template not found" });
    res.json({ success: true });
  });

  // ============== AREA TASKS (convenient endpoint) ==============
  router.get("/api/task-tags/:id/tasks", requireAuth, async (req, res) => {
    const { userId } = getSessionUser(req);
    const tagId = getId(req);

    // Buscar a tag primeiro
    const tag = await storage.getTaskTag(tagId);

    if (!tag) {
      return res.status(404).json({ error: "Tag não encontrada" });
    }

    // Verificar se usuário tem acesso à tag usando a mesma lógica de getTaskTags
    const userAreas = await getUserAccessibleAreaIds(userId);
    const hasAccess = userAreas.includes(tagId);

    if (!hasAccess) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    // Se tem acesso, buscar TODAS as reuniões da tag (não filtrar por createdBy)
    const tasks = await storage.getTasks({ tagId });
    res.json(tasks);
  });
}
