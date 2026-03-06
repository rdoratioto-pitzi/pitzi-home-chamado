import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export default function EstoquesPosicaoPage() {
  return (
    <div className="container mx-auto py-6">
      <PageHeader
        title="Posição de Estoques"
        description="Consulta em tempo real do estoque via integração Omie"
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Posição de Estoques
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Em breve: Esta página exibirá a posição de estoques em tempo real.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}