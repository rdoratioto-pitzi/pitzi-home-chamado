// worker/src/routes/projects.ts
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import { requireAdmin } from "../middleware/auth";
import {
  insertProjectSchema,
  insertKanbanColumnSchema,
  insertKanbanCardSchema,
  insertKanbanCommentSchema,
  insertKanbanLabelSchema,
  insertKanbanCardDependencySchema,
} from "../../../shared/schema";

import {
  sendProjectMemberAddedEmail,
  sendCardStatusChangedEmail,
  sendCardAssignedEmail,
  sendCardCommentEmail,
  sendMentionNotificationEmail,
} from "../lib/email";

const projects = new Hono<AppEnv>();

async function getUserAccessibleProjectIds(
  storage: ReturnType<typeof getStorage>,
  userId: string
): Promise<string[]> {
  const allProjects = await storage.getProjects();
  const userMemberships = await storage.getProjectMembersByUser(userId);
  const memberProjectIds = new Set(userMemberships.map((m) => m.projectId));
  const accessibleIds: string[] = [];
  for (const project of allProjects) {
    if (project.ownerId === userId) {
      accessibleIds.push(project.id);
    } else if (project.visibility === "public") {
      accessibleIds.push(project.id);
    } else if (
      project.visibility === "shared" &&
      memberProjectIds.has(project.id)
    ) {
      accessibleIds.push(project.id);
    }
  }
  return accessibleIds;
}

// ============== PROJECTS ==============

projects.get("/api/projects", async (c) => {
  const { userId, role } = c.get("user");
  const isAdmin = role === "admin";
  const storage = getStorage(c.get("db"));
  const allProjects = await storage.getProjects();
  if (isAdmin) return c.json(allProjects);
  const accessibleIds = await getUserAccessibleProjectIds(storage, userId);
  const filtered = allProjects.filter((p) => accessibleIds.includes(p.id));
  return c.json(filtered);
});

projects.get("/api/projects/:id", async (c) => {
  const { userId, role } = c.get("user");
  const isAdmin = role === "admin";
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const project = await storage.getProject(id);
  if (!project) return c.json({ error: "Project not found" }, 404);
  if (!isAdmin) {
    const accessibleIds = await getUserAccessibleProjectIds(storage, userId);
    if (!accessibleIds.includes(project.id)) {
      return c.json({ error: "Access denied" }, 403);
    }
  }
  return c.json(project);
});

projects.post("/api/projects", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const { memberIds, ...projectData } = body;
  const validated = insertProjectSchema.parse(projectData);
  const project = await storage.createProject(validated);

  if (
    memberIds &&
    Array.isArray(memberIds) &&
    memberIds.length > 0 &&
    validated.visibility === "shared"
  ) {
    for (const uid of memberIds) {
      try {
        await storage.addProjectMember({
          projectId: project.id,
          userId: uid,
          role: "member",
        });
      } catch (_e) {
        // Silently skip failed member additions
      }
    }
  }

  return c.json(project, 201);
});

projects.patch("/api/projects/:id", async (c) => {
  const { userId, role } = c.get("user");
  const isAdmin = role === "admin";
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const existing = await storage.getProject(id);
  if (!existing) return c.json({ error: "Project not found" }, 404);
  if (!isAdmin && existing.ownerId !== userId) {
    return c.json({ error: "Access denied" }, 403);
  }
  const body = await c.req.json();
  const { memberIds, ...projectData } = body;
  const partialSchema = insertProjectSchema.partial();
  const validated = partialSchema.parse(projectData);
  const project = await storage.updateProject(id, validated);
  if (!project) return c.json({ error: "Project not found" }, 404);

  if (
    memberIds &&
    Array.isArray(memberIds) &&
    (validated.visibility === "shared" || existing.visibility === "shared")
  ) {
    const currentMembers = await storage.getProjectMembers(id);
    const currentMemberIds = new Set(currentMembers.map((m) => m.userId));
    const newMemberIds = new Set(memberIds as string[]);

    for (const uid of memberIds) {
      if (!currentMemberIds.has(uid)) {
        await storage.addProjectMember({
          projectId: id,
          userId: uid,
          role: "member",
        });
      }
    }
    for (const member of currentMembers) {
      if (!newMemberIds.has(member.userId)) {
        await storage.removeProjectMember(member.id);
      }
    }
  }

  return c.json(project);
});

