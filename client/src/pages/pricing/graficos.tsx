import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingDown,
  TrendingUp,
  Minus,
  Download,
  BarChart3,
  LineChartIcon,
  TableIcon,
  RefreshCw,
} from "lucide-react";
import html2canvas from "html2canvas";

interface PricingDevice {
  id: string;
  categoryId: string;
  categoryName: string;
  manufacturerName: string;
  modelName: string;
  storage: number;
  condition: string;
  specs: string | null;
  imageUrl: string | null;
  releaseDate: string | null;
  isActive: boolean;
}

interface PriceHistory {
  id: string;
  deviceId: string;
  date: string;
  minPrice: string;
  avgPrice: string;
  maxPrice: string;
  sampleCount: number;
}

const PERIOD_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "365", label: "12 meses" },
];

const AGGREGATION_OPTIONS = [
  { value: "device", label: "Por Dispositivo" },
  { value: "brand", label: "Por Marca" },
  { value: "category", label: "Por Categoria" },
  { value: "storage", label: "Por Capacidade" },
];

const COLORS = [
  "#00A137", "#3B82F6", "#EF4444", "#F59E0B", "#8B5CF6", 
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#10B981"
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export default function GraficosPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("30");
  const [selectedAggregation, setSelectedAggregation] = useState("device");
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);

  const { data: devices = [], isLoading: isLoadingDevices, refetch } = useQuery<PricingDevice[]>({
    queryKey: ["pricing-local-devices"],
    queryFn: async () => {
      const response = await fetch("/api/pricing/devices");
      if (!response.ok) throw new Error("Erro ao carregar dispositivos");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const deviceHistoryQueries = useQuery({
    queryKey: ["pricing-all-history", devices.map(d => d.id)],
    queryFn: async () => {
      const allHistory: Record<string, PriceHistory[]> = {};
      for (const device of devices) {
        const response = await fetch(`/api/pricing/devices/${device.id}/history`);
        if (response.ok) {
          allHistory[device.id] = await response.json();
        }
      }
      return allHistory;
    },
    enabled: devices.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const allHistory = deviceHistoryQueries.data || {};

  const filteredData = useMemo(() => {
    const now = new Date();
    const periodDays = parseInt(selectedPeriod);
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    const activeDevices = selectedDevices.length > 0 
      ? devices.filter(d => selectedDevices.includes(d.id))
      : devices;

    const dateMap: Record<string, Record<string, number>> = {};

    for (const device of activeDevices) {
      const history = allHistory[device.id] || [];
      const filtered = history.filter(h => new Date(h.date) >= cutoffDate);
      
      for (const entry of filtered) {
        const dateKey = formatDate(entry.date);
        if (!dateMap[dateKey]) dateMap[dateKey] = {};
        
        const deviceKey = `${device.manufacturerName} ${device.modelName} ${device.storage}GB`;
        dateMap[dateKey][deviceKey] = parseFloat(entry.avgPrice || "0");
      }
    }

    return Object.entries(dateMap)
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => {
        const [dayA, monthA] = a.date.split("/").map(Number);
        const [dayB, monthB] = b.date.split("/").map(Number);
        return monthA - monthB || dayA - dayB;
      });
  }, [devices, allHistory, selectedPeriod, selectedDevices]);

  const aggregatedData = useMemo(() => {
    if (selectedAggregation === "device") return null;

    const now = new Date();
    const periodDays = parseInt(selectedPeriod);
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    const groups: Record<string, { prices: number[]; name: string }> = {};

    for (const device of devices) {
      let groupKey: string;
      let groupName: string;
      
      switch (selectedAggregation) {
        case "brand":
          groupKey = device.manufacturerName;
          groupName = device.manufacturerName;
          break;
        case "category":
          groupKey = device.categoryName;
          groupName = device.categoryName;
          break;
        case "storage":
          groupKey = `${device.storage}GB`;
          groupName = `${device.storage}GB`;
          break;
        default:
          groupKey = device.id;
          groupName = `${device.manufacturerName} ${device.modelName}`;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = { prices: [], name: groupName };
      }

      const history = allHistory[device.id] || [];
      const filtered = history.filter(h => new Date(h.date) >= cutoffDate);
      
      for (const entry of filtered) {
        groups[groupKey].prices.push(parseFloat(entry.avgPrice || "0"));
      }
    }

    return Object.entries(groups).map(([key, data]) => ({
      name: data.name,
      avgPrice: data.prices.length > 0 
        ? data.prices.reduce((a, b) => a + b, 0) / data.prices.length 
        : 0,
      minPrice: data.prices.length > 0 ? Math.min(...data.prices) : 0,
      maxPrice: data.prices.length > 0 ? Math.max(...data.prices) : 0,
    }));
  }, [devices, allHistory, selectedPeriod, selectedAggregation]);

  const tableData = useMemo(() => {
    const now = new Date();
    const periodDays = parseInt(selectedPeriod);
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    return devices.map(device => {
      const history = allHistory[device.id] || [];
      const filtered = history
        .filter(h => new Date(h.date) >= cutoffDate)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const latestPrice = filtered.length > 0 ? parseFloat(filtered[0].avgPrice || "0") : 0;
      const oldestPrice = filtered.length > 1 ? parseFloat(filtered[filtered.length - 1].avgPrice || "0") : latestPrice;
      const priceChange = oldestPrice > 0 ? ((latestPrice - oldestPrice) / oldestPrice) * 100 : 0;
      const avgPrice = filtered.length > 0 
        ? filtered.reduce((acc, h) => acc + parseFloat(h.avgPrice || "0"), 0) / filtered.length 
        : 0;

      return {
        id: device.id,
        name: `${device.manufacturerName} ${device.modelName}`,
        storage: device.storage,
        category: device.categoryName,
        brand: device.manufacturerName,
        latestPrice,
        avgPrice,
        minPrice: filtered.length > 0 ? Math.min(...filtered.map(h => parseFloat(h.minPrice || "0"))) : 0,
        maxPrice: filtered.length > 0 ? Math.max(...filtered.map(h => parseFloat(h.maxPrice || "0"))) : 0,
        priceChange,
        samples: filtered.reduce((acc, h) => acc + (h.sampleCount || 0), 0),
      };
    });
  }, [devices, allHistory, selectedPeriod]);

  const deviceNames = useMemo(() => {
    return devices.map(d => `${d.manufacturerName} ${d.modelName} ${d.storage}GB`);
  }, [devices]);

  const handleDownloadChart = async () => {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current);
      const link = document.createElement("a");
      link.download = `pricing-chart-${new Date().toISOString().split("T")[0]}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error("Error downloading chart:", error);
    }
  };

  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDevices(prev => 
      prev.includes(deviceId) 
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  if (isLoadingDevices) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader
          title="Gráficos Evolutivos"
          description="Visualização temporal de preços e tendências"
        />
        <main className="flex-1 p-6">
          <Skeleton className="h-[500px] w-full" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Gráficos Evolutivos"
        description="Visualização temporal de preços e tendências"
      />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Filtros
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-charts">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Período</label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-[150px]" data-testid="select-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Agregação</label>
                <Select value={selectedAggregation} onValueChange={setSelectedAggregation}>
                  <SelectTrigger className="w-[180px]" data-testid="select-aggregation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGGREGATION_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex-1">
                <label className="text-sm font-medium">Dispositivos</label>
                <div className="flex flex-wrap gap-2">
                  {devices.map(device => (
                    <Badge
                      key={device.id}
                      variant={selectedDevices.includes(device.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleDeviceSelection(device.id)}
                      data-testid={`badge-device-${device.id}`}
                    >
                      {device.manufacturerName} {device.modelName} {device.storage}GB
                    </Badge>
                  ))}
                  {selectedDevices.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedDevices([])}
                      data-testid="button-clear-selection"
                    >
                      Limpar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="line" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="line" className="gap-2" data-testid="tab-line-chart">
                <LineChartIcon className="h-4 w-4" />
                Linha
              </TabsTrigger>
              <TabsTrigger value="bar" className="gap-2" data-testid="tab-bar-chart">
                <BarChart3 className="h-4 w-4" />
                Barras
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-2" data-testid="tab-table">
                <TableIcon className="h-4 w-4" />
                Tabela
              </TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" onClick={handleDownloadChart} data-testid="button-download-chart">
              <Download className="h-4 w-4 mr-2" />
              Baixar Gráfico
            </Button>
          </div>

          <TabsContent value="line">
            <Card ref={chartRef}>
              <CardHeader>
                <CardTitle>Evolução Temporal de Preços</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredData.length === 0 ? (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    Nenhum dado disponível para o período selecionado
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={filteredData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis 
                        tickFormatter={(value) => formatCurrency(value).replace("R$", "")}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => `Data: ${label}`}
                      />
                      <Legend />
                      {deviceNames.map((name, index) => (
                        <Area
                          key={name}
                          type="monotone"
                          dataKey={name}
                          stroke={COLORS[index % COLORS.length]}
                          fill={COLORS[index % COLORS.length]}
                          fillOpacity={0.3}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bar">
            <Card ref={chartRef}>
              <CardHeader>
                <CardTitle>
                  Comparação {selectedAggregation === "device" ? "por Modelo" : 
                    selectedAggregation === "brand" ? "por Marca" :
                    selectedAggregation === "category" ? "por Categoria" : "por Capacidade"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(aggregatedData || tableData).length === 0 ? (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={aggregatedData || tableData.map(d => ({
                      name: `${d.name} ${d.storage}GB`,
                      avgPrice: d.avgPrice,
                      minPrice: d.minPrice,
                      maxPrice: d.maxPrice,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis tickFormatter={(value) => formatCurrency(value).replace("R$", "")} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="minPrice" name="Mínimo" fill="#10B981" />
                      <Bar dataKey="avgPrice" name="Médio" fill="#3B82F6" />
                      <Bar dataKey="maxPrice" name="Máximo" fill="#EF4444" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="table">
            <Card>
              <CardHeader>
                <CardTitle>Tabela de Dados Completa</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dispositivo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Capacidade</TableHead>
                      <TableHead className="text-right">Preço Atual</TableHead>
                      <TableHead className="text-right">Preço Médio</TableHead>
                      <TableHead className="text-right">Mínimo</TableHead>
                      <TableHead className="text-right">Máximo</TableHead>
                      <TableHead className="text-right">Variação</TableHead>
                      <TableHead className="text-right">Amostras</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{row.category}</TableCell>
                        <TableCell>{row.storage}GB</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.latestPrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.avgPrice)}</TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(row.minPrice)}</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(row.maxPrice)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {row.priceChange < -1 ? (
                              <TrendingDown className="h-4 w-4 text-green-600" />
                            ) : row.priceChange > 1 ? (
                              <TrendingUp className="h-4 w-4 text-red-600" />
                            ) : (
                              <Minus className="h-4 w-4 text-gray-400" />
                            )}
                            <span className={
                              row.priceChange < -1 ? "text-green-600" :
                              row.priceChange > 1 ? "text-red-600" : "text-gray-500"
                            }>
                              {row.priceChange.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{row.samples}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
