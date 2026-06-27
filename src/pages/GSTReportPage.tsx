import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  HiOutlineReceiptPercent,
  HiOutlineArrowDownTray,
  HiOutlinePrinter,
  HiOutlineDocumentArrowDown,
} from 'react-icons/hi2';
import { GSTReportEntry, Project } from '@/types';
import { getExportMetadata } from '@/lib/export-utils';
import { useToast } from '@/context/ToastContext';
import PlanGate from '@/components/PlanGate';

// Returns YYYY-MM for the current month
function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Given YYYY-MM, returns { from: 'YYYY-MM-01', to: 'YYYY-MM-DD' }
function monthRange(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    from: `${ym}-01`,
    to:   `${ym}-${String(lastDay).padStart(2, '0')}`,
  };
}

function fmtIndian(n: number) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function projectAddress(p: Project) {
  return [p.plot_no, p.location].filter(Boolean).join(', ');
}

function GSTReportPageInner() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [projectId,     setProjectId]     = useState('');
  const [projects,      setProjects]      = useState<Project[]>([]);
  const [entries,       setEntries]       = useState<GSTReportEntry[]>([]);
  const { showSuccess } = useToast();
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    window.electronAPI.getProjects().then(setProjects);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const { from, to } = monthRange(selectedMonth);
    window.electronAPI
      .getGSTReport(from, to, projectId || undefined)
      .then((data) => { setEntries(data); setLoading(false); });
  }, [selectedMonth, projectId]);

  useEffect(() => { load(); }, [load]);

  const totalTaxable = entries.reduce((s, e) => s + e.taxable_amount, 0);
  const totalGST     = entries.reduce((s, e) => s + e.gst_amount, 0);
  const totalNet     = entries.reduce((s, e) => s + e.amount, 0);

  const { from, to } = monthRange(selectedMonth);
  const [fy, fm] = selectedMonth.split('-').map(Number);
  const lastDay = new Date(fy, fm, 0).getDate();
  const periodLabel = `${String(1).padStart(2, '0')}-${String(fm).padStart(2, '0')}-${String(fy).slice(-2)} to ${String(lastDay).padStart(2, '0')}-${String(fm).padStart(2, '0')}-${String(fy).slice(-2)}`;

  const selectedProject = projects.find((p) => p.id === projectId);

  const handleExport = async () => {
    const addr = selectedProject ? projectAddress(selectedProject) : '';
    const rows: any[][] = [
      [`GST DETAIL PURCHASE SHEET FOR ( ${periodLabel} )`],
      [monthLabel(selectedMonth)],
      [selectedProject ? `Project: ${selectedProject.name}` : 'All Projects'],
      ...(addr ? [[`Address: ${addr}`]] : []),
      [],
      ['SR. NO', 'NAME OF CLIENT', 'PROJECT ADDRESS', 'MONTH & YEAR', 'PURCHASER / INVOICE / BILL NO.', 'TAXABLE AMOUNT', 'GST AMOUNT', 'GST %', 'CHEQUE NUMBER', 'NET AMOUNT'],
      ...entries.map((e, i) => [
        i + 1,
        e.vendor_name || '',
        [e.project_plot_no, e.project_location].filter(Boolean).join(', ') || '',
        fmtDate(e.expense_date),
        e.invoice_no || '',
        e.taxable_amount,
        e.gst_amount,
        `${e.gst_rate}%`,
        e.cheque_no || '',
        e.amount,
      ]),
      [],
      ['', '', '', '', 'Total', totalTaxable, totalGST, '', '', totalNet],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 }, { wch: 28 }, { wch: 24 }, { wch: 16 }, { wch: 26 },
      { wch: 16 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GST Purchase Sheet');
    
    const { from, to } = monthRange(selectedMonth);
    const { filename, subPath } = getExportMetadata('GST Purchase Sheet', selectedProject || null, from, to, 'GST');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const res = await window.electronAPI.saveFile(buffer, `${filename}.xlsx`, subPath);
    if (res.success) showSuccess('Excel saved successfully');
  };

  const handleDownloadPDF = () => {
    const { from, to } = monthRange(selectedMonth);
    const { filename, subPath } = getExportMetadata('GST Purchase Sheet', selectedProject || null, from, to, 'GST');
    window.electronAPI.printToPDF(`${filename}.pdf`, subPath);
  };

  return (
    <div className="animate-fade-in pb-20 px-4 sm:px-6 print:p-0 print:m-0">
      {/* Screen header */}
      <div className="flex items-start justify-between mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
            GST Purchase Sheet
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-500">Monthly GST detail sheet — share with your CA for filing</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 btn-secondary text-sm">
            <HiOutlinePrinter className="w-4 h-4" /> Print
          </button>
          <button onClick={handleDownloadPDF} disabled={entries.length === 0}
            className="flex items-center gap-2 btn-secondary text-sm disabled:opacity-40">
            <HiOutlineDocumentArrowDown className="w-4 h-4" /> Download PDF
          </button>
          <button onClick={handleExport} disabled={entries.length === 0}
            className="flex items-center gap-2 btn-secondary text-sm disabled:opacity-40">
            <HiOutlineArrowDownTray className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 mb-6 flex flex-wrap items-end gap-4 print:hidden">
        <div>
          <label className="input-label text-xs">Month</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="input-compact"
          />
        </div>
        <div>
          <label className="input-label text-xs">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="input-compact pr-8"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.location ? ` — ${p.location}` : ''}</option>
            ))}
          </select>
        </div>
        <button onClick={load} className="btn-primary text-sm py-2">Apply</button>
      </div>

      {/* Summary cards (screen only) */}
      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6 print:hidden">
          {[
            { label: 'Total Taxable Amount', value: fmtIndian(totalTaxable), color: 'text-slate-700 dark:text-slate-300' },
            { label: 'Total GST', value: fmtIndian(totalGST), color: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'Total Net Amount', value: fmtIndian(totalNet), color: 'text-emerald-600 dark:text-emerald-400' },
          ].map((s) => (
            <div key={s.label} className="glass-card p-4 text-center">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">{s.label}</p>
              <p className={`text-lg font-extrabold ${s.color}`} style={{ fontFamily: 'Manrope, sans-serif' }}>Rs.{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── PRINTABLE SHEET ── */}
      <div className="bg-white print:shadow-none">

        {/* Print title */}
        <div className="text-center mb-3 py-2 hidden print:block">
          <p className="text-sm font-bold uppercase tracking-wide">
            GST DETAIL PURCHASE SHEET FOR ( {periodLabel} )
          </p>
          <p className="text-sm font-semibold">{monthLabel(selectedMonth)}</p>
          {selectedProject && (
            <div className="mt-0.5">
              <p className="text-xs font-semibold text-slate-700">{selectedProject.name}</p>
              {projectAddress(selectedProject) && (
                <p className="text-xs text-slate-500">{projectAddress(selectedProject)}</p>
              )}
            </div>
          )}
        </div>

        {/* Screen subtitle inside the card */}
        <div className="px-4 pt-4 pb-1 print:hidden">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            GST DETAIL PURCHASE SHEET — {monthLabel(selectedMonth).toUpperCase()}
            {selectedProject && <span className="ml-2 text-indigo-500">/ {selectedProject.name}</span>}
          </p>
          {selectedProject && projectAddress(selectedProject) && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{projectAddress(selectedProject)}</p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 print:hidden">
            <HiOutlineReceiptPercent className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-semibold">No GST bills found for this period</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Enable the GST toggle when adding bills in the Vendor/Contractor ledger
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse border border-black print:text-[11px]">
              <thead>
                {/* Sheet title row */}
                <tr className="border-b border-black">
                  <td colSpan={10} className="border border-black p-2 text-center font-bold uppercase tracking-wide text-[11px]">
                    GST DETAIL PURCHASE SHEET FOR ( {periodLabel} )
                  </td>
                </tr>
                {/* Month + project info row */}
                <tr className="border-b border-black">
                  <td colSpan={10} className="border border-black px-3 py-1.5 text-center">
                    <span className="font-semibold text-[12px]">{monthLabel(selectedMonth)}</span>
                    {selectedProject && (
                      <>
                        <span className="mx-2 text-slate-400">|</span>
                        <span className="font-semibold">{selectedProject.name}</span>
                        {projectAddress(selectedProject) && (
                          <span className="ml-2 text-slate-500 text-[11px]">{projectAddress(selectedProject)}</span>
                        )}
                      </>
                    )}
                    {!selectedProject && <span className="ml-2 text-slate-500 text-[11px]">All Projects</span>}
                  </td>
                </tr>
                {/* Column headers */}
                <tr className="border-b-2 border-black bg-gray-100">
                  <th className="border border-black p-2 text-center font-bold w-10">SR.<br/>NO</th>
                  <th className="border border-black p-2 text-center font-bold min-w-[160px]">NAME OF CLIENT</th>
                  <th className="border border-black p-2 text-center font-bold min-w-[140px]">PROJECT<br/>ADDRESS</th>
                  <th className="border border-black p-2 text-center font-bold w-24">MONTH &amp;<br/>YEAR</th>
                  <th className="border border-black p-2 text-center font-bold w-28">PURCHASER/<br/>INVOICE/<br/>BILL NO.</th>
                  <th className="border border-black p-2 text-right font-bold w-28">TAXABLE<br/>AMOUNT</th>
                  <th className="border border-black p-2 text-right font-bold w-28">GST<br/>AMOUNT</th>
                  <th className="border border-black p-2 text-center font-bold w-16">GST<br/>5% TO<br/>18%</th>
                  <th className="border border-black p-2 text-center font-bold w-24">CHEQUE<br/>NUMBER</th>
                  <th className="border border-black p-2 text-right font-bold w-28">NET<br/>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, idx) => (
                  <tr key={e.id} className="border-b border-black hover:bg-indigo-50/30 print:hover:bg-transparent">
                    <td className="border border-black p-2 text-center">{idx + 1}</td>
                    <td className="border border-black p-2 font-semibold">{e.vendor_name || '—'}</td>
                    <td className="border border-black p-2 text-[11px]">
                      {[e.project_plot_no, e.project_location].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="border border-black p-2 text-center whitespace-nowrap">{fmtDate(e.expense_date)}</td>
                    <td className="border border-black p-2 text-center font-mono text-[11px]">{e.invoice_no || '—'}</td>
                    <td className="border border-black p-2 text-right font-mono">{fmtIndian(e.taxable_amount)}</td>
                    <td className="border border-black p-2 text-right font-mono">{fmtIndian(e.gst_amount)}</td>
                    <td className="border border-black p-2 text-center font-semibold">{e.gst_rate}%</td>
                    <td className="border border-black p-2 text-center font-mono">{e.cheque_no || '—'}</td>
                    <td className="border border-black p-2 text-right font-mono font-bold">{fmtIndian(e.amount)}</td>
                  </tr>
                ))}
                {/* Empty spacer rows to match physical form style */}
                {[...Array(Math.max(0, 5 - entries.length))].map((_, i) => (
                  <tr key={`empty-${i}`} className="border-b border-black h-7">
                    {[...Array(10)].map((__, j) => (
                      <td key={j} className="border border-black p-2">&nbsp;</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black bg-gray-100 font-bold">
                  <td colSpan={5} className="border border-black p-2 text-right font-bold">Total</td>
                  <td className="border border-black p-2 text-right font-mono">{fmtIndian(totalTaxable)}</td>
                  <td className="border border-black p-2 text-right font-mono">{fmtIndian(totalGST)}</td>
                  <td className="border border-black p-2"></td>
                  <td className="border border-black p-2"></td>
                  <td className="border border-black p-2 text-right font-mono">{fmtIndian(totalNet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

export default function GSTReportPage() {
  return (
    <PlanGate feature="gstReport">
      <GSTReportPageInner />
    </PlanGate>
  );
}
