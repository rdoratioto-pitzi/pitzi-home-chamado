import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SiPostman } from "react-icons/si";
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
  AlertCircle,
  Info,
  Link as LinkIcon,
  Key,
  FileText,
  BarChart3,
  Calendar,
  ExternalLink,
  Copy,
  Play,
  Settings2,
  ClipboardList,
  ShieldAlert,
  Wrench,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const API_BASE_URL = "https://dash.renovsmart.com.br/api/adm_logistica";
const POSTMAN_DOC_URL = "https://documenter.getpostman.com/view/49982216/2sBXc8oiGE";

interface ConnectionStatus {
  connected: boolean;
  message: string;
  timestamp?: string;
}

const coletasSchema = z.object({
  voucher_imei: z.string().optional(),
  code: z.string().optional(),
  awb_code: z.string().optional(),
  rede: z.string().optional(),
  operator: z.string().optional(),
  req_start: z.string().optional(),
  req_end: z.string().optional(),
  col_start: z.string().optional(),
  col_end: z.string().optional(),
  status: z.string().optional(),
  represados: z.string().optional(),
});

const recebimentosSchema = z.object({
  imei: z.string().optional(),
  categories: z.string().optional(),
  status_recebimento: z.string().optional(),
  redes: z.string().optional(),
  voucher_use_start: z.string().optional(),
  voucher_use_end: z.string().optional(),
  col_start: z.string().optional(),
  col_end: z.string().optional(),
  receipt_start: z.string().optional(),
  receipt_end: z.string().optional(),
  coleta_code: z.string().optional(),
  awb_code: z.string().optional(),
});

const triagemSchema = z.object({
  imei: z.string().optional(),
  categories: z.string().optional(),
  status_recebimento: z.string().optional(),
  redes: z.string().optional(),
  responsavel_triagem: z.string().optional(),
  receipt_start: z.string().optional(),
  receipt_end: z.string().optional(),
  col_start: z.string().optional(),
  col_end: z.string().optional(),
  triagem_start: z.string().optional(),
  triagem_end: z.string().optional(),
});

const bloqueadosSchema = z.object({
  imei: z.string().optional(),
  redes: z.string().optional(),
  date_start: z.string().optional(),
  date_end: z.string().optional(),
  status: z.string().optional(),
});

const manutencaoSchema = z.object({
  imei: z.string().optional(),
});

const divergentesSchema = z.object({
  imei: z.string().optional(),
});

