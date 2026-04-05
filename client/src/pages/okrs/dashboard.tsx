import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Archive,
} from "lucide-react";
import { getCurrentQuarter, getQuarterOptions } from "@/lib/quarter";
import { HealthBadge } from "@/components/okrs/HealthBadge";
import type { HealthStatus } from "@/lib/okr-health";
import type { User } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ObjectiveSummary {
  id: string;
  title: string;
  progressPercent: number;
  healthStatus: HealthStatus;
  keyResultsCount: number;
  status: string;
}

interface ClosedObjectiveSummary {
  id: string;
  title: string;
  closeStatus: string | null;
  closedAt: string | null;
}

interface AtRiskKR {
  id: string;
  title: string;
  objectiveId: string;
  objectiveTitle: string;
  progressPercent: number;
  expectedPercent: number;
  healthStatus: "at_risk" | "off_track";
  ownerId: string | null;
}

interface OverdueInitiative {
  id: string;
  title: string;
  keyResultId: string;
  keyResultTitle: string;
  objectiveTitle: string;
  dueDate: string;
  ownerId: string | null;
}

interface DashboardData {
  cycle: string;
  totalObjectives: number;
  avgProgress: number;
  byHealth: { on_track: number; at_risk: number; off_track: number };
  closedCount: number;
  closedObjectives: ClosedObjectiveSummary[];
  objectives: ObjectiveSummary[];
  initiatives: { total: number; completed: number; completionRate: number };
  atRiskKRs: AtRiskKR[];
  overdueInitiatives: OverdueInitiative[];
}

// ─── LS key para persistir quarter entre sessões ───────────────────────────────
const LS_QUARTER_KEY = "okr_dashboard_quarter";

function getInitialQuarter(): string {
  try {
    return localStorage.getItem(LS_QUARTER_KEY) || getCurrentQuarter();
  } catch {
    return getCurrentQuarter();
  }
}

// ─── OwnerChip ────────────────────────────────────────────────────────────────
function OwnerChip({ userId, users }: { userId: string | null; users: User[] }) {
  if (!userId) return null;
  const user = users.find((u) => u.id === userId);
  if (!user) return null;
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-5 w-5 rounded-full bg-muted/60 flex items-center justify-center text-[9px] font-semibold text-muted-foreground">
        {initials}
      </div>
      <span className="text-[11px] text-muted-foreground">{user.name}</span>
    </div>
  );
}

// ─── Health bar color ─────────────────────────────────────────────────────────
function healthBarColor(status: HealthStatus): string {
  if (status === "on_track") return "bg-green-500";
  if (status === "at_risk") return "bg-yellow-500";
  return "bg-red-500";
}

// ─── KPI Card (inline, simples) ────────────────────────────────────────────────
interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  sub?: React.ReactNode;
  highlight?: boolean;
}

