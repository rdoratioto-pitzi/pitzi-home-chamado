import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, List, Trello, BarChart3, Calendar, LayoutDashboard, Pencil, ChevronRight, MoreHorizontal, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, User as UserIcon, Users, Globe, UserPlus, X } from "lucide-react";
import { KpiStrip } from "@/components/workspace/KpiStrip";
import { ItemDetailDrawer } from "@/components/workspace/ItemDetailDrawer";
import type { UnifiedItem } from "@/components/workspace/WorkspaceTable";
import { fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Migração lazy de status legado → canônico (espelha backend). Defesa em
 * profundidade: backend já normaliza, mas se o form fizer round-trip antes
 * de salvar, o Select fica vazio quando recebe valor desconhecido. Aqui
 * traduz na hidratação.
 */
const STATUS_LEGACY_MAP: Record<string, string> = {
  active: "ativo",
  sprint_active: "ativo",
  planning: "backlog",
  on_hold: "pausado",
  completed: "concluido",
  archived: "inativo",
};

function normalizeStatusForForm(s: string | null | undefined): string {
  if (!s) return "backlog";
  return STATUS_LEGACY_MAP[s] ?? s;
}

/**
 * Garante valor compatível com `<Input type="date">` (formato yyyy-MM-dd).
 * Aceita ISO string, yyyy-MM-dd, Date object, ou null/undefined/"".
 * Retorna "" pra valores vazios/inválidos (input fica em branco, sem warnings).
 */
function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") {
    // Já está em yyyy-MM-dd? Aceita direto.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    // ISO ou outro formato — parseia e formata.
    const d = new Date(value);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return "";
    return value.toISOString().slice(0, 10);
  }
  return "";
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProjetosKpis {
  ativos: number;
  tarefasAbertas: number;
  emAndamento: number;
  concluidas: number;
  atrasadas: number;
}

interface TarefaItem {
  id: string;
  codigo: string;
  projetoId: string | null;
  titulo: string;
  descricao: string | null;
  status: string | null;
  prioridade: string | null;
  responsavel: string;
  responsavelInitials: string;
  dataEntrega: string | null;
  sprint: string | null;
  progresso: number | null;
  criadoEm: string | null;
  anexos?: Array<{ name: string; url: string }>;
}

interface ProjetoComTarefas {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  status: string | null;
  prioridade: string | null;
  responsavel: string;
  responsavelInitials: string;
  dataInicio: string | null;
  dataFim: string | null;
  progresso: number | null;
  cor: string | null;
  categoria: string | null;
  visibility?: "private" | "shared" | "public" | null;
  memberIds?: string[];
  criadoEm: string | null;
  tarefas: TarefaItem[];
}

interface WorkspaceProjetosResponse {
  kpis: ProjetosKpis;
  projetos: ProjetoComTarefas[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

type ViewMode = "lista" | "kanban" | "gantt" | "calendario" | "dashboard";

type SortField = "codigo" | "titulo" | "projeto" | "responsavel" | "status" | "prioridade" | "progresso" | "dataFim";

interface TarefaFlat extends TarefaItem {
  projetoNome: string;
  projetoCor: string;
}

const statusLabels: Record<string, string> = {
  "a-fazer": "A Fazer",
  "em-andamento": "Em Andamento",
  "em-revisao": "Em Revisão",
  "concluido": "Concluído",
  "bloqueado": "Bloqueado",
  backlog: "Backlog",
};

const statusDotColors: Record<string, string> = {
  "em-andamento": "#00c853",
  "em-revisao": "#2196f3",
  "concluido": "#4ade80",
  "a-fazer": "#f59e0b",
  bloqueado: "#ef4444",
  backlog: "hsl(var(--muted-foreground) / 0.45)",
};

const priorityLabels: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

const priorityColors: Record<string, string> = {
  baixa: "bg-slate-500/10 text-slate-400 border-slate-700",
  media: "bg-yellow-500/10 text-yellow-400 border-yellow-700",
  alta: "bg-orange-500/10 text-orange-400 border-orange-700",
  critica: "bg-red-500/10 text-red-400 border-red-700",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProjectGroupHeader({
  projeto,
  collapsed,
  onToggle,
  onEdit,
}: {
  projeto: ProjetoComTarefas;
  collapsed: boolean;
  onToggle: () => void;
  onEdit?: () => void;
}) {
  const cor = projeto.cor || "#00c853";
  const prog = projeto.progresso ?? 0;
  const tarefaCount = projeto.tarefas.length;

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 group cursor-pointer select-none bg-muted/20"
      onClick={onToggle}
    >
      <ChevronRight
        size={14}
        className="transition-transform duration-200 flex-shrink-0 text-muted-foreground"
        style={{
          transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
        }}
      />
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: cor,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      <span
        className="text-muted-foreground"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          textTransform: "uppercase",
          fontSize: "10px",
          letterSpacing: "0.05em",
        }}
      >
        {projeto.nome}
      </span>
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0 border"
        style={{
          background: `${cor}15`,
          color: cor,
          borderColor: `${cor}40`,
        }}
      >
        {prog}%
      </Badge>
      <span
        className="text-muted-foreground/70"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "10px",
        }}
      >
        {projeto.codigo}
      </span>
      {collapsed && tarefaCount > 0 && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {tarefaCount} {tarefaCount === 1 ? "atividade" : "atividades"}
        </span>
      )}
      {onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
          title="Editar projeto"
        >
          <Pencil size={12} className="text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

function HeaderRow() {
  const headers = [
    "Código",
    "Título",
    "Categoria / Tipo",
    "Responsável",
    "Status",
    "Prioridade",
    "Progresso",
    "Data Início",
    "Data Fim",
    "",
  ];
  return (
    <div
      className="grid items-center px-4 py-2 gap-2 border-b border-border/40"
      style={{
        gridTemplateColumns: "96px 1fr 175px 100px 115px 110px 62px 88px 88px 30px",
      }}
    >
      {headers.map((h, i) => (
        <span
          key={i}
          className="text-muted-foreground/70"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: "uppercase",
            fontSize: "9px",
            letterSpacing: "0.05em",
          }}
        >
          {h}
        </span>
      ))}
    </div>
  );
}

