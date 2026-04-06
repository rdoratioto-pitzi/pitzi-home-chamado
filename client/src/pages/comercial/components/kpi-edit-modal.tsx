import { useState, useMemo } from "react";
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
import { Loader2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  type DashboardMonth,
  type MonthKey,
  MONTH_KEYS,
  INITIAL_DASHBOARD_DATA,
  monthKeyToPeriodo,
  monthKeyToLabel,
  formatBRL,
  formatPct,
} from "../lib/dashboard-data";
import { calcKpis, type KpiInputs } from "../lib/kpi-calculator";
import { useUpsertComercialKpi } from "../hooks/use-comercial-kpis";

interface KpiEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMonth: MonthKey;
  data: Record<MonthKey, DashboardMonth>;
}

function parseNumericInput(value: string): number {
  const cleaned = value.replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function formatForInput(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function formatForInputInt(value: number): string {
  return Math.round(value).toString();
}

interface FormState {
  vendas: string;
  faturamentoTotal: string;
  cmcTotal: string;
  freteTotal: string;
  icmsPct: string;
  pisPct: string;
  cofinsPct: string;
  comissaoVarPct: string;
  comissaoRepPct: string;
}

function buildFormState(month: DashboardMonth): FormState {
  return {
    vendas: formatForInputInt(month.volume),
    faturamentoTotal: formatForInput(month.faturamentoTotal),
    cmcTotal: formatForInput(month.cmcTotal),
    freteTotal: formatForInput(month.freteTotal),
    icmsPct: formatForInput(month.icmsPct),
    pisPct: formatForInput(month.pisPct),
    cofinsPct: formatForInput(month.cofinsPct),
    comissaoVarPct: formatForInput(month.comissaoVarPct),
    comissaoRepPct: formatForInput(month.comissaoRepPct),
  };
}

function formToInputs(form: FormState): KpiInputs {
  return {
    vendas: parseNumericInput(form.vendas),
    faturamentoTotal: parseNumericInput(form.faturamentoTotal),
    cmcTotal: parseNumericInput(form.cmcTotal),
    freteTotal: parseNumericInput(form.freteTotal),
    icmsPct: parseNumericInput(form.icmsPct),
    pisPct: parseNumericInput(form.pisPct),
    cofinsPct: parseNumericInput(form.cofinsPct),
    comissaoVarPct: parseNumericInput(form.comissaoVarPct),
    comissaoRepPct: parseNumericInput(form.comissaoRepPct),
  };
}

function getCurrentMonthKey(): MonthKey {
  const now = new Date();
  const abbr = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${abbr[now.getMonth()]}-${now.getFullYear()}`;
}

export function KpiEditModal({ open, onOpenChange, currentMonth, data }: KpiEditModalProps) {
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>(currentMonth);
  const [form, setForm] = useState<FormState>(() => buildFormState(data[currentMonth] ?? data[MONTH_KEYS[0]]));
  const { toast } = useToast();
  const upsertMutation = useUpsertComercialKpi();

  const inputs = useMemo(() => formToInputs(form), [form]);
  const calculated = useMemo(() => calcKpis(inputs), [inputs]);

  function handleMonthChange(month: MonthKey) {
    setSelectedMonth(month);
    const monthData = data[month];
    if (monthData) {
      setForm(buildFormState(monthData));
    } else {
      setForm({
        vendas: "0",
        faturamentoTotal: "0,00",
        cmcTotal: "0,00",
        freteTotal: "0,00",
        icmsPct: "3,51",
        pisPct: "0,65",
        cofinsPct: "3,00",
        comissaoVarPct: "10,00",
        comissaoRepPct: "0,00",
      });
    }
  }

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    const periodo = monthKeyToPeriodo(selectedMonth);
    const label = monthKeyToLabel(selectedMonth);

    const payload = {
      label,
      volume: inputs.vendas,
      ticket: calculated.ticketMedio,
      cmc: calculated.cmcMedio,
      margemUn: calculated.margemLiqUn,
      margemPct: calculated.margemLiqPct,
      margemTotal: calculated.margemLiqTotal,
      mcTotal: calculated.mcTotal,
      comissaoVarPct: inputs.comissaoVarPct,
      comissaoRepPct: inputs.comissaoRepPct,
      icmsPct: inputs.icmsPct,
      pisPct: inputs.pisPct,
      cofinsPct: inputs.cofinsPct,
      frete: calculated.freteMedioUn,
      faturamentoTotal: inputs.faturamentoTotal,
      cmcTotal: inputs.cmcTotal,
      freteTotal: inputs.freteTotal,
      cpdMedio: calculated.cpdMedio,
      markup: calculated.markup,
    };

    upsertMutation.mutate(
      { periodo, data: payload },
      {
        onSuccess: () => {
          toast({
            title: "KPIs atualizados",
            description: `KPIs de ${label} salvos com sucesso`,
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

  const margemColor = calculated.margemLiqUn >= 0 ? "text-emerald-600" : "text-red-600";
  const markupColor = calculated.markup >= 1.5 ? "text-emerald-600" : calculated.markup > 0 ? "text-amber-600" : "text-red-600";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atualizar KPIs</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* SEÇÃO 1 — Dados do Período */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
              Dados do Período
            </h3>

            <div>
              <Label className="text-xs">Período</Label>
              <Select value={selectedMonth} onValueChange={(v) => handleMonthChange(v as MonthKey)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {monthKeyToLabel(key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Vendas (dispositivos)</Label>
                <Input
                  value={form.vendas}
                  onChange={(e) => handleChange("vendas", e.target.value)}
                  className="mt-1 border-emerald-300 focus:border-emerald-500"
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">
                  Faturamento Total <span className="text-muted-foreground">(R$)</span>
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <Input
                    value={form.faturamentoTotal}
                    onChange={(e) => handleChange("faturamentoTotal", e.target.value)}
                    className="pl-8 border-emerald-300 focus:border-emerald-500"
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">
                  CMC Total <span className="text-muted-foreground">(R$)</span>
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <Input
                    value={form.cmcTotal}
                    onChange={(e) => handleChange("cmcTotal", e.target.value)}
                    className="pl-8 border-emerald-300 focus:border-emerald-500"
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">
                  Frete Total <span className="text-muted-foreground">(R$)</span>
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <Input
                    value={form.freteTotal}
                    onChange={(e) => handleChange("freteTotal", e.target.value)}
                    className="pl-8 border-emerald-300 focus:border-emerald-500"
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2 — Alíquotas */}
          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Alíquotas
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {([
                { key: "icmsPct" as const, label: "ICMS %" },
                { key: "pisPct" as const, label: "PIS %" },
                { key: "cofinsPct" as const, label: "COFINS %" },
                { key: "comissaoVarPct" as const, label: "Com. Var. %" },
                { key: "comissaoRepPct" as const, label: "Com. Rep. %" },
              ]).map((field) => (
                <div key={field.key}>
                  <Label className="text-[10px] text-muted-foreground">{field.label}</Label>
                  <Input
                    value={form[field.key]}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="mt-0.5 text-xs h-8"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* SEÇÃO 3 — Preview dos KPIs */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Indicadores Calculados
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <PreviewCard label="Ticket Médio" value={formatBRL(calculated.ticketMedio)} />
              <PreviewCard label="CMC Médio" value={formatBRL(calculated.cmcMedio)} />
              <PreviewCard label="Markup" value={`${calculated.markup.toFixed(2).replace(".", ",")}x`} className={markupColor} />
              <PreviewCard label="Frete/Un" value={formatBRL(calculated.freteMedioUn)} />

              <PreviewCard label="MC Total" value={formatBRL(calculated.mcTotal)} className={calculated.mcTotal >= 0 ? "text-emerald-600" : "text-red-600"} />
              <PreviewCard label="MC %" value={formatPct(calculated.mcPct)} className={calculated.mcPct >= 0 ? "text-emerald-600" : "text-red-600"} />
              <PreviewCard label="CPD Médio" value={formatBRL(calculated.cpdMedio)} className="text-red-600" />
              <PreviewCard label="CPD %" value={formatPct(calculated.ticketMedio > 0 ? (calculated.cpdMedio / calculated.ticketMedio) * 100 : 0)} className="text-red-600" />

              <PreviewCard label="Margem Líq/Un" value={formatBRL(calculated.margemLiqUn)} className={margemColor} />
              <PreviewCard label="Margem Líq Total" value={formatBRL(calculated.margemLiqTotal)} className={margemColor} />
              <PreviewCard label="Margem Líq %" value={formatPct(calculated.margemLiqPct)} className={margemColor} />
            </div>
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

function PreviewCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-md bg-background p-2.5">
      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`mt-0.5 text-base font-bold ${className ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