function KpiCard({ title, value, icon, sub, highlight }: KpiCardProps) {
  return (
    <Card
      style={
        highlight
          ? { background: "var(--vf)", border: "none" }
          : { background: "var(--bg2)", borderColor: "var(--sep)" }
      }
    >
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start justify-between mb-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: highlight ? "#FFFFFF" : "var(--l3)" }}
          >
            {title}
          </p>
          <span style={{ color: highlight ? "#FFFFFF" : undefined }} className={highlight ? "" : "text-muted-foreground/60"}>
            {icon}
          </span>
        </div>
        <p
          className="text-[28px] font-bold tracking-tight mb-1"
          style={{ color: highlight ? "#FFFFFF" : "var(--l1)" }}
        >
          {value}
        </p>
        {sub && <div style={{ color: highlight ? "rgba(255,255,255,0.8)" : undefined }}>{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3 px-4 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
          <CardContent className="space-y-3">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function OKRsDashboardPage() {
  const [, setLocation] = useLocation();
  const [cycle, setCycle] = useState<string>(getInitialQuarter);
  const quarters = getQuarterOptions();

  useEffect(() => {
    try { localStorage.setItem(LS_QUARTER_KEY, cycle); } catch { /* ignore */ }
  }, [cycle]);

  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: [`/api/okrs/dashboard?cycle=${encodeURIComponent(cycle)}`],
    staleTime: 30_000,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <PageHeader
          title="Dashboard OKRs"
          description="Visão executiva do trimestre"
        />
        <Select value={cycle} onValueChange={setCycle}>
          <SelectTrigger className="w-[140px] border h-9" data-testid="select-dashboard-cycle">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {quarters.map((q) => (
              <SelectItem key={q} value={q}>{q}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Loading ── */}
      {isLoading && <DashboardSkeleton />}

      {/* ── Error ── */}
      {isError && (
        <Card style={{ borderColor: "var(--sep)" }}>
          <CardContent className="pt-6 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Erro ao carregar dashboard. Tente novamente.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Data ── */}
      {data && !isLoading && (
        <>
          {/* ── BLOCO 1: KPI Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="Progresso Geral"
              value={`${data.avgProgress}%`}
              icon={<TrendingUp className="h-5 w-5" />}
              sub={
                <div className="mt-1.5 w-full bg-muted/40 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: `${data.avgProgress}%` }}
                  />
                </div>
              }
              highlight
            />
            <KpiCard
              title="No Caminho"
              value={data.byHealth.on_track}
              icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
              sub={
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-[9px] font-bold uppercase tracking-wider mt-1">
                  on track
                </Badge>
              }
            />
            <KpiCard
              title="Em Risco"
              value={data.byHealth.at_risk}
              icon={<AlertTriangle className="h-5 w-5 text-yellow-500" />}
              sub={
                <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-[9px] font-bold uppercase tracking-wider mt-1">
                  at risk
                </Badge>
              }
            />
            <KpiCard
              title="Atrasados"
              value={data.byHealth.off_track}
              icon={<XCircle className="h-5 w-5 text-red-500" />}
              sub={
                <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[9px] font-bold uppercase tracking-wider mt-1">
                  off track
                </Badge>
              }
            />
          </div>

          {/* ── BLOCO 2: Objetivos do trimestre ── */}
          <Card style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-[14px] font-semibold" style={{ color: "var(--l1)" }}>
                Objetivos do trimestre
              </CardTitle>
              <p className="text-[11px]" style={{ color: "var(--l3)" }}>
                Ordenados do mais atrasado ao mais avançado
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.objectives.length === 0 ? (
                <p className="text-[13px] text-muted-foreground text-center py-4">
                  Nenhum objetivo encontrado para este trimestre.
                </p>
              ) : (
                data.objectives.map((obj) => (
                  <button
                    key={obj.id}
                    className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-muted/40 transition-colors"
                    onClick={() => setLocation("/okrs")}
                    data-testid={`obj-row-${obj.id}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <HealthBadge status={obj.healthStatus} />
                      <Badge
                        variant="outline"
                        className="text-[9px] uppercase tracking-wider font-semibold border-border/50 text-muted-foreground"
                      >
                        {obj.status}
                      </Badge>
                      <span className="flex-1 text-[13px] font-medium truncate" style={{ color: "var(--l1)" }}>
                        {obj.title}
                      </span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {obj.keyResultsCount} KR{obj.keyResultsCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all ${healthBarColor(obj.healthStatus)}`}
                          style={{ width: `${obj.progressPercent}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold shrink-0" style={{ color: "var(--l2)" }}>
                        {obj.progressPercent}%
                      </span>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {/* ── BLOCO 2b: Objetivos encerrados ── */}
          {data.closedCount > 0 && (
            <Card style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Archive className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-[14px] font-semibold" style={{ color: "var(--l1)" }}>
                    {data.closedCount} objetivo{data.closedCount !== 1 ? "s" : ""} encerrado{data.closedCount !== 1 ? "s" : ""} este quarter
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.closedObjectives.map((obj) => {
                  const statusConfig = {
                    achieved: { label: "Atingido", className: "bg-green-500/10 text-green-600 border-green-500/30" },
                    partial: { label: "Parcialmente Atingido", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
                    not_achieved: { label: "Não Atingido", className: "bg-red-500/10 text-red-600 border-red-500/30" },
                  } as const;
                  type CloseStatus = keyof typeof statusConfig;
                  const cfg = obj.closeStatus && obj.closeStatus in statusConfig
                    ? statusConfig[obj.closeStatus as CloseStatus]
                    : null;
                  const closedDate = obj.closedAt
                    ? format(new Date(obj.closedAt), "dd/MM/yyyy", { locale: ptBR })
                    : null;
                  return (
                    <div
                      key={obj.id}
                      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 opacity-75"
                      style={{ borderBottom: "1px solid var(--sep)" }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Archive className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                        <span className="text-[13px] truncate" style={{ color: "var(--l2)" }}>
                          {obj.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {closedDate && (
                          <span className="text-[11px]" style={{ color: "var(--l3)" }}>
                            {closedDate}
                          </span>
                        )}
                        {cfg && (
                          <Badge variant="outline" className={`text-[9px] font-semibold uppercase tracking-wide ${cfg.className}`}>
                            {cfg.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* ── BLOCOS 3+4 em grid ── */}
          <div className="grid md:grid-cols-2 gap-4 items-start">
            {/* ── BLOCO 3: KRs fora do ritmo ── */}
            <Card style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-[14px] font-semibold" style={{ color: "var(--l1)" }}>
                  KRs que precisam de atenção
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.atRiskKRs.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-500/60" />
                    <p className="text-[13px] text-muted-foreground">
                      Todos os KRs estão no caminho.
                    </p>
                  </div>
                ) : (
                  data.atRiskKRs.map((kr) => {
                    const gap = kr.expectedPercent - kr.progressPercent;
                    return (
                      <div
                        key={kr.id}
                        className="rounded-lg border px-3 py-2.5 space-y-1"
                        style={{ borderColor: "var(--sep)" }}
                      >
                        <div className="flex items-center gap-2">
                          <HealthBadge status={kr.healthStatus} />
                          <span className="flex-1 text-[12px] font-medium truncate" style={{ color: "var(--l1)" }}>
                            {kr.title}
                          </span>
                        </div>
                        <p className="text-[11px]" style={{ color: "var(--l3)" }}>
                          Objetivo:{" "}
                          <span className="font-medium">{kr.objectiveTitle}</span>
                        </p>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-[11px]" style={{ color: "var(--l2)" }}>
                            Progresso: <strong>{kr.progressPercent}%</strong>
                          </span>
                          <span className="text-[11px]" style={{ color: "var(--l3)" }}>
                            Esperado: {kr.expectedPercent}%
                          </span>
                          <span className="text-[11px] font-semibold text-red-500">
                            Gap: -{gap}pp
                          </span>
                        </div>
                        {kr.ownerId && (
                          <OwnerChip userId={kr.ownerId} users={users} />
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* ── BLOCO 4: Iniciativas ── */}
            <Card style={{ background: "var(--bg2)", borderColor: "var(--sep)" }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-[14px] font-semibold" style={{ color: "var(--l1)" }}>
                  Iniciativas do trimestre
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Resumo */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px]" style={{ color: "var(--l2)" }}>
                      <strong>{data.initiatives.completed}</strong> de{" "}
                      <strong>{data.initiatives.total}</strong> concluídas
                    </p>
                    <span className="text-[13px] font-bold" style={{ color: "var(--l1)" }}>
                      {data.initiatives.completionRate}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{ width: `${data.initiatives.completionRate}%` }}
                    />
                  </div>
                </div>

                {/* Vencidas */}
                {data.overdueInitiatives.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-red-500">
                      Vencidas e não concluídas
                    </p>
                    {data.overdueInitiatives.map((init) => (
                      <div
                        key={init.id}
                        className="flex flex-col gap-0.5 rounded-md border-l-2 border-red-500 pl-3 py-1"
                      >
                        <div className="flex items-start gap-1.5">
                          <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                          <span className="text-[12px] font-medium leading-tight" style={{ color: "var(--l1)" }}>
                            {init.title}
                          </span>
                        </div>
                        <p className="text-[11px]" style={{ color: "var(--l3)" }}>
                          {init.keyResultTitle}
                        </p>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-[11px] text-red-500 font-medium">
                            Venceu em{" "}
                            {format(new Date(init.dueDate), "dd/MM/yy", { locale: ptBR })}
                          </span>
                          {init.ownerId && (
                            <OwnerChip userId={init.ownerId} users={users} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-md bg-green-500/5 border border-green-500/20 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <p className="text-[12px] text-green-600 dark:text-green-400">
                      Nenhuma iniciativa vencida.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
