import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { GitRepository } from "../index";

interface RepositoryVolumeChartProps {
  repositories: GitRepository[];
  commitsByRepo: Record<string, number>;
  prsByRepo: Record<string, number>;
}

export function RepositoryVolumeChart({ repositories, commitsByRepo, prsByRepo }: RepositoryVolumeChartProps) {
  // Preparar dados para o gráfico
  const data = repositories.map((repo) => {
    const commits = commitsByRepo[repo.id] || 0;
    const prs = prsByRepo[repo.id] || 0;
    return {
      name: repo.name,
      commits,
      prs,
    };
  }).sort((a, b) => b.commits - a.commits);

  // Calcular totais e percentuais
  const totalCommits = data.reduce((sum, d) => sum + d.commits, 0);
  const totalPRs = data.reduce((sum, d) => sum + d.prs, 0);

  const dataWithPercentage = data.map((d) => ({
    ...d,
    percentage: totalCommits > 0 ? ((d.commits / totalCommits) * 100).toFixed(1) : "0",
  }));

  const COLORS = ["#3b82f6", "#22c55e", "#8b5cf6", "#f59e0b", "#06b6d4", "#ef4444"];

  return (
    <div className="bg-card rounded-xl border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Volume por Repositório</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span className="text-muted-foreground">Commits</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500"></div>
            <span className="text-muted-foreground">PRs</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de barras horizontal */}
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dataWithPercentage} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" className="text-xs" tick={{ fill: 'currentColor' }} />
            <YAxis 
              type="category" 
              dataKey="name" 
              className="text-xs" 
              tick={{ fill: 'currentColor' }} 
              width={100}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => [value, name === 'commits' ? 'Commits' : 'PRs']}
            />
            <Bar dataKey="commits" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Commits" />
            <Bar dataKey="prs" fill="#22c55e" radius={[0, 4, 4, 0]} name="PRs" />
          </BarChart>
        </ResponsiveContainer>

        {/* Tabela de representatividade */}
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-2 font-medium">Repositório</th>
                <th className="text-right py-2 font-medium">Commits</th>
                <th className="text-right py-2 font-medium">PRs</th>
                <th className="text-right py-2 font-medium">% Total</th>
              </tr>
            </thead>
            <tbody>
              {dataWithPercentage.map((repo, idx) => (
                <tr key={idx} className="border-b border-border/50">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="font-medium">{repo.name}</span>
                    </div>
                  </td>
                  <td className="text-right text-muted-foreground">{repo.commits}</td>
                  <td className="text-right text-muted-foreground">{repo.prs}</td>
                  <td className="text-right font-semibold">{repo.percentage}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold border-t">
                <td className="py-2">Total</td>
                <td className="text-right">{totalCommits}</td>
                <td className="text-right">{totalPRs}</td>
                <td className="text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
