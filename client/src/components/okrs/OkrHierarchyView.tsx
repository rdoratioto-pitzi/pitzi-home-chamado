import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Target } from "lucide-react";
import type { Objective, KeyResult, User } from "@shared/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

type OkrNode = Objective & { children: OkrNode[] };

export interface OkrHierarchyViewProps {
  objectives: Objective[];
  keyResults: KeyResult[];
  users: User[];
}

interface OrgChartNodeProps {
  node: OkrNode;
  keyResults: KeyResult[];
  users: User[];
}

interface OrgChartCardProps {
  node: OkrNode;
  keyResults: KeyResult[];
  expanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CARD_WIDTH = 280;
const CHILD_GAP = 24;
const CONNECTOR_H = 30;

const levelBorderLeft: Record<string, string> = {
  company: "border-l-[3px] border-l-[#00E676]",
  area: "border-l-[3px] border-l-[#378ADD]",
  team: "border-l-[3px] border-l-[#7F77DD]",
};

const levelBadgeStyle: Record<string, { label: string; cls: string }> = {
  company: { label: "Empresa", cls: "bg-[#00E676]/10 text-[#00E676] border-[#00E676]/20" },
  area:    { label: "Área",    cls: "bg-[#378ADD]/10 text-[#378ADD] border-[#378ADD]/20" },
  team:    { label: "Time",    cls: "bg-[#7F77DD]/10 text-[#7F77DD] border-[#7F77DD]/20" },
};

const statusBadgeStyle: Record<string, { label: string; cls: string }> = {
  on_track: { label: "NO CAMINHO", cls: "bg-green-500/10 text-green-500 border-green-500/20" },
  at_risk:  { label: "EM RISCO",   cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  off_track: { label: "ATRASADO",  cls: "bg-red-500/10 text-red-500 border-red-500/20" },
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

/**
 * Calculates the full width a subtree occupies so connectors can be aligned.
 * A leaf node occupies exactly CARD_WIDTH. A parent occupies the sum of its
 * children subtree widths plus the gaps between them.
 */
function calcSubtreeWidth(node: OkrNode): number {
  if (!node.children.length) return CARD_WIDTH;
  return node.children.reduce(
    (sum, child, i) => sum + calcSubtreeWidth(child) + (i > 0 ? CHILD_GAP : 0),
    0,
  );
}

// ─── OrgChartCard ─────────────────────────────────────────────────────────────

function OrgChartCard({ node, keyResults, expanded, hasChildren, onToggle }: OrgChartCardProps) {
  const progress = calcProgress(node.id, keyResults);
  const krCount = keyResults.filter((kr) => kr.objectiveId === node.id).length;
  const levelInfo = levelBadgeStyle[node.level] ?? levelBadgeStyle.company;
  const statusInfo = statusBadgeStyle[node.status] ?? statusBadgeStyle.on_track;
  const borderCls = levelBorderLeft[node.level] ?? "";

  return (
    <Card
      className={`overflow-hidden ${borderCls} border-[0.5px] border-border/40`}
      style={{ width: CARD_WIDTH, minWidth: CARD_WIDTH }}
    >
      <CardContent className="p-0">
        <div className="px-4 pt-3 pb-3">
          {/* Level badge */}
          <Badge
            variant="outline"
            className={`text-[10px] px-[7px] py-[2px] font-semibold mb-2 ${levelInfo.cls}`}
          >
            {levelInfo.label}
          </Badge>

          {/* Title */}
          <p className="text-[13px] font-medium text-foreground leading-snug line-clamp-2 mt-2 mb-2">
            {node.title}
          </p>

          {/* Status badge */}
          <Badge
            variant="outline"
            className={`text-[10px] px-[7px] py-[2px] font-semibold ${statusInfo.cls}`}
          >
            {statusInfo.label}
          </Badge>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="h-[4px] w-full bg-border/40 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: "#00E676" }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground text-right mt-1">{progress}%</p>
          </div>

          {/* KR counter */}
          {krCount > 0 && (
            <p className="text-[11px] text-muted-foreground mt-2">
              ● {krCount} key result{krCount !== 1 ? "s" : ""}
            </p>
          )}

          {/* Expand / collapse children button */}
          {hasChildren && (
            <button
              onClick={onToggle}
              className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Ocultar filhos
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  {node.children.length} filho{node.children.length !== 1 ? "s" : ""}
                </>
              )}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── OrgChartNode ─────────────────────────────────────────────────────────────

function OrgChartNode({ node, keyResults, users }: OrgChartNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const subtreeWidth = calcSubtreeWidth(node);

  return (
    <div
      style={{
        width: subtreeWidth,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Card */}
      <OrgChartCard
        node={node}
        keyResults={keyResults}
        expanded={expanded}
        hasChildren={hasChildren}
        onToggle={() => setExpanded((v) => !v)}
      />

      {/* Connectors + children */}
      {hasChildren && expanded && (
        <div style={{ width: "100%" }}>
          {/* Vertical line down from card */}
          <div style={{ display: "flex", justifyContent: "center", height: CONNECTOR_H }}>
            <div className="w-px bg-border/40" style={{ height: CONNECTOR_H }} />
          </div>

          {/* Horizontal bar connecting children centers */}
          {node.children.length > 1 && (
            <div style={{ position: "relative", height: 1, width: "100%" }}>
              {(() => {
                const leftOffset = calcSubtreeWidth(node.children[0]) / 2;
                const rightOffset =
                  calcSubtreeWidth(node.children[node.children.length - 1]) / 2;
                return (
                  <div
                    className="bg-border/40"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: leftOffset,
                      right: rightOffset,
                      height: 1,
                    }}
                  />
                );
              })()}
            </div>
          )}

          {/* Children row */}
          <div style={{ display: "flex", gap: CHILD_GAP }}>
            {node.children.map((child) => (
              <div
                key={child.id}
                style={{
                  width: calcSubtreeWidth(child),
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                {/* Vertical line up to horizontal bar */}
                <div className="w-px bg-border/40" style={{ height: CONNECTOR_H }} />

                {/* Recursive subtree */}
                <OrgChartNode node={child} keyResults={keyResults} users={users} />
              </div>
            ))}
          </div>
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
          />
        ))}
      </div>
    </div>
  );
}
