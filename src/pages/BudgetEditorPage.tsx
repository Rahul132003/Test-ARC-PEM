import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlineArrowLeft,
  HiOutlinePencilSquare,
  HiOutlineDocumentArrowDown,
  HiOutlineChartPie,
  HiOutlineBookmarkSquare,
  HiOutlineTableCells,
  HiXMark,
  HiOutlinePrinter,
} from 'react-icons/hi2';
import { Project, Category, BudgetSummaryData, Template } from '@/types';
import { formatCurrency, formatNumber, calculateBudgetSummary, generateId } from '@/lib/calculations';
import CategorySection from '@/components/budget/CategorySection';
import BudgetCharts from '@/components/reports/BudgetCharts';
import { exportToPdf } from '@/lib/pdf-generator';
import { exportToExcel } from '@/lib/excel-export';

export default function BudgetEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showLoadTemplate, setShowLoadTemplate] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [editData, setEditData] = useState<any>({});

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [proj, cats] = await Promise.all([
        window.electronAPI.getProject(id),
        window.electronAPI.getCategories(id),
      ]);
      setProject(proj);
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load project:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary: BudgetSummaryData = project
    ? calculateBudgetSummary(categories, project.gst_rate, project.contingency_rate, project.area_sqft)
    : { subtotal: 0, contingency: 0, beforeTax: 0, gst: 0, grandTotal: 0, ratePerSqFt: 0 };

  const handleAddCategory = async () => {
    if (!id) return;
    const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#f97316', '#06b6d4'];
    const catId = generateId('cat');
    await window.electronAPI.createCategory({
      id: catId,
      project_id: id,
      name: 'New Category',
      color: colors[categories.length % colors.length],
      sort_order: categories.length,
    });
    loadData();
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    await window.electronAPI.updateProject(id, {
      name: editData.name,
      client: editData.client,
      plot_no: editData.plot_no || null,
      location: editData.location || null,
      area_sqft: parseFloat(editData.area_sqft) || 0,
      description: editData.description || null,
      gst_rate: parseFloat(editData.gst_rate) || 18,
      contingency_rate: parseFloat(editData.contingency_rate) || 10,
    });
    setShowEditModal(false);
    loadData();
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const templateData = JSON.stringify({
      categories: categories.map((c) => ({
        name: c.name,
        color: c.color,
        sort_order: c.sort_order,
        items: (c.items || []).map((item) => ({
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          rate: item.rate,
          notes: item.notes,
          sort_order: item.sort_order,
        })),
      })),
    });
    await window.electronAPI.createTemplate({
      id: generateId('tmpl'),
      name: templateName,
      description: templateDesc || null,
      data: templateData,
    });
    setShowSaveTemplate(false);
    setTemplateName('');
    setTemplateDesc('');
  };

  const handleOpenLoadTemplate = async () => {
    const data = await window.electronAPI.getTemplates();
    setAvailableTemplates(data);
    setShowLoadTemplate(true);
  };

  const handleApplyTemplate = async (template: Template) => {
    if (!id) return;
    let catCount = 0;
    try { catCount = (JSON.parse(template.data).categories || []).length; } catch { /* */ }
    const confirmed = confirm(
      `Apply template "${template.name}"?\n\nThis will replace all ${categories.length} existing categor${categories.length === 1 ? 'y' : 'ies'} and line items with the template's ${catCount} categor${catCount === 1 ? 'y' : 'ies'}.\n\nThis cannot be undone.`
    );
    if (!confirmed) return;
    await window.electronAPI.applyTemplate(id, template.data);
    setShowLoadTemplate(false);
    loadData();
  };

  const handleExportPdf = () => {
    if (!project) return;
    exportToPdf(project, categories, summary);
  };

  const handleExportExcel = () => {
    if (!project) return;
    exportToExcel(project, categories, summary);
  };

  const handlePrint = () => {
    window.print();
  };

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
        <button onClick={() => navigate('/projects')} className="btn-secondary mt-4">Go Back</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-32 print:max-w-none print:p-0 print:m-0">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/projects')} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
          <HiOutlineArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {project.plot_no && (
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">
                {project.plot_no}
              </span>
            )}
            <h1 className="text-2xl font-extrabold text-slate-800 truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {project.name}
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            Client: {project.client}
            {project.location && <> • {project.location}</>}
            {project.area_sqft > 0 && <> • {formatNumber(project.area_sqft)} sq.ft</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditData({ ...project }); setShowEditModal(true); }} className="btn-ghost flex items-center gap-1.5 text-sm" title="Edit Project">
            <HiOutlinePencilSquare className="w-4 h-4" /> Edit
          </button>
          <button onClick={() => setShowCharts(!showCharts)} className={`btn-ghost flex items-center gap-1.5 text-sm ${showCharts ? 'bg-indigo-50 text-indigo-600' : ''}`} title="Charts">
            <HiOutlineChartPie className="w-4 h-4" /> Charts
          </button>
          <button onClick={() => setShowSaveTemplate(true)} className="btn-ghost flex items-center gap-1.5 text-sm" title="Save as Template">
            <HiOutlineBookmarkSquare className="w-4 h-4" /> Save Template
          </button>
          <button onClick={handleOpenLoadTemplate} className="btn-ghost flex items-center gap-1.5 text-sm" title="Load Template">
            <HiOutlineBookmarkSquare className="w-4 h-4" /> Load Template
          </button>
          <button onClick={() => navigate(`/project/${id}/expenses`)} className="btn-ghost flex items-center gap-1.5 text-sm" title="Expense Tracker">
            <HiOutlineTableCells className="w-4 h-4" /> Expense Tracker
          </button>
          <button onClick={handlePrint} className="btn-ghost flex items-center gap-1.5 text-sm" title="Print">
            <HiOutlinePrinter className="w-4 h-4" />
          </button>
          <button onClick={handleExportPdf} className="btn-secondary text-sm py-2 px-3 flex items-center gap-1.5">
            <HiOutlineDocumentArrowDown className="w-4 h-4" /> PDF
          </button>
          <button onClick={handleExportExcel} className="btn-primary text-sm py-2 px-3 flex items-center gap-1.5">
            <HiOutlineDocumentArrowDown className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-xs text-slate-400 mb-1">Subtotal</p>
          <p className="text-lg font-bold text-slate-800">{formatCurrency(summary.subtotal)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-400 mb-1">Contingency ({project.contingency_rate}%)</p>
          <p className="text-lg font-bold text-amber-600">{formatCurrency(summary.contingency)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-400 mb-1">Before Tax</p>
          <p className="text-lg font-bold text-slate-800">{formatCurrency(summary.beforeTax)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-400 mb-1">GST ({project.gst_rate}%)</p>
          <p className="text-lg font-bold text-sky-600">{formatCurrency(summary.gst)}</p>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)' }}>
          <p className="text-xs text-white/70 mb-1">Grand Total</p>
          <p className="text-lg font-extrabold text-white">{formatCurrency(summary.grandTotal)}</p>
        </div>
        {project.area_sqft > 0 && (
          <div className="stat-card">
            <p className="text-xs text-slate-400 mb-1">Rate / Sq.ft</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(summary.ratePerSqFt)}</p>
          </div>
        )}
      </div>

      {/* Charts */}
      <AnimatePresence>
        {showCharts && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-6">
            <BudgetCharts categories={categories} summary={summary} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Sections */}
      <div className="space-y-4">
        {categories.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            onRefresh={loadData}
          />
        ))}
      </div>

      {/* Add Category Button */}
      <button
        onClick={handleAddCategory}
        className="w-full mt-4 py-4 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30 transition-all font-semibold text-sm flex items-center justify-center gap-2"
        id="add-category-btn"
      >
        + Add Category
      </button>

      {/* Sticky Bottom Summary Bar */}
      <div className="fixed bottom-0 left-60 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 px-8 py-4 z-40 print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Categories</p>
              <p className="text-sm font-bold text-slate-700">{categories.length}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Line Items</p>
              <p className="text-sm font-bold text-slate-700">
                {categories.reduce((sum, c) => sum + (c.items?.length || 0), 0)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Subtotal</p>
              <p className="text-sm font-bold text-slate-700">{formatCurrency(summary.subtotal)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">+ Contingency</p>
              <p className="text-sm font-bold text-amber-600">{formatCurrency(summary.contingency)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">+ GST</p>
              <p className="text-sm font-bold text-sky-600">{formatCurrency(summary.gst)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Grand Total</p>
            <p className="text-xl font-extrabold gradient-text">{formatCurrency(summary.grandTotal)}</p>
          </div>
        </div>
      </div>

      {/* Edit Project Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>Edit Project</h2>
                <button onClick={() => setShowEditModal(false)}><HiXMark className="w-6 h-6 text-slate-400" /></button>
              </div>
              <form onSubmit={handleUpdateProject} className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 gap-5">
                  <div><label className="input-label">Name *</label><input required className="input-field" value={editData.name || ''} onChange={(e) => setEditData({ ...editData, name: e.target.value })} /></div>
                  <div><label className="input-label">Client *</label><input required className="input-field" value={editData.client || ''} onChange={(e) => setEditData({ ...editData, client: e.target.value })} /></div>
                  <div><label className="input-label">Plot No.</label><input className="input-field" value={editData.plot_no || ''} onChange={(e) => setEditData({ ...editData, plot_no: e.target.value })} /></div>
                  <div><label className="input-label">Area (Sq.ft)</label><input type="number" step="0.01" className="input-field" value={editData.area_sqft || ''} onChange={(e) => setEditData({ ...editData, area_sqft: e.target.value })} /></div>
                  <div className="col-span-2"><label className="input-label">Location</label><input className="input-field" value={editData.location || ''} onChange={(e) => setEditData({ ...editData, location: e.target.value })} /></div>
                  <div className="col-span-2"><label className="input-label">Description</label><textarea className="input-field min-h-[80px]" value={editData.description || ''} onChange={(e) => setEditData({ ...editData, description: e.target.value })} /></div>
                  <div><label className="input-label">GST Rate (%)</label><input type="number" step="0.1" className="input-field" value={editData.gst_rate ?? 18} onChange={(e) => setEditData({ ...editData, gst_rate: e.target.value })} /></div>
                  <div><label className="input-label">Contingency (%)</label><input type="number" step="0.1" className="input-field" value={editData.contingency_rate ?? 10} onChange={(e) => setEditData({ ...editData, contingency_rate: e.target.value })} /></div>
                </div>
                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary">Save Changes</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Save as Template Modal */}
      <AnimatePresence>
        {showSaveTemplate && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>Save as Template</h2>
                <button onClick={() => setShowSaveTemplate(false)}><HiXMark className="w-5 h-5 text-slate-400" /></button>
              </div>
              <form onSubmit={handleSaveTemplate} className="p-6 space-y-4">
                <div><label className="input-label">Template Name *</label><input required className="input-field" placeholder="e.g. Standard Villa Budget" value={templateName} onChange={(e) => setTemplateName(e.target.value)} /></div>
                <div><label className="input-label">Description</label><textarea className="input-field min-h-[60px]" placeholder="Optional description..." value={templateDesc} onChange={(e) => setTemplateDesc(e.target.value)} /></div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowSaveTemplate(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary">Save Template</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Load Template Modal */}
      <AnimatePresence>
        {showLoadTemplate && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>Load Template</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Replaces existing categories and items</p>
                </div>
                <button onClick={() => setShowLoadTemplate(false)}><HiXMark className="w-5 h-5 text-slate-400" /></button>
              </div>
              <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
                {availableTemplates.length === 0 ? (
                  <p className="text-center text-slate-400 py-8 text-sm">No templates saved yet.</p>
                ) : (
                  availableTemplates.map((tmpl) => {
                    let cats = 0, items = 0;
                    try { const d = JSON.parse(tmpl.data); cats = (d.categories || []).length; items = (d.categories || []).reduce((s: number, c: any) => s + (c.items || []).length, 0); } catch { /* */ }
                    return (
                      <button
                        key={tmpl.id}
                        onClick={() => handleApplyTemplate(tmpl)}
                        className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors group"
                      >
                        <p className="font-semibold text-sm text-slate-800 group-hover:text-indigo-700">{tmpl.name}</p>
                        {tmpl.description && <p className="text-xs text-slate-400 mt-0.5">{tmpl.description}</p>}
                        <p className="text-xs text-slate-400 mt-1">{cats} categories • {items} items</p>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="p-4 border-t border-slate-100 flex justify-end">
                <button onClick={() => setShowLoadTemplate(false)} className="btn-secondary">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
