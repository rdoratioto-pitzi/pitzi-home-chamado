import { type DashboardMonth, formatBRL, formatPct } from "../lib/dashboard-data";

interface DashboardBreakdownProps {
  data: DashboardMonth;
}

export function DashboardBreakdown({ data }: DashboardBreakdownProps) {
  const cmcPctReceita = data.ticket > 0 ? (data.cmc / data.ticket) * 100 : 0;
  const icmsUn = data.ticket * (data.icmsPct / 100);
  const pisUn = data.ticket * (data.pisPct / 100);
  const cofinsUn = data.ticket * (data.cofinsPct / 100);
  const pisCofinsUn = pisUn + cofinsUn;
  const pisCofinsTotal = data.pisPct + data.cofinsPct;
  const fretePct = data.ticket > 0 ? (data.frete / data.ticket) * 100 : 0;
  const comissaoTotalPct = data.comissaoVarPct + data.comissaoRepPct;
  const comissaoUn = data.ticket * (comissaoTotalPct / 100);

  const cards = [
    {
      title: "CMC / Receita",
      pct: formatPct(cmcPctReceita),
      value: `${formatBRL(data.cmc)}/un`,
    },
    {
      title: "ICMS",
      pct: formatPct(data.icmsPct),
      value: `${formatBRL(icmsUn)}/un`,
    },
    {
      title: "PIS + COFINS",
      pct: formatPct(pisCofinsTotal),
      value: `${formatBRL(pisCofinsUn)}/un`,
    },
    {
      title: "Frete",
      pct: formatPct(fretePct),
      value: `${formatBRL(data.frete)}/un`,
    },
    {
      title: "Comissão Média",
      pct: formatPct(comissaoTotalPct),
      value: `${formatBRL(comissaoUn)}/un`,
    },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Composição do CPD
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-lg border bg-card p-4"
          >
            <p className="text-xs font-medium text-muted-foreground">{card.title}</p>
            <p className="mt-2 text-xl font-bold text-foreground">{card.pct}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
