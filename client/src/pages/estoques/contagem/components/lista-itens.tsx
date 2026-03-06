import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Package } from "lucide-react";

interface ContagemItem {
  id: string;
  imei: string;
  codigoErp: string | null;
  modelo: string | null;
  categoria: string | null;
  marca: string | null;
  metodoLeitura: string;
  contadoEm: string;
}

interface ListaItensProps {
  itens: ContagemItem[];
  isLoading: boolean;
}

export function ListaItens({ itens, isLoading }: ListaItensProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatImei = (imei: string) => {
    // Show first 6 and last 3 digits, hide middle
    return `${imei.substring(0, 6)}***${imei.substring(12, 15)}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Itens Contados
          </CardTitle>
          <Badge variant="secondary" className="text-sm">
            {itens.length} {itens.length === 1 ? "item" : "itens"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : itens.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum item contado ainda</p>
            <p className="text-sm">Escaneie ou digite um IMEI para começar</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {itens.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground w-6">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="font-mono text-sm font-medium">
                        {formatImei(item.imei)}
                      </p>
                      {item.modelo && (
                        <p className="text-xs text-muted-foreground">
                          {item.modelo}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {formatTime(item.contadoEm)}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {item.metodoLeitura === 'barcode' ? 'Scanner' : 'Manual'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}