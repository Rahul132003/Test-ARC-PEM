import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  HiOutlineRectangleStack,
  HiOutlineBanknotes,
  HiOutlineExclamationCircle,
  HiOutlineArrowTrendingUp,
  HiOutlineCalendarDays,
  HiOutlineClock,
  HiOutlineReceiptPercent,
  HiOutlineClipboardDocumentList,
  HiOutlineDocumentText,
  HiOutlineUsers,
  HiOutlineWrenchScrewdriver,
} from 'react-icons/hi2';
import { DashboardStats, RecentActivity } from '@/types';
import { useApp } from '@/context/AppContext';

const CATEGORY_COLORS: Record<string, string> = {
  labour:     '#6366f1',
  vendor:     '#0ea5e9',
  contractor: '#10b981',
  site:       '#f59e0b',
};
const CATEGORY_LABELS: Record<string, string> = {
  labour:     'Labour',
  vendor:     'Vendor',
  contractor: 'Contractor',
  site:       'Site',
};

type Period = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'all';

function getPeriodDates(period: Period): { dateFrom?: string; dateTo?: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const iso = (d: Date) => d.toISOString().split('T')[0];

  switch (period) {
    case 'this_month': {
      const from = new Date(y, m, 1);
      const to   = new Date(y, m + 1, 0);
      return { dateFrom: iso(from), dateTo: iso(to), label: now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) };
    }
    case 'last_month': {
      const from = new Date(y, m - 1, 1);
      const to   = new Date(y, m, 0);
      return { dateFrom: iso(from), dateTo: iso(to), label: from.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) };
    }
    case 'this_quarter': {
      const q    = Math.floor(m / 3);
      const from = new Date(y, q * 3, 1);
      const to   = new Date(y, q * 3 + 3, 0);
      return { dateFrom: iso(from), dateTo: iso(to), label: `Q${q + 1} ${y}` };
    }
    case 'last_quarter': {
      const q    = Math.floor(m / 3) - 1;
      const yr   = q < 0 ? y - 1 : y;
      const qn   = q < 0 ? 3 : q;
      const from = new Date(yr, qn * 3, 1);
      const to   = new Date(yr, qn * 3 + 3, 0);
      return { dateFrom: iso(from), dateTo: iso(to), label: `Q${qn + 1} ${yr}` };
    }
    case 'this_year': {
      const from = new Date(y, 0, 1);
      const to   = new Date(y, 11, 31);
      return { dateFrom: iso(from), dateTo: iso(to), label: `FY ${y}` };
    }
    case 'all':
    default:
      return { label: 'All Time' };
  }
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="stat-card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-0.5" style={{ fontFamily: 'Manrope, sans-serif' }}>{value}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'this_month',   label: 'This Month' },
  { value: 'last_month',   label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year',    label: 'This Year' },
  { value: 'all',          label: 'All Time' },
];

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  expenses:       <HiOutlineReceiptPercent className="w-4 h-4" />,
  summary:        <HiOutlineClipboardDocumentList className="w-4 h-4" />,
  budget:         <HiOutlineDocumentText className="w-4 h-4" />,
  'ledger/labour':<HiOutlineUsers className="w-4 h-4" />,
  'ledger/vendor':<HiOutlineWrenchScrewdriver className="w-4 h-4" />,
};

