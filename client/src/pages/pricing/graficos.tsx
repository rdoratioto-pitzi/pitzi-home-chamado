import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Download,
  BarChart3,
  LineChartIcon,
  RefreshCw,
} from "lucide-react";
import html2canvas from "html2canvas";

const CATEGORIES = [
  { id: "d7f3dcd8-ddf9-4750-b1f8-c20a5bc9d345", name: "iPhone" },
  { id: "f16906d8-f052-4738-a56e-6b57246436f9", name: "Android" },
];

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

const PERIOD_OPTIONS = [
  { value: "1", label: "1 mês" },
  { value: "3", label: "3 meses" },
  { value: "6", label: "6 meses" },
  { value: "12", label: "12 meses" },
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

export default function GraficosPage() {
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].id);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedStorage, setSelectedStorage] = useState<string>("");
  const [months, setMonths] = useState("6");
  const chartRef = useRef<HTMLDivElement>(null);

  const { data: devicesData, isLoading: isLoadingDevices, refetch } = useQuery<EligibleDevicesResponse>({
    queryKey: ["pricing-devices", selectedCategory],
    queryFn: async () => {
      const response = await fetch(
        `/api/pricing/eligible-devices?categoryId=${selectedCategory}&pageNumber=1&pageSize=500`
      );
      if (!response.ok) throw new Error("Erro ao carregar dispositivos");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const devices = devicesData?.items || [];

  const brands = useMemo(() => {
    return Array.from(new Set(devices.map(d => d.manufacturerName))).sort();
  }, [devices]);

  const models = useMemo(() => {
    if (!selectedBrand) return [];
    return Array.from(new Set(
      devices.filter(d => d.manufacturerName === selectedBrand).map(d => d.modelName)
    )).sort();
  }, [devices, selectedBrand]);

  const storages = useMemo(() => {
    if (!selectedModel) return [];
    return Array.from(new Set(
      devices
        .filter(d => d.manufacturerName === selectedBrand && d.modelName === selectedModel)
        .map(d => d.storage)
    )).sort((a, b) => a - b);
  }, [devices, selectedBrand, selectedModel]);

  const canFetchAgg = !!selectedBrand && !!selectedModel && !!selectedStorage;

  const { data: aggData, isLoading: isLoadingAgg } = useQuery<AggregatedData[]>({
    queryKey: ["pricing-agg", selectedBrand, selectedModel, selectedStorage, months],
    queryFn: async () => {
      const url = `/api/pricing/agg/by-device?manufacturer=${encodeURIComponent(selectedBrand)}&model=${encodeURIComponent(selectedModel)}&storage=${selectedStorage}&months=${months}&page=1&pageSize=1000`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Erro ao carregar dados agregados");
      return response.json();
    },
    enabled: canFetchAgg,
    staleTime: 5 * 60 * 1000,
  });

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

  const handleDownloadChart = async () => {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current, { backgroundColor: "#fff" });
      const link = document.createElement("a");
      link.download = `grafico_${selectedBrand}_${selectedModel}_${selectedStorage}GB.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Error downloading chart:", error);
    }
  };

  const categoryName = CATEGORIES.find(c => c.id === selectedCategory)?.name || "";
  const isLoading = isLoadingDevices || isLoadingAgg;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Gráficos de Preço"
        description="Visualização histórica de preços por dispositivo"
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Selecionar Dispositivo
              </CardTitle>
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
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={selectedCategory}
                  onValueChange={(val) => {
                    setSelectedCategory(val);
                    setSelectedBrand("");
                    setSelectedModel("");
                    setSelectedStorage("");
                  }}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Marca</Label>
                <Select
                  value={selectedBrand || "__none__"}
                  onValueChange={(val) => {
                    setSelectedBrand(val === "__none__" ? "" : val);
                    setSelectedModel("");
                    setSelectedStorage("");
                  }}
                  disabled={isLoadingDevices}
                >
                  <SelectTrigger data-testid="select-brand">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecione...</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Modelo</Label>
                <Select
                  value={selectedModel || "__none__"}
                  onValueChange={(val) => {
                    setSelectedModel(val === "__none__" ? "" : val);
                    setSelectedStorage("");
                  }}
                  disabled={!selectedBrand}
                >
                  <SelectTrigger data-testid="select-model">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecione...</SelectItem>
                    {models.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Capacidade</Label>
                <Select
                  value={selectedStorage || "__none__"}
                  onValueChange={(val) => setSelectedStorage(val === "__none__" ? "" : val)}
                  disabled={!selectedModel}
                >
                  <SelectTrigger data-testid="select-storage">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecione...</SelectItem>
                    {storages.map((storage) => (
                      <SelectItem key={storage} value={storage.toString()}>
                        {storage}GB
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Período</Label>
                <Select value={months} onValueChange={setMonths}>
                  <SelectTrigger data-testid="select-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {!canFetchAgg ? (
          <Card>
            <CardContent className="py-12 text-center">
              <LineChartIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Selecione um dispositivo completo (marca, modelo e capacidade) para visualizar os gráficos de preço.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{categoryName}</Badge>
                <Badge variant="secondary">
                  {selectedBrand} {selectedModel} {selectedStorage}GB
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadChart}
                disabled={chartData.length === 0}
                data-testid="button-download-chart"
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar Gráfico
              </Button>
            </div>

            <div ref={chartRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Evolução de Preços</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingAgg ? (
                    <Skeleton className="h-64" />
                  ) : chartData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Nenhum dado disponível para este período
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorAvgPrice" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis 
                            tickFormatter={(v) => `R$${v}`}
                            className="text-xs"
                            domain={['auto', 'auto']}
                          />
                          <Tooltip 
                            formatter={(value: number) => [formatCurrency(value), ""]}
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
                            fill="url(#colorAvgPrice)"
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
                      Nenhum dado disponível para este período
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip 
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
          </>
        )}
      </div>
    </div>
  );
}