projects.delete("/api/projects/:id", async (c) => {
  const { userId, role } = c.get("user");
  const isAdmin = role === "admin";
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const project = await storage.getProject(id);
  if (!project) return c.json({ error: "Project not found" }, 404);
  if (!isAdmin && project.ownerId !== userId) {
    return c.json({ error: "Access denied" }, 403);
  }
  const deleted = await storage.deleteProject(id);
  if (!deleted) return c.json({ error: "Project not found" }, 404);
  return c.body(null, 204);
});

// ============== PROJECT MEMBERS ==============

projects.get("/api/projects/:id/members", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const members = await storage.getProjectMembers(id);
  return c.json(members);
});

projects.post("/api/projects/:id/members", async (c) => {
  const { userId: sessionUserId } = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const body = await c.req.json();
  const { userId: uid, role: memberRole } = body;
  const member = await storage.addProjectMember({
    projectId: id,
    userId: uid,
    role: memberRole || "member",
  });

  // Send email notification (fire-and-forget)
  const [project, newMember, addedBy] = await Promise.all([
    storage.getProject(id),
    storage.getUser(uid),
    storage.getUser(sessionUserId),
  ]);
  if (project && newMember && addedBy) {
    sendProjectMemberAddedEmail(c.env, storage, project, newMember, addedBy).catch(console.error);
  }

  return c.json(member, 201);
});

projects.delete("/api/projects/:id/members/:memberId", async (c) => {
  const storage = getStorage(c.get("db"));
  const memberId = c.req.param("memberId");
  const deleted = await storage.removeProjectMember(memberId);
  if (!deleted) return c.json({ error: "Member not found" }, 404);
  return c.body(null, 204);
});

// ============== PROJECT COLUMNS ==============

projects.get("/api/projects/:id/columns", async (c) => {
  const { userId, role } = c.get("user");
  const isAdmin = role === "admin";
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  if (!isAdmin) {
    const accessibleIds = await getUserAccessibleProjectIds(storage, userId);
    if (!accessibleIds.includes(id)) {
      return c.json({ error: "Access denied" }, 403);
    }
  }
  const columns = await storage.getKanbanColumns(id);
  return c.json(columns);
});

// ============== PROJECT CARDS ==============

projects.get("/api/projects/:id/cards", async (c) => {
  const { userId, role } = c.get("user");
  const isAdmin = role === "admin";
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  if (!isAdmin) {
    const accessibleIds = await getUserAccessibleProjectIds(storage, userId);
    if (!accessibleIds.includes(id)) {
      return c.json({ error: "Access denied" }, 403);
    }
  }
  const cards = await storage.getKanbanCards(id);

  const priorityOrder: Record<string, number> = {
    muito_urgente: 0,
    urgente: 1,
    normal: 2,
  };

  cards.sort((a, b) => {
    const priorityA = priorityOrder[a.priority] ?? 3;
    const priorityB = priorityOrder[b.priority] ?? 3;
    return priorityA - priorityB;
  });

  return c.json(cards);
});

// ============== KANBAN COLUMNS ==============

projects.post("/api/columns", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const validated = insertKanbanColumnSchema.parse(body);
  const column = await storage.createKanbanColumn(validated);
  return c.json(column, 201);
});

projects.patch("/api/columns/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const body = await c.req.json();
  const partialSchema = insertKanbanColumnSchema.partial();
  const validated = partialSchema.parse(body);
  const column = await storage.updateKanbanColumn(id, validated);
  if (!column) return c.json({ error: "Column not found" }, 404);
  return c.json(column);
});

projects.delete("/api/columns/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const deleted = await storage.deleteKanbanColumn(id);
  if (!deleted) return c.json({ error: "Column not found" }, 404);
  return c.body(null, 204);
});

// ============== KANBAN CARDS ==============

projects.get("/api/cards/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const card = await storage.getKanbanCard(id);
  if (!card) return c.json({ error: "Card not found" }, 404);
  return c.json(card);
});

