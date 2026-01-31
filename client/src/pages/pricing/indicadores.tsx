import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
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
import {
  TrendingDown,
  TrendingUp,
  Minus,
  Activity,
  BarChart3,
  RefreshCw,
  ArrowDown,
  ArrowUp,
  ArrowRight,
  Percent,
  Target,
} from "lucide-react";

interface DeflationDevice {
  deviceId: string;
  deviceName: string;
  manufacturerName: string;
  categoryName: string;
  currentPrice: number;
  priceChange30d: number;
  weeklyVariation: number;
}

interface BrandDeflation {
  brand: string;
  avgDeflation: number;
}

interface DeflationData {
  avgMonthlyDeflation: number;
  avgWeeklyVariation: number;
  top10Drops: DeflationDevice[];
  top10Rises: DeflationDevice[];
  deflationByBrand: BrandDeflation[];
  totalDevices: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function TrendIcon({ value }: { value: number }) {
  if (value < -1) {
    return <ArrowDown className="h-4 w-4 text-green-600" />;
  } else if (value > 1) {
    return <ArrowUp className="h-4 w-4 text-red-600" />;
  }
  return <ArrowRight className="h-4 w-4 text-gray-400" />;
}

function TrendBadge({ value, inverted = false }: { value: number; inverted?: boolean }) {
  const isPositive = inverted ? value > 0 : value < 0;
  const isNegative = inverted ? value < 0 : value > 0;
  
  return (
    <Badge 
      variant="outline"
      className={`gap-1 ${
        isPositive ? "border-green-500 text-green-600 bg-green-50 dark:bg-green-950" :
        isNegative ? "border-red-500 text-red-600 bg-red-50 dark:bg-red-950" :
        "border-gray-300 text-gray-500"
      }`}
    >
      <TrendIcon value={value} />
      {formatPercent(value)}
    </Badge>
  );
}

export default function IndicadoresPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("__all__");

  const { data: deflationData, isLoading, refetch } = useQuery<DeflationData>({
    queryKey: ["pricing-deflation"],
    queryFn: async () => {
      const response = await fetch("/api/pricing/analytics/deflation");
      if (!response.ok) throw new Error("Erro ao carregar indicadores");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader
          title="Indicadores de Deflação"
          description="Métricas e tendências de preços do mercado"
        />
        <main className="flex-1 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-[120px]" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[400px]" />
            <Skeleton className="h-[400px]" />
          </div>
        </main>
      </div>
    );
  }

  const {
    avgMonthlyDeflation = 0,
    avgWeeklyVariation = 0,
    top10Drops = [],
    top10Rises = [],
    deflationByBrand = [],
    totalDevices = 0,
  } = deflationData || {};

  const maxDeflation = Math.max(
    ...deflationByBrand.map(b => Math.abs(b.avgDeflation)),
    10
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Indicadores de Deflação"
        description="Métricas e tendências de preços do mercado"
      />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]" data-testid="select-category-filter">
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as categorias</SelectItem>
                <SelectItem value="iphone">iPhone</SelectItem>
                <SelectItem value="smartphone">Smartphone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-indicators">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Deflação Média Mensal
              </CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">
                  {formatPercent(avgMonthlyDeflation)}
                </span>
                <TrendIcon value={avgMonthlyDeflation} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Variação média nos últimos 30 dias
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Variação Semanal
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">
                  {formatPercent(avgWeeklyVariation)}
                </span>
                <TrendIcon value={avgWeeklyVariation} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Variação média nos últimos 7 dias
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Dispositivos Monitorados
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDevices}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Total de dispositivos ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Marcas Analisadas
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{deflationByBrand.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Fabricantes com dados
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" />
              Deflação Média por Marca
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {deflationByBrand.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum dado disponível
                </p>
              ) : (
                deflationByBrand.map((brand) => (
                  <div key={brand.brand} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{brand.brand}</span>
                      <TrendBadge value={brand.avgDeflation} />
                    </div>
                    <Progress 
                      value={Math.min(Math.abs(brand.avgDeflation) / maxDeflation * 100, 100)} 
                      className={`h-2 ${brand.avgDeflation < 0 ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500"}`}
                    />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-green-600" />
                Top 10 Maiores Quedas (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {top10Drops.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum dado disponível
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dispositivo</TableHead>
                      <TableHead className="text-right">Preço Atual</TableHead>
                      <TableHead className="text-right">Variação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {top10Drops.map((device, index) => (
                      <TableRow key={device.deviceId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0 text-xs">
                              {index + 1}
                            </Badge>
                            <div>
                              <div className="font-medium">{device.deviceName}</div>
                              <div className="text-xs text-muted-foreground">{device.categoryName}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(device.currentPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          <TrendBadge value={device.priceChange30d} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-red-600" />
                Top 10 Maiores Altas (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {top10Rises.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum dado disponível
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dispositivo</TableHead>
                      <TableHead className="text-right">Preço Atual</TableHead>
                      <TableHead className="text-right">Variação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {top10Rises.map((device, index) => (
                      <TableRow key={device.deviceId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0 text-xs">
                              {index + 1}
                            </Badge>
                            <div>
                              <div className="font-medium">{device.deviceName}</div>
                              <div className="text-xs text-muted-foreground">{device.categoryName}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(device.currentPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          <TrendBadge value={device.priceChange30d} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
