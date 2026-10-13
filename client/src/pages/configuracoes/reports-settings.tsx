// Configurações → Relatórios: chamados por técnico no período (GET /api/v1/reports/technicians).
import { Fragment, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchWithAuth } from "@/lib/queryClient";
import { useSupportGroups } from "@/hooks/use-support-groups";
import { csvCell, formatBusinessMinutes, slaPercent, type TechnicianReport, type TechnicianRow, type ReportTicketLine } from "@shared/technician-report";

type PeriodKey = "this-month" | "last-month" | "last-7" | "last-30" | "this-year" | "custom";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "this-month", label: "Este mês" },
  { key: "last-month", label: "Mês passado" },
  { key: "last-7", label: "Últimos 7 dias" },
  { key: "last-30", label: "Últimos 30 dias" },
  { key: "this-year", label: "Este ano" },
  { key: "custom", label: "Personalizado" },
];

const STATUS_LABEL: Record<string, string> = {
  open: "Aberto", triage: "Triagem", in_progress: "Em andamento", blocked: "Bloqueado",
  waiting_requester: "Aguardando solicitante", resolved: "Resolvido", closed: "Fechado",
};

/** Data de hoje (AAAA-MM-DD) no fuso de Brasília. */
function todayBr(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

function shift(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function periodRange(key: PeriodKey, today = todayBr()): { from: string; to: string } {
  const [y, m] = today.split("-").map(Number);
  const firstOf = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}-01`;
  switch (key) {
    case "last-month": {
      const year = m === 1 ? y - 1 : y;
      const month = m === 1 ? 12 : m - 1;
      return { from: firstOf(year, month), to: shift(firstOf(y, m), -1) };
    }
    case "last-7": return { from: shift(today, -6), to: today };
    case "last-30": return { from: shift(today, -29), to: today };
    case "this-year": return { from: `${y}-01-01`, to: today };
    default: return { from: firstOf(y, m), to: today };
  }
}

const fmtDate = (value: string | null) => (value ? new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const pct = (sla: { met: number; total: number }) => {
  const value = slaPercent(sla);
  return value == null ? "—" : `${value}%`;
};

function slaTone(sla: { met: number; total: number }) {
  const value = slaPercent(sla);
  if (value == null) return "text-muted-foreground";
  if (value >= 90) return "text-green-600 dark:text-green-400";
  if (value >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

/** CSV com ";" e BOM para abrir direto no Excel em português. */
function downloadCsv(filename: string, header: string[], rows: (string | number | null)[][]) {
  const content = [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type SortKey = "name" | "received" | "resolved" | "openNow" | "overdueNow" | "avgFirstResponseMin" | "avgResolutionMin" | "resolutionSla" | "csat";

function sortValue(row: TechnicianRow, key: SortKey): number | string {
  if (key === "name") return row.name.toLowerCase();
  if (key === "resolutionSla") return slaPercent(row.resolutionSla) ?? -1;
  if (key === "csat") return row.csat.average ?? -1;
  return (row[key] as number | null) ?? -1;
}

export function ReportsSettings() {
  const [period, setPeriod] = useState<PeriodKey>("this-month");
  const [custom, setCustom] = useState(() => periodRange("this-month"));
  const [group, setGroup] = useState("__all__");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "resolved", dir: "desc" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const { groups, groupName } = useSupportGroups();

  const range = period === "custom" ? custom : periodRange(period);
  const params = new URLSearchParams({ from: range.from, to: range.to });
  if (group !== "__all__") params.set("group", group);

  const { data, isLoading, isError, error } = useQuery<TechnicianReport>({
    queryKey: ["/api/v1/reports/technicians", range.from, range.to, group],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/v1/reports/technicians?${params}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Erro ao gerar o relatório");
      return body;
    },
    enabled: range.from <= range.to,
  });

  const rows = useMemo(() => {
    const list = [...(data?.rows ?? [])];
    list.sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [data, sort]);

  const ticketsOf = (assigneeId: string | null) => (data?.tickets ?? []).filter((t) => t.assigneeId === assigneeId);
  const rowKey = (row: TechnicianRow) => row.assigneeId ?? "__none__";
  const fileSuffix = `${range.from}_a_${range.to}${group !== "__all__" ? `_${group}` : ""}`;

  function exportSummary() {
    if (!data) return;
    downloadCsv(`relatorio-tecnicos_${fileSuffix}.csv`,
      ["Técnico", "Recebidos", "Resolvidos", "Em aberto", "Atrasados", "1ª resposta média", "Resolução média", "SLA 1ª resposta", "SLA resolução", "CSAT médio", "Avaliações"],
      [...rows, data.totals].map((r) => [r.name, r.received, r.resolved, r.openNow, r.overdueNow,
        formatBusinessMinutes(r.avgFirstResponseMin), formatBusinessMinutes(r.avgResolutionMin),
        pct(r.firstResponseSla), pct(r.resolutionSla), r.csat.average ?? "", r.csat.count]));
  }

  function exportTickets(list: ReportTicketLine[], suffix = "") {
    downloadCsv(`chamados${suffix}_${fileSuffix}.csv`,
      ["Código", "Título", "Squad", "Status", "Técnico", "Solicitante", "Aberto em", "1ª resposta em", "Resolvido em", "1ª resposta (útil)", "Resolução (útil)", "SLA", "CSAT"],
      list.map((t) => [t.code, t.title, groupName(t.category), STATUS_LABEL[t.status] ?? t.status, t.assigneeName, t.requesterName,
        fmtDate(t.openedAt), fmtDate(t.firstResponseAt), fmtDate(t.resolvedAt),
        formatBusinessMinutes(t.firstResponseMin), formatBusinessMinutes(t.resolutionMin),
        t.slaStatus === "dentro_prazo" ? "No prazo" : t.slaStatus === "em_atraso" ? "Atrasado" : "", t.csat ?? ""]));
  }

  const SortHead = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => (
    <TableHead className={className}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => setSort((s) => ({ key: k, dir: s.key === k && s.dir === "desc" ? "asc" : "desc" }))}
      >
        {label}
        {sort.key === k ? (sort.dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </TableHead>
  );

  const totals = data?.totals;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relatório de chamados por técnico</CardTitle>
        <CardDescription>
          Volume, tempos (em horas úteis, seg–sex 9h–18h, descontando as pausas) e SLA de cada técnico no período.
          Recebidos e 1ª resposta contam os chamados abertos no período; resolvidos, tempo de resolução, SLA e CSAT contam os resolvidos no período; em aberto e atrasados mostram a situação de agora.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Período</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="w-[180px]" data-testid="select-report-period"><SelectValue /></SelectTrigger>
              <SelectContent>{PERIODS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {period === "custom" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="report-from">De</Label>
                <Input id="report-from" type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="w-[160px]" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="report-to">Até</Label>
                <Input id="report-to" type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="w-[160px]" />
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label>Squad</Label>
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger className="w-[180px]" data-testid="select-report-group"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as squads</SelectItem>
                {groups.map((g) => <SelectItem key={g.key} value={g.key}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={exportSummary} disabled={!data} data-testid="button-export-summary">
              <Download className="h-4 w-4 mr-1" />Resumo (Excel)
            </Button>
            <Button variant="outline" size="sm" onClick={() => data && exportTickets(data.tickets)} disabled={!data} data-testid="button-export-tickets">
              <Download className="h-4 w-4 mr-1" />Chamados (Excel)
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : isError ? (
          <p className="text-sm text-destructive">{(error as Error)?.message || "Erro ao gerar o relatório"}</p>
        ) : !data ? null : (
          <>
            {totals && (
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                {[
                  ["Recebidos", totals.received],
                  ["Resolvidos", totals.resolved],
                  ["Em aberto agora", totals.openNow],
                  ["Atrasados agora", totals.overdueNow],
                  ["1ª resposta média", formatBusinessMinutes(totals.avgFirstResponseMin)],
                  ["Resolução média", formatBusinessMinutes(totals.avgResolutionMin)],
                  ["SLA de resolução", pct(totals.resolutionSla)],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`text-2xl font-semibold mt-1 ${label === "Atrasados agora" && Number(value) > 0 ? "text-red-600 dark:text-red-400" : ""}`}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum chamado no período.</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <SortHead label="Técnico" k="name" />
                      <SortHead label="Recebidos" k="received" className="text-right" />
                      <SortHead label="Resolvidos" k="resolved" className="text-right" />
                      <SortHead label="Em aberto" k="openNow" className="text-right" />
                      <SortHead label="Atrasados" k="overdueNow" className="text-right" />
                      <SortHead label="1ª resposta" k="avgFirstResponseMin" className="text-right" />
                      <SortHead label="Resolução" k="avgResolutionMin" className="text-right" />
                      <TableHead className="text-right">SLA resposta</TableHead>
                      <SortHead label="SLA resolução" k="resolutionSla" className="text-right" />
                      <SortHead label="CSAT" k="csat" className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const key = rowKey(row);
                      const open = expanded === key;
                      const list = open ? ticketsOf(row.assigneeId) : [];
                      return (
                        <Fragment key={key}>
                          <TableRow className="cursor-pointer" onClick={() => setExpanded(open ? null : key)} data-testid={`row-report-${key}`}>
                            <TableCell>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                            <TableCell className="font-medium">{row.assigneeId ? row.name : <span className="text-muted-foreground">{row.name}</span>}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.received}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.resolved}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.openNow}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.overdueNow ? <Badge variant="destructive">{row.overdueNow}</Badge> : 0}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatBusinessMinutes(row.avgFirstResponseMin)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatBusinessMinutes(row.avgResolutionMin)}</TableCell>
                            <TableCell className={`text-right tabular-nums ${slaTone(row.firstResponseSla)}`}>{pct(row.firstResponseSla)}</TableCell>
                            <TableCell className={`text-right tabular-nums ${slaTone(row.resolutionSla)}`}>{pct(row.resolutionSla)}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.csat.average != null ? `${row.csat.average.toLocaleString("pt-BR")} (${row.csat.count})` : "—"}</TableCell>
                          </TableRow>
                          {open && (
                            <TableRow>
                              <TableCell colSpan={11} className="bg-muted/30 p-0">
                                <div className="p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium">Chamados de {row.name} ({list.length})</p>
                                    <Button variant="ghost" size="sm" onClick={() => exportTickets(list, `_${row.name.toLowerCase().replace(/\s+/g, "-")}`)} disabled={!list.length}>
                                      <Download className="h-4 w-4 mr-1" />Exportar
                                    </Button>
                                  </div>
                                  {list.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Nenhum chamado no período.</p>
                                  ) : (
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Chamado</TableHead>
                                          <TableHead>Squad</TableHead>
                                          <TableHead>Status</TableHead>
                                          <TableHead>Aberto em</TableHead>
                                          <TableHead className="text-right">1ª resposta</TableHead>
                                          <TableHead className="text-right">Resolução</TableHead>
                                          <TableHead>SLA</TableHead>
                                          <TableHead className="text-right">CSAT</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {list.map((t) => (
                                          <TableRow key={t.id}>
                                            <TableCell>
                                              <Link href={`/chamados/${t.id}`} className="text-primary hover:underline">{t.code}</Link>
                                              <span className="text-muted-foreground"> · {t.title}</span>
                                            </TableCell>
                                            <TableCell>{groupName(t.category)}</TableCell>
                                            <TableCell>{STATUS_LABEL[t.status] ?? t.status}</TableCell>
                                            <TableCell className="tabular-nums">{fmtDate(t.openedAt)}</TableCell>
                                            <TableCell className="text-right tabular-nums">{formatBusinessMinutes(t.firstResponseMin)}</TableCell>
                                            <TableCell className="text-right tabular-nums">{formatBusinessMinutes(t.resolutionMin)}</TableCell>
                                            <TableCell>
                                              {t.slaStatus === "em_atraso" ? <Badge variant="destructive">Atrasado</Badge> : t.slaStatus === "dentro_prazo" ? <Badge variant="outline">No prazo</Badge> : "—"}
                                            </TableCell>
                                            <TableCell className="text-right">{t.csat ?? "—"}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
