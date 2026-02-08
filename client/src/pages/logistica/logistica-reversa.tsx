import { useState, useEffect } from "react";
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
import { Progress } from "@/components/ui/progress";
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
  CheckCircle,
  BarChart3,
  TrendingUp,
  Timer,
  Ban,
  Download,
  Upload
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
  aguardando_coleta: { label: "Aguardando Coleta", className: "bg-amber-100 text-amber-800 border-amber-200" },
  coletado: { label: "Coletado", className: "bg-purple-100 text-purple-800 border-purple-200" },
  objeto_postado: { label: "Objeto Postado", className: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  em_transito: { label: "Em Trânsito", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  em_rota_entrega: { label: "Em Rota de Entrega", className: "bg-teal-100 text-teal-800 border-teal-200" },
  entregue: { label: "Entregue ao Destinatário", className: "bg-green-100 text-green-800 border-green-200" },
  devolvido: { label: "Devolvido ao Remetente", className: "bg-orange-100 text-orange-800 border-orange-200" },
  cancelado: { label: "Cancelado", className: "bg-red-100 text-red-800 border-red-200" },
  expirado: { label: "Prazo Expirado", className: "bg-gray-100 text-gray-800 border-gray-200" },
  aguardando_objeto: { label: "Aguardando Objeto na Agência", className: "bg-lime-100 text-lime-800 border-lime-200" },
};

const TIPO_SERVICO_LABEL: Record<string, string> = {
  "03247": "SEDEX Reversa",
  "03301": "PAC Reversa",
  "04677": "SEDEX Reversa (Homolog)",
  "04170": "SEDEX Reversa Especial",
  "41076": "PAC Reversa (Legado)",
  "40010": "SEDEX Reversa (Legado)",
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
  adicionalAnac: z.boolean().default(true),
  exigeChecklist: z.boolean().default(false),
  observacao: z.string().optional(),
});

type LogisticaReversaFormData = z.infer<typeof logisticaReversaFormSchema>;

const defaultFormValues: LogisticaReversaFormData = {
  tipo: "A",
  codigoServico: "03247",
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
  adicionalAnac: true,
  exigeChecklist: false,
  observacao: "",
};

