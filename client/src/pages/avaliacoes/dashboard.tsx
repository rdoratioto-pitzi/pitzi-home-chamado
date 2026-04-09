import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AccuracyTrendChart } from "@/components/avaliacoes/accuracy-trend-chart";
import { EvaluatorRanking } from "@/components/avaliacoes/evaluator-ranking";
import { CostImpactCard } from "@/components/avaliacoes/cost-impact-card";
import { EvaluatorEvolutionChart } from "@/components/avaliacoes/evaluator-evolution-chart";
import { DashboardFilters } from "@/components/avaliacoes/dashboard-filters";
import {
  useAvaliacoesResumo,
  useEvolucaoIA,
  useDispositivosIA,
  useCategoriasIA,
  useAssertividadeFotos,
  useEvolucaoCategoriaIA,
  useImeiIA,
  useVersaoIAAtual,
  useVersoesIA,
} from "@/hooks/use-avaliacoes";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  CheckCircle2, XCircle, Camera, TrendingUp, Bot,
  TrendingDown, Smartphone, ArrowUpRight, ArrowDownRight, Cpu, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AvaliacoesFilters, AvaliacaoImeiItem, VersaoIA } from "@/hooks/use-avaliacoes";

// ─── Grade helpers ───────────────────────────────────────────────────────────

type Grade = "A" | "B" | "C";

const GRADE_ORDER: Record<string, number> = { A: 0, B: 1, C: 2 };

function normalizeGrade(raw: string | null | undefined): Grade | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  if (upper === "D") return "C";
  if (upper === "A" || upper === "B" || upper === "C") return upper as Grade;
  return null;
}

function worstGrade(grades: (Grade | null)[]): Grade | null {
  const valid = grades.filter((g): g is Grade => g !== null);
  if (valid.length === 0) return null;
  return valid.reduce((worst, g) =>
    (GRADE_ORDER[g] ?? 0) > (GRADE_ORDER[worst] ?? 0) ? g : worst
  );
}

// Map foto description to area
function isDisplayFoto(desc: string): boolean {
  const lower = desc.toLowerCase();
  return ["tela", "frente", "front", "display", "screen"].some((p) => lower.includes(p));
}

// ─── Aggregate IMEI data into per-device metrics ────────────────────────────

interface DeviceMetrics {
  imei: string;
  gradeIaDisplay: Grade | null;
  gradeIaCarcaca: Grade | null;
  gradeHumanoDisplay: Grade | null;
  gradeHumanoCarcaca: Grade | null;
  // Grade final = pior nota entre TODAS as fotos (display + carcaça)
  gradeIaFinal: Grade | null;
  gradeHumanoFinal: Grade | null;
}

function aggregateDeviceMetrics(items: AvaliacaoImeiItem[], imeiFilter?: string): DeviceMetrics[] {
  const filtered = imeiFilter
    ? items.filter((i) => i.Imei?.includes(imeiFilter))
    : items;

  const grouped = new Map<string, {
    displayIa: (Grade | null)[]; displayHumano: (Grade | null)[];
    carcacaIa: (Grade | null)[]; carcacaHumano: (Grade | null)[];
  }>();

  for (const item of filtered) {
    const desc = item.Descricao_Captura || "";
    if (desc.toLowerCase().includes("video") || desc.toLowerCase().includes("360")) continue;

    const gradeIa = normalizeGrade(item.Nota_IA);
    const gradeHumano = normalizeGrade(item.Nota_Humana);

    if (!grouped.has(item.Imei)) {
      grouped.set(item.Imei, {
        displayIa: [], displayHumano: [],
        carcacaIa: [], carcacaHumano: [],
      });
    }
    const d = grouped.get(item.Imei)!;

    if (isDisplayFoto(desc)) {
      d.displayIa.push(gradeIa);
      d.displayHumano.push(gradeHumano);
    } else {
      d.carcacaIa.push(gradeIa);
      d.carcacaHumano.push(gradeHumano);
    }
  }

  return Array.from(grouped.entries()).map(([imei, d]) => {
    const gradeIaDisplay = worstGrade(d.displayIa);
    const gradeIaCarcaca = worstGrade(d.carcacaIa);
    const gradeHumanoDisplay = worstGrade(d.displayHumano);
    const gradeHumanoCarcaca = worstGrade(d.carcacaHumano);
    return {
      imei,
      gradeIaDisplay,
      gradeIaCarcaca,
      gradeHumanoDisplay,
      gradeHumanoCarcaca,
      gradeIaFinal: worstGrade([...d.displayIa, ...d.carcacaIa]),
      gradeHumanoFinal: worstGrade([...d.displayHumano, ...d.carcacaHumano]),
    };
  });
}

