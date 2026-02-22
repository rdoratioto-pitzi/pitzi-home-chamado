import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, LayoutDashboard, Table2, GitPullRequest, GitCommit, 
  Users, TrendingUp, Shield, GitBranch, Zap, Bug, Wrench, AlertTriangle 
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { KPICard, KPI_HELP_TEXTS } from "./components/KPICard";
import { TYPE_COLORS, TYPE_LABELS } from "./components/Badges";
import { TypeDistributionChart } from "./components/TypeDistributionChart";
import { VolumeByDayCharts, VolumeByMonthCharts } from "./components/VolumeCharts";

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

export interface DeveloperStats {
  name: string;
  email: string | null;
  avatarUrl: string | null;
  commits: number;
  additions: number;
  deletions: number;
  prs: number;
  prsMerged: number;
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

  // Fetch developer stats
  const { data: developerStats = [] } = useQuery<DeveloperStats[]>({
    queryKey: ["/api/git-analytics/developer-stats"],
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

  // Calcular métricas
  const totalCommits = stats?.totalCommits || 0;
  const commitsByType = stats?.commitsByType || {};
  const features = commitsByType.feature || 0;
  const bugfixes = commitsByType.bugfix || 0;
  const improvements = commitsByType.improvement || 0;
  const refactorDocs = (commitsByType.refactor || 0) + (commitsByType.docs || 0);
  
  const bugRate = totalCommits > 0 ? ((bugfixes / totalCommits) * 100).toFixed(1) : "0";
  const frequency = totalCommits > 0 ? (totalCommits / 30).toFixed(1) : "0";

  const featuresPercent = totalCommits > 0 ? ((features / totalCommits) * 100).toFixed(0) : "0";
  const bugfixesPercent = totalCommits > 0 ? ((bugfixes / totalCommits) * 100).toFixed(0) : "0";
  const improvementsPercent = totalCommits > 0 ? ((improvements / totalCommits) * 100).toFixed(0) : "0";
  const refactorDocsPercent = totalCommits > 0 ? ((refactorDocs / totalCommits) * 100).toFixed(0) : "0";

  const securityTotal = stats?.securityAlerts?.total || 0;
  const securityHigh = stats?.securityAlerts?.bySeverity?.high || 0;
  const securityLow = stats?.securityAlerts?.bySeverity?.low || 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <PageHeader
        title="Git Analytics"
        description="Governança de código, produtividade e segurança"
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
            <DashboardView 
              stats={stats} 
              repositories={repositories}
              developerStats={developerStats}
              totalCommits={totalCommits}
              features={features}
              bugfixes={bugfixes}
              improvements={improvements}
              refactorDocs={refactorDocs}
              bugRate={bugRate}
              frequency={frequency}
              featuresPercent={featuresPercent}
              bugfixesPercent={bugfixesPercent}
              improvementsPercent={improvementsPercent}
              refactorDocsPercent={refactorDocsPercent}
              securityTotal={securityTotal}
              securityHigh={securityHigh}
              securityLow={securityLow}
            />
          ) : (
            <DetailedView />
          )}
        </div>
      </div>
    </div>
  );
}

interface DashboardViewProps {
  stats?: GitAnalyticsStats;
  repositories: GitRepository[];
  developerStats: DeveloperStats[];
  totalCommits: number;
  features: number;
  bugfixes: number;
  improvements: number;
  refactorDocs: number;
  bugRate: string;
  frequency: string;
  featuresPercent: string;
  bugfixesPercent: string;
  improvementsPercent: string;
  refactorDocsPercent: string;
  securityTotal: number;
  securityHigh: number;
  securityLow: number;
}