export default function ApiAdmLogisticaPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [activeEndpoint, setActiveEndpoint] = useState<string | null>(null);

  const coletasForm = useForm({
    resolver: zodResolver(coletasSchema),
    defaultValues: {
      voucher_imei: "",
      code: "",
      awb_code: "",
      rede: "",
      operator: "",
      req_start: "",
      req_end: "",
      col_start: "",
      col_end: "",
      status: "",
      represados: "",
    },
  });

  const recebimentosForm = useForm({
    resolver: zodResolver(recebimentosSchema),
    defaultValues: {
      imei: "",
      categories: "",
      status_recebimento: "",
      redes: "",
      voucher_use_start: "",
      voucher_use_end: "",
      col_start: "",
      col_end: "",
      receipt_start: "",
      receipt_end: "",
      coleta_code: "",
      awb_code: "",
    },
  });

  const triagemForm = useForm({
    resolver: zodResolver(triagemSchema),
    defaultValues: {
      imei: "",
      categories: "",
      status_recebimento: "",
      redes: "",
      responsavel_triagem: "",
      receipt_start: "",
      receipt_end: "",
      col_start: "",
      col_end: "",
      triagem_start: "",
      triagem_end: "",
    },
  });

  const bloqueadosForm = useForm({
    resolver: zodResolver(bloqueadosSchema),
    defaultValues: {
      imei: "",
      redes: "",
      date_start: "",
      date_end: "",
      status: "",
    },
  });

  const manutencaoForm = useForm({
    resolver: zodResolver(manutencaoSchema),
    defaultValues: {
      imei: "",
    },
  });

  const divergentesForm = useForm({
    resolver: zodResolver(divergentesSchema),
    defaultValues: {
      imei: "",
    },
  });

  const testConnection = async () => {
    setIsTestingConnection(true);
    try {
      const response = await fetch("/api/integrations/adm-logistica/test-connection", {
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

  const coletasMutation = useMutation({
    mutationFn: async (data: z.infer<typeof coletasSchema>) => {
      const params = new URLSearchParams();
      Object.entries(data).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const response = await fetch(`/api/integrations/adm-logistica/coletas?${params.toString()}`);
      if (!response.ok) throw new Error("Falha na requisição");
      return response.json();
    },
    onSuccess: (data) => {
      setApiResponse(data);
      toast({ title: "Consulta realizada com sucesso!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro na consulta", description: error.message, variant: "destructive" });
    },
  });

  const recebimentosMutation = useMutation({
    mutationFn: async (data: z.infer<typeof recebimentosSchema>) => {
      const params = new URLSearchParams();
      Object.entries(data).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const response = await fetch(`/api/integrations/adm-logistica/recebimentos?${params.toString()}`);
      if (!response.ok) throw new Error("Falha na requisição");
      return response.json();
    },
    onSuccess: (data) => {
      setApiResponse(data);
      toast({ title: "Consulta realizada com sucesso!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro na consulta", description: error.message, variant: "destructive" });
    },
  });

  const triagemMutation = useMutation({
    mutationFn: async (data: z.infer<typeof triagemSchema>) => {
      const params = new URLSearchParams();
      Object.entries(data).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const response = await fetch(`/api/integrations/adm-logistica/triagem?${params.toString()}`);
      if (!response.ok) throw new Error("Falha na requisição");
      return response.json();
    },
    onSuccess: (data) => {
      setApiResponse(data);
      toast({ title: "Consulta realizada com sucesso!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro na consulta", description: error.message, variant: "destructive" });
    },
  });

  const bloqueadosMutation = useMutation({
    mutationFn: async (data: z.infer<typeof bloqueadosSchema>) => {
      const params = new URLSearchParams();
      Object.entries(data).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const response = await fetch(`/api/integrations/adm-logistica/bloqueados?${params.toString()}`);
      if (!response.ok) throw new Error("Falha na requisição");
      return response.json();
    },
    onSuccess: (data) => {
      setApiResponse(data);
      toast({ title: "Consulta realizada com sucesso!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro na consulta", description: error.message, variant: "destructive" });
    },
  });

  const manutencaoMutation = useMutation({
    mutationFn: async (data: z.infer<typeof manutencaoSchema>) => {
      const params = new URLSearchParams();
      Object.entries(data).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const response = await fetch(`/api/integrations/adm-logistica/manutencao?${params.toString()}`);
      if (!response.ok) throw new Error("Falha na requisição");
      return response.json();
    },
    onSuccess: (data) => {
      setApiResponse(data);
      toast({ title: "Consulta realizada com sucesso!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro na consulta", description: error.message, variant: "destructive" });
    },
  });

  const divergentesMutation = useMutation({
    mutationFn: async (data: z.infer<typeof divergentesSchema>) => {
      const params = new URLSearchParams();
      Object.entries(data).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const response = await fetch(`/api/integrations/adm-logistica/divergentes?${params.toString()}`);
      if (!response.ok) throw new Error("Falha na requisição");
      return response.json();
    },
    onSuccess: (data) => {
      setApiResponse(data);
      toast({ title: "Consulta realizada com sucesso!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro na consulta", description: error.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado para a área de transferência!" });
  };

  const endpoints = [
    {
      id: "coletas",
      name: "Coletas",
      method: "GET",
      path: "/api/adm_logistica/coletas",
      description: "Retorna dados de coletas com filtros por IMEI, código, AWB, rede, operador, datas e status.",
      category: "Coletas",
      tab: "coletas",
    },
    {
      id: "recebimentos",
      name: "Recebimentos",
      method: "GET",
      path: "/api/adm_logistica/recebimentos",
      description: "Retorna dados de recebimentos com filtros por IMEI, categoria, status, rede, datas e códigos.",
      category: "Recebimentos",
      tab: "recebimentos",
    },
    {
      id: "triagem",
      name: "Triagem",
      method: "GET",
      path: "/api/adm_logistica/triagem",
      description: "Retorna dados de triagem com filtros por IMEI, categoria, status, rede, responsável e datas.",
      category: "Triagem",
      tab: "triagem",
    },
    {
      id: "bloqueados",
      name: "Bloqueados",
      method: "GET",
      path: "/api/adm_logistica/bloqueados",
      description: "Retorna dados de itens bloqueados com filtros por IMEI, rede, datas e status.",
      category: "Bloqueados",
      tab: "bloqueados",
    },
    {
      id: "manutencao",
      name: "Manutenção",
      method: "GET",
      path: "/api/adm_logistica/manutencao",
      description: "Retorna dados de manutenção filtrados por IMEI.",
      category: "Manutenção",
      tab: "manutencao",
    },
    {
      id: "divergentes",
      name: "Divergentes",
      method: "GET",
      path: "/api/adm_logistica/divergentes",
      description: "Retorna dados de itens divergentes filtrados por IMEI.",
      category: "Divergentes",
      tab: "divergentes",
    },
  ];

  const tabTriggerClass = "bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none h-12 px-1 text-[13px] font-bold gap-2";

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader 
        title="Administração Logística" 
        description="Integração com a API de Administração Logística do Dashboard Renov."
        breadcrumbs={[
          { label: "Integrações", href: "/apis" },
          { label: "Administração Logística" }
        ]}
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Admin Logística API - Dashboard Renov</h2>
              <p className="text-sm text-muted-foreground">Documentação oficial das APIs de Administração Logística</p>
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
                <TabsTrigger value="visao-geral" className={tabTriggerClass} data-testid="tab-visao-geral">
                  <Info className="h-4 w-4" />
                  Visão Geral
                </TabsTrigger>
                <TabsTrigger value="coletas" className={tabTriggerClass} data-testid="tab-coletas">
                  <Package className="h-4 w-4" />
                  Coletas
                </TabsTrigger>
                <TabsTrigger value="recebimentos" className={tabTriggerClass} data-testid="tab-recebimentos">
                  <ClipboardList className="h-4 w-4" />
                  Recebimentos
                </TabsTrigger>
                <TabsTrigger value="triagem" className={tabTriggerClass} data-testid="tab-triagem">
                  <Search className="h-4 w-4" />
                  Triagem
                </TabsTrigger>
                <TabsTrigger value="bloqueados" className={tabTriggerClass} data-testid="tab-bloqueados">
                  <ShieldAlert className="h-4 w-4" />
                  Bloqueados
                </TabsTrigger>
                <TabsTrigger value="manutencao" className={tabTriggerClass} data-testid="tab-manutencao">
                  <Wrench className="h-4 w-4" />
                  Manutenção
                </TabsTrigger>
                <TabsTrigger value="divergentes" className={tabTriggerClass} data-testid="tab-divergentes">
                  <AlertTriangle className="h-4 w-4" />
                  Divergentes
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
                        Esta integração permite consultar dados de administração logística do Dashboard Renov. 
                        A API disponibiliza endpoints para coletas, recebimentos, triagem, bloqueados, 
                        manutenção e divergentes.
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
                        O token padrão <code className="bg-muted px-1 rounded">Renov123</code> é utilizado para autenticação em todas as requisições.
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
                      Lista completa de endpoints disponíveis na API Administração Logística
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
                                setActiveTab(endpoint.tab);
                                setActiveEndpoint(endpoint.id);
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

              <TabsContent value="coletas" className="m-0 space-y-6">
                <Card className="border-2 border-border/60">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="font-bold text-xs h-6 px-2 bg-green-500/10 text-green-700 border-green-500/30">
                          GET
                        </Badge>
                        <div>
                          <CardTitle className="text-base">Coletas</CardTitle>
                          <code className="text-xs text-muted-foreground">/api/adm_logistica/coletas</code>
                        </div>
                      </div>
                    </div>
                    <CardDescription className="mt-2">
                      Retorna dados de coletas com filtros por IMEI, código, AWB, rede, operador, datas e status.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Form {...coletasForm}>
                      <form onSubmit={coletasForm.handleSubmit((data) => coletasMutation.mutate(data))} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={coletasForm.control}
                            name="voucher_imei"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">IMEI do Voucher</FormLabel>
                                <FormControl>
                                  <Input placeholder="IMEI do voucher" {...field} data-testid="input-adm-coletas-voucher_imei" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={coletasForm.control}
                            name="code"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Código da Coleta</FormLabel>
                                <FormControl>
                                  <Input placeholder="Código da coleta" {...field} data-testid="input-adm-coletas-code" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={coletasForm.control}
                            name="awb_code"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Código AWB</FormLabel>
                                <FormControl>
                                  <Input placeholder="Código AWB" {...field} data-testid="input-adm-coletas-awb_code" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={coletasForm.control}
                            name="rede"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Nome da Rede</FormLabel>
                                <FormControl>
                                  <Input placeholder="Nome da rede" {...field} data-testid="input-adm-coletas-rede" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={coletasForm.control}
                            name="operator"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Operador Logístico</FormLabel>
                                <FormControl>
                                  <Input placeholder="Loggi / Correios" {...field} data-testid="input-adm-coletas-operator" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={coletasForm.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Status da Coleta</FormLabel>
                                <FormControl>
                                  <Input placeholder="Status da coleta" {...field} data-testid="input-adm-coletas-status" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={coletasForm.control}
                            name="req_start"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data Requisição Início</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-adm-coletas-req_start" />
                                </FormControl>
                                <FormDescription className="text-xs">YYYY-MM-DD</FormDescription>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={coletasForm.control}
                            name="req_end"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data Requisição Fim</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-adm-coletas-req_end" />
                                </FormControl>
                                <FormDescription className="text-xs">YYYY-MM-DD</FormDescription>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={coletasForm.control}
                            name="col_start"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data Coleta Início</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-adm-coletas-col_start" />
                                </FormControl>
                                <FormDescription className="text-xs">YYYY-MM-DD</FormDescription>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={coletasForm.control}
                            name="col_end"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data Coleta Fim</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-adm-coletas-col_end" />
                                </FormControl>
                                <FormDescription className="text-xs">YYYY-MM-DD</FormDescription>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={coletasForm.control}
                            name="represados"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Represados</FormLabel>
                                <FormControl>
                                  <Input placeholder="true / false" {...field} data-testid="input-adm-coletas-represados" />
                                </FormControl>
                                <FormDescription className="text-xs">Filtrar itens represados</FormDescription>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button 
                            type="submit" 
                            className="gap-2"
                            disabled={coletasMutation.isPending}
                            data-testid="button-buscar-coletas"
                          >
                            {coletasMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                            Buscar Coletas
                          </Button>
                        </div>
                      </form>
                    </Form>

                    {apiResponse && activeTab === "coletas" && (
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

              <TabsContent value="recebimentos" className="m-0 space-y-6">
                <Card className="border-2 border-border/60">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="font-bold text-xs h-6 px-2 bg-green-500/10 text-green-700 border-green-500/30">
                          GET
                        </Badge>
                        <div>
                          <CardTitle className="text-base">Recebimentos</CardTitle>
                          <code className="text-xs text-muted-foreground">/api/adm_logistica/recebimentos</code>
                        </div>
                      </div>
                    </div>
                    <CardDescription className="mt-2">
                      Retorna dados de recebimentos com filtros por IMEI, categoria, status, rede, datas e códigos.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Form {...recebimentosForm}>
                      <form onSubmit={recebimentosForm.handleSubmit((data) => recebimentosMutation.mutate(data))} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={recebimentosForm.control}
                            name="imei"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">IMEI</FormLabel>
                                <FormControl>
                                  <Input placeholder="Filtrar por IMEI" {...field} data-testid="input-adm-recebimentos-imei" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={recebimentosForm.control}
                            name="categories"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Categoria</FormLabel>
                                <FormControl>
                                  <Input placeholder="Categoria" {...field} data-testid="input-adm-recebimentos-categories" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={recebimentosForm.control}
                            name="status_recebimento"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Status Recebimento</FormLabel>
                                <FormControl>
                                  <Input placeholder="Recebido, Pendente, etc" {...field} data-testid="input-adm-recebimentos-status_recebimento" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={recebimentosForm.control}
                            name="redes"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Rede</FormLabel>
                                <FormControl>
                                  <Input placeholder="Nome da rede" {...field} data-testid="input-adm-recebimentos-redes" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={recebimentosForm.control}
                            name="coleta_code"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Código da Coleta</FormLabel>
                                <FormControl>
                                  <Input placeholder="Código da coleta" {...field} data-testid="input-adm-recebimentos-coleta_code" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={recebimentosForm.control}
                            name="awb_code"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Código AWB</FormLabel>
                                <FormControl>
                                  <Input placeholder="Código AWB" {...field} data-testid="input-adm-recebimentos-awb_code" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={recebimentosForm.control}
                            name="voucher_use_start"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data Uso Voucher Início</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-adm-recebimentos-voucher_use_start" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={recebimentosForm.control}
                            name="voucher_use_end"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data Uso Voucher Fim</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-adm-recebimentos-voucher_use_end" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={recebimentosForm.control}
                            name="col_start"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data Coleta Início</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-adm-recebimentos-col_start" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={recebimentosForm.control}
                            name="col_end"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data Coleta Fim</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-adm-recebimentos-col_end" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={recebimentosForm.control}
                            name="receipt_start"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data Recebimento Início</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-adm-recebimentos-receipt_start" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={recebimentosForm.control}
                            name="receipt_end"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data Recebimento Fim</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-adm-recebimentos-receipt_end" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button 
                            type="submit" 
                            className="gap-2"
                            disabled={recebimentosMutation.isPending}
                            data-testid="button-buscar-recebimentos"
                          >
                            {recebimentosMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                            Buscar Recebimentos
                          </Button>
                        </div>
                      </form>
                    </Form>

                    {apiResponse && activeTab === "recebimentos" && (
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

              <TabsContent value="triagem" className="m-0 space-y-6">
                <Card className="border-2 border-border/60">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="font-bold text-xs h-6 px-2 bg-green-500/10 text-green-700 border-green-500/30">
                          GET
                        </Badge>
                        <div>
                          <CardTitle className="text-base">Triagem</CardTitle>
                          <code className="text-xs text-muted-foreground">/api/adm_logistica/triagem</code>
                        </div>
                      </div>
                    </div>
                    <CardDescription className="mt-2">
                      Retorna dados de triagem com filtros por IMEI, categoria, status, rede, responsável e datas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Form {...triagemForm}>
                      <form onSubmit={triagemForm.handleSubmit((data) => triagemMutation.mutate(data))} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={triagemForm.control}
                            name="imei"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">IMEI</FormLabel>
                                <FormControl>
                                  <Input placeholder="Filtrar por IMEI" {...field} data-testid="input-adm-triagem-imei" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={triagemForm.control}
                            name="categories"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Categoria</FormLabel>
                                <FormControl>
                                  <Input placeholder="Categoria" {...field} data-testid="input-adm-triagem-categories" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={triagemForm.control}
                            name="status_recebimento"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Status Recebimento</FormLabel>
                                <FormControl>
                                  <Input placeholder="Recebido, Pendente, etc" {...field} data-testid="input-adm-triagem-status_recebimento" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={triagemForm.control}
                            name="redes"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Rede</FormLabel>
                                <FormControl>
                                  <Input placeholder="Nome da rede" {...field} data-testid="input-adm-triagem-redes" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={triagemForm.control}
                            name="responsavel_triagem"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Responsável Triagem</FormLabel>
                                <FormControl>
                                  <Input placeholder="Nome do responsável" {...field} data-testid="input-adm-triagem-responsavel_triagem" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={triagemForm.control}
                            name="receipt_start"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data Recebimento Início</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-adm-triagem-receipt_start" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={triagemForm.control}
                            name="receipt_end"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data Recebimento Fim</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-adm-triagem-receipt_end" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={triagemForm.control}
                            name="col_start"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data Coleta Início</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-adm-triagem-col_start" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={triagemForm.control}
                            name="col_end"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data Coleta Fim</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-adm-triagem-col_end" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={triagemForm.control}
                            name="triagem_start"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data Triagem Início</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-adm-triagem-triagem_start" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={triagemForm.control}
                            name="triagem_end"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data Triagem Fim</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-adm-triagem-triagem_end" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button 
                            type="submit" 
                            className="gap-2"
                            disabled={triagemMutation.isPending}
                            data-testid="button-buscar-triagem"
                          >
                            {triagemMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                            Buscar Triagem
                          </Button>
                        </div>
                      </form>
                    </Form>

                    {apiResponse && activeTab === "triagem" && (
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

              <TabsContent value="bloqueados" className="m-0 space-y-6">
                <Card className="border-2 border-border/60">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="font-bold text-xs h-6 px-2 bg-green-500/10 text-green-700 border-green-500/30">
                          GET
                        </Badge>
                        <div>
                          <CardTitle className="text-base">Bloqueados</CardTitle>
                          <code className="text-xs text-muted-foreground">/api/adm_logistica/bloqueados</code>
                        </div>
                      </div>
                    </div>
                    <CardDescription className="mt-2">
                      Retorna dados de itens bloqueados com filtros por IMEI, rede, datas e status.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Form {...bloqueadosForm}>
                      <form onSubmit={bloqueadosForm.handleSubmit((data) => bloqueadosMutation.mutate(data))} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={bloqueadosForm.control}
                            name="imei"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">IMEI</FormLabel>
                                <FormControl>
                                  <Input placeholder="Filtrar por IMEI" {...field} data-testid="input-adm-bloqueados-imei" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={bloqueadosForm.control}
                            name="redes"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Rede</FormLabel>
                                <FormControl>
                                  <Input placeholder="Nome da rede" {...field} data-testid="input-adm-bloqueados-redes" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={bloqueadosForm.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Status</FormLabel>
                                <FormControl>
                                  <Input placeholder="Status" {...field} data-testid="input-adm-bloqueados-status" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={bloqueadosForm.control}
                            name="date_start"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data Início</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-adm-bloqueados-date_start" />
                                </FormControl>
                                <FormDescription className="text-xs">YYYY-MM-DD</FormDescription>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={bloqueadosForm.control}
                            name="date_end"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Data Fim</FormLabel>
                                <FormControl>
                                  <Input type="date" className="date-picker-full" {...field} data-testid="input-adm-bloqueados-date_end" />
                                </FormControl>
                                <FormDescription className="text-xs">YYYY-MM-DD</FormDescription>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button 
                            type="submit" 
                            className="gap-2"
                            disabled={bloqueadosMutation.isPending}
                            data-testid="button-buscar-bloqueados"
                          >
                            {bloqueadosMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                            Buscar Bloqueados
                          </Button>
                        </div>
                      </form>
                    </Form>

                    {apiResponse && activeTab === "bloqueados" && (
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

              <TabsContent value="manutencao" className="m-0 space-y-6">
                <Card className="border-2 border-border/60">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="font-bold text-xs h-6 px-2 bg-green-500/10 text-green-700 border-green-500/30">
                          GET
                        </Badge>
                        <div>
                          <CardTitle className="text-base">Manutenção</CardTitle>
                          <code className="text-xs text-muted-foreground">/api/adm_logistica/manutencao</code>
                        </div>
                      </div>
                    </div>
                    <CardDescription className="mt-2">
                      Retorna dados de manutenção filtrados por IMEI.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Form {...manutencaoForm}>
                      <form onSubmit={manutencaoForm.handleSubmit((data) => manutencaoMutation.mutate(data))} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={manutencaoForm.control}
                            name="imei"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">IMEI</FormLabel>
                                <FormControl>
                                  <Input placeholder="Filtrar por IMEI" {...field} data-testid="input-adm-manutencao-imei" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button 
                            type="submit" 
                            className="gap-2"
                            disabled={manutencaoMutation.isPending}
                            data-testid="button-buscar-manutencao"
                          >
                            {manutencaoMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                            Buscar Manutenção
                          </Button>
                        </div>
                      </form>
                    </Form>

                    {apiResponse && activeTab === "manutencao" && (
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

              <TabsContent value="divergentes" className="m-0 space-y-6">
                <Card className="border-2 border-border/60">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="font-bold text-xs h-6 px-2 bg-green-500/10 text-green-700 border-green-500/30">
                          GET
                        </Badge>
                        <div>
                          <CardTitle className="text-base">Divergentes</CardTitle>
                          <code className="text-xs text-muted-foreground">/api/adm_logistica/divergentes</code>
                        </div>
                      </div>
                    </div>
                    <CardDescription className="mt-2">
                      Retorna dados de itens divergentes filtrados por IMEI.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Form {...divergentesForm}>
                      <form onSubmit={divergentesForm.handleSubmit((data) => divergentesMutation.mutate(data))} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={divergentesForm.control}
                            name="imei"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">IMEI</FormLabel>
                                <FormControl>
                                  <Input placeholder="Filtrar por IMEI" {...field} data-testid="input-adm-divergentes-imei" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button 
                            type="submit" 
                            className="gap-2"
                            disabled={divergentesMutation.isPending}
                            data-testid="button-buscar-divergentes"
                          >
                            {divergentesMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                            Buscar Divergentes
                          </Button>
                        </div>
                      </form>
                    </Form>

                    {apiResponse && activeTab === "divergentes" && (
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
