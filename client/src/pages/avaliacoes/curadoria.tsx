import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  ClipboardList,
  LayoutDashboard,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  useCuradoriaPendentes,
  useSaveCuradoria,
  useAvaliacoesConfiguracoes,
  type CuradoriaPayload,
} from "@/hooks/use-avaliacoes";
import { CurationImageViewer } from "@/components/avaliacoes/curation-image-viewer";
import { CurationCard } from "@/components/avaliacoes/curation-card";

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CuradoriaLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-full rounded-full" />
      <div className="grid grid-cols-1 lg:grid-cols-[58%_40%] gap-6">
        <Skeleton className="h-[460px] rounded-xl" />
        <Skeleton className="h-[460px] rounded-xl" />
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ percentual }: { percentual: string }) {
  const [, navigate] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
      <ClipboardList className="h-16 w-16 text-muted-foreground/40" />
      <div>
        <h3 className="text-lg font-semibold">Nenhum trade-in pendente para curadoria hoje</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Os trade-ins do dia anterior serão disponibilizados amanhã com base na amostragem configurada
          ({percentual}%).
        </p>
      </div>
      <Button onClick={() => navigate("/avaliacoes/dashboard")} variant="outline" className="gap-2">
        <LayoutDashboard className="h-4 w-4" />
        Ver Dashboard
      </Button>
    </div>
  );
}

// ─── Conclusão ────────────────────────────────────────────────────────────────

function ConclusaoState({ curados, pulados }: { curados: number; pulados: number }) {
  const [, navigate] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
      <CheckCircle2 className="h-20 w-20 text-[#00A137]" />
      <div>
        <h3 className="text-2xl font-bold">Curadoria completa!</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Você curou <strong>{curados}</strong> trade-in{curados !== 1 ? "s" : ""} hoje
          {pulados > 0 && (
            <>
              {" "}
              · <span className="text-muted-foreground">{pulados} pulado{pulados !== 1 ? "s" : ""}</span>
            </>
          )}
        </p>
      </div>
      <Button
        onClick={() => navigate("/avaliacoes/dashboard")}
        className="gap-2 bg-[#00A137] hover:bg-[#048E33] text-white"
      >
        <LayoutDashboard className="h-4 w-4" />
        Voltar ao Dashboard
      </Button>
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
      <AlertCircle className="h-16 w-16 text-red-500/60" />
      <div>
        <h3 className="text-lg font-semibold">Erro ao carregar trade-ins</h3>
        <p className="text-sm text-muted-foreground mt-1">Não foi possível conectar ao servidor.</p>
      </div>
      <Button onClick={onRetry} variant="outline" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Tentar Novamente
      </Button>
    </div>
  );
}

// ─── Barra de progresso ───────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const restam = total - current;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          Curadoria: {current} de {total}
        </span>
        <span className="text-muted-foreground text-xs">
          {restam > 0 ? `Restam ${restam}` : "Todos curados"}
        </span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AvaliacoesCuradoriaPage() {
  const { toast } = useToast();
  const {
    data: pendentesData,
    isLoading,
    isError,
    refetch,
  } = useCuradoriaPendentes();
  const { data: configData } = useAvaliacoesConfiguracoes();
  const saveMutation = useSaveCuradoria();

  const tradeIns = pendentesData?.data ?? [];
  const percentual = configData?.data?.percentualAmostragem ?? "15";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [curadosCount, setCuradosCount] = useState(0);
  const [puladosCount, setPuladosCount] = useState(0);

  const concluido = !isLoading && !isError && tradeIns.length > 0 && currentIndex >= tradeIns.length;
  const tradeInAtual = tradeIns[currentIndex];

  const handleConfirm = useCallback(
    async (dados: CuradoriaPayload) => {
      try {
        await saveMutation.mutateAsync(dados);
        const novoCurados = curadosCount + 1;
        setCuradosCount(novoCurados);
        setCurrentIndex((i) => i + 1);
        toast({
          title: "Curadoria salva!",
          description: `(${novoCurados} de ${tradeIns.length})`,
        });
      } catch {
        toast({
          title: "Erro ao salvar",
          description: "Não foi possível salvar a curadoria. Tente novamente.",
          variant: "destructive",
        });
      }
    },
    [saveMutation, curadosCount, tradeIns.length, toast]
  );

  const handleSkip = useCallback(() => {
    setPuladosCount((p) => p + 1);
    setCurrentIndex((i) => i + 1);
    toast({
      description: "Trade-in pulado",
    });
  }, [toast]);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Avaliações — Curadoria" />

      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-5">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/avaliacoes/dashboard">Avaliações</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Curadoria</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {isLoading ? (
          <CuradoriaLoadingSkeleton />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : tradeIns.length === 0 ? (
          <EmptyState percentual={percentual} />
        ) : concluido ? (
          <ConclusaoState curados={curadosCount} pulados={puladosCount} />
        ) : (
          <div className="flex flex-col gap-5 mt-0">
            {/* Progresso */}
            <ProgressBar current={currentIndex} total={tradeIns.length} />

            {/* Layout principal */}
            <div className="grid grid-cols-1 lg:grid-cols-[58%_40%] gap-6 items-start">
              {/* Coluna esquerda: imagens */}
              <div className="lg:sticky lg:top-4">
                <CurationImageViewer
                  imagens={{
                    frontal: tradeInAtual.imagemFrontal,
                    traseira: tradeInAtual.imagemTraseira,
                    lateral1: tradeInAtual.imagemLateral1,
                    lateral2: tradeInAtual.imagemLateral2,
                    detalhe: tradeInAtual.imagemDetalhe,
                  }}
                  linkFotos={tradeInAtual.linkFotos}
                />
              </div>

              {/* Coluna direita: card de curadoria */}
              <div>
                <CurationCard
                  key={tradeInAtual.tradeInId}
                  tradeIn={tradeInAtual}
                  onConfirm={handleConfirm}
                  onSkip={handleSkip}
                  isSubmitting={saveMutation.isPending}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
