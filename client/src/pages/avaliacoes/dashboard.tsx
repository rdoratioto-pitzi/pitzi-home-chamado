import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScanEye } from "lucide-react";

export default function AvaliacoesDashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Avaliações — Dashboard" />
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanEye className="h-5 w-5" />
              Dashboard de Avaliações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. Em breve: KPIs de avaliações, eficiência da IA e indicadores de curadoria.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
