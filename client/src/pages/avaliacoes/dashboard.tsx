import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { DashboardFilters } from "@/components/avaliacoes/dashboard-filters";
import {
  useAvaliacoesResumo, useResumoIA, useEvolucaoIA, useDispositivosIA,
  useCategoriasIA, useAssertividadeFotos,
} from "@/hooks/use-avaliacoes";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart2, CheckCircle2, XCircle, Camera, TrendingUp, Bot,
} from "lucide-react";
import type { AvaliacoesFilters } from "@/hooks/use-avaliacoes";

// ─── KPI Strip — dados reais da API proxy ─────────────────────────────────────

function ProxyKpiStrip({
  total, acertos, erros, assertividade, isLoading,
}: { total: number; acertos: number; erros: number; assertividade: number; isLoading: boolean }) {
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
            Total Avaliações
          </CardTitle>
          <BarChart2 className="h-4 w-4" style={{ color: "#FFF" }} />
        </CardHeader>
        <CardContent>
          <div className="text-[28px] font-bold" style={{ color: "#FFF" }}>
            {total.toLocaleString("pt-BR")}
          </div>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>registros no período</p>
        </CardContent>
      </Card>

      <Card style={{ background: "var(--vf)", border: "none" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#FFF" }}>
            Assertividade Geral IA
          </CardTitle>
          <Bot className="h-4 w-4" style={{ color: "#FFF" }} />
        </CardHeader>
        <CardContent>
          <div className="text-[28px] font-bold" style={{ color: "#FFF" }}>
            {assertividade.toFixed(1)}%
          </div>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>grade IA vs grade humano</p>
        </CardContent>
      </Card>

      <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--l3)" }}>
            Total Acertos
          </CardTitle>
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        </CardHeader>
        <CardContent>
          <div className="text-[28px] font-bold text-emerald-400">
            {acertos.toLocaleString("pt-BR")}
          </div>
          <p className="text-xs text-muted-foreground mt-1">IA acertou a grade</p>
        </CardContent>
      </Card>

      <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--l3)" }}>
            Total Erros
          </CardTitle>
          <XCircle className="h-4 w-4 text-red-400" />
        </CardHeader>
        <CardContent>
          <div className="text-[28px] font-bold text-red-400">
            {erros.toLocaleString("pt-BR")}
          </div>
          <p className="text-xs text-muted-foreground mt-1">IA errou a grade</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Gráfico de evolução (proxy) ──────────────────────────────────────────────

function ProxyEvolutionChart({ filtros }: { filtros: AvaliacoesFilters }) {
  const { data, isLoading } = useEvolucaoIA(filtros);

  const pontos = useMemo(() => {
    if (!data) return [];
    return data.map((item) => ({
      data: item.Mes.slice(0, 7),
      assertividade: item.Acuracia_Mensal,
      totalAvaliados: item.Total_Avaliados,
    }));
  }, [data]);

  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Evolução da Assertividade IA
        </CardTitle>
        <CardDescription>Precisão da IA ao longo do tempo (dados por foto)</CardDescription>
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
              <Line type="monotone" dataKey="assertividade" name="Assertividade IA" stroke="#00A137" strokeWidth={2} dot={{ r: 4, fill: "#00A137" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
            Nenhum dado disponível para o período selecionado.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Assertividade por Grade (proxy, D→C) ────────────────────────────────────

function AssertividadePorGradeCard({ resumoIA, isLoading }: { resumoIA: Array<{ grade: string; acertos: number; total: number; assertividade: number }>; isLoading: boolean }) {
  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold" style={{ color: "var(--l1)" }}>
          Assertividade por Grade
        </CardTitle>
        <CardDescription className="text-xs">Precisão da IA em cada faixa de qualidade</CardDescription>
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

// ─── Top Dispositivos (proxy) ─────────────────────────────────────────────────

function TopDispositivosCard({ filtros }: { filtros: AvaliacoesFilters }) {
  const { data, isLoading } = useDispositivosIA(filtros);
  const top10 = useMemo(() => (data ?? []).slice(0, 10), [data]);

  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold" style={{ color: "var(--l1)" }}>
          Top Dispositivos
        </CardTitle>
        <CardDescription className="text-xs">Modelos com maior volume de avaliações</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
        ) : top10.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Dispositivo</TableHead>
                  <TableHead className="text-right text-xs">Total</TableHead>
                  <TableHead className="text-right text-xs">Assert.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top10.map((d) => (
                  <TableRow key={d.Dispositivo}>
                    <TableCell className="text-xs font-medium truncate max-w-[180px]">{d.Dispositivo}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{d.Total_Avaliados.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className={`text-right text-xs tabular-nums font-semibold ${d.Acuracia >= 60 ? "text-emerald-400" : d.Acuracia >= 30 ? "text-yellow-400" : "text-red-400"}`}>
                      {d.Acuracia.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum dado para o período.</p>
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
          Taxa por Categoria
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
                  {cat.Total_Avaliados.toLocaleString("pt-BR")} avaliações
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum dado para o período.</p>
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
          Em qual ângulo/tipo de foto a IA tem mais dificuldade (dados por foto, não por dispositivo)
        </p>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AvaliacoesDashboardPage() {
  const [filters, setFilters] = useState<AvaliacoesFilters>({ area: "ambas" });
  const [, navigate] = useLocation();

  // Dados da API proxy (reais)
  const { data: resumoIAData, isLoading: resumoIALoading } = useResumoIA(filters);

  // Processar resumo: mesclar Grade D→C, calcular totais
  const resumoProcessado = useMemo(() => {
    if (!resumoIAData) return { total: 0, acertos: 0, erros: 0, assertividade: 0, porGrade: [] as Array<{ grade: string; acertos: number; total: number; assertividade: number }> };

    const gradeMap = new Map<string, { acertos: number; total: number }>();
    let totalGeral = 0, acertosGeral = 0;

    for (const item of resumoIAData) {
      // Grade D → C (POP 101 V3)
      const grade = item.Grade_Humano_Real === "D" ? "C" : item.Grade_Humano_Real;
      const existing = gradeMap.get(grade) ?? { acertos: 0, total: 0 };
      gradeMap.set(grade, {
        acertos: existing.acertos + item.Qtd_Acertos_IA,
        total: existing.total + item.Total_Avaliados,
      });
      totalGeral += item.Total_Avaliados;
      acertosGeral += item.Qtd_Acertos_IA;
    }

    const porGrade = ["A", "B", "C"].map((grade) => {
      const g = gradeMap.get(grade) ?? { acertos: 0, total: 0 };
      return { grade, ...g, assertividade: g.total > 0 ? Math.round((g.acertos / g.total) * 1000) / 10 : 0 };
    });

    return {
      total: totalGeral,
      acertos: acertosGeral,
      erros: totalGeral - acertosGeral,
      assertividade: totalGeral > 0 ? Math.round((acertosGeral / totalGeral) * 1000) / 10 : 0,
      porGrade,
    };
  }, [resumoIAData]);

  // Dados de curadoria (DB local — ficam zerados até curadoria ser iniciada)
  const { data: resumoCuradoriaData, isLoading: curadoriaLoading } = useAvaliacoesResumo(filters);
  const temCuradoria = (resumoCuradoriaData?.data?.totalCurados ?? 0) > 0;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Avaliações — Dashboard" />
      <div className="container mx-auto px-4 py-6 space-y-6">

        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbPage>Avaliações</BreadcrumbPage></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Dashboard</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Filtros */}
        <DashboardFilters filters={filters} onChange={setFilters} />

        {/* ── KPIs da API RenovSmart (dados reais) ── */}
        <ProxyKpiStrip
          total={resumoProcessado.total}
          acertos={resumoProcessado.acertos}
          erros={resumoProcessado.erros}
          assertividade={resumoProcessado.assertividade}
          isLoading={resumoIALoading}
        />

        {/* ── Evolução da Assertividade (dados reais) ── */}
        <ProxyEvolutionChart filtros={filters} />

        {/* ── Breakdown: Grade + Dispositivos + Categorias ── */}
        <div className="grid gap-4 md:grid-cols-3">
          <AssertividadePorGradeCard resumoIA={resumoProcessado.porGrade} isLoading={resumoIALoading} />
          <TopDispositivosCard filtros={filters} />
          <CategoriaCard filtros={filters} />
        </div>

        {/* ── Assertividade por tipo de foto (proxy) ── */}
        <AssertividadeFotosSection filtros={filters} />

        {/* ── Métricas de Curadoria (DB local) ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold" style={{ color: "var(--l1)" }}>
              Métricas de Curadoria
            </h2>
            <Button variant="outline" size="sm" onClick={() => navigate("/avaliacoes/curadoria")}>
              Acessar Curadoria
            </Button>
          </div>

          {!temCuradoria && !curadoriaLoading ? (
            <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground text-sm">
                  Inicie a curadoria para ver métricas de acurácia IA vs avaliador humano, custo do erro e evolução histórica.
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
            </>
          )}
        </div>

      </div>
    </div>
  );
}
