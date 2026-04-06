import { useState, useEffect } from "react";
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
import { Search, List, Trello, BarChart3, Calendar, LayoutDashboard, Pencil, ChevronRight, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { KpiStrip } from "@/components/workspace/KpiStrip";
import { ItemDetailDrawer } from "@/components/workspace/ItemDetailDrawer";
import type { UnifiedItem } from "@/components/workspace/WorkspaceTable";
import { fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  criadoEm: string | null;
  tarefas: TarefaItem[];
}

interface WorkspaceProjetosResponse {
  kpis: ProjetosKpis;
  projetos: ProjetoComTarefas[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

type ViewMode = "lista" | "kanban" | "gantt" | "calendario" | "dashboard";

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
  backlog: "rgba(255,255,255,0.25)",
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
      className="flex items-center gap-2 px-4 py-2 group cursor-pointer select-none"
      style={{ background: "rgba(255,255,255,0.02)" }}
      onClick={onToggle}
    >
      <ChevronRight
        size={14}
        className="transition-transform duration-200 flex-shrink-0"
        style={{
          color: "rgba(255,255,255,0.3)",
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
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          textTransform: "uppercase",
          fontSize: "10px",
          letterSpacing: "0.05em",
          color: "rgba(255,255,255,0.5)",
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
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "10px",
          color: "rgba(255,255,255,0.2)",
        }}
      >
        {projeto.codigo}
      </span>
      {collapsed && tarefaCount > 0 && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.35)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {tarefaCount} {tarefaCount === 1 ? "atividade" : "atividades"}
        </span>
      )}
      {onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
          title="Editar projeto"
        >
          <Pencil size={12} style={{ color: "rgba(255,255,255,0.5)" }} />
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
      className="grid items-center px-4 py-2 gap-2"
      style={{
        gridTemplateColumns: "96px 1fr 175px 100px 115px 110px 62px 88px 88px 30px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {headers.map((h, i) => (
        <span
          key={i}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: "uppercase",
            fontSize: "9px",
            letterSpacing: "0.05em",
            color: "rgba(255,255,255,0.25)",
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
    <div
      className="flex items-center px-4 py-3"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
    >
      <span className="text-xs italic" style={{ color: "rgba(255,255,255,0.2)", paddingLeft: 18 }}>
        Nenhuma atividade neste projeto
      </span>
    </div>
  );
}

function TarefaRow({ tarefa, projetoCor, onClick, onEdit, onDelete }: { tarefa: TarefaItem; projetoCor: string; onClick?: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const status = tarefa.status || "a-fazer";
  const dotColor = statusDotColors[status] || "rgba(255,255,255,0.2)";
  const prioridade = tarefa.prioridade || "media";
  const prioColor = priorityColors[prioridade] || priorityColors.media;
  const prog = tarefa.progresso ?? 0;

  const dataInicio = tarefa.criadoEm
    ? new Date(tarefa.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : "—";

  return (
    <div
      className="group grid items-center px-4 py-2.5 gap-2 transition-colors cursor-pointer"
      onClick={onClick}
      style={{
        gridTemplateColumns: "96px 1fr 175px 100px 115px 110px 62px 88px 88px 30px",
        borderBottom: "1px solid rgba(255,255,255,0.03)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#141814")}
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
      <span className="text-sm truncate" style={{ color: "rgba(255,255,255,0.85)" }}>
        {tarefa.titulo}
      </span>

      {/* Categoria / Tipo */}
      <div className="flex items-center gap-1.5 min-w-0 truncate">
        <span className="text-xs truncate" style={{ color: projetoCor, opacity: 0.7 }}>
          {tarefa.sprint || "—"}
        </span>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border bg-slate-500/10 text-slate-400">
          atividade
        </Badge>
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
          <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
            {tarefa.responsavel}
          </span>
        )}
      </div>

      {/* Status */}
      <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
        {statusLabels[status] || status}
      </span>

      {/* Prioridade */}
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${prioColor}`}>
        {priorityLabels[prioridade] || prioridade}
      </Badge>

      {/* Progresso */}
      <div className="flex items-center gap-1">
        <div style={{ width: 56, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
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

function ProjectsKanbanView({ projetos, onStatusChange }: { projetos: ProjetoComTarefas[]; onStatusChange?: () => void }) {
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
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  textTransform: "uppercase",
                  fontSize: "10px",
                  letterSpacing: "0.05em",
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                {col.label}
              </span>
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.06)", color: "#00c853", fontSize: "10px" }}
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
                  className="p-3 rounded cursor-grab active:cursor-grabbing"
                  style={{
                    background: draggingId === t.id ? "rgba(0,200,83,0.1)" : "rgba(255,255,255,0.03)",
                    border: draggingId === t.id ? "1px solid rgba(0,200,83,0.3)" : "1px solid rgba(255,255,255,0.06)",
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
                  <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.8)" }}>
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
                        className="flex items-center justify-center rounded-full text-[10px] font-semibold"
                        style={{ width: 22, height: 22, background: "rgba(0,200,83,0.15)", color: "#00c853" }}
                      >
                        {t.responsavelInitials}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {columnTarefas.length === 0 && (
                <div
                  className="p-4 rounded text-center text-xs italic"
                  style={{
                    background: isOver ? "rgba(0,200,83,0.05)" : "rgba(255,255,255,0.01)",
                    border: "1px dashed rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.2)",
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
  dataInicio: string;
  dataFim: string;
  cor: string;
  progresso: number;
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
  const [responsavelId, setResponsavelId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [cor, setCor] = useState("#00c853");
  const [progresso, setProgresso] = useState(0);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (projeto) {
      setNome(projeto.nome);
      setDescricao(projeto.descricao || "");
      setStatus(projeto.status || "backlog");
      setPrioridade(projeto.prioridade || "media");
      setCategoria(projeto.categoria || "");
      setCor(projeto.cor || "#00c853");
      setProgresso(projeto.progresso ?? 0);
      setDataInicio(projeto.dataInicio ? projeto.dataInicio.split("T")[0] : "");
      setDataFim(projeto.dataFim ? projeto.dataFim.split("T")[0] : "");
      setResponsavelId("");
    }
  }, [projeto]);

  useEffect(() => {
    if (!open) return;
    fetchWithAuth("/api/users")
      .then((r) => r.json())
      .then((data: Array<{ id: string; name: string }>) => setUsers(data || []))
      .catch(() => {});
  }, [open]);

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
                  <SelectItem value="">Manter atual ({projeto?.responsavel})</SelectItem>
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
              responsavelId: responsavelId || undefined,
              dataInicio, dataFim, cor, progresso,
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

        {/* Projeto filter */}
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

        {/* Status filter */}
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
        <div className="flex items-center gap-0 border rounded-md overflow-hidden ml-auto" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          {(Object.keys(viewIcons) as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="p-1.5 transition-colors"
              style={{
                background: viewMode === mode ? "rgba(0,200,83,0.15)" : "transparent",
                color: viewMode === mode ? "#00c853" : "rgba(255,255,255,0.3)",
              }}
              title={mode.charAt(0).toUpperCase() + mode.slice(1)}
            >
              {viewIcons[mode]}
            </button>
          ))}
        </div>
      </div>

      {/* Content by view mode */}
      {viewMode === "lista" && (
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
      {viewMode === "kanban" && !loading && (
        <ProjectsKanbanView projetos={filteredProjetos} onStatusChange={refreshData} />
      )}
      {viewMode !== "lista" && viewMode !== "kanban" && (
        <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "14px" }}>
          Visualização {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} em desenvolvimento
        </div>
      )}

      <ItemDetailDrawer
        open={drawerOpen}
        item={selectedTarefa}
        onClose={() => setDrawerOpen(false)}
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
