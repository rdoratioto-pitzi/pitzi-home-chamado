import { AlertTriangle, CheckCircle2, Zap, Activity } from "lucide-react";
import { KpiCard } from "./kpi-card";

interface EficienciaKpiMeta {
  atual: number;
  meta: number;
  status: "dentro" | "acima" | "abaixo";
  variacao: number;
}

interface EficienciaCriticos {
  atual: number;
  anterior: number;
  variacao: number;
}

interface EficienciaData {
  taxaDesvios:   EficienciaKpiMeta;
  slaAtingido:   EficienciaKpiMeta;
  criticos:      EficienciaCriticos;
  produtividade: EficienciaKpiMeta;
}

interface Props {
  dados?: EficienciaData;
  isLoading: boolean;
}

export function KpiEficiencia({ dados, isLoading }: Props) {
  return (
    <div className="space-y-2">
      <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
        Eficiência
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          titulo="Taxa Desvios"
          subtitulo="Bloq+Manut+Div"
          valor={dados?.taxaDesvios.atual ?? 0}
          variacao={dados?.taxaDesvios.variacao}
          variacaoBoa={false}
          meta={dados?.taxaDesvios.meta}
          status={dados?.taxaDesvios.status}
          formato="percentual"
          icone={<AlertTriangle className="h-4 w-4" />}
          isLoading={isLoading}
          highlight
        />
        <KpiCard
          titulo="SLA Atingido"
          subtitulo="ciclo ≤ 30 dias"
          valor={dados?.slaAtingido.atual ?? 0}
          variacao={dados?.slaAtingido.variacao}
          meta={dados?.slaAtingido.meta}
          status={dados?.slaAtingido.status}
          formato="percentual"
          icone={<CheckCircle2 className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KpiCard
          titulo="Críticos"
          subtitulo="> 30 dias no processo"
          valor={dados?.criticos.atual ?? 0}
          variacao={dados?.criticos.variacao}
          variacaoBoa={false}
          formato="numero"
          icone={<Zap className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KpiCard
          titulo="Produtividade"
          subtitulo="triagens/dia útil"
          valor={dados?.produtividade.atual ?? 0}
          variacao={dados?.produtividade.variacao}
          meta={dados?.produtividade.meta}
          status={dados?.produtividade.status}
          formato="numero"
          icone={<Activity className="h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
