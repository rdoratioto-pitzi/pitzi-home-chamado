/**
 * server/services/slack-templates.service.ts
 *
 * Templates de mensagens Slack (Block Kit) — funções puras, sem I/O.
 * Separa formatação visual da lógica de envio. Toda string visível no
 * Slack passa por aqui para garantir consistência.
 *
 * Hierarquia visual:
 *  - Mensagem-mãe: emoji + código + título em destaque + meta + botão
 *  - Reply na thread: linha curta com emoji + ação + ator
 *  - DM: card compacto com link direto
 */

import type { Ticket, Project, KanbanCard, User } from "../../shared/schema";
import type { SlackBlock } from "./slack.service";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fallback defensivo para `baseUrl`. Em runtime sempre deve vir um valor
 * concreto via `env.APP_URL`; este default só protege contra config faltando.
 */
const APP_BASE_URL_FALLBACK = "https://home.renovsmart.com.br";

export type EntityType = "chamado" | "projeto" | "atividade";

/**
 * Constrói URL canônica para uma entidade no Renov Home. Os paths refletem
 * as rotas reais do frontend (`client/src/App.tsx`):
 *  - chamado   → /chamados/<uuid>           (`pages/chamados/[id].tsx`)
 *  - projeto   → /projetos/<uuid>           (`pages/projetos/kanban.tsx`)
 *  - atividade → /projetos/<uuid>?card=<id> (kanban abre o card via query —
 *                forward-compat: hoje o `card=` é ignorado, mas links antigos
 *                continuarão válidos quando a abertura por query for ativada)
 *
 * IMPORTANTE: o argumento de identificação é o **UUID** da entidade (ticket.id,
 * project.id, kanbanCard.id). NÃO usar `code` (CHA-XXXX) — a rota não resolve.
 */
export function buildEntityUrl(
  entityType: EntityType,
  id: string,
  parentProjectId?: string,
  baseUrl: string = APP_BASE_URL_FALLBACK,
): string {
  const base = baseUrl.replace(/\/$/, "");
  switch (entityType) {
    case "chamado":
      return `${base}/chamados/${encodeURIComponent(id)}`;
    case "projeto":
      return `${base}/projetos/${encodeURIComponent(id)}`;
    case "atividade": {
      if (parentProjectId) {
        return `${base}/projetos/${encodeURIComponent(parentProjectId)}?card=${encodeURIComponent(id)}`;
      }
      // Sem projeto pai conhecido, cai numa rota inerte mas no domínio correto.
      return `${base}/projetos`;
    }
  }
}

/**
 * Retorna `"[DEV] "` quando o `baseUrl` aponta para ambiente dev/local —
 * usado para prefixar títulos de mensagens Slack e diferenciar visualmente
 * notificações de teste das de produção (canal único compartilhado).
 */
export function buildEnvPrefix(baseUrl: string | undefined): string {
  if (!baseUrl) return "";
  const lower = baseUrl.toLowerCase();
  if (lower.includes("home-dev") || lower.includes("localhost") || lower.includes("127.0.0.1")) {
    return "[DEV] ";
  }
  return "";
}

/**
 * Mapa prioridade → emoji (consistente entre chamados, projetos e atividades).
 * Prioridades vêm em formatos diferentes do banco:
 *  - Chamados: low | medium | high | critical (em inglês)
 *  - Projetos/atividades: baixa | media | alta | critica | urgente | muito_urgente | normal
 */
export function emojiPorPrioridade(prioridade: string | null | undefined): string {
  if (!prioridade) return "⚪";
  const p = prioridade.toLowerCase();
  if (["critica", "critical", "muito_urgente"].includes(p)) return "🚨";
  if (["alta", "high", "urgente"].includes(p)) return "🔥";
  if (["media", "medium", "normal"].includes(p)) return "🟡";
  if (["baixa", "low"].includes(p)) return "⚪";
  return "⚪";
}

/** Tradução de status ticket → label PT-BR para display. */
function statusChamadoLabel(status: string): string {
  const map: Record<string, string> = {
    open: "Aberto",
    in_progress: "Em andamento",
    blocked: "Bloqueado",
    resolved: "Resolvido",
    closed: "Fechado",
  };
  return map[status] || status;
}

