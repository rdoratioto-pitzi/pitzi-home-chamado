import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { SiPostman } from "react-icons/si";
import { 
  Package, 
  Code2, 
  Truck, 
  Search,
  AlertCircle,
  CheckCircle,
  Clock,
  Settings2,
  Users,
  BarChart3,
  DollarSign,
  ArrowRight,
  Database
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  ativo: { label: "Ativo", variant: "default", icon: CheckCircle },
  inativo: { label: "Inativo", variant: "secondary", icon: AlertCircle },
  aguardando_credenciais: { label: "Aguardando Credenciais", variant: "outline", icon: Clock },
  em_desenvolvimento: { label: "Em Desenvolvimento", variant: "secondary", icon: Settings2 },
};

const correiosIntegrations = [
  {
    id: "correios-rastreamento",
    name: "Rastreamento de Encomendas - Correios",
    description: "Consulte o status de rastreamento de objetos via API oficial dos Correios",
    status: "aguardando_credenciais",
    endpoints: [
      { method: "GET", path: "/api/integrations/correios/rastro/:codigo", description: "Rastreia objeto por código" },
      { method: "GET", path: "/api/integrations/correios/status", description: "Verifica status da integração" },
    ],
  },
  {
    id: "correios-reversa",
    name: "Logística Reversa - Correios",
    description: "Solicite coletas reversas e gerencie devoluções via API dos Correios",
    status: "ativo",
    endpoints: [
      { method: "POST", path: "/api/logistics/logistica-reversa/solicitar", description: "Solicita nova coleta reversa" },
      { method: "GET", path: "/api/logistics/logistica-reversa", description: "Lista pedidos de logística reversa" },
    ],
  },
];

