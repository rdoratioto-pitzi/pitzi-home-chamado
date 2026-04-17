import { useEffect, useState, type ReactNode, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Search, X, CalendarDays, Table2, Users, ChevronLeft, ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

type TriagemRecord = Record<string, unknown>;

type TriagemFilters = {
  startDate: string;
  endDate: string;
  categoria: string;
  status: string;
  triador: string;
  rede: string;
  filial: string;
};

const DETAILS_PAGE_SIZE = 25;

function getTodayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

function getMonthStartISO() {
  const now = new Date();
  return format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
}

function getString(row: TriagemRecord, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function normalizeDateValue(value: string): Date | null {
  if (!value) return null;

  const trimmed = value.trim();
  const dateTimeMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (dateTimeMatch) {
    const [, day, month, year, hours = "00", minutes = "00"] = dateTimeMatch;
    // Parse DD/MM/YYYY em horário local, não UTC
    const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // Para ISO format (YYYY-MM-DD), parse em horário local, não UTC
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (isoMatch) {
    const [, year, month, day, hours = "00", minutes = "00"] = isoMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // Fallback: tenta parse direto
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateDisplay(value: string, includeTime = false): string {
  const parsed = normalizeDateValue(value);
  if (!parsed) return value || "—";
  return format(parsed, includeTime ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy");
}

function dateKey(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

function getComparableDate(row: TriagemRecord): Date | null {
  const triagem = getString(row, ["Data_da_Triagem", "Data da Triagem", "data_da_triagem"]);
  const recebimento = getString(row, ["Data_de_Recebimento", "Data de Recebimento", "data_de_recebimento"]);
  return normalizeDateValue(triagem) || normalizeDateValue(recebimento);
}

async function fetchTriagemConsulta(filters: TriagemFilters): Promise<TriagemRecord[]> {
  const params = new URLSearchParams();

  if (filters.startDate) params.set("start_date", filters.startDate);
  if (filters.endDate) params.set("end_date", filters.endDate);
  if (filters.categoria) params.set("tipo_categoria", filters.categoria);
  if (filters.status) params.set("status", filters.status);
  if (filters.triador) params.set("triador", filters.triador);
  if (filters.rede) params.set("rede", filters.rede);
  if (filters.filial) params.set("filial", filters.filial);

  const url = `/api/triagem/consulta${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(raw || `Falha ao consultar triagem (${response.status})`);
  }

  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    const preview = raw.slice(0, 180).replace(/\s+/g, " ").trim();
    throw new Error(
      `Resposta inválida em /api/triagem/consulta: esperado JSON, recebido: ${preview || "(vazio)"}`,
    );
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const maybeError = parsed as { success?: boolean; error?: string };
    if (maybeError.success === false) {
      throw new Error(maybeError.error || "Falha na consulta de triagem.");
    }
  }

  if (Array.isArray(parsed)) return parsed as TriagemRecord[];
  if (Array.isArray((parsed as { data?: unknown }).data)) return (parsed as { data: TriagemRecord[] }).data;
  return [];
}

function useTriagemConsulta(filters: TriagemFilters) {
  return useQuery({
    queryKey: ["triagem-consulta", filters],
    queryFn: () => fetchTriagemConsulta(filters),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

function buildPeriodoRows(rows: TriagemRecord[], startDate: string, endDate: string) {
  const grouped: Record<string, { recebido: number; triado: number }> = {};
  const start = normalizeDateValue(startDate);
  const end = normalizeDateValue(endDate);

  for (const row of rows) {
    const recebimento = normalizeDateValue(getString(row, ["Data_de_Recebimento", "Data de Recebimento", "data_de_recebimento"]));
    const triagem = normalizeDateValue(getString(row, ["Data_da_Triagem", "Data da Triagem", "data_da_triagem"]));

    if (recebimento) {
      const key = dateKey(recebimento);
      grouped[key] ||= { recebido: 0, triado: 0 };
      grouped[key].recebido += 1;
    }

    if (triagem) {
      const key = dateKey(triagem);
      grouped[key] ||= { recebido: 0, triado: 0 };
      grouped[key].triado += 1;
    }
  }

  const dates: Date[] = [];
  if (start && end && start <= end) {
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const limit = new Date(end);
    limit.setHours(0, 0, 0, 0);
    while (cursor <= limit) {
      dates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const rowsByDate = dates.map((date) => {
    const key = dateKey(date);
    const counts = grouped[key] || { recebido: 0, triado: 0 };
    return {
      Data: format(date, "dd/MM/yyyy"),
      Recebido: counts.recebido,
      Triado: counts.triado,
    };
  });

  const totalRecebido = rows.length; // Total de dispositivos recebidos
  const totalTriado = rows.reduce(
    (acc, row) => {
      const status = getString(row, ["Status", "status"]);
      return acc + (status.toLowerCase() === "inspected" ? 1 : 0);
    },
    0,
  );

  rowsByDate.push({ Data: "Total", Recebido: totalRecebido, Triado: totalTriado });
  return rowsByDate;
}

function buildTriadorRows(rows: TriagemRecord[]) {
  const counts: Record<string, number> = {};

  for (const row of rows) {
    const triador = getString(row, ["Triador", "triador"]) || "Sem triador";
    counts[triador] = (counts[triador] || 0) + 1;
  }

  const ordered = Object.entries(counts)
    .sort(([, left], [, right]) => right - left)
    .map(([Triador, Triagens]) => ({ Triador, Triagens }));

  ordered.push({ Triador: "Total", Triagens: rows.length });
  return ordered;
}

function buildDetailRows(rows: TriagemRecord[]) {
  return [...rows]
    .sort((left, right) => {
      const leftDate = getComparableDate(left)?.getTime() || 0;
      const rightDate = getComparableDate(right)?.getTime() || 0;
      return rightDate - leftDate;
    })
    .map((row) => ({
      IMEI: getString(row, ["IMEI", "imei"]),
      Voucher: getString(row, ["Codigo_do_Voucher", "Código do Voucher", "codigo_do_voucher"]),
      Rede: getString(row, ["Rede", "rede"]),
      Filial: getString(row, ["Filial", "filial"]),
      Categoria: getString(row, ["Tipo_de_Categoria", "Tipo de Categoria", "tipo_de_categoria"]),
      Fabricante: getString(row, ["Fabricante", "fabricante", "ManufacturerName"]),
      Descricao: getString(row, ["Descricao_do_Produto", "Descrição do Produto", "descricao_do_produto"]),
      DataRecebimento: formatDateDisplay(getString(row, ["Data_de_Recebimento", "Data de Recebimento", "data_de_recebimento"])),
      DataTriagem: formatDateDisplay(getString(row, ["Data_da_Triagem", "Data da Triagem", "data_da_triagem"]), true),
      Triador: getString(row, ["Triador", "triador"]),
      Status: getString(row, ["Status", "status"]),
      GradeAvaliacao: getString(row, ["Grade_da_Avaliacao", "Grade_da_Avaliação", "Grade da Avaliação", "grade_da_avaliacao", "grade_da_avaliação"]),
      GradeTriagem: getString(row, ["Grade_da_Triagem", "Grade da Triagem", "grade_da_triagem"]),
      Avaliador: getString(row, ["Avaliador", "avaliador"]),
      Defeitos: getString(row, ["Defeitos_da_Triagem", "Defeitos da Triagem", "defeitos_da_triagem"]),
      ObservacaoTriagem: getString(row, ["Observacao_da_Triagem", "Observação da Triagem", "Observacao da Triagem", "observacao_da_triagem", "observação_da_triagem", "ObservationNote", "inspection_note"]),
    }));
}

function extractUniqueOptions(rows: TriagemRecord[], keys: string[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const value = getString(row, keys);
    if (value && value.trim()) {
      seen.add(value.trim());
    }
  }
  return Array.from(seen).sort();
}

function defaultFilters(): TriagemFilters {
  return {
    startDate: getMonthStartISO(),
    endDate: getTodayISO(),
    categoria: "",
    status: "",
    triador: "",
    rede: "",
    filial: "",
  };
}

function TableCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="border shadow-sm">
      <CardHeader className="space-y-1 border-b bg-muted/20">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

export default function TriagemDashboardPage() {
  const [draftFilters, setDraftFilters] = useState<TriagemFilters>(() => defaultFilters());
  const [activeFilters, setActiveFilters] = useState<TriagemFilters>(() => defaultFilters());
  const [detailsPage, setDetailsPage] = useState(1);

  const { data, isLoading, error } = useTriagemConsulta(activeFilters);
  const rows = data ?? [];
  
  // Extrair opções disponíveis dos dados
  const categorias = useMemo(() => extractUniqueOptions(rows, ["Tipo_de_Categoria", "Tipo de Categoria", "tipo_de_categoria"]), [rows]);
  const statusOptions = useMemo(() => extractUniqueOptions(rows, ["Status", "status"]), [rows]);
  const triadores = useMemo(() => extractUniqueOptions(rows, ["Triador", "triador"]), [rows]);
  const redes = useMemo(() => extractUniqueOptions(rows, ["Rede", "rede"]), [rows]);
  const filiais = useMemo(() => extractUniqueOptions(rows, ["Filial", "filial"]), [rows]);
  
  const totalizadores = buildPeriodoRows(rows, activeFilters.startDate, activeFilters.endDate);
  const triadoresCount = buildTriadorRows(rows);
  const detalhes = buildDetailRows(rows);
  const kpis = useMemo(() => {
    const totalRecebidos = rows.length;
    const totalTriados = rows.reduce((acc, row) => {
      const status = getString(row, ["Status", "status"]);
      return acc + (status.toLowerCase() === "inspected" ? 1 : 0);
    }, 0);

    const statusMaintenance = rows.reduce((acc, row) => {
      const status = getString(row, ["Status", "status"]).toLowerCase();
      return acc + (status === "maintenance" ? 1 : 0);
    }, 0);

    const statusDeviceMismatch = rows.reduce((acc, row) => {
      const status = getString(row, ["Status", "status"]).toLowerCase();
      return acc + (status === "devicemismatch" ? 1 : 0);
    }, 0);

    const statusBlocked = rows.reduce((acc, row) => {
      const status = getString(row, ["Status", "status"]).toLowerCase();
      return acc + (status === "blocked" ? 1 : 0);
    }, 0);

    const leadTimeDias: number[] = [];

    for (const row of rows) {
      const recebimento = normalizeDateValue(getString(row, ["Data_de_Recebimento", "Data de Recebimento", "data_de_recebimento"]));
      const triagem = normalizeDateValue(getString(row, ["Data_da_Triagem", "Data da Triagem", "data_da_triagem"]));

      if (!recebimento || !triagem) continue;

      const diffMs = triagem.getTime() - recebimento.getTime();
      if (diffMs < 0) continue;

      leadTimeDias.push(diffMs / (1000 * 60 * 60 * 24));
    }

    let tempoMedianoTriagem = "—";
    if (leadTimeDias.length > 0) {
      const sorted = [...leadTimeDias].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      const mediana = sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
      tempoMedianoTriagem = `${mediana.toFixed(1)} dias`;
    }

    return {
      totalRecebidos,
      totalTriados,
      statusMaintenance,
      statusDeviceMismatch,
      statusBlocked,
      tempoMedianoTriagem,
    };
  }, [rows]);

  const totalDetailPages = Math.max(1, Math.ceil(detalhes.length / DETAILS_PAGE_SIZE));
  const pagedDetalhes = detalhes.slice(
    (detailsPage - 1) * DETAILS_PAGE_SIZE,
    detailsPage * DETAILS_PAGE_SIZE,
  );

  useEffect(() => {
    if (detailsPage > totalDetailPages) {
      setDetailsPage(totalDetailPages);
    }
  }, [detailsPage, totalDetailPages]);

  function applyFilters() {
    setActiveFilters({ ...draftFilters });
    setDetailsPage(1);
  }

  function clearFilters() {
    const next = defaultFilters();
    setDraftFilters(next);
    setActiveFilters(next);
    setDetailsPage(1);
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Triagem — Dashboard" />
      <div className="container mx-auto max-w-[1800px] px-4 py-8 space-y-6">
        <Card className="border shadow-sm">
          <CardHeader className="space-y-1 border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" />
              Filtros da consulta
            </CardTitle>
            <CardDescription>Período, categoria, triador, rede e filial via API interna autenticada.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <DateInput
                value={draftFilters.startDate}
                onChange={(event) => setDraftFilters((current) => ({ ...current, startDate: event.target.value }))}
                placeholder="Data inicial"
                className="w-[160px] h-10"
              />
              <DateInput
                value={draftFilters.endDate}
                onChange={(event) => setDraftFilters((current) => ({ ...current, endDate: event.target.value }))}
                placeholder="Data final"
                className="w-[160px] h-10"
              />
              <FilterCombobox
                value={draftFilters.categoria}
                onValueChange={(value) => setDraftFilters((current) => ({ ...current, categoria: value === "all" ? "" : value }))}
                options={categorias}
                placeholder="Categoria"
                searchPlaceholder="Buscar categoria..."
                allLabel="Todas"
                emptyMessage="Nenhuma categoria encontrada"
                className="w-[160px] h-10"
              />
              <FilterCombobox
                value={draftFilters.status}
                onValueChange={(value) => setDraftFilters((current) => ({ ...current, status: value === "all" ? "" : value }))}
                options={statusOptions}
                placeholder="Status"
                searchPlaceholder="Buscar status..."
                allLabel="Todos"
                emptyMessage="Nenhum status encontrado"
                className="w-[160px] h-10"
              />
              <FilterCombobox
                value={draftFilters.triador}
                onValueChange={(value) => setDraftFilters((current) => ({ ...current, triador: value === "all" ? "" : value }))}
                options={triadores}
                placeholder="Triador"
                searchPlaceholder="Buscar triador..."
                allLabel="Todos"
                emptyMessage="Nenhum triador encontrado"
                className="w-[160px] h-10"
              />
              <FilterCombobox
                value={draftFilters.rede}
                onValueChange={(value) => setDraftFilters((current) => ({ ...current, rede: value === "all" ? "" : value }))}
                options={redes}
                placeholder="Rede"
                searchPlaceholder="Buscar rede..."
                allLabel="Todas"
                emptyMessage="Nenhuma rede encontrada"
                className="w-[160px] h-10"
              />
              <FilterCombobox
                value={draftFilters.filial}
                onValueChange={(value) => setDraftFilters((current) => ({ ...current, filial: value === "all" ? "" : value }))}
                options={filiais}
                placeholder="Filial"
                searchPlaceholder="Buscar filial..."
                allLabel="Todas"
                emptyMessage="Nenhuma filial encontrada"
                className="w-[160px] h-10"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={applyFilters} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Buscar
              </Button>
              <Button variant="outline" onClick={clearFilters} disabled={isLoading}>
                <X className="mr-2 h-4 w-4" />
                Limpar
              </Button>
              <Badge variant="secondary" className="h-9 px-3 text-xs">
                {activeFilters.startDate} a {activeFilters.endDate}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <Card className="border-destructive/40">
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Erro ao carregar a consulta de triagem. {error instanceof Error ? error.message : "Verifique a conexão com a API interna."}
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

              <Card className="border shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recebidos</p>
                  <p className="mt-2 text-2xl font-semibold">{kpis.totalRecebidos}</p>
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Triados</p>
                  <p className="mt-2 text-2xl font-semibold">{kpis.totalTriados}</p>
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tempo mediano até triagem</p>
                  <p className="mt-2 text-2xl font-semibold">{kpis.tempoMedianoTriagem}</p>
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Pendências</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Manutenção</p>
                      <p className="mt-1 text-xl font-semibold">{kpis.statusMaintenance}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Divergente</p>
                      <p className="mt-1 text-xl font-semibold">{kpis.statusDeviceMismatch}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Bloqueado</p>
                      <p className="mt-1 text-xl font-semibold">{kpis.statusBlocked}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <TableCard
                title="Totalizadores por dia"
                description="Recebidos e triados dentro do período selecionado."
                icon={<CalendarDays className="h-4 w-4 text-primary" />}
              >
                <ScrollArea className="h-[420px]">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[560px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[180px] uppercase tracking-wide">Data</TableHead>
                          <TableHead className="text-center uppercase tracking-wide">Recebido</TableHead>
                          <TableHead className="text-center uppercase tracking-wide">Triado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {totalizadores.map((item, index) => (
                          <TableRow key={`${item.Data}-${index}`}>
                            <TableCell className={item.Data === "Total" ? "font-semibold" : ""}>{item.Data}</TableCell>
                            <TableCell className="text-center">{item.Recebido}</TableCell>
                            <TableCell className="text-center">{item.Triado}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </TableCard>

              <TableCard
                title="Triadores"
                description="Quantidade de triagens por responsável no resultado filtrado."
                icon={<Users className="h-4 w-4 text-primary" />}
              >
                <ScrollArea className="h-[420px]">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[520px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="uppercase tracking-wide">Triador</TableHead>
                          <TableHead className="w-[180px] text-center uppercase tracking-wide">Triagens</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {triadoresCount.map((item, index) => (
                          <TableRow key={`${item.Triador}-${index}`}>
                            <TableCell className={item.Triador === "Total" ? "font-semibold" : ""}>{item.Triador}</TableCell>
                            <TableCell className="text-center">{item.Triagens}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </TableCard>
            </div>

            <TableCard
              title="Tabela completa"
              description="Registro detalhado com rede, filial e demais campos trazidos pela API externa."
              icon={<Table2 className="h-4 w-4 text-primary" />}
            >
              <div className="max-h-[640px] overflow-auto">
                <div className="w-full overflow-x-auto pb-2">
                  <Table className="min-w-[1900px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="uppercase tracking-wide">IMEI</TableHead>
                        <TableHead className="uppercase tracking-wide">Voucher</TableHead>
                        <TableHead className="uppercase tracking-wide">Rede</TableHead>
                        <TableHead className="uppercase tracking-wide">Filial</TableHead>
                        <TableHead className="uppercase tracking-wide">Categoria</TableHead>
                        <TableHead className="uppercase tracking-wide">Fabricante</TableHead>
                        <TableHead className="uppercase tracking-wide">Status</TableHead>
                        <TableHead className="uppercase tracking-wide">Descrição</TableHead>
                        <TableHead className="uppercase tracking-wide">Recebimento</TableHead>
                        <TableHead className="uppercase tracking-wide">Triagem</TableHead>
                        <TableHead className="uppercase tracking-wide">Triador</TableHead>
                        <TableHead className="uppercase tracking-wide">Grade da Avaliação</TableHead>
                        <TableHead className="uppercase tracking-wide">Grade da Triagem</TableHead>
                        <TableHead className="uppercase tracking-wide">Avaliador</TableHead>
                        <TableHead className="uppercase tracking-wide">Defeitos</TableHead>
                        <TableHead className="uppercase tracking-wide">Observação da Triagem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalhes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={16} className="py-10 text-center text-muted-foreground">
                            Nenhum registro encontrado para os filtros aplicados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        pagedDetalhes.map((item, index) => (
                          <TableRow key={`${item.IMEI || "sem-imei"}-${index}`}>
                            <TableCell className="font-mono text-xs">{item.IMEI || "—"}</TableCell>
                            <TableCell className="text-xs">{item.Voucher || "—"}</TableCell>
                            <TableCell className="text-xs">{item.Rede || "—"}</TableCell>
                            <TableCell className="text-xs">{item.Filial || "—"}</TableCell>
                            <TableCell>
                              {item.Categoria ? <Badge variant="secondary">{item.Categoria}</Badge> : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-xs">{item.Fabricante || "—"}</TableCell>
                            <TableCell className="text-xs">{item.Status || "—"}</TableCell>
                            <TableCell className="max-w-[260px] truncate text-xs">{item.Descricao || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs">{item.DataRecebimento || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs">{item.DataTriagem || "—"}</TableCell>
                            <TableCell className="text-xs">{item.Triador || "—"}</TableCell>
                            <TableCell className="text-xs">{item.GradeAvaliacao || "—"}</TableCell>
                            <TableCell className="text-xs">{item.GradeTriagem || "—"}</TableCell>
                            <TableCell className="text-xs">{item.Avaliador || "—"}</TableCell>
                            <TableCell className="max-w-[300px] truncate text-xs">{item.Defeitos || "—"}</TableCell>
                            <TableCell className="max-w-[320px] truncate text-xs">{item.ObservacaoTriagem || "—"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {detalhes.length > 0 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Página {detailsPage} de {totalDetailPages} ({detalhes.length} registros)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailsPage((p) => Math.max(1, p - 1))}
                      disabled={detailsPage === 1}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailsPage((p) => Math.min(totalDetailPages, p + 1))}
                      disabled={detailsPage === totalDetailPages}
                    >
                      Próxima
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </TableCard>
          </div>
        )}
      </div>
    </div>
  );
}
