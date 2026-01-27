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
            <h2 className="text-2xl font-bold">Objetivos e Resultados-Chave</h2>
            <p className="text-muted-foreground">
              Acompanhe o progresso dos objetivos da empresa
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={cycleFilter} onValueChange={setCycleFilter}>
              <SelectTrigger className="w-[130px]" data-testid="select-cycle-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {quarters.map((q) => (
                  <SelectItem key={q} value={q}>{q}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[130px]" data-testid="select-level-filter">
                <SelectValue placeholder="Nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="company">Empresa</SelectItem>
                <SelectItem value="team">Time</SelectItem>
                <SelectItem value="area">Área</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {objectivesLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : filteredObjectives.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">Nenhum OKR encontrado</h3>
              <p className="text-muted-foreground mt-1">
                {objectives.length === 0 
                  ? "Crie seu primeiro objetivo clicando no botão acima"
                  : "Tente ajustar os filtros"}
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
                  className="border rounded-lg"
                >
                  <Card className="border-0">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline">
                      <div className="flex items-start gap-4 flex-1 text-left">
                        <div className={`p-2 rounded-lg ${statusColors[objective.status]}`}>
                          <StatusIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{objective.title}</h3>
                            <Badge variant="outline" className={statusColors[objective.status]}>
                              {statusLabels[objective.status]}
                            </Badge>
                            <Badge variant="secondary">
                              {levelLabels[objective.level]}
                            </Badge>
                          </div>
                          {objective.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {objective.description}
                            </p>
                          )}
                          <div className="mt-3 flex items-center gap-3">
                            <Progress value={progress} className="flex-1 h-2" />
                            <span className="text-sm font-medium">{progress}%</span>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="px-6 pb-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Resultados-Chave ({krs.length})</h4>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openKRDialog(objective.id)}
                            data-testid={`button-add-kr-${objective.id}`}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Adicionar KR
                          </Button>
                        </div>
                        
                        {krs.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum resultado-chave cadastrado
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {krs.map((kr) => {
                              const krProgress = Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100));
                              return (
                                <Card key={kr.id} className="p-3" data-testid={`card-kr-${kr.id}`}>
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{kr.title}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Progress value={krProgress} className="flex-1 h-1.5" />
                                        <span className="text-xs text-muted-foreground">
                                          {kr.currentValue}/{kr.targetValue} {kr.unit || ""}
                                        </span>
                                      </div>
                                    </div>
                                    <span className="text-sm font-semibold">{krProgress}%</span>
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
