import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ConfusionMatrix } from "@/components/avaliacoes/confusion-matrix";
import { MatrizFilters } from "@/components/avaliacoes/matriz-filters";
import { useMatrizConfusao } from "@/hooks/use-avaliacoes";
import { Lightbulb, TrendingUp, AlertTriangle } from "lucide-react";
import type { AvaliacoesFilters, MatrizConfusaoResult } from "@/hooks/use-avaliacoes";
import type { Grade } from "@/hooks/use-avaliacoes";

const GRADES: Grade[] = ["A", "B", "C"];

// ─── Insights ─────────────────────────────────────────────────────────────────

interface InsightItem {
  text: string;
  impact: number;
  type: "warning" | "success" | "info";
}

function computeRowPercents(
  data: MatrizConfusaoResult["matriz"]
): Map<string, number> {
  const lookup = new Map<string, number>();
  const rowTotals = new Map<string, number>();

  for (const e of data) {
    lookup.set(`${e.atribuido}|${e.correto}`, e.quantidade);
  }
  for (const g of GRADES) {
    rowTotals.set(
      g,
      GRADES.reduce((s, c) => s + (lookup.get(`${g}|${c}`) ?? 0), 0)
    );
  }

  const rowPcts = new Map<string, number>();
  for (const e of data) {
    const rt = rowTotals.get(e.atribuido) ?? 0;
    rowPcts.set(
      `${e.atribuido}|${e.correto}`,
      rt > 0 ? Math.round((e.quantidade / rt) * 1000) / 10 : 0
    );
  }
  return rowPcts;
}

function computeInsights(
  iaResult: MatrizConfusaoResult | null | undefined,
  humanoResult: MatrizConfusaoResult | null | undefined
): InsightItem[] {
  const insights: InsightItem[] = [];

  function worstError(
    result: MatrizConfusaoResult,
    tipo: "IA" | "Humano"
  ): InsightItem | null {
    const rowPcts = computeRowPercents(result.matriz);
    let worst: { atribuido: string; correto: string; rowPct: number } | null =
      null;
    for (const e of result.matriz) {
      if (e.atribuido === e.correto) continue;
      const rowPct = rowPcts.get(`${e.atribuido}|${e.correto}`) ?? 0;
      if (!worst || rowPct > worst.rowPct) {
        worst = { atribuido: e.atribuido, correto: e.correto, rowPct };
      }
    }
    if (!worst || worst.rowPct < 5) return null;
    return {
      text: `${tipo} confunde ${worst.atribuido}→${worst.correto} em ${worst.rowPct}% dos casos`,
      impact: worst.rowPct,
      type: worst.rowPct >= 20 ? "warning" : "info",
    };
  }

  if (iaResult && iaResult.totalAvaliacoes > 0) {
    const w = worstError(iaResult, "IA");
    if (w) insights.push(w);

    insights.push({
      text: `IA tem ${iaResult.acuraciaGeral}% de acurácia geral`,
      impact: iaResult.acuraciaGeral,
      type: iaResult.acuraciaGeral >= 80 ? "success" : "warning",
    });
  }

  if (humanoResult && humanoResult.totalAvaliacoes > 0) {
    const w = worstError(humanoResult, "Humano");
    if (w) insights.push(w);

    if (iaResult && iaResult.totalAvaliacoes > 0) {
      const diff = humanoResult.acuraciaGeral - iaResult.acuraciaGeral;
      if (Math.abs(diff) >= 3) {
        const melhor = diff > 0 ? "Humano" : "IA";
        const abs = Math.abs(diff).toFixed(1);
        insights.push({
          text: `${melhor} supera o outro avaliador em ${abs} p.p. de acurácia`,
          impact: Math.abs(diff),
          type: "info",
        });
      }
    }
  }

  // Top combined error pair
  const allData = [
    ...(iaResult?.matriz ?? []),
    ...(humanoResult?.matriz ?? []),
  ];
  const errorByPair = new Map<string, number>();
  for (const e of allData) {
    if (e.atribuido === e.correto) continue;
    const key = `${e.atribuido}→${e.correto}`;
    errorByPair.set(key, (errorByPair.get(key) ?? 0) + e.quantidade);
  }
  if (errorByPair.size > 0) {
    const [topPair, topCount] = [...errorByPair.entries()].sort(
      ([, a], [, b]) => b - a
    )[0];
    insights.push({
      text: `Maior fonte de erro combinada: Grade ${topPair} (${topCount} ocorrências)`,
      impact: topCount,
      type: "warning",
    });
  }

  // Dedupe and sort by impact
  const seen = new Set<string>();
  return insights
    .filter((i) => {
      if (seen.has(i.text)) return false;
      seen.add(i.text);
      return true;
    })
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 4);
}

