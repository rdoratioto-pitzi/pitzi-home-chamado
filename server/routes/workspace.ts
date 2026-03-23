import { Router } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { requireAuth, getSessionUser } from "../middleware/auth";
import { workspaceProjetos, workspaceTarefas, users } from "@shared/schema";
import type { Ticket, User, SlaRule } from "@shared/schema";
import { eq } from "drizzle-orm";

export function registerWorkspaceRoutes(router: Router) {
  router.get("/api/workspace/chamados", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const periodo = (req.query.periodo as string) || "este-ano";

      // Fetch tickets based on user role
      const allTickets: Ticket[] = isAdmin
        ? await storage.getTickets()
        : await storage.getTickets({ requesterId: userId, assigneeId: userId });

      const users: User[] = await storage.getUsers();
      const slaRules: SlaRule[] = await storage.getSlaRules();

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
        const slaStatus = getSlaStatus(ticket, slaRules);
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

        const sla = getSlaForTicket(t, slaRules);

        return {
          id: t.id,
          codigo: t.code,
          titulo: t.title,
          categoria: t.category,
          tipo: t.type,
          responsavel: name,
          responsavelInitials: initials,
          status: t.status,
          prioridade: t.priority,
          sla: sla.slaHoras,
          statusSla: sla.status,
          abertura: t.dataAbertura || t.createdAt,
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

  // ─── Projetos ────────────────────────────────────────────────────────────────
  router.get("/api/workspace/projetos", requireAuth, async (_req, res) => {
    try {
      if (!db) {
        return res.status(500).json({ error: "Database not available" });
      }

      const projetos = await db.select().from(workspaceProjetos);
      const tarefas = await db.select().from(workspaceTarefas);
      const allUsers = await db.select().from(users);

      const userMap = new Map(allUsers.map((u) => [u.id, u]));

      // Build projetos with nested tarefas
      const projetosComTarefas = projetos.map((p) => {
        const tarefasDoProjeto = tarefas.filter((t) => t.projetoId === p.id);
        const responsavel = p.responsavelId ? userMap.get(p.responsavelId) : null;
        const nome = responsavel?.name || "Não atribuído";
        const initials = nome
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0].toUpperCase())
          .join("");

        return {
          ...p,
          responsavel: nome,
          responsavelInitials: initials,
          tarefas: tarefasDoProjeto.map((t) => {
            const tResp = t.responsavelId ? userMap.get(t.responsavelId) : null;
            const tNome = tResp?.name || "Não atribuído";
            const tInitials = tNome
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0].toUpperCase())
              .join("");
            return { ...t, responsavel: tNome, responsavelInitials: tInitials };
          }),
        };
      });

      // KPIs
      const ativos = projetos.filter((p) => p.status !== "concluido" && p.status !== "cancelado").length;
      const tarefasAbertas = tarefas.filter((t) => t.status === "a-fazer").length;
      const emAndamento = tarefas.filter((t) => t.status === "em-andamento").length;
      const concluidas = tarefas.filter((t) => t.status === "concluido").length;
      const now = new Date();
      const atrasadas = tarefas.filter((t) => {
        if (t.status === "concluido") return false;
        if (!t.dataEntrega) return false;
        return new Date(t.dataEntrega) < now;
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
