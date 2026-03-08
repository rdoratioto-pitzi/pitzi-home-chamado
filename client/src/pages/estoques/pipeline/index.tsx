import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, AlertCircle, Warehouse, TrendingUp } from "lucide-react";
import { fetchWithAuth } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/permissions";
import { FunilCards } from "./components/funil-cards";
import { DesviosCards } from "./components/desvios-cards";
import { TabelaEtapa } from "./components/tabela-etapa";

interface PipelineData {
  etapas: Array<{
    nome: string;
    quantidade: number;
    valor: number;
    porMes: Record<string, number>;
    criticos: number;
  }>;
  desvios: Array<{
    nome: string;
    quantidade: number;
    valor: number;
    porMes: Record<string, number>;
    criticos: number;
  }>;
  totais: {
    emTransito: { quantidade: number; valor: number };
    emEstoque: { quantidade: number; valor: number };
  };
}

async function fetchPipeline(): Promise<PipelineData> {
  const res = await fetchWithAuth("/api/estoques/pipeline");
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  const json = await res.json();
  return json.data;
}

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function PipelinePage() {
  const user = getCurrentUser();
  const isAdmin = user?.isAdmin === true;

  const [etapaAberta, setEtapaAberta] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["pipeline"],
    queryFn: fetchPipeline,
    enabled: isAdmin,
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-6">
        <PageHeader title="Pipeline de Dispositivos" description="Visão do funil de dispositivos por etapa" />
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

  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Pipeline de Dispositivos"
          description="Quantos dispositivos tenho em cada etapa da jornada?"
        />
        <div className="flex flex-col items-end gap-1 shrink-0">
          {updatedAt && <p className="text-xs text-muted-foreground">Atualizado: {updatedAt}</p>}
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar pipeline</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            Não foi possível obter dados das APIs. Verifique a conexão.
            <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Funil principal */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Pré-Estoque (Trânsito)
        </h3>
        <FunilCards
          etapas={data?.etapas ?? []}
          isLoading={isLoading}
          onClickEtapa={setEtapaAberta}
        />
      </div>

      {/* Desvios */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Desvios Transitórios
        </h3>
        <DesviosCards
          desvios={data?.desvios ?? []}
          isLoading={isLoading}
          onClickDesvio={setEtapaAberta}
        />
      </div>

      {/* Totais consolidados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </>
        ) : (
          <>
            <Card className="border-blue-200 dark:border-blue-900">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total em Trânsito (Pré-Estoque)</p>
                  <p className="text-xl font-bold tabular-nums">
                    {(data?.totais.emTransito.quantidade ?? 0).toLocaleString("pt-BR")} dispositivos
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(data?.totais.emTransito.valor ?? 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-green-200 dark:border-green-900">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center shrink-0">
                  <Warehouse className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total em Estoque (Pós-Triagem)</p>
                  <p className="text-xl font-bold tabular-nums">
                    {(data?.totais.emEstoque.quantidade ?? 0).toLocaleString("pt-BR")} dispositivos
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(data?.totais.emEstoque.valor ?? 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Drawer de drill-down */}
      <TabelaEtapa etapa={etapaAberta} onClose={() => setEtapaAberta(null)} />
    </div>
  );
}
