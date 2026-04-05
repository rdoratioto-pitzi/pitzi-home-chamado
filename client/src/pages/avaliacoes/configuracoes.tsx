import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings2 } from "lucide-react";

export default function AvaliacoesConfiguracoesPage() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Avaliações — Configurações" />
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Configurações de Avaliações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. Em breve: percentual de amostragem para curadoria, modo de prioridade e outras configurações do módulo.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