function DashboardView({
  stats,
  repositories,
  developerStats,
  totalCommits,
  features,
  bugfixes,
  improvements,
  refactorDocs,
  bugRate,
  frequency,
  featuresPercent,
  bugfixesPercent,
  improvementsPercent,
  refactorDocsPercent,
  securityTotal,
  securityHigh,
  securityLow,
}: DashboardViewProps) {
  return (
    <div className="space-y-6">
      {/* KPIs Row 1 - Métricas principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          title="Pull Requests"
          value={stats?.totalPRs || 0}
          subtitle={`${stats?.totalPRsMerged || 0} merged • ${stats?.totalPRsOpen || 0} open`}
          icon={GitPullRequest}
          helpText={KPI_HELP_TEXTS.pullRequests}
          highlight
        />
        <KPICard
          title="Total Commits"
          value={totalCommits}
          subtitle="Últimos 30 dias"
          icon={GitCommit}
          helpText={KPI_HELP_TEXTS.commits}
        />
        <KPICard
          title="Desenvolvedores"
          value={stats?.totalDevelopers || 0}
          subtitle="Ativos no período"
          icon={Users}
          helpText={KPI_HELP_TEXTS.developers}
        />
        <KPICard
          title="Frequência"
          value={frequency}
          subtitle="Commits/dia"
          icon={TrendingUp}
          helpText={KPI_HELP_TEXTS.frequency}
        />
        <KPICard
          title="Vulnerabilidades"
          value={securityTotal}
          subtitle={securityTotal > 0 ? `${securityHigh} high • ${securityLow} low` : "Nenhuma detectada"}
          icon={Shield}
          helpText={KPI_HELP_TEXTS.vulnerabilities}
          alert={securityTotal > 0}
          clickable={securityTotal > 0}
        />
        <KPICard
          title="Repositórios"
          value={repositories.length}
          subtitle="Conectados"
          icon={GitBranch}
          helpText={KPI_HELP_TEXTS.repositories}
        />
      </div>

      {/* KPIs Row 2 - Por tipo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Features"
          value={features}
          subtitle={`${featuresPercent}% do total de commits`}
          icon={Zap}
          helpText={KPI_HELP_TEXTS.features}
        />
        <KPICard
          title="Correções"
          value={bugfixes}
          subtitle={`${bugfixesPercent}% do total (Bug Rate)`}
          icon={Bug}
          helpText={KPI_HELP_TEXTS.corrections}
        />
        <KPICard
          title="Melhorias"
          value={improvements}
          subtitle={`${improvementsPercent}% do total de commits`}
          icon={Wrench}
          helpText={KPI_HELP_TEXTS.improvements}
        />
        <KPICard
          title="Refatoração + Docs"
          value={refactorDocs}
          subtitle={`${refactorDocsPercent}% do total de commits`}
          icon={GitBranch}
          helpText={KPI_HELP_TEXTS.refactorDocs}
        />
      </div>

      {/* Security Alert Banner */}
      {securityTotal > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">
                {securityTotal} vulnerabilidade{securityTotal > 1 ? "s" : ""} de segurança detectada{securityTotal > 1 ? "s" : ""}
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {securityHigh > 0 && `${securityHigh} high severity`}
                {securityHigh > 0 && securityLow > 0 && " • "}
                {securityLow > 0 && `${securityLow} low severity`}
              </p>
            </div>
          </div>
          <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
            Ver Detalhes
          </Button>
        </div>
      )}

      {/* Row: Distribuição por Tipo + Produtividade por Dev */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TypeDistributionChart
          commitsByType={stats?.commitsByType || {}}
          totalCommits={totalCommits}
          totalPRs={stats?.totalPRs || 0}
        />
        
        {/* Produtividade por Desenvolvedor */}
        <div className="bg-card rounded-xl border p-5">
          <h3 className="text-sm font-semibold mb-4">Produtividade por Desenvolvedor</h3>
          <div className="space-y-3">
            {developerStats.slice(0, 5).map((dev, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {dev.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">{dev.name}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{dev.commits} commits</span>
                      <span className="text-emerald-600">{dev.prsMerged} merged</span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{ width: `${developerStats[0]?.commits ? (dev.commits / developerStats[0].commits) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {developerStats.length === 0 && (
              <p className="text-muted-foreground text-center py-4 text-sm">Nenhum desenvolvedor encontrado</p>
            )}
          </div>
        </div>
      </div>

      {/* Volume por Dia */}
      <VolumeByDayCharts repositories={repositories} />

      {/* Volume por Mês */}
      <VolumeByMonthCharts repositories={repositories} />
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
