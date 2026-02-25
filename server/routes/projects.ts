import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import {
  insertProjectSchema,
  insertKanbanColumnSchema,
  insertKanbanCardSchema,
  insertKanbanCommentSchema,
} from "@shared/schema";
import { getSessionUser, requireAuth } from "../middleware/auth";
import { sendMentionNotificationEmail } from "../email-service";

export function registerProjectRoutes(router: Router) {
  const getId = (req: any) => req.params.id as string;

  async function getUserAccessibleProjectIds(userId: string): Promise<string[]> {
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
  router.get("/api/projects", requireAuth, async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    const projects = await storage.getProjects();
    if (isAdmin) return res.json(projects);
    const accessibleIds = await getUserAccessibleProjectIds(userId);
    const filtered = projects.filter((p) => accessibleIds.includes(p.id));
    res.json(filtered);
  });

  router.get("/api/projects/:id", requireAuth, async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    const project = await storage.getProject(getId(req));
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!isAdmin) {
      const accessibleIds = await getUserAccessibleProjectIds(userId);
      if (!accessibleIds.includes(project.id)) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    res.json(project);
  });

  router.post("/api/projects", requireAuth, async (req, res) => {
    try {
      const { memberIds, ...projectData } = req.body;
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
          } catch (e) {
            console.error(
              `Error adding member ${uid} to project ${project.id}:`,
              e
            );
          }
        }
      }

      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create project" });
    }
  });

  router.patch("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const existing = await storage.getProject(getId(req));
      if (!existing) return res.status(404).json({ error: "Project not found" });
      if (!isAdmin && existing.ownerId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { memberIds, ...projectData } = req.body;
      const partialSchema = insertProjectSchema.partial();
      const validated = partialSchema.parse(projectData);
      const project = await storage.updateProject(getId(req), validated);
      if (!project) return res.status(404).json({ error: "Project not found" });

      if (
        memberIds &&
        Array.isArray(memberIds) &&
        (validated.visibility === "shared" || existing.visibility === "shared")
      ) {
        const currentMembers = await storage.getProjectMembers(getId(req));
        const currentMemberIds = new Set(currentMembers.map((m) => m.userId));
        const newMemberIds = new Set(memberIds as string[]);

        for (const uid of memberIds) {
          if (!currentMemberIds.has(uid)) {
            await storage.addProjectMember({
              projectId: getId(req),
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

      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update project" });
    }
  });

  router.delete("/api/projects/:id", requireAuth, async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    const project = await storage.getProject(getId(req));
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!isAdmin && project.ownerId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const deleted = await storage.deleteProject(getId(req));
    if (!deleted) return res.status(404).json({ error: "Project not found" });
    res.status(204).send();
  });

  // Project Members
  router.get("/api/projects/:id/members", requireAuth, async (req, res) => {
    const members = await storage.getProjectMembers(getId(req));
    res.json(members);
  });

  router.post("/api/projects/:id/members", requireAuth, async (req, res) => {
    try {
      const { userId: uid, role } = req.body;
      const member = await storage.addProjectMember({
        projectId: getId(req),
        userId: uid,
        role: role || "member",
      });
      res.status(201).json(member);
    } catch (error) {
      res.status(400).json({ error: "Failed to add member" });
    }
  });

  router.delete("/api/projects/:id/members/:memberId", requireAuth, async (req, res) => {
    const deleted = await storage.removeProjectMember(req.params.memberId as string);
    if (!deleted) return res.status(404).json({ error: "Member not found" });
    res.status(204).send();
  });

  // Project Columns
  router.get("/api/projects/:id/columns", requireAuth, async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    if (!isAdmin) {
      const accessibleIds = await getUserAccessibleProjectIds(userId);
      if (!accessibleIds.includes(getId(req))) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    const columns = await storage.getKanbanColumns(getId(req));
    res.json(columns);
  });

  // Project Cards
  router.get("/api/projects/:id/cards", requireAuth, async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    if (!isAdmin) {
      const accessibleIds = await getUserAccessibleProjectIds(userId);
      if (!accessibleIds.includes(getId(req))) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    const cards = await storage.getKanbanCards(getId(req));
    
    // Sort cards by priority: muito_urgente > urgente > normal
    const priorityOrder: Record<string, number> = {
      "muito_urgente": 0,
      "urgente": 1,
      "normal": 2
    };
    
    cards.sort((a, b) => {
      const priorityA = priorityOrder[a.priority] ?? 3;
      const priorityB = priorityOrder[b.priority] ?? 3;
      return priorityA - priorityB;
    });
    
    res.json(cards);
  });

  // ============== KANBAN COLUMNS ==============
  router.post("/api/columns", requireAuth, async (req, res) => {
    try {
      const validated = insertKanbanColumnSchema.parse(req.body);
      const column = await storage.createKanbanColumn(validated);
      res.status(201).json(column);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create column" });
    }
  });

  router.patch("/api/columns/:id", requireAuth, async (req, res) => {
    try {
      const partialSchema = insertKanbanColumnSchema.partial();
      const validated = partialSchema.parse(req.body);
      const column = await storage.updateKanbanColumn(getId(req), validated);
      if (!column) return res.status(404).json({ error: "Column not found" });
      res.json(column);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update column" });
    }
  });

  router.delete("/api/columns/:id", requireAuth, async (req, res) => {
    const deleted = await storage.deleteKanbanColumn(getId(req));
    if (!deleted) return res.status(404).json({ error: "Column not found" });
    res.status(204).send();
  });

  // ============== KANBAN CARDS ==============
  router.get("/api/cards/:id", requireAuth, async (req, res) => {
    const card = await storage.getKanbanCard(getId(req));
    if (!card) return res.status(404).json({ error: "Card not found" });
    res.json(card);
  });

  router.post("/api/cards", requireAuth, async (req, res) => {
    try {
      const validated = insertKanbanCardSchema.parse(req.body);
      const card = await storage.createKanbanCard(validated);

      const cardCreatorId = req.body.createdBy || req.body.reporterId;
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
          .catch(console.error);
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
          .catch(console.error);
      }

      res.status(201).json(card);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create card" });
    }
  });

  router.patch("/api/cards/:id", requireAuth, async (req, res) => {
    try {
      const oldCard = await storage.getKanbanCard(getId(req));
      const partialSchema = insertKanbanCardSchema.partial();
      const validated = partialSchema.parse(req.body);
      const card = await storage.updateKanbanCard(getId(req), validated);
      if (!card) return res.status(404).json({ error: "Card not found" });

      const updatedBy = req.body.updatedBy || oldCard?.reporterId;
      if (
        validated.assigneeId &&
        card.assigneeId &&
        card.assigneeId !== oldCard?.assigneeId &&
        card.assigneeId !== updatedBy
      ) {
        const updater = updatedBy ? await storage.getUser(updatedBy) : null;
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
          .catch(console.error);
      }
      if (
        validated.reporterId &&
        card.reporterId &&
        card.reporterId !== oldCard?.reporterId &&
        card.reporterId !== updatedBy &&
        card.reporterId !== card.assigneeId
      ) {
        const updater = updatedBy ? await storage.getUser(updatedBy) : null;
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
          .catch(console.error);
      }

      res.json(card);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update card" });
    }
  });

  router.delete("/api/cards/:id", requireAuth, async (req, res) => {
    const deleted = await storage.deleteKanbanCard(getId(req));
    if (!deleted) return res.status(404).json({ error: "Card not found" });
    res.status(204).send();
  });

  // Kanban Comments
  router.get("/api/cards/:id/comments", requireAuth, async (req, res) => {
    const comments = await storage.getKanbanComments(getId(req));
    res.json(comments);
  });

  router.post("/api/cards/:id/comments", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const validated = insertKanbanCommentSchema.parse({
        ...req.body,
        cardId: getId(req),
        userId: userId,
      });
      const comment = await storage.createKanbanComment(validated);

      // Process @mentions and send notifications
      const mentionMatches = validated.content.match(/@(\w+(?:\s+\w+)?)/g);
      if (mentionMatches) {
        const card = await storage.getKanbanCard(getId(req));
        const users = await storage.getUsers();
        const author = await storage.getUser(validated.userId);

        for (const mention of mentionMatches) {
          const mentionedName = mention.slice(1).trim();
          const mentionedUser = users.find(
            (u) =>
              u.name.toLowerCase() === mentionedName.toLowerCase() &&
              u.status === "active"
          );

          if (mentionedUser && card && author) {
            sendMentionNotificationEmail(
              mentionedUser,
              author.name,
              card.title,
              card.id,
              validated.content
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
              .catch(console.error);
          }
        }
      }

      res.status(201).json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create comment" });
    }
  });
}
