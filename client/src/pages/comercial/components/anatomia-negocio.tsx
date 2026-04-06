import { Card, CardContent } from "@/components/ui/card";
import type { SimuladorInputs, SimuladorResult } from "../lib/simulador-calc";

interface AnatomiaNegocioProps {
  resultado: SimuladorResult;
  inputs: SimuladorInputs;
  revenda: string;
}

const fmtBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const fmtMarkup = (v: number) => `${v.toFixed(2).replace(".", ",")}x`;

type LineColor = "green" | "red" | "blue" | "yellow" | "total";

interface DRELine {
  icon: string;
  title: string;
  description: string;
  pctReceita: string;
  unitario: string;
  total: string;
  color: LineColor;
  bold?: boolean;
  separator?: boolean;
  hidden?: boolean;
}

const colorMap: Record<LineColor, { bg: string; text: string; border: string }> = {
  green: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "",
  },
  red: {
    bg: "bg-red-500/15",
    text: "text-red-700 dark:text-red-400",
    border: "",
  },
  blue: {
    bg: "bg-blue-500/15",
    text: "text-blue-700 dark:text-blue-400",
    border: "",
  },
  yellow: {
    bg: "bg-amber-500/15",
    text: "text-amber-700 dark:text-amber-400",
    border: "",
  },
  total: {
    bg: "bg-slate-500/15",
    text: "text-foreground",
    border: "border-t-2 border-b-2 border-border",
  },
};

function buildLines(
  resultado: SimuladorResult,
  inputs: SimuladorInputs,
): readonly DRELine[] {
  const { vendaTotal } = resultado;
  const { volume, vendaUn } = inputs;
  const safe = (v: number) => (vendaUn > 0 ? (v / vendaUn) * 100 : 0);

  const pisCofinsPct = inputs.pisPct + inputs.cofinsPct;
  const pisCofinUn = resultado.pisUn + resultado.cofinsUn;
  const pisCofinTotal = pisCofinUn * inputs.volume;

  const freteUn = inputs.frete;
  const cpdTotal = resultado.cpd * inputs.volume;

  return [
    {
      icon: "💰",
      title: "Receita de Revenda",
      description: "Preço de venda ao varejo",
      pctReceita: "100,0%",
      unitario: fmtBRL.format(vendaUn),
      total: fmtBRL.format(vendaTotal),
      color: "green",
    },
    {
      icon: "⬇",
      title: "CMC — Custo da Mercadoria",
      description: "Preço de compra do dispositivo",
      pctReceita: fmtPct(safe(inputs.compraUn)),
      unitario: fmtBRL.format(inputs.compraUn),
      total: fmtBRL.format(resultado.compraTotal),
      color: "red",
    },
    {
      icon: "↕",
      title: "Margem de Contribuição",
      description: "Receita − CMC",
      pctReceita: fmtPct(safe(resultado.margemContribUn)),
      unitario: fmtBRL.format(resultado.margemContribUn),
      total: fmtBRL.format(resultado.margemContribTotal),
      color: "green",
    },
    {
      icon: "🏛",
      title: "ICMS",
      description: `Alíquota ${fmtPct(inputs.icmsPct)}`,
      pctReceita: fmtPct(inputs.icmsPct),
      unitario: fmtBRL.format(resultado.icmsUn),
      total: fmtBRL.format(resultado.icmsUn * volume),
      color: "blue",
    },
    {
      icon: "🏛",
      title: "PIS + COFINS",
      description: `${fmtPct(inputs.pisPct)} + ${fmtPct(inputs.cofinsPct)}`,
      pctReceita: fmtPct(pisCofinsPct),
      unitario: fmtBRL.format(pisCofinUn),
      total: fmtBRL.format(pisCofinTotal),
      color: "blue",
    },
    {
      icon: "🚚",
      title: "Frete sobre Compra",
      description: "Custo logístico unitário",
      pctReceita: fmtPct(safe(freteUn)),
      unitario: fmtBRL.format(freteUn),
      total: fmtBRL.format(resultado.freteTotal),
      color: "yellow",
    },
    {
      icon: "🤝",
      title: "Comissão Varejista",
      description: `${fmtPct(inputs.comissaoVarPct)} s/ compra`,
      pctReceita: fmtPct(safe(resultado.comissaoVarUn)),
      unitario: fmtBRL.format(resultado.comissaoVarUn),
      total: fmtBRL.format(resultado.comissaoVarTotal),
      color: "yellow",
    },
    {
      icon: "👤",
      title: "Comissão Representante",
      description: `${fmtPct(inputs.comissaoRepPct)} s/ venda`,
      pctReceita: fmtPct(safe(resultado.comissaoRepUn)),
      unitario: fmtBRL.format(resultado.comissaoRepUn),
      total: fmtBRL.format(resultado.comissaoRepTotal),
      color: "yellow",
      hidden: inputs.comissaoRepPct <= 0,
    },
    {
      icon: "Σ",
      title: "Custo por Dispositivo (CPD)",
      description: "Soma de todos os custos",
      pctReceita: fmtPct(safe(resultado.cpd)),
      unitario: fmtBRL.format(resultado.cpd),
      total: fmtBRL.format(cpdTotal),
      color: "total",
      bold: true,
      separator: true,
    },
    {
      icon: "✓",
      title: "Margem Líquida",
      description: "Receita − CPD",
      pctReceita: fmtPct(resultado.margemPct),
      unitario: fmtBRL.format(resultado.margemLiqUn),
      total: fmtBRL.format(resultado.margemLiqTotal),
      color: "green",
      bold: true,
    },
    {
      icon: "📐",
      title: "Markup",
      description: `Meta: ${fmtMarkup(inputs.markupMeta)}`,
      pctReceita: "—",
      unitario: fmtMarkup(resultado.markup),
      total: `Meta: ${fmtMarkup(inputs.markupMeta)}`,
      color: resultado.markup >= inputs.markupMeta ? "green" : "yellow",
      bold: true,
    },
  ];
}

