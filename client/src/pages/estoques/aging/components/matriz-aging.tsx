import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface FaixaPreEstoque {
  nome: string;
  cor: string;
  etapas: Record<string, number>;
  total: number;
}

interface MatrizAgingProps {
  faixas: FaixaPreEstoque[];
  totaisPorEtapa: Record<string, number>;
  totalGeral: number;
  isLoading: boolean;
  onClickCelula: (faixa: string, etapa: string) => void;
  filtroAtivo: { faixa: string; etapa: string } | null;
}

const ETAPAS = [
  { key: 'voucher',     label: 'Voucher'     },
  { key: 'confirmacao', label: 'Confirmação' },
  { key: 'coleta',      label: 'Coleta'      },
  { key: 'recebimento', label: 'Recebimento' },
  { key: 'triagem',     label: 'Triagem'     },
];

const COR_CLASSES: Record<string, string> = {
  green:  'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
  yellow: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800',
  orange: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
  red:    'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
  black:  'bg-gray-100 dark:bg-gray-900/50 border-gray-300 dark:border-gray-700',
};

const BADGE_CLASSES: Record<string, string> = {
  green:  'text-green-700 dark:text-green-400',
  yellow: 'text-yellow-700 dark:text-yellow-400',
  orange: 'text-orange-700 dark:text-orange-400',
  red:    'text-red-700 dark:text-red-400',
  black:  'text-gray-700 dark:text-gray-300',
};

const EMOJI: Record<string, string> = {
  green: '🟢', yellow: '🟡', orange: '🟠', red: '🔴', black: '⚫',
};

export function MatrizAging({ faixas, totaisPorEtapa, totalGeral, isLoading, onClickCelula, filtroAtivo }: MatrizAgingProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-semibold text-muted-foreground w-28">Faixa</th>
            {ETAPAS.map(e => (
              <th key={e.key} className="text-center py-2 px-3 font-semibold text-muted-foreground">
                {e.label}
              </th>
            ))}
            <th className="text-center py-2 px-3 font-semibold text-muted-foreground">Total</th>
          </tr>
        </thead>
        <tbody>
          {faixas.map(faixa => (
            <tr key={faixa.nome} className={cn('border-b', COR_CLASSES[faixa.cor])}>
              <td className="py-2 px-3 font-medium">
                <span className="mr-1">{EMOJI[faixa.cor]}</span>
                <span className={BADGE_CLASSES[faixa.cor]}>{faixa.nome}</span>
              </td>
              {ETAPAS.map(e => {
                const val = faixa.etapas[e.key] ?? 0;
                const ativo = filtroAtivo?.faixa === faixa.nome && filtroAtivo?.etapa === e.key;
                return (
                  <td key={e.key} className="text-center py-2 px-3">
                    <button
                      onClick={() => onClickCelula(faixa.nome, e.key)}
                      disabled={val === 0}
                      className={cn(
                        'min-w-[2.5rem] px-2 py-0.5 rounded font-tabular-nums text-sm transition-colors',
                        val > 0
                          ? 'hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer'
                          : 'text-muted-foreground/40 cursor-default',
                        ativo && 'ring-2 ring-primary bg-primary/10',
                      )}
                    >
                      {val.toLocaleString('pt-BR')}
                    </button>
                  </td>
                );
              })}
              <td className="text-center py-2 px-3 font-bold">
                {faixa.total.toLocaleString('pt-BR')}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 bg-muted/30">
            <td className="py-2 px-3 font-bold text-muted-foreground">TOTAL</td>
            {ETAPAS.map(e => (
              <td key={e.key} className="text-center py-2 px-3 font-bold">
                {(totaisPorEtapa[e.key] ?? 0).toLocaleString('pt-BR')}
              </td>
            ))}
            <td className="text-center py-2 px-3 font-bold">
              {totalGeral.toLocaleString('pt-BR')}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