export default function LogisticaReversaPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("solicitar");
  const [selectedPedido, setSelectedPedido] = useState<LogisticaReversaPedido | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");

  const [consultaCodigo, setConsultaCodigo] = useState("");
  const [consultaResult, setConsultaResult] = useState<any>(null);
  const [consultaLoading, setConsultaLoading] = useState(false);

  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkData, setBulkData] = useState<any[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

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

  const itensWatch = form.watch("itens");
  const valorTotalItens = itensWatch.reduce((acc, item) => acc + (item.quantidade * item.valorUnitario), 0);
  const custoEstimado = 23.90;

  useEffect(() => {
    form.setValue("valorDeclarado", valorTotalItens.toFixed(2));
  }, [valorTotalItens]);

  const handleSolicitar = async (data: LogisticaReversaFormData) => {
    if (data.itens.length > 50) {
      toast({
        title: "Limite excedido",
        description: "O limite máximo por lote é de 50 objetos. Por favor, divida sua solicitação.",
        variant: "destructive",
      });
      return;
    }

    try {
      await solicitarMutation.mutateAsync({ 
        ...data, 
        destinatario,
        itensColeta: JSON.stringify(data.itens),
        valorDeclarado: valorTotalItens.toFixed(2),
        adicionalAnac: data.adicionalAnac,
        exigeChecklist: data.exigeChecklist,
      });
      toast({ title: "Solicitação enviada com sucesso!" });
      form.reset(defaultFormValues);
      setActiveTab("dashboard");
    } catch (error: any) {
      let errorMessage = "Erro desconhecido";
      
      if (error.message) {
        try {
          const jsonMatch = error.message.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);
            errorMessage = errorData.error || errorData.message || errorData.details || error.message;
          } else {
            errorMessage = error.message;
          }
        } catch {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Erro ao solicitar",
        description: errorMessage,
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

  const handleConsultar = async () => {
    if (!consultaCodigo.trim()) {
      toast({ title: "Informe um código para consultar", variant: "destructive" });
      return;
    }
    setConsultaLoading(true);
    setConsultaResult(null);
    try {
      const response = await fetch('/api/logistica-reversa/consultar?codigo=' + encodeURIComponent(consultaCodigo.trim()));
      if (response.ok) {
        const data = await response.json();
        setConsultaResult(data);
      } else {
        toast({ title: "Erro ao consultar", description: "Não foi possível consultar o código informado.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro ao consultar", variant: "destructive" });
    } finally {
      setConsultaLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const header = "nome,email,cep,logradouro,numero,complemento,bairro,cidade,uf,ddd,telefone,descricao_item,quantidade,valor_unitario,imei";
    const example = "João Silva,joao@email.com,01001000,Praça da Sé,100,,Sé,São Paulo,SP,11,999999999,Samsung Galaxy A03,1,500.00,350916874861670";
    const csvContent = header + "\n" + example;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template_coleta_massa.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkFileChange = (file: File | null) => {
    if (!file) return;
    setBulkFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) {
        toast({ title: "Arquivo vazio ou sem dados", variant: "destructive" });
        return;
      }
      const headers = lines[0].split(",").map((h) => h.trim());
      const rows = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, i) => {
          row[h] = values[i] || "";
        });
        return row;
      });
      setBulkData(rows);
    };
    reader.readAsText(file);
  };

  const handleBulkProcess = async () => {
    if (bulkData.length === 0) {
      toast({ title: "Nenhum dado para processar", variant: "destructive" });
      return;
    }

    setBulkProcessing(true);
    setBulkProgress(0);

    const batchSize = 50;
    const totalBatches = Math.ceil(bulkData.length / batchSize);
    let processedBatches = 0;
    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < bulkData.length; i += batchSize) {
        const batch = bulkData.slice(i, i + batchSize);
        
        const batchItens = batch.map((row) => ({
          descricao: row.descricao_item || "",
          quantidade: parseInt(row.quantidade) || 1,
          valorUnitario: parseFloat(row.valor_unitario) || 0,
          imei: row.imei || "",
        }));

        const batchValorTotal = batchItens.reduce(
          (acc, item) => acc + (item.quantidade * item.valorUnitario), 0
        );

        const firstRow = batch[0];
        const batchRequest = {
          tipo: "A" as const,
          codigoServico: "03247",
          remetente: {
            nome: firstRow.nome || "",
            email: firstRow.email || "",
            cep: firstRow.cep || "",
            logradouro: firstRow.logradouro || "",
            numero: firstRow.numero || "",
            complemento: firstRow.complemento || "",
            bairro: firstRow.bairro || "",
            cidade: firstRow.cidade || "",
            uf: firstRow.uf || "",
            ddd: firstRow.ddd || "",
            telefone: firstRow.telefone || "",
          },
          destinatario,
          itensColeta: JSON.stringify(batchItens),
          valorDeclarado: batchValorTotal.toFixed(2),
          adicionalAnac: true,
          exigeChecklist: false,
        };

        try {
          await solicitarMutation.mutateAsync(batchRequest);
          successCount += batch.length;
        } catch (e) {
          errorCount += batch.length;
        }

        processedBatches++;
        setBulkProgress(Math.round((processedBatches / totalBatches) * 100));
      }

      const msg = errorCount > 0 
        ? `${successCount} itens processados com sucesso, ${errorCount} com erro.`
        : `${successCount} itens processados com sucesso em ${totalBatches} lote(s).`;
      toast({ title: "Processamento concluído", description: msg });
      setBulkData([]);
      setBulkFile(null);
    } catch (error: any) {
      toast({ title: "Erro no processamento em massa", description: error.message, variant: "destructive" });
    } finally {
      setBulkProcessing(false);
    }
  };

  const aguardandoPostagemCount = pedidos?.filter((p) => p.status === "aguardando_postagem").length || 0;
  const emTransitoCount = pedidos?.filter((p) => p.status === "em_transito" || p.status === "objeto_postado").length || 0;

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
            <TabsTrigger value="dashboard" className="flex items-center gap-2" data-testid="tab-dashboard">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="consultas" className="flex items-center gap-2" data-testid="tab-consultas">
              <Search className="h-4 w-4" />
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
                                <SelectItem value="03247" data-testid="option-servico-03247">SEDEX Reversa</SelectItem>
                                <SelectItem value="03301" data-testid="option-servico-03301">PAC Reversa</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Truck className="h-4 w-4" />
                        <h3 className="font-medium">Dados do Remetente (Cliente que enviara)</h3>
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
                              <FormLabel>E-mail (para multiplos, separe por virgula)</FormLabel>
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

                    <div className="border rounded-lg p-4 bg-muted/50">
                      <div className="flex items-center gap-2 mb-3">
                        <Package className="h-4 w-4" />
                        <h3 className="font-medium">Dados do Destinatário (Onde será entregue)</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        O destinatário está configurado como RENOV SOLUÇÕES E SERVIÇOS LTDA. Todos os pacotes serão enviados para este endereço.
                      </p>
                      <div className="bg-background rounded-lg p-3 text-sm">
                        <p className="font-medium">{destinatario.nome}</p>
                        <p>{destinatario.logradouro}, {destinatario.numero} - {destinatario.complemento}</p>
                        <p>{destinatario.bairro} - {destinatario.cidade}/{destinatario.uf}</p>
                        <p>CEP: {destinatario.cep}</p>
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
                                  <SelectItem value="1">Caixa/Pacote (tipo 1)</SelectItem>
                                  <SelectItem value="2">Rolo/Prisma (tipo 2)</SelectItem>
                                  <SelectItem value="3">Envelope (tipo 3)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div>
                          <p className="text-sm font-medium mb-2">Valor Declarado (R$)</p>
                          <div className="p-3 bg-muted rounded-lg border" data-testid="display-valor-declarado">
                            <p className="text-lg font-bold">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotalItens)}
                            </p>
                            <p className="text-xs text-muted-foreground">Calculado automaticamente com base nos itens</p>
                          </div>
                        </div>
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
                                Marque esta opcao para dispositivos com baterias de litio (celulares, notebooks, tablets)
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="exigeChecklist"
                        render={({ field }) => (
                          <FormItem className="flex items-start gap-3 p-4 bg-muted rounded-lg border">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-checklist"
                              />
                            </FormControl>
                            <div className="space-y-1">
                              <FormLabel className="font-medium">
                                Exige Checklist de Verificação
                              </FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Marque esta opção para exigir checklist de conferência na entrega
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>

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
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Coleta em Massa
                </CardTitle>
                <CardDescription>Importe um arquivo CSV para criar múltiplas solicitações de coleta de uma vez.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4">
                  <Button variant="outline" onClick={handleDownloadTemplate} data-testid="button-download-template">
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Template CSV
                  </Button>
                </div>

                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors"
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.name.endsWith(".csv")) {
                      handleBulkFileChange(file);
                    } else {
                      toast({ title: "Formato inválido", description: "Por favor, envie um arquivo CSV.", variant: "destructive" });
                    }
                  }}
                  data-testid="dropzone-bulk"
                >
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-4" />
                  <p className="text-muted-foreground mb-2">Arraste e solte seu arquivo CSV aqui</p>
                  <p className="text-xs text-muted-foreground mb-4">ou</p>
                  <label>
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (file) handleBulkFileChange(file);
                      }}
                      data-testid="input-bulk-file"
                    />
                    <Button variant="outline" asChild>
                      <span>Selecionar Arquivo</span>
                    </Button>
                  </label>
                  {bulkFile && (
                    <p className="text-sm mt-4 text-muted-foreground" data-testid="text-bulk-filename">
                      Arquivo selecionado: {bulkFile.name}
                    </p>
                  )}
                </div>

                {bulkData.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium" data-testid="text-bulk-count">{bulkData.length} registros encontrados</p>
                      <Button 
                        onClick={handleBulkProcess} 
                        disabled={bulkProcessing}
                        data-testid="button-bulk-process"
                      >
                        {bulkProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Processar
                      </Button>
                    </div>

                    {bulkProcessing && (
                      <div className="space-y-2" data-testid="bulk-progress">
                        <Progress value={bulkProgress} />
                        <p className="text-xs text-muted-foreground text-center">{bulkProgress}% concluído</p>
                      </div>
                    )}

                    <div className="border rounded-lg overflow-auto max-h-80" data-testid="table-bulk-preview">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>CEP</TableHead>
                            <TableHead>Cidade/UF</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead>Qtd</TableHead>
                            <TableHead>Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bulkData.slice(0, 20).map((row, idx) => (
                            <TableRow key={idx} data-testid={`row-bulk-${idx}`}>
                              <TableCell className="text-sm">{row.nome}</TableCell>
                              <TableCell className="text-sm">{row.email}</TableCell>
                              <TableCell className="text-sm font-mono">{row.cep}</TableCell>
                              <TableCell className="text-sm">{row.cidade}/{row.uf}</TableCell>
                              <TableCell className="text-sm">{row.descricao_item}</TableCell>
                              <TableCell className="text-sm">{row.quantidade}</TableCell>
                              <TableCell className="text-sm">{row.valor_unitario}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {bulkData.length > 20 && (
                        <p className="text-xs text-muted-foreground p-2 text-center">
                          Mostrando 20 de {bulkData.length} registros
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card data-testid="card-kpi-aguardando">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Aguardando Postagem</p>
                      <p className="text-3xl font-bold text-yellow-600" data-testid="stat-kpi-aguardando">{aguardandoPostagemCount}</p>
                    </div>
                    <Timer className="h-10 w-10 text-yellow-500 opacity-30" />
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-kpi-transito">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Postado/Em Trânsito</p>
                      <p className="text-3xl font-bold text-indigo-600" data-testid="stat-kpi-transito">{emTransitoCount}</p>
                    </div>
                    <Truck className="h-10 w-10 text-indigo-500 opacity-30" />
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-kpi-sla">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">SLA Médio de Reversa</p>
                      <p className="text-3xl font-bold" data-testid="stat-kpi-sla">-- dias</p>
                    </div>
                    <TrendingUp className="h-10 w-10 text-muted-foreground opacity-30" />
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-kpi-economia">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Economia Gerada</p>
                      <p className="text-3xl font-bold" data-testid="stat-kpi-economia">R$ --</p>
                    </div>
                    <BarChart3 className="h-10 w-10 text-muted-foreground opacity-30" />
                  </div>
                </CardContent>
              </Card>
            </div>

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
                      <TableRow key={pedido.id} data-testid={`row-lr-${pedido.id}`}>
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
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Consultas
                </CardTitle>
                <CardDescription>Consulte o status de etiquetas e pedidos diretamente na API dos Correios.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-2 max-w-md">
                  <Input 
                    placeholder="Número da Coleta ou E-ticket" 
                    value={consultaCodigo}
                    onChange={(e) => setConsultaCodigo(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleConsultar(); }}
                    data-testid="input-consulta-codigo" 
                  />
                  <Button onClick={handleConsultar} disabled={consultaLoading} data-testid="button-consultar">
                    {consultaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                    Consultar
                  </Button>
                </div>

                {consultaResult && (
                  <div className="space-y-4" data-testid="consulta-result">
                    {!consultaResult.status && !consultaResult.numero_pedido ? (
                      <div className="text-center py-8 text-muted-foreground" data-testid="consulta-empty">
                        Nenhum resultado encontrado
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Card>
                            <CardContent className="pt-6 space-y-3">
                              <div>
                                <p className="text-sm text-muted-foreground">Status</p>
                                <Badge variant="outline" className={STATUS_CONFIG[consultaResult.status]?.className || ""} data-testid="consulta-status">
                                  {STATUS_CONFIG[consultaResult.status]?.label || consultaResult.status || "-"}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Numero do Pedido</p>
                                <p className="font-mono font-medium" data-testid="consulta-numero-pedido">{consultaResult.numero_pedido || "-"}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Etiqueta</p>
                                <p className="font-mono font-medium" data-testid="consulta-etiqueta">{consultaResult.numero_etiqueta || "-"}</p>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="pt-6 space-y-3">
                              {consultaResult.remetente && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Remetente</p>
                                  <p className="font-medium" data-testid="consulta-remetente">{consultaResult.remetente.nome || "-"}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {consultaResult.remetente.cidade}/{consultaResult.remetente.uf} - CEP {consultaResult.remetente.cep}
                                  </p>
                                </div>
                              )}
                              {consultaResult.destinatario && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Destinatário</p>
                                  <p className="font-medium" data-testid="consulta-destinatario">{consultaResult.destinatario.nome || "-"}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {consultaResult.destinatario.cidade}/{consultaResult.destinatario.uf} - CEP {consultaResult.destinatario.cep}
                                  </p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>

                        {consultaResult.historico && consultaResult.historico.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">Histórico de Eventos</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {consultaResult.historico.map((evento: any, idx: number) => (
                                  <div key={idx} className="flex gap-3 text-sm" data-testid={`consulta-evento-${idx}`}>
                                    <div className="text-muted-foreground whitespace-nowrap min-w-[120px]">
                                      {evento.data || "-"}
                                    </div>
                                    <div>
                                      <p className="font-medium">{evento.descricao || evento.status || "-"}</p>
                                      {evento.local && <p className="text-xs text-muted-foreground">{evento.local}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

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
                <p className="text-sm">{selectedPedido.remetenteNome}</p>
                <p className="text-sm text-muted-foreground">{selectedPedido.remetenteEndereco}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedPedido.remetenteCidade}/{selectedPedido.remetenteUf} - CEP: {selectedPedido.remetenteCep}
                </p>
              </div>

              {selectedPedido.observacao && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Observações</h4>
                  <p className="text-sm whitespace-pre-wrap">{selectedPedido.observacao}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t pt-4">
                {selectedPedido.status !== "cancelado" && selectedPedido.status !== "entregue" && (
                  <Button
                    variant="destructive"
                    onClick={() => handleCancelar(selectedPedido.id)}
                    disabled={cancelarMutation.isPending}
                    data-testid="button-cancel-dialog"
                  >
                    {cancelarMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Ban className="mr-2 h-4 w-4" />
                    Cancelar Pedido
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
