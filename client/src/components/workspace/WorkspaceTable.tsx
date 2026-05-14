import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { getApplicationLabel } from "@shared/applications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, ChevronRight } from "lucide-react";
import {
  statusOptionsForKind,
  priorityOptionsForKind,
  type ItemKind,
} from "@/lib/workspace-status";

export interface ChamadoItem {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string;
  categoria: string;
  tipo: string;
  responsavel: string;
  responsavelInitials: string;
  status: string;
  prioridade: string;
  sla: number | null;
  statusSla: "dentro_prazo" | "em_atraso" | null;
  abertura: string | null;
  solicitante: string | null;
  applicationKey: string | null;
  anexos: Array<{ name: string; url: string }>;
}

export interface UnifiedItem {
  tipo: "chamado" | "tarefa";
  id: string;
  codigo: string;
  titulo: string;
  contexto: string;
  corContexto: string | null;
  badgeLabel: string;
  badgeVariant: string;
  responsavel: string;
  responsavelInitials: string;
  status: string;
  prioridade: string;
  sla: number | null;
  statusSla: "dentro_prazo" | "em_atraso" | null;
  criadoEm: string | null;
  descricao?: string | null;
  progresso?: number | null;
  sprint?: string | null;
  dataEntrega?: string | null;
  applicationKey?: string | null;
  anexos?: Array<{ name: string; url: string }>;
}

type WorkspaceTableProps =
  | {
      variant?: "chamados";
      items: ChamadoItem[];
      loading?: boolean;
      onRowClick?: (item: ChamadoItem) => void;
      onDelete?: (item: ChamadoItem) => void;
      onStatusChange?: (item: ChamadoItem, newStatus: string) => void;
      onPriorityChange?: (item: ChamadoItem, newPriority: string) => void;
    }
  | {
      variant: "todos";
      items: UnifiedItem[];
      loading?: boolean;
      onRowClick?: (item: UnifiedItem) => void;
      onDelete?: (item: ChamadoItem) => void;
      onStatusChange?: (item: UnifiedItem, newStatus: string) => void;
      onPriorityChange?: (item: UnifiedItem, newPriority: string) => void;
    };

const statusDotColors: Record<string, { bg: string }> = {
  in_progress: { bg: "#5B62EC" },
  resolved: { bg: "#4ade80" },
  closed: { bg: "#4ade80" },
  open: { bg: "#f59e0b" },
  blocked: { bg: "#ef4444" },
  // tarefa statuses
  "a-fazer": { bg: "#f59e0b" },
  "em-andamento": { bg: "#5B62EC" },
  concluido: { bg: "#4ade80" },
  cancelado: { bg: "#ef4444" },
};

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Andamento",
  blocked: "Bloqueado",
  resolved: "Resolvido",
  closed: "Fechado",
  "a-fazer": "A Fazer",
  "em-andamento": "Em Andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

// Normalize status to a group key
const toGroup = (status: string): string => {
  if (status === "em-andamento") return "in_progress";
  if (status === "a-fazer") return "open";
  if (status === "concluido" || status === "cancelado") return "resolved";
  if (status === "closed") return "resolved";
  return status;
};

const statusGroupOrder = ["in_progress", "open", "blocked", "resolved"] as const;

const statusGroupLabels: Record<string, string> = {
  in_progress: "Em Andamento",
  open: "Abertos",
  blocked: "Em Atraso",
  resolved: "Resolvidos",
};

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-500/10 text-slate-400 border-slate-700",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-700",
  high: "bg-orange-500/10 text-orange-400 border-orange-700",
  critical: "bg-red-500/10 text-red-400 border-red-700",
  baixa: "bg-slate-500/10 text-slate-400 border-slate-700",
  media: "bg-yellow-500/10 text-yellow-400 border-yellow-700",
  alta: "bg-orange-500/10 text-orange-400 border-orange-700",
};

const typeColors: Record<string, string> = {
  bug: "bg-red-500/10 text-red-400",
  melhoria: "bg-blue-500/10 text-blue-400",
  negocio: "bg-purple-500/10 text-purple-400",
  tarefa: "bg-teal-500/10 text-teal-400",
};

function StatusDot({ status }: { status: string }) {
  const style = statusDotColors[status];
  if (!style) {
    return (
      <span
        className="inline-block flex-shrink-0"
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          border: "1.5px solid var(--l4)",
        }}
      />
    );
  }
  return (
    <span
      className="inline-block flex-shrink-0"
      style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: style.bg,
      }}
    />
  );
}

