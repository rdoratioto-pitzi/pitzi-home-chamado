import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";

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
}

type WorkspaceTableProps =
  | { variant?: "chamados"; items: ChamadoItem[]; loading?: boolean; onRowClick?: (item: ChamadoItem) => void }
  | { variant: "todos"; items: UnifiedItem[]; loading?: boolean; onRowClick?: (item: UnifiedItem) => void };

const statusDotColors: Record<string, { bg: string }> = {
  in_progress: { bg: "#00c853" },
  resolved: { bg: "#4ade80" },
  closed: { bg: "#4ade80" },
  open: { bg: "#f59e0b" },
  blocked: { bg: "#ef4444" },
  // tarefa statuses
  "a-fazer": { bg: "#f59e0b" },
  "em-andamento": { bg: "#00c853" },
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
          border: "1.5px solid rgba(255,255,255,0.2)",
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

function GroupHeader({ status, count }: { status: string; count: number }) {
  const dotStyle = statusDotColors[status];
  return (
    <div
      className="flex items-center gap-2 px-4 py-2"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
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
            border: "1.5px solid rgba(255,255,255,0.2)",
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
          color: "rgba(255,255,255,0.5)",
        }}
      >
        {statusGroupLabels[status] || status}
      </span>
      <span
        className="text-xs px-1.5 py-0.5 rounded-full"
        style={{
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.4)",
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
  from { background-color: rgba(255,255,255,0.04); }
  to   { background-color: rgba(255,255,255,0.08); }
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

const COL_TEMPLATE = "96px 1fr 175px 140px 115px 110px 62px 98px 30px";
const COL_TEMPLATE_MOBILE = "96px 1fr 175px 140px 115px 110px 30px";

const responsiveStyles = `
@media (max-width: 767px) {
  .ws-col-sla { display: none !important; }
  .ws-table-row { grid-template-columns: ${COL_TEMPLATE_MOBILE} !important; }
}
`;

export function WorkspaceTable(props: WorkspaceTableProps) {
  const { items, loading } = props;
  const variant = props.variant ?? "chamados";
  const onRowClick = "onRowClick" in props ? props.onRowClick : undefined;

  const col3Header = variant === "todos" ? "Tipo / Contexto" : "Categoria / Tipo";
  const headers = ["Código", "Título", col3Header, "Responsável", "Status", "Prioridade", "SLA", "Status SLA", ""];

  if (loading) {
    return (
      <div style={{ overflowX: "auto" }}>
        <style>{responsiveStyles}</style>
        <div style={{ minWidth: 900 }}>
          <HeaderRow headers={headers} />
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

  return (
    <div style={{ overflowX: "auto" }}>
      <style>{responsiveStyles}</style>
      <div style={{ minWidth: 900 }}>
        <HeaderRow headers={headers} />
        {statusGroupOrder.map((status) => {
          const groupItems = grouped.get(status) || [];
          if (groupItems.length === 0) return null;
          return (
            <div key={status}>
              <GroupHeader status={status} count={groupItems.length} />
              {groupItems.map((item) =>
                variant === "todos" ? (
                  <UnifiedItemRow
                    key={item.id}
                    item={item as UnifiedItem}
                    onRowClick={onRowClick as ((item: UnifiedItem) => void) | undefined}
                  />
                ) : (
                  <ChamadoItemRow
                    key={(item as ChamadoItem).id}
                    item={item as ChamadoItem}
                    onRowClick={onRowClick as ((item: ChamadoItem) => void) | undefined}
                  />
                ),
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeaderRow({ headers }: { headers: string[] }) {
  return (
    <div
      className="ws-table-row grid items-center px-4 py-2 gap-2"
      style={{
        gridTemplateColumns: COL_TEMPLATE,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {headers.map((h, i) => (
        <span
          key={i}
          className={i === 6 || i === 7 ? "ws-col-sla" : undefined}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: "uppercase",
            fontSize: "9px",
            letterSpacing: "0.05em",
            color: "rgba(255,255,255,0.25)",
          }}
        >
          {h}
        </span>
      ))}
    </div>
  );
}

function ChamadoItemRow({ item, onRowClick }: { item: ChamadoItem; onRowClick?: (item: ChamadoItem) => void }) {
  const typeColor = typeColors[item.tipo?.toLowerCase()] || "bg-slate-500/10 text-slate-400";
  const prioColor = priorityColors[item.prioridade] || priorityColors.medium;

  return (
    <div
      className="ws-table-row group grid items-center px-4 py-2.5 gap-2 transition-colors cursor-pointer"
      onClick={() => onRowClick?.(item)}
      style={{
        gridTemplateColumns: COL_TEMPLATE,
        borderBottom: "1px solid rgba(255,255,255,0.03)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#141814")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div className="flex items-center gap-2 min-w-0">
        <StatusDot status={item.status} />
        <span className="text-xs text-muted-foreground truncate" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {item.codigo}
        </span>
      </div>
      <span className="text-sm truncate" style={{ color: "rgba(255,255,255,0.85)" }}>
        {item.titulo}
      </span>
      <div className="flex items-center gap-1.5 min-w-0 truncate">
        <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
          {item.categoria}
        </span>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${typeColor}`}>
          {item.tipo}
        </Badge>
      </div>
      <ResponsavelCell initials={item.responsavelInitials} name={item.responsavel} />
      <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
        {statusLabels[item.status] || item.status}
      </span>
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${prioColor}`}>
        {priorityLabels[item.prioridade] || item.prioridade}
      </Badge>
      <span className="ws-col-sla text-xs text-muted-foreground">
        {item.sla ? `${item.sla}h` : "—"}
      </span>
      <SlaStatusCell statusSla={item.statusSla} className="ws-col-sla" />
      <ActionsMenu />
    </div>
  );
}

function UnifiedItemRow({ item, onRowClick }: { item: UnifiedItem; onRowClick?: (item: UnifiedItem) => void }) {
  const badgeColor = typeColors[item.badgeVariant] || "bg-slate-500/10 text-slate-400";
  const prioColor = priorityColors[item.prioridade] || priorityColors.media;

  const contextoColor =
    item.tipo === "tarefa" && item.corContexto
      ? `${item.corContexto}b3`
      : "rgba(255,255,255,0.5)";

  return (
    <div
      className="ws-table-row group grid items-center px-4 py-2.5 gap-2 transition-colors cursor-pointer"
      onClick={() => onRowClick?.(item)}
      style={{
        gridTemplateColumns: COL_TEMPLATE,
        borderBottom: "1px solid rgba(255,255,255,0.03)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#141814")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div className="flex items-center gap-2 min-w-0">
        <StatusDot status={item.status} />
        <span className="text-xs text-muted-foreground truncate" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {item.codigo}
        </span>
      </div>
      <span className="text-sm truncate" style={{ color: "rgba(255,255,255,0.85)" }}>
        {item.titulo}
      </span>
      <div className="flex items-center gap-1.5 min-w-0 truncate">
        <span className="text-xs truncate" style={{ color: contextoColor }}>
          {item.contexto}
        </span>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${badgeColor}`}>
          {item.badgeLabel}
        </Badge>
      </div>
      <ResponsavelCell initials={item.responsavelInitials} name={item.responsavel} />
      <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
        {statusLabels[item.status] || item.status}
      </span>
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${prioColor}`}>
        {priorityLabels[item.prioridade] || item.prioridade}
      </Badge>
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
          background: "rgba(0,200,83,0.15)",
          color: "#00c853",
        }}
      >
        {initials}
      </div>
      {displayName && (
        <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
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
            ? "#00c853"
            : statusSla === "em_atraso"
              ? "#ff5050"
              : "rgba(255,255,255,0.2)",
      }}
    >
      {statusSla === "dentro_prazo" ? "No Prazo" : statusSla === "em_atraso" ? "Em Atraso" : "—"}
    </span>
  );
}

function ActionsMenu() {
  return (
    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-1 rounded hover:bg-white/5">
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <Edit className="h-3.5 w-3.5 mr-2" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem className="text-red-400">
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
