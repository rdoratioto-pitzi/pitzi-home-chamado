import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { GitRepository } from "../index";

interface VolumeChartsProps {
  repositories: GitRepository[];
}

export function VolumeByDayCharts({ repositories }: VolumeChartsProps) {
  const [commitsRepoFilter, setCommitsRepoFilter] = useState("all");
  const [prsRepoFilter, setPrsRepoFilter] = useState("all");

  // Fetch commits by day
  const { data: commitsByDay = [] } = useQuery<{ date: string; commits: number }[]>({
    queryKey: ["/api/git-analytics/commits-by-day", commitsRepoFilter],
    queryFn: async () => {
      const params = commitsRepoFilter !== "all" ? `?repositoryId=${commitsRepoFilter}` : "";
      const res = await fetch(`/api/git-analytics/commits-by-day${params}`);
      return res.json();
    },
  });

  // Fetch PRs by day
  const { data: prsByDay = [] } = useQuery<{ date: string; prs: number }[]>({
    queryKey: ["/api/git-analytics/prs-by-day", prsRepoFilter],
    queryFn: async () => {
      const params = prsRepoFilter !== "all" ? `?repositoryId=${prsRepoFilter}` : "";
      const res = await fetch(`/api/git-analytics/prs-by-day${params}`);
      return res.json();
    },
  });

  // Formatar datas para exibição
  const formattedCommits = commitsByDay.slice(-14).map(d => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
  }));

  const formattedPRs = prsByDay.slice(-14).map(d => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
  }));

  const RepoFilter = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px] h-8 text-xs">
        <SelectValue placeholder="Repositório" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos</SelectItem>
        {repositories.map((repo) => (
          <SelectItem key={repo.id} value={repo.id}>
            {repo.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Volume de Commits por Dia */}
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Volume de Commits por Dia</h3>
          <RepoFilter value={commitsRepoFilter} onChange={setCommitsRepoFilter} />
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={formattedCommits}>
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

      {/* Volume de PRs por Dia */}
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Volume de PRs por Dia</h3>
          <RepoFilter value={prsRepoFilter} onChange={setPrsRepoFilter} />
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={formattedPRs}>
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
            <Bar dataKey="prs" fill="#22c55e" radius={[4, 4, 0, 0]} name="PRs" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function VolumeByMonthCharts({ repositories }: VolumeChartsProps) {
  const [commitsRepoFilter, setCommitsRepoFilter] = useState("all");
  const [prsRepoFilter, setPrsRepoFilter] = useState("all");

  // Fetch commits by month
  const { data: commitsByMonth = [] } = useQuery<{ month: string; commits: number }[]>({
    queryKey: ["/api/git-analytics/commits-by-month", commitsRepoFilter],
    queryFn: async () => {
      const params = commitsRepoFilter !== "all" ? `?repositoryId=${commitsRepoFilter}` : "";
      const res = await fetch(`/api/git-analytics/commits-by-month${params}`);
      return res.json();
    },
  });

  // Fetch PRs by month
  const { data: prsByMonth = [] } = useQuery<{ month: string; prs: number }[]>({
    queryKey: ["/api/git-analytics/prs-by-month", prsRepoFilter],
    queryFn: async () => {
      const params = prsRepoFilter !== "all" ? `?repositoryId=${prsRepoFilter}` : "";
      const res = await fetch(`/api/git-analytics/prs-by-month${params}`);
      return res.json();
    },
  });

  // Formatar meses
  const monthNames: Record<string, string> = {
    "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr", "05": "Mai", "06": "Jun",
    "07": "Jul", "08": "Ago", "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
  };

  const formattedCommits = commitsByMonth.slice(-6).map(d => ({
    ...d,
    month: monthNames[d.month.split("-")[1]] || d.month,
  }));

  const formattedPRs = prsByMonth.slice(-6).map(d => ({
    ...d,
    month: monthNames[d.month.split("-")[1]] || d.month,
  }));

  const RepoFilter = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px] h-8 text-xs">
        <SelectValue placeholder="Repositório" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos</SelectItem>
        {repositories.map((repo) => (
          <SelectItem key={repo.id} value={repo.id}>
            {repo.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Volume de Commits por Mês */}
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Volume de Commits por Mês</h3>
          <RepoFilter value={commitsRepoFilter} onChange={setCommitsRepoFilter} />
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={formattedCommits}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" className="text-xs" tick={{ fill: 'currentColor' }} />
            <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="commits" fill="#6366f1" radius={[4, 4, 0, 0]} name="Commits" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Volume de PRs por Mês */}
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Volume de PRs por Mês</h3>
          <RepoFilter value={prsRepoFilter} onChange={setPrsRepoFilter} />
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={formattedPRs}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" className="text-xs" tick={{ fill: 'currentColor' }} />
            <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="prs" fill="#10b981" radius={[4, 4, 0, 0]} name="PRs" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
