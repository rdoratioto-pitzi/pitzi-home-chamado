/**
 * Página de Dispositivos - Dashboard de Logística
 * 
 * Esta página exibe:
 * - Filtros: Rede, Filial, Quinzena, Status da Coleta, Transportadora
 * - Tabela Resumo por Quinzena e Status (Quantidade)
 * - Tabela Resumo por Quinzena e Status (Valores)
 * - Gráfico de Barras: Conclusão de Quinzenas (stack 100%)
 * - Mapa do Brasil por Estado (quantidade de registros)
 * - Tabela Resumo por Transportadora (Recebidos, Coleta Solicitada, Lead Time)
 * - Tabela SLA por Transportadora (dentro/fora de 20 dias)
 * - Tabela Completa de Movimentação Logística com paginação
 */
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Warehouse, Download, Filter, RefreshCw, AlertCircle, Loader2, ChevronsUpDown } from "lucide-react";
import { useAdmDispositivosAggregates, LogisticaFilters, LogisticaDispositivosResponse } from "@/hooks/use-adm-logistica";
import { DataTable } from "@/components/data-table";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart, Cell, LabelList } from "recharts";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

const QUINZENA_STATUS_COLORS = {
  pendente: "#EA2B1F",
  criado: "#F46036",
  coleta: "#FAA916",
  recebido: "#58BC82",
  destaqueUltimaQuinzena: "#1E90FF",
  totalGeral: "#00BFFF",
} as const;

type QuinzenaRow = {
  Quinzena: string;
  "Pendente de Coleta": number;
  "Criado pelo cliente": number;
  "Coleta Solicitada": number;
  Recebido: number;
  "Total Geral": number;
  pendente_qtd: number;
  criado_qtd: number;
  coleta_qtd: number;
  recebido_qtd: number;
  isLatestQuinzena: boolean;
};

type SummaryTableType = "quantidade" | "valores";

type SummaryCellSelection = {
  summaryType: SummaryTableType;
  quinzena: string;
  status: string | null;
  value: unknown;
};

const BRAZIL_GEOJSON_URL =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

const UF_COORDS: Record<string, [number, number]> = {
  AC: [-70.55, -9.02],
  AL: [-36.55, -9.62],
  AP: [-51.77, 1.41],
  AM: [-63.07, -3.47],
  BA: [-41.17, -12.96],
  CE: [-39.53, -5.2],
  DF: [-47.93, -15.78],
  ES: [-40.33, -19.19],
  GO: [-49.63, -16.64],
  MA: [-45.27, -5.42],
  MT: [-56.1, -12.64],
  MS: [-54.54, -20.51],
  MG: [-44.38, -18.1],
  PA: [-52.48, -3.79],
  PB: [-36.72, -7.12],
  PR: [-51.55, -24.89],
  PE: [-37.86, -8.28],
  PI: [-42.28, -7.72],
  RJ: [-43.2, -22.84],
  RN: [-36.52, -5.81],
  RS: [-53.37, -30.03],
  RO: [-63.9, -11.22],
  RR: [-61.22, 1.89],
  SC: [-49.71, -27.45],
  SP: [-48.55, -22.19],
  SE: [-37.07, -10.9],
  TO: [-48.25, -10.25],
};

const BLUE_SCALE = ["#EAF2FB", "#D2E3F6", "#A9C8EA", "#7BA8DA", "#4D87C5", "#1F5EA8"];

// Função para formatar valores em reais (R$)
const formatCurrency = (value: unknown): string => {
  if (value === undefined || value === null) return "-";
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
};

