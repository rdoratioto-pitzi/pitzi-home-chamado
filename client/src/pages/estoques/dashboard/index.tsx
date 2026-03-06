import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export default function EstoquesDashboardPage() {
  return (
    <div className="container mx-auto py-6">
      <PageHeader
        title="Dashboard de Estoques"
        description="Métricas e análises de estoque"
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-6 w-6" />
            Dashboard de Estoques
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Em breve: Esta página exibirá métricas e análises de estoque.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}