import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingDown,
  TrendingUp,
  Smartphone,
  Activity,
  Bell,
  RefreshCw,
  DollarSign,
  Package,
  BarChart3,
} from "lucide-react";
import { Link } from "wouter";

interface PricingDevice {
  id: string;
  categoryName: string;
  manufacturerName: string;
  modelName: string;
  storage: number;
  isActive: boolean;
}

interface PriceHistory {
  id: string;
  date: string;
  avgPrice: string;
}

interface DeflationData {
  avgMonthlyDeflation: number;
  avgWeeklyVariation: number;
  totalDevices: number;
  deflationByBrand: { brand: string; avgDeflation: number }[];
}

interface PricingAlert {
  id: string;
  isActive: boolean;
}

const COLORS = ["#00A137", "#3B82F6", "#F59E0B", "#EC4899", "#8B5CF6"];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export default function DashboardPage() {
  const { data: devices = [], isLoading: loadingDevices, refetch } = useQuery<PricingDevice[]>({
    queryKey: ["pricing-local-devices"],
    queryFn: async () => {
      const response = await fetch("/api/pricing/devices");
      if (!response.ok) throw new Error("Erro ao carregar dispositivos");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: deflationData, isLoading: loadingDeflation } = useQuery<DeflationData>({
    queryKey: ["pricing-deflation"],
    queryFn: async () => {
      const response = await fetch("/api/pricing/analytics/deflation");
      if (!response.ok) throw new Error("Erro ao carregar indicadores");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: alerts = [], isLoading: loadingAlerts } = useQuery<PricingAlert[]>({
    queryKey: ["pricing-alerts"],
    queryFn: async () => {
      const response = await fetch("/api/pricing/alerts");
      if (!response.ok) throw new Error("Erro ao carregar alertas");
      return response.json();
    },
    staleTime: 60 * 1000,
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

  const isLoading = loadingDevices || loadingDeflation || loadingAlerts;

  const categoryData = devices.reduce((acc, device) => {
    const cat = device.categoryName || "Outros";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(categoryData).map(([name, value]) => ({
    name,
    value,
  }));

  const brandData = devices.reduce((acc, device) => {
    const brand = device.manufacturerName;
    acc[brand] = (acc[brand] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const barData = Object.entries(brandData).map(([name, count]) => ({
    name,
    count,
  }));

  const recentHistory = deviceHistoryQueries.data
    ? Object.values(deviceHistoryQueries.data)
        .flat()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 30)
    : [];

  const avgPriceByDay = recentHistory.reduce((acc, h) => {
    const dateKey = new Date(h.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    if (!acc[dateKey]) {
      acc[dateKey] = { prices: [], date: dateKey };
    }
    acc[dateKey].prices.push(parseFloat(h.avgPrice || "0"));
    return acc;
  }, {} as Record<string, { prices: number[]; date: string }>);

  const lineData = Object.values(avgPriceByDay)
    .map(d => ({
      date: d.date,
      price: d.prices.reduce((a, b) => a + b, 0) / d.prices.length,
    }))
    .reverse()
    .slice(-14);

  const totalValue = devices.length > 0 && recentHistory.length > 0
    ? recentHistory.slice(0, devices.length).reduce((acc, h) => acc + parseFloat(h.avgPrice || "0"), 0)
    : 0;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader
          title="Dashboard Executivo"
          description="Visão geral do módulo de Pricing"
        />
        <main className="flex-1 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-[120px]" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  const activeAlerts = alerts.filter(a => a.isActive).length;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Dashboard Executivo"
        description="Visão geral do módulo de Pricing"
      />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Resumo</h2>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-dashboard">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Dispositivos Monitorados
              </CardTitle>
              <Smartphone className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{devices.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Total de dispositivos ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Deflação Mensal
              </CardTitle>
              {deflationData?.avgMonthlyDeflation && deflationData.avgMonthlyDeflation < 0 ? (
                <TrendingDown className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingUp className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                (deflationData?.avgMonthlyDeflation || 0) < 0 ? "text-green-600" : "text-red-600"
              }`}>
                {formatPercent(deflationData?.avgMonthlyDeflation || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Variação média de preços
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Alertas Ativos
              </CardTitle>
              <Bell className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeAlerts}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Monitorando variações
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Valor Total Estimado
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Soma de preços médios
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Evolução de Preços (14 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lineData.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Sem dados disponíveis
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(v) => formatCurrency(v).replace("R$", "")} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Line type="monotone" dataKey="price" stroke="#00A137" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Dispositivos por Marca
              </CardTitle>
            </CardHeader>
            <CardContent>
              {barData.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Sem dados disponíveis
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#00A137" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Distribuição por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Sem dados disponíveis
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {pieData.map((entry, index) => (
                  <Badge key={entry.name} variant="outline" className="gap-1">
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    {entry.name}: {entry.value}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-green-600" />
                Deflação por Marca
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!deflationData?.deflationByBrand || deflationData.deflationByBrand.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Sem dados disponíveis
                </div>
              ) : (
                <div className="space-y-3">
                  {deflationData.deflationByBrand.map(brand => (
                    <div key={brand.brand} className="flex items-center justify-between">
                      <span className="font-medium">{brand.brand}</span>
                      <Badge variant={brand.avgDeflation < 0 ? "default" : "destructive"}>
                        {brand.avgDeflation < 0 ? (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        )}
                        {formatPercent(brand.avgDeflation)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-4">
          <Link href="/pricing/analise">
            <Button variant="outline" data-testid="link-analysis">
              Análise de Produtos
            </Button>
          </Link>
          <Link href="/pricing/graficos">
            <Button variant="outline" data-testid="link-charts">
              Gráficos Evolutivos
            </Button>
          </Link>
          <Link href="/pricing/indicadores">
            <Button variant="outline" data-testid="link-indicators">
              Indicadores de Deflação
            </Button>
          </Link>
          <Link href="/pricing/alertas">
            <Button variant="outline" data-testid="link-alerts">
              Alertas de Preço
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
