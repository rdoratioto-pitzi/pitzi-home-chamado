import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Users,
  RefreshCw,
  CalendarClock,
  MoreHorizontal,
  Pencil,
  Trash2,
  Network,
  LayoutGrid,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Objective, KeyResult, User } from "@shared/schema";
import { ObjectiveDialog } from "./objective-dialog";
import { ObjectiveEditDialog } from "./objective-edit-dialog";
import { KeyResultDialog } from "./key-result-dialog";
import { KeyResultEditDialog } from "./key-result-edit-dialog";
import { KeyResultUpdateDialog } from "./key-result-update-dialog";
import { OkrHierarchyView } from "@/components/okrs/OkrHierarchyView";
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

const measurementTypeLabels: Record<string, string> = {
  percentage: "%",
  absolute: "Absoluto",
  monetary: "R$",
  temporal: "Temporal",
  binary: "Sim/Não",
  decreasing: "Decrescente",
};

const levelLabels: Record<string, string> = {
  company: "Empresa",
  team: "Time",
  area: "Área",
};

function getInitialQuarter(): string {
  const saved = localStorage.getItem(LS_QUARTER_KEY);
  return saved || getCurrentQuarter();
}

export default function OKRsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isObjectiveDialogOpen, setIsObjectiveDialogOpen] = useState(false);
  const [isKRDialogOpen, setIsKRDialogOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);

  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [editingKR, setEditingKR] = useState<KeyResult | null>(null);
  const [deletingObjectiveId, setDeletingObjectiveId] = useState<string | null>(null);
  const [deletingKRId, setDeletingKRId] = useState<string | null>(null);

  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [selectedKeyResult, setSelectedKeyResult] = useState<KeyResult | null>(null);
  const [cycleFilter, setCycleFilter] = useState<string>(getInitialQuarter);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "hierarchy">("list");

  const quarters = getQuarterOptions();

  useEffect(() => {
    localStorage.setItem(LS_QUARTER_KEY, cycleFilter);
  }, [cycleFilter]);

  const { data: objectives = [], isLoading: objectivesLoading } = useQuery<Objective[]>({
    queryKey: ["/api/objectives"],
  });

  const { data: keyResults = [] } = useQuery<KeyResult[]>({
    queryKey: ["/api/key-results"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

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

  const filteredObjectives = objectives.filter((obj) => {
    const matchesCycle = obj.cycle === cycleFilter;
    const matchesLevel = levelFilter === "all" || obj.level === levelFilter;
    return matchesCycle && matchesLevel;
  });

  const getProgress = (objectiveId: string): number => {
    const krs = keyResults.filter((kr) => kr.objectiveId === objectiveId);
    if (krs.length === 0) return 0;
    const totalProgress = krs.reduce((sum, kr) => {
      const startVal = parseFloat(kr.startValue || "0");
      const targetVal = parseFloat(kr.targetValue || "100");
      const currentVal = parseFloat(kr.currentValue || "0");
      let progress: number;
      if (kr.measurementType === "decreasing") {
        progress = targetVal !== startVal ? ((startVal - currentVal) / (startVal - targetVal)) * 100 : 0;
      } else if (kr.measurementType === "binary") {
        progress = currentVal > 0 ? 100 : 0;
      } else {
        progress = targetVal !== startVal ? ((currentVal - startVal) / (targetVal - startVal)) * 100 : 0;
      }
      return sum + Math.min(100, Math.max(0, progress));
    }, 0);
    return Math.round(totalProgress / krs.length);
  };

  const openKRDialog = (objectiveId: string) => {
    setSelectedObjectiveId(objectiveId);
    setIsKRDialogOpen(true);
  };

  const openUpdateDialog = (kr: KeyResult) => {
    setSelectedKeyResult(kr);
    setIsUpdateDialogOpen(true);
  };

  const parseResponsibleIds = (raw: string | null): string[] => {
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  };

  const getOwnerNames = (ownerIds: string[]): string[] => {
    return ownerIds
      .map((id) => users.find((u) => u.id === id)?.name)
      .filter((name): name is string => !!name);
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="OKRs"
        breadcrumbs={[{ label: "OKRs" }]}
        actions={
          <Button onClick={() => setIsObjectiveDialogOpen(true)} data-testid="button-new-objective">
            <Plus className="h-4 w-4 mr-2" />
            Novo Objetivo
          </Button>
        }
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight">Objetivos e Resultados-Chave</h2>
            <p className="text-[14px] text-muted-foreground mt-1">
              Acompanhe o progresso dos objetivos da empresa
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Card className="shadow-sm border-border/60 p-1 flex gap-2">
              <Select
                value={cycleFilter}
                onValueChange={setCycleFilter}
              >
                <SelectTrigger className="w-[140px] border-0 h-9 bg-transparent" data-testid="select-cycle-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {quarters.map((q) => (
                    <SelectItem key={q} value={q}>{q}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="w-px h-4 bg-border/60 self-center" />
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-[140px] border-0 h-9 bg-transparent" data-testid="select-level-filter">
                  <SelectValue placeholder="Nível" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Níveis</SelectItem>
                  <SelectItem value="company">Empresa</SelectItem>
                  <SelectItem value="team">Time</SelectItem>
                  <SelectItem value="area">Área</SelectItem>
                </SelectContent>
              </Select>
            </Card>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === "hierarchy" ? "default" : "outline"}
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setViewMode((m) => (m === "list" ? "hierarchy" : "list"))}
                  data-testid="button-toggle-hierarchy"
                >
                  {viewMode === "hierarchy" ? (
                    <LayoutGrid className="h-4 w-4" />
                  ) : (
                    <Network className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {viewMode === "hierarchy" ? "Bullets" : "Organograma"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {viewMode === "hierarchy" ? (
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
            />
          )
        ) : objectivesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredObjectives.map((objective) => {
              const progress = getProgress(objective.id);
              const krs = keyResults.filter((kr) => kr.objectiveId === objective.id);
              const StatusIcon = statusIcons[objective.status];

              return (
                <Card
                  key={objective.id}
                  className="shadow-sm border-border/60 overflow-hidden hover:border-primary/20 transition-all duration-200"
                >
                  {/* Card header */}
                  <div className="px-5 pt-5 pb-4">
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${statusColors[objective.status]}`}>
                        <StatusIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[15px] font-bold text-foreground leading-tight">
                            {objective.title}
                          </h3>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                                data-testid={`btn-menu-objective-${objective.id}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditingObjective(objective)}>
                                <Pencil className="h-3.5 w-3.5 mr-2" />
                                Editar
                              </DropdownMenuItem>
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
                        <div className="flex items-center gap-2 flex-wrap mt-1.5">
                          <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wider ${statusColors[objective.status]}`}>
                            {statusLabels[objective.status]}
                          </Badge>
                          <Badge variant="secondary" className="font-bold text-[10px] uppercase tracking-wider bg-muted/50">
                            {levelLabels[objective.level]}
                          </Badge>
                          <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-wider">
                            {objective.cycle}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-full transition-all duration-500 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-[13px] font-bold text-primary min-w-[35px] text-right">{progress}%</span>
                    </div>
                  </div>

                  {/* KRs section */}
                  <div className="px-5 pb-5 border-t border-border/40 pt-3 bg-muted/5">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                        Resultados-Chave ({krs.length})
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px] text-primary font-bold hover:bg-primary/10"
                        onClick={() => openKRDialog(objective.id)}
                        data-testid={`button-add-kr-${objective.id}`}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Novo KR
                      </Button>
                    </div>

                    {krs.length === 0 ? (
                      <div className="text-center py-5 rounded-lg border border-dashed border-border/60">
                        <p className="text-[12px] text-muted-foreground">Nenhum resultado-chave cadastrado.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {krs.map((kr) => {
                          const startVal = parseFloat(kr.startValue || "0");
                          const targetVal = parseFloat(kr.targetValue || "100");
                          const currentVal = parseFloat(kr.currentValue || "0");
                          let krProgress: number;

                          if (kr.measurementType === "decreasing") {
                            krProgress = targetVal !== startVal ? ((startVal - currentVal) / (startVal - targetVal)) * 100 : 0;
                          } else if (kr.measurementType === "binary") {
                            krProgress = currentVal > 0 ? 100 : 0;
                          } else {
                            krProgress = targetVal !== startVal ? ((currentVal - startVal) / (targetVal - startVal)) * 100 : 0;
                          }
                          krProgress = Math.min(100, Math.max(0, Math.round(krProgress)));

                          const ownerNames = getOwnerNames(parseResponsibleIds(kr.responsibleIds));
                          const deadlineStatus = kr.deadlineStatus || "on_track";

                          return (
                            <div
                              key={kr.id}
                              className="group relative rounded-lg border border-border/40 bg-background p-3 hover:border-primary/20 transition-all"
                              data-testid={`card-kr-${kr.id}`}
                            >
                              {/* KR action buttons — visible on hover */}
                              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                  onClick={(e) => { e.stopPropagation(); setEditingKR(kr); }}
                                  data-testid={`btn-edit-kr-${kr.id}`}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={(e) => { e.stopPropagation(); setDeletingKRId(kr.id); }}
                                  data-testid={`btn-delete-kr-${kr.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>

                              <div className="flex items-start gap-3 pr-14">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                    <p className="text-[13px] font-semibold text-foreground leading-snug">{kr.title}</p>
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

                                  <div className="flex items-center gap-3 mb-1.5">
                                    <div className="flex-1 bg-muted rounded-full h-1.5">
                                      <div className="bg-primary h-full rounded-full" style={{ width: `${krProgress}%` }} />
                                    </div>
                                    <span className="text-[11px] font-bold text-primary whitespace-nowrap">
                                      {krProgress}%
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                    <span className="font-medium">{currentVal} / {targetVal} {kr.unit || ""}</span>
                                    {ownerNames.length > 0 && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center gap-1">
                                            <Users className="h-3 w-3" />
                                            <span>{ownerNames.length} resp.</span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>{ownerNames.join(", ")}</TooltipContent>
                                      </Tooltip>
                                    )}
                                    {kr.dueDate && (
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        <span>{format(new Date(kr.dueDate), "dd/MM/yyyy", { locale: ptBR })}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px] shrink-0 mt-0.5"
                                  onClick={() => openUpdateDialog(kr)}
                                  data-testid={`button-update-kr-${kr.id}`}
                                >
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  Check-in
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Create dialogs */}
      <ObjectiveDialog
        open={isObjectiveDialogOpen}
        onOpenChange={setIsObjectiveDialogOpen}
        defaultCycle={cycleFilter}
      />
      <KeyResultDialog
        open={isKRDialogOpen}
        onOpenChange={setIsKRDialogOpen}
        objectiveId={selectedObjectiveId || ""}
      />
      <KeyResultUpdateDialog
        open={isUpdateDialogOpen}
        onOpenChange={setIsUpdateDialogOpen}
        keyResult={selectedKeyResult}
      />

      {/* Edit dialogs */}
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
        />
      )}

      {/* Delete confirmations */}
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