// Componente para renderizar tabela de dados
function DataTableCard({
  title,
  data,
  columns,
  formatCurrencyColumns = [],
  onCellClick,
  isCellClickable,
  headerAction,
}: {
  title: string;
  data: Record<string, unknown>[];
  columns: { key: string; label: string }[];
  formatCurrencyColumns?: string[];
  onCellClick?: (args: {
    row: Record<string, unknown>;
    columnKey: string;
    value: unknown;
  }) => void;
  isCellClickable?: (row: Record<string, unknown>, columnKey: string) => boolean;
  headerAction?: React.ReactNode;
}) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {headerAction}
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum dado disponível</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderCellValue = (value: unknown, columnKey: string): string => {
    if (formatCurrencyColumns.includes(columnKey)) {
      return formatCurrency(value);
    }
    return value !== undefined ? String(value) : "-";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {headerAction}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {columns.map((col) => (
                  <th key={col.key} className="text-left p-2 font-medium">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} className="border-b hover:bg-muted/50">
                  {columns.map((col) => {
                    const isClickable =
                      Boolean(onCellClick) &&
                      (isCellClickable ? isCellClickable(row, col.key) : true);

                    return (
                      <td key={col.key} className="p-2">
                        {isClickable ? (
                          <button
                            type="button"
                            className="w-full text-left hover:underline underline-offset-2 text-primary"
                            onClick={() => onCellClick?.({ row, columnKey: col.key, value: row[col.key] })}
                          >
                            {renderCellValue(row[col.key], col.key)}
                          </button>
                        ) : (
                          renderCellValue(row[col.key], col.key)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DispositivosPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<LogisticaFilters>({});
  const [selectedQuinzenas, setSelectedQuinzenas] = useState<string[]>([]);
  const [appliedQuinzenas, setAppliedQuinzenas] = useState<string[]>([]);
  const [quinzenaFilterInitialized, setQuinzenaFilterInitialized] = useState(false);
  const [summaryCellSelection, setSummaryCellSelection] = useState<SummaryCellSelection | null>(null);
  const [isExportingDetail, setIsExportingDetail] = useState(false);
  const [exportingTable, setExportingTable] = useState<"qtd" | "valores" | "completa" | null>(null);
  
  // Chamar a API com os filtros
  const { data, isLoading, isError, error, refetch, isFetching } = useAdmDispositivosAggregates(filters);

  // Funções para atualizar filtros
  const updateFilter = (key: keyof LogisticaFilters, value: string) => {
    const newValue = value === "all" ? undefined : value;
    setFilters(prev => ({ ...prev, [key]: newValue }));
  };

  const areStringArraysEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
  };

  const clearFilters = () => {
    setFilters({});
    setSelectedQuinzenas(quinzenaOptions);
    setAppliedQuinzenas(quinzenaOptions);
  };

  // Tratamento de erros
  const errorMessage = isError ? (error as Error)?.message : null;

  // Extrair opções dos filtros disponíveis
  const filtrosDisponiveis = data?.filtros_disponiveis;
  const quinzenaOptions = useMemo(() => {
    const filtrosComAlias = filtrosDisponiveis as
      | (typeof filtrosDisponiveis & { quinzenas?: string[]; quincenas?: string[] })
      | undefined;

    const base = filtrosComAlias?.quinzenas || filtrosComAlias?.quincenas || [];
    return [...base].sort((a, b) =>
      a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" })
    );
  }, [filtrosDisponiveis]);

  useEffect(() => {
    if (!quinzenaOptions.length) {
      if (!quinzenaFilterInitialized) {
        setSelectedQuinzenas([]);
      }
      return;
    }

    if (!quinzenaFilterInitialized) {
      setSelectedQuinzenas(quinzenaOptions);
      setAppliedQuinzenas(quinzenaOptions);
      setQuinzenaFilterInitialized(true);
      return;
    }

    setSelectedQuinzenas((prev) => {
      const filtered = prev.filter((item) => quinzenaOptions.includes(item));
      return filtered.length ? filtered : quinzenaOptions;
    });

    setAppliedQuinzenas((prev) => {
      const filtered = prev.filter((item) => quinzenaOptions.includes(item));
      return filtered.length ? filtered : quinzenaOptions;
    });
  }, [quinzenaFilterInitialized, quinzenaOptions]);

  const allQuinzenasSelected = quinzenaOptions.length > 0 && selectedQuinzenas.length === quinzenaOptions.length;

  const hasPendingQuinzenaChanges = useMemo(() => {
    return !areStringArraysEqual(selectedQuinzenas, appliedQuinzenas);
  }, [appliedQuinzenas, selectedQuinzenas]);

  const quinzenaFilterLabel = useMemo(() => {
    if (selectedQuinzenas.length === 0) return "Filtrar Quinzenas";
    if (allQuinzenasSelected) return "Todas as Quinzenas";
    if (selectedQuinzenas.length === 1) return selectedQuinzenas[0];
    return `${selectedQuinzenas.length} quinzenas selecionadas`;
  }, [allQuinzenasSelected, selectedQuinzenas]);

  const toggleQuinzena = (quinzena: string) => {
    setSelectedQuinzenas((prev) => {
      const isSelected = prev.includes(quinzena);
      const next = isSelected ? prev.filter((item) => item !== quinzena) : [...prev, quinzena];
      return quinzenaOptions.filter((item) => next.includes(item));
    });
  };

  const selectAllQuinzenas = () => {
    setSelectedQuinzenas(quinzenaOptions);
  };

  const applyQuinzenaFilter = () => {
    if (selectedQuinzenas.length === 0) {
      toast({
        title: "Selecione ao menos uma quinzena",
        description: "Marque pelo menos uma quinzena para aplicar o filtro.",
        variant: "destructive",
      });
      return;
    }

    const normalized = quinzenaOptions.filter((item) => selectedQuinzenas.includes(item));
    setAppliedQuinzenas(normalized);
  };

  const parseLocaleNumber = (value: unknown): number | null => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string") return null;

    const cleaned = value
      .replace(/\s/g, "")
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/%/g, "");

    if (!cleaned || cleaned === "-" || cleaned.toLowerCase() === "nan") {
      return null;
    }

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const normalizeText = (value: unknown) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

  const toFileSafeToken = (value: string) =>
    normalizeText(value)
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

  const applyLocalQuinzenaFilter = (rows: Record<string, unknown>[]) => {
    if (!rows.length) return rows;

    const quinzenaKey = Object.keys(rows[0]).find((key) => key.toLowerCase().includes("quinz"));
    if (!quinzenaKey) return rows;

    const dataRows = rows.filter((row) => String(row[quinzenaKey] ?? "") !== "Total");
    const filteredRows = dataRows.filter((row) => appliedQuinzenas.includes(String(row[quinzenaKey] ?? "")));

    if (!filteredRows.length) return [];

    const hasTotalRow = rows.some((row) => String(row[quinzenaKey] ?? "") === "Total");
    if (!hasTotalRow) return filteredRows;

    const keys = Object.keys(rows[0]);
    const totalRow: Record<string, unknown> = {};

    keys.forEach((key) => {
      if (key === quinzenaKey) {
        totalRow[key] = "Total";
        return;
      }

      let sum = 0;
      let hasNumeric = false;

      filteredRows.forEach((row) => {
        const numberValue = parseLocaleNumber(row[key]);
        if (numberValue !== null) {
          sum += numberValue;
          hasNumeric = true;
        }
      });

      totalRow[key] = hasNumeric ? Number(sum.toFixed(2)) : "-";
    });

    return [...filteredRows, totalRow];
  };

  const tabelaQtdFiltrada = useMemo(() => applyLocalQuinzenaFilter(data?.tabela_qtd || []), [appliedQuinzenas, data?.tabela_qtd]);
  const tabelaValoresFiltrada = useMemo(() => applyLocalQuinzenaFilter(data?.tabela_valores || []), [appliedQuinzenas, data?.tabela_valores]);
  
  // Ordem das colunas para tabelas de quantidade e valores
  const columnOrder = ["Quinzena", "Pendente de Coleta", "Criado pelo cliente", "Coleta Solicitada", "Recebido", "Total Geral"];

  // Ordem das colunas para Resumo por Transportadora
  const transportadoraColumnOrder = [
    "Operador Logístico",
    "Recebidos",
    "Coleta_Solicitada",
    "LeadTimeMedio",
    "LeadTimeMin",
    "LeadTimeMax",
    "PercDentroSLA"
  ];

  // Ordem das colunas para SLA por Transportadora
  const slaColumnOrder = [
    "Operador Logístico",
    "Coletas_Dentro_SLA",
    "Coletas_Fora_SLA"
  ];

  // Ordem das colunas para Tabela Completa
  const completaColumnOrder = [
    "IMEI",
    "Código do Voucher",
    "Descrição do Produto",
    "Nome do Vendedor",
    "Loja",
    "Rede",
    "Cidade",
    "UF",
    "Data de Compra",
    "Mês da Compra",
    "Romaneio",
    "Data do Romaneio",
    "Operador Logístico",
    "Data de Recebimento",
    "Valor do Aparelho",
    "Valor do Voucher",
    "Reciclagem",
    "Quinzena",
    "QuinzenaSort",
    "Status da Coleta",
    "Valor do Aparelho (float)",
    "Lead Time (dias)",
    "Responsável"
  ];

  // Função para ordenar colunas conforme a ordem especificada
  const orderColumns = (columns: { key: string; label: string }[], order: string[]) => {
    return columns.sort((a, b) => {
      const indexA = order.indexOf(a.key);
      const indexB = order.indexOf(b.key);
      // Se a coluna não estiver na lista, coloca no final
      const posA = indexA === -1 ? 999 : indexA;
      const posB = indexB === -1 ? 999 : indexB;
      return posA - posB;
    });
  };

  // Colunas para as tabelas
  const qtdColumns = useMemo(() => {
    if (!tabelaQtdFiltrada.length) return [];
    const columns = Object.keys(tabelaQtdFiltrada[0]).map(key => ({ key, label: key }));
    return orderColumns(columns, columnOrder);
  }, [tabelaQtdFiltrada]);

  const valoresColumns = useMemo(() => {
    if (!tabelaValoresFiltrada.length) return [];
    const columns = Object.keys(tabelaValoresFiltrada[0]).map(key => ({ key, label: key }));
    return orderColumns(columns, columnOrder);
  }, [tabelaValoresFiltrada]);

  // Identificar colunas de valores na tabela de valores (todas exceto Quinzena)
  const valoresCurrencyColumns = useMemo(() => {
    if (!tabelaValoresFiltrada.length) return [];
    const columns = Object.keys(tabelaValoresFiltrada[0]);
    return columns.filter(col => col !== "Quinzena");
  }, [tabelaValoresFiltrada]);

  const transportadoraColumns = useMemo(() => {
    if (!data?.tabela_transportadora?.length) return [];
    const columns = Object.keys(data.tabela_transportadora[0]).map(key => ({ key, label: key }));
    return orderColumns(columns, transportadoraColumnOrder);
  }, [data?.tabela_transportadora]);

  const slaColumns = useMemo(() => {
    if (!data?.tabela_sla_transportadora?.length) return [];
    const columns = Object.keys(data.tabela_sla_transportadora[0]).map(key => ({ key, label: key }));
    return orderColumns(columns, slaColumnOrder);
  }, [data?.tabela_sla_transportadora]);

  const completaColumns = useMemo(() => {
    if (!data?.tabela_completa?.length) return [];
    const columns = Object.keys(data.tabela_completa[0]).map(key => ({ key, label: key }));
    return orderColumns(columns, completaColumnOrder);
  }, [data?.tabela_completa]);

  const latestQuinzena = useMemo(() => {
    if (!data?.tabela_completa?.length) return null;

    const candidates = data.tabela_completa
      .map((row) => {
        const quinzena = row["Quinzena"];
        if (!quinzena) return null;
        return {
          quinzena: String(quinzena),
          sort: row["QuinzenaSort"],
        };
      })
      .filter((item): item is { quinzena: string; sort: unknown } => item !== null);

    if (!candidates.length) return null;

    const sorted = [...candidates].sort((a, b) => {
      const aNum = Number(a.sort);
      const bNum = Number(b.sort);

      if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
        return aNum - bNum;
      }

      const aKey = a.sort === undefined || a.sort === null || String(a.sort).trim() === ""
        ? a.quinzena
        : String(a.sort);
      const bKey = b.sort === undefined || b.sort === null || String(b.sort).trim() === ""
        ? b.quinzena
        : String(b.sort);

      return aKey.localeCompare(bKey, "pt-BR", { numeric: true, sensitivity: "base" });
    });

    return sorted[sorted.length - 1]?.quinzena ?? null;
  }, [data?.tabela_completa]);

  // Dados transformados para o gráfico de conclusão de quinzenas (espelhando app_logistica.py)
  const chartData = useMemo<QuinzenaRow[]>(() => {
    if (!tabelaQtdFiltrada.length) return [];

    const roundOneDecimal = (value: number) => Math.round(value * 10) / 10;

    return tabelaQtdFiltrada
      .filter((row) => {
        const quinzena = String(row["Quinzena"] ?? "");
        const total = Number(row["Total Geral"]) || 0;
        const recebido = Number(row["Recebido"]) || 0;
        if (!quinzena || quinzena === "Total") return false;
        // Mesma regra do Python: excluir quinzenas concluídas (Total Geral == Recebido)
        return total !== recebido;
      })
      .map((row) => {
        const quinzena = String(row["Quinzena"]);
        const total = Number(row["Total Geral"]) || 0;
        const pendente = Number(row["Pendente de Coleta"]) || 0;
        const criado = Number(row["Criado pelo cliente"]) || 0;
        const coleta = Number(row["Coleta Solicitada"]) || 0;
        const recebido = Number(row["Recebido"]) || 0;

        return {
          Quinzena: quinzena,
          "Pendente de Coleta": total > 0 ? roundOneDecimal((pendente / total) * 100) : 0,
          "Criado pelo cliente": total > 0 ? roundOneDecimal((criado / total) * 100) : 0,
          "Coleta Solicitada": total > 0 ? roundOneDecimal((coleta / total) * 100) : 0,
          Recebido: total > 0 ? roundOneDecimal((recebido / total) * 100) : 0,
          "Total Geral": total,
          pendente_qtd: pendente,
          criado_qtd: criado,
          coleta_qtd: coleta,
          recebido_qtd: recebido,
          isLatestQuinzena: latestQuinzena === quinzena,
        };
      });
  }, [tabelaQtdFiltrada, latestQuinzena]);

  const ufCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    (data?.tabela_completa || []).forEach((row) => {
      const rawUf = row["UF"] ?? row["Estado"] ?? row["estado"];
      if (!rawUf) return;

      const uf = String(rawUf).trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(uf)) return;

      counts[uf] = (counts[uf] || 0) + 1;
    });

    return counts;
  }, [data?.tabela_completa]);

  const maxUfCount = useMemo(() => {
    const values = Object.values(ufCounts);
    return values.length ? Math.max(...values) : 0;
  }, [ufCounts]);

  const totalUfRegistros = useMemo(
    () => Object.values(ufCounts).reduce((sum, value) => sum + value, 0),
    [ufCounts]
  );

  const getUfFill = (count: number) => {
    if (count <= 0 || maxUfCount === 0) return "#EEF2F7";

    const ratio = count / maxUfCount;
    const index = Math.min(BLUE_SCALE.length - 1, Math.floor(ratio * BLUE_SCALE.length));
    return BLUE_SCALE[index];
  };

  const topUfEntries = useMemo(() => {
    return Object.entries(ufCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [ufCounts]);

  const detailRows = useMemo(() => {
    if (!summaryCellSelection || !data?.tabela_completa?.length) return [];

    const sampleRow = data.tabela_completa[0];
    const quinzenaKey = Object.keys(sampleRow).find((key) => key.toLowerCase().includes("quinz"));

    const statusKey =
      Object.keys(sampleRow).find(
        (key) => key.toLowerCase().includes("status") && key.toLowerCase().includes("coleta")
      ) || Object.keys(sampleRow).find((key) => key.toLowerCase().includes("status"));

    if (!quinzenaKey) return [];

    const targetQuinzena = normalizeText(summaryCellSelection.quinzena);
    const targetStatus = summaryCellSelection.status ? normalizeText(summaryCellSelection.status) : null;

    return data.tabela_completa.filter((row) => {
      const rowQuinzena = normalizeText(row[quinzenaKey]);
      if (rowQuinzena !== targetQuinzena) return false;

      if (!targetStatus) return true;
      if (!statusKey) return false;

      return normalizeText(row[statusKey]) === targetStatus;
    });
  }, [data?.tabela_completa, summaryCellSelection]);

  const handleSummaryCellClick = (
    summaryType: SummaryTableType,
    row: Record<string, unknown>,
    columnKey: string,
    value: unknown
  ) => {
    const quinzena = String(row["Quinzena"] ?? "").trim();
    if (!quinzena || quinzena.toLowerCase() === "total") {
      return;
    }

    const status = columnKey === "Quinzena" || columnKey === "Total Geral" ? null : columnKey;

    setSummaryCellSelection({
      summaryType,
      quinzena,
      status,
      value,
    });
  };

  const handleExportDetailsToExcel = async () => {
    if (!summaryCellSelection || detailRows.length === 0) {
      toast({
        title: "Sem dados para exportar",
        description: "Selecione uma célula com registros disponíveis para exportação.",
      });
      return;
    }

    try {
      setIsExportingDetail(true);
      const XLSX = await import("xlsx");

      const formattedRows = detailRows.map((row) => {
        const rowOutput: Record<string, unknown> = {};
        completaColumns.forEach((col) => {
          rowOutput[col.label] = row[col.key] ?? "";
        });
        return rowOutput;
      });

      const worksheet = XLSX.utils.json_to_sheet(formattedRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Detalhamento");

      const quinzenaToken = toFileSafeToken(summaryCellSelection.quinzena);
      const statusToken = summaryCellSelection.status
        ? toFileSafeToken(summaryCellSelection.status)
        : "todos_status";

      XLSX.writeFile(workbook, `detalhamento_dispositivos_${quinzenaToken}_${statusToken}.xlsx`);
    } catch (exportError) {
      toast({
        title: "Erro ao exportar",
        description:
          exportError instanceof Error ? exportError.message : "Não foi possível exportar o arquivo Excel.",
        variant: "destructive",
      });
    } finally {
      setIsExportingDetail(false);
    }
  };

  const exportTableToExcel = async ({
    rows,
    columns,
    filename,
    tableKey,
    formatCurrencyCols = [],
  }: {
    rows: Record<string, unknown>[];
    columns: { key: string; label: string }[];
    filename: string;
    tableKey: "qtd" | "valores" | "completa";
    formatCurrencyCols?: string[];
  }) => {
    if (!rows.length || !columns.length) {
      toast({
        title: "Sem dados para exportar",
        description: "A tabela selecionada não possui dados no momento.",
      });
      return;
    }

    try {
      setExportingTable(tableKey);
      const XLSX = await import("xlsx");

      const formattedRows = rows.map((row) => {
        const output: Record<string, unknown> = {};
        columns.forEach((col) => {
          output[col.label] = formatCurrencyCols.includes(col.key)
            ? formatCurrency(row[col.key])
            : (row[col.key] ?? "");
        });
        return output;
      });

      const worksheet = XLSX.utils.json_to_sheet(formattedRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
      XLSX.writeFile(workbook, filename);
    } catch (exportError) {
      toast({
        title: "Erro ao exportar",
        description:
          exportError instanceof Error ? exportError.message : "Não foi possível exportar o arquivo Excel.",
        variant: "destructive",
      });
    } finally {
      setExportingTable(null);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="Dispositivos"
        description="Dashboard de dispositivos logísticos com análise por quinzenas, transportadoras e estados"
      />

      {/* Mensagem de erro */}
      {errorMessage && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>Erro ao carregar dados: {errorMessage}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Tentar novamente
              </Button>
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Rede</label>
              <FilterCombobox
                value={filters.rede || "all"}
                onValueChange={(value) => updateFilter("rede", value)}
                options={filtrosDisponiveis?.redes || []}
                allLabel="Todas as Redes"
                placeholder="Todas as Redes"
                searchPlaceholder="Buscar rede..."
                emptyMessage="Nenhuma rede encontrada"
                className="w-full h-10 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Filial</label>
              <FilterCombobox
                value={filters.filial || "all"}
                onValueChange={(value) => updateFilter("filial", value)}
                options={filtrosDisponiveis?.filiais || []}
                allLabel="Todas as Filiais"
                placeholder="Todas as Filiais"
                searchPlaceholder="Buscar filial..."
                emptyMessage="Nenhuma filial encontrada"
                className="w-full h-10 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Quinzena</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-10 justify-between text-sm font-normal"
                    disabled={isLoading}
                  >
                    <span className="truncate">{quinzenaFilterLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[320px]">
                  <DropdownMenuLabel>Filtrar Quinzenas</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={allQuinzenasSelected}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        selectAllQuinzenas();
                      } else {
                        setSelectedQuinzenas([]);
                      }
                    }}
                  >
                    Selecionar todas
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {quinzenaOptions.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      Nenhuma quinzena disponível
                    </div>
                  ) : (
                    quinzenaOptions.map((quinzena) => (
                      <DropdownMenuCheckboxItem
                        key={quinzena}
                        checked={selectedQuinzenas.includes(quinzena)}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={() => toggleQuinzena(quinzena)}
                      >
                        {quinzena}
                      </DropdownMenuCheckboxItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Status da Coleta</label>
              <Select 
                value={filters.status_coleta || "all"} 
                onValueChange={(value) => updateFilter("status_coleta", value)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  {filtrosDisponiveis?.status_coleta?.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Transportadora</label>
              <Select 
                value={filters.transportadora || "all"} 
                onValueChange={(value) => updateFilter("transportadora", value)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as Transportadoras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Transportadoras</SelectItem>
                  {filtrosDisponiveis?.transportadoras?.map((tsp) => (
                    <SelectItem key={tsp} value={tsp}>{tsp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => refetch()} disabled={isLoading || isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              {isFetching ? "Atualizando..." : "Atualizar"}
            </Button>
            <Button
              variant="secondary"
              onClick={applyQuinzenaFilter}
              disabled={isLoading || isFetching || !hasPendingQuinzenaChanges}
            >
              Aplicar Quinzenas
            </Button>
            <Button variant="outline" onClick={clearFilters} disabled={isLoading}>
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Meta info */}
      {data?.meta && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>Total de Registros: <strong>{data.meta.total_registros}</strong></span>
          <span>Total Filtrado: <strong>{data.meta.total_filtrado}</strong></span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>Carregando dados...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conteúdo Principal */}
      {!isLoading && !errorMessage && (
        <Tabs defaultValue="resumo" className="space-y-4">
          <TabsList>
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="quinzenas">Quinzenas</TabsTrigger>
            <TabsTrigger value="transportadoras">Transportadoras</TabsTrigger>
            <TabsTrigger value="mapa">Mapa Brasil</TabsTrigger>
            <TabsTrigger value="completa">Tabela Completa</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DataTableCard
                title="Quantidade por Quinzena e Status"
                data={tabelaQtdFiltrada}
                columns={qtdColumns}
                headerAction={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportTableToExcel({
                        rows: tabelaQtdFiltrada,
                        columns: qtdColumns,
                        filename: "dispositivos_qtd_por_quinzena.xlsx",
                        tableKey: "qtd",
                      })
                    }
                    disabled={exportingTable === "qtd" || !tabelaQtdFiltrada.length}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {exportingTable === "qtd" ? "Exportando..." : "Exportar Excel"}
                  </Button>
                }
                onCellClick={({ row, columnKey, value }) =>
                  handleSummaryCellClick("quantidade", row, columnKey, value)
                }
                isCellClickable={(row) => String(row["Quinzena"] ?? "").toLowerCase() !== "total"}
              />
              <DataTableCard
                title="Valores por Quinzena e Status"
                data={tabelaValoresFiltrada}
                columns={valoresColumns}
                formatCurrencyColumns={valoresCurrencyColumns}
                headerAction={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportTableToExcel({
                        rows: tabelaValoresFiltrada,
                        columns: valoresColumns,
                        filename: "dispositivos_valores_por_quinzena.xlsx",
                        tableKey: "valores",
                        formatCurrencyCols: valoresCurrencyColumns,
                      })
                    }
                    disabled={exportingTable === "valores" || !tabelaValoresFiltrada.length}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {exportingTable === "valores" ? "Exportando..." : "Exportar Excel"}
                  </Button>
                }
                onCellClick={({ row, columnKey, value }) =>
                  handleSummaryCellClick("valores", row, columnKey, value)
                }
                isCellClickable={(row) => String(row["Quinzena"] ?? "").toLowerCase() !== "total"}
              />
            </div>
          </TabsContent>

          <TabsContent value="quinzenas">
            <Card>
              <CardHeader>
                <CardTitle>Conclusão de Quinzenas</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData && chartData.length > 0 ? (
                  <>
                    <div className="flex items-center justify-end mb-2 text-sm" style={{ color: "#1E90FF" }}>
                      <span className="inline-block w-3 h-3 mr-2" style={{ backgroundColor: "#1E90FF" }} />
                      Última Quinzena
                    </div>
                    <div className="rounded-md border p-2" style={{ backgroundColor: "#FFFFFF" }}>
                      <ResponsiveContainer width="100%" height={600}>
                        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                          <XAxis
                            dataKey="Quinzena"
                            tick={{ fontSize: 12 }}
                            label={{ value: "Quinzena", position: "insideBottom", offset: -2 }}
                          />
                          <YAxis
                            yAxisId="left"
                            label={{ value: "Proporção (%)", angle: -90, position: "insideLeft" }}
                            domain={[0, 100]}
                            tickFormatter={(value) => `${value}`}
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            label={{ value: "Total Geral", angle: 90, position: "insideRight" }}
                            allowDecimals={false}
                          />
                          <Tooltip
                            formatter={(value: number, name: string, item) => {
                              if (name === "Total Geral") {
                                return [Number(value).toLocaleString("pt-BR"), name];
                              }

                              const qtyMap: Record<string, keyof QuinzenaRow> = {
                                "Pendente de Coleta": "pendente_qtd",
                                "Criado pelo cliente": "criado_qtd",
                                "Coleta Solicitada": "coleta_qtd",
                                "Recebido": "recebido_qtd",
                              };

                              const qtyKey = qtyMap[name];
                              const qty = qtyKey ? Number(item.payload?.[qtyKey] ?? 0) : 0;
                              return [`${Number(value).toFixed(1)}% | Qtd: ${qty.toLocaleString("pt-BR")}`, name];
                            }}
                            contentStyle={{ backgroundColor: "#fff", border: "1px solid #ccc", borderRadius: "4px" }}
                          />
                          <Legend
                            orientation="horizontal"
                            verticalAlign="top"
                            align="right"
                            wrapperStyle={{ paddingBottom: 8 }}
                          />

                          <Bar
                            yAxisId="left"
                            dataKey="Pendente de Coleta"
                            stackId="a"
                            name="Pendente de Coleta"
                            fill={QUINZENA_STATUS_COLORS.pendente}
                          >
                            {chartData.map((entry) => (
                              <Cell
                                key={`pendente-${entry.Quinzena}`}
                                fill={entry.isLatestQuinzena ? QUINZENA_STATUS_COLORS.destaqueUltimaQuinzena : QUINZENA_STATUS_COLORS.pendente}
                              />
                            ))}
                            <LabelList
                              dataKey="pendente_qtd"
                              position="inside"
                              fontSize={14}
                              fill="#111111"
                              formatter={(value: number) => (value > 0 ? value.toLocaleString("pt-BR") : "")}
                            />
                          </Bar>

                          <Bar
                            yAxisId="left"
                            dataKey="Criado pelo cliente"
                            stackId="a"
                            name="Criado pelo cliente"
                            fill={QUINZENA_STATUS_COLORS.criado}
                          >
                            {chartData.map((entry) => (
                              <Cell
                                key={`criado-${entry.Quinzena}`}
                                fill={entry.isLatestQuinzena ? QUINZENA_STATUS_COLORS.destaqueUltimaQuinzena : QUINZENA_STATUS_COLORS.criado}
                              />
                            ))}
                            <LabelList
                              dataKey="criado_qtd"
                              position="inside"
                              fontSize={14}
                              fill="#111111"
                              formatter={(value: number) => (value > 0 ? value.toLocaleString("pt-BR") : "")}
                            />
                          </Bar>

                          <Bar
                            yAxisId="left"
                            dataKey="Coleta Solicitada"
                            stackId="a"
                            name="Coleta Solicitada"
                            fill={QUINZENA_STATUS_COLORS.coleta}
                          >
                            {chartData.map((entry) => (
                              <Cell
                                key={`coleta-${entry.Quinzena}`}
                                fill={entry.isLatestQuinzena ? QUINZENA_STATUS_COLORS.destaqueUltimaQuinzena : QUINZENA_STATUS_COLORS.coleta}
                              />
                            ))}
                            <LabelList
                              dataKey="coleta_qtd"
                              position="inside"
                              fontSize={14}
                              fill="#111111"
                              formatter={(value: number) => (value > 0 ? value.toLocaleString("pt-BR") : "")}
                            />
                          </Bar>

                          <Bar
                            yAxisId="left"
                            dataKey="Recebido"
                            stackId="a"
                            name="Recebido"
                            fill={QUINZENA_STATUS_COLORS.recebido}
                          >
                            {chartData.map((entry) => (
                              <Cell
                                key={`recebido-${entry.Quinzena}`}
                                fill={entry.isLatestQuinzena ? QUINZENA_STATUS_COLORS.destaqueUltimaQuinzena : QUINZENA_STATUS_COLORS.recebido}
                              />
                            ))}
                            <LabelList
                              dataKey="recebido_qtd"
                              position="inside"
                              fontSize={14}
                              fill="#111111"
                              formatter={(value: number) => (value > 0 ? value.toLocaleString("pt-BR") : "")}
                            />
                          </Bar>

                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="Total Geral"
                            stroke={QUINZENA_STATUS_COLORS.totalGeral}
                            strokeWidth={3}
                            dot={{ fill: QUINZENA_STATUS_COLORS.totalGeral, r: 5 }}
                            name="Total Geral"
                          >
                            <LabelList
                              dataKey="Total Geral"
                              position="top"
                              formatter={(value: number) => value.toLocaleString("pt-BR")}
                            />
                          </Line>
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>Nenhum dado disponível para exibir</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transportadoras">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DataTableCard 
                title="Resumo por Transportadora" 
                data={data?.tabela_transportadora || []} 
                columns={transportadoraColumns}
              />
              <DataTableCard 
                title="SLA por Transportadora" 
                data={data?.tabela_sla_transportadora || []} 
                columns={slaColumns}
              />
            </div>
          </TabsContent>

          <TabsContent value="mapa">
            <Card>
              <CardHeader>
                <CardTitle>Mapa do Brasil por Estado (UF)</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(ufCounts).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Warehouse className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Sem dados de UF para exibir no mapa.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                    <div className="xl:col-span-3 rounded-md border bg-white p-2">
                      <ComposableMap
                        projection="geoMercator"
                        projectionConfig={{ center: [-54, -15], scale: 750 }}
                        style={{ width: "100%", height: "620px" }}
                      >
                        <Geographies geography={BRAZIL_GEOJSON_URL}>
                          {({ geographies }: { geographies: Array<{ rsmKey: string; properties?: { sigla?: string } }> }) =>
                            geographies.map((geo: { rsmKey: string; properties?: { sigla?: string } }) => {
                              const uf = String(geo.properties?.sigla || "").toUpperCase();
                              const count = ufCounts[uf] || 0;

                              return (
                                <Geography
                                  key={geo.rsmKey}
                                  geography={geo}
                                  fill={getUfFill(count)}
                                  stroke="#FFFFFF"
                                  strokeWidth={0.8}
                                  style={{
                                    default: { outline: "none" },
                                    hover: { fill: "#0F3F83", outline: "none" },
                                    pressed: { outline: "none" },
                                  }}
                                >
                                  <title>{`${uf}: ${count.toLocaleString("pt-BR")} registros`}</title>
                                </Geography>
                              );
                            })
                          }
                        </Geographies>

                        {Object.entries(ufCounts).map(([uf, quantidade]) => {
                          const coords = UF_COORDS[uf];
                          if (!coords) return null;

                          return (
                            <Marker key={`marker-${uf}`} coordinates={coords}>
                              <text
                                textAnchor="middle"
                                fontSize={10}
                                fill="#111827"
                                style={{ pointerEvents: "none", fontWeight: 600 }}
                              >
                                <tspan x="0" dy="0">{uf}</tspan>
                                <tspan x="0" dy="12">{quantidade}</tspan>
                              </text>
                            </Marker>
                          );
                        })}
                      </ComposableMap>
                    </div>

                    <div className="space-y-3">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Resumo</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 text-sm">
                          <div className="flex items-center justify-between">
                            <span>UFs com registros</span>
                            <strong>{Object.keys(ufCounts).length}</strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Total de registros</span>
                            <strong>{totalUfRegistros.toLocaleString("pt-BR")}</strong>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Top UFs</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 text-sm">
                          {topUfEntries.map(([uf, value]) => (
                            <div key={`top-${uf}`} className="flex items-center justify-between">
                              <span>{uf}</span>
                              <strong>{value.toLocaleString("pt-BR")}</strong>
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Intensidade</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-3 rounded-sm" style={{ background: "linear-gradient(to right, #EAF2FB, #1F5EA8)" }} />
                          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span>Menor</span>
                            <span>Maior</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completa">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Tabela Completa de Movimentação Logística</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportTableToExcel({
                      rows: data?.tabela_completa || [],
                      columns: completaColumns,
                      filename: "dispositivos_tabela_completa.xlsx",
                      tableKey: "completa",
                    })
                  }
                  disabled={exportingTable === "completa" || !(data?.tabela_completa?.length)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exportingTable === "completa" ? "Exportando..." : "Exportar Excel"}
                </Button>
              </CardHeader>
              <CardContent>
                {data?.tabela_completa && data.tabela_completa.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          {completaColumns.map((col) => (
                            <th key={col.key} className="text-left p-2 font-medium">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.tabela_completa.slice(0, 100).map((row, idx) => (
                          <tr key={idx} className="border-b hover:bg-muted/50">
                            {completaColumns.map((col) => (
                              <td key={col.key} className="p-2">
                                {row[col.key] !== undefined ? String(row[col.key]) : "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {data.tabela_completa.length > 100 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Mostrando 100 de {data.tabela_completa.length} registros
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>Nenhum dado disponível para exibir</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Dialog
        open={Boolean(summaryCellSelection)}
        onOpenChange={(open) => {
          if (!open) {
            setSummaryCellSelection(null);
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-[1200px] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Detalhamento da Célula Selecionada</DialogTitle>
            <DialogDescription>
              {summaryCellSelection
                ? `${summaryCellSelection.summaryType === "quantidade" ? "Resumo de Quantidade" : "Resumo de Valores"} • ${summaryCellSelection.quinzena}${summaryCellSelection.status ? ` • ${summaryCellSelection.status}` : " • Todos os status"}`
                : "Selecione uma célula da tabela de resumo para visualizar os registros completos."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Valor da célula: <strong>{summaryCellSelection?.summaryType === "valores" && summaryCellSelection?.status ? formatCurrency(summaryCellSelection.value) : String(summaryCellSelection?.value ?? "-")}</strong> • Registros encontrados: <strong>{detailRows.length}</strong>
            </p>
            <Button onClick={handleExportDetailsToExcel} disabled={isExportingDetail || detailRows.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              {isExportingDetail ? "Exportando..." : "Exportar Excel"}
            </Button>
          </div>

          <div className="border rounded-md overflow-auto max-h-[62vh]">
            {detailRows.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">Nenhum registro encontrado para esse recorte.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b">
                    {completaColumns.map((col) => (
                      <th key={col.key} className="text-left p-2 font-medium whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      {completaColumns.map((col) => (
                        <td key={col.key} className="p-2 whitespace-nowrap">
                          {row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}