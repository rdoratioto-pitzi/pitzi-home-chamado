import { Skeleton } from "@/components/ui/skeleton";

export interface WorkspaceKpis {
  total: number;
  abertos: number;
  andamento: number;
  bloqueados: number;
  resolvidos: number;
  noPrazo: number;
  emAtraso: number;
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
}

function getKpiItems(kpis: WorkspaceKpis, variant: string): KpiItem[] {
  if (variant === "chamados") {
    return [
      { label: "Total", value: kpis.total, isFirst: true },
      { label: "Abertos", value: kpis.abertos },
      { label: "Em Andamento", value: kpis.andamento },
      { label: "Bloqueados", value: kpis.bloqueados, negativeWhen: (v) => v > 0 },
      { label: "Resolvidos", value: kpis.resolvidos, color: "#00c853" },
      { label: "No Prazo", value: kpis.noPrazo, color: "#00c853" },
      { label: "Em Atraso", value: kpis.emAtraso, negativeWhen: (v) => v > 0 },
    ];
  }

  // projetos / todos — 5 columns (placeholder)
  return [
    { label: "Total", value: kpis.total, isFirst: true },
    { label: "Abertos", value: kpis.abertos },
    { label: "Em Andamento", value: kpis.andamento },
    { label: "Resolvidos", value: kpis.resolvidos, color: "#00c853" },
    { label: "Em Atraso", value: kpis.emAtraso, negativeWhen: (v) => v > 0 },
  ];
}

export function KpiStrip({ kpis, variant, loading }: KpiStripProps) {
  const items = getKpiItems(kpis, variant);

  if (loading) {
    return (
      <div className="flex gap-0 w-full">
        {items.map((_, i) => (
          <div key={i} className="flex-1 px-4 py-3">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-6 w-10" />
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
          : item.color || "rgba(255,255,255,0.85)";

        return (
          <div
            key={i}
            className="flex-1 px-4 py-3 min-w-0"
            style={{
              borderLeft: item.isFirst ? "2px solid #00c853" : undefined,
              background: item.isFirst ? "#111411" : undefined,
              borderRadius: item.isFirst ? "4px 0 0 4px" : undefined,
            }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: "uppercase",
                fontSize: "9px",
                letterSpacing: "0.05em",
                color: "rgba(255,255,255,0.25)",
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
