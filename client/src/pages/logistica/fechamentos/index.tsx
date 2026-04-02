/**
 * Página de Fechamentos - Dashboard de Logística
 *
 * Esta página replica a funcionalidade da aba "Fechamentos" do app_logistica.py:
 * - Filtro por Rede e Data de Corte
 * - Geração de relatório com elegibilidade e controle de pagamento
 * - Exportação para Excel
 */
import { useCallback, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  Calculator,
  Download,
  FileSpreadsheet,
  Filter,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useAdmDispositivosAggregates,
  useAdmFechamentosAggregates,
  type LogisticaFechamentosFilters,
} from "@/hooks/use-adm-logistica";

const REDE_ALL_VALUE = "all";

const FECHAMENTOS_COLUMNS_ORDER = [
  "Nome da Rede",
  "IMEI",
  "Descricao",
  "Nome da Filial",
  "Data de Uso",
  "Codigo do Voucher",
  "Valor do Dispositivo",
  "Comissao",
  "Periodo",
  "Boost",
  "CPF do Cliente",
  "Nome do Cliente",
  "Valor do Voucher",
  "Categoria",
  "Nome do Vendedor",
  "Situacao do Voucher",
  "Criado em",
  "Status do Recebimento",
  "Data de Recebimento",
  "Codigo do Romaneio",
  "Elegivel",
  "Bloqueado",
  "Pago",
  "Controle",
] as const;

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeOptions(values: unknown): string[] {
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

export default function FechamentosPage() {
  const { toast } = useToast();
  const [selectedRede, setSelectedRede] = useState<string>(REDE_ALL_VALUE);
  const [dataCorte, setDataCorte] = useState<string>(getTodayIsoDate());
  const [shouldSearch, setShouldSearch] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [currentFilters, setCurrentFilters] = useState<LogisticaFechamentosFilters>({});

  const { data: dispositivosData } = useAdmDispositivosAggregates({});

  const redesDisponiveis = useMemo(() => {
    return normalizeOptions(dispositivosData?.filtros_disponiveis?.redes);
  }, [dispositivosData?.filtros_disponiveis?.redes]);

  const { data, isLoading, isFetching, isError, error, refetch } = useAdmFechamentosAggregates(
    currentFilters,
    shouldSearch
  );

  const rows = useMemo(() => normalizeRows(data?.tabela_resultado), [data?.tabela_resultado]);

  const columns = useMemo(() => {
    if (!rows.length) return [];

    const availableKeys = Object.keys(rows[0]);
    const availableSet = new Set(availableKeys);

    const preferred = FECHAMENTOS_COLUMNS_ORDER.filter((col) => availableSet.has(col));
    const remainder = availableKeys.filter((col) => !preferred.includes(col as (typeof FECHAMENTOS_COLUMNS_ORDER)[number]));

    return [...preferred, ...remainder];
  }, [rows]);

  const errorMessage = isError ? (error as Error)?.message : null;

  const handleGenerate = useCallback(() => {
    if (!dataCorte) {
      toast({
        title: "Data de corte obrigatória",
        description: "Selecione uma data de corte para gerar o fechamento.",
        variant: "destructive",
      });
      return;
    }

    const filters: LogisticaFechamentosFilters = {
      data_corte: dataCorte,
      rede: selectedRede === REDE_ALL_VALUE ? undefined : selectedRede,
    };

    setCurrentFilters(filters);
    setShouldSearch(true);
  }, [dataCorte, selectedRede, toast]);

  const handleRefresh = useCallback(() => {
    if (!shouldSearch) {
      handleGenerate();
      return;
    }
    void refetch();
  }, [handleGenerate, refetch, shouldSearch]);

  const handleExportExcel = useCallback(async () => {
    if (!rows.length || !columns.length) {
      toast({
        title: "Sem dados para exportar",
        description: "Gere o relatório de fechamento antes de exportar.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsExporting(true);
      const XLSX = await import("xlsx");

      const exportRows = rows.map((row) => {
        const output: Record<string, unknown> = {};
        columns.forEach((col) => {
          output[col] = row[col] ?? "";
        });
        return output;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Fechamentos");
      XLSX.writeFile(workbook, "fechamento_logistica.xlsx");
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
  }, [columns, rows, toast]);

  const renderCell = useCallback((column: string, value: unknown) => {
    const text = value === undefined || value === null || value === "" ? "-" : String(value);

    if (column === "Controle") {
      const isPagar = text.toUpperCase() === "PAGAR";
      return (
        <span className={isPagar ? "font-semibold text-green-600" : "text-red-600"}>
          {text}
        </span>
      );
    }

    return text;
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="Fechamentos"
        description="Relatório de elegibilidade e controle de pagamento por data de corte"
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
            Parâmetros de Fechamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Rede</label>
              <Select value={selectedRede} onValueChange={setSelectedRede}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as Redes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={REDE_ALL_VALUE}>Todas as Redes</SelectItem>
                  {redesDisponiveis.map((rede) => (
                    <SelectItem key={rede} value={rede}>{rede}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Data de Corte</label>
              <Input type="date" value={dataCorte} onChange={(e) => setDataCorte(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleGenerate} disabled={isLoading || isFetching}>
              {(isLoading || isFetching) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4 mr-2" />
              )}
              Gerar Fechamento
            </Button>
            <Button variant="outline" onClick={handleRefresh} disabled={isLoading || isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={handleExportExcel} disabled={isExporting || !rows.length}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "Exportando..." : "Exportar Excel"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {shouldSearch && data?.meta && (
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>Total de Registros: <strong>{data.meta.total_registros}</strong></span>
          {data.mensagem ? <span>{data.mensagem}</span> : null}
        </div>
      )}

      {(isLoading || isFetching) && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>Gerando relatório de fechamento...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && shouldSearch && rows.length === 0 && !errorMessage && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum dado encontrado para os filtros selecionados.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tabela de Fechamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead key={column} className="whitespace-nowrap">
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 500).map((row, rowIndex) => (
                    <TableRow key={`fechamento-row-${rowIndex}`}>
                      {columns.map((column) => (
                        <TableCell key={`${column}-${rowIndex}`} className="whitespace-nowrap">
                          {renderCell(column, row[column])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 500 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Mostrando 500 de {rows.length} registros.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}