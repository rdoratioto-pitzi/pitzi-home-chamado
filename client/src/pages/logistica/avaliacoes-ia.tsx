import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  Cell,
  Tooltip as RechartsTooltip,
  Legend
} from "recharts";
import { 
  Bot, 
  Search, 
  Loader2,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  Info,
  Target,
  Activity,
  BarChart3,
  PieChart,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Types
interface AvaliacaoDetail {
  Imei: string | null;
  Modelo: string;
  Grade_Humano: string;
  Grade_IA: string;
  Status_Assertividade: "ACERTOU" | "ERROU";
  Is_Match: number;
  Data_Avaliacao: string;
  Link_Fotos: string;
}

interface ResumoGrade {
  Grade_Humano_Real: string;
  Total_Avaliados: number;
  Qtd_Acertos_IA: number;
  Percentual_Assertividade: number;
  Erros_Comuns_IA: string | null;
}

interface EvolucaoMensal {
  Mes: string;
  Total_Avaliados: number;
  Qtd_Acertos: number;
  Acuracia_Mensal: number;
}

interface DispositivoAcuracia {
  Dispositivo: string;
  Total_Avaliados: number;
  Qtd_Acertos: number;
  Acuracia: number;
}

interface KPIData {
  totalAvaliacoes: number;
  assertividadeGeral: number;
  totalAcertos: number;
  totalErros: number;
  concordancia: number;
}

interface AlertItem {
  type: "warning" | "info" | "error";
  message: string;
  description?: string;
}

const API_BASE_URL = "/api";

// Cores para os gráficos
const COLORS = {
  acerto: "#22c55e",
  erro: "#ef4444",
  primario: "#3b82f6",
  secundario: "#8b5cf6",
  terciario: "#f59e0b",
  cinza: "#6b7280",
};

export default function EficienciaAvaliacoesIaPage() {
  const { toast } = useToast();
  
  // States
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Data states
  const [detalhes, setDetalhes] = useState<AvaliacaoDetail[]>([]);
  const [resumo, setResumo] = useState<ResumoGrade[]>([]);
  const [evolucao, setEvolucao] = useState<EvolucaoMensal[]>([]);
  const [dispositivos, setDispositivos] = useState<DispositivoAcuracia[]>([]);
  
  // Computed KPIs
  const kpis = useMemo((): KPIData => {
    const total = detalhes.length;
    const acertos = detalhes.filter(d => d.Status_Assertividade === "ACERTOU").length;
    const erros = total - acertos;
    const assertividade = total > 0 ? (acertos / total) * 100 : 0;
    
    return {
      totalAvaliacoes: total,
      assertividadeGeral: Math.round(assertividade * 10) / 10,
      totalAcertos: acertos,
      totalErros: erros,
      concordancia: Math.round(assertividade * 10) / 10,
    };
  }, [detalhes]);
  
  // Alerts
  const alerts = useMemo((): AlertItem[] => {
    const alertList: AlertItem[] = [];
    
    // Alerta de assertividade baixa
    if (kpis.assertividadeGeral < 85) {
      alertList.push({
        type: "warning",
        message: "Assertividade abaixo do target",
        description: `A assertividade geral está em ${kpis.assertividadeGeral}%, abaixo do target de 85%`,
      });
    }
    
    // Alerta por grade com baixa performance
    resumo.forEach(r => {
      if (r.Percentual_Assertividade < 80) {
        alertList.push({
          type: "error",
          message: `Baixa assertividade para grade ${r.Grade_Humano_Real}`,
          description: `Apenas ${r.Percentual_Assertividade}% de acerto para a grade ${r.Grade_Humano_Real}`,
        });
      }
    });
    
    // Insights
    const errosComuns = resumo
      .filter(r => r.Erros_Comuns_IA)
      .map(r => `${r.Grade_Humano_Real}: ${r.Erros_Comuns_IA}`);
    
    if (errosComuns.length > 0) {
      alertList.push({
        type: "info",
        message: "Padrões de erro identificados",
        description: `A IA tende a confundir: ${errosComuns.join("; ")}`,
      });
    }
    
    return alertList;
  }, [kpis, resumo]);
  
  // Filtered details
  const filteredDetalhes = useMemo(() => {
    return detalhes.filter(d => {
      if (statusFilter !== "all" && d.Status_Assertividade !== statusFilter) return false;
      if (deviceFilter !== "all" && d.Modelo !== deviceFilter) return false;
      return true;
    });
  }, [detalhes, statusFilter, deviceFilter]);
  
  // Unique devices for filter (limit to 50 for performance)
  const uniqueDevices = useMemo(() => {
    const devices = new Set(
      detalhes
        .map(d => d.Modelo)
        .filter(d => d && typeof d === 'string' && d.trim() !== '')
    );
    return Array.from(devices).sort().slice(0, 50);
  }, [detalhes]);
  
  // Fetch data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      
      if (statusFilter !== "all") {
        params.append("status_assertividade", statusFilter);
      }
      if (deviceFilter !== "all") {
        params.append("device_description", deviceFilter);
      }
      
      // Fetch all data in parallel
      const [detalhesRes, resumoRes, evolucaoRes, dispositivosRes] = await Promise.all([
        fetch(`${API_BASE_URL}/avaliacoes-ia/detalhes?${params}`),
        fetch(`${API_BASE_URL}/avaliacoes-ia/resumo?${params}`),
        fetch(`${API_BASE_URL}/avaliacoes-ia/evolucao?${params}`),
        fetch(`${API_BASE_URL}/avaliacoes-ia/dispositivos?${params}`),
      ]);
      
      const detalhesData = await detalhesRes.json();
      const resumoData = await resumoRes.json();
      const evolucaoData = await evolucaoRes.json();
      const dispositivosData = await dispositivosRes.json();
      
      // Handle detalhes data
      if (Array.isArray(detalhesData)) {
        setDetalhes(detalhesData);
      } else if (detalhesData && typeof detalhesData === 'object') {
        // Handle case where API returns object with data property
        if (Array.isArray(detalhesData.data)) {
          setDetalhes(detalhesData.data);
        }
      }
      
      // Handle resumo data
      if (Array.isArray(resumoData)) {
        setResumo(resumoData);
      } else if (resumoData && typeof resumoData === 'object' && Array.isArray(resumoData.data)) {
        setResumo(resumoData.data);
      }
      
      // Handle evolucao data
      if (Array.isArray(evolucaoData)) {
        setEvolucao(evolucaoData);
      } else if (evolucaoData && typeof evolucaoData === 'object' && Array.isArray(evolucaoData.data)) {
        setEvolucao(evolucaoData.data);
      }
      
      // Handle dispositivos data
      if (Array.isArray(dispositivosData)) {
        setDispositivos(dispositivosData);
      } else if (dispositivosData && typeof dispositivosData === 'object' && Array.isArray(dispositivosData.data)) {
        setDispositivos(dispositivosData.data);
      }
      
      toast({
        title: "Dados atualizados",
        description: "As informações foram carregadas com sucesso",
      });
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível buscar os dados. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch on mount and when filters change
  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);
  
  // Export to CSV
  const exportToCSV = () => {
    if (filteredDetalhes.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Aplique filtros válidos e tente novamente",
      });
      return;
    }
    
    const headers = ["IMEI", "Modelo", "Grade Humano", "Grade IA", "Status", "Data"];
    const rows = filteredDetalhes.map(d => [
      d.Imei || "N/A",
      d.Modelo,
      d.Grade_Humano,
      d.Grade_IA,
      d.Status_Assertividade,
      new Date(d.Data_Avaliacao).toLocaleDateString("pt-BR"),
    ]);
    
    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.join(";"))
    ].join("\n");
    
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `avaliacoes-ia-${startDate}-${endDate}.csv`;
    link.click();
    
    toast({
      title: "Exportação concluída",
      description: ` foram exportados ${filteredDetalhes.length} registros`,
    });
  };
  
  // Render grade badge
  const renderGradeBadge = (grade: string) => {
    const colors: Record<string, string> = {
      "A": "bg-green-100 text-green-800 border-green-200",
      "B": "bg-blue-100 text-blue-800 border-blue-200",
      "C": "bg-yellow-100 text-yellow-800 border-yellow-200",
      "D": "bg-red-100 text-red-800 border-red-200",
    };
    return (
      <Badge className={colors[grade] || "bg-gray-100 text-gray-800"}>
        {grade}
      </Badge>
    );
  };
  
  // Render status badge
  const renderStatusBadge = (status: string) => {
    if (status === "ACERTOU") {
      return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Acerto</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>;
  };
  
  // Chart configurations
  const barChartConfig = {
    assertividade: {
      label: "Assertividade %",
      color: COLORS.primario,
    },
  };
  
  const lineChartConfig = {
    acuracia: {
      label: "Acurácia %",
      color: COLORS.primario,
    },
    acertos: {
      label: "Acertos",
      color: COLORS.acerto,
    },
  };
  
  if (isLoading && detalhes.length === 0) {
    return (
      <div className="flex flex-col min-h-full">
        <PageHeader
          title="Eficiência Avaliações IA"
          description="Análise comparativa entre classificações humanas e sugestões da Inteligência Artificial"
          breadcrumbs={[
            { label: "Logística", href: "/logistica/dashboard" },
            { label: "Eficiência Avaliações IA" }
          ]}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando dados...</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Eficiência Avaliações IA"
        description="Análise comparativa entre classificações humanas e sugestões da Inteligência Artificial"
        breadcrumbs={[
          { label: "Logística", href: "/logistica/dashboard" },
          { label: "Eficiência Avaliações IA" }
        ]}
      />
      
      <main className="flex-1 p-6 space-y-6">
        {/* Filtros */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtros
              </CardTitle>
              <Button onClick={fetchData} disabled={isLoading} size="sm">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="start-date">Data Inicial</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end-date">Data Final</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="device">Dispositivo</Label>
                <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                  <SelectTrigger id="device">
                    <SelectValue placeholder="Todos os dispositivos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os dispositivos</SelectItem>
                    {uniqueDevices.map(device => (
                      <SelectItem key={device} value={device}>{device}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ACERTOU">Acertos</SelectItem>
                    <SelectItem value="ERROU">Erros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                Total Avaliações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalAvaliacoes.toLocaleString("pt-BR")}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="w-4 h-4 text-green-500" />
                Assertividade Geral
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <span className={kpis.assertividadeGeral >= 85 ? "text-green-600" : "text-yellow-600"}>
                  {kpis.assertividadeGeral}%
                </span>
                {kpis.assertividadeGeral >= 85 ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-yellow-500" />
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Total Acertos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{kpis.totalAcertos.toLocaleString("pt-BR")}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                Total Erros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{kpis.totalErros.toLocaleString("pt-BR")}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                Concordância
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{kpis.concordancia}%</div>
            </CardContent>
          </Card>
        </div>
        
        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Evolução Temporal */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Evolução Temporal da Acurácia
              </CardTitle>
              <CardDescription>Acurácia mês a mês no período selecionado</CardDescription>
            </CardHeader>
            <CardContent>
              {evolucao.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={evolucao}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="Mes"
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
                      }}
                      className="text-xs"
                    />
                    <YAxis domain={[0, 100]} className="text-xs" />
                    <RechartsTooltip
                      formatter={(value: number) => [`${value}%`, "Acurácia"]}
                      labelFormatter={(label) => new Date(label).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                    />
                    <Area
                      type="monotone"
                      dataKey="Acuracia_Mensal"
                      stroke={COLORS.primario}
                      fill={COLORS.primario}
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <p>Sem dados para o período</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Assertividade por Grade */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Assertividade por Grade
              </CardTitle>
              <CardDescription>Percentual de acertos por grade do avaliador humano</CardDescription>
            </CardHeader>
            <CardContent>
              {resumo.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={resumo} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" domain={[0, 100]} className="text-xs" />
                    <YAxis type="category" dataKey="Grade_Humano_Real" width={40} className="text-xs" />
                    <RechartsTooltip
                      formatter={(value: number) => [`${value}%`, "Assertividade"]}
                    />
                    <Bar dataKey="Percentual_Assertividade" fill={COLORS.primario} radius={[0, 4, 4, 0]}>
                      {resumo.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.Percentual_Assertividade >= 85 ? COLORS.acerto : entry.Percentual_Assertividade >= 70 ? COLORS.terciario : COLORS.erro}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <p>Sem dados para o período</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Segundo Row de Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Acurácia por Dispositivo */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Top 10 Dispositivos
              </CardTitle>
              <CardDescription>Dispositivos com maior volume de avaliações</CardDescription>
            </CardHeader>
            <CardContent>
              {dispositivos.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dispositivos.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" domain={[0, 100]} className="text-xs" />
                    <YAxis
                      type="category"
                      dataKey="Dispositivo"
                      width={120}
                      className="text-xs"
                      tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 15)}...` : value}
                    />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => [
                        name === "Acuracia" ? `${value}%` : value,
                        name === "Acuracia" ? "Acurácia" : name === "Total_Avaliados" ? "Total" : name
                      ]}
                    />
                    <Bar dataKey="Acuracia" fill={COLORS.primario} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <p>Sem dados para o período</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Tabela de Resumo por Grade */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Resumo por Grade
              </CardTitle>
              <CardDescription>Detalhes de acertos e erros por classificação</CardDescription>
            </CardHeader>
            <CardContent>
              {resumo.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Grade</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Acertos</TableHead>
                        <TableHead className="text-right">% Acerto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resumo.map((row) => (
                        <TableRow key={row.Grade_Humano_Real}>
                          <TableCell className="font-medium">
                            {renderGradeBadge(row.Grade_Humano_Real)}
                          </TableCell>
                          <TableCell className="text-right">{row.Total_Avaliados}</TableCell>
                          <TableCell className="text-right text-green-600">{row.Qtd_Acertos_IA}</TableCell>
                          <TableCell className="text-right">
                            <span className={row.Percentual_Assertividade >= 85 ? "text-green-600 font-bold" : row.Percentual_Assertividade >= 70 ? "text-yellow-600 font-bold" : "text-red-600 font-bold"}>
                              {row.Percentual_Assertividade}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  <p>Sem dados para o período</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Alertas e Insights */}
        {alerts.length > 0 && (
          <Card className="shadow-sm border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                Alertas e Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.map((alert, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg flex items-start gap-3 ${
                      alert.type === "warning" ? "bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200" :
                      alert.type === "error" ? "bg-red-100 dark:bg-red-900/30 border border-red-200" :
                      "bg-blue-100 dark:bg-blue-900/30 border border-blue-200"
                    }`}
                  >
                    {alert.type === "warning" && <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />}
                    {alert.type === "error" && <XCircle className="w-5 h-5 text-red-600 shrink-0" />}
                    {alert.type === "info" && <Info className="w-5 h-5 text-blue-600 shrink-0" />}
                    <div>
                      <p className="font-medium text-sm">{alert.message}</p>
                      {alert.description && (
                        <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Tabela de Detalhes */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Detalhamento de Avaliações
              </CardTitle>
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
            <CardDescription>
              Lista completa das avaliações no período • {filteredDetalhes.length} registros
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IMEI</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-center">Grade Humano</TableHead>
                    <TableHead className="text-center">Grade IA</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDetalhes.length > 0 ? (
                    filteredDetalhes.slice(0, 100).map((detail, index) => (
                      <TableRow
                        key={`${detail.Imei}-${index}`}
                        className={detail.Status_Assertividade === "ERROU" ? "bg-red-50 dark:bg-red-900/10" : ""}
                      >
                        <TableCell className="font-mono text-xs">{detail.Imei || "N/A"}</TableCell>
                        <TableCell className="text-sm">{detail.Modelo}</TableCell>
                        <TableCell className="text-center">
                          {renderGradeBadge(detail.Grade_Humano)}
                        </TableCell>
                        <TableCell className="text-center">
                          {renderGradeBadge(detail.Grade_IA)}
                        </TableCell>
                        <TableCell className="text-center">
                          {renderStatusBadge(detail.Status_Assertividade)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(detail.Data_Avaliacao).toLocaleDateString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum dado encontrado para os filtros selecionados
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {filteredDetalhes.length > 100 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Mostrando os primeiros 100 registros de {filteredDetalhes.length} no total
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}