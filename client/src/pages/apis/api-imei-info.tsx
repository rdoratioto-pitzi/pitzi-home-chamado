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
import {
  Search,
  Loader2,
  XCircle,
  CheckCircle,
  RefreshCw,
  Info,
  Key,
  FileText,
  Smartphone,
  CreditCard,
  Activity,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface ConnectionStatus {
  connected: boolean;
  message: string;
  timestamp?: string;
}

const checkImeiSchema = z.object({
  imei: z.string().min(1, "IMEI é obrigatório"),
  service: z.string().optional(),
});

export default function ApiImeiInfoPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [apiResponse, setApiResponse] = useState<any>(null);

  const checkImeiForm = useForm({
    resolver: zodResolver(checkImeiSchema),
    defaultValues: {
      imei: "",
      service: "",
    },
  });

  const creditsQuery = useQuery({
    queryKey: ["/api/integrations/imei-info/credits"],
    enabled: activeTab === "creditos",
  });

  const statsQuery = useQuery({
    queryKey: ["/api/integrations/imei-info/stats"],
    enabled: activeTab === "visao-geral",
  });

  const dbStatsQuery = useQuery({
    queryKey: ["/api/integrations/imei-info/db-stats"],
    enabled: activeTab === "visao-geral",
  });

  const testConnection = async () => {
    setIsTestingConnection(true);
    try {
      const response = await fetch("/api/integrations/imei-info/test-connection", {
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

  const checkImeiMutation = useMutation({
    mutationFn: async (data: z.infer<typeof checkImeiSchema>) => {
      const response = await fetch("/api/integrations/imei-info/check-imei", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imei: data.imei, service: data.service || undefined }),
      });
      if (!response.ok) throw new Error("Falha na requisição");
      return response.json();
    },
    onSuccess: (data) => {
      setApiResponse(data);
      toast({ title: "Consulta IMEI realizada com sucesso!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro na consulta", description: error.message, variant: "destructive" });
    },
  });

  const tabTriggerClass = "bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none h-12 px-1 text-[13px] font-bold gap-2";

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="API IMEI.info"
        breadcrumbs={[
          { label: "Integrações", href: "/apis" },
          { label: "API IMEI.info" },
        ]}
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">API IMEI.info</h2>
              <p className="text-sm text-muted-foreground">Consulta e verificação de IMEI de dispositivos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              {connectionStatus.message} {connectionStatus.timestamp && `• Último teste: ${connectionStatus.timestamp}`}
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
                <TabsTrigger value="consultar-imei" className={tabTriggerClass} data-testid="tab-consultar-imei">
                  <Search className="h-4 w-4" />
                  Consultar IMEI
                </TabsTrigger>
                <TabsTrigger value="creditos" className={tabTriggerClass} data-testid="tab-creditos">
                  <CreditCard className="h-4 w-4" />
                  Créditos
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
                        A integração com IMEI.info permite consultar informações detalhadas de dispositivos
                        através do número IMEI. Inclui dados como modelo, fabricante, status de garantia e mais.
                      </p>

                      <Separator />

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Provedor</span>
                          <Badge variant="secondary" className="text-xs">IMEI.info</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Autenticação</span>
                          <Badge variant="secondary" className="text-xs">API Key</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Tipo</span>
                          <Badge variant="outline" className="text-xs">REST API</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-border/60">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        Estatísticas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {statsQuery.isLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : statsQuery.data ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Total de Consultas</span>
                            <Badge variant="outline" className="text-xs" data-testid="text-total-consultas">
                              {(statsQuery.data as any)?.totalQueries ?? "—"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Consultas Hoje</span>
                            <Badge variant="outline" className="text-xs" data-testid="text-consultas-hoje">
                              {(statsQuery.data as any)?.todayQueries ?? "—"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Taxa de Sucesso</span>
                            <Badge variant="outline" className="text-xs" data-testid="text-taxa-sucesso">
                              {(statsQuery.data as any)?.successRate ?? "—"}
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhuma estatística disponível.</p>
                      )}

                      <Separator />

                      {dbStatsQuery.isLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : dbStatsQuery.data ? (
                        <div className="space-y-3">
                          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Banco de Dados</Label>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Registros</span>
                            <Badge variant="outline" className="text-xs" data-testid="text-db-registros">
                              {(dbStatsQuery.data as any)?.totalRecords ?? "—"}
                            </Badge>
                          </div>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-2 border-border/60">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Key className="h-4 w-4 text-primary" />
                      Endpoints Disponíveis
                    </CardTitle>
                    <CardDescription>
                      Lista de endpoints disponíveis na API IMEI.info
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { method: "POST", path: "/api/integrations/imei-info/check-imei", name: "Consultar IMEI", description: "Verifica informações de um dispositivo pelo IMEI" },
                        { method: "GET", path: "/api/integrations/imei-info/credits", name: "Créditos", description: "Retorna saldo de créditos da API" },
                        { method: "GET", path: "/api/integrations/imei-info/stats", name: "Estatísticas", description: "Retorna estatísticas de monitoramento" },
                        { method: "GET", path: "/api/integrations/imei-info/db-stats", name: "Estatísticas do DB", description: "Retorna estatísticas do banco de dados" },
                      ].map((endpoint) => (
                        <div
                          key={endpoint.path}
                          className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border/40 hover:border-primary/30 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <Badge
                              variant="secondary"
                              className={`font-bold text-xs px-2 ${
                                endpoint.method === "POST"
                                  ? "bg-blue-500/10 text-blue-700 border-blue-500/30"
                                  : "bg-green-500/10 text-green-700 border-green-500/30"
                              }`}
                            >
                              {endpoint.method}
                            </Badge>
                            <div>
                              <p className="font-semibold text-sm">{endpoint.name}</p>
                              <code className="text-xs text-muted-foreground">{endpoint.path}</code>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground max-w-xs text-right">{endpoint.description}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="consultar-imei" className="m-0 space-y-6">
                <Card className="border-2 border-border/60">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="font-bold text-xs px-2 bg-blue-500/10 text-blue-700 border-blue-500/30">
                        POST
                      </Badge>
                      <div>
                        <CardTitle className="text-base">Consultar IMEI</CardTitle>
                        <code className="text-xs text-muted-foreground">/api/integrations/imei-info/check-imei</code>
                      </div>
                    </div>
                    <CardDescription className="mt-2">
                      Verifica informações detalhadas de um dispositivo através do número IMEI.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Form {...checkImeiForm}>
                      <form onSubmit={checkImeiForm.handleSubmit((data) => checkImeiMutation.mutate(data))} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={checkImeiForm.control}
                            name="imei"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">IMEI *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Digite o número IMEI" {...field} data-testid="input-imei" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={checkImeiForm.control}
                            name="service"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Serviço (opcional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="Tipo de serviço" {...field} data-testid="input-service" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="submit"
                            className="gap-2"
                            disabled={checkImeiMutation.isPending}
                            data-testid="button-consultar-imei"
                          >
                            {checkImeiMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                            Consultar IMEI
                          </Button>
                        </div>
                      </form>
                    </Form>

                    {apiResponse && activeTab === "consultar-imei" && (
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Resposta da API</Label>
                        <ScrollArea className="h-64 w-full rounded-md border bg-muted/20 p-4">
                          <pre className="text-xs font-mono whitespace-pre-wrap" data-testid="text-api-response">
                            {JSON.stringify(apiResponse, null, 2)}
                          </pre>
                        </ScrollArea>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="creditos" className="m-0 space-y-6">
                <Card className="border-2 border-border/60">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      Créditos da API
                    </CardTitle>
                    <CardDescription>
                      Saldo e informações de créditos disponíveis na API IMEI.info
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {creditsQuery.isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : creditsQuery.error ? (
                      <Alert className="bg-red-500/5 border-red-500/20">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <AlertTitle className="text-sm font-bold text-red-700">Erro ao carregar créditos</AlertTitle>
                        <AlertDescription className="text-xs text-red-600/80">
                          Não foi possível obter as informações de créditos. Verifique a conexão com a API.
                        </AlertDescription>
                      </Alert>
                    ) : creditsQuery.data ? (
                      <div className="space-y-4">
                        <ScrollArea className="h-64 w-full rounded-md border bg-muted/20 p-4">
                          <pre className="text-xs font-mono whitespace-pre-wrap" data-testid="text-credits-response">
                            {JSON.stringify(creditsQuery.data, null, 2)}
                          </pre>
                        </ScrollArea>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhuma informação de crédito disponível.</p>
                    )}

                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => creditsQuery.refetch()}
                        disabled={creditsQuery.isFetching}
                        data-testid="button-refresh-credits"
                      >
                        {creditsQuery.isFetching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        Atualizar Créditos
                      </Button>
                    </div>
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
