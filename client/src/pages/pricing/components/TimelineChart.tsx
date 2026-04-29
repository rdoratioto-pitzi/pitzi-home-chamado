import React, { useMemo } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TopRankingRecord {
  Ranking: number;
  Digitado: number;
  Avaliado: number;
  Comprado: number;
  RR: number;
  CR: number;
  Fabricante: string;
  Descrição: string;
  A: number;
  B: number;
  C: number;
  D: number;
  "Avaliado c/ Defeito": number;
  Percentual_Defeito: number;
  "Compra A": number;
  "Compra B": number;
  "Compra C": number;
  "Compra D": number;
}

interface TimelineChartProps {
  data: TopRankingRecord[];
}

export function TimelineChart({ data }: TimelineChartProps) {
  // Pegar os top 10 por volume e criar um gráfico de tendência
  const chartData = useMemo(() => {
    const top10 = data.slice(0, 10);

    return top10.map((item) => ({
      name: item.Descrição.substring(0, 20) + "...",
      digitado: item.Digitado,
      avaliado: item.Avaliado,
      comprado: item.Comprado,
    }));
  }, [data]);

  return (
    <Card className="shadow-sm border-border/70 bg-card">
      <CardHeader className="border-b border-border/70 bg-card">
        <CardTitle className="text-lg font-bold text-foreground">
          Volume Top 10 Modelos
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "4px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Legend wrapperStyle={{ color: "hsl(var(--muted-foreground))" }} />
            <Bar dataKey="digitado" fill="#3b82f6" name="Digitado" radius={[4, 4, 0, 0]} />
            <Bar dataKey="avaliado" fill="#10b981" name="Avaliado" radius={[4, 4, 0, 0]} />
            <Bar dataKey="comprado" fill="#00A137" name="Comprado" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
