import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getCurrentUser } from "@/lib/permissions";
import { fetchWithAuth } from "@/lib/queryClient";
import { GiroEstoque } from "./components/giro-estoque";
import { CurvaABC } from "./components/curva-abc";
import { AgingReport } from "./components/aging-report";
import { Tendencias } from "./components/tendencias";
import { ErrorBoundary } from "@/components/error-boundary";

async function fetchJson(url: string) {
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  const data = await res.json();
  return data.data;
}

export default function EstoquesDashboardPage() {
  const user = getCurrentUser();
  const isAdmin = user?.isAdmin === true;

  const [periodoGiro, setPeriodoGiro] = useState<string>('90d');
  const [periodoTendencias, setPeriodoTendencias] = useState<string>('12m');

  const { data: giroData, isLoading: isLoadingGiro, isError: isErrorGiro, refetch: refetchGiro } = useQuery({
    queryKey: ['dashboard-giro', periodoGiro],
    queryFn: () => fetchJson(`/api/estoques/dashboard/giro?periodo=${periodoGiro}`),
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const { data: abcData, isLoading: isLoadingAbc, isError: isErrorAbc, refetch: refetchAbc } = useQuery({
    queryKey: ['dashboard-curva-abc'],
    queryFn: () => fetchJson('/api/estoques/dashboard/curva-abc'),
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const { data: agingData, isLoading: isLoadingAging, isError: isErrorAging, refetch: refetchAging } = useQuery({
    queryKey: ['dashboard-aging'],
    queryFn: () => fetchJson('/api/estoques/dashboard/aging'),
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const { data: tendenciasData, isLoading: isLoadingTendencias, isError: isErrorTendencias, refetch: refetchTendencias } = useQuery({
    queryKey: ['dashboard-tendencias', periodoTendencias],
    queryFn: () => fetchJson(`/api/estoques/dashboard/tendencias?periodo=${periodoTendencias}`),
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  function handleRefreshAll() {
    refetchGiro();
    refetchAbc();
    refetchAging();
    refetchTendencias();
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-6">
        <PageHeader
          title="Dashboard de Estoques"
          description="Métricas e análises para gestão de inventário"
        />
        <div className="flex items-center justify-center mt-8">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Acesso Restrito</AlertTitle>
            <AlertDescription>
              O Dashboard Analítico é exclusivo para administradores.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <PageHeader
        title="Dashboard de Estoques"
        description="Métricas e análises para gestão de inventário"
      />

      {/* Ações do header */}
      <div className="flex justify-end mb-6">
        <Button variant="outline" size="sm" onClick={handleRefreshAll} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar Dados
        </Button>
      </div>

      {/* Aviso global se todas as queries falharam */}
      {isErrorGiro && isErrorAbc && isErrorAging && isErrorTendencias && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar dashboard</AlertTitle>
          <AlertDescription>
            Não foi possível obter dados do Omie. Verifique a integração e tente novamente.
          </AlertDescription>
        </Alert>
      )}

      {/* Grid 2x2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ErrorBoundary>
          <GiroEstoque
            dados={giroData}
            isLoading={isLoadingGiro}
            isError={isErrorGiro}
            onRetry={refetchGiro}
            periodo={periodoGiro}
            onPeriodoChange={setPeriodoGiro}
          />
        </ErrorBoundary>

        <ErrorBoundary>
          <CurvaABC
            dados={abcData}
            isLoading={isLoadingAbc}
            isError={isErrorAbc}
            onRetry={refetchAbc}
          />
        </ErrorBoundary>

        <ErrorBoundary>
          <AgingReport
            dados={agingData}
            isLoading={isLoadingAging}
            isError={isErrorAging}
            onRetry={refetchAging}
          />
        </ErrorBoundary>

        <ErrorBoundary>
          <Tendencias
            dados={tendenciasData}
            isLoading={isLoadingTendencias}
            isError={isErrorTendencias}
            onRetry={refetchTendencias}
            periodo={periodoTendencias}
            onPeriodoChange={setPeriodoTendencias}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
