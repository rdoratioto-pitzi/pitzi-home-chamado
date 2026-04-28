import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { PricingFilters } from "./components/PricingFilters";
import { PricingKPIs } from "./components/PricingKPIs";
import { TopRankingTable } from "./components/TopRankingTable";
import { MonthlyEvolutionTable } from "./components/MonthlyEvolutionTable";
import { DistributionChart } from "./components/DistributionChart";
import { TimelineChart } from "./components/TimelineChart";
import { ExportUtils } from "@/lib/export-utils";

interface FilterState {
  networks?: string[];
  categories?: Array<string | number>;
  weeks?: string[];
  limit: number;
}

export function PricingDashboard() {
  const [filters, setFilters] = useState<FilterState>({
    limit: 50,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch metadados (redes, categorias, semanas)
  const { data: metadata } = useQuery({
    queryKey: ["pricing-metadata"],
    queryFn: async () => {
      const res = await fetch("/api/pricing/metadata", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch metadata");
      return res.json();
    },
  });

  useEffect(() => {
    if (!metadata?.defaultWeeks?.length) return;
    setFilters((prev) => {
      if (prev.weeks && prev.weeks.length > 0) return prev;
      return { ...prev, weeks: metadata.defaultWeeks };
    });
  }, [metadata]);

  // Fetch top 50 data
  const { data: top50Data, isLoading: isLoadingTop50, refetch: refetchTop50 } = useQuery({
    queryKey: ["pricing-top50", filters],
    queryFn: async () => {
      const res = await fetch("/api/pricing/top50", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          networks: filters.networks,
          weeks: filters.weeks,
          categories: filters.categories,
          limit: filters.limit,
        }),
      });
      if (!res.ok) throw new Error("Failed to fetch top50");
      return res.json();
    },
  });

  // Fetch monthly evolution
  const { data: monthlyData, isLoading: isLoadingMonthly, refetch: refetchMonthly } = useQuery({
    queryKey: ["pricing-monthly", filters],
    queryFn: async () => {
      const res = await fetch("/api/pricing/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          networks: filters.networks,
          categories: filters.categories,
        }),
      });
      if (!res.ok) throw new Error("Failed to fetch monthly");
      return res.json();
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchTop50(),
      refetchMonthly()
    ]);
    setIsRefreshing(false);
  };

  const handleExportTop50 = () => {
    if (top50Data?.data) {
      ExportUtils.exportToExcel(
        top50Data.data,
        `pricing-top${filters.limit}-${new Date().toISOString().split("T")[0]}.xlsx`,
        `Top ${filters.limit} Modelos`
      );
    }
  };

  const handleExportMonthly = () => {
    if (monthlyData?.data) {
      ExportUtils.exportToExcel(
        monthlyData.data,
        `pricing-mensal-${new Date().toISOString().split("T")[0]}.xlsx`,
        "Evolução Mensal"
      );
    }
  };

  // Calcular KPIs agregadas
  const calculateKPIs = () => {
    if (!top50Data?.data) return null;

    const data = top50Data.data as Array<{
      Digitado?: number;
      Avaliado?: number;
      Comprado?: number;
      RR?: number;
      CR?: number;
    }>;
    const totalDigitado = data.reduce((sum: number, row) => sum + (row.Digitado || 0), 0);
    const totalAvaliado = data.reduce((sum: number, row) => sum + (row.Avaliado || 0), 0);
    const totalComprado = data.reduce((sum: number, row) => sum + (row.Comprado || 0), 0);
    const avgRR =
      data.reduce((sum: number, row) => sum + (row.RR || 0), 0) / (data.length || 1);
    const avgCR =
      data.reduce((sum: number, row) => sum + (row.CR || 0), 0) / (data.length || 1);

    return {
      totalDigitado,
      totalAvaliado,
      totalComprado,
      avgRR,
      avgCR,
      modelosCount: data.length,
    };
  };

  const kpis = calculateKPIs();

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Dashboard de Pricing"
        description="Análise de volumes, avaliações, conversões e performance de modelos"
      />

      <div className="flex-1 overflow-auto p-6 space-y-6 bg-background">
        <PricingFilters
          metadata={metadata}
          filters={filters}
          onFiltersChange={setFilters}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        {kpis && <PricingKPIs kpis={kpis} />}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {top50Data?.data && <DistributionChart data={top50Data.data} />}
          {top50Data?.data && <TimelineChart data={top50Data.data} />}
        </div>

        <Card className="shadow-sm border-border/70 bg-card">
          <CardHeader className="border-b border-border/70 bg-card">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-foreground">
                Ranking de Modelos
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportTop50}
                disabled={!top50Data?.data}
              >
                <Download className="w-4 h-4 mr-2" />
                Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {isLoadingTop50 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : top50Data?.data ? (
              <TopRankingTable data={top50Data.data} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum dado disponível com os filtros selecionados
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/70 bg-card">
          <CardHeader className="border-b border-border/70 bg-card">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-foreground">
                Evolução Mensal - Top 3 Fabricantes
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportMonthly}
                disabled={!monthlyData?.data}
              >
                <Download className="w-4 h-4 mr-2" />
                Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {isLoadingMonthly ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : monthlyData?.data ? (
              <MonthlyEvolutionTable data={monthlyData.data} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PricingDashboard;
