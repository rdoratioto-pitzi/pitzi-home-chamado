import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

const TIPOS_REVISAO = [
  { value: "listras", label: "Listras na tela" },
  { value: "burn-in", label: "Burn-in" },
  { value: "pixels", label: "Pixels queimados" },
  { value: "manchas", label: "Manchas e/ou sombras" },
] as const;

type TipoRevisao = (typeof TIPOS_REVISAO)[number]["value"];

interface ReviewerFlagProps {
  enabled: boolean;
  tipo: string | null;
  onToggle: (enabled: boolean) => void;
  onTipoChange: (tipo: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReviewerFlag({ enabled, tipo, onToggle, onTipoChange }: ReviewerFlagProps) {
  return (
    <div
      className={cn(
        "rounded-lg border transition-all",
        enabled
          ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20"
          : "border-dashed border-border bg-muted/20"
      )}
    >
      <div className="flex items-center justify-between p-3">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="revisao-switch" className="text-sm font-medium cursor-pointer">
            Revisão Avaliador
          </Label>
          <p className="text-xs text-muted-foreground">
            Marcar se há falha visual que não é estética (burn-in, listras, etc.)
          </p>
        </div>
        <Switch
          id="revisao-switch"
          checked={enabled}
          onCheckedChange={(checked) => {
            onToggle(checked);
          }}
        />
      </div>

      {/* Tipos de revisão — aparece quando enabled */}
      {enabled && (
        <div className="px-3 pb-3 flex flex-col gap-1.5 border-t border-amber-200 dark:border-amber-800 pt-3 mt-0">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
            Selecione o tipo (obrigatório):
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {TIPOS_REVISAO.map((t) => {
              const isSelected = tipo === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => onTipoChange(t.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium text-left transition-all focus:outline-none focus:ring-2 focus:ring-amber-400",
                    isSelected
                      ? "bg-amber-500 text-white border-amber-500"
                      : "border-amber-200 dark:border-amber-700 bg-white dark:bg-transparent text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/40"
                  )}
                >
                  <span
                    className={cn(
                      "h-3 w-3 rounded-full border-2 flex-shrink-0",
                      isSelected ? "border-white bg-white" : "border-amber-400"
                    )}
                  />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
