import { useState, useMemo, useEffect } from "react";
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
import { usePricingCategories } from "@/hooks/use-pricing-categories";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bell,
  BellRing,
  RefreshCw,
  Smartphone,
  Info,
  BarChart3,
  Eye,
} from "lucide-react";
import { Link, useLocation } from "wouter";

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

export default function AlertasPage() {
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const { data: categoriesData } = usePricingCategories();

  // Set default category once categories are loaded
  useEffect(() => {
    if (categoriesData && categoriesData.length > 0 && !selectedCategory) {
      setSelectedCategory(categoriesData[0].id);
    }
  }, [categoriesData, selectedCategory]);

  const { data: devicesData, isLoading, refetch } = useQuery<EligibleDevicesResponse>({
    queryKey: ["pricing-devices", selectedCategory],
    queryFn: async () => {
      const response = await fetch(
        `/api/pricing/eligible-devices?categoryId=${selectedCategory}&pageNumber=1&pageSize=200`
      );
      if (!response.ok) throw new Error("Erro ao carregar dispositivos");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const devices = devicesData?.items || [];

  const brands = useMemo(() => {
    return Array.from(new Set(devices.map((d) => d.manufacturerName))).sort();
  }, [devices]);

  const filteredDevices = useMemo(() => {
    if (!selectedBrand) return devices;
    return devices.filter((d) => d.manufacturerName === selectedBrand);
  }, [devices, selectedBrand]);

  const groupedDevices = useMemo(() => {
    const groups: Record<string, EligibleDevice[]> = {};
    filteredDevices.forEach((d) => {
      const key = `${d.manufacturerName} ${d.modelName}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 30);
  }, [filteredDevices]);

  const handleViewDevice = (device: EligibleDevice) => {
    const params = new URLSearchParams({
      category: selectedCategory,
      brand: device.manufacturerName,
      model: device.modelName,
      storage: device.storage.toString(),
    });
    setLocation(`/pricing/detalhes?${params.toString()}`);
  };

  const categoryName = categoriesData?.find((c) => c.id === selectedCategory)?.name || "";

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Monitoramento de Preços"
        description="Acompanhe dispositivos específicos para análise de preços"
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Filtros
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={selectedCategory}
                  onValueChange={(val) => {
                    setSelectedCategory(val);
                    setSelectedBrand("");
                  }}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriesData?.map((cat) => (
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
                  value={selectedBrand || "__all__"}
                  onValueChange={(val) => setSelectedBrand(val === "__all__" ? "" : val)}
                  disabled={isLoading}
                >
                  <SelectTrigger data-testid="select-brand">
                    <SelectValue placeholder="Todas as marcas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as marcas</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Dispositivos para Monitorar - {categoryName}
              </CardTitle>
              <Badge variant="secondary">{filteredDevices.length} variantes</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : groupedDevices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Smartphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum dispositivo encontrado.</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dispositivo</TableHead>
                      <TableHead>Capacidades</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedDevices.map(([name, variants]) => (
                      <TableRow key={name}>
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {variants
                              .sort((a, b) => a.storage - b.storage)
                              .map((v) => (
                                <Badge
                                  key={v.storage}
                                  variant="secondary"
                                  className="cursor-pointer"
                                  onClick={() => handleViewDevice(v)}
                                  data-testid={`badge-storage-${v.storage}`}
                                >
                                  {v.storage}GB
                                </Badge>
                              ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDevice(variants[0])}
                            data-testid={`button-view-${name.replace(/\s+/g, "-").toLowerCase()}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {groupedDevices.length > 0 && groupedDevices.length < filteredDevices.length && (
              <p className="text-sm text-muted-foreground text-center mt-4">
                Exibindo {groupedDevices.length} de {Object.keys(
                  filteredDevices.reduce((acc, d) => {
                    acc[`${d.manufacturerName} ${d.modelName}`] = true;
                    return acc;
                  }, {} as Record<string, boolean>)
                ).length} modelos
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center gap-4">
              <BellRing className="h-10 w-10 text-muted-foreground" />
              <div className="max-w-md">
                <h3 className="font-semibold mb-2">Alertas de Preço</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Para acompanhar a variação de preços de um dispositivo específico, acesse os detalhes do produto.
                  Os dados são atualizados automaticamente via API RenovSmart.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Link href="/pricing">
                    <Button variant="outline" data-testid="button-go-overview">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Visão Geral
                    </Button>
                  </Link>
                  <Link href="/pricing/analise">
                    <Button data-testid="button-go-analysis">
                      <Smartphone className="h-4 w-4 mr-2" />
                      Análise de Produtos
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
