import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export default function AvaliacoesCuradoriaPage() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Avaliações — Curadoria" />
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Curadoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. Em breve: revisão e curadoria de avaliações de dispositivos, comparando grau da IA com grau humano.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
