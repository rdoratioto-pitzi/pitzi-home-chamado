import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Truck, Package, Calendar, Clock } from "lucide-react";
import type { Shipment, ShipmentEvent } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ShipmentDetailSheetProps {
  shipment: Shipment | null;
  onClose: () => void;
}

const statusColors: Record<string, string> = {
  pending: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  processing: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  in_transit: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  out_for_delivery: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  delivered: "bg-green-500/10 text-green-600 dark:text-green-400",
  cancelled: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  processing: "Processando",
  in_transit: "Em Trânsito",
  out_for_delivery: "Saiu para Entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export function ShipmentDetailSheet({ shipment, onClose }: ShipmentDetailSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events = [] } = useQuery<ShipmentEvent[]>({
    queryKey: ["/api/shipments", shipment?.id, "events"],
    enabled: !!shipment?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { status: string }) => {
      return apiRequest("PATCH", `/api/shipments/${shipment?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments", shipment?.id, "events"] });
      toast({
        title: "Status atualizado",
        description: "O status do envio foi atualizado com sucesso.",
      });
    },
  });

  const handleStatusChange = (status: string) => {
    updateMutation.mutate({ status });
  };

  if (!shipment) return null;

  return (
    <Sheet open={!!shipment} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-left font-mono">{shipment.trackingCode}</SheetTitle>
          <SheetDescription className="text-left">
            Detalhes do envio
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-auto space-y-6 py-4">
          <Badge variant="outline" className={statusColors[shipment.status]}>
            {statusLabels[shipment.status]}
          </Badge>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Origem</p>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-medium">{shipment.origin}</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Destino</p>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-destructive" />
                <span className="font-medium">{shipment.destination}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {shipment.carrier && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Transportadora</p>
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  <span>{shipment.carrier}</span>
                </div>
              </div>
            )}
            {shipment.weight && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Peso</p>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span>{shipment.weight}</span>
                </div>
              </div>
            )}
          </div>

          {shipment.dimensions && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Dimensões</p>
              <span>{shipment.dimensions}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Criado: {shipment.createdAt ? new Date(shipment.createdAt).toLocaleDateString("pt-BR") : "-"}
              </span>
            </div>
            {shipment.estimatedDelivery && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Previsão: {new Date(shipment.estimatedDelivery).toLocaleDateString("pt-BR")}
                </span>
              </div>
            )}
          </div>

          {shipment.notes && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Observações</p>
              <p className="text-sm">{shipment.notes}</p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium mb-2">Alterar Status</p>
            <Select 
              value={shipment.status} 
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="w-full" data-testid="select-change-shipment-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="processing">Processando</SelectItem>
                <SelectItem value="in_transit">Em Trânsito</SelectItem>
                <SelectItem value="out_for_delivery">Saiu para Entrega</SelectItem>
                <SelectItem value="delivered">Entregue</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="text-sm font-medium">Histórico de Eventos ({events.length})</h4>
            
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum evento registrado ainda
              </p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="flex gap-3 relative pl-4">
                    <div className="absolute left-0 top-2 w-2 h-2 rounded-full bg-primary" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={statusColors[event.status]}>
                          {statusLabels[event.status]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {event.timestamp ? new Date(event.timestamp).toLocaleString("pt-BR") : "-"}
                        </span>
                      </div>
                      {event.location && (
                        <p className="text-sm mt-1">{event.location}</p>
                      )}
                      {event.description && (
                        <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
