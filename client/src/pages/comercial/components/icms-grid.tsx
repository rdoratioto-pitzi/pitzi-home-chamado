import { UF_LIST } from "../lib/icms-table";

interface IcmsGridProps {
  selectedUf: string;
  onSelectUf: (uf: string, aliquota: number) => void;
}

export function IcmsGrid({ selectedUf, onSelectUf }: IcmsGridProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Tabela ICMS — SP → UF Destino
      </h4>
      <div className="grid grid-cols-7 gap-1.5">
        {UF_LIST.map(({ uf, aliquota }) => {
          const isActive = uf === selectedUf;
          const hasAliquota = aliquota !== null;

          return (
            <button
              key={uf}
              type="button"
              disabled={!hasAliquota}
              onClick={() => hasAliquota && onSelectUf(uf, aliquota)}
              className={`
                flex flex-col items-center justify-center rounded-md border px-1 py-1.5
                text-xs transition-all
                ${isActive
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold ring-1 ring-emerald-500/30"
                  : hasAliquota
                    ? "border-border/60 hover:border-border hover:bg-muted/50 cursor-pointer"
                    : "border-border/30 opacity-40 cursor-not-allowed"
                }
              `}
            >
              <span className="font-medium leading-none">{uf}</span>
              <span className="text-[10px] leading-none mt-0.5 text-muted-foreground">
                {hasAliquota ? `${aliquota.toFixed(2)}%` : "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
