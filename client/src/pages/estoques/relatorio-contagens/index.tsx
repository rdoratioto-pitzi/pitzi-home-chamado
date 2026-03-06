import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export default function EstoquesRelatorioContagensPage() {
  return (
    <div className="container mx-auto py-6">
      <PageHeader
        title="Relatório de Contagens"
        description="Análise comparativa sistema vs físico"
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            Relatório de Contagens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Em breve: Esta página exibirá relatórios comparativos entre sistema e contagem física.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}