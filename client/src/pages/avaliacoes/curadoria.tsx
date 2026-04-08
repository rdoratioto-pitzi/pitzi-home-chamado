import { useState, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Loader2,
  SkipForward,
  Filter,
} from "lucide-react";
import {
  useCuradoriaPendentes,
  useSaveCuradoria,
  useAvaliacoesConfiguracoes,
  type CuradoriaPayload,
  type CuradoriaFiltros,
  type Grade,
  type FotoAvaliacao,
  type TradeInAvaliacao,
} from "@/hooks/use-avaliacoes";
import { CurationPhotoCard } from "@/components/avaliacoes/curation-photo-card";
import { ReviewerFlag } from "@/components/avaliacoes/reviewer-flag";

// ─── Grade helpers ───────────────────────────────────────────────────────────

const GRADE_ORDER: Record<string, number> = { A: 0, B: 1, C: 2 };

function worstGrade(grades: (Grade | null)[]): Grade | null {
  const valid = grades.filter((g): g is Grade => g !== null);
  if (valid.length === 0) return null;
  return valid.reduce((worst, g) =>
    (GRADE_ORDER[g] ?? 0) > (GRADE_ORDER[worst] ?? 0) ? g : worst
  );
}

const GRADE_BADGE: Record<Grade, string> = {
  A: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border-green-300 dark:border-green-700",
  B: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-300 dark:border-amber-700",
  C: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-300 dark:border-red-700",
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CuradoriaLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-full rounded-full" />
      <Skeleton className="h-[200px] rounded-xl" />
      <Skeleton className="h-[200px] rounded-xl" />
      <Skeleton className="h-[200px] rounded-xl" />
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
        <h3 className="text-lg font-semibold">Nenhum trade-in pendente para curadoria</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Os trade-ins serão disponibilizados com base na amostragem configurada ({percentual}%).
          Tente ajustar o filtro de datas.
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
          Você curou <strong>{curados}</strong> trade-in{curados !== 1 ? "s" : ""}
          {pulados > 0 && (
            <>
              {" · "}
              <span className="text-muted-foreground">{pulados} pulado{pulados !== 1 ? "s" : ""}</span>
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

// ─── Progress bar ─────────────────────────────────────────────────────────────

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

// ─── Filters ──────────────────────────────────────────────────────────────────

function CuradoriaFilters({
  filtros,
  onApply,
}: {
  filtros: CuradoriaFiltros;
  onApply: (f: CuradoriaFiltros) => void;
}) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(filtros.startDate || yesterdayStr);
  const [endDate, setEndDate] = useState(filtros.endDate || todayStr);
  const [categoria, setCategoria] = useState(filtros.categoria || "todas");

  function handleApply() {
    onApply({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      categoria: categoria === "todas" ? undefined : categoria,
    });
  }

  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Data Início</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[150px] h-9 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Data Fim</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[150px] h-9 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="SmartphoneV2">Smartphone</SelectItem>
                <SelectItem value="iPhoneV2">iPhone</SelectItem>
                <SelectItem value="Console">Console</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleApply} size="sm" className="gap-1.5 h-9">
            <Filter className="h-3.5 w-3.5" />
            Filtrar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Device header ────────────────────────────────────────────────────────────

function DeviceHeader({ tradeIn }: { tradeIn: TradeInAvaliacao }) {
  const CATEGORIA_LABEL: Record<string, string> = {
    iphone: "iPhone",
    smartphone: "Smartphone",
    console: "Console",
  };

  return (
    <div className="flex items-start justify-between gap-2 flex-wrap">
      <div>
        <h2 className="text-xl font-bold leading-tight">{tradeIn.modelo || "Dispositivo"}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          IMEI: {tradeIn.imei || "—"} · {CATEGORIA_LABEL[tradeIn.categoria] ?? tradeIn.categoria}
        </p>
      </div>
      <span className="text-xs text-muted-foreground">
        {tradeIn.dataTradeIn ? new Date(tradeIn.dataTradeIn).toLocaleString("pt-BR") : "—"}
      </span>
    </div>
  );
}

// ─── Area summary badge ──────────────────────────────────────────────────────

function AreaGradeBadge({ label, grade }: { label: string; grade: Grade | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{label}:</span>
      {grade ? (
        <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-bold ${GRADE_BADGE[grade]}`}>
          {grade}
        </span>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AvaliacoesCuradoriaPage() {
  const { toast } = useToast();

  // Filters
  const [filtros, setFiltros] = useState<CuradoriaFiltros>({});
  const {
    data: pendentesData,
    isLoading,
    isError,
    refetch,
  } = useCuradoriaPendentes(filtros);
  const { data: configData } = useAvaliacoesConfiguracoes();
  const saveMutation = useSaveCuradoria();

  const tradeIns = pendentesData?.data ?? [];
  const totalPendentes = pendentesData?.total ?? 0;
  const percentual = configData?.data?.percentualAmostragem ?? "15";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [curadosCount, setCuradosCount] = useState(0);
  const [puladosCount, setPuladosCount] = useState(0);

  // Per-photo grades state: { slotNumber: grade }
  const [gradesPorFoto, setGradesPorFoto] = useState<Record<number, Grade>>({});
  const [revisaoAtiva, setRevisaoAtiva] = useState(false);
  const [revisaoTipo, setRevisaoTipo] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [showValidation, setShowValidation] = useState(false);

  const concluido = !isLoading && !isError && tradeIns.length > 0 && currentIndex >= tradeIns.length;
  const tradeInAtual = tradeIns[currentIndex];

  // Calculate area grades from per-photo curator grades
  const { gradeDisplay, gradeCarcaca } = useMemo(() => {
    if (!tradeInAtual) return { gradeDisplay: null, gradeCarcaca: null };
    const fotos = tradeInAtual.fotos ?? [];

    const displayGrades = fotos
      .filter((f) => f.area === "display")
      .map((f) => gradesPorFoto[f.slot] ?? null);

    const carcacaGrades = fotos
      .filter((f) => f.area === "carcaca")
      .map((f) => gradesPorFoto[f.slot] ?? null);

    return {
      gradeDisplay: worstGrade(displayGrades),
      gradeCarcaca: worstGrade(carcacaGrades),
    };
  }, [tradeInAtual, gradesPorFoto]);

  // Check if all photos with URLs have been graded
  const fotosComUrl = useMemo(() => {
    if (!tradeInAtual) return [];
    return (tradeInAtual.fotos ?? []).filter((f) => f.url !== null);
  }, [tradeInAtual]);

  const allGraded = fotosComUrl.every((f) => gradesPorFoto[f.slot] != null);
  const canConfirm = allGraded && fotosComUrl.length > 0;

  function resetFormState() {
    setGradesPorFoto({});
    setRevisaoAtiva(false);
    setRevisaoTipo(null);
    setObservacao("");
    setShowValidation(false);
  }

  const handleConfirm = useCallback(async () => {
    if (!canConfirm || !tradeInAtual) {
      setShowValidation(true);
      return;
    }

    const payload: CuradoriaPayload = {
      tradeInId: tradeInAtual.tradeInId,
      imei: tradeInAtual.imei,
      modelo: tradeInAtual.modelo,
      categoria: tradeInAtual.categoria,
      gradeIaDisplay: tradeInAtual.gradeIaDisplay,
      gradeIaCarcaca: tradeInAtual.gradeIaCarcaca,
      gradeHumanoDisplay: tradeInAtual.gradeHumanoDisplay,
      gradeHumanoCarcaca: tradeInAtual.gradeHumanoCarcaca,
      avaliadorHumanoId: tradeInAtual.avaliadorHumanoId,
      precoMaximo: tradeInAtual.precoMaximo,
      dataTradeIn: tradeInAtual.dataTradeIn,
      imagemFrontal: tradeInAtual.imagemFrontal,
      imagemTraseira: tradeInAtual.imagemTraseira,
      imagemLateral1: tradeInAtual.imagemLateral1,
      imagemLateral2: tradeInAtual.imagemLateral2,
      imagemDetalhe: tradeInAtual.imagemDetalhe,
      gradeCorretaDisplay: gradeDisplay,
      gradeCorretaCarcaca: gradeCarcaca,
      gradesPorFoto: Object.fromEntries(
        Object.entries(gradesPorFoto).map(([k, v]) => [String(k), v])
      ),
      revisaoAvaliador: revisaoAtiva,
      revisaoTipo: revisaoAtiva ? revisaoTipo : null,
      observacao: observacao.trim() || null,
    };

    try {
      await saveMutation.mutateAsync(payload);
      const novoCurados = curadosCount + 1;
      setCuradosCount(novoCurados);
      setCurrentIndex((i) => i + 1);
      resetFormState();
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
  }, [canConfirm, tradeInAtual, gradeDisplay, gradeCarcaca, gradesPorFoto, revisaoAtiva, revisaoTipo, observacao, saveMutation, curadosCount, tradeIns.length, toast]);

  const handleSkip = useCallback(() => {
    setPuladosCount((p) => p + 1);
    setCurrentIndex((i) => i + 1);
    resetFormState();
    toast({ description: "Trade-in pulado" });
  }, [toast]);

  function handleFotoGradeChange(slot: number, grade: Grade) {
    setGradesPorFoto((prev) => ({ ...prev, [slot]: grade }));
  }

  function handleFilterApply(f: CuradoriaFiltros) {
    setFiltros(f);
    setCurrentIndex(0);
    setCuradosCount(0);
    setPuladosCount(0);
    resetFormState();
  }

  // Separate photos by area
  const displayFotos = tradeInAtual?.fotos?.filter((f) => f.area === "display") ?? [];
  const carcacaFotos = tradeInAtual?.fotos?.filter((f) => f.area === "carcaca") ?? [];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Avaliações — Curadoria" />

      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-5">
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

        {/* Filters */}
        <CuradoriaFilters filtros={filtros} onApply={handleFilterApply} />

        {isLoading ? (
          <CuradoriaLoadingSkeleton />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : tradeIns.length === 0 ? (
          <EmptyState percentual={percentual} />
        ) : concluido ? (
          <ConclusaoState curados={curadosCount} pulados={puladosCount} />
        ) : (
          <div className="flex flex-col gap-5">
            {/* Sticky progress bar */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 pt-1 -mx-1 px-1">
              <ProgressBar current={currentIndex} total={tradeIns.length} />
              {totalPendentes > tradeIns.length && (
                <p className="text-xs text-muted-foreground mt-1">
                  Total pendentes: {totalPendentes} · Amostra: {tradeIns.length}
                </p>
              )}
            </div>

            {/* Device header */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <DeviceHeader tradeIn={tradeInAtual} />
              </CardContent>
            </Card>

            {/* ═══ DISPLAY & TELA ═══ */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-sm font-bold text-muted-foreground whitespace-nowrap">
                  DISPLAY & TELA (fotos 1-2)
                </span>
                <Separator className="flex-1" />
              </div>

              {displayFotos.map((foto) => (
                <CurationPhotoCard
                  key={foto.slot}
                  foto={foto}
                  gradeCurador={gradesPorFoto[foto.slot] ?? null}
                  onGradeChange={(g) => handleFotoGradeChange(foto.slot, g)}
                  highlight={showValidation}
                />
              ))}

              {/* Display area grade */}
              <div className="flex justify-center py-2">
                <AreaGradeBadge label="Grade Display" grade={gradeDisplay} />
              </div>
            </div>

            {/* ═══ CARCAÇA ═══ */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-sm font-bold text-muted-foreground whitespace-nowrap">
                  CARCAÇA (fotos 3-7)
                </span>
                <Separator className="flex-1" />
              </div>

              {carcacaFotos.map((foto) => (
                <CurationPhotoCard
                  key={foto.slot}
                  foto={foto}
                  gradeCurador={gradesPorFoto[foto.slot] ?? null}
                  onGradeChange={(g) => handleFotoGradeChange(foto.slot, g)}
                  highlight={showValidation}
                />
              ))}

              {/* Carcaça area grade */}
              <div className="flex justify-center py-2">
                <AreaGradeBadge label="Grade Carcaça" grade={gradeCarcaca} />
              </div>
            </div>

            {/* ═══ RESUMO ═══ */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-center gap-8 py-3 rounded-lg bg-muted/30 border border-border">
                    <AreaGradeBadge label="Display & Tela" grade={gradeDisplay} />
                    <div className="h-8 w-px bg-border" />
                    <AreaGradeBadge label="Carcaça" grade={gradeCarcaca} />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    Calculado automaticamente da pior nota por área
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ═══ REVISÃO + OBSERVAÇÃO ═══ */}
            <Card>
              <CardContent className="pt-4 pb-4 flex flex-col gap-4">
                <ReviewerFlag
                  enabled={revisaoAtiva}
                  tipo={revisaoTipo}
                  onToggle={(enabled) => {
                    setRevisaoAtiva(enabled);
                    if (!enabled) setRevisaoTipo(null);
                  }}
                  onTipoChange={setRevisaoTipo}
                />

                <Separator />

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Observação</label>
                    <span className="text-xs text-muted-foreground">{observacao.length}/500</span>
                  </div>
                  <Textarea
                    placeholder="Observação opcional..."
                    maxLength={500}
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    rows={3}
                    className="resize-none text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Validation message */}
            {showValidation && !canConfirm && (
              <p className="text-sm text-red-500 font-medium text-center">
                Avalie todas as fotos disponíveis antes de confirmar.
              </p>
            )}

            {/* ═══ STICKY ACTION BAR ═══ */}
            <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm py-3 -mx-1 px-1 border-t border-border">
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-[#00A137] hover:bg-[#048E33] text-white"
                  onClick={handleConfirm}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Confirmar Curadoria
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleSkip} disabled={saveMutation.isPending} className="gap-2">
                  <SkipForward className="h-4 w-4" />
                  Pular
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
