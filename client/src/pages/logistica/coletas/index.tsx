/**
 * Página de Coletas - Dashboard de Logística
 * 
 * Esta página exibe:
 * - Filtros: Transportadora (TSP), Status (Controle), Responsável
 * - Tabela de Coletas com dados agregados da API
 * - Exportação para Excel
 */
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Truck, Download, Filter, RefreshCw, AlertCircle, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdmColetasAggregates } from "@/hooks/use-adm-logistica";

const COLETAS_COLUMNS_ORDER = [
  "Romaneio",
  "Emissao",
  "Recebimento",
  "Dias",
  "TSP",
  "Itens",
  "Recebidos",
  "Controle",
  "Rede",
  "Loja",
  "Cidade",
  "UF",
  "NFs",
  "Responsavel",
] as const;

const COLETAS_PIVOT_GROUP_FIELDS = ["Emissao", "Responsavel", "TSP", "Rede"] as const;

type PivotBuildNode = {
  id: string;
  label: string;
  level: number;
  lojaSet: Set<string>;
  itensTotal: number;
  childrenMap: Map<string, PivotBuildNode>;
};

type PivotNode = {
  id: string;
  label: string;
  level: number;
  lojasCount: number;
  itensTotal: number;
  children: PivotNode[];
};

type PivotFlatRow = {
  id: string;
  label: string;
  level: number;
  lojasCount: number;
  itensTotal: number;
  hasChildren: boolean;
};

function normalizeSelectOptions(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value : String(value ?? "")).trim())
        .filter((value) => value.length > 0)
    )
  );
}

