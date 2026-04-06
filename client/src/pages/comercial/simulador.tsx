import { useMemo, useState, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator, BarChart3, FileDown, FlaskConical } from "lucide-react";
import { SimuladorForm } from "./components/simulador-form";
import { SimuladorResults } from "./components/simulador-results";
import {
  calcSimulacao,
  DEFAULT_INPUTS,
  type SimuladorInputs,
} from "./lib/simulador-calc";

export default function ComercialSimuladorPage() {
  const [inputs, setInputs] = useState<SimuladorInputs>(DEFAULT_INPUTS);
  const [selectedUf, setSelectedUf] = useState("SP");
  const [revenda, setRevenda] = useState("");

  const handleChange = useCallback((patch: Partial<SimuladorInputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSelectUf = useCallback(
    (uf: string, aliquota: number) => {
      setSelectedUf(uf);
      setInputs((prev) => ({ ...prev, icmsPct: aliquota }));
    },
    [],
  );

  const result = useMemo(() => calcSimulacao(inputs), [inputs]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Simulador CPD"
        breadcrumbs={[
          { label: "Comercial", href: "/comercial" },
          { label: "Simulador CPD" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="default" className="gap-1.5 text-xs">
              <Calculator className="h-3.5 w-3.5" />
              Simulador
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs" disabled>
              <BarChart3 className="h-3.5 w-3.5" />
              Dashboard
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled>
              <FileDown className="h-3.5 w-3.5" />
              Exportar PDF
            </Button>
          </div>
        }
      />

      <div className="flex-1 p-6 overflow-auto">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* ── Coluna esquerda: Form + Results ── */}
          <div className="xl:col-span-3 space-y-4">
            <SimuladorForm
              inputs={inputs}
              selectedUf={selectedUf}
              compraTotal={result.compraTotal}
              vendaTotal={result.vendaTotal}
              freteTotal={result.freteTotal}
              comissaoVarUn={result.comissaoVarUn}
              comissaoRepUn={result.comissaoRepUn}
              onChange={handleChange}
              onSelectUf={handleSelectUf}
              revenda={revenda}
              onRevendaChange={setRevenda}
            />

            <SimuladorResults result={result} markupMeta={inputs.markupMeta} />
          </div>

          {/* ── Coluna direita: Anatomia (placeholder Fase 3) ── */}
          <div className="xl:col-span-2">
            <Card
              className="border h-full"
              style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}
            >
              <CardContent className="pt-6 flex flex-col items-center justify-center h-full min-h-[300px] text-center gap-3">
                <FlaskConical className="h-8 w-8 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Anatomia do Negocio
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Em breve — Fase 3
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
