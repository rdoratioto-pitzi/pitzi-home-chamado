import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { TYPE_COLORS, TYPE_LABELS } from "./Badges";

interface TypeDistributionChartProps {
  commitsByType: Record<string, number>;
  totalCommits: number;
  totalPRs: number;
}

export function TypeDistributionChart({ commitsByType, totalCommits, totalPRs }: TypeDistributionChartProps) {
  // Preparar dados para o gráfico de commits
  const commitsData = Object.entries(commitsByType)
    .filter(([_, value]) => value > 0)
    .map(([type, value]) => ({
      name: TYPE_LABELS[type] || type,
      value,
      percentage: totalCommits > 0 ? Math.round((value / totalCommits) * 100) : 0,
      color: TYPE_COLORS[type] || TYPE_COLORS.other,
    }));

  // Para PRs, usamos proporção similar (simplificado)
  const prsData = Object.entries(commitsByType)
    .filter(([_, value]) => value > 0)
    .map(([type, value]) => {
      const proportion = totalCommits > 0 ? value / totalCommits : 0;
      const prValue = Math.round(proportion * totalPRs);
      return {
        name: TYPE_LABELS[type] || type,
        value: prValue,
        percentage: totalPRs > 0 ? Math.round((prValue / totalPRs) * 100) : 0,
        color: TYPE_COLORS[type] || TYPE_COLORS.other,
      };
    })
    .filter(item => item.value > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-2 text-sm">
          <p className="font-medium">{data.name}</p>
          <p className="text-muted-foreground">{data.value} ({data.percentage}%)</p>
        </div>
      );
    }
    return null;
  };

  const renderLabel = ({ cx, cy, midAngle, outerRadius, value, percentage }: any) => {
    if (percentage < 8) return null;
    const RADIAN = Math.PI / 180;
    const radius = outerRadius * 1.2;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    return (
      <text
        x={x}
        y={y}
        fill="currentColor"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        className="text-[11px] fill-muted-foreground"
      >
        {value}
      </text>
    );
  };

  return (
    <div className="bg-card rounded-xl border p-5">
      <h3 className="text-sm font-semibold mb-4">Distribuição por Tipo</h3>
      
      <div className="grid grid-cols-2 gap-6">
        {/* Commits Chart */}
        <div>
          <p className="text-xs text-muted-foreground text-center mb-2 font-medium">Commits</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={commitsData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                paddingAngle={2}
                dataKey="value"
                label={renderLabel}
                labelLine={false}
              >
                {commitsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Lista com valores */}
          <div className="space-y-1 mt-2">
            {commitsData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-medium">{item.value} ({item.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* PRs Chart */}
        <div>
          <p className="text-xs text-muted-foreground text-center mb-2 font-medium">Pull Requests</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={prsData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                paddingAngle={2}
                dataKey="value"
                label={renderLabel}
                labelLine={false}
              >
                {prsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Lista com valores */}
          <div className="space-y-1 mt-2">
            {prsData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-medium">{item.value} ({item.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
