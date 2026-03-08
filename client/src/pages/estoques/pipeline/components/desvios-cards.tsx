import { Lock, Wrench, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export interface DesvioItem {
  nome: string;
  quantidade: number;
  valor: number;
  porMes: Record<string, number>;
  criticos: number;
}

const DESVIO_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  bloqueados:  { label: "Bloqueados",  icon: Lock,          color: "text-red-600",    bg: "bg-red-50 dark:bg-red-950/20" },
  manutencao:  { label: "Manutenção",  icon: Wrench,        color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-950/20" },
  divergentes: { label: "Divergentes", icon: AlertTriangle,  color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/20" },
};

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

interface Props {
  desvios: DesvioItem[];
  isLoading: boolean;
  onClickDesvio: (nome: string) => void;
}

export function DesviosCards({ desvios, isLoading, onClickDesvio }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {desvios.map((desvio) => {
        const config = DESVIO_CONFIG[desvio.nome] ?? { label: desvio.nome, icon: AlertTriangle, color: "text-gray-600", bg: "bg-muted" };
        const Icon = config.icon;

        return (
          <Card
            key={desvio.nome}
            className={`cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all duration-200 ${config.bg}`}
            onClick={() => onClickDesvio(desvio.nome)}
          >
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${config.color}`} />
                  <span className="text-sm font-medium">{config.label}</span>
                </div>
                {desvio.criticos > 0 && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0">
                    ⚠ {desvio.criticos} &gt;30d
                  </Badge>
                )}
              </div>
              <p className="text-3xl font-bold tabular-nums">{desvio.quantidade.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(desvio.valor)}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
