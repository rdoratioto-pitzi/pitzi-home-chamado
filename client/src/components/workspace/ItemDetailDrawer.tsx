import { useEffect } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ChamadoItem, UnifiedItem } from "./WorkspaceTable";

interface ItemDetailDrawerProps {
  open: boolean;
  item: ChamadoItem | UnifiedItem | null;
  onClose: () => void;
}

const SECTION_LABEL_STYLE: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  textTransform: "uppercase",
  fontSize: "9px",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.25)",
  marginBottom: "12px",
};

const ROW_LABEL_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "rgba(255,255,255,0.35)",
  minWidth: "90px",
};

const statusColors: Record<string, string> = {
  open: "#f59e0b",
  in_progress: "#00c853",
  blocked: "#ef4444",
  resolved: "#4ade80",
  closed: "#4ade80",
  "a-fazer": "#f59e0b",
  "em-andamento": "#00c853",
  concluido: "#4ade80",
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

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function ItemDetailDrawer({ open, item, onClose }: ItemDetailDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isChamado = item !== null && "tipo" in item && typeof (item as ChamadoItem).categoria === "string";

  const statusColor = item ? (statusColors[item.status] ?? "rgba(255,255,255,0.3)") : "rgba(255,255,255,0.3)";
  const statusLabel = item ? (statusLabels[item.status] ?? item.status) : "";

  const prioColor = item ? (priorityColors[item.prioridade] ?? priorityColors.medium) : priorityColors.medium;
  const prioLabel = item ? (priorityLabels[item.prioridade] ?? item.prioridade) : "";

  const abertura = isChamado
    ? formatDate((item as ChamadoItem).abertura)
    : formatDate((item as UnifiedItem | null)?.criadoEm);

  const descricao = item
    ? isChamado
      ? (item as ChamadoItem).categoria
      : (item as UnifiedItem).contexto
    : "";

  return (
    <>
      {/* Full-screen overlay container — pointer-events none so main content stays interactive */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          pointerEvents: "none",
        }}
      >
        {/* Semi-transparent backdrop — pointer-events all only when open */}
        <div
          onClick={onClose}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            opacity: open ? 1 : 0,
            transition: "opacity 300ms ease",
            pointerEvents: open ? "all" : "none",
          }}
        />

        {/* Slide-in panel */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            width: 480,
            height: "100vh",
            background: "#111411",
            borderLeft: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            transform: open ? "translateX(0)" : "translateX(100%)",
            transition: "transform 300ms ease",
            pointerEvents: "all",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              flexShrink: 0,
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {item && (
                <>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.4)",
                      flexShrink: 0,
                    }}
                  >
                    {item.codigo}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
                  <span
                    className="truncate text-sm"
                    style={{ color: "rgba(255,255,255,0.85)" }}
                  >
                    {item.titulo}
                  </span>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body — scrollable */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px" }}>
            {item && (
              <>
                {/* DETALHES section */}
                <div style={{ marginBottom: 24 }}>
                  <div style={SECTION_LABEL_STYLE}>Detalhes</div>

                  <div className="flex flex-col gap-3">
                    {/* Status */}
                    <div className="flex items-center gap-3">
                      <span style={ROW_LABEL_STYLE}>Status</span>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded"
                        style={{
                          background: `${statusColor}1a`,
                          color: statusColor,
                          border: `1px solid ${statusColor}33`,
                        }}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    {/* Prioridade */}
                    <div className="flex items-center gap-3">
                      <span style={ROW_LABEL_STYLE}>Prioridade</span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${prioColor}`}>
                        {prioLabel}
                      </Badge>
                    </div>

                    {/* Responsável */}
                    <div className="flex items-center gap-3">
                      <span style={ROW_LABEL_STYLE}>Responsável</span>
                      <div className="flex items-center gap-1.5">
                        <div
                          className="flex items-center justify-center flex-shrink-0 rounded-full text-[10px] font-semibold"
                          style={{
                            width: 22,
                            height: 22,
                            background: "rgba(0,200,83,0.15)",
                            color: "#00c853",
                          }}
                        >
                          {item.responsavelInitials}
                        </div>
                        <span
                          className="text-xs"
                          style={{ color: "rgba(255,255,255,0.7)" }}
                        >
                          {item.responsavel}
                        </span>
                      </div>
                    </div>

                    {/* Abertura */}
                    <div className="flex items-center gap-3">
                      <span style={ROW_LABEL_STYLE}>Abertura</span>
                      <span
                        className="text-xs"
                        style={{ color: "rgba(255,255,255,0.55)" }}
                      >
                        {abertura}
                      </span>
                    </div>

                    {/* SLA */}
                    <div className="flex items-center gap-3">
                      <span style={ROW_LABEL_STYLE}>SLA</span>
                      <span
                        className="text-xs"
                        style={{ color: "rgba(255,255,255,0.55)" }}
                      >
                        {item.sla ? `${item.sla}h` : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* DESCRIÇÃO section */}
                <div
                  style={{
                    marginBottom: 24,
                    paddingTop: 20,
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div style={SECTION_LABEL_STYLE}>Descrição</div>
                  <p
                    className="text-sm"
                    style={{ color: "rgba(255,255,255,0.55)", lineHeight: "1.6" }}
                  >
                    {descricao || "—"}
                  </p>
                </div>

                {/* ATIVIDADE section */}
                <div
                  style={{
                    paddingTop: 20,
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div style={SECTION_LABEL_STYLE}>Atividade</div>
                  <p
                    className="text-xs"
                    style={{ color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}
                  >
                    Em breve...
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
