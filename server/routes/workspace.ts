import { Router } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { requireAuth, getSessionUser } from "../middleware/auth";
import { projects, projectMembers, kanbanCards, kanbanColumns, kanbanComments, users, workspaceComentarios } from "@shared/schema";
import type { Ticket, User, SlaRule, InsertTicket } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import {
  notifyChamadoCriado,
  notifyChamadoAtribuido,
  notifyChamadoFechado,
  notifyProjetoCriado,
  notifyAtividadeCriada,
  notifyAtividadeMovida,
  notifyAtividadeConcluida,
  type SlackDb,
} from "../services/slack-notifier.service";

/**
 * Slack notifier env (Express runtime). Apenas as variáveis necessárias —
 * o service ignora chaves ausentes e respeita SLACK_INTEGRATION_ENABLED.
 */
function slackEnv() {
  return {
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
    SLACK_INTEGRATION_ENABLED: process.env.SLACK_INTEGRATION_ENABLED,
    SLACK_CHANNEL_DEVS: process.env.SLACK_CHANNEL_DEVS,
  };
}

/** Fire-and-forget no Express: setImmediate evita bloquear a resposta HTTP. */
function fireSlack(fn: () => Promise<void>): void {
  setImmediate(() => {
    fn().catch((err) => console.error("[slack-notifier] dispatch falhou:", err));
  });
}

const STATUS_FECHADO = new Set(["resolved", "closed"]);

/**
 * Converte input do payload (que pode ser "", " ", null, undefined, ou string ISO/yyyy-MM-dd)
 * em Date válido OU null. Evita `new Date("")` que produz Invalid Date e quebra o
 * `mapToDriverValue` do Drizzle (RangeError: Invalid time value em toISOString).
 */
function toDateOrNull(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string" && !(v instanceof Date) && typeof v !== "number") return null;
  const s = typeof v === "string" ? v.trim() : v;
  if (s === "") return null;
  const d = s instanceof Date ? s : new Date(s as string | number);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Mapa de migração lazy: status legado (criados pelo modal /projetos antigo ou
 * pelo default do schema) → status canônico do workspace. Quando user edita um
 * projeto antigo, o backend normaliza on-the-fly e persiste no formato novo.
 */
const STATUS_LEGACY_MAP: Record<string, string> = {
  active: "ativo",
  sprint_active: "ativo",
  planning: "backlog",
  on_hold: "pausado",
  completed: "concluido",
  archived: "inativo",
};

function normalizeProjectStatus(s: unknown): string | undefined {
  if (s === null || s === undefined) return undefined;
  const str = String(s);
  const mapped = STATUS_LEGACY_MAP[str];
  if (mapped) {
    console.log("[normalize-status] migrated", { from: str, to: mapped });
    return mapped;
  }
  return str;
}

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

interface Anexo { name: string; url: string }

function mimeToName(mime: string, idx: number): string {
  const map: Record<string, string> = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "planilha.xlsx",
    "application/vnd.ms-excel": "planilha.xls",
    "application/pdf": "documento.pdf",
    "application/zip": "arquivo.zip",
    "application/msword": "documento.doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "documento.docx",
    "text/csv": "dados.csv",
  };
  if (map[mime]) return map[mime];
  if (mime.startsWith("image/")) return `imagem.${mime.split("/")[1] || "png"}`;
  return `arquivo_${idx + 1}`;
}

