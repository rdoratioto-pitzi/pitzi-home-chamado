import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, Info } from 'lucide-react';

export default function OmieTransporte() {
  return (
    <div className="space-y-6 mt-6">
      {/* CT-e — não disponível */}
      <Card className="opacity-75">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">CT-e — Conhecimento de Transporte Eletrônico</span>
          </CardTitle>
          <CardDescription>Consultar conhecimentos de transporte emitidos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Endpoint não disponível</p>
              <p className="text-sm text-muted-foreground">
                A API de CT-e do Omie não está habilitada para esta conta.
                O Conhecimento de Transporte Eletrônico é um documento fiscal para prestação de serviços de transporte de cargas.
                Consulte diretamente no ERP Omie ou entre em contato com o suporte para habilitar o acesso.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
