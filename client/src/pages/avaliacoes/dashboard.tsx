import { useState } from "react";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AccuracyKpiStrip } from "@/components/avaliacoes/accuracy-kpi-strip";
import { AccuracyTrendChart } from "@/components/avaliacoes/accuracy-trend-chart";
import { EvaluatorRanking } from "@/components/avaliacoes/evaluator-ranking";
import { CostImpactCard } from "@/components/avaliacoes/cost-impact-card";
import { DashboardFilters } from "@/components/avaliacoes/dashboard-filters";
import { useAvaliacoesResumo, useAssertividadeFotos } from "@/hooks/use-avaliacoes";
import { ArrowUpRight, ArrowDownRight, GitCompare, Camera } from "lucide-react";
import type { AvaliacoesFilters } from "@/hooks/use-avaliacoes";

// ─── Card de Divergências ─────────────────────────────────────────────────────

interface DivergenciasCardProps {
  percentualDivergencias: number;
  trend: number;
  isLoading: boolean;
}

function DivergenciasCard({ percentualDivergencias, trend, isLoading }: DivergenciasCardProps) {
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
        <CardHeader className="pb-2">
          <Skeleton className="h-3 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-40 mt-2" />
        </CardContent>
      </Card>
    );
  }

  const nivelRisco = percentualDivergencias >= 30 ? "alto" : percentualDivergencias >= 15 ? "médio" : "baixo";
  const corValor = nivelRisco === "alto"
    ? "text-red-500"
    : nivelRisco === "médio"
    ? "text-yellow-500"
    : "text-emerald-500";

  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
        <CardTitle
          className="text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: "var(--l3)" }}
        >
          Divergências IA vs Humano
        </CardTitle>
        <GitCompare className="h-4 w-4 text-purple-400" />
      </CardHeader>
      <CardContent>
        <div className={`text-[28px] font-bold tabular-nums ${corValor}`}>
          {percentualDivergencias.toFixed(1)}%
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {trend !== 0 && (
              trend > 0
                ? <ArrowUpRight className="h-3 w-3 text-red-500" />
                : <ArrowDownRight className="h-3 w-3 text-emerald-500" />
            )}
            {trend !== 0
              ? `${trend > 0 ? "+" : ""}${trend.toFixed(1)}% vs período anterior`
              : "grade IA ≠ grade curador"}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6 px-2"
            onClick={() => navigate("/avaliacoes/curadoria")}
          >
            Ver na Curadoria
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Assertividade por Tipo de Foto ──────────────────────────────────────────

function AssertividadeFotosSection({ filtros }: { filtros: AvaliacoesFilters }) {
  const { data: fotosData, isLoading } = useAssertividadeFotos(filtros);

  // Aggregate by photo type (sum across months)
  const aggregated = (fotosData ?? []).reduce<Record<string, { total: number; acertos: number }>>((acc, item) => {
    const nome = item.Nome_da_Tela || "Desconhecido";
    if (!acc[nome]) acc[nome] = { total: 0, acertos: 0 };
    acc[nome].total += item.Total_Fotos;
    acc[nome].acertos += item.Acertos;
    return acc;
  }, {});

  const rows = Object.entries(aggregated)
    .map(([nome, { total, acertos }]) => ({
      nome,
      total,
      acertos,
      assertividade: total > 0 ? Math.round((acertos / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  if (isLoading) {
    return (
      <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) return null;

  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 gap-2">
        <CardTitle className="text-sm font-semibold" style={{ color: "var(--l1)" }}>
          Assertividade por Tipo de Foto
        </CardTitle>
        <Camera className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Em qual ângulo/tipo de foto a IA tem mais dificuldade (dados por foto, não por dispositivo)
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de Foto</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acertos</TableHead>
                <TableHead className="text-right">Assertividade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.nome}>
                  <TableCell className="font-medium">{row.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.total.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.acertos.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className={row.assertividade >= 80 ? "text-emerald-500" : row.assertividade >= 60 ? "text-yellow-500" : "text-red-500"}>
                      {row.assertividade.toFixed(1)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AvaliacoesDashboardPage() {
  const [filters, setFilters] = useState<AvaliacoesFilters>({
    area: "ambas",
  });

  const { data: resumoData, isLoading: resumoLoading } = useAvaliacoesResumo(filters);

  // Divergência = onde IA ≠ curador (inverso da acurácia IA)
  const acuraciaIa = resumoData?.data?.acuraciaIa ?? 0;
  const percentualDivergencias = resumoData?.data ? Math.max(0, 100 - acuraciaIa) : 0;
  const trendDivergencias = resumoData?.data ? -(resumoData.data.trendAcuraciaIa ?? 0) : 0;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Avaliações — Dashboard" />
      <div className="container mx-auto px-4 py-6 space-y-6">

        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Avaliações</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Filtros */}
        <DashboardFilters filters={filters} onChange={setFilters} />

        {/* KPI Strip */}
        <AccuracyKpiStrip data={resumoData?.data} isLoading={resumoLoading} />

        {/* Card de Divergências IA vs Humano */}
        <DivergenciasCard
          percentualDivergencias={percentualDivergencias}
          trend={trendDivergencias}
          isLoading={resumoLoading}
        />

        {/* Gráfico temporal — largura total */}
        <AccuracyTrendChart filtros={filters} />

        {/* Grid 2 colunas: Ranking + Custo */}
        <div className="grid gap-4 md:grid-cols-2">
          <EvaluatorRanking filtros={filters} />
          <CostImpactCard filtros={filters} />
        </div>

        {/* Assertividade por Tipo de Foto (dados da API proxy) */}
        <AssertividadeFotosSection filtros={filters} />

      </div>
    </div>
  );
}
