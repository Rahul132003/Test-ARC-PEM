import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import {
  HiOutlineArrowLeft,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlinePencilSquare,
  HiOutlinePrinter,
  HiOutlineArrowUpTray,
  HiOutlineArrowDownTray,
  HiOutlineTableCells,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiXMark,
  HiOutlinePaperClip,
  HiOutlineEye,
  HiOutlineXCircle,
  HiOutlineArrowsUpDown,
  HiOutlineArrowUp,
  HiOutlineArrowDown,
  HiOutlineSquare2Stack,
  HiOutlineCalendarDays,
  HiOutlineMinus,
} from 'react-icons/hi2';
import MonthPicker from '@/components/MonthPicker';
import { Project, Expense, ManpowerReport } from '@/types';
import { useLogActivity } from '@/hooks/useLogActivity';
import { formatCurrency, generateId, formatDateISO } from '@/lib/calculations';
import { getExportMetadata } from '@/lib/export-utils';
import { useToast } from '@/context/ToastContext';

type SortCol = 'expense_date' | 'amount' | 'pending_payment';
type SortDir = 'asc' | 'desc';

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

const defaultForm = () => ({
  expense_date:    new Date().toISOString().split('T')[0],
  mason_count:     '',
  mason_rate:      '700',
  coolie_count:    '',
  coolie_rate:     '500',
  helper_count:    '',
  helper_rate:     '600',
  other_count:     '',
  other_rate:      '',
  cash_payment:    '',
  cheque_payment:  '',
  pending_payment: '',
  remarks:         '',
  round_off:       '',
  round_off_amount: '0',
  payment_date:    new Date().toISOString().split('T')[0],
});

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol; sortDir: SortDir }) {
  if (col !== sortCol) return <HiOutlineArrowsUpDown className="w-3 h-3 opacity-40 ml-1 inline" />;
  return sortDir === 'asc'
    ? <HiOutlineArrowUp className="w-3 h-3 text-indigo-500 ml-1 inline" />
    : <HiOutlineArrowDown className="w-3 h-3 text-indigo-500 ml-1 inline" />;
}