/** Tradução de prioridade ticket (en) → PT-BR. */
function prioridadeChamadoLabel(p: string): string {
  const map: Record<string, string> = {
    low: "Baixa",
    medium: "Média",
    high: "Alta",
    critical: "Crítica",
  };
  return map[p] || p;
}

/** Sanitiza texto para Slack (escape básico de caracteres especiais). */
function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Trunca texto longo para Block Kit (Slack limita ~3000 chars por bloco). */
function truncate(text: string, max = 200): string {
  if (text.length <= max) return text;
  return text.substring(0, max - 1) + "…";
}

// ─────────────────────────────────────────────────────────────────────────────
// Block Kit builders — mensagens-mãe
// ─────────────────────────────────────────────────────────────────────────────

export type ChamadoCriadoInput = {
  chamado: Pick<Ticket, "id" | "code" | "title" | "category" | "type" | "priority">;
  autor: Pick<User, "name"> | null;
  baseUrl?: string;
};

/** Mensagem-mãe quando um novo chamado é aberto. */
export function buildChamadoCriadoBlocks(input: ChamadoCriadoInput): {
  text: string;
  blocks: SlackBlock[];
} {
  const { chamado, autor, baseUrl } = input;
  const url = buildEntityUrl("chamado", chamado.id, undefined, baseUrl);
  const emoji = emojiPorPrioridade(chamado.priority);
  const autorNome = autor?.name || "Usuário desconhecido";
  const envPrefix = buildEnvPrefix(baseUrl);

  const text = `${envPrefix}🎫 Novo chamado ${chamado.code}: ${chamado.title}`;

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${envPrefix}🎫 *Novo chamado: <${url}|${chamado.code}>*\n*${escapeMrkdwn(truncate(chamado.title, 150))}*`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Categoria: *${escapeMrkdwn(chamado.category || "-")}* · Tipo: *${escapeMrkdwn(chamado.type || "-")}* · Prioridade: ${emoji} *${prioridadeChamadoLabel(chamado.priority || "")}*`,
        },
        {
          type: "mrkdwn",
          text: `Aberto por *${escapeMrkdwn(autorNome)}*`,
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Ver no Renov Home", emoji: true },
          url,
          style: "primary",
        },
      ],
    },
  ];

  return { text, blocks };
}

export type ProjetoCriadoInput = {
  projeto: Pick<Project, "id" | "code" | "name" | "visibility" | "priority">;
  owner: Pick<User, "name"> | null;
  baseUrl?: string;
};

/** Mensagem-mãe quando um novo projeto é criado (apenas se shared/public). */
export function buildProjetoCriadoBlocks(input: ProjetoCriadoInput): {
  text: string;
  blocks: SlackBlock[];
} {
  const { projeto, owner, baseUrl } = input;
  const url = buildEntityUrl("projeto", projeto.id, undefined, baseUrl);
  const emoji = emojiPorPrioridade(projeto.priority);
  const ownerNome = owner?.name || "Sem owner";
  const envPrefix = buildEnvPrefix(baseUrl);

  const text = `${envPrefix}📋 Novo projeto ${projeto.code}: ${projeto.name}`;

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${envPrefix}📋 *Novo projeto: <${url}|${projeto.code}>*\n*${escapeMrkdwn(truncate(projeto.name, 150))}*`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Owner: *${escapeMrkdwn(ownerNome)}* · Prioridade: ${emoji} · Visibilidade: *${escapeMrkdwn(projeto.visibility)}*`,
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Abrir Kanban", emoji: true },
          url,
          style: "primary",
        },
      ],
    },
  ];

  return { text, blocks };
}

// ─────────────────────────────────────────────────────────────────────────────
// Block Kit builders — replies em thread
// ─────────────────────────────────────────────────────────────────────────────

export type AtividadeCriadaInput = {
  atividade: Pick<KanbanCard, "id" | "code" | "title" | "priority">;
  projeto: Pick<Project, "id" | "code">;
  responsavel: Pick<User, "name"> | null;
  baseUrl?: string;
};

