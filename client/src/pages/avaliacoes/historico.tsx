import { useState, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  User,
  Smartphone,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useCuradorias,
  useAvaliadores,
  type CuradoriaHistoricoFiltros,
  type CuradoriaHistoricoItem,
} from "@/hooks/use-avaliacoes";

// ─── Grade badge ─────────────────────────────────────────────────────────────

const GRADE_COLORS: Record<string, string> = {
  A: "bg-[#0F6E56] text-white",
  B: "bg-[#BA7517] text-white",
  C: "bg-[#A32D2D] text-white",
};

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${GRADE_COLORS[grade] ?? "bg-muted text-foreground"}`}>
      {grade}
    </span>
  );
}

function GradeArrow({ ia, curador }: { ia: string | null; curador: string | null }) {
  return (
    <div className="flex items-center gap-1">
      <GradeBadge grade={ia} />
      <span className="text-muted-foreground text-xs">→</span>
      <GradeBadge grade={curador} />
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function isConcordante(r: CuradoriaHistoricoItem): boolean {
  return (
    Boolean(r.gradeCorretaDisplay) &&
    Boolean(r.gradeIaDisplay) &&
    Boolean(r.gradeCorretaCarcaca) &&
    Boolean(r.gradeIaCarcaca) &&
    r.gradeCorretaDisplay === r.gradeIaDisplay &&
    r.gradeCorretaCarcaca === r.gradeIaCarcaca
  );
}

function StatusBadge({ item }: { item: CuradoriaHistoricoItem }) {
  const ok = isConcordante(item);
  return ok ? (
    <Badge className="bg-[#0F6E56]/15 text-[#0F6E56] hover:bg-[#0F6E56]/20 border-0 gap-1 font-medium">
      <CheckCircle2 className="h-3 w-3" />
      Concordante
    </Badge>
  ) : (
    <Badge className="bg-[#BA7517]/15 text-[#BA7517] hover:bg-[#BA7517]/20 border-0 gap-1 font-medium">
      <AlertTriangle className="h-3 w-3" />
      Divergente
    </Badge>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, sub }: { label: string; value: string | number; icon: React.ElementType; sub?: string }) {
  return (
    <Card className="border border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-lg font-bold leading-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

const FOTO_LABELS: Record<number, string> = {
  1: "Frontal",
  2: "Traseira",
  3: "Lateral E",
  4: "Lateral D",
  5: "Detalhe",
  6: "Extra 1",
  7: "Extra 2",
};

function DetailSheet({
  item,
  open,
  onClose,
}: {
  item: CuradoriaHistoricoItem | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!item) return null;

  const fotos = [
    { slot: 1, url: item.imagemFrontal },
    { slot: 2, url: item.imagemTraseira },
    { slot: 3, url: item.imagemLateral1 },
    { slot: 4, url: item.imagemLateral2 },
    { slot: 5, url: item.imagemDetalhe },
  ].filter((f) => f.url);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[480px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            {item.modelo ?? item.imei ?? "Dispositivo"}
          </SheetTitle>
          <p className="text-xs text-muted-foreground font-mono">{item.imei ?? "—"}</p>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-5">
          {/* Status e grades */}
          <div className="flex flex-col gap-2">
            <StatusBadge item={item} />
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div className="rounded-lg bg-muted/50 p-3 flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Display</span>
                <GradeArrow ia={item.gradeIaDisplay} curador={item.gradeCorretaDisplay} />
              </div>
              <div className="rounded-lg bg-muted/50 p-3 flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Carcaça</span>
                <GradeArrow ia={item.gradeIaCarcaca} curador={item.gradeCorretaCarcaca} />
              </div>
            </div>
          </div>

          {/* Observação */}
          {item.observacao && (
            <div className="rounded-lg border border-border/50 p-3 flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Observação</span>
              <p className="text-sm">{item.observacao}</p>
            </div>
          )}

          {/* Revisão */}
          {item.revisaoAvaliador && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Avaliador revisado — {item.revisaoTipo ?? "sem tipo"}
              </p>
            </div>
          )}

          {/* Fotos */}
          {fotos.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fotos</span>
              <div className="grid grid-cols-3 gap-2">
                {fotos.map(({ slot, url }) => (
                  <div key={slot} className="flex flex-col gap-1">
                    <div className="aspect-square rounded-lg overflow-hidden bg-muted border border-border/50">
                      <img
                        src={url!}
                        alt={FOTO_LABELS[slot]}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[10px] text-muted-foreground">{FOTO_LABELS[slot]}</span>
                      {item.gradesPorFoto?.[String(slot)] && (
                        <GradeBadge grade={item.gradesPorFoto[String(slot)]} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data */}
          {item.dataCuradoria && (
            <p className="text-xs text-muted-foreground">
              Curadoria em {format(parseISO(item.dataCuradoria), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(rows: CuradoriaHistoricoItem[]) {
  // Use semicolon as delimiter (Excel PT-BR friendly) and prepend BOM for UTF-8
  const delimiter = ";";
  const header = ["IMEI", "Modelo", "Categoria", "Data Curadoria", "Curador", "Display IA", "Display Curador", "Carcaça IA", "Carcaça Curador", "Status", "Observação"];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const lines = rows.map((r) => [
    r.imei ?? "",
    r.modelo ?? "",
    r.categoria ?? "",
    r.dataCuradoria ? format(parseISO(r.dataCuradoria), "dd/MM/yyyy HH:mm") : "",
    r.curadorId ?? "",
    r.gradeIaDisplay ?? "",
    r.gradeCorretaDisplay ?? "",
    r.gradeIaCarcaca ?? "",
    r.gradeCorretaCarcaca ?? "",
    isConcordante(r) ? "Concordante" : "Divergente",
    r.observacao ?? "",
  ].map(escape).join(delimiter));

  const csvBody = [header.map(escape).join(delimiter), ...lines].join("\n");
  const csvWithBom = "\uFEFF" + csvBody;
  const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `historico-curadoria-${format(new Date(), "yyyyMMdd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function HistoricoSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
      </div>
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const LIMIT = 20;
const HISTORICO_MIN_START_DATE = "2026-04-23";

export default function HistoricoCuradoriaPage() {
  const [filtros, setFiltros] = useState<CuradoriaHistoricoFiltros>({ dataInicio: HISTORICO_MIN_START_DATE });
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<CuradoriaHistoricoItem | null>(null);

  // draft filter state
  const [draft, setDraft] = useState<CuradoriaHistoricoFiltros>({ dataInicio: HISTORICO_MIN_START_DATE });

  const { data, isLoading, isFetching } = useCuradorias(filtros, page, LIMIT);
  const { data: avaliadoresData } = useAvaliadores();

  const avaliadores = avaliadoresData?.data ?? [];
  const registros = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const kpis = data?.kpis;

  const applyFiltros = useCallback(() => {
    setFiltros({ ...draft });
    setPage(1);
  }, [draft]);

  const clearFiltros = useCallback(() => {
    setDraft({ dataInicio: HISTORICO_MIN_START_DATE });
    setFiltros({ dataInicio: HISTORICO_MIN_START_DATE });
    setPage(1);
  }, []);

  const hasActiveFilters = Object.values(filtros).some((v) => v !== undefined && v !== "" && v !== false);

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Histórico de Curadoria"
        breadcrumbs={[
          { label: "Avaliações", href: "/avaliacoes/dashboard" },
          { label: "Histórico" },
        ]}
      />

      <div className="flex-1 p-6 flex flex-col gap-5">
        {/* Filtros */}
        <Card className="border border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5 min-w-[140px]">
                <Label className="text-xs">Data início</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="date"
                    className="pl-8 h-9 text-sm"
                    min={HISTORICO_MIN_START_DATE}
                    value={draft.dataInicio ?? ""}
                    onChange={(e) => setDraft((p) => ({ ...p, dataInicio: e.target.value || undefined }))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 min-w-[140px]">
                <Label className="text-xs">Data fim</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="date"
                    className="pl-8 h-9 text-sm"
                    min={HISTORICO_MIN_START_DATE}
                    value={draft.dataFim ?? ""}
                    onChange={(e) => setDraft((p) => ({ ...p, dataFim: e.target.value || undefined }))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 min-w-[160px]">
                <Label className="text-xs">Curador</Label>
                <Select
                  value={draft.curadorId ?? "all"}
                  onValueChange={(v) => setDraft((p) => ({ ...p, curadorId: v === "all" ? undefined : v }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <User className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {avaliadores.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5 min-w-[180px]">
                <Label className="text-xs">IMEI</Label>
                <Input
                  placeholder="Buscar por IMEI…"
                  className="h-9 text-sm"
                  value={draft.imei ?? ""}
                  onChange={(e) => setDraft((p) => ({ ...p, imei: e.target.value || undefined }))}
                />
              </div>

              <div className="flex items-center gap-2 pb-0.5">
                <Switch
                  id="divergentes-only"
                  checked={draft.divergentesOnly ?? false}
                  onCheckedChange={(v) => setDraft((p) => ({ ...p, divergentesOnly: v || undefined }))}
                />
                <Label htmlFor="divergentes-only" className="text-xs cursor-pointer">
                  Apenas divergentes
                </Label>
              </div>

              <div className="flex items-center gap-2 pb-0.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportCsv(registros)}
                  disabled={registros.length === 0}
                  className="gap-1.5 h-9"
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar Excel
                </Button>
                <Button size="sm" onClick={applyFiltros} className="gap-1.5 h-9">
                  <Filter className="h-3.5 w-3.5" />
                  Filtrar
                </Button>
                {hasActiveFilters && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={clearFiltros} className="h-9 w-9 p-0">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Limpar filtros</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        {isLoading ? (
          <HistoricoSkeleton />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard
                label="Total de Curadorias"
                value={kpis?.totalCuradorias ?? 0}
                icon={ClipboardList}
              />
              <KpiCard
                label="Taxa de Concordância"
                value={`${kpis?.taxaConcordancia ?? 0}%`}
                icon={CheckCircle2}
              />
              <KpiCard
                label="Curadorias Hoje"
                value={kpis?.curadoriasHoje ?? 0}
                icon={Calendar}
              />
              <KpiCard
                label="Top Curador"
                value={kpis?.topCurador ?? "—"}
                icon={User}
              />
            </div>

            {/* Tabela */}
            <Card className="border border-border/50 flex-1">
              <CardContent className="p-0">
                {registros.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                    <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Nenhuma curadoria realizada ainda</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {hasActiveFilters ? "Tente ajustar os filtros." : "As curadorias confirmadas aparecerão aqui."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-b border-border/50">
                            <TableHead className="text-xs font-semibold text-muted-foreground pl-5">IMEI</TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground">Modelo</TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground">Data</TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground">Curador</TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground">Display</TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground">Carcaça</TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
                            <TableHead className="text-xs font-semibold text-muted-foreground pr-5">Obs.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {registros.map((r) => (
                            <TableRow
                              key={r.id}
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => setSelectedItem(r)}
                            >
                              <TableCell className="pl-5 font-mono text-xs text-muted-foreground">
                                {r.imei ?? "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {r.modelo ?? "—"}
                                {r.categoria && (
                                  <span className="ml-1.5 text-xs text-muted-foreground capitalize">
                                    ({r.categoria})
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {r.dataCuradoria
                                  ? format(parseISO(r.dataCuradoria), "dd/MM/yy HH:mm", { locale: ptBR })
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                                {r.curadorId ?? "—"}
                              </TableCell>
                              <TableCell>
                                <GradeArrow ia={r.gradeIaDisplay} curador={r.gradeCorretaDisplay} />
                              </TableCell>
                              <TableCell>
                                <GradeArrow ia={r.gradeIaCarcaca} curador={r.gradeCorretaCarcaca} />
                              </TableCell>
                              <TableCell>
                                <StatusBadge item={r} />
                              </TableCell>
                              <TableCell className="pr-5 max-w-[160px]">
                                {r.observacao ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="text-xs text-muted-foreground line-clamp-1 cursor-default">
                                          {r.observacao}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="max-w-[240px] text-xs">
                                        {r.observacao}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <span className="text-muted-foreground/40 text-xs">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Paginação */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-5 py-3 border-t border-border/50">
                        <p className="text-xs text-muted-foreground">
                          {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} de {total} registros
                        </p>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1 || isFetching}
                            className="h-7 w-7 p-0"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </Button>
                          <span className="text-xs text-muted-foreground px-2">
                            {page} / {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages || isFetching}
                            className="h-7 w-7 p-0"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <DetailSheet
        item={selectedItem}
        open={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}
