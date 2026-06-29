import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlineArrowLeft,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlinePencilSquare,
  HiOutlinePrinter,
  HiXMark,
  HiOutlinePaperClip,
  HiOutlineEye,
  HiOutlineXCircle,
  HiOutlineArrowsUpDown,
  HiOutlineArrowUp,
  HiOutlineArrowDown,
  HiOutlineDocumentArrowDown,
  HiOutlineCheckCircle,
  HiOutlineSquare2Stack,
  HiOutlineTableCells,
  HiOutlineMagnifyingGlass,
  HiOutlineUserGroup,
  HiOutlineChevronRight,
  HiOutlineCalendarDays,
  HiOutlineMinus,
  HiOutlineExclamationTriangle,
} from 'react-icons/hi2';
// xlsx-js-style is loaded dynamically inside handleExportExcel to avoid renderer crash
import MonthPicker from '@/components/MonthPicker';
import { Project, Expense, Vendor } from '@/types';
import { useLogActivity } from '@/hooks/useLogActivity';
import { generateId, UNIT_OPTIONS, formatDateISO } from '@/lib/calculations';
import { getExportMetadata } from '@/lib/export-utils';
import { useToast } from '@/context/ToastContext';

const GST_RATES = [5, 12, 18, 28];

type SortCol = 'expense_date' | 'amount' | 'vendor_name' | 'pending_payment';
type SortDir = 'asc' | 'desc';

const defaultForm = () => ({
  expense_date: new Date().toISOString().split('T')[0],
  vendor_name: '',
  description: '',
  invoice_no: '',
  quantity: '',
  unit: '',
  rate_unit: '',
  amount: '',
  cash_payment: '',
  cheque_payment: '',
  cheque_no: '',
  pending_payment: '',
  payment_date: new Date().toISOString().split('T')[0],
  remarks: '',
  has_gst: '',
  gst_rate: '18',
  gst_amount: '0',
  round_off: '',
  round_off_amount: '0',
});

const fmtNum = (v: number | null | undefined) => {
  if (v === null || v === undefined || v === 0) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(v);
};
const fmtCur = (v: number) =>
  v !== 0 ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(v) : '—';
const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol; sortDir: SortDir }) {
  if (col !== sortCol) return <HiOutlineArrowsUpDown className="w-3 h-3 opacity-40 ml-1" />;
  return sortDir === 'asc'
    ? <HiOutlineArrowUp className="w-3 h-3 text-indigo-500 ml-1" />
    : <HiOutlineArrowDown className="w-3 h-3 text-indigo-500 ml-1" />;
}

