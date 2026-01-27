import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Package, 
  Code2, 
  Truck, 
  Search,
  AlertCircle,
  CheckCircle,
  Clock,
  Settings2
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  ativo: { label: "Ativo", variant: "default", icon: CheckCircle },
  inativo: { label: "Inativo", variant: "secondary", icon: AlertCircle },
  aguardando_credenciais: { label: "Aguardando Credenciais", variant: "outline", icon: Clock },
  em_desenvolvimento: { label: "Em Desenvolvimento", variant: "secondary", icon: Settings2 },
};

// Correios integrations
const correiosIntegrations = [
  {
    id: "correios-rastreamento",
    name: "Rastreamento de Encomendas - Correios",
    description: "Consulte o status de rastreamento de objetos via API oficial dos Correios",
    status: "aguardando_credenciais",
    documentation: `## Rastreamento de Encomendas - Correios

Consulte o status de rastreamento de objetos via API oficial dos Correios.

### Credenciais não configuradas

Para utilizar a API de rastreamento dos Correios, é necessário configurar as credenciais:

- **CORREIOS_API_KEY** - Chave de Acesso CWS (gerar no portal Meu Correios)

**Nota:** Desde 2025, a API só permite rastrear objetos do próprio contrato.

### Endpoints Disponíveis`,
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
    documentation: `## Logística Reversa - Correios

Solicite coletas reversas e gerencie devoluções via API dos Correios.

### Serviços Disponíveis

- **PAC Reversa** (41076) - Coleta econômica
- **SEDEX Reversa** (40010) - Coleta expressa  
- **SEDEX 10 Reversa** (40215) - Entrega até 10h
- **SEDEX 12 Reversa** (40290) - Entrega até 12h

### Endpoints Disponíveis`,
    endpoints: [
      { method: "POST", path: "/api/logistics/logistica-reversa/solicitar", description: "Solicita nova coleta reversa" },
      { method: "GET", path: "/api/logistics/logistica-reversa", description: "Lista pedidos de logística reversa" },
      { method: "GET", path: "/api/logistics/logistica-reversa/:id", description: "Detalhes do pedido" },
      { method: "POST", path: "/api/logistics/logistica-reversa/:id/cancelar", description: "Cancela pedido" },
    ],
  },
  {
    id: "correios-precos",
    name: "Preços e Prazos - Correios",
    description: "Consulte preços e prazos de envio via API dos Correios",
    status: "ativo",
    documentation: `## Preços e Prazos - Correios

Consulte preços e prazos de envio via API dos Correios.

### Endpoints Disponíveis`,
    endpoints: [
      { method: "POST", path: "/api/logistics/simular-frete", description: "Simula frete com múltiplos operadores" },
      { method: "GET", path: "/api/cep/:cep", description: "Consulta endereço por CEP" },
    ],
  },
];

// Internal APIs
const internalApis = [
  {
    id: "api-chamados",
    name: "API de Chamados",
    description: "Gerenciamento de tickets e suporte interno",
    status: "ativo",
    endpoints: [
      { method: "GET", path: "/api/tickets", description: "Lista todos os chamados" },
      { method: "POST", path: "/api/tickets", description: "Cria novo chamado" },
      { method: "PATCH", path: "/api/tickets/:id", description: "Atualiza chamado" },
      { method: "GET", path: "/api/tickets/:id/comments", description: "Lista comentários" },
    ],
  },
  {
    id: "api-projetos",
    name: "API de Projetos",
    description: "Gerenciamento de projetos e quadros Kanban",
    status: "ativo",
    endpoints: [
      { method: "GET", path: "/api/projects", description: "Lista projetos" },
      { method: "POST", path: "/api/projects", description: "Cria projeto" },
      { method: "GET", path: "/api/projects/:id/cards", description: "Lista cards do projeto" },
      { method: "POST", path: "/api/cards", description: "Cria card" },
    ],
  },
  {
    id: "api-okrs",
    name: "API de OKRs",
    description: "Objetivos e resultados-chave",
    status: "ativo",
    endpoints: [
      { method: "GET", path: "/api/objectives", description: "Lista objetivos" },
      { method: "POST", path: "/api/objectives", description: "Cria objetivo" },
      { method: "GET", path: "/api/key-results", description: "Lista key results" },
      { method: "PATCH", path: "/api/key-results/:id", description: "Atualiza progresso" },
    ],
  },
  {
    id: "api-logistica",
    name: "API de Logística",
    description: "Gerenciamento de envios e operadores",
    status: "ativo",
    endpoints: [
      { method: "GET", path: "/api/logistics/dashboard", description: "Dashboard com estatísticas" },
      { method: "GET", path: "/api/logistics/operators", description: "Lista operadores" },
      { method: "GET", path: "/api/logistics/requests", description: "Lista solicitações" },
      { method: "POST", path: "/api/logistics/requests", description: "Cria solicitação" },
    ],
  },
];

