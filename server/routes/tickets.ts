import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import {
  insertTicketSchema,
  insertTicketResponsavelSchema,
  insertTicketCommentSchema,
} from "@shared/schema";
import { requireAuth, requireAdmin, getSessionUser } from "../middleware/auth";
import {
  sendTicketCreatedEmail,
  sendTicketAssignedEmail,
  sendTicketStatusChangedEmail,
  sendTicketCommentEmail,
  sendMentionNotificationEmail,
  sendCSATReceivedEmail,
} from "../email-service";

export function registerTicketRoutes(router: Router) {
  const getId = (req: any) => req.params.id as string;

  router.get("/api/tickets", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      
      if (isAdmin) {
        const tickets = await storage.getTickets();
        return res.json(tickets);
      }
      
      const tickets = await storage.getTickets({ requesterId: userId, assigneeId: userId });
      res.json(tickets);
    } catch (error: any) {
      const status = error.status || 500;
      res.status(status).json({ error: error.message });
    }
  });

  router.get("/api/tickets/:id", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const ticket = await storage.getTicket(getId(req));
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      if (!isAdmin && ticket.requesterId !== userId && ticket.assigneeId !== userId) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      res.json(ticket);
    } catch (error: any) {
      const status = error.status || 500;
      res.status(status).json({ error: error.message });
    }
  });

  router.post("/api/tickets", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const data = { ...req.body };

      if (!isAdmin || !data.requesterId) {
        data.requesterId = userId;
      }

      const validated = insertTicketSchema.parse(data);

      if (!validated.assigneeId && validated.category && validated.type) {
        const autoAssignee = await storage.findResponsavelForTicket(validated.category, validated.type);
        if (autoAssignee) {
          validated.assigneeId = autoAssignee;
        }
      }

      const ticket = await storage.createTicket(validated);

      const requester = await storage.getUser(ticket.requesterId);
      const assignee = ticket.assigneeId ? await storage.getUser(ticket.assigneeId) : null;

      if (requester) {
        sendTicketCreatedEmail(ticket, requester, assignee || null).catch(console.error);
      }

      if (assignee && assignee.id !== ticket.requesterId) {
        sendTicketAssignedEmail(ticket, assignee).catch(console.error);
      }

      if (ticket.assigneeId && ticket.assigneeId !== ticket.requesterId) {
        storage.createNotification({
          userId: ticket.assigneeId,
          fromUserId: ticket.requesterId,
          title: "Novo chamado atribuído",
          message: `O chamado "${ticket.title}" (${ticket.code}) foi criado e atribuído a você`,
          module: "chamados",
          entityId: ticket.id,
          linkUrl: `/chamados?ticket=${ticket.id}`,
        }).catch(console.error);
      }

      res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create ticket" });
    }
  });

  router.patch("/api/tickets/:id", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const oldTicket = await storage.getTicket(getId(req));
      if (!oldTicket) return res.status(404).json({ error: "Ticket not found" });
      if (!isAdmin && oldTicket.requesterId !== userId && oldTicket.assigneeId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      let updateData: any = { ...req.body };

      if (!isAdmin) {
        const allowedFields = ["status", "title", "description", "attachments", "location", "impact", "dueDate"];
        const filteredData: any = {};
        allowedFields.forEach(field => {
          if (updateData[field] !== undefined) {
            filteredData[field] = updateData[field];
          }
        });
        updateData = filteredData;
      }

      if (req.body.status && req.body.status !== oldTicket.status) {
        if (req.body.status === "resolved" && !oldTicket.dataResolucao) {
          updateData.dataResolucao = new Date();
        }
        if (req.body.status === "closed" && !oldTicket.dataFechamento) {
          updateData.dataFechamento = new Date();
        }
      }

      if (updateData.descriptionLastEditedAt) {
        updateData.descriptionLastEditedAt = new Date(updateData.descriptionLastEditedAt);
      }

      const ticket = await storage.updateTicket(getId(req), updateData);
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      if (req.body.status && req.body.status !== oldTicket.status) {
        const requester = await storage.getUser(ticket.requesterId);
        const assignee = ticket.assigneeId ? await storage.getUser(ticket.assigneeId) : null;
        if (requester) {
          sendTicketStatusChangedEmail(ticket, oldTicket.status, req.body.status, requester, assignee || null).catch(console.error);
        }
        const statusLabels: Record<string, string> = { open: "Aberto", in_progress: "Em andamento", resolved: "Resolvido", closed: "Fechado", pending: "Pendente" };
        const statusLabel = statusLabels[req.body.status] || req.body.status;
        if (ticket.requesterId) {
          storage.createNotification({
            userId: ticket.requesterId,
            title: "Status do chamado alterado",
            message: `O chamado "${ticket.title}" (${ticket.code || ''}) mudou para "${statusLabel}"`,
            module: "chamados",
            entityId: ticket.id,
            linkUrl: `/chamados?ticket=${ticket.id}`,
          }).catch(console.error);
        }
      }

      if (req.body.assigneeId && req.body.assigneeId !== oldTicket.assigneeId) {
        const assignee = await storage.getUser(req.body.assigneeId);
        if (assignee) {
          sendTicketAssignedEmail(ticket, assignee).catch(console.error);
        }
        storage.createNotification({
          userId: req.body.assigneeId,
          title: "Chamado atribuído a você",
          message: `O chamado "${ticket.title}" (${ticket.code || ''}) foi atribuído a você`,
          module: "chamados",
          entityId: ticket.id,
          linkUrl: `/chamados?ticket=${ticket.id}`,
        }).catch(console.error);
      }

      res.json(ticket);
    } catch (error) {
      console.error("Error updating ticket:", error);
      res.status(400).json({ error: "Failed to update ticket" });
    }
  });

  router.delete("/api/tickets/:id", requireAuth, async (req, res) => {
    const { userId, isAdmin } = getSessionUser(req);
    const ticket = await storage.getTicket(getId(req));
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (!isAdmin && ticket.requesterId !== userId && ticket.assigneeId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const deleted = await storage.deleteTicket(getId(req));
    if (!deleted) return res.status(404).json({ error: "Ticket not found" });
    res.status(204).send();
  });

  router.get("/api/tickets/:id/comments", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const ticket = await storage.getTicket(getId(req));
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      if (!isAdmin && ticket.requesterId !== userId && ticket.assigneeId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const comments = await storage.getTicketComments(getId(req));
      res.json(comments);
    } catch (error: any) {
      const status = error.status || 500;
      res.status(status).json({ error: error.message });
    }
  });

  router.post("/api/tickets/:id/comments", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const ticket = await storage.getTicket(getId(req));
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      if (!isAdmin && ticket.requesterId !== userId && ticket.assigneeId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const validated = insertTicketCommentSchema.parse({
        ...req.body,
        ticketId: getId(req),
        userId: userId,
      });
      const comment = await storage.createTicketComment(validated);

      if (ticket) {
        if (ticket.assigneeId && comment.userId === ticket.assigneeId && !ticket.dataPrimeiraResposta) {
          await storage.updateTicket(ticket.id, { dataPrimeiraResposta: new Date() });
        }

        const commenter = await storage.getUser(comment.userId);
        const requester = await storage.getUser(ticket.requesterId);
        const assignee = ticket.assigneeId ? await storage.getUser(ticket.assigneeId) : null;

        if (commenter && requester) {
          sendTicketCommentEmail(ticket, comment, commenter, requester, assignee || null).catch(console.error);
        }

        if (requester && commenter && commenter.id !== requester.id) {
          storage.createNotification({
            userId: requester.id,
            fromUserId: commenter.id,
            title: "Novo comentário no chamado",
            message: `${commenter.name} comentou no chamado "${ticket.title}"`,
            module: "chamados",
            entityId: ticket.id,
            linkUrl: `/chamados?ticket=${ticket.id}`,
          }).catch(console.error);
        }
        if (assignee && commenter && commenter.id !== assignee.id && assignee.id !== requester?.id) {
          storage.createNotification({
            userId: assignee.id,
            fromUserId: commenter.id,
            title: "Novo comentário no chamado",
            message: `${commenter.name} comentou no chamado "${ticket.title}"`,
            module: "chamados",
            entityId: ticket.id,
            linkUrl: `/chamados?ticket=${ticket.id}`,
          }).catch(console.error);
        }

        const mentionMatches = validated.content.match(/@(\w+(?:\s+\w+)?)/g);
        if (mentionMatches) {
          const users = await storage.getUsers();

          for (const mention of mentionMatches) {
            const mentionedName = mention.slice(1).trim();
            const mentionedUser = users.find(u =>
              u.name.toLowerCase() === mentionedName.toLowerCase() && u.status === "active"
            );

            if (mentionedUser && commenter) {
              sendMentionNotificationEmail(
                mentionedUser,
                commenter.name,
                ticket.title,
                ticket.id,
                validated.content
              ).catch(console.error);
              storage.createNotification({
                userId: mentionedUser.id,
                fromUserId: commenter.id,
                title: "Menção em chamado",
                message: `${commenter.name} mencionou você em um comentário no chamado "${ticket.title}"`,
                module: "chamados",
                entityId: ticket.id,
                linkUrl: `/chamados?ticket=${ticket.id}`,
              }).catch(console.error);
            }
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

  router.get("/api/ticket-responsaveis", requireAuth, async (req, res) => {
    const responsaveis = await storage.getTicketResponsaveis();
    res.json(responsaveis);
  });

  router.get("/api/ticket-responsaveis/:id", requireAuth, async (req, res) => {
    const responsavel = await storage.getTicketResponsavel(getId(req));
    if (!responsavel) return res.status(404).json({ error: "Responsavel not found" });
    res.json(responsavel);
  });

  router.post("/api/ticket-responsaveis", requireAdmin, async (req, res) => {
    try {
      const validated = insertTicketResponsavelSchema.parse(req.body);
      const responsavel = await storage.createTicketResponsavel(validated);
      res.status(201).json(responsavel);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create responsavel" });
    }
  });

  router.patch("/api/ticket-responsaveis/:id", requireAdmin, async (req, res) => {
    try {
      const partialSchema = insertTicketResponsavelSchema.partial();
      const validated = partialSchema.parse(req.body);
      const responsavel = await storage.updateTicketResponsavel(getId(req), validated);
      if (!responsavel) return res.status(404).json({ error: "Responsavel not found" });
      res.json(responsavel);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update responsavel" });
    }
  });

  router.delete("/api/ticket-responsaveis/:id", requireAdmin, async (req, res) => {
    const deleted = await storage.deleteTicketResponsavel(getId(req));
    if (!deleted) return res.status(404).json({ error: "Responsavel not found" });
    res.status(204).send();
  });

  router.get("/api/ticket-responsaveis/find/:categoria/:tipo", requireAuth, async (req, res) => {
    const responsavelId = await storage.findResponsavelForTicket(req.params.categoria, req.params.tipo);
    res.json({ responsavelId });
  });

  // CSAT - Analytics (apenas admins)
  router.get("/api/tickets/csat/analytics", requireAuth, async (req, res) => {
    try {
      const { isAdmin } = getSessionUser(req);
      
      if (!isAdmin) {
        return res.status(403).json({ error: "Apenas administradores podem acessar analytics" });
      }

      const allTickets = await storage.getTickets();
      const users = await storage.getUsers();
      
      // Filtrar tickets com CSAT
      const ticketsWithCSAT = allTickets.filter(t => 
        t.satisfactionRating !== null && t.satisfactionRating !== undefined
      );

      // Métricas gerais
      const totalTickets = allTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
      const totalEvaluations = ticketsWithCSAT.length;
      const evaluationRate = totalTickets > 0 ? (totalEvaluations / totalTickets) * 100 : 0;

      // CSAT Score médio
      const averageRating = ticketsWithCSAT.length > 0 
        ? ticketsWithCSAT.reduce((sum, t) => sum + (t.satisfactionRating || 0), 0) / ticketsWithCSAT.length 
        : 0;

      // Distribuição de notas
      const ratingDistribution = [1, 2, 3, 4, 5].map(rating => ({
        rating,
        count: ticketsWithCSAT.filter(t => t.satisfactionRating === rating).length,
        percentage: ticketsWithCSAT.length > 0 
          ? (ticketsWithCSAT.filter(t => t.satisfactionRating === rating).length / ticketsWithCSAT.length) * 100 
          : 0
      }));

      // Top responsáveis (melhores avaliações)
      const responsibleStats = users.map(user => {
        const userTickets = ticketsWithCSAT.filter(t => t.assigneeId === user.id);
        const avgRating = userTickets.length > 0 
          ? userTickets.reduce((sum, t) => sum + (t.satisfactionRating || 0), 0) / userTickets.length 
          : 0;
        return {
          userId: user.id,
          userName: user.name,
          totalEvaluations: userTickets.length,
          averageRating: Math.round(avgRating * 10) / 10,
          ratings: [1, 2, 3, 4, 5].map(r => userTickets.filter(t => t.satisfactionRating === r).length)
        };
      }).filter(s => s.totalEvaluations > 0)
        .sort((a, b) => b.averageRating - a.averageRating);

      // Comentários negativos (notas 1-2)
      const negativeComments = ticketsWithCSAT
        .filter(t => (t.satisfactionRating || 0) <= 2 && t.satisfactionComment)
        .map(t => ({
          ticketId: t.id,
          ticketCode: t.code,
          ticketTitle: t.title,
          rating: t.satisfactionRating,
          comment: t.satisfactionComment,
          createdAt: t.satisfactionCreatedAt,
          assigneeId: t.assigneeId
        }))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 10);

      // Tendência temporal (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentEvaluations = ticketsWithCSAT
        .filter(t => t.satisfactionCreatedAt && new Date(t.satisfactionCreatedAt) >= thirtyDaysAgo)
        .sort((a, b) => new Date(a.satisfactionCreatedAt || 0).getTime() - new Date(b.satisfactionCreatedAt || 0).getTime());

      // Agrupar por dia para tendência
      const trendByDay: Record<string, { sum: number; count: number }> = {};
      recentEvaluations.forEach(t => {
        const day = t.satisfactionCreatedAt ? new Date(t.satisfactionCreatedAt).toISOString().split('T')[0] : 'unknown';
        if (!trendByDay[day]) trendByDay[day] = { sum: 0, count: 0 };
        trendByDay[day].sum += t.satisfactionRating || 0;
        trendByDay[day].count++;
      });

      const trend = Object.entries(trendByDay).map(([date, data]) => ({
        date,
        rating: Math.round((data.sum / data.count) * 10) / 10,
        count: data.count
      })).sort((a, b) => a.date.localeCompare(b.date));

      res.json({
        overview: {
          totalTickets,
          totalEvaluations,
          evaluationRate: Math.round(evaluationRate * 100) / 100,
          averageRating: Math.round(averageRating * 100) / 100
        },
        ratingDistribution,
        topResponsibles: responsibleStats.slice(0, 5),
        negativeComments,
        trend
      });
    } catch (error: any) {
      console.error("Error fetching CSAT analytics:", error);
      res.status(500).json({ error: "Failed to fetch CSAT analytics" });
    }
  });

  // CSAT - Avaliação de satisfação
  router.patch("/api/tickets/:id/satisfaction", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const ticket = await storage.getTicket(getId(req));
      
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // Validar que apenas o solicitante pode avaliar
      if (ticket.requesterId !== userId) {
        return res.status(403).json({ error: "Apenas o solicitante pode avaliar este chamado" });
      }

      // Validar que o ticket está closed ou resolved
      if (ticket.status !== "closed" && ticket.status !== "resolved") {
        return res.status(400).json({ error: "Apenas chamados fechados ou resolvidos podem ser avaliados" });
      }

      // Validar se já foi avaliado
      if (ticket.satisfactionRating !== null && ticket.satisfactionRating !== undefined) {
        return res.status(400).json({ error: "Este chamado já foi avaliado" });
      }

      // Validar rating
      const { rating, comment } = req.body;
      if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        return res.status(400).json({ error: "Rating deve ser um número inteiro entre 1 e 5" });
      }

      // Validar comentário (opcional, até 500 caracteres)
      if (comment && comment.length > 500) {
        return res.status(400).json({ error: "Comentário deve ter no máximo 500 caracteres" });
      }

      // Atualizar avaliação
      const updatedTicket = await storage.updateTicket(getId(req), {
        satisfactionRating: rating,
        satisfactionComment: comment || null,
        satisfactionCreatedAt: new Date(),
      });

      // Enviar email de notificação para o responsável
      if (updatedTicket.assigneeId) {
        const assignee = await storage.getUser(updatedTicket.assigneeId);
        if (assignee) {
          sendCSATReceivedEmail(
            updatedTicket,
            rating,
            comment || null,
            assignee
          ).catch(console.error);
        }
      }

      // Criar notificação in-app para o responsável
      if (updatedTicket.assigneeId && updatedTicket.assigneeId !== userId) {
        const starsText = rating === 5 ? "⭐⭐⭐⭐⭐" : rating === 4 ? "⭐⭐⭐⭐" : rating === 3 ? "⭐⭐⭐" : rating === 2 ? "⭐⭐" : "⭐";
        storage.createNotification({
          userId: updatedTicket.assigneeId,
          fromUserId: userId,
          title: "Avaliação de chamado recebida",
          message: `Seu atendimento no chamado "${ticket.title}" foi avaliado com ${starsText} (${rating}/5)`,
          module: "chamados",
          entityId: ticket.id,
          linkUrl: `/chamados?ticket=${ticket.id}`,
        }).catch(console.error);
      }

      res.json(updatedTicket);
    } catch (error: any) {
      console.error("Error submitting satisfaction:", error);
      res.status(500).json({ error: "Failed to submit satisfaction rating" });
    }
  });
}
