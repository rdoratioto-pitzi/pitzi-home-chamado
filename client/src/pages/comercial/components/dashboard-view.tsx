import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import {
  type DashboardMonth,
  type MonthKey,
  MONTH_KEYS,
  INITIAL_DASHBOARD_DATA,
} from "../lib/dashboard-data";
import { DashboardHero } from "./dashboard-hero";
import { DashboardKpiRow } from "./dashboard-kpi-row";
import { DashboardBreakdown } from "./dashboard-breakdown";
import { KpiEditModal } from "./kpi-edit-modal";

export function DashboardView() {
  const [data, setData] = useState<Record<MonthKey, DashboardMonth>>(INITIAL_DASHBOARD_DATA);
  const [activeMonth, setActiveMonth] = useState<MonthKey>("mar-2026");
  const [editOpen, setEditOpen] = useState(false);

  const handleSave = useCallback((month: MonthKey, updated: DashboardMonth) => {
    setData((prev) => ({ ...prev, [month]: updated }));
  }, []);

  const current = data[activeMonth];

  return (
    <div className="space-y-6">
      {/* Seletor de mês + botão atualizar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          {MONTH_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setActiveMonth(key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeMonth === key
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {data[key].label}
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
        onSave={handleSave}
      />
    </div>
  );
}
