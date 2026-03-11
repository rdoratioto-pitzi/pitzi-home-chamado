import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SiPostman } from "react-icons/si";
import {
  Bot,
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
  TrendingUp,
  BarChart3,
  Calendar,
  Smartphone,
  Camera,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = "/api"; // Use relative path like other API pages
const POSTMAN_DOC_URL = "https://documenter.getpostman.com/view/49982216/2sBXcHgy9E";

interface ApiResponse {
  data?: any;
  error?: string;
  message?: string;
}

export default function ApiAvaliacoesIaPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [activeEndpoint, setActiveEndpoint] = useState<string | null>(null);
  
  // Form states - default to first day of current month to ensure data availability
  const getFirstDayOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  };
  const [startDate, setStartDate] = useState(getFirstDayOfMonth);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [imei, setImei] = useState("");
  const [deviceDescription, setDeviceDescription] = useState("");
  const [statusAssertividade, setStatusAssertividade] = useState("");
  const [categories, setCategories] = useState("");
  const [sortBy, setSortBy] = useState("count");

  const getQueryParams = () => {
    const params: Record<string, string> = {};
    if (imei) params.imei = imei;
    if (deviceDescription) params.device_description = deviceDescription;
    if (statusAssertividade) params.status_assertividade = statusAssertividade;
    if (categories) params.categories = categories;
    if (sortBy) params.sort_by = sortBy;
    return params;
  };

  const testEndpoint = async (endpoint: string, params: Record<string, string> = {}) => {
    setIsLoading(true);
    setActiveEndpoint(endpoint);
    setApiResponse(null);

    try {
      const queryString = new URLSearchParams({
        ...params,
        start_date: startDate,
        end_date: endDate,
      }).toString();

      const url = `${API_BASE_URL}${endpoint}?${queryString}`;
      console.log(`[API Test] Request URL: ${url}`);
      console.log(`[API Test] Request Headers:`, {
        "Authorization": "Bearer Renov123",
        "Content-Type": "application/json",
      });

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          // Note: Authorization header might need to be added by the server's auth layer
          // Try without explicit auth - server might use session/cookie auth
        },
      });

      console.log(`[API Test] Response status: ${response.status} ${response.statusText}`);
      console.log(`[API Test] Response URL: ${response.url}`);
      console.log(`[API Test] Response type: ${response.type}`);
      console.log(`[API Test] Response headers:`, Object.fromEntries(response.headers.entries()));

      // Get raw response text first for debugging
      const rawText = await response.text();
      console.log(`[API Test] Raw response (first 500 chars):`, rawText.substring(0, 500));

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseError: any) {
        console.error(`[API Test] JSON parse error:`, parseError.message);
        setApiResponse({
          error: `Erro ao processar resposta: ${parseError.message}. O servidor pode ter retornado HTML ou texto em vez de JSON.`,
          data: { rawResponse: rawText.substring(0, 1000) }
        });
        setIsLoading(false);
        return;
      }
      
      if (response.ok) {
        setApiResponse({ data, message: "Sucesso!" });
        toast({
          title: "Requisição bem-sucedida",
          description: `Endpoint ${endpoint} retornou dados`,
        });
      } else {
        if (response.status === 401 && (data.error === "Não autenticado" || data.message === "Não autenticado")) {
          setApiResponse({ 
             error: "Sessão expirada ou inválida. Por favor, faça login novamente no sistema.",
             data 
          });
          toast({
            title: "Erro de Autenticação",
            description: "Sua sessão expirou. Faça login novamente.",
            variant: "destructive",
          });
        } else {
          setApiResponse({ error: data.message || data.error || "Erro na requisição", data });
          toast({
            title: "Erro na requisição",
            description: data.message || data.error || "Verifique os parâmetros",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      setApiResponse({ error: error.message || "Falha ao conectar com a API" });
      toast({
        title: "Erro de conexão",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: "Conteúdo copiado para a área de transferência",
    });
  };

  const endpoints = [
    {
      id: "resumo",
      name: "Resumo de Assertividade",
      description: "Retorna um resumo da assertividade da IA agrupado pela grade atribuída pelo avaliador humano (Real).",
      path: "/avaliacoes-ia/resumo",
      icon: BarChart3,
    },
    {
      id: "evolucao",
      name: "Evolução Temporal",
      description: "Retorna a evolução da acurácia da IA mês a mês dentro do período especificado.",
      path: "/avaliacoes-ia/evolucao",
      icon: TrendingUp,
    },
    {
      id: "evolucao-categoria",
      name: "Evolução por Categoria",
      description: "Retorna a evolução da acurácia da IA mês a mês, quebrada por categoria de dispositivo.",
      path: "/avaliacoes-ia/evolucao-categoria",
      icon: TrendingUp,
    },
    {
      id: "dispositivos",
      name: "Acurácia por Dispositivo",
      description: "Retorna os top 10 dispositivos conforme critério de ordenação (volume, assertividade ou erro).",
      path: "/avaliacoes-ia/dispositivos",
      icon: Smartphone,
    },
    {
      id: "detalhes",
      name: "Detalhamento de Avaliações",
      description: "Retorna a lista completa e detalhada de todas as avaliações no período.",
      path: "/avaliacoes-ia/detalhes",
      icon: FileText,
    },
    {
      id: "categorias",
      name: "Acurácia por Categoria",
      description: "Retorna o volume de avaliações e a acurácia da IA agrupados por categoria de dispositivo.",
      path: "/avaliacoes-ia/categorias",
      icon: BarChart3,
    },
    {
      id: "assertividade-fotos",
      name: "Assertividade por Foto",
      description: "Retorna o percentual de assertividade da IA comparado com a avaliação humana, detalhado por mês e tipo de foto.",
      path: "/avaliacoes-ia/assertividade-fotos",
      icon: Camera,
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader 
        title="API - Avaliações IA" 
        description="API para consulta de dados de eficiência e assertividade da Inteligência Artificial nas avaliações estéticas de dispositivos."
        breadcrumbs={[
          { label: "Integrações", href: "/apis" },
          { label: "Avaliações IA" }
        ]}
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Documentação Postman */}
        <div className="flex justify-end">
          <a 
            href={POSTMAN_DOC_URL} 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <SiPostman className="w-4 h-4 mr-2" />
              Documentação Postman
            </Button>
          </a>
        </div>

        {/* Filtros Globais */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-5 h-5" />
              Parâmetros de Consulta
            </CardTitle>
            <CardDescription>
              Configure o período e filtros para todas as consultas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="start-date">Data Inicial</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end-date">Data Final</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="imei">IMEI (Opcional)</Label>
                <Input
                  id="imei"
                  placeholder="Filtrar por IMEI"
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="device-description">Modelo (Opcional)</Label>
                <Input
                  id="device-description"
                  placeholder="Filtrar por modelo"
                  value={deviceDescription}
                  onChange={(e) => setDeviceDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4">
              <Label htmlFor="status-assertividade">Status de Assertividade (Opcional)</Label>
              <select
                id="status-assertividade"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={statusAssertividade}
                onChange={(e) => setStatusAssertividade(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="ACERTOU">ACERTOU</option>
                <option value="ERROU">ERROU</option>
              </select>
            </div>
            <div className="mt-4">
              <Label htmlFor="categories">Categorias (Opcional)</Label>
              <Input
                id="categories"
                placeholder="Filtrar por categorias (ex: Smartphone, Tablet)"
                value={categories}
                onChange={(e) => setCategories(e.target.value)}
              />
            </div>
            <div className="mt-4">
              <Label htmlFor="sort-by">Ordenação Dispositivos (Opcional)</Label>
              <select
                id="sort-by"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="count">Volume (count)</option>
                <option value="accuracy_desc">Maior Assertividade</option>
                <option value="accuracy_asc">Maiores Erros</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {endpoints.map((endpoint) => {
            const Icon = endpoint.icon;
            const isActive = activeEndpoint === endpoint.path;
            
            return (
              <Card key={endpoint.id} className={`shadow-sm border-border/60 ${isActive ? 'ring-2 ring-primary' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icon className="w-5 h-5 text-primary" />
                      {endpoint.name}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      GET
                    </Badge>
                  </div>
                  <CardDescription className="text-sm">
                    {endpoint.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 font-mono">
                        {endpoint.path}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(endpoint.path)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    <Button
                      className="w-full"
                      onClick={() => testEndpoint(endpoint.path, getQueryParams())}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Testando...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Testar Endpoint
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Response Area */}
        {apiResponse && (
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {apiResponse.error ? (
                    <XCircle className="w-5 h-5 text-destructive" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  Resposta da API
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(apiResponse, null, 2))}
                >
                  <Copy className="w-3 h-3 mr-2" />
                  Copiar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full rounded-md border">
                <pre className="text-xs p-4 font-mono whitespace-pre-wrap">
                  {JSON.stringify(apiResponse, null, 2)}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Documentação dos Endpoints */}
        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Documentação dos Endpoints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="resumo">Resumo</TabsTrigger>
                <TabsTrigger value="evolucao">Evolução</TabsTrigger>
                <TabsTrigger value="evolucao-categoria">Evol. Categoria</TabsTrigger>
                <TabsTrigger value="dispositivos">Dispositivos</TabsTrigger>
                <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
              </TabsList>

              <TabsContent value="resumo" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">GET /api/avaliacoes-ia/resumo</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Retorna um resumo da assertividade da IA agrupado pela grade atribuída pelo avaliador humano (Real).
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Parâmetros de Query</h4>
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-3 gap-2 font-mono text-xs bg-muted p-2 rounded">
                        <span className="font-bold">Parâmetro</span>
                        <span className="font-bold">Tipo</span>
                        <span className="font-bold">Descrição</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>start_date</span>
                        <span>string</span>
                        <span>Data inicial (YYYY-MM-DD)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>end_date</span>
                        <span>string</span>
                        <span>Data final (YYYY-MM-DD)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>categories</span>
                        <span>string</span>
                        <span>Filtrar por categorias (opcional)</span>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Exemplo de Resposta</h4>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`[
  {
    "Grade_Humano_Real": "A",
    "Total_Avaliados": 150,
    "Qtd_Acertos_IA": 135,
    "Percentual_Assertividade": 90.0,
    "Erros_Comuns_IA": "B, C"
  }
]`}
                    </pre>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="evolucao" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">GET /api/avaliacoes-ia/evolucao</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Retorna a evolução da acurácia da IA mês a mês dentro do período especificado.
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Parâmetros de Query</h4>
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-3 gap-2 font-mono text-xs bg-muted p-2 rounded">
                        <span className="font-bold">Parâmetro</span>
                        <span className="font-bold">Tipo</span>
                        <span className="font-bold">Descrição</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>start_date</span>
                        <span>string</span>
                        <span>Data inicial (YYYY-MM-DD)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>end_date</span>
                        <span>string</span>
                        <span>Data final (YYYY-MM-DD)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>categories</span>
                        <span>string</span>
                        <span>Filtrar por categorias (opcional)</span>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Exemplo de Resposta</h4>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`[
  {
    "Mes": "2024-01-01",
    "Total_Avaliados": 100,
    "Qtd_Acertos": 85,
    "Acuracia_Mensal": 85.0
  }
]`}
                    </pre>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="evolucao-categoria" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">GET /api/avaliacoes-ia/evolucao-categoria</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Retorna a evolução da acurácia da IA mês a mês, quebrada por categoria de dispositivo.
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Parâmetros de Query</h4>
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-3 gap-2 font-mono text-xs bg-muted p-2 rounded">
                        <span className="font-bold">Parâmetro</span>
                        <span className="font-bold">Tipo</span>
                        <span className="font-bold">Descrição</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>start_date</span>
                        <span>string</span>
                        <span>Data inicial (YYYY-MM-DD)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>end_date</span>
                        <span>string</span>
                        <span>Data final (YYYY-MM-DD)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>categories</span>
                        <span>string</span>
                        <span>Filtrar por categorias (opcional)</span>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Exemplo de Resposta</h4>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`[
  {
    "Mes": "2024-01",
    "Categoria": "Smartphone",
    "Total_Avaliados": 100,
    "Qtd_Acertos": 85,
    "Acuracia_Mensal": 85.0
  },
  {
    "Mes": "2024-01",
    "Categoria": "Tablet",
    "Total_Avaliados": 30,
    "Qtd_Acertos": 28,
    "Acuracia_Mensal": 93.3
  }
]`}
                    </pre>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="dispositivos" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">GET /api/avaliacoes-ia/dispositivos</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Retorna os top 10 dispositivos conforme critério de ordenação (volume, assertividade ou erro).
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Parâmetros de Query</h4>
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-3 gap-2 font-mono text-xs bg-muted p-2 rounded">
                        <span className="font-bold">Parâmetro</span>
                        <span className="font-bold">Tipo</span>
                        <span className="font-bold">Descrição</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>start_date</span>
                        <span>string</span>
                        <span>Data inicial (YYYY-MM-DD)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>end_date</span>
                        <span>string</span>
                        <span>Data final (YYYY-MM-DD)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>sort_by</span>
                        <span>string</span>
                        <span>Ordenação: 'count', 'accuracy_desc', 'accuracy_asc'</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>categories</span>
                        <span>string</span>
                        <span>Filtrar por categorias (opcional)</span>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Exemplo de Resposta</h4>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`[
  {
    "Dispositivo": "iPhone 13",
    "Total_Avaliados": 50,
    "Qtd_Acertos": 45,
    "Acuracia": 90.0
  }
]`}
                    </pre>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="detalhes" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">GET /api/avaliacoes-ia/detalhes</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Retorna a lista completa e detalhada de todas as avaliações no período.
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Parâmetros de Query</h4>
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-3 gap-2 font-mono text-xs bg-muted p-2 rounded">
                        <span className="font-bold">Parâmetro</span>
                        <span className="font-bold">Tipo</span>
                        <span className="font-bold">Descrição</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>start_date</span>
                        <span>string</span>
                        <span>Data inicial (YYYY-MM-DD)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>end_date</span>
                        <span>string</span>
                        <span>Data final (YYYY-MM-DD)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>imei</span>
                        <span>string</span>
                        <span>Filtrar por IMEI (opcional)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>device_description</span>
                        <span>string</span>
                        <span>Filtrar por modelo (opcional)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>status_assertividade</span>
                        <span>string</span>
                        <span>Filtrar por ACERTOU ou ERROU (opcional)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>categories</span>
                        <span>string</span>
                        <span>Filtrar por categorias (opcional)</span>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Exemplo de Resposta</h4>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`[
  {
    "Imei": "123456789012345",
    "DeviceDescription": "iPhone 13",
    "Grade_Humano": "A",
    "Grade_IA": "A",
    "Status_Assertividade": "ACERTOU",
    "Is_Match": 1,
    "Data_Avaliacao": "2024-01-15T10:30:00Z",
    "Link_Fotos": "https://app.renovsmart.com.br/..."
  }
]`}
                    </pre>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="categorias" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">GET /api/avaliacoes-ia/categorias</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Retorna o volume de avaliações e a acurácia da IA agrupados por categoria de dispositivo.
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Parâmetros de Query</h4>
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-3 gap-2 font-mono text-xs bg-muted p-2 rounded">
                        <span className="font-bold">Parâmetro</span>
                        <span className="font-bold">Tipo</span>
                        <span className="font-bold">Descrição</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>start_date</span>
                        <span>string</span>
                        <span>Data inicial (YYYY-MM-DD)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>end_date</span>
                        <span>string</span>
                        <span>Data final (YYYY-MM-DD)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>categories</span>
                        <span>string</span>
                        <span>Filtrar por categorias (opcional)</span>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Exemplo de Resposta</h4>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`[
  {
    "Categoria": "Smartphone",
    "Total_Avaliados": 1500,
    "Qtd_Acertos": 1275,
    "Acuracia": 85.0
  },
  {
    "Categoria": "Tablet",
    "Total_Avaliados": 300,
    "Qtd_Acertos": 270,
    "Acuracia": 90.0
  }
]`}
                    </pre>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="assertividade-fotos" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">GET /api/avaliacoes-ia/assertividade-fotos</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Retorna o percentual de assertividade da IA comparado com a avaliação humana, detalhado por mês e tipo de foto (tela).
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Parâmetros de Query</h4>
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-3 gap-2 font-mono text-xs bg-muted p-2 rounded">
                        <span className="font-bold">Parâmetro</span>
                        <span className="font-bold">Tipo</span>
                        <span className="font-bold">Descrição</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>start_date</span>
                        <span>string</span>
                        <span>Data inicial (YYYY-MM-DD)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>end_date</span>
                        <span>string</span>
                        <span>Data final (YYYY-MM-DD)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>categories</span>
                        <span>string</span>
                        <span>Filtrar por categorias (opcional)</span>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Exemplo de Resposta</h4>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`[
  {
    "Mes": "2024-01",
    "Tipo_Foto": "Tela",
    "Total_Avaliados": 500,
    "Acertos_Ambos_Dano": 100,
    "Acertos_Ambos_Sem_Dano": 350,
    "Total_Acertos": 450,
    "Percentual_Assertividade": 90.0
  },
  {
    "Mes": "2024-01",
    "Tipo_Foto": "Traseira",
    "Total_Avaliados": 480,
    "Acertos_Ambos_Dano": 90,
    "Acertos_Ambos_Sem_Dano": 340,
    "Total_Acertos": 430,
    "Percentual_Assertividade": 89.6
  }
]`}
                    </pre>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}