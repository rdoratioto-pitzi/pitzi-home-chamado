import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Square,
  CheckSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
  TrendingUp,
  Flag,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatKRRange } from "@/lib/kr-format";
import type { Objective, KeyResult, User, Initiative } from "@shared/schema";
import { calculateHealthStatus, calculateObjectiveHealth } from "@/lib/okr-health";
import { HealthBadge } from "@/components/okrs/HealthBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OkrListViewProps {
  objectives: Objective[];
  keyResults: KeyResult[];
  users: User[];
  initiativesByKR: Map<string, Initiative[]>;
  levelFilter: string;
  currentUserId: string | undefined;
  onToggleInitiative: (id: string, completed: boolean) => void;
  onEditObjective: (obj: Objective) => void;
  onDeleteObjective: (id: string) => void;
  onEditKR: (kr: KeyResult) => void;
  onDeleteKR: (id: string) => void;
  onEditInitiative: (init: Initiative) => void;
  onCheckin?: (kr: KeyResult) => void;
  onRetroObjective?: (obj: Objective, readOnly: boolean) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const levelBorder: Record<string, string> = {
  company: "border-l-[#00E676]",
  area: "border-l-[#378ADD]",
  team: "border-l-[#7F77DD]",
};

const levelBadge: Record<string, { label: string; cls: string }> = {
  company: { label: "Empresa", cls: "bg-[#00E676]/10 text-[#00E676] border-[#00E676]/20" },
  area:    { label: "Área",    cls: "bg-[#378ADD]/10 text-[#378ADD] border-[#378ADD]/20" },
  team:    { label: "Time",    cls: "bg-[#7F77DD]/10 text-[#7F77DD] border-[#7F77DD]/20" },
};

