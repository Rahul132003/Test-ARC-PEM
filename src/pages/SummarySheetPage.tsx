import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency, formatDateISO } from '@/lib/calculations';
import { exportExpensesToExcel } from '@/lib/excel-export';
import { getExportMetadata } from '@/lib/export-utils';
import { useToast } from '@/context/ToastContext';
import { Project, Expense } from '@/types';
import MonthPicker from '@/components/MonthPicker';
import {
  HiOutlineArrowLeft,
  HiOutlinePrinter,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineTableCells,
  HiOutlineDocumentArrowDown,
  HiOutlineCalendarDays,
} from 'react-icons/hi2';

const EXPENSE_CATEGORIES = [
  { value: 'labour',     label: "Labour's Expenses"     },
  { value: 'site',       label: "Site Expenses"          },
  { value: 'contractor', label: "Contractor's Expenses"  },
  { value: 'vendor',     label: "Vendor's Expenses"      },
] as const;

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];
const romanize = (n: number) => ROMAN[n] ?? String(n + 1);

interface AggregatedRow {
  id: string;
  description: string;
  amount: number;
  cash_payment: number;
  cheque_payment: number;
  pending_payment: number;
  remarks: string;
  count: number;
}

export default function SummarySheetPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const { showSuccess } = useToast();
  const [printFilter, setPrintFilter] = useState<'complete' | 'gst'>('complete');

  const now = new Date();
  const [dateFrom, setDateFrom] = useState(
    formatDateISO(new Date(now.getFullYear() - 2, 0, 1))
  );
  const [dateTo, setDateTo] = useState(
    formatDateISO(new Date(now.getFullYear() + 1, 11, 31))
  );

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [proj, exps] = await Promise.all([
        window.electronAPI.getProject(id),
        window.electronAPI.getExpenses(id, dateFrom, dateTo),
      ]);
      setProject(proj);
      setExpenses(exps);
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, [id, dateFrom, dateTo]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Filter by print mode ────────────────────────────────────────
  const displayExpenses = printFilter === 'gst'
    ? expenses.filter((e) => e.has_gst === 1)
    : expenses;

  // ── Derived totals ──────────────────────────────────────────────
  const totalExpenses = displayExpenses.reduce((s, e) => s + e.amount, 0);
  const totalCash     = displayExpenses.reduce((s, e) => s + e.cash_payment, 0);
  const totalCheque   = displayExpenses.reduce((s, e) => s + e.cheque_payment, 0);
  const totalPending  = displayExpenses.reduce((s, e) => s + e.pending_payment, 0);
  const totalGst      = displayExpenses.reduce((s, e) => s + (e.gst_amount || 0), 0);

  // ── Aggregated groups per category ─────────────────────────────
  const finalizedGroups: Record<string, AggregatedRow[]> = {};

  EXPENSE_CATEGORIES.forEach((cat) => {
    const catExpenses = displayExpenses.filter((e) => e.category === cat.value);
    if (catExpenses.length === 0) return;

    const isSimpleCategory = cat.value === 'labour' || cat.value === 'site';
    const partyMap: Record<string, AggregatedRow> = {};

    catExpenses.forEach((exp) => {
      const partyKey = isSimpleCategory
        ? 'TOTAL'
        : (exp.vendor_name?.trim() || exp.description?.trim() || 'Other');

      if (!partyMap[partyKey]) {
        partyMap[partyKey] = {
          id: exp.id,
          description: isSimpleCategory ? cat.label : partyKey,
          amount: 0,
          cash_payment: 0,
          cheque_payment: 0,
          pending_payment: 0,
          remarks: '',
          count: 0,
        };
      }

      partyMap[partyKey].amount          += exp.amount;
      partyMap[partyKey].cash_payment    += exp.cash_payment;
      partyMap[partyKey].cheque_payment  += exp.cheque_payment;
      partyMap[partyKey].pending_payment += exp.pending_payment;
      partyMap[partyKey].count           += 1;
      if (exp.remarks && !partyMap[partyKey].remarks.includes(exp.remarks)) {
        partyMap[partyKey].remarks = partyMap[partyKey].remarks
          ? `${partyMap[partyKey].remarks}; ${exp.remarks}`
          : exp.remarks;
      }
    });

    finalizedGroups[cat.value] = Object.values(partyMap);
  });



  const handleExportPDF = async () => {
    const { filename, subPath } = getExportMetadata('Summary Sheet', project, dateFrom, dateTo, 'Summary');
    const res = await window.electronAPI.printToPDF(`${filename}.pdf`, subPath);
    if (res.success) showSuccess('PDF saved successfully');
  };

  // ── Helpers ─────────────────────────────────────────────────────
  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Project not found</p>
        <button onClick={() => navigate('/projects')} className="btn-secondary mt-4">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in pb-20 px-4 sm:px-6 print:max-w-none print:p-0 print:m-0">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-8 print:hidden">
        <button
          onClick={() => navigate(`/project/${id}/expenses`)}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <HiOutlineArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1
            className="text-2xl font-extrabold text-slate-800"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Summary Sheet
          </h1>
          <p className="text-sm text-slate-400">
            {project.name} • {project.client}
            {project.location && <> • {project.location}</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MonthPicker
            onSelect={(y: number, m: number) => {
              const firstDay = new Date(y, m, 1);
              const lastDay = new Date(y, m + 1, 0);
              setDateFrom(formatDateISO(firstDay));
              setDateTo(formatDateISO(lastDay));
            }}
          />
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <label className="text-xs text-slate-500 font-medium whitespace-nowrap uppercase tracking-wider">
              Period
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-sm text-slate-700 bg-transparent border-none outline-none focus:ring-0"
            />
            <span className="text-slate-300">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-sm text-slate-700 bg-transparent border-none outline-none focus:ring-0"
            />
          </div>
          <div className="flex items-center rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm text-sm font-medium">
            <button
              onClick={() => setPrintFilter('complete')}
              className={`px-3 py-2 transition-colors ${
                printFilter === 'complete'
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              Complete
            </button>
            <button
              onClick={() => setPrintFilter('gst')}
              className={`px-3 py-2 border-l border-slate-200 transition-colors ${
                printFilter === 'gst'
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              GST Only
            </button>
          </div>
          <button
            onClick={() => project && exportExpensesToExcel(project, displayExpenses, dateFrom, dateTo)}
            className="btn-secondary flex items-center gap-1.5 text-sm"
            title="Export to Excel"
          >
            <HiOutlineTableCells className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="btn-secondary flex items-center gap-1.5 text-sm"
            title="Save as PDF"
          >
            <HiOutlineDocumentArrowDown className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={() => window.print()}
            className="btn-secondary flex items-center gap-1.5 text-sm"
            title="Print Report"
          >
            <HiOutlinePrinter className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* ── Summary Table ────────────────────────────────── */}
       <div className="bg-white border-2 border-black overflow-hidden print:m-0 print:border-black print:overflow-visible">
        {/* Report Header */}
        <div className="border-b-2 border-black p-4 text-center">
          <h2 className="text-xl font-bold uppercase tracking-widest mb-1">
            {project.location || project.name}
          </h2>
        </div>
        <div className="border-b-2 border-black bg-slate-50/50 py-2 text-center">
          <p className="text-sm font-bold">
            {printFilter === 'gst' ? 'GST Bills Only' : 'All Expenses'} — {fmtDate(dateFrom)} to {fmtDate(dateTo)}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="border-r border-black p-2 text-left w-12 font-bold">Sr No</th>
                <th className="border-r border-black p-2 text-left min-w-[200px] font-bold">Description</th>
                <th className="border-r border-black p-2 text-right w-32 font-bold">Amount</th>
                <th className="border-r border-black p-2 text-right w-32 font-bold">Cash Payment</th>
                <th className="border-r border-black p-2 text-right w-32 font-bold">Cheque Payment</th>
                <th className="border-r border-black p-2 text-right w-32 font-bold">Pending Payment</th>
                <th className="p-2 text-left min-w-[150px] font-bold">Remarks {`{if any}`}</th>
              </tr>
            </thead>
            <tbody>
              {EXPENSE_CATEGORIES.map((cat, catIdx) => {
                const groupItems = finalizedGroups[cat.value] || [];
                const hasSubItems =
                  groupItems.length > 1 ||
                  (groupItems.length === 1 && !['labour', 'site'].includes(cat.value));

                const drillUrl =
                  cat.value === 'labour'
                    ? `/project/${id}/ledger/labour`
                    : cat.value === 'site'
                    ? `/project/${id}/ledger/vendor?category=site`
                    : null;

                return (
                  <React.Fragment key={cat.value}>
                    {/* Category row */}
                    <tr className={`border-b border-black group${catIdx > 0 ? ' border-t-2' : ''}`}>
                      <td className="border-r border-black p-2 font-bold align-top">{catIdx + 1}</td>
                      <td className="border-r border-black p-2 font-bold align-top">
                        <div className="flex items-center justify-between gap-2">
                          <span>{cat.label}</span>
                          {drillUrl && (
                            <button
                              onClick={() => navigate(drillUrl)}
                              className="print:hidden opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-indigo-100 text-indigo-500 transition-opacity"
                              title={`View ${cat.label} detail`}
                            >
                              <HiOutlineArrowTopRightOnSquare className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      {!hasSubItems && groupItems.length > 0 ? (
                        <>
                          <td className="border-r border-black p-2 text-right font-bold">{formatCurrency(groupItems[0].amount)}</td>
                          <td className="border-r border-black p-2 text-right font-bold">{formatCurrency(groupItems[0].cash_payment)}</td>
                          <td className="border-r border-black p-2 text-right font-bold">{formatCurrency(groupItems[0].cheque_payment)}</td>
                          <td className="border-r border-black p-2 text-right font-bold">{formatCurrency(groupItems[0].pending_payment)}</td>
                          <td className="p-2 align-top text-xs">{groupItems[0].remarks}</td>
                        </>
                      ) : (
                        <>
                          <td className="border-r border-black p-2"></td>
                          <td className="border-r border-black p-2"></td>
                          <td className="border-r border-black p-2"></td>
                          <td className="border-r border-black p-2"></td>
                          <td className="p-2"></td>
                        </>
                      )}
                    </tr>

                    {/* Sub-item rows (vendor/contractor breakdown) */}
                    {hasSubItems &&
                      groupItems.map((item, itemIdx) => {
                        const vendorUrl =
                          item.description && item.description !== cat.label
                            ? `/project/${id}/ledger/vendor?vendor=${encodeURIComponent(item.description)}&category=${cat.value}`
                            : null;
                        return (
                          <tr
                            key={item.id}
                            className="border-b border-black group/row hover:bg-indigo-50/30 transition-colors"
                          >
                            <td className="border-r border-black p-2 text-center align-top"></td>
                            <td className="border-r border-black p-2 pl-8 align-top">
                              <div className="flex items-center justify-between gap-2">
                                <span>
                                  ({romanize(itemIdx)}) &nbsp; {item.description}
                                </span>
                                <div className="print:hidden opacity-0 group-hover/row:opacity-100 flex items-center gap-1">
                                  {vendorUrl && (
                                    <button
                                      onClick={() => navigate(vendorUrl)}
                                      className="p-1 rounded hover:bg-indigo-100 text-indigo-500"
                                      title={`View ${item.description} ledger`}
                                    >
                                      <HiOutlineArrowTopRightOnSquare className="w-3 h-3" />
                                    </button>
                                  )}
                                  {item.count > 1 && (
                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                                      {item.count} entries
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="border-r border-black p-2 text-right">{formatCurrency(item.amount)}</td>
                            <td className="border-r border-black p-2 text-right">{formatCurrency(item.cash_payment)}</td>
                            <td className="border-r border-black p-2 text-right">{formatCurrency(item.cheque_payment)}</td>
                            <td className="border-r border-black p-2 text-right">{formatCurrency(item.pending_payment)}</td>
                            <td className="p-2 text-xs">{item.remarks}</td>
                          </tr>
                        );
                      })}

                    {/* Sub-total row for categories with multiple parties */}
                    {hasSubItems && groupItems.length > 0 && (
                      <tr className="border-b-2 border-black bg-slate-50/60 font-bold text-[12px]">
                        <td className="border-r border-black p-2"></td>
                        <td className="border-r border-black p-2 pl-8 text-right">Sub Total — {cat.label}</td>
                        <td className="border-r border-black p-2 text-right">{formatCurrency(groupItems.reduce((s, i) => s + i.amount, 0))}</td>
                        <td className="border-r border-black p-2 text-right">{formatCurrency(groupItems.reduce((s, i) => s + i.cash_payment, 0))}</td>
                        <td className="border-r border-black p-2 text-right">{formatCurrency(groupItems.reduce((s, i) => s + i.cheque_payment, 0))}</td>
                        <td className="border-r border-black p-2 text-right">{formatCurrency(groupItems.reduce((s, i) => s + i.pending_payment, 0))}</td>
                        <td className="p-2"></td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {displayExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-20 text-slate-400 italic">
                    {printFilter === 'gst'
                      ? 'No GST bills found for the selected period.'
                      : 'No expense data found for the selected period.'}
                  </td>
                </tr>
              )}
              {displayExpenses.length > 0 && (
                <>
                <tr className="bg-slate-50/80 font-bold text-sm border-t-2 border-black">
                  <td className="border-r border-black p-3 text-center" colSpan={2}>
                    Total Expense
                  </td>
                  <td className="border-r border-black p-3 text-right">{formatCurrency(totalExpenses)}</td>
                  <td className="border-r border-black p-3 text-right">{formatCurrency(totalCash)}</td>
                  <td className="border-r border-black p-3 text-right">{formatCurrency(totalCheque)}</td>
                  <td className="border-r border-black p-3 text-right">{formatCurrency(totalPending)}</td>
                  <td className="p-3"></td>
                </tr>
                {totalGst > 0 && (
                  <tr className="text-sm text-green-700 bg-green-50/60">
                    <td className="border-r border-black p-3 text-center font-bold" colSpan={2}>
                      GST Component
                    </td>
                    <td className="border-r border-black p-3 text-right font-bold">{formatCurrency(totalGst)}</td>
                    <td className="border-r border-black p-3"></td>
                    <td className="border-r border-black p-3"></td>
                    <td className="border-r border-black p-3"></td>
                    <td className="p-3"></td>
                  </tr>
                )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Signature Area */}
        <div className="grid grid-cols-2 mt-12 mb-8 px-12 gap-20">
          <div className="text-center">
            <div className="border-b-2 border-black h-12 mb-2"></div>
            <p className="text-xs font-bold uppercase tracking-wider">
              Accountant / Employee Signature
            </p>
          </div>
          <div className="text-center">
            <div className="border-b-2 border-black h-12 mb-2"></div>
            <p className="text-xs font-bold uppercase tracking-wider">
              Principal Architect Verification
            </p>
          </div>
        </div>
      </div>

      <div className="h-20 print:hidden" />
    </div>
  );
}