function GroupHeader({
  status,
  count,
  collapsed,
  onToggle,
}: {
  status: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const dotStyle = statusDotColors[status];
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 cursor-pointer select-none"
      style={{ background: "var(--bg3)" }}
      onClick={onToggle}
    >
      <ChevronRight
        size={14}
        className="transition-transform duration-200 flex-shrink-0"
        style={{
          color: "var(--l3)",
          transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
        }}
      />
      {dotStyle ? (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: dotStyle.bg,
            display: "inline-block",
          }}
        />
      ) : (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            border: "1.5px solid var(--l4)",
            display: "inline-block",
          }}
        />
      )}
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          textTransform: "uppercase",
          fontSize: "10px",
          letterSpacing: "0.05em",
          color: "var(--l1)",
        }}
      >
        {statusGroupLabels[status] || status}
      </span>
      <span
        className="text-xs px-1.5 py-0.5 rounded-full"
        style={{
          background: "var(--bg4)",
          color: "#5B62EC",
          fontSize: "10px",
        }}
      >
        {count}
      </span>
    </div>
  );
}

const skeletonKeyframes = `
@keyframes ws-skeleton-pulse {
  from { background-color: var(--l4); }
  to   { background-color: var(--l3); }
}
`;

function SkeletonCell({ width, height = 14, rounded }: { width: number; height?: number; rounded?: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width,
        height,
        borderRadius: rounded ? "50%" : 4,
        animation: "ws-skeleton-pulse 1.5s ease-in-out infinite alternate",
      }}
    />
  );
}

function SkeletonRows({ colTemplate }: { colTemplate: string }) {
  return (
    <>
      <style>{skeletonKeyframes}</style>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="ws-table-row grid items-center px-4 py-3 gap-2"
          style={{ gridTemplateColumns: colTemplate }}
        >
          <SkeletonCell width={64} />
          <SkeletonCell width={160} />
          <SkeletonCell width={128} />
          <SkeletonCell width={100} />
          <SkeletonCell width={20} height={20} rounded />
          <SkeletonCell width={80} />
          <SkeletonCell width={64} />
          <span className="ws-col-sla"><SkeletonCell width={32} /></span>
          <span className="ws-col-sla"><SkeletonCell width={64} /></span>
          <div />
        </div>
      ))}
    </>
  );
}

const COL_TEMPLATE_CHAMADOS = "96px 1fr 220px 140px 140px 115px 85px 62px 78px 30px";
const COL_TEMPLATE_TODOS = "96px 1fr 175px 220px 140px 140px 115px 85px 62px 78px 30px";
const COL_TEMPLATE_CHAMADOS_MOBILE = "96px 1fr 220px 140px 140px 115px 85px 30px";
const COL_TEMPLATE_TODOS_MOBILE = "96px 1fr 175px 220px 140px 140px 115px 85px 30px";

const responsiveStyles = `
@media (max-width: 767px) {
  .ws-col-sla { display: none !important; }
  .ws-table-chamados .ws-table-row { grid-template-columns: ${COL_TEMPLATE_CHAMADOS_MOBILE} !important; }
  .ws-table-todos .ws-table-row { grid-template-columns: ${COL_TEMPLATE_TODOS_MOBILE} !important; }
}
`;