export default function ApisPage() {
  const [activeTab, setActiveTab] = useState("correios");
  const [selectedApi, setSelectedApi] = useState<any>(correiosIntegrations[0]);
  const [trackingCode, setTrackingCode] = useState("");

  const stats = {
    endpointsInternos: 10,
    operadoresAtivos: 2,
    emDesenvolvimento: 1,
    totalIntegracoes: 4,
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader 
        title="Integrações" 
        description="Documentação de APIs internas, integrações e operadores logísticos."
        breadcrumbs={[{ label: "Integrações" }]}
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider">Endpoints Internos</p>
                  <p className="text-3xl font-bold mt-1">{stats.endpointsInternos}</p>
                </div>
                <Code2 className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider">Operadores Ativos</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{stats.operadoresAtivos}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider">Em Desenvolvimento</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.emDesenvolvimento}</p>
                </div>
                <Settings2 className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider">Total Integrações</p>
                  <p className="text-3xl font-bold mt-1">{stats.totalIntegracoes}</p>
                </div>
                <Package className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="border-b border-border/50 pb-0 px-6">
              <TabsList className="bg-transparent h-12 p-0 gap-8">
                <TabsTrigger 
                  value="correios" 
                  className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none h-12 px-1 text-[13px] font-bold gap-2"
                >
                  <Package className="h-4 w-4" />
                  Correios
                </TabsTrigger>
                <TabsTrigger 
                  value="internas" 
                  className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none h-12 px-1 text-[13px] font-bold gap-2"
                >
                  <Code2 className="h-4 w-4" />
                  APIs Internas
                </TabsTrigger>
                <TabsTrigger 
                  value="operadores" 
                  className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none h-12 px-1 text-[13px] font-bold gap-2"
                >
                  <Truck className="h-4 w-4" />
                  Operadores Logísticos
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="p-6">
              <TabsContent value="correios" className="m-0 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-4 space-y-3">
                    {correiosIntegrations.map((api) => {
                      const isSelected = selectedApi?.id === api.id;
                      return (
                        <div 
                          key={api.id}
                          className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border/60 hover:border-primary/30"}`}
                          onClick={() => setSelectedApi(api)}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <h3 className="text-[14px] font-bold">{api.name}</h3>
                            <Badge variant="outline" className="text-[10px]">
                              {STATUS_CONFIG[api.status]?.label}
                            </Badge>
                          </div>
                          <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">{api.description}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="lg:col-span-8">
                    {selectedApi && (
                      <div className="border rounded-lg p-6 bg-muted/5">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Package className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <h2 className="text-[18px] font-bold leading-tight">{selectedApi.name}</h2>
                              <p className="text-[13px] text-muted-foreground mt-1">{selectedApi.description}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="font-bold">{STATUS_CONFIG[selectedApi.status]?.label}</Badge>
                        </div>

                        {selectedApi.id === "correios-rastreamento" && (
                          <div className="relative mb-6">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              placeholder="Digite o código de rastreio (ex: AA123456789BR)"
                              className="pl-10 pr-28 h-11"
                              value={trackingCode}
                              onChange={(e) => setTrackingCode(e.target.value)}
                            />
                            <Button className="absolute right-1.5 top-1.5 h-8 px-4 text-xs font-bold" size="sm">
                              Rastrear
                            </Button>
                          </div>
                        )}

                        <Alert className="bg-yellow-500/5 border-yellow-500/20 mb-8">
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                          <AlertTitle className="text-[14px] font-bold text-yellow-700">Credenciais não configuradas</AlertTitle>
                          <AlertDescription className="text-[13px] text-yellow-600/80 mt-1">
                            Para utilizar esta API, é necessário configurar as credenciais.
                          </AlertDescription>
                        </Alert>

                        <div className="space-y-4">
                          <h4 className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">
                            Endpoints Disponíveis
                          </h4>
                          <div className="space-y-3">
                            {selectedApi.endpoints.map((endpoint: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-3.5 rounded-lg bg-muted/30 border border-border/40">
                                <div className="flex items-center gap-3">
                                  <Badge variant="secondary" className="font-bold text-[10px] h-5 px-1.5">{endpoint.method}</Badge>
                                  <code className="text-[13px] font-semibold">{endpoint.path}</code>
                                </div>
                                <span className="text-[12px] text-muted-foreground font-medium">{endpoint.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="internas" className="m-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-2 border-border/60 hover:border-primary/30 transition-all" data-testid="card-api-bi-rs">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
                          <BarChart3 className="h-7 w-7 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-[18px] font-bold">API Leitura BI RS</CardTitle>
                            <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-700 border-yellow-500/30">
                              <Clock className="h-3 w-3 mr-1" />
                              Em breve
                            </Badge>
                          </div>
                          <CardDescription className="mt-1.5 text-[13px]">
                            Consulta interna via API da Renov para dados de BI do RS
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 rounded-lg bg-muted/30 border border-border/40">
                        <div className="flex items-start gap-3">
                          <Database className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-[13px] font-semibold text-foreground">Dados disponíveis</p>
                            <p className="text-[12px] text-muted-foreground mt-1">
                              Relatórios, métricas de vendas, indicadores de performance e dashboards do Rio Grande do Sul
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <Alert className="bg-blue-500/5 border-blue-500/20">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <AlertTitle className="text-[13px] font-bold text-blue-700">Integração Pendente</AlertTitle>
                        <AlertDescription className="text-[12px] text-blue-600/80 mt-1">
                          Esta integração será configurada em breve. Os endpoints serão documentados após a implementação.
                        </AlertDescription>
                      </Alert>

                      <div className="pt-2">
                        <Button variant="outline" className="w-full gap-2" disabled>
                          <ArrowRight className="h-4 w-4" />
                          Configurar Integração
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-border/60 hover:border-primary/30 transition-all" data-testid="card-api-pricing">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-xl bg-green-500/10 flex items-center justify-center">
                          <DollarSign className="h-7 w-7 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-[18px] font-bold">API Pricing</CardTitle>
                            <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-700 border-yellow-500/30">
                              <Clock className="h-3 w-3 mr-1" />
                              Em breve
                            </Badge>
                          </div>
                          <CardDescription className="mt-1.5 text-[13px]">
                            Consulta do módulo de Pricing para precificação dinâmica
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 rounded-lg bg-muted/30 border border-border/40">
                        <div className="flex items-start gap-3">
                          <Database className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-[13px] font-semibold text-foreground">Funcionalidades planejadas</p>
                            <p className="text-[12px] text-muted-foreground mt-1">
                              Cálculo de preços, margens, tabelas de precificação e simulações de cenários
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <Alert className="bg-green-500/5 border-green-500/20">
                        <AlertCircle className="h-4 w-4 text-green-600" />
                        <AlertTitle className="text-[13px] font-bold text-green-700">Módulo em Desenvolvimento</AlertTitle>
                        <AlertDescription className="text-[12px] text-green-600/80 mt-1">
                          O módulo de Pricing está sendo desenvolvido. Esta integração será habilitada após sua conclusão.
                        </AlertDescription>
                      </Alert>

                      <div className="pt-2">
                        <Button variant="outline" className="w-full gap-2" disabled>
                          <ArrowRight className="h-4 w-4" />
                          Configurar Integração
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="operadores" className="m-0 space-y-6">
                <div className="text-center py-12">
                  <Truck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-bold text-muted-foreground">Operadores Logísticos</h3>
                  <p className="text-sm text-muted-foreground/70 mt-2">
                    Documentação de integrações com Jadlog, Azul Cargo e outros operadores.
                  </p>
                </div>
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </main>
    </div>
  );
}
