import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardList } from "lucide-react";

interface ContagemItem {
  id: string;
  imei: string;
  contadoEm: string | null;
  metodoLeitura: string;
}

interface ListaItensProps {
  itens: ContagemItem[];
  isLoading?: boolean;
}

export function ListaItens({ itens, isLoading = false }: ListaItensProps) {
  function formatTime(dateStr: string | null) {
    if (!dateStr) return "--:--";
    return new Date(dateStr).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function maskImei(imei: string) {
    if (imei.length <= 8) return imei;
    return imei.slice(0, 6) + "***" + imei.slice(-4);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Itens Contados
          </div>
          <Badge variant="secondary" className="text-sm">
            {isLoading ? "..." : itens.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 w-full rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : itens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <ClipboardList className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhum item contado ainda</p>
          </div>
        ) : (
          <ScrollArea className="h-64">
            <div className="divide-y">
              {itens.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6 text-right">
                      {itens.length - index}
                    </span>
                    <span className="font-mono">{maskImei(item.imei)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatTime(item.contadoEm)}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
