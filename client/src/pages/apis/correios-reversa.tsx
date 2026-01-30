import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Package, 
  Truck, 
  Search, 
  Clock,
  Loader2,
  XCircle,
  CheckCircle,
  Send,
  RefreshCw,
  Hash,
  Calendar,
  AlertCircle,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface CorreiosConfig {
  configured: boolean;
  cartaoPostagem: string;
  codAdministrativo: string;
  usuario: string;
}
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const solicitarPostagemSchema = z.object({
  codigo_servico: z.string().min(1, "Código do serviço obrigatório"),
  tipo: z.enum(["A", "C", "CA"]),
  id_cliente: z.string().optional(),
  ag: z.string().optional(),
  valor_declarado: z.string().optional(),
  descricao: z.string().optional(),
  remetente_nome: z.string().min(1, "Nome obrigatório"),
  remetente_logradouro: z.string().min(1, "Logradouro obrigatório"),
  remetente_numero: z.string().min(1, "Número obrigatório"),
  remetente_complemento: z.string().optional(),
  remetente_bairro: z.string().min(1, "Bairro obrigatório"),
  remetente_cidade: z.string().min(1, "Cidade obrigatória"),
  remetente_uf: z.string().length(2, "UF deve ter 2 caracteres"),
  remetente_cep: z.string().min(8, "CEP obrigatório"),
  remetente_ddd: z.string().min(2, "DDD obrigatório"),
  remetente_telefone: z.string().min(8, "Telefone obrigatório"),
  remetente_email: z.string().email("Email inválido"),
  remetente_restricao_anac: z.string().default("S"),
});

const cancelarPedidoSchema = z.object({
  numeroPedido: z.string().min(1, "Número do pedido obrigatório"),
  tipo: z.enum(["A", "C"]),
});

const acompanharPedidoSchema = z.object({
  numeroPedido: z.string().min(1, "Número do pedido obrigatório"),
  tipoBusca: z.enum(["T", "P", "U"]),
  tipoSolicitacao: z.enum(["A", "C"]),
});

const acompanharPorDataSchema = z.object({
  data: z.string().min(1, "Data obrigatória"),
  tipoSolicitacao: z.enum(["A", "C"]),
});

const revalidarPrazoSchema = z.object({
  numeroPedido: z.string().min(1, "Número do pedido obrigatório"),
  qtdeDias: z.number().min(5).max(30),
});

const solicitarRangeSchema = z.object({
  tipo: z.literal("AP"),
  servico: z.string().optional(),
  quantidade: z.number().min(1).max(50000),
});

const calcularDigitoSchema = z.object({
  numero: z.string().min(1, "Número obrigatório"),
});

