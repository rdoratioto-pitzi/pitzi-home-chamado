import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Truck, Package, MapPin, Clock, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Shipment } from "@shared/schema";
import { ShipmentDialog } from "./shipment-dialog";
import { ShipmentDetailSheet } from "./shipment-detail-sheet";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function LogisticaPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: shipments = [], isLoading } = useQuery<Shipment[]>({
    queryKey: ["/api/shipments"],
  });

  const filteredShipments = shipments.filter((shipment) => {
    const matchesSearch = 
      shipment.trackingCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.destination.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || shipment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: shipments.length,
    inTransit: shipments.filter(s => s.status === "in_transit").length,
    delivered: shipments.filter(s => s.status === "delivered").length,
    pending: shipments.filter(s => s.status === "pending" || s.status === "processing").length,
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader 
        title="Logística" 
        breadcrumbs={[{ label: "Logística" }]}
        actions={
          <Button onClick={() => setIsDialogOpen(true)} data-testid="button-new-shipment">
            <Plus className="h-4 w-4 mr-2" />
            Novo Envio
          </Button>
        }
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Envios</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-shipments">{stats.total}</div>
              <p className="text-xs text-muted-foreground">registrados no sistema</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Trânsito</CardTitle>
              <Truck className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600" data-testid="text-transit-shipments">{stats.inTransit}</div>
              <p className="text-xs text-muted-foreground">a caminho do destino</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Entregues</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-delivered-shipments">{stats.delivered}</div>
              <p className="text-xs text-muted-foreground">concluídos com sucesso</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-600" data-testid="text-pending-shipments">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">aguardando processamento</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle>Envios</CardTitle>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por código, origem ou destino..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-[280px]"
                    data-testid="input-search-shipments"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]" data-testid="select-shipment-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="processing">Processando</SelectItem>
                    <SelectItem value="in_transit">Em Trânsito</SelectItem>
                    <SelectItem value="out_for_delivery">Saiu para Entrega</SelectItem>
                    <SelectItem value="delivered">Entregue</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredShipments.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">Nenhum envio encontrado</h3>
                <p className="text-muted-foreground mt-1">
                  {shipments.length === 0 
                    ? "Registre seu primeiro envio clicando no botão acima"
                    : "Tente ajustar os filtros de busca"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código de Rastreio</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Transportadora</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Previsão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShipments.map((shipment) => (
                    <TableRow 
                      key={shipment.id} 
                      className="cursor-pointer hover-elevate"
                      onClick={() => setSelectedShipment(shipment)}
                      data-testid={`row-shipment-${shipment.id}`}
                    >
                      <TableCell className="font-mono font-medium">{shipment.trackingCode}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {shipment.origin}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {shipment.destination}
                        </div>
                      </TableCell>
                      <TableCell>{shipment.carrier || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[shipment.status]}>
                          {statusLabels[shipment.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {shipment.estimatedDelivery 
                          ? new Date(shipment.estimatedDelivery).toLocaleDateString("pt-BR")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <ShipmentDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
      <ShipmentDetailSheet shipment={selectedShipment} onClose={() => setSelectedShipment(null)} />
    </div>
  );
}
