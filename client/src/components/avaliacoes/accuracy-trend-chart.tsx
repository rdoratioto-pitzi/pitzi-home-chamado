import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { EvolucaoPonto, AvaliacoesFilters } from "@/hooks/use-avaliacoes";
import { useAvaliacoesEvolucao } from "@/hooks/use-avaliacoes";

interface AccuracyTrendChartProps {
  filtros?: Omit<AvaliacoesFilters, "granularidade">;
}

type Granularidade = "diaria" | "semanal" | "mensal";

function formatAxisDate(value: string, gran: Granularidade): string {
  try {
    const d = parseISO(value.length === 7 ? `${value}-01` : value);
    if (gran === "mensal") return format(d, "MMM/yy", { locale: ptBR });
    if (gran === "semanal") return format(d, "dd/MM", { locale: ptBR });
    return format(d, "dd/MM", { locale: ptBR });
  } catch {
    return value;
  }
}

function formatTooltipDate(value: string, gran: Granularidade): string {
  try {
    const d = parseISO(value.length === 7 ? `${value}-01` : value);
    if (gran === "mensal") return format(d, "MMMM yyyy", { locale: ptBR });
    return format(d, "dd 'de' MMMM", { locale: ptBR });
  } catch {
    return value;
  }
}

export function AccuracyTrendChart({ filtros = {} }: AccuracyTrendChartProps) {
  const [granularidade, setGranularidade] = useState<Granularidade>("diaria");
  const { data, isLoading } = useAvaliacoesEvolucao({ ...filtros, granularidade });
  const pontos: EvolucaoPonto[] = data?.data ?? [];

  return (
    <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Evolução de Acurácia
            </CardTitle>
            <CardDescription>Comparativo IA vs Avaliador Humano ao longo do tempo</CardDescription>
          </div>
          <Select value={granularidade} onValueChange={(v) => setGranularidade(v as Granularidade)}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="diaria">Diário</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[260px] flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : pontos.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={pontos} margin={{ top: 4, right: 4, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--sep)" />
              <XAxis
                dataKey="data"
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
                itemStyle={{ fontSize: 12 }}
                labelFormatter={(v) => formatTooltipDate(v, granularidade)}
                formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--l2)" }} />
              <Line
                type="monotone"
                dataKey="acuraciaIa"
                name="IA (Lapisco)"
                stroke="#00A137"
                strokeWidth={2}
                dot={{ r: 3, fill: "#00A137" }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="acuraciaHumano"
                name="Humano"
                stroke="#378ADD"
                strokeWidth={2}
                dot={{ r: 3, fill: "#378ADD" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm text-center px-4">
            Nenhum dado de curadoria ainda. Inicie a curadoria para ver métricas.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
