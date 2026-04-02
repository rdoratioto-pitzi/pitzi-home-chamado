import { useState, useEffect, useMemo, useCallback } from "react";
import { format, startOfMonth, endOfMonth, parseISO, subMonths, eachMonthOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, ComposedChart, Cell 
} from "recharts";
import { 
  Loader2, Filter, AlertTriangle, Info, Download, Search, Check, ChevronsUpDown, CalendarIcon
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";

// --- Interfaces based on User Request ---

interface ResumoGrade {
  Erros_Comuns_IA: string | null;
  Grade_Humano_Real: string;
  Percentual_Assertividade: number;
  Qtd_Acertos_IA: number;
  Total_Avaliados: number;
}

interface Evolucao {
  Acuracia_Mensal: number;
  Mes: string;
  Qtd_Acertos: number;
  Total_Avaliados: number;
}

interface EvolucaoCategoria {
  Acuracia_Mensal: number;
  Categoria: string;
  Mes: string;
  Qtd_Acertos: number;
  Total_Avaliados: number;
}

interface DispositivoData {
  Acuracia: number;
  Dispositivo: string;
  Qtd_Acertos: number;
  Qtd_Erros: number;
  Total_Avaliados: number;
}

interface DetalheAvaliacao {
  Categoria: string;
  Data_Avaliacao: string;
  Grade_Humano: string;
  Grade_IA: string;
  Imei: string;
  Is_Match: number;
  Link_Fotos: string;
  Modelo: string;
  Status_Assertividade: string;
}

interface AvaliacaoImei {
  Imei: string;
  Codigo_Voucher: string;
  Criacao_Pedido: string;
  Descricao_Captura: string;
  Nota_IA: string;
  Nota_Humana: string;
  Tags_IA: string | null;
  Tags_Humana: string | null;
}

interface AssertividadeFotos {
  Acertos: number;
  Mes_Avaliacao: string;
  Nome_da_Tela: string;
  Percentual_Assertividade: number;
  Total_Fotos: number;
}

interface CategoriaMetrica {
  Acuracia: number;
  Categoria: string;
  Qtd_Acertos: number;
  Total_Avaliados: number;
}

interface CategoriaData {
  Categoria: string;
  Acuracia?: number;
  Qtd_Acertos?: number;
  Total_Avaliados?: number;
}

// Cores para os gráficos
const COLORS = {
  acerto: "#22c55e",
  erro: "#ef4444",
  primario: "#3b82f6",
  secundario: "#8b5cf6",
  terciario: "#f59e0b",
  cinza: "#6b7280",
};

const API_BASE_URL = "/api/avaliacoes-ia";

export default function EficienciaAvaliacoesIaPage() {
  const { toast } = useToast();

  // --- State ---
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });

  // Month filter state
  const [selectedMonths, setSelectedMonths] = useState<string[]>([
    format(subMonths(new Date(), 2), "yyyy-MM"),
    format(subMonths(new Date(), 1), "yyyy-MM"),
    format(new Date(), "yyyy-MM")
  ]);
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [periodType, setPeriodType] = useState<'months' | 'dates'>('months');
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [isDeviceOpen, setIsDeviceOpen] = useState(false);

  // Generate available months (last 12 months)
  const availableMonths = useMemo(() => {
    const today = new Date();
    const twelveMonthsAgo = subMonths(today, 11);
    const months = eachMonthOfInterval({ start: twelveMonthsAgo, end: today });
    return months.map(m => format(m, "yyyy-MM")).reverse();
  }, []);

  const [loading, setLoading] = useState(false);
  
  // Data States
  const [resumoData, setResumoData] = useState<ResumoGrade[]>([]);
  const [evolucaoData, setEvolucaoData] = useState<Evolucao[]>([]);
  const [evolucaoCategoriaData, setEvolucaoCategoriaData] = useState<EvolucaoCategoria[]>([]);
  const [dispositivosData, setDispositivosData] = useState<DispositivoData[]>([]);
  const [detalhesData, setDetalhesData] = useState<DetalheAvaliacao[]>([]);
  const [imeiData, setImeiData] = useState<AvaliacaoImei[]>([]);
  const [imeiPageIndex, setImeiPageIndex] = useState<number>(0);
  const [imeiFilter, setImeiFilter] = useState<string>('');
  const [assertividadeFotosData, setAssertividadeFotosData] = useState<AssertividadeFotos[]>([]);
  const [categoriasData, setCategoriasData] = useState<CategoriaMetrica[]>([]);
  
  // Filters
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [availableDevicesList, setAvailableDevicesList] = useState<string[]>([]);

  // --- Fetch Logic ---

  // Helper to fetch categories and devices list for filters
  const fetchFilterOptions = useCallback(async () => {
    try {
      const commonParams = new URLSearchParams({
        start_date: dateRange.start,
        end_date: dateRange.end
      });
      // 1. Fetch Categories
      const catsResponse = await fetch(`${API_BASE_URL}/categorias?${commonParams.toString()}`);
      if (catsResponse.ok) {
        const data: any = await catsResponse.json();
        let cats: string[] = [];
        if (Array.isArray(data)) {
           cats = data.map((d: any) => d.Categoria);
        } else if (data.data && Array.isArray(data.data)) {
           cats = data.data.map((d: any) => d.Categoria);
        }
        if (cats.length > 0) {
            setAvailableCategories(prev => {
                const unique = Array.from(new Set([...prev, ...cats])).sort();
                return unique;
            });
        }
      }

      // 2. Fetch Devices (respecting Category filter only)
      const devParams = new URLSearchParams(commonParams);
      if (selectedCategories.length > 0) {
        selectedCategories.forEach(c => devParams.append("categories", c));
      }
      
      // Busca todos os dispositivos (remove o LIMIT 10)
      devParams.append("limit", "0");
      
      const devicesUrl = `${API_BASE_URL}/dispositivos?${devParams.toString()}`;
      console.log("[DEBUG] Fetching devices options from:", devicesUrl);

      const devsResponse = await fetch(devicesUrl);
      if (devsResponse.ok) {
        const data: any = await devsResponse.json();
        console.log("[DEBUG] Raw devices response data:", data);

        let devs: string[] = [];
        if (Array.isArray(data)) {
           devs = data.map((d: any) => d.Dispositivo || d.Modelo);
        } else {
           console.warn("[DEBUG] Devices response is not an array:", data);
        }

        const uniqueDevs = Array.from(new Set(devs)).sort();
        console.log(`[DEBUG] Found ${uniqueDevs.length} unique devices for filter.`);
        setAvailableDevicesList(uniqueDevs);
      } else {
        console.error("[DEBUG] Failed to fetch devices options:", devsResponse.status, devsResponse.statusText);
      }

    } catch (error) {
      console.warn("Failed to fetch filter options", error);
    }
  }, [dateRange, selectedCategories]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start_date: dateRange.start,
        end_date: dateRange.end,
      });

      // Categories param
      if (selectedCategories.length > 0) {
        selectedCategories.forEach(cat => params.append("categories", cat));
      }

      // Devices param - send each selected device
      if (selectedDevices.length > 0) {
        selectedDevices.forEach(device => params.append("devices", device));
      }

      const queryString = params.toString();

      console.log("Fetching data with params:", queryString);

      // Parallel fetch
      const [
        resResumo, 
        resEvolucao, 
        resEvolucaoCat, 
        resDispositivos, 
        resDetalhes,
        resImei,
        resAssertividadeFotos,
        resCategorias
      ] = await Promise.all([
        fetch(`${API_BASE_URL}/resumo?${queryString}`),
        fetch(`${API_BASE_URL}/evolucao?${queryString}`),
        fetch(`${API_BASE_URL}/evolucao-categoria?${queryString}`),
        fetch(`${API_BASE_URL}/dispositivos?${queryString}`),
        fetch(`${API_BASE_URL}/detalhes?${queryString}`),
        fetch(`${API_BASE_URL}/imei?${new URLSearchParams({ limit_date: dateRange.end }).toString()}`),
        fetch(`${API_BASE_URL}/assertividade-fotos?${queryString}`),
        fetch(`${API_BASE_URL}/categorias?${queryString}`)
      ]);

      const [
        dataResumo, 
        dataEvolucao, 
        dataEvolucaoCat, 
        dataDispositivos, 
        dataDetalhes,
        dataImei,
        dataAssertividadeFotos,
        dataCategorias
      ] = await Promise.all([
        resResumo.ok ? resResumo.json() : [], 
        resEvolucao.ok ? resEvolucao.json() : [], 
        resEvolucaoCat.ok ? resEvolucaoCat.json() : [], 
        resDispositivos.ok ? resDispositivos.json() : [], 
        resDetalhes.ok ? resDetalhes.json() : [],
        resImei.ok ? resImei.json() : [],
        resAssertividadeFotos.ok ? resAssertividadeFotos.json() : [],
        resCategorias.ok ? resCategorias.json() : []
      ]);

      // Handle Data (Ensure arrays)
      setResumoData(Array.isArray(dataResumo) ? dataResumo : [dataResumo].filter(x => x && x.Grade_Humano_Real));
      setEvolucaoData(Array.isArray(dataEvolucao) ? dataEvolucao : []);
      setEvolucaoCategoriaData(Array.isArray(dataEvolucaoCat) ? dataEvolucaoCat : []);
      setDispositivosData(Array.isArray(dataDispositivos) ? dataDispositivos : []);
      setDetalhesData(Array.isArray(dataDetalhes) ? dataDetalhes : []);
      setImeiData(Array.isArray(dataImei) ? dataImei : []);
      setAssertividadeFotosData(Array.isArray(dataAssertividadeFotos) ? dataAssertividadeFotos : []);
      setCategoriasData(Array.isArray(dataCategorias) ? dataCategorias : []);

      // Update available categories from 'detalhes' just in case the dedicated endpoint missed some
      if (Array.isArray(dataDetalhes) && dataDetalhes.length > 0) {
        const catsFromDetails = new Set(dataDetalhes.map(d => d.Categoria).filter(Boolean));
        setAvailableCategories(prev => {
            const combined = new Set(prev);
            catsFromDetails.forEach(c => combined.add(c));
            return Array.from(combined).sort();
        });
      }

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Falha ao buscar métricas de avaliações IA.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedCategories, selectedDevices, toast]);

  // Initial Fetch & Categories
  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update dateRange when selectedMonths changes
  useEffect(() => {
    if (selectedMonths.length > 0) {
      const sortedMonths = [...selectedMonths].sort();
      const firstMonth = parseISO(sortedMonths[0] + "-01");
      const lastMonth = parseISO(sortedMonths[sortedMonths.length - 1] + "-01");
      setDateRange({
        start: format(startOfMonth(firstMonth), "yyyy-MM-dd"),
        end: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
      });
    }
  }, [selectedMonths]);

  // --- Helpers for Date Shortcuts ---
  const handlePresetDate = (preset: 'current' | 'last' | 'last3') => {
    const today = new Date();
    let start: Date, end: Date;

    switch (preset) {
      case 'current':
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case 'last':
        const lastMonth = subMonths(today, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      case 'last3':
        start = startOfMonth(subMonths(today, 2));
        end = endOfMonth(today);
        break;
    }
    setDateRange({
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    });
  };

  // --- Render Helpers ---

  const sortedResumo = useMemo(() => {
    return [...resumoData].sort((a, b) => a.Grade_Humano_Real.localeCompare(b.Grade_Humano_Real));
  }, [resumoData]);

  const kpis = useMemo(() => {
    // Calculate global KPIs from Resumo data to match current display if needed, 
    // or aggregate from Detalles if Resumo is pre-aggregated per Grade
    const total = resumoData.reduce((acc, curr) => acc + curr.Total_Avaliados, 0);
    const acertos = resumoData.reduce((acc, curr) => acc + curr.Qtd_Acertos_IA, 0);
    const assertividade = total > 0 ? (acertos / total) * 100 : 0;
    
    return {
      total,
      acertos,
      assertividade: assertividade.toFixed(2),
      erros: total - acertos
    };
  }, [resumoData]);

  // Use the fetched list for available devices instead of deriving from filtered data
  const availableDevices = availableDevicesList;

  // Top lists
  const top10PorAssertividade = useMemo(() => {
    return [...dispositivosData]
      .filter(d => d.Total_Avaliados >= 1)
      .sort((a, b) => b.Acuracia - a.Acuracia)
      .slice(0, 10);
  }, [dispositivosData]);

  const top10PorErros = useMemo(() => {
    return [...dispositivosData]
      .filter(d => d.Total_Avaliados >= 1)
      // Top errors usually means lowest accuracy, OR highest Qtd_Erros
      .sort((a, b) => a.Acuracia - b.Acuracia) // Lowest accuracy first
      .slice(0, 10);
  }, [dispositivosData]);

  // pivot table data for category evolution
  const categoryEvolutionPivot = useMemo(() => {
    const pivot: Record<string, Record<string, number>> = {};
    const months = new Set<string>();
    const categories = new Set<string>();

    evolucaoCategoriaData.forEach(item => {
      if (!pivot[item.Categoria]) pivot[item.Categoria] = {};
      pivot[item.Categoria][item.Mes] = item.Acuracia_Mensal;
      months.add(item.Mes);
      categories.add(item.Categoria);
    });

    const sortedMonths = Array.from(months).sort().reverse().slice(0, 3).reverse(); // Last 3 months sorted ASC
    const sortedCategories = Array.from(categories).sort();

    return { pivot, sortedMonths, sortedCategories };
  }, [evolucaoCategoriaData]);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Eficiência de Avaliações IA"
        description="Monitoramento detalhado da performance dos modelos de avaliação"
      />

      {/* Filters Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            
            {/* Period Type Toggle */}
            <div className="flex flex-col space-y-2">
              <span className="text-sm font-medium">Período</span>
              <div className="flex gap-1 p-1 bg-muted rounded-md">
                <Button
                  variant={periodType === 'months' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPeriodType('months')}
                >
                  Meses
                </Button>
                <Button
                  variant={periodType === 'dates' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPeriodType('dates')}
                >
                  Datas
                </Button>
              </div>
            </div>

            {/* Period Filter - Months or Dates */}
            {periodType === 'months' ? (
            <div className="flex flex-col space-y-2">
              <span className="text-sm font-medium">Meses</span>
              <Popover open={isMonthOpen} onOpenChange={setIsMonthOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isMonthOpen}
                    className="w-[240px] justify-between"
                  >
                    {selectedMonths.length === 0
                      ? "Selecione os meses"
                      : `${selectedMonths.length} mês${selectedMonths.length > 1 ? 'es' : ''} selecionado${selectedMonths.length > 1 ? 's' : ''}`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar mês..." />
                    <CommandList>
                      <CommandEmpty>Nenhum mês encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setSelectedMonths([]);
                            setDateRange({ start: '', end: '' });
                          }}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedMonths.length === 0 ? "opacity-100" : "opacity-0"
                            )}
                          />
                          Todos os meses
                        </CommandItem>
                        {availableMonths.map((month) => (
                          <CommandItem
                            key={month}
                            onSelect={() => {
                              setSelectedMonths(prev => {
                                if (prev.includes(month)) {
                                  return prev.filter(m => m !== month);
                                } else {
                                  return [...prev, month];
                                }
                              });
                            }}
                            className="cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedMonths.includes(month) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {format(parseISO(month + "-01"), 'MMMM yyyy', { locale: ptBR })}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            ) : (
            <div className="flex flex-col space-y-2">
              <span className="text-sm font-medium">Período</span>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-[140px]"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-[140px]"
                />
              </div>
            </div>
            )}

            {/* Device Filter */}
            <div className="flex flex-col space-y-2 flex-1 min-w-[200px]">
              <span className="text-sm font-medium">Dispositivos</span>
              <Popover open={isDeviceOpen} onOpenChange={setIsDeviceOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isDeviceOpen}
                    className="w-full justify-between"
                  >
                    {selectedDevices.length === 0
                      ? "Todos dispositivos"
                      : `${selectedDevices.length} selecionado${selectedDevices.length > 1 ? 's' : ''}`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar dispositivo..." />
                    <CommandList>
                      <CommandEmpty>Nenhum dispositivo encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => setSelectedDevices([])}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedDevices.length === 0 ? "opacity-100" : "opacity-0"
                            )}
                          />
                          Todos os dispositivos
                        </CommandItem>
                        {availableDevices.map((device) => (
                          <CommandItem
                            key={device}
                            onSelect={() => {
                              setSelectedDevices(prev => {
                                if (prev.includes(device)) {
                                  return prev.filter(d => d !== device);
                                } else {
                                  return [...prev, device];
                                }
                              });
                            }}
                            className="cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedDevices.includes(device) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {device}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Category Filter */}
            <div className="flex flex-col space-y-2 flex-1 min-w-[200px]">
               <span className="text-sm font-medium">Categorias</span>
               <Popover open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isCategoryOpen}
                    className="w-full justify-between"
                  >
                    {selectedCategories.length === 0
                      ? "Todas categorias"
                      : `${selectedCategories.length} selecionadas`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar categoria..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                      <CommandGroup>
                         <CommandItem
                          onSelect={() => setSelectedCategories([])}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCategories.length === 0 ? "opacity-100" : "opacity-0"
                            )}
                          />
                          Todas (Limpar Filtro)
                        </CommandItem>
                        {availableCategories.map((category) => (
                          <CommandItem
                            key={category}
                            onSelect={() => {
                                setSelectedCategories(prev => {
                                    if (prev.includes(category)) {
                                        return prev.filter(c => c !== category);
                                    } else {
                                        return [...prev, category];
                                    }
                                });
                            }}
                            className="cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedCategories.includes(category) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {category}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <Button onClick={fetchData} disabled={loading} className="min-w-[100px]">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
              Filtrar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Avaliações</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.total.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assertividade Geral</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn(
                "text-2xl font-bold",
                Number(kpis.assertividade) >= 85 ? "text-green-600" :
                Number(kpis.assertividade) >= 70 ? "text-amber-600" : "text-red-600"
            )}>{kpis.assertividade}%</div>
            <p className="text-xs text-muted-foreground">Média ponderada</p>
          </CardContent>
        </Card>
        <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Acertos</CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.acertos.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Erros</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.erros.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Evolution Chart */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Evolução da Assertividade</CardTitle>
            <CardDescription>Acurácia mensal ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolucaoData}>
                  <defs>
                    <linearGradient id="colorAssertividade" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="Mes" 
                    tickFormatter={(val) => {
                        try { return format(parseISO(val), 'MMM yy', { locale: ptBR }) } catch { return val }
                    }}
                  />
                  <YAxis domain={[0, 100]} />
                  <RechartsTooltip 
                    formatter={(value: number) => [`${value}%`, 'Acurácia']}
                    labelFormatter={(label) => {
                        try { return format(parseISO(label as string), 'MMMM yyyy', { locale: ptBR }) } catch { return label }
                    }} 
                  />
                  <Area type="monotone" dataKey="Acuracia_Mensal" stroke="#3b82f6" fillOpacity={1} fill="url(#colorAssertividade)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Resumo Por Grade */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Assertividade por Grade</CardTitle>
            <CardDescription>Performance por classificação humana</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
                {sortedResumo.length === 0 && <p className="text-muted-foreground text-center py-4">Sem dados</p>}
                {sortedResumo.map((item) => (
                    <div key={item.Grade_Humano_Real} className="flex items-center justify-between space-x-2">
                        <div className="flex flex-col space-y-1 w-full">
                            <div className="flex items-center justify-between">
                                <span className="font-medium">Grade {item.Grade_Humano_Real}</span>
                                <span className={cn(
                                    "font-bold",
                                    item.Percentual_Assertividade >= 85 ? "text-green-600" : 
                                    item.Percentual_Assertividade >= 70 ? "text-amber-600" : "text-red-600"
                                )}>
                                    {item.Percentual_Assertividade}%
                                </span>
                            </div>
                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                <div 
                                    className={cn(
                                        "h-full transition-all",
                                        item.Percentual_Assertividade >= 85 ? "bg-green-500" : 
                                        item.Percentual_Assertividade >= 70 ? "bg-amber-500" : "bg-red-500"
                                    )} 
                                    style={{ width: `${item.Percentual_Assertividade}%` }} 
                                />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{item.Qtd_Acertos_IA} acertos de {item.Total_Avaliados}</span>
                                {item.Erros_Comuns_IA && (
                                    <span title={`Confunde com ${item.Erros_Comuns_IA}`}>
                                        Erro comum: {item.Erros_Comuns_IA}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
             </div>
          </CardContent>
        </Card>
      </div>

       {/* Assertividade Fotos */}
       {/* Removed from here to place below Top 10 cards */}


      {/* Dispositivos Table */}
      <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Top 10 - Melhor Assertividade</CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Dispositivo</TableHead>
                        <TableHead className="text-right">Vol.</TableHead>
                        <TableHead className="text-right">Assertividade</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {top10PorAssertividade.map((device) => (
                        <TableRow key={device.Dispositivo}>
                            <TableCell className="font-medium text-xs truncate max-w-[200px]" title={device.Dispositivo}>{device.Dispositivo}</TableCell>
                            <TableCell className="text-right">{device.Total_Avaliados}</TableCell>
                            <TableCell className="text-right">
                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                    {device.Acuracia}%
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Top 10 - Maior Taxa de Erro</CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Dispositivo</TableHead>
                        <TableHead className="text-right">Vol.</TableHead>
                        <TableHead className="text-right">Assertividade</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {top10PorErros.map((device) => (
                        <TableRow key={device.Dispositivo}>
                            <TableCell className="font-medium text-xs truncate max-w-[200px]" title={device.Dispositivo}>{device.Dispositivo}</TableCell>
                            <TableCell className="text-right">{device.Total_Avaliados}</TableCell>
                            <TableCell className="text-right">
                                <Badge variant="destructive">
                                    {device.Acuracia}%
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
      </div>

      {/* Category Analysis Configured */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Taxa de Acerto por Categoria (Período Atual)</CardTitle>
            <CardDescription>Performance consolidada por categoria</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px] overflow-auto">
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Vol.</TableHead>
                    <TableHead className="text-right">Assertividade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...categoriasData].sort((a, b) => b.Acuracia - a.Acuracia).map((cat) => (
                    <TableRow key={cat.Categoria}>
                      <TableCell className="font-medium">{cat.Categoria}</TableCell>
                      <TableCell className="text-right">{cat.Total_Avaliados}</TableCell>
                      <TableCell className="text-right">
                         <div className="flex items-center justify-end gap-2">
                            <span className={cn(
                                "font-bold",
                                cat.Acuracia >= 85 ? "text-green-600" : 
                                cat.Acuracia >= 70 ? "text-amber-600" : "text-red-600"
                            )}>
                                {cat.Acuracia}%
                            </span>
                         </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {categoriasData.length === 0 && (
                     <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground p-4">
                           Nenhuma categoria encontrada
                        </TableCell>
                     </TableRow>
                  )}
                </TableBody>
             </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evolução por Categoria (Últimos 3 Meses)</CardTitle>
            <CardDescription>Histórico de assertividade fechado mês a mês</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px] overflow-auto">
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    {categoryEvolutionPivot.sortedMonths.map(m => {
                       let formattedDate = m;
                       try {
                         // If m is YYYY-MM-DD, parseISO works. If it's YYYY-MM, we might need -01 if parseISO fails or returns invalid.
                         // However, the API returns YYYY-MM-DD from DATE_TRUNC. 
                         // Let's rely on parseISO handling the string.
                         if (m.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            formattedDate = format(parseISO(m), 'MMM/yy', { locale: ptBR });
                         } else if (m.match(/^\d{4}-\d{2}$/)) {
                            formattedDate = format(parseISO(m + "-01"), 'MMM/yy', { locale: ptBR });
                         } else {
                            formattedDate = m; // Fallback
                         }
                       } catch (e) {
                         formattedDate = m;
                       }
                       
                       return (
                         <TableHead key={m} className="text-right whitespace-nowrap">
                           {formattedDate}
                         </TableHead>
                       );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryEvolutionPivot.sortedCategories.map(cat => (
                    <TableRow key={cat}>
                       <TableCell className="font-medium whitespace-nowrap">{cat}</TableCell>
                       {categoryEvolutionPivot.sortedMonths.map(m => {
                          const val = categoryEvolutionPivot.pivot[cat]?.[m];
                          return (
                            <TableCell key={m} className="text-right">
                               {val !== undefined ? (
                                 <span className={cn(
                                    "font-medium",
                                    val >= 85 ? "text-green-600" : 
                                    val >= 70 ? "text-amber-600" : "text-red-600"
                                )}>
                                    {val}%
                                 </span>
                               ) : "-"}
                            </TableCell>
                          );
                       })}
                    </TableRow>
                  ))}
                  {categoryEvolutionPivot.sortedCategories.length === 0 && (
                     <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground p-4">
                           Sem histórico disponível
                        </TableCell>
                     </TableRow>
                  )}
                </TableBody>
             </Table>
          </CardContent>
        </Card>
      </div>

       {/* Assertividade Fotos */}
       <Card>
          <CardHeader>
            <CardTitle>Assertividade por Etapa (Fotos)</CardTitle>
            <CardDescription>Desempenho da IA em cada etapa de avaliação visual</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Etapa / Tela</TableHead>
                        <TableHead>Mês Referência</TableHead>
                        <TableHead className="text-right">Total Fotos</TableHead>
                        <TableHead className="text-right">Acertos</TableHead>
                        <TableHead className="text-right">Assertividade</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...assertividadeFotosData]
                        .sort((a, b) => b.Percentual_Assertividade - a.Percentual_Assertividade) // Ordenar por assertividade (maior para menor)
                        .map((item, index) => (
                        <TableRow key={index}>
                            <TableCell className="font-medium">{item.Nome_da_Tela}</TableCell>
                            <TableCell>{item.Mes_Avaliacao ? format(parseISO(item.Mes_Avaliacao), 'MMM yyyy', { locale: ptBR }) : '-'}</TableCell>
                            <TableCell className="text-right">{item.Total_Fotos}</TableCell>
                            <TableCell className="text-right">{item.Acertos}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <span className={cn(
                                        "font-bold",
                                        item.Percentual_Assertividade >= 85 ? "text-green-600" : 
                                        item.Percentual_Assertividade >= 70 ? "text-amber-600" : "text-red-600"
                                    )}>
                                        {item.Percentual_Assertividade.toFixed(1)}%
                                    </span>
                                    <Badge 
                                        variant="outline" 
                                        className={cn(
                                            "w-2 h-2 rounded-full p-0 border-none",
                                             item.Percentual_Assertividade >= 85 ? "bg-green-500" : 
                                             item.Percentual_Assertividade >= 70 ? "bg-amber-500" : "bg-red-500"
                                        )}
                                    />
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </CardContent>
       </Card>

         {/* Últimas avaliações por IMEI */}
       <Card>
        <CardHeader>
          <CardTitle>Últimas Avaliações por IMEI</CardTitle>
        </CardHeader>
        <CardContent>
           {/* Filtro de IMEI */}
           <div className="mb-4">
             <Input
               placeholder="Filtrar por IMEI..."
               value={imeiFilter}
               onChange={(e) => {
                 setImeiFilter(e.target.value);
                 setImeiPageIndex(0);
               }}
               className="max-w-xs"
             />
           </div>
           {(() => {
             const itemsPerPage = 10;
             // Filtrar dados por IMEI
             const filteredData = imeiData.filter(d => 
               (d.Imei || '').toLowerCase().includes(imeiFilter.toLowerCase())
             );
             const totalPages = Math.ceil(filteredData.length / itemsPerPage);
             const startIdx = imeiPageIndex * itemsPerPage;
             const endIdx = startIdx + itemsPerPage;
             const paginatedData = filteredData.slice(startIdx, endIdx);

             return (
               <div className="space-y-4">
                 <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Data</TableHead>
                      <TableHead>IMEI</TableHead>
                      <TableHead>Voucher</TableHead>
                      <TableHead>Captura</TableHead>
                      <TableHead>Nota IA</TableHead>
                      <TableHead>Nota Humana</TableHead>
                      <TableHead>Tags IA</TableHead>
                      <TableHead>Tags Humana</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                    {paginatedData.map((d, i) => (
                        <TableRow key={i}>
                  <TableCell>{d.Criacao_Pedido ? format(new Date(d.Criacao_Pedido), 'dd/MM/yyyy HH:mm') : '-'}</TableCell>
                  <TableCell className="text-xs font-medium">{d.Imei || '-'}</TableCell>
                  <TableCell className="text-xs truncate max-w-[160px]" title={d.Codigo_Voucher || '-'}>{d.Codigo_Voucher || '-'}</TableCell>
                  <TableCell className="text-xs truncate max-w-[240px]" title={d.Descricao_Captura || '-'}>{d.Descricao_Captura || '-'}</TableCell>
                  <TableCell>{d.Nota_IA || '-'}</TableCell>
                  <TableCell>{d.Nota_Humana || '-'}</TableCell>
                  <TableCell className="text-xs truncate max-w-[200px]" title={d.Tags_IA || '-'}>{d.Tags_IA || '-'}</TableCell>
                  <TableCell className="text-xs truncate max-w-[200px]" title={d.Tags_Humana || '-'}>{d.Tags_Humana || '-'}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

               {/* Paginação */}
               <div className="flex items-center justify-between pt-4 border-t mt-4">
                 <span className="text-sm text-muted-foreground">
                   Página {imeiPageIndex + 1} de {totalPages > 0 ? totalPages : 1}
                 </span>
                 <div className="flex gap-2">
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => setImeiPageIndex(Math.max(0, imeiPageIndex - 1))}
                     disabled={imeiPageIndex === 0}
                   >
                     Anterior
                   </Button>
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => setImeiPageIndex(Math.min(totalPages - 1, imeiPageIndex + 1))}
                     disabled={imeiPageIndex >= totalPages - 1}
                   >
                     Próximo
                   </Button>
                 </div>
               </div>
             </div>
           );
         })()}
        </CardContent>
       </Card>

    </div>
  );
}
