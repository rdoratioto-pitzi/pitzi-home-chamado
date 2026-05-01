import type { ChamadoItem, UnifiedItem } from "./WorkspaceTable";
import { Badge } from "@/components/ui/badge";

interface KanbanViewProps {
  items: (ChamadoItem | UnifiedItem)[];
  variant?: "chamados" | "todos";
  onStatusChange?: (itemId: string, newStatus: string) => void;
  onItemClick?: (item: ChamadoItem | UnifiedItem) => void;
}

interface KanbanColumn {
  key: string;
  label: string;
  dotColor: string;
  statuses: string[];
}

const COLUMNS: KanbanColumn[] = [
  {
    key: "abertos",
    label: "Abertos / A Fazer",
    dotColor: "#f59e0b",
    statuses: ["open", "a-fazer"],
  },
  {
    key: "em_andamento",
    label: "Em Andamento",
    dotColor: "#00c853",
    statuses: ["in_progress", "em-andamento"],
  },
  {
    key: "bloqueados",
    label: "Bloqueados",
    dotColor: "#ef4444",
    statuses: ["blocked", "bloqueado"],
  },
  {
    key: "resolvidos",
    label: "Resolvidos",
    dotColor: "#4ade80",
    statuses: ["resolved", "closed", "concluido"],
  },
];

const typeColors: Record<string, string> = {
  bug: "bg-red-500/10 text-red-400",
  melhoria: "bg-blue-500/10 text-blue-400",
  negocio: "bg-purple-500/10 text-purple-400",
  tarefa: "bg-teal-500/10 text-teal-400",
};

function getItemDate(item: ChamadoItem | UnifiedItem): string {
  const raw = "abertura" in item && (item as ChamadoItem).abertura != null
    ? (item as ChamadoItem).abertura
    : "criadoEm" in item
    ? (item as UnifiedItem).criadoEm
    : null;
  if (!raw) return "—";
  return new Date(raw).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function getItemTipoBadge(item: ChamadoItem | UnifiedItem): { label: string; colorClass: string } | null {
  if ("badgeLabel" in item) {
    const ui = item as UnifiedItem;
    const colorClass = typeColors[ui.badgeVariant] ?? "bg-slate-500/10 text-slate-400";
    return { label: ui.badgeLabel, colorClass };
  }
  if ("tipo" in item) {
    const ch = item as ChamadoItem;
    const colorClass = typeColors[ch.tipo?.toLowerCase()] ?? "bg-slate-500/10 text-slate-400";
    return { label: ch.tipo, colorClass };
  }
  return null;
}

function KanbanCard({ item, draggable, onClick }: { item: ChamadoItem | UnifiedItem; draggable?: boolean; onClick?: () => void }) {
  const badge = getItemTipoBadge(item);
  const date = getItemDate(item);
  // Nome do projeto: só pra tarefa em variant=todos (UnifiedItem com tipo="tarefa").
  const projetoNome =
    "tipo" in item && (item as UnifiedItem).tipo === "tarefa" ? (item as UnifiedItem).contexto : null;

  const statusColors: Record<string, string> = {
    in_progress: "#00c853",
    "em-andamento": "#00c853",
    open: "#f59e0b",
    "a-fazer": "#f59e0b",
    blocked: "#ef4444",
    bloqueado: "#ef4444",
    resolved: "#4ade80",
    closed: "#4ade80",
    concluido: "#4ade80",
  };
  const dotColor = statusColors[item.status] ?? "rgba(255,255,255,0.2)";

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("itemId", item.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onClick}
      style={{
        background: "#111411",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 8,
        cursor: onClick ? "pointer" : draggable ? "grab" : "default",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
    >
      {/* Top row: codigo + badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
          gap: 6,
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "rgba(255,255,255,0.4)",
            flexShrink: 0,
          }}
        >
          {item.codigo}
        </span>
        {badge && (
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 border ${badge.colorClass}`}
          >
            {badge.label}
          </Badge>
        )}
      </div>

      {/* Projeto (só pra tarefa) */}
      {projetoNome && (
        <p
          className="truncate"
          title={projetoNome}
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.45)",
            marginBottom: 4,
          }}
        >
          {projetoNome}
        </p>
      )}

      {/* Title */}
      <p
        className="line-clamp-2"
        style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.85)",
          marginBottom: 8,
          lineHeight: "1.4",
        }}
      >
        {item.titulo}
      </p>

      {/* Bottom row: status dot + responsavel */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span
            style={{
              display: "inline-block",
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: dotColor,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "rgba(0,200,83,0.15)",
                color: "#00c853",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {item.responsavelInitials}
            </div>
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.5)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 100,
              }}
            >
              {item.responsavel}
            </span>
          </div>
        </div>

        {/* Date */}
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
            flexShrink: 0,
          }}
        >
          {date}
        </span>
      </div>
    </div>
  );
}

function KanbanColumnHeader({ column, count }: { column: KanbanColumn; count: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 0 12px 0",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: column.dotColor,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        {column.label}
      </span>
      <span
        style={{
          borderRadius: "9999px",
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.4)",
          fontSize: 10,
          padding: "1px 7px",
        }}
      >
        {count}
      </span>
    </div>
  );
}

export function KanbanView({ items, onStatusChange, onItemClick }: KanbanViewProps) {
  const columnItems = COLUMNS.map((col) => ({
    column: col,
    items: items.filter((item) => col.statuses.includes(item.status)),
  }));

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent, targetStatuses: string[]) {
    e.preventDefault();
    const itemId = e.dataTransfer.getData("itemId");
    if (!itemId || !onStatusChange) return;
    const item = items.find((i) => i.id === itemId);
    if (item && !targetStatuses.includes(item.status)) {
      onStatusChange(itemId, targetStatuses[0]);
    }
  }

  const isDraggable = !!onStatusChange;

  return (
    <div style={{ overflowX: "auto" }}>
      <div
        style={{
          display: "flex",
          gap: 16,
          minWidth: "max-content",
          paddingBottom: 16,
        }}
      >
        {columnItems.map(({ column, items: colItems }) => (
          <div
            key={column.key}
            style={{ width: 260, flexShrink: 0 }}
            onDragOver={isDraggable ? handleDragOver : undefined}
            onDrop={isDraggable ? (e) => handleDrop(e, column.statuses) : undefined}
          >
            <KanbanColumnHeader column={column} count={colItems.length} />
            <div
              style={{
                overflowY: "auto",
                maxHeight: "calc(100vh - 300px)",
                minHeight: 60,
              }}
            >
              {colItems.map((item) => (
                <KanbanCard
                  key={item.id}
                  item={item}
                  draggable={isDraggable}
                  onClick={onItemClick ? () => onItemClick(item) : undefined}
                />
              ))}
              {colItems.length === 0 && (
                <div
                  style={{
                    padding: "20px 0",
                    textAlign: "center",
                    color: "rgba(255,255,255,0.15)",
                    fontSize: 12,
                    fontStyle: "italic",
                  }}
                >
                  Nenhum item
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