projects.post("/api/cards", async (c) => {
  const storage = getStorage(c.get("db"));
  const body = await c.req.json();
  const validated = insertKanbanCardSchema.parse(body);
  const card = await storage.createKanbanCard(validated);

  const cardCreatorId = body.createdBy || body.reporterId;

  if (card.assigneeId && card.assigneeId !== cardCreatorId) {
    const creator = cardCreatorId
      ? await storage.getUser(cardCreatorId)
      : null;
    storage
      .createNotification({
        userId: card.assigneeId,
        fromUserId: cardCreatorId || undefined,
        title: "Novo card atribuído",
        message: `${
          creator?.name || "Alguém"
        } atribuiu o card "${card.title}" a você`,
        module: "projetos",
        entityId: card.id,
        linkUrl: `/projetos/${card.projectId}`,
      })
      .catch(() => {});
  }

  if (
    card.reporterId &&
    card.reporterId !== cardCreatorId &&
    card.reporterId !== card.assigneeId
  ) {
    const creator = cardCreatorId
      ? await storage.getUser(cardCreatorId)
      : null;
    storage
      .createNotification({
        userId: card.reporterId,
        fromUserId: cardCreatorId || undefined,
        title: "Você foi definido como relator",
        message: `${
          creator?.name || "Alguém"
        } definiu você como relator do card "${card.title}"`,
        module: "projetos",
        entityId: card.id,
        linkUrl: `/projetos/${card.projectId}`,
      })
      .catch(() => {});
  }

  return c.json(card, 201);
});

projects.patch("/api/cards/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const body = await c.req.json();
  const oldCard = await storage.getKanbanCard(id);
  const partialSchema = insertKanbanCardSchema.partial();
  const validated = partialSchema.parse(body);
  const card = await storage.updateKanbanCard(id, validated);
  if (!card) return c.json({ error: "Card not found" }, 404);

  const updatedBy = body.updatedBy || oldCard?.reporterId;
  const updater = updatedBy ? await storage.getUser(updatedBy) : null;

  // Send email when status changes
  if (oldCard && validated.status && validated.status !== oldCard.status) {
    const project = await storage.getProject(card.projectId);
    const assignee = card.assigneeId ? await storage.getUser(card.assigneeId) : null;
    const reporter = card.reporterId ? await storage.getUser(card.reporterId) : null;
    if (project && updater) {
      sendCardStatusChangedEmail(
        c.env, storage, card, project, oldCard.status, validated.status, updater, assignee, reporter
      ).catch(console.error);
    }
  }

  // Notification: assignee changed
  if (
    validated.assigneeId &&
    card.assigneeId &&
    card.assigneeId !== oldCard?.assigneeId &&
    card.assigneeId !== updatedBy
  ) {
    storage
      .createNotification({
        userId: card.assigneeId,
        fromUserId: updatedBy || undefined,
        title: "Card atribuído a você",
        message: `${
          updater?.name || "Alguém"
        } atribuiu o card "${card.title}" a você`,
        module: "projetos",
        entityId: card.id,
        linkUrl: `/projetos/${card.projectId}`,
      })
      .catch(() => {});

    // Send card assigned email
    const project = await storage.getProject(card.projectId);
    const newAssignee = await storage.getUser(card.assigneeId);
    if (project && newAssignee && updater) {
      sendCardAssignedEmail(c.env, storage, card, project, newAssignee, updater).catch(console.error);
    }
  }

  // Notification: reporter changed
  if (
    validated.reporterId &&
    card.reporterId &&
    card.reporterId !== oldCard?.reporterId &&
    card.reporterId !== updatedBy &&
    card.reporterId !== card.assigneeId
  ) {
    storage
      .createNotification({
        userId: card.reporterId,
        fromUserId: updatedBy || undefined,
        title: "Você foi definido como relator",
        message: `${
          updater?.name || "Alguém"
        } definiu você como relator do card "${card.title}"`,
        module: "projetos",
        entityId: card.id,
        linkUrl: `/projetos/${card.projectId}`,
      })
      .catch(() => {});
  }

  return c.json(card);
});

projects.delete("/api/cards/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const deleted = await storage.deleteKanbanCard(id);
  if (!deleted) return c.json({ error: "Card not found" }, 404);
  return c.body(null, 204);
});

// ============== KANBAN COMMENTS ==============

projects.get("/api/cards/:id/comments", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const comments = await storage.getKanbanComments(id);
  return c.json(comments);
});