// ─── KPI Strip — device-level metrics ────────────────────────────────────────

interface DeviceKpis {
  totalDispositivos: number;
  assertividadeGeral: number;
  concordantes: number;
  divergentes: number;
}

function computeDeviceKpis(devices: DeviceMetrics[]): DeviceKpis {
  let concordantes = 0;
  let divergentes = 0;
  let comparaveis = 0;

  for (const d of devices) {
    // Assertividade pela grade final: pior nota única entre todas as fotos
    if (d.gradeIaFinal !== null && d.gradeHumanoFinal !== null) {
      comparaveis++;
      if (d.gradeIaFinal === d.gradeHumanoFinal) concordantes++;
      else divergentes++;
    }
  }

  return {
    totalDispositivos: devices.length,
    assertividadeGeral: comparaveis > 0 ? Math.round((concordantes / comparaveis) * 1000) / 10 : 0,
    concordantes,
    divergentes,
  };
}

// ─── Assertividade por grade final (IMEI-based, não por foto) ────────────────

function buildGradeBreakdown(
  devices: DeviceMetrics[]
): Array<{ grade: string; acertos: number; total: number; assertividade: number }> {
  const gradeMap = new Map<string, { acertos: number; total: number }>();

  for (const d of devices) {
    if (d.gradeHumanoFinal === null || d.gradeIaFinal === null) continue;
    const grade = d.gradeHumanoFinal;
    const existing = gradeMap.get(grade) ?? { acertos: 0, total: 0 };
    gradeMap.set(grade, {
      acertos: existing.acertos + (d.gradeIaFinal === grade ? 1 : 0),
      total: existing.total + 1,
    });
  }

  return ["A", "B", "C"].map((grade) => {
    const g = gradeMap.get(grade) ?? { acertos: 0, total: 0 };
    return { grade, ...g, assertividade: g.total > 0 ? Math.round((g.acertos / g.total) * 1000) / 10 : 0 };
  });
}

function DeviceKpiStrip({ kpis, isLoading }: { kpis: DeviceKpis; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
            <CardHeader className="pb-2"><Skeleton className="h-3 w-28" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-20" /><Skeleton className="h-3 w-32 mt-2" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <Card style={{ background: "var(--vf)", border: "none" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#FFF" }}>
            Total Dispositivos
          </CardTitle>
          <Smartphone className="h-4 w-4" style={{ color: "#FFF" }} />
        </CardHeader>
        <CardContent>
          <div className="text-[28px] font-bold" style={{ color: "#FFF" }}>
            {kpis.totalDispositivos.toLocaleString("pt-BR")}
          </div>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>IMEIs unicos no periodo</p>
        </CardContent>
      </Card>

      <Card style={{ background: "var(--vf)", border: "none" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#FFF" }}>
            Assertividade Geral
          </CardTitle>
          <Bot className="h-4 w-4" style={{ color: "#FFF" }} />
        </CardHeader>
        <CardContent>
          <div className="text-[28px] font-bold" style={{ color: "#FFF" }}>
            {kpis.assertividadeGeral.toFixed(1)}%
          </div>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>grade IA = grade humano por dispositivo</p>
        </CardContent>
      </Card>

      <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--l3)" }}>
            Concordantes
          </CardTitle>
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        </CardHeader>
        <CardContent>
          <div className="text-[28px] font-bold text-emerald-400">
            {kpis.concordantes.toLocaleString("pt-BR")}
          </div>
          <p className="text-xs text-muted-foreground mt-1">IA = humano (ambas areas)</p>
        </CardContent>
      </Card>

      <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--l3)" }}>
            Divergentes
          </CardTitle>
          <XCircle className="h-4 w-4 text-red-400" />
        </CardHeader>
        <CardContent>
          <div className="text-[28px] font-bold text-red-400">
            {kpis.divergentes.toLocaleString("pt-BR")}
          </div>
          <p className="text-xs text-muted-foreground mt-1">IA != humano em alguma area</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Bidirectional error card ────────────────────────────────────────────────

