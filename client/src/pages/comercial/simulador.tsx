import { useMemo, useState, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Calculator, BarChart3, FileDown } from "lucide-react";
import { SimuladorForm } from "./components/simulador-form";
import { SimuladorResults } from "./components/simulador-results";
import { AnatomiaNegocio } from "./components/anatomia-negocio";
import { DashboardView } from "./components/dashboard-view";
import {
  calcSimulacao,
  DEFAULT_INPUTS,
  type SimuladorInputs,
} from "./lib/simulador-calc";

type ViewMode = "simulator" | "dashboard";

export default function ComercialSimuladorPage() {
  const [currentView, setCurrentView] = useState<ViewMode>("simulator");
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
            <Button
              size="sm"
              variant={currentView === "simulator" ? "default" : "ghost"}
              className="gap-1.5 text-xs"
              onClick={() => setCurrentView("simulator")}
            >
              <Calculator className="h-3.5 w-3.5" />
              Simulador
            </Button>
            <Button
              size="sm"
              variant={currentView === "dashboard" ? "default" : "ghost"}
              className="gap-1.5 text-xs"
              onClick={() => setCurrentView("dashboard")}
            >
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
        {currentView === "simulator" ? (
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

            {/* ── Coluna direita: Anatomia do Negócio ── */}
            <div className="xl:col-span-2">
              <AnatomiaNegocio resultado={result} inputs={inputs} revenda={revenda} />
            </div>
          </div>
        ) : (
          <DashboardView />
        )}
      </div>
    </div>
  );
}
