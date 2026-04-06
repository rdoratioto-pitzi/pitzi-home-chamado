import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import type { Grade } from "@/hooks/use-avaliacoes";

interface MatrizEntry {
  atribuido: Grade;
  correto: Grade;
  quantidade: number;
  percentual: number;
}

export interface ConfusionMatrixProps {
  data: MatrizEntry[];
  totalAvaliacoes: number;
  acuraciaGeral: number;
  isLoading: boolean;
  title?: string;
}

const GRADES: Grade[] = ["A", "B", "C"];

function getCellBg(isDiagonal: boolean, rowPct: number): string {
  if (isDiagonal) {
    if (rowPct >= 90) return "rgba(34,197,94,0.22)";
    if (rowPct >= 70) return "rgba(34,197,94,0.14)";
    if (rowPct > 0) return "rgba(34,197,94,0.07)";
    return "transparent";
  }
  if (rowPct >= 20) return "rgba(239,68,68,0.22)";
  if (rowPct >= 10) return "rgba(239,68,68,0.14)";
  if (rowPct >= 1) return "rgba(239,68,68,0.07)";
  return "transparent";
}

function getCellBoxShadow(isDiagonal: boolean): string | undefined {
  return isDiagonal ? "inset 0 0 0 2px rgba(34,197,94,0.30)" : undefined;
}

export function ConfusionMatrix({
  data,
  totalAvaliacoes,
  acuraciaGeral,
  isLoading,
  title,
}: ConfusionMatrixProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {title && (
          <p className="text-sm font-semibold" style={{ color: "var(--l1)" }}>
            {title}
          </p>
        )}
        <div className="grid grid-cols-4 gap-1">
          {Array.from({ length: 16 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        {title && (
          <p className="text-sm font-semibold mb-3" style={{ color: "var(--l1)" }}>
            {title}
          </p>
        )}
        <p className="text-sm max-w-xs" style={{ color: "var(--l3)" }}>
          Nenhum dado de curadoria disponível. Realize curadorias para ver a matriz.
        </p>
      </div>
    );
  }

  // Build lookup map and row totals
  const lookup = new Map<string, number>();
  for (const entry of data) {
    lookup.set(`${entry.atribuido}|${entry.correto}`, entry.quantidade);
  }

  const rowTotals = new Map<Grade, number>();
  for (const g of GRADES) {
    const rowTotal = GRADES.reduce(
      (sum, c) => sum + (lookup.get(`${g}|${c}`) ?? 0),
      0
    );
    rowTotals.set(g, rowTotal);
  }

  const acuraciaColor =
    acuraciaGeral >= 80
      ? "rgb(34,197,94)"
      : acuraciaGeral >= 60
      ? "rgb(234,179,8)"
      : "rgb(239,68,68)";

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {title && (
          <p className="text-sm font-semibold" style={{ color: "var(--l1)" }}>
            {title}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[240px]">
            <thead>
              <tr>
                <th className="p-0 w-10" />
                <th
                  colSpan={3}
                  className="py-2 px-3 text-center text-[10px] uppercase tracking-wide font-semibold"
                  style={{ color: "var(--l3)" }}
                >
                  Grade Correta (Curadoria)
                </th>
              </tr>
              <tr>
                <th
                  className="pb-2 px-2 text-[10px] uppercase tracking-wide text-left font-normal"
                  style={{ color: "var(--l3)", borderBottom: "2px solid var(--sep)" }}
                >
                  Atribuído ↓
                </th>
                {GRADES.map((g) => (
                  <th
                    key={g}
                    className="pb-2 px-4 text-center font-bold text-sm"
                    style={{
                      color: "var(--l1)",
                      borderBottom: "2px solid var(--sep)",
                    }}
                  >
                    {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GRADES.map((atribuido) => {
                const rowTotal = rowTotals.get(atribuido) ?? 0;
                return (
                  <tr key={atribuido}>
                    <td
                      className="py-2 px-2 font-bold text-sm text-center"
                      style={{
                        color: "var(--l1)",
                        borderRight: "2px solid var(--sep)",
                      }}
                    >
                      {atribuido}
                    </td>
                    {GRADES.map((correto) => {
                      const isDiagonal = atribuido === correto;
                      const quantidade = lookup.get(`${atribuido}|${correto}`) ?? 0;
                      const rowPct =
                        rowTotal > 0
                          ? Math.round((quantidade / rowTotal) * 1000) / 10
                          : 0;
                      const bg = getCellBg(isDiagonal, rowPct);
                      const boxShadow = getCellBoxShadow(isDiagonal);
                      const tooltipText = isDiagonal
                        ? `Classificação correta: Grade ${atribuido} — ${quantidade} ocorrências (${rowPct}% da linha)`
                        : `Atribuído ${atribuido}, curadoria corrigiu para ${correto} — ${quantidade} ocorrências (${rowPct}% da linha)`;

                      return (
                        <Tooltip key={correto}>
                          <TooltipTrigger asChild>
                            <td
                              className="transition-colors"
                              style={{
                                backgroundColor: bg,
                                boxShadow,
                                border: "1px solid var(--sep)",
                                cursor: "default",
                              }}
                            >
                              <div className="py-2 px-3 text-center select-none">
                                <div
                                  className="font-semibold text-sm tabular-nums"
                                  style={{ color: "var(--l1)" }}
                                >
                                  {quantidade}
                                </div>
                                <div
                                  className="text-[11px] tabular-nums"
                                  style={{ color: "var(--l3)" }}
                                >
                                  {rowPct}%
                                </div>
                              </div>
                            </td>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs max-w-[200px]">{tooltipText}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
          <span className="text-[11px]" style={{ color: "var(--l3)" }}>
            Avaliações curadas:{" "}
            <span className="font-semibold" style={{ color: "var(--l2)" }}>
              {totalAvaliacoes}
            </span>
          </span>
          <span className="text-[11px]" style={{ color: "var(--l3)" }}>
            Acurácia geral:{" "}
            <span
              className="font-bold text-sm tabular-nums"
              style={{ color: acuraciaColor }}
            >
              {acuraciaGeral}%
            </span>
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}
