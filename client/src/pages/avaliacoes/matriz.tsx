import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet } from "lucide-react";

export default function AvaliacoesMatrizPage() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Avaliações — Matriz de Confusão" />
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Matriz de Confusão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. Em breve: análise visual da acurácia da IA por categoria, exibindo divergências entre grau predito e grau real.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
