// worker/src/routes/workspace.ts
import { Hono } from "hono";
import { eq, isNull } from "drizzle-orm";
import type { AppEnv } from "../index";
import { getStorage } from "../lib/storage";
import {
  projects,
  projectMembers,
  kanbanCards,
  kanbanColumns,
  kanbanComments,
  users,
  workspaceComentarios,
} from "../../../shared/schema";
import type { Ticket, SlaRule } from "../../../shared/schema";
import { isValidApplicationKey } from "../../../shared/applications";
import { extractMentions } from "../lib/sanitize-rich-text";
import {
  notifyChamadoCriado,
  notifyChamadoAtribuido,
  notifyChamadoFechado,
  notifyProjetoCriado,
  notifyAtividadeCriada,
  notifyAtividadeMovida,
  notifyAtividadeConcluida,
  type SlackDb,
} from "../../../server/services/slack-notifier.service";
import { fireFor as fireHermes } from "../services/hermes-trigger.service";

/** Extrai env Slack do binding do Worker. */
function slackEnv(envBindings: {
  SLACK_BOT_TOKEN?: string;
  SLACK_INTEGRATION_ENABLED?: string;
  SLACK_CHANNEL_DEVS?: string;
  APP_URL?: string;
}) {
  return {
    SLACK_BOT_TOKEN: envBindings.SLACK_BOT_TOKEN,
    SLACK_INTEGRATION_ENABLED: envBindings.SLACK_INTEGRATION_ENABLED,
    SLACK_CHANNEL_DEVS: envBindings.SLACK_CHANNEL_DEVS,
    APP_URL: envBindings.APP_URL,
  };
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

const kanbanStatusToPtBr: Record<string, string> = {
  todo: "a-fazer",
  doing: "em-andamento",
  done: "concluido",
};

/**
 * Fire-and-forget para notificações Slack no Worker.
 * Usa executionCtx.waitUntil para garantir que a Promise execute mesmo após
 * a resposta HTTP ser enviada — sem bloquear o cliente.
 */
function fireSlack(
  c: { executionCtx?: { waitUntil: (p: Promise<unknown>) => void } },
  fn: () => Promise<void>,
): void {
  const promise = fn().catch((err) =>
    console.error("[slack-notifier] dispatch falhou:", err),
  );
  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(promise);
  }
  // Fora do Worker (ex: testes), a Promise apenas roda no event loop.
}

const workspace = new Hono<AppEnv>();