function parseAnexos(raw: string | null | undefined): Anexo[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((a: any, idx: number) => {
        if (typeof a === "string" && a.startsWith("data:")) {
          const mime = a.substring(5, a.indexOf(";")) || "application/octet-stream";
          return { name: mimeToName(mime, idx), url: a };
        }
        if (a && typeof a.url === "string") {
          return { name: a.name || mimeToName("", idx), url: a.url };
        }
        return null;
      })
      .filter(Boolean) as Anexo[];
  } catch {
    return [];
  }
}

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
            if (t.status === "open" || t.status === "in_progress" || t.status === "blocked") return true;
            if (t.status === "resolved" || t.status === "closed") {
              const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              const closedDate = (t as any).dataFechamento ? new Date((t as any).dataFechamento) : created;
              return closedDate ? closedDate >= thirtyDaysAgo : false;
            }
            return false;
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

      // SLA calculation — only count active (non-resolved) tickets
      let noPrazo = 0;
      let emAtraso = 0;
      const slaTickets = periodo === "em-tratativa"
        ? filtered.filter((t) => t.status !== "resolved" && t.status !== "closed")
        : filtered;
      for (const ticket of slaTickets) {
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

        const requester = (t as any).requesterId ? userMap.get((t as any).requesterId) : null;
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
          solicitante: requester?.name || null,
          anexos: parseAnexos((t as any).attachments),
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
      const { titulo, descricao, categoria, tipo, prioridade, attachments } = req.body as {
        titulo?: string;
        descricao?: string;
        categoria?: string;
        tipo?: string;
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
        type: tipo || "bug",
        location: "outros",
        priority: mappedPriority,
        impact: "medio",
        status: "open",
        requesterId: userId,
        tenantId: null,
        attachments: attachments || null,
      } as InsertTicket);

      // Slack: notifica criação no canal #devs-renov (fire-and-forget).
      if (db) {
        fireSlack(() => notifyChamadoCriado({ db: db as SlackDb, env: slackEnv() }, ticket.id));
      }

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
          dueDate: toDateOrNull(dataEntrega),
          status: "todo",
          progress: 0,
        })
        .returning();

      // Slack: reply na thread do projeto pai (se mapeado).
      fireSlack(() => notifyAtividadeCriada({ db: db as SlackDb, env: slackEnv() }, card.id));

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
      const { nome, descricao, prioridade, responsavelId, dataInicio, dataFim, categoria, visibility, memberIds } =
        req.body as {
          nome?: string;
          descricao?: string;
          prioridade?: string;
          responsavelId?: string;
          dataInicio?: string;
          dataFim?: string;
          categoria?: string;
          visibility?: string;
          memberIds?: string[];
        };

      if (!nome?.trim()) {
        return res.status(400).json({ error: "Nome obrigatório" });
      }

      const validVisibilities = ["private", "shared", "public"] as const;
      type Visibility = typeof validVisibilities[number];
      const finalVisibility: Visibility = (validVisibilities as readonly string[]).includes(visibility ?? "")
        ? (visibility as Visibility)
        : "private";
      if (visibility !== undefined && !validVisibilities.includes(visibility as Visibility)) {
        return res.status(400).json({ error: `Visibilidade inválida. Aceitos: ${validVisibilities.join(", ")}` });
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
          startDate: toDateOrNull(dataInicio),
          endDate: toDateOrNull(dataFim),
          color: "#00c853",
          category: categoria || null,
          visibility: finalVisibility,
          progress: 0,
        })
        .returning();

      // Insere membros quando shared (espelha worker/src/routes/projects.ts)
      if (finalVisibility === "shared" && Array.isArray(memberIds) && memberIds.length > 0) {
        for (const uid of memberIds) {
          try {
            await storage.addProjectMember({
              projectId: projeto.id,
              userId: uid,
              role: "member",
            });
          } catch (_e) {
            // Silenciosamente ignora membros inválidos para não bloquear criação
          }
        }
      }

      // Slack: notifica criação no canal (skipa se visibility=private).
      fireSlack(() => notifyProjetoCriado({ db: db as SlackDb, env: slackEnv() }, projeto.id));

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
        visibility: projeto.visibility,
        criadoEm: (projeto.createdAt || "").toString(),
      });
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  });

  // ─── PATCH projetos ───────────────────────────────────────────────────────────
  router.patch("/api/workspace/projetos/:id", requireAuth, async (req, res) => {
    const id = String(req.params.id);
    let stage = "init";
    try {
      if (!db) return res.status(500).json({ error: "Database not available" });

      stage = "parse-body";
      const { nome, descricao, prioridade, responsavelId, dataInicio, dataFim, categoria, cor, progresso, visibility, memberIds } =
        req.body as {
          nome?: string;
          descricao?: string;
          status?: string;
          prioridade?: string;
          responsavelId?: string;
          dataInicio?: string | null;
          dataFim?: string | null;
          categoria?: string;
          cor?: string;
          progresso?: number;
          visibility?: string;
          memberIds?: string[];
        };
      const status = normalizeProjectStatus((req.body as any).status);

      stage = "validate-status";
      const validStatuses = ["backlog", "ativo", "pausado", "concluido", "inativo"];
      if (status !== undefined && !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status inválido. Valores aceitos: ${validStatuses.join(", ")}` });
      }

      stage = "validate-visibility";
      const validVisibilities = ["private", "shared", "public"] as const;
      type Visibility = typeof validVisibilities[number];
      if (visibility !== undefined && !(validVisibilities as readonly string[]).includes(visibility)) {
        return res.status(400).json({ error: `Visibilidade inválida. Aceitos: ${validVisibilities.join(", ")}` });
      }

      stage = "load-existing";
      const existing = await storage.getProject(id);
      if (!existing) {
        return res.status(404).json({ error: "Projeto não encontrado" });
      }

      stage = "build-updateData";
      const updateData: Record<string, any> = {};
      if (nome !== undefined) updateData.name = nome.trim();
      if (descricao !== undefined) updateData.description = descricao;
      if (status !== undefined) updateData.status = status;
      if (prioridade !== undefined) updateData.priority = prioridade;
      if (responsavelId !== undefined) updateData.ownerId = responsavelId;
      if (dataInicio !== undefined) updateData.startDate = toDateOrNull(dataInicio);
      if (dataFim !== undefined) updateData.endDate = toDateOrNull(dataFim);
      if (categoria !== undefined) updateData.category = categoria;
      if (cor !== undefined) updateData.color = cor;
      if (progresso !== undefined) updateData.progress = Math.max(0, Math.min(100, progresso));
      if (visibility !== undefined) updateData.visibility = visibility;

      if (Object.keys(updateData).length === 0 && memberIds === undefined) {
        return res.status(400).json({ error: "Nenhum campo para atualizar" });
      }

      let updated = existing;
      if (Object.keys(updateData).length > 0) {
        stage = "db.update";
        console.log("[PATCH /api/workspace/projetos/:id] db.update", { id, fields: Object.keys(updateData) });
        const [u] = await db
          .update(projects)
          .set(updateData)
          .where(eq(projects.id, id))
          .returning();
        if (!u) return res.status(404).json({ error: "Projeto não encontrado" });
        updated = u;
      }

      // Upsert de project_members (espelha worker/src/routes/projects.ts)
      const effectiveVisibility = (visibility as Visibility | undefined) ?? (existing.visibility as Visibility);
      if (effectiveVisibility === "shared" && Array.isArray(memberIds)) {
        stage = "members.shared.load";
        const currentMembers = await storage.getProjectMembers(id);
        const currentMemberIds = new Set(currentMembers.map((m) => m.userId));
        const newMemberIds = new Set(memberIds);

        for (const uid of memberIds) {
          if (!currentMemberIds.has(uid)) {
            stage = `members.add(${uid})`;
            try {
              await storage.addProjectMember({ projectId: id, userId: uid, role: "member" });
            } catch (e: any) {
              console.error("[PATCH /api/workspace/projetos/:id] addProjectMember falhou (ignorado)", { id, uid, msg: e?.message, stack: e?.stack });
            }
          }
        }
        for (const member of currentMembers) {
          if (!newMemberIds.has(member.userId)) {
            stage = `members.remove(${member.id})`;
            try {
              await storage.removeProjectMember(member.id);
            } catch (e: any) {
              console.error("[PATCH /api/workspace/projetos/:id] removeProjectMember falhou (ignorado)", { id, memberId: member.id, msg: e?.message, stack: e?.stack });
            }
          }
        }
      } else if (effectiveVisibility !== "shared") {
        // Limpa membros se virou private/public
        stage = "members.cleanup.load";
        const currentMembers = await storage.getProjectMembers(id);
        for (const member of currentMembers) {
          stage = `members.cleanup(${member.id})`;
          try {
            await storage.removeProjectMember(member.id);
          } catch (e: any) {
            console.error("[PATCH /api/workspace/projetos/:id] cleanup removeProjectMember falhou (ignorado)", { id, memberId: member.id, msg: e?.message, stack: e?.stack });
          }
        }
      }

      return res.json({
        id: updated.id,
        codigo: updated.code,
        nome: updated.name,
        status: updated.status,
        prioridade: updated.priority,
        visibility: updated.visibility,
      });
    } catch (error: any) {
      console.error("[PATCH /api/workspace/projetos/:id] FALHOU", {
        id,
        stage,
        msg: error?.message,
        name: error?.name,
        code: error?.code,
        stack: error?.stack,
      });
      return res.status(error.status || 500).json({ error: error.message, stage });
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

      const [allProjects, cards, allUsers, allMembers] = await Promise.all([
        db.select().from(projects),
        db.select().from(kanbanCards),
        db.select().from(users),
        db.select().from(projectMembers),
      ]);

      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const membersByProject = new Map<string, string[]>();
      for (const m of allMembers) {
        const arr = membersByProject.get(m.projectId) ?? [];
        arr.push(m.userId);
        membersByProject.set(m.projectId, arr);
      }

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
          visibility: p.visibility,
          memberIds: membersByProject.get(p.id) ?? [],
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
            // Parse attachments: kanbanCards.attachments is text[] of URLs
            const rawAtt = c.attachments || [];
            const anexos = rawAtt.map((url, i) => ({ name: `Anexo ${i + 1}`, url }));
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
              anexos,
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
      const { userId: actorId } = getSessionUser(req);
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

      // Captura estado anterior para detectar transições (atribuição, fechamento).
      const previous = await storage.getTicket(String(id));

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

      // Slack: dispara hooks por transição (apenas o que mudou).
      if (db) {
        const oldAssignee = previous?.assigneeId || null;
        const newAssignee = ticket.assigneeId || null;
        if (newAssignee && newAssignee !== oldAssignee) {
          fireSlack(() =>
            notifyChamadoAtribuido({ db: db as SlackDb, env: slackEnv() }, ticket.id, newAssignee),
          );
        }
        const wasOpen = previous && !STATUS_FECHADO.has(previous.status);
        const isClosed = STATUS_FECHADO.has(ticket.status);
        if (wasOpen && isClosed) {
          fireSlack(() =>
            notifyChamadoFechado({ db: db as SlackDb, env: slackEnv() }, ticket.id, actorId),
          );
        }
      }

      const [allUsers, slaRules] = await Promise.all([
        storage.getUsers(),
        storage.getSlaRules(),
      ]);
      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const assignee = ticket.assigneeId ? userMap.get(ticket.assigneeId) : null;
      const name = assignee?.name || "Não atribuído";
      const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
      const requester = (ticket as any).requesterId ? userMap.get((ticket as any).requesterId) : null;
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
        solicitante: requester?.name || null,
      });
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  });

  // ─── GET tarefa individual ──────────────────────────────────────────────────
  router.get("/api/workspace/tarefas/:id", requireAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: "Database not available" });
      const { id } = req.params;

      const [card] = await db
        .select()
        .from(kanbanCards)
        .where(eq(kanbanCards.id, String(id)))
        .limit(1);

      if (!card) return res.status(404).json({ error: "Tarefa não encontrada" });

      // Fetch project info
      const [projeto] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, card.projectId))
        .limit(1);

      const allUsers = await storage.getUsers();
      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const resp = card.assigneeId ? userMap.get(card.assigneeId) : null;
      const respNome = resp?.name || "Não atribuído";
      const respInitials = respNome.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

      const rawAtt = card.attachments || [];
      const anexos = rawAtt.map((url, i) => ({ name: `Anexo ${i + 1}`, url }));

      return res.json({
        id: card.id,
        codigo: card.code,
        titulo: card.title,
        descricao: card.objectives || null,
        status: kanbanStatusToPtBr[card.status] || card.status,
        prioridade: card.priority,
        responsavelId: card.assigneeId,
        responsavel: respNome,
        responsavelInitials: respInitials,
        dataEntrega: card.dueDate ? String(card.dueDate) : null,
        dataInicio: card.startDate ? String(card.startDate) : null,
        progresso: card.progress ?? 0,
        criadoEm: card.createdAt ? String(card.createdAt) : null,
        anexos,
        projeto: projeto ? {
          id: projeto.id,
          codigo: projeto.code,
          nome: projeto.name,
          cor: projeto.color || "#00c853",
        } : null,
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
      const { status, prioridade, responsavelId, dataEntrega, progresso, titulo, descricao, projetoId } = req.body as {
        status?: string;
        prioridade?: string;
        responsavelId?: string;
        dataEntrega?: string | null;
        progresso?: number;
        titulo?: string;
        descricao?: string;
        projetoId?: string;
      };

      const ptBrToKanban: Record<string, string> = {
        "a-fazer": "todo",
        "em-andamento": "doing",
        concluido: "done",
        bloqueado: "blocked",
      };

      // Captura estado anterior para detectar mudança de status.
      const [prevCard] = await db
        .select()
        .from(kanbanCards)
        .where(eq(kanbanCards.id, String(id)))
        .limit(1);

      const updateData: Record<string, any> = {};
      if (status !== undefined) updateData.status = ptBrToKanban[status] || status;
      if (prioridade !== undefined) updateData.priority = prioridade;
      if (responsavelId !== undefined) updateData.assigneeId = responsavelId;
      if (dataEntrega !== undefined) updateData.dueDate = toDateOrNull(dataEntrega);
      if (progresso !== undefined) updateData.progress = progresso;
      if (titulo !== undefined) updateData.title = titulo.trim();
      if (descricao !== undefined) updateData.objectives = descricao;

      // Mover tarefa para outro projeto: precisa reatribuir columnId,
      // pois a coluna atual pertence ao projeto antigo.
      if (projetoId !== undefined && projetoId !== prevCard?.projectId) {
        const [targetProject] = await db
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.id, projetoId))
          .limit(1);
        if (!targetProject) {
          return res.status(404).json({ error: "Projeto destino não encontrado" });
        }
        let [targetCol] = await db
          .select({ id: kanbanColumns.id })
          .from(kanbanColumns)
          .where(eq(kanbanColumns.projectId, projetoId))
          .orderBy(kanbanColumns.order)
          .limit(1);
        if (!targetCol) {
          [targetCol] = await db
            .insert(kanbanColumns)
            .values({ projectId: projetoId, name: "A Fazer", order: 0 })
            .returning({ id: kanbanColumns.id });
        }
        updateData.projectId = projetoId;
        updateData.columnId = targetCol.id;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "Nenhum campo para atualizar" });
      }

      const [card] = await db
        .update(kanbanCards)
        .set(updateData)
        .where(eq(kanbanCards.id, String(id)))
        .returning();

      if (!card) return res.status(404).json({ error: "Tarefa não encontrada" });

      // Slack: hook de transição de status na atividade.
      if (prevCard && prevCard.status !== card.status) {
        if (card.status === "done") {
          fireSlack(() =>
            notifyAtividadeConcluida({ db: db as SlackDb, env: slackEnv() }, card.id),
          );
        } else {
          fireSlack(() =>
            notifyAtividadeMovida({ db: db as SlackDb, env: slackEnv() }, card.id, card.status),
          );
        }
      }

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

  // ─── DELETE tarefa ─────────────────────────────────────────────────────────────
  router.delete("/api/workspace/tarefas/:id", requireAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: "Database not available" });
      const { id } = req.params;

      const [deleted] = await db
        .delete(kanbanCards)
        .where(eq(kanbanCards.id, String(id)))
        .returning({ id: kanbanCards.id });

      if (!deleted) return res.status(404).json({ error: "Tarefa não encontrada" });

      return res.json({ ok: true });
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  });

  // ─── GET comentarios de tarefa ────────────────────────────────────────────────
  router.get("/api/workspace/tarefas/:id/comentarios", requireAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: "Database not available" });
      const { id } = req.params;

      const comentarios = await db
        .select()
        .from(kanbanComments)
        .where(eq(kanbanComments.cardId, String(id)))
        .orderBy(kanbanComments.createdAt);

      const allUsers = await storage.getUsers();
      const userMap = new Map(allUsers.map((u) => [u.id, u]));

      const items = comentarios.map((c) => {
        const autor = userMap.get(c.userId);
        const autorNome = autor?.name || "Usuário";
        const autorInitials = autorNome.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
        return {
          id: c.id,
          texto: c.content,
          autorId: c.userId,
          autorNome,
          autorInitials,
          criadoEm: c.createdAt ? String(c.createdAt) : null,
        };
      });

      return res.json({ comentarios: items });
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  });

  // ─── POST comentario em tarefa ──────────────────────────────────────────────
  router.post("/api/workspace/tarefas/:id/comentarios", requireAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: "Database not available" });
      const { id } = req.params;
      const { userId } = getSessionUser(req);
      const { texto } = req.body as { texto?: string };

      if (!texto?.trim()) {
        return res.status(400).json({ error: "Texto obrigatório" });
      }

      const [comentario] = await db
        .insert(kanbanComments)
        .values({
          cardId: String(id),
          userId,
          content: texto.trim(),
        })
        .returning();

      const allUsers = await storage.getUsers();
      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const autor = userMap.get(comentario.userId);
      const autorNome = autor?.name || "Usuário";
      const autorInitials = autorNome.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

      return res.status(201).json({
        id: comentario.id,
        texto: comentario.content,
        autorId: comentario.userId,
        autorNome,
        autorInitials,
        criadoEm: comentario.createdAt ? String(comentario.createdAt) : null,
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
