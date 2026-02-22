import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/app-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw, LayoutDashboard, Table2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Types
export interface GitRepository {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  isActive: boolean;
  syncEnabled: boolean;
  lastSyncAt: string | null;
}

export interface GitAnalyticsStats {
  totalCommits: number;
  totalPRs: number;
  totalPRsMerged: number;
  totalPRsOpen: number;
  totalDevelopers: number;
  commitsByType: Record<string, number>;
  securityAlerts: {
    total: number;
    bySeverity: Record<string, number>;
  };
}

export default function GitAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "detailed">("dashboard");
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  // Fetch repositories
  const { data: repositories = [] } = useQuery<GitRepository[]>({
    queryKey: ["/api/git-analytics/repositories"],
  });

  // Fetch stats
  const { data: stats, refetch: refetchStats } = useQuery<GitAnalyticsStats>({
    queryKey: ["/api/git-analytics/stats"],
  });

  // Sync handler
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await apiRequest("POST", "/api/git-analytics/sync");
      await refetchStats();
      toast({ title: "Sincronização concluída!", description: "Dados atualizados com sucesso." });
    } catch (error) {
      toast({ title: "Erro na sincronização", description: String(error), variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <AppHeader
        title="Git Analytics"
        subtitle="Governança de código, produtividade e segurança"
        breadcrumbs={[{ label: "Git Analytics" }]}
      />

      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header com tabs e botão sync */}
          <div className="flex items-center justify-between">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "dashboard" | "detailed")}>
              <TabsList>
                <TabsTrigger value="dashboard" className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="detailed" className="flex items-center gap-2">
                  <Table2 className="h-4 w-4" />
                  Detalhado
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              variant="outline"
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Sincronizando..." : "Sincronizar"}
            </Button>
          </div>

          {/* Content */}
          {activeTab === "dashboard" ? (
            <DashboardView stats={stats} repositories={repositories} />
          ) : (
            <DetailedView />
          )}
        </div>
      </div>
    </div>
  );
}

// Placeholder components - serão expandidos nos próximos prompts
function DashboardView({ stats, repositories }: { stats?: GitAnalyticsStats; repositories: GitRepository[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-card rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Total Commits</p>
          <p className="text-3xl font-bold">{stats?.totalCommits || 0}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Pull Requests</p>
          <p className="text-3xl font-bold">{stats?.totalPRs || 0}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">PRs Merged</p>
          <p className="text-3xl font-bold text-green-600">{stats?.totalPRsMerged || 0}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">PRs Open</p>
          <p className="text-3xl font-bold text-amber-600">{stats?.totalPRsOpen || 0}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Desenvolvedores</p>
          <p className="text-3xl font-bold">{stats?.totalDevelopers || 0}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Repositórios</p>
          <p className="text-3xl font-bold">{repositories.length}</p>
        </div>
      </div>
      <p className="text-muted-foreground text-center py-8">Dashboard completo será implementado nos próximos passos...</p>
    </div>
  );
}

function DetailedView() {
  return (
    <div className="text-center py-8 text-muted-foreground">
      Visão detalhada será implementada nos próximos passos...
    </div>
  );
}
