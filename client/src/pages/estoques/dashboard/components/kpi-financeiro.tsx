import { Truck, Warehouse, DollarSign, TrendingUp } from "lucide-react";
import { KpiCard } from "./kpi-card";

interface FinanceiroKpi {
  atual: number;
  anterior: number;
  variacao: number;
}

interface FinanceiroData {
  valorTransito: FinanceiroKpi;
  valorEstoque:  FinanceiroKpi;
  ticketMedio:   FinanceiroKpi;
  margemMedia:   FinanceiroKpi;
}

interface Props {
  dados?: FinanceiroData;
  isLoading: boolean;
}

export function KpiFinanceiro({ dados, isLoading }: Props) {
  return (
    <div className="space-y-2">
      <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
        Financeiro
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          titulo="Valor Trânsito"
          subtitulo="pré-estoque"
          valor={dados?.valorTransito.atual ?? 0}
          variacao={dados?.valorTransito.variacao}
          formato="moeda"
          icone={<Truck className="h-4 w-4" />}
          isLoading={isLoading}
          highlight
        />
        <KpiCard
          titulo="Valor Estoque"
          subtitulo="custo total (Omie)"
          valor={dados?.valorEstoque.atual ?? 0}
          variacao={dados?.valorEstoque.variacao}
          formato="moeda"
          icone={<Warehouse className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KpiCard
          titulo="Ticket Médio"
          subtitulo="por dispositivo"
          valor={dados?.ticketMedio.atual ?? 0}
          variacao={dados?.ticketMedio.variacao}
          formato="moeda"
          icone={<DollarSign className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KpiCard
          titulo="Margem Média"
          subtitulo="venda vs custo"
          valor={dados?.margemMedia.atual ?? 0}
          variacao={dados?.margemMedia.variacao}
          formato="percentual"
          icone={<TrendingUp className="h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
