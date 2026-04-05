import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

export default function TriagemRecebimentosPage() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Triagem — Recebimentos" />
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Recebimentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. Em breve: registro e acompanhamento de recebimentos de dispositivos para triagem.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