function normalizeRows(values: unknown): Record<string, unknown>[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter(
    (value): value is Record<string, unknown> =>
      typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

function parseDateBr(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-") return null;

  const [dayPart, monthPart, yearPart] = trimmed.split("/");
  const day = Number(dayPart);
  const month = Number(monthPart);
  const year = Number(yearPart);

  if (!day || !month || !year) return null;

  return new Date(year, month - 1, day);
}

function parseDateInput(value: string, endOfDay = false): Date | null {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function getTodayYmd(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysYmd(ymd: string, days: number): string {
  if (!ymd) return ymd;
  const base = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(base.getTime())) return ymd;
  base.setDate(base.getDate() + days);
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseItensValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;

  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDimensionValue(value: unknown): string {
  const text = String(value ?? "").trim();
  return text.length ? text : "(Sem valor)";
}

function buildPivotTree(rows: Record<string, unknown>[]): PivotNode[] {
  const rootMap = new Map<string, PivotBuildNode>();

  const upsertNode = (
    map: Map<string, PivotBuildNode>,
    id: string,
    label: string,
    level: number
  ): PivotBuildNode => {
    const existing = map.get(id);
    if (existing) return existing;

    const created: PivotBuildNode = {
      id,
      label,
      level,
      lojaSet: new Set<string>(),
      itensTotal: 0,
      childrenMap: new Map<string, PivotBuildNode>(),
    };
    map.set(id, created);
    return created;
  };

  rows.forEach((row) => {
    const loja = normalizeDimensionValue(row.Loja);
    const itens = parseItensValue(row.Itens);
    const pathValues = COLETAS_PIVOT_GROUP_FIELDS.map((field) => normalizeDimensionValue(row[field]));

    let currentMap = rootMap;
    let path = "";

    pathValues.forEach((value, index) => {
      path = path ? `${path}::${value}` : value;
      const node = upsertNode(currentMap, path, value, index);

      node.lojaSet.add(loja);
      node.itensTotal += itens;

      currentMap = node.childrenMap;
    });
  });

  const toPivotNode = (node: PivotBuildNode): PivotNode => ({
    id: node.id,
    label: node.label,
    level: node.level,
    lojasCount: node.lojaSet.size,
    itensTotal: node.itensTotal,
    children: Array.from(node.childrenMap.values()).map(toPivotNode),
  });

  return Array.from(rootMap.values()).map(toPivotNode);
}

function flattenPivotRows(nodes: PivotNode[], expandedRows: Set<string>): PivotFlatRow[] {
  const output: PivotFlatRow[] = [];

  const walk = (items: PivotNode[]) => {
    items.forEach((node) => {
      const hasChildren = node.children.length > 0;
      output.push({
        id: node.id,
        label: node.label,
        level: node.level,
        lojasCount: node.lojasCount,
        itensTotal: node.itensTotal,
        hasChildren,
      });

      if (hasChildren && expandedRows.has(node.id)) {
        walk(node.children);
      }
    });
  };

  walk(nodes);
  return output;
}

export default function ColetasPage() {
  const { toast } = useToast();
  const todayYmd = useMemo(() => getTodayYmd(), []);
  const [viewMode, setViewMode] = useState<"detalhes" | "agregado">("detalhes");
  const [selectedTransportadora, setSelectedTransportadora] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedResponsavel, setSelectedResponsavel] = useState<string>("all");
  const [emissaoInicio, setEmissaoInicio] = useState<string>(todayYmd);
  const [emissaoFim, setEmissaoFim] = useState<string>(todayYmd);
  const [recebimentoInicio, setRecebimentoInicio] = useState<string>("");
  const [recebimentoFim, setRecebimentoFim] = useState<string>("");
  const [appliedTransportadora, setAppliedTransportadora] = useState<string>("all");
  const [appliedStatus, setAppliedStatus] = useState<string>("all");
  const [appliedResponsavel, setAppliedResponsavel] = useState<string>("all");
  const [appliedEmissaoInicio, setAppliedEmissaoInicio] = useState<string>(todayYmd);
  const [appliedEmissaoFim, setAppliedEmissaoFim] = useState<string>(todayYmd);
  const [appliedRecebimentoInicio, setAppliedRecebimentoInicio] = useState<string>("");
  const [appliedRecebimentoFim, setAppliedRecebimentoFim] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [expandedAggregateRows, setExpandedAggregateRows] = useState<Set<string>>(new Set());

  const filters = useMemo(
    () => ({
      start_date: appliedEmissaoInicio || undefined,
      end_date: appliedEmissaoFim ? addDaysYmd(appliedEmissaoFim, 1) : undefined,
      receipt_start: appliedRecebimentoInicio || undefined,
      receipt_end: appliedRecebimentoFim ? addDaysYmd(appliedRecebimentoFim, 1) : undefined,
      tsp: appliedTransportadora === "all" ? undefined : appliedTransportadora,
      status_controle: appliedStatus === "all" ? undefined : appliedStatus,
      responsavel: appliedResponsavel === "all" ? undefined : appliedResponsavel,
    }),
    [
      appliedEmissaoFim,
      appliedEmissaoInicio,
      appliedRecebimentoFim,
      appliedRecebimentoInicio,
      appliedResponsavel,
      appliedStatus,
      appliedTransportadora,
    ]
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useAdmColetasAggregates(filters);
  const filtrosDisponiveis = data?.filtros_disponiveis;

  const tspOptions = useMemo(() => normalizeSelectOptions(filtrosDisponiveis?.tsp), [filtrosDisponiveis?.tsp]);
  const statusControleOptions = useMemo(
    () => normalizeSelectOptions(filtrosDisponiveis?.status_controle),
    [filtrosDisponiveis?.status_controle]
  );
  const responsavelOptions = useMemo(
    () => normalizeSelectOptions(filtrosDisponiveis?.responsaveis),
    [filtrosDisponiveis?.responsaveis]
  );

  const rows = useMemo(() => normalizeRows(data?.tabela_completa), [data?.tabela_completa]);
  const visibleRows = useMemo(() => {
    const emissãoInicio = parseDateInput(appliedEmissaoInicio);
    const emissãoFim = parseDateInput(appliedEmissaoFim, true);
    const recebimentoInicioDate = parseDateInput(appliedRecebimentoInicio);
    const recebimentoFimDate = parseDateInput(appliedRecebimentoFim, true);

    return rows.filter((row) => {
      const emissão = parseDateBr(String(row.Emissao ?? ""));
      const recebimento = parseDateBr(String(row.Recebimento ?? ""));

      if (emissãoInicio && (!emissão || emissão < emissãoInicio)) return false;
      if (emissãoFim && (!emissão || emissão > emissãoFim)) return false;

      if (recebimentoInicioDate && (!recebimento || recebimento < recebimentoInicioDate)) return false;
      if (recebimentoFimDate && (!recebimento || recebimento > recebimentoFimDate)) return false;

      return true;
    });
  }, [appliedEmissaoFim, appliedEmissaoInicio, appliedRecebimentoFim, appliedRecebimentoInicio, rows]);

  const columns = useMemo(() => {
    if (!rows.length) return [];

    const availableKeys = new Set(Object.keys(rows[0]));
    return COLETAS_COLUMNS_ORDER.filter((key) => availableKeys.has(key)).map((key) => ({ key, label: key }));
  }, [rows]);

  const aggregateTree = useMemo(() => buildPivotTree(visibleRows), [visibleRows]);

  useEffect(() => {
    const topLevelIds = aggregateTree.map((node) => node.id);
    setExpandedAggregateRows(new Set(topLevelIds));
  }, [aggregateTree]);

  const aggregateRows = useMemo(
    () => flattenPivotRows(aggregateTree, expandedAggregateRows),
    [aggregateTree, expandedAggregateRows]
  );

  const errorMessage = isError ? (error as Error)?.message : null;

  const hasPendingFilterChanges = useMemo(
    () =>
      selectedTransportadora !== appliedTransportadora ||
      selectedStatus !== appliedStatus ||
      selectedResponsavel !== appliedResponsavel ||
      emissaoInicio !== appliedEmissaoInicio ||
      emissaoFim !== appliedEmissaoFim ||
      recebimentoInicio !== appliedRecebimentoInicio ||
      recebimentoFim !== appliedRecebimentoFim,
    [
      appliedEmissaoFim,
      appliedEmissaoInicio,
      appliedRecebimentoFim,
      appliedRecebimentoInicio,
      appliedResponsavel,
      appliedStatus,
      appliedTransportadora,
      emissaoFim,
      emissaoInicio,
      recebimentoFim,
      recebimentoInicio,
      selectedResponsavel,
      selectedStatus,
      selectedTransportadora,
    ]
  );

  const handleApplyFilters = () => {
    if (!hasPendingFilterChanges) {
      refetch();
      return;
    }

    setAppliedTransportadora(selectedTransportadora);
    setAppliedStatus(selectedStatus);
    setAppliedResponsavel(selectedResponsavel);
    setAppliedEmissaoInicio(emissaoInicio);
    setAppliedEmissaoFim(emissaoFim);
    setAppliedRecebimentoInicio(recebimentoInicio);
    setAppliedRecebimentoFim(recebimentoFim);
  };

  const handleClearFilters = () => {
    setSelectedTransportadora("all");
    setSelectedStatus("all");
    setSelectedResponsavel("all");
    setEmissaoInicio(todayYmd);
    setEmissaoFim(todayYmd);
    setRecebimentoInicio("");
    setRecebimentoFim("");

    setAppliedTransportadora("all");
    setAppliedStatus("all");
    setAppliedResponsavel("all");
    setAppliedEmissaoInicio(todayYmd);
    setAppliedEmissaoFim(todayYmd);
    setAppliedRecebimentoInicio("");
    setAppliedRecebimentoFim("");
  };

  const handleExportExcel = async () => {
    if (!visibleRows.length || !columns.length) {
      toast({
        title: "Sem dados para exportar",
        description: "Não há dados na tabela de coletas para exportação.",
      });
      return;
    }

    try {
      setIsExporting(true);
      const XLSX = await import("xlsx");

      const formattedRows = visibleRows.map((row) => {
        const output: Record<string, unknown> = {};
        columns.forEach((col) => {
          output[col.label] = row[col.key] ?? "";
        });
        return output;
      });

      const worksheet = XLSX.utils.json_to_sheet(formattedRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Coletas");
      XLSX.writeFile(workbook, "coletas_aggregates.xlsx");
    } catch (exportError) {
      toast({
        title: "Erro ao exportar",
        description:
          exportError instanceof Error ? exportError.message : "Não foi possível exportar o arquivo Excel.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const toggleAggregateRow = (rowId: string) => {
    setExpandedAggregateRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="Coletas"
        description="Gestão de coletas com filtros por TSP, status de controle, responsável, emissão e recebimento"
      />

      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "detalhes" | "agregado")}> 
        <TabsList className="grid w-full grid-cols-2 md:w-[320px]">
          <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
          <TabsTrigger value="agregado">Agregado</TabsTrigger>
        </TabsList>

        <TabsContent value="detalhes" className="mt-6 space-y-6">
          {errorMessage && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <p>Erro ao carregar dados: {errorMessage}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filtros */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Transportadora (TSP)</label>
                  <Select value={selectedTransportadora} onValueChange={setSelectedTransportadora}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as Transportadoras" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Transportadoras</SelectItem>
                      {tspOptions.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Status (Controle)</label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      {statusControleOptions.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Responsável</label>
                  <Select value={selectedResponsavel} onValueChange={setSelectedResponsavel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os Responsáveis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Responsáveis</SelectItem>
                      {responsavelOptions.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Emissão - Início</label>
                  <DateInput className="max-w-[160px]" value={emissaoInicio} onChange={(e) => setEmissaoInicio(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Emissão - Fim</label>
                  <DateInput className="max-w-[160px]" value={emissaoFim} onChange={(e) => setEmissaoFim(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Recebimento - Início</label>
                  <DateInput className="max-w-[160px]" value={recebimentoInicio} onChange={(e) => setRecebimentoInicio(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Recebimento - Fim</label>
                  <DateInput className="max-w-[160px]" value={recebimentoFim} onChange={(e) => setRecebimentoFim(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleApplyFilters} disabled={isLoading || isFetching || (!hasPendingFilterChanges && !isError)}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
                  {isFetching ? "Atualizando..." : "Atualizar"}
                </Button>
                <Button variant="outline" onClick={handleClearFilters} disabled={isLoading || isFetching}>
                  Limpar Filtros
                </Button>
                <Button variant="outline" onClick={handleExportExcel} disabled={isExporting || !rows.length}>
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? "Exportando..." : "Exportar Excel"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {data?.meta && (
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>Total de Registros: <strong>{data.meta.total_registros}</strong></span>
              <span>Total Filtrado: <strong>{visibleRows.length}</strong></span>
            </div>
          )}

          {isLoading && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mr-2" />
                  <span>Carregando dados de coletas...</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela de Coletas */}
          <Card>
            <CardHeader>
              <CardTitle>Tabela de Coletas</CardTitle>
            </CardHeader>
            <CardContent>
              {!isLoading && visibleRows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum dado encontrado para os filtros selecionados.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        {columns.map((col) => (
                          <th key={col.key} className="text-left p-2 font-medium whitespace-nowrap">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.slice(0, 300).map((row, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          {columns.map((col) => (
                            <td key={col.key} className="p-2 whitespace-nowrap">
                              {row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {visibleRows.length > 300 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Mostrando 300 de {visibleRows.length} registros
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agregado" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Transportadora (TSP)</label>
                  <Select value={selectedTransportadora} onValueChange={setSelectedTransportadora}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as Transportadoras" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Transportadoras</SelectItem>
                      {tspOptions.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Status (Controle)</label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      {statusControleOptions.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Responsável</label>
                  <Select value={selectedResponsavel} onValueChange={setSelectedResponsavel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os Responsáveis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Responsáveis</SelectItem>
                      {responsavelOptions.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Emissão - Início</label>
                  <DateInput className="max-w-[160px]" value={emissaoInicio} onChange={(e) => setEmissaoInicio(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Emissão - Fim</label>
                  <DateInput className="max-w-[160px]" value={emissaoFim} onChange={(e) => setEmissaoFim(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Recebimento - Início</label>
                  <DateInput className="max-w-[160px]" value={recebimentoInicio} onChange={(e) => setRecebimentoInicio(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Recebimento - Fim</label>
                  <DateInput className="max-w-[160px]" value={recebimentoFim} onChange={(e) => setRecebimentoFim(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleApplyFilters} disabled={isLoading || isFetching || (!hasPendingFilterChanges && !isError)}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
                  {isFetching ? "Atualizando..." : "Atualizar"}
                </Button>
                <Button variant="outline" onClick={handleClearFilters} disabled={isLoading || isFetching}>
                  Limpar Filtros
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agregado</CardTitle>
            </CardHeader>
            <CardContent>
              {!isLoading && aggregateRows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum dado encontrado para montar o agregado.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Linhas</th>
                        <th className="text-right p-2 font-medium">Contagem de Lojas</th>
                        <th className="text-right p-2 font-medium">Soma de Itens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aggregateRows.map((row) => {
                        const isExpanded = expandedAggregateRows.has(row.id);
                        return (
                          <tr key={row.id} className="border-b hover:bg-muted/50">
                            <td className="p-2">
                              <div
                                className="flex items-center gap-2"
                                style={{ paddingLeft: `${row.level * 16}px` }}
                              >
                                {row.hasChildren ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleAggregateRow(row.id)}
                                    className="inline-flex items-center justify-center rounded-sm border border-border p-0.5 hover:bg-muted"
                                    aria-label={isExpanded ? "Recolher grupo" : "Expandir grupo"}
                                  >
                                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  </button>
                                ) : (
                                  <span className="inline-block w-4" />
                                )}
                                <span className="whitespace-nowrap">{row.label}</span>
                              </div>
                            </td>
                            <td className="p-2 text-right tabular-nums">{row.lojasCount}</td>
                            <td className="p-2 text-right tabular-nums">{row.itensTotal.toLocaleString("pt-BR")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}