import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Users,
  Clock,
  Target,
  GitFork,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Objective, KeyResult, User } from "@shared/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

type OkrNode = Objective & { children: OkrNode[] };

interface OkrHierarchyViewProps {
  objectives: Objective[];
  keyResults: KeyResult[];
  users: User[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const levelLabels: Record<string, string> = {
  company: "Empresa",
  area: "Área",
  team: "Time",
};

const levelBorderColors: Record<string, string> = {
  company: "border-l-[3px] border-l-[#00A137]",
  area: "border-l-[3px] border-l-blue-500",
  team: "border-l-[3px] border-l-muted-foreground/60",
};

const levelBadgeColors: Record<string, string> = {
  company: "bg-[#00A137]/10 text-[#00A137] border-[#00A137]/30",
  area: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  team: "bg-muted/50 text-muted-foreground border-border/60",
};

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildTree(flatList: Objective[]): OkrNode[] {
  const map = new Map<string, OkrNode>();
  const roots: OkrNode[] = [];

  for (const obj of flatList) {
    map.set(obj.id, { ...obj, children: [] });
  }

  for (const node of map.values()) {
    if (node.parentOkrId && map.has(node.parentOkrId)) {
      map.get(node.parentOkrId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function calcProgress(objectiveId: string, keyResults: KeyResult[]): number {
  const krs = keyResults.filter((kr) => kr.objectiveId === objectiveId);
  if (krs.length === 0) return 0;
  const total = krs.reduce((sum, kr) => {
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
    return sum + Math.min(100, Math.max(0, p));
  }, 0);
  return Math.round(total / krs.length);
}

function parseOwners(raw: string | null, users: User[]): string[] {
  if (!raw) return [];
  try {
    const ids: string[] = JSON.parse(raw);
    return ids.map((id) => users.find((u) => u.id === id)?.name).filter((n): n is string => !!n);
  } catch {
    return [];
  }
}

// ─── OkrNodeCard ─────────────────────────────────────────────────────────────

interface OkrNodeCardProps {
  node: OkrNode;
  keyResults: KeyResult[];
  users: User[];
  depth: number;
}

function OkrNodeCard({ node, keyResults, users, depth }: OkrNodeCardProps) {
  const [expanded, setExpanded] = useState(true);
  const progress = calcProgress(node.id, keyResults);
  const nodeKrs = keyResults.filter((kr) => kr.objectiveId === node.id);
  const StatusIcon = statusIcons[node.status] ?? CheckCircle2;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      {/* Card */}
      <Card
        className={`shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md ${
          levelBorderColors[node.level] ?? ""
        }`}
      >
        <CardContent className="p-0">
          {/* Header */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-start gap-3">
              {/* Status icon */}
              <div
                className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${
                  statusColors[node.status]
                }`}
              >
                <StatusIcon className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[14px] font-bold text-foreground leading-tight">
                    {node.title}
                  </h3>
                  {hasChildren && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground -mt-0.5"
                      onClick={() => setExpanded((v) => !v)}
                      aria-label={expanded ? "Recolher filhos" : "Expandir filhos"}
                    >
                      {expanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  <Badge
                    variant="outline"
                    className={`font-bold text-[9px] uppercase tracking-wider ${
                      levelBadgeColors[node.level]
                    }`}
                  >
                    {levelLabels[node.level]}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`font-bold text-[9px] uppercase tracking-wider ${
                      statusColors[node.status]
                    }`}
                  >
                    {statusLabels[node.status]}
                  </Badge>
                  {hasChildren && (
                    <Badge variant="secondary" className="font-bold text-[9px] bg-muted/40">
                      <GitFork className="h-2.5 w-2.5 mr-1" />
                      {node.children.length} derivado{node.children.length !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: "#00A137",
                  }}
                />
              </div>
              <span className="text-[12px] font-bold min-w-[34px] text-right" style={{ color: "#00A137" }}>
                {progress}%
              </span>
            </div>
          </div>

          {/* KRs section */}
          {nodeKrs.length > 0 && (
            <div className="px-4 pb-4 pt-2 border-t border-border/40 bg-muted/5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                Resultados-Chave ({nodeKrs.length})
              </p>
              <div className="space-y-2">
                {nodeKrs.map((kr) => {
                  const start = parseFloat(kr.startValue || "0");
                  const target = parseFloat(kr.targetValue || "100");
                  const current = parseFloat(kr.currentValue || "0");
                  let krProgress: number;
                  if (kr.measurementType === "decreasing") {
                    krProgress = target !== start ? ((start - current) / (start - target)) * 100 : 0;
                  } else if (kr.measurementType === "binary") {
                    krProgress = current > 0 ? 100 : 0;
                  } else {
                    krProgress = target !== start ? ((current - start) / (target - start)) * 100 : 0;
                  }
                  krProgress = Math.min(100, Math.max(0, Math.round(krProgress)));

                  const ownerNames = parseOwners(kr.responsibleIds, users);

                  return (
                    <div
                      key={kr.id}
                      className="flex items-start gap-2 py-1.5 px-2 rounded-md bg-background border border-border/40"
                    >
                      <div className="mt-1 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: "#00A137" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground leading-snug mb-1">
                          {kr.title}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-1">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${krProgress}%`, backgroundColor: "#00A137" }}
                            />
                          </div>
                          <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: "#00A137" }}>
                            {krProgress}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                          <span>{current} / {target} {kr.unit || ""}</span>
                          {ownerNames.length > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-0.5 cursor-default">
                                  <Users className="h-2.5 w-2.5" />
                                  <span>{ownerNames.length}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>{ownerNames.join(", ")}</TooltipContent>
                            </Tooltip>
                          )}
                          {kr.dueDate && (
                            <div className="flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              <span>{format(new Date(kr.dueDate), "dd/MM/yy", { locale: ptBR })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Children (recursive) */}
      {hasChildren && expanded && (
        <div className="ml-5 mt-2 pl-4 border-l-2 border-border/40 space-y-3">
          {node.children.map((child) => (
            <OkrNodeCard
              key={child.id}
              node={child}
              keyResults={keyResults}
              users={users}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── OkrHierarchyView (main export) ──────────────────────────────────────────

export function OkrHierarchyView({ objectives, keyResults, users }: OkrHierarchyViewProps) {
  const tree = useMemo(() => buildTree(objectives), [objectives]);

  if (tree.length === 0) {
    return (
      <Card className="shadow-sm border-border/60 text-center py-16">
        <CardContent>
          <div className="h-16 w-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Target className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-[18px] font-bold">Nenhum OKR encontrado</h3>
          <p className="text-[14px] text-muted-foreground mt-2 max-w-xs mx-auto">
            Ajuste os filtros ou crie um novo objetivo para visualizar a hierarquia.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {tree.map((root) => (
        <OkrNodeCard
          key={root.id}
          node={root}
          keyResults={keyResults}
          users={users}
          depth={0}
        />
      ))}
    </div>
  );
}
