import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function TriagemDesviosPage() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Triagem — Desvios" />
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Desvios (Bloqueados / Manutenção / Divergentes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. Em breve: acompanhamento de dispositivos com desvios na triagem — bloqueados, em manutenção ou divergentes.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
