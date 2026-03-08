import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface MetricaBase {
  dias:   number;
  meta:   number;
  status: 'ok' | 'acima';
}

interface Metricas {
  cicloTotal?:      MetricaBase | null;
  cicloPreEstoque?: MetricaBase | null;
  agingEstoque?:    MetricaBase | null;
  tempoEmDesvio?:   { dias: number; tipo: string | null } | null;
  margemBruta?:     { valor: number; percentual: number } | null;
}

interface Props {
  metricas:  Metricas;
  isLoading: boolean;
}

function MetricaCard({
  titulo,
  valor,
  subtitulo,
  detalhe,
  statusOk,
}: {
  titulo:    string;
  valor:     string;
  subtitulo?: string;
  detalhe?:  string;
  statusOk?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-1 min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
        {titulo}
      </p>
      <p className="text-2xl font-bold leading-tight truncate">{valor}</p>
      {subtitulo && (
        <p className={`text-xs font-medium flex items-center gap-1 ${
          statusOk === true  ? 'text-emerald-600' :
          statusOk === false ? 'text-destructive'  : 'text-muted-foreground'
        }`}>
          {statusOk === true  && '✅'}
          {statusOk === false && '⚠️'}
          {subtitulo}
        </p>
      )}
      {detalhe && (
        <p className="text-xs text-muted-foreground">{detalhe}</p>
      )}
    </div>
  );
}

export function MetricasItem({ metricas, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  const { cicloTotal, cicloPreEstoque, agingEstoque, tempoEmDesvio, margemBruta } = metricas;

  const hasAny = cicloTotal || cicloPreEstoque || agingEstoque || margemBruta;

  if (!hasAny) {
    return (
      <p className="text-sm text-muted-foreground">
        Métricas indisponíveis — dados insuficientes para calcular ciclos.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

        {cicloTotal && (
          <MetricaCard
            titulo="Ciclo Total"
            valor={`${cicloTotal.dias} dias`}
            subtitulo={`Meta: ${cicloTotal.meta}d · ${cicloTotal.status === 'ok' ? 'Dentro da meta' : 'Acima da meta'}`}
            statusOk={cicloTotal.status === 'ok'}
          />
        )}

        {cicloPreEstoque && (
          <MetricaCard
            titulo="Pré-Estoque"
            valor={`${cicloPreEstoque.dias} dias`}
            subtitulo={`Meta: ${cicloPreEstoque.meta}d · ${cicloPreEstoque.status === 'ok' ? 'Dentro da meta' : 'Acima da meta'}`}
            statusOk={cicloPreEstoque.status === 'ok'}
          />
        )}

        {agingEstoque && (
          <MetricaCard
            titulo="Aging Estoque"
            valor={`${agingEstoque.dias} dias`}
            subtitulo={`Meta: ${agingEstoque.meta}d · ${agingEstoque.status === 'ok' ? 'Dentro da meta' : 'Acima da meta'}`}
            statusOk={agingEstoque.status === 'ok'}
          />
        )}

        {margemBruta ? (
          <MetricaCard
            titulo="Margem Bruta"
            valor={`R$ ${margemBruta.valor.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}
            subtitulo={`${margemBruta.percentual}%`}
            statusOk={margemBruta.valor >= 0}
          />
        ) : (
          <MetricaCard
            titulo="Margem Bruta"
            valor="—"
            subtitulo="Item não vendido"
          />
        )}
      </div>

      {tempoEmDesvio && (
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <span className="text-yellow-500">⚠️</span>
          Tempo em desvio:
          <strong>{tempoEmDesvio.dias} dias</strong>
          {tempoEmDesvio.tipo && <span>({tempoEmDesvio.tipo})</span>}
        </p>
      )}
    </div>
  );
}