projects.post("/api/cards/:id/comments", async (c) => {
  const { userId } = c.get("user");
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const body = await c.req.json();
  const validated = insertKanbanCommentSchema.parse({
    ...body,
    cardId: id,
    userId: userId,
  });
  const comment = await storage.createKanbanComment(validated);

  // Send comment email + process @mentions
  const card = await storage.getKanbanCard(id);
  const author = await storage.getUser(validated.userId);
  const project = card ? await storage.getProject(card.projectId) : null;

  if (card && project && author) {
    const assignee = card.assigneeId ? await storage.getUser(card.assigneeId) : null;
    const reporter = card.reporterId ? await storage.getUser(card.reporterId) : null;
    sendCardCommentEmail(
      c.env, storage, card, project, validated.content, author, assignee, reporter
    ).catch(console.error);
  }

  const mentionMatches = validated.content.match(/@(\w+(?:\s+\w+)?)/g);
  if (mentionMatches) {
    const users = await storage.getUsers();

    for (const mention of mentionMatches) {
      const mentionedName = mention.slice(1).trim();
      const mentionedUser = users.find(
        (u) =>
          u.name.toLowerCase() === mentionedName.toLowerCase() &&
          u.status === "active"
      );

      if (mentionedUser && card && author) {
        sendMentionNotificationEmail(
          c.env, storage, mentionedUser, author.name, card.title, card.id, validated.content
        ).catch(console.error);
        storage
          .createNotification({
            userId: mentionedUser.id,
            fromUserId: author.id,
            title: "Menção em card",
            message: `${author.name} mencionou você em um comentário no card "${card.title}"`,
            module: "projetos",
            entityId: card.id,
            linkUrl: `/projetos/${card.projectId}`,
          })
          .catch(() => {});
      }
    }
  }

  return c.json(comment, 201);
});

// ============== KANBAN LABELS ==============

projects.get("/api/projects/:id/labels", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const labels = await storage.getKanbanLabels(id);
  return c.json(labels);
});

projects.post("/api/projects/:id/labels", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const body = await c.req.json();
  const validated = insertKanbanLabelSchema.parse({
    ...body,
    projectId: id,
  });
  const label = await storage.createKanbanLabel(validated);
  return c.json(label, 201);
});

projects.patch("/api/labels/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const body = await c.req.json();
  const updated = await storage.updateKanbanLabel(id, body);
  if (!updated) return c.json({ error: "Label not found" }, 404);
  return c.json(updated);
});

projects.delete("/api/labels/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const deleted = await storage.deleteKanbanLabel(id);
  if (!deleted) return c.json({ error: "Label not found" }, 404);
  return c.body(null, 204);
});

// ============== KANBAN CARD DEPENDENCIES ==============

projects.get("/api/cards/:id/dependencies", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const deps = await storage.getCardDependencies(id);
  return c.json(deps);
});

projects.get("/api/projects/:id/blocked-cards", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const blockedIds = await storage.getProjectBlockedCardIds(id);
  return c.json(Array.from(blockedIds));
});

projects.post("/api/cards/:id/dependencies", async (c) => {
  const storage = getStorage(c.get("db"));
  const cardId = c.req.param("id");
  const card = await storage.getKanbanCard(cardId);
  if (!card) return c.json({ error: "Card not found" }, 404);

  const body = await c.req.json();
  const { blockingCardId, blockedCardId } = body;
  const validated = insertKanbanCardDependencySchema.parse({
    blockingCardId: blockingCardId ?? cardId,
    blockedCardId: blockedCardId ?? cardId,
    projectId: card.projectId,
  });
  const dep = await storage.addCardDependency(validated);
  return c.json(dep, 201);
});

projects.delete("/api/card-dependencies/:id", async (c) => {
  const storage = getStorage(c.get("db"));
  const id = c.req.param("id");
  const deleted = await storage.removeCardDependency(id);
  if (!deleted) return c.json({ error: "Dependency not found" }, 404);
  return c.body(null, 204);
});

// ============== PROJECT METRICS ==============

projects.get("/api/projects/:id/metrics", async (c) => {
  const storage = getStorage(c.get("db"));
  const projectId = c.req.param("id");
  const [cards, columns] = await Promise.all([
    storage.getKanbanCards(projectId),
    storage.getKanbanColumns(projectId),
  ]);

  const cardsByColumn = columns.map((col) => ({
    columnId: col.id,
    columnName: col.name,
    count: cards.filter((card) => card.columnId === col.id).length,
  }));

  const priorityCounts: Record<string, number> = {};
  for (const card of cards) {
    priorityCounts[card.priority] = (priorityCounts[card.priority] ?? 0) + 1;
  }
  const cardsByPriority = Object.entries(priorityCounts).map(
    ([priority, count]) => ({ priority, count })
  );

  const assigneeCounts: Record<string, number> = {};
  for (const card of cards) {
    if (card.assigneeId) {
      assigneeCounts[card.assigneeId] =
        (assigneeCounts[card.assigneeId] ?? 0) + 1;
    }
  }

  const now = new Date();
  const overdue = cards.filter(
    (card) => card.dueDate && new Date(card.dueDate) < now
  ).length;

  return c.json({
    totalCards: cards.length,
    cardsByColumn,
    cardsByPriority,
    cardsByAssignee: assigneeCounts,
    overdue,
  });
});

export { projects };
