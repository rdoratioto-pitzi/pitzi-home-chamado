import { Fragment, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { DateInput } from "@/components/ui/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Download, Filter, RefreshCw } from "lucide-react";
import {
  Bar,
  ComposedChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApoioVendas, type ApoioVendasFilters, type DadoInicioRaw } from "@/hooks/use-apoio-vendas";
import { useTheme } from "@/hooks/use-theme";

function getCurrentMonthDateRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const toYmd = (d: Date) => d.toISOString().slice(0, 10);
  return {
    dataInicio: toYmd(firstDay),
    dataFim: toYmd(now),
  };
}

type GroupByAvaliador = {
  nome: string;
  totalAvaliados: number;
  totalComprados: number;
  conversao: number;
  grades: Array<{ grade: string; avaliados: number; comprados: number; conversao: number }>;
};

type GroupByTag = {
  tag: string;
  avaliados: number;
  comprados: number;
  conversao: number;
};

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function parseDatePtBr(value: string): Date | null {
  const [datePart, timePart] = value.split(" ");
  if (!datePart || !timePart) return null;
  const [dd, mm, yyyy] = datePart.split("/").map(Number);
  const [hh, min] = timePart.split(":").map(Number);
  if (!dd || !mm || !yyyy) return null;
  return new Date(yyyy, mm - 1, dd, hh || 0, min || 0);
}

function getFaixaHorario(hour: number) {
  if (hour < 9) return "<9";
  if (hour > 23) return ">23";
  return String(hour);
}

