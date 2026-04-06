import { Card, CardContent } from "@/components/ui/card";
import type { SimuladorResult } from "../lib/simulador-calc";

interface SimuladorResultsProps {
  result: SimuladorResult;
  markupMeta: number;
}

const fmtBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function valueColor(value: number): string {
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

function markupColor(markup: number, meta: number): string {
  if (markup >= meta) return "border-emerald-500/50 bg-emerald-500/5";
  if (markup >= 1.20) return "border-yellow-500/50 bg-yellow-500/5";
  return "border-red-500/50 bg-red-500/5";
}

function markupTextColor(markup: number, meta: number): string {
  if (markup >= meta) return "text-emerald-600 dark:text-emerald-400";
  if (markup >= 1.20) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export function SimuladorResults({ result, markupMeta }: SimuladorResultsProps) {
  const cards = [
    {
      label: "MC / Un",
      value: fmtBRL.format(result.margemContribUn),
      colorClass: valueColor(result.margemContribUn),
      borderClass: "",
    },
    {
      label: "Markup",
      value: `${result.markup.toFixed(2)}x`,
      colorClass: markupTextColor(result.markup, markupMeta),
      borderClass: markupColor(result.markup, markupMeta),
    },
    {
      label: "Margem Líq. / Un",
      value: fmtBRL.format(result.margemLiqUn),
      colorClass: valueColor(result.margemLiqUn),
      borderClass: "",
    },
    {
      label: "Margem Líq. Total",
      value: fmtBRL.format(result.margemLiqTotal),
      colorClass: valueColor(result.margemLiqTotal),
      borderClass: "",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card
          key={card.label}
          className={`border ${card.borderClass}`}
          style={{ background: "var(--bg2)", borderColor: card.borderClass ? undefined : "var(--sep)" }}
        >
          <CardContent className="p-3">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              {card.label}
            </p>
            <p className={`text-lg font-bold tabular-nums ${card.colorClass}`}>
              {card.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