interface ErrorBreakdown {
  overGrading: number;
  underGrading: number;
  total: number;
}

function computeErrorBreakdown(devices: DeviceMetrics[]): ErrorBreakdown {
  let overGrading = 0;
  let underGrading = 0;

  for (const d of devices) {
    // Check display
    if (d.gradeIaDisplay && d.gradeHumanoDisplay && d.gradeIaDisplay !== d.gradeHumanoDisplay) {
      const iaOrder = GRADE_ORDER[d.gradeIaDisplay] ?? 0;
      const humOrder = GRADE_ORDER[d.gradeHumanoDisplay] ?? 0;
      if (iaOrder < humOrder) overGrading++; // IA gave better grade (A < C in order)
      else underGrading++; // IA gave worse grade
    }
    // Check carcaca
    if (d.gradeIaCarcaca && d.gradeHumanoCarcaca && d.gradeIaCarcaca !== d.gradeHumanoCarcaca) {
      const iaOrder = GRADE_ORDER[d.gradeIaCarcaca] ?? 0;
      const humOrder = GRADE_ORDER[d.gradeHumanoCarcaca] ?? 0;
      if (iaOrder < humOrder) overGrading++;
      else underGrading++;
    }
  }

  return { overGrading, underGrading, total: overGrading + underGrading };
}

