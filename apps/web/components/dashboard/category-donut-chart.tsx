'use client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency, CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/utils';

interface CategoryBreakdown { category: string; total: number; count: number; }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-foreground">{payload[0].name}</p>
      <p className="text-sm font-semibold font-mono">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export function CategoryDonutChart({ data, total }: { data: CategoryBreakdown[]; total: number }) {
  const chartData = data.map((d) => ({
    name: CATEGORY_LABELS[d.category] ?? d.category,
    value: d.total,
    color: CATEGORY_COLORS[d.category] ?? '#cbd5e1',
    category: d.category,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Centre label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold font-mono text-foreground leading-none">
            {formatCurrency(total)}
          </span>
          <span className="text-xs text-muted-foreground mt-0.5">this month</span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {chartData.slice(0, 6).map((d) => (
          <div key={d.category} className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-xs text-muted-foreground truncate">{d.name}</span>
            <span className="ml-auto text-xs font-mono font-medium text-foreground">
              {formatCurrency(d.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
