import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MonthlyEvolutionRecord {
  Ranking: number;
  Marca: string;
  "Mes_Ant_6"?: number;
  "Mes_Ant_5"?: number;
  "Mes_Ant_4"?: number;
  "Mes_Ant_3"?: number;
  "Mes_Ant_2"?: number;
  "Mes_Ant_1"?: number;
  "Mes_Atual"?: number;
  [key: string]: any;
}

interface MonthlyEvolutionTableProps {
  data: MonthlyEvolutionRecord[];
}

const formatNumber = (value: number) => value.toLocaleString("pt-BR");

const getGrowthTrend = (previous: number, current: number) => {
  if (previous === 0) return current > 0 ? "up" : "neutral";
  const change = ((current - previous) / previous) * 100;
  return change > 5 ? "up" : change < -5 ? "down" : "neutral";
};

const getTrendBadgeColor = (trend: string) => {
  if (trend === "up") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300";
  if (trend === "down") return "bg-rose-500/15 text-rose-600 dark:text-rose-300";
  return "bg-muted text-foreground";
};

export function MonthlyEvolutionTable({ data }: MonthlyEvolutionTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum dado disponível
      </div>
    );
  }

  // Extrair nomes dos meses dinamicamente dos headers
  const monthColumns = Object.keys(data[0])
    .filter((key) => key.startsWith("Mes_") || /^[A-Za-z]+$/.test(key))
    .filter((key) => key !== "Ranking" && key !== "Marca");

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 border-b border-border/70">
            <TableHead className="font-bold text-foreground w-12">#</TableHead>
            <TableHead className="font-bold text-foreground min-w-32">
              Marca/Fabricante
            </TableHead>
            {monthColumns.map((month) => (
              <TableHead
                key={month}
                className="font-bold text-foreground text-right"
              >
                {month}
              </TableHead>
            ))}
            <TableHead className="font-bold text-foreground text-right">
              Trend
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, idx) => {
            const values = monthColumns.map((col) => row[col] || 0);
            const latestValue = values[values.length - 1] || 0;
            const previousValue = values[values.length - 2] || 0;
            const trend = getGrowthTrend(previousValue, latestValue);

            return (
              <TableRow key={idx} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-bold text-foreground">
                  {row.Ranking}
                </TableCell>
                <TableCell className="font-semibold text-foreground">
                  {row.Marca}
                </TableCell>
                {monthColumns.map((month) => {
                  const value = row[month] || 0;
                  return (
                    <TableCell key={month} className="text-right font-semibold">
                      {formatNumber(value)}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right">
                  <Badge className={getTrendBadgeColor(trend)}>
                    {trend === "up" && (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    )}
                    {trend === "down" && (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {trend === "up"
                      ? "↑ +5%"
                      : trend === "down"
                        ? "↓ -5%"
                        : "→ 0%"}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
