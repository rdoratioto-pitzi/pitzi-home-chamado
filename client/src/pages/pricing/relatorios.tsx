import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import {
  FileSpreadsheet,
  Download,
  RefreshCw,
  ArrowLeft,
  TrendingDown,
  TrendingUp,
  Minus,
  BarChart3,
  Calendar,
  Smartphone,
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

interface EligibleDevice {
  categoryId: string;
  manufacturerName: string;
  modelName: string;
  storage: number;
}

interface EligibleDevicesResponse {
  items: EligibleDevice[];
  currentPage: number;
  hasNextPage: boolean;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

export default function PricingReportsPage() {
  const [location] = useLocation();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].id);
  const [months, setMonths] = useState("12");
  const [isExporting, setIsExporting] = useState(false);

  const params = new URLSearchParams(location.split("?")[1] || "");
  const devicesParam = params.get("devices") || "";
  const selectedDeviceKeys = devicesParam ? devicesParam.split(",") : [];

  const { data: devicesData, isLoading: isLoadingDevices, refetch } = useQuery<EligibleDevicesResponse>({
    queryKey: ["pricing-devices", selectedCategory],
    queryFn: async () => {
      const response = await fetch(
        `${RENOVSMART_API_BASE}/eligible-devices?categoryId=${selectedCategory}&pageNumber=1&pageSize=500`
      );
      if (!response.ok) throw new Error("Erro ao carregar dispositivos");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const selectedDevices = useMemo(() => {
    if (!devicesData?.items || selectedDeviceKeys.length === 0) return [];
    return selectedDeviceKeys.map((key) => {
      const [brand, model, storage] = key.split("-");
      return { brand, model: model?.replace(/_/g, " ") || "", storage: parseInt(storage) || 0 };
    }).filter(d => d.brand && d.model && d.storage);
  }, [devicesData, selectedDeviceKeys]);

  const { data: comparisonData, isLoading: isLoadingComparison } = useQuery<Record<string, AggregatedData[]>>({
    queryKey: ["pricing-comparison", selectedDevices, months],
    queryFn: async () => {
      if (selectedDevices.length === 0) return {};
      
      const results: Record<string, AggregatedData[]> = {};
      
      await Promise.all(
        selectedDevices.map(async (device) => {
          try {
            const url = `${RENOVSMART_API_BASE}/agg/by-device?manufacturer=${encodeURIComponent(device.brand)}&model=${encodeURIComponent(device.model)}&storage=${device.storage}&months=${months}&page=1&pageSize=1000`;
            const response = await fetch(url);
            if (response.ok) {
              const data = await response.json();
              const key = `${device.brand} ${device.model} ${device.storage}GB`;
              results[key] = data;
            }
          } catch (error) {
            console.error(`Error fetching data for ${device.brand} ${device.model}:`, error);
          }
        })
      );
      
      return results;
    },
    enabled: selectedDevices.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const chartData = useMemo(() => {
    if (!comparisonData || Object.keys(comparisonData).length === 0) return [];
    
    const allDates = new Set<string>();
    Object.values(comparisonData).forEach((deviceData) => {
      deviceData.forEach((item) => {
        allDates.add(new Date(item.updatedAt).toLocaleDateString("pt-BR"));
      });
    });
    
    const sortedDates = Array.from(allDates).sort((a, b) => {
      const [dayA, monthA, yearA] = a.split("/").map(Number);
      const [dayB, monthB, yearB] = b.split("/").map(Number);
      return new Date(yearA, monthA - 1, dayA).getTime() - new Date(yearB, monthB - 1, dayB).getTime();
    });
    
    return sortedDates.map((date) => {
      const point: Record<string, any> = { date };
      Object.entries(comparisonData).forEach(([deviceName, deviceData]) => {
        const dataPoint = deviceData.find(
          (d) => new Date(d.updatedAt).toLocaleDateString("pt-BR") === date
        );
        point[deviceName] = dataPoint ? Number(dataPoint.avgPrice.toFixed(2)) : null;
      });
      return point;
    });
  }, [comparisonData]);

  const summaryData = useMemo(() => {
    if (!comparisonData) return [];
    
    return Object.entries(comparisonData).map(([deviceName, data]) => {
      if (data.length === 0) return null;
      
      const latest = data[data.length - 1];
      const previous = data.length > 1 ? data[data.length - 2] : null;
      const variation = previous 
        ? ((latest.avgPrice - previous.avgPrice) / previous.avgPrice) * 100 
        : 0;
      
      return {
        name: deviceName,
        avgPrice: latest.avgPrice,
        minPrice: latest.minPrice,
        maxPrice: latest.maxPrice,
        itemsCount: latest.itemsCount,
        variation,
        updatedAt: latest.updatedAt,
      };
    }).filter(Boolean);
  }, [comparisonData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const summarySheet = summaryData.map((d: any) => ({
        Dispositivo: d.name,
        "Preço Médio": d.avgPrice,
        "Preço Mínimo": d.minPrice,
        "Preço Máximo": d.maxPrice,
        "Variação %": d.variation.toFixed(2),
        Ofertas: d.itemsCount,
        "Última Atualização": new Date(d.updatedAt).toLocaleDateString("pt-BR"),
      }));

      const historySheet = chartData.map((d: any) => {
        const row: Record<string, any> = { Data: d.date };
        Object.keys(d).forEach((key) => {
          if (key !== "date") {
            row[key] = d[key];
          }
        });
        return row;
      });

      const wb = XLSX.utils.book_new();
      
      const wsSummary = XLSX.utils.json_to_sheet(summarySheet);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");
      
      const wsHistory = XLSX.utils.json_to_sheet(historySheet);
      XLSX.utils.book_append_sheet(wb, wsHistory, "Histórico");

      const filename = `pricing_relatorio_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast({
        title: "Relatório exportado",
        description: `Arquivo ${filename} baixado com sucesso.`,
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Não foi possível gerar o relatório.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = isLoadingDevices || isLoadingComparison;
  const deviceNames = Object.keys(comparisonData || {});

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Relatórios"
        description="Comparação e exportação de dados de precificação"
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link href="/pricing/analise">
            <Button variant="outline" size="sm" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Análise de Produtos
            </Button>
          </Link>
          <div className="flex items-center gap-2">
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button
              size="sm"
              onClick={handleExportExcel}
              disabled={isExporting || summaryData.length === 0}
              data-testid="button-export"
            >
              <Download className={`h-4 w-4 mr-2 ${isExporting ? "animate-spin" : ""}`} />
              Exportar Excel
            </Button>
          </div>
        </div>

        {selectedDevices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">
                Nenhum dispositivo selecionado para comparação.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Vá para "Análise de Produtos", selecione dispositivos e clique em "Comparar Selecionados".
              </p>
              <Link href="/pricing/analise">
                <Button data-testid="button-go-analysis">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Ir para Análise
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Dispositivos Comparados ({selectedDevices.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {selectedDevices.map((device, idx) => (
                    <Badge 
                      key={idx} 
                      variant="secondary"
                      style={{ borderLeftColor: CHART_COLORS[idx % CHART_COLORS.length], borderLeftWidth: 4 }}
                    >
                      {device.brand} {device.model} {device.storage}GB
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Comparação de Preços</CardTitle>
                <CardDescription>Evolução do preço médio dos dispositivos selecionados</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-80" />
                ) : chartData.length === 0 ? (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    Sem dados disponíveis para comparação
                  </div>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
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
                        {deviceNames.map((name, idx) => (
                          <Line
                            key={name}
                            type="monotone"
                            dataKey={name}
                            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumo Comparativo</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : summaryData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Sem dados para exibir
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dispositivo</TableHead>
                          <TableHead className="text-right">Preço Médio</TableHead>
                          <TableHead className="text-right">Mínimo</TableHead>
                          <TableHead className="text-right">Máximo</TableHead>
                          <TableHead className="text-right">Variação</TableHead>
                          <TableHead className="text-right">Ofertas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summaryData.map((row: any, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                                />
                                {row.name}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(row.avgPrice)}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {formatCurrency(row.minPrice)}
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                              {formatCurrency(row.maxPrice)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className={`flex items-center justify-end gap-1 ${
                                row.variation < 0 ? "text-green-600" : 
                                row.variation > 0 ? "text-red-600" : "text-muted-foreground"
                              }`}>
                                {row.variation < 0 ? (
                                  <TrendingDown className="h-4 w-4" />
                                ) : row.variation > 0 ? (
                                  <TrendingUp className="h-4 w-4" />
                                ) : (
                                  <Minus className="h-4 w-4" />
                                )}
                                <span>{row.variation.toFixed(2)}%</span>
                              </div>
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
          </>
        )}
      </div>
    </div>
  );
}