// ─── Counts (lightweight) ──────────────────────────────────────────────────
workspace.get("/api/workspace/counts", async (c) => {
  try {
    const { userId, role } = c.get("user");
    const isAdmin = role === "admin";
    const db = c.get("db");
    const storage = getStorage(db);

    const [allTickets, allCards] = await Promise.all([
      isAdmin
        ? storage.getTickets()
        : storage.getTickets({ requesterId: userId, assigneeId: userId }),
      db.select().from(kanbanCards).where(isNull(kanbanCards.parentCardId)),
    ]);

    const chamados = allTickets.filter(
      (t) => t.status === "open" || t.status === "in_progress" || t.status === "blocked"
    ).length;

    const myCards = allCards.filter(
      (card) => card.assigneeId === userId && card.status !== "done"
    ).length;

    return c.json({ chamados, projetos: myCards, todos: chamados + myCards });
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
});

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

    // SLA calculation — only count active (non-resolved) tickets
    let noPrazo = 0;
    let emAtraso = 0;
    const slaTickets = periodo === "em-tratativa"
      ? filtered.filter((t) => t.status !== "resolved" && t.status !== "closed")
      : filtered;
    for (const ticket of slaTickets) {
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
      const requester = (t as any).requesterId ? userMap.get((t as any).requesterId) : null;
      const sla = getSlaForTicket(t, slaRules);

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
        anexos: parseAnexos(t.attachments),
        applicationKey: (t as any).applicationKey ?? null,
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
    const body = await c.req.json<{ titulo?: string; descricao?: string; categoria?: string; tipo?: string; prioridade?: string; applicationKey?: string }>();
    const { titulo, descricao, categoria, tipo, prioridade, applicationKey } = body;

    if (!titulo?.trim()) {
      return c.json({ error: "Título obrigatório" }, 400);
    }

    if (!isValidApplicationKey(applicationKey)) {
      return c.json({ error: "Aplicação é obrigatória e deve ser válida" }, 400);
    }

    const prioridadeMap: Record<string, string> = { baixa: "low", media: "medium", alta: "high", critica: "critical" };
    const mappedPriority = prioridade ? (prioridadeMap[prioridade] || prioridade) : "medium";

    const db = c.get("db");
    const storage = getStorage(db);
    const ticket = await storage.createTicket({
      title: titulo.trim(),
      description: descricao || "",
      category: categoria || "geral",
      type: tipo || "bug",
      applicationKey,
      priority: mappedPriority,
      impact: "medio",
      status: "open",
      requesterId: userId,
      tenantId: null,
    } as any);

    // Slack: notifica criação no canal #devs-renov (fire-and-forget via waitUntil).
    fireSlack(c, () =>
      notifyChamadoCriado({ db: db as SlackDb, env: slackEnv(c.env) }, ticket.id),
    );

    // Hermes trigger — fire-and-forget via waitUntil, NUNCA propaga erro.
    const hermesPromise = storage
      .getUser(userId)
      .then((requester) =>
        fireHermes(
          {
            HERMES_ROUTINE_URL: c.env.HERMES_ROUTINE_URL,
            HERMES_ROUTINE_TOKEN: c.env.HERMES_ROUTINE_TOKEN,
            APP_URL: c.env.APP_URL,
          },
          ticket,
          requester ? { name: requester.name } : null,
        ),
      )
      .catch((err: unknown) => {
        console.error("[hermes-trigger] erro inesperado fora do service:", err);
      });
    c.executionCtx.waitUntil(hermesPromise);

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
        applicationKey: (ticket as any).applicationKey ?? null,
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
      applicationKey?: string | null;
    }>();
    const { titulo, descricao, projetoId, prioridade, responsavelId, dataEntrega, applicationKey } = body;

    if (!titulo?.trim()) {
      return c.json({ error: "Título obrigatório" }, 400);
    }
    if (!projetoId) {
      return c.json({ error: "Projeto obrigatório para criar tarefa" }, 400);
    }

    if (applicationKey !== undefined && applicationKey !== null && !isValidApplicationKey(applicationKey)) {
      return c.json({ error: "Aplicação inválida" }, 400);
    }

    const [projeto] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projetoId))
      .limit(1);
    if (!projeto) {
      return c.json({ error: "Projeto não encontrado" }, 404);
    }

    // Herança: se applicationKey não foi passada, usa a do projeto pai
    const finalApplicationKey: string | null =
      applicationKey !== undefined ? (applicationKey ?? null) : (projeto.applicationKey ?? null);

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
        applicationKey: finalApplicationKey,
      })
      .returning();

    // Slack: reply na thread do projeto pai (se mapeado).
    fireSlack(c, () =>
      notifyAtividadeCriada({ db: db as SlackDb, env: slackEnv(c.env) }, card.id),
    );

    const storage = getStorage(db);
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

    return c.json(
      {
        tipo: "tarefa",
        id: card.id,
        codigo: card.code,
        titulo: card.title,
        contexto: projeto.name,
        corContexto: projeto.color || null,
        badgeLabel: "Tarefa",
        badgeVariant: "tarefa",
        responsavel: respNome,
        responsavelInitials: respInitials,
        status: kanbanStatusToPtBr[card.status] || "a-fazer",
        prioridade: card.priority || "normal",
        applicationKey: (card as any).applicationKey ?? null,
        sla: null,
        statusSla: null,
        criadoEm: (card.createdAt || "").toString(),
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
      status?: string;
      prioridade?: string;
      responsavelId?: string;
      dataInicio?: string;
      dataFim?: string;
      categoria?: string;
      visibility?: string;
      memberIds?: string[];
      applicationKey?: string;
    }>();
    const {
      nome,
      descricao,
      status,
      prioridade,
      responsavelId,
      dataInicio,
      dataFim,
      categoria,
      visibility,
      memberIds,
      applicationKey,
    } = body;

    if (!nome?.trim()) {
      return c.json({ error: "Nome obrigatório" }, 400);
    }

    if (!isValidApplicationKey(applicationKey)) {
      return c.json({ error: "Aplicação é obrigatória e deve ser válida" }, 400);
    }

    const validStatuses = ["backlog", "ativo", "pausado", "concluido", "inativo"];
    const normalizedStatus = normalizeProjectStatus(status);
    if (normalizedStatus !== undefined && !validStatuses.includes(normalizedStatus)) {
      return c.json({ error: `Status inválido. Valores aceitos: ${validStatuses.join(", ")}` }, 400);
    }
    const finalStatus = normalizedStatus ?? "backlog";

    const validVisibilities = ["private", "shared", "public"] as const;
    type Visibility = typeof validVisibilities[number];
    if (visibility !== undefined && !(validVisibilities as readonly string[]).includes(visibility)) {
      return c.json({ error: `Visibilidade inválida. Aceitos: ${validVisibilities.join(", ")}` }, 400);
    }
    const finalVisibility: Visibility = (visibility as Visibility | undefined) ?? "private";

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
        status: finalStatus,
        priority: prioridade || "media",
        ownerId: responsavelId || userId,
        startDate: toDateOrNull(dataInicio),
        endDate: toDateOrNull(dataFim),
        color: "#00c853",
        category: categoria || null,
        visibility: finalVisibility,
        progress: 0,
        applicationKey,
      })
      .returning();

    const storage = getStorage(db);

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
          // Ignora membros inválidos
        }
      }
    }

    // Slack: notifica criação no canal (skipa se visibility=private).
    fireSlack(c, () =>
      notifyProjetoCriado({ db: db as SlackDb, env: slackEnv(c.env) }, projeto.id),
    );
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
        descricao: projeto.description,
        status: projeto.status,
        prioridade: projeto.priority,
        responsavel: respNome,
        responsavelInitials: respInitials,
        responsavelId: projeto.ownerId,
        cor: projeto.color,
        categoria: projeto.category,
        dataInicio: projeto.startDate ? String(projeto.startDate) : null,
        dataFim: projeto.endDate ? String(projeto.endDate) : null,
        progresso: projeto.progress ?? 0,
        applicationKey: projeto.applicationKey ?? null,
        visibility: projeto.visibility,
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

    const [allTickets, cards, allProjects, allUsers, slaRules] =
      await Promise.all([
        isAdmin
          ? storage.getTickets()
          : storage.getTickets({ requesterId: userId, assigneeId: userId }),
        db.select().from(kanbanCards).where(isNull(kanbanCards.parentCardId)),
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
        applicationKey: (t as any).applicationKey ?? null,
        sla: sla.slaHoras,
        statusSla: sla.status,
        criadoEm: (t.dataAbertura || t.createdAt || "").toString(),
      };
    });

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
        badgeLabel: "Tarefa",
        badgeVariant: "tarefa",
        responsavel: name,
        responsavelInitials: getInitials(name),
        status: kanbanStatusToPtBr[c.status] || c.status,
        prioridade: c.priority || "normal",
        applicationKey: (c as any).applicationKey ?? null,
        sla: null as number | null,
        statusSla: null as "dentro_prazo" | "em_atraso" | null,
        criadoEm: (c.createdAt || "").toString(),
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
      (i) => i.status === "in_progress" || i.status === "em-andamento" || i.status === "doing",
    ).length;
    const resolvidos = items.filter(
      (i) =>
        i.status === "resolved" ||
        i.status === "closed" ||
        i.status === "concluido" ||
        i.status === "done",
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

    const [allProjects, cards, allUsers, allMembers] = await Promise.all([
      db.select().from(projects),
      db.select().from(kanbanCards).where(isNull(kanbanCards.parentCardId)),
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
        applicationKey: p.applicationKey,
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
          return {
            id: c.id,
            codigo: c.code,
            titulo: c.title,
            descricao: c.objectives,
            status: kanbanStatusToPtBr[c.status] || c.status,
            prioridade: c.priority,
            responsavelId: c.assigneeId,
            applicationKey: c.applicationKey,
            dataEntrega: c.dueDate ? String(c.dueDate) : null,
            progresso: c.progress,
            criadoEm: c.createdAt ? String(c.createdAt) : null,
            responsavel: tNome,
            responsavelInitials: tInitials,
          };
        }),
      };
    });

    const ativos = allProjects.filter(
      (p) => p.status !== "concluido" && p.status !== "cancelado" && p.status !== "completed",
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

    return c.json({
      kpis: { ativos, tarefasAbertas, emAndamento, concluidas, atrasadas },
      projetos: projetosComTarefas,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
});

// ─── PATCH chamado ────────────────────────────────────────────────────────────
workspace.patch("/api/workspace/chamados/:id", async (c) => {
  try {
    const { id } = c.req.param() as { id: string };
    const { userId: actorId } = c.get("user");
    const { status, prioridade, responsavelId, titulo, descricao, applicationKey } = await c.req.json();
    const db = c.get("db");
    const storage = getStorage(db);

    if (applicationKey !== undefined && applicationKey !== null && !isValidApplicationKey(applicationKey)) {
      return c.json({ error: "Aplicação inválida" }, 400);
    }

    const prioridadeMap: Record<string, string> = {
      baixa: "low", media: "medium", alta: "high", critica: "critical",
    };
    const priorityRevMap: Record<string, string> = {
      low: "baixa", medium: "media", high: "alta", critical: "critica",
    };

    // Captura estado anterior para detectar transições (atribuição, fechamento).
    const previous = await storage.getTicket(String(id));

    const updateData: Partial<Ticket> = {};
    if (status !== undefined) updateData.status = status;
    if (prioridade !== undefined) updateData.priority = prioridadeMap[prioridade] || prioridade;
    if (responsavelId !== undefined) updateData.assigneeId = responsavelId;
    if (titulo !== undefined) updateData.title = titulo.trim();
    if (descricao !== undefined) updateData.description = descricao;
    if (applicationKey !== undefined) updateData.applicationKey = applicationKey;

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: "Nenhum campo para atualizar" }, 400);
    }

    const ticket = await storage.updateTicket(String(id), updateData);
    if (!ticket) return c.json({ error: "Chamado não encontrado" }, 404);

    // Slack: dispara hooks por transição (apenas o que mudou).
    const oldAssignee = previous?.assigneeId || null;
    const newAssignee = ticket.assigneeId || null;
    if (newAssignee && newAssignee !== oldAssignee) {
      fireSlack(c, () =>
        notifyChamadoAtribuido({ db: db as SlackDb, env: slackEnv(c.env) }, ticket.id, newAssignee),
      );
    }
    const wasOpen = previous && !STATUS_FECHADO.has(previous.status);
    const isClosed = STATUS_FECHADO.has(ticket.status);
    if (wasOpen && isClosed) {
      fireSlack(c, () =>
        notifyChamadoFechado({ db: db as SlackDb, env: slackEnv(c.env) }, ticket.id, actorId),
      );
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

    return c.json({
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
      applicationKey: (ticket as any).applicationKey ?? null,
      sla: sla.slaHoras,
      statusSla: sla.status,
      abertura: (ticket.dataAbertura || ticket.createdAt || "").toString(),
      solicitante: requester?.name || null,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
});

// ─── PATCH tarefa ─────────────────────────────────────────────────────────────
workspace.patch("/api/workspace/tarefas/:id", async (c) => {
  try {
    const { id } = c.req.param() as { id: string };
    const { status, prioridade, responsavelId, dataEntrega, progresso, titulo, descricao, projetoId, applicationKey } = await c.req.json();
    const db = c.get("db");
    const storage = getStorage(db);

    if (applicationKey !== undefined && applicationKey !== null && !isValidApplicationKey(applicationKey)) {
      return c.json({ error: "Aplicação inválida" }, 400);
    }

    const ptBrToKanban: Record<string, string> = {
      "a-fazer": "todo", "em-andamento": "doing", concluido: "done", bloqueado: "blocked",
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
    // applicationKey: se vier explícito, aplica; mudança de projetoId NÃO sobrescreve.
    if (applicationKey !== undefined) updateData.applicationKey = applicationKey;

    // Mover tarefa para outro projeto: precisa reatribuir columnId,
    // pois a coluna atual pertence ao projeto antigo.
    if (projetoId !== undefined && projetoId !== prevCard?.projectId) {
      const [targetProject] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projetoId))
        .limit(1);
      if (!targetProject) {
        return c.json({ error: "Projeto destino não encontrado" }, 404);
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
      return c.json({ error: "Nenhum campo para atualizar" }, 400);
    }

    const [card] = await db
      .update(kanbanCards)
      .set(updateData)
      .where(eq(kanbanCards.id, String(id)))
      .returning();

    if (!card) return c.json({ error: "Tarefa não encontrada" }, 404);

    // Slack: hook de transição de status na atividade.
    if (prevCard && prevCard.status !== card.status) {
      if (card.status === "done") {
        fireSlack(c, () =>
          notifyAtividadeConcluida({ db: db as SlackDb, env: slackEnv(c.env) }, card.id),
        );
      } else {
        fireSlack(c, () =>
          notifyAtividadeMovida({ db: db as SlackDb, env: slackEnv(c.env) }, card.id, card.status),
        );
      }
    }

    const allUsers = await storage.getUsers();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const tResp = card.assigneeId ? userMap.get(card.assigneeId) : null;
    const tNome = tResp?.name || "Não atribuído";
    const tInitials = tNome.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

    return c.json({
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
      applicationKey: (card as any).applicationKey ?? null,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
});

// ─── PATCH projetos ───────────────────────────────────────────────────────────
workspace.patch("/api/workspace/projetos/:id", async (c) => {
  const id = c.req.param("id");
  let stage = "init";
  try {
    const db = c.get("db");
    stage = "parse-body";
    const body = await c.req.json();
    const { nome, descricao, prioridade, responsavelId, dataInicio, dataFim, categoria, cor, progresso, visibility, memberIds, applicationKey } = body;
    const status = normalizeProjectStatus(body.status);

    if (applicationKey !== undefined && applicationKey !== null && !isValidApplicationKey(applicationKey)) {
      return c.json({ error: "Aplicação inválida" }, 400);
    }

    stage = "validate-status";
    const validStatuses = ["backlog", "ativo", "pausado", "concluido", "inativo"];
    if (status !== undefined && !validStatuses.includes(status)) {
      return c.json({ error: `Status inválido. Valores aceitos: ${validStatuses.join(", ")}` }, 400);
    }

    const validVisibilities = ["private", "shared", "public"] as const;
    type Visibility = typeof validVisibilities[number];
    if (visibility !== undefined && !(validVisibilities as readonly string[]).includes(visibility)) {
      return c.json({ error: `Visibilidade inválida. Aceitos: ${validVisibilities.join(", ")}` }, 400);
    }

    const storage = getStorage(db);
    stage = "load-existing";
    const existing = await storage.getProject(id);
    if (!existing) {
      return c.json({ error: "Projeto não encontrado" }, 404);
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
    if (applicationKey !== undefined) updateData.applicationKey = applicationKey;

    if (Object.keys(updateData).length === 0 && memberIds === undefined) {
      return c.json({ error: "Nenhum campo para atualizar" }, 400);
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
      if (!u) return c.json({ error: "Projeto não encontrado" }, 404);
      updated = u;
    }

    // Upsert de project_members (espelha worker/src/routes/projects.ts)
    const effectiveVisibility = (visibility as Visibility | undefined) ?? (existing.visibility as Visibility);
    if (effectiveVisibility === "shared" && Array.isArray(memberIds)) {
      stage = "members.shared.load";
      const currentMembers = await storage.getProjectMembers(id);
      const currentMemberIds = new Set(currentMembers.map((m) => m.userId));
      const newMemberIds = new Set(memberIds as string[]);

      for (const uid of memberIds as string[]) {
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

    return c.json({
      id: updated.id,
      codigo: updated.code,
      nome: updated.name,
      descricao: updated.description,
      status: updated.status,
      prioridade: updated.priority,
      responsavelId: updated.ownerId,
      cor: updated.color,
      categoria: updated.category,
      dataInicio: updated.startDate ? String(updated.startDate) : null,
      dataFim: updated.endDate ? String(updated.endDate) : null,
      progresso: updated.progress ?? 0,
      applicationKey: updated.applicationKey ?? null,
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
    return c.json({ error: error.message, stage }, error.status || 500);
  }
});

// ─── GET tarefa individual ────────────────────────────────────────────────────
workspace.get("/api/workspace/tarefas/:id", async (c) => {
  try {
    const { id } = c.req.param() as { id: string };
    const db = c.get("db");
    const storage = getStorage(db);

    const [card] = await db
      .select()
      .from(kanbanCards)
      .where(eq(kanbanCards.id, id))
      .limit(1);

    if (!card) return c.json({ error: "Tarefa não encontrada" }, 404);

    const [projeto] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, card.projectId))
      .limit(1);

    const allUsers = await storage.getUsers();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const resp = card.assigneeId ? userMap.get(card.assigneeId) : null;
    const respNome = resp?.name || "Não atribuído";
    const respInitials = respNome.split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join("");

    const kanbanStatusToPtBrLocal: Record<string, string> = {
      todo: "a-fazer", doing: "em-andamento", done: "concluido", blocked: "bloqueado",
    };

    const rawAtt = card.attachments || [];
    const anexos = rawAtt.map((url: string, i: number) => ({ name: `Anexo ${i + 1}`, url }));

    return c.json({
      id: card.id,
      codigo: card.code,
      titulo: card.title,
      descricao: card.objectives || null,
      status: kanbanStatusToPtBrLocal[card.status] || card.status,
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
    return c.json({ error: error.message }, error.status || 500);
  }
});

// ─── GET subtarefas ───────────────────────────────────────────────────────────
workspace.get("/api/workspace/tarefas/:id/subtarefas", async (c) => {
  try {
    const { id } = c.req.param() as { id: string };
    const db = c.get("db");
    const rows = await db
      .select()
      .from(kanbanCards)
      .where(eq(kanbanCards.parentCardId, id))
      .orderBy(kanbanCards.order, kanbanCards.createdAt);
    return c.json({
      subtarefas: rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        done: r.status === "done",
      })),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
});

// ─── POST subtarefa ───────────────────────────────────────────────────────────
workspace.post("/api/workspace/tarefas/:id/subtarefas", async (c) => {
  try {
    const { id } = c.req.param() as { id: string };
    const { title } = await c.req.json();
    const t = (title || "").trim();
    if (!t) return c.json({ error: "Título obrigatório" }, 400);
    const db = c.get("db");

    const [parent] = await db
      .select()
      .from(kanbanCards)
      .where(eq(kanbanCards.id, id))
      .limit(1);
    if (!parent) return c.json({ error: "Tarefa pai não encontrada" }, 404);

    const existing = await db
      .select({ id: kanbanCards.id })
      .from(kanbanCards)
      .where(eq(kanbanCards.parentCardId, parent.id));
    const code = `${parent.code || parent.id.slice(0, 6)}·S${existing.length + 1}`;

    const [created] = await db
      .insert(kanbanCards)
      .values({
        code,
        projectId: parent.projectId,
        columnId: parent.columnId,
        parentCardId: parent.id,
        title: t,
        status: "todo",
        priority: "normal",
      })
      .returning();
    return c.json({
      id: created.id,
      title: created.title,
      done: created.status === "done",
    }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
});

// ─── PATCH subtarefa ──────────────────────────────────────────────────────────
workspace.patch("/api/workspace/subtarefas/:subtaskId", async (c) => {
  try {
    const { subtaskId } = c.req.param() as { subtaskId: string };
    const { done, title } = await c.req.json();
    const db = c.get("db");

    const updateData: Record<string, any> = {};
    if (done !== undefined) updateData.status = done ? "done" : "todo";
    if (title !== undefined) updateData.title = String(title).trim();
    if (Object.keys(updateData).length === 0) {
      return c.json({ error: "Nenhum campo para atualizar" }, 400);
    }

    const [updated] = await db
      .update(kanbanCards)
      .set(updateData)
      .where(eq(kanbanCards.id, subtaskId))
      .returning();
    if (!updated) return c.json({ error: "Subtarefa não encontrada" }, 404);

    return c.json({
      id: updated.id,
      title: updated.title,
      done: updated.status === "done",
    });
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
});

// ─── DELETE subtarefa ─────────────────────────────────────────────────────────
workspace.delete("/api/workspace/subtarefas/:subtaskId", async (c) => {
  try {
    const { subtaskId } = c.req.param() as { subtaskId: string };
    const db = c.get("db");
    const [deleted] = await db
      .delete(kanbanCards)
      .where(eq(kanbanCards.id, subtaskId))
      .returning({ id: kanbanCards.id });
    if (!deleted) return c.json({ error: "Subtarefa não encontrada" }, 404);
    return c.json({ ok: true });
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
});

// ─── DELETE tarefa ────────────────────────────────────────────────────────────
workspace.delete("/api/workspace/tarefas/:id", async (c) => {
  try {
    const { id } = c.req.param() as { id: string };
    const db = c.get("db");

    const [deleted] = await db
      .delete(kanbanCards)
      .where(eq(kanbanCards.id, id))
      .returning({ id: kanbanCards.id });

    if (!deleted) return c.json({ error: "Tarefa não encontrada" }, 404);

    return c.json({ ok: true });
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
});

// ─── GET comentarios de tarefa ────────────────────────────────────────────────
workspace.get("/api/workspace/tarefas/:id/comentarios", async (c) => {
  try {
    const { id } = c.req.param() as { id: string };
    const db = c.get("db");
    const storage = getStorage(db);

    const comentarios = await db
      .select()
      .from(kanbanComments)
      .where(eq(kanbanComments.cardId, id))
      .orderBy(kanbanComments.createdAt);

    const allUsers = await storage.getUsers();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    const items = comentarios.map((row: any) => {
      const autor = userMap.get(row.userId);
      const autorNome = autor?.name || "Usuário";
      const autorInitials = autorNome.split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join("");
      return {
        id: row.id,
        texto: row.content,
        autorId: row.userId,
        autorNome,
        autorInitials,
        criadoEm: row.createdAt ? String(row.createdAt) : null,
      };
    });

    return c.json({ comentarios: items });
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
});

// ─── POST comentario em tarefa ────────────────────────────────────────────────
workspace.post("/api/workspace/tarefas/:id/comentarios", async (c) => {
  try {
    const { id } = c.req.param() as { id: string };
    const { userId } = c.get("user");
    const db = c.get("db");
    const storage = getStorage(db);
    const { texto } = await c.req.json();

    if (!texto?.trim()) {
      return c.json({ error: "Texto obrigatório" }, 400);
    }

    const sanitizedTexto = texto.trim();
    const [comentario] = await db
      .insert(kanbanComments)
      .values({
        cardId: id,
        userId,
        content: sanitizedTexto,
        mentions: extractMentions(sanitizedTexto),
      })
      .returning();

    const allUsers = await storage.getUsers();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const autor = userMap.get(comentario.userId);
    const autorNome = autor?.name || "Usuário";
    const autorInitials = autorNome.split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join("");

    return c.json({
      id: comentario.id,
      texto: comentario.content,
      autorId: comentario.userId,
      autorNome,
      autorInitials,
      criadoEm: comentario.createdAt ? String(comentario.createdAt) : null,
    }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
});

// ─── GET comentarios de chamado ───────────────────────────────────────────────
workspace.get("/api/workspace/chamados/:id/comentarios", async (c) => {
  try {
    const { id } = c.req.param() as { id: string };
    const db = c.get("db");
    const storage = getStorage(db);

    const comentarios = await db
      .select()
      .from(workspaceComentarios)
      .where(eq(workspaceComentarios.chamadoId, id))
      .orderBy(workspaceComentarios.criadoEm);

    const allUsers = await storage.getUsers();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    const items = comentarios.map((row) => {
      const autor = userMap.get(row.autorId);
      const autorNome = autor?.name || "Usuário";
      const autorInitials = autorNome.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
      return {
        id: row.id,
        texto: row.texto,
        autorId: row.autorId,
        autorNome,
        autorInitials,
        criadoEm: row.criadoEm ? String(row.criadoEm) : null,
      };
    });

    return c.json({ comentarios: items });
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
});

// ─── POST comentario em chamado ───────────────────────────────────────────────
workspace.post("/api/workspace/chamados/:id/comentarios", async (c) => {
  try {
    const { id } = c.req.param() as { id: string };
    const { userId } = c.get("user");
    const db = c.get("db");
    const storage = getStorage(db);
    const { texto } = await c.req.json();

    if (!texto?.trim()) {
      return c.json({ error: "Texto obrigatório" }, 400);
    }

    const sanitizedTexto = texto.trim();
    const mencionados = extractMentions(sanitizedTexto).map((m) => m.userId);
    const [comentario] = await db
      .insert(workspaceComentarios)
      .values({
        chamadoId: id,
        autorId: userId,
        texto: sanitizedTexto,
        mencionados,
      })
      .returning();

    const allUsers = await storage.getUsers();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const autor = userMap.get(comentario.autorId);
    const autorNome = autor?.name || "Usuário";
    const autorInitials = autorNome.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

    return c.json({
      id: comentario.id,
      texto: comentario.texto,
      autorId: comentario.autorId,
      autorNome,
      autorInitials,
      criadoEm: comentario.criadoEm ? String(comentario.criadoEm) : null,
    }, 201);
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
