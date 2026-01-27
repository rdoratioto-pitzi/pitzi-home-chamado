import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Package, 
  Truck, 
  Search, 
  Clock,
  Loader2,
  XCircle,
  Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useLogisticaReversaPedidos, 
  useLogisticaReversaStats, 
  useLogisticaReversaServicos,
  useSolicitarLogisticaReversa,
  useCancelarLogisticaReversa 
} from "@/hooks/use-logistics";
import type { LogisticaReversaPedido } from "@shared/schema";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  solicitado: { label: "Solicitado", className: "bg-blue-100 text-blue-800 border-blue-200" },
  aguardando_postagem: { label: "Aguardando Postagem", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  coletado: { label: "Coletado", className: "bg-purple-100 text-purple-800 border-purple-200" },
  em_transito: { label: "Em Trânsito", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  entregue: { label: "Entregue", className: "bg-green-100 text-green-800 border-green-200" },
  cancelado: { label: "Cancelado", className: "bg-red-100 text-red-800 border-red-200" },
};

const TIPO_SERVICO_LABEL: Record<string, string> = {
  "41076": "PAC Reversa",
  "40010": "SEDEX Reversa",
  "40215": "SEDEX 10 Reversa",
  "40290": "SEDEX 12 Reversa",
};

const TIPO_COLETA_LABEL: Record<string, string> = {
  "A": "Autorização de Postagem",
  "C": "Coleta Domiciliar",
  "CA": "Coleta Simultânea",
};

const remetenteSchema = z.object({
  nome: z.string().min(3, "Nome é obrigatório"),
  logradouro: z.string().min(3, "Logradouro é obrigatório"),
  numero: z.string().min(1, "Número é obrigatório"),
  complemento: z.string().optional(),
  bairro: z.string().min(2, "Bairro é obrigatório"),
  cep: z.string().min(8, "CEP é obrigatório"),
  cidade: z.string().min(2, "Cidade é obrigatória"),
  uf: z.string().length(2, "UF deve ter 2 caracteres"),
  ddd: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

const logisticaReversaFormSchema = z.object({
  tipo: z.string().min(1, "Tipo é obrigatório"),
  codigoServico: z.string().min(1, "Serviço é obrigatório"),
  remetente: remetenteSchema,
  observacao: z.string().optional(),
});

type LogisticaReversaFormData = z.infer<typeof logisticaReversaFormSchema>;

const defaultFormValues: LogisticaReversaFormData = {
  tipo: "C",
  codigoServico: "41076",
  remetente: {
    nome: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cep: "",
    cidade: "",
    uf: "",
    ddd: "",
    telefone: "",
    email: "",
  },
  observacao: "",
};

export default function LogisticaReversaPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("solicitar");
  const [selectedPedido, setSelectedPedido] = useState<LogisticaReversaPedido | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: servicos } = useLogisticaReversaServicos();
  const { data: pedidos, isLoading: isLoadingPedidos } = useLogisticaReversaPedidos();
  const { data: stats } = useLogisticaReversaStats();
  const solicitarMutation = useSolicitarLogisticaReversa();
  const cancelarMutation = useCancelarLogisticaReversa();

  const form = useForm<LogisticaReversaFormData>({
    resolver: zodResolver(logisticaReversaFormSchema),
    defaultValues: defaultFormValues,
  });

  const destinatario = {
    nome: "RENOV SOLUCOES E SERVICOS LTDA",
    logradouro: "R LUIGI GALVANI",
    numero: "200",
    complemento: "CONJ 11",
    bairro: "CIDADE MONCOES",
    cep: "04575020",
    cidade: "SAO PAULO",
    uf: "SP",
  };

  const handleSolicitar = async (data: LogisticaReversaFormData) => {
    try {
      await solicitarMutation.mutateAsync({ ...data, destinatario });
      toast({ title: "Solicitação enviada com sucesso!" });
      form.reset(defaultFormValues);
      setActiveTab("pedidos");
    } catch (error: any) {
      toast({
        title: "Erro ao solicitar",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleCancelar = async (id: string) => {
    try {
      await cancelarMutation.mutateAsync(id);
      toast({ title: "Pedido cancelado com sucesso" });
      setIsDetailsOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao cancelar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const consultarCep = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) return;
    
    try {
      const response = await fetch(`/api/cep/${cepLimpo}`);
      if (response.ok) {
        const data = await response.json();
        const currentValues = form.getValues("remetente");
        form.setValue("remetente", {
          ...currentValues,
          cep: cep,
          logradouro: data.logradouro || currentValues.logradouro,
          bairro: data.bairro || currentValues.bairro,
          cidade: data.cidade || currentValues.cidade,
          uf: data.uf || currentValues.uf,
          ddd: data.ddd || currentValues.ddd,
        });
        toast({ title: "CEP encontrado" });
      }
    } catch (e) {
      toast({ title: "Erro ao consultar CEP", variant: "destructive" });
    }
  };

  const filteredPedidos = pedidos?.filter((p) => {
    const matchStatus = filtroStatus === "todos" || p.status === filtroStatus;
    const matchSearch = !searchTerm || 
      p.numeroPedido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.remetenteNome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.idCliente?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6" data-testid="page-logistica-reversa">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-lr-total">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                <p className="text-2xl font-bold" data-testid="stat-lr-total">{stats?.total || 0}</p>
              </div>
              <Package className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-lr-pending">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600" data-testid="stat-lr-pending">{stats?.pendentes || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-lr-completed">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Concluídos</p>
                <p className="text-2xl font-bold text-green-600" data-testid="stat-lr-completed">{stats?.concluidos || 0}</p>
              </div>
              <Truck className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-lr-cancelled">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cancelados</p>
                <p className="text-2xl font-bold text-red-600" data-testid="stat-lr-cancelled">{stats?.cancelados || 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="solicitar" data-testid="tab-solicitar">Nova Solicitação</TabsTrigger>
          <TabsTrigger value="pedidos" data-testid="tab-pedidos">Meus Pedidos</TabsTrigger>
        </TabsList>

        <TabsContent value="solicitar" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Solicitar Coleta Reversa</CardTitle>
              <CardDescription>Preencha os dados para solicitar uma coleta reversa via Correios</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSolicitar)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="tipo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Coleta</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-tipo">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {servicos?.tipos?.map((t) => (
                                <SelectItem key={t.codigo} value={t.codigo} data-testid={`option-tipo-${t.codigo}`}>{t.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="codigoServico"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Serviço</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-servico">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {servicos?.servicos?.map((s) => (
                                <SelectItem key={s.codigo} value={s.codigo} data-testid={`option-servico-${s.codigo}`}>{s.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-medium">Dados do Remetente</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="remetente.nome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome / Razão Social</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-remetente-nome" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="remetente.cep"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CEP</FormLabel>
                            <FormControl>
                              <Input 
                                {...field}
                                onBlur={(e) => { field.onBlur(); consultarCep(e.target.value); }}
                                placeholder="00000-000"
                                data-testid="input-remetente-cep"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="remetente.logradouro"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Logradouro</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-remetente-logradouro" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="remetente.numero"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-remetente-numero" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="remetente.complemento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Complemento</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-remetente-complemento" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="remetente.bairro"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bairro</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-remetente-bairro" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="remetente.cidade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-remetente-cidade" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="remetente.uf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>UF</FormLabel>
                            <FormControl>
                              <Input {...field} maxLength={2} data-testid="input-remetente-uf" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="remetente.telefone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-remetente-telefone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="remetente.email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} data-testid="input-remetente-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="observacao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field}
                            placeholder="Informações adicionais sobre a coleta..."
                            data-testid="textarea-observacao"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" disabled={solicitarMutation.isPending} data-testid="button-submit-lr">
                      {solicitarMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Solicitar Coleta
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pedidos" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por número, remetente..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-lr"
              />
            </div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" data-testid="option-filter-todos">Todos</SelectItem>
                <SelectItem value="solicitado" data-testid="option-filter-solicitado">Solicitado</SelectItem>
                <SelectItem value="aguardando_postagem" data-testid="option-filter-aguardando">Aguardando Postagem</SelectItem>
                <SelectItem value="coletado" data-testid="option-filter-coletado">Coletado</SelectItem>
                <SelectItem value="em_transito" data-testid="option-filter-transito">Em Trânsito</SelectItem>
                <SelectItem value="entregue" data-testid="option-filter-entregue">Entregue</SelectItem>
                <SelectItem value="cancelado" data-testid="option-filter-cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg overflow-hidden" data-testid="table-container-lr">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Remetente</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingPedidos ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" data-testid="loader-lr" />
                    </TableCell>
                  </TableRow>
                ) : filteredPedidos?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground" data-testid="empty-state-lr">
                      Nenhum pedido encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPedidos?.map((pedido) => (
                    <TableRow key={pedido.id} className="hover-elevate" data-testid={`row-lr-${pedido.id}`}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium font-mono" data-testid={`text-pedido-${pedido.id}`}>{pedido.numeroPedido || "-"}</span>
                          <span className="text-xs text-muted-foreground" data-testid={`text-etiqueta-${pedido.id}`}>{pedido.numeroEtiqueta || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium" data-testid={`text-remetente-${pedido.id}`}>{pedido.remetenteNome || "-"}</span>
                          <span className="text-xs text-muted-foreground">
                            {pedido.remetenteCidade && pedido.remetenteUf ? `${pedido.remetenteCidade}/${pedido.remetenteUf}` : "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm" data-testid={`text-servico-${pedido.id}`}>{TIPO_SERVICO_LABEL[pedido.codigoServico] || pedido.codigoServico}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_CONFIG[pedido.status]?.className || ""} data-testid={`badge-status-${pedido.id}`}>
                          {STATUS_CONFIG[pedido.status]?.label || pedido.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" data-testid={`text-date-${pedido.id}`}>
                        {pedido.createdAt && format(new Date(pedido.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => { setSelectedPedido(pedido); setIsDetailsOpen(true); }}
                            data-testid={`button-view-${pedido.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {pedido.status !== "cancelado" && pedido.status !== "entregue" && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleCancelar(pedido.id)}
                              disabled={cancelarMutation.isPending}
                              data-testid={`button-cancel-${pedido.id}`}
                            >
                              <XCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido</DialogTitle>
            <DialogDescription>
              Pedido {selectedPedido?.numeroPedido}
            </DialogDescription>
          </DialogHeader>
          {selectedPedido && (
            <div className="space-y-4" data-testid="dialog-details-content">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Etiqueta</p>
                  <p className="font-mono font-medium" data-testid="detail-etiqueta">{selectedPedido.numeroEtiqueta || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="outline" className={STATUS_CONFIG[selectedPedido.status]?.className || ""} data-testid="detail-status">
                    {STATUS_CONFIG[selectedPedido.status]?.label || selectedPedido.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Serviço</p>
                  <p data-testid="detail-servico">{TIPO_SERVICO_LABEL[selectedPedido.codigoServico] || selectedPedido.codigoServico}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <p data-testid="detail-tipo">{TIPO_COLETA_LABEL[selectedPedido.tipo] || selectedPedido.tipo}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Remetente</h4>
                <p data-testid="detail-remetente-nome">{selectedPedido.remetenteNome}</p>
                <p className="text-sm text-muted-foreground" data-testid="detail-remetente-endereco">{selectedPedido.remetenteEndereco}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedPedido.remetenteCidade}/{selectedPedido.remetenteUf} - CEP: {selectedPedido.remetenteCep}
                </p>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Destinatário</h4>
                <p data-testid="detail-destinatario-nome">{selectedPedido.destinatarioNome}</p>
                <p className="text-sm text-muted-foreground" data-testid="detail-destinatario-endereco">{selectedPedido.destinatarioEndereco}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedPedido.destinatarioCidade}/{selectedPedido.destinatarioUf} - CEP: {selectedPedido.destinatarioCep}
                </p>
              </div>

              {selectedPedido.observacao && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Observações</h4>
                  <p className="text-sm text-muted-foreground" data-testid="detail-observacao">{selectedPedido.observacao}</p>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setIsDetailsOpen(false)} data-testid="button-close-details">
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
