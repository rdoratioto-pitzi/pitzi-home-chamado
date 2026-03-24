// worker/src/routes/workspace.ts
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import {
  projects,
  workspaceTarefas,
  users,
} from "../../../shared/schema";
import type { Ticket, SlaRule } from "../../../shared/schema";

const workspace = new Hono<AppEnv>();

// ─── GET chamados ─────────────────────────────────────────────────────────────

workspace.get("/api/workspace/chamados", async (c) => {
  try {
    const { userId, role } = c.get("user");
    const isAdmin = role === "admin";
    const periodo = c.req.query("periodo") || "este-ano";
    const storage = getStorage(c.get("db"));

    const allTickets: Ticket[] = isAdmin
      ? await storage.getTickets()
      : await storage.getTickets({ requesterId: userId, assigneeId: userId });

    const allUsers = await storage.getUsers();
    const slaRules: SlaRule[] = await storage.getSlaRules();

    const now = new Date();
    const filtered = allTickets.filter((t) => {
      const created = t.dataAbertura
        ? new Date(t.dataAbertura)
        : t.createdAt
          ? new Date(t.createdAt)
          : null;
      if (!created) return false;

      switch (periodo) {
        case "mes-vigente":
          return (
            created.getMonth() === now.getMonth() &&
            created.getFullYear() === now.getFullYear()
          );
        case "mes-anterior": {
          const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          return (
            created.getMonth() === prev.getMonth() &&
            created.getFullYear() === prev.getFullYear()
          );
        }
        case "em-tratativa":
          return (
            t.status === "open" ||
            t.status === "in_progress" ||
            t.status === "blocked"
          );
        case "este-ano":
        default:
          return created.getFullYear() === now.getFullYear();
      }
    });

    const abertos = filtered.filter((t) => t.status === "open").length;
    const andamento = filtered.filter((t) => t.status === "in_progress").length;
    const bloqueados = filtered.filter((t) => t.status === "blocked").length;
    const resolvidos = filtered.filter(
      (t) => t.status === "resolved" || t.status === "closed",
    ).length;
    const total = filtered.length;

    let noPrazo = 0;
    let emAtraso = 0;
    for (const ticket of filtered) {
      const slaStatus = getSlaStatus(ticket, slaRules);
      if (slaStatus === "dentro_prazo") noPrazo++;
      else if (slaStatus === "em_atraso") emAtraso++;
    }

    const userMap = new Map(allUsers.map((u) => [u.id, u]));

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

    return c.json({
      kpis: {
        total,
        abertos,
        andamento,
        bloqueados,
        resolvidos,
        noPrazo,
        emAtraso,
      },
      items,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
});

// ─── POST chamados ────────────────────────────────────────────────────────────

workspace.post("/api/workspace/chamados", async (c) => {
  try {
    const { userId } = c.get("user");
    const body = await c.req.json<{ titulo?: string; descricao?: string }>();
    const { titulo, descricao } = body;

    if (!titulo?.trim()) {
      return c.json({ error: "Título obrigatório" }, 400);
    }

    const storage = getStorage(c.get("db"));
    const ticket = await storage.createTicket({
      title: titulo.trim(),
      description: descricao || "",
      category: "geral",
      type: "bug",
      location: "outros",
      priority: "medium",
      impact: "medio",
      status: "open",
      requesterId: userId,
      tenantId: null,
    } as any);

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

    return c.json(
      {
        tipo: "chamado",
        id: String(ticket.id),
        codigo: ticket.code,
        titulo: ticket.title,
        categoria: ticket.category,
        responsavel: name,
        responsavelInitials: initials,
        status: ticket.status,
        prioridade: ticket.priority,
        sla: sla.slaHoras,
        statusSla: sla.status,
        criadoEm: (ticket.dataAbertura || ticket.createdAt || "").toString(),
      },
      201,
    );
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
});

// ─── POST tarefas ─────────────────────────────────────────────────────────────

workspace.post("/api/workspace/tarefas", async (c) => {
  try {
    const db = c.get("db");
    const body = await c.req.json<{
      titulo?: string;
      descricao?: string;
      projetoId?: string;
      prioridade?: string;
      responsavelId?: string;
      dataEntrega?: string;
      sprint?: string;
    }>();
    const {
      titulo,
      descricao,
      projetoId,
      prioridade,
      responsavelId,
      dataEntrega,
      sprint,
    } = body;

    if (!titulo?.trim()) {
      return c.json({ error: "Título obrigatório" }, 400);
    }

    const allTarefas = await db.select().from(workspaceTarefas);
    let codigo = `TAR-${String(allTarefas.length + 1).padStart(4, "0")}`;

    if (projetoId) {
      const projResult = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projetoId))
        .limit(1);
      if (projResult[0]) {
        const tarefasDoProjeto = await db
          .select()
          .from(workspaceTarefas)
          .where(eq(workspaceTarefas.projetoId, projetoId));
        codigo = `${projResult[0].code}·T${tarefasDoProjeto.length + 1}`;
      }
    }

    const [tarefa] = await db
      .insert(workspaceTarefas)
      .values({
        codigo,
        titulo: titulo.trim(),
        descricao: descricao || null,
        projetoId: projetoId || null,
        prioridade: prioridade || "media",
        responsavelId: responsavelId || null,
        dataEntrega: dataEntrega || null,
        sprint: sprint || null,
        status: "a-fazer",
        progresso: 0,
      })
      .returning();

    const storage = getStorage(db);
    const allUsers = await storage.getUsers();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const responsavel = tarefa.responsavelId
      ? userMap.get(tarefa.responsavelId)
      : null;
    const respNome = responsavel?.name || "Não atribuído";
    const respInitials = respNome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");

    let projetoNome = "Sem projeto";
    let corContexto: string | null = null;
    if (tarefa.projetoId) {
      const projResult = await db
        .select()
        .from(projects)
        .where(eq(projects.id, tarefa.projetoId))
        .limit(1);
      if (projResult[0]) {
        projetoNome = projResult[0].name;
        corContexto = projResult[0].color || null;
      }
    }

    return c.json(
      {
        tipo: "tarefa",
        id: tarefa.id,
        codigo: tarefa.codigo,
        titulo: tarefa.titulo,
        contexto: projetoNome,
        corContexto,
        badgeLabel: "TAREFA",
        badgeVariant: "tarefa",
        responsavel: respNome,
        responsavelInitials: respInitials,
        status: tarefa.status || "a-fazer",
        prioridade: tarefa.prioridade || "media",
        sla: null,
        statusSla: null,
        criadoEm: (tarefa.criadoEm || "").toString(),
      },
      201,
    );
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
});

// ─── POST projetos ────────────────────────────────────────────────────────────

workspace.post("/api/workspace/projetos", async (c) => {
  try {
    const db = c.get("db");
    const { userId } = c.get("user");
    const body = await c.req.json<{
      nome?: string;
      descricao?: string;
      prioridade?: string;
      responsavelId?: string;
      dataInicio?: string;
      dataFim?: string;
      categoria?: string;
    }>();
    const {
      nome,
      descricao,
      prioridade,
      responsavelId,
      dataInicio,
      dataFim,
      categoria,
    } = body;

    if (!nome?.trim()) {
      return c.json({ error: "Nome obrigatório" }, 400);
    }

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

    const storage = getStorage(db);
    const allUsers = await storage.getUsers();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const responsavel = projeto.ownerId
      ? userMap.get(projeto.ownerId)
      : null;
    const respNome = responsavel?.name || "Não atribuído";
    const respInitials = respNome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");

    return c.json(
      {
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
      },
      201,
    );
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
});

// ─── GET todos (visão unificada) ──────────────────────────────────────────────

workspace.get("/api/workspace/todos", async (c) => {
  try {
    const { userId, role } = c.get("user");
    const isAdmin = role === "admin";
    const db = c.get("db");
    const storage = getStorage(db);

    const [allTickets, tarefas, allProjects, allUsers, slaRules] =
      await Promise.all([
        isAdmin
          ? storage.getTickets()
          : storage.getTickets({ requesterId: userId, assigneeId: userId }),
        db.select().from(workspaceTarefas),
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

    const tarefaItems = tarefas.map((t) => {
      const user = t.responsavelId ? userMap.get(t.responsavelId) : null;
      const name = user?.name || "Não atribuído";
      const projeto = t.projetoId ? projetoMap.get(t.projetoId) : null;
      return {
        tipo: "tarefa" as const,
        id: t.id,
        codigo: t.codigo,
        titulo: t.titulo,
        contexto: projeto?.nome || "Sem projeto",
        corContexto: projeto?.cor || null,
        badgeLabel: "TAREFA",
        badgeVariant: "tarefa",
        responsavel: name,
        responsavelInitials: getInitials(name),
        status: t.status || "a-fazer",
        prioridade: t.prioridade || "media",
        sla: null as number | null,
        statusSla: null as "dentro_prazo" | "em_atraso" | null,
        criadoEm: (t.criadoEm || "").toString(),
      };
    });

    const items = [...chamadoItems, ...tarefaItems].sort((a, b) => {
      const da = a.criadoEm ? new Date(a.criadoEm).getTime() : 0;
      const db2 = b.criadoEm ? new Date(b.criadoEm).getTime() : 0;
      return db2 - da;
    });

    const totalGeral = items.length;
    const chamadosCount = chamadoItems.length;
    const tarefasCount = tarefaItems.length;
    const emAndamento = items.filter(
      (i) => i.status === "in_progress" || i.status === "em-andamento",
    ).length;
    const resolvidos = items.filter(
      (i) =>
        i.status === "resolved" ||
        i.status === "closed" ||
        i.status === "concluido",
    ).length;

    let noPrazo = 0;
    let emAtraso = 0;
    for (const ticket of allTickets) {
      const slaStatus = getSlaStatus(ticket, slaRules);
      if (slaStatus === "dentro_prazo") noPrazo++;
      else if (slaStatus === "em_atraso") emAtraso++;
    }

    return c.json({
      kpis: {
        totalGeral,
        chamados: chamadosCount,
        tarefas: tarefasCount,
        emAndamento,
        resolvidos,
        noPrazo,
        emAtraso,
      },
      items,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
});

// ─── GET projetos ─────────────────────────────────────────────────────────────

workspace.get("/api/workspace/projetos", async (c) => {
  try {
    const db = c.get("db");

    const allProjects = await db.select().from(projects);
    const tarefas = await db.select().from(workspaceTarefas);
    const allUsers = await db.select().from(users);

    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    const projetosComTarefas = allProjects.map((p) => {
      const tarefasDoProjeto = tarefas.filter((t) => t.projetoId === p.id);
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
        dataInicio: p.startDate ? p.startDate.toISOString() : null,
        dataFim: p.endDate ? p.endDate.toISOString() : null,
        progresso: p.progress,
        cor: p.color,
        categoria: p.category,
        criadoEm: p.createdAt ? p.createdAt.toISOString() : null,
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

    const ativos = allProjects.filter(
      (p) => p.status !== "concluido" && p.status !== "cancelado" && p.status !== "completed",
    ).length;
    const tarefasAbertas = tarefas.filter((t) => t.status === "a-fazer").length;
    const emAndamento = tarefas.filter(
      (t) => t.status === "em-andamento",
    ).length;
    const concluidas = tarefas.filter((t) => t.status === "concluido").length;
    const now = new Date();
    const atrasadas = tarefas.filter((t) => {
      if (t.status === "concluido") return false;
      if (!t.dataEntrega) return false;
      return new Date(t.dataEntrega) < now;
    }).length;

    return c.json({
      kpis: { ativos, tarefasAbertas, emAndamento, concluidas, atrasadas },
      projetos: projetosComTarefas,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
});

export { workspace };

// ─── SLA helpers ──────────────────────────────────────────────────────────────

function getSlaStatus(
  ticket: Ticket,
  slaRules: SlaRule[],
): "dentro_prazo" | "em_atraso" | null {
  return getSlaForTicket(ticket, slaRules).status;
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
      return {
        slaHoras,
        status: resolutionDate > deadline ? "em_atraso" : "dentro_prazo",
      };
    }
    return { slaHoras, status: "dentro_prazo" };
  }

  const now = new Date();
  return {
    slaHoras,
    status: now > deadline ? "em_atraso" : "dentro_prazo",
  };
}

function calculateBusinessSLADeadline(
  createdAt: Date,
  slaHours: number,
): Date {
  const WORK_START_HOUR = 8;
  const WORK_HOURS_PER_DAY = 8;

  const current = new Date(createdAt);

  if (current.getHours() < WORK_START_HOUR) {
    current.setHours(WORK_START_HOUR, 0, 0, 0);
  }

  if (current.getHours() >= WORK_START_HOUR + WORK_HOURS_PER_DAY) {
    current.setDate(current.getDate() + 1);
    current.setHours(WORK_START_HOUR, 0, 0, 0);
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

  const hoursLeftInDay =
    WORK_START_HOUR + WORK_HOURS_PER_DAY - current.getHours();
  if (remainingHours <= hoursLeftInDay) {
    current.setHours(current.getHours() + remainingHours);
  } else {
    current.setDate(current.getDate() + 1);
    while (current.getDay() === 0 || current.getDay() === 6) {
      current.setDate(current.getDate() + 1);
    }
    current.setHours(
      WORK_START_HOUR + (remainingHours - hoursLeftInDay),
      0,
      0,
      0,
    );
  }

  return current;
}
