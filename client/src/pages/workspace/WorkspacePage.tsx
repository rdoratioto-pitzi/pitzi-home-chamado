import { useState, useCallback, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus, BarChart3 } from "lucide-react";
import { TodosView } from "./TodosView";
import { ChamadosView } from "./ChamadosView";
import { ProjetosView } from "./ProjetosView";
import { VisaoEstrategica } from "@/components/workspace/VisaoEstrategica";
import { NovoItemModal, type ItemType } from "@/components/workspace/NovoItemModal";
import { fetchWithAuth } from "@/lib/queryClient";

type TabKey = "todos" | "chamados" | "projetos";

interface TopbarActionsProps {
  activeTab: TabKey;
  onVisaoEstrategica?: () => void;
  onNewItem: (type: ItemType) => void;
}

function TopbarActions({ activeTab, onVisaoEstrategica, onNewItem }: TopbarActionsProps) {
  if (activeTab === "chamados") {
    return (
      <Button
        size="sm"
        className="bg-[#00a137] hover:bg-[#00a137]/90 text-white"
        onClick={() => onNewItem("chamado")}
      >
        <Plus className="h-4 w-4 mr-1" />
        Novo Chamado
      </Button>
    );
  }

  if (activeTab === "projetos") {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="border-[#00c853] text-[#00c853] hover:bg-[#00c853]/10"
          onClick={() => onNewItem("tarefa")}
        >
          <Plus className="h-4 w-4 mr-1" />
          Nova Tarefa
        </Button>
        <Button
          size="sm"
          className="bg-[#00a137] hover:bg-[#00a137]/90 text-white"
          onClick={() => onNewItem("projeto")}
        >
          <Plus className="h-4 w-4 mr-1" />
          Novo Projeto
        </Button>
        <div className="h-6 w-px bg-border/40" />
        <Button size="sm" variant="outline" onClick={onVisaoEstrategica}>
          <BarChart3 className="h-4 w-4 mr-1" />
          Visão Estratégica
        </Button>
      </div>
    );
  }

  // Tab "Todos"
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="border-[#00c853] text-[#00c853] hover:bg-[#00c853]/10"
        onClick={() => onNewItem("chamado")}
      >
        <Plus className="h-4 w-4 mr-1" />
        Chamado
      </Button>
      <Button size="sm" variant="outline" onClick={() => onNewItem("tarefa")}>
        <Plus className="h-4 w-4 mr-1" />
        Nova Tarefa
      </Button>
      <Button
        size="sm"
        className="bg-[#00a137] hover:bg-[#00a137]/90 text-white"
        onClick={() => onNewItem("projeto")}
      >
        <Plus className="h-4 w-4 mr-1" />
        Projeto
      </Button>
    </div>
  );
}

const viewMap: Record<TabKey, React.ComponentType> = {
  todos: TodosView,
  chamados: ChamadosView,
  projetos: ProjetosView,
};

export default function WorkspacePage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/workspace/:tab");
  const activeTab: TabKey = (params?.tab as TabKey) || "todos";
  const ActiveView = viewMap[activeTab] ?? viewMap.todos;

  const [tabCounts, setTabCounts] = useState({ todos: 0, chamados: 0, projetos: 0 });

  useEffect(() => {
    Promise.allSettled([
      fetchWithAuth("/api/workspace/chamados?periodo=em-tratativa").then(r => r.json()),
      fetchWithAuth("/api/workspace/projetos").then(r => r.json()),
    ]).then(([chamadosRes, projetosRes]) => {
      const chamados = chamadosRes.status === "fulfilled" ? (chamadosRes.value.kpis?.total ?? 0) : 0;
      const projetos = projetosRes.status === "fulfilled" ? (projetosRes.value.kpis?.ativos ?? 0) : 0;
      setTabCounts({ todos: chamados + projetos, chamados, projetos });
    });
  }, []);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: tabCounts.todos },
    { key: "chamados", label: "Chamados", count: tabCounts.chamados },
    { key: "projetos", label: "Projetos", count: tabCounts.projetos },
  ];

  const [visaoOpen, setVisaoOpen] = useState(false);
  const [visaoData, setVisaoData] = useState<{ projetos: any[]; kpis: any }>({
    projetos: [],
    kpis: { ativos: 0, tarefasAbertas: 0, emAndamento: 0, concluidas: 0, atrasadas: 0 },
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ItemType>("chamado");
  const [viewRefreshKey, setViewRefreshKey] = useState(0);

  const handleOpenVisao = () => {
    fetchWithAuth("/api/workspace/projetos")
      .then((res) => res.json())
      .then((data) => {
        setVisaoData({ projetos: data.projetos, kpis: data.kpis });
        setVisaoOpen(true);
      })
      .catch(() => setVisaoOpen(true));
  };

  const handleNewItem = useCallback((type: ItemType) => {
    setModalType(type);
    setModalOpen(true);
  }, []);

  const handleModalSuccess = useCallback(() => {
    setViewRefreshKey((k) => k + 1);
  }, []);

  const handleTabClick = (key: TabKey) => {
    setLocation(key === "todos" ? "/workspace" : `/workspace/${key}`);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Workspace"
        breadcrumbs={[
          { label: "Renov Home", href: "/" },
          { label: "Workspace" },
        ]}
        actions={
          <TopbarActions
            activeTab={activeTab}
            onVisaoEstrategica={handleOpenVisao}
            onNewItem={handleNewItem}
          />
        }
      />

      <NovoItemModal
        open={modalOpen}
        defaultType={modalType}
        onClose={() => setModalOpen(false)}
        onSuccess={handleModalSuccess}
      />

      <VisaoEstrategica
        open={visaoOpen}
        projetos={visaoData.projetos}
        kpis={visaoData.kpis}
        onClose={() => setVisaoOpen(false)}
      />

      {/* Tabs */}
      <div className="flex items-center gap-0 px-6 border-b" style={{ borderColor: "var(--sep)" }}>
        {tabs.map((tab, idx) => {
          const isActive = tab.key === activeTab;
          return (
            <div key={tab.key} className="flex items-center">
              {/* Divisor sutil antes de "Chamados" (após "Todos") */}
              {idx === 1 && (
                <div className="h-5 w-px bg-border/30 mx-1" />
              )}
              <button
                onClick={() => handleTabClick(tab.key)}
                className="relative px-4 py-3 text-sm font-medium transition-colors"
                style={{
                  color: isActive ? "#00c853" : "rgba(255,255,255,0.3)",
                  borderBottom: isActive ? "2px solid #00c853" : "2px solid transparent",
                }}
              >
                {tab.label}
                <span
                  className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    background: isActive ? "rgba(0,200,83,0.15)" : "rgba(255,255,255,0.05)",
                    color: isActive ? "#00c853" : "rgba(255,255,255,0.3)",
                  }}
                >
                  {tab.count}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <ActiveView key={viewRefreshKey} />
      </div>
    </div>
  );
}
