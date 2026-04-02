/**
 * Página de Coletas - Dashboard de Logística
 * 
 * Esta página exibe:
 * - Filtros: Transportadora (TSP), Status (Controle), Responsável
 * - Tabela de Coletas com dados agregados da API
 * - Exportação para Excel
 */
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Truck, Download, Filter, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdmColetasAggregates } from "@/hooks/use-adm-logistica";

const COLETAS_COLUMNS_ORDER = [
  "Romaneio",
  "Emissão",
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
  "Responsável",
] as const;

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

export default function ColetasPage() {
  const { toast } = useToast();
  const [selectedTransportadora, setSelectedTransportadora] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedResponsavel, setSelectedResponsavel] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);

  const filters = useMemo(
    () => ({
      tsp: selectedTransportadora === "all" ? undefined : selectedTransportadora,
      status_controle: selectedStatus === "all" ? undefined : selectedStatus,
      responsavel: selectedResponsavel === "all" ? undefined : selectedResponsavel,
    }),
    [selectedResponsavel, selectedStatus, selectedTransportadora]
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

  const columns = useMemo(() => {
    if (!rows.length) return [];

    const availableKeys = new Set(Object.keys(rows[0]));
    return COLETAS_COLUMNS_ORDER.filter((key) => availableKeys.has(key)).map((key) => ({ key, label: key }));
  }, [rows]);

  const errorMessage = isError ? (error as Error)?.message : null;

  const handleClearFilters = () => {
    setSelectedTransportadora("all");
    setSelectedStatus("all");
    setSelectedResponsavel("all");
  };

  const handleExportExcel = async () => {
    if (!rows.length || !columns.length) {
      toast({
        title: "Sem dados para exportar",
        description: "Não há dados na tabela de coletas para exportação.",
      });
      return;
    }

    try {
      setIsExporting(true);
      const XLSX = await import("xlsx");

      const formattedRows = rows.map((row) => {
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="Coletas"
        description="Gestão de coletas com filtros por TSP, status de controle e responsável"
      />

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => refetch()} disabled={isLoading || isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
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
          <span>Total Filtrado: <strong>{data.meta.total_filtrado}</strong></span>
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
          {!isLoading && rows.length === 0 ? (
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
                  {rows.slice(0, 300).map((row, idx) => (
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
              {rows.length > 300 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Mostrando 300 de {rows.length} registros
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}