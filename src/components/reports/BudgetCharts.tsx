import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Category, BudgetSummaryData } from '@/types';
import { formatCurrency } from '@/lib/calculations';

interface BudgetChartsProps {
  categories: Category[];
  summary: BudgetSummaryData;
}

export default function BudgetCharts({ categories, summary }: BudgetChartsProps) {
  const pieData = categories
    .map((cat) => ({
      name: cat.name,
      value: (cat.items || []).reduce((sum, item) => sum + item.quantity * item.rate, 0),
      color: cat.color,
    }))
    .filter((d) => d.value > 0);

  const barData = categories.map((cat) => ({
    name: cat.name.length > 12 ? cat.name.slice(0, 12) + '…' : cat.name,
    amount: (cat.items || []).reduce((sum, item) => sum + item.quantity * item.rate, 0),
    color: cat.color,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white rounded-xl px-4 py-3 shadow-lg border border-slate-100">
          <p className="text-xs font-bold text-slate-700 mb-0.5">{data.name || data.payload.name}</p>
          <p className="text-sm font-bold" style={{ color: data.payload.color }}>
            {formatCurrency(data.value)}
          </p>
          {summary.subtotal > 0 && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              {((data.value / summary.subtotal) * 100).toFixed(1)}% of total
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (pieData.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-slate-400 text-sm">Add items to see budget distribution charts</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Pie Chart */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Budget Distribution
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={110}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: string) => (
                <span className="text-xs text-slate-600">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Bar Chart */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Category Comparison
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <XAxis
              type="number"
              tickFormatter={(v) => `Rs.${(v / 1000).toFixed(0)}K`}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={90}
              tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
            <Bar dataKey="amount" radius={[0, 6, 6, 0]} maxBarSize={28}>
              {barData.map((entry, index) => (
                <Cell key={`bar-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
