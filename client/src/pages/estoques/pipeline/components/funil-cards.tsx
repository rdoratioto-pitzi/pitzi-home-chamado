import { Package, CheckCircle, Truck, BoxIcon, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export interface EtapaPipeline {
  nome: string;
  quantidade: number;
  valor: number;
  porMes: Record<string, number>;
  criticos: number;
}

const ETAPA_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  voucher:     { label: "Voucher Utilizado",    icon: Package,      color: "text-blue-600" },
  confirmacao: { label: "Confirm. Gerente",     icon: CheckCircle,  color: "text-indigo-600" },
  coleta:      { label: "Coleta/Trânsito",      icon: Truck,        color: "text-violet-600" },
  recebimento: { label: "Recebimento",          icon: BoxIcon,      color: "text-purple-600" },
  triagem:     { label: "Triagem",              icon: Layers,       color: "text-fuchsia-600" },
};

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

interface Props {
  etapas: EtapaPipeline[];
  isLoading: boolean;
  onClickEtapa: (nome: string) => void;
}

export function FunilCards({ etapas, isLoading, onClickEtapa }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {etapas.map((etapa, idx) => {
        const config = ETAPA_CONFIG[etapa.nome] ?? { label: etapa.nome, icon: Package, color: "text-gray-600" };
        const Icon = config.icon;
        const topMeses = Object.entries(etapa.porMes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);

        return (
          <div key={etapa.nome} className="relative flex flex-col items-stretch">
            <Card
              className="cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all duration-200 h-full"
              onClick={() => onClickEtapa(etapa.nome)}
            >
              <CardContent className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Icon className={`h-5 w-5 ${config.color}`} />
                  {etapa.criticos > 0 && (
                    <Badge variant="destructive" className="text-xs px-1.5 py-0">
                      {etapa.criticos} &gt;30d
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-medium leading-tight">{config.label}</p>
                <p className="text-2xl font-bold tabular-nums">{etapa.quantidade.toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(etapa.valor)}</p>
                {topMeses.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {topMeses.map(([mes, qtd]) => (
                      <Badge key={mes} variant="secondary" className="text-[10px] px-1 py-0">
                        {mes}: {qtd}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            {idx < etapas.length - 1 && (
              <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 bg-muted border border-border rounded-full items-center justify-center">
                <span className="text-muted-foreground text-xs">›</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
