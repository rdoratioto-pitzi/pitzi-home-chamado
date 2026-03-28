import { Router } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { requireAuth, getSessionUser } from "../middleware/auth";
import { projects, kanbanCards, kanbanColumns, users, workspaceComentarios } from "@shared/schema";
import type { Ticket, User, SlaRule, InsertTicket } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const kanbanStatusToPtBr: Record<string, string> = {
  todo: "a-fazer",
  doing: "em-andamento",
  done: "concluido",
};

const ptBrToKanbanStatus: Record<string, string> = {
  "a-fazer": "todo",
  "em-andamento": "doing",
  concluido: "done",
};

export function registerWorkspaceRoutes(router: Router) {
  // ─── Counts (lightweight) ──────────────────────────────────────────────────
  router.get("/api/workspace/counts", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);

      const [allTickets, allCards] = await Promise.all([
        isAdmin
          ? storage.getTicketsForWorkspace()
          : storage.getTicketsForWorkspace({ requesterId: userId, assigneeId: userId }),
        db ? db.select().from(kanbanCards) : Promise.resolve([]),
      ]);

      const chamados = allTickets.filter(
        (t) => t.status === "open" || t.status === "in_progress" || t.status === "blocked"
      ).length;

      const myCards = allCards.filter(
        (c: any) => c.assigneeId === userId && c.status !== "done"
      ).length;

      res.json({ chamados, projetos: myCards, todos: chamados + myCards });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  router.get("/api/workspace/chamados", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const periodo = (req.query.periodo as string) || "este-ano";

      // Fetch tickets, users and SLA rules in parallel (avoid sequential DB roundtrips)
      const ticketsPromise = isAdmin
        ? storage.getTicketsForWorkspace()
        : storage.getTicketsForWorkspace({ requesterId: userId, assigneeId: userId });

      const [allTickets, users, slaRules] = await Promise.all([
        ticketsPromise,
        storage.getUsers() as Promise<User[]>,
        storage.getSlaRules() as Promise<SlaRule[]>,
      ]);

      // Filter by period
      const now = new Date();
      const filtered = allTickets.filter((t) => {
        const created = t.dataAbertura ? new Date(t.dataAbertura) : t.createdAt ? new Date(t.createdAt) : null;
        if (!created) return false;

        switch (periodo) {
          case "mes-vigente": {
            return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
          }
          case "mes-anterior": {
            const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return created.getMonth() === prev.getMonth() && created.getFullYear() === prev.getFullYear();
          }
          case "em-tratativa": {
            return t.status === "open" || t.status === "in_progress" || t.status === "blocked";
          }
          case "este-ano":
          default: {
            return created.getFullYear() === now.getFullYear();
          }
        }
      });

      // Build KPIs
      const abertos = filtered.filter((t) => t.status === "open").length;
      const andamento = filtered.filter((t) => t.status === "in_progress").length;
      const bloqueados = filtered.filter((t) => t.status === "blocked").length;
      const resolvidos = filtered.filter((t) => t.status === "resolved" || t.status === "closed").length;
      const total = filtered.length;

      // SLA calculation
      let noPrazo = 0;
      let emAtraso = 0;
      for (const ticket of filtered) {
        const slaStatus = getSlaStatus(ticket as any, slaRules);
        if (slaStatus === "dentro_prazo") noPrazo++;
        else if (slaStatus === "em_atraso") emAtraso++;
      }

      // Build user lookup
      const userMap = new Map(users.map((u) => [u.id, u]));

      const items = filtered.map((t) => {
        const user = t.assigneeId ? userMap.get(t.assigneeId) : null;
        const name = user?.name || "Não atribuído";
        const initials = name
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0].toUpperCase())
          .join("");

        const sla = getSlaForTicket(t as any, slaRules);

        return {
          id: t.id,
          codigo: t.code,
          titulo: t.title,
          descricao: t.description || "",
          categoria: t.category,
          tipo: t.type,
          responsavel: name,
          responsavelInitials: initials,
          status: t.status,
          prioridade: t.priority,
          sla: sla.slaHoras,
          statusSla: sla.status,
          abertura: t.dataAbertura || t.createdAt,
          hasAttachments: !!(t as any).hasAttachments,
        };
      });

      res.json({
        kpis: { total, abertos, andamento, bloqueados, resolvidos, noPrazo, emAtraso },
        items,
      });
    } catch (error: any) {
      const status = error.status || 500;
      res.status(status).json({ error: error.message });
    }
  });

  // ─── POST chamados ───────────────────────────────────────────────────────────
  router.post("/api/workspace/chamados", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const { titulo, descricao, categoria, prioridade, attachments } = req.body as {
        titulo?: string;
        descricao?: string;
        categoria?: string;
        prioridade?: string;
        attachments?: string;
      };

      if (!titulo?.trim()) {
        return res.status(400).json({ error: "Título obrigatório" });
      }

      const prioridadeMap: Record<string, string> = {
        baixa: "low",
        media: "medium",
        alta: "high",
        critica: "critical",
      };
      const mappedPriority = prioridade ? (prioridadeMap[prioridade] || prioridade) : "medium";

      const ticket = await storage.createTicket({
        title: titulo.trim(),
        description: descricao || "",
        category: categoria || "geral",
        type: "bug",
        location: "outros",
        priority: mappedPriority,
        impact: "medio",
        status: "open",
        requesterId: userId,
        tenantId: null,
        attachments: attachments || null,
      } as InsertTicket);

      const [allUsers, slaRules] = await Promise.all([
        storage.getUsers(),
        storage.getSlaRules(),
      ]);
      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const assignee = ticket.assigneeId ? userMap.get(ticket.assigneeId) : null;
      const name = assignee?.name || "Não atribuído";
      const initials = name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join("");
      const sla = getSlaForTicket(ticket, slaRules);

      return res.status(201).json({
        tipo: "chamado",
        id: String(ticket.id),
        codigo: ticket.code,
        titulo: ticket.title,
        descricao: ticket.description || "",
        categoria: ticket.category,
        responsavel: name,
        responsavelInitials: initials,
        status: ticket.status,
        prioridade: ticket.priority,
        sla: sla.slaHoras,
        statusSla: sla.status,
        criadoEm: (ticket.dataAbertura || ticket.createdAt || "").toString(),
      });
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  });

  // ─── POST tarefas ─────────────────────────────────────────────────────────────
  router.post("/api/workspace/tarefas", requireAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: "Database not available" });

      const { titulo, descricao, projetoId, prioridade, responsavelId, dataEntrega } =
        req.body as {
          titulo?: string;
          descricao?: string;
          projetoId?: string;
          prioridade?: string;
          responsavelId?: string;
          dataEntrega?: string;
        };

      if (!titulo?.trim()) {
        return res.status(400).json({ error: "Título obrigatório" });
      }
      if (!projetoId) {
        return res.status(400).json({ error: "Projeto obrigatório para criar tarefa" });
      }

      // Find project
      const [projeto] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projetoId))
        .limit(1);
      if (!projeto) {
        return res.status(404).json({ error: "Projeto não encontrado" });
      }

      // Find or create first column for the project
      let columns = await db
        .select()
        .from(kanbanColumns)
        .where(eq(kanbanColumns.projectId, projetoId));
      if (columns.length === 0) {
        const [col] = await db
          .insert(kanbanColumns)
          .values({ projectId: projetoId, name: "A Fazer", order: 0 })
          .returning();
        columns = [col];
      }
      const columnId = columns.sort((a, b) => a.order - b.order)[0].id;

      // Generate code
      const cardsInProject = await db
        .select()
        .from(kanbanCards)
        .where(eq(kanbanCards.projectId, projetoId));
      const codigo = `${projeto.code}·T${cardsInProject.length + 1}`;

      const [card] = await db
        .insert(kanbanCards)
        .values({
          code: codigo,
          title: titulo.trim(),
          objectives: descricao || null,
          projectId: projetoId,
          columnId,
          priority: prioridade || "normal",
          assigneeId: responsavelId || null,
          dueDate: dataEntrega ? new Date(dataEntrega) : null,
          status: "todo",
          progress: 0,
        })
        .returning();

      const allUsers = await storage.getUsers();
      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const responsavel = card.assigneeId ? userMap.get(card.assigneeId) : null;
      const respNome = responsavel?.name || "Não atribuído";
      const respInitials = respNome
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join("");

      return res.status(201).json({
        tipo: "tarefa",
        id: card.id,
        codigo: card.code,
        titulo: card.title,
        contexto: projeto.name,
        corContexto: projeto.color || null,
        badgeLabel: "TAREFA",
        badgeVariant: "tarefa",
        responsavel: respNome,
        responsavelInitials: respInitials,
        status: kanbanStatusToPtBr[card.status] || "a-fazer",
        prioridade: card.priority || "normal",
        sla: null,
        statusSla: null,
        criadoEm: (card.createdAt || "").toString(),
      });
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  });

  // ─── POST projetos ────────────────────────────────────────────────────────────
  router.post("/api/workspace/projetos", requireAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: "Database not available" });

      const { userId } = getSessionUser(req);
      const { nome, descricao, prioridade, responsavelId, dataInicio, dataFim, categoria } =
        req.body as {
          nome?: string;
          descricao?: string;
          prioridade?: string;
          responsavelId?: string;
          dataInicio?: string;
          dataFim?: string;
          categoria?: string;
        };

      if (!nome?.trim()) {
        return res.status(400).json({ error: "Nome obrigatório" });
      }

      // Generate next PRO-XXXX code
      const allProjects = await db.select().from(projects);
      const maxCode = allProjects
        .map((p) => parseInt(p.code.replace("PRO-", ""), 10))
        .filter((n) => !isNaN(n))
        .reduce((a, b) => Math.max(a, b), 0);
      const code = `PRO-${String(maxCode + 1).padStart(4, "0")}`;

      const [projeto] = await db
        .insert(projects)
        .values({
          code,
          name: nome.trim(),
          description: descricao || null,
          status: "backlog",
          priority: prioridade || "media",
          ownerId: responsavelId || userId,
          startDate: dataInicio ? new Date(dataInicio) : null,
          endDate: dataFim ? new Date(dataFim) : null,
          color: "#00c853",
          category: categoria || null,
          progress: 0,
        })
        .returning();

      const allUsers = await storage.getUsers();
      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const responsavel = projeto.ownerId ? userMap.get(projeto.ownerId) : null;
      const respNome = responsavel?.name || "Não atribuído";
      const respInitials = respNome
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join("");

      return res.status(201).json({
        tipo: "projeto",
        id: projeto.id,
        codigo: projeto.code,
        nome: projeto.name,
        status: projeto.status,
        prioridade: projeto.priority,
        responsavel: respNome,
        responsavelInitials: respInitials,
        cor: projeto.color,
        criadoEm: (projeto.createdAt || "").toString(),
      });
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  });

  // ─── Todos (visão unificada) ──────────────────────────────────────────────────
  router.get("/api/workspace/todos", requireAuth, async (req, res) => {
    try {
      if (!db) {
        return res.status(500).json({ error: "Database not available" });
      }

      const { userId, isAdmin } = getSessionUser(req);

      const [allTickets, cards, allProjects, allUsers, slaRules] = await Promise.all([
        isAdmin
          ? storage.getTickets()
          : storage.getTickets({ requesterId: userId, assigneeId: userId }),
        db.select().from(kanbanCards),
        db.select().from(projects),
        storage.getUsers(),
        storage.getSlaRules(),
      ]);

      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const projetoMap = new Map(allProjects.map((p) => [p.id, { nome: p.name, cor: p.color }]));

      const getInitials = (name: string) =>
        name
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0].toUpperCase())
          .join("");

      const getBadgeVariantForType = (tipo: string): string => {
        const map: Record<string, string> = {
          bug: "bug",
          melhoria: "melhoria",
          negocio: "negocio",
        };
        return map[tipo.toLowerCase()] || "default";
      };

      // Map chamados
      const chamadoItems = allTickets.map((t) => {
        const user = t.assigneeId ? userMap.get(t.assigneeId) : null;
        const name = user?.name || "Não atribuído";
        const sla = getSlaForTicket(t, slaRules);
        return {
          tipo: "chamado" as const,
          id: String(t.id),
          codigo: t.code,
          titulo: t.title,
          contexto: t.category || "",
          corContexto: null as string | null,
          badgeLabel: t.type || "",
          badgeVariant: getBadgeVariantForType(t.type || ""),
          responsavel: name,
          responsavelInitials: getInitials(name),
          status: t.status,
          prioridade: t.priority,
          sla: sla.slaHoras,
          statusSla: sla.status,
          criadoEm: (t.dataAbertura || t.createdAt || "").toString(),
        };
      });

      // Map tarefas (kanban cards)
      const tarefaItems = cards.map((c) => {
        const user = c.assigneeId ? userMap.get(c.assigneeId) : null;
        const name = user?.name || "Não atribuído";
        const proj = c.projectId ? projetoMap.get(c.projectId) : null;
        return {
          tipo: "tarefa" as const,
          id: c.id,
          codigo: c.code,
          titulo: c.title,
          contexto: proj?.nome || "Sem projeto",
          corContexto: proj?.cor || null,
          badgeLabel: "TAREFA",
          badgeVariant: "tarefa",
          responsavel: name,
          responsavelInitials: getInitials(name),
          status: kanbanStatusToPtBr[c.status] || c.status,
          prioridade: c.priority || "normal",
          sla: null as number | null,
          statusSla: null as "dentro_prazo" | "em_atraso" | null,
          criadoEm: (c.createdAt || "").toString(),
        };
      });

      // Merge and sort by criadoEm desc
      const items = [...chamadoItems, ...tarefaItems].sort((a, b) => {
        const da = a.criadoEm ? new Date(a.criadoEm).getTime() : 0;
        const db2 = b.criadoEm ? new Date(b.criadoEm).getTime() : 0;
        return db2 - da;
      });

      // KPIs
      const totalGeral = items.length;
      const chamadosCount = chamadoItems.length;
      const tarefasCount = tarefaItems.length;
      const emAndamento = items.filter(
        (i) => i.status === "in_progress" || i.status === "em-andamento" || i.status === "doing",
      ).length;
      const resolvidos = items.filter(
        (i) => i.status === "resolved" || i.status === "closed" || i.status === "concluido" || i.status === "done",
      ).length;

      let noPrazo = 0;
      let emAtraso = 0;
      for (const ticket of allTickets) {
        const slaStatus = getSlaStatus(ticket as any, slaRules);
        if (slaStatus === "dentro_prazo") noPrazo++;
        else if (slaStatus === "em_atraso") emAtraso++;
      }

      res.json({
        kpis: { totalGeral, chamados: chamadosCount, tarefas: tarefasCount, emAndamento, resolvidos, noPrazo, emAtraso },
        items,
      });
    } catch (error: any) {
      const status = error.status || 500;
      res.status(status).json({ error: error.message });
    }
  });

  // ─── Projetos ────────────────────────────────────────────────────────────────
  router.get("/api/workspace/projetos", requireAuth, async (_req, res) => {
    try {
      if (!db) {
        return res.status(500).json({ error: "Database not available" });
      }

      const [allProjects, cards, allUsers] = await Promise.all([
        db.select().from(projects),
        db.select().from(kanbanCards),
        db.select().from(users),
      ]);

      const userMap = new Map(allUsers.map((u) => [u.id, u]));

      // Map projects (EN) -> formato frontend (PT-BR)
      const projetosComTarefas = allProjects.map((p) => {
        const cardsDoProjeto = cards.filter((c) => c.projectId === p.id);
        const responsavel = p.ownerId ? userMap.get(p.ownerId) : null;
        const nome = responsavel?.name || "Não atribuído";
        const initials = nome
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0].toUpperCase())
          .join("");

        return {
          id: p.id,
          codigo: p.code,
          nome: p.name,
          descricao: p.description,
          status: p.status,
          prioridade: p.priority,
          responsavel: nome,
          responsavelInitials: initials,
          dataInicio: p.startDate ? String(p.startDate) : null,
          dataFim: p.endDate ? String(p.endDate) : null,
          progresso: p.progress,
          cor: p.color,
          categoria: p.category,
          criadoEm: p.createdAt ? String(p.createdAt) : null,
          tarefas: cardsDoProjeto.map((c) => {
            const tResp = c.assigneeId ? userMap.get(c.assigneeId) : null;
            const tNome = tResp?.name || "Não atribuído";
            const tInitials = tNome
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0].toUpperCase())
              .join("");
            return {
              id: c.id,
              codigo: c.code,
              titulo: c.title,
              descricao: c.objectives,
              status: kanbanStatusToPtBr[c.status] || c.status,
              prioridade: c.priority,
              responsavelId: c.assigneeId,
              dataEntrega: c.dueDate ? String(c.dueDate) : null,
              progresso: c.progress,
              criadoEm: c.createdAt ? String(c.createdAt) : null,
              responsavel: tNome,
              responsavelInitials: tInitials,
            };
          }),
        };
      });

      // KPIs — "ativos" = não concluído nem cancelado nem completed
      const ativos = allProjects.filter((p) =>
        p.status !== "concluido" && p.status !== "cancelado" && p.status !== "completed"
      ).length;
      const tarefasAbertas = cards.filter((c) => c.status === "todo").length;
      const emAndamento = cards.filter((c) => c.status === "doing").length;
      const concluidas = cards.filter((c) => c.status === "done").length;
      const now = new Date();
      const atrasadas = cards.filter((c) => {
        if (c.status === "done") return false;
        if (!c.dueDate) return false;
        return new Date(c.dueDate) < now;
      }).length;

      res.json({
        kpis: { ativos, tarefasAbertas, emAndamento, concluidas, atrasadas },
        projetos: projetosComTarefas,
      });
    } catch (error: any) {
      const status = error.status || 500;
      res.status(status).json({ error: error.message });
    }
  });

  // ─── PATCH chamado ─────────────────────────────────────────────────────────────
  router.patch("/api/workspace/chamados/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, prioridade, responsavelId, titulo, descricao } = req.body as {
        status?: string;
        prioridade?: string;
        responsavelId?: string;
        titulo?: string;
        descricao?: string;
      };

      const prioridadeMap: Record<string, string> = {
        baixa: "low",
        media: "medium",
        alta: "high",
        critica: "critical",
      };
      const priorityRevMap: Record<string, string> = {
        low: "baixa",
        medium: "media",
        high: "alta",
        critical: "critica",
      };

      const updateData: Partial<Ticket> = {};
      if (status !== undefined) updateData.status = status;
      if (prioridade !== undefined) updateData.priority = prioridadeMap[prioridade] || prioridade;
      if (responsavelId !== undefined) updateData.assigneeId = responsavelId;
      if (titulo !== undefined) updateData.title = titulo.trim();
      if (descricao !== undefined) updateData.description = descricao;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "Nenhum campo para atualizar" });
      }

      const ticket = await storage.updateTicket(String(id), updateData);
      if (!ticket) return res.status(404).json({ error: "Chamado não encontrado" });

      const [allUsers, slaRules] = await Promise.all([
        storage.getUsers(),
        storage.getSlaRules(),
      ]);
      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const assignee = ticket.assigneeId ? userMap.get(ticket.assigneeId) : null;
      const name = assignee?.name || "Não atribuído";
      const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
      const sla = getSlaForTicket(ticket, slaRules);

      return res.json({
        id: String(ticket.id),
        codigo: ticket.code,
        titulo: ticket.title,
        descricao: ticket.description || "",
        categoria: ticket.category,
        tipo: ticket.type,
        responsavel: name,
        responsavelInitials: initials,
        status: ticket.status,
        prioridade: priorityRevMap[ticket.priority] || ticket.priority,
        sla: sla.slaHoras,
        statusSla: sla.status,
        abertura: (ticket.dataAbertura || ticket.createdAt || "").toString(),
      });
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  });

  // ─── PATCH tarefa ──────────────────────────────────────────────────────────────
  router.patch("/api/workspace/tarefas/:id", requireAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: "Database not available" });
      const { id } = req.params;
      const { status, prioridade, responsavelId, dataEntrega, progresso } = req.body as {
        status?: string;
        prioridade?: string;
        responsavelId?: string;
        dataEntrega?: string;
        progresso?: number;
      };

      const ptBrToKanban: Record<string, string> = {
        "a-fazer": "todo",
        "em-andamento": "doing",
        concluido: "done",
        bloqueado: "blocked",
      };

      const updateData: Record<string, any> = {};
      if (status !== undefined) updateData.status = ptBrToKanban[status] || status;
      if (prioridade !== undefined) updateData.priority = prioridade;
      if (responsavelId !== undefined) updateData.assigneeId = responsavelId;
      if (dataEntrega !== undefined) updateData.dueDate = dataEntrega ? new Date(dataEntrega) : null;
      if (progresso !== undefined) updateData.progress = progresso;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "Nenhum campo para atualizar" });
      }

      const [card] = await db
        .update(kanbanCards)
        .set(updateData)
        .where(eq(kanbanCards.id, String(id)))
        .returning();

      if (!card) return res.status(404).json({ error: "Tarefa não encontrada" });

      const allUsers = await storage.getUsers();
      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const tResp = card.assigneeId ? userMap.get(card.assigneeId) : null;
      const tNome = tResp?.name || "Não atribuído";
      const tInitials = tNome.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

      return res.json({
        id: card.id,
        codigo: card.code,
        titulo: card.title,
        descricao: card.objectives,
        status: kanbanStatusToPtBr[card.status] || card.status,
        prioridade: card.priority,
        responsavelId: card.assigneeId,
        responsavel: tNome,
        responsavelInitials: tInitials,
        dataEntrega: card.dueDate ? String(card.dueDate) : null,
        progresso: card.progress,
        criadoEm: card.createdAt ? String(card.createdAt) : null,
      });
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  });

  // ─── GET comentarios de chamado ───────────────────────────────────────────────
  router.get("/api/workspace/chamados/:id/comentarios", requireAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: "Database not available" });
      const { id } = req.params;
      const { userId: _userId } = getSessionUser(req);

      const comentarios = await db
        .select()
        .from(workspaceComentarios)
        .where(eq(workspaceComentarios.chamadoId, id))
        .orderBy(workspaceComentarios.criadoEm);

      const allUsers = await storage.getUsers();
      const userMap = new Map(allUsers.map((u) => [u.id, u]));

      const items = comentarios.map((c) => {
        const autor = userMap.get(c.autorId);
        const autorNome = autor?.name || "Usuário";
        const autorInitials = autorNome.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
        return {
          id: c.id,
          texto: c.texto,
          autorId: c.autorId,
          autorNome,
          autorInitials,
          criadoEm: c.criadoEm ? String(c.criadoEm) : null,
        };
      });

      return res.json({ comentarios: items });
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  });

  // ─── POST comentario em chamado ───────────────────────────────────────────────
  router.post("/api/workspace/chamados/:id/comentarios", requireAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: "Database not available" });
      const { id } = req.params;
      const { userId } = getSessionUser(req);
      const { texto } = req.body as { texto?: string; mencionados?: string[] };

      if (!texto?.trim()) {
        return res.status(400).json({ error: "Texto obrigatório" });
      }

      const [comentario] = await db
        .insert(workspaceComentarios)
        .values({
          chamadoId: id,
          autorId: userId,
          texto: texto.trim(),
        })
        .returning();

      const allUsers = await storage.getUsers();
      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const autor = userMap.get(comentario.autorId);
      const autorNome = autor?.name || "Usuário";
      const autorInitials = autorNome.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

      return res.status(201).json({
        id: comentario.id,
        texto: comentario.texto,
        autorId: comentario.autorId,
        autorNome,
        autorInitials,
        criadoEm: comentario.criadoEm ? String(comentario.criadoEm) : null,
      });
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  });
}

