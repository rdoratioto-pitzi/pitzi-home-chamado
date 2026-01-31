import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bell,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  BellRing,
  Activity,
} from "lucide-react";

interface PricingDevice {
  id: string;
  manufacturerName: string;
  modelName: string;
  storage: number;
  categoryName: string;
}

interface PricingAlert {
  id: string;
  userId: string;
  deviceId: string;
  alertType: string;
  thresholdPercent: string;
  isActive: boolean;
  lastTriggered: string | null;
  createdAt: string;
}

const alertFormSchema = z.object({
  deviceId: z.string().min(1, "Selecione um dispositivo"),
  alertType: z.enum(["price_drop", "price_rise"]),
  thresholdPercent: z.string().min(1, "Informe o percentual"),
});

type AlertFormValues = z.infer<typeof alertFormSchema>;

export default function AlertasPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentUser] = useState(() => {
    try {
      const userStr = sessionStorage.getItem("user");
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  });

  const { data: devices = [], isLoading: loadingDevices } = useQuery<PricingDevice[]>({
    queryKey: ["pricing-local-devices"],
    queryFn: async () => {
      const response = await fetch("/api/pricing/devices");
      if (!response.ok) throw new Error("Erro ao carregar dispositivos");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: alerts = [], isLoading: loadingAlerts, refetch } = useQuery<PricingAlert[]>({
    queryKey: ["pricing-alerts"],
    queryFn: async () => {
      const response = await fetch("/api/pricing/alerts");
      if (!response.ok) throw new Error("Erro ao carregar alertas");
      return response.json();
    },
    staleTime: 60 * 1000,
  });

  const form = useForm<AlertFormValues>({
    resolver: zodResolver(alertFormSchema),
    defaultValues: {
      deviceId: "",
      alertType: "price_drop",
      thresholdPercent: "5",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AlertFormValues) => {
      return apiRequest("POST", "/api/pricing/alerts", {
        ...data,
        userId: currentUser?.id || "unknown",
      });
    },
    onSuccess: () => {
      toast({ title: "Alerta criado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["pricing-alerts"] });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar alerta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/pricing/alerts/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing-alerts"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/pricing/alerts/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Alerta removido" });
      queryClient.invalidateQueries({ queryKey: ["pricing-alerts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover alerta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getDeviceName = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    return device 
      ? `${device.manufacturerName} ${device.modelName} ${device.storage}GB` 
      : deviceId;
  };

  const onSubmit = (data: AlertFormValues) => {
    createMutation.mutate(data);
  };

  if (loadingDevices || loadingAlerts) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader
          title="Alertas de Preço"
          description="Configure notificações de variação de preços"
        />
        <main className="flex-1 p-6 space-y-6">
          <Skeleton className="h-[400px]" />
        </main>
      </div>
    );
  }

  const activeAlerts = alerts.filter(a => a.isActive).length;
  const triggeredToday = alerts.filter(a => {
    if (!a.lastTriggered) return false;
    const triggered = new Date(a.lastTriggered);
    const today = new Date();
    return triggered.toDateString() === today.toDateString();
  }).length;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Alertas de Preço"
        description="Configure notificações de variação de preços"
      />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Alertas
              </CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{alerts.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Alertas configurados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Alertas Ativos
              </CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeAlerts}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Monitorando preços
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Disparados Hoje
              </CardTitle>
              <BellRing className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{triggeredToday}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Alertas disparados
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Seus Alertas
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-alerts">
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-new-alert">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Alerta
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Alerta de Preço</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="deviceId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dispositivo</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-alert-device">
                                  <SelectValue placeholder="Selecione um dispositivo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {devices.map(device => (
                                  <SelectItem key={device.id} value={device.id}>
                                    {device.manufacturerName} {device.modelName} {device.storage}GB
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="alertType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Alerta</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-alert-type">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="price_drop">Queda de Preço</SelectItem>
                                <SelectItem value="price_rise">Aumento de Preço</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="thresholdPercent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Percentual (%)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="1" 
                                max="100" 
                                placeholder="5"
                                data-testid="input-threshold"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end gap-2 pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setDialogOpen(false)}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createMutation.isPending}
                          data-testid="button-submit-alert"
                        >
                          {createMutation.isPending ? "Criando..." : "Criar Alerta"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum alerta configurado</h3>
                <p className="text-muted-foreground mb-4">
                  Crie alertas para ser notificado quando os preços variarem
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Limite</TableHead>
                    <TableHead>Último Disparo</TableHead>
                    <TableHead className="text-center">Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell className="font-medium">
                        {getDeviceName(alert.deviceId)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={alert.alertType === "price_drop" ? "default" : "secondary"}>
                          {alert.alertType === "price_drop" ? (
                            <>
                              <TrendingDown className="h-3 w-3 mr-1" />
                              Queda
                            </>
                          ) : (
                            <>
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Aumento
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>{alert.thresholdPercent}%</TableCell>
                      <TableCell>
                        {alert.lastTriggered 
                          ? new Date(alert.lastTriggered).toLocaleDateString("pt-BR")
                          : "—"
                        }
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={alert.isActive}
                          onCheckedChange={(isActive) => 
                            toggleMutation.mutate({ id: alert.id, isActive })
                          }
                          data-testid={`switch-alert-${alert.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(alert.id)}
                          data-testid={`button-delete-alert-${alert.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