/** Reply na thread do projeto pai quando uma nova atividade é criada. */
export function buildAtividadeCriadaBlocks(input: AtividadeCriadaInput): {
  text: string;
  blocks: SlackBlock[];
} {
  const { atividade, projeto, responsavel, baseUrl } = input;
  const url = buildEntityUrl("atividade", atividade.id, projeto.id, baseUrl);
  const emoji = emojiPorPrioridade(atividade.priority);
  const respNome = responsavel?.name || "Não atribuído";

  // Reply herda contexto da mensagem-mãe (já prefixada quando dev) — sem [DEV] aqui.
  const text = `➕ Nova atividade ${atividade.code}: ${atividade.title}`;

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `➕ Nova atividade: *<${url}|${atividade.code}>* — ${escapeMrkdwn(truncate(atividade.title, 150))}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Responsável: *${escapeMrkdwn(respNome)}* · Prioridade: ${emoji}`,
        },
      ],
    },
  ];

  return { text, blocks };
}

// ─────────────────────────────────────────────────────────────────────────────
// Replies/text simples (sem blocks)
// ─────────────────────────────────────────────────────────────────────────────

export function buildChamadoFechadoText(
  chamado: Pick<Ticket, "code">,
  fechadoPor: Pick<User, "name"> | null,
): string {
  const dataFmt = formatDateBR(new Date());
  const nome = fechadoPor?.name || "Usuário";
  return `✅ *${chamado.code}* fechado por *${escapeMrkdwn(nome)}* em ${dataFmt}`;
}

export function buildAtribuicaoText(
  entityCode: string,
  atribuido: Pick<User, "name">,
): string {
  return `🙋 *${entityCode}* atribuído a *${escapeMrkdwn(atribuido.name)}*`;
}

export function buildAtividadeMovidaText(
  atividade: Pick<KanbanCard, "code">,
  novoStatusPtBr: string,
): string {
  return `🔄 *${atividade.code}* movida para *${escapeMrkdwn(novoStatusPtBr)}*`;
}

export function buildAtividadeConcluidaText(
  atividade: Pick<KanbanCard, "code" | "title">,
): string {
  return `✅ Atividade concluída: *${atividade.code}* — ${escapeMrkdwn(truncate(atividade.title, 150))}`;
}

export function buildAlertaCriticoText(chamadoCode: string): string {
  // Usa <!here> para mencionar usuários online no canal sem spammar offline.
  return `<!here> ⚠️ Chamado *${chamadoCode}* aberto com prioridade *crítica* — atenção imediata`;
}

/** DM enviada ao responsável quando atribuído a um chamado. */
export function buildDmAtribuicaoChamado(input: {
  chamadoId: string;
  chamadoCode: string;
  titulo: string;
  baseUrl?: string;
}): { text: string; blocks: SlackBlock[] } {
  const url = buildEntityUrl("chamado", input.chamadoId, undefined, input.baseUrl);
  const envPrefix = buildEnvPrefix(input.baseUrl);
  const text = `${envPrefix}Você foi atribuído ao chamado ${input.chamadoCode}`;
  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${envPrefix}🙋 Você foi atribuído ao chamado *<${url}|${input.chamadoCode}>*\n${escapeMrkdwn(truncate(input.titulo, 200))}`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Abrir chamado", emoji: true },
          url,
          style: "primary",
        },
      ],
    },
  ];
  return { text, blocks };
}

/** DM enviada ao responsável de atividade urgente/muito-urgente. */
export function buildDmAtividadeUrgente(input: {
  atividadeId: string;
  atividadeCode: string;
  titulo: string;
  projetoId: string;
  baseUrl?: string;
}): { text: string; blocks: SlackBlock[] } {
  const url = buildEntityUrl("atividade", input.atividadeId, input.projetoId, input.baseUrl);
  const envPrefix = buildEnvPrefix(input.baseUrl);
  const text = `${envPrefix}Atividade urgente atribuída: ${input.atividadeCode}`;
  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${envPrefix}🔥 Atividade urgente: *<${url}|${input.atividadeCode}>*\n${escapeMrkdwn(truncate(input.titulo, 200))}`,
      },
    },
  ];
  return { text, blocks };
}

// ─────────────────────────────────────────────────────────────────────────────
// Date formatting (timezone America/Sao_Paulo)
// ─────────────────────────────────────────────────────────────────────────────

function formatDateBR(date: Date): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}
