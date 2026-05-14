import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SiPostman } from "react-icons/si";
import {
  Search,
  Loader2,
  XCircle,
  CheckCircle,
  RefreshCw,
  Info,
  Key,
  FileText,
  ExternalLink,
  Copy,
  Play,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const API_BASE_URL = "https://dash.pitzi.com.br/api";
const POSTMAN_DOC_URL = "https://documenter.getpostman.com/view/49982216/2sBXcAJNtW";

interface ConnectionStatus {
  connected: boolean;
  message: string;
  timestamp?: string;
}

const consultaPedidosSchema = z.object({
  imei: z.string().optional(),
  voucher_code: z.string().optional(),
  voucher_status: z.string().optional(),
  customer_cpf: z.string().optional(),
  created_start: z.string().optional(),
  created_end: z.string().optional(),
  used_start: z.string().optional(),
  used_end: z.string().optional(),
  category: z.string().optional(),
  network: z.string().optional(),
  seller_name: z.string().optional(),
  regional: z.string().optional(),
  filial: z.string().optional(),
  store_type: z.string().optional(),
  boost: z.string().optional(),
  global_status: z.string().optional(),
});

export default function ApiRelatorioPedidosPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [apiResponse, setApiResponse] = useState<any>(null);

  const consultaPedidosForm = useForm({
    resolver: zodResolver(consultaPedidosSchema),
    defaultValues: {
      imei: "",
      voucher_code: "",
      voucher_status: "",
      customer_cpf: "",
      created_start: "",
      created_end: "",
      used_start: "",
      used_end: "",
      category: "",
      network: "",
      seller_name: "",
      regional: "",
      filial: "",
      store_type: "",
      boost: "",
      global_status: "",
    },
  });

  const testConnection = async () => {
    setIsTestingConnection(true);
    try {
      const response = await fetch("/api/integrations/relatorio-pedidos/test-connection", {
        method: "POST",
      });
      const data = await response.json();

      setConnectionStatus({
        connected: data.connected,
        message: data.message,
        timestamp: new Date().toLocaleString("pt-BR"),
      });

      toast({
        title: data.connected ? "Conexão bem-sucedida!" : "Falha na conexão",
        description: data.message,
        variant: data.connected ? "default" : "destructive",
      });
    } catch (error: any) {
      setConnectionStatus({
        connected: false,
        message: error.message || "Erro ao testar conexão",
        timestamp: new Date().toLocaleString("pt-BR"),
      });
      toast({
        title: "Erro",
        description: "Falha ao testar conexão com a API",
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const consultaPedidosMutation = useMutation({
    mutationFn: async (data: z.infer<typeof consultaPedidosSchema>) => {
      const params = new URLSearchParams();
      Object.entries(data).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`/api/integrations/relatorio-pedidos/orders/advanced?${params.toString()}`);
      if (!response.ok) throw new Error("Falha na requisição");
      return response.json();
    },
    onSuccess: (data) => {
      setApiResponse(data);
      toast({ title: "Consulta realizada com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro na consulta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado para a área de transferência!" });
  };

  const endpoints = [
    {
      id: "consulta-pedidos",
      name: "Consulta Avançada de Pedidos",
      method: "GET",
      path: "/api/orders/advanced",
      description: "Retorna uma lista de pedidos com base em múltiplos filtros opcionais incluindo IMEI, voucher, CPF, datas, rede, vendedor, regional, filial e status.",
      category: "Pedidos",
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Relatório Pedidos"
        description="API para consulta avançada de pedidos e vouchers."
        breadcrumbs={[
          { label: "Integrações", href: "/apis" },
          { label: "Relatório Pedidos" },
        ]}
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Pedidos API - Dashboard Renov</h2>
              <p className="text-sm text-muted-foreground">Documentação oficial da API de Relatório de Pedidos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => window.open(POSTMAN_DOC_URL, "_blank")}
              data-testid="button-postman-docs"
            >
              <SiPostman className="h-4 w-4" />
              Postman Docs
              <ExternalLink className="h-3 w-3" />
            </Button>
            <Button
              variant={connectionStatus?.connected ? "outline" : "default"}
              size="sm"
              className="gap-2"
              onClick={testConnection}
              disabled={isTestingConnection}
              data-testid="button-test-connection"
            >
              {isTestingConnection ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : connectionStatus?.connected ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isTestingConnection ? "Testando..." : "Testar Conexão"}
            </Button>
          </div>
        </div>

        {connectionStatus && (
          <Alert className={connectionStatus.connected ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}>
            {connectionStatus.connected ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertTitle className={`text-sm font-bold ${connectionStatus.connected ? "text-green-700" : "text-red-700"}`}>
              {connectionStatus.connected ? "Conectado" : "Desconectado"}
            </AlertTitle>
            <AlertDescription className={`text-xs ${connectionStatus.connected ? "text-green-600/80" : "text-red-600/80"}`}>
              {connectionStatus.message} • Último teste: {connectionStatus.timestamp}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="border-b border-border/50 pb-0 px-6">
              <TabsList className="bg-transparent h-12 p-0 gap-8">
                <TabsTrigger
                  value="visao-geral"
                  className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none h-12 px-1 text-[13px] font-bold gap-2"
                  data-testid="tab-visao-geral"
                >
                  <Info className="h-4 w-4" />
                  Visão Geral
                </TabsTrigger>
                <TabsTrigger
                  value="consulta"
                  className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none h-12 px-1 text-[13px] font-bold gap-2"
                  data-testid="tab-consulta"
                >
                  <Search className="h-4 w-4" />
                  Consulta
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="p-6">
              <TabsContent value="visao-geral" className="m-0 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="border-2 border-border/60">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary" />
                        Sobre a Integração
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        API para consulta avançada de pedidos e vouchers do Dashboard Renov. Permite filtrar pedidos por múltiplos critérios incluindo IMEI, voucher, CPF, datas, rede, vendedor, regional, filial e status.
                      </p>

                      <Separator />

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Base URL</span>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">{API_BASE_URL}</code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(API_BASE_URL)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Autenticação</span>
                          <Badge variant="secondary" className="text-xs">Bearer Token</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Total de Endpoints</span>
                          <Badge variant="outline" className="text-xs">{endpoints.length}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-border/60">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Key className="h-4 w-4 text-primary" />
                        Autenticação
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Alert className="bg-blue-500/5 border-blue-500/20">
                        <Info className="h-4 w-4 text-blue-600" />
                        <AlertTitle className="text-sm font-bold text-blue-700">Bearer Token</AlertTitle>
                        <AlertDescription className="text-xs text-blue-600/80 mt-1">
                          Todas as rotas são protegidas. O token deve ser enviado no header Authorization de todas as requisições.
                        </AlertDescription>
                      </Alert>

                      <div className="p-4 rounded-lg bg-muted/30 border border-border/40">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Header de Autenticação</Label>
                        <div className="mt-2 flex items-center justify-between">
                          <code className="text-sm font-mono">Authorization: Bearer Renov123</code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard("Authorization: Bearer Renov123")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        O token de autenticação deve ser obtido através do painel de configurações ou solicitado ao administrador do sistema.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-2 border-border/60">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Endpoints Disponíveis
                    </CardTitle>
                    <CardDescription>
                      Lista completa de endpoints disponíveis na API Relatório Pedidos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {endpoints.map((endpoint) => (
                        <div
                          key={endpoint.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border/40 hover:border-primary/30 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <Badge
                              variant="secondary"
                              className="font-bold text-xs h-6 px-2 bg-green-500/10 text-green-700 border-green-500/30"
                            >
                              {endpoint.method}
                            </Badge>
                            <div>
                              <p className="font-semibold text-sm">{endpoint.name}</p>
                              <code className="text-xs text-muted-foreground">{endpoint.path}</code>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-xs">{endpoint.category}</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-xs"
                              onClick={() => {
                                setActiveTab("consulta");
                              }}
                              data-testid={`button-test-${endpoint.id}`}
                            >
                              <Play className="h-3 w-3" />
                              Testar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="consulta" className="m-0 space-y-6">
                <Card className="border-2 border-border/60">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="font-bold text-xs h-6 px-2 bg-green-500/10 text-green-700 border-green-500/30">
                          GET
                        </Badge>
                        <div>
                          <CardTitle className="text-base">Consulta Avançada de Pedidos</CardTitle>
                          <code className="text-xs text-muted-foreground">/api/orders/advanced</code>
                        </div>
                      </div>
                    </div>
                    <CardDescription className="mt-2">
                      Retorna uma lista de pedidos com base em múltiplos filtros opcionais incluindo IMEI, voucher, CPF, datas, rede, vendedor, regional, filial e status.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Form {...consultaPedidosForm}>
                      <form onSubmit={consultaPedidosForm.handleSubmit((data) => consultaPedidosMutation.mutate(data))} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={consultaPedidosForm.control}
                            name="imei"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">IMEI do Dispositivo</FormLabel>
                                <FormControl>
                                  <Input placeholder="Filtrar por IMEI exato" {...field} data-testid="input-pedidos-imei" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={consultaPedidosForm.control}
                            name="voucher_code"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Código do Voucher</FormLabel>
                                <FormControl>
                                  <Input placeholder="Código do voucher" {...field} data-testid="input-pedidos-voucher_code" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={consultaPedidosForm.control}
                            name="voucher_status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Status do Voucher</FormLabel>
                                <FormControl>
                                  <Input placeholder="UTILIZADO, DISPONÍVEL, EXPIRADO, NÃO GERADO" {...field} data-testid="input-pedidos-voucher_status" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={consultaPedidosForm.control}
                            name="customer_cpf"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">CPF do Cliente</FormLabel>
                                <FormControl>
                                  <Input placeholder="CPF do cliente" {...field} data-testid="input-pedidos-customer_cpf" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={consultaPedidosForm.control}
                            name="created_start"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data de Criação Início</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-pedidos-created_start" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={consultaPedidosForm.control}
                            name="created_end"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data de Criação Fim</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-pedidos-created_end" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={consultaPedidosForm.control}
                            name="used_start"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data de Uso Voucher Início</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-pedidos-used_start" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={consultaPedidosForm.control}
                            name="used_end"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data de Uso Voucher Fim</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-pedidos-used_end" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={consultaPedidosForm.control}
                            name="category"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Categoria do Dispositivo</FormLabel>
                                <FormControl>
                                  <Input placeholder="Categoria do dispositivo" {...field} data-testid="input-pedidos-category" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={consultaPedidosForm.control}
                            name="network"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Nome da Rede</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ex: TIM, CASAS BAHIA" {...field} data-testid="input-pedidos-network" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={consultaPedidosForm.control}
                            name="seller_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Nome do Vendedor</FormLabel>
                                <FormControl>
                                  <Input placeholder="Nome do vendedor" {...field} data-testid="input-pedidos-seller_name" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={consultaPedidosForm.control}
                            name="regional"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Regional</FormLabel>
                                <FormControl>
                                  <Input placeholder="Regional" {...field} data-testid="input-pedidos-regional" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={consultaPedidosForm.control}
                            name="filial"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Filial</FormLabel>
                                <FormControl>
                                  <Input placeholder="Filial" {...field} data-testid="input-pedidos-filial" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={consultaPedidosForm.control}
                            name="store_type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Tipo de Loja</FormLabel>
                                <FormControl>
                                  <Input placeholder="Loja Própria ou Dealer" {...field} data-testid="input-pedidos-store_type" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={consultaPedidosForm.control}
                            name="boost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Boost</FormLabel>
                                <FormControl>
                                  <Input placeholder="true ou false" {...field} data-testid="input-pedidos-boost" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={consultaPedidosForm.control}
                            name="global_status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Status Global do Pedido</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ex: Completed" {...field} data-testid="input-pedidos-global_status" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="submit"
                            className="gap-2"
                            disabled={consultaPedidosMutation.isPending}
                            data-testid="button-consultar-pedidos"
                          >
                            {consultaPedidosMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                            Consultar Pedidos
                          </Button>
                        </div>
                      </form>
                    </Form>

                    {apiResponse && activeTab === "consulta" && (
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Resposta da API</Label>
                        <ScrollArea className="h-64 w-full rounded-md border bg-muted/20 p-4">
                          <pre className="text-xs font-mono whitespace-pre-wrap">
                            {JSON.stringify(apiResponse, null, 2)}
                          </pre>
                        </ScrollArea>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </main>
    </div>
  );
}