export function AnatomiaNegocio({ resultado, inputs, revenda }: AnatomiaNegocioProps) {
  const lines = buildLines(resultado, inputs);

  const subtitle = revenda
    ? `${inputs.volume} un. — ${revenda}`
    : `${inputs.volume} un.`;

  return (
    <Card
      className="border h-full"
      style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}
    >
      <CardContent className="pt-5 pb-4 px-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold">Anatomia do Negócio</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>

        {/* Header */}
        <div className="grid grid-cols-[1fr_68px_80px_90px] gap-1 mb-2 px-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Linha
          </span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">
            % Receita
          </span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">
            Unitário
          </span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">
            Total
          </span>
        </div>

        {/* Lines */}
        <div className="space-y-1">
          {lines.map((line) => {
            if (line.hidden) return null;

            const palette = colorMap[line.color];

            return (
              <div
                key={line.title}
                className={`grid grid-cols-[1fr_68px_80px_90px] gap-1 items-center rounded-md px-1 py-1.5
                  ${line.separator ? palette.border : ""}
                  ${line.bold ? "bg-muted/40" : ""}
                `}
              >
                {/* Label cell */}
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`flex items-center justify-center shrink-0 rounded-[7px] ${palette.bg}`}
                    style={{ width: 26, height: 26 }}
                  >
                    <span className="text-xs leading-none">{line.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-xs truncate ${line.bold ? "font-bold" : "font-semibold"} ${palette.text}`}
                    >
                      {line.title}
                    </p>
                    <p className="text-[9px] text-muted-foreground/40 truncate">
                      {line.description}
                    </p>
                  </div>
                </div>

                {/* % Receita */}
                <span
                  className={`text-[11px] tabular-nums text-right ${line.bold ? "font-bold" : "font-medium"} text-muted-foreground`}
                >
                  {line.pctReceita}
                </span>

                {/* Unitário */}
                <span
                  className={`text-[11px] tabular-nums text-right ${line.bold ? "font-bold" : "font-medium"} ${palette.text}`}
                >
                  {line.unitario}
                </span>

                {/* Total */}
                <span
                  className={`text-[11px] tabular-nums text-right ${line.bold ? "font-bold" : "font-medium"} ${palette.text}`}
                >
                  {line.total}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