function EmptyTarefasRow() {
  return (
    <div className="flex items-center px-4 py-3 border-b border-border/30">
      <span className="text-xs italic text-muted-foreground" style={{ paddingLeft: 18 }}>
        Nenhuma atividade neste projeto
      </span>
    </div>
  );
}

const FLAT_GRID = "96px 1fr 175px 100px 115px 110px 62px 88px 30px";

const FLAT_HEADERS: { label: string; field: SortField | null }[] = [
  { label: "Código", field: "codigo" },
  { label: "Título", field: "titulo" },
  { label: "Projeto", field: "projeto" },
  { label: "Responsável", field: "responsavel" },
  { label: "Status", field: "status" },
  { label: "Prioridade", field: "prioridade" },
  { label: "Progresso", field: "progresso" },
  { label: "Data Fim", field: "dataFim" },
  { label: "", field: null },
];

function FlatHeaderRow({ sortField, sortDir, onSort }: { sortField: SortField; sortDir: "asc" | "desc"; onSort: (f: SortField) => void }) {
  return (
    <div
      className="grid items-center px-4 py-2 gap-2"
      style={{ gridTemplateColumns: FLAT_GRID, borderBottom: "1px solid hsl(var(--border))" }}
    >
      {FLAT_HEADERS.map(({ label, field }, i) => (
        <button
          key={i}
          disabled={!field}
          onClick={() => field && onSort(field)}
          className="flex items-center gap-1 text-left disabled:cursor-default"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: "uppercase",
            fontSize: "9px",
            letterSpacing: "0.05em",
            color: field && sortField === field ? "hsl(var(--foreground) / 0.85)" : "hsl(var(--muted-foreground) / 0.55)",
            background: "none",
            border: "none",
            padding: 0,
          }}
        >
          {label}
          {field && (
            sortField === field
              ? sortDir === "asc"
                ? <ArrowUp className="h-2.5 w-2.5 flex-shrink-0" />
                : <ArrowDown className="h-2.5 w-2.5 flex-shrink-0" />
              : <ArrowUpDown className="h-2.5 w-2.5 flex-shrink-0 opacity-30" />
          )}
        </button>
      ))}
    </div>
  );
}