// ─── Insight icon ──────────────────────────────────────────────────────────────

function InsightIcon({ type }: { type: InsightItem["type"] }) {
  if (type === "warning")
    return (
      <AlertTriangle
        className="h-4 w-4 shrink-0 mt-0.5"
        style={{ color: "rgb(234,179,8)" }}
      />
    );
  if (type === "success")
    return (
      <TrendingUp
        className="h-4 w-4 shrink-0 mt-0.5"
        style={{ color: "rgb(34,197,94)" }}
      />
    );
  return (
    <Lightbulb
      className="h-4 w-4 shrink-0 mt-0.5"
      style={{ color: "var(--l3)" }}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AvaliacoesMatrizPage() {
  const [filters, setFilters] = useState<AvaliacoesFilters>({
    area: "ambas",
    tipo: "ia",
  });

  // Shared filters for both matrices (area, periodo, categoria)
  // Each matrix uses its own tipo override
  const sharedFilters: AvaliacoesFilters = {
    dataInicio: filters.dataInicio,
    dataFim: filters.dataFim,
    categoria: filters.categoria,
    area: filters.area,
  };

  const iaFilters: AvaliacoesFilters = { ...sharedFilters, tipo: "ia" };
  const humanoFilters: AvaliacoesFilters = { ...sharedFilters, tipo: "humano" };
  const singleFilters: AvaliacoesFilters = {
    ...sharedFilters,
    tipo: filters.tipo ?? "ia",
  };

  const { data: iaData, isLoading: iaLoading } = useMatrizConfusao(iaFilters);
  const { data: humanoData, isLoading: humanoLoading } =
    useMatrizConfusao(humanoFilters);
  const { data: singleData, isLoading: singleLoading } =
    useMatrizConfusao(singleFilters);

  const iaResult = iaData?.data ?? null;
  const humanoResult = humanoData?.data ?? null;
  const singleResult = singleData?.data ?? null;

  const insights = computeInsights(iaResult, humanoResult);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Avaliações — Matriz de Confusão" />
      <div className="container mx-auto px-4 py-6 space-y-6">

        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/avaliacoes/dashboard">Avaliações</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Matriz de Confusão</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Filtros */}
        <MatrizFilters
          filters={filters}
          onChange={setFilters}
          hideTipoToggle={false}
        />

        {/* ── Desktop lg: 2 matrizes lado a lado ── */}
        <div className="hidden xl:grid xl:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-5">
              <ConfusionMatrix
                data={iaResult?.matriz ?? []}
                totalAvaliacoes={iaResult?.totalAvaliacoes ?? 0}
                acuraciaGeral={iaResult?.acuraciaGeral ?? 0}
                isLoading={iaLoading}
                title="Matriz IA"
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <ConfusionMatrix
                data={humanoResult?.matriz ?? []}
                totalAvaliacoes={humanoResult?.totalAvaliacoes ?? 0}
                acuraciaGeral={humanoResult?.acuraciaGeral ?? 0}
                isLoading={humanoLoading}
                title="Matriz Humano"
              />
            </CardContent>
          </Card>
        </div>

        {/* ── Desktop md / Mobile: 1 matriz com toggle ── */}
        <div className="xl:hidden">
          <Card>
            <CardContent className="pt-5">
              <ConfusionMatrix
                data={singleResult?.matriz ?? []}
                totalAvaliacoes={singleResult?.totalAvaliacoes ?? 0}
                acuraciaGeral={singleResult?.acuraciaGeral ?? 0}
                isLoading={singleLoading}
                title={`Matriz ${filters.tipo === "humano" ? "Humano" : "IA"}`}
              />
            </CardContent>
          </Card>
        </div>

        {/* ── Card de Insights ── */}
        {insights.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2" style={{ color: "var(--l1)" }}>
                <Lightbulb className="h-4 w-4" style={{ color: "var(--accent)" }} />
                Insights Automáticos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--l2)" }}>
                    <InsightIcon type={insight.type} />
                    <span>{insight.text}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