export default function CorreiosReversaPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("config");
  const [apiResponse, setApiResponse] = useState<any>(null);

  const { data: config, isLoading: isLoadingConfig } = useQuery<CorreiosConfig>({
    queryKey: ["/api/correios/config"],
  });

  const solicitarPostagemForm = useForm({
    resolver: zodResolver(solicitarPostagemSchema),
    defaultValues: {
      codigo_servico: "04677",
      tipo: "A" as const,
      id_cliente: "",
      ag: "",
      valor_declarado: "",
      descricao: "",
      remetente_nome: "",
      remetente_logradouro: "",
      remetente_numero: "",
      remetente_complemento: "",
      remetente_bairro: "",
      remetente_cidade: "",
      remetente_uf: "",
      remetente_cep: "",
      remetente_ddd: "",
      remetente_telefone: "",
      remetente_email: "",
      remetente_restricao_anac: "S",
    },
  });

  const cancelarPedidoForm = useForm({
    resolver: zodResolver(cancelarPedidoSchema),
    defaultValues: { numeroPedido: "", tipo: "A" as const },
  });

  const acompanharPedidoForm = useForm({
    resolver: zodResolver(acompanharPedidoSchema),
    defaultValues: { numeroPedido: "", tipoBusca: "T" as const, tipoSolicitacao: "A" as const },
  });

  const acompanharPorDataForm = useForm({
    resolver: zodResolver(acompanharPorDataSchema),
    defaultValues: { data: "", tipoSolicitacao: "A" as const },
  });

  const revalidarPrazoForm = useForm({
    resolver: zodResolver(revalidarPrazoSchema),
    defaultValues: { numeroPedido: "", qtdeDias: 10 },
  });

  const solicitarRangeForm = useForm({
    resolver: zodResolver(solicitarRangeSchema),
    defaultValues: { tipo: "AP" as const, servico: undefined as string | undefined, quantidade: 10 },
  });

  const calcularDigitoForm = useForm({
    resolver: zodResolver(calcularDigitoSchema),
    defaultValues: { numero: "" },
  });

  const solicitarPostagemMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        codigo_servico: data.codigo_servico,
        destinatario: {
          nome: "RENOV SOLUCOES E SERVICOS LTDA",
          logradouro: "R LUIGI GALVANI",
          numero: "200",
          complemento: "CONJ 11",
          bairro: "CIDADE MONCOES",
          cidade: "SAO PAULO",
          uf: "SP",
          cep: "04575020",
          ciencia_conteudo_proibido: "S",
        },
        coletas_solicitadas: [{
          tipo: data.tipo,
          id_cliente: data.id_cliente || undefined,
          ag: data.ag || undefined,
          valor_declarado: data.valor_declarado ? parseFloat(data.valor_declarado) : undefined,
          descricao: data.descricao || undefined,
          remetente: {
            nome: data.remetente_nome,
            logradouro: data.remetente_logradouro,
            numero: data.remetente_numero,
            complemento: data.remetente_complemento || undefined,
            bairro: data.remetente_bairro,
            cidade: data.remetente_cidade,
            uf: data.remetente_uf,
            cep: data.remetente_cep.replace(/\D/g, ""),
            ddd: data.remetente_ddd,
            telefone: data.remetente_telefone,
            email: data.remetente_email,
            restricao_anac: data.remetente_restricao_anac,
          },
          obj_col: [{ item: 1 }],
        }],
      };
      const res = await apiRequest("POST", "/api/correios/solicitar-postagem-reversa", payload);
      return res.json();
    },
    onSuccess: (data) => {
      setApiResponse(data);
      toast({ title: "Solicitação enviada com sucesso!" });
    },
    onError: (error: any) => {
      setApiResponse({ erro: true, mensagem: error.message });
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const cancelarPedidoMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/correios/cancelar-pedido", data);
      return res.json();
    },
    onSuccess: (data) => {
      setApiResponse(data);
      toast({ title: "Pedido cancelado com sucesso!" });
    },
    onError: (error: any) => {
      setApiResponse({ erro: true, mensagem: error.message });
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const acompanharPedidoMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/correios/acompanhar-pedido", data);
      return res.json();
    },
    onSuccess: (data) => {
      setApiResponse(data);
      toast({ title: "Consulta realizada!" });
    },
    onError: (error: any) => {
      setApiResponse({ erro: true, mensagem: error.message });
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const acompanharPorDataMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/correios/acompanhar-pedido-por-data", data);
      return res.json();
    },
    onSuccess: (data) => {
      setApiResponse(data);
      toast({ title: "Consulta realizada!" });
    },
    onError: (error: any) => {
      setApiResponse({ erro: true, mensagem: error.message });
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const revalidarPrazoMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/correios/revalidar-prazo", data);
      return res.json();
    },
    onSuccess: (data) => {
      setApiResponse(data);
      toast({ title: "Prazo revalidado com sucesso!" });
    },
    onError: (error: any) => {
      setApiResponse({ erro: true, mensagem: error.message });
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const solicitarRangeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/correios/solicitar-range", data);
      return res.json();
    },
    onSuccess: (data) => {
      setApiResponse(data);
      toast({ title: "Range solicitado com sucesso!" });
    },
    onError: (error: any) => {
      setApiResponse({ erro: true, mensagem: error.message });
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const calcularDigitoMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/correios/calcular-digito-verificador", data);
      return res.json();
    },
    onSuccess: (data) => {
      setApiResponse(data);
      toast({ title: "Dígito verificador calculado!" });
    },
    onError: (error: any) => {
      setApiResponse({ erro: true, mensagem: error.message });
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const consultarCep = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) return;
    
    try {
      const response = await fetch(`/api/cep/${cepLimpo}`);
      if (response.ok) {
        const data = await response.json();
        solicitarPostagemForm.setValue("remetente_logradouro", data.logradouro || "");
        solicitarPostagemForm.setValue("remetente_bairro", data.bairro || "");
        solicitarPostagemForm.setValue("remetente_cidade", data.cidade || "");
        solicitarPostagemForm.setValue("remetente_uf", data.uf || "");
        solicitarPostagemForm.setValue("remetente_ddd", data.ddd || "");
      }
    } catch (error) {
      console.error("Erro ao consultar CEP:", error);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Correios - Logística Reversa"
        description="Integração com o Web Service de Logística Reversa dos Correios (CWS)"
      />

      <div className="flex-1 overflow-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-8 w-full mb-6" data-testid="tabs-correios-methods">
            <TabsTrigger value="config" data-testid="tab-config">Configuração</TabsTrigger>
            <TabsTrigger value="solicitar" data-testid="tab-solicitar">Solicitar</TabsTrigger>
            <TabsTrigger value="cancelar" data-testid="tab-cancelar">Cancelar</TabsTrigger>
            <TabsTrigger value="acompanhar" data-testid="tab-acompanhar">Acompanhar</TabsTrigger>
            <TabsTrigger value="acompanhar-data" data-testid="tab-acompanhar-data">Por Data</TabsTrigger>
            <TabsTrigger value="revalidar" data-testid="tab-revalidar">Revalidar</TabsTrigger>
            <TabsTrigger value="range" data-testid="tab-range">Range</TabsTrigger>
            <TabsTrigger value="digito" data-testid="tab-digito">Dígito</TabsTrigger>
          </TabsList>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <TabsContent value="config" className="m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5" />
                      Configuração da API
                    </CardTitle>
                    <CardDescription>
                      Status da conexão com o Web Service de Logística Reversa dos Correios
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isLoadingConfig ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : config?.configured ? (
                      <Alert>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertTitle className="text-green-700">Configurado</AlertTitle>
                        <AlertDescription>
                          A API está configurada e pronta para uso.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Não Configurado</AlertTitle>
                        <AlertDescription>
                          As credenciais da API não foram configuradas. Configure as variáveis de ambiente.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Código Administrativo</span>
                        <span className="font-mono">{config?.codAdministrativo || "-"}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Cartão de Postagem</span>
                        <span className="font-mono">{config?.cartaoPostagem || "-"}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Usuário</span>
                        <span className="font-mono">{config?.usuario || "-"}</span>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div>
                      <h4 className="font-medium mb-2">Métodos Disponíveis</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { name: "solicitarPostagemReversa", desc: "Solicita autorização ou coleta" },
                          { name: "cancelarPedido", desc: "Cancela um pedido" },
                          { name: "acompanharPedido", desc: "Acompanha por número" },
                          { name: "acompanharPedidoPorData", desc: "Acompanha por data" },
                          { name: "revalidarPrazoAutorizacaoPostagem", desc: "Revalida prazo do e-ticket" },
                          { name: "solicitarRange", desc: "Reserva faixa de e-tickets" },
                          { name: "calcularDigitoVerificador", desc: "Calcula DV do e-ticket" },
                          { name: "solicitarPostagemSimultanea", desc: "Coleta com troca simultânea" },
                        ].map((method) => (
                          <div key={method.name} className="p-2 rounded border bg-muted/50">
                            <span className="font-mono text-xs">{method.name}</span>
                            <p className="text-xs text-muted-foreground">{method.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="solicitar" className="m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="h-5 w-5" />
                      Solicitar Postagem Reversa
                    </CardTitle>
                    <CardDescription>
                      Solicita uma autorização de postagem (e-ticket) ou coleta domiciliária
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...solicitarPostagemForm}>
                      <form onSubmit={solicitarPostagemForm.handleSubmit((data) => solicitarPostagemMutation.mutate(data))} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={solicitarPostagemForm.control}
                            name="codigo_servico"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Código do Serviço</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-codigo-servico">
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="04677">04677 - PAC Reversa</SelectItem>
                                    <SelectItem value="04170">04170 - SEDEX Reversa</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={solicitarPostagemForm.control}
                            name="tipo"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tipo</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-tipo">
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="A">A - Autorização de Postagem</SelectItem>
                                    <SelectItem value="C">C - Coleta Domiciliária</SelectItem>
                                    <SelectItem value="CA">CA - Coleta com Fallback</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={solicitarPostagemForm.control}
                            name="id_cliente"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>ID Cliente (opcional)</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Ex: NF-12345" data-testid="input-id-cliente" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={solicitarPostagemForm.control}
                            name="valor_declarado"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Valor Declarado</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="0.00" data-testid="input-valor-declarado" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <Separator />
                        <div className="bg-muted/30 p-4 rounded-md border border-dashed">
                          <h4 className="font-medium mb-2 flex items-center gap-2 text-sm">
                            <Truck className="h-4 w-4" />
                            Destinatário Fixo (Sua Empresa)
                          </h4>
                          <div className="text-xs space-y-1 text-muted-foreground">
                            <p><strong>Nome:</strong> RENOV SOLUCOES E SERVICOS LTDA</p>
                            <p><strong>Endereço:</strong> R LUIGI GALVANI, 200, CONJ 11</p>
                            <p><strong>Bairro/Cidade:</strong> CIDADE MONCOES, SAO PAULO - SP</p>
                            <p><strong>CEP:</strong> 04575-020</p>
                          </div>
                        </div>

                        <Separator />
                        <h4 className="font-medium">Dados do Remetente</h4>

                        <FormField
                          control={solicitarPostagemForm.control}
                          name="remetente_nome"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Nome completo" data-testid="input-remetente-nome" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={solicitarPostagemForm.control}
                            name="remetente_cep"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CEP</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="00000-000"
                                    onBlur={(e) => consultarCep(e.target.value)}
                                    data-testid="input-remetente-cep"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={solicitarPostagemForm.control}
                            name="remetente_logradouro"
                            render={({ field }) => (
                              <FormItem className="col-span-2">
                                <FormLabel>Logradouro</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Rua, Av..." data-testid="input-remetente-logradouro" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                          <FormField
                            control={solicitarPostagemForm.control}
                            name="remetente_numero"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Número</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Nº" data-testid="input-remetente-numero" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={solicitarPostagemForm.control}
                            name="remetente_complemento"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Complemento</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Apto, Bloco..." data-testid="input-remetente-complemento" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={solicitarPostagemForm.control}
                            name="remetente_bairro"
                            render={({ field }) => (
                              <FormItem className="col-span-2">
                                <FormLabel>Bairro</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Bairro" data-testid="input-remetente-bairro" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={solicitarPostagemForm.control}
                            name="remetente_cidade"
                            render={({ field }) => (
                              <FormItem className="col-span-2">
                                <FormLabel>Cidade</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Cidade" data-testid="input-remetente-cidade" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={solicitarPostagemForm.control}
                            name="remetente_uf"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>UF</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="SP" maxLength={2} data-testid="input-remetente-uf" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={solicitarPostagemForm.control}
                            name="remetente_ddd"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>DDD</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="11" maxLength={2} data-testid="input-remetente-ddd" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={solicitarPostagemForm.control}
                            name="remetente_telefone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Telefone</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="99999999" data-testid="input-remetente-telefone" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={solicitarPostagemForm.control}
                            name="remetente_email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input {...field} type="email" placeholder="email@email.com" data-testid="input-remetente-email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <Button type="submit" className="w-full" disabled={solicitarPostagemMutation.isPending} data-testid="button-solicitar-postagem">
                          {solicitarPostagemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                          Solicitar Postagem Reversa
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cancelar" className="m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <XCircle className="h-5 w-5" />
                      Cancelar Pedido
                    </CardTitle>
                    <CardDescription>
                      Cancela uma solicitação de autorização de postagem ou coleta
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...cancelarPedidoForm}>
                      <form onSubmit={cancelarPedidoForm.handleSubmit((data) => cancelarPedidoMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={cancelarPedidoForm.control}
                          name="numeroPedido"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Número do Pedido</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Ex: 194848820" data-testid="input-numero-pedido-cancelar" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={cancelarPedidoForm.control}
                          name="tipo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-tipo-cancelar">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="A">A - Autorização de Postagem</SelectItem>
                                  <SelectItem value="C">C - Coleta Domiciliária</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" variant="destructive" className="w-full" disabled={cancelarPedidoMutation.isPending} data-testid="button-cancelar-pedido">
                          {cancelarPedidoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                          Cancelar Pedido
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="acompanhar" className="m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="h-5 w-5" />
                      Acompanhar Pedido
                    </CardTitle>
                    <CardDescription>
                      Consulta o status de uma solicitação pelo número do pedido
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...acompanharPedidoForm}>
                      <form onSubmit={acompanharPedidoForm.handleSubmit((data) => acompanharPedidoMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={acompanharPedidoForm.control}
                          name="numeroPedido"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Número do Pedido</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Ex: 194848820" data-testid="input-numero-pedido-acompanhar" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={acompanharPedidoForm.control}
                            name="tipoBusca"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tipo de Busca</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-tipo-busca">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="T">T - Todos os eventos</SelectItem>
                                    <SelectItem value="P">P - Primeiro evento</SelectItem>
                                    <SelectItem value="U">U - Último evento</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={acompanharPedidoForm.control}
                            name="tipoSolicitacao"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tipo Solicitação</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-tipo-solicitacao">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="A">A - Autorização</SelectItem>
                                    <SelectItem value="C">C - Coleta</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={acompanharPedidoMutation.isPending} data-testid="button-acompanhar-pedido">
                          {acompanharPedidoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                          Consultar Pedido
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="acompanhar-data" className="m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Acompanhar por Data
                    </CardTitle>
                    <CardDescription>
                      Consulta pedidos por data de atualização de status
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...acompanharPorDataForm}>
                      <form onSubmit={acompanharPorDataForm.handleSubmit((data) => acompanharPorDataMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={acompanharPorDataForm.control}
                          name="data"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data (DD/MM/AAAA)</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="20/07/2025" data-testid="input-data-acompanhar" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={acompanharPorDataForm.control}
                          name="tipoSolicitacao"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo Solicitação</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-tipo-solicitacao-data">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="A">A - Autorização</SelectItem>
                                  <SelectItem value="C">C - Coleta</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" className="w-full" disabled={acompanharPorDataMutation.isPending} data-testid="button-acompanhar-data">
                          {acompanharPorDataMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
                          Consultar por Data
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="revalidar" className="m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RefreshCw className="h-5 w-5" />
                      Revalidar Prazo
                    </CardTitle>
                    <CardDescription>
                      Revalida o prazo de uma autorização de postagem expirada
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...revalidarPrazoForm}>
                      <form onSubmit={revalidarPrazoForm.handleSubmit((data) => revalidarPrazoMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={revalidarPrazoForm.control}
                          name="numeroPedido"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Número do Pedido</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Ex: 232532598" data-testid="input-numero-pedido-revalidar" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={revalidarPrazoForm.control}
                          name="qtdeDias"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantidade de Dias (5-30)</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  min={5} 
                                  max={30}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  data-testid="input-qtde-dias"
                                />
                              </FormControl>
                              <FormDescription>
                                O prazo deve ser entre 5 e 30 dias corridos
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" className="w-full" disabled={revalidarPrazoMutation.isPending} data-testid="button-revalidar">
                          {revalidarPrazoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                          Revalidar Prazo
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="range" className="m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Hash className="h-5 w-5" />
                      Solicitar Range de e-Tickets
                    </CardTitle>
                    <CardDescription>
                      Reserva uma faixa de numeração de e-tickets para uso posterior
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...solicitarRangeForm}>
                      <form onSubmit={solicitarRangeForm.handleSubmit((data) => solicitarRangeMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={solicitarRangeForm.control}
                          name="servico"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Serviço (opcional)</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-servico-range">
                                    <SelectValue placeholder="Selecione (opcional)" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="LE">LE - PAC</SelectItem>
                                  <SelectItem value="LS">LS - SEDEX</SelectItem>
                                  <SelectItem value="LV">LV - e-SEDEX</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Apenas para Logística Reversa Domiciliária
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={solicitarRangeForm.control}
                          name="quantidade"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantidade (máx. 50.000)</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  min={1} 
                                  max={50000}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  data-testid="input-quantidade-range"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" className="w-full" disabled={solicitarRangeMutation.isPending} data-testid="button-solicitar-range">
                          {solicitarRangeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Hash className="h-4 w-4 mr-2" />}
                          Solicitar Range
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="digito" className="m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Hash className="h-5 w-5" />
                      Calcular Dígito Verificador
                    </CardTitle>
                    <CardDescription>
                      Calcula o dígito verificador de um número de e-ticket
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...calcularDigitoForm}>
                      <form onSubmit={calcularDigitoForm.handleSubmit((data) => calcularDigitoMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={calcularDigitoForm.control}
                          name="numero"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Número do e-Ticket</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Ex: 19484775" data-testid="input-numero-digito" />
                              </FormControl>
                              <FormDescription>
                                Número do range sem o dígito verificador
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" className="w-full" disabled={calcularDigitoMutation.isPending} data-testid="button-calcular-digito">
                          {calcularDigitoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Hash className="h-4 w-4 mr-2" />}
                          Calcular Dígito
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Resposta da API
                  </CardTitle>
                  <CardDescription>
                    Resultado da última chamada ao Web Service dos Correios
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {apiResponse ? (
                    <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[600px] text-xs font-mono">
                      {JSON.stringify(apiResponse, null, 2)}
                    </pre>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Package className="h-12 w-12 mb-4 opacity-30" />
                      <p>Nenhuma resposta ainda</p>
                      <p className="text-sm">Execute uma operação para ver o resultado</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
