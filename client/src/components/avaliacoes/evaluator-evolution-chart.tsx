import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Bot } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AvaliacoesFilters, AvaliadorEvolucaoItem } from "@/hooks/use-avaliacoes";
import { useAvaliadorEvolucao } from "@/hooks/use-avaliacoes";

interface EvaluatorEvolutionChartProps {
  filtros?: AvaliacoesFilters;
}

type Granularidade = "dia" | "mes";

const LINE_COLORS = [
  "#00A137", "#378ADD", "#C07A00", "#C53030", "#6366f1",
  "#ec4899", "#14b8a6", "#f97316", "#8b5cf6", "#06b6d4",
];

function formatAxisDate(value: string, gran: Granularidade): string {
  try {
    const d = parseISO(value.length === 7 ? `${value}-01` : value);
    if (gran === "mes") return format(d, "MMM/yy", { locale: ptBR });
    return format(d, "dd/MM", { locale: ptBR });
  } catch {
    return value;
  }
}

function formatTooltipDate(value: string, gran: Granularidade): string {
  try {
    const d = parseISO(value.length === 7 ? `${value}-01` : value);
    if (gran === "mes") return format(d, "MMMM yyyy", { locale: ptBR });
    return format(d, "dd 'de' MMMM", { locale: ptBR });
  } catch {
    return value;
  }
}

export function EvaluatorEvolutionChart({ filtros = {} }: EvaluatorEvolutionChartProps) {
  const [granularidade, setGranularidade] = useState<Granularidade>("dia");
  const [selectedAvaliadores, setSelectedAvaliadores] = useState<Set<string>>(new Set());

  const { data, isLoading } = useAvaliadorEvolucao(filtros, granularidade);
  const avaliadores: AvaliadorEvolucaoItem[] = data?.data?.avaliadores ?? [];

  // Sort by total volume descending, show top 5 by default
  const sortedAvaliadores = useMemo(() =>
    [...avaliadores].sort((a, b) => {
      const totalA = a.dados.reduce((s, d) => s + d.total, 0);
      const totalB = b.dados.reduce((s, d) => s + d.total, 0);
      return totalB - totalA;
    }),
    [avaliadores]
  );

  const visibleAvaliadores = useMemo(() => {
    if (selectedAvaliadores.size > 0) {
      return sortedAvaliadores.filter((a) => selectedAvaliadores.has(a.nome));
    }
    return sortedAvaliadores.slice(0, 5);
  }, [sortedAvaliadores, selectedAvaliadores]);

  // Build chart data: pivot to { periodo, [nome]: assertividade }
  const chartData = useMemo(() => {
    const allPeriodos = new Set<string>();
    for (const av of visibleAvaliadores) {
      for (const d of av.dados) allPeriodos.add(d.periodo);
    }
    const sorted = Array.from(allPeriodos).sort();
    return sorted.map((periodo) => {
      const row: Record<string, string | number> = { periodo };
      for (const av of visibleAvaliadores) {
        const ponto = av.dados.find((d) => d.periodo === periodo);
        if (ponto) row[av.nome] = ponto.assertividade;
      }
      return row;
    });
  }, [visibleAvaliadores]);

  const hasExtraAvaliadores = sortedAvaliadores.length > 5;

  function toggleAvaliador(nome: string) {
    setSelectedAvaliadores((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  }

  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Evolucao dos Avaliadores
            </CardTitle>
            <CardDescription>Assertividade por avaliador ao longo do tempo</CardDescription>
          </div>
          <Select value={granularidade} onValueChange={(v) => setGranularidade(v as Granularidade)}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dia">Por dia</SelectItem>
              <SelectItem value="mes">Por mes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="h-[280px] flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : chartData.length > 0 && visibleAvaliadores.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--sep)" />
                <XAxis
                  dataKey="periodo"
                  tick={{ fontSize: 10, fill: "var(--l3)" }}
                  tickFormatter={(v) => formatAxisDate(v, granularidade)}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "var(--l3)" }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ background: "var(--bg2)", border: "1px solid var(--sep)", borderRadius: 6 }}
                  labelStyle={{ color: "var(--l1)", fontSize: 12 }}
                  itemStyle={{ fontSize: 11 }}
                  labelFormatter={(v) => formatTooltipDate(v, granularidade)}
                  formatter={(value: number, name: string) => {
                    const av = visibleAvaliadores.find((a) => a.nome === name);
                    const ponto = av?.dados.find((d) => chartData.some((cd) => cd.periodo === (cd as any).periodo && cd[name] === value));
                    const volume = ponto?.total ?? "";
                    return [`${value.toFixed(1)}%${volume ? ` (${volume} disp.)` : ""}`, name];
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: "var(--l2)" }}
                  formatter={(value: string) => {
                    const av = visibleAvaliadores.find((a) => a.nome === value);
                    return av?.isAutomatica ? `${value} (Auto)` : value;
                  }}
                />
                <ReferenceLine
                  y={80}
                  stroke="#00A137"
                  strokeDasharray="6 3"
                  strokeOpacity={0.4}
                  label={{ value: "Meta 80%", position: "insideTopRight", fill: "#00A137", fontSize: 10, opacity: 0.6 }}
                />
                {visibleAvaliadores.map((av, idx) => (
                  <Line
                    key={av.nome}
                    type="monotone"
                    dataKey={av.nome}
                    name={av.nome}
                    stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                    strokeWidth={av.isAutomatica ? 1 : 2}
                    strokeDasharray={av.isAutomatica ? "5 5" : undefined}
                    dot={{ r: 3, fill: LINE_COLORS[idx % LINE_COLORS.length] }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>

            {/* Avaliador selector (when >5) */}
            {hasExtraAvaliadores && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t" style={{ borderColor: "var(--sep)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide w-full mb-1" style={{ color: "var(--l3)" }}>
                  Selecionar avaliadores ({sortedAvaliadores.length} total)
                </p>
                {sortedAvaliadores.map((av, idx) => {
                  const isVisible = selectedAvaliadores.size === 0
                    ? idx < 5
                    : selectedAvaliadores.has(av.nome);
                  return (
                    <button
                      key={av.nome}
                      onClick={() => toggleAvaliador(av.nome)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border transition-colors"
                      style={{
                        borderColor: isVisible ? LINE_COLORS[idx % LINE_COLORS.length] : "var(--sep)",
                        background: isVisible ? `${LINE_COLORS[idx % LINE_COLORS.length]}15` : "transparent",
                        color: isVisible ? LINE_COLORS[idx % LINE_COLORS.length] : "var(--l3)",
                      }}
                    >
                      {av.isAutomatica && <Bot className="h-2.5 w-2.5" />}
                      {av.nome}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm text-center px-4">
            Inicie a curadoria para ver a evolucao dos avaliadores.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
