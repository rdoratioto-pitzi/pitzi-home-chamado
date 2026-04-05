import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CalendarClock,
  MoreHorizontal,
  Pencil,
  Trash2,
  Network,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  Square,
  CheckSquare,
  Flag,
  Archive,
  Eye,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Objective, KeyResult, User, Initiative, KeyResultUpdate } from "@shared/schema";
import { ObjectiveDialog } from "./objective-dialog";
import { ObjectiveEditDialog } from "./objective-edit-dialog";
import { ObjectiveRetrospectiveDialog } from "./objective-retrospective-dialog";
import { KeyResultDialog } from "./key-result-dialog";
import { KeyResultEditDialog } from "./key-result-edit-dialog";
import { KeyResultUpdateDialog } from "./key-result-update-dialog";
import { InitiativeDialog } from "./initiative-dialog";
import { InitiativeEditDialog } from "./initiative-edit-dialog";
import { OkrHierarchyView } from "@/components/okrs/OkrHierarchyView";
import { OkrListView } from "@/components/okrs/OkrListView";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentQuarter, getQuarterOptions } from "@/lib/quarter";
import { formatKRRange, formatKRCurrentOverTarget } from "@/lib/kr-format";
import { useAuth } from "@/contexts/auth-context";
import { calculateHealthStatus, calculateObjectiveHealth } from "@/lib/okr-health";
import { HealthBadge } from "@/components/okrs/HealthBadge";

