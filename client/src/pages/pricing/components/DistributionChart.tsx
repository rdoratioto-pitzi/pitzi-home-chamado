import React, { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
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

interface DistributionChartProps {
  data: TopRankingRecord[];
}

const COLORS = {
  gradeA: "#10b981",
  gradeB: "#3b82f6",
  gradeC: "#f59e0b",
  gradeD: "#ef4444",
};

export function DistributionChart({ data }: DistributionChartProps) {
  const gradeDistribution = useMemo(() => {
    const totalA = data.reduce((sum, row) => sum + (row.A || 0), 0);
    const totalB = data.reduce((sum, row) => sum + (row.B || 0), 0);
    const totalC = data.reduce((sum, row) => sum + (row.C || 0), 0);
    const totalD = data.reduce((sum, row) => sum + (row.D || 0), 0);

    return [
      { name: "Grade A", value: totalA, fill: COLORS.gradeA },
      { name: "Grade B", value: totalB, fill: COLORS.gradeB },
      { name: "Grade C", value: totalC, fill: COLORS.gradeC },
      { name: "Grade D", value: totalD, fill: COLORS.gradeD },
    ].filter((item) => item.value > 0);
  }, [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const total = gradeDistribution.reduce((sum, item) => sum + item.value, 0);
      const percent = ((value / total) * 100).toFixed(1);
      return (
        <div className="bg-popover p-2 border border-border rounded shadow-lg text-sm text-popover-foreground">
          <p className="font-semibold">{payload[0].name}</p>
          <p className="text-muted-foreground">{value.toLocaleString("pt-BR")}</p>
          <p className="text-muted-foreground">{percent}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="shadow-sm border-border/70 bg-card">
      <CardHeader className="border-b border-border/70 bg-card">
        <CardTitle className="text-lg font-bold text-foreground">
          Distribuição de Grades
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 flex items-center justify-center">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={gradeDistribution}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {gradeDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
