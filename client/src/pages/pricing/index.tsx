import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/page-header";
import {
  DollarSign,
  Search,
  Filter,
  X,
  TrendingDown,
  TrendingUp,
  Smartphone,
  RefreshCw,
  ExternalLink,
  BarChart3,
} from "lucide-react";

const RENOVSMART_API_BASE = "https://rp.renovsmart.com.br/api";

const CATEGORIES = [
  { id: "d7f3dcd8-ddf9-4750-b1f8-c20a5bc9d345", name: "iPhone" },
  { id: "d686a25d-045d-4b8c-9d7c-35a21d29d31b", name: "Smartphone (Geral)" },
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

export default function PricingOverviewPage() {
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].id);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedStorages, setSelectedStorages] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

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

  const devices = devicesData?.items || [];

  const brands = useMemo(() => {
    const uniqueBrands = Array.from(new Set(devices.map((d) => d.manufacturerName)));
    return uniqueBrands.sort();
  }, [devices]);

  const models = useMemo(() => {
    if (!selectedBrand) return [];
    const filteredModels = devices
      .filter((d) => d.manufacturerName === selectedBrand)
      .map((d) => d.modelName);
    return Array.from(new Set(filteredModels)).sort();
  }, [devices, selectedBrand]);

  const storages = useMemo(() => {
    const filtered = devices.filter((d) => {
      if (selectedBrand && d.manufacturerName !== selectedBrand) return false;
      if (selectedModel && d.modelName !== selectedModel) return false;
      return true;
    });
    const uniqueStorages = Array.from(new Set(filtered.map((d) => d.storage)));
    return uniqueStorages.sort((a, b) => a - b);
  }, [devices, selectedBrand, selectedModel]);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (selectedBrand && d.manufacturerName !== selectedBrand) return false;
      if (selectedModel && d.modelName !== selectedModel) return false;
      if (selectedStorages.length > 0 && !selectedStorages.includes(d.storage)) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const fullName = `${d.manufacturerName} ${d.modelName} ${d.storage}GB`.toLowerCase();
        if (!fullName.includes(term)) return false;
      }
      return true;
    });
  }, [devices, selectedBrand, selectedModel, selectedStorages, searchTerm]);

  const groupedDevices = useMemo(() => {
    const groups: Record<string, EligibleDevice[]> = {};
    filteredDevices.forEach((d) => {
      const key = `${d.manufacturerName} ${d.modelName}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredDevices]);

  const handleClearFilters = () => {
    setSelectedBrand("");
    setSelectedModel("");
    setSelectedStorages([]);
    setSearchTerm("");
  };

  const handleStorageToggle = (storage: number) => {
    setSelectedStorages((prev) =>
      prev.includes(storage) ? prev.filter((s) => s !== storage) : [...prev, storage]
    );
  };

  useEffect(() => {
    setSelectedModel("");
    setSelectedStorages([]);
  }, [selectedBrand]);

  const handleDeviceClick = (device: EligibleDevice) => {
    const params = new URLSearchParams({
      category: selectedCategory,
      brand: device.manufacturerName,
      model: device.modelName,
      storage: device.storage.toString(),
    });
    setLocation(`/pricing/detalhes?${params.toString()}`);
  };

  const categoryName = CATEGORIES.find((c) => c.id === selectedCategory)?.name || "";

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Pricing - Visão Geral"
        description="Monitoramento de preços de smartphones e iPhones dos principais e-commerces brasileiros"
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isLoadingDevices}
                  data-testid="button-refresh-devices"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingDevices ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
                {(selectedBrand || selectedModel || selectedStorages.length > 0 || searchTerm) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpar Filtros
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={selectedCategory}
                  onValueChange={(value) => {
                    setSelectedCategory(value);
                    setSelectedBrand("");
                    setSelectedModel("");
                    setSelectedStorages([]);
                  }}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Selecione a categoria" />
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
                  value={selectedBrand}
                  onValueChange={setSelectedBrand}
                  disabled={isLoadingDevices}
                >
                  <SelectTrigger data-testid="select-brand">
                    <SelectValue placeholder="Todas as marcas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas as marcas</SelectItem>
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
                  value={selectedModel}
                  onValueChange={setSelectedModel}
                  disabled={!selectedBrand || isLoadingDevices}
                >
                  <SelectTrigger data-testid="select-model">
                    <SelectValue placeholder={selectedBrand ? "Todos os modelos" : "Selecione a marca"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os modelos</SelectItem>
                    {models.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Busca</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar dispositivo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
              </div>
            </div>

            {storages.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Label className="mb-3 block">Capacidade</Label>
                <div className="flex flex-wrap gap-3">
                  {storages.map((storage) => (
                    <div key={storage} className="flex items-center gap-2">
                      <Checkbox
                        id={`storage-${storage}`}
                        checked={selectedStorages.includes(storage)}
                        onCheckedChange={() => handleStorageToggle(storage)}
                        data-testid={`checkbox-storage-${storage}`}
                      />
                      <label
                        htmlFor={`storage-${storage}`}
                        className="text-sm cursor-pointer"
                      >
                        {storage}GB
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Smartphone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dispositivos Monitorados</p>
                  <p className="text-2xl font-bold">{filteredDevices.length}</p>
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
                  <p className="text-sm text-muted-foreground">Modelos Únicos</p>
                  <p className="text-2xl font-bold">{groupedDevices.length}</p>
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
                  <p className="text-sm text-muted-foreground">Categoria</p>
                  <p className="text-2xl font-bold">{categoryName}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Dispositivos ({filteredDevices.length})
              </CardTitle>
              <Link href="/pricing/analise">
                <Button variant="outline" size="sm" data-testid="button-go-to-analysis">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Análise de Produtos
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingDevices ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : groupedDevices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Smartphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum dispositivo encontrado com os filtros selecionados.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedDevices.map(([name, deviceVariants]) => (
                  <Card
                    key={name}
                    className="hover-elevate cursor-pointer transition-all"
                    data-testid={`card-device-${name.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{name}</h3>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {deviceVariants
                              .sort((a, b) => a.storage - b.storage)
                              .map((variant) => (
                                <Badge
                                  key={variant.storage}
                                  variant="secondary"
                                  className="cursor-pointer"
                                  onClick={() => handleDeviceClick(variant)}
                                  data-testid={`badge-storage-${variant.storage}`}
                                >
                                  {variant.storage}GB
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </Badge>
                              ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
