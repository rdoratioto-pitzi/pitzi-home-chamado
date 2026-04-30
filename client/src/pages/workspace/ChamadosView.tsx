import { useState, useEffect } from "react";
import { ItemDetailDrawer } from "@/components/workspace/ItemDetailDrawer";
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
import { WorkspaceTable, type ChamadoItem } from "@/components/workspace/WorkspaceTable";
import { KanbanView } from "@/components/workspace/KanbanView";
import { fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Periodo = "este-ano" | "mes-vigente" | "mes-anterior" | "em-tratativa";
type ViewMode = "lista" | "kanban" | "gantt" | "calendario" | "dashboard";

interface WorkspaceChamadosResponse {
  kpis: WorkspaceKpis;
  items: ChamadoItem[];
}

const periodLabels: Record<Periodo, string> = {
  "este-ano": "Este Ano",
  "mes-vigente": "Mês Vigente",
  "mes-anterior": "Mês Anterior",
  "em-tratativa": "Em Tratativa",
};

const viewIcons: Record<ViewMode, React.ReactNode> = {
  lista: <List className="h-4 w-4" />,
  kanban: <Trello className="h-4 w-4" />,
  gantt: <BarChart3 className="h-4 w-4" />,
  calendario: <Calendar className="h-4 w-4" />,
  dashboard: <LayoutDashboard className="h-4 w-4" />,
};

export function ChamadosView() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<WorkspaceKpis>({
    total: 0,
    abertos: 0,
    andamento: 0,
    bloqueados: 0,
    resolvidos: 0,
    noPrazo: 0,
    emAtraso: 0,
  });
  const [items, setItems] = useState<ChamadoItem[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>("em-tratativa");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [responsavelFilter, setResponsavelFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [selectedItem, setSelectedItem] = useState<ChamadoItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filtroKpi, setFiltroKpi] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchWithAuth(`/api/workspace/chamados?periodo=${periodo}`)
      .then((res) => res.json())
      .then((data: WorkspaceChamadosResponse) => {
        if (cancelled) return;
        setKpis(data.kpis);
        setItems(data.items);
      })
      .catch(() => {
        if (cancelled) return;
        setKpis({ total: 0, abertos: 0, andamento: 0, bloqueados: 0, resolvidos: 0, noPrazo: 0, emAtraso: 0 });
        setItems([]);
        toast({ title: "Não foi possível carregar os dados. Tente novamente.", variant: "destructive" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [periodo]);

  // KPI label → filter function
  function applyKpiFilter(item: ChamadoItem, kpi: string | null): boolean {
    if (!kpi || kpi === "Total") return true;
    if (kpi === "Abertos") return item.status === "open";
    if (kpi === "Em Andamento") return item.status === "in_progress";
    if (kpi === "Bloqueados") return item.status === "blocked";
    if (kpi === "Resolvidos") return item.status === "resolved" || item.status === "closed";
    if (kpi === "No Prazo") return item.statusSla === "dentro_prazo";
    if (kpi === "Em Atraso") return item.statusSla === "em_atraso";
    return true;
  }

  // Client-side filtering
  const filteredItems = items.filter((item) => {
    if (!applyKpiFilter(item, filtroKpi)) return false;
    // Em tratativa: ocultar resolvidos da listagem (KPI totalizador continua mostrando)
    if (periodo === "em-tratativa" && filtroKpi !== "Resolvidos" && (item.status === "resolved" || item.status === "closed")) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matches =
        item.codigo.toLowerCase().includes(q) ||
        item.titulo.toLowerCase().includes(q) ||
        item.categoria.toLowerCase().includes(q) ||
        item.responsavel.toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (responsavelFilter !== "all" && item.responsavel !== responsavelFilter) return false;
    return true;
  });

  // Unique responsaveis for filter
  const responsaveis = [...new Set(items.map((i) => i.responsavel))].sort();

  return (
    <div className="flex flex-col gap-4">
      {/* KPI Strip */}
      <KpiStrip
        kpis={kpis}
        variant="chamados"
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
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Period toggle */}
        <div className="flex items-center gap-0 border rounded-md overflow-hidden" style={{ borderColor: "var(--sep)" }}>
          {(Object.keys(periodLabels) as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: periodo === p ? "rgba(0,200,83,0.15)" : "transparent",
                color: periodo === p ? "#00c853" : "var(--l2)",
              }}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="open">Aberto</SelectItem>
            <SelectItem value="in_progress">Em Andamento</SelectItem>
            <SelectItem value="blocked">Bloqueado</SelectItem>
            <SelectItem value="resolved">Resolvido</SelectItem>
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
        <div className="flex items-center gap-0 border rounded-md overflow-hidden ml-auto" style={{ borderColor: "var(--sep)" }}>
          {(Object.keys(viewIcons) as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="p-1.5 transition-colors"
              style={{
                background: viewMode === mode ? "rgba(0,200,83,0.15)" : "transparent",
                color: viewMode === mode ? "#00c853" : "var(--l3)",
              }}
              title={mode.charAt(0).toUpperCase() + mode.slice(1)}
            >
              {viewIcons[mode]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {viewMode === "lista" && (
        <>
          <WorkspaceTable
            items={filteredItems}
            loading={loading}
            onRowClick={(item) => { setSelectedItem(item); setDrawerOpen(true); }}
            onDelete={async (item) => {
              if (!confirm(`Excluir chamado ${item.codigo}?`)) return;
              try {
                const res = await fetchWithAuth(`/api/tickets/${item.id}`, { method: "DELETE" });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({ error: "Erro ao excluir" }));
                  throw new Error(err.error || "Erro ao excluir");
                }
                setItems((prev) => prev.filter((i) => i.id !== item.id));
                toast({ title: `Chamado ${item.codigo} excluído` });
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Erro desconhecido";
                toast({ title: "Erro ao excluir", description: msg, variant: "destructive" });
              }
            }}
          />
          <ItemDetailDrawer
            open={drawerOpen}
            item={selectedItem}
            onClose={() => setDrawerOpen(false)}
            onUpdate={(updated) => {
              // Em ChamadosView, o drawer só lida com chamados; cast seguro.
              const ch = updated as ChamadoItem;
              setItems((prev) => prev.map((i) => (i.id === ch.id ? ch : i)));
              setSelectedItem(ch);
            }}
          />
        </>
      )}
      {viewMode === "kanban" && !loading && (
        <KanbanView
          items={filteredItems}
          variant="chamados"
          onStatusChange={async (itemId, newStatus) => {
            try {
              const res = await fetchWithAuth(`/api/workspace/chamados/${itemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
              });
              if (!res.ok) throw new Error("Erro ao atualizar");
              const updated: ChamadoItem = await res.json();
              setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i));
            } catch {
              toast({ title: "Erro ao mover chamado", variant: "destructive" });
            }
          }}
        />
      )}
      {viewMode !== "lista" && viewMode !== "kanban" && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--l3)", fontSize: "14px" }}>
          Visualização {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} em desenvolvimento
        </div>
      )}
    </div>
  );
}
