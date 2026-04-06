import { type DashboardMonth, formatBRL, formatNumber, formatPct } from "../lib/dashboard-data";

interface DashboardHeroProps {
  data: DashboardMonth;
}

export function DashboardHero({ data }: DashboardHeroProps) {
  const markup = data.cmc > 0 ? data.ticket / data.cmc : 0;
  const markupMeta = 1.35;
  const naMeta = markup >= markupMeta;

  const margemPctRevenda = data.faturamentoTotal > 0
    ? (data.margemTotal / data.faturamentoTotal) * 100
    : 0;

  const items = [
    {
      title: "Vendas",
      value: formatNumber(data.volume),
      sub: "Dispositivos vendidos",
    },
    {
      title: "Markup Real",
      value: `${markup.toFixed(2).replace(".", ",")}x`,
      sub: naMeta ? (
        <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
          Na meta
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full bg-red-500/30 px-2 py-0.5 text-xs font-medium">
          Abaixo da meta
        </span>
      ),
    },
    {
      title: "Faturamento Total",
      value: formatBRL(data.faturamentoTotal),
      sub: `Ticket médio ${formatBRL(data.ticket)}`,
    },
    {
      title: "Margem Líquida Total",
      value: formatBRL(data.margemTotal),
      sub: `${formatPct(margemPctRevenda, 2)} sobre faturamento`,
    },
  ];

  return (
    <div className="rounded-lg bg-emerald-600 text-white">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => (
          <div
            key={item.title}
            className={`px-6 py-5 ${i > 0 ? "sm:border-l border-white/20" : ""}`}
          >
            <p className="text-xs font-medium text-emerald-100 uppercase tracking-wide">
              {item.title}
            </p>
            <p className="mt-1 text-2xl font-bold">{item.value}</p>
            <div className="mt-1 text-sm text-emerald-100">{item.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