// ─── OwnerChip ────────────────────────────────────────────────────────────────
// Exibe avatar (iniciais) + nome do responsável. Mostra "Você" quando o
// usuário logado é o responsável. Não renderiza nada se userId estiver vazio
// ou se o usuário não for encontrado na lista.
function OwnerChip({
  userId,
  users,
  currentUserId,
}: {
  userId: string | null | undefined;
  users: User[];
  currentUserId: string | undefined;
}) {
  if (!userId) return null;
  const user = users.find((u) => u.id === userId);
  if (!user) return null;
  const label = userId === currentUserId ? "Você" : user.name;
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="flex items-center gap-1.5" data-testid={`owner-chip-${userId}`}>
      <div className="h-6 w-6 rounded-full bg-muted/60 flex items-center justify-center text-[9px] font-semibold text-muted-foreground">
        {initials}
      </div>
      <span className="text-[12px] text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_QUARTER_KEY = "okr_quarter_filter";

const statusColors: Record<string, string> = {
  on_track: "bg-green-500/10 text-green-600 dark:text-green-400",
  at_risk: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  off_track: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const statusLabels: Record<string, string> = {
  on_track: "No Caminho",
  at_risk: "Em Risco",
  off_track: "Fora do Caminho",
};

const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  on_track: CheckCircle2,
  at_risk: AlertTriangle,
  off_track: TrendingUp,
};

const deadlineStatusColors: Record<string, string> = {
  on_track: "bg-green-500/10 text-green-600 border-green-500/30",
  at_risk: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  overdue: "bg-red-500/10 text-red-600 border-red-500/30",
};

const deadlineStatusLabels: Record<string, string> = {
  on_track: "No prazo",
  at_risk: "Vencendo",
  overdue: "Atrasado",
};

const levelLabels: Record<string, string> = {
  company: "Empresa",
  team: "Time",
  area: "Área", // legacy
};

function getInitialQuarter(): string {
  const saved = localStorage.getItem(LS_QUARTER_KEY);
  return saved || getCurrentQuarter();
}

// ─── Progress helpers ─────────────────────────────────────────────────────────

function calcKRProgress(kr: KeyResult, initiatives: Initiative[]): number {
  if (initiatives.length > 0) {
    const done = initiatives.filter((i) => i.completed).length;
    return Math.round((done / initiatives.length) * 100);
  }
  const start = parseFloat(kr.startValue || "0");
  const target = parseFloat(kr.targetValue || "100");
  const current = parseFloat(kr.currentValue || "0");
  let p: number;
  if (kr.measurementType === "decreasing") {
    p = target !== start ? ((start - current) / (start - target)) * 100 : 0;
  } else if (kr.measurementType === "binary") {
    p = current > 0 ? 100 : 0;
  } else {
    p = target !== start ? ((current - start) / (target - start)) * 100 : 0;
  }
  return Math.min(100, Math.max(0, Math.round(p)));
}

function calcObjectiveProgress(
  objectiveId: string,
  keyResults: KeyResult[],
  initiativesByKR: Map<string, Initiative[]>,
): number {
  const krs = keyResults.filter((kr) => kr.objectiveId === objectiveId);
  if (krs.length === 0) return 0;
  const total = krs.reduce(
    (sum, kr) => sum + calcKRProgress(kr, initiativesByKR.get(kr.id) ?? []),
    0,
  );
  return Math.round(total / krs.length);
}

// ─── KRHistorySection ─────────────────────────────────────────────────────────
// Seção colapsável inline no card do KR com histórico de check-ins.
// Faz fetch apenas quando expandido (enabled: isOpen).

function KRHistorySection({
  krId,
  unit,
  onViewAll,
}: {
  krId: string;
  unit: string | null | undefined;
  onViewAll: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: updates = [], isLoading } = useQuery<(KeyResultUpdate & { user?: { name: string } })[]>({
    queryKey: ["/api/key-results", krId, "updates"],
    enabled: isOpen,
  });

  const sorted = [...updates].sort((a, b) => {
    const dA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dB - dA;
  });

  return (
    <div className="border-t border-border/30 mt-2 pt-1.5">
      <button
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors py-0.5"
        onClick={() => setIsOpen((v) => !v)}
      >
        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Histórico
      </button>

      {isOpen && (
        <div className="mt-1.5 space-y-1">
          {isLoading ? (
            <p className="text-[11px] text-muted-foreground py-1">Carregando...</p>
          ) : sorted.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-1">Nenhum check-in registrado ainda.</p>
          ) : (
            <>
              {sorted.slice(0, 5).map((u) => {
                const newVal = parseFloat(u.newValue || "0");
                const prog = u.progressPercentage
                  ? Math.round(parseFloat(u.progressPercentage))
                  : null;
                return (
                  <div key={u.id} className="flex items-center gap-2 text-[11px] py-0.5 flex-wrap">
                    <span className="text-muted-foreground shrink-0">
                      {u.createdAt ? format(new Date(u.createdAt), "dd/MM/yy", { locale: ptBR }) : "—"}
                    </span>
                    <span className="font-semibold shrink-0">
                      {newVal}{unit ? ` ${unit}` : ""}
                    </span>
                    {prog !== null && (
                      <span className="text-muted-foreground shrink-0">{prog}%</span>
                    )}
                    {u.user?.name && (
                      <span className="text-muted-foreground">{u.user.name}</span>
                    )}
                    {u.comment && (
                      <span className="text-muted-foreground truncate max-w-[160px]">
                        {u.comment.length > 60 ? `${u.comment.slice(0, 60)}…` : u.comment}
                      </span>
                    )}
                  </div>
                );
              })}
              {sorted.length > 5 && (
                <button
                  className="text-[11px] text-primary hover:underline py-0.5"
                  onClick={onViewAll}
                >
                  Ver todos ({sorted.length})
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OKRsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id;

  // ── Dialog state ────────────────────────────────────────────────────────────
  const [isObjectiveDialogOpen, setIsObjectiveDialogOpen] = useState(false);
  const [isKRDialogOpen, setIsKRDialogOpen] = useState(false);
  const [isGlobalKRDialogOpen, setIsGlobalKRDialogOpen] = useState(false);
  const [isInitiativeDialogOpen, setIsInitiativeDialogOpen] = useState(false);
  const [isInlineInitiativeDialogOpen, setIsInlineInitiativeDialogOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);

  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [editingKR, setEditingKR] = useState<KeyResult | null>(null);
  const [editingInitiative, setEditingInitiative] = useState<Initiative | null>(null);
  const [deletingObjectiveId, setDeletingObjectiveId] = useState<string | null>(null);
  const [deletingKRId, setDeletingKRId] = useState<string | null>(null);
  const [retroObjective, setRetroObjective] = useState<Objective | null>(null);
  const [retroReadOnly, setRetroReadOnly] = useState(false);

  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [selectedKeyResult, setSelectedKeyResult] = useState<KeyResult | null>(null);
  const [inlineInitiativeKRId, setInlineInitiativeKRId] = useState<string | null>(null);

  // ── Filter + view state ─────────────────────────────────────────────────────
  const [cycleFilter, setCycleFilter] = useState<string>(getInitialQuarter);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"lista" | "bullets" | "hierarchy">("bullets");

  // Per-card collapse state (default: all expanded)
  const [collapsedObjectives, setCollapsedObjectives] = useState<Set<string>>(new Set());
  const [collapsedKRs, setCollapsedKRs] = useState<Set<string>>(new Set());

  const quarters = getQuarterOptions();

  useEffect(() => {
    localStorage.setItem(LS_QUARTER_KEY, cycleFilter);
  }, [cycleFilter]);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const isArchiveMode = cycleFilter === "archive";
  const { data: objectives = [], isLoading: objectivesLoading } = useQuery<Objective[]>({
    queryKey: isArchiveMode ? ["/api/objectives", "archived"] : ["/api/objectives"],
    queryFn: isArchiveMode
      ? () => fetch("/api/objectives?archived=true").then((r) => r.json())
      : undefined,
  });
  const { data: keyResults = [] } = useQuery<KeyResult[]>({
    queryKey: ["/api/key-results"],
  });
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });
  const { data: allInitiatives = [] } = useQuery<Initiative[]>({
    queryKey: ["/api/initiatives"],
  });

  // ── Derived data ─────────────────────────────────────────────────────────────
  const initiativesByKR = useMemo(() => {
    const map = new Map<string, Initiative[]>();
    for (const init of allInitiatives) {
      const list = map.get(init.keyResultId) ?? [];
      list.push(init);
      map.set(init.keyResultId, list);
    }
    return map;
  }, [allInitiatives]);

  const filteredObjectives = isArchiveMode
    ? objectives
    : objectives.filter((obj) => obj.cycle === cycleFilter);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const deleteObjectiveMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/objectives/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/objectives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-results"] });
      toast({ title: "Objetivo excluído", description: "O objetivo foi removido." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível excluir o objetivo.", variant: "destructive" });
    },
  });

  const deleteKRMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/key-results/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/key-results"] });
      toast({ title: "KR excluído", description: "O resultado-chave foi removido." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível excluir o KR.", variant: "destructive" });
    },
  });

  const toggleInitiativeMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) =>
      apiRequest("PATCH", `/api/initiatives/${id}`, { completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/initiatives"] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível atualizar a iniciativa.", variant: "destructive" });
    },
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const openKRDialog = (objectiveId: string) => {
    setSelectedObjectiveId(objectiveId);
    setIsKRDialogOpen(true);
  };

  const openUpdateDialog = (kr: KeyResult) => {
    setSelectedKeyResult(kr);
    setIsUpdateDialogOpen(true);
  };

  const openInlineInitiativeDialog = (krId: string) => {
    setInlineInitiativeKRId(krId);
    setIsInlineInitiativeDialogOpen(true);
  };

  const toggleObjectiveCollapse = (id: string) =>
    setCollapsedObjectives((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleKRCollapse = (id: string) =>
    setCollapsedKRs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const parseResponsibleIds = (raw: string | null): string[] => {
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="OKRs"
        breadcrumbs={[{ label: "OKRs" }]}
        actions={
          !isArchiveMode ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setIsInitiativeDialogOpen(true)}
                data-testid="button-new-initiative"
                className="text-primary hover:text-primary hover:bg-primary/10"
              >
                <Plus className="h-4 w-4 mr-1" />
                Nova Iniciativa
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsGlobalKRDialogOpen(true)}
                data-testid="button-new-kr-global"
                className="border-primary text-primary hover:bg-primary/10 hover:text-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo KR
              </Button>
              <Button
                onClick={() => setIsObjectiveDialogOpen(true)}
                data-testid="button-new-objective"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Objetivo
              </Button>
            </div>
          ) : undefined
        }
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Filters + toggle */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight">Objetivos e Resultados-Chave</h2>
            <p className="text-[14px] text-muted-foreground mt-1">
              Acompanhe o progresso dos objetivos da empresa
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Card className="shadow-sm border-border/60 p-1 flex gap-2">
              <Select value={cycleFilter} onValueChange={setCycleFilter}>
                <SelectTrigger className="w-[140px] border-0 h-9 bg-transparent" data-testid="select-cycle-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {quarters.map((q) => (
                    <SelectItem key={q} value={q}>{q}</SelectItem>
                  ))}
                  <SelectItem value="archive">
                    <span className="flex items-center gap-1.5">
                      <Archive className="h-3 w-3" />
                      Arquivo
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="w-px h-4 bg-border/60 self-center" />
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-[140px] border-0 h-9 bg-transparent" data-testid="select-level-filter">
                  <SelectValue placeholder="Nível" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Níveis</SelectItem>
                  <SelectItem value="empresa">Empresa</SelectItem>
                  <SelectItem value="kr">KR</SelectItem>
                  <SelectItem value="iniciativa">Iniciativa</SelectItem>
                </SelectContent>
              </Select>
            </Card>
            {/* View mode toggle: Lista | Bullets | Organograma */}
            <div className="flex rounded-lg border border-border/60 overflow-hidden">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-10 w-10 rounded-none border-r border-border/60 ${viewMode === "lista" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
                    onClick={() => setViewMode("lista")}
                    data-testid="button-view-lista"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Lista</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-10 w-10 rounded-none border-r border-border/60 ${viewMode === "bullets" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
                    onClick={() => setViewMode("bullets")}
                    data-testid="button-view-bullets"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Bullets</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-10 w-10 rounded-none ${viewMode === "hierarchy" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
                    onClick={() => setViewMode("hierarchy")}
                    data-testid="button-view-organograma"
                  >
                    <Network className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Organograma</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* ── Lista view ───────────────────────────────────────────────────── */}
        {viewMode === "lista" ? (
          objectivesLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : (
            <OkrListView
              objectives={filteredObjectives}
              keyResults={keyResults}
              users={users}
              initiativesByKR={initiativesByKR}
              levelFilter={levelFilter}
              currentUserId={currentUserId}
              onToggleInitiative={(id, completed) =>
                toggleInitiativeMutation.mutate({ id, completed })
              }
              onEditObjective={(obj) => setEditingObjective(obj)}
              onDeleteObjective={(id) => setDeletingObjectiveId(id)}
              onEditKR={(kr) => setEditingKR(kr)}
              onDeleteKR={(id) => setDeletingKRId(id)}
              onEditInitiative={(init) => setEditingInitiative(init)}
              onCheckin={(kr) => openUpdateDialog(kr)}
              onRetroObjective={(obj, ro) => { setRetroObjective(obj); setRetroReadOnly(ro); }}
            />
          )

        /* ── Organograma view ──────────────────────────────────────────────── */
        ) : viewMode === "hierarchy" ? (
          objectivesLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : (
            <OkrHierarchyView
              objectives={filteredObjectives}
              keyResults={keyResults}
              users={users}
              initiativesByKR={initiativesByKR}
              onToggleInitiative={(id, completed) =>
                toggleInitiativeMutation.mutate({ id, completed })
              }
              onRetroObjective={(obj, ro) => { setRetroObjective(obj); setRetroReadOnly(ro); }}
            />
          )

        /* ── Bullets view ─────────────────────────────────────────────────── */
        ) : objectivesLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : filteredObjectives.length === 0 ? (
          <Card className="shadow-sm border-border/60 text-center py-16">
            <CardContent>
              <div className="h-16 w-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-[18px] font-bold">Nenhum OKR encontrado</h3>
              <p className="text-[14px] text-muted-foreground mt-2 max-w-xs mx-auto">
                {objectives.length === 0
                  ? "Crie seu primeiro objetivo estratégico clicando no botão 'Novo Objetivo' acima"
                  : "Tente ajustar os filtros de ciclo ou nível para encontrar o que procura"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredObjectives.map((objective) => {
              const krs = keyResults.filter((kr) => kr.objectiveId === objective.id);
              const progress = calcObjectiveProgress(objective.id, keyResults, initiativesByKR);
              const StatusIcon = statusIcons[objective.status] ?? CheckCircle2;
              const isObjCollapsed = collapsedObjectives.has(objective.id);
              const objHealth = calculateObjectiveHealth(
                krs.map((kr) =>
                  calculateHealthStatus(
                    calcKRProgress(kr, initiativesByKR.get(kr.id) ?? []),
                    objective.cycle,
                  )
                )
              );

              const isClosed = objective.closedAt != null;

              return (
                <div
                  key={objective.id}
                  className={`rounded-xl border border-border/60 bg-background shadow-sm overflow-hidden ${
                    isClosed
                      ? "border-l-[3px] border-l-border opacity-70"
                      : "border-l-[3px] border-l-[#00E676]"
                  }`}
                  data-testid={`card-objective-${objective.id}`}
                >
                  {/* ── Objective header ─────────────────────────────────── */}
                  <div className="px-5 pt-4 pb-3">
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${isClosed ? "bg-muted/40" : statusColors[objective.status]}`}>
                        <StatusIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-wrap">
                            <Badge variant="secondary" className="font-bold text-[10px] uppercase tracking-wider bg-[#00E676]/10 text-[#00E676] border-[#00E676]/20 border">
                              {levelLabels[objective.level]}
                            </Badge>
                            <h3 className={`text-[15px] font-bold leading-tight ${isClosed ? "text-muted-foreground" : "text-foreground"}`}>
                              {objective.title}
                            </h3>
                            {isClosed ? (
                              <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-wider bg-muted/40 text-muted-foreground border-border/60">
                                ENCERRADO
                              </Badge>
                            ) : (
                              <>
                                <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wider ${statusColors[objective.status]}`}>
                                  {statusLabels[objective.status]}
                                </Badge>
                                {objHealth !== objective.status && (
                                  <HealthBadge status={objHealth} secondary />
                                )}
                              </>
                            )}
                            <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-wider">
                              {objective.cycle}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground"
                              onClick={() => toggleObjectiveCollapse(objective.id)}
                            >
                              {isObjCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  data-testid={`btn-menu-objective-${objective.id}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {isClosed ? (
                                  <DropdownMenuItem onClick={() => { setRetroObjective(objective); setRetroReadOnly(true); }}>
                                    <Eye className="h-3.5 w-3.5 mr-2" />
                                    Ver retrospectiva
                                  </DropdownMenuItem>
                                ) : (
                                  <>
                                    <DropdownMenuItem onClick={() => setEditingObjective(objective)}>
                                      <Pencil className="h-3.5 w-3.5 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setRetroObjective(objective); setRetroReadOnly(false); }}>
                                      <Flag className="h-3.5 w-3.5 mr-2" />
                                      Encerrar Quarter
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeletingObjectiveId(objective.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Responsável */}
                        {objective.ownerId && (
                          <div className="mt-2">
                            <OwnerChip
                              userId={objective.ownerId}
                              users={users}
                              currentUserId={currentUserId}
                            />
                          </div>
                        )}

                        {/* Objective progress bar */}
                        <div className="mt-3 flex items-center gap-3">
                          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-400"
                              style={{ width: `${progress}%`, background: "#00E676" }}
                            />
                          </div>
                          <span className="text-[13px] font-bold min-w-[35px] text-right" style={{ color: "#00E676" }}>
                            {progress}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── KRs section (collapsible) ────────────────────────── */}
                  {!isObjCollapsed && levelFilter !== "empresa" && (
                    <div className="border-t border-border/40 bg-muted/5 px-5 pb-4 pt-3">
                      <div className="space-y-2">
                        {krs.map((kr) => {
                          const initiatives = initiativesByKR.get(kr.id) ?? [];
                          const krProgress = calcKRProgress(kr, initiatives);
                          const isKRCollapsed = collapsedKRs.has(kr.id);
                          const completedCount = initiatives.filter((i) => i.completed).length;
                          const deadlineStatus = kr.deadlineStatus || "on_track";
                          const ownerIds = parseResponsibleIds(kr.responsibleIds);
                          const krHealth = calculateHealthStatus(krProgress, objective.cycle);

                          return (
                            <div key={kr.id}>
                              {/* ── KR card (indented 20px, blue border) ── */}
                              <div
                                className="ml-5 rounded-lg border border-border/40 border-l-[3px] border-l-[#378ADD] bg-background p-3 hover:border-primary/20 transition-all"
                                data-testid={`card-kr-${kr.id}`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    {/* KR title row */}
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <Badge variant="outline" className="font-bold text-[9px] uppercase bg-[#378ADD]/10 text-[#378ADD] border-[#378ADD]/20">
                                        KR
                                      </Badge>
                                      <p className="text-[13px] font-semibold text-foreground leading-snug">
                                        {kr.title}
                                      </p>
                                      <HealthBadge status={krHealth} />
                                      {kr.dueDate && (
                                        <Badge
                                          variant="outline"
                                          className={`text-[9px] uppercase font-bold ${deadlineStatusColors[deadlineStatus]}`}
                                        >
                                          <CalendarClock className="h-2.5 w-2.5 mr-1" />
                                          {deadlineStatusLabels[deadlineStatus]}
                                        </Badge>
                                      )}
                                    </div>

                                    {/* De X → Para Y [unit] */}
                                    <p className="text-[11px] text-muted-foreground mb-2">
                                      {formatKRRange(kr.startValue, kr.targetValue, kr.measurementType, kr.unit)}
                                    </p>

                                    {/* KR progress bar (blue) */}
                                    <div className="flex items-center gap-3 mb-1.5">
                                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                          className="h-full rounded-full transition-all duration-400"
                                          style={{ width: `${krProgress}%`, background: "#378ADD" }}
                                        />
                                      </div>
                                      <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: "#378ADD" }}>
                                        {krProgress}%
                                      </span>
                                    </div>

                                    {/* Subtitle + Responsável */}
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      {initiatives.length > 0 ? (
                                        <p className="text-[11px] text-muted-foreground">
                                          {completedCount} de {initiatives.length} iniciativa{initiatives.length !== 1 ? "s" : ""} concluída{initiatives.length !== 1 ? "s" : ""}
                                        </p>
                                      ) : (
                                        <p className="text-[11px] text-muted-foreground">
                                          {formatKRCurrentOverTarget(kr.currentValue, kr.targetValue, kr.measurementType, kr.unit)}
                                        </p>
                                      )}
                                      {ownerIds[0] && (
                                        <OwnerChip
                                          userId={ownerIds[0]}
                                          users={users}
                                          currentUserId={currentUserId}
                                        />
                                      )}
                                    </div>
                                  </div>

                                  {/* KR actions */}
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    {initiatives.length > 0 && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground"
                                        onClick={() => toggleKRCollapse(kr.id)}
                                      >
                                        {isKRCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                                      </Button>
                                    )}
                                    {!isClosed && initiatives.length === 0 && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                                        onClick={() => openUpdateDialog(kr)}
                                        data-testid={`button-update-kr-${kr.id}`}
                                      >
                                        <TrendingUp className="h-3 w-3 mr-1" />
                                        Check-in
                                      </Button>
                                    )}
                                    {!isClosed && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                        onClick={() => setEditingKR(kr)}
                                        data-testid={`btn-edit-kr-${kr.id}`}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                    )}
                                    {!isClosed && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                        onClick={() => setDeletingKRId(kr.id)}
                                        data-testid={`btn-delete-kr-${kr.id}`}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {/* Histórico inline colapsável */}
                                {initiatives.length === 0 && (
                                  <KRHistorySection
                                    krId={kr.id}
                                    unit={kr.unit}
                                    onViewAll={() => openUpdateDialog(kr)}
                                  />
                                )}
                              </div>

                              {/* ── Initiatives (indented 40px) ──────────── */}
                              {!isKRCollapsed && levelFilter !== "kr" && (
                                <div className="ml-10 mt-1 space-y-0.5">
                                  {initiatives.map((initiative) => {
                                    const owner = users.find((u) => u.id === initiative.ownerId);
                                    return (
                                      <div
                                        key={initiative.id}
                                        className="flex items-center gap-2 py-1.5 px-3 rounded-md hover:bg-muted/30 group"
                                        data-testid={`row-initiative-${initiative.id}`}
                                      >
                                        {!isClosed && (
                                          <button
                                            onClick={() =>
                                              toggleInitiativeMutation.mutate({
                                                id: initiative.id,
                                                completed: !initiative.completed,
                                              })
                                            }
                                            className="shrink-0 text-muted-foreground hover:text-[#378ADD] transition-colors"
                                          >
                                            {initiative.completed ? (
                                              <CheckSquare className="h-4 w-4 text-[#378ADD]" />
                                            ) : (
                                              <Square className="h-4 w-4" />
                                            )}
                                          </button>
                                        )}
                                        <p
                                          className={`flex-1 text-[13px] transition-all ${
                                            initiative.completed
                                              ? "line-through opacity-50"
                                              : "text-foreground"
                                          }`}
                                        >
                                          {initiative.title}
                                        </p>
                                        {owner && (
                                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                            {owner.id === currentUserId ? "Você" : owner.name}
                                          </span>
                                        )}
                                        {initiative.dueDate && (
                                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                            <Clock className="h-3 w-3 inline mr-0.5" />
                                            {format(new Date(initiative.dueDate), "dd/MM/yy", { locale: ptBR })}
                                          </span>
                                        )}
                                        <button
                                          onClick={() => setEditingInitiative(initiative)}
                                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                          data-testid={`btn-edit-initiative-${initiative.id}`}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </button>
                                      </div>
                                    );
                                  })}

                                  {/* + Adicionar iniciativa */}
                                  {!isClosed && (
                                    <button
                                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary py-1 px-3 rounded-md hover:bg-muted/20 transition-colors"
                                      onClick={() => openInlineInitiativeDialog(kr.id)}
                                      data-testid={`button-add-initiative-${kr.id}`}
                                    >
                                      <Plus className="h-3 w-3" />
                                      Adicionar iniciativa
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* + Adicionar KR */}
                      {!isClosed && (
                        <button
                          className="ml-5 mt-2 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary py-1 px-2 rounded-md hover:bg-muted/20 transition-colors"
                          onClick={() => openKRDialog(objective.id)}
                          data-testid={`button-add-kr-${objective.id}`}
                        >
                          <Plus className="h-3 w-3" />
                          Adicionar KR
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      <ObjectiveDialog
        open={isObjectiveDialogOpen}
        onOpenChange={setIsObjectiveDialogOpen}
        defaultCycle={cycleFilter}
      />
      <KeyResultDialog
        open={isGlobalKRDialogOpen}
        onOpenChange={setIsGlobalKRDialogOpen}
        defaultCycle={cycleFilter}
      />
      <KeyResultDialog
        open={isKRDialogOpen}
        onOpenChange={setIsKRDialogOpen}
        objectiveId={selectedObjectiveId || undefined}
        defaultCycle={cycleFilter}
      />
      <InitiativeDialog
        open={isInitiativeDialogOpen}
        onOpenChange={setIsInitiativeDialogOpen}
        defaultCycle={cycleFilter}
      />
      <InitiativeDialog
        open={isInlineInitiativeDialogOpen}
        onOpenChange={setIsInlineInitiativeDialogOpen}
        defaultCycle={cycleFilter}
        defaultKeyResultId={inlineInitiativeKRId ?? undefined}
      />
      <KeyResultUpdateDialog
        open={isUpdateDialogOpen}
        onOpenChange={setIsUpdateDialogOpen}
        keyResult={selectedKeyResult}
        cycle={cycleFilter}
      />
      {editingObjective && (
        <ObjectiveEditDialog
          open={!!editingObjective}
          onOpenChange={(open) => { if (!open) setEditingObjective(null); }}
          objective={editingObjective}
        />
      )}
      {editingKR && (
        <KeyResultEditDialog
          open={!!editingKR}
          onOpenChange={(open) => { if (!open) setEditingKR(null); }}
          keyResult={editingKR}
          hasInitiatives={(initiativesByKR.get(editingKR.id) ?? []).length > 0}
        />
      )}
      {editingInitiative && (
        <InitiativeEditDialog
          open={!!editingInitiative}
          onOpenChange={(open) => { if (!open) setEditingInitiative(null); }}
          initiative={editingInitiative}
          defaultCycle={cycleFilter}
        />
      )}

      {/* ── Retrospectiva dialog ────────────────────────────────────────────── */}
      {retroObjective && (
        <ObjectiveRetrospectiveDialog
          objective={retroObjective}
          keyResults={keyResults.filter((kr) => kr.objectiveId === retroObjective.id)}
          open={!!retroObjective}
          onClose={() => setRetroObjective(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/objectives"] });
          }}
          readOnly={retroReadOnly}
        />
      )}

      {/* ── Delete confirmations ─────────────────────────────────────────────── */}
      <AlertDialog open={!!deletingObjectiveId} onOpenChange={(open) => { if (!open) setDeletingObjectiveId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir objetivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O objetivo e todos os seus resultados-chave serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingObjectiveId) deleteObjectiveMutation.mutate(deletingObjectiveId);
                setDeletingObjectiveId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingKRId} onOpenChange={(open) => { if (!open) setDeletingKRId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir resultado-chave?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O resultado-chave será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingKRId) deleteKRMutation.mutate(deletingKRId);
                setDeletingKRId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
