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
import { usePricingCategories } from "@/hooks/use-pricing-categories";

const PRICING_API_BASE = "/api/pricing";

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

interface ScrapedPrice {
  id: string;
  rawId: string;
  productId: string;
  productUrl: string;
  title: string;
  source: string;
  priceText: string;
  extractedPrice: number;
  rating?: number;
  reviews?: number;
  thumbnail: string;
}

interface DeviceWithPrices {
  device: {
    categoryId: string;
    manufacturerName: string;
    modelName: string;
    storage: number;
  };
  fromCache: boolean;
  scrapedAt: string;
  scrapedData: ScrapedPrice[];
}

interface InternalPrice {
  price?: number;
  tradeInPrice?: number;
}

export default function PricingDetailsPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: categoriesData } = usePricingCategories();
  const [months, setMonths] = useState("12");
  const [isExporting, setIsExporting] = useState(false);
  const [isForceRefreshing, setIsForceRefreshing] = useState(false);
  
  // State for URL parameters - updated reactively when location changes
  const [category, setCategory] = useState(() => {
    // Initialize from URL on first render
    const params = new URLSearchParams(window.location.search);
    return params.get("category") || "";
  });
  const [brand, setBrand] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("brand") || "";
  });
  const [model, setModel] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("model") || "";
  });
  const [storage, setStorage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("storage") || "";
  });
  
  // Parse URL parameters when location changes
  // IMPORTANT: useLocation from wouter doesn't include query params, so we use window.location.search
  useEffect(() => {
    console.log("[detalhes] useEffect triggered, location:", location);
    console.log("[detalhes] window.location.search:", window.location.search);
    
    // Use window.location.search to get query params (works better with wouter)
    const params = new URLSearchParams(window.location.search);
    const urlCategory = params.get("category");
    const urlBrand = params.get("brand");
    const urlModel = params.get("model");
    const urlStorage = params.get("storage");
    
    console.log("[detalhes] Parsed params:", { urlCategory, urlBrand, urlModel, urlStorage });
    
    setCategory(urlCategory || (categoriesData?.[0]?.id || ""));
    setBrand(urlBrand || "");
    setModel(urlModel || "");
    setStorage(urlStorage || "");
  }, [location]);

  useEffect(() => {
    if (categoriesData && categoriesData.length > 0 && !category) {
      setCategory(categoriesData[0].id);
    }
  }, [categoriesData, category]);

  const categoryName = categoriesData?.find((c) => c.id === category)?.name || "";
  const deviceName = `${brand} ${model} ${storage}GB`;

  const { data: aggData, isLoading: isLoadingAgg, refetch: refetchAgg } = useQuery<AggregatedData[]>({
    queryKey: ["pricing-agg", brand, model, storage, months],
    queryFn: async () => {
      if (!brand || !model || !storage) return [];
      const url = `${PRICING_API_BASE}/agg/by-device?manufacturer=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&storage=${storage}&months=${months}&page=1&pageSize=1000`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Erro ao carregar dados agregados");
      return response.json();
    },
    enabled: !!brand && !!model && !!storage,
    staleTime: 5 * 60 * 1000,
  });

  const { data: deviceData, isLoading: isLoadingSearch, refetch: refetchSearch } = useQuery<DeviceWithPrices>({
    queryKey: ["pricing-device", category, brand, model, storage],
    queryFn: async () => {
      if (!brand || !model || !storage) throw new Error("Parâmetros inválidos");
      const url = `${PRICING_API_BASE}/device/${category}/${encodeURIComponent(brand)}/${encodeURIComponent(model)}/${storage}`;
      const response = await fetch(url);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(error.error || "Erro ao carregar dados do dispositivo");
      }
      return response.json();
    },
    enabled: !!brand && !!model && !!storage,
    staleTime: 5 * 60 * 1000, // 5 minutos - o cache de 7 dias é gerenciado pelo servidor
  });

  const { data: internalPrice, isLoading: isLoadingPrice } = useQuery<InternalPrice>({
    queryKey: ["pricing-internal", category, brand, model, storage],
    queryFn: async () => {
      if (!brand || !model || !storage) return {};
      const url = `${PRICING_API_BASE}/eligible-devices/price?categoryId=${category}&manufacturerName=${encodeURIComponent(brand)}&modelName=${encodeURIComponent(model)}&storage=${storage}`;
      const response = await fetch(url);
      if (!response.ok) return {};
      return response.json();
    },
    enabled: !!brand && !!model && !!storage,
    staleTime: 5 * 60 * 1000,
  });

  // State for discarded ads (local only - resets on page refresh)
  const [discardedAdIds, setDiscardedAdIds] = useState<Set<string>>(new Set());

  // Filter out discarded ads from results
  const activeShoppingResults = useMemo(() => {
    return (deviceData?.scrapedData || []).filter(ad => !discardedAdIds.has(ad.id));
  }, [deviceData?.scrapedData, discardedAdIds]);

  const shoppingResults = activeShoppingResults;

  // Handle discarding an ad
  const handleDiscardAd = (adId: string) => {
    setDiscardedAdIds(prev => new Set(Array.from(prev).concat(adId)));
    toast({
      title: "Anúncio descartado",
      description: "O anúncio foi removido da lista. Os valores serão recalculados.",
    });
  };

  // Handle restoring all discarded ads
  const handleRestoreAll = () => {
    setDiscardedAdIds(new Set());
    toast({
      title: "Anúncios restaurados",
      description: "Todos os anúncios descartados foram restaurados.",
    });
  };
   
  // Informações do cache
  const isFromCache = deviceData?.fromCache || false;
  const scrapedAt = deviceData?.scrapedAt ? new Date(deviceData.scrapedAt).toLocaleString("pt-BR") : "N/A";

  // Calculate prices from active (non-discarded) scraped ads
  const scrapedPrices = useMemo(() => {
    const prices = shoppingResults
      .map(ad => ad.extractedPrice)
      .filter((price): price is number => typeof price === "number" && !isNaN(price));
    
    if (prices.length === 0) return null;
    
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    return { min, max, avg, count: prices.length };
  }, [shoppingResults]);

  const chartData = useMemo(() => {
    let data: {
      date: string;
      avgPrice: number;
      minPrice: number;
      maxPrice: number;
      itemsCount: number;
    }[] = [];
    
    if (aggData && aggData.length > 0) {
      data = aggData
        .map((item) => ({
          date: new Date(item.updatedAt).toLocaleDateString("pt-BR"),
          avgPrice: Number(item.avgPrice.toFixed(2)),
          minPrice: Number(item.minPrice.toFixed(2)),
          maxPrice: Number(item.maxPrice.toFixed(2)),
          itemsCount: item.itemsCount,
        }));
    }

    // Sort historical data
    data.sort((a, b) => {
      const [dayA, monthA, yearA] = a.date.split("/").map(Number);
      const [dayB, monthB, yearB] = b.date.split("/").map(Number);
      return new Date(yearA, monthA - 1, dayA).getTime() - new Date(yearB, monthB - 1, dayB).getTime();
    });

    // Add/Update with scraped data if available
    if (scrapedPrices) {
      // Use scrapedAt date if available, otherwise today
      const dateStr = deviceData?.scrapedAt 
        ? new Date(deviceData.scrapedAt).toLocaleDateString("pt-BR")
        : new Date().toLocaleDateString("pt-BR");
        
      const scrapedPoint = {
        date: dateStr,
        avgPrice: Number(Number(scrapedPrices.avg).toFixed(2)),
        minPrice: Number(Number(scrapedPrices.min).toFixed(2)),
        maxPrice: Number(Number(scrapedPrices.max).toFixed(2)),
        itemsCount: scrapedPrices.count,
      };

      const existingIndex = data.findIndex(d => d.date === dateStr);
      
      if (existingIndex >= 0) {
        data[existingIndex] = scrapedPoint;
      } else {
        data.push(scrapedPoint);
      }

      // Re-sort to ensure correct order
      data.sort((a, b) => {
        const [dayA, monthA, yearA] = a.date.split("/").map(Number);
        const [dayB, monthB, yearB] = b.date.split("/").map(Number);
        return new Date(yearA, monthA - 1, dayA).getTime() - new Date(yearB, monthB - 1, dayB).getTime();
      });
    }

    return data;
  }, [aggData, scrapedPrices, deviceData]);

  const latestData = chartData && chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const previousData = chartData && chartData.length > 1 ? chartData[chartData.length - 2] : null;

  const priceVariation = useMemo(() => {
    if (!latestData || !previousData) return null;

    // Use avgPrice or fallback
    const currentPrice = latestData.avgPrice;
    const prevPrice = previousData.avgPrice;
    
    if (!prevPrice) return null;

    const variation = ((currentPrice - prevPrice) / prevPrice) * 100;
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
        Preço: ad.extractedPrice || 0,
        Link: ad.productUrl || "",
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

  const handleForceRefresh = async () => {
    if (!brand || !model || !storage) return;
    
    setIsForceRefreshing(true);
    try {
      const url = `${PRICING_API_BASE}/device/refresh`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryId: category,
          manufacturerName: brand,
          modelName: model,
          storage: parseInt(storage, 10),
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao forçar atualização");
      }

      // Refetch data after force refresh
      await refetchSearch();
      await refetchAgg();
      
      toast({
        title: "Atualização concluída",
        description: "Dados atualizados com sucesso!",
      });
    } catch (error) {
      toast({
        title: "Erro na atualização",
        description: "Não foi possível atualizar os dados.",
        variant: "destructive",
      });
    } finally {
      setIsForceRefreshing(false);
    }
  };

  const isLoading = isLoadingAgg || isLoadingSearch || isLoadingPrice;

  console.log("[detalhes] Checking product - brand:", brand, "model:", model, "storage:", storage);
  console.log("[detalhes] !brand:", !brand, "!model:", !model, "!storage:", !storage);

  if (!brand || !model || !storage) {
    console.log("[detalhes] Showing 'Nenhum produto selecionado' message");
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
              onClick={handleForceRefresh}
              disabled={isForceRefreshing || !brand || !model || !storage}
              title="Forçar nova busca (ignora cache de 7 dias)"
              data-testid="button-force-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isForceRefreshing ? "animate-spin" : ""}`} />
              {isForceRefreshing ? "Atualizando..." : "Forçar Atualização"}
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
                  <CardDescription className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline">{categoryName}</Badge>
                    <Badge variant="secondary">{storage}GB</Badge>
                    {deviceData && (
                      <Badge variant={isFromCache ? "secondary" : "default"} className={isFromCache ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}>
                        {isFromCache ? (
                          <>
                            <Clock className="h-3 w-3 mr-1" />
                            Cache ({scrapedAt})
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Atualizado ({scrapedAt})
                          </>
                        )}
                      </Badge>
                    )}
                  </CardDescription>
                </div>
              </div>
              {(latestData || scrapedPrices) && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Preço Médio Atual</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(scrapedPrices?.avg ?? latestData?.avgPrice ?? 0)}
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
          ) : (latestData || scrapedPrices) ? (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-500/10">
                      <DollarSign className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {scrapedPrices ? "Preço Médio (Scraping)" : "Preço Médio"}
                      </p>
                      <p className="text-xl font-bold">
                        {formatCurrency(scrapedPrices?.avg ?? latestData?.avgPrice ?? 0)}
                      </p>
                      {scrapedPrices && (
                        <p className="text-xs text-muted-foreground">{scrapedPrices.count} anúncios</p>
                      )}
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
                      <p className="text-sm text-muted-foreground">
                        {scrapedPrices ? "Preço Mínimo (Scraping)" : "Preço Mínimo"}
                      </p>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(scrapedPrices?.min ?? latestData?.minPrice ?? 0)}
                      </p>
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
                      <p className="text-sm text-muted-foreground">
                        {scrapedPrices ? "Preço Máximo (Scraping)" : "Preço Máximo"}
                      </p>
                      <p className="text-xl font-bold text-red-600">
                        {formatCurrency(scrapedPrices?.max ?? latestData?.maxPrice ?? 0)}
                      </p>
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
                      <p className="text-xl font-bold">{scrapedPrices?.count ?? latestData?.itemsCount ?? 0}</p>
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
                    {discardedAdIds.size > 0 && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {discardedAdIds.size} descartado(s)
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {discardedAdIds.size > 0 && (
                      <Button variant="outline" size="sm" onClick={handleRestoreAll}>
                        <Eye className="h-4 w-4 mr-1" />
                        Restaurar ({discardedAdIds.size})
                      </Button>
                    )}
                    {deviceData?.scrapedAt && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Atualizado: {new Date(deviceData.scrapedAt).toLocaleString("pt-BR")}
                      </span>
                    )}
                  </div>
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
                          <TableHead className="w-20">Imagem</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Preço</TableHead>
                          <TableHead className="w-24 text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shoppingResults.map((ad, idx) => (
                          <TableRow key={ad.id || idx} data-testid={`row-ad-${idx}`} className="h-24">
                            <TableCell className="text-muted-foreground align-middle">{idx + 1}</TableCell>
                            <TableCell className="align-middle">
                              {ad.thumbnail ? (
                                <img
                                  src={ad.thumbnail}
                                  alt={ad.title || "Produto"}
                                  className="w-24 h-24 object-cover rounded border"
                                />
                              ) : (
                                <div className="w-24 h-24 bg-gray-100 rounded border flex items-center justify-center">
                                  <ShoppingCart className="h-8 w-8 text-gray-400" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="align-middle">
                              <div>
                                <p className="font-medium">{ad.source || "Loja"}</p>
                                <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                                  {ad.title}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium align-middle">
                              {ad.extractedPrice ? formatCurrency(ad.extractedPrice) : ad.priceText || "N/A"}
                            </TableCell>
                            <TableCell className="text-right align-middle">
                              <div className="flex items-center justify-end gap-1">
                                {ad.productUrl && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    asChild
                                    data-testid={`button-link-${idx}`}
                                  >
                                    <a href={ad.productUrl} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDiscardAd(ad.id)}
                                  data-testid={`button-discard-${idx}`}
                                  title="Descartar este anúncio"
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
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
