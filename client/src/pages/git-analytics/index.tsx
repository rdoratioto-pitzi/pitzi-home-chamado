import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { RepositoryVolumeChart } from "./components/RepositoryVolumeChart";
import { SecurityModal } from "./components/SecurityModal";
import { DeveloperDetailModal } from "./components/DeveloperDetailModal";
import { CommitsTable } from "./components/CommitsTable";
import { PullRequestsTable } from "./components/PullRequestsTable";

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
  const [selectedRepoId, setSelectedRepoId] = useState<string>("all");
  const [selectedDevName, setSelectedDevName] = useState<string>("all");
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);
  const [selectedDev, setSelectedDev] = useState<DeveloperStats | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const { toast } = useToast();

  // Fetch repositories
  const { data: repositories = [] } = useQuery<GitRepository[]>({
    queryKey: ["/api/git-analytics/repositories"],
  });

  // Fetch stats
  const { data: stats, refetch: refetchStats } = useQuery<GitAnalyticsStats>({
    queryKey: ["/api/git-analytics/stats", selectedRepoId, selectedDevName, selectedPeriod],
    queryFn: async () => {
      const [year, month] = selectedPeriod.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const params = new URLSearchParams();
      if (selectedRepoId !== "all") params.set("repositoryId", selectedRepoId);
      if (selectedDevName !== "all") params.set("authorName", selectedDevName);
      params.set("startDate", startDate.toISOString());
      params.set("endDate", endDate.toISOString());
      
      const res = await fetch(`/api/git-analytics/stats?${params}`);
      return res.json();
    },
  });

  // Fetch developer stats
  const { data: developerStats = [] } = useQuery<DeveloperStats[]>({
    queryKey: ["/api/git-analytics/developer-stats", selectedRepoId, selectedDevName, selectedPeriod],
    queryFn: async () => {
      const [year, month] = selectedPeriod.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const params = new URLSearchParams();
      if (selectedRepoId !== "all") params.set("repositoryId", selectedRepoId);
      if (selectedDevName !== "all") params.set("authorName", selectedDevName);
      params.set("startDate", startDate.toISOString());
      params.set("endDate", endDate.toISOString());
      
      const res = await fetch(`/api/git-analytics/developer-stats?${params}`);
      return res.json();
    },
  });

  // Lista completa de desenvolvedores para o dropdown (sem filtro)
  const { data: allDevelopers = [] } = useQuery<DeveloperStats[]>({
    queryKey: ["/api/git-analytics/developer-stats", "all-for-dropdown"],
    queryFn: async () => {
      const res = await fetch(`/api/git-analytics/developer-stats`);
      return res.json();
    },
  });

  // Fetch pending branches
  const { data: pendingBranches = [] } = useQuery<any[]>({
    queryKey: ["/api/git-analytics/pending-branches", selectedRepoId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedRepoId !== "all") params.set("repositoryId", selectedRepoId);
      const res = await fetch(`/api/git-analytics/pending-branches?${params}`);
      return res.json();
    },
  });

  // Funções auxiliares para período
  const getMonthName = (month: number) => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return months[month - 1];
  };

  const getAvailablePeriods = () => {
    const periods = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = `${getMonthName(date.getMonth() + 1)} ${date.getFullYear()}`;
      periods.push({ value, label });
    }
    return periods;
  };

  // Sync handler
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const [year, month] = selectedPeriod.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      await apiRequest("POST", "/api/git-analytics/sync-period", {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        repositoryId: selectedRepoId !== "all" ? selectedRepoId : undefined,
      });
      
      await refetchStats();
      toast({ title: "Sincronização concluída!", description: `Dados de ${getMonthName(month)}/${year} atualizados.` });
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
          {/* Header com tabs, filtros e botão sync */}
          <div className="flex flex-col gap-4">
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

              <div className="flex items-center gap-3">
                {/* Filtro de Período */}
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailablePeriods().map((period) => (
                      <SelectItem key={period.value} value={period.value}>
                        {period.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Filtro de Repositório */}
                <Select value={selectedRepoId} onValueChange={setSelectedRepoId}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Repositório" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os repositórios</SelectItem>
                    {repositories.map((repo) => (
                      <SelectItem key={repo.id} value={repo.id}>
                        {repo.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Filtro de Desenvolvedor */}
                <Select value={selectedDevName} onValueChange={setSelectedDevName}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Desenvolvedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os devs</SelectItem>
                    {allDevelopers.map((dev) => (
                      <SelectItem key={dev.name} value={dev.name}>
                        {dev.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

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
            </div>
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
              pendingBranches={pendingBranches}
              onOpenSecurityModal={() => setShowSecurityModal(true)}
              onOpenDevModal={(dev) => { setSelectedDev(dev); setShowDevModal(true); }}
              showSecurityModal={showSecurityModal}
              setShowSecurityModal={setShowSecurityModal}
              showDevModal={showDevModal}
              setShowDevModal={setShowDevModal}
              selectedDev={selectedDev}
              setSelectedDev={setSelectedDev}
              selectedRepoId={selectedRepoId}
              selectedDevName={selectedDevName}
            />
          ) : (
            <DetailedView
              repositories={repositories}
              selectedRepoId={selectedRepoId}
              selectedDevName={selectedDevName}
            />
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
  pendingBranches: any[];
  onOpenSecurityModal: () => void;
  onOpenDevModal: (dev: DeveloperStats) => void;
  showSecurityModal: boolean;
  setShowSecurityModal: (open: boolean) => void;
  showDevModal: boolean;
  setShowDevModal: (open: boolean) => void;
  selectedDev: DeveloperStats | null;
  setSelectedDev: (dev: DeveloperStats | null) => void;
  selectedRepoId: string;
  selectedDevName: string;
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
  pendingBranches,
  onOpenSecurityModal,
  onOpenDevModal,
  showSecurityModal,
  setShowSecurityModal,
  showDevModal,
  setShowDevModal,
  selectedDev,
  setSelectedDev,
  selectedRepoId,
  selectedDevName,
}: DashboardViewProps) {
  // Filtrar desenvolvedores pelo filtro global
  const filteredDevelopers = selectedDevName === "all"
    ? developerStats
    : developerStats.filter(d => d.name === selectedDevName);
  // Calcular commits e PRs por repositório (simplificado - usando proporção)
  const commitsByRepo: Record<string, number> = {};
  const prsByRepo: Record<string, number> = {};
  repositories.forEach((repo, idx) => {
    // Distribuir proporcionalmente (em produção, viria da API)
    const proportion = 1 / (idx + 1);
    commitsByRepo[repo.id] = Math.round(totalCommits * proportion / repositories.length) || 0;
    prsByRepo[repo.id] = Math.round((stats?.totalPRs || 0) * proportion / repositories.length) || 0;
  });
  // Ajustar o primeiro repo para ter o restante
  if (repositories.length > 0) {
    const sumCommits = Object.values(commitsByRepo).reduce((a, b) => a + b, 0);
    const sumPRs = Object.values(prsByRepo).reduce((a, b) => a + b, 0);
    commitsByRepo[repositories[0].id] = totalCommits - sumCommits + (commitsByRepo[repositories[0].id] || 0);
    prsByRepo[repositories[0].id] = (stats?.totalPRs || 0) - sumPRs + (prsByRepo[repositories[0].id] || 0);
  }

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
          onClick={onOpenSecurityModal}
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

      {/* Alerts Row */}
      <div className="flex flex-col gap-3">
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
            <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100" onClick={onOpenSecurityModal}>
              Ver Detalhes
            </Button>
          </div>
        )}

        {/* PRs Pendentes Alert Banner */}
        {(stats?.totalPRsOpen || 0) > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <GitPullRequest className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">
                  {stats?.totalPRsOpen} Pull Request{(stats?.totalPRsOpen || 0) > 1 ? "s" : ""} aguardando revisão
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  PRs abertos precisam de atenção para serem revisados e mergeados
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
              onClick={() => window.open(`https://github.com/${repositories[0]?.fullName}/pulls`, "_blank")}
            >
              Ver no GitHub
            </Button>
          </div>
        )}

        {/* Branches Pendentes Alert Banner */}
        {pendingBranches.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <GitBranch className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">
                  {pendingBranches.length} branch{pendingBranches.length > 1 ? "es" : ""} aguardando revisão
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  {pendingBranches.slice(0, 3).map((b: any) => b.name).join(", ")}
                  {pendingBranches.length > 3 && ` e mais ${pendingBranches.length - 3}`}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
              onClick={() => window.open(`https://github.com/${repositories[0]?.fullName}/branches`, "_blank")}
            >
              Ver Branches
            </Button>
          </div>
        )}
      </div>

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
            {filteredDevelopers.slice(0, 5).map((dev, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => onOpenDevModal(dev)}
              >
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

      {/* Volume por Repositório */}
      {repositories.length > 0 && (
        <RepositoryVolumeChart
          repositories={repositories}
          commitsByRepo={commitsByRepo}
          prsByRepo={prsByRepo}
        />
      )}

      {/* Modals */}
      <SecurityModal
        open={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        repositoryFullName={repositories[0]?.fullName}
      />
      <DeveloperDetailModal
        open={showDevModal}
        onClose={() => setShowDevModal(false)}
        developer={selectedDev}
        allDevelopers={developerStats}
        onSelectDeveloper={setSelectedDev}
      />
    </div>
  );
}

function DetailedView({
  repositories,
  selectedRepoId,
  selectedDevName
}: {
  repositories: GitRepository[];
  selectedRepoId: string;
  selectedDevName: string;
}) {
  const [activeTab, setActiveTab] = useState<"commits" | "prs" | "security">("commits");

  // Fetch security alerts
  const { data: securityAlerts = [] } = useQuery<any[]>({
    queryKey: ["/api/git-analytics/security-alerts"],
    queryFn: async () => {
      const res = await fetch(`/api/git-analytics/security-alerts`);
      return res.json();
    },
    enabled: activeTab === "security",
  });

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        <button
          onClick={() => setActiveTab("commits")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "commits"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Commits
        </button>
        <button
          onClick={() => setActiveTab("prs")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "prs"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Pull Requests
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "security"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Segurança ({securityAlerts.length})
        </button>
      </div>

      {/* Conteúdo */}
      {activeTab === "commits" && (
        <CommitsTable
          repositories={repositories}
          selectedRepoId={selectedRepoId}
          selectedDevName={selectedDevName}
        />
      )}
      {activeTab === "prs" && (
        <PullRequestsTable
          repositories={repositories}
          selectedRepoId={selectedRepoId}
          selectedDevName={selectedDevName}
        />
      )}
      {activeTab === "security" && (
        <SecurityAlertsTable alerts={securityAlerts} repositories={repositories} />
      )}
    </div>
  );
}

// Componente inline para tabela de segurança
function SecurityAlertsTable({ alerts, repositories }: { alerts: any[]; repositories: GitRepository[] }) {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-12">
        <Shield className="h-12 w-12 mx-auto mb-4 text-emerald-500 opacity-50" />
        <p className="text-muted-foreground">Nenhuma vulnerabilidade detectada</p>
        <p className="text-sm text-muted-foreground mt-1">Seus repositórios estão seguros!</p>
      </div>
    );
  }

  const getRepoName = (repoId: string) => {
    return repositories.find(r => r.id === repoId)?.name || "—";
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-600 text-white";
      case "high": return "bg-orange-500 text-white";
      case "medium": return "bg-amber-500 text-white";
      case "low": return "bg-blue-500 text-white";
      default: return "bg-slate-500 text-white";
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[80px]">#</TableHead>
            <TableHead className="w-[100px]">Severidade</TableHead>
            <TableHead>Título</TableHead>
            <TableHead className="w-[120px]">Pacote</TableHead>
            <TableHead className="w-[120px]">Repositório</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[120px]">Patch</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert) => (
            <TableRow key={alert.id}>
              <TableCell className="font-mono text-xs">
                #{alert.githubAlertNumber}
              </TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase ${getSeverityColor(alert.severity)}`}>
                  {alert.severity}
                </span>
              </TableCell>
              <TableCell className="max-w-[300px]">
                <div className="truncate font-medium" title={alert.title}>
                  {alert.title}
                </div>
              </TableCell>
              <TableCell className="text-sm">
                <span className="font-mono">{alert.packageName}</span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {getRepoName(alert.repositoryId)}
              </TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  alert.status === "open"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                }`}>
                  {alert.status === "open" ? "Aberto" : "Corrigido"}
                </span>
              </TableCell>
              <TableCell className="text-xs">
                {alert.patchedVersion ? (
                  <span className="text-emerald-600">✓ {alert.patchedVersion}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
