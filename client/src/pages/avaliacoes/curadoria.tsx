import { useState, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
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

const GRADE_BADGE_COLORS: Record<Grade, string> = {
  A: "bg-[#0F6E56] text-white",
  B: "bg-[#BA7517] text-white",
  C: "bg-[#A32D2D] text-white",
};

const CURADORIA_MIN_START_DATE = "2026-04-23";

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CuradoriaLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-full rounded-full" />
      <div className="flex gap-4">
        <Skeleton className="h-[300px] flex-[35%] rounded-xl" />
        <Skeleton className="h-[300px] flex-[65%] rounded-xl" />
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
        <h3 className="text-lg font-semibold">Nenhum trade-in pendente para curadoria</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Os trade-ins serao disponibilizados com base na amostragem configurada ({percentual}%).
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

// ─── Conclusao ────────────────────────────────────────────────────────────────

function ConclusaoState({ curados, pulados }: { curados: number; pulados: number }) {
  const [, navigate] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
      <CheckCircle2 className="h-20 w-20 text-[#00A137]" />
      <div>
        <h3 className="text-2xl font-bold">Curadoria completa!</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Voce curou <strong>{curados}</strong> trade-in{curados !== 1 ? "s" : ""}
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
        <p className="text-sm text-muted-foreground mt-1">Nao foi possivel conectar ao servidor.</p>
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

  const [startDate, setStartDate] = useState(filtros.startDate || CURADORIA_MIN_START_DATE);
  const [endDate, setEndDate] = useState(filtros.endDate || todayStr);
  const [categoria, setCategoria] = useState(filtros.categoria || "todas");
  const [imei, setImei] = useState(filtros.imei || "");
  const [voucher, setVoucher] = useState(filtros.voucher || "");

  function handleApply() {
    onApply({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      categoria: categoria === "todas" ? undefined : categoria,
      imei: imei.trim() || undefined,
      voucher: voucher.trim() || undefined,
    });
  }

  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Data Inicio</Label>
            <Input
              type="date"
              value={startDate}
              min={CURADORIA_MIN_START_DATE}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[150px] h-9 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Data Fim</Label>
            <Input
              type="date"
              value={endDate}
              min={CURADORIA_MIN_START_DATE}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[150px] h-9 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">IMEI</Label>
            <Input
              type="text"
              value={imei}
              onChange={(e) => setImei(e.target.value)}
              placeholder="Buscar IMEI..."
              className="w-[160px] h-9 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Voucher</Label>
            <Input
              type="text"
              value={voucher}
              onChange={(e) => setVoucher(e.target.value)}
              placeholder="Buscar voucher..."
              className="w-[160px] h-9 text-sm"
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

// ─── Device header (compact) ─────────────────────────────────────────────────

const CATEGORIA_LABEL: Record<string, string> = {
  iphone: "iPhone",
  iphonev2: "iPhone",
  smartphone: "Smartphone",
  smartphonev2: "Smartphone",
  console: "Console",
};

function DeviceHeader({ tradeIn }: { tradeIn: TradeInAvaliacao }) {
  const catLabel = CATEGORIA_LABEL[tradeIn.categoria.toLowerCase()] ?? tradeIn.categoria;
  const dateStr = tradeIn.dataTradeIn
    ? new Date(tradeIn.dataTradeIn).toLocaleDateString("pt-BR")
    : "—";

  return (
    <div className="flex items-center gap-2 flex-wrap text-sm">
      <span className="font-bold text-base">{tradeIn.modelo || "Dispositivo"}</span>
      <span className="text-muted-foreground">|</span>
      <span className="text-muted-foreground font-mono text-xs">IMEI: {tradeIn.imei || "—"}</span>
      <span className="text-muted-foreground">|</span>
      <span className="text-muted-foreground">{catLabel}</span>
      <span className="text-muted-foreground">|</span>
      <span className="text-muted-foreground">{dateStr}</span>
    </div>
  );
}

// ─── Area grade bar ──────────────────────────────────────────────────────────

function AreaGradeBar({ label, grade }: { label: string; grade: Grade | null }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}:</span>
      {grade ? (
        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold ${GRADE_BADGE_COLORS[grade]}`}>
          {grade}
        </span>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      )}
    </div>
  );
}

// ─── Photo grid section ──────────────────────────────────────────────────────

function PhotoGridSection({
  label,
  fotos,
  gradesPorFoto,
  onGradeChange,
  showValidation,
  gridClass,
}: {
  label: string;
  fotos: FotoAvaliacao[];
  gradesPorFoto: Record<number, Grade>;
  onGradeChange: (slot: number, grade: Grade) => void;
  showValidation: boolean;
  gridClass: string;
}) {
  const areaGrade = worstGrade(
    fotos.map((f) => gradesPorFoto[f.slot] ?? null)
  );

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
      <div className={gridClass}>
        {fotos.map((foto) => (
          <CurationPhotoCard
            key={foto.slot}
            foto={foto}
            gradeCurador={gradesPorFoto[foto.slot] ?? null}
            onGradeChange={(g) => onGradeChange(foto.slot, g)}
            highlight={showValidation}
          />
        ))}
      </div>
      <AreaGradeBar
        label={`Grade ${label.toLowerCase().includes("display") ? "display" : "carcaca"}`}
        grade={areaGrade}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AvaliacoesCuradoriaPage() {
  const { toast } = useToast();

  // Filters
  const [filtros, setFiltros] = useState<CuradoriaFiltros>({ startDate: CURADORIA_MIN_START_DATE });
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
      toast({
        title: "Avalie todas as fotos antes de confirmar",
        description: "Fotos com imagem disponivel precisam de nota do curador.",
        variant: "destructive",
      });
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
        description: "Nao foi possivel salvar a curadoria. Tente novamente.",
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
      <PageHeader title="Avaliacoes — Curadoria" />

      <div className="container mx-auto px-4 py-4 max-w-7xl space-y-4">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/avaliacoes/dashboard">Avaliacoes</BreadcrumbLink>
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
          <div className="flex flex-col gap-4">
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
              <CardContent className="pt-3 pb-3">
                <DeviceHeader tradeIn={tradeInAtual} />
              </CardContent>
            </Card>

            {/* ═══ GRID LAYOUT: Display (35%) + Carcaca (65%) ═══ */}
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Left: DISPLAY & TELA — 2-col grid */}
              <div className="lg:w-[35%] flex-shrink-0">
                <PhotoGridSection
                  label="Display & Tela"
                  fotos={displayFotos}
                  gradesPorFoto={gradesPorFoto}
                  onGradeChange={handleFotoGradeChange}
                  showValidation={showValidation}
                  gridClass="grid grid-cols-2 gap-2"
                />
              </div>

              {/* Right: CARCACA — 3-col grid (fotos 3-5) + 2-col grid (fotos 6-7) */}
              <div className="lg:w-[65%] flex-1">
                <PhotoGridSection
                  label="Carcaca"
                  fotos={carcacaFotos}
                  gradesPorFoto={gradesPorFoto}
                  onGradeChange={handleFotoGradeChange}
                  showValidation={showValidation}
                  gridClass="grid grid-cols-2 sm:grid-cols-3 gap-2"
                />
              </div>
            </div>

            {/* ═══ RESUMO GRADES ═══ */}
            <div className="flex items-center justify-center gap-6 py-2 rounded-lg bg-muted/30 border border-border">
              <AreaGradeBar label="Display" grade={gradeDisplay} />
              <div className="h-6 w-px bg-border" />
              <AreaGradeBar label="Carcaca" grade={gradeCarcaca} />
            </div>

            {/* Validation message */}
            {showValidation && !canConfirm && (
              <p className="text-sm text-red-500 font-medium text-center">
                Avalie todas as fotos disponiveis antes de confirmar.
              </p>
            )}

            {/* ═══ STICKY ACTION BAR ═══ */}
            <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm py-3 -mx-1 px-1 border-t border-border">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Revisao Avaliador toggle */}
                <div className="flex items-center gap-2">
                  <Switch
                    id="revisao-inline"
                    checked={revisaoAtiva}
                    onCheckedChange={(checked) => {
                      setRevisaoAtiva(checked);
                      if (!checked) setRevisaoTipo(null);
                    }}
                  />
                  <Label htmlFor="revisao-inline" className="text-xs cursor-pointer whitespace-nowrap">
                    Revisao Avaliador
                  </Label>
                </div>

                {/* Revisao tipo selector (compact) */}
                {revisaoAtiva && (
                  <Select value={revisaoTipo ?? ""} onValueChange={setRevisaoTipo}>
                    <SelectTrigger className="h-8 w-[160px] text-xs">
                      <SelectValue placeholder="Tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="listras">Listras na tela</SelectItem>
                      <SelectItem value="burn-in">Burn-in</SelectItem>
                      <SelectItem value="pixels">Pixels queimados</SelectItem>
                      <SelectItem value="manchas">Manchas/sombras</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                <Separator orientation="vertical" className="h-6 hidden sm:block" />

                {/* Observacao inline */}
                <Input
                  placeholder="Observacao (opcional)..."
                  maxLength={500}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="h-8 text-xs flex-1 min-w-[140px] max-w-xs"
                />

                <div className="flex gap-2 ml-auto">
                  <Button
                    className="bg-[#00A137] hover:bg-[#048E33] text-white h-9"
                    onClick={handleConfirm}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Confirmar Curadoria
                      </>
                    )}
                  </Button>
                  <Button variant="ghost" onClick={handleSkip} disabled={saveMutation.isPending} size="sm" className="gap-1 h-9">
                    <SkipForward className="h-4 w-4" />
                    Pular
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