function exportToExcel(rows: Record<string, unknown>[], filename: string, sheetName: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function normalizeRows(rows: DadoInicioRaw[]) {
  const filteredRows = rows.filter((row) => {
    const avaliador = String(row["Avaliador"] || "").trim().toUpperCase();
    return avaliador !== "SEM AVALIADOR";
  });

  const byAvaliador = new Map<string, GroupByAvaliador>();
  const byTag = new Map<string, GroupByTag>();
  const byGrade = new Map<string, { grade: string; avaliados: number; comprados: number; conversao: number }>();
  const chartByAvaliador = new Map<string, { avaliador: string; gradeA: number; gradeB: number; gradeC: number; gradeD: number; utilizados: number }>();
  const heatmap = new Map<string, { diaSemana: string; faixaHorario: string; quantidade: number }>();

  for (const row of filteredRows) {
    const avaliador = row["Avaliador"] || "Sem Avaliador";
    const grade = row["Grade"] || "N/I";
    const tag = row["Uso de Tag"] || "Não";
    const voucherStatus = row["Situação do voucher"] || "NÃO GERADO";
    const comprou = voucherStatus === "UTILIZADO";

    const avaliadorItem = byAvaliador.get(avaliador) || {
      nome: avaliador,
      totalAvaliados: 0,
      totalComprados: 0,
      conversao: 0,
      grades: [],
    };
    avaliadorItem.totalAvaliados += 1;
    if (comprou) avaliadorItem.totalComprados += 1;

    const gradeItem = avaliadorItem.grades.find((g) => g.grade === grade) || {
      grade,
      avaliados: 0,
      comprados: 0,
      conversao: 0,
    };
    gradeItem.avaliados += 1;
    if (comprou) gradeItem.comprados += 1;
    gradeItem.conversao = gradeItem.avaliados > 0 ? (gradeItem.comprados / gradeItem.avaliados) * 100 : 0;

    if (!avaliadorItem.grades.find((g) => g.grade === grade)) {
      avaliadorItem.grades.push(gradeItem);
    }

    avaliadorItem.conversao =
      avaliadorItem.totalAvaliados > 0
        ? (avaliadorItem.totalComprados / avaliadorItem.totalAvaliados) * 100
        : 0;

    byAvaliador.set(avaliador, avaliadorItem);

    const tagItem = byTag.get(tag) || { tag, avaliados: 0, comprados: 0, conversao: 0 };
    tagItem.avaliados += 1;
    if (comprou) tagItem.comprados += 1;
    tagItem.conversao = tagItem.avaliados > 0 ? (tagItem.comprados / tagItem.avaliados) * 100 : 0;
    byTag.set(tag, tagItem);

    const gradeGlobal = byGrade.get(grade) || { grade, avaliados: 0, comprados: 0, conversao: 0 };
    gradeGlobal.avaliados += 1;
    if (comprou) gradeGlobal.comprados += 1;
    gradeGlobal.conversao = gradeGlobal.avaliados > 0 ? (gradeGlobal.comprados / gradeGlobal.avaliados) * 100 : 0;
    byGrade.set(grade, gradeGlobal);

    const chartItem = chartByAvaliador.get(avaliador) || {
      avaliador,
      gradeA: 0,
      gradeB: 0,
      gradeC: 0,
      gradeD: 0,
      utilizados: 0,
    };
    if (grade === "A") chartItem.gradeA += 1;
    if (grade === "B") chartItem.gradeB += 1;
    if (grade === "C") chartItem.gradeC += 1;
    if (grade === "D") chartItem.gradeD += 1;
    if (comprou) chartItem.utilizados += 1;
    chartByAvaliador.set(avaliador, chartItem);

    const createdOn = String(row["Criado em"] || "");
    const parsed = parseDatePtBr(createdOn);
    if (parsed) {
      const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const diaSemana = dias[parsed.getDay()];
      const hour = parsed.getHours();
      const faixaHorario = `${String(hour).padStart(2, "0")}:00`;
      const heatKey = `${diaSemana}-${faixaHorario}`;
      const heatItem = heatmap.get(heatKey) || { diaSemana, faixaHorario, quantidade: 0 };
      heatItem.quantidade += 1;
      heatmap.set(heatKey, heatItem);
    }
  }

  const gradeOrder: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 };
  const avaliacoesPorAvaliador = [...byAvaliador.values()]
    .map((item) => ({
      ...item,
      grades: [...item.grades].sort((g1, g2) => {
        const o1 = gradeOrder[g1.grade] ?? 99;
        const o2 = gradeOrder[g2.grade] ?? 99;
        return o1 - o2;
      }),
    }))
    .sort((a, b) => b.totalAvaliados - a.totalAvaliados);
  const conversaoPorTag = [...byTag.values()].sort((a, b) => b.avaliados - a.avaliados);
  const avaliacoesPorGrade = [...byGrade.values()].sort((a, b) => a.grade.localeCompare(b.grade));
  const chartAvaliacoesComprasPorAvaliador = [...chartByAvaliador.values()].sort((a, b) => a.avaliador.localeCompare(b.avaliador));
  const heatmapRows = [...heatmap.values()].sort((a, b) => {
    if (a.diaSemana === b.diaSemana) return a.faixaHorario.localeCompare(b.faixaHorario);
    return a.diaSemana.localeCompare(b.diaSemana);
  });

  // KPIs gerais devem refletir o total bruto do período (sem exclusão de "Sem Avaliador").
  const totalAvaliados = rows.length;
  const totalUtilizados = rows.filter((r) => String(r["Situação do voucher"] || "").toUpperCase() === "UTILIZADO").length;
  const aquisicoesPorAvaliacoes = rows.filter((r) => {
    const voucher = String(r["Situação do voucher"] || "").toUpperCase();
    const avaliador = String(r["Avaliador"] || "").toUpperCase();
    return voucher === "UTILIZADO" && avaliador !== "RECICLAGEM";
  }).length;
  const conversaoGeral = totalAvaliados > 0 ? (aquisicoesPorAvaliacoes / totalAvaliados) * 100 : 0;

  return {
    totalAvaliados,
    totalUtilizados,
    aquisicoesPorAvaliacoes,
    conversaoGeral,
    avaliacoesPorAvaliador,
    conversaoPorTag,
    avaliacoesPorGrade,
    chartAvaliacoesComprasPorAvaliador,
    heatmapRows,
  };
}

