import { useState, useEffect } from 'react';
import {
  HiOutlineUserGroup,
  HiOutlinePlus,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineMagnifyingGlass,
  HiOutlineXMark,
} from 'react-icons/hi2';
import { Vendor } from '@/types';
import { generateId } from '@/lib/calculations';

const CATEGORIES = [
  { value: 'vendor',     label: 'Vendor' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'labour',     label: 'Labour' },
  { value: 'site',       label: 'Site' },
];

const CATEGORY_COLORS: Record<string, string> = {
  vendor:     'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  contractor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  labour:     'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  site:       'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const EMPTY_FORM = {
  name: '', category: 'vendor' as Vendor['category'],
  contact_person: '', phone: '', email: '', gstin: '', notes: '',
};

export default function VendorDirectoryPage() {
  const [vendors, setVendors]     = useState<Vendor[]>([]);
  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Vendor | null>(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);

  const load = () => window.electronAPI.getVendors().then(setVendors);
  useEffect(() => { load(); }, []);

  const filtered = vendors.filter((v) => {
    const q = search.toLowerCase();
    const matchQ = !q || v.name.toLowerCase().includes(q) ||
      (v.gstin || '').toLowerCase().includes(q) ||
      (v.phone || '').includes(q);
    const matchCat = !catFilter || v.category === catFilter;
    return matchQ && matchCat;
  });

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (v: Vendor) => {
    setEditing(v);
    setForm({
      name: v.name, category: v.category,
      contact_person: v.contact_person || '',
      phone: v.phone || '', email: v.email || '',
      gstin: v.gstin || '', notes: v.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editing) {
      await window.electronAPI.updateVendor(editing.id, {
        name: form.name.trim(), category: form.category,
        contact_person: form.contact_person.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        gstin: form.gstin.trim().toUpperCase() || null,
        notes: form.notes.trim() || null,
      });
    } else {
      await window.electronAPI.createVendor({
        id: generateId('vnd'), name: form.name.trim(), category: form.category,
        contact_person: form.contact_person.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        gstin: form.gstin.trim().toUpperCase() || null,
        notes: form.notes.trim() || null,
      });
    }
    setSaving(false);
    setShowModal(false);
    load();
  };

  const handleDelete = async (v: Vendor) => {
    if (!confirm(`Delete "${v.name}" from the directory?`)) return;
    await window.electronAPI.deleteVendor(v.id);
    load();
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Party Directory
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-500">Vendors, contractors &amp; parties — names auto-fill in every expense ledger</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm">
          <HiOutlinePlus className="w-4 h-4" /> Add Party
        </button>
      </div>

      {/* Autocomplete tip */}
      <div className="flex items-start gap-2.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 rounded-xl px-4 py-3 mb-5 text-xs text-indigo-700 dark:text-indigo-300">
        <HiOutlineUserGroup className="w-4 h-4 shrink-0 mt-0.5 text-indigo-500" />
        <span>
          <strong>How reuse works:</strong> Every name saved here appears as a suggestion in the{' '}
          <span className="font-semibold">Vendor / Party Name</span> field when adding entries in any Vendor, Contractor, or Site ledger.
          Start typing a name in the ledger form and the matching parties will appear in a dropdown.
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, GSTIN, phone…"
            className="input-compact pl-9 w-64"
          />
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="input-compact w-44">
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400 dark:text-slate-500 self-center">{filtered.length} of {vendors.length} parties</span>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {vendors.length === 0 ? (
          <div className="text-center py-16">
            <HiOutlineUserGroup className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-semibold">No parties added yet</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Add vendors, contractors, and parties — their names auto-fill in expense ledger forms</p>
            <button onClick={openAdd} className="btn-primary mt-4 text-sm">Add First Party</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 dark:text-slate-500">No vendors match your search</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 dark:border-slate-700">
                <tr>
                  {['Name', 'Category', 'Contact', 'Phone', 'GSTIN', 'Actions'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{v.name}</p>
                      {v.email && <p className="text-xs text-slate-400 dark:text-slate-500">{v.email}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[v.category]}`}>
                        {CATEGORIES.find((c) => c.value === v.category)?.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{v.contact_person || '—'}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono">{v.phone || '—'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">{v.gstin || '—'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(v)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
                          <HiOutlinePencilSquare className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(v)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {editing ? 'Edit Party' : 'Add Party'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                <HiOutlineXMark className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="input-label">Name *</label>
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="input-field" placeholder="e.g. Sharma Electricals" autoFocus />
                </div>
                <div>
                  <label className="input-label">Category</label>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Vendor['category'] }))}
                    className="input-field">
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Contact Person</label>
                  <input value={form.contact_person} onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
                    className="input-field" placeholder="Name" />
                </div>
                <div>
                  <label className="input-label">Phone</label>
                  <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="input-field" placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className="input-label">Email</label>
                  <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="input-field" type="email" placeholder="vendor@email.com" />
                </div>
                <div className="col-span-2">
                  <label className="input-label">GSTIN</label>
                  <input value={form.gstin} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                    className="input-field font-mono" placeholder="29ABCDE1234F1Z5" maxLength={15} />
                </div>
                <div className="col-span-2">
                  <label className="input-label">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="input-field resize-none" rows={2} placeholder="Any notes…" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 btn-ghost border border-slate-200 dark:border-slate-600">
                Cancel
              </button>
              <button onClick={handleSave} disabled={!form.name.trim() || saving} className="flex-1 btn-primary">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Party'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
