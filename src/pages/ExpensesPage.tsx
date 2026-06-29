import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  HiOutlineArrowLeft,
  HiOutlineTableCells,
  HiOutlinePlus,
  HiOutlineArrowRight,
  HiOutlineUsers,
  HiOutlineBuildingStorefront,
  HiOutlineTruck,
  HiOutlineWrenchScrewdriver,
  HiXMark,
  HiOutlineChevronRight,
  HiOutlinePencilSquare,
  HiOutlineMagnifyingGlass,
  HiOutlineUserGroup,
  HiOutlineCalendarDays,
} from 'react-icons/hi2';
import MonthPicker from '@/components/MonthPicker';
import { Project, Expense, Vendor } from '@/types';
import { formatCurrency, generateId, formatDateISO } from '@/lib/calculations';
import { useLogActivity } from '@/hooks/useLogActivity';

const COLORS = {
  indigo: { iconBg: 'bg-indigo-100', iconText: 'text-indigo-600' },
  emerald: { iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
  amber:  { iconBg: 'bg-amber-100',  iconText: 'text-amber-600'  },
  rose:   { iconBg: 'bg-rose-100',   iconText: 'text-rose-600'   },
} as const;

type ColorKey = keyof typeof COLORS;

interface PartyTotals {
  total: number;
  cash: number;
  cheque: number;
  pending: number;
}

const nc = (v: number) =>
  v !== 0
    ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(v)
    : '—';

function getCategoryTotals(expenses: Expense[], category: string): PartyTotals {
  return expenses
    .filter((e) => e.category === category)
    .reduce(
      (s, e) => ({
        total:   s.total   + e.amount,
        cash:    s.cash    + e.cash_payment,
        cheque:  s.cheque  + e.cheque_payment,
        pending: s.pending + e.pending_payment,
      }),
      { total: 0, cash: 0, cheque: 0, pending: 0 }
    );
}

function getParties(expenses: Expense[], category: string): [string, PartyTotals][] {
  const map: Record<string, PartyTotals> = {};
  for (const e of expenses) {
    if (e.category !== category) continue;
    const key = e.vendor_name?.trim() || '(unnamed)';
    if (!map[key]) map[key] = { total: 0, cash: 0, cheque: 0, pending: 0 };
    map[key].total   += e.amount;
    map[key].cash    += e.cash_payment;
    map[key].cheque  += e.cheque_payment;
    map[key].pending += e.pending_payment;
  }
  return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
}

// ── Sub-components ──────────────────────────────────────────────────────

function ExpenseCard({
  color, icon, title, totals, onOpen, openLabel,
}: {
  color: ColorKey;
  icon: React.ReactNode;
  title: string;
  totals: PartyTotals;
  onOpen: () => void;
  openLabel: string;
}) {
  const c = COLORS[color];
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-4 p-5">
        <div className={`w-11 h-11 rounded-xl ${c.iconBg} ${c.iconText} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-slate-800 text-base">{title}</h2>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 flex-wrap">
            <span>
              Total:{' '}
              <span className="font-semibold text-slate-700">
                {totals.total > 0 ? formatCurrency(totals.total) : '—'}
              </span>
            </span>
            {totals.pending > 0 && (
              <span className="text-amber-600">
                Pending:{' '}
                <span className="font-semibold">{formatCurrency(totals.pending)}</span>
              </span>
            )}
          </div>
        </div>
        <button onClick={onOpen} className="btn-primary flex items-center gap-1.5 text-sm shrink-0">
          {openLabel} <HiOutlineArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function PartyGroupCard({
  color, icon, title, totals, parties, projectId, category, navigate, onAddNew,
}: {
  color: ColorKey;
  icon: React.ReactNode;
  title: string;
  totals: PartyTotals;
  parties: [string, PartyTotals][];
  projectId: string;
  category: string;
  navigate: (path: string) => void;
  onAddNew: () => void;
}) {
  const c = COLORS[color];
  const partyLabel = category === 'contractor' ? 'Contractor' : 'Vendor';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-4 p-5 border-b border-slate-100">
        <div className={`w-11 h-11 rounded-xl ${c.iconBg} ${c.iconText} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-slate-800 text-base">{title}</h2>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 flex-wrap">
            <span>
              Total:{' '}
              <span className="font-semibold text-slate-700">
                {totals.total > 0 ? formatCurrency(totals.total) : '—'}
              </span>
            </span>
            {totals.pending > 0 && (
              <span className="text-amber-600">
                Pending:{' '}
                <span className="font-semibold">{formatCurrency(totals.pending)}</span>
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onAddNew}
          className="btn-secondary flex items-center gap-1.5 text-sm shrink-0"
        >
          <HiOutlinePlus className="w-4 h-4" />
          New {partyLabel}
        </button>
      </div>

      {parties.length > 0 ? (
        <div className="divide-y divide-slate-100">
          {parties.map(([name, t]) => (
            <button
              key={name}
              onClick={() =>
                navigate(
                  `/project/${projectId}/ledger/vendor?vendor=${encodeURIComponent(name)}&category=${category}`
                )
              }
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left group"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-700 text-sm truncate">{name}</p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                  {t.cash > 0 && <span>Cash: {nc(t.cash)}</span>}
                  {t.cheque > 0 && <span>Cheque: {nc(t.cheque)}</span>}
                  {t.pending !== 0 && (
                    <span className={t.pending > 0 ? 'text-amber-500' : 'text-emerald-500'}>
                      Pending: {nc(t.pending)}
                    </span>
                  )}
                </div>
              </div>
              <p className="font-bold text-slate-800 text-sm shrink-0">
                {formatCurrency(t.total)}
              </p>
              <HiOutlineChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-slate-400 italic">
          No entries yet — click "New {partyLabel}" to start.
        </p>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  useLogActivity(id, project, 'expenses', 'Expenses');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [directoryVendors, setDirectoryVendors] = useState<Vendor[]>([]);
  const [showNewPartyModal, setShowNewPartyModal] = useState(false);
  const [newPartyCategory, setNewPartyCategory] = useState<'vendor' | 'contractor'>('vendor');
  const [pickerSearch, setPickerSearch] = useState('');
  const [showAddInPicker, setShowAddInPicker] = useState(false);
  const [newPartyForm, setNewPartyForm] = useState({ name: '', phone: '', gstin: '' });

  const now = new Date();
  const [dateFrom, setDateFrom] = useState(
    formatDateISO(new Date(now.getFullYear() - 2, 0, 1))
  );
  const [dateTo, setDateTo] = useState(
    formatDateISO(new Date(now.getFullYear() + 1, 11, 31))
  );

  // Edit project
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', client: '', plot_no: '', location: '', area_sqft: '' });

  const openEditModal = () => {
    if (!project) return;
    setEditForm({
      name:      project.name,
      client:    project.client,
      plot_no:   project.plot_no ?? '',
      location:  project.location ?? '',
      area_sqft: project.area_sqft ? String(project.area_sqft) : '',
    });
    setShowEditModal(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    await window.electronAPI.updateProject(id, {
      name:      editForm.name,
      client:    editForm.client,
      plot_no:   editForm.plot_no || null,
      location:  editForm.location || null,
      area_sqft: parseFloat(editForm.area_sqft) || 0,
    });
    setShowEditModal(false);
    load();
  };

  const load = useCallback(async () => {
    if (!id) return;
    const [proj, exps, vendors] = await Promise.all([
      window.electronAPI.getProject(id),
      window.electronAPI.getExpenses(id, dateFrom, dateTo),
      window.electronAPI.getVendors(),
    ]);
    setProject(proj);
    setExpenses(exps);
    setDirectoryVendors(vendors);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load, dateFrom, dateTo]);

  const openNewPartyModal = (cat: 'vendor' | 'contractor') => {
    setNewPartyCategory(cat);
    setPickerSearch('');
    setShowAddInPicker(false);
    setNewPartyForm({ name: '', phone: '', gstin: '' });
    setShowNewPartyModal(true);
  };

  const goToPartyLedger = (name: string, cat: string) => {
    navigate(`/project/${id}/ledger/vendor?vendor=${encodeURIComponent(name)}&category=${cat}`);
  };

  const handleSaveAndOpen = async () => {
    if (!newPartyForm.name.trim()) return;
    await window.electronAPI.createVendor({
      id: generateId('vnd'),
      name: newPartyForm.name.trim(),
      category: newPartyCategory,
      contact_person: null,
      phone: newPartyForm.phone.trim() || null,
      email: null,
      gstin: newPartyForm.gstin.trim().toUpperCase() || null,
      notes: null,
    });
    goToPartyLedger(newPartyForm.name.trim(), newPartyCategory);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  const labourTotals     = getCategoryTotals(expenses, 'labour');
  const siteTotals       = getCategoryTotals(expenses, 'site');
  const contractorTotals = getCategoryTotals(expenses, 'contractor');
  const vendorTotals     = getCategoryTotals(expenses, 'vendor');
  const contractors      = getParties(expenses, 'contractor');
  const vendors          = getParties(expenses, 'vendor');

  const grandTotal   = labourTotals.total   + siteTotals.total   + contractorTotals.total   + vendorTotals.total;
  const grandCash    = labourTotals.cash    + siteTotals.cash    + contractorTotals.cash    + vendorTotals.cash
                     + labourTotals.cheque  + siteTotals.cheque  + contractorTotals.cheque  + vendorTotals.cheque;
  const grandPending = labourTotals.pending + siteTotals.pending + contractorTotals.pending + vendorTotals.pending;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-20 px-4 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        {/* Title row */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors shrink-0"
          >
            <HiOutlineArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h1
                className="text-xl sm:text-2xl font-extrabold text-slate-800 truncate"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                {project?.name}
              </h1>
              <button
                onClick={openEditModal}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                title="Edit project details"
              >
                <HiOutlinePencilSquare className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-400 truncate">
              {[project?.client, project?.location, project?.plot_no ? `Plot ${project.plot_no}` : null]
                .filter(Boolean).join(' • ')}
            </p>
          </div>
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
            <label className="text-xs text-slate-500 font-medium whitespace-nowrap uppercase tracking-wider hidden sm:block">Period</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-xs sm:text-sm text-slate-700 bg-transparent border-none outline-none w-[6.5rem] sm:w-auto" />
            <span className="text-slate-300 shrink-0">–</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-xs sm:text-sm text-slate-700 bg-transparent border-none outline-none w-[6.5rem] sm:w-auto" />
          </div>
          <button
            onClick={() => navigate(`/project/${id}/summary`)}
            className="btn-secondary flex items-center gap-1.5 text-sm whitespace-nowrap"
          >
            <HiOutlineTableCells className="w-4 h-4" />
            <span className="hidden sm:inline">View Summary Sheet</span>
            <span className="sm:hidden">Summary</span>
          </button>
        </div>
      </div>

      {/* Grand total strip */}
      {expenses.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Spent</p>
            <p className="text-xl font-extrabold text-slate-800">{formatCurrency(grandTotal)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Paid (Cash + Cheque)</p>
            <p className="text-xl font-extrabold text-emerald-600">{formatCurrency(grandCash)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Pending Payment</p>
            <p className={`text-xl font-extrabold ${grandPending > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
              {grandPending > 0 ? formatCurrency(grandPending) : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Category sections */}
      <div className="space-y-4">
        <ExpenseCard
          color="indigo"
          icon={<HiOutlineUsers className="w-5 h-5" />}
          title="Labour's Expenses"
          totals={labourTotals}
          onOpen={() => navigate(`/project/${id}/ledger/labour`)}
          openLabel="Open Labour Ledger"
        />

        <ExpenseCard
          color="emerald"
          icon={<HiOutlineWrenchScrewdriver className="w-5 h-5" />}
          title="Site Expenses"
          totals={siteTotals}
          onOpen={() => navigate(`/project/${id}/ledger/vendor?category=site`)}
          openLabel="Open Site Ledger"
        />

        <PartyGroupCard
          color="amber"
          icon={<HiOutlineTruck className="w-5 h-5" />}
          title="Contractor's Expenses"
          totals={contractorTotals}
          parties={contractors}
          projectId={id!}
          category="contractor"
          navigate={navigate}
          onAddNew={() => openNewPartyModal('contractor')}
        />

        <PartyGroupCard
          color="rose"
          icon={<HiOutlineBuildingStorefront className="w-5 h-5" />}
          title="Vendor's Expenses"
          totals={vendorTotals}
          parties={vendors}
          projectId={id!}
          category="vendor"
          navigate={navigate}
          onAddNew={() => openNewPartyModal('vendor')}
        />
      </div>

      {/* Edit Project modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Edit Project
              </h2>
              <button onClick={() => setShowEditModal(false)}>
                <HiXMark className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSaveProject} className="p-6 space-y-4">
              <div>
                <label className="input-label">Project Name *</label>
                <input required type="text" className="input-field"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Client *</label>
                <input required type="text" className="input-field"
                  value={editForm.client}
                  onChange={(e) => setEditForm((p) => ({ ...p, client: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Plot No.</label>
                  <input type="text" className="input-field" placeholder="e.g. W7-3"
                    value={editForm.plot_no}
                    onChange={(e) => setEditForm((p) => ({ ...p, plot_no: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">Area (sq.ft)</label>
                  <input type="number" min="0" step="0.01" className="input-field" placeholder="0"
                    value={editForm.area_sqft}
                    onChange={(e) => setEditForm((p) => ({ ...p, area_sqft: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="input-label">Location</label>
                <input type="text" className="input-field" placeholder="e.g. Sector-76, Faridabad"
                  value={editForm.location}
                  onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Vendor / Contractor modal */}
      {showNewPartyModal && (() => {
        const q = pickerSearch.toLowerCase();
        const filtered = directoryVendors.filter((v) => {
          const matchSearch = !q || v.name.toLowerCase().includes(q) ||
            (v.phone || '').includes(q) || (v.gstin || '').toLowerCase().includes(q);
          return v.category === newPartyCategory && matchSearch;
        });
        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
                <div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Open {newPartyCategory === 'contractor' ? 'Contractor' : 'Vendor'} Ledger
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Select an existing party or add a new one</p>
                </div>
                <button onClick={() => setShowNewPartyModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                  <HiXMark className="w-5 h-5" />
                </button>
              </div>

              {/* Category tabs + search */}
              <div className="px-5 pt-4 pb-3 shrink-0 space-y-3">
                <div className="flex gap-2">
                  {(['vendor', 'contractor'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setNewPartyCategory(cat); setPickerSearch(''); setShowAddInPicker(false); }}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                        newPartyCategory === cat
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {cat === 'vendor' ? 'Vendors' : 'Contractors'}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search by name, phone, GSTIN…"
                    className="input-field pl-9 text-sm"
                  />
                </div>
              </div>

              {/* Party list */}
              <div className="overflow-y-auto flex-1 px-3 pb-2">
                {filtered.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-6">
                    {pickerSearch ? 'No matches found' : `No ${newPartyCategory}s in directory yet`}
                  </p>
                ) : (
                  filtered.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => goToPartyLedger(v.name, newPartyCategory)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left group"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                        <HiOutlineUserGroup className="w-4 h-4 text-indigo-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm truncate">{v.name}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {[v.phone, v.gstin].filter(Boolean).join(' · ') || 'No contact info'}
                        </p>
                      </div>
                      <HiOutlineChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                    </button>
                  ))
                )}
              </div>

              {/* Add new party */}
              <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-slate-700 shrink-0">
                {!showAddInPicker ? (
                  <button
                    onClick={() => { setShowAddInPicker(true); setNewPartyForm({ name: pickerSearch, phone: '', gstin: '' }); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 text-sm text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <HiOutlinePlus className="w-4 h-4" />
                    Add New {newPartyCategory === 'contractor' ? 'Contractor' : 'Vendor'} &amp; Open Ledger
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">New Party</p>
                    <input
                      autoFocus
                      type="text"
                      value={newPartyForm.name}
                      onChange={(e) => setNewPartyForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Party name *"
                      className="input-field text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={newPartyForm.phone}
                        onChange={(e) => setNewPartyForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="Phone (optional)"
                        className="input-field text-sm"
                      />
                      <input
                        type="text"
                        value={newPartyForm.gstin}
                        onChange={(e) => setNewPartyForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                        placeholder="GSTIN (optional)"
                        className="input-field text-sm font-mono"
                        maxLength={15}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowAddInPicker(false)} className="flex-1 btn-ghost border border-slate-200 dark:border-slate-600 text-sm py-2">
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveAndOpen}
                        disabled={!newPartyForm.name.trim()}
                        className="flex-1 btn-primary text-sm py-2"
                      >
                        Save &amp; Open Ledger →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
