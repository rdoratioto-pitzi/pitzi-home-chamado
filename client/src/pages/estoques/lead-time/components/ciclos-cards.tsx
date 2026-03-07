import { Clock, ArrowRight, Warehouse } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface CicloStats {
  media: number;
  p50: number;
  p90: number;
  min: number;
  max: number;
  meta: number;
}

interface Props {
  ciclos: {
    total: CicloStats;
    preEstoque: CicloStats;
    agingEstoque: CicloStats;
  } | undefined;
  isLoading: boolean;
}

function DentroMeta({ valor, meta }: { valor: number; meta: number }) {
  const ok = valor <= meta;
  return (
    <Badge variant={ok ? "default" : "destructive"} className="text-xs px-1.5">
      {ok ? "✓" : "⚠"} Meta: {meta}d
    </Badge>
  );
}

function CicloCard({
  label,
  descricao,
  stats,
  icon: Icon,
  color,
}: {
  label: string;
  descricao: string;
  stats: CicloStats;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${color}`} />
            <span className="text-sm font-semibold">{label}</span>
          </div>
          <DentroMeta valor={stats.media} meta={stats.meta} />
        </div>
        <p className="text-xs text-muted-foreground">{descricao}</p>
        <p className="text-4xl font-bold tabular-nums">{stats.media}<span className="text-lg font-normal text-muted-foreground ml-1">dias</span></p>
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Mediana</p>
            <p className="text-sm font-semibold">{stats.p50}d</p>
          </div>
          <div className="text-center border-x border-border">
            <p className="text-[10px] text-muted-foreground">P90</p>
            <p className="text-sm font-semibold">{stats.p90}d</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Máx</p>
            <p className="text-sm font-semibold">{stats.max}d</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CiclosCards({ ciclos, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
      </div>
    );
  }

  if (!ciclos) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <CicloCard
        label="Ciclo Total"
        descricao="Voucher utilizado → Venda"
        stats={ciclos.total}
        icon={ArrowRight}
        color="text-blue-600"
      />
      <CicloCard
        label="Ciclo Pré-Estoque"
        descricao="Voucher utilizado → Triagem finalizada"
        stats={ciclos.preEstoque}
        icon={Clock}
        color="text-violet-600"
      />
      <CicloCard
        label="Aging de Estoque"
        descricao="Triagem finalizada → Venda"
        stats={ciclos.agingEstoque}
        icon={Warehouse}
        color="text-green-600"
      />
    </div>
  );
}
