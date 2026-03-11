import { Package, ShoppingCart, Truck, Warehouse } from "lucide-react";
import { KpiCard } from "./kpi-card";

interface VolumeData {
  processados: { atual: number; anterior: number; variacao: number };
  vendidos:    { atual: number; anterior: number; variacao: number };
  emTransito:  { atual: number; anterior: number; variacao: number };
  emEstoque:   { atual: number; anterior: number; variacao: number };
}

interface Props {
  dados?: VolumeData;
  isLoading: boolean;
}

export function KpiVolume({ dados, isLoading }: Props) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
        Volume
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          titulo="Processados"
          subtitulo="no período"
          valor={dados?.processados.atual ?? 0}
          variacao={dados?.processados.variacao}
          formato="numero"
          icone={<Package className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KpiCard
          titulo="Triados"
          subtitulo="no período"
          valor={dados?.vendidos.atual ?? 0}
          variacao={dados?.vendidos.variacao}
          formato="numero"
          icone={<ShoppingCart className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KpiCard
          titulo="Em Trânsito"
          subtitulo="atual"
          valor={dados?.emTransito.atual ?? 0}
          variacao={dados?.emTransito.variacao}
          variacaoBoa={false}
          formato="numero"
          icone={<Truck className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KpiCard
          titulo="Em Estoque"
          subtitulo="atual (Omie)"
          valor={dados?.emEstoque.atual ?? 0}
          variacao={dados?.emEstoque.variacao}
          formato="numero"
          icone={<Warehouse className="h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
