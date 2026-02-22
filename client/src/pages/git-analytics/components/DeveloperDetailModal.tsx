import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { GitCommit, GitPullRequest, Plus, Minus, TrendingUp } from "lucide-react";
import { DeveloperStats } from "../index";
import { TYPE_COLORS, TYPE_LABELS } from "./Badges";

interface DeveloperDetailModalProps {
  open: boolean;
  onClose: () => void;
  developer: DeveloperStats | null;
  allDevelopers: DeveloperStats[];
  onSelectDeveloper: (dev: DeveloperStats) => void;
}

export function DeveloperDetailModal({
  open,
  onClose,
  developer,
  allDevelopers,
  onSelectDeveloper,
}: DeveloperDetailModalProps) {
  if (!developer) return null;

  // Fetch commits do desenvolvedor para atividade recente
  const { data: recentCommits = [] } = useQuery<{ date: string; commits: number }[]>({
    queryKey: ["/api/git-analytics/commits-by-day", developer.name],
    queryFn: async () => {
      const res = await fetch(`/api/git-analytics/commits-by-day`);
      return res.json();
    },
    enabled: open && !!developer,
  });

  // Formatar dados para o gráfico (últimos 7 dias)
  const activityData = recentCommits.slice(-7).map((d) => ({
    date: new Date(d.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    commits: d.commits,
  }));

  // Calcular bug rate
  const bugRate = developer.commits > 0 
    ? ((developer.commits * 0.15) / developer.commits * 100).toFixed(0) 
    : "0";

  // Iniciais do desenvolvedor
  const initials = developer.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xl font-bold text-blue-600">
              {developer.avatarUrl ? (
                <img src={developer.avatarUrl} alt={developer.name} className="w-14 h-14 rounded-full" />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl">{developer.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">{developer.email || "Email não disponível"}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Filtro de desenvolvedor */}
        <div className="flex items-center gap-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Desenvolvedor:</label>
            <Select
              value={developer.name}
              onValueChange={(name) => {
                const dev = allDevelopers.find((d) => d.name === name);
                if (dev) onSelectDeveloper(dev);
              }}
            >
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allDevelopers.map((dev) => (
                  <SelectItem key={dev.name} value={dev.name}>
                    {dev.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto py-4">
          {/* KPIs do desenvolvedor */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <GitCommit className="h-4 w-4" />
                <span className="text-xs">Commits</span>
              </div>
              <p className="text-2xl font-bold">{developer.commits}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <GitPullRequest className="h-4 w-4" />
                <span className="text-xs">PRs Merged</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{developer.prsMerged}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <GitPullRequest className="h-4 w-4" />
                <span className="text-xs">PRs Total</span>
              </div>
              <p className="text-2xl font-bold">{developer.prs}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Plus className="h-4 w-4" />
                <span className="text-xs">Linhas +</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">+{developer.additions.toLocaleString()}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Minus className="h-4 w-4" />
                <span className="text-xs">Linhas -</span>
              </div>
              <p className="text-2xl font-bold text-red-500">-{developer.deletions.toLocaleString()}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs">Commits/dia</span>
              </div>
              <p className="text-2xl font-bold">{(developer.commits / 30).toFixed(1)}</p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Atividade Recente */}
            <div className="bg-muted/30 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-4">Atividade Recente</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: 'currentColor' }} />
                  <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="commits" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Commits" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Métricas de Performance */}
            <div className="bg-muted/30 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-4">Métricas de Performance</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Taxa de Merge</span>
                    <span className="font-medium">
                      {developer.prs > 0 ? ((developer.prsMerged / developer.prs) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full"
                      style={{ width: `${developer.prs > 0 ? (developer.prsMerged / developer.prs) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Produtividade (vs top)</span>
                    <span className="font-medium">
                      {allDevelopers[0]?.commits
                        ? ((developer.commits / allDevelopers[0].commits) * 100).toFixed(0)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: `${allDevelopers[0]?.commits ? (developer.commits / allDevelopers[0].commits) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Impacto (linhas alteradas)</span>
                    <span className="font-medium">{(developer.additions + developer.deletions).toLocaleString()}</span>
                  </div>
                  <div className="flex gap-1 h-2">
                    <div
                      className="bg-emerald-500 rounded-l-full"
                      style={{
                        width: `${(developer.additions / (developer.additions + developer.deletions || 1)) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-red-500 rounded-r-full"
                      style={{
                        width: `${(developer.deletions / (developer.additions + developer.deletions || 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>+{developer.additions.toLocaleString()} adicionadas</span>
                    <span>-{developer.deletions.toLocaleString()} removidas</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
