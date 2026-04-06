import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  type DashboardMonth,
  type MonthKey,
  MONTH_KEYS,
  INITIAL_DASHBOARD_DATA,
  monthKeyToPeriodo,
} from "../lib/dashboard-data";
import { useUpsertComercialKpi } from "../hooks/use-comercial-kpis";

interface KpiEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMonth: MonthKey;
  data: Record<MonthKey, DashboardMonth>;
}

type NumericField = keyof Omit<DashboardMonth, "label">;

const FIELDS: { key: NumericField; label: string; prefix?: string; suffix?: string }[] = [
  { key: "volume", label: "Vendas (dispositivos)" },
  { key: "ticket", label: "Ticket Revenda", prefix: "R$" },
  { key: "cmc", label: "CMC Médio", prefix: "R$" },
  { key: "margemUn", label: "Margem Líq/Un", prefix: "R$" },
  { key: "margemPct", label: "Margem Líq %", suffix: "%" },
  { key: "margemTotal", label: "Margem Total", prefix: "R$" },
  { key: "mcTotal", label: "MC Total", prefix: "R$" },
  { key: "comissaoVarPct", label: "Comissão Varejista", suffix: "%" },
  { key: "comissaoRepPct", label: "Comissão Representante", suffix: "%" },
  { key: "icmsPct", label: "ICMS", suffix: "%" },
  { key: "pisPct", label: "PIS", suffix: "%" },
  { key: "cofinsPct", label: "COFINS", suffix: "%" },
  { key: "frete", label: "Frete Médio/Un", prefix: "R$" },
];

function parseNumericInput(value: string): number {
  const cleaned = value.replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function formatForInput(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export function KpiEditModal({ open, onOpenChange, currentMonth, data }: KpiEditModalProps) {
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>(currentMonth);
  const [values, setValues] = useState<Record<NumericField, string>>(() =>
    buildFormValues(data[currentMonth]),
  );
  const { toast } = useToast();
  const upsertMutation = useUpsertComercialKpi();

  function buildFormValues(month: DashboardMonth): Record<NumericField, string> {
    const result: Record<string, string> = {};
    for (const field of FIELDS) {
      result[field.key] = formatForInput(month[field.key]);
    }
    return result as Record<NumericField, string>;
  }

  function handleMonthChange(month: MonthKey) {
    setSelectedMonth(month);
    setValues(buildFormValues(data[month]));
  }

  function handleFieldChange(key: NumericField, raw: string) {
    setValues((prev) => ({ ...prev, [key]: raw }));
  }

  function handleSave() {
    const periodo = monthKeyToPeriodo(selectedMonth);
    const label = data[selectedMonth].label;

    const payload = {
      label,
      volume: parseNumericInput(values.volume),
      ticket: parseNumericInput(values.ticket),
      cmc: parseNumericInput(values.cmc),
      margemUn: parseNumericInput(values.margemUn),
      margemPct: parseNumericInput(values.margemPct),
      margemTotal: parseNumericInput(values.margemTotal),
      mcTotal: parseNumericInput(values.mcTotal),
      comissaoVarPct: parseNumericInput(values.comissaoVarPct),
      comissaoRepPct: parseNumericInput(values.comissaoRepPct),
      icmsPct: parseNumericInput(values.icmsPct),
      pisPct: parseNumericInput(values.pisPct),
      cofinsPct: parseNumericInput(values.cofinsPct),
      frete: parseNumericInput(values.frete),
    };

    upsertMutation.mutate(
      { periodo, data: payload },
      {
        onSuccess: () => {
          toast({
            title: "KPIs atualizados",
            description: `KPIs de ${label} atualizados com sucesso`,
          });
          onOpenChange(false);
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Não foi possível salvar os KPIs",
            variant: "destructive",
          });
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atualizar KPIs</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Período</Label>
            <Select value={selectedMonth} onValueChange={(v) => handleMonthChange(v as MonthKey)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {INITIAL_DASHBOARD_DATA[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((field) => (
              <div key={field.key}>
                <Label className="text-xs">
                  {field.label}
                  {field.suffix && <span className="text-muted-foreground ml-1">({field.suffix})</span>}
                </Label>
                <div className="relative mt-1">
                  {field.prefix && (
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {field.prefix}
                    </span>
                  )}
                  <Input
                    value={values[field.key]}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className={field.prefix ? "pl-8" : ""}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={upsertMutation.isPending}>
            {upsertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
