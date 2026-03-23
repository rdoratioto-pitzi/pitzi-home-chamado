import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { fetchWithAuth } from "@/lib/queryClient";

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
  const [periodo, setPeriodo] = useState<Periodo>("este-ano");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [responsavelFilter, setResponsavelFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("lista");

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
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [periodo]);

  // Client-side filtering
  const filteredItems = items.filter((item) => {
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
      <KpiStrip kpis={kpis} variant="chamados" loading={loading} />

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
        <div className="flex items-center gap-0 border rounded-md overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          {(Object.keys(periodLabels) as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: periodo === p ? "rgba(0,200,83,0.15)" : "transparent",
                color: periodo === p ? "#00c853" : "rgba(255,255,255,0.4)",
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
        <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {responsaveis.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

      {/* Table */}
      <WorkspaceTable items={filteredItems} loading={loading} />
    </div>
  );
}
