import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
  Search,
  Filter,
  X,
  TrendingDown,
  TrendingUp,
  Minus,
  RefreshCw,
  Download,
  BarChart3,
  ArrowUpDown,
  Eye,
  CheckSquare,
  Square,
} from "lucide-react";
import * as XLSX from "xlsx";
import { usePricingCategories } from "@/hooks/use-pricing-categories";

const PRICING_API_BASE = "/api/pricing";

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

type SortField = "name" | "storage" | "avgPrice" | "variation" | "itemsCount" | "updatedAt";
type SortDirection = "asc" | "desc";

export default function PricingAnalysisPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const { data: categoriesData } = usePricingCategories();

  useEffect(() => {
    if (categoriesData && categoriesData.length > 0 && !selectedCategory) {
      setSelectedCategory(categoriesData[0].id);
    }
  }, [categoriesData, selectedCategory]);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isExporting, setIsExporting] = useState(false);

  const { data: devicesData, isLoading: isLoadingDevices, refetch } = useQuery<EligibleDevicesResponse>({
    queryKey: ["pricing-devices", selectedCategory],
    queryFn: async () => {
      const response = await fetch(
        `${PRICING_API_BASE}/eligible-devices?categoryId=${selectedCategory}&pageNumber=1&pageSize=200`
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

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (selectedBrand && d.manufacturerName !== selectedBrand) return false;
      if (selectedModel && d.modelName !== selectedModel) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const fullName = `${d.manufacturerName} ${d.modelName} ${d.storage}GB`.toLowerCase();
        if (!fullName.includes(term)) return false;
      }
      return true;
    });
  }, [devices, selectedBrand, selectedModel, searchTerm]);

  const sortedDevices = useMemo(() => {
    const sorted = [...filteredDevices].sort((a, b) => {
      const nameA = `${a.manufacturerName} ${a.modelName}`;
      const nameB = `${b.manufacturerName} ${b.modelName}`;
      
      switch (sortField) {
        case "name":
          return sortDirection === "asc" 
            ? nameA.localeCompare(nameB) 
            : nameB.localeCompare(nameA);
        case "storage":
          return sortDirection === "asc" 
            ? a.storage - b.storage 
            : b.storage - a.storage;
        default:
          return nameA.localeCompare(nameB);
      }
    });
    return sorted;
  }, [filteredDevices, sortField, sortDirection]);

  const handleClearFilters = () => {
    setSelectedBrand("");
    setSelectedModel("");
    setSearchTerm("");
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getDeviceKey = (device: EligibleDevice) =>
    `${device.manufacturerName}|${device.modelName}|${device.storage}`;

  const handleSelectDevice = (device: EligibleDevice) => {
    const key = getDeviceKey(device);
    const newSelected = new Set(selectedDevices);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedDevices(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedDevices.size === sortedDevices.length) {
      setSelectedDevices(new Set());
    } else {
      const allKeys = new Set(sortedDevices.map(getDeviceKey));
      setSelectedDevices(allKeys);
    }
  };

  const handleViewDetails = (device: EligibleDevice) => {
    const params = new URLSearchParams({
      category: selectedCategory,
      brand: device.manufacturerName,
      model: device.modelName,
      storage: device.storage.toString(),
    });
    setLocation(`/pricing/detalhes?${params.toString()}`);
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const dataToExport = sortedDevices.map((d) => ({
        Marca: d.manufacturerName,
        Modelo: d.modelName,
        Capacidade: `${d.storage}GB`,
        Categoria: categoriesData?.find((c) => c.id === selectedCategory)?.name || "",
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dispositivos");

      ws["!cols"] = [
        { wch: 15 },
        { wch: 25 },
        { wch: 12 },
        { wch: 20 },
      ];

      const now = new Date();
      const filename = `pricing_dispositivos_${now.toISOString().split("T")[0]}.xlsx`;
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

  const handleCompareSelected = () => {
    if (selectedDevices.size < 2) {
      toast({
        title: "Selecione mais dispositivos",
        description: "Selecione pelo menos 2 dispositivos para comparar.",
        variant: "destructive",
      });
      return;
    }
    
    const selectedArray = Array.from(selectedDevices);
    const params = new URLSearchParams({ devices: selectedArray.join(",") });
    setLocation(`/pricing/relatorios?${params.toString()}`);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Análise de Produtos"
        description="Seleção e comparação de dispositivos para análise de Pareto"
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
                  data-testid="button-refresh"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingDevices ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
                {(selectedBrand || selectedModel || searchTerm) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpar
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
                  }}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Selecione" />
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
                  onValueChange={(val) => {
                    setSelectedBrand(val === "__all__" ? "" : val);
                    setSelectedModel("");
                  }}
                  disabled={isLoadingDevices}
                >
                  <SelectTrigger data-testid="select-brand">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
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
                  value={selectedModel || "__all__"}
                  onValueChange={(val) => setSelectedModel(val === "__all__" ? "" : val)}
                  disabled={!selectedBrand}
                >
                  <SelectTrigger data-testid="select-model">
                    <SelectValue placeholder={selectedBrand ? "Todos" : "Selecione marca"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
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
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedDevices.size > 0 && (
          <Card className="border-primary">
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant="default">{selectedDevices.size}</Badge>
                  <span className="text-sm">dispositivos selecionados</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDevices(new Set())}
                    data-testid="button-clear-selection"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpar Seleção
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCompareSelected}
                    data-testid="button-compare-selected"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Comparar Selecionados
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Dispositivos ({sortedDevices.length})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={isExporting || sortedDevices.length === 0}
                data-testid="button-export-excel"
              >
                <Download className={`h-4 w-4 mr-2 ${isExporting ? "animate-spin" : ""}`} />
                Exportar Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingDevices ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : sortedDevices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum dispositivo encontrado.</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedDevices.size === sortedDevices.length && sortedDevices.length > 0}
                          onCheckedChange={handleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center gap-2">
                          Dispositivo
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 text-right"
                        onClick={() => handleSort("storage")}
                      >
                        <div className="flex items-center justify-end gap-2">
                          Capacidade
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead className="w-24 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedDevices.map((device) => {
                      const key = getDeviceKey(device);
                      const isSelected = selectedDevices.has(key);
                      return (
                        <TableRow 
                          key={key}
                          className={isSelected ? "bg-primary/5" : ""}
                          data-testid={`row-device-${key}`}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleSelectDevice(device)}
                              data-testid={`checkbox-device-${key}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {device.manufacturerName} {device.modelName}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{device.storage}GB</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDetails(device)}
                              data-testid={`button-view-${key}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
