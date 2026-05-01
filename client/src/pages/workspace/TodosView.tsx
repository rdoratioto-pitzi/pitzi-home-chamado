import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import {
  Search,
  List,
  Trello,
  BarChart3,
  Calendar,
  LayoutDashboard,
} from "lucide-react";
import { KpiStrip, type WorkspaceKpis } from "@/components/workspace/KpiStrip";
import { WorkspaceTable, type UnifiedItem } from "@/components/workspace/WorkspaceTable";
import { fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type TipoFilter = "todos" | "chamados" | "tarefas" | "projetos";
type ViewMode = "lista" | "kanban" | "gantt" | "calendario" | "dashboard";

interface TodosKpis {
  totalGeral: number;
  chamados: number;
  tarefas: number;
  emAndamento: number;
  resolvidos: number;
  noPrazo: number;
  emAtraso: number;
}

interface WorkspaceTodosResponse {
  kpis: TodosKpis;
  items: UnifiedItem[];
}

const tipoLabels: Record<TipoFilter, string> = {
  todos: "Todos",
  chamados: "Chamados",
  tarefas: "Tarefas",
  projetos: "Projetos",
};

const viewIcons: Record<ViewMode, React.ReactNode> = {
  lista: <List className="h-4 w-4" />,
  kanban: <Trello className="h-4 w-4" />,
  gantt: <BarChart3 className="h-4 w-4" />,
  calendario: <Calendar className="h-4 w-4" />,
  dashboard: <LayoutDashboard className="h-4 w-4" />,
};

const EMPTY_KPIS: WorkspaceKpis = {
  total: 0,
  abertos: 0,
  andamento: 0,
  bloqueados: 0,
  resolvidos: 0,
  noPrazo: 0,
  emAtraso: 0,
  chamados: 0,
  tarefas: 0,
};

export function TodosView() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<WorkspaceKpis>(EMPTY_KPIS);
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("todos");
  const [statusFilter, setStatusFilter] = useState("all");
  const [responsavelFilter, setResponsavelFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("lista");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchWithAuth("/api/workspace/todos")
      .then((res) => res.json())
      .then((data: WorkspaceTodosResponse) => {
        if (cancelled) return;
        setKpis({
          total: data.kpis.totalGeral,
          abertos: 0,
          andamento: data.kpis.emAndamento,
          bloqueados: 0,
          resolvidos: data.kpis.resolvidos,
          noPrazo: data.kpis.noPrazo,
          emAtraso: data.kpis.emAtraso,
          chamados: data.kpis.chamados,
          tarefas: data.kpis.tarefas,
        });
        setItems(data.items);
      })
      .catch(() => {
        if (cancelled) return;
        setKpis(EMPTY_KPIS);
        setItems([]);
        toast({ title: "Não foi possível carregar os dados. Tente novamente.", variant: "destructive" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Client-side filtering
  const filteredItems = items.filter((item) => {
    if (tipoFilter === "chamados" && item.tipo !== "chamado") return false;
    if (tipoFilter === "tarefas" && item.tipo !== "tarefa") return false;
    if (tipoFilter === "projetos") return false; // placeholder — no projeto tipo yet

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matches =
        item.codigo.toLowerCase().includes(q) ||
        item.titulo.toLowerCase().includes(q) ||
        item.contexto.toLowerCase().includes(q) ||
        item.responsavel.toLowerCase().includes(q);
      if (!matches) return false;
    }

    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (responsavelFilter !== "all" && item.responsavel !== responsavelFilter) return false;

    return true;
  });

  const responsaveis = [...new Set(items.map((i) => i.responsavel))].sort();

  return (
    <div className="flex flex-col gap-4">
      {/* KPI Strip */}
      <KpiStrip kpis={kpis} variant="todos" loading={loading} />

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Tipo filter */}
        <Select value={tipoFilter} onValueChange={(v) => setTipoFilter(v as TipoFilter)}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(tipoLabels) as TipoFilter[]).map((t) => (
              <SelectItem key={t} value={t}>
                {tipoLabels[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="open">Aberto</SelectItem>
            <SelectItem value="in_progress">Em Andamento</SelectItem>
            <SelectItem value="a-fazer">A Fazer</SelectItem>
            <SelectItem value="em-andamento">Em Andamento (Tarefa)</SelectItem>
            <SelectItem value="blocked">Bloqueado</SelectItem>
            <SelectItem value="resolved">Resolvido</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="closed">Fechado</SelectItem>
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
        <div
          className="flex items-center gap-0 border rounded-md overflow-hidden ml-auto"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
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

      {/* Table */}
      <WorkspaceTable
        variant="todos"
        items={filteredItems}
        loading={loading}
        onStatusChange={async (item, newStatus) => {
          try {
            const url = item.tipo === "chamado"
              ? `/api/workspace/chamados/${item.id}`
              : `/api/workspace/tarefas/${item.id}`;
            const res = await fetchWithAuth(url, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error("Erro ao atualizar status");
            setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: newStatus } : i));
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Erro desconhecido";
            toast({ title: "Erro ao atualizar status", description: msg, variant: "destructive" });
          }
        }}
        onPriorityChange={async (item, newPriority) => {
          try {
            const url = item.tipo === "chamado"
              ? `/api/workspace/chamados/${item.id}`
              : `/api/workspace/tarefas/${item.id}`;
            const res = await fetchWithAuth(url, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prioridade: newPriority }),
            });
            if (!res.ok) throw new Error("Erro ao atualizar prioridade");
            setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, prioridade: newPriority } : i));
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Erro desconhecido";
            toast({ title: "Erro ao atualizar prioridade", description: msg, variant: "destructive" });
          }
        }}
      />
    </div>
  );
}