export default function VendorLedgerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vendorName = searchParams.get('vendor') || '';
  const category = searchParams.get('category') || '';
  const { showUndo, showSuccess } = useToast();

  const now = new Date();
  const [dateFrom, setDateFrom] = useState(new Date(now.getFullYear() - 2, 0, 1).toISOString().split('T')[0]);
  const [dateTo,   setDateTo]   = useState(new Date(now.getFullYear() + 1, 11, 31).toISOString().split('T')[0]);

  const [project,       setProject]       = useState<Project | null>(null);
  useLogActivity(id, project, 'ledger/vendor', 'Vendor Ledger');
  const [expenses,      setExpenses]      = useState<Expense[]>([]);
  const [vendors,       setVendors]       = useState<Vendor[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showModal,     setShowModal]     = useState(false);
  const [editingExpense,setEditingExpense]= useState<Expense | null>(null);
  const [formData,      setFormData]      = useState<Record<string, string>>(defaultForm());

  // Sorting
  const [sortCol, setSortCol] = useState<SortCol>('expense_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Form errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Settlement (Contract)
  const [settlement, setSettlement] = useState<any>(null);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementForm, setSettlementForm] = useState({
    work_description: '',
    quantity: '',
    unit: '',
    rate: '',
    settled_amount: '',
    use_settlement: 0, // 0 = calc, 1 = manual
  });

  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateDate, setDuplicateDate] = useState(new Date().toISOString().split('T')[0]);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  // Party picker
  const [showPartyPicker,  setShowPartyPicker]  = useState(false);
  const [pickerSearch,     setPickerSearch]     = useState('');
  const [showAddInPicker,  setShowAddInPicker]  = useState(false);
  const [newPartyForm,     setNewPartyForm]     = useState({
    name: '', category: (category || 'vendor') as Vendor['category'],
    contact_person: '', phone: '', email: '', gstin: '', notes: '',
  });

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setSelected(new Set());
    try {
      const [proj, exps, vends, sett] = await Promise.all([
        window.electronAPI.getProject(id),
        vendorName
          ? window.electronAPI.getExpensesByVendor(id, vendorName, dateFrom, dateTo)
          : window.electronAPI.getExpensesByCategory(id, category, dateFrom, dateTo),
        window.electronAPI.getVendors(),
        vendorName ? window.electronAPI.getVendorSettlement(id, vendorName) : Promise.resolve(null),
      ]);
      setProject(proj);
      setExpenses(exps);
      setVendors(vends);
      setSettlement(sett);
      if (sett) {
        setSettlementForm({
          work_description: sett.work_description || '',
          quantity: sett.quantity ? String(sett.quantity) : '',
          unit: sett.unit || '',
          rate: sett.rate ? String(sett.rate) : '',
          settled_amount: sett.settled_amount ? String(sett.settled_amount) : '',
          use_settlement: sett.use_settlement ?? 0,
        });
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [id, vendorName, category, dateFrom, dateTo]);

  useEffect(() => { loadData(); }, [loadData]);

  const sortedExpenses = useMemo(() => {
    const copy = [...expenses];
    copy.sort((a, b) => {
      let va: any = a[sortCol] ?? '';
      let vb: any = b[sortCol] ?? '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [expenses, sortCol, sortDir]);

  const descriptionSuggestions = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach(e => {
      if (e.description) set.add(e.description.trim());
    });
    return Array.from(set).sort();
  }, [expenses]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  // Bulk helpers
  const allSelected = selected.size === expenses.length && expenses.length > 0;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(expenses.map((e) => e.id)));
  };
  const toggleOne = (expId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(expId) ? next.delete(expId) : next.add(expId);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = [...selected];
    const removed = expenses.filter((e) => ids.includes(e.id));
    setExpenses((prev) => prev.filter((e) => !ids.includes(e.id)));
    setSelected(new Set());
    await window.electronAPI.bulkDeleteExpenses(ids);
    showUndo(
      `${ids.length} entr${ids.length === 1 ? 'y' : 'ies'} deleted`,
      async () => {},
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
        cash_payment: exp.cash_payment,
        cheque_payment: exp.cheque_payment,
        pending_payment: exp.pending_payment,
        attachment_path: null,
      });
    }
    
    setSelected(new Set());
    setShowDuplicateModal(false);
    showSuccess(`${ids.length} entr${ids.length === 1 ? 'y' : 'ies'} duplicated to ${fmtDate(duplicateDate)}`);
    loadData();
  };

  const handleDeleteAll = async () => {
    if (!id || !vendorName) return;
    await window.electronAPI.deleteExpensesByVendor(id, vendorName);
    setShowDeleteAllModal(false);
    navigate(`/project/${id}/expenses`);
  };

  const closeModal = () => { setShowModal(false); setEditingExpense(null); setFormData(defaultForm()); setFormErrors({}); };
  const openAdd    = () => { setFormData({ ...defaultForm(), vendor_name: category === 'site' ? 'Site Expenses' : vendorName }); setShowModal(true); };

  const openEdit = (exp: Expense) => {
    setEditingExpense(exp);
    const hasGst = !!(exp.has_gst);
    const gstAmt = exp.gst_amount ?? 0;
    const roundOffAmt = exp.round_off_amount ?? 0;
    const displayAmount = String(exp.amount - gstAmt - roundOffAmt);
    setFormData({
      expense_date:    exp.expense_date,
      vendor_name:     exp.vendor_name ?? vendorName,
      description:     exp.description ?? '',
      invoice_no:      exp.invoice_no ?? '',
      quantity:        exp.quantity != null ? String(exp.quantity) : '',
      unit:            exp.unit ?? '',
      rate_unit:       exp.rate_unit != null ? String(exp.rate_unit) : '',
      amount:          displayAmount,
      cash_payment:    exp.cash_payment ? String(exp.cash_payment) : '',
      cheque_payment:  exp.cheque_payment ? String(exp.cheque_payment) : '',
      cheque_no:       exp.cheque_no ?? '',
      pending_payment: exp.pending_payment ? String(exp.pending_payment) : '',
      payment_date:    exp.payment_date ?? exp.expense_date,
      remarks:         exp.remarks ?? '',
      has_gst:         hasGst ? 'true' : '',
      gst_rate:        exp.gst_rate ? String(exp.gst_rate) : '18',
      gst_amount:      gstAmt ? String(gstAmt) : '0',
      round_off:       exp.round_off ? 'true' : '',
      round_off_amount: exp.round_off_amount ? String(exp.round_off_amount) : '0',
    });
    setShowModal(true);
  };

  const openDuplicate = (exp: Expense) => {
    setEditingExpense(null);
    const hasGst = !!(exp.has_gst);
    const gstAmt = exp.gst_amount ?? 0;
    const roundOffAmt = exp.round_off_amount ?? 0;
    const displayAmount = String(exp.amount - gstAmt - roundOffAmt);
    setFormData({
      expense_date:    new Date().toISOString().split('T')[0],
      vendor_name:     exp.vendor_name ?? vendorName,
      description:     exp.description ?? '',
      invoice_no:      exp.invoice_no ?? '',
      quantity:        exp.quantity != null ? String(exp.quantity) : '',
      unit:            exp.unit ?? '',
      rate_unit:       exp.rate_unit != null ? String(exp.rate_unit) : '',
      amount:          displayAmount,
      cash_payment:    exp.cash_payment ? String(exp.cash_payment) : '',
      cheque_payment:  exp.cheque_payment ? String(exp.cheque_payment) : '',
      cheque_no:       exp.cheque_no ?? '',
      pending_payment: exp.pending_payment ? String(exp.pending_payment) : '',
      payment_date:    new Date().toISOString().split('T')[0],
      remarks:         exp.remarks ?? '',
      has_gst:         hasGst ? 'true' : '',
      gst_rate:        exp.gst_rate ? String(exp.gst_rate) : '18',
      gst_amount:      gstAmt ? String(gstAmt) : '0',
      round_off:       exp.round_off ? 'true' : '',
      round_off_amount: exp.round_off_amount ? String(exp.round_off_amount) : '0',
    });
    setShowModal(true);
  };

  // ── Party Picker helpers ────────────────────────────────────────────────────
  const openPartyPicker = () => {
    setPickerSearch('');
    setShowAddInPicker(false);
    setNewPartyForm({ name: '', category: (category || 'vendor') as Vendor['category'], contact_person: '', phone: '', email: '', gstin: '', notes: '' });
    setShowPartyPicker(true);
  };

  const handleSelectParty = (name: string) => {
    setFormData((prev) => ({ ...prev, vendor_name: name }));
    setShowPartyPicker(false);
  };

  const handleAddPartyFromPicker = async () => {
    if (!newPartyForm.name.trim()) return;
    await window.electronAPI.createVendor({
      id: generateId('vnd'),
      name:           newPartyForm.name.trim(),
      category:       newPartyForm.category,
      contact_person: newPartyForm.contact_person.trim() || null,
      phone:          newPartyForm.phone.trim() || null,
      email:          newPartyForm.email.trim() || null,
      gstin:          newPartyForm.gstin.trim().toUpperCase() || null,
      notes:          newPartyForm.notes.trim() || null,
    });
    const updated = await window.electronAPI.getVendors();
    setVendors(updated);
    handleSelectParty(newPartyForm.name.trim());
  };

  // Auto-calculate payment logic
  useEffect(() => {
    if (!showModal) return;

    const qty = parseFloat(formData.quantity) || null;
    const rate = parseFloat(formData.rate_unit) || null;
    const baseAmount = qty && rate ? qty * rate : parseFloat(formData.amount) || 0;

    const hasGst = formData.has_gst === 'true';
    const gstRate = hasGst ? (parseFloat(formData.gst_rate) || 0) : 0;
    const gstAmount = hasGst ? Math.round(baseAmount * gstRate / 100 * 100) / 100 : 0;
    let totalAmount = baseAmount + gstAmount;

    const updates: Record<string, string> = {};

    if (formData.round_off === 'true') {
      const rounded = Math.round(totalAmount);
      const diff = Math.round((rounded - totalAmount) * 100) / 100;
      if (String(diff) !== formData.round_off_amount) {
        updates.round_off_amount = String(diff);
      }
      totalAmount = rounded;
    }

    const cash = parseFloat(formData.cash_payment) || 0;
    const cheque = parseFloat(formData.cheque_payment) || 0;
    const pending = Math.max(0, Math.round((totalAmount - cash - cheque) * 100) / 100);
    const pendingStr = pending > 0 ? String(pending) : '';
    if (pendingStr !== formData.pending_payment) {
      updates.pending_payment = pendingStr;
    }

    if (Object.keys(updates).length > 0) {
      setFormData(prev => ({ ...prev, ...updates }));
    }
  }, [formData.quantity, formData.rate_unit, formData.amount, formData.has_gst, formData.gst_rate, formData.cash_payment, formData.cheque_payment, formData.round_off, formData.round_off_amount, showModal]);

  // Handle auto-filling cash payment on submit if all empty
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const errors: Record<string, string> = {};
    if (!formData.expense_date)         errors.expense_date  = 'Date is required.';
    if (category !== 'site' && !formData.vendor_name.trim())   errors.vendor_name   = 'Party / vendor name is required.';
    
    const qty  = parseFloat(formData.quantity) || null;
    const rate = parseFloat(formData.rate_unit) || null;
    const baseAmount = qty && rate ? qty * rate : parseFloat(formData.amount) || 0;
    if (baseAmount <= 0)                errors.amount        = 'Amount must be greater than 0.';

    const hasGst  = formData.has_gst === 'true';
    const gstRate = hasGst ? (parseFloat(formData.gst_rate) || 0) : 0;
    const gstAmount = hasGst ? Math.round(baseAmount * gstRate / 100 * 100) / 100 : 0;
    let totalAmount = baseAmount + gstAmount;
    if (formData.round_off === 'true') {
      totalAmount += (parseFloat(formData.round_off_amount) || 0);
    }

    let _cashPay    = parseFloat(formData.cash_payment)    || 0;
    let _chequePay  = parseFloat(formData.cheque_payment)  || 0;
    let _pendingPay = parseFloat(formData.pending_payment) || 0;

    // AUTO PAYMENT LOGIC: If all payment fields are empty, assume full cash payment
    if (!formData.cash_payment && !formData.cheque_payment && !formData.pending_payment) {
      _cashPay = totalAmount;
    }

    if (_cashPay + _chequePay + _pendingPay > totalAmount + 0.01)
      errors.payment = `Payments (${_cashPay + _chequePay + _pendingPay}) exceed total (Rs.${totalAmount.toFixed(2)}).`;
    
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});

    const payload = {
      expense_date:    formData.expense_date,
      category:        (category || 'vendor') as Expense['category'],
      vendor_name:     category === 'site' ? 'Site Expenses' : (formData.vendor_name.trim() || null),
      description:     formData.description || null,
      invoice_no:      formData.invoice_no || null,
      quantity:        qty,
      unit:            formData.unit || null,
      rate_unit:       rate,
      amount:          totalAmount,
      advance_amt:     0,
      cash_payment:    _cashPay,
      cheque_payment:  _chequePay,
      cheque_no:       formData.cheque_no || null,
      pending_payment: _pendingPay,
      payment_date:    formData.payment_date || formData.expense_date || null,
      remarks:         formData.remarks || null,
      has_gst:         hasGst ? 1 : 0,
      gst_rate:        gstRate,
      gst_amount:      gstAmount,
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
      async () => {},
      async () => {
        await window.electronAPI.createExpense(exp);
        loadData();
      }
    );
  };

  const handleAttach = async (expId: string) => {
    const res = await window.electronAPI.attachPhoto(expId);
    if (res.success) loadData();
  };

  const handleOpenAttachment = async (path: string) => {
    await window.electronAPI.openAttachment(path);
  };

  const handleRemoveAttachment = async (expId: string) => {
    await window.electronAPI.removeAttachment(expId);
    loadData();
  };

  const handleExportPDF = async () => {
    const { filename, subPath } = getExportMetadata(title, project, dateFrom, dateTo, category);
    const res = await window.electronAPI.printToPDF(`${filename}.pdf`, subPath);
    if (res.success) showSuccess('PDF saved successfully');
  };

  const handleExportTally = async () => {
    if (!id) return;
    const res = await window.electronAPI.exportTally(id, dateFrom, dateTo);
    if (res.success) showSuccess('Tally XML exported');
    else console.error(res.error);
  };





  const handleExportExcel = async () => {
    const headers = [
      'Sr No', 'Date', 'Vendor / Party', 'Description', 'Bill No.',
      'Qty', 'Unit', 'Rate (Rs.)',
      'Amount (Rs.)', 'Paid by Cash (Rs.)', 'Paid by Cheque (Rs.)',
      'Cheque No', 'Pending (Rs.)', 'Payment Date',
    ];
    const numCols = headers.length; // 14

    // ── Style definitions ────────────────────────────────────────────────────
    const borderThin = { style: 'thin', color: { rgb: 'B0B8C8' } };
    const borderMedium = { style: 'medium', color: { rgb: '4472C4' } };
    const allBorderThin = { top: borderThin, bottom: borderThin, left: borderThin, right: borderThin };
    const allBorderMedium = { top: borderMedium, bottom: borderMedium, left: borderMedium, right: borderMedium };

    const titleStyle = {
      font: { bold: true, sz: 14, color: { rgb: '1F3864' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      fill: { fgColor: { rgb: 'D9E1F2' }, patternType: 'solid' },
      border: allBorderMedium,
    };
    const periodStyle = {
      font: { italic: true, sz: 10, color: { rgb: '595959' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      fill: { fgColor: { rgb: 'EEF2FA' }, patternType: 'solid' },
      border: allBorderThin,
    };
    const headerStyle = {
      font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      fill: { fgColor: { rgb: '2F5496' }, patternType: 'solid' },
      border: allBorderMedium,
    };
    const dataStyleBase = {
      font: { sz: 10 },
      alignment: { vertical: 'center', wrapText: true },
      border: allBorderThin,
    };
    const dataStyleAlt = {
      ...dataStyleBase,
      fill: { fgColor: { rgb: 'F2F6FF' }, patternType: 'solid' },
    };
    const numberStyle = (base: any) => ({ ...base, alignment: { ...base.alignment, horizontal: 'right' }, numFmt: '#,##0.00' });
    const centerStyle = (base: any) => ({ ...base, alignment: { ...base.alignment, horizontal: 'center' } });
    const totalStyle = {
      font: { bold: true, sz: 10, color: { rgb: '1F3864' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      fill: { fgColor: { rgb: 'D9E1F2' }, patternType: 'solid' },
      border: allBorderMedium,
      numFmt: '#,##0.00',
    };
    const totalLabelStyle = {
      font: { bold: true, sz: 10, color: { rgb: '1F3864' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      fill: { fgColor: { rgb: 'D9E1F2' }, patternType: 'solid' },
      border: allBorderMedium,
    };

    // ── Helper: encode column letter ─────────────────────────────────────────
    const colLetter = (c: number) => {
      let s = '';
      let n = c + 1;
      while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); }
      return s;
    };
    const cellAddr = (r: number, c: number) => `${colLetter(c)}${r + 1}`;

    const ws: any = {};
    const merges: any[] = [];

    let rowIdx = 0;

    // ── Row 0: Title ─────────────────────────────────────────────────────────
    ws[cellAddr(rowIdx, 0)] = { v: `${project?.name || ''} — ${title}`, t: 's', s: titleStyle };
    for (let c = 1; c < numCols; c++) ws[cellAddr(rowIdx, c)] = { v: '', t: 's', s: titleStyle };
    merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: numCols - 1 } });
    rowIdx++;

    // ── Row 1: Period ─────────────────────────────────────────────────────────
    ws[cellAddr(rowIdx, 0)] = { v: `Period: ${dateFrom} to ${dateTo}`, t: 's', s: periodStyle };
    for (let c = 1; c < numCols; c++) ws[cellAddr(rowIdx, c)] = { v: '', t: 's', s: periodStyle };
    merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: numCols - 1 } });
    rowIdx++;

    // ── Row 2: blank spacer ───────────────────────────────────────────────────
    rowIdx++;

    // ── Row 3: Header ─────────────────────────────────────────────────────────
    headers.forEach((h, c) => {
      ws[cellAddr(rowIdx, c)] = { v: h, t: 's', s: headerStyle };
    });
    rowIdx++;

    // ── Data rows ─────────────────────────────────────────────────────────────
    // Number column indices: Rate(7), Amount(8), Cash(9), Cheque(10), Pending(12)
    const numericCols = new Set([7, 8, 9, 10, 12]);
    const centerCols = new Set([0, 1, 5, 6, 11, 13]); // Sr,Date,Qty,Unit,ChequeNo,PayDate

    sortedExpenses.forEach((e, i) => {
      const base = i % 2 === 0 ? dataStyleBase : dataStyleAlt;
      const row = [
        i + 1,
        e.expense_date,
        e.vendor_name || '',
        e.description || '',
        e.invoice_no || '',
        e.quantity ?? '',
        e.unit || '',
        e.rate_unit ?? '',
        e.amount,
        e.cash_payment,
        e.cheque_payment,
        e.cheque_no || '',
        e.pending_payment,
        e.payment_date || '',
      ];
      row.forEach((val, c) => {
        const isNum = numericCols.has(c) && typeof val === 'number';
        const isCtr = centerCols.has(c);
        let s = isNum ? numberStyle(base) : isCtr ? centerStyle(base) : { ...base, alignment: { ...base.alignment, horizontal: 'left' } };
        ws[cellAddr(rowIdx, c)] = { v: val === '' || val == null ? '' : val, t: isNum ? 'n' : 's', s };
      });
      rowIdx++;
    });

    // ── Blank spacer before totals ────────────────────────────────────────────
    rowIdx++;

    // ── Total row ─────────────────────────────────────────────────────────────
    const totalValues: (string | number)[] = [
      '', '', '', '', 'TOTAL',
      totalQty || '',
      '', '',
      totalAmt, totalCash, totalCheque,
      '', totalPending, '',
    ];
    totalValues.forEach((val, c) => {
      const isNum = numericCols.has(c) && typeof val === 'number';
      ws[cellAddr(rowIdx, c)] = {
        v: val === '' ? '' : val,
        t: isNum ? 'n' : 's',
        s: isNum ? totalStyle : totalLabelStyle,
      };
    });

    // ── Sheet range & column widths ───────────────────────────────────────────
    ws['!ref'] = `A1:${cellAddr(rowIdx, numCols - 1)}`;
    ws['!merges'] = merges;
    ws['!cols'] = [
      { wch: 6 },  // Sr No
      { wch: 12 }, // Date
      { wch: 24 }, // Vendor
      { wch: 30 }, // Description
      { wch: 12 }, // Bill No
      { wch: 7 },  // Qty
      { wch: 7 },  // Unit
      { wch: 12 }, // Rate
      { wch: 14 }, // Amount
      { wch: 14 }, // Cash
      { wch: 14 }, // Cheque
      { wch: 12 }, // Cheque No
      { wch: 14 }, // Pending
      { wch: 12 }, // Pay Date
    ];
    ws['!rows'] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 6 }, { hpt: 36 }]; // title/period/spacer/header heights

    const XLSXStyle = (await import('xlsx-js-style')).default ?? (await import('xlsx-js-style'));
    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Ledger');

    const { filename, subPath } = getExportMetadata(title, project, dateFrom, dateTo, category);
    const buffer = XLSXStyle.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const res = await window.electronAPI.saveFile(buffer, `${filename}.xlsx`, subPath);
    if (res.success) showSuccess('Excel saved successfully');
  };



  // Totals
  const totalQty     = expenses.reduce((s, e) => s + (e.quantity ?? 0), 0);
  const totalCash    = expenses.reduce((s, e) => s + e.cash_payment, 0);
  const totalCheque  = expenses.reduce((s, e) => s + e.cheque_payment, 0);
  const totalGst     = expenses.reduce((s, e) => s + (e.gst_amount ?? 0), 0);
  const totalTaxableAmt = expenses.reduce((s, e) => {
    if (e.has_gst) return s + (e.amount - (e.gst_amount ?? 0) - (e.round_off_amount ?? 0));
    return s + (e.amount - (e.round_off_amount ?? 0));
  }, 0);

  const totalAmt = settlement
    ? (settlement.use_settlement === 1 ? (settlement.settled_amount ?? 0) : (settlement.quantity || 0) * (settlement.rate || 0))
    : expenses.reduce((s, e) => s + e.amount, 0);

  const totalPending = settlement
    ? Math.max(0, totalAmt - (totalCash + totalCheque))
    : expenses.reduce((s, e) => s + e.pending_payment, 0);

  const handleSaveSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      id: settlement?.id || generateId('sett'),
      project_id: id!,
      vendor_name: vendorName,
      work_description: settlementForm.work_description || null,
      quantity: parseFloat(settlementForm.quantity) || null,
      unit: settlementForm.unit || null,
      rate: parseFloat(settlementForm.rate) || null,
      settled_amount: parseFloat(settlementForm.settled_amount) || null,
      use_settlement: settlementForm.use_settlement,
    };
    await window.electronAPI.saveVendorSettlement(payload);
    setShowSettlementModal(false);
    loadData();
    showSuccess('Settlement details saved');
  };

  const handleSettlementQtyRateChange = (key: 'quantity' | 'rate', val: string) => {
    setSettlementForm(prev => {
      const updated = { ...prev, [key]: val };
      const q = parseFloat(key === 'quantity' ? val : prev.quantity) || 0;
      const r = parseFloat(key === 'rate' ? val : prev.rate) || 0;
      if (q > 0 && r > 0) {
        updated.settled_amount = String(Math.round(q * r));
      }
      return updated;
    });
  };

  const f   = (key: string) => formData[key] ?? '';
  const set = (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setFormData((prev) => ({ ...prev, [key]: e.target.value }));

  const handleQtyRateChange = (key: 'quantity' | 'rate_unit', val: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [key]: val };
      const q = parseFloat(key === 'quantity' ? val : prev.quantity) || 0;
      const r = parseFloat(key === 'rate_unit' ? val : prev.rate_unit) || 0;
      if (q > 0 && r > 0) updated.amount = String(q * r);
      return updated;
    });
  };

  const title = vendorName || (category === 'labour' ? "Labour's Expenses" : category === 'site' ? 'Site Expenses' : category);

  const thCls = "border-r border-black p-2 font-bold cursor-pointer select-none hover:bg-indigo-50/50 transition-colors print:cursor-default";

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-10 h-10 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto animate-fade-in pb-20 px-4 sm:px-6 print:max-w-none print:p-0 print:m-0">
      {/* Header */}
      <div className="mb-6 print:hidden">
        {/* Title row */}
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(`/project/${id}/expenses`)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors shrink-0">
            <HiOutlineArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {title}
            </h1>
            <p className="text-sm text-slate-400 truncate">
              {[project?.name, project?.client, project?.location].filter(Boolean).join(' • ')}
            </p>
          </div>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm shadow-indigo-200 shadow-lg shrink-0">
            <HiOutlinePlus className="w-4 h-4" /> Add Entry
          </button>
        </div>
        {/* Controls row */}
        <div className="flex items-center gap-2 flex-wrap">
          <MonthPicker
            onSelect={(y, m) => {
              const firstDay = new Date(y, m, 1);
              const lastDay = new Date(y, m + 1, 0);
              setDateFrom(formatDateISO(firstDay));
              setDateTo(formatDateISO(lastDay));
            }}
          />
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <label className="text-xs text-slate-500 font-medium uppercase tracking-wider whitespace-nowrap hidden sm:block">Period</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-xs sm:text-sm text-slate-700 bg-transparent border-none outline-none w-[6.5rem] sm:w-auto" />
            <span className="text-slate-300 shrink-0">–</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-xs sm:text-sm text-slate-700 bg-transparent border-none outline-none w-[6.5rem] sm:w-auto" />
          </div>
          <button onClick={handleExportExcel} className="btn-secondary flex items-center gap-1.5 text-sm" title="Export Excel">
            <HiOutlineTableCells className="w-4 h-4" /><span className="hidden lg:inline">Excel</span>
          </button>
          <button onClick={handleExportPDF} className="btn-secondary flex items-center gap-1.5 text-sm" title="Save as PDF">
            <HiOutlineDocumentArrowDown className="w-4 h-4" /><span className="hidden lg:inline">PDF</span>
          </button>
          <button onClick={() => window.print()} className="btn-secondary flex items-center gap-1.5 text-sm" title="Print">
            <HiOutlinePrinter className="w-4 h-4" /><span className="hidden lg:inline">Print</span>
          </button>
          {vendorName && (
            <button
              onClick={() => setShowDeleteAllModal(true)}
              className="btn-secondary flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50"
              title="Delete all entries for this vendor"
            >
              <HiOutlineTrash className="w-4 h-4" /><span className="hidden lg:inline">Delete All</span>
            </button>
          )}
        </div>
      </div>

      {/* Settlement Info Section */}
      {vendorName && (category === 'vendor' || category === 'contractor') && (
        <div className="mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm print:hidden">
          <div className="flex items-center justify-between mb-4 gap-2 min-w-0">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider truncate">Work / Settlement Details</h3>
            <button
              onClick={() => setShowSettlementModal(true)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              Edit Details
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-1 truncate">Description</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 break-words">{settlement?.work_description || 'Not set'}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-1 truncate">Agreed Qty / Rate</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 break-words">
                {settlement?.quantity ? `${settlement.quantity} ${settlement.unit || ''}` : '—'}
                {settlement?.rate ? ` @ Rs.${settlement.rate}` : ''}
              </p>
            </div>
            <div className="min-w-0">
              <p className={`text-[10px] font-bold uppercase mb-1 truncate ${settlement?.use_settlement === 0 ? 'text-indigo-500' : 'text-slate-400'}`}>
                Calculated Amt {settlement?.use_settlement === 0 && '(Applied)'}
              </p>
              <p className={`text-sm font-semibold ${settlement?.use_settlement === 0 ? 'text-indigo-600 font-bold' : 'text-slate-700 dark:text-slate-200'}`}>
                {settlement?.quantity && settlement?.rate ? `Rs.${new Intl.NumberFormat('en-IN').format(settlement.quantity * settlement.rate)}` : '—'}
              </p>
            </div>
            <div className="min-w-0">
              <p className={`text-[10px] font-bold uppercase mb-1 truncate ${settlement?.use_settlement === 1 ? 'text-indigo-500' : 'text-slate-400'}`}>
                Settled Amt {settlement?.use_settlement === 1 && '(Applied)'}
              </p>
              <p className={`text-lg font-extrabold ${settlement?.use_settlement === 1 ? 'text-indigo-600' : 'text-slate-700 dark:text-slate-200'}`}>
                {settlement?.settled_amount ? `Rs.${new Intl.NumberFormat('en-IN').format(settlement.settled_amount)}` : 'Not settled'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="print:hidden mb-4 flex items-center gap-2 flex-wrap bg-indigo-600 text-white rounded-xl px-4 py-3 shadow-lg"
          >
            <HiOutlineSquare2Stack className="w-5 h-5 shrink-0" />
            <span className="font-semibold text-sm flex-1 min-w-0 truncate">{selected.size} item{selected.size !== 1 ? 's' : ''} selected</span>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleBulkMarkPaid} className="flex items-center gap-1.5 text-xs font-bold bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap">
                <HiOutlineCheckCircle className="w-4 h-4" /><span className="hidden sm:inline">Mark Paid</span>
              </button>
              <button onClick={() => setShowDuplicateModal(true)} className="flex items-center gap-1.5 text-xs font-bold bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap">
                <HiOutlineSquare2Stack className="w-4 h-4" /><span className="hidden sm:inline">Duplicate</span>
              </button>
              <button onClick={handleBulkDelete} className="flex items-center gap-1.5 text-xs font-bold bg-red-500/80 hover:bg-red-500 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap">
                <HiOutlineTrash className="w-4 h-4" /><span className="hidden sm:inline">Delete</span>
              </button>
              <button onClick={() => setSelected(new Set())} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                <HiXMark className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
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

      {/* Delete All Confirmation Modal */}
      <AnimatePresence>
        {showDeleteAllModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <HiOutlineExclamationTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Delete All Entries</h3>
                </div>
                <p className="text-sm text-slate-600 mb-1">
                  This will permanently delete <span className="font-bold">{expenses.length} entr{expenses.length === 1 ? 'y' : 'ies'}</span> for:
                </p>
                <p className="text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-4 truncate">
                  {vendorName}
                </p>
                <p className="text-xs text-red-500 mb-5">This action cannot be undone.</p>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setShowDeleteAllModal(false)} className="btn-secondary">Cancel</button>
                  <button
                    onClick={handleDeleteAll}
                    className="btn-primary bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700 flex items-center gap-1.5"
                  >
                    <HiOutlineTrash className="w-4 h-4" /> Delete All
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print-only header */}
      <div className="hidden print:block text-center mb-2">
        <p className="text-lg font-bold">{project?.location || project?.name}</p>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border-2 border-black overflow-hidden">
        <div className="grid grid-cols-2 border-b-2 border-black">
          <div className="p-3 bg-gray-200 border-r-2 border-black min-w-0">
            <p className="text-base font-bold truncate">{title}</p>
          </div>
          <div className="p-3 bg-gray-200 text-center min-w-0">
            <p className="text-xs sm:text-sm font-bold truncate">
              {new Date(dateFrom + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              {' – '}
              {new Date(dateTo + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="border-b-2 border-black">
                {/* Checkbox col — print hidden */}
                <th className="border-r border-black p-2 w-8 print:hidden">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer" />
                </th>
                <th className="border-r border-black p-2 text-left w-12 font-bold">Sr No</th>
                <th className={thCls + ' w-20 text-left'} onClick={() => toggleSort('expense_date')}>
                  <span className="flex items-center">Date <SortIcon col="expense_date" sortCol={sortCol} sortDir={sortDir} /></span>
                </th>
                <th className={thCls + ' min-w-[180px] text-left'} onClick={() => toggleSort('vendor_name')}>
                  <span className="flex items-center">Description <SortIcon col="vendor_name" sortCol={sortCol} sortDir={sortDir} /></span>
                </th>
                <th className="border-r border-black p-2 text-right w-16 font-bold">Qty.</th>
                <th className="border-r border-black p-2 text-center w-16 font-bold">Unit</th>
                <th className="border-r border-black p-2 text-right w-24 font-bold">Rate (Rs.)</th>
                <th className="border-r border-black p-2 text-right w-28 font-bold">Taxable Amt</th>
                <th className={thCls + ' w-28 text-right'} onClick={() => toggleSort('amount')}>
                  <span className="flex items-center justify-end">Total Amount <SortIcon col="amount" sortCol={sortCol} sortDir={sortDir} /></span>
                </th>
                <th className="border-r border-black p-2 text-right w-28 font-bold">Paid by Cash</th>
                <th className="border-r border-black p-2 text-right w-28 font-bold">Paid by Cheque</th>
                <th className="border-r border-black p-2 text-right w-24 font-bold">Cheque No</th>
                <th className={thCls + ' w-28 text-right'} onClick={() => toggleSort('pending_payment')}>
                  <span className="flex items-center justify-end">Pending <SortIcon col="pending_payment" sortCol={sortCol} sortDir={sortDir} /></span>
                </th>
                <th className="p-2 text-left w-24 font-bold">Payment date</th>
              </tr>
            </thead>
            <tbody>
              {sortedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={15} className="text-center py-16 text-slate-400 italic">
                    No entries found. Click <button onClick={openAdd} className="text-indigo-500 underline">Add Entry</button> to get started.
                  </td>
                </tr>
              ) : (
                sortedExpenses.map((exp, idx) => (
                  <tr key={exp.id} className={`border-b border-black group hover:bg-indigo-50/20 transition-colors ${selected.has(exp.id) ? 'bg-indigo-50/40' : ''}`}>
                    {/* Checkbox */}
                    <td className="border-r border-black p-2 text-center align-top print:hidden" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(exp.id)} onChange={() => toggleOne(exp.id)} className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer" />
                    </td>
                    <td className="border-r border-black p-2 text-center align-top">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-0.5">
                          <span>{idx + 1}</span>
                          {exp.attachment_path && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" title="Has attachment" />}
                        </div>
                        <div className="print:hidden opacity-0 group-hover:opacity-100 flex gap-0.5">
                          <button onClick={() => openEdit(exp)} className="p-0.5 rounded hover:bg-slate-100 text-slate-400" title="Edit">
                            <HiOutlinePencilSquare className="w-3 h-3" />
                          </button>
                          <button onClick={() => openDuplicate(exp)} className="p-0.5 rounded hover:bg-indigo-50 text-indigo-400" title="Duplicate">
                            <HiOutlineSquare2Stack className="w-3 h-3" />
                          </button>
                          <button onClick={() => handleDelete(exp)} className="p-0.5 rounded hover:bg-red-50 text-red-400" title="Delete">
                            <HiOutlineTrash className="w-3 h-3" />
                          </button>
                          {exp.attachment_path ? (
                            <>
                              <button onClick={() => window.electronAPI.openAttachment(exp.attachment_path!)} className="p-0.5 rounded hover:bg-green-50 text-green-600" title="View bill">
                                <HiOutlineEye className="w-3 h-3" />
                              </button>
                              <button onClick={() => { window.electronAPI.removeAttachment(exp.id); loadData(); }} className="p-0.5 rounded hover:bg-slate-100 text-slate-400" title="Remove attachment">
                                <HiOutlineXCircle className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <button onClick={() => handleAttach(exp.id)} className="p-0.5 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-500" title="Attach bill / photo">
                              <HiOutlinePaperClip className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="border-r border-black p-2 align-top whitespace-nowrap">{fmtDate(exp.expense_date)}</td>
                    <td className="border-r border-black p-2 align-top max-w-[220px]">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="break-words">{exp.description || '—'}</span>
                          {exp.has_gst ? (
                            <span className="text-[10px] font-bold bg-green-100 text-green-700 border border-green-300 px-1 py-0.5 rounded whitespace-nowrap">
                              GST {exp.gst_rate}%
                            </span>
                          ) : null}
                        </div>
                        {exp.invoice_no && (
                          <span className="text-[10px] text-slate-400 font-mono break-all">Bill# {exp.invoice_no}</span>
                        )}
                      </div>
                    </td>
                    <td className="border-r border-black p-2 text-right align-top">{fmtNum(exp.quantity)}</td>
                    <td className="border-r border-black p-2 text-center align-top text-xs">{exp.unit || '—'}</td>
                    <td className="border-r border-black p-2 text-right align-top">{fmtNum(exp.rate_unit)}</td>
                    <td className="border-r border-black p-2 text-right align-top">
                      {(() => {
                        const taxable = exp.has_gst
                          ? (exp.amount - (exp.gst_amount ?? 0) - (exp.round_off_amount ?? 0))
                          : (exp.amount - (exp.round_off_amount ?? 0));
                        return <span>{fmtCur(taxable)}</span>;
                      })()}
                    </td>
                    <td className="border-r border-black p-2 text-right align-top font-semibold">{fmtCur(exp.amount)}</td>
                    <td className="border-r border-black p-2 text-right align-top">{fmtCur(exp.cash_payment)}</td>
                    <td className="border-r border-black p-2 text-right align-top">{fmtCur(exp.cheque_payment)}</td>
                    <td className="border-r border-black p-2 text-right align-top text-xs">{exp.cheque_no || '—'}</td>
                    <td className="border-r border-black p-2 text-right align-top">{fmtCur(exp.pending_payment)}</td>
                    <td className="p-2 align-top whitespace-nowrap text-xs">{exp.payment_date ? fmtDate(exp.payment_date) : (exp.pending_payment > 0 ? <span className="text-amber-500">Pending</span> : '—')}</td>
                  </tr>
                ))
              )}

              {expenses.length > 0 && (
                <>
                  <tr className="bg-gray-100 font-bold border-t-2 border-black">
                    <td className="border-r border-black p-3 text-center print:hidden"></td>
                    <td className="border-r border-black p-3 text-center" colSpan={3}>Total Expense</td>
                    <td className="border-r border-black p-3 text-right">{totalQty > 0 ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(totalQty) : '—'}</td>
                    <td className="border-r border-black p-3"></td>
                    <td className="border-r border-black p-3 text-right">—</td>
                    <td className="border-r border-black p-3 text-right">{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(totalTaxableAmt)}</td>
                    <td className="border-r border-black p-3 text-right">{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(totalAmt)}</td>
                    <td className="border-r border-black p-3 text-right">{totalCash > 0 ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(totalCash) : '—'}</td>
                    <td className="border-r border-black p-3 text-right">{totalCheque > 0 ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(totalCheque) : '—'}</td>
                    <td className="border-r border-black p-3"></td>
                    <td className="border-r border-black p-3 text-right">{totalPending !== 0 ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(totalPending) : '—'}</td>
                    <td className="p-3"></td>
                  </tr>
                  {totalGst > 0 && (
                    <tr className="bg-green-50 text-[12px] border-t border-black">
                      <td className="border-r border-black p-2 print:hidden"></td>
                      <td className="border-r border-black p-2 text-center text-green-700 font-bold" colSpan={7}>
                        GST Component (incl. in total above)
                      </td>
                      <td className="border-r border-black p-2 text-right text-green-700 font-bold">
                        {new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(totalGst)}
                      </td>
                      {/* Remaining columns for Site (5) or Vendor (6) */}
                      <td className="border-r border-black p-2"></td>
                      <td className="border-r border-black p-2"></td>
                      <td className="border-r border-black p-2"></td>
                      <td className="border-r border-black p-2"></td>
                      <td className="border-r border-black p-2"></td>
                      <td className="p-2"></td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {editingExpense ? 'Edit Entry' : 'Add Entry'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">{title}</p>
                </div>
                <button onClick={closeModal}><HiXMark className="w-5 h-5 text-slate-400" /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(100vh-12rem)]">
                {/* Summary error bar */}
                {Object.keys(formErrors).length > 0 && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 space-y-0.5">
                    {Object.values(formErrors).map((err, i) => <p key={i}>• {err}</p>)}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
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
                  {category !== 'site' && (
                  <div>
                    <label className="input-label">
                      Vendor / Party Name <span className="text-red-500">*</span>
                      {!editingExpense && vendorName ? (
                        <span className="ml-1.5 text-[10px] font-normal text-slate-400 normal-case tracking-normal">
                          — locked to this ledger
                        </span>
                      ) : vendors.length > 0 ? (
                        <span className="ml-1.5 text-[10px] font-normal text-indigo-400 normal-case tracking-normal">
                          — {vendors.length} in directory
                        </span>
                      ) : null}
                    </label>
                    {!editingExpense && vendorName ? (
                      <div className="input-field bg-slate-50 text-slate-600 select-none">
                        {f('vendor_name')}
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-2">
                          <input
                            list="vendor-options"
                            type="text"
                            className={`input-field flex-1 ${formErrors.vendor_name ? 'border-red-400' : ''}`}
                            placeholder="Type or browse directory…"
                            value={f('vendor_name')}
                            onChange={(e) => { set('vendor_name')(e); setFormErrors((p) => ({ ...p, vendor_name: '' })); }}
                          />
                          <button
                            type="button"
                            onClick={openPartyPicker}
                            title="Browse Party Directory"
                            className="px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-slate-500 hover:text-indigo-600 transition-colors"
                          >
                            <HiOutlineUserGroup className="w-4 h-4" />
                          </button>
                        </div>
                        <datalist id="vendor-options">
                          {vendors.map((v) => <option key={v.id} value={v.name} />)}
                        </datalist>
                      </>
                    )}
                  </div>
                  )}


                  <div>
                    <label className="input-label">Description / Item</label>
                    <input 
                      list="desc-options"
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. Steel, Cement, Dust…" 
                      value={f('description')} 
                      onChange={set('description')} 
                    />
                    <datalist id="desc-options">
                      {descriptionSuggestions.map(d => <option key={d} value={d} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="input-label">Bill / Invoice No.</label>
                    <input type="text" className="input-field" placeholder="e.g. MPAHD-26-27-017" value={f('invoice_no')} onChange={set('invoice_no')} />
                  </div>
                  <div>
                    <label className="input-label">Quantity</label>
                    <input type="number" step="0.01" min="0" className="input-field" placeholder="0.00"
                      value={f('quantity')} onChange={(e) => handleQtyRateChange('quantity', e.target.value)} />
                  </div>
                  <div>
                    <label className="input-label">Unit</label>
                    <input list="unit-options" type="text" className="input-field" placeholder="e.g. bags, kg, rft…"
                      value={f('unit')} onChange={set('unit')} />
                    <datalist id="unit-options">
                      {['nos','bags','kg','mt','rft','sqft','cum','brass','load','trip','lt','pcs','set','day','month'].map((u) => (
                        <option key={u} value={u} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="input-label">Rate (Rs.)</label>
                    <input type="number" step="0.01" min="0" className="input-field" placeholder="0.00"
                      value={f('rate_unit')} onChange={(e) => handleQtyRateChange('rate_unit', e.target.value)} />
                  </div>
                  <div className="col-span-2 space-y-3">
                    <div>
                      <label className="input-label">
                        {f('has_gst') === 'true' ? 'Base Amount (Excl. GST) Rs.' : 'Total Amount (Rs.)'} <span className="text-red-500">*</span>
                        {f('quantity') && f('rate_unit') && <span className="text-indigo-500 font-normal text-xs ml-1">— auto-calculated</span>}
                      </label>
                      <input
                        type="number" step="0.01" min="0"
                        className={`input-field ${formErrors.amount ? 'border-red-400' : ''}`}
                        placeholder="0.00"
                        value={f('amount')}
                        onChange={(e) => { set('amount')(e); setFormErrors((p) => ({ ...p, amount: '' })); }}
                      />
                      {f('has_gst') !== 'true' && f('round_off') === 'true' && f('amount') && (
                        <p className="text-xs text-indigo-600 font-semibold mt-1">
                          Final rounded amount: Rs.{new Intl.NumberFormat('en-IN').format((parseFloat(f('amount')) || 0) + (parseFloat(f('round_off_amount')) || 0))}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" className="w-4 h-4 rounded accent-green-600"
                          checked={f('has_gst') === 'true'}
                          onChange={(e) => setFormData((prev) => ({ ...prev, has_gst: e.target.checked ? 'true' : '' }))} />
                        <span className="text-sm font-semibold text-slate-700">GST Bill</span>
                      </label>
                      {f('has_gst') === 'true' && (
                        <div className="flex items-center gap-2 ml-2">
                          <span className="text-xs text-slate-500">Rate:</span>
                          <div className="flex gap-1">
                            {GST_RATES.map((r) => (
                              <button key={r} type="button"
                                onClick={() => setFormData((prev) => ({ ...prev, gst_rate: String(r) }))}
                                className={`px-2 py-0.5 rounded text-xs font-bold border transition-colors ${f('gst_rate') === String(r) ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-600 border-slate-300 hover:border-green-400'}`}>
                                {r}%
                              </button>
                            ))}
                          </div>
                          <input type="number" min="0" max="100" step="0.01" className="input-field py-1 w-20 text-sm"
                            placeholder="Custom" value={f('gst_rate')} onChange={set('gst_rate')} />
                        </div>
                      )}
                    </div>
                    {f('has_gst') === 'true' && f('amount') && (() => {
                      const base = parseFloat(f('amount')) || 0;
                      const rate = parseFloat(f('gst_rate')) || 0;
                      const gst  = Math.round(base * rate / 100 * 100) / 100;
                      let total = base + gst;
                      if (f('round_off') === 'true') total += (parseFloat(f('round_off_amount')) || 0);
                      return (
                        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm">
                          <div className="flex items-center gap-4 text-slate-600">
                            <span>Base: <span className="font-semibold">Rs.{new Intl.NumberFormat('en-IN').format(base)}</span></span>
                            <span>+</span>
                            <span className="text-green-700">GST ({rate}%): <span className="font-semibold">Rs.{new Intl.NumberFormat('en-IN').format(gst)}</span></span>
                          </div>
                          <span className="font-extrabold text-slate-800 text-base">= Rs.{new Intl.NumberFormat('en-IN').format(total)}</span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" className="w-4 h-4 rounded accent-indigo-600"
                          checked={f('round_off') === 'true'}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            if (isChecked) {
                              const qty = parseFloat(formData.quantity) || null;
                              const rate = parseFloat(formData.rate_unit) || null;
                              const base = qty && rate ? qty * rate : parseFloat(formData.amount) || 0;
                              const hasGst = formData.has_gst === 'true';
                              const gstRate = hasGst ? (parseFloat(formData.gst_rate) || 0) : 0;
                              const gstAmt = hasGst ? Math.round(base * gstRate / 100 * 100) / 100 : 0;
                              const total = base + gstAmt;
                              const rounded = Math.round(total);
                              const diff = Math.round((rounded - total) * 100) / 100;
                              setFormData(prev => ({ ...prev, round_off: 'true', round_off_amount: String(diff) }));
                            } else {
                              setFormData(prev => ({ ...prev, round_off: '', round_off_amount: '0' }));
                            }
                          }} />
                        <span className="text-sm font-semibold text-slate-700">Round off total amount</span>
                      </label>
                      {f('round_off') === 'true' && (
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
                          <button type="button" 
                            onClick={() => setFormData(p => ({...p, round_off_amount: String(Math.round((parseFloat(p.round_off_amount) - 1) * 100) / 100)}))}
                            className="p-1 hover:bg-white rounded text-slate-500 hover:text-indigo-600 transition-colors">
                            <HiOutlineMinus className="w-3.5 h-3.5" />
                          </button>
                          <input 
                            type="number" step="0.01" 
                            className="w-20 text-center text-sm font-bold bg-transparent border-none outline-none text-indigo-600"
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
                  <div>
                    <label className="input-label">Paid by Cash (Rs.)</label>
                    <input type="number" step="0.01" min="0"
                      className={`input-field ${formErrors.payment ? 'border-red-400' : ''}`}
                      placeholder="0.00" value={f('cash_payment')}
                      onChange={(e) => { set('cash_payment')(e); setFormErrors((p) => ({ ...p, payment: '' })); }} />
                  </div>
                  <div>
                    <label className="input-label">Paid by Cheque (Rs.)</label>
                    <input type="number" step="0.01" min="0"
                      className={`input-field ${formErrors.payment ? 'border-red-400' : ''}`}
                      placeholder="0.00" value={f('cheque_payment')}
                      onChange={(e) => { set('cheque_payment')(e); setFormErrors((p) => ({ ...p, payment: '' })); }} />
                  </div>
                  <div>
                    <label className="input-label">Cheque No.</label>
                    <input type="text" className="input-field" placeholder="e.g. 529751" value={f('cheque_no')} onChange={set('cheque_no')} />
                  </div>
                  <div>
                    <label className="input-label">Pending Amount (Rs.) <span className="text-[10px] font-normal text-indigo-400 normal-case tracking-normal">— auto-calculated</span></label>
                    <input type="number" step="0.01" className="input-field" placeholder="0.00" value={f('pending_payment')} onChange={set('pending_payment')} />
                  </div>
                  <div>
                    <label className="input-label">Payment Date</label>
                    <input type="date" className="input-field" value={f('payment_date')} onChange={set('payment_date')} />
                  </div>
                  <div>
                    <label className="input-label">Remarks</label>
                    <input type="text" className="input-field" placeholder="Optional notes" value={f('remarks')} onChange={set('remarks')} />
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary">{editingExpense ? 'Save Changes' : 'Add Entry'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Party Picker Modal ────────────────────────────────────────────────── */}
      {showPartyPicker && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => setShowPartyPicker(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
            style={{ maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <HiOutlineUserGroup className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Party Directory
                </h3>
                <span className="text-xs text-slate-400 ml-1">{vendors.length} parties</span>
              </div>
              <button onClick={() => setShowPartyPicker(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                <HiXMark className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <div className="relative">
                <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search parties…"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="input-field pl-9 text-sm"
                />
              </div>
            </div>

            {/* Party list */}
            <div className="flex-1 overflow-y-auto">
              {vendors.filter((v) => !pickerSearch || v.name.toLowerCase().includes(pickerSearch.toLowerCase())).length === 0 ? (
                <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-10">No matching parties</p>
              ) : (
                vendors
                  .filter((v) => !pickerSearch || v.name.toLowerCase().includes(pickerSearch.toLowerCase()))
                  .map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleSelectParty(v.name)}
                      className="w-full text-left px-5 py-3 border-b border-slate-50 dark:border-slate-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center justify-between gap-3 transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{v.name}</p>
                        {(v.phone || v.gstin) && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                            {[v.phone, v.gstin].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        v.category === 'vendor'     ? 'bg-sky-100 text-sky-700' :
                        v.category === 'contractor' ? 'bg-emerald-100 text-emerald-700' :
                        v.category === 'labour'     ? 'bg-indigo-100 text-indigo-700' :
                                                      'bg-amber-100 text-amber-700'
                      }`}>
                        {v.category}
                      </span>
                    </button>
                  ))
              )}
            </div>

            {/* Add new party section */}
            <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4">
              {!showAddInPicker ? (
                <button
                  type="button"
                  onClick={() => setShowAddInPicker(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:hover:border-indigo-500 dark:text-indigo-400 transition-colors text-sm font-semibold"
                >
                  <HiOutlinePlus className="w-4 h-4" /> Add New Party to Directory
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">New Party</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <input
                        autoFocus
                        type="text"
                        className="input-field text-sm"
                        placeholder="Party name *"
                        value={newPartyForm.name}
                        onChange={(e) => setNewPartyForm((p) => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <select
                        className="input-field text-sm"
                        value={newPartyForm.category}
                        onChange={(e) => setNewPartyForm((p) => ({ ...p, category: e.target.value as Vendor['category'] }))}
                      >
                        <option value="vendor">Vendor</option>
                        <option value="contractor">Contractor</option>
                        <option value="labour">Labour</option>
                        <option value="site">Site</option>
                      </select>
                    </div>
                    <div>
                      <input
                        type="text"
                        className="input-field text-sm"
                        placeholder="Phone"
                        value={newPartyForm.phone}
                        onChange={(e) => setNewPartyForm((p) => ({ ...p, phone: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        className="input-field text-sm font-mono"
                        placeholder="GSTIN (optional)"
                        maxLength={15}
                        value={newPartyForm.gstin}
                        onChange={(e) => setNewPartyForm((p) => ({ ...p, gstin: e.target.value.toUpperCase() }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddInPicker(false)}
                      className="flex-1 btn-secondary text-sm py-2"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddPartyFromPicker}
                      disabled={!newPartyForm.name.trim()}
                      className="flex-1 btn-primary text-sm py-2 disabled:opacity-40"
                    >
                      Save &amp; Select
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settlement Modal */}
      <AnimatePresence>
        {showSettlementModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800">Settlement Details</h2>
                <button onClick={() => setShowSettlementModal(false)}><HiXMark className="w-5 h-5 text-slate-400" /></button>
              </div>

              <form onSubmit={handleSaveSettlement} className="p-6 space-y-4">
                <div>
                  <label className="input-label">Work Description</label>
                  <input
                    type="text"
                    className="input-field"
                    value={settlementForm.work_description}
                    onChange={(e) => setSettlementForm(p => ({...p, work_description: e.target.value}))}
                    placeholder="e.g. Paint work, Structural work..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Quantity</label>
                    <input
                      type="number" step="0.01"
                      className="input-field"
                      value={settlementForm.quantity}
                      onChange={(e) => handleSettlementQtyRateChange('quantity', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label">Unit</label>
                    <input
                      list="sett-unit-options"
                      type="text"
                      className="input-field"
                      value={settlementForm.unit}
                      onChange={(e) => setSettlementForm(p => ({...p, unit: e.target.value}))}
                      placeholder="e.g. sqft"
                    />
                    <datalist id="sett-unit-options">
                      {UNIT_OPTIONS.map(u => <option key={u} value={u} />)}
                    </datalist>
                  </div>
                </div>
                <div>
                  <label className="input-label">Rate (Rs.)</label>
                  <input
                    type="number" step="0.01"
                    className="input-field"
                    value={settlementForm.rate}
                    onChange={(e) => handleSettlementQtyRateChange('rate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">Settled Amount (Manual Override)</label>
                  <input
                    type="number" step="0.01"
                    className="input-field"
                    value={settlementForm.settled_amount}
                    onChange={(e) => setSettlementForm(p => ({...p, settled_amount: e.target.value}))}
                    placeholder="e.g. 350000"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Apply in Calculations</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSettlementForm(p => ({...p, use_settlement: 0}))}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${settlementForm.use_settlement === 0 ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'}`}
                    >
                      <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Use Calculated</p>
                      <p className="text-sm font-extrabold text-slate-700">
                        Rs.{new Intl.NumberFormat('en-IN').format((parseFloat(settlementForm.quantity) || 0) * (parseFloat(settlementForm.rate) || 0))}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettlementForm(p => ({...p, use_settlement: 1}))}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${settlementForm.use_settlement === 1 ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'}`}
                    >
                      <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Use Manual</p>
                      <p className="text-sm font-extrabold text-slate-700">
                        Rs.{new Intl.NumberFormat('en-IN').format(parseFloat(settlementForm.settled_amount) || 0)}
                      </p>
                    </button>
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" className="btn-primary w-full py-3">
                    Save Details
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
