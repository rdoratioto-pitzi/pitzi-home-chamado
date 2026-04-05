import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronUp, ChevronRight, Target, Square, CheckSquare, Clock, MoreHorizontal, Flag, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatKRRange } from "@/lib/kr-format";
import { useAuth } from "@/contexts/auth-context";
import type { Objective, KeyResult, User, Initiative } from "@shared/schema";
import { calculateHealthStatus, calculateObjectiveHealth } from "@/lib/okr-health";
import { HealthBadge } from "@/components/okrs/HealthBadge";

// ─── OwnerChip (organogram variant) ──────────────────────────────────────────
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
    <div className="flex items-center gap-1 min-w-0">
      <div className="h-5 w-5 shrink-0 rounded-full bg-muted/60 flex items-center justify-center text-[8px] font-semibold text-muted-foreground">
        {initials}
      </div>
      <span className="text-[10px] text-muted-foreground truncate">{label}</span>
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type OkrNode = Objective & { children: OkrNode[] };

export interface OkrHierarchyViewProps {
  objectives: Objective[];
  keyResults: KeyResult[];
  users: User[];
  initiativesByKR?: Map<string, Initiative[]>;
  onToggleInitiative?: (id: string, completed: boolean) => void;
  onRetroObjective?: (obj: Objective, readOnly: boolean) => void;
}

interface OrgChartNodeProps {
  node: OkrNode;
  keyResults: KeyResult[];
  users: User[];
  initiativesByKR: Map<string, Initiative[]>;
  onToggleInitiative: (id: string, completed: boolean) => void;
  currentUserId: string | undefined;
  onRetroObjective?: (obj: Objective, readOnly: boolean) => void;
}

