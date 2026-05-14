const kpiSkeletonKeyframes = `
@keyframes kpi-skeleton-pulse {
  from { background-color: var(--l4); }
  to   { background-color: var(--l3); }
}
`;

export interface WorkspaceKpis {
  total: number;
  abertos: number;
  andamento: number;
  bloqueados: number;
  resolvidos: number;
  noPrazo: number;
  emAtraso: number;
  // todos variant extras
  chamados?: number;
  tarefas?: number;
}

interface KpiItem {
  label: string;
  value: number;
  color?: string;
  isFirst?: boolean;
  negativeWhen?: (v: number) => boolean;
}

interface KpiStripProps {
  kpis: WorkspaceKpis;
  variant: "chamados" | "projetos" | "todos";
  loading?: boolean;
  activeKpi?: string | null;
  onKpiClick?: (label: string) => void;
}

function getKpiItems(kpis: WorkspaceKpis, variant: string): KpiItem[] {
  if (variant === "chamados") {
    return [
      { label: "Total", value: kpis.total, isFirst: true },
      { label: "Abertos", value: kpis.abertos },
      { label: "Em Andamento", value: kpis.andamento },
      { label: "Bloqueados", value: kpis.bloqueados, negativeWhen: (v) => v > 0 },
      { label: "Resolvidos", value: kpis.resolvidos, color: "#5B62EC" },
      { label: "No Prazo", value: kpis.noPrazo, color: "#5B62EC" },
      { label: "Em Atraso", value: kpis.emAtraso, negativeWhen: (v) => v > 0 },
    ];
  }

  if (variant === "projetos") {
    return [
      { label: "Proj. Ativos", value: kpis.total, isFirst: true },
      { label: "Tarefas Abertas", value: kpis.abertos },
      { label: "Em Andamento", value: kpis.andamento },
      { label: "Concluídas", value: kpis.resolvidos, color: "#5B62EC" },
      { label: "Atrasadas", value: kpis.emAtraso, negativeWhen: (v) => v > 0 },
    ];
  }

  // todos — 7 columns
  return [
    { label: "Total Geral", value: kpis.total, isFirst: true },
    { label: "Chamados", value: kpis.chamados ?? 0 },
    { label: "Tarefas", value: kpis.tarefas ?? 0 },
    { label: "Em Andamento", value: kpis.andamento },
    { label: "Resolvidos", value: kpis.resolvidos, color: "#5B62EC" },
    { label: "No Prazo", value: kpis.noPrazo, color: "#5B62EC" },
    { label: "Em Atraso", value: kpis.emAtraso, negativeWhen: (v) => v > 0 },
  ];
}

export function KpiStrip({ kpis, variant, loading, activeKpi, onKpiClick }: KpiStripProps) {
  const items = getKpiItems(kpis, variant);

  if (loading) {
    const skeletonStyle = {
      display: "block",
      borderRadius: 4,
      animation: "kpi-skeleton-pulse 1.5s ease-in-out infinite alternate",
    };
    return (
      <div className="flex gap-0 w-full">
        <style>{kpiSkeletonKeyframes}</style>
        {items.map((_, i) => (
          <div key={i} className="flex-1 px-4 py-3">
            <span style={{ ...skeletonStyle, width: 64, height: 10, marginBottom: 8 }} />
            <span style={{ ...skeletonStyle, width: 40, height: 24 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-0 w-full">
      {items.map((item, i) => {
        const isNegative = item.negativeWhen?.(item.value);
        const valueColor = isNegative
          ? "#ff5050"
          : item.color || "var(--l1)";
        const isActive = activeKpi === item.label;
        const isClickable = !!onKpiClick;

        return (
          <div
            key={i}
            className="flex-1 px-4 py-3 min-w-0"
            onClick={isClickable ? () => onKpiClick(item.label) : undefined}
            style={{
              cursor: isClickable ? "pointer" : "default",
              borderLeft: item.isFirst
                ? `2px solid ${isActive ? "#7B80F0" : "#5B62EC"}`
                : isActive
                ? "2px solid rgba(0,200,83,0.5)"
                : undefined,
              background: isActive
                ? "rgba(0,200,83,0.08)"
                : item.isFirst
                ? "var(--bg3)"
                : undefined,
              borderRadius: item.isFirst ? "4px 0 0 4px" : undefined,
              outline: isActive && !item.isFirst ? "1px solid rgba(59,66,222,0.3)" : undefined,
              transition: "background 0.15s, outline 0.15s",
            }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: "uppercase",
                fontSize: "9px",
                letterSpacing: "0.05em",
                color: isActive ? "rgba(0,200,83,0.7)" : "var(--l3)",
                marginBottom: "4px",
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "21px",
                fontWeight: 600,
                color: valueColor,
                lineHeight: 1.2,
              }}
            >
              {item.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
