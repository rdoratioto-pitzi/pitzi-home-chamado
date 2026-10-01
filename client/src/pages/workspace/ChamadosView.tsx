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
import { TICKET_STATUSES } from "@shared/ticket-options";
import { claimDenial, type QueueViewer } from "@shared/ticket-queue";
import { useAuth } from "@/contexts/auth-context";
import { useSupportGroups } from "@/hooks/use-support-groups";
import { TransferirChamadoDialog } from "@/components/workspace/TransferirChamadoDialog";
import { useKnowledgePrompt } from "@/components/knowledge/knowledge-prompt";
import { useIsTechnician } from "@/hooks/use-is-technician";

type Periodo = "este-ano" | "mes-vigente" | "mes-anterior" | "em-tratativa";
type ViewMode = "lista" | "kanban" | "gantt" | "calendario" | "dashboard";
type Escopo = "meus" | "fila";
type FiltroFila = "sem-responsavel" | "todos";

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

const escopoLabels: Record<Escopo, string> = {
  meus: "Meus Chamados",
  fila: "Fila do Grupo",
};

const filtroFilaLabels: Record<FiltroFila, string> = {
  "sem-responsavel": "Sem Responsável",
  todos: "Todos",
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
  // Popup "virar artigo" ao resolver/fechar (lista, kanban e gaveta).
  const knowledgePrompt = useKnowledgePrompt();
  const { user } = useAuth();
  const { groups } = useSupportGroups();
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
  const [escopo, setEscopo] = useState<Escopo>("meus");
  // Fila do Grupo é de quem atende: só técnicos (e admins) veem o seletor.
  const isTech = useIsTechnician();
  const [filtroFila, setFiltroFila] = useState<FiltroFila>("sem-responsavel");
  const [transferItem, setTransferItem] = useState<ChamadoItem | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const queueViewer: QueueViewer = {
    userId: user?.id ?? "",
    isAdmin: user?.isAdmin === true,
    groupKeys: groups.filter((g) => user && g.memberIds.includes(user.id)).map((g) => g.key),
  };
  const canClaim = (item: ChamadoItem) =>
    claimDenial(queueViewer, { category: item.categoria, assigneeId: item.responsavelId ?? null, status: item.status }) === null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const escopoParam = escopo === "fila" ? "&escopo=fila" : "";
    fetchWithAuth(`/api/workspace/chamados?periodo=${periodo}${escopoParam}`)
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
  }, [periodo, escopo, reloadKey]);

  async function postQueueAction(url: string, body: unknown, erro: string): Promise<boolean> {
    try {
      const res = await fetchWithAuth(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: erro }));
        throw new Error(err.error || erro);
      }
      setReloadKey((k) => k + 1);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: erro, description: msg, variant: "destructive" });
      return false;
    }
  }

  async function handleClaim(item: ChamadoItem) {
    if (await postQueueAction(`/api/tickets/${item.id}/assumir`, {}, "Erro ao assumir chamado")) {
      toast({ title: `Chamado ${item.codigo} assumido` });
    }
  }

  async function handleTransfer(item: ChamadoItem, category: string, assigneeId: string | null) {
    if (await postQueueAction(`/api/tickets/${item.id}/transferir`, { category, assigneeId }, "Erro ao transferir chamado")) {
      toast({ title: `Chamado ${item.codigo} transferido` });
      setTransferItem(null);
    }
  }

  // KPI label → filter function
  function applyKpiFilter(item: ChamadoItem, kpi: string | null): boolean {
    if (!kpi || kpi === "Total") return true;
    if (kpi === "Abertos") return item.status === "open" || item.status === "triage";
    if (kpi === "Em Andamento") return item.status === "in_progress";
    if (kpi === "Bloqueados") return item.status === "blocked" || item.status === "waiting_requester";
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
    if (escopo === "fila" && filtroFila === "sem-responsavel" && item.responsavelId) return false;
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

        {/* Escopo: meus chamados ou fila dos grupos do usuário (só técnicos) */}
        {isTech && (
        <div className="flex items-center gap-0 border rounded-md overflow-hidden" style={{ borderColor: "var(--sep)" }}>
          {(Object.keys(escopoLabels) as Escopo[]).map((e) => (
            <button
              key={e}
              onClick={() => setEscopo(e)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              data-testid={`button-escopo-${e}`}
              style={{
                background: escopo === e ? "rgba(59,66,222,0.15)" : "transparent",
                color: escopo === e ? "#5B62EC" : "var(--l2)",
              }}
            >
              {escopoLabels[e]}
            </button>
          ))}
        </div>
        )}

        {escopo === "fila" && (
          <div className="flex items-center gap-0 border rounded-md overflow-hidden" style={{ borderColor: "var(--sep)" }}>
            {(Object.keys(filtroFilaLabels) as FiltroFila[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltroFila(f)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                data-testid={`button-fila-${f}`}
                style={{
                  background: filtroFila === f ? "rgba(59,66,222,0.15)" : "transparent",
                  color: filtroFila === f ? "#5B62EC" : "var(--l2)",
                }}
              >
                {filtroFilaLabels[f]}
              </button>
            ))}
          </div>
        )}

        {/* Period toggle */}
        <div className="flex items-center gap-0 border rounded-md overflow-hidden" style={{ borderColor: "var(--sep)" }}>
          {(Object.keys(periodLabels) as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: periodo === p ? "rgba(59,66,222,0.15)" : "transparent",
                color: periodo === p ? "#5B62EC" : "var(--l2)",
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
            {TICKET_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
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
                background: viewMode === mode ? "rgba(59,66,222,0.15)" : "transparent",
                color: viewMode === mode ? "#5B62EC" : "var(--l3)",
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
        <WorkspaceTable
          items={filteredItems}
          loading={loading}
          onRowClick={(item) => { setSelectedItem(item); setDrawerOpen(true); }}
          onClaim={escopo === "fila" ? handleClaim : undefined}
          canClaim={canClaim}
          onTransfer={escopo === "fila" ? setTransferItem : undefined}
          onStatusChange={async (item, newStatus) => {
            try {
              const res = await fetchWithAuth(`/api/workspace/chamados/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
              });
              if (!res.ok) throw new Error("Erro ao atualizar status");
              const updated: ChamadoItem = await res.json();
              setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
              knowledgePrompt.maybeAsk(updated.id, updated.solicitanteId, item.status, updated.status);
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Erro desconhecido";
              toast({ title: "Erro ao atualizar status", description: msg, variant: "destructive" });
            }
          }}
          onPriorityChange={async (item, newPriority) => {
            try {
              const res = await fetchWithAuth(`/api/workspace/chamados/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prioridade: newPriority }),
              });
              if (!res.ok) throw new Error("Erro ao atualizar prioridade");
              const updated: ChamadoItem = await res.json();
              setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Erro desconhecido";
              toast({ title: "Erro ao atualizar prioridade", description: msg, variant: "destructive" });
            }
          }}
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
      )}
      {viewMode === "kanban" && !loading && (
        <KanbanView
          items={filteredItems}
          variant="chamados"
          onItemClick={(item) => { setSelectedItem(item as ChamadoItem); setDrawerOpen(true); }}
          onStatusChange={async (itemId, newStatus) => {
            try {
              const res = await fetchWithAuth(`/api/workspace/chamados/${itemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
              });
              if (!res.ok) throw new Error("Erro ao atualizar");
              const updated: ChamadoItem = await res.json();
              const before = items.find((i) => i.id === itemId);
              setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i));
              knowledgePrompt.maybeAsk(updated.id, updated.solicitanteId, before?.status, updated.status);
            } catch {
              toast({ title: "Erro ao mover chamado", variant: "destructive" });
            }
          }}
        />
      )}
      {(viewMode === "lista" || viewMode === "kanban") && (
        <ItemDetailDrawer
          open={drawerOpen}
          item={selectedItem}
          onClose={() => setDrawerOpen(false)}
          onUpdate={(updated) => {
            const ch = updated as ChamadoItem;
            const before = items.find((i) => i.id === ch.id);
            setItems((prev) => prev.map((i) => (i.id === ch.id ? ch : i)));
            setSelectedItem(ch);
            knowledgePrompt.maybeAsk(ch.id, ch.solicitanteId, before?.status, ch.status);
          }}
          onDelete={(id) => {
            setItems((prev) => prev.filter((i) => i.id !== id));
          }}
        />
      )}
      {knowledgePrompt.dialog}
      <TransferirChamadoDialog
        item={transferItem}
        onClose={() => setTransferItem(null)}
        onConfirm={handleTransfer}
      />
      {viewMode !== "lista" && viewMode !== "kanban" && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--l3)", fontSize: "14px" }}>
          Visualização {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} em desenvolvimento
        </div>
      )}
    </div>
  );
}
