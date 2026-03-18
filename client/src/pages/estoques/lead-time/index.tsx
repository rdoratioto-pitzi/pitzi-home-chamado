import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, AlertCircle } from "lucide-react";
import { fetchWithAuth } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
import { CiclosCards } from "./components/ciclos-cards";
import { MetricasTabela } from "./components/metricas-tabela";
import { TendenciaChart } from "./components/tendencia-chart";

const PERIODOS = [
  { value: "30d", label: "30 dias" },
  { value: "60d", label: "60 dias" },
  { value: "90d", label: "90 dias" },
];

interface LeadTimeData {
  ciclos: {
    total:        { media: number; p50: number; p90: number; min: number; max: number; meta: number };
    preEstoque:   { media: number; p50: number; p90: number; min: number; max: number; meta: number };
    agingEstoque: { media: number; p50: number; p90: number; min: number; max: number; meta: number };
  };
  etapas: Array<{ nome: string; label: string; media: number; p50: number; p90: number; min: number; max: number; meta: number }>;
  desvios: Array<{ nome: string; label: string; media: number; p50: number; p90: number; min: number; max: number }>;
  periodo: string;
  totalAmostras: number;
}

interface TendenciaData {
  semana: string;
  cicloTotal: number;
  preEstoque: number;
  agingEstoque: number;
  amostras: number;
}

async function fetchLeadTime(periodo: string): Promise<LeadTimeData> {
  const res = await fetchWithAuth(`/api/estoques/lead-time?periodo=${periodo}`);
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function fetchTendencia(): Promise<TendenciaData[]> {
  const res = await fetchWithAuth("/api/estoques/lead-time/tendencia");
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  const json = await res.json();
  return json.data ?? [];
}

export default function LeadTimePage() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin === true;

  const [periodo, setPeriodo] = useState("30d");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["lead-time", periodo],
    queryFn: () => fetchLeadTime(periodo),
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const { data: tendencia, isLoading: isLoadingTendencia } = useQuery({
    queryKey: ["lead-time-tendencia"],
    queryFn: fetchTendencia,
    enabled: isAdmin,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-6">
        <PageHeader title="Lead Time Analytics" description="Métricas de tempo por etapa da jornada do dispositivo" />
        <div className="flex items-center justify-center mt-8">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Acesso Restrito</AlertTitle>
            <AlertDescription>Esta tela é exclusiva para administradores.</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Lead Time Analytics"
          description="Qual o tempo médio em cada etapa da jornada do dispositivo?"
        />
        <div className="flex items-center gap-2 shrink-0">
          {/* Seletor de período */}
          <div className="flex items-center rounded-lg border bg-background overflow-hidden">
            {PERIODOS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriodo(p.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  periodo === p.value
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {data && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {data.totalAmostras.toLocaleString("pt-BR")} amostras no período
          </Badge>
          <Badge variant="outline" className="text-xs">
            Período: {PERIODOS.find(p => p.value === periodo)?.label}
          </Badge>
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar lead time</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            Não foi possível obter dados das APIs.
            <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Ciclos cards */}
      <CiclosCards ciclos={data?.ciclos} isLoading={isLoading} />

      {/* Tabela de métricas por etapa */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Métricas por Etapa</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <MetricasTabela
            etapas={data?.etapas ?? []}
            desvios={data?.desvios ?? []}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Gráfico de tendência */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tendência de Lead Time</CardTitle>
        </CardHeader>
        <CardContent>
          <TendenciaChart dados={tendencia} isLoading={isLoadingTendencia} />
        </CardContent>
      </Card>
    </div>
  );
}
