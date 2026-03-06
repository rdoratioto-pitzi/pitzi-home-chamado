import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export default function EstoquesContagemPage() {
  return (
    <div className="container mx-auto py-6">
      <PageHeader
        title="Contagem Interna"
        description="Contagem física de estoque"
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            Contagem Interna
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Em breve: Esta página permitirá realizar contagens físicas de estoque.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}