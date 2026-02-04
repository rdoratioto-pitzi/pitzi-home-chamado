import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
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
  Eye,
  Plus,
  Trash2,
  CheckCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useForm, useFieldArray } from "react-hook-form";
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

const itemSchema = z.object({
  descricao: z.string().min(1, "Descrição é obrigatória"),
  quantidade: z.number().min(1, "Quantidade mínima é 1"),
  valorUnitario: z.number().min(0, "Valor inválido"),
  imei: z.string().optional(),
});

const logisticaReversaFormSchema = z.object({
  tipo: z.string().min(1, "Tipo é obrigatório"),
  codigoServico: z.string().min(1, "Serviço é obrigatório"),
  remetente: z.object({
    nome: z.string().min(3, "Nome é obrigatório"),
    email: z.string().email().optional().or(z.literal("")),
    cep: z.string().min(8, "CEP é obrigatório"),
    logradouro: z.string().min(3, "Logradouro é obrigatório"),
    numero: z.string().min(1, "Número é obrigatório"),
    complemento: z.string().optional(),
    bairro: z.string().min(2, "Bairro é obrigatório"),
    cidade: z.string().min(2, "Cidade é obrigatória"),
    uf: z.string().length(2, "UF deve ter 2 caracteres"),
    ddd: z.string().optional(),
    telefone: z.string().optional(),
  }),
  itens: z.array(itemSchema).min(1, "Adicione pelo menos um item"),
  tipoEmbalagem: z.string().optional(),
  valorDeclarado: z.string().optional(),
  adicionalAnac: z.boolean().default(false),
  observacao: z.string().optional(),
});

type LogisticaReversaFormData = z.infer<typeof logisticaReversaFormSchema>;

const defaultFormValues: LogisticaReversaFormData = {
  tipo: "C",
  codigoServico: "41076",
  remetente: {
    nome: "",
    email: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    ddd: "",
    telefone: "",
  },
  itens: [{ descricao: "", quantidade: 1, valorUnitario: 0, imei: "" }],
  tipoEmbalagem: "",
  valorDeclarado: "",
  adicionalAnac: false,
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

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "itens",
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
      await solicitarMutation.mutateAsync({ 
        ...data, 
        destinatario,
        itensColeta: JSON.stringify(data.itens),
        valorDeclarado: data.valorDeclarado,
        adicionalAnac: data.adicionalAnac,
      });
      toast({ title: "Solicitação enviada com sucesso!" });
      form.reset(defaultFormValues);
      setActiveTab("acompanhamento");
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
      p.remetenteNome?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  const itensWatch = form.watch("itens");
  const valorTotalItens = itensWatch.reduce((acc, item) => acc + (item.quantidade * item.valorUnitario), 0);
  const custoEstimado = 23.90; // Mock calculation

  const handleFinalizarItens = () => {
    const itens = form.getValues("itens");
    if (!itens || itens.length === 0) return;

    const observacaoAtual = form.getValues("observacao") || "";
    const listaItens = itens
      .map((item) => `${item.descricao}${item.imei ? ` (IMEI: ${item.imei})` : ""}`)
      .join("\n");

    const novaObservacao = observacaoAtual 
      ? `${observacaoAtual}\n\nItens:\n${listaItens}`
      : `Itens:\n${listaItens}`;

    form.setValue("observacao", novaObservacao);
    toast({
      title: "Itens finalizados",
      description: "As informações dos itens foram adicionadas às observações.",
    });
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader 
        title="Logística Reversa" 
        description="Solicite coletas, acompanhe pedidos e gerencie devoluções via Correios"
        breadcrumbs={[
          { label: "Logística", href: "/logistica" },
          { label: "Logística Reversa" },
        ]}
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-lr-total">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                  <p className="text-3xl font-bold text-primary" data-testid="stat-lr-total">{stats?.total || 0}</p>
                </div>
                <Package className="h-10 w-10 text-primary opacity-30" />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-lr-pending">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-3xl font-bold text-yellow-600" data-testid="stat-lr-pending">{stats?.pendentes || 0}</p>
                </div>
                <Clock className="h-10 w-10 text-yellow-500 opacity-30" />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-lr-completed">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Concluídos</p>
                  <p className="text-3xl font-bold text-green-600" data-testid="stat-lr-completed">{stats?.concluidos || 0}</p>
                </div>
                <CheckCircle className="h-10 w-10 text-green-500 opacity-30" />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-lr-cancelled">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cancelados</p>
                  <p className="text-3xl font-bold text-red-600" data-testid="stat-lr-cancelled">{stats?.cancelados || 0}</p>
                </div>
                <XCircle className="h-10 w-10 text-red-500 opacity-30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="solicitar" className="flex items-center gap-2" data-testid="tab-solicitar">
              <Package className="h-4 w-4" />
              Solicitar Coleta
            </TabsTrigger>
            <TabsTrigger value="massa" className="flex items-center gap-2" data-testid="tab-massa">
              <Truck className="h-4 w-4" />
              Coleta em Massa
            </TabsTrigger>
            <TabsTrigger value="acompanhamento" className="flex items-center gap-2" data-testid="tab-acompanhamento">
              <Search className="h-4 w-4" />
              Acompanhamento
            </TabsTrigger>
            <TabsTrigger value="consultas" className="flex items-center gap-2" data-testid="tab-consultas">
              <Clock className="h-4 w-4" />
              Consultas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="solicitar" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Nova Solicitação de Coleta
                </CardTitle>
                <CardDescription>
                  Solicite uma coleta reversa via Correios. O cliente poderá postar o pacote em uma agência ou agendar coleta domiciliar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSolicitar)} className="space-y-6">
                    {/* Tipo e Serviço */}
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
                                <SelectItem value="C" data-testid="option-tipo-C">Coleta Domiciliar</SelectItem>
                                <SelectItem value="A" data-testid="option-tipo-A">Autorização de Postagem</SelectItem>
                                <SelectItem value="CA" data-testid="option-tipo-CA">Coleta Simultânea</SelectItem>
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
                                <SelectItem value="41076" data-testid="option-servico-41076">PAC Reversa</SelectItem>
                                <SelectItem value="40010" data-testid="option-servico-40010">SEDEX Reversa</SelectItem>
                                <SelectItem value="40215" data-testid="option-servico-40215">SEDEX 10 Reversa</SelectItem>
                                <SelectItem value="40290" data-testid="option-servico-40290">SEDEX 12 Reversa</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Dados do Remetente */}
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Truck className="h-4 w-4" />
                        <h3 className="font-medium">Dados do Remetente (Cliente que enviará)</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="remetente.nome"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome Completo *</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-remetente-nome" />
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
                              <FormLabel>E-mail (para múltiplos, separe por vírgula)</FormLabel>
                              <FormControl>
                                <Input type="email" {...field} data-testid="input-remetente-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <FormField
                          control={form.control}
                          name="remetente.cep"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CEP *</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input 
                                    {...field}
                                    onBlur={(e) => { field.onBlur(); consultarCep(e.target.value); }}
                                    placeholder="00000-000"
                                    data-testid="input-remetente-cep"
                                  />
                                  <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon"
                                    className="absolute right-0 top-0"
                                    onClick={() => consultarCep(field.value)}
                                  >
                                    <Search className="h-4 w-4" />
                                  </Button>
                                </div>
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
                              <FormLabel>Logradouro *</FormLabel>
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
                              <FormLabel>Número *</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-remetente-numero" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <FormField
                          control={form.control}
                          name="remetente.complemento"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Complemento</FormLabel>
                              <FormControl>
                                <Input placeholder="Apto, Bloco..." {...field} data-testid="input-remetente-complemento" />
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
                              <FormLabel>Bairro *</FormLabel>
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
                              <FormLabel>Cidade *</FormLabel>
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
                              <FormLabel>UF *</FormLabel>
                              <FormControl>
                                <Input {...field} maxLength={2} data-testid="input-remetente-uf" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <FormField
                          control={form.control}
                          name="remetente.ddd"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>DDD</FormLabel>
                              <FormControl>
                                <Input {...field} maxLength={2} data-testid="input-remetente-ddd" />
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
                      </div>
                    </div>

                    {/* Dados do Destinatário */}
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <div className="flex items-center gap-2 mb-3">
                        <Package className="h-4 w-4" />
                        <h3 className="font-medium">Dados do Destinatário (Onde será entregue)</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        O destinatário está configurado como RENOV SOLUCOES E SERVICOS LTDA. Todos os pacotes serão enviados para este endereço.
                      </p>
                      <div className="bg-background rounded-lg p-3 text-sm">
                        <p className="font-medium">{destinatario.nome}</p>
                        <p>{destinatario.logradouro}, {destinatario.numero} - {destinatario.complemento}</p>
                        <p>{destinatario.bairro} - {destinatario.cidade}/{destinatario.uf}</p>
                        <p>CEP: {destinatario.cep}</p>
                      </div>
                    </div>

                    {/* Observações */}
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

                    {/* Itens a Coletar */}
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          <h3 className="font-medium">Itens a Coletar</h3>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={handleFinalizarItens}
                            data-testid="button-finalizar-itens"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Finalizar Itens
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => append({ descricao: "", quantidade: 1, valorUnitario: 0, imei: "" })}
                            data-testid="button-adicionar-item"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar Item
                          </Button>
                        </div>
                      </div>

                      {fields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-5">
                            <FormField
                              control={form.control}
                              name={`itens.${index}.descricao`}
                              render={({ field }) => (
                                <FormItem>
                                  {index === 0 && <FormLabel className="text-xs">Descrição do Item</FormLabel>}
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      placeholder="Ex: SAMSUNG GALAXY A03 1 GB Black"
                                      data-testid={`input-item-descricao-${index}`}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="col-span-1">
                            <FormField
                              control={form.control}
                              name={`itens.${index}.quantidade`}
                              render={({ field }) => (
                                <FormItem>
                                  {index === 0 && <FormLabel className="text-xs">Qtd</FormLabel>}
                                  <FormControl>
                                    <Input 
                                      type="number"
                                      min={1}
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                      data-testid={`input-item-qtd-${index}`}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="col-span-2">
                            <FormField
                              control={form.control}
                              name={`itens.${index}.valorUnitario`}
                              render={({ field }) => (
                                <FormItem>
                                  {index === 0 && <FormLabel className="text-xs">Valor Unit. (R$)</FormLabel>}
                                  <FormControl>
                                    <Input 
                                      type="number"
                                      step="0.01"
                                      min={0}
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      data-testid={`input-item-valor-${index}`}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="col-span-3">
                            <FormField
                              control={form.control}
                              name={`itens.${index}.imei`}
                              render={({ field }) => (
                                <FormItem>
                                  {index === 0 && <FormLabel className="text-xs">IMEI</FormLabel>}
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      placeholder="350916874861670"
                                      data-testid={`input-item-imei-${index}`}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="col-span-1">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon"
                              onClick={() => fields.length > 1 && remove(index)}
                              disabled={fields.length <= 1}
                              data-testid={`button-remove-item-${index}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      <p className="text-xs text-muted-foreground">
                        Pressione Enter para adicionar novo item rapidamente
                      </p>
                      <div className="text-right">
                        <span className="text-sm text-muted-foreground">Valor Total dos Itens: </span>
                        <span className="font-bold" data-testid="valor-total-itens">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotalItens)}
                        </span>
                      </div>
                    </div>

                    {/* Embalagem e Adicionais */}
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        <h3 className="font-medium">Embalagem e Adicionais</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="tipoEmbalagem"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo de Embalagem</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-embalagem">
                                    <SelectValue placeholder="Selecione..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="caixa_p">Caixa Pequena</SelectItem>
                                  <SelectItem value="caixa_m">Caixa Média</SelectItem>
                                  <SelectItem value="caixa_g">Caixa Grande</SelectItem>
                                  <SelectItem value="envelope">Envelope</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="valorDeclarado"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Valor Declarado (R$)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  step="0.01"
                                  {...field}
                                  data-testid="input-valor-declarado"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="adicionalAnac"
                        render={({ field }) => (
                          <FormItem className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-anac"
                              />
                            </FormControl>
                            <div className="space-y-1">
                              <FormLabel className="font-medium text-yellow-800 dark:text-yellow-200">
                                Adicional 095 - ARTIGOS PERIGOSOS ANAC
                              </FormLabel>
                              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                Marque esta opção para dispositivos com baterias de lítio (celulares, notebooks, tablets)
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Custo Estimado */}
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">Custo Estimado da Coleta:</p>
                        <p className="text-xs text-muted-foreground">* Valor estimado baseado no serviço e embalagem selecionados. O valor final pode variar.</p>
                      </div>
                      <p className="text-3xl font-bold text-primary" data-testid="custo-estimado">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(custoEstimado)}
                      </p>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={solicitarMutation.isPending}
                      data-testid="button-submit-lr"
                    >
                      {solicitarMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Package className="mr-2 h-4 w-4" />
                      Solicitar Coleta
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="massa" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Coleta em Massa</CardTitle>
                <CardDescription>Importe um arquivo CSV ou Excel para criar múltiplas solicitações de coleta.</CardDescription>
              </CardHeader>
              <CardContent className="text-center py-12">
                <Package className="h-16 w-16 mx-auto text-muted-foreground opacity-30 mb-4" />
                <p className="text-muted-foreground">Funcionalidade em desenvolvimento</p>
                <Button variant="outline" className="mt-4" disabled>
                  Importar Arquivo
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="acompanhamento" className="space-y-6">
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
                            <span className="text-xs text-muted-foreground">{pedido.numeroEtiqueta || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{pedido.remetenteNome || "-"}</span>
                            <span className="text-xs text-muted-foreground">
                              {pedido.remetenteCidade && pedido.remetenteUf ? `${pedido.remetenteCidade}/${pedido.remetenteUf}` : "-"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{TIPO_SERVICO_LABEL[pedido.codigoServico] || pedido.codigoServico}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_CONFIG[pedido.status]?.className || ""}>
                            {STATUS_CONFIG[pedido.status]?.label || pedido.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
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

          <TabsContent value="consultas" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Consultas</CardTitle>
                <CardDescription>Consulte o status de etiquetas e pedidos diretamente na API dos Correios.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 max-w-md">
                  <Input placeholder="Digite o código de rastreio ou número do pedido" data-testid="input-consulta-codigo" />
                  <Button data-testid="button-consultar">
                    <Search className="h-4 w-4 mr-2" />
                    Consultar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Details Dialog */}
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
                  <p className="font-mono font-medium">{selectedPedido.numeroEtiqueta || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="outline" className={STATUS_CONFIG[selectedPedido.status]?.className || ""}>
                    {STATUS_CONFIG[selectedPedido.status]?.label || selectedPedido.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Serviço</p>
                  <p>{TIPO_SERVICO_LABEL[selectedPedido.codigoServico] || selectedPedido.codigoServico}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Remetente</h4>
                <p>{selectedPedido.remetenteNome}</p>
                <p className="text-sm text-muted-foreground">{selectedPedido.remetenteEndereco}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedPedido.remetenteCidade}/{selectedPedido.remetenteUf} - CEP: {selectedPedido.remetenteCep}
                </p>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Destinatário</h4>
                <p>{selectedPedido.destinatarioNome}</p>
                <p className="text-sm text-muted-foreground">{selectedPedido.destinatarioEndereco}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedPedido.destinatarioCidade}/{selectedPedido.destinatarioUf} - CEP: {selectedPedido.destinatarioCep}
                </p>
              </div>

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
