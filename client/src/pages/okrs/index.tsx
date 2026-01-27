import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Target, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Objective, KeyResult } from "@shared/schema";
import { ObjectiveDialog } from "./objective-dialog";
import { KeyResultDialog } from "./key-result-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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

const statusIcons: Record<string, any> = {
  on_track: CheckCircle2,
  at_risk: AlertTriangle,
  off_track: TrendingUp,
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
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [cycleFilter, setCycleFilter] = useState(`${currentYear} Q${currentQuarter}`);
  const [levelFilter, setLevelFilter] = useState<string>("all");

  const { data: objectives = [], isLoading: objectivesLoading } = useQuery<Objective[]>({
    queryKey: ["/api/objectives"],
  });

  const { data: keyResults = [] } = useQuery<KeyResult[]>({
    queryKey: ["/api/key-results"],
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
      const progress = Math.min(100, (kr.currentValue / kr.targetValue) * 100);
      return sum + progress;
    }, 0);
    return Math.round(totalProgress / krs.length);
  };

  const openKRDialog = (objectiveId: string) => {
    setSelectedObjectiveId(objectiveId);
    setIsKRDialogOpen(true);
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
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {krs.map((kr) => {
                              const krProgress = Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100));
                              return (
                                <Card key={kr.id} className="p-4 shadow-none border-border/40 bg-background" data-testid={`card-kr-${kr.id}`}>
                                  <div className="flex items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[14px] font-bold text-foreground leading-snug truncate">{kr.title}</p>
                                      <div className="flex items-center justify-between mt-2.5">
                                        <div className="flex-1 bg-muted rounded-full h-1.5 mr-3">
                                          <div className="bg-primary h-full rounded-full" style={{ width: `${krProgress}%` }} />
                                        </div>
                                        <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">
                                          {kr.currentValue} / {kr.targetValue} {kr.unit || ""}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="h-10 w-10 shrink-0 rounded-full border-2 border-primary/20 flex items-center justify-center">
                                      <span className="text-[12px] font-bold text-primary">{krProgress}%</span>
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
    </div>
  );
}
