import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RefreshCw, ChevronLeft } from "lucide-react";
import { fetchWithAuth } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/permissions";
import { BuscaDispositivo } from "./components/busca-dispositivo";
import { InfoDispositivo } from "./components/info-dispositivo";
import { Timeline, type TimelineEvento } from "./components/timeline";
import { MetricasItem } from "./components/metricas-item";

// ── tipos ─────────────────────────────────────────────────────────────────────

interface DispositivoData {
  imei:       string;
  modelo:     string;
  categoria:  string;
  grade:      string | null;
  mesTradeIn: string;
}

interface OrigemData {
  voucher:      string;
  rede:         string;
  filial:       string;
  valorVoucher: number;
}

interface StatusAtualData {
  status:     string;
  nfVenda?:   string | null;
  valorVenda?: number;
  dataVenda?:  string | null;
}

interface MetricaBase { dias: number; meta: number; status: 'ok' | 'acima'; }

interface MetricasData {
  cicloTotal?:      MetricaBase | null;
  cicloPreEstoque?: MetricaBase | null;
  agingEstoque?:    MetricaBase | null;
  tempoEmDesvio?:   { dias: number; tipo: string | null } | null;
  margemBruta?:     { valor: number; percentual: number } | null;
}

interface RastreabilidadeData {
  dispositivo: DispositivoData;
  origem:      OrigemData;
  statusAtual: StatusAtualData;
  timeline:    TimelineEvento[];
  metricas:    MetricasData;
}

// ── fetcher ───────────────────────────────────────────────────────────────────

async function fetchTimeline(imei: string): Promise<RastreabilidadeData> {
  const res = await fetchWithAuth(`/api/estoques/rastreabilidade/${encodeURIComponent(imei)}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
  return json.data as RastreabilidadeData;
}

// ── componente principal ──────────────────────────────────────────────────────

export default function RastreabilidadePage() {
  const user    = getCurrentUser();
  const isAdmin = user?.isAdmin === true;

  const [imeiSelecionado, setImeiSelecionado] = useState<string | null>(null);

  const timelineQ = useQuery({
    queryKey:  ['rastreabilidade', imeiSelecionado],
    queryFn:   () => fetchTimeline(imeiSelecionado!),
    enabled:   isAdmin && !!imeiSelecionado,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // ── acesso restrito ────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-6">
        <PageHeader title="Rastreabilidade" description="Consulte a jornada completa de um dispositivo" />
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

  // ── tela de busca ──────────────────────────────────────────────────────────

  if (!imeiSelecionado) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <PageHeader
          title="Rastreabilidade"
          description="Consulte a jornada completa de um dispositivo — do voucher até a venda."
        />

        <Card className="max-w-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Buscar Dispositivo</CardTitle>
          </CardHeader>
          <CardContent>
            <BuscaDispositivo
              onResultado={setImeiSelecionado}
              isLoading={false}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── tela de resultado ──────────────────────────────────────────────────────

  const data    = timelineQ.data;
  const loading = timelineQ.isLoading;

  return (
    <div className="container mx-auto py-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 -ml-2 shrink-0"
            onClick={() => setImeiSelecionado(null)}
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </Button>
          <PageHeader
            title="Rastreabilidade"
            description={`IMEI: ${imeiSelecionado}`}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => timelineQ.refetch()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* ── Erro ── */}
      {timelineQ.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Dispositivo não encontrado</AlertTitle>
          <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
            {(timelineQ.error as any)?.message ?? 'Não foi possível carregar a timeline.'}
            <Button variant="outline" size="sm" onClick={() => setImeiSelecionado(null)}>
              Nova busca
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Info do Dispositivo ── */}
      {(loading || data) && !timelineQ.isError && (
        <>
          {loading ? (
            <Card>
              <CardContent className="py-8 flex items-center justify-center">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Buscando dados nas APIs…</span>
              </CardContent>
            </Card>
          ) : data && (
            <InfoDispositivo
              dispositivo={data.dispositivo}
              origem={data.origem}
              statusAtual={data.statusAtual}
            />
          )}
        </>
      )}

      {/* ── Timeline ── */}
      {!timelineQ.isError && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Timeline Completa</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline
              eventos={data?.timeline ?? []}
              isLoading={loading}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Métricas ── */}
      {!timelineQ.isError && (loading || data) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Métricas deste Item</CardTitle>
          </CardHeader>
          <CardContent>
            <MetricasItem
              metricas={data?.metricas ?? {}}
              isLoading={loading}
            />
          </CardContent>
        </Card>
      )}

    </div>
  );
}