interface OrgChartCardProps {
  node: OkrNode;
  keyResults: KeyResult[];
  users: User[];
  initiativesByKR: Map<string, Initiative[]>;
  onToggleInitiative: (id: string, completed: boolean) => void;
  expanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  currentUserId: string | undefined;
  onRetroObjective?: (obj: Objective, readOnly: boolean) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CARD_WIDTH = 300;
const CHILD_GAP = 24;
const CONNECTOR_H = 30;

const levelBorderLeft: Record<string, string> = {
  company: "border-l-[3px] border-l-[#00E676]",
  area: "border-l-[3px] border-l-[#378ADD]",
  team: "border-l-[3px] border-l-[#7F77DD]",
};

const levelBadgeStyle: Record<string, { label: string; cls: string }> = {
  company: { label: "Empresa",  cls: "bg-[#00E676]/10 text-[#00E676] border-[#00E676]/20" },
  area:    { label: "Área",     cls: "bg-[#378ADD]/10 text-[#378ADD] border-[#378ADD]/20" },
  team:    { label: "Time",     cls: "bg-[#7F77DD]/10 text-[#7F77DD] border-[#7F77DD]/20" },
};

const levelProgressColor: Record<string, string> = {
  company: "#00E676",
  area: "#378ADD",
  team: "#7F77DD",
};

const statusBadgeStyle: Record<string, { label: string; cls: string }> = {
  on_track:  { label: "NO CAMINHO", cls: "bg-green-500/10 text-green-500 border-green-500/20" },
  at_risk:   { label: "EM RISCO",   cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  off_track: { label: "ATRASADO",   cls: "bg-red-500/10 text-red-500 border-red-500/20" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildTree(flatList: Objective[]): OkrNode[] {
  const map = new Map<string, OkrNode>();
  const roots: OkrNode[] = [];
  for (const obj of flatList) map.set(obj.id, { ...obj, children: [] });
  for (const node of map.values()) {
    if (node.parentOkrId && map.has(node.parentOkrId)) {
      map.get(node.parentOkrId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

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

function calcSubtreeWidth(node: OkrNode): number {
  if (!node.children.length) return CARD_WIDTH;
  return node.children.reduce(
    (sum, child, i) => sum + calcSubtreeWidth(child) + (i > 0 ? CHILD_GAP : 0),
    0,
  );
}

// ─── OrgChartCard ─────────────────────────────────────────────────────────────

function OrgChartCard({
  node,
  keyResults,
  users,
  initiativesByKR,
  onToggleInitiative,
  expanded,
  hasChildren,
  onToggle,
  currentUserId,
  onRetroObjective,
}: OrgChartCardProps) {
  const [krsExpanded, setKrsExpanded] = useState(true);
  const [expandedKRs, setExpandedKRs] = useState<Set<string>>(new Set());

  const isClosed = node.closedAt != null;
  const progress = calcObjectiveProgress(node.id, keyResults, initiativesByKR);
  const nodeKRs = keyResults.filter((kr) => kr.objectiveId === node.id);
  const levelInfo = levelBadgeStyle[node.level] ?? levelBadgeStyle.company;
  const statusInfo = statusBadgeStyle[node.status] ?? statusBadgeStyle.on_track;
  const borderCls = isClosed ? "border-l-[3px] border-l-border" : (levelBorderLeft[node.level] ?? "");
  const progressColor = isClosed ? "var(--border)" : (levelProgressColor[node.level] ?? "#00E676");
  const objHealth = calculateObjectiveHealth(
    nodeKRs.map((kr) =>
      calculateHealthStatus(
        calcKRProgress(kr, initiativesByKR.get(kr.id) ?? []),
        node.cycle,
      )
    )
  );

  const toggleKR = (id: string) =>
    setExpandedKRs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <Card
      className={`overflow-hidden ${borderCls} border-[0.5px] border-border/40 ${isClosed ? "opacity-70" : ""}`}
      style={{ width: CARD_WIDTH, minWidth: CARD_WIDTH }}
    >
      <CardContent className="p-0">
        <div className="px-4 pt-3 pb-3">
          {/* Level badge + menu ⋯ */}
          <div className="flex items-start justify-between gap-1 mb-2">
            <Badge
              variant="outline"
              className={`text-[10px] px-[7px] py-[2px] font-semibold ${levelInfo.cls}`}
            >
              {levelInfo.label}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-foreground -mt-0.5 -mr-1 shrink-0"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isClosed ? (
                  <DropdownMenuItem onClick={() => onRetroObjective?.(node, true)}>
                    <Eye className="h-3.5 w-3.5 mr-2" /> Ver retrospectiva
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onRetroObjective?.(node, false)}>
                    <Flag className="h-3.5 w-3.5 mr-2" /> Encerrar Quarter
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Title */}
          <p className={`text-[13px] font-medium leading-snug line-clamp-2 mt-1 mb-2 ${isClosed ? "text-muted-foreground" : "text-foreground"}`}>
            {node.title}
          </p>

          {/* Responsável */}
          {node.ownerId && (
            <div className="mb-2">
              <OwnerChip userId={node.ownerId} users={users} currentUserId={currentUserId} />
            </div>
          )}

          {/* Status badge (manual) + HealthBadge automático */}
          <div className="flex items-center gap-1 flex-wrap">
            {isClosed ? (
              <Badge variant="outline" className="text-[10px] px-[7px] py-[2px] font-semibold bg-muted/40 text-muted-foreground border-border/60">
                ENCERRADO
              </Badge>
            ) : (
              <>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-[7px] py-[2px] font-semibold ${statusInfo.cls}`}
                >
                  {statusInfo.label}
                </Badge>
                {objHealth !== node.status && (
                  <HealthBadge status={objHealth} secondary />
                )}
              </>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="h-[4px] w-full bg-border/40 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-400"
                style={{ width: `${progress}%`, background: progressColor }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground text-right mt-1">{progress}%</p>
          </div>

          {/* KRs inline (toggleable) */}
          {nodeKRs.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setKrsExpanded((v) => !v)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {krsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {nodeKRs.length} key result{nodeKRs.length !== 1 ? "s" : ""}
              </button>

              {krsExpanded && (
                <div className="mt-2 space-y-2">
                  {nodeKRs.map((kr) => {
                    const initiatives = initiativesByKR.get(kr.id) ?? [];
                    const krProgress = calcKRProgress(kr, initiatives);
                    const isKRExpanded = expandedKRs.has(kr.id);
                    const completedCount = initiatives.filter((i) => i.completed).length;
                    const krHealth = calculateHealthStatus(krProgress, node.cycle);
                    const krOwnerId = (() => {
                      try {
                        const ids = JSON.parse(kr.responsibleIds ?? "[]");
                        return Array.isArray(ids) && ids.length > 0 ? (ids[0] as string) : null;
                      } catch {
                        return null;
                      }
                    })();

                    return (
                      <div
                        key={kr.id}
                        className="rounded-md border border-border/40 border-l-[2px] border-l-[#378ADD] bg-muted/10 px-2.5 py-2"
                      >
                        {/* KR header */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <p className="text-[11px] font-semibold leading-snug line-clamp-2">
                              {kr.title}
                            </p>
                            <HealthBadge status={krHealth} />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatKRRange(kr.startValue, kr.targetValue, kr.measurementType, kr.unit)}
                          </p>
                          {/* KR progress */}
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-[3px] bg-border/40 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-400"
                                style={{ width: `${krProgress}%`, background: "#378ADD" }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-[#378ADD]">{krProgress}%</span>
                          </div>
                          {krOwnerId && (
                            <div className="mt-1">
                              <OwnerChip
                                userId={krOwnerId}
                                users={users}
                                currentUserId={currentUserId}
                              />
                            </div>
                          )}
                        </div>

                        {/* Initiatives toggle — full-width clickable row */}
                        {initiatives.length > 0 && (
                          <button
                            onClick={() => toggleKR(kr.id)}
                            className="mt-1.5 w-full flex items-center gap-1 text-[10px] font-medium text-[#378ADD] hover:text-[#378ADD]/80 transition-colors"
                            data-testid={`btn-toggle-initiatives-${kr.id}`}
                          >
                            {isKRExpanded
                              ? <ChevronDown className="h-3 w-3" />
                              : <ChevronRight className="h-3 w-3" />}
                            <span>
                              {completedCount}/{initiatives.length} iniciativa{initiatives.length !== 1 ? "s" : ""} concluída{initiatives.length !== 1 ? "s" : ""}
                            </span>
                          </button>
                        )}

                        {/* Initiatives list */}
                        {isKRExpanded && initiatives.length > 0 && (
                          <div className="mt-1.5 space-y-1 pl-1 border-l border-border/40">
                            {initiatives.map((init) => {
                              const initOwner = users.find((u) => u.id === init.ownerId);
                              return (
                                <div
                                  key={init.id}
                                  className="flex items-start gap-1.5 pl-2 py-0.5 rounded hover:bg-muted/20 group"
                                  data-testid={`row-organogram-initiative-${init.id}`}
                                >
                                  <button
                                    onClick={() => onToggleInitiative(init.id, !init.completed)}
                                    className="shrink-0 mt-0.5 text-muted-foreground hover:text-[#378ADD] transition-colors"
                                  >
                                    {init.completed
                                      ? <CheckSquare className="h-3 w-3 text-[#378ADD]" />
                                      : <Square className="h-3 w-3" />}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-[10px] leading-snug ${init.completed ? "line-through opacity-50" : ""}`}>
                                      {init.title}
                                    </p>
                                    {(initOwner || init.dueDate) && (
                                      <div className="flex items-center gap-2 mt-0.5 text-[9px] text-muted-foreground">
                                        {initOwner && (
                                          <span className="truncate">
                                            {initOwner.id === currentUserId ? "Você" : initOwner.name}
                                          </span>
                                        )}
                                        {init.dueDate && (
                                          <span className="flex items-center gap-0.5 whitespace-nowrap">
                                            <Clock className="h-2.5 w-2.5" />
                                            {format(new Date(init.dueDate), "dd/MM/yy", { locale: ptBR })}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Expand / collapse objective children */}
          {hasChildren && (
            <button
              onClick={onToggle}
              className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {expanded ? (
                <><ChevronUp className="h-3 w-3" /> Ocultar filhos</>
              ) : (
                <><ChevronDown className="h-3 w-3" /> {node.children.length} filho{node.children.length !== 1 ? "s" : ""}</>
              )}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── OrgChartNode ─────────────────────────────────────────────────────────────

function OrgChartNode({ node, keyResults, users, initiativesByKR, onToggleInitiative, currentUserId, onRetroObjective }: OrgChartNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const subtreeWidth = calcSubtreeWidth(node);

  return (
    <div style={{ width: subtreeWidth, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <OrgChartCard
        node={node}
        keyResults={keyResults}
        users={users}
        initiativesByKR={initiativesByKR}
        onToggleInitiative={onToggleInitiative}
        expanded={expanded}
        hasChildren={hasChildren}
        onToggle={() => setExpanded((v) => !v)}
        currentUserId={currentUserId}
        onRetroObjective={onRetroObjective}
      />

      {hasChildren && expanded && (
        <div style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "center", height: CONNECTOR_H }}>
            <div className="w-px bg-border/40" style={{ height: CONNECTOR_H }} />
          </div>
          {node.children.length > 1 && (
            <div style={{ position: "relative", height: 1, width: "100%" }}>
              {(() => {
                const leftOffset = calcSubtreeWidth(node.children[0]) / 2;
                const rightOffset = calcSubtreeWidth(node.children[node.children.length - 1]) / 2;
                return (
                  <div
                    className="bg-border/40"
                    style={{ position: "absolute", top: 0, left: leftOffset, right: rightOffset, height: 1 }}
                  />
                );
              })()}
            </div>
          )}
          <div style={{ display: "flex", gap: CHILD_GAP }}>
            {node.children.map((child) => (
              <div
                key={child.id}
                style={{ width: calcSubtreeWidth(child), display: "flex", flexDirection: "column", alignItems: "center" }}
              >
                <div className="w-px bg-border/40" style={{ height: CONNECTOR_H }} />
                <OrgChartNode
                  node={child}
                  keyResults={keyResults}
                  users={users}
                  initiativesByKR={initiativesByKR}
                  onToggleInitiative={onToggleInitiative}
                  currentUserId={currentUserId}
                  onRetroObjective={onRetroObjective}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── OkrHierarchyView (main export) ──────────────────────────────────────────

export function OkrHierarchyView({
  objectives,
  keyResults,
  users,
  initiativesByKR = new Map(),
  onToggleInitiative = () => {},
  onRetroObjective,
}: OkrHierarchyViewProps) {
  const tree = useMemo(() => buildTree(objectives), [objectives]);
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id;

  if (tree.length === 0) {
    return (
      <Card className="border-border/60 text-center py-16">
        <CardContent>
          <div className="h-16 w-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Target className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-[18px] font-bold">Nenhum OKR encontrado</h3>
          <p className="text-[14px] text-muted-foreground mt-2 max-w-xs mx-auto">
            Ajuste os filtros ou crie um novo objetivo para visualizar o organograma.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto overflow-y-visible p-6">
      <div className="flex gap-12 min-w-fit items-start">
        {tree.map((root) => (
          <OrgChartNode
            key={root.id}
            node={root}
            keyResults={keyResults}
            users={users}
            initiativesByKR={initiativesByKR}
            onToggleInitiative={onToggleInitiative}
            currentUserId={currentUserId}
            onRetroObjective={onRetroObjective}
          />
        ))}
      </div>
    </div>
  );
}
