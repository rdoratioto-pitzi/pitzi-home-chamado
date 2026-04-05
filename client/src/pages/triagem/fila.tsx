import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export default function TriagemFilaPage() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Triagem — Fila de Triagem" />
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Fila de Triagem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. Em breve: gerenciamento da fila de dispositivos aguardando triagem e priorização.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
