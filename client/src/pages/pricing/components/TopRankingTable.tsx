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
import { useState } from "react";

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

interface TopRankingTableProps {
  data: TopRankingRecord[];
}

const getGradeBadgeColor = (grade: string) => {
  const colors: Record<string, string> = {
    A: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    B: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
    C: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
    D: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  };
  return colors[grade] || "bg-muted text-foreground";
};

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
const formatNumber = (value: number) => value.toLocaleString("pt-BR");

export function TopRankingTable({ data }: TopRankingTableProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum dado disponível
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 border-b border-border/70">
            <TableHead className="font-bold text-foreground w-12">#</TableHead>
            <TableHead className="font-bold text-foreground">Modelo</TableHead>
            <TableHead className="font-bold text-foreground text-right">
              Digitado
            </TableHead>
            <TableHead className="font-bold text-foreground text-right">
              Avaliado
            </TableHead>
            <TableHead className="font-bold text-foreground text-right">
              Comprado
            </TableHead>
            <TableHead className="font-bold text-foreground text-right">
              RR
            </TableHead>
            <TableHead className="font-bold text-foreground text-right">
              CR
            </TableHead>
            <TableHead className="font-bold text-foreground text-right">
              Grades
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, idx) => (
            <React.Fragment key={idx}>
              <TableRow
                className="hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() =>
                  setExpandedRow(expandedRow === idx ? null : idx)
                }
              >
                <TableCell className="font-bold text-foreground">
                  {row.Ranking}
                </TableCell>
                <TableCell className="max-w-xs">
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      {row.Descrição}
                    </p>
                    <p className="text-xs text-muted-foreground">{row.Fabricante}</p>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold text-foreground">
                  {formatNumber(row.Digitado)}
                </TableCell>
                <TableCell className="text-right font-semibold text-foreground">
                  {formatNumber(row.Avaliado)}
                </TableCell>
                <TableCell className="text-right font-semibold text-foreground">
                  {formatNumber(row.Comprado)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant={row.RR > 0.3 ? "destructive" : "default"}
                    className="justify-center"
                  >
                    {formatPercent(row.RR)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge className="justify-center bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20">
                    {formatPercent(row.CR)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    {[
                      { label: "A", value: row.A },
                      { label: "B", value: row.B },
                      { label: "C", value: row.C },
                      { label: "D", value: row.D },
                    ].map(
                      (grade) =>
                        grade.value > 0 && (
                          <Badge
                            key={grade.label}
                            className={`text-xs ${getGradeBadgeColor(
                              grade.label
                            )} hover:opacity-80`}
                          >
                            {grade.label}: {formatNumber(grade.value)}
                          </Badge>
                        )
                    )}
                  </div>
                </TableCell>
              </TableRow>

              {/* Linha de detalhes expandida */}
              {expandedRow === idx && (
                <TableRow className="bg-muted/30 border-t border-border/70">
                  <TableCell colSpan={8} className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs font-semibold mb-1">
                          COMPRA POR GRADE
                        </p>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Grade A:</span>
                            <span className="font-semibold">
                              {formatNumber(row["Compra A"])}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Grade B:</span>
                            <span className="font-semibold">
                              {formatNumber(row["Compra B"])}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Grade C:</span>
                            <span className="font-semibold">
                              {formatNumber(row["Compra C"])}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Grade D:</span>
                            <span className="font-semibold">
                              {formatNumber(row["Compra D"])}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-muted-foreground text-xs font-semibold mb-1">
                          DEFEITOS
                        </p>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Avaliados c/ defeito:
                            </span>
                            <span className="font-semibold">
                              {formatNumber(row["Avaliado c/ Defeito"])}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              % de defeito:
                            </span>
                            <span className="font-semibold">
                              {formatPercent(row.Percentual_Defeito)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-muted-foreground text-xs font-semibold mb-1">
                          MÉTRICAS
                        </p>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Taxa RR:</span>
                            <span className="font-semibold">
                              {formatPercent(row.RR)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Taxa CR:</span>
                            <span className="font-semibold">
                              {formatPercent(row.CR)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-muted-foreground text-xs font-semibold mb-1">
                          EFICIÊNCIA
                        </p>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Média Grade:</span>
                            <span className="font-semibold">
                              {(
                                (row.A * 4 +
                                  row.B * 3 +
                                  row.C * 2 +
                                  row.D * 1) /
                                (row.A + row.B + row.C + row.D || 1)
                              ).toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
