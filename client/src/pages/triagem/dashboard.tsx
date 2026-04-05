import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter } from "lucide-react";

export default function TriagemDashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Triagem — Dashboard" />
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Dashboard de Triagem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. Em breve: KPIs de triagem, status de recebimentos e métricas operacionais.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
