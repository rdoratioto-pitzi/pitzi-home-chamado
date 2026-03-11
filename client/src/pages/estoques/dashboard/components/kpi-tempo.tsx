import { Clock, ArrowRightLeft, Timer, RefreshCw } from "lucide-react";
import { KpiCard } from "./kpi-card";

interface TempoKpi {
  media: number;
  meta: number;
  status: "dentro" | "acima" | "abaixo";
  variacao: number;
}

interface GiroKpi {
  valor: number;
  meta: number;
  status: "dentro" | "acima" | "abaixo";
  variacao: number;
}

interface TempoData {
  cicloTotal:      TempoKpi;
  cicloPreEstoque: TempoKpi;
  agingEstoque:    TempoKpi;
  giroMensal:      GiroKpi;
}

interface Props {
  dados?: TempoData;
  isLoading: boolean;
}

export function KpiTempo({ dados, isLoading }: Props) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
        Tempo
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          titulo="Ciclo Total"
          subtitulo="Voucher → Venda"
          valor={dados?.cicloTotal.media ?? 0}
          variacao={dados?.cicloTotal.variacao}
          variacaoBoa={false}
          meta={dados?.cicloTotal.meta}
          status={dados?.cicloTotal.status}
          formato="dias"
          icone={<Clock className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KpiCard
          titulo="Pré-Estoque"
          subtitulo="Voucher → Triagem"
          valor={dados?.cicloPreEstoque.media ?? 0}
          variacao={dados?.cicloPreEstoque.variacao}
          variacaoBoa={false}
          meta={dados?.cicloPreEstoque.meta}
          status={dados?.cicloPreEstoque.status}
          formato="dias"
          icone={<ArrowRightLeft className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KpiCard
          titulo="Aging Estoque"
          subtitulo="Triagem → Venda"
          valor={dados?.agingEstoque.media ?? 0}
          variacao={dados?.agingEstoque.variacao}
          variacaoBoa={false}
          meta={dados?.agingEstoque.meta}
          status={dados?.agingEstoque.status}
          formato="dias"
          icone={<Timer className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KpiCard
          titulo="Giro Mensal"
          subtitulo="renovações/mês"
          valor={dados?.giroMensal.valor ?? 0}
          variacao={dados?.giroMensal.variacao}
          meta={dados?.giroMensal.meta}
          metaLabel="x"
          status={dados?.giroMensal.status}
          formato="numero"
          icone={<RefreshCw className="h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