const statusBadge: Record<string, { label: string; cls: string }> = {
  on_track:  { label: "NO CAMINHO", cls: "bg-green-500/10 text-green-500 border-green-500/20" },
  at_risk:   { label: "EM RISCO",   cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  off_track: { label: "ATRASADO",   cls: "bg-red-500/10 text-red-500 border-red-500/20" },
};

function calcKRProgress(kr: KeyResult, initiatives: Initiative[]): number {
  if (initiatives.length > 0) {
    const done = initiatives.filter((i) => i.completed).length;
    return Math.round((done / initiatives.length) * 100);
  }
  const start = parseFloat(kr.startValue || "0");
  const target = parseFloat(kr.targetValue || "100");
  const current = parseFloat(kr.currentValue || "0");
  if (kr.measurementType === "decreasing") {
    return target !== start
      ? Math.min(100, Math.max(0, Math.round(((start - current) / (start - target)) * 100)))
      : 0;
  }
  if (kr.measurementType === "binary") return current > 0 ? 100 : 0;
  return target !== start
    ? Math.min(100, Math.max(0, Math.round(((current - start) / (target - start)) * 100)))
    : 0;
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

function parseResponsibleIds(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function OwnerDisplay({
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
  const initials = user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="flex items-center gap-1 min-w-0">
      <div className="h-5 w-5 shrink-0 rounded-full bg-muted/60 flex items-center justify-center text-[8px] font-semibold text-muted-foreground">
        {initials}
      </div>
      <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">{label}</span>
    </div>
  );
}

// ─── Column widths ─────────────────────────────────────────────────────────────
// Layout: [title flex-1 min-300] [level 80px] [status 110px] [progress 120px] [owner 120px] [due 80px] [actions 60px]

function TableHeader() {
  return (
    <div className="flex items-center px-3 py-1.5 border-b border-border/40 bg-muted/30">
      <div className="flex-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide min-w-[300px]">
        Objetivo / KR / Iniciativa
      </div>
      <div className="w-[80px] text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
        Nível
      </div>
      <div className="w-[110px] text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
        Status
      </div>
      <div className="w-[120px] text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
        Progresso
      </div>
      <div className="w-[120px] text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
        Responsável
      </div>
      <div className="w-[80px] text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
        Prazo
      </div>
      <div className="w-[60px] shrink-0" />
    </div>
  );
}

// ─── Initiative row ────────────────────────────────────────────────────────────

function InitiativeRow({
  initiative,
  users,
  currentUserId,
  onToggle,
  onEdit,
}: {
  initiative: Initiative;
  users: User[];
  currentUserId: string | undefined;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      className="flex items-center h-10 px-3 border-b border-border/30 hover:bg-muted/20 transition-colors border-l-[3px] border-l-[#7F77DD]"
      style={{ paddingLeft: "calc(12px + 48px)" }}
      data-testid={`list-row-initiative-${initiative.id}`}
    >
      <div className="flex-1 flex items-center gap-2 min-w-[300px]">
        <button
          onClick={onToggle}
          className="shrink-0 text-muted-foreground hover:text-[#7F77DD] transition-colors"
        >
          {initiative.completed
            ? <CheckSquare className="h-3.5 w-3.5 text-[#7F77DD]" />
            : <Square className="h-3.5 w-3.5" />}
        </button>
        <span
          className={`text-[12px] truncate ${initiative.completed ? "line-through opacity-50" : "text-foreground"}`}
          title={initiative.title}
        >
          {initiative.title}
        </span>
      </div>
      <div className="w-[80px] shrink-0" />
      <div className="w-[110px] shrink-0" />
      <div className="w-[120px] shrink-0" />
      <div className="w-[120px] shrink-0">
        <OwnerDisplay userId={initiative.ownerId} users={users} currentUserId={currentUserId} />
      </div>
      <div className="w-[80px] shrink-0 text-[11px] text-muted-foreground">
        {initiative.dueDate
          ? format(new Date(initiative.dueDate), "dd/MM/yy", { locale: ptBR })
          : null}
      </div>
      <div className="w-[60px] shrink-0 flex justify-end">
        <button
          onClick={onEdit}
          className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition-colors"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── KR row ────────────────────────────────────────────────────────────────────

function KRRow({
  kr,
  users,
  initiatives,
  initiativesExpanded,
  currentUserId,
  showInitiatives,
  levelFilter,
  objectiveCycle,
  onToggleExpand,
  onToggleInitiative,
  onEdit,
  onDelete,
  onEditInitiative,
  onCheckin,
}: {
  kr: KeyResult;
  users: User[];
  initiatives: Initiative[];
  initiativesExpanded: boolean;
  currentUserId: string | undefined;
  showInitiatives: boolean;
  levelFilter: string;
  objectiveCycle: string;
  onToggleExpand: () => void;
  onToggleInitiative: (id: string, completed: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onEditInitiative: (init: Initiative) => void;
  onCheckin?: () => void;
}) {
  const krProgress = calcKRProgress(kr, initiatives);
  const ownerIds = parseResponsibleIds(kr.responsibleIds);
  const hasInitiatives = initiatives.length > 0;
  const krHealth = calculateHealthStatus(krProgress, objectiveCycle, { hasCheckins: kr.hasCheckins });

  return (
    <>
      <div
        className="flex items-center h-11 px-3 border-b border-border/30 hover:bg-muted/10 transition-colors border-l-[3px] border-l-[#378ADD] bg-muted/5"
        style={{ paddingLeft: "calc(12px + 24px)" }}
        data-testid={`list-row-kr-${kr.id}`}
      >
        <div className="flex-1 flex items-center gap-1.5 min-w-[300px]">
          {hasInitiatives && showInitiatives ? (
            <button
              onClick={onToggleExpand}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              {initiativesExpanded
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <div className="w-3.5 shrink-0" />
          )}
          <span className="text-[12px] font-semibold truncate text-foreground" title={kr.title}>{kr.title}</span>
          <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">
            {formatKRRange(kr.startValue, kr.targetValue, kr.measurementType, kr.unit)}
          </span>
        </div>
        <div className="w-[80px] shrink-0">
          <Badge variant="outline" className="text-[9px] font-bold bg-[#378ADD]/10 text-[#378ADD] border-[#378ADD]/20">
            KR
          </Badge>
        </div>
        <div className="w-[110px] shrink-0">
          <HealthBadge status={krHealth} />
        </div>
        <div className="w-[120px] shrink-0 flex items-center gap-1.5 pr-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${krProgress}%`, background: "#378ADD" }}
            />
          </div>
          <span className="text-[10px] font-bold text-[#378ADD] whitespace-nowrap">{krProgress}%</span>
        </div>
        <div className="w-[120px] shrink-0">
          <OwnerDisplay userId={ownerIds[0]} users={users} currentUserId={currentUserId} />
        </div>
        <div className="w-[80px] shrink-0 text-[11px] text-muted-foreground">
          {kr.dueDate ? format(new Date(kr.dueDate), "dd/MM/yy", { locale: ptBR }) : null}
        </div>
        <div className="w-[60px] shrink-0 flex items-center justify-end gap-0.5">
          {!hasInitiatives && onCheckin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={onCheckin}
              data-testid={`list-checkin-kr-${kr.id}`}
              title="Check-in"
            >
              <TrendingUp className="h-3.5 w-3.5" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                data-testid={`list-menu-kr-${kr.id}`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Initiative rows */}
      {showInitiatives && initiativesExpanded && initiatives.map((init) => (
        <InitiativeRow
          key={init.id}
          initiative={init}
          users={users}
          currentUserId={currentUserId}
          onToggle={() => onToggleInitiative(init.id, !init.completed)}
          onEdit={() => onEditInitiative(init)}
        />
      ))}
    </>
  );
}

// ─── Objective row ─────────────────────────────────────────────────────────────

function ObjectiveRow({
  objective,
  keyResults,
  users,
  initiativesByKR,
  levelFilter,
  currentUserId,
  onToggleInitiative,
  onEditObjective,
  onDeleteObjective,
  onEditKR,
  onDeleteKR,
  onEditInitiative,
  onCheckin,
  onRetroObjective,
}: {
  objective: Objective;
  keyResults: KeyResult[];
  users: User[];
  initiativesByKR: Map<string, Initiative[]>;
  levelFilter: string;
  currentUserId: string | undefined;
  onToggleInitiative: (id: string, completed: boolean) => void;
  onEditObjective: (obj: Objective) => void;
  onDeleteObjective: (id: string) => void;
  onEditKR: (kr: KeyResult) => void;
  onDeleteKR: (id: string) => void;
  onEditInitiative: (init: Initiative) => void;
  onCheckin?: (kr: KeyResult) => void;
  onRetroObjective?: (obj: Objective, readOnly: boolean) => void;
}) {
  // Default: objectives expanded, KRs collapsed
  const [krsExpanded, setKrsExpanded] = useState(true);
  const [expandedKRs, setExpandedKRs] = useState<Set<string>>(new Set());

  const isClosed = objective.closedAt != null;
  const krs = keyResults.filter((kr) => kr.objectiveId === objective.id);
  const progress = calcObjectiveProgress(objective.id, keyResults, initiativesByKR);
  const lvlInfo = levelBadge[objective.level] ?? levelBadge.company;
  const stInfo = statusBadge[objective.status] ?? statusBadge.on_track;
  const borderCls = isClosed ? "border-l-border" : (levelBorder[objective.level] ?? "border-l-[#00E676]");
  const objHealth = calculateObjectiveHealth(
    krs.map((kr) =>
      calculateHealthStatus(
        calcKRProgress(kr, initiativesByKR.get(kr.id) ?? []),
        objective.cycle,
        { hasCheckins: kr.hasCheckins },
      )
    )
  );

  const showKRs = levelFilter !== "empresa";
  const showInitiatives = levelFilter === "all" || levelFilter === "iniciativa";

  const toggleKR = (id: string) =>
    setExpandedKRs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <>
      {/* Objective row */}
      <div
        className={`flex items-center h-12 px-3 border-b border-border/40 hover:bg-muted/30 transition-colors border-l-[3px] ${borderCls} bg-background ${isClosed ? "opacity-70" : ""}`}
        data-testid={`list-row-objective-${objective.id}`}
      >
        <div className="flex-1 flex items-center gap-1.5 min-w-[300px]">
          {krs.length > 0 && showKRs ? (
            <button
              onClick={() => setKrsExpanded((v) => !v)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              {krsExpanded
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <div className="w-3.5 shrink-0" />
          )}
          <span
            className={`text-[13px] font-bold truncate ${isClosed ? "text-muted-foreground" : "text-foreground"}`}
            title={objective.title}
          >
            {objective.title}
          </span>
        </div>
        <div className="w-[80px] shrink-0">
          <Badge variant="outline" className={`text-[9px] font-bold ${lvlInfo.cls}`}>
            {lvlInfo.label}
          </Badge>
        </div>
        <div className="w-[110px] shrink-0 flex flex-col gap-0.5">
          {isClosed ? (
            <Badge variant="outline" className="text-[9px] font-bold bg-muted/40 text-muted-foreground border-border/60">
              ENCERRADO
            </Badge>
          ) : (
            <>
              <Badge variant="outline" className={`text-[9px] font-bold ${stInfo.cls}`}>
                {stInfo.label}
              </Badge>
              {objHealth !== objective.status && (
                <HealthBadge status={objHealth} secondary />
              )}
            </>
          )}
        </div>
        <div className="w-[120px] shrink-0 flex items-center gap-1.5 pr-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: isClosed ? "var(--border)" : "#00E676" }}
            />
          </div>
          <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: isClosed ? "var(--muted-foreground)" : "#00E676" }}>
            {progress}%
          </span>
        </div>
        <div className="w-[120px] shrink-0">
          <OwnerDisplay userId={objective.ownerId} users={users} currentUserId={currentUserId} />
        </div>
        <div className="w-[80px] shrink-0 text-[11px] text-muted-foreground">
          {objective.cycle}
        </div>
        <div className="w-[60px] shrink-0 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                data-testid={`list-menu-objective-${objective.id}`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isClosed ? (
                <DropdownMenuItem onClick={() => onRetroObjective?.(objective, true)}>
                  <Eye className="h-3.5 w-3.5 mr-2" /> Ver retrospectiva
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => onEditObjective(objective)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onRetroObjective?.(objective, false)}>
                    <Flag className="h-3.5 w-3.5 mr-2" /> Encerrar Quarter
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDeleteObjective(objective.id)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KR rows */}
      {showKRs && krsExpanded && krs.map((kr) => (
        <KRRow
          key={kr.id}
          kr={kr}
          users={users}
          initiatives={initiativesByKR.get(kr.id) ?? []}
          initiativesExpanded={expandedKRs.has(kr.id)}
          currentUserId={currentUserId}
          showInitiatives={showInitiatives}
          levelFilter={levelFilter}
          objectiveCycle={objective.cycle}
          onToggleExpand={() => toggleKR(kr.id)}
          onToggleInitiative={onToggleInitiative}
          onEdit={() => onEditKR(kr)}
          onDelete={() => onDeleteKR(kr.id)}
          onEditInitiative={onEditInitiative}
          onCheckin={!isClosed && onCheckin ? () => onCheckin(kr) : undefined}
        />
      ))}
    </>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

export function OkrListView({
  objectives,
  keyResults,
  users,
  initiativesByKR,
  levelFilter,
  currentUserId,
  onToggleInitiative,
  onEditObjective,
  onDeleteObjective,
  onEditKR,
  onDeleteKR,
  onEditInitiative,
  onCheckin,
  onRetroObjective,
}: OkrListViewProps) {
  if (objectives.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 text-center py-16">
        <p className="text-[14px] text-muted-foreground">Nenhum objetivo encontrado para os filtros selecionados.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 overflow-x-auto">
      <div className="min-w-[870px]">
      <TableHeader />
      {objectives.map((obj) => (
        <ObjectiveRow
          key={obj.id}
          objective={obj}
          keyResults={keyResults}
          users={users}
          initiativesByKR={initiativesByKR}
          levelFilter={levelFilter}
          currentUserId={currentUserId}
          onToggleInitiative={onToggleInitiative}
          onEditObjective={onEditObjective}
          onDeleteObjective={onDeleteObjective}
          onEditKR={onEditKR}
          onDeleteKR={onDeleteKR}
          onEditInitiative={onEditInitiative}
          onCheckin={onCheckin}
          onRetroObjective={onRetroObjective}
        />
      ))}
      </div>
    </div>
  );
}
