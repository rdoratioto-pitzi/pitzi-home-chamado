import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShoppingCart, Receipt, Truck, Users } from "lucide-react";
import { UF_ORDER, ICMS_TABLE } from "../lib/icms-table";
import { IcmsGrid } from "./icms-grid";
import type { SimuladorInputs } from "../lib/simulador-calc";

interface SimuladorFormProps {
  inputs: SimuladorInputs;
  selectedUf: string;
  compraTotal: number;
  vendaTotal: number;
  freteTotal: number;
  comissaoVarUn: number;
  comissaoRepUn: number;
  onChange: (patch: Partial<SimuladorInputs>) => void;
  onSelectUf: (uf: string, aliquota: number) => void;
  revenda: string;
  onRevendaChange: (value: string) => void;
}

const fmtNum = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function parseBRL(value: string): number {
  const cleaned = value.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function CurrencyInput({
  label,
  value,
  onChange,
  readOnly = false,
  prefix = "R$",
}: {
  label: string;
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  prefix?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {prefix}
        </span>
        <Input
          className="pl-8 text-right tabular-nums text-sm h-9"
          value={readOnly ? fmtNum.format(value) : undefined}
          defaultValue={readOnly ? undefined : fmtNum.format(value)}
          readOnly={readOnly}
          onChange={
            onChange
              ? (e) => onChange(parseBRL(e.target.value))
              : undefined
          }
          onBlur={
            onChange
              ? (e) => {
                  const parsed = parseBRL(e.target.value);
                  e.target.value = fmtNum.format(parsed);
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  suffix,
  min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
  min?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          className="text-right tabular-nums text-sm h-9 pr-8"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
        {suffix && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold text-foreground">{children}</h3>
    </div>
  );
}

export function SimuladorForm({
  inputs,
  selectedUf,
  compraTotal,
  vendaTotal,
  freteTotal,
  comissaoVarUn,
  comissaoRepUn,
  onChange,
  onSelectUf,
  revenda,
  onRevendaChange,
}: SimuladorFormProps) {
  return (
    <Tabs defaultValue="simulacao" className="w-full">
      <TabsList className="w-full grid grid-cols-2">
        <TabsTrigger value="simulacao">Simulacao</TabsTrigger>
        <TabsTrigger value="fiscal">Fiscal + Logistica + Comissao</TabsTrigger>
      </TabsList>

      {/* ── Aba Simulação ── */}
      <TabsContent value="simulacao" className="space-y-4 mt-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Revenda</Label>
          <Input
            className="text-sm h-9"
            placeholder="Nome da revenda — para report de aprovacao"
            value={revenda}
            onChange={(e) => onRevendaChange(e.target.value)}
          />
        </div>

        <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
          <CardContent className="pt-4 pb-4 space-y-3">
            <SectionTitle icon={ShoppingCart}>Compra</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <NumberInput
                label="Volume"
                value={inputs.volume}
                onChange={(v) => onChange({ volume: v })}
                min={0}
              />
              <CurrencyInput
                label="Valor Unit. Compra"
                value={inputs.compraUn}
                onChange={(v) => onChange({ compraUn: v })}
              />
              <CurrencyInput
                label="Total Compra"
                value={compraTotal}
                readOnly
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
          <CardContent className="pt-4 pb-4 space-y-3">
            <SectionTitle icon={Receipt}>Venda</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <CurrencyInput
                label="Valor Unit. Venda"
                value={inputs.vendaUn}
                onChange={(v) => onChange({ vendaUn: v })}
              />
              <CurrencyInput
                label="Total Venda"
                value={vendaTotal}
                readOnly
              />
              <NumberInput
                label="Markup Meta"
                value={inputs.markupMeta}
                onChange={(v) => onChange({ markupMeta: v })}
                step={0.01}
                suffix="x"
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Aba Fiscal + Logística + Comissão ── */}
      <TabsContent value="fiscal" className="space-y-4 mt-4">
        <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
          <CardContent className="pt-4 pb-4 space-y-3">
            <SectionTitle icon={Receipt}>Impostos</SectionTitle>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">UF Destino</Label>
                <Select
                  value={selectedUf}
                  onValueChange={(uf) => {
                    const aliquota = ICMS_TABLE[uf];
                    if (aliquota !== null && aliquota !== undefined) {
                      onSelectUf(uf, aliquota);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UF_ORDER.map((uf) => {
                      const aliq = ICMS_TABLE[uf];
                      return (
                        <SelectItem key={uf} value={uf} disabled={aliq === null}>
                          {uf} {aliq !== null ? `(${aliq.toFixed(2)}%)` : "(n/d)"}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <NumberInput
                label="ICMS %"
                value={inputs.icmsPct}
                onChange={(v) => onChange({ icmsPct: v })}
                step={0.01}
                suffix="%"
              />
              <NumberInput
                label="PIS %"
                value={inputs.pisPct}
                onChange={(v) => onChange({ pisPct: v })}
                step={0.01}
                suffix="%"
              />
              <NumberInput
                label="COFINS %"
                value={inputs.cofinsPct}
                onChange={(v) => onChange({ cofinsPct: v })}
                step={0.01}
                suffix="%"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
          <CardContent className="pt-4 pb-4 space-y-3">
            <SectionTitle icon={Truck}>Logistica</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <CurrencyInput
                label="Frete Medio / Un"
                value={inputs.frete}
                onChange={(v) => onChange({ frete: v })}
              />
              <CurrencyInput
                label="Total Frete"
                value={freteTotal}
                readOnly
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
          <CardContent className="pt-4 pb-4 space-y-3">
            <SectionTitle icon={Users}>Comissao</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-3">
                <NumberInput
                  label="Comissao Varejista % (sobre CMC)"
                  value={inputs.comissaoVarPct}
                  onChange={(v) => onChange({ comissaoVarPct: v })}
                  step={0.5}
                  suffix="%"
                />
                <CurrencyInput
                  label="Valor / Un"
                  value={comissaoVarUn}
                  readOnly
                />
              </div>
              <div className="space-y-3">
                <NumberInput
                  label="Comissao Representante % (sobre Venda)"
                  value={inputs.comissaoRepPct}
                  onChange={(v) => onChange({ comissaoRepPct: v })}
                  step={0.5}
                  suffix="%"
                />
                <CurrencyInput
                  label="Valor / Un"
                  value={comissaoRepUn}
                  readOnly
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <IcmsGrid selectedUf={selectedUf} onSelectUf={onSelectUf} />
      </TabsContent>
    </Tabs>
  );
}