export function ApoioVendasInicioTab() {
  const { loading, getDadosInicio, getDadosGestao, getOpcoesFiltros } = useApoioVendas();
  const { theme } = useTheme();
  const [filters, setFilters] = useState<ApoioVendasFilters>(getCurrentMonthDateRange());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandedTags, setExpandedTags] = useState<Record<string, boolean>>({});
  const [opcoes, setOpcoes] = useState<{ avaliadores: string[]; redes: string[]; filiais: string[]; meses: number[] }>({
    avaliadores: [],
    redes: [],
    filiais: [],
    meses: [],
  });
  const [rows, setRows] = useState<DadoInicioRaw[]>([]);
  const [rowsGestao, setRowsGestao] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    getOpcoesFiltros().then(setOpcoes);
  }, [getOpcoesFiltros]);

  useEffect(() => {
    Promise.all([
      getDadosInicio(filters),
      getDadosGestao({ dataInicio: filters.dataInicio, dataFim: filters.dataFim, filtroData: "recebimento" }),
    ]).then(([inicio, gestao]) => {
      setRows(inicio?.dados || []);
      const dataset = (gestao?.dados || gestao?.created || gestao?.received || []) as Record<string, unknown>[];
      setRowsGestao(dataset);
    });
  }, [getDadosInicio, getDadosGestao]);

  const metrics = useMemo(() => normalizeRows(rows), [rows]);
  const rowsSemAvaliador = useMemo(
    () => rows.filter((r) => String(r["Avaliador"] || "").trim().toUpperCase() !== "SEM AVALIADOR"),
    [rows],
  );

  const resumoUsoTagPorAvaliador = useMemo(() => {
    const byAvaliador = new Map<string, { avaliador: string; nao: number; sim: number; total: number; percUsoTag: number }>();

    for (const row of rowsSemAvaliador) {
      const avaliador = String(row["Avaliador"] || "").trim();
      if (!avaliador) continue;

      const usoTag = String(row["Uso de Tag"] || "");
      const item = byAvaliador.get(avaliador) || { avaliador, nao: 0, sim: 0, total: 0, percUsoTag: 0 };
      if (usoTag === "Sim") item.sim += 1;
      else item.nao += 1;
      item.total += 1;
      item.percUsoTag = item.total > 0 ? (item.sim / item.total) * 100 : 0;
      byAvaliador.set(avaliador, item);
    }

    const rowsResumo = [...byAvaliador.values()].sort((a, b) => b.total - a.total);
    const totalNao = rowsResumo.reduce((acc, r) => acc + r.nao, 0);
    const totalSim = rowsResumo.reduce((acc, r) => acc + r.sim, 0);
    const totalGeral = rowsResumo.reduce((acc, r) => acc + r.total, 0);

    return [
      ...rowsResumo,
      {
        avaliador: "Total Geral",
        nao: totalNao,
        sim: totalSim,
        total: totalGeral,
        percUsoTag: totalGeral > 0 ? (totalSim / totalGeral) * 100 : 0,
      },
    ];
  }, [rowsSemAvaliador]);

  const comprasPorGradeUsoTag = useMemo(() => {
    const tags: Array<"Sim" | "Não"> = ["Sim", "Não"];
    const grades = ["A", "B", "C", "D"];
    return tags.map((tag) => {
      const dfTag = rowsSemAvaliador.filter((r) => String(r["Uso de Tag"] || "") === tag);
      const avaliacoes = dfTag.length;
      const compras = dfTag.filter((r) => String(r["Situação do voucher"] || "") === "UTILIZADO").length;
      const taxa = avaliacoes > 0 ? (compras / avaliacoes) * 100 : 0;

      const gradesRows = grades.map((g) => {
        const dfGrade = dfTag.filter((r) => String(r["Grade"] || "") === g);
        const avalG = dfGrade.length;
        const compG = dfGrade.filter((r) => String(r["Situação do voucher"] || "") === "UTILIZADO").length;
        return {
          grade: g,
          avaliacoes: avalG,
          compras: compG,
          taxa: avalG > 0 ? (compG / avalG) * 100 : 0,
        };
      });

      return { usoTag: tag, avaliacoes, compras, taxa, grades: gradesRows };
    });
  }, [rowsSemAvaliador]);

  const totalComprasPorGradeUsoTag = useMemo(() => {
    const totalAval = comprasPorGradeUsoTag.reduce((acc, r) => acc + r.avaliacoes, 0);
    const totalComp = comprasPorGradeUsoTag.reduce((acc, r) => acc + r.compras, 0);
    return {
      totalAval,
      totalComp,
      taxa: totalAval > 0 ? (totalComp / totalAval) * 100 : 0,
    };
  }, [comprasPorGradeUsoTag]);
  const resumoTrocaGrade = useMemo(() => {
    const byAvaliador = new Map<string, { avaliador: string; recebidos: number; trocas: number; percTroca: number }>();

    for (const row of rowsGestao) {
      const avaliador = String(row["Nome do Avaliador"] || "").trim();
      if (!avaliador || avaliador.toUpperCase() === "SEM AVALIADOR") continue;

      const dataRecebimento = String(row["Data de recebimento"] || "").trim();
      const controleGrade = String(row["Controle de Grade"] || "");

      const item = byAvaliador.get(avaliador) || { avaliador, recebidos: 0, trocas: 0, percTroca: 0 };
      if (dataRecebimento && dataRecebimento.toLowerCase() !== "nan") item.recebidos += 1;
      if (controleGrade === "Troca de Grade") item.trocas += 1;
      item.percTroca = item.recebidos > 0 ? (item.trocas / item.recebidos) * 100 : 0;
      byAvaliador.set(avaliador, item);
    }

    const rowsResumo = [...byAvaliador.values()].sort((a, b) => b.recebidos - a.recebidos);
    const totalRecebidos = rowsResumo.reduce((acc, r) => acc + r.recebidos, 0);
    const totalTrocas = rowsResumo.reduce((acc, r) => acc + r.trocas, 0);

    return [
      ...rowsResumo,
      {
        avaliador: "Total Geral",
        recebidos: totalRecebidos,
        trocas: totalTrocas,
        percTroca: totalRecebidos > 0 ? (totalTrocas / totalRecebidos) * 100 : 0,
      },
    ];
  }, [rowsGestao]);

  const detalheImei = useMemo(() => {
    return rows
      .filter((row) => String(row["Avaliador"] || "").trim().toUpperCase() !== "SEM AVALIADOR")
      .map((row) => ({
        imei: String(row["IMEI"] || ""),
        criadoEm: String(row["Criado em"] || ""),
        avaliador: String(row["Avaliador"] || ""),
        compras: String(row["Situação do voucher"] || ""),
        avaliacao: String(row["Grade"] || ""),
      }));
  }, [rows]);
  const heatmapVisualData = useMemo(() => {
    const diasOrdem = ["Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado", "Domingo"];
    const diasJs = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
    const faixas = ["<9", ...Array.from({ length: 15 }, (_, i) => String(i + 9)), ">23"];

    const matrix = diasOrdem.map(() => faixas.map(() => 0));

    for (const row of rows) {
      const created = parseDatePtBr(String(row["Criado em"] || ""));
      if (!created) continue;

      const dia = diasJs[created.getDay()];
      const faixa = getFaixaHorario(created.getHours());

      const diaIdx = diasOrdem.indexOf(dia);
      const faixaIdx = faixas.indexOf(faixa);
      if (diaIdx >= 0 && faixaIdx >= 0) {
        matrix[diaIdx][faixaIdx] += 1;
      }
    }

    const totalPorDia = diasOrdem.map((dia, idx) => ({
      dia,
      total: matrix[idx].reduce((acc, cur) => acc + cur, 0),
    }));

    const totalPorFaixa = faixas.map((faixa, faixaIdx) => ({
      faixa,
      total: matrix.reduce((acc, row) => acc + row[faixaIdx], 0),
    }));

    const maxCell = Math.max(1, ...matrix.flat());

    return { diasOrdem, faixas, matrix, totalPorDia, totalPorFaixa, maxCell };
  }, [rows]);
  const lineColor = theme === "dark" ? "#FFFFFF" : "#111111";
  const labelColor = theme === "dark" ? "#FFFFFF" : "#111111";

  const exportComprasAvaliadorRows = useMemo(() => {
    const rowsExport: Record<string, unknown>[] = [];
    let totalAval = 0;
    let totalComp = 0;

    metrics.avaliacoesPorAvaliador.forEach((item) => {
      rowsExport.push({
        Avaliador: item.nome,
        Grade: "",
        Avaliado: item.totalAvaliados,
        Comprado: item.totalComprados,
        Conversao: formatPercent(item.conversao),
      });
      totalAval += item.totalAvaliados;
      totalComp += item.totalComprados;

      item.grades.forEach((g) => {
        rowsExport.push({
          Avaliador: "",
          Grade: `Grade ${g.grade}`,
          Avaliado: g.avaliados,
          Comprado: g.comprados,
          Conversao: formatPercent(g.conversao),
        });
      });
    });

    rowsExport.push({
      Avaliador: "Total Geral",
      Grade: "",
      Avaliado: totalAval,
      Comprado: totalComp,
      Conversao: formatPercent(totalAval > 0 ? (totalComp / totalAval) * 100 : 0),
    });

    return rowsExport;
  }, [metrics.avaliacoesPorAvaliador]);

  const exportResumoUsoTagRows = useMemo(
    () => resumoUsoTagPorAvaliador.map((r) => ({
      Avaliador: r.avaliador,
      Nao: r.nao,
      Sim: r.sim,
      TotalGeral: r.total,
      PercUsoTag: formatPercent(r.percUsoTag),
    })),
    [resumoUsoTagPorAvaliador],
  );

  const exportComprasGradeTagRows = useMemo(() => {
    const rowsExport: Record<string, unknown>[] = [];

    comprasPorGradeUsoTag.forEach((row) => {
      rowsExport.push({
        UsoDeTag: row.usoTag,
        Grade: "",
        Avaliacoes: row.avaliacoes,
        Compras: row.compras,
        TaxaConversao: formatPercent(row.taxa),
      });

      row.grades.forEach((g) => {
        rowsExport.push({
          UsoDeTag: "",
          Grade: `Grade ${g.grade}`,
          Avaliacoes: g.avaliacoes,
          Compras: g.compras,
          TaxaConversao: formatPercent(g.taxa),
        });
      });
    });

    rowsExport.push({
      UsoDeTag: "Total Geral",
      Grade: "",
      Avaliacoes: totalComprasPorGradeUsoTag.totalAval,
      Compras: totalComprasPorGradeUsoTag.totalComp,
      TaxaConversao: formatPercent(totalComprasPorGradeUsoTag.taxa),
    });

    return rowsExport;
  }, [comprasPorGradeUsoTag, totalComprasPorGradeUsoTag]);

  const exportResumoTrocaRows = useMemo(
    () => resumoTrocaGrade.map((r) => ({
      Avaliador: r.avaliador,
      Recebidos: r.recebidos,
      TrocaDeGrade: r.trocas,
      PercTrocaDeGrade: formatPercent(r.percTroca),
    })),
    [resumoTrocaGrade],
  );

  const exportDetalheImeiRows = useMemo(
    () => detalheImei.map((r) => ({
      IMEI: r.imei,
      CriadoEm: r.criadoEm,
      Avaliador: r.avaliador,
      Compras: r.compras,
      Avaliacao: r.avaliacao,
    })),
    [detalheImei],
  );

  const handleLoadData = async () => {
    const [inicio, gestao] = await Promise.all([
      getDadosInicio(filters),
      getDadosGestao({ dataInicio: filters.dataInicio, dataFim: filters.dataFim, filtroData: "recebimento" }),
    ]);
    setRows(inicio?.dados || []);
    const dataset = (gestao?.dados || gestao?.created || gestao?.received || []) as Record<string, unknown>[];
    setRowsGestao(dataset);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label>Data início</Label>
              <DateInput
                value={filters.dataInicio || ""}
                onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data fim</Label>
              <DateInput
                value={filters.dataFim || ""}
                onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={filters.mes || "__all__"} onValueChange={(value) => setFilters({ ...filters, mes: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {opcoes.meses.map((mes) => (
                    <SelectItem key={mes} value={String(mes)}>{String(mes)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Avaliador</Label>
              <Select value={filters.avaliador || "__all__"} onValueChange={(value) => setFilters({ ...filters, avaliador: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {opcoes.avaliadores.map((avaliador) => (
                    <SelectItem key={avaliador} value={avaliador}>{avaliador}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rede</Label>
              <Select value={filters.rede || "__all__"} onValueChange={(value) => setFilters({ ...filters, rede: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {opcoes.redes.map((rede) => (
                    <SelectItem key={rede} value={rede}>{rede}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Filial</Label>
              <Select value={filters.filial || "__all__"} onValueChange={(value) => setFilters({ ...filters, filial: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {opcoes.filiais.map((filial) => (
                    <SelectItem key={filial} value={filial}>{filial}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleLoadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Carregar dados
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Avaliações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{metrics.totalAvaliados}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Utilizados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{metrics.totalUtilizados}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Aquisições por Avaliações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{metrics.aquisicoesPorAvaliacoes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Conversão geral</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatPercent(metrics.conversaoGeral)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Compras e avaliações por avaliador</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToExcel(exportComprasAvaliadorRows, "compras_avaliacoes_por_avaliador", "ComprasAvaliador")}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Avaliador</TableHead>
                <TableHead className="text-right">Avaliados</TableHead>
                <TableHead className="text-right">Comprados</TableHead>
                <TableHead className="text-right">Conversão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.avaliacoesPorAvaliador.map((item) => {
                const isOpen = expanded[item.nome] === true;
                return (
                  <Fragment key={item.nome}>
                    <TableRow key={item.nome} className="cursor-pointer" onClick={() => setExpanded((prev) => ({ ...prev, [item.nome]: !prev[item.nome] }))}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {item.nome}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.totalAvaliados}</TableCell>
                      <TableCell className="text-right">{item.totalComprados}</TableCell>
                      <TableCell className="text-right">{formatPercent(item.conversao)}</TableCell>
                    </TableRow>
                    {isOpen && item.grades.map((grade) => (
                      <TableRow key={`${item.nome}-${grade.grade}`} className="bg-muted/30">
                        <TableCell className="pl-10">Grade {grade.grade}</TableCell>
                        <TableCell className="text-right">{grade.avaliados}</TableCell>
                        <TableCell className="text-right">{grade.comprados}</TableCell>
                        <TableCell className="text-right">{formatPercent(grade.conversao)}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Avaliações por Grade e Utilizados por Avaliador</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={metrics.chartAvaliacoesComprasPorAvaliador}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="avaliador" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="gradeA" name="Avaliações Grade A" fill="#2E7D32">
                  <LabelList dataKey="gradeA" position="top" fill={labelColor} fontSize={10} />
                </Bar>
                <Bar dataKey="gradeB" name="Avaliações Grade B" fill="#1976D2">
                  <LabelList dataKey="gradeB" position="top" fill={labelColor} fontSize={10} />
                </Bar>
                <Bar dataKey="gradeC" name="Avaliações Grade C" fill="#F9A825">
                  <LabelList dataKey="gradeC" position="top" fill={labelColor} fontSize={10} />
                </Bar>
                <Bar dataKey="gradeD" name="Avaliações Grade D" fill="#D84315">
                  <LabelList dataKey="gradeD" position="top" fill={labelColor} fontSize={10} />
                </Bar>
                <Line
                  type="monotone"
                  dataKey="utilizados"
                  name="Total Utilizados"
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={{ r: 3, fill: lineColor }}
                >
                  <LabelList dataKey="utilizados" position="top" fill={lineColor} fontSize={10} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Resumo de Uso de Tag por Avaliador</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToExcel(exportResumoUsoTagRows, "resumo_uso_tag_por_avaliador", "UsoTagAvaliador")}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Avaliador</TableHead>
                  <TableHead className="text-right">Não</TableHead>
                  <TableHead className="text-right">Sim</TableHead>
                  <TableHead className="text-right">Total Geral</TableHead>
                  <TableHead className="text-right">% Uso de Tag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumoUsoTagPorAvaliador.map((row) => (
                  <TableRow key={`uso-tag-${row.avaliador}`}>
                    <TableCell>{row.avaliador}</TableCell>
                    <TableCell className="text-right">{row.nao}</TableCell>
                    <TableCell className="text-right">{row.sim}</TableCell>
                    <TableCell className="text-right">{row.total}</TableCell>
                    <TableCell className="text-right">{formatPercent(row.percUsoTag)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Compras por Grade e Uso de Tag</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToExcel(exportComprasGradeTagRows, "compras_por_grade_uso_tag", "ComprasGradeTag")}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Uso de Tag</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-right">Avaliações</TableHead>
                  <TableHead className="text-right">Compras</TableHead>
                  <TableHead className="text-right">Taxa de Conversão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comprasPorGradeUsoTag.map((row) => {
                  const isOpen = expandedTags[row.usoTag] === true;
                  return (
                    <Fragment key={`conv-${row.usoTag}`}>
                      <TableRow className="cursor-pointer" onClick={() => setExpandedTags((prev) => ({ ...prev, [row.usoTag]: !prev[row.usoTag] }))}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {row.usoTag}
                          </div>
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right">{row.avaliacoes}</TableCell>
                        <TableCell className="text-right">{row.compras}</TableCell>
                        <TableCell className="text-right">{formatPercent(row.taxa)}</TableCell>
                      </TableRow>
                      {isOpen && row.grades.map((g) => (
                        <TableRow key={`conv-${row.usoTag}-${g.grade}`} className="bg-muted/30">
                          <TableCell />
                          <TableCell>Grade {g.grade}</TableCell>
                          <TableCell className="text-right">{g.avaliacoes}</TableCell>
                          <TableCell className="text-right">{g.compras}</TableCell>
                          <TableCell className="text-right">{formatPercent(g.taxa)}</TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })}
                <TableRow>
                  <TableCell className="font-medium">Total Geral</TableCell>
                  <TableCell />
                  <TableCell className="text-right">{totalComprasPorGradeUsoTag.totalAval}</TableCell>
                  <TableCell className="text-right">{totalComprasPorGradeUsoTag.totalComp}</TableCell>
                  <TableCell className="text-right">{formatPercent(totalComprasPorGradeUsoTag.taxa)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Heatmap (dia da semana x faixa de horário)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="text-left p-2 border">Dia/Hora</th>
                  {heatmapVisualData.faixas.map((faixa) => (
                    <th key={`head-${faixa}`} className="text-center p-2 border">{faixa}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapVisualData.diasOrdem.map((dia, diaIdx) => (
                  <tr key={`row-${dia}`}>
                    <td className="p-2 border font-medium">{dia}</td>
                    {heatmapVisualData.faixas.map((faixa, faixaIdx) => {
                      const value = heatmapVisualData.matrix[diaIdx][faixaIdx];
                      const intensity = value / heatmapVisualData.maxCell;
                      const bg = `rgba(0, 161, 55, ${Math.max(0.08, intensity)})`;
                      return (
                        <td
                          key={`cell-${dia}-${faixa}`}
                          className="p-2 border text-center"
                          style={{ backgroundColor: bg }}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Total por dia da semana</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dia</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {heatmapVisualData.totalPorDia.map((row) => (
                    <TableRow key={`dia-total-${row.dia}`}>
                      <TableCell>{row.dia}</TableCell>
                      <TableCell className="text-right">{row.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Total por faixa de horario</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      {heatmapVisualData.totalPorFaixa.map((row) => (
                        <th key={`faixa-head-${row.faixa}`} className="text-center p-2 border">{row.faixa}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {heatmapVisualData.totalPorFaixa.map((row) => (
                        <td key={`faixa-total-${row.faixa}`} className="text-center p-2 border">{row.total}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Resumo de Troca de Grade por Avaliador</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToExcel(exportResumoTrocaRows, "resumo_troca_grade_por_avaliador", "TrocaGrade")}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Avaliador</TableHead>
                <TableHead className="text-right">Recebidos</TableHead>
                <TableHead className="text-right">Troca de Grade</TableHead>
                <TableHead className="text-right">% Troca de Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumoTrocaGrade.map((row) => (
                <TableRow key={`troca-${row.avaliador}`}>
                  <TableCell>{row.avaliador}</TableCell>
                  <TableCell className="text-right">{row.recebidos}</TableCell>
                  <TableCell className="text-right">{row.trocas}</TableCell>
                  <TableCell className="text-right">{formatPercent(row.percTroca)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Detalhamento por IMEI</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToExcel(exportDetalheImeiRows, "detalhamento_por_imei", "DetalheIMEI")}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IMEI</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Avaliador</TableHead>
                <TableHead>Compras</TableHead>
                <TableHead>Avaliação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detalheImei.map((row, idx) => (
                <TableRow key={`detalhe-${idx}-${row.imei}`}>
                  <TableCell>{row.imei}</TableCell>
                  <TableCell>{row.criadoEm}</TableCell>
                  <TableCell>{row.avaliador}</TableCell>
                  <TableCell>{row.compras}</TableCell>
                  <TableCell>{row.avaliacao}</TableCell>
                  </TableRow>
              ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
    </div>
  );
}
