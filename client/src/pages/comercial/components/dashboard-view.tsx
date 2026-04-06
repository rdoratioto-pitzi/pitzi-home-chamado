import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Loader2 } from "lucide-react";
import {
  type DashboardMonth,
  type MonthKey,
  MONTH_KEYS,
  INITIAL_DASHBOARD_DATA,
  periodoToMonthKey,
  monthKeyToLabel,
} from "../lib/dashboard-data";
import { DashboardHero } from "./dashboard-hero";
import { DashboardKpiRow } from "./dashboard-kpi-row";
import { DashboardBreakdown } from "./dashboard-breakdown";
import { KpiEditModal } from "./kpi-edit-modal";
import { useComercialKpis, apiRowToDashboardMonth } from "../hooks/use-comercial-kpis";

function getCurrentMonthKey(): MonthKey {
  const abbr = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const now = new Date();
  return `${abbr[now.getMonth()]}-${now.getFullYear()}`;
}

export function DashboardView() {
  const currentKey = getCurrentMonthKey();
  const defaultMonth = MONTH_KEYS.includes(currentKey) ? currentKey : MONTH_KEYS[0];
  const [activeMonth, setActiveMonth] = useState<MonthKey>(defaultMonth);
  const [editOpen, setEditOpen] = useState(false);

  const { data: apiRows, isLoading } = useComercialKpis();

  const data = useMemo<Record<MonthKey, DashboardMonth>>(() => {
    const base = { ...INITIAL_DASHBOARD_DATA };
    if (apiRows) {
      for (const row of apiRows) {
        const key = periodoToMonthKey(row.periodo);
        if (key && key in base) {
          base[key] = apiRowToDashboardMonth(row);
        }
      }
    }
    return base;
  }, [apiRows]);

  const current = data[activeMonth] ?? data[MONTH_KEYS[0]];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Carregando KPIs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seletor de mês + botão atualizar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1 overflow-x-auto">
          {MONTH_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setActiveMonth(key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeMonth === key
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {monthKeyToLabel(key)}
            </button>
          ))}
        </div>

        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditOpen(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Atualizar KPIs
        </Button>
      </div>

      {/* Hero row */}
      <DashboardHero data={current} />

      {/* KPI cards */}
      <DashboardKpiRow data={current} />

      {/* CPD breakdown */}
      <DashboardBreakdown data={current} />

      {/* Modal */}
      <KpiEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        currentMonth={activeMonth}
        data={data}
      />
    </div>
  );
}
