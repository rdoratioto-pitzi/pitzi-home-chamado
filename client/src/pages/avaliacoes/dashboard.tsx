import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { AccuracyKpiStrip } from "@/components/avaliacoes/accuracy-kpi-strip";
import { AccuracyTrendChart } from "@/components/avaliacoes/accuracy-trend-chart";
import { EvaluatorRanking } from "@/components/avaliacoes/evaluator-ranking";
import { CostImpactCard } from "@/components/avaliacoes/cost-impact-card";
import { DashboardFilters } from "@/components/avaliacoes/dashboard-filters";
import { useAvaliacoesResumo } from "@/hooks/use-avaliacoes";
import type { AvaliacoesFilters } from "@/hooks/use-avaliacoes";

export default function AvaliacoesDashboardPage() {
  const [filters, setFilters] = useState<AvaliacoesFilters>({
    area: "ambas",
  });

  const { data: resumoData, isLoading: resumoLoading } = useAvaliacoesResumo(filters);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Avaliações — Dashboard" />
      <div className="container mx-auto px-4 py-8 space-y-6">

        {/* Filtros */}
        <DashboardFilters filters={filters} onChange={setFilters} />

        {/* KPI Strip */}
        <AccuracyKpiStrip data={resumoData?.data} isLoading={resumoLoading} />

        {/* Gráfico temporal — largura total */}
        <AccuracyTrendChart filtros={filters} />

        {/* Grid 2 colunas: Ranking + Custo */}
        <div className="grid gap-4 md:grid-cols-2">
          <EvaluatorRanking filtros={filters} />
          <CostImpactCard filtros={filters} />
        </div>

      </div>
    </div>
  );
}
