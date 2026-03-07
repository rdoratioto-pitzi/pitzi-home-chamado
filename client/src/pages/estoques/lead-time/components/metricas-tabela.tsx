import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface EtapaMetrica {
  nome: string;
  label: string;
  media: number;
  p50: number;
  p90: number;
  min: number;
  max: number;
  meta?: number;
}

interface Props {
  etapas: EtapaMetrica[];
  desvios: EtapaMetrica[];
  isLoading: boolean;
}

function StatusBadge({ valor, meta }: { valor: number; meta?: number }) {
  if (!meta) return null;
  return (
    <Badge variant={valor <= meta ? "default" : "destructive"} className="text-xs px-1.5">
      {valor <= meta ? "✓" : "⚠"}
    </Badge>
  );
}

function MetricaRow({ item, variant = "normal" }: { item: EtapaMetrica; variant?: "normal" | "total" | "desvio" }) {
  const bg =
    variant === "total" ? "bg-muted/70 font-semibold" :
    variant === "desvio" ? "bg-amber-50/50 dark:bg-amber-950/10" :
    "";

  return (
    <tr className={`border-b last:border-0 text-sm ${bg}`}>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span>{item.label}</span>
          {item.meta !== undefined && <StatusBadge valor={item.media} meta={item.meta} />}
        </div>
      </td>
      <td className="px-4 py-2.5 tabular-nums text-center font-medium">{item.media}d</td>
      <td className="px-4 py-2.5 tabular-nums text-center text-muted-foreground">{item.p50}d</td>
      <td className="px-4 py-2.5 tabular-nums text-center text-muted-foreground">{item.p90}d</td>
      <td className="px-4 py-2.5 tabular-nums text-center text-muted-foreground">{item.min}d</td>
      <td className="px-4 py-2.5 tabular-nums text-center text-muted-foreground">{item.max}d</td>
      <td className="px-4 py-2.5 tabular-nums text-center text-muted-foreground">
        {item.meta !== undefined ? `${item.meta}d` : "—"}
      </td>
    </tr>
  );
}

export function MetricasTabela({ etapas, desvios, isLoading }: Props) {
  if (isLoading) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  const headers = ["Etapa", "Média", "P50", "P90", "Min", "Max", "Meta"];

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full">
        <thead className="bg-muted/50 border-b">
          <tr>
            {headers.map(h => (
              <th
                key={h}
                className={`px-4 py-2.5 text-xs font-medium text-muted-foreground ${h === "Etapa" ? "text-left" : "text-center"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {etapas.length === 0 && desvios.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                Dados insuficientes para calcular métricas no período selecionado.
              </td>
            </tr>
          ) : (
            <>
              {etapas.map(e => <MetricaRow key={e.nome} item={e} />)}
              {desvios.length > 0 && (
                <>
                  <tr className="bg-muted/30">
                    <td colSpan={7} className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Tempo adicional em desvios
                    </td>
                  </tr>
                  {desvios.map(d => <MetricaRow key={d.nome} item={d} variant="desvio" />)}
                </>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