// SLA helpers (reused logic from chamados frontend)
function getSlaStatus(ticket: Ticket, slaRules: SlaRule[]): "dentro_prazo" | "em_atraso" | null {
  const result = getSlaForTicket(ticket, slaRules);
  return result.status;
}

function getSlaForTicket(
  ticket: Ticket,
  slaRules: SlaRule[],
): { slaHoras: number | null; status: "dentro_prazo" | "em_atraso" | null } {
  const tipo = ticket.type?.toLowerCase();
  const rule = slaRules.find(
    (r) => r.tipo.toLowerCase() === tipo && r.prioridade === ticket.priority && r.ativo,
  );

  if (!rule || !rule.slaHoras) {
    return { slaHoras: null, status: null };
  }

  const slaHoras = parseFloat(rule.slaHoras.toString());
  const createdAt = ticket.dataAbertura
    ? new Date(ticket.dataAbertura)
    : ticket.createdAt
      ? new Date(ticket.createdAt)
      : null;

  if (!createdAt) {
    return { slaHoras, status: null };
  }

  const deadline = calculateBusinessSLADeadline(createdAt, slaHoras);

  if (ticket.status === "closed" || ticket.status === "resolved") {
    if (ticket.dataResolucao) {
      const resolutionDate = new Date(ticket.dataResolucao);
      return { slaHoras, status: resolutionDate > deadline ? "em_atraso" : "dentro_prazo" };
    }
    return { slaHoras, status: "dentro_prazo" };
  }

  const now = new Date();
  return {
    slaHoras,
    status: now > deadline ? "em_atraso" : "dentro_prazo",
  };
}