// Operator integrations  
const operatorIntegrations = [
  {
    id: "op-jadlog",
    name: "Jadlog",
    description: "Integração com API da transportadora Jadlog",
    status: "em_desenvolvimento",
    endpoints: [],
  },
  {
    id: "op-azul",
    name: "Azul Cargo",
    description: "Integração com API da Azul Cargo Express",
    status: "em_desenvolvimento",
    endpoints: [],
  },
];

export default function ApisPage() {
  const [activeTab, setActiveTab] = useState("correios");
  const [selectedApi, setSelectedApi] = useState<typeof correiosIntegrations[0] | null>(correiosIntegrations[0]);
  const [trackingCode, setTrackingCode] = useState("");

  const stats = {
    endpointsInternos: 10,
    operadoresAtivos: 2,
    emDesenvolvimento: 1,
    totalIntegracoes: 4,
  };

  const renderApiCard = (api: typeof correiosIntegrations[0]) => {
    const statusConfig = STATUS_CONFIG[api.status];
    const StatusIcon = statusConfig?.icon || Clock;
    
    return (
      <Card 
        key={api.id}
        className={`cursor-pointer transition-all ${selectedApi?.id === api.id ? "ring-2 ring-primary" : ""}`}
        onClick={() => setSelectedApi(api)}
        data-testid={`card-api-${api.id}`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{api.name}</CardTitle>
            <Badge variant={statusConfig?.variant || "outline"} className="shrink-0" data-testid={`badge-status-${api.id}`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig?.label}
            </Badge>
          </div>
          <CardDescription className="text-sm">{api.description}</CardDescription>
        </CardHeader>
      </Card>
    );
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader 
        title="APIs Log" 
        description="Documentação interna de endpoints e integrações com operadores logísticos."
        breadcrumbs={[{ label: "APIs" }]}
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-stat-endpoints">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Endpoints Internos</p>
                  <p className="text-3xl font-bold" data-testid="stat-endpoints">{stats.endpointsInternos}</p>
                </div>
                <Code2 className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-operators">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Operadores Ativos</p>
                  <p className="text-3xl font-bold text-green-600" data-testid="stat-operators">{stats.operadoresAtivos}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-development">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Em Desenvolvimento</p>
                  <p className="text-3xl font-bold text-yellow-600" data-testid="stat-development">{stats.emDesenvolvimento}</p>
                </div>
                <Settings2 className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-total">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Integrações</p>
                  <p className="text-3xl font-bold" data-testid="stat-total">{stats.totalIntegracoes}</p>
                </div>
                <Package className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="correios" className="flex items-center gap-2" data-testid="tab-correios">
              <Package className="h-4 w-4" />
              Correios
            </TabsTrigger>
            <TabsTrigger value="internas" className="flex items-center gap-2" data-testid="tab-api-internas">
              <Code2 className="h-4 w-4" />
              APIs Internas
            </TabsTrigger>
            <TabsTrigger value="operadores" className="flex items-center gap-2" data-testid="tab-api-operadores">
              <Truck className="h-4 w-4" />
              Operadores Logísticos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="correios" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* API List */}
              <div className="space-y-4">
                {correiosIntegrations.map(renderApiCard)}
              </div>

              {/* API Details */}
              <div className="lg:col-span-2">
                {selectedApi && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Package className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle>{selectedApi.name}</CardTitle>
                            <CardDescription>{selectedApi.description}</CardDescription>
                          </div>
                        </div>
                        <Badge variant={STATUS_CONFIG[selectedApi.status]?.variant || "outline"}>
                          {STATUS_CONFIG[selectedApi.status]?.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Tracking Test */}
                      {selectedApi.id === "correios-rastreamento" && (
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              placeholder="Digite o código de rastreio (ex: AA123456789BR)"
                              className="pl-10"
                              value={trackingCode}
                              onChange={(e) => setTrackingCode(e.target.value)}
                              data-testid="input-tracking-code"
                            />
                          </div>
                          <Button data-testid="button-rastrear">
                            <Search className="h-4 w-4 mr-2" />
                            Rastrear
                          </Button>
                        </div>
                      )}

                      {/* Documentation */}
                      {selectedApi.documentation && (
                        <div className="bg-muted/50 rounded-lg p-4 border">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                            <div className="space-y-2">
                              <p className="font-medium text-yellow-700 dark:text-yellow-400">Credenciais não configuradas</p>
                              <p className="text-sm text-muted-foreground">
                                Para utilizar a API de rastreamento dos Correios, é necessário configurar as credenciais:
                              </p>
                              <ul className="text-sm text-muted-foreground list-disc pl-4">
                                <li><strong>CORREIOS_API_KEY</strong> - Chave de Acesso CWS (gerar no portal Meu Correios)</li>
                              </ul>
                              <p className="text-xs text-muted-foreground italic">
                                Nota: Desde 2025, a API só permite rastrear objetos do próprio contrato.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Endpoints */}
                      {selectedApi.endpoints.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                            Endpoints Disponíveis
                          </h4>
                          <div className="space-y-2">
                            {selectedApi.endpoints.map((endpoint, idx) => (
                              <div 
                                key={idx}
                                className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                                data-testid={`endpoint-${idx}`}
                              >
                                <Badge 
                                  variant={endpoint.method === "GET" ? "secondary" : "default"}
                                  className="font-mono text-xs"
                                >
                                  {endpoint.method}
                                </Badge>
                                <code className="text-sm font-mono flex-1">{endpoint.path}</code>
                                <span className="text-sm text-muted-foreground">{endpoint.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="internas" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {internalApis.map((api) => {
                const statusConfig = STATUS_CONFIG[api.status];
                return (
                  <Card key={api.id} data-testid={`card-api-${api.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{api.name}</CardTitle>
                          <CardDescription>{api.description}</CardDescription>
                        </div>
                        <Badge variant={statusConfig?.variant || "default"}>
                          {statusConfig?.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {api.endpoints.slice(0, 3).map((endpoint, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="font-mono text-xs">
                              {endpoint.method}
                            </Badge>
                            <code className="text-xs font-mono text-muted-foreground">{endpoint.path}</code>
                          </div>
                        ))}
                        {api.endpoints.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{api.endpoints.length - 3} endpoints
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="operadores" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {operatorIntegrations.map((api) => {
                const statusConfig = STATUS_CONFIG[api.status];
                const StatusIcon = statusConfig?.icon || Clock;
                return (
                  <Card key={api.id} data-testid={`card-api-${api.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                            <Truck className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{api.name}</CardTitle>
                            <CardDescription className="text-sm">{api.description}</CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Badge variant={statusConfig?.variant || "outline"}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig?.label}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