export default function LabourLedgerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showUndo, showSuccess } = useToast();

  const now = new Date();
  const [dateFrom, setDateFrom] = useState(new Date(now.getFullYear() - 2, 0, 1).toISOString().split('T')[0]);
  const [dateTo,   setDateTo]   = useState(new Date(now.getFullYear() + 1, 11, 31).toISOString().split('T')[0]);

  const [project,        setProject]        = useState<Project | null>(null);
  useLogActivity(id, project, 'ledger/labour', 'Labour Ledger');
  const [expenses,       setExpenses]       = useState<Expense[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [showModal,      setShowModal]      = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData,       setFormData]       = useState<Record<string, string>>(defaultForm());
  const [formErrors,     setFormErrors]     = useState<Record<string, string>>({});

  // Sorting
  const [sortCol, setSortCol] = useState<SortCol>('expense_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Manpower PDF import
  const [manpowerReport,       setManpowerReport]       = useState<ManpowerReport | null>(null);
  const [showManpowerModal,    setShowManpowerModal]    = useState(false);
  const [manpowerImporting,    setManpowerImporting]    = useState(false);
  const [masonRate,            setMasonRate]            = useState('');
  const [coolieRate,           setCoolieRate]           = useState('');
  const [helperRate,           setHelperRate]           = useState('');
  const [otherRate,            setOtherRate]            = useState('');
  const [manpowerImportSuccess,setManpowerImportSuccess]= useState(false);

  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateDate, setDuplicateDate] = useState(new Date().toISOString().split('T')[0]);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setSelected(new Set());
    try {
      const [proj, exps] = await Promise.all([
        window.electronAPI.getProject(id),
        window.electronAPI.getExpensesByCategory(id, 'labour', dateFrom, dateTo),
      ]);
      setProject(proj);
      setExpenses(exps);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [id, dateFrom, dateTo]);

  useEffect(() => { loadData(); }, [loadData]);

  const sortedExpenses = useMemo(() => {
    const copy = [...expenses];
    copy.sort((a, b) => {
      const va = (a as any)[sortCol] ?? 0;
      const vb = (b as any)[sortCol] ?? 0;
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [expenses, sortCol, sortDir]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const allSelected = selected.size === expenses.length && expenses.length > 0;
  const toggleAll   = () => allSelected ? setSelected(new Set()) : setSelected(new Set(expenses.map((e) => e.id)));
  const toggleOne   = (expId: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(expId) ? next.delete(expId) : next.add(expId);
    return next;
  });

  const handleBulkDelete = async () => {
    const ids = [...selected];
    const removed = expenses.filter((e) => ids.includes(e.id));
    setExpenses((prev) => prev.filter((e) => !ids.includes(e.id)));
    setSelected(new Set());
    await window.electronAPI.bulkDeleteExpenses(ids);
    showUndo(
      `${ids.length} entr${ids.length === 1 ? 'y' : 'ies'} deleted`,
      () => {},
      async () => {
        for (const exp of removed) await window.electronAPI.createExpense(exp);
        loadData();
      }
    );
  };

  const handleBulkMarkPaid = async () => {
    const ids = [...selected];
    await window.electronAPI.bulkMarkPaid(ids);
    setSelected(new Set());
    showSuccess(`${ids.length} entr${ids.length === 1 ? 'y' : 'ies'} marked as paid`);
    loadData();
  };

  const handleBulkDuplicate = async () => {
    const ids = [...selected];
    const toDuplicate = expenses.filter(e => ids.includes(e.id));
    
    for (const exp of toDuplicate) {
      const { id: oldId, created_at, attachment_path, ...rest } = exp;
      await window.electronAPI.createExpense({
        ...rest,
        id: generateId('exp'),
        expense_date: duplicateDate,
        payment_date: duplicateDate,
        cash_payment: exp.amount,
        cheque_payment: 0,
        pending_payment: 0,
        attachment_path: null, // Don't duplicate attachment for now
      });
    }
    
    setSelected(new Set());
    setShowDuplicateModal(false);
    showSuccess(`${ids.length} entr${ids.length === 1 ? 'y' : 'ies'} duplicated to ${fmtDate(duplicateDate)}`);
    loadData();
  };

  const closeModal = () => { setShowModal(false); setEditingExpense(null); setFormData(defaultForm()); setFormErrors({}); };
  const openAdd    = () => { setFormData(defaultForm()); setShowModal(true); };

  const openEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setFormData({
      expense_date:    exp.expense_date,
      mason_count:     exp.mason_count  ? String(exp.mason_count)  : '',
      mason_rate:      exp.mason_rate   ? String(exp.mason_rate)   : '700',
      coolie_count:    exp.coolie_count ? String(exp.coolie_count) : '',
      coolie_rate:     exp.coolie_rate  ? String(exp.coolie_rate)  : '500',
      helper_count:    exp.helper_count ? String(exp.helper_count) : '',
      helper_rate:     exp.helper_rate  ? String(exp.helper_rate)  : '600',
      other_count:     exp.other_count  ? String(exp.other_count)  : '',
      other_rate:      exp.other_rate   ? String(exp.other_rate)   : '',
      cash_payment:    exp.cash_payment    ? String(exp.cash_payment)    : '',
      cheque_payment:  exp.cheque_payment  ? String(exp.cheque_payment)  : '',
      pending_payment: exp.pending_payment ? String(exp.pending_payment) : '',
      remarks:         exp.remarks ?? '',
      round_off:       exp.round_off ? 'true' : '',
      round_off_amount: exp.round_off_amount ? String(exp.round_off_amount) : '0',
      payment_date:    exp.payment_date ?? exp.expense_date,
    });
    setShowModal(true);
  };

  const openDuplicate = (exp: Expense) => {
    setEditingExpense(null);
    setFormData({
      expense_date:    new Date().toISOString().split('T')[0],
      mason_count:     exp.mason_count  ? String(exp.mason_count)  : '',
      mason_rate:      exp.mason_rate   ? String(exp.mason_rate)   : '700',
      coolie_count:    exp.coolie_count ? String(exp.coolie_count) : '',
      coolie_rate:     exp.coolie_rate  ? String(exp.coolie_rate)  : '500',
      helper_count:    exp.helper_count ? String(exp.helper_count) : '',
      helper_rate:     exp.helper_rate  ? String(exp.helper_rate)  : '600',
      other_count:     exp.other_count  ? String(exp.other_count)  : '',
      other_rate:      exp.other_rate   ? String(exp.other_rate)   : '',
      cash_payment:    String(exp.amount),
      cheque_payment:  '',
      pending_payment: '',
      remarks:         exp.remarks ?? '',
      round_off:       exp.round_off ? 'true' : '',
      round_off_amount: exp.round_off_amount ? String(exp.round_off_amount) : '0',
      payment_date:    new Date().toISOString().split('T')[0],
    });
    setShowModal(true);
  };

  const computeAmount = (fd: Record<string, string>) => {
    const mc = parseFloat(fd.mason_count)  || 0;
    const mr = parseFloat(fd.mason_rate)   || 0;
    const cc = parseFloat(fd.coolie_count) || 0;
    const cr = parseFloat(fd.coolie_rate)  || 0;
    const hc = parseFloat(fd.helper_count) || 0;
    const hr = parseFloat(fd.helper_rate)  || 0;
    const oc = parseFloat(fd.other_count)  || 0;
    const or_ = parseFloat(fd.other_rate) || 0;
    let total = mc * mr + cc * cr + hc * hr + oc * or_;
    if (fd.round_off === 'true') {
      total += (parseFloat(fd.round_off_amount) || 0);
    }
    return total;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formData.expense_date) errors.expense_date = 'Date is required.';
    const amount = computeAmount(formData);
    if (amount <= 0) errors.amount = 'Enter at least one worker with a rate to compute the amount.';
    
    let cashPay    = parseFloat(formData.cash_payment)    || 0;
    let chequePay  = parseFloat(formData.cheque_payment)  || 0;
    let pendingPay = parseFloat(formData.pending_payment) || 0;

    // AUTO PAYMENT LOGIC: If all payment fields are empty, assume full cash payment
    if (!formData.cash_payment && !formData.cheque_payment && !formData.pending_payment) {
      cashPay = amount;
    }

    if (cashPay + chequePay + pendingPay > amount + 0.01)
      errors.payment = `Payments (${cashPay + chequePay + pendingPay}) exceed total amount (Rs.${amount.toFixed(2)}).`;
    
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});
    const payload = {
      expense_date:    formData.expense_date,
      category:        'labour' as Expense['category'],
      vendor_name:     null,
      description:     'Daily Labour',
      amount,
      advance_amt:     0,
      cash_payment:    cashPay,
      cheque_payment:  chequePay,
      pending_payment: pendingPay,
      mason_count:     parseFloat(formData.mason_count)     || 0,
      mason_rate:      parseFloat(formData.mason_rate)      || 0,
      coolie_count:    parseFloat(formData.coolie_count)    || 0,
      coolie_rate:     parseFloat(formData.coolie_rate)     || 0,
      helper_count:    parseFloat(formData.helper_count)    || 0,
      helper_rate:     parseFloat(formData.helper_rate)     || 0,
      other_count:     parseFloat(formData.other_count)     || 0,
      other_rate:      parseFloat(formData.other_rate)      || 0,
      remarks:         formData.remarks || null,
      payment_date:    formData.payment_date || formData.expense_date,
      round_off:       formData.round_off === 'true' ? 1 : 0,
      round_off_amount: formData.round_off === 'true' ? (parseFloat(formData.round_off_amount) || 0) : 0,
    };
    if (editingExpense) {
      await window.electronAPI.updateExpense(editingExpense.id, payload);
    } else {
      await window.electronAPI.createExpense({ id: generateId('exp'), project_id: id!, sort_order: expenses.length, ...payload });
    }
    closeModal();
    loadData();
  };

  const handleDelete = async (exp: Expense) => {
    setExpenses((prev) => prev.filter((e) => e.id !== exp.id));
    await window.electronAPI.deleteExpense(exp.id);
    showUndo(
      `Entry deleted`,
      () => {},
      async () => {
        await window.electronAPI.createExpense(exp);
        loadData();
      }
    );
  };

  const handleOpenManpowerPdf = async () => {
    setManpowerImporting(true);
    try {
      const result = await window.electronAPI.openAndParseManpower();
      if (!result) return;
      setManpowerReport(result);
      setMasonRate(''); setCoolieRate(''); setHelperRate(''); setOtherRate('');
      setManpowerImportSuccess(false);
      setShowManpowerModal(true);
    } catch (err: any) {
      showSuccess(`Failed to read PDF: ${err?.message ?? 'Unknown error'}`);
    } finally {
      setManpowerImporting(false);
    }
  };

  const handleSaveManpowerExpenses = async () => {
    if (!manpowerReport || !id) return;
    const parseDate = (period: string): string => {
      try { const d = new Date(period); if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]; } catch {}
      return new Date().toISOString().split('T')[0];
    };
    const expDate = parseDate(manpowerReport.period);
    const rows = [
      { label: 'Mason',  count: manpowerReport.mason,  rate: parseFloat(masonRate)  || 0 },
      { label: 'Coolie', count: manpowerReport.coolie, rate: parseFloat(coolieRate) || 0 },
      { label: 'Helper', count: manpowerReport.helper, rate: parseFloat(helperRate) || 0 },
      { label: 'Other',  count: manpowerReport.other,  rate: parseFloat(otherRate)  || 0 },
    ].filter((r) => r.count > 0);
    for (const row of rows) {
      const amount = row.count * row.rate;
      await window.electronAPI.createExpense({
        id: generateId('exp'), project_id: id, expense_date: expDate,
        category: 'labour', vendor_name: `Manpower – ${row.label}`,
        description: `${row.count} ${row.label}(s) × Rs.${row.rate}/day | Period: ${manpowerReport.period}`,
        amount, advance_amt: 0, cash_payment: 0, cheque_payment: 0, pending_payment: amount,
        remarks: `Imported from Manpower PDF (Ref: ${manpowerReport.refNo})`, sort_order: expenses.length,
      });
    }
    setManpowerImportSuccess(true);
    loadData();
    setTimeout(() => { setShowManpowerModal(false); setManpowerReport(null); setManpowerImportSuccess(false); }, 1800);
  };

  const f   = (key: string) => formData[key] ?? '';
  const set = (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setFormData((prev) => ({ ...prev, [key]: e.target.value }));

  const previewAmount = computeAmount(formData);

  // Auto-calculate pending = total - cash - cheque
  useEffect(() => {
    if (!showModal) return;
    const baseTotal = computeAmount({ ...formData, round_off: '' });
    let total = baseTotal;

    if (formData.round_off === 'true') {
      const rounded = Math.round(baseTotal);
      const diff = Math.round((rounded - baseTotal) * 100) / 100;
      if (String(diff) !== formData.round_off_amount) {
        setFormData(prev => ({ ...prev, round_off_amount: String(diff) }));
        return;
      }
      total = rounded;
    }

    const cash = parseFloat(formData.cash_payment) || 0;
    const cheque = parseFloat(formData.cheque_payment) || 0;
    const pending = Math.max(0, Math.round((total - cash - cheque) * 100) / 100);
    
    setFormData((prev) => {
      const nextPending = pending > 0 ? String(pending) : '';
      if (prev.pending_payment === nextPending) return prev;
      return { ...prev, pending_payment: nextPending };
    });
  }, [formData.mason_count, formData.mason_rate, formData.coolie_count, formData.coolie_rate, formData.helper_count, formData.helper_rate, formData.other_count, formData.other_rate, formData.cash_payment, formData.cheque_payment, formData.round_off, formData.round_off_amount, showModal]);

  // Totals
  const totMason      = expenses.reduce((s, e) => s + (e.mason_count ?? 0), 0);
  const totMasonCost  = expenses.reduce((s, e) => s + ((e.mason_count ?? 0) * (e.mason_rate ?? 0)), 0);
  const totCoolie     = expenses.reduce((s, e) => s + (e.coolie_count ?? 0), 0);
  const totCoolieCost = expenses.reduce((s, e) => s + ((e.coolie_count ?? 0) * (e.coolie_rate ?? 0)), 0);
  const totHelper     = expenses.reduce((s, e) => s + (e.helper_count ?? 0), 0);
  const totHelperCost = expenses.reduce((s, e) => s + ((e.helper_count ?? 0) * (e.helper_rate ?? 0)), 0);
  const totOther      = expenses.reduce((s, e) => s + (e.other_count ?? 0), 0);
  const totOtherCost  = expenses.reduce((s, e) => s + ((e.other_count ?? 0) * (e.other_rate ?? 0)), 0);
  const totAmount     = expenses.reduce((s, e) => s + e.amount, 0);
  const totCash       = expenses.reduce((s, e) => s + e.cash_payment, 0);
  const totCheque     = expenses.reduce((s, e) => s + e.cheque_payment, 0);

  const handleExportExcel = async () => {
    const pName = project?.name || 'Labour';
    const pLoc  = project?.location || '';
    const periodStr = `${new Date(dateFrom + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} to ${new Date(dateTo + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`;
    const rows: any[][] = [
      [`LABOUR LEDGER — ${pName}${pLoc ? ` (${pLoc})` : ''}`],
      [`Period: ${periodStr}`],
      [],
      ['SR.NO', 'DATE', 'MASON NOS', 'MASON RATE', 'MASON COST', 'COOLIE NOS', 'COOLIE RATE', 'COOLIE COST', 'HELPER NOS', 'HELPER RATE', 'HELPER COST', 'OTHER NOS', 'OTHER RATE', 'OTHER COST', 'AMOUNT', 'CASH', 'CHEQUE', 'PENDING', 'PAYMENT DATE'],
      ...sortedExpenses.map((exp, idx) => {
        const masonCost  = (exp.mason_count  ?? 0) * (exp.mason_rate  ?? 0);
        const coolieCost = (exp.coolie_count ?? 0) * (exp.coolie_rate ?? 0);
        const helperCost = (exp.helper_count ?? 0) * (exp.helper_rate ?? 0);
        const otherCost  = (exp.other_count  ?? 0) * (exp.other_rate  ?? 0);
        return [
          idx + 1, exp.expense_date,
          exp.mason_count  || 0, exp.mason_rate  || 0, masonCost,
          exp.coolie_count || 0, exp.coolie_rate || 0, coolieCost,
          exp.helper_count || 0, exp.helper_rate || 0, helperCost,
          exp.other_count  || 0, exp.other_rate  || 0, otherCost,
          exp.amount, exp.cash_payment, exp.cheque_payment, exp.pending_payment,
          exp.payment_date || exp.expense_date,
        ];
      }),
      [],
      ['', 'Total', totMason, '', totMasonCost, totCoolie, '', totCoolieCost, totHelper, '', totHelperCost, totOther, '', totOtherCost, totAmount, totCash, totCheque, '', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 }, { wch: 12 },
      { wch: 10 }, { wch: 11 }, { wch: 12 },
      { wch: 11 }, { wch: 12 }, { wch: 12 },
      { wch: 11 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 11 }, { wch: 12 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Labour Ledger');
    
    const { filename, subPath } = getExportMetadata('Labour Ledger', project, dateFrom, dateTo, 'labour');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const res = await window.electronAPI.saveFile(buffer, `${filename}.xlsx`, subPath);
    if (res.success) showSuccess('Excel saved successfully');
  };

  const handleExportPDF = async () => {
    const { filename, subPath } = getExportMetadata('Labour Ledger', project, dateFrom, dateTo, 'labour');
    await window.electronAPI.printToPDF(`${filename}.pdf`, subPath);
  };

  const handleExportTally = async () => {
    await window.electronAPI.exportTally(id!, dateFrom, dateTo);
  };

  const n  = (v: number | null | undefined) => (v && v > 0 ? v : '—');
  const nc = (v: number) => v > 0 ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v) : '—';

  const thSort = (col: SortCol) => (
    <span className="cursor-pointer select-none hover:text-indigo-600 transition-colors" onClick={() => toggleSort(col)}>
      <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
    </span>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-10 h-10 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-full mx-auto animate-fade-in pb-20 px-4 sm:px-6 print:p-0 print:m-0">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 print:hidden flex-wrap">
        <button onClick={() => navigate(`/project/${id}/expenses`)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
          <HiOutlineArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Labour Expenses
          </h1>
          <p className="text-sm text-slate-400">
            {project?.name} • {project?.client}
            {project?.location && <> • {project.location}</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MonthPicker
            onSelect={(y, m) => {
              const firstDay = new Date(y, m, 1);
              const lastDay = new Date(y, m + 1, 0);
              setDateFrom(formatDateISO(firstDay));
              setDateTo(formatDateISO(lastDay));
            }}
          />
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <label className="text-xs text-slate-500 font-medium uppercase tracking-wider whitespace-nowrap">Period</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-sm text-slate-700 bg-transparent border-none outline-none" />
            <span className="text-slate-300">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-sm text-slate-700 bg-transparent border-none outline-none" />
          </div>
          <button onClick={handleExportTally} disabled={expenses.length === 0} className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40">
            <HiOutlineArrowDownTray className="w-4 h-4" /> Tally CSV
          </button>
          <button onClick={handleExportExcel} disabled={expenses.length === 0} className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40">
            <HiOutlineTableCells className="w-4 h-4" /> Excel
          </button>
          <button onClick={handleExportPDF} disabled={expenses.length === 0} className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40">
            <HiOutlineArrowDownTray className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => window.print()} className="btn-secondary flex items-center gap-1.5 text-sm">
            <HiOutlinePrinter className="w-4 h-4" /> Print
          </button>
          <button onClick={handleOpenManpowerPdf} disabled={manpowerImporting} className="btn-secondary flex items-center gap-1.5 text-sm">
            <HiOutlineArrowUpTray className="w-4 h-4" />
            {manpowerImporting ? 'Reading PDF…' : 'Import PDF'}
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm shadow-indigo-200 shadow-lg">
            <HiOutlinePlus className="w-4 h-4" /> Add Day
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="print:hidden mb-4 flex items-center gap-3 bg-indigo-600 text-white rounded-xl px-4 py-3 shadow-lg"
          >
            <HiOutlineSquare2Stack className="w-5 h-5 shrink-0" />
            <span className="font-semibold text-sm flex-1">{selected.size} item{selected.size !== 1 ? 's' : ''} selected</span>
            <button onClick={handleBulkMarkPaid} className="flex items-center gap-1.5 text-xs font-bold bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 transition-colors">
              <HiOutlineCheckCircle className="w-4 h-4" /> Mark Paid
            </button>
            <button onClick={() => setShowDuplicateModal(true)} className="flex items-center gap-1.5 text-xs font-bold bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 transition-colors">
              <HiOutlineSquare2Stack className="w-4 h-4" /> Duplicate
            </button>
            <button onClick={handleBulkDelete} className="flex items-center gap-1.5 text-xs font-bold bg-red-500/80 hover:bg-red-500 rounded-lg px-3 py-1.5 transition-colors">
              <HiOutlineTrash className="w-4 h-4" /> Delete
            </button>
            <button onClick={() => setSelected(new Set())} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
              <HiXMark className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Labour Ledger Table */}
      <div className="bg-white border-2 border-black overflow-hidden">
        <div className="grid grid-cols-2 border-b-2 border-black">
          <div className="p-3 bg-gray-200 border-r-2 border-black">
            <p className="text-base font-bold">Labour Expenses</p>
          </div>
          <div className="p-3 bg-gray-200 text-center">
            <p className="text-sm font-bold">
              {new Date(dateFrom + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
              {' '}to{' '}
              {new Date(dateTo + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th rowSpan={2} className="border-r border-black p-2 w-8 print:hidden font-bold align-bottom">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer" />
                </th>
                <th rowSpan={2} className="border-r border-black p-2 text-left w-10 font-bold align-bottom">Sr No</th>
                <th rowSpan={2} className="border-r border-black p-2 text-left w-16 font-bold align-bottom cursor-pointer select-none" onClick={() => toggleSort('expense_date')}>
                  Date {thSort('expense_date')}
                </th>
                <th colSpan={3} className="border-r border-black p-2 text-center font-bold border-b border-black">Mason</th>
                <th colSpan={3} className="border-r border-black p-2 text-center font-bold border-b border-black">Coolie</th>
                <th colSpan={3} className="border-r border-black p-2 text-center font-bold border-b border-black">Helper</th>
                <th colSpan={3} className="border-r border-black p-2 text-center font-bold border-b border-black">Other Labour</th>
                <th rowSpan={2} className="border-r border-black p-2 text-right w-24 font-bold align-bottom cursor-pointer select-none" onClick={() => toggleSort('amount')}>
                  Total Amount {thSort('amount')}
                </th>
                <th rowSpan={2} className="border-r border-black p-2 text-right w-24 font-bold align-bottom">Paid by Cash</th>
                <th rowSpan={2} className="border-r border-black p-2 text-right w-24 font-bold align-bottom">Paid by Cheque</th>
                <th rowSpan={2} className="border-r border-black p-2 text-right w-20 font-bold align-bottom cursor-pointer select-none" onClick={() => toggleSort('pending_payment')}>
                  Pending {thSort('pending_payment')}
                </th>
                <th rowSpan={2} className="p-2 text-left w-20 font-bold align-bottom">Payment date</th>
              </tr>
              <tr className="border-b-2 border-black">
                {['Mason','Coolie','Helper','Other'].flatMap((_, i) => [
                  <th key={`n${i}`} className="border-r border-black p-1 text-center w-12 font-semibold text-slate-600">Nos.</th>,
                  <th key={`r${i}`} className="border-r border-black p-1 text-center w-16 font-semibold text-slate-600">Rs. Each</th>,
                  <th key={`c${i}`} className="border-r border-black p-1 text-center w-20 font-semibold text-slate-600">Cost</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {sortedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={21} className="text-center py-16 text-slate-400 italic">
                    No labour entries. Click <button onClick={openAdd} className="text-indigo-500 underline">Add Day</button> to record daily labour.
                  </td>
                </tr>
              ) : (
                sortedExpenses.map((exp, idx) => {
                  const masonCost  = (exp.mason_count ?? 0)  * (exp.mason_rate ?? 0);
                  const coolieCost = (exp.coolie_count ?? 0) * (exp.coolie_rate ?? 0);
                  const helperCost = (exp.helper_count ?? 0) * (exp.helper_rate ?? 0);
                  const otherCost  = (exp.other_count ?? 0)  * (exp.other_rate ?? 0);
                  return (
                    <tr key={exp.id} className={`border-b border-black group hover:bg-indigo-50/20 transition-colors ${selected.has(exp.id) ? 'bg-indigo-50/40' : ''}`}>
                      {/* Checkbox */}
                      <td className="border-r border-black p-1.5 text-center align-top print:hidden" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(exp.id)} onChange={() => toggleOne(exp.id)} className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer" />
                      </td>
                      <td className="border-r border-black p-1.5 text-center align-top">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center gap-0.5">
                            <span>{idx + 1}</span>
                            {exp.attachment_path && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" title="Has attachment" />}
                          </div>
                          <div className="print:hidden opacity-0 group-hover:opacity-100 flex gap-0.5">
                            <button onClick={() => openEdit(exp)} className="p-0.5 rounded hover:bg-slate-100 text-slate-400" title="Edit">
                              <HiOutlinePencilSquare className="w-2.5 h-2.5" />
                            </button>
                            <button onClick={() => openDuplicate(exp)} className="p-0.5 rounded hover:bg-indigo-50 text-indigo-400" title="Duplicate">
                              <HiOutlineSquare2Stack className="w-2.5 h-2.5" />
                            </button>
                            <button onClick={() => handleDelete(exp)} className="p-0.5 rounded hover:bg-red-50 text-red-400" title="Delete">
                              <HiOutlineTrash className="w-2.5 h-2.5" />
                            </button>
                            {exp.attachment_path ? (
                              <>
                                <button onClick={() => window.electronAPI.openAttachment(exp.attachment_path!)} className="p-0.5 rounded hover:bg-green-50 text-green-600" title="View bill">
                                  <HiOutlineEye className="w-2.5 h-2.5" />
                                </button>
                                <button onClick={() => { window.electronAPI.removeAttachment(exp.id); loadData(); }} className="p-0.5 rounded hover:bg-slate-100 text-slate-400" title="Remove attachment">
                                  <HiOutlineXCircle className="w-2.5 h-2.5" />
                                </button>
                              </>
                            ) : (
                              <button onClick={async () => { const r = await window.electronAPI.attachPhoto(exp.id); if (r.success) loadData(); }} className="p-0.5 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-500" title="Attach bill / photo">
                                <HiOutlinePaperClip className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="border-r border-black p-1.5 align-top whitespace-nowrap font-medium">{fmtDate(exp.expense_date)}</td>
                      <td className="border-r border-black p-1.5 text-center align-top">{n(exp.mason_count)}</td>
                      <td className="border-r border-black p-1.5 text-center align-top">{n(exp.mason_rate)}</td>
                      <td className="border-r border-black p-1.5 text-right align-top">{nc(masonCost)}</td>
                      <td className="border-r border-black p-1.5 text-center align-top">{n(exp.coolie_count)}</td>
                      <td className="border-r border-black p-1.5 text-center align-top">{n(exp.coolie_rate)}</td>
                      <td className="border-r border-black p-1.5 text-right align-top">{nc(coolieCost)}</td>
                      <td className="border-r border-black p-1.5 text-center align-top">{n(exp.helper_count)}</td>
                      <td className="border-r border-black p-1.5 text-center align-top">{n(exp.helper_rate)}</td>
                      <td className="border-r border-black p-1.5 text-right align-top">{nc(helperCost)}</td>
                      <td className="border-r border-black p-1.5 text-center align-top">{n(exp.other_count)}</td>
                      <td className="border-r border-black p-1.5 text-center align-top">{n(exp.other_rate)}</td>
                      <td className="border-r border-black p-1.5 text-right align-top">{nc(otherCost)}</td>
                      <td className="border-r border-black p-1.5 text-right align-top font-semibold">{nc(exp.amount)}</td>
                      <td className="border-r border-black p-1.5 text-right align-top">{nc(exp.cash_payment)}</td>
                      <td className="border-r border-black p-1.5 text-right align-top">{exp.cheque_payment > 0 ? nc(exp.cheque_payment) : '—'}</td>
                      <td className="border-r border-black p-1.5 text-right align-top">{exp.pending_payment > 0 ? nc(exp.pending_payment) : '—'}</td>
                      <td className="p-1.5 align-top whitespace-nowrap text-xs">{exp.payment_date ? fmtDate(exp.payment_date) : (exp.pending_payment > 0 ? <span className="text-amber-500">Pending</span> : '—')}</td>
                    </tr>
                  );
                })
              )}

              {expenses.length > 0 && (
                <tr className="bg-gray-100 font-bold border-t-2 border-black text-[12px] print:bg-gray-100">
                  <td className="border-r border-black p-2 print:hidden"></td>
                  <td className="border-r border-black p-2 text-center" colSpan={2}>Total Expense</td>
                  <td className="border-r border-black p-2 text-center">{totMason > 0 ? totMason : '—'}</td>
                  <td className="border-r border-black p-2 text-center">—</td>
                  <td className="border-r border-black p-2 text-right">{nc(totMasonCost)}</td>
                  <td className="border-r border-black p-2 text-center">{totCoolie > 0 ? totCoolie : '—'}</td>
                  <td className="border-r border-black p-2 text-center">—</td>
                  <td className="border-r border-black p-2 text-right">{nc(totCoolieCost)}</td>
                  <td className="border-r border-black p-2 text-center">{totHelper > 0 ? totHelper : '—'}</td>
                  <td className="border-r border-black p-2 text-center">—</td>
                  <td className="border-r border-black p-2 text-right">{nc(totHelperCost)}</td>
                  <td className="border-r border-black p-2 text-center">{totOther > 0 ? totOther : '—'}</td>
                  <td className="border-r border-black p-2 text-center">—</td>
                  <td className="border-r border-black p-2 text-right">{nc(totOtherCost)}</td>
                  <td className="border-r border-black p-2 text-right">{formatCurrency(totAmount)}</td>
                  <td className="border-r border-black p-2 text-right">{formatCurrency(totCash)}</td>
                  <td className="border-r border-black p-2 text-right">{totCheque > 0 ? formatCurrency(totCheque) : '—'}</td>
                  <td className="border-r border-black p-2 text-right">—</td>
                  <td className="p-2"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manpower PDF Import Modal */}
      <AnimatePresence>
        {showManpowerModal && manpowerReport && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>Manpower Report Imported</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Review counts, enter daily rates, then save as Labour Expenses.</p>
                </div>
                <button onClick={() => setShowManpowerModal(false)}><HiXMark className="w-5 h-5 text-slate-400" /></button>
              </div>
              {manpowerReport.error ? (
                <div className="p-6 flex items-start gap-3">
                  <HiOutlineExclamationCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-600">Parse Error</p>
                    <p className="text-sm text-slate-500 mt-1">{manpowerReport.error}</p>
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-5">
                  <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-slate-400 mb-0.5">Period</p><p className="font-semibold text-slate-700">{manpowerReport.period || '—'}</p></div>
                    <div><p className="text-xs text-slate-400 mb-0.5">Project (in PDF)</p><p className="font-semibold text-slate-700">{manpowerReport.project || '—'}</p></div>
                    <div><p className="text-xs text-slate-400 mb-0.5">Supervisor</p><p className="font-semibold text-slate-700">{manpowerReport.supervisor || '—'}</p></div>
                    <div><p className="text-xs text-slate-400 mb-0.5">Ref No.</p><p className="font-semibold text-slate-700 text-xs break-all">{manpowerReport.refNo || '—'}</p></div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Worker Counts &amp; Daily Rates</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Mason',  count: manpowerReport.mason,  rate: masonRate,  setRate: setMasonRate  },
                        { label: 'Coolie', count: manpowerReport.coolie, rate: coolieRate, setRate: setCoolieRate },
                        { label: 'Helper', count: manpowerReport.helper, rate: helperRate, setRate: setHelperRate },
                        { label: 'Other',  count: manpowerReport.other,  rate: otherRate,  setRate: setOtherRate  },
                      ].map(({ label, count, rate, setRate }) => (
                        <div key={label} className={`rounded-xl border p-3 flex flex-col gap-2 ${count === 0 ? 'opacity-40' : 'border-slate-200'}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-700">{label}</span>
                            <span className="text-lg font-extrabold text-indigo-600">{count}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400">Rs.</span>
                            <input type="number" min="0" step="0.01" placeholder="Rate/day" value={rate}
                              onChange={(e) => setRate(e.target.value)} disabled={count === 0} className="input-field py-1.5 text-sm" />
                          </div>
                          {count > 0 && rate && (
                            <p className="text-xs text-emerald-600 font-semibold">= {formatCurrency(count * (parseFloat(rate) || 0))}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  {(masonRate || coolieRate || helperRate || otherRate) && (
                    <div className="bg-indigo-50 rounded-xl px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-bold text-indigo-700">Total Labour Amount</span>
                      <span className="text-lg font-extrabold text-indigo-700">
                        {formatCurrency(
                          manpowerReport.mason  * (parseFloat(masonRate)  || 0) +
                          manpowerReport.coolie * (parseFloat(coolieRate) || 0) +
                          manpowerReport.helper * (parseFloat(helperRate) || 0) +
                          manpowerReport.other  * (parseFloat(otherRate)  || 0)
                        )}
                      </span>
                    </div>
                  )}
                  {manpowerImportSuccess ? (
                    <div className="flex items-center justify-center gap-2 py-3 text-emerald-600 font-semibold text-sm">
                      <HiOutlineCheckCircle className="w-5 h-5" /> Labour expenses added successfully!
                    </div>
                  ) : (
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                      <button type="button" onClick={() => setShowManpowerModal(false)} className="btn-secondary">Cancel</button>
                      <button onClick={handleSaveManpowerExpenses} disabled={manpowerReport.grandTotal === 0} className="btn-primary">
                        Save as Labour Expenses
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Duplicate Date Modal */}
      <AnimatePresence>
        {showDuplicateModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
              <div className="p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-2">Duplicate Entries</h3>
                <p className="text-sm text-slate-500 mb-4">Select the target date for the {selected.size} duplicated entr{selected.size === 1 ? 'y' : 'ies'}.</p>
                <div className="mb-6">
                  <label className="input-label">New Date</label>
                  <input type="date" value={duplicateDate} onChange={(e) => setDuplicateDate(e.target.value)} className="input-field" />
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setShowDuplicateModal(false)} className="btn-secondary">Cancel</button>
                  <button onClick={handleBulkDuplicate} className="btn-primary">Duplicate</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {editingExpense ? 'Edit Labour Entry' : 'Add Daily Labour'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Enter counts and rates for each worker type</p>
                </div>
                <button onClick={closeModal}><HiXMark className="w-5 h-5 text-slate-400" /></button>
              </div>
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
                {Object.keys(formErrors).length > 0 && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 space-y-0.5">
                    {Object.values(formErrors).map((err, i) => <p key={i}>• {err}</p>)}
                  </div>
                )}
                <div className="mb-4">
                  <label className="input-label">Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    className={`input-field ${formErrors.expense_date ? 'border-red-400' : ''}`}
                    value={f('expense_date')}
                    onChange={(e) => { 
                      const newDate = e.target.value;
                      setFormData(prev => ({ ...prev, expense_date: newDate, payment_date: newDate })); 
                      setFormErrors((p) => ({ ...p, expense_date: '' })); 
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 mb-4">
                  {[
                    { type: 'mason', label: 'Mason' },
                    { type: 'coolie', label: 'Coolie' },
                    { type: 'helper', label: 'Helper' },
                    { type: 'other', label: 'Other Labour' },
                  ].map(({ type, label }) => {
                    const count    = parseFloat(f(`${type}_count`)) || 0;
                    const rate     = parseFloat(f(`${type}_rate`)) || 0;
                    const subtotal = count * rate;
                    return (
                      <div key={type} className={`rounded-xl border p-4 ${count > 0 ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200'}`}>
                        <p className="text-sm font-bold text-slate-700 mb-3">{label}</p>
                        <div className="grid grid-cols-3 gap-3 items-end">
                          <div>
                            <label className="input-label text-xs">Count</label>
                            <input type="number" min="0" step="1" className="input-field py-2 text-sm" placeholder="0"
                              value={f(`${type}_count`)} onChange={set(`${type}_count`)} />
                          </div>
                          <div>
                            <label className="input-label text-xs">Rate / Day (Rs.)</label>
                            <input type="number" min="0" step="0.01" className="input-field py-2 text-sm" placeholder="0"
                              value={f(`${type}_rate`)} onChange={set(`${type}_rate`)} />
                          </div>
                          <div>
                            <label className="input-label text-xs">Sub-total</label>
                            <div className={`px-3 py-2 rounded-xl text-sm font-semibold border text-right ${subtotal > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                              {subtotal > 0 ? `Rs.${new Intl.NumberFormat('en-IN').format(subtotal)}` : '—'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-indigo-50 rounded-xl px-4 py-3 flex-1 flex items-center justify-between mr-4">
                    <span className="text-sm font-bold text-indigo-700">Total Labour for the Day</span>
                    <span className="text-xl font-extrabold text-indigo-700">{formatCurrency(previewAmount)}</span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" className="w-4 h-4 rounded accent-indigo-600"
                        checked={f('round_off') === 'true'}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          if (isChecked) {
                            const total = computeAmount({ ...formData, round_off: '' });
                            const rounded = Math.round(total);
                            const diff = Math.round((rounded - total) * 100) / 100;
                            setFormData(prev => ({ ...prev, round_off: 'true', round_off_amount: String(diff) }));
                          } else {
                            setFormData(prev => ({ ...prev, round_off: '', round_off_amount: '0' }));
                          }
                        }} />
                      <span className="text-sm font-semibold text-slate-700">Round off</span>
                    </label>
                    {f('round_off') === 'true' && (
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1 scale-90 origin-right">
                        <button type="button" 
                          onClick={() => setFormData(p => ({...p, round_off_amount: String(Math.round((parseFloat(p.round_off_amount) - 1) * 100) / 100)}))}
                          className="p-1 hover:bg-white rounded text-slate-500 hover:text-indigo-600 transition-colors">
                          <HiOutlineMinus className="w-3.5 h-3.5" />
                        </button>
                        <input 
                          type="number" step="0.01" 
                          className="w-16 text-center text-xs font-bold bg-transparent border-none outline-none text-indigo-600"
                          value={f('round_off_amount')}
                          onChange={(e) => setFormData(p => ({...p, round_off_amount: e.target.value}))}
                        />
                        <button type="button" 
                          onClick={() => setFormData(p => ({...p, round_off_amount: String(Math.round((parseFloat(p.round_off_amount) + 1) * 100) / 100)}))}
                          className="p-1 hover:bg-white rounded text-slate-500 hover:text-indigo-600 transition-colors">
                          <HiOutlinePlus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Paid by Cash (Rs.)</label>
                    <input type="number" step="0.01" min="0" className="input-field"
                      placeholder={previewAmount > 0 ? String(previewAmount) : '0.00'}
                      value={f('cash_payment')} onChange={set('cash_payment')} />
                  </div>
                  <div>
                    <label className="input-label">Paid by Cheque (Rs.)</label>
                    <input type="number" step="0.01" min="0" className="input-field" placeholder="0.00" value={f('cheque_payment')} onChange={set('cheque_payment')} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="input-label">Pending (Rs.) <span className="text-[10px] font-normal text-indigo-400 normal-case tracking-normal">— auto-calculated</span></label>
                    <input type="number" step="0.01" className="input-field" placeholder="0.00" value={f('pending_payment')} onChange={set('pending_payment')} />
                  </div>
                  <div>
                    <label className="input-label">Payment Date</label>
                    <input type="date" className="input-field" value={f('payment_date')} onChange={set('payment_date')} />
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary" disabled={previewAmount === 0 && !editingExpense}>
                    {editingExpense ? 'Save Changes' : 'Add Labour Entry'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