function calculateBusinessSLADeadline(createdAt: Date, slaHours: number): Date {
  const WORK_START_HOUR = 8;
  const WORK_HOURS_PER_DAY = 8;

  let current = new Date(createdAt);

  if (current.getHours() < WORK_START_HOUR) {
    current.setHours(WORK_START_HOUR, 0, 0, 0);
  }

  if (current.getHours() >= WORK_START_HOUR + WORK_HOURS_PER_DAY) {
    current.setDate(current.getDate() + 1);
    current.setHours(WORK_START_HOUR, 0, 0, 0);
    // Skip weekends
    while (current.getDay() === 0 || current.getDay() === 6) {
      current.setDate(current.getDate() + 1);
    }
  }

  while (current.getDay() === 0 || current.getDay() === 6) {
    current.setDate(current.getDate() + 1);
    current.setHours(WORK_START_HOUR, 0, 0, 0);
  }

  const fullDays = Math.floor(slaHours / WORK_HOURS_PER_DAY);
  const remainingHours = slaHours % WORK_HOURS_PER_DAY;

  for (let i = 0; i < fullDays; i++) {
    current.setDate(current.getDate() + 1);
    while (current.getDay() === 0 || current.getDay() === 6) {
      current.setDate(current.getDate() + 1);
    }
  }

  const hoursLeftInDay = (WORK_START_HOUR + WORK_HOURS_PER_DAY) - current.getHours();
  if (remainingHours <= hoursLeftInDay) {
    current.setHours(current.getHours() + remainingHours);
  } else {
    current.setDate(current.getDate() + 1);
    while (current.getDay() === 0 || current.getDay() === 6) {
      current.setDate(current.getDate() + 1);
    }
    current.setHours(WORK_START_HOUR + (remainingHours - hoursLeftInDay), 0, 0, 0);
  }

  return current;
}
