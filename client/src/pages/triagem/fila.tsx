import { useState, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ClipboardList, Search, X, Clock, AlertCircle, Timer } from "lucide-react";
import { useTriagemFila } from "@/hooks/use-triagem";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const normalized = dateStr.includes("T")
      ? dateStr
      : dateStr.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
    return format(parseISO(normalized), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

function parseDateLocal(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  try {
    const normalized = dateStr.includes("T")
      ? dateStr
      : dateStr.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function rowHighlightClass(dias: number): string {
  if (dias > 15) return "bg-red-50 dark:bg-red-950/20";
  if (dias > 7) return "bg-amber-50 dark:bg-amber-950/20";
  return "";
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilaFilters {
  imei: string;
  categoria: string;
  rede: string;
  responsavel: string;
  dataInicio: string;
  dataFim: string;
}

const EMPTY_FILTERS: FilaFilters = {
  imei: "",
  categoria: "",
  rede: "",
  responsavel: "",
  dataInicio: "",
  dataFim: "",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TriagemFilaPage() {
  const { data, isLoading } = useTriagemFila();
  const [draft, setDraft] = useState<FilaFilters>({ ...EMPTY_FILTERS });
  const [filters, setFilters] = useState<FilaFilters>({ ...EMPTY_FILTERS });

  const allItems = data?.data ?? [];

  const filtered = useMemo(() => {
    let items = [...allItems];

    if (filters.imei)
      items = items.filter(i => i.imei.toLowerCase().includes(filters.imei.toLowerCase()));
    if (filters.categoria)
      items = items.filter(i => i.categoria.toLowerCase().includes(filters.categoria.toLowerCase()));
    if (filters.rede)
      items = items.filter(i => i.rede.toLowerCase().includes(filters.rede.toLowerCase()));
    if (filters.responsavel)
      items = items.filter(i => i.responsavel.toLowerCase().includes(filters.responsavel.toLowerCase()));
    if (filters.dataInicio) {
      const start = parseDateLocal(filters.dataInicio);
      if (start)
        items = items.filter(i => { const d = parseDateLocal(i.dataRecebimento); return d && d >= start; });
    }
    if (filters.dataFim) {
      const end = parseDateLocal(filters.dataFim);
      if (end) {
        end.setHours(23, 59, 59, 999);
        items = items.filter(i => { const d = parseDateLocal(i.dataRecebimento); return d && d <= end; });
      }
    }

    // FIFO: mais antigo primeiro (maior diasNoStatus no topo)
    return items.sort((a, b) => (b.diasNoStatus ?? 0) - (a.diasNoStatus ?? 0));
  }, [allItems, filters]);

  // KPIs
  const tempoMedio = filtered.length > 0
    ? Math.round(filtered.reduce((sum, i) => sum + (i.diasNoStatus ?? 0), 0) / filtered.length)
    : 0;
  const itensCriticos = filtered.filter(i => (i.diasNoStatus ?? 0) > 7).length;

  const hasActiveFilters = Object.values(filters).some(Boolean);

  function applyFilters() {
    setFilters({ ...draft });
  }

  function clearFilters() {
    setDraft({ ...EMPTY_FILTERS });
    setFilters({ ...EMPTY_FILTERS });
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Triagem — Fila de Triagem" />
        <div className="h-[60vh] flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Triagem — Fila de Triagem" />
      <div className="container mx-auto px-4 py-8 space-y-6">

        {/* KPI Strip */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--l3)" }}>
                Total na Fila
              </CardTitle>
              <ClipboardList className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-[28px] font-bold" style={{ color: "var(--l1)" }}>
                {filtered.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">dispositivos em processamento</p>
            </CardContent>
          </Card>

          <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--l3)" }}>
                Tempo Médio
              </CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-[28px] font-bold" style={{ color: "var(--l1)" }}>
                {tempoMedio}
              </div>
              <p className="text-xs text-muted-foreground mt-1">dias médios no status</p>
            </CardContent>
          </Card>

          <Card
            className="border"
            style={{
              background: "var(--bg2)",
              borderColor: itensCriticos > 0 ? "rgb(239 68 68 / 0.4)" : "var(--sep)",
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--l3)" }}>
                Itens Críticos
              </CardTitle>
              <AlertCircle className={`h-4 w-4 ${itensCriticos > 0 ? "text-red-500" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div
                  className="text-[28px] font-bold"
                  style={{ color: itensCriticos > 0 ? "rgb(239 68 68)" : "var(--l1)" }}
                >
                  {itensCriticos}
                </div>
                {itensCriticos > 0 && (
                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 text-xs">
                    +7 dias
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">aguardando há mais de 7 dias</p>
            </CardContent>
          </Card>
        </div>

        {/* Legenda de highlights */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-950/40 border border-amber-200" />
            <span>7+ dias no status</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-950/40 border border-red-200" />
            <span>15+ dias no status (crítico)</span>
          </div>
        </div>

        {/* Filtros */}
        <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Search className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Input
                placeholder="IMEI"
                value={draft.imei}
                onChange={(e) => setDraft(prev => ({ ...prev, imei: e.target.value }))}
                className="text-sm"
              />
              <Input
                placeholder="Categoria"
                value={draft.categoria}
                onChange={(e) => setDraft(prev => ({ ...prev, categoria: e.target.value }))}
                className="text-sm"
              />
              <Input
                placeholder="Rede"
                value={draft.rede}
                onChange={(e) => setDraft(prev => ({ ...prev, rede: e.target.value }))}
                className="text-sm"
              />
              <Input
                placeholder="Responsável"
                value={draft.responsavel}
                onChange={(e) => setDraft(prev => ({ ...prev, responsavel: e.target.value }))}
                className="text-sm"
              />
              <Input
                type="date"
                value={draft.dataInicio}
                onChange={(e) => setDraft(prev => ({ ...prev, dataInicio: e.target.value }))}
                className="text-sm"
              />
              <Input
                type="date"
                value={draft.dataFim}
                onChange={(e) => setDraft(prev => ({ ...prev, dataFim: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={applyFilters}>
                <Search className="h-3.5 w-3.5 mr-1.5" />
                Buscar
              </Button>
              {hasActiveFilters && (
                <Button size="sm" variant="ghost" onClick={clearFilters}>
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card className="border" style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Fila de Triagem
              </span>
              <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                <Timer className="h-3.5 w-3.5" />
                Ordem FIFO — mais antigo primeiro
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: "var(--sep)" }}>
                    <TableHead className="text-xs font-semibold uppercase">IMEI</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Modelo</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Marca</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Categoria</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Rede</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Responsável</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Data Recebimento</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Dias no Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        {hasActiveFilters
                          ? "Nenhum item encontrado com os filtros aplicados."
                          : "Fila vazia — nenhum dispositivo em triagem no momento."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item, idx) => {
                      const dias = item.diasNoStatus ?? 0;
                      return (
                        <TableRow
                          key={`${item.imei}-${idx}`}
                          className={`hover-elevate ${rowHighlightClass(dias)}`}
                          style={{ borderColor: "var(--sep)" }}
                        >
                          <TableCell className="font-mono text-xs">{item.imei || "—"}</TableCell>
                          <TableCell className="text-sm max-w-[160px] truncate">{item.modelo || "—"}</TableCell>
                          <TableCell className="text-sm">{item.marca || "—"}</TableCell>
                          <TableCell className="text-sm">{item.categoria || "—"}</TableCell>
                          <TableCell className="text-sm">{item.rede || "—"}</TableCell>
                          <TableCell className="text-sm">{item.responsavel || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(item.dataRecebimento)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-sm font-semibold">{dias}</span>
                              {dias > 15 && (
                                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 text-xs px-1.5">
                                  crítico
                                </Badge>
                              )}
                              {dias > 7 && dias <= 15 && (
                                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 text-xs px-1.5">
                                  atenção
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
