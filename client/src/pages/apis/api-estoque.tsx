import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SiPostman } from "react-icons/si";
import {
  Package,
  Search,
  Loader2,
  XCircle,
  CheckCircle,
  Copy,
  Play,
  Info,
  Key,
  FileText,
  ExternalLink,
  Smartphone,
  Tag,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = "/api";

interface ApiResponse {
  data?: any;
  error?: string;
  message?: string;
}

interface EstoqueItem {
  Id: number;
  Imei: string;
  "Código ERP": string;
  Categoria: string;
  Marca: string;
  Modelo: string;
  "Grade Estética": string;
  "Problemas Funcionais": string | null;
  "Valor do Dispositivo": number;
  "Valor sugerido (venda)": number | null;
  "Markup final": number;
  "Valor final": number;
}

export default function ApiEstoquePage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [activeEndpoint, setActiveEndpoint] = useState<string | null>(null);
  
  // Form states
  const [imei, setImei] = useState("");

  const getQueryParams = () => {
    const params: Record<string, string> = {};
    if (imei) params.imei = imei;
    return params;
  };

  const testEndpoint = async (endpoint: string, params: Record<string, string> = {}) => {
    setIsLoading(true);
    setActiveEndpoint(endpoint);
    setApiResponse(null);

    try {
      const queryString = new URLSearchParams(params).toString();
      const url = `${API_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Get raw response text first for debugging
      const rawText = await response.text();

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
        } else if (response.status === 403) {
          setApiResponse({ 
             error: "Token de acesso inválido. Verifique as credenciais da API.",
             data 
          });
          toast({
            title: "Erro de Autorização",
            description: "Token de acesso inválido.",
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
      id: "estoques",
      name: "Consulta de Estoque",
      description: "Retorna a lista de dispositivos em estoque com informações detalhadas incluindo IMEI, código ERP, categoria, marca, modelo, grade estética, problemas funcionais e valores.",
      path: "/estoques",
      icon: Package,
    },
  ];

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const renderEstoqueTable = (data: EstoqueItem[]) => {
    if (!Array.isArray(data) || data.length === 0) {
      return <p className="text-muted-foreground text-sm">Nenhum dado de estoque encontrado.</p>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="p-2 text-left font-semibold border">IMEI</th>
              <th className="p-2 text-left font-semibold border">Código ERP</th>
              <th className="p-2 text-left font-semibold border">Categoria</th>
              <th className="p-2 text-left font-semibold border">Marca</th>
              <th className="p-2 text-left font-semibold border">Modelo</th>
              <th className="p-2 text-left font-semibold border">Grade</th>
              <th className="p-2 text-left font-semibold border">Problemas</th>
              <th className="p-2 text-right font-semibold border">Valor Disp.</th>
              <th className="p-2 text-right font-semibold border">Valor Sugerido</th>
              <th className="p-2 text-right font-semibold border">Markup</th>
              <th className="p-2 text-right font-semibold border">Valor Final</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 50).map((item, idx) => (
              <tr key={idx} className="border-b hover:bg-muted/50">
                <td className="p-2 border font-mono text-xs">{item.Imei}</td>
                <td className="p-2 border">{item["Código ERP"]}</td>
                <td className="p-2 border">{item.Categoria}</td>
                <td className="p-2 border">{item.Marca}</td>
                <td className="p-2 border">{item.Modelo}</td>
                <td className="p-2 border">
                  <Badge variant="outline" className="text-xs">
                    {item["Grade Estética"]}
                  </Badge>
                </td>
                <td className="p-2 border text-red-500">
                  {item["Problemas Funcionais"] || "-"}
                </td>
                <td className="p-2 border text-right">
                  {formatCurrency(item["Valor do Dispositivo"])}
                </td>
                <td className="p-2 border text-right">
                  {formatCurrency(item["Valor sugerido (venda)"])}
                </td>
                <td className="p-2 border text-right">
                  {item["Markup final"]?.toFixed(2)}
                </td>
                <td className="p-2 border text-right font-semibold">
                  {formatCurrency(item["Valor final"])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 50 && (
          <p className="text-muted-foreground text-xs mt-2">
            Mostrando 50 de {data.length} registros. Copie o JSON completo para ver todos.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader 
        title="API - Estoque" 
        description="API para consulta de dados de estoque de dispositivos avaliados."
        breadcrumbs={[
          { label: "Integrações", href: "/apis" },
          { label: "Estoque" }
        ]}
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Filtros */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-5 h-5" />
              Parâmetros de Consulta
            </CardTitle>
            <CardDescription>
              Configure os filtros para a consulta de estoque
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="imei">IMEI (Opcional)</Label>
                <Input
                  id="imei"
                  placeholder="Filtrar por IMEI específico"
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Deixe o campo IMEI vazio para retornar todos os dispositivos em estoque.
            </p>
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
              {!apiResponse.error && apiResponse.data && Array.isArray(apiResponse.data) && apiResponse.data.length > 0 ? (
                <div className="space-y-4">
                  <Alert className="bg-green-500/5 border-green-500/20">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-sm font-bold text-green-700">
                      {apiResponse.data.length} dispositivo(s) encontrado(s)
                    </AlertTitle>
                    <AlertDescription className="text-xs text-green-600/80 mt-1">
                      Os dados foram retornados com sucesso da API de estoque.
                    </AlertDescription>
                  </Alert>
                  {renderEstoqueTable(apiResponse.data)}
                  <Separator />
                  <div>
                    <Label className="text-xs font-semibold">JSON Completo</Label>
                    <ScrollArea className="h-[200px] w-full rounded-md border mt-2">
                      <pre className="text-xs p-4 font-mono whitespace-pre-wrap">
                        {JSON.stringify(apiResponse, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                </div>
              ) : (
                <ScrollArea className="h-[400px] w-full rounded-md border">
                  <pre className="text-xs p-4 font-mono whitespace-pre-wrap">
                    {JSON.stringify(apiResponse, null, 2)}
                  </pre>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        )}

        {/* Documentação */}
        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Documentação do Endpoint
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">GET /api/estoques</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Retorna a lista de dispositivos em estoque com informações detalhadas. 
                  O endpoint retorna apenas dispositivos com status "Inspected" (avaliados) 
                  e que não possuem pedido de venda associado.
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
                    <span>imei</span>
                    <span>string</span>
                    <span>Filtrar por IMEI específico (opcional)</span>
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Campos Retornados</h4>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs bg-muted p-2 rounded">
                    <span className="font-bold">Campo</span>
                    <span className="font-bold">Descrição</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Id</span>
                    <span>ID do dispositivo no sistema</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Imei</span>
                    <span>Número IMEI do dispositivo</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Código ERP</span>
                    <span>Código do dispositivo no ERP</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Categoria</span>
                    <span>Categoria do dispositivo (Smartphone, Tablet, etc)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Marca</span>
                    <span>Fabricante do dispositivo</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Modelo</span>
                    <span>Modelo do dispositivo</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Grade Estética</span>
                    <span>Nota de avaliação estética (A, B, C, etc)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Problemas Funcionais</span>
                    <span>Lista de problemas identificados na avaliação</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Valor do Dispositivo</span>
                    <span>Valor de compra do dispositivo</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Valor sugerido (venda)</span>
                    <span>Preço sugerido para venda</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Markup final</span>
                    <span>Multiplicador aplicado sobre o valor do dispositivo</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Valor final</span>
                    <span>Valor de venda calculado (Valor do Dispositivo × Markup)</span>
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Exemplo de Resposta</h4>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`[
  {
    "Id": 12345,
    "Imei": "123456789012345",
    "Código ERP": "IPHONE13PRO128GB",
    "Categoria": "iPhone",
    "Marca": "Apple",
    "Modelo": "iPhone 13 Pro",
    "Grade Estética": "A",
    "Problemas Funcionais": null,
    "Valor do Dispositivo": 2500.00,
    "Valor sugerido (venda)": 3200.00,
    "Markup final": 1.45,
    "Valor final": 3625.00
  }
]`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
