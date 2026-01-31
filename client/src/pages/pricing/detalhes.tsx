import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  Minus,
  RefreshCw,
  Download,
  ExternalLink,
  Smartphone,
  Calendar,
  Tag,
  ShoppingCart,
  ArrowLeft,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  DollarSign,
  Hash,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Area,
  AreaChart,
} from "recharts";

const RENOVSMART_API_BASE = "https://rp.renovsmart.com.br/api";

const CATEGORIES = [
  { id: "d7f3dcd8-ddf9-4750-b1f8-c20a5bc9d345", name: "iPhone" },
  { id: "d686a25d-045d-4b8c-9d7c-35a21d29d31b", name: "Smartphone (Geral)" },
];

interface AggregatedData {
  manufacturer: string;
  model: string;
  storage: number;
  minPrice: number;
  avgPrice: number;
  maxPrice: number;
  itemsCount: number;
  updatedAt: string;
}

interface SearchResult {
  id?: string;
  title?: string;
  link?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  thumbnail?: string;
  position?: number;
}

interface SearchResponse {
  raw?: {
    shopping_results?: SearchResult[];
  };
  searchedAt?: string;
}

interface InternalPrice {
  price?: number;
  tradeInPrice?: number;
}

export default function PricingDetailsPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [months, setMonths] = useState("12");
  const [isExporting, setIsExporting] = useState(false);

  const params = new URLSearchParams(location.split("?")[1] || "");
  const category = params.get("category") || CATEGORIES[0].id;
  const brand = params.get("brand") || "";
  const model = params.get("model") || "";
  const storage = params.get("storage") || "";

  const categoryName = CATEGORIES.find((c) => c.id === category)?.name || "";
  const deviceName = `${brand} ${model} ${storage}GB`;

  const { data: aggData, isLoading: isLoadingAgg, refetch: refetchAgg } = useQuery<AggregatedData[]>({
    queryKey: ["pricing-agg", brand, model, storage, months],
    queryFn: async () => {
      if (!brand || !model || !storage) return [];
      const url = `${RENOVSMART_API_BASE}/agg/by-device?manufacturer=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&storage=${storage}&months=${months}&page=1&pageSize=1000`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Erro ao carregar dados agregados");
      return response.json();
    },
    enabled: !!brand && !!model && !!storage,
    staleTime: 5 * 60 * 1000,
  });

  const { data: searchData, isLoading: isLoadingSearch, refetch: refetchSearch } = useQuery<SearchResponse>({
    queryKey: ["pricing-search", category, brand, model, storage],
    queryFn: async () => {
      if (!brand || !model || !storage) return { raw: { shopping_results: [] } };
      const url = `${RENOVSMART_API_BASE}/search?categoryId=${category}&manufacturer=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&storage=${storage}&ignoreLastUpdateDate=false`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Erro ao carregar anúncios");
      return response.json();
    },
    enabled: !!brand && !!model && !!storage,
    staleTime: 5 * 60 * 1000,
  });

  const { data: internalPrice, isLoading: isLoadingPrice } = useQuery<InternalPrice>({
    queryKey: ["pricing-internal", category, brand, model, storage],
    queryFn: async () => {
      if (!brand || !model || !storage) return {};
      const url = `${RENOVSMART_API_BASE}/eligible-devices/price?categoryId=${category}&manufacturerName=${encodeURIComponent(brand)}&modelName=${encodeURIComponent(model)}&storage=${storage}`;
      const response = await fetch(url);
      if (!response.ok) return {};
      return response.json();
    },
    enabled: !!brand && !!model && !!storage,
    staleTime: 5 * 60 * 1000,
  });

  const shoppingResults = searchData?.raw?.shopping_results || [];

  const chartData = useMemo(() => {
    if (!aggData || aggData.length === 0) return [];
    return aggData
      .map((item) => ({
        date: new Date(item.updatedAt).toLocaleDateString("pt-BR"),
        avgPrice: Number(item.avgPrice.toFixed(2)),
        minPrice: Number(item.minPrice.toFixed(2)),
        maxPrice: Number(item.maxPrice.toFixed(2)),
        itemsCount: item.itemsCount,
      }))
      .sort((a, b) => {
        const [dayA, monthA, yearA] = a.date.split("/").map(Number);
        const [dayB, monthB, yearB] = b.date.split("/").map(Number);
        return new Date(yearA, monthA - 1, dayA).getTime() - new Date(yearB, monthB - 1, dayB).getTime();
      });
  }, [aggData]);

  const latestData = aggData && aggData.length > 0 ? aggData[aggData.length - 1] : null;
  const previousData = aggData && aggData.length > 1 ? aggData[aggData.length - 2] : null;

  const priceVariation = useMemo(() => {
    if (!latestData || !previousData) return null;
    const variation = ((latestData.avgPrice - previousData.avgPrice) / previousData.avgPrice) * 100;
    return variation;
  }, [latestData, previousData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const historyData = chartData.map((d) => ({
        Data: d.date,
        "Preço Médio": d.avgPrice,
        "Preço Mínimo": d.minPrice,
        "Preço Máximo": d.maxPrice,
        "Ofertas": d.itemsCount,
      }));

      const adsData = shoppingResults.map((ad, idx) => ({
        "#": idx + 1,
        Loja: ad.source || "N/A",
        Preço: ad.extracted_price || 0,
        Link: ad.link || "",
      }));

      const wb = XLSX.utils.book_new();
      
      const wsHistory = XLSX.utils.json_to_sheet(historyData);
      XLSX.utils.book_append_sheet(wb, wsHistory, "Histórico");
      
      const wsAds = XLSX.utils.json_to_sheet(adsData);
      XLSX.utils.book_append_sheet(wb, wsAds, "Anúncios");

      const filename = `pricing_${brand}_${model}_${storage}GB_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast({
        title: "Exportação concluída",
        description: `Arquivo ${filename} baixado com sucesso.`,
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os dados.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = isLoadingAgg || isLoadingSearch || isLoadingPrice;

  if (!brand || !model || !storage) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader
          title="Detalhes do Produto"
          description="Selecione um produto para ver os detalhes"
        />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Smartphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">
                Nenhum produto selecionado. Selecione um produto na Visão Geral ou Análise de Produtos.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Link href="/pricing">
                  <Button variant="outline" data-testid="button-go-overview">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Visão Geral
                  </Button>
                </Link>
                <Link href="/pricing/analise">
                  <Button data-testid="button-go-analysis">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Análise de Produtos
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={deviceName}
        description={`Análise detalhada de preços - ${categoryName}`}
        breadcrumbs={[
          { label: "Pricing", href: "/pricing" },
          { label: "Detalhes", href: "/pricing/detalhes" },
          { label: deviceName },
        ]}
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link href="/pricing">
            <Button variant="outline" size="sm" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchAgg();
                refetchSearch();
              }}
              disabled={isLoading}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={isExporting || !aggData || aggData.length === 0}
              data-testid="button-export"
            >
              <Download className={`h-4 w-4 mr-2 ${isExporting ? "animate-spin" : ""}`} />
              Exportar Excel
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Smartphone className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">{deviceName}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{categoryName}</Badge>
                    <Badge variant="secondary">{storage}GB</Badge>
                  </CardDescription>
                </div>
              </div>
              {latestData && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Preço Médio Atual</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(latestData.avgPrice)}
                  </p>
                  {priceVariation !== null && (
                    <div className={`flex items-center justify-end gap-1 text-sm ${priceVariation < 0 ? "text-green-600" : priceVariation > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                      {priceVariation < 0 ? (
                        <TrendingDown className="h-4 w-4" />
                      ) : priceVariation > 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <Minus className="h-4 w-4" />
                      )}
                      <span>{priceVariation.toFixed(2)}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <Tag className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Marca</p>
                  <p className="font-medium">{brand}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Modelo</p>
                  <p className="font-medium">{model}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Hash className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Capacidade</p>
                  <p className="font-medium">{storage}GB</p>
                </div>
              </div>
              {internalPrice?.tradeInPrice && (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Preço Trade-in</p>
                    <p className="font-medium text-primary">
                      {formatCurrency(internalPrice.tradeInPrice)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))
          ) : latestData ? (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-500/10">
                      <DollarSign className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Preço Médio</p>
                      <p className="text-xl font-bold">{formatCurrency(latestData.avgPrice)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-green-500/10">
                      <TrendingDown className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Preço Mínimo</p>
                      <p className="text-xl font-bold">{formatCurrency(latestData.minPrice)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-red-500/10">
                      <TrendingUp className="h-6 w-6 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Preço Máximo</p>
                      <p className="text-xl font-bold">{formatCurrency(latestData.maxPrice)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-purple-500/10">
                      <ShoppingCart className="h-6 w-6 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Ofertas Detectadas</p>
                      <p className="text-xl font-bold">{latestData.itemsCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="md:col-span-4">
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum dado disponível para este dispositivo.
              </CardContent>
            </Card>
          )}
        </div>

        <Tabs defaultValue="chart" className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="chart" data-testid="tab-chart">Gráficos</TabsTrigger>
              <TabsTrigger value="history" data-testid="tab-history">Histórico</TabsTrigger>
              <TabsTrigger value="ads" data-testid="tab-ads">Anúncios ({shoppingResults.length})</TabsTrigger>
            </TabsList>
            <Select value={months} onValueChange={setMonths}>
              <SelectTrigger className="w-36" data-testid="select-months">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Último mês</SelectItem>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="chart">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Evolução de Preços</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingAgg ? (
                    <Skeleton className="h-64" />
                  ) : chartData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Sem dados para exibir
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis 
                            tickFormatter={(value) => `R$${value}`} 
                            className="text-xs"
                            domain={['auto', 'auto']}
                          />
                          <Tooltip 
                            formatter={(value: number) => [formatCurrency(value), ""]}
                            labelStyle={{ color: "hsl(var(--foreground))" }}
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--card))",
                              borderColor: "hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="avgPrice"
                            name="Preço Médio"
                            stroke="hsl(var(--primary))"
                            fillOpacity={1}
                            fill="url(#colorAvg)"
                          />
                          <Line
                            type="monotone"
                            dataKey="minPrice"
                            name="Preço Mínimo"
                            stroke="#22c55e"
                            strokeDasharray="5 5"
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="maxPrice"
                            name="Preço Máximo"
                            stroke="#ef4444"
                            strokeDasharray="5 5"
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ofertas ao Longo do Tempo</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingAgg ? (
                    <Skeleton className="h-64" />
                  ) : chartData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Sem dados para exibir
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip 
                            labelStyle={{ color: "hsl(var(--foreground))" }}
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--card))",
                              borderColor: "hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Bar 
                            dataKey="itemsCount" 
                            name="Ofertas" 
                            fill="hsl(var(--primary))" 
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de Preços</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingAgg ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Sem histórico disponível
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Preço Médio</TableHead>
                          <TableHead className="text-right">Mínimo</TableHead>
                          <TableHead className="text-right">Máximo</TableHead>
                          <TableHead className="text-right">Ofertas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {chartData.slice().reverse().map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{row.date}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.avgPrice)}</TableCell>
                            <TableCell className="text-right text-green-600">
                              {formatCurrency(row.minPrice)}
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                              {formatCurrency(row.maxPrice)}
                            </TableCell>
                            <TableCell className="text-right">{row.itemsCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ads">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Anúncios Detectados ({shoppingResults.length})
                  </CardTitle>
                  {searchData?.searchedAt && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Atualizado: {new Date(searchData.searchedAt).toLocaleString("pt-BR")}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingSearch ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : shoppingResults.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    Nenhum anúncio detectado
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Loja</TableHead>
                          <TableHead className="text-right">Preço</TableHead>
                          <TableHead className="w-24 text-right">Link</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shoppingResults.map((ad, idx) => (
                          <TableRow key={ad.id || idx} data-testid={`row-ad-${idx}`}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{ad.source || "Loja"}</p>
                                <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                                  {ad.title}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {ad.extracted_price ? formatCurrency(ad.extracted_price) : ad.price || "N/A"}
                            </TableCell>
                            <TableCell className="text-right">
                              {ad.link && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  asChild
                                  data-testid={`button-link-${idx}`}
                                >
                                  <a href={ad.link} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