export function WorkspaceTable(props: WorkspaceTableProps) {
  const { items, loading } = props;
  const variant = props.variant ?? "chamados";
  const onRowClick = "onRowClick" in props ? props.onRowClick : undefined;
  const onDelete = "onDelete" in props ? props.onDelete : undefined;
  const onStatusChange = "onStatusChange" in props ? props.onStatusChange : undefined;
  const onPriorityChange = "onPriorityChange" in props ? props.onPriorityChange : undefined;

  const COL_TEMPLATE = variant === "todos" ? COL_TEMPLATE_TODOS : COL_TEMPLATE_CHAMADOS;
  const headers = variant === "todos"
    ? ["Código", "Título", "Projeto", "Tipo / Contexto", "Aplicação", "Responsável", "Status", "Prioridade", "SLA", "Status SLA", ""]
    : ["Código", "Título", "Categoria / Tipo", "Aplicação", "Responsável", "Status", "Prioridade", "SLA", "Status SLA", ""];
  const tableClass = variant === "todos" ? "ws-table-todos" : "ws-table-chamados";
  const slaCol1Idx = variant === "todos" ? 8 : 7;
  const slaCol2Idx = variant === "todos" ? 9 : 8;

  if (loading) {
    return (
      <div className={tableClass} style={{ overflowX: "auto" }}>
        <style>{responsiveStyles}</style>
        <div style={{ minWidth: 900 }}>
          <HeaderRow headers={headers} colTemplate={COL_TEMPLATE} slaCol1Idx={slaCol1Idx} slaCol2Idx={slaCol2Idx} />
          <SkeletonRows colTemplate={COL_TEMPLATE} />
        </div>
      </div>
    );
  }

  // Group items by normalized status
  const grouped = new Map<string, (ChamadoItem | UnifiedItem)[]>();
  for (const status of statusGroupOrder) {
    grouped.set(status, []);
  }
  for (const item of items) {
    const rawStatus = variant === "todos"
      ? (item as UnifiedItem).status
      : (item as ChamadoItem).status;
    const group = toGroup(rawStatus);
    const bucket = grouped.get(group);
    if (bucket) {
      bucket.push(item);
    } else {
      grouped.get("open")?.push(item);
    }
  }

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  return (
    <div className={tableClass} style={{ overflowX: "auto" }}>
      <style>{responsiveStyles}</style>
      <div style={{ minWidth: 900 }}>
        <HeaderRow headers={headers} colTemplate={COL_TEMPLATE} slaCol1Idx={slaCol1Idx} slaCol2Idx={slaCol2Idx} />
        {statusGroupOrder.map((status) => {
          const groupItems = grouped.get(status) || [];
          if (groupItems.length === 0) return null;
          const isCollapsed = collapsedGroups.has(status);
          return (
            <div key={status}>
              <GroupHeader
                status={status}
                count={groupItems.length}
                collapsed={isCollapsed}
                onToggle={() => toggleGroup(status)}
              />
              {!isCollapsed && (
                <>
                  {groupItems.map((item) =>
                    variant === "todos" ? (
                      <UnifiedItemRow
                        key={item.id}
                        item={item as UnifiedItem}
                        colTemplate={COL_TEMPLATE}
                        onRowClick={onRowClick as ((item: UnifiedItem) => void) | undefined}
                        onStatusChange={onStatusChange as ((item: UnifiedItem, s: string) => void) | undefined}
                        onPriorityChange={onPriorityChange as ((item: UnifiedItem, p: string) => void) | undefined}
                      />
                    ) : (
                      <ChamadoItemRow
                        key={(item as ChamadoItem).id}
                        item={item as ChamadoItem}
                        colTemplate={COL_TEMPLATE}
                        onRowClick={onRowClick as ((item: ChamadoItem) => void) | undefined}
                        onDelete={onDelete}
                        onStatusChange={onStatusChange as ((item: ChamadoItem, s: string) => void) | undefined}
                        onPriorityChange={onPriorityChange as ((item: ChamadoItem, p: string) => void) | undefined}
                      />
                    ),
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeaderRow({ headers, colTemplate, slaCol1Idx, slaCol2Idx }: { headers: string[]; colTemplate: string; slaCol1Idx: number; slaCol2Idx: number }) {
  return (
    <div
      className="ws-table-row grid items-center px-4 py-2 gap-2"
      style={{
        gridTemplateColumns: colTemplate,
        borderBottom: "1px solid var(--sep)",
      }}
    >
      {headers.map((h, i) => (
        <span
          key={i}
          className={i === slaCol1Idx || i === slaCol2Idx ? "ws-col-sla" : undefined}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: "uppercase",
            fontSize: "9px",
            letterSpacing: "0.05em",
            color: "var(--l3)",
          }}
        >
          {h}
        </span>
      ))}
    </div>
  );
}

function InlineSelectChip({
  value,
  options,
  onChange,
  className,
  emptyLabel,
}: {
  value: string;
  options: readonly { value: string; label: string }[];
  onChange?: (next: string) => void;
  className?: string;
  emptyLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const label = options.find((o) => o.value === value)?.label ?? value ?? emptyLabel ?? "—";

  if (!onChange) {
    return (
      <span className={className}>
        {label}
      </span>
    );
  }

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={value}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          e.stopPropagation();
          const v = e.target.value;
          if (v && v !== value) onChange(v);
          setEditing(false);
        }}
        onBlur={() => setEditing(false)}
        className="text-xs rounded px-1 py-0 outline-none"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(59,66,222,0.3)",
          color: "rgba(255,255,255,0.85)",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className={`${className ?? ""} hover:bg-white/5 rounded px-1 -mx-1 cursor-pointer text-left`}
    >
      {label}
    </button>
  );
}

function ChamadoItemRow({ item, colTemplate, onRowClick, onDelete, onStatusChange, onPriorityChange }: {
  item: ChamadoItem;
  colTemplate: string;
  onRowClick?: (item: ChamadoItem) => void;
  onDelete?: (item: ChamadoItem) => void;
  onStatusChange?: (item: ChamadoItem, s: string) => void;
  onPriorityChange?: (item: ChamadoItem, p: string) => void;
}) {
  const typeColor = typeColors[item.tipo?.toLowerCase()] || "bg-slate-500/10 text-slate-400";
  const prioColor = priorityColors[item.prioridade] || priorityColors.medium;

  return (
    <div
      className="ws-table-row group grid items-center px-4 py-2.5 gap-2 transition-colors cursor-pointer"
      onClick={() => onRowClick?.(item)}
      style={{
        gridTemplateColumns: colTemplate,
        borderBottom: "1px solid var(--sep)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg3)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div className="flex items-center gap-2 min-w-0">
        <StatusDot status={item.status} />
        <span className="text-xs text-muted-foreground truncate" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {item.codigo}
        </span>
      </div>
      <span className="text-sm truncate" style={{ color: "var(--l1)" }}>
        {item.titulo}
      </span>
      <div className="flex items-center gap-1.5 min-w-0 truncate">
        <span className="text-xs truncate" style={{ color: "var(--l2)" }}>
          {item.categoria}
        </span>
        <span style={{ color: "var(--l4)" }}>·</span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${typeColor}`}>
          {item.tipo}
        </Badge>
      </div>
      <span
        className="text-xs truncate"
        style={{ color: item.applicationKey ? "var(--l2)" : "var(--l4)" }}
        title={getApplicationLabel(item.applicationKey)}
      >
        {getApplicationLabel(item.applicationKey)}
      </span>
      <ResponsavelCell initials={item.responsavelInitials} name={item.responsavel} />
      <InlineSelectChip
        value={item.status}
        options={statusOptionsForKind("chamado")}
        onChange={onStatusChange ? (next) => onStatusChange(item, next) : undefined}
        className="text-xs"
      />
      {onPriorityChange ? (
        <InlineSelectChip
          value={item.prioridade}
          options={priorityOptionsForKind("chamado")}
          onChange={(next) => onPriorityChange(item, next)}
          className={`text-[10px] px-1.5 py-0 rounded border ${prioColor}`}
        />
      ) : (
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${prioColor}`}>
          {priorityLabels[item.prioridade] || item.prioridade}
        </Badge>
      )}
      <span className="ws-col-sla text-xs text-muted-foreground">
        {item.sla ? `${item.sla}h` : "—"}
      </span>
      <SlaStatusCell statusSla={item.statusSla} className="ws-col-sla" />
      <ActionsMenu
        onEdit={() => { window.location.href = `/chamados/${item.id}`; }}
        onDelete={onDelete ? () => onDelete(item) : undefined}
      />
    </div>
  );
}

function UnifiedItemRow({ item, colTemplate, onRowClick, onStatusChange, onPriorityChange }: {
  item: UnifiedItem;
  colTemplate: string;
  onRowClick?: (item: UnifiedItem) => void;
  onStatusChange?: (item: UnifiedItem, s: string) => void;
  onPriorityChange?: (item: UnifiedItem, p: string) => void;
}) {
  const kind: ItemKind = item.tipo === "chamado" ? "chamado" : "tarefa";
  const badgeColor = typeColors[item.badgeVariant] || "bg-slate-500/10 text-slate-400";
  const prioColor = priorityColors[item.prioridade] || priorityColors.media;

  const contextoColor =
    item.tipo === "tarefa" && item.corContexto
      ? `${item.corContexto}b3`
      : "var(--l2)";

  return (
    <div
      className="ws-table-row group grid items-center px-4 py-2.5 gap-2 transition-colors cursor-pointer"
      onClick={() => onRowClick?.(item)}
      style={{
        gridTemplateColumns: colTemplate,
        borderBottom: "1px solid var(--sep)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg3)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div className="flex items-center gap-2 min-w-0">
        <StatusDot status={item.status} />
        <span className="text-xs text-muted-foreground truncate" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {item.codigo}
        </span>
      </div>
      <span className="text-sm truncate" style={{ color: "var(--l1)" }}>
        {item.titulo}
      </span>
      {/* Projeto: tarefa = nome do projeto + bolinha cor; chamado = "—" */}
      <div className="flex items-center gap-1.5 min-w-0 truncate" title={item.tipo === "tarefa" ? item.contexto : undefined}>
        {item.tipo === "tarefa" ? (
          <>
            <span
              className="inline-block flex-shrink-0"
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: item.corContexto || "rgba(255,255,255,0.3)",
              }}
            />
            <span className="text-xs truncate" style={{ color: item.corContexto || "var(--l2)", opacity: 0.85 }}>
              {item.contexto || "—"}
            </span>
          </>
        ) : (
          <span className="text-xs" style={{ color: "var(--l4)" }}>—</span>
        )}
      </div>
      {/* Tipo / Contexto: tarefa = badge; chamado = categoria + badge tipo */}
      <div className="flex items-center gap-1.5 min-w-0 truncate">
        {item.tipo === "chamado" ? (
          <>
            <span className="text-xs truncate" style={{ color: contextoColor }}>
              {item.contexto}
            </span>
            <span style={{ color: "var(--l4)" }}>·</span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${badgeColor}`}>
              {item.badgeLabel}
            </Badge>
          </>
        ) : (
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${badgeColor}`}>
            {item.badgeLabel}
          </Badge>
        )}
      </div>
      <span
        className="text-xs truncate"
        style={{ color: item.applicationKey ? "var(--l2)" : "var(--l4)" }}
        title={getApplicationLabel(item.applicationKey)}
      >
        {getApplicationLabel(item.applicationKey)}
      </span>
      <ResponsavelCell initials={item.responsavelInitials} name={item.responsavel} />
      <InlineSelectChip
        value={item.status}
        options={statusOptionsForKind(kind)}
        onChange={onStatusChange ? (next) => onStatusChange(item, next) : undefined}
        className="text-xs"
      />
      {onPriorityChange ? (
        <InlineSelectChip
          value={item.prioridade}
          options={priorityOptionsForKind(kind)}
          onChange={(next) => onPriorityChange(item, next)}
          className={`text-[10px] px-1.5 py-0 rounded border ${prioColor}`}
        />
      ) : (
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${prioColor}`}>
          {priorityLabels[item.prioridade] || item.prioridade}
        </Badge>
      )}
      <span className="ws-col-sla text-xs text-muted-foreground">
        {item.sla ? `${item.sla}h` : "—"}
      </span>
      <SlaStatusCell statusSla={item.statusSla} className="ws-col-sla" />
      <ActionsMenu />
    </div>

  );
}

function ResponsavelCell({ initials, name }: { initials: string; name: string }) {
  const displayName = name && name !== "Não atribuído" ? name : null;
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div
        className="flex items-center justify-center flex-shrink-0 rounded-full text-[10px] font-semibold"
        style={{
          width: 22,
          height: 22,
          background: "rgba(59,66,222,0.15)",
          color: "#5B62EC",
        }}
      >
        {initials}
      </div>
      {displayName && (
        <span className="text-xs truncate" style={{ color: "var(--l2)" }}>
          {displayName}
        </span>
      )}
    </div>
  );
}

function SlaStatusCell({ statusSla, className }: { statusSla: "dentro_prazo" | "em_atraso" | null; className?: string }) {
  return (
    <span
      className={`text-xs font-medium${className ? ` ${className}` : ""}`}
      style={{
        color:
          statusSla === "dentro_prazo"
            ? "#5B62EC"
            : statusSla === "em_atraso"
              ? "#ff5050"
              : "var(--l4)",
      }}
    >
      {statusSla === "dentro_prazo" ? "No Prazo" : statusSla === "em_atraso" ? "Em Atraso" : "—"}
    </span>
  );
}

function ActionsMenu({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-1 rounded hover:bg-muted/60">
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>
            <Edit className="h-3.5 w-3.5 mr-2" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem className="text-red-400" onClick={(e) => { e.stopPropagation(); onDelete?.(); }}>
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
