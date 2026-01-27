import { useRequests, useCreateRequest, useUpdateRequest } from "@/hooks/use-logistics";
import { useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Package, Search, Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  quoted: "outline",
  approved: "default",
  collected: "default",
  delivered: "default",
  cancelled: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  quoted: "Cotado",
  approved: "Aprovado",
  collected: "Coletado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const requestFormSchema = z.object({
  origem: z.string().min(3, "Origem deve ter pelo menos 3 caracteres"),
  destino: z.string().min(3, "Destino deve ter pelo menos 3 caracteres"),
  peso: z.string().min(1, "Peso é obrigatório"),
  cubagem: z.string().min(1, "Cubagem é obrigatória"),
  observacao: z.string().optional(),
});

type RequestFormData = z.infer<typeof requestFormSchema>;

export default function SolicitacoesPage() {
  const { data: requests, isLoading } = useRequests();
  const { mutateAsync: createRequest, isPending } = useCreateRequest();
  const { mutateAsync: updateRequest } = useUpdateRequest();
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestFormSchema),
    defaultValues: {
      origem: "",
      destino: "",
      peso: "",
      cubagem: "",
      observacao: "",
    },
  });

  const onSubmit = async (data: RequestFormData) => {
    try {
      await createRequest(data);
      toast({ title: "Solicitação criada com sucesso!" });
      setOpen(false);
      form.reset();
    } catch (err) {
      toast({ title: "Erro ao criar solicitação", variant: "destructive" });
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await updateRequest({ id, data: { status: newStatus } });
      toast({ title: "Status atualizado!" });
    } catch (err) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  const filteredRequests = requests?.filter((req) => 
    req.id.toString().includes(filter) ||
    req.origem.toLowerCase().includes(filter.toLowerCase()) ||
    req.destino.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-8" data-testid="page-solicitacoes">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="heading-solicitacoes">Solicitações de Coleta</h2>
          <p className="text-muted-foreground mt-1">Acompanhe o status de todas as coletas solicitadas.</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-request">
              <Plus className="mr-2 h-4 w-4" /> Nova Solicitação
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Nova Solicitação de Coleta</DialogTitle>
              <DialogDescription>
                Preencha os dados para criar uma nova solicitação.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="origem"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Origem</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="São Paulo, SP"
                            {...field}
                            data-testid="input-origem"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="destino"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Destino</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Rio de Janeiro, RJ"
                            {...field}
                            data-testid="input-destino"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="peso"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Peso (kg)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.1"
                            placeholder="10.5"
                            {...field}
                            data-testid="input-peso"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cubagem"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cubagem (m³)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.01"
                            placeholder="0.25"
                            {...field}
                            data-testid="input-cubagem"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="observacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observação</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Informações adicionais..."
                          {...field}
                          data-testid="input-observacao"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="pt-4 flex justify-end gap-2">
                  <Button variant="outline" type="button" onClick={() => setOpen(false)} data-testid="button-cancel-form">Cancelar</Button>
                  <Button type="submit" disabled={isPending} data-testid="button-submit-request">
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar Solicitação
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Filtrar por ID, Origem ou Destino..." 
            className="pl-10"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            data-testid="input-filter-requests"
          />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden" data-testid="table-container-requests">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Origem → Destino</TableHead>
              <TableHead>Carga</TableHead>
              <TableHead>Valor Estimado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" data-testid="loader-requests" />
                </TableCell>
              </TableRow>
            ) : filteredRequests?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground" data-testid="empty-state-requests">
                  Nenhuma solicitação encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests?.map((req) => (
                <TableRow key={req.id} className="hover-elevate" data-testid={`row-request-${req.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium" data-testid={`text-origem-${req.id}`}>{req.origem}</span>
                        <span className="text-xs text-muted-foreground" data-testid={`text-destino-${req.id}`}>para {req.destino}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm" data-testid={`text-carga-${req.id}`}>
                      {req.peso} kg <span className="text-muted-foreground mx-1">•</span> {req.cubagem} m³
                    </div>
                  </TableCell>
                  <TableCell data-testid={`text-valor-${req.id}`}>
                    {req.valorEstimado 
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(req.valorEstimado))
                      : "-"
                    }
                  </TableCell>
                  <TableCell>
                    <Select 
                      value={req.status} 
                      onValueChange={(value) => handleUpdateStatus(req.id, value)}
                    >
                      <SelectTrigger className="w-[130px]" data-testid={`select-status-${req.id}`}>
                        <Badge variant={STATUS_VARIANTS[req.status] || "outline"}>
                          {STATUS_LABELS[req.status] || req.status}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending" data-testid={`option-pending-${req.id}`}>Pendente</SelectItem>
                        <SelectItem value="quoted" data-testid={`option-quoted-${req.id}`}>Cotado</SelectItem>
                        <SelectItem value="approved" data-testid={`option-approved-${req.id}`}>Aprovado</SelectItem>
                        <SelectItem value="collected" data-testid={`option-collected-${req.id}`}>Coletado</SelectItem>
                        <SelectItem value="delivered" data-testid={`option-delivered-${req.id}`}>Entregue</SelectItem>
                        <SelectItem value="cancelled" data-testid={`option-cancelled-${req.id}`}>Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground" data-testid={`text-date-${req.id}`}>
                    {req.createdAt && format(new Date(req.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" data-testid={`button-track-${req.id}`}>Rastrear</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
