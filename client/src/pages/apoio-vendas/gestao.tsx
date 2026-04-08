import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Filter, RefreshCw } from "lucide-react";
import { useApoioVendas, type ApoioVendasFilters } from "@/hooks/use-apoio-vendas";

function getCurrentMonthDateRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const toYmd = (d: Date) => d.toISOString().slice(0, 10);
  return {
    dataInicio: toYmd(firstDay),
    dataFim: toYmd(now),
  };
}

function formatMoney(value: number): string {
  const formatted = value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  return formatted;
}

function parseMoneyToNumber(value: string): number {
  if (!value || typeof value !== "string") return 0;
  const cleaned = value.replace("R$", "").replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

function exportToExcel(rows: Record<string, unknown>[], filename: string, sheetName: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

interface DesempenhoAvaliador {
  avaliador: string;
  acuracidade: number;
  conversao: number;
  avaliado: number;
  comprado: number;
  recebidos: number;
  trocaGrade: number;
  percTroca: number;
  subiu_qty: number;
  subiu_val: number;
  desceu_qty: number;
  desceu_val: number;
  resultado: number;
}

interface DetalheTrocaGrade {
  imei: string;
  avaliador: string;
  gradeAvaliada: string;
  gradeFinal: string;
  resultadoFinanceiro: number;
}

export function ApoioVendasGestaoTab() {
  const { loading, getDadosGestao } = useApoioVendas();
  const [filters, setFilters] = useState<ApoioVendasFilters & { filtroData?: "criacao" | "recebimento" }>({
    ...getCurrentMonthDateRange(),
    filtroData: "recebimento",
  });
  const [rowsCreated, setRowsCreated] = useState<Record<string, unknown>[]>([]);
  const [rowsReceived, setRowsReceived] = useState<Record<string, unknown>[]>([]);
  const isExcludedEvaluator = (row: Record<string, unknown>) => {
    const nome = String(row["Nome do Avaliador"] || "").trim().toUpperCase();
    return nome === "RECICLAGEM" || nome === "SEM AVALIADOR" || nome === "AUTOMÁTICA" || nome === "AUTOMATICA";
  };

  // Agregação: Gestão de Avaliadores — Desempenho
  const desempenhoData = useMemo(() => {
    if (!rowsCreated.length && !rowsReceived.length) return { dados: [] as DesempenhoAvaliador[], total: null };

    const avaliadoresSet = new Set<string>();

    const rowsCreatedFiltered = rowsCreated.filter((row) => !isExcludedEvaluator(row));
    const rowsReceivedFiltered = rowsReceived.filter((row) => !isExcludedEvaluator(row));
    
    // Coletar todos os avaliadores (inclusive "Outros", "Reciclagem", etc)
    rowsCreatedFiltered.forEach((row) => {
      const nome = String(row["Nome do Avaliador"] || "Sem Avaliador");
      avaliadoresSet.add(nome);
    });
    rowsReceivedFiltered.forEach((row) => {
      const nome = String(row["Nome do Avaliador"] || "Sem Avaliador");
      avaliadoresSet.add(nome);
    });

    const dados: DesempenhoAvaliador[] = [];

    avaliadoresSet.forEach((avaliador) => {
      // Dados de criação (avaliado, comprado)
      const rowsCreatedAval = rowsCreatedFiltered.filter((r) => {
        const nome = String(r["Nome do Avaliador"] || "Sem Avaliador");
        return nome === avaliador;
      });

      // Dados de recebimento (recebidos, trocas, movimentos)
      const rowsReceivedAval = rowsReceivedFiltered.filter(
        (r) => String(r["Nome do Avaliador"] || "Sem Avaliador") === avaliador
      );

      const avaliado = rowsCreatedAval.length;
      const comprado = rowsCreatedAval.filter(
        (r) => String(r["Situação do voucher"] || "") === "UTILIZADO"
      ).length;
      const conversao = avaliado > 0 ? (comprado / avaliado) * 100 : 0;

      const recebidos = rowsReceivedAval.length;
      const trocas = rowsReceivedAval.filter((r) => String(r["Controle de Grade"]) === "Troca de Grade").length;
      const acuracidade = recebidos > 0 ? ((recebidos - trocas) / recebidos) * 100 : 0;

      const subiu = rowsReceivedAval.filter((r) => String(r["Movimento de Grade"]) === "Subiu");
      const desceu = rowsReceivedAval.filter((r) => String(r["Movimento de Grade"]) === "Desceu");

      const subiu_qty = subiu.length;
      const subiu_val = subiu.reduce((sum, r) => {
        const val = String(r["Diferença Valor"] || "0");
        return sum + parseMoneyToNumber(val);
      }, 0);

      const desceu_qty = desceu.length;
      const desceu_val = desceu.reduce((sum, r) => {
        const val = String(r["Diferença Valor"] || "0");
        return sum + parseMoneyToNumber(val);
      }, 0);

      dados.push({
        avaliador,
        acuracidade,
        conversao,
        avaliado,
        comprado,
        recebidos,
        trocaGrade: trocas,
        percTroca: recebidos > 0 ? (trocas / recebidos) * 100 : 0,
        subiu_qty,
        subiu_val,
        desceu_qty,
        desceu_val,
        resultado: subiu_val + desceu_val,
      });
    });

    dados.sort((a, b) => {
      // Priorizar por recebidos se houver, depois por avaliados
      if (b.recebidos !== a.recebidos) return b.recebidos - a.recebidos;
      return b.avaliado - a.avaliado;
    });

    // Total Geral
    const total: DesempenhoAvaliador = {
      avaliador: "Total Geral",
      acuracidade: dados.length > 0 ? dados.reduce((sum, d) => sum + d.acuracidade, 0) / dados.length : 0,
      conversao: dados.length > 0 ? dados.reduce((sum, d) => sum + d.conversao, 0) / dados.length : 0,
      avaliado: dados.reduce((sum, d) => sum + d.avaliado, 0),
      comprado: dados.reduce((sum, d) => sum + d.comprado, 0),
      recebidos: dados.reduce((sum, d) => sum + d.recebidos, 0),
      trocaGrade: dados.reduce((sum, d) => sum + d.trocaGrade, 0),
      percTroca: 0,
      subiu_qty: dados.reduce((sum, d) => sum + d.subiu_qty, 0),
      subiu_val: dados.reduce((sum, d) => sum + d.subiu_val, 0),
      desceu_qty: dados.reduce((sum, d) => sum + d.desceu_qty, 0),
      desceu_val: dados.reduce((sum, d) => sum + d.desceu_val, 0),
      resultado: dados.reduce((sum, d) => sum + d.resultado, 0),
    };
    if (total.recebidos > 0) {
      total.percTroca = (total.trocaGrade / total.recebidos) * 100;
    }

    return { dados, total };
  }, [rowsCreated, rowsReceived]);

  // Detalhamento: Dispositivos com Troca de Grade
  const detalheData = useMemo(() => {
    const trocas = rowsReceived.filter(
      (r) => String(r["Controle de Grade"]) === "Troca de Grade" && !isExcludedEvaluator(r)
    );
    return trocas.map((row) => ({
      imei: String(row["IMEI"] || ""),
      avaliador: String(row["Nome do Avaliador"] || ""),
      gradeAvaliada: String(row["Avaliação"] || ""),
      gradeFinal: String(row["Triagem"] || ""),
      resultadoFinanceiro: parseMoneyToNumber(String(row["Diferença Valor"] || "0")),
    }));
  }, [rowsReceived]);

  // Export rows para desempenho
  const exportDesempenhoRows = useMemo(() => {
    const result: Record<string, unknown>[] = [];
    desempenhoData.dados.forEach((d) => {
      result.push({
        Avaliador: d.avaliador,
        Avaliado: d.avaliado,
        Comprado: d.comprado,
        "Conversão (%)": `${d.conversao.toFixed(1)}%`,
        "Acuracidade (%)": `${d.acuracidade.toFixed(1)}%`,
        "Recebidos": d.recebidos,
        "Troca de Grade": d.trocaGrade,
        "%Troca": `${d.percTroca.toFixed(1)}%`,
        "Subiu #": d.subiu_qty,
        "Subiu $": formatMoney(d.subiu_val),
        "Desceu #": d.desceu_qty,
        "Desceu $": formatMoney(d.desceu_val),
        "Resultado $": formatMoney(d.resultado),
      });
    });
    if (desempenhoData.total) {
      result.push({
        Avaliador: desempenhoData.total.avaliador,
        Avaliado: desempenhoData.total.avaliado,
        Comprado: desempenhoData.total.comprado,
        "Conversão (%)": `${desempenhoData.total.conversao.toFixed(1)}%`,
        "Acuracidade (%)": `${desempenhoData.total.acuracidade.toFixed(1)}%`,
        "Recebidos": desempenhoData.total.recebidos,
        "Troca de Grade": desempenhoData.total.trocaGrade,
        "%Troca": `${desempenhoData.total.percTroca.toFixed(1)}%`,
        "Subiu #": desempenhoData.total.subiu_qty,
        "Subiu $": formatMoney(desempenhoData.total.subiu_val),
        "Desceu #": desempenhoData.total.desceu_qty,
        "Desceu $": formatMoney(desempenhoData.total.desceu_val),
        "Resultado $": formatMoney(desempenhoData.total.resultado),
      });
    }
    return result;
  }, [desempenhoData]);

  // Export rows para detalhe
  const exportDetalheRows = useMemo(
    () =>
      detalheData.map((d) => ({
        IMEI: d.imei,
        Avaliador: d.avaliador,
        "Grade Avaliada": d.gradeAvaliada,
        "Grade Final": d.gradeFinal,
        "Resultado Financeiro": formatMoney(d.resultadoFinanceiro),
      })),
    [detalheData],
  );

  const handleLoadData = async () => {
    // Carrega sem filter_by para o backend devolver both (created + received).
    const result = await getDadosGestao({
      dataInicio: filters.dataInicio,
      dataFim: filters.dataFim,
    });
    
    if (!result) {
      setRowsCreated([]);
      setRowsReceived([]);
      return;
    }

    // Se filter_by === "both", temos "created" e "received"
    if (result.filter_by === "both") {
      const created = (result.created || []) as Record<string, unknown>[];
      const received = (result.received || []) as Record<string, unknown>[];
      setRowsCreated(created);
      setRowsReceived(received);
    } else {
      // Fallback se vir apenas um dataset
      const dataset = (result.dados || result.created || result.received || []) as Record<string, unknown>[];
      if (result.filter_by === "created") {
        setRowsCreated(dataset);
        setRowsReceived([]);
      } else {
        setRowsCreated([]);
        setRowsReceived(dataset);
      }
    }
  };

  // Auto-load on mount
  useEffect(() => {
    handleLoadData();
  }, [filters.dataInicio, filters.dataFim]);

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data início</Label>
              <Input
                type="date"
                value={filters.dataInicio || ""}
                onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data fim</Label>
              <Input
                type="date"
                value={filters.dataFim || ""}
                onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleLoadData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Carregar dados
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Gestão de Avaliadores — Desempenho</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToExcel(exportDesempenhoRows, "gestao_desempenho_avaliadores", "Desempenho")}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!rowsCreated.length && !rowsReceived.length ? (
            <div className="text-center text-muted-foreground py-12">Carregue os dados para visualizar</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Avaliador</TableHead>
                    <TableHead className="text-right">Avaliado</TableHead>
                    <TableHead className="text-right">Comprado</TableHead>
                    <TableHead className="text-right">Conversão (%)</TableHead>
                    <TableHead className="text-right">Acuracidade (%)</TableHead>
                    <TableHead className="text-right">Recebidos</TableHead>
                    <TableHead className="text-right">Troca de Grade</TableHead>
                    <TableHead className="text-right">%Troca</TableHead>
                    <TableHead className="text-right">Subiu #</TableHead>
                    <TableHead className="text-right">Subiu $</TableHead>
                    <TableHead className="text-right">Desceu #</TableHead>
                    <TableHead className="text-right">Desceu $</TableHead>
                    <TableHead className="text-right">Resultado $</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {desempenhoData.dados.map((item) => (
                    <TableRow key={item.avaliador}>
                      <TableCell className="font-medium">{item.avaliador}</TableCell>
                      <TableCell className="text-right">{item.avaliado}</TableCell>
                      <TableCell className="text-right">{item.comprado}</TableCell>
                      <TableCell className="text-right">{item.conversao.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{item.acuracidade.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{item.recebidos}</TableCell>
                      <TableCell className="text-right">{item.trocaGrade}</TableCell>
                      <TableCell className="text-right">{item.percTroca.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{item.subiu_qty}</TableCell>
                      <TableCell className="text-right">{formatMoney(item.subiu_val)}</TableCell>
                      <TableCell className="text-right">{item.desceu_qty}</TableCell>
                      <TableCell className="text-right">{formatMoney(item.desceu_val)}</TableCell>
                      <TableCell className="text-right">{formatMoney(item.resultado)}</TableCell>
                    </TableRow>
                  ))}
                  {desempenhoData.total && (
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell>{desempenhoData.total.avaliador}</TableCell>
                      <TableCell className="text-right">{desempenhoData.total.avaliado}</TableCell>
                      <TableCell className="text-right">{desempenhoData.total.comprado}</TableCell>
                      <TableCell className="text-right">{desempenhoData.total.conversao.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{desempenhoData.total.acuracidade.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{desempenhoData.total.recebidos}</TableCell>
                      <TableCell className="text-right">{desempenhoData.total.trocaGrade}</TableCell>
                      <TableCell className="text-right">{desempenhoData.total.percTroca.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{desempenhoData.total.subiu_qty}</TableCell>
                      <TableCell className="text-right">{formatMoney(desempenhoData.total.subiu_val)}</TableCell>
                      <TableCell className="text-right">{desempenhoData.total.desceu_qty}</TableCell>
                      <TableCell className="text-right">{formatMoney(desempenhoData.total.desceu_val)}</TableCell>
                      <TableCell className="text-right">{formatMoney(desempenhoData.total.resultado)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Detalhamento: Dispositivos com Troca de Grade</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToExcel(exportDetalheRows, "detalhamento_troca_grade", "DetalheTroca")}
              disabled={!detalheData.length}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!detalheData.length ? (
            <div className="text-center text-muted-foreground py-12">
              {!rowsCreated.length && !rowsReceived.length
                ? "Carregue os dados para visualizar"
                : "Nenhuma troca de grade encontrada no período"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IMEI</TableHead>
                    <TableHead>Avaliador</TableHead>
                    <TableHead>Grade Avaliada</TableHead>
                    <TableHead>Grade Final</TableHead>
                    <TableHead className="text-right">Resultado Financeiro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalheData.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-sm">{item.imei}</TableCell>
                      <TableCell>{item.avaliador}</TableCell>
                      <TableCell>{item.gradeAvaliada}</TableCell>
                      <TableCell>{item.gradeFinal}</TableCell>
                      <TableCell className="text-right">{formatMoney(item.resultadoFinanceiro)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
