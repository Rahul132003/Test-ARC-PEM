import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  HiOutlineExclamationCircle,
  HiOutlineArrowDownTray,
  HiOutlineCheckCircle,
} from 'react-icons/hi2';
import { PendingPayment, Project } from '@/types';
import { useApp } from '@/context/AppContext';
import { formatDate } from '@/lib/calculations';
import PlanGate from '@/components/PlanGate';

const CATEGORY_LABELS: Record<string, string> = {
  labour:     'Labour',
  vendor:     'Vendor',
  contractor: 'Contractor',
  site:       'Site',
};

function urgencyClass(daysAgo: number) {
  if (daysAgo > 30) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (daysAgo > 14) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
}

function PendingPaymentsPageInner() {
  const [payments, setPayments]   = useState<PendingPayment[]>([]);
  const [projects, setProjects]   = useState<Project[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('');
  const [projectId, setProjectId] = useState('');
  const now = new Date();
  const [dateFrom, setDateFrom]   = useState(new Date(now.getFullYear() - 2, 0, 1).toISOString().split('T')[0]);
  const [dateTo, setDateTo]       = useState(new Date(now.getFullYear() + 1, 11, 31).toISOString().split('T')[0]);
  const { fmt } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      window.electronAPI.getPendingPayments(),
      window.electronAPI.getProjects(),
    ]).then(([data, projs]) => {
      setPayments(data);
      setProjects(projs);
      setLoading(false);
    });
  }, []);

  const today = new Date();
  const daysSince = (dateStr: string) =>
    Math.floor((today.getTime() - new Date(dateStr + 'T00:00:00').getTime()) / 86_400_000);

  const filtered = payments.filter((p) => {
    if (projectId && p.project_id !== projectId) return false;
    if (dateFrom && p.expense_date < dateFrom) return false;
    if (dateTo && p.expense_date > dateTo) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      p.project_name.toLowerCase().includes(q) ||
      (p.vendor_name || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  });

  const totalPending = filtered.reduce((s, p) => s + p.pending_payment, 0);

  const handleExport = () => {
    const rows: any[][] = [
      ['Bill Date', 'Project', 'Category', 'Vendor / Party', 'Description', 'Bill Amount', 'Pending', 'Days Since Bill'],
      ...filtered.map((p) => [
        p.expense_date,
        p.project_name,
        CATEGORY_LABELS[p.category] || p.category,
        p.vendor_name || '',
        p.description || '',
        p.amount,
        p.pending_payment,
        daysSince(p.expense_date),
      ]),
      [],
      ['', '', '', '', 'TOTAL PENDING', '', totalPending, ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 22 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pending Payments');
    XLSX.writeFile(wb, `Pending_Payments_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Pending Payments
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-500">All unpaid bills across every project, oldest first</p>
        </div>
        <button onClick={handleExport} disabled={filtered.length === 0}
          className="flex items-center gap-2 btn-secondary text-sm disabled:opacity-40">
          <HiOutlineArrowDownTray className="w-4 h-4" /> Export Excel
        </button>
      </div>

      {/* Summary banner */}
      {payments.length > 0 && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl mb-6 ${totalPending > 0 ? 'bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-700/40' : 'bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-700/40'}`}>
          {totalPending > 0
            ? <HiOutlineExclamationCircle className="w-5 h-5 text-amber-500 shrink-0" />
            : <HiOutlineCheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
          }
          <div>
            <p className={`text-sm font-bold ${totalPending > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {totalPending > 0
                ? `${fmt(totalPending)} pending across ${filtered.length} bill${filtered.length !== 1 ? 's' : ''}`
                : 'All bills are paid up!'
              }
            </p>
            {totalPending > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {filtered.filter((p) => daysSince(p.expense_date) > 30).length} bills are over 30 days old
              </p>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search vendor, description…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input-compact w-full max-w-xs"
        />
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="input-compact pr-8"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
          <label className="text-xs text-slate-500 font-medium uppercase tracking-wider whitespace-nowrap">Bill date</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-sm text-slate-700 bg-transparent border-none outline-none" />
          <span className="text-slate-300">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-sm text-slate-700 bg-transparent border-none outline-none" />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <HiOutlineCheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-semibold">
              {payments.length === 0 ? 'No pending payments' : 'No results match your filter'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">All bills have been cleared!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 dark:border-slate-700">
                <tr>
                  {['Bill Date', 'Project', 'Category', 'Vendor / Party', 'Bill Amt', 'Pending', 'Days Old'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const age = daysSince(p.expense_date);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/project/${p.project_id}/ledger/${p.category === 'labour' ? 'labour' : 'vendor'}`)}
                      className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDate(p.expense_date)}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">{p.project_name}</td>
                      <td className="py-3 px-4">
                        <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                          {CATEGORY_LABELS[p.category] || p.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-[180px] truncate">
                        {p.vendor_name || p.description || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">{fmt(p.amount)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">{fmt(p.pending_payment)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${urgencyClass(age)}`}>
                          {age}d
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 dark:border-slate-600">
                <tr>
                  <td colSpan={4} className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Total</td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                    {fmt(filtered.reduce((s, p) => s + p.amount, 0))}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-amber-600 dark:text-amber-400">
                    {fmt(totalPending)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PendingPaymentsPage() {
  return (
    <PlanGate feature="pendingPayments">
      <PendingPaymentsPageInner />
    </PlanGate>
  );
}
