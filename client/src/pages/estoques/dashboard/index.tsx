import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, AlertCircle, LayoutDashboard, Warehouse } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/permissions";
import { fetchWithAuth } from "@/lib/queryClient";
import { ErrorBoundary } from "@/components/error-boundary";

import { KpiVolume }          from "./components/kpi-volume";
import { KpiTempo }           from "./components/kpi-tempo";
import { KpiFinanceiro }      from "./components/kpi-financeiro";
import { KpiEficiencia }      from "./components/kpi-eficiencia";
import { GraficosExecutivo }  from "./components/graficos-executivo";
import { AgingEstoque }       from "./components/aging-estoque";
import { Tendencias }         from "./components/tendencias";
import { LinksRapidos }       from "./components/links-rapidos";

// ── fetcher helper ──────────────────────────────────────────────────────────

async function fetchJson(url: string) {
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return (await res.json()).data;
}

// ── sub-views ────────────────────────────────────────────────────────────────

function VisaoExecutiva({ periodo }: { periodo: string }) {
  const opts = { staleTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 2 };

  const { data: volume,     isLoading: lVolume,     isError: eVolume,     refetch: rVolume }     = useQuery({ queryKey: ["dash-volume",     periodo], queryFn: () => fetchJson(`/api/estoques/dashboard/volume?periodo=${periodo}`),     ...opts });
  const { data: tempo,      isLoading: lTempo,      isError: eTempo,      refetch: rTempo }       = useQuery({ queryKey: ["dash-tempo",      periodo], queryFn: () => fetchJson(`/api/estoques/dashboard/tempo?periodo=${periodo}`),      ...opts });
  const { data: financeiro, isLoading: lFinanceiro, isError: eFinanceiro, refetch: rFinanceiro }  = useQuery({ queryKey: ["dash-financeiro", periodo], queryFn: () => fetchJson(`/api/estoques/dashboard/financeiro?periodo=${periodo}`), ...opts });
  const { data: eficiencia, isLoading: lEficiencia, isError: eEficiencia, refetch: rEficiencia }  = useQuery({ queryKey: ["dash-eficiencia", periodo], queryFn: () => fetchJson(`/api/estoques/dashboard/eficiencia?periodo=${periodo}`), ...opts });
  const { data: graficos,   isLoading: lGraficos,   isError: eGraficos,   refetch: rGraficos }    = useQuery({ queryKey: ["dash-graficos",   periodo], queryFn: () => fetchJson(`/api/estoques/dashboard/graficos?periodo=${periodo}`),   ...opts });

  const allError = eVolume && eTempo && eFinanceiro && eEficiencia && eGraficos;

  function refetchAll() {
    rVolume(); rTempo(); rFinanceiro(); rEficiencia(); rGraficos();
  }

  return (
    <div className="space-y-6">
      {allError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar KPIs</AlertTitle>
          <AlertDescription className="flex items-center gap-2">
            Não foi possível obter dados. Verifique a integração e
            <button onClick={refetchAll} className="underline text-sm">tente novamente</button>.
          </AlertDescription>
        </Alert>
      )}

      <ErrorBoundary><KpiVolume     dados={volume}     isLoading={lVolume} /></ErrorBoundary>
      <Separator />
      <ErrorBoundary><KpiTempo      dados={tempo}      isLoading={lTempo} /></ErrorBoundary>
      <Separator />
      <ErrorBoundary><KpiFinanceiro dados={financeiro} isLoading={lFinanceiro} /></ErrorBoundary>
      <Separator />
      <ErrorBoundary><KpiEficiencia dados={eficiencia} isLoading={lEficiencia} /></ErrorBoundary>
      <Separator />
      <ErrorBoundary><GraficosExecutivo dados={graficos} isLoading={lGraficos} /></ErrorBoundary>
    </div>
  );
}

function VisaoEstoque({ periodo }: { periodo: string }) {
  const opts = { staleTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 2 };

  const { data: aging,      isLoading: lAging,      isError: eAging,      refetch: rAging }      = useQuery({ queryKey: ["dash-aging-estoque"],          queryFn: () => fetchJson("/api/estoques/dashboard/aging-estoque"),             ...opts });
  const { data: tendencias, isLoading: lTendencias, isError: eTendencias, refetch: rTendencias }  = useQuery({ queryKey: ["dash-tendencias-exec", periodo], queryFn: () => fetchJson(`/api/estoques/dashboard/tendencias?periodo=${periodo}`), ...opts });

  return (
    <div className="space-y-6">
      {eAging && eTendencias && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar dados</AlertTitle>
          <AlertDescription className="flex items-center gap-2">
            Não foi possível obter dados do estoque.
            <button onClick={() => { rAging(); rTendencias(); }} className="underline text-sm">
              Tentar novamente
            </button>
          </AlertDescription>
        </Alert>
      )}

      <ErrorBoundary>
        <AgingEstoque dados={aging} isLoading={lAging} />
      </ErrorBoundary>

      <Separator />

      <ErrorBoundary>
        <Tendencias
          dados={tendencias}
          isLoading={lTendencias}
          isError={eTendencias}
          onRetry={rTendencias}
          periodo={periodo === "30d" ? "6m" : periodo === "60d" ? "6m" : "12m"}
          onPeriodoChange={() => {}}
        />
      </ErrorBoundary>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function EstoquesDashboardPage() {
  const user    = getCurrentUser();
  const isAdmin = user?.isAdmin === true;

  const [tab,    setTab]    = useState<string>("executiva");
  const [periodo, setPeriodo] = useState<string>("30d");

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-6">
        <PageHeader
          title="Dashboard de Estoques"
          description="Visão consolidada com KPIs macro e análise de estoque"
        />
        <div className="flex items-center justify-center mt-8">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Acesso Restrito</AlertTitle>
            <AlertDescription>
              O Dashboard de Estoques é exclusivo para administradores.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-4">
      <PageHeader
        title="Dashboard de Estoques"
        description="Visão consolidada com KPIs macro e análise de estoque"
      />

      {/* Barra de controles: tabs + período + refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Tabs value={tab} onValueChange={setTab} className="w-auto">
          <TabsList>
            <TabsTrigger value="executiva" className="flex items-center gap-1.5">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Visão Executiva
            </TabsTrigger>
            <TabsTrigger value="estoque" className="flex items-center gap-1.5">
              <Warehouse className="h-3.5 w-3.5" />
              Visão Estoque
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="60d">Últimos 60 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
            onClick={() => window.location.reload()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Conteúdo das abas */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsContent value="executiva" className="mt-0">
          <VisaoExecutiva periodo={periodo} />
        </TabsContent>
        <TabsContent value="estoque" className="mt-0">
          <VisaoEstoque periodo={periodo} />
        </TabsContent>
      </Tabs>

      {/* Links rápidos */}
      <Separator />
      <LinksRapidos />
    </div>
  );
}