function BidirectionalErrorCard({ errors, isLoading }: { errors: ErrorBreakdown; isLoading: boolean }) {
  const overPct = errors.total > 0 ? Math.round((errors.overGrading / errors.total) * 100) : 0;
  const underPct = errors.total > 0 ? Math.round((errors.underGrading / errors.total) * 100) : 0;

  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold" style={{ color: "var(--l1)" }}>
          Direcao das Divergencias
        </CardTitle>
        <CardDescription className="text-xs">
          Quando a IA erra, ela superestima ou subestima a qualidade?
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : errors.total > 0 ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <ArrowUpRight className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Over-grading</span>
                  <span className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
                    {errors.overGrading} ({overPct}%)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  IA deu grade melhor que a correta (ex: IA=A, correto=C) — Renov paga mais
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <ArrowDownRight className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">Under-grading</span>
                  <span className="text-sm font-bold tabular-nums text-blue-700 dark:text-blue-400">
                    {errors.underGrading} ({underPct}%)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  IA deu grade pior que a correta (ex: IA=C, correto=A) — cliente recebe menos
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma divergencia no periodo.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Grafico de evolucao (proxy) ──────────────────────────────────────────────

function ProxyEvolutionChart({ filtros, versoes }: { filtros: AvaliacoesFilters; versoes: VersaoIA[] }) {
  const { data, isLoading } = useEvolucaoIA(filtros);

  const pontos = useMemo(() => {
    if (!data) return [];
    return data.map((item) => ({
      data: item.Mes.slice(0, 7),
      assertividade: item.Acuracia_Mensal,
      totalAvaliados: item.Total_Avaliados,
    }));
  }, [data]);

  // Linhas de versão que estão no range de datas do filtro
  const versoesFiltradas = useMemo(() => {
    if (!versoes.length || !pontos.length) return versoes;
    const datas = pontos.map((p) => p.data);
    const min = datas[0];
    const max = datas[datas.length - 1];
    return versoes.filter((v) => {
      const mesVersao = v.data.slice(0, 7);
      return mesVersao >= min && mesVersao <= max;
    });
  }, [versoes, pontos]);

  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Evolucao da Assertividade IA
        </CardTitle>
        <CardDescription>Precisao da IA por dispositivo (grade final) ao longo do tempo</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[220px] flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : pontos.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={pontos} margin={{ top: 4, right: 4, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--sep)" />
              <XAxis
                dataKey="data"
                tick={{ fontSize: 10, fill: "var(--l3)" }}
                tickFormatter={(v) => { try { return format(parseISO(`${v}-01`), "MMM/yy", { locale: ptBR }); } catch { return v; } }}
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--l3)" }} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: "var(--bg2)", border: "1px solid var(--sep)", borderRadius: 6 }}
                labelStyle={{ color: "var(--l1)", fontSize: 12 }}
                labelFormatter={(v) => { try { return format(parseISO(`${v}-01`), "MMMM yyyy", { locale: ptBR }); } catch { return v; } }}
                formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--l2)" }} />
              {versoesFiltradas.map((v) => (
                <ReferenceLine
                  key={v.data}
                  x={v.data.slice(0, 7)}
                  stroke="var(--vf)"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{ value: v.versao, position: "top", fontSize: 9, fill: "var(--vf)" }}
                />
              ))}
              <Line type="monotone" dataKey="assertividade" name="Assertividade IA" stroke="#00A137" strokeWidth={2} dot={{ r: 4, fill: "#00A137" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
            Nenhum dado disponivel para o periodo selecionado.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Assertividade por Grade (proxy, D->C) ────────────────────────────────────

function AssertividadePorGradeCard({ resumoIA, isLoading }: { resumoIA: Array<{ grade: string; acertos: number; total: number; assertividade: number }>; isLoading: boolean }) {
  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold" style={{ color: "var(--l1)" }}>
          Assertividade por Grade
        </CardTitle>
        <CardDescription className="text-xs">Precisao da IA em cada faixa de qualidade (Grade D consolidada em C)</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : (
          <div className="space-y-3">
            {resumoIA.map(({ grade, acertos, total, assertividade }) => (
              <div key={grade}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Grade {grade}</span>
                  <span className={`text-sm font-bold tabular-nums ${assertividade >= 60 ? "text-emerald-400" : assertividade >= 30 ? "text-yellow-400" : "text-red-400"}`}>
                    {assertividade.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${assertividade >= 60 ? "bg-emerald-400" : assertividade >= 30 ? "bg-yellow-400" : "bg-red-400"}`}
                    style={{ width: `${assertividade}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {acertos.toLocaleString("pt-BR")} acertos / {total.toLocaleString("pt-BR")} total
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Top 10 Melhor Assertividade ─────────────────────────────────────────────

function Top10MelhorCard({ filtros }: { filtros: AvaliacoesFilters }) {
  const { data, isLoading } = useDispositivosIA(filtros);

  const top10 = useMemo(() =>
    [...(data ?? [])]
      .filter((d) => d.Total_Avaliados >= 5)
      .sort((a, b) => b.Acuracia - a.Acuracia)
      .slice(0, 10),
    [data]
  );

  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--l1)" }}>
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          Top 10 — Melhor Assertividade
        </CardTitle>
        <CardDescription className="text-xs">Modelos com maior precisao da IA (min. 5 avaliacoes)</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
        ) : top10.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">#</TableHead>
                  <TableHead className="text-xs">Dispositivo</TableHead>
                  <TableHead className="text-right text-xs">Total</TableHead>
                  <TableHead className="text-right text-xs">Assert.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top10.map((d, idx) => (
                  <TableRow key={d.Dispositivo}>
                    <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="text-xs font-medium truncate max-w-[160px]">{d.Dispositivo}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{d.Total_Avaliados.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums font-semibold text-emerald-400">
                      {d.Acuracia.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum dado para o periodo.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Top 10 Maior Taxa de Erro ────────────────────────────────────────────────

function Top10PiorCard({ filtros }: { filtros: AvaliacoesFilters }) {
  const { data, isLoading } = useDispositivosIA(filtros);

  const top10 = useMemo(() =>
    [...(data ?? [])]
      .filter((d) => d.Total_Avaliados >= 5)
      .sort((a, b) => a.Acuracia - b.Acuracia)
      .slice(0, 10),
    [data]
  );

  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--l1)" }}>
          <TrendingDown className="h-4 w-4 text-red-400" />
          Top 10 — Maior Taxa de Erro
        </CardTitle>
        <CardDescription className="text-xs">Modelos onde a IA mais erra (min. 5 avaliacoes)</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
        ) : top10.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">#</TableHead>
                  <TableHead className="text-xs">Dispositivo</TableHead>
                  <TableHead className="text-right text-xs">Total</TableHead>
                  <TableHead className="text-right text-xs">Assert.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top10.map((d, idx) => (
                  <TableRow key={d.Dispositivo}>
                    <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="text-xs font-medium truncate max-w-[160px]">{d.Dispositivo}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{d.Total_Avaliados.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums font-semibold text-red-400">
                      {d.Acuracia.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum dado para o periodo.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Taxa por Categoria (proxy) ───────────────────────────────────────────────

function CategoriaCard({ filtros }: { filtros: AvaliacoesFilters }) {
  const { data, isLoading } = useCategoriasIA(filtros);

  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold" style={{ color: "var(--l1)" }}>
          Taxa de Acerto por Categoria
        </CardTitle>
        <CardDescription className="text-xs">Assertividade da IA por tipo de dispositivo</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : (data ?? []).length > 0 ? (
          <div className="space-y-3">
            {(data ?? []).map((cat) => (
              <div key={cat.Categoria}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{cat.Categoria}</span>
                  <span className={`text-xs font-bold tabular-nums ${cat.Acuracia >= 60 ? "text-emerald-400" : cat.Acuracia >= 30 ? "text-yellow-400" : "text-red-400"}`}>
                    {cat.Acuracia.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${cat.Acuracia >= 60 ? "bg-emerald-400" : cat.Acuracia >= 30 ? "bg-yellow-400" : "bg-red-400"}`}
                    style={{ width: `${cat.Acuracia}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {cat.Total_Avaliados.toLocaleString("pt-BR")} avaliacoes
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum dado para o periodo.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Evolucao por Categoria (ultimos 3 meses) ─────────────────────────────────

function EvolucaoCategoriaCard({ filtros }: { filtros: AvaliacoesFilters }) {
  const { data, isLoading } = useEvolucaoCategoriaIA(filtros);

  const { pivot, sortedMonths, sortedCategories } = useMemo(() => {
    const p: Record<string, Record<string, number>> = {};
    const months = new Set<string>();
    const categories = new Set<string>();

    (data ?? []).forEach((item) => {
      if (!p[item.Categoria]) p[item.Categoria] = {};
      p[item.Categoria][item.Mes] = item.Acuracia_Mensal;
      months.add(item.Mes);
      categories.add(item.Categoria);
    });

    const sm = Array.from(months).sort().reverse().slice(0, 3).reverse();
    const sc = Array.from(categories).sort();
    return { pivot: p, sortedMonths: sm, sortedCategories: sc };
  }, [data]);

  if (!isLoading && sortedCategories.length === 0) return null;

  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold" style={{ color: "var(--l1)" }}>
          Evolucao por Categoria (ultimos 3 meses)
        </CardTitle>
        <CardDescription className="text-xs">Tendencia de assertividade por tipo de dispositivo</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Categoria</TableHead>
                  {sortedMonths.map((m) => (
                    <TableHead key={m} className="text-right text-xs">
                      {(() => { try { return format(parseISO(`${m.slice(0, 7)}-01`), "MMM/yy", { locale: ptBR }); } catch { return m; } })()}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCategories.map((cat) => (
                  <TableRow key={cat}>
                    <TableCell className="text-xs font-medium">{cat}</TableCell>
                    {sortedMonths.map((m) => {
                      const val = pivot[cat]?.[m];
                      return (
                        <TableCell key={m} className="text-right text-xs tabular-nums">
                          {val != null ? (
                            <span className={val >= 60 ? "text-emerald-400" : val >= 30 ? "text-yellow-400" : "text-red-400"}>
                              {val.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Assertividade por Tipo de Foto ──────────────────────────────────────────

function AssertividadeFotosSection({ filtros }: { filtros: AvaliacoesFilters }) {
  const { data: fotosData, isLoading } = useAssertividadeFotos(filtros);

  const aggregated = (fotosData ?? []).reduce<Record<string, { total: number; acertos: number }>>((acc, item) => {
    const nome = item.Nome_da_Tela || "Desconhecido";
    if (!acc[nome]) acc[nome] = { total: 0, acertos: 0 };
    acc[nome].total += item.Total_Fotos;
    acc[nome].acertos += item.Acertos;
    return acc;
  }, {});

  const rows = Object.entries(aggregated)
    .map(([nome, { total, acertos }]) => ({
      nome, total, acertos,
      assertividade: total > 0 ? Math.round((acertos / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  if (!isLoading && rows.length === 0) return null;

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
          Em qual angulo/tipo de foto a IA tem mais dificuldade (dados por foto, nao por dispositivo)
        </p>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tipo de Foto</TableHead>
                  <TableHead className="text-right text-xs">Total</TableHead>
                  <TableHead className="text-right text-xs">Acertos</TableHead>
                  <TableHead className="text-right text-xs">Assert.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.nome}>
                    <TableCell className="text-xs font-medium max-w-[200px] truncate">{r.nome}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{r.total.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{r.acertos.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums font-semibold">
                      <span className={r.assertividade >= 60 ? "text-emerald-400" : r.assertividade >= 30 ? "text-yellow-400" : "text-red-400"}>
                        {r.assertividade.toFixed(1)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULT_DATA_INICIO = "2026-03-20";
const DEFAULT_DATA_FIM = new Date().toISOString().slice(0, 10);

export default function AvaliacoesDashboardPage() {
  const [filters, setFilters] = useState<AvaliacoesFilters>({
    area: "ambas",
    dataInicio: DEFAULT_DATA_INICIO,
    dataFim: DEFAULT_DATA_FIM,
  });
  const [, navigate] = useLocation();

  // Versão IA
  const { data: versaoAtualData } = useVersaoIAAtual();
  const { data: versoesData } = useVersoesIA();
  const versaoAtual = versaoAtualData?.data ?? null;
  const versoes: VersaoIA[] = versoesData?.data ?? [];
  const [versaoHistoricoAberto, setVersaoHistoricoAberto] = useState(false);

  // IMEI data for device-level KPIs (always enabled)
  const limitDate = filters.dataFim ?? new Date().toISOString().slice(0, 10);
  const { data: imeiData, isLoading: imeiLoading } = useImeiIA(limitDate, true);

  // Filter IMEI data by date range on the frontend (API only accepts limit_date)
  const imeiDataFiltrado = useMemo(() => {
    if (!imeiData) return [];
    const inicio = filters.dataInicio;
    const fim = filters.dataFim;
    return imeiData.filter((item) => {
      const data = item.Criacao_Pedido?.slice(0, 10);
      if (!data) return true;
      if (inicio && data < inicio) return false;
      if (fim && data > fim) return false;
      return true;
    });
  }, [imeiData, filters.dataInicio, filters.dataFim]);

  // Process device-level metrics from IMEI data
  const deviceMetrics = useMemo(() => {
    return aggregateDeviceMetrics(imeiDataFiltrado, filters.imei);
  }, [imeiDataFiltrado, filters.imei]);

  const deviceKpis = useMemo(() => computeDeviceKpis(deviceMetrics), [deviceMetrics]);
  const errorBreakdown = useMemo(() => computeErrorBreakdown(deviceMetrics), [deviceMetrics]);
  const gradeBreakdown = useMemo(() => buildGradeBreakdown(deviceMetrics), [deviceMetrics]);

  // Dados de curadoria (DB local)
  const { data: resumoCuradoriaData, isLoading: curadoriaLoading } = useAvaliacoesResumo(filters);
  const temCuradoria = (resumoCuradoriaData?.data?.totalCurados ?? 0) > 0;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Avaliacoes — Dashboard" />
      <div className="container mx-auto px-4 py-6 space-y-6">

        {/* Breadcrumb + Badge de versão IA */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem><BreadcrumbPage>Avaliacoes</BreadcrumbPage></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>Dashboard</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {versaoAtual && (
            <div className="flex flex-col items-end gap-1">
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 cursor-default">
                      <Cpu className="h-3 w-3" style={{ color: "var(--l3)" }} />
                      <span className="text-[11px]" style={{ color: "var(--l3)" }}>
                        IA {versaoAtual.versao} — {(() => { try { return format(parseISO(versaoAtual.data), "dd/MM/yyyy"); } catch { return versaoAtual.data; } })()}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[220px]">
                    <p className="font-medium">Modelo de IA da Lapisco</p>
                    <p className="text-muted-foreground mt-0.5">Última atualização: {versaoAtual.data}</p>
                    {versaoAtual.descricao && <p className="mt-0.5">{versaoAtual.descricao}</p>}
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
              {versoes.length > 1 && (
                <button
                  className="text-[10px] flex items-center gap-0.5"
                  style={{ color: "var(--l3)" }}
                  onClick={() => setVersaoHistoricoAberto((v) => !v)}
                >
                  Histórico de versões
                  {versaoHistoricoAberto ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
              {versaoHistoricoAberto && (
                <div className="text-right space-y-0.5 mt-1">
                  {versoes.map((v) => (
                    <p key={v.data + v.versao} className="text-[10px]" style={{ color: "var(--l3)" }}>
                      {v.versao} — {(() => { try { return format(parseISO(v.data), "dd/MM/yyyy"); } catch { return v.data; } })()} — {v.descricao}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs principais */}
        <Tabs defaultValue="visao-geral" className="space-y-6">
          <TabsList className="h-9">
            <TabsTrigger value="visao-geral" className="text-xs sm:text-sm">
              Visao Geral
            </TabsTrigger>
            <TabsTrigger value="curadoria" className="text-xs sm:text-sm">
              Metricas de Curadoria
            </TabsTrigger>
          </TabsList>

          {/* ── Aba 1: Visao Geral ────────────────────────────────────────── */}
          <TabsContent value="visao-geral" className="space-y-6 mt-0">

            {/* Filtros (includes IMEI filter) */}
            <DashboardFilters filters={filters} onChange={setFilters} />

            {/* KPIs por dispositivo (IMEIs unicos) */}
            <DeviceKpiStrip kpis={deviceKpis} isLoading={imeiLoading} />

            {/* Grafico evolucao + Grade breakdown */}
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <ProxyEvolutionChart filtros={filters} versoes={versoes} />
              </div>
              <div className="lg:col-span-2">
                <AssertividadePorGradeCard resumoIA={gradeBreakdown} isLoading={imeiLoading} />
              </div>
            </div>

            {/* Top 10 Melhor + Top 10 Pior */}
            <div className="grid gap-4 md:grid-cols-2">
              <Top10MelhorCard filtros={filters} />
              <Top10PiorCard filtros={filters} />
            </div>

            {/* Taxa por Categoria + Evolucao por Categoria */}
            <div className="grid gap-4 md:grid-cols-2">
              <CategoriaCard filtros={filters} />
              <EvolucaoCategoriaCard filtros={filters} />
            </div>

            {/* Assertividade por tipo de foto + Direcao das divergencias */}
            <div className="grid gap-4 md:grid-cols-2">
              <AssertividadeFotosSection filtros={filters} />
              <BidirectionalErrorCard errors={errorBreakdown} isLoading={imeiLoading} />
            </div>

          </TabsContent>

          {/* ── Aba 2: Metricas de Curadoria ─────────────────────────────── */}
          <TabsContent value="curadoria" className="space-y-6 mt-0">

            {/* Filtros compartilhados */}
            <DashboardFilters filters={filters} onChange={setFilters} />

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold" style={{ color: "var(--l1)" }}>
                  Metricas de Curadoria
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Acuracia IA vs avaliador humano, ranking e impacto financeiro
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/avaliacoes/curadoria")}>
                Acessar Curadoria
              </Button>
            </div>

            {!temCuradoria && !curadoriaLoading ? (
              <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
                <CardContent className="py-10 text-center">
                  <p className="text-muted-foreground text-sm">
                    Inicie a curadoria para ver metricas de acuracia IA vs avaliador humano, custo do erro e evolucao historica.
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    className="mt-4"
                    onClick={() => navigate("/avaliacoes/curadoria")}
                  >
                    Iniciar Curadoria
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <AccuracyTrendChart filtros={filters} />
                <div className="grid gap-4 md:grid-cols-2">
                  <EvaluatorRanking filtros={filters} />
                  <CostImpactCard filtros={filters} />
                </div>
                <EvaluatorEvolutionChart filtros={filters} />
              </>
            )}

          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
