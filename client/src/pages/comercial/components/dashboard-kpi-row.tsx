import { type ReactNode } from "react";
import { type DashboardMonth, formatBRL, formatPct } from "../lib/dashboard-data";

interface DashboardKpiRowProps {
  data: DashboardMonth;
}

function MargemBadge({ margemUn }: { margemUn: number }) {
  if (margemUn >= 80) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
        Saudável
      </span>
    );
  }
  if (margemUn >= 40) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
        Margem frágil
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
      Risco
    </span>
  );
}

export function DashboardKpiRow({ data }: DashboardKpiRowProps) {
  const receitaTotal = data.faturamentoTotal > 0 ? data.faturamentoTotal : data.volume * data.ticket;

  const icmsUn = data.ticket * (data.icmsPct / 100);
  const pisUn = data.ticket * (data.pisPct / 100);
  const cofinsUn = data.ticket * (data.cofinsPct / 100);
  const comissaoVarUn = data.cmc * (data.comissaoVarPct / 100);
  const comissaoRepUn = data.ticket * (data.comissaoRepPct / 100);
  const cpdUn = data.cpdMedio > 0
    ? data.cpdMedio
    : data.cmc + icmsUn + pisUn + cofinsUn + data.frete + comissaoVarUn + comissaoRepUn;
  const cpdPctReceita = data.ticket > 0 ? (cpdUn / data.ticket) * 100 : 0;

  const mcPctReceita = receitaTotal > 0 ? (data.mcTotal / receitaTotal) * 100 : 0;

  const cards: { title: string; value: string; sub?: string; badge?: ReactNode; color: string }[] = [
    {
      title: "Ticket Revenda",
      value: formatBRL(data.ticket),
      color: "text-foreground",
    },
    {
      title: "CMC Médio",
      value: formatBRL(data.cmc),
      color: "text-foreground",
    },
    {
      title: "CPD Médio",
      value: formatBRL(cpdUn),
      sub: `${formatPct(cpdPctReceita)} da receita`,
      color: "text-red-600",
    },
    {
      title: "MC Total",
      value: formatBRL(data.mcTotal),
      sub: `${formatPct(mcPctReceita)} da receita`,
      color: "text-emerald-600",
    },
    {
      title: "Margem Líquida / Un",
      value: formatBRL(data.margemUn),
      badge: <MargemBadge margemUn={data.margemUn} />,
      color: "text-emerald-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-lg border bg-card p-5"
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {card.title}
          </p>
          <p className={`mt-2 text-2xl font-bold ${card.color}`}>{card.value}</p>
          {card.sub && (
            <p className="mt-1 text-sm text-muted-foreground">{card.sub}</p>
          )}
          {card.badge && <div className="mt-2">{card.badge}</div>}
        </div>
      ))}
    </div>
  );
}
