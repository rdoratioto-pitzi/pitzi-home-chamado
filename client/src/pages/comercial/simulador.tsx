import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator } from "lucide-react";

export default function ComercialSimuladorPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Simulador CPD"
        breadcrumbs={[
          { label: "Comercial" },
          { label: "Simulador CPD" },
        ]}
      />
      <div className="flex-1 p-6">
        <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Calculator className="h-5 w-5" />
              <span className="text-sm">Simulador em desenvolvimento</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