const ACTIVITY_COLORS: Record<string, string> = {
  expenses:        'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400',
  summary:         'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  budget:          'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
  'ledger/labour': 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  'ledger/vendor': 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400',
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso + 'Z').getTime()) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function RecentActivitySection({ navigate }: { navigate: (r: string) => void }) {
  const [items, setItems] = useState<RecentActivity[]>([]);

  useEffect(() => {
    window.electronAPI.getRecentActivity(8).then(setItems);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HiOutlineClock className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Recent Activity
          </h2>
        </div>
        <button
          onClick={() => window.electronAPI.clearActivity().then(() => setItems([]))}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.route)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50/60 dark:hover:bg-indigo-900/10 transition-colors text-left group"
          >
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ACTIVITY_COLORS[item.type] ?? 'bg-slate-100 text-slate-500'}`}>
              {ACTIVITY_ICONS[item.type] ?? <HiOutlineDocumentText className="w-4 h-4" />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                {item.project_name}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {item.sub_label}{item.client_name ? ` · ${item.client_name}` : ''}
              </p>
            </div>
            <span className="text-xs text-slate-400 shrink-0 group-hover:text-indigo-500 transition-colors">
              {timeAgo(item.accessed_at)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [period, setPeriod] = useState<Period>('all');
  const { fmt } = useApp();
  const navigate = useNavigate();

  const { dateFrom, dateTo } = useMemo(() => getPeriodDates(period), [period]);

  useEffect(() => {
    setStats(null);
    window.electronAPI.getDashboardStats(dateFrom, dateTo).then(setStats);
  }, [dateFrom, dateTo]);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  const totalExpenses = stats.projectStats.reduce((s, p) => s + p.totalExpenses, 0);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Dashboard
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-500">Overview across all your projects</p>
        </div>

        {/* Period filter */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-sm">
          <HiOutlineCalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="text-sm font-medium text-slate-700 dark:text-slate-300 bg-transparent border-none outline-none cursor-pointer"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<HiOutlineRectangleStack className="w-6 h-6 text-white" />}
          label="Total Projects"
          value={String(stats.totalProjects)}
          color="icon-sq-indigo"
        />
        <StatCard
          icon={<HiOutlineBanknotes className="w-6 h-6 text-white" />}
          label={period === 'all' ? 'This Month' : getPeriodDates(period).label}
          value={fmt(period === 'all' ? stats.totalExpensesThisMonth : totalExpenses)}
          sub="total expenses recorded"
          color="icon-sq-emerald"
        />
        <StatCard
          icon={<HiOutlineExclamationCircle className="w-6 h-6 text-white" />}
          label="Total Pending"
          value={fmt(stats.totalPending)}
          sub="across all vendors"
          color="icon-sq-amber"
        />
      </div>

      {/* Recent Activity */}
      <RecentActivitySection navigate={navigate} />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly trend */}
        <div className="glass-card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <HiOutlineArrowTrendingUp className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Monthly Spend Trend
            </h2>
          </div>
          {stats.monthlyTrend.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No expense data for this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.monthlyTrend} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number) => [fmt(v), 'Expenses']}
                />
                <Bar dataKey="amount" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category breakdown */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
            By Category
          </h2>
          {stats.categoryBreakdown.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No expense data for this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={stats.categoryBreakdown} dataKey="amount" nameKey="category"
                  cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {stats.categoryBreakdown.map((entry) => (
                    <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] || '#94a3b8'} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value) => CATEGORY_LABELS[value] || value}
                  iconType="circle" iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number, name) => [fmt(v), CATEGORY_LABELS[name as string] || name]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Project health table */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Project Overview
        </h2>
        {stats.projectStats.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No projects yet. Create your first project to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">Project</th>
                  <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">Client</th>
                  <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">Total Expenses</th>
                  <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">Pending</th>
                  <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">Spend Bar</th>
                </tr>
              </thead>
              <tbody>
                {stats.projectStats.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/project/${p.id}/expenses`)}
                    className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">{p.name}</td>
                    <td className="py-3 px-3 text-slate-500 dark:text-slate-400">{p.client}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300">{fmt(p.totalExpenses)}</td>
                    <td className={`py-3 px-3 text-right font-mono font-semibold ${p.pendingPayments > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {p.pendingPayments > 0 ? fmt(p.pendingPayments) : '—'}
                    </td>
                    <td className="py-3 px-3 min-w-[120px]">
                      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.min(100, totalExpenses > 0 ? (p.totalExpenses / totalExpenses) * 100 : 0)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
