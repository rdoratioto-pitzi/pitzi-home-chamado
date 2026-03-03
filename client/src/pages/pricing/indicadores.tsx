import { useState, useMemo } from "react";
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
  Smartphone,
  Info,
} from "lucide-react";
import { Link } from "wouter";

const CATEGORIES = [
  { id: "d7f3dcd8-ddf9-4750-b1f8-c20a5bc9d345", name: "iPhone" },
  { id: "d686a25d-045d-4b8c-9d7c-35a21d29d31b", name: "Android" },
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function IndicadoresPage() {
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].id);

  const { data: devicesData, isLoading, refetch } = useQuery<EligibleDevicesResponse>({
    queryKey: ["pricing-devices", selectedCategory],
    queryFn: async () => {
      let allItems: EligibleDevice[] = [];
      let currentPage = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        const response = await fetch(
          `/api/pricing/eligible-devices?categoryId=${selectedCategory}&pageNumber=${currentPage}&pageSize=200`
        );
        if (!response.ok) throw new Error("Erro ao carregar dispositivos");
        
        const data = await response.json();
        allItems = [...allItems, ...data.items];

        hasNextPage = data.hasNextPage;
        currentPage++;
      }

      return { items: allItems, currentPage: 1, hasNextPage: false };
    },
    staleTime: 5 * 60 * 1000,
  });

  const devices = devicesData?.items || [];

  const brandStats = useMemo(() => {
    const stats: Record<string, { count: number; storages: Set<number>; models: Set<string> }> = {};
    devices.forEach((d) => {
      if (!stats[d.manufacturerName]) {
        stats[d.manufacturerName] = { count: 0, storages: new Set(), models: new Set() };
      }
      stats[d.manufacturerName].count++;
      stats[d.manufacturerName].storages.add(d.storage);
      stats[d.manufacturerName].models.add(d.modelName);
    });
    return Object.entries(stats)
      .map(([brand, data]) => ({
        brand,
        variants: data.count,
        models: data.models.size,
        storages: data.storages.size,
      }))
      .sort((a, b) => b.variants - a.variants);
  }, [devices]);

  const storageStats = useMemo(() => {
    const stats: Record<number, number> = {};
    devices.forEach((d) => {
      stats[d.storage] = (stats[d.storage] || 0) + 1;
    });
    return Object.entries(stats)
      .map(([storage, count]) => ({
        storage: parseInt(storage),
        count,
        percentage: devices.length > 0 ? ((count / devices.length) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => a.storage - b.storage);
  }, [devices]);

  const categoryName = CATEGORIES.find((c) => c.id === selectedCategory)?.name || "";

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Indicadores"
        description="Análise de distribuição de dispositivos monitorados"
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48" data-testid="select-category">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Smartphone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Variantes</p>
                  <p className="text-2xl font-bold">{devices.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <BarChart3 className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Marcas</p>
                  <p className="text-2xl font-bold">{brandStats.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <Activity className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Modelos Únicos</p>
                  <p className="text-2xl font-bold">
                    {new Set(devices.map((d) => `${d.manufacturerName} ${d.modelName}`)).size}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-500/10">
                  <Info className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Capacidades</p>
                  <p className="text-2xl font-bold">{storageStats.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Dispositivos por Marca - {categoryName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : brandStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum dado disponível
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marca</TableHead>
                        <TableHead className="text-right">Modelos</TableHead>
                        <TableHead className="text-right">Variantes</TableHead>
                        <TableHead className="text-right">Capacidades</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brandStats.map((stat) => (
                        <TableRow key={stat.brand}>
                          <TableCell className="font-medium">{stat.brand}</TableCell>
                          <TableCell className="text-right">{stat.models}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{stat.variants}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{stat.storages}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Distribuição por Capacidade - {categoryName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : storageStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum dado disponível
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Capacidade</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead className="text-right">Percentual</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {storageStats.map((stat) => (
                        <TableRow key={stat.storage}>
                          <TableCell className="font-medium">{stat.storage}GB</TableCell>
                          <TableCell className="text-right">{stat.count}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{stat.percentage}%</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center gap-4">
              <Info className="h-10 w-10 text-muted-foreground" />
              <div className="max-w-md">
                <h3 className="font-semibold mb-2">Indicadores de Deflação</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Para análise de deflação e variação de preços, acesse os detalhes de um dispositivo específico.
                  Os dados históricos de preços são obtidos diretamente da API RenovSmart.
                </p>
                <Link href="/pricing">
                  <Button data-testid="button-go-pricing">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Ver Dispositivos
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
