import { useState } from "react";
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
import { Plus, Target, TrendingUp, AlertTriangle, CheckCircle2, Clock, Users, RefreshCw, CalendarClock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Objective, KeyResult, User } from "@shared/schema";
import { ObjectiveDialog } from "./objective-dialog";
import { KeyResultDialog } from "./key-result-dialog";
import { KeyResultUpdateDialog } from "./key-result-update-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

export default function OKRsPage() {
  const [isObjectiveDialogOpen, setIsObjectiveDialogOpen] = useState(false);
  const [isKRDialogOpen, setIsKRDialogOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [selectedKeyResult, setSelectedKeyResult] = useState<KeyResult | null>(null);
  const [cycleFilter, setCycleFilter] = useState(`${currentYear} Q${currentQuarter}`);
  const [levelFilter, setLevelFilter] = useState<string>("all");

  const { data: objectives = [], isLoading: objectivesLoading } = useQuery<Objective[]>({
    queryKey: ["/api/objectives"],
  });

  const { data: keyResults = [] } = useQuery<KeyResult[]>({
    queryKey: ["/api/key-results"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const filteredObjectives = objectives.filter((obj) => {
    const matchesCycle = obj.cycle === cycleFilter;
    const matchesLevel = levelFilter === "all" || obj.level === levelFilter;
    return matchesCycle && matchesLevel;
  });

  const getProgress = (objectiveId: string): number => {
    const krs = keyResults.filter(kr => kr.objectiveId === objectiveId);
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

  const getOwnerNames = (ownerIds: string[] | null): string[] => {
    if (!ownerIds) return [];
    return ownerIds
      .map(id => users.find(u => u.id === id)?.name)
      .filter((name): name is string => !!name);
  };

  const quarters = [
    `${currentYear} Q1`,
    `${currentYear} Q2`,
    `${currentYear} Q3`,
    `${currentYear} Q4`,
  ];

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
            <h2 className="text-[20px] font-bold tracking-tight">Objetivos e Resultados-Chave</h2>
            <p className="text-[14px] text-muted-foreground mt-1">
              Acompanhe o progresso dos objetivos da empresa
            </p>
          </div>
          <Card className="shadow-sm border-border/60 p-1 flex gap-2">
            <Select value={cycleFilter} onValueChange={setCycleFilter}>
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
        </div>

        {objectivesLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
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
          <Accordion type="multiple" className="space-y-4" defaultValue={filteredObjectives.map(o => o.id)}>
            {filteredObjectives.map((objective) => {
              const progress = getProgress(objective.id);
              const krs = keyResults.filter(kr => kr.objectiveId === objective.id);
              const StatusIcon = statusIcons[objective.status];

              return (
                <AccordionItem 
                  key={objective.id} 
                  value={objective.id}
                  className="border-0"
                >
                  <Card className="shadow-sm border-border/60 overflow-hidden hover:border-primary/20 transition-all duration-200">
                    <AccordionTrigger className="px-6 py-5 hover:no-underline">
                      <div className="flex items-start gap-5 flex-1 text-left">
                        <div className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center ${statusColors[objective.status]}`}>
                          <StatusIcon className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-[16px] font-bold text-foreground leading-tight truncate">{objective.title}</h3>
                            <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wider ${statusColors[objective.status]}`}>
                              {statusLabels[objective.status]}
                            </Badge>
                            <Badge variant="secondary" className="font-bold text-[10px] uppercase tracking-wider bg-muted/50">
                              {levelLabels[objective.level]}
                            </Badge>
                          </div>
                          {objective.description && (
                            <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed line-clamp-1">
                              {objective.description}
                            </p>
                          )}
                          <div className="mt-4 flex items-center gap-4">
                            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-primary h-full transition-all duration-500 rounded-full" 
                                style={{ width: `${progress}%` }} 
                              />
                            </div>
                            <span className="text-[13px] font-bold text-primary min-w-[35px]">{progress}%</span>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="px-6 pb-6 pt-2 space-y-4 border-t border-border/40 bg-muted/5">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">Resultados-Chave ({krs.length})</h4>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 px-3 text-primary font-bold hover:bg-primary/10"
                            onClick={() => openKRDialog(objective.id)}
                            data-testid={`button-add-kr-${objective.id}`}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Novo KR
                          </Button>
                        </div>
                        
                        {krs.length === 0 ? (
                          <div className="text-center py-8 rounded-lg border border-dashed border-border/60">
                            <p className="text-[13px] text-muted-foreground">Nenhum resultado-chave cadastrado para este objetivo.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3">
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

                              const ownerNames = getOwnerNames(kr.ownerIds);
                              const deadlineStatus = kr.deadlineStatus || "on_track";

                              return (
                                <Card 
                                  key={kr.id} 
                                  className="p-4 shadow-none border-border/40 bg-background hover-elevate cursor-pointer" 
                                  data-testid={`card-kr-${kr.id}`}
                                  onClick={() => openUpdateDialog(kr)}
                                >
                                  <div className="flex items-start gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap mb-2">
                                        <p className="text-[14px] font-bold text-foreground leading-snug">{kr.title}</p>
                                        {kr.measurementType && (
                                          <Badge variant="secondary" className="text-[9px] uppercase font-bold">
                                            {measurementTypeLabels[kr.measurementType] || kr.measurementType}
                                          </Badge>
                                        )}
                                        {kr.dueDate && (
                                          <Badge 
                                            variant="outline" 
                                            className={`text-[9px] uppercase font-bold ${deadlineStatusColors[deadlineStatus]}`}
                                          >
                                            <CalendarClock className="h-3 w-3 mr-1" />
                                            {deadlineStatusLabels[deadlineStatus]}
                                          </Badge>
                                        )}
                                      </div>
                                      
                                      <div className="flex items-center gap-4 mb-2">
                                        <div className="flex-1 bg-muted rounded-full h-1.5">
                                          <div className="bg-primary h-full rounded-full" style={{ width: `${krProgress}%` }} />
                                        </div>
                                        <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">
                                          {currentVal} / {targetVal} {kr.unit || ""}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                                        {ownerNames.length > 0 && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div className="flex items-center gap-1">
                                                <Users className="h-3 w-3" />
                                                <span>{ownerNames.length} responsável{ownerNames.length !== 1 ? 'is' : ''}</span>
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              {ownerNames.join(", ")}
                                            </TooltipContent>
                                          </Tooltip>
                                        )}
                                        {kr.dueDate && (
                                          <div className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            <span>
                                              {format(new Date(kr.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="flex flex-col items-center gap-2">
                                      <div className="h-12 w-12 shrink-0 rounded-full border-2 border-primary/20 flex items-center justify-center">
                                        <span className="text-[13px] font-bold text-primary">{krProgress}%</span>
                                      </div>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 px-2 text-[10px]"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openUpdateDialog(kr);
                                        }}
                                        data-testid={`button-update-kr-${kr.id}`}
                                      >
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                        Check-in
                                      </Button>
                                    </div>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </main>

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
    </div>
  );
}