function TarefaFlatRow({ tarefa, onClick, onEdit, onDelete }: { tarefa: TarefaFlat; onClick?: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const status = tarefa.status || "a-fazer";
  const dotColor = statusDotColors[status] || "hsl(var(--muted-foreground) / 0.45)";
  const prioridade = tarefa.prioridade || "media";
  const prioColor = priorityColors[prioridade] || priorityColors.media;
  const prog = tarefa.progresso ?? 0;

  return (
    <div
      className="group grid items-center px-4 py-2.5 gap-2 transition-colors cursor-pointer"
      onClick={onClick}
      style={{ gridTemplateColumns: FLAT_GRID, borderBottom: "1px solid hsl(var(--border) / 0.5)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--muted))")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Código */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-block flex-shrink-0" style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor }} />
        <span className="text-xs text-muted-foreground truncate" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {tarefa.codigo}
        </span>
      </div>

      {/* Título */}
      <span className="text-sm truncate" style={{ color: "hsl(var(--foreground))" }}>
        {tarefa.titulo}
      </span>

      {/* Projeto */}
      <div className="flex items-center gap-1.5 min-w-0 truncate">
        <span className="inline-block flex-shrink-0" style={{ width: 7, height: 7, borderRadius: "50%", background: tarefa.projetoCor }} />
        <span className="text-xs truncate" style={{ color: tarefa.projetoCor, opacity: 0.85 }}>
          {tarefa.projetoNome}
        </span>
      </div>

      {/* Responsável */}
      <div className="flex items-center gap-1.5 min-w-0">
        <div
          className="flex items-center justify-center flex-shrink-0 rounded-full text-[10px] font-semibold"
          style={{ width: 22, height: 22, background: "rgba(0,200,83,0.15)", color: "#00c853" }}
        >
          {tarefa.responsavelInitials}
        </div>
        {tarefa.responsavel && tarefa.responsavel !== "Não atribuído" && (
          <span className="text-xs truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
            {tarefa.responsavel}
          </span>
        )}
      </div>

      {/* Status */}
      <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
        {statusLabels[status] || status}
      </span>

      {/* Prioridade */}
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${prioColor}`}>
        {priorityLabels[prioridade] || prioridade}
      </Badge>

      {/* Progresso */}
      <div className="flex items-center gap-1">
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "hsl(var(--border))" }}>
          <div style={{ width: `${Math.min(prog, 100)}%`, height: "100%", borderRadius: 2, background: tarefa.projetoCor }} />
        </div>
        <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {prog}%
        </span>
      </div>

      {/* Data Fim */}
      <span className="text-xs text-muted-foreground">
        {tarefa.dataEntrega
          ? new Date(tarefa.dataEntrega).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
          : "—"}
      </span>

      {/* Actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded hover:bg-white/5">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>
              <Edit className="h-3.5 w-3.5 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-400" onClick={(e) => { e.stopPropagation(); onDelete?.(); }}>
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function TarefaRow({ tarefa, projetoCor, onClick, onEdit, onDelete }: { tarefa: TarefaItem; projetoCor: string; onClick?: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const status = tarefa.status || "a-fazer";
  const dotColor = statusDotColors[status] || "hsl(var(--muted-foreground) / 0.45)";
  const prioridade = tarefa.prioridade || "media";
  const prioColor = priorityColors[prioridade] || priorityColors.media;
  const prog = tarefa.progresso ?? 0;

  const dataInicio = tarefa.criadoEm
    ? new Date(tarefa.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : "—";

  return (
    <div
      className="group grid items-center px-4 py-2.5 gap-2 transition-colors cursor-pointer border-b border-border/30 hover:bg-muted/40"
      onClick={onClick}
      style={{
        gridTemplateColumns: "96px 1fr 175px 100px 115px 110px 62px 88px 88px 30px",
        borderBottom: "1px solid hsl(var(--border) / 0.5)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--muted))")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Código */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="inline-block flex-shrink-0"
          style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor }}
        />
        <span
          className="text-xs text-muted-foreground truncate"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {tarefa.codigo}
        </span>
      </div>

      {/* Título */}
      <span className="text-sm truncate text-foreground">
        {tarefa.titulo}
      </span>

      {/* Categoria / Tipo */}
      <div className="flex items-center gap-1.5 min-w-0 truncate">
        <span className="text-xs truncate" style={{ color: projetoCor, opacity: 0.7 }}>
          {tarefa.sprint || "—"}
        </span>
        <span className="text-muted-foreground/40">·</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border bg-slate-500/10 text-slate-400">
          atividade
        </Badge>
      </div>

      {/* Responsável */}
      <div className="flex items-center gap-1.5 min-w-0">
        <div
          className="flex items-center justify-center flex-shrink-0 rounded-full text-[10px] font-semibold h-[22px] w-[22px] bg-primary/15 text-primary"
        >
          {tarefa.responsavelInitials}
        </div>
        {tarefa.responsavel && tarefa.responsavel !== "Não atribuído" && (
          <span className="text-xs truncate text-muted-foreground">
            {tarefa.responsavel}
          </span>
        )}
      </div>

      {/* Status */}
      <span className="text-xs text-muted-foreground">
        {statusLabels[status] || status}
      </span>

      {/* Prioridade */}
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${prioColor}`}>
        {priorityLabels[prioridade] || prioridade}
      </Badge>

      {/* Progresso */}
      <div className="flex items-center gap-1">
        <div style={{ width: 56, height: 4, borderRadius: 2, background: "hsl(var(--muted))" }}>
          <div
            style={{
              width: `${Math.min(prog, 100)}%`,
              height: "100%",
              borderRadius: 2,
              background: projetoCor,
            }}
          />
        </div>
        <span
          className="text-[10px] text-muted-foreground"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {prog}%
        </span>
      </div>

      {/* Data Início */}
      <span className="text-xs text-muted-foreground">{dataInicio}</span>

      {/* Data Fim */}
      <span className="text-xs text-muted-foreground">
        {tarefa.dataEntrega
          ? new Date(tarefa.dataEntrega).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
          : "—"}
      </span>

      {/* Actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded hover:bg-muted">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>
              <Edit className="h-3.5 w-3.5 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-400" onClick={(e) => { e.stopPropagation(); onDelete?.(); }}>
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="grid items-center px-4 py-3 gap-2 animate-pulse"
          style={{
            gridTemplateColumns: "96px 1fr 175px 100px 115px 110px 62px 88px 88px 30px",
          }}
        >
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <div />
        </div>
      ))}
    </>
  );
}

// ─── Kanban View ─────────────────────────────────────────────────────────────

function ProjectsKanbanView({
  projetos,
  onStatusChange,
  onTarefaClick,
}: {
  projetos: ProjetoComTarefas[];
  onStatusChange?: () => void;
  onTarefaClick?: (tarefa: ProjetoComTarefas["tarefas"][number] & { projetoCor: string; projetoNome: string }) => void;
}) {
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const columns = [
    { key: "a-fazer", label: "A Fazer", color: "#f59e0b" },
    { key: "em-andamento", label: "Em Andamento", color: "#00c853" },
    { key: "bloqueado", label: "Bloqueado", color: "#ef4444" },
    { key: "concluido", label: "Concluído", color: "#4ade80" },
  ];

  const allTarefas = projetos.flatMap((p) =>
    p.tarefas.map((t) => ({ ...t, projetoCor: p.cor || "#00c853", projetoNome: p.nome }))
  );

  const handleDrop = async (targetStatus: string) => {
    setDragOverCol(null);
    if (!draggingId) return;
    const tarefa = allTarefas.find((t) => t.id === draggingId);
    if (!tarefa || (tarefa.status || "a-fazer") === targetStatus) { setDraggingId(null); return; }
    setDraggingId(null);
    try {
      await fetchWithAuth(`/api/workspace/tarefas/${draggingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
      onStatusChange?.();
    } catch { /* silently fail */ }
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => {
        const columnTarefas = allTarefas.filter((t) => (t.status || "a-fazer") === col.key);
        const isOver = dragOverCol === col.key;
        return (
          <div
            key={col.key}
            style={{ minWidth: 240, width: 240 }}
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => { e.preventDefault(); handleDrop(col.key); }}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: col.color, display: "inline-block" }} />
              <span
                className="text-foreground"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  textTransform: "uppercase",
                  fontSize: "10px",
                  letterSpacing: "0.05em",
                }}
              >
                {col.label}
              </span>
              <span
                className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-primary"
                style={{ fontSize: "10px" }}
              >
                {columnTarefas.length}
              </span>
            </div>
            {/* Cards */}
            <div
              className="flex flex-col gap-2 rounded-lg p-1 min-h-[60px] transition-colors"
              style={{ background: isOver ? "rgba(0,200,83,0.08)" : "transparent", border: isOver ? "1px dashed rgba(0,200,83,0.3)" : "1px dashed transparent" }}
            >
              {columnTarefas.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={() => setDraggingId(t.id)}
                  onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                  onClick={() => { if (onTarefaClick) onTarefaClick(t); }}
                  className="p-3 rounded cursor-pointer active:cursor-grabbing transition-colors"
                  style={{
                    background: draggingId === t.id ? "hsl(var(--primary) / 0.1)" : "hsl(var(--muted) / 0.35)",
                    border: draggingId === t.id ? "1px solid hsl(var(--primary) / 0.35)" : "1px solid hsl(var(--border) / 0.8)",
                    opacity: draggingId === t.id ? 0.6 : 1,
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "10px",
                        color: t.projetoCor,
                        opacity: 0.7,
                      }}
                    >
                      {t.codigo}
                    </span>
                  </div>
                  <p className="text-xs mb-2 text-foreground">
                    {t.titulo}
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 border ${
                        t.prioridade === "critica" ? "bg-red-500/10 text-red-400 border-red-700"
                        : t.prioridade === "alta" ? "bg-orange-500/10 text-orange-400 border-orange-700"
                        : t.prioridade === "media" ? "bg-yellow-500/10 text-yellow-400 border-yellow-700"
                        : "bg-slate-500/10 text-slate-400 border-slate-700"
                      }`}
                    >
                      {t.prioridade || "—"}
                    </Badge>
                    {t.responsavelInitials && (
                      <div
                        className="flex items-center justify-center rounded-full text-[10px] font-semibold h-[22px] w-[22px] bg-primary/15 text-primary"
                      >
                        {t.responsavelInitials}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {columnTarefas.length === 0 && (
                <div
                  className="p-4 rounded text-center text-xs italic text-muted-foreground"
                  style={{
                    background: isOver ? "hsl(var(--primary) / 0.05)" : "hsl(var(--muted) / 0.2)",
                    border: "1px dashed hsl(var(--border) / 0.8)",
                  }}
                >
                  {isOver ? "Soltar aqui" : "Vazio"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface ProjectEditFormData {
  nome: string;
  descricao: string;
  status: string;
  prioridade: string;
  categoria: string;
  responsavelId?: string;
  dataInicio: string | null;
  dataFim: string | null;
  cor: string;
  progresso: number;
  visibility: "private" | "shared" | "public";
  memberIds: string[];
}

function ProjectEditDialog({
  projeto,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  projeto: ProjetoComTarefas | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: ProjectEditFormData) => void;
  saving: boolean;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState("backlog");
  const [prioridade, setPrioridade] = useState("media");
  const [categoria, setCategoria] = useState("");
  const [responsavelId, setResponsavelId] = useState("keep");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [cor, setCor] = useState("#00c853");
  const [progresso, setProgresso] = useState(0);
  const [visibility, setVisibility] = useState<"private" | "shared" | "public">("private");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberSearchInput, setMemberSearchInput] = useState("");
  const [users, setUsers] = useState<Array<{ id: string; name: string; email?: string; status?: string }>>([]);

  useEffect(() => {
    if (projeto) {
      setNome(projeto.nome);
      setDescricao(projeto.descricao || "");
      setStatus(normalizeStatusForForm(projeto.status));
      setPrioridade(projeto.prioridade || "media");
      setCategoria(projeto.categoria || "");
      setCor(projeto.cor || "#00c853");
      setProgresso(projeto.progresso ?? 0);
      setDataInicio(toDateInputValue(projeto.dataInicio));
      setDataFim(toDateInputValue(projeto.dataFim));
      setResponsavelId("keep");
      setVisibility(projeto.visibility ?? "private");
      setMemberIds(projeto.memberIds ?? []);
      setMemberSearchInput("");
    }
  }, [projeto]);

  useEffect(() => {
    if (!open) return;
    fetchWithAuth("/api/users")
      .then((r) => r.json())
      .then((data: Array<{ id: string; name: string; email?: string; status?: string }>) => setUsers(data || []))
      .catch(() => {});
  }, [open]);

  const filteredUsersForMembers = useMemo(() => {
    return users
      // Estritamente ativos — alinha com /api/users do projeto-dialog legado
      // e evita "alguns aleatórios" quando a flag status vem ausente/legada.
      .filter((u) => u.status === "active")
      .filter((u) => {
        if (memberIds.includes(u.id)) return false;
        if (!memberSearchInput) return true;
        const q = memberSearchInput.toLowerCase();
        return u.name.toLowerCase().includes(q) || (u.email?.toLowerCase().includes(q) ?? false);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [users, memberIds, memberSearchInput]);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Projeto</DialogTitle>
          <DialogDescription>
            {projeto?.codigo} — Criado em {formatDate(projeto?.criadoEm ?? null)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="mt-1" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Responsável</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={projeto?.responsavel || "Manter atual"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">Manter atual ({projeto?.responsavel})</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Visibilidade</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as "private" | "shared" | "public")}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="private">
                  <div className="flex items-center gap-2"><UserIcon className="h-4 w-4" /> Privada</div>
                </SelectItem>
                <SelectItem value="shared">
                  <div className="flex items-center gap-2"><Users className="h-4 w-4" /> Compartilhada</div>
                </SelectItem>
                <SelectItem value="public">
                  <div className="flex items-center gap-2"><Globe className="h-4 w-4" /> Pública</div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              {visibility === "private"
                ? "Apenas o responsável pode ver este projeto."
                : visibility === "shared"
                ? "O responsável e os membros selecionados podem ver este projeto."
                : "Todos os usuários podem ver este projeto."}
            </p>
          </div>

          {visibility === "shared" && (
            <div className="space-y-2">
              <Label className="text-xs">Membros</Label>
              <div className="relative">
                <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuário para adicionar..."
                  value={memberSearchInput}
                  onChange={(e) => setMemberSearchInput(e.target.value)}
                  className="pl-9"
                />
              </div>
              {memberSearchInput && filteredUsersForMembers.length > 0 && (
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {filteredUsersForMembers.slice(0, 5).map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover-elevate"
                      onClick={() => {
                        setMemberIds((prev) => [...prev, user.id]);
                        setMemberSearchInput("");
                      }}
                    >
                      {user.name}
                      {user.email && <span className="text-muted-foreground"> ({user.email})</span>}
                    </button>
                  ))}
                </div>
              )}
              {memberIds.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {memberIds.map((uid) => {
                    const user = users.find((u) => u.id === uid);
                    return (
                      <Badge key={uid} variant="secondary" className="gap-1">
                        {user?.name || uid}
                        <button
                          type="button"
                          onClick={() => setMemberIds((prev) => prev.filter((id) => id !== uid))}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data Início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Data Fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Cor do Projeto</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  className="h-8 w-10 rounded border border-white/10 cursor-pointer bg-transparent"
                />
                <Input value={cor} onChange={(e) => setCor(e.target.value)} className="flex-1 font-mono text-xs" maxLength={7} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Progresso ({progresso}%)</Label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progresso}
                onChange={(e) => setProgresso(Number(e.target.value))}
                className="w-full mt-2 accent-[#00c853]"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => onSave({
              nome, descricao, status, prioridade, categoria,
              responsavelId: responsavelId && responsavelId !== "keep" ? responsavelId : undefined,
              // Defesa em profundidade — string vazia vira null antes de sair do client
              // (backend já trata via toDateOrNull, mas evita ambiguidade do payload).
              dataInicio: dataInicio || null,
              dataFim: dataFim || null,
              cor, progresso,
              visibility,
              memberIds: visibility === "shared" ? memberIds : [],
            })}
            disabled={saving || !nome.trim()}
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function toUnifiedItem(tarefa: TarefaItem, projetoNome: string): UnifiedItem {
  return {
    tipo: "tarefa",
    id: tarefa.id,
    codigo: tarefa.codigo,
    titulo: tarefa.titulo,
    contexto: projetoNome,
    corContexto: null,
    badgeLabel: "ATIVIDADE",
    badgeVariant: "tarefa",
    responsavel: tarefa.responsavel,
    responsavelInitials: tarefa.responsavelInitials,
    status: tarefa.status || "a-fazer",
    prioridade: tarefa.prioridade || "media",
    sla: null,
    statusSla: null,
    criadoEm: tarefa.criadoEm,
    descricao: tarefa.descricao,
    progresso: tarefa.progresso,
    sprint: tarefa.sprint,
    dataEntrega: tarefa.dataEntrega,
    anexos: tarefa.anexos || [],
  };
}

export function ProjetosView() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<ProjetosKpis>({
    ativos: 0,
    tarefasAbertas: 0,
    emAndamento: 0,
    concluidas: 0,
    atrasadas: 0,
  });
  const [projetos, setProjetos] = useState<ProjetoComTarefas[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [projetoFilter, setProjetoFilter] = useState("all");
  const [filtroKpi, setFiltroKpi] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [statusFilter, setStatusFilter] = useState("all");
  const [responsavelFilter, setResponsavelFilter] = useState("all");
  const [selectedTarefa, setSelectedTarefa] = useState<UnifiedItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editProjeto, setEditProjeto] = useState<ProjetoComTarefas | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [emTratativa, setEmTratativa] = useState(false);
  const [sortField, setSortField] = useState<SortField>("projeto");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const EM_TRATATIVA_STATUSES = ["a-fazer", "em-andamento", "bloqueado"];

  const sortedFlatTarefas = useMemo<TarefaFlat[]>(() => {
    if (!emTratativa) return [];
    let list: TarefaFlat[] = projetos.flatMap((p) =>
      p.tarefas
        .filter((t) => EM_TRATATIVA_STATUSES.includes(t.status || ""))
        .map((t) => ({ ...t, projetoNome: p.nome, projetoCor: p.cor || "#00c853" }))
    );
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.titulo.toLowerCase().includes(q) ||
          t.codigo.toLowerCase().includes(q) ||
          t.responsavel.toLowerCase().includes(q) ||
          t.projetoNome.toLowerCase().includes(q)
      );
    }
    if (responsavelFilter !== "all") {
      list = list.filter((t) => t.responsavel === responsavelFilter);
    }
    return [...list].sort((a, b) => {
      if (sortField === "prioridade") {
        const order: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };
        const diff = (order[a.prioridade || ""] ?? 4) - (order[b.prioridade || ""] ?? 4);
        return sortDir === "asc" ? diff : -diff;
      }
      if (sortField === "progresso") {
        const diff = (a.progresso ?? 0) - (b.progresso ?? 0);
        return sortDir === "asc" ? diff : -diff;
      }
      const map: Record<SortField, string> = {
        codigo: a.codigo,
        titulo: a.titulo,
        projeto: a.projetoNome,
        responsavel: a.responsavel,
        status: a.status || "",
        dataFim: a.dataEntrega || "",
        prioridade: "",
        progresso: "",
      };
      const mapB: Record<SortField, string> = {
        codigo: b.codigo,
        titulo: b.titulo,
        projeto: b.projetoNome,
        responsavel: b.responsavel,
        status: b.status || "",
        dataFim: b.dataEntrega || "",
        prioridade: "",
        progresso: "",
      };
      const cmp = map[sortField].localeCompare(mapB[sortField], "pt-BR");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [emTratativa, projetos, searchQuery, responsavelFilter, sortField, sortDir]);

  const handleSaveEdit = async (formData: ProjectEditFormData) => {
    if (!editProjeto) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/workspace/projetos/${editProjeto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      toast({ title: "Projeto atualizado com sucesso" });
      setEditOpen(false);
      const dataRes = await fetchWithAuth("/api/workspace/projetos");
      const data: WorkspaceProjetosResponse = await dataRes.json();
      setKpis(data.kpis);
      setProjetos(data.projetos);
    } catch {
      toast({ title: "Erro ao atualizar projeto", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const viewIcons: Record<ViewMode, React.ReactNode> = {
    lista: <List className="h-4 w-4" />,
    kanban: <Trello className="h-4 w-4" />,
    gantt: <BarChart3 className="h-4 w-4" />,
    calendario: <Calendar className="h-4 w-4" />,
    dashboard: <LayoutDashboard className="h-4 w-4" />,
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchWithAuth("/api/workspace/projetos")
      .then((res) => res.json())
      .then((data: WorkspaceProjetosResponse) => {
        if (cancelled) return;
        setKpis(data.kpis);
        setProjetos(data.projetos);
      })
      .catch(() => {
        if (cancelled) return;
        setKpis({ ativos: 0, tarefasAbertas: 0, emAndamento: 0, concluidas: 0, atrasadas: 0 });
        setProjetos([]);
        toast({ title: "Não foi possível carregar os dados. Tente novamente.", variant: "destructive" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDeleteTarefa = async (tarefaId: string) => {
    try {
      const res = await fetchWithAuth(`/api/workspace/tarefas/${tarefaId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir");
      toast({ title: "Atividade excluída com sucesso" });
      refreshData();
    } catch {
      toast({ title: "Erro ao excluir atividade", variant: "destructive" });
    }
  };

  const refreshData = () => {
    fetchWithAuth("/api/workspace/projetos")
      .then((res) => res.json())
      .then((data: WorkspaceProjetosResponse) => { setKpis(data.kpis); setProjetos(data.projetos); })
      .catch(() => {});
  };

  // Map KPIs to the WorkspaceKpis shape expected by KpiStrip
  const kpiStripData = {
    total: kpis.ativos,
    abertos: kpis.tarefasAbertas,
    andamento: kpis.emAndamento,
    bloqueados: 0,
    resolvidos: kpis.concluidas,
    noPrazo: 0,
    emAtraso: kpis.atrasadas,
  };

  // Derived responsaveis list
  const responsaveis = [...new Set(
    projetos.flatMap((p) => [p.responsavel, ...p.tarefas.map((t) => t.responsavel)])
  )].filter(Boolean).sort() as string[];

  // Filter projetos
  function applyKpiFilterToTarefa(tarefa: TarefaItem, kpi: string | null): boolean {
    if (!kpi || kpi === "Proj. Ativos") return true;
    if (kpi === "Tarefas Abertas") return tarefa.status === "a-fazer";
    if (kpi === "Em Andamento") return tarefa.status === "em-andamento";
    if (kpi === "Concluídas") return tarefa.status === "concluido";
    if (kpi === "Atrasadas") {
      if (!tarefa.dataEntrega) return false;
      return tarefa.status !== "concluido" && new Date(tarefa.dataEntrega) < new Date();
    }
    return true;
  }

  const filteredProjetos = projetos
    .filter((p) => projetoFilter === "all" || p.id === projetoFilter)
    .map((p) => {
      if (!searchQuery) {
        // Apply KPI filter, status filter, and responsavel filter even without search query
        const kpiFiltered = p.tarefas.filter((t) => {
          const matchKpi = applyKpiFilterToTarefa(t, filtroKpi);
          const matchStatus = statusFilter === "all" || t.status === statusFilter;
          const matchResp = responsavelFilter === "all" || t.responsavel === responsavelFilter;
          return matchKpi && matchStatus && matchResp;
        });
        const needsFilter = (filtroKpi && filtroKpi !== "Proj. Ativos") || statusFilter !== "all" || responsavelFilter !== "all";
        return needsFilter ? { ...p, tarefas: kpiFiltered } : p;
      }
      const q = searchQuery.toLowerCase();
      // Search projects by name/code too
      const projetoMatch =
        p.nome.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q);
      const tarefasFiltradas = p.tarefas.filter(
        (t) => {
          const matchKpi = applyKpiFilterToTarefa(t, filtroKpi);
          const matchStatus = statusFilter === "all" || t.status === statusFilter;
          const matchResp = responsavelFilter === "all" || t.responsavel === responsavelFilter;
          return (
            matchKpi &&
            matchStatus &&
            matchResp &&
            (t.codigo.toLowerCase().includes(q) ||
              t.titulo.toLowerCase().includes(q) ||
              t.responsavel.toLowerCase().includes(q))
          );
        },
      );
      // Show project if name matches or has matching tarefas
      if (!projetoMatch && tarefasFiltradas.length === 0) return null;
      return {
        ...p,
        tarefas: projetoMatch
          ? p.tarefas.filter((t) => {
              const matchKpi = applyKpiFilterToTarefa(t, filtroKpi);
              const matchStatus = statusFilter === "all" || t.status === statusFilter;
              const matchResp = responsavelFilter === "all" || t.responsavel === responsavelFilter;
              return matchKpi && matchStatus && matchResp;
            })
          : tarefasFiltradas,
      };
    })
    .filter((p): p is ProjetoComTarefas => p !== null);

  return (
    <div className="flex flex-col gap-4">
      {/* KPI Strip */}
      <KpiStrip
        kpis={kpiStripData}
        variant="projetos"
        loading={loading}
        activeKpi={filtroKpi}
        onKpiClick={(label) => setFiltroKpi(filtroKpi === label ? null : label)}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Em Tratativa toggle */}
        <button
          onClick={() => setEmTratativa((v) => !v)}
          className="h-8 px-3 text-xs rounded-md border transition-colors flex-shrink-0"
          style={{
            background: emTratativa ? "rgba(0,200,83,0.12)" : "transparent",
            borderColor: emTratativa ? "#00c853" : "hsl(var(--border))",
            color: emTratativa ? "#00c853" : "hsl(var(--muted-foreground))",
            fontWeight: emTratativa ? 600 : 400,
          }}
        >
          Em Tratativa
        </button>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar atividades..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Projeto filter — hidden in Em Tratativa */}
        {!emTratativa && (
          <Select value={projetoFilter} onValueChange={setProjetoFilter}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue placeholder="Projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Projetos</SelectItem>
              {projetos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Status filter — hidden in Em Tratativa */}
        {!emTratativa && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Todos Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="a-fazer">A Fazer</SelectItem>
              <SelectItem value="em-andamento">Em Andamento</SelectItem>
              <SelectItem value="bloqueado">Bloqueado</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Responsável filter */}
        <FilterCombobox
          value={responsavelFilter}
          onValueChange={setResponsavelFilter}
          options={responsaveis}
          allLabel="Todos"
          searchPlaceholder="Buscar colaborador..."
          className="w-[150px]"
        />

        {/* View mode toggle */}
        <div className="flex items-center gap-0 border border-border rounded-md overflow-hidden ml-auto">
          {(Object.keys(viewIcons) as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`p-1.5 transition-colors ${
                viewMode === mode ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              style={{
              }}
              title={mode.charAt(0).toUpperCase() + mode.slice(1)}
            >
              {viewIcons[mode]}
            </button>
          ))}
        </div>
      </div>

      {/* Content by view mode */}
      {emTratativa && (
        <div className="w-full">
          <FlatHeaderRow sortField={sortField} sortDir={sortDir} onSort={handleSort} />
          {loading ? (
            <SkeletonRows />
          ) : sortedFlatTarefas.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Nenhuma atividade em tratativa
            </div>
          ) : (
            sortedFlatTarefas.map((tarefa) => (
              <TarefaFlatRow
                key={tarefa.id}
                tarefa={tarefa}
                onClick={() => {
                  setSelectedTarefa(toUnifiedItem(tarefa, tarefa.projetoNome));
                  setDrawerOpen(true);
                }}
                onEdit={() => {
                  setSelectedTarefa(toUnifiedItem(tarefa, tarefa.projetoNome));
                  setDrawerOpen(true);
                }}
                onDelete={() => handleDeleteTarefa(tarefa.id)}
              />
            ))
          )}
        </div>
      )}
      {!emTratativa && viewMode === "lista" && (
        <div className="w-full">
          <HeaderRow />
          {loading ? (
            <SkeletonRows />
          ) : filteredProjetos.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Nenhum projeto encontrado
            </div>
          ) : (
            <>
              {filteredProjetos.map((projeto) => {
                const isCollapsed = collapsedProjects.has(projeto.id);
                return (
                  <div key={projeto.id}>
                    <ProjectGroupHeader
                      projeto={projeto}
                      collapsed={isCollapsed}
                      onToggle={() => {
                        setCollapsedProjects((prev) => {
                          const next = new Set(prev);
                          if (next.has(projeto.id)) {
                            next.delete(projeto.id);
                          } else {
                            next.add(projeto.id);
                          }
                          return next;
                        });
                      }}
                      onEdit={() => {
                        setEditProjeto(projeto);
                        setEditOpen(true);
                      }}
                    />
                    {!isCollapsed && (
                      <>
                        {projeto.tarefas.length === 0 ? (
                          <EmptyTarefasRow />
                        ) : (
                          projeto.tarefas.map((tarefa) => (
                            <TarefaRow
                              key={tarefa.id}
                              tarefa={tarefa}
                              projetoCor={projeto.cor || "#00c853"}
                              onClick={() => {
                                setSelectedTarefa(toUnifiedItem(tarefa, projeto.nome));
                                setDrawerOpen(true);
                              }}
                              onEdit={() => {
                                setSelectedTarefa(toUnifiedItem(tarefa, projeto.nome));
                                setDrawerOpen(true);
                              }}
                              onDelete={() => handleDeleteTarefa(tarefa.id)}
                            />
                          ))
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
      {!emTratativa && viewMode === "kanban" && !loading && (
        <ProjectsKanbanView
          projetos={filteredProjetos}
          onStatusChange={refreshData}
          onTarefaClick={(tarefa) => {
            setSelectedTarefa(toUnifiedItem(tarefa, tarefa.projetoNome));
            setDrawerOpen(true);
          }}
        />
      )}
      {viewMode !== "lista" && viewMode !== "kanban" && (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Visualização {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} em desenvolvimento
        </div>
      )}

      <ItemDetailDrawer
        open={drawerOpen}
        item={selectedTarefa}
        onClose={() => setDrawerOpen(false)}
        onUpdate={(updated) => {
          // Drawer só nos chama com UnifiedItem aqui (selectedTarefa é UnifiedItem | null).
          if (updated && "tipo" in updated && updated.tipo === "tarefa") {
            const u = updated as UnifiedItem;
            setSelectedTarefa(u);
            // Atualiza a lista de projetos/tarefas para refletir a edição
            // sem precisar refetch completo.
            setProjetos((prev) =>
              prev.map((p) => ({
                ...p,
                tarefas: p.tarefas.map((t) =>
                  t.id === u.id
                    ? {
                        ...t,
                        titulo: u.titulo,
                        descricao: u.descricao ?? null,
                        status: u.status,
                        prioridade: u.prioridade,
                        responsavel: u.responsavel,
                        responsavelInitials: u.responsavelInitials,
                        dataEntrega: u.dataEntrega ?? null,
                        progresso: u.progresso ?? 0,
                      }
                    : t,
                ),
              })),
            );
          }
        }}
      />
      <ProjectEditDialog
        projeto={editProjeto}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleSaveEdit}
        saving={saving}
      />
    </div>
  );
}
