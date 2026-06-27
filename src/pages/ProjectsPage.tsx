import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlinePlus,
  HiOutlineFolderOpen,
  HiOutlineTrash,
  HiOutlineDocumentDuplicate,
  HiOutlineMagnifyingGlass,
  HiOutlineMapPin,
  HiXMark,
  HiOutlineSquare3Stack3D,
  HiOutlinePencilSquare,
  HiOutlineChevronDown,
} from 'react-icons/hi2';
import { Project, ProjectStatus, PLAN_DISPLAY_NAMES } from '@/types';
import { formatCurrency, formatDate, generateId } from '@/lib/calculations';
import { useToast } from '@/context/ToastContext';
import { useProjectLimit, usePlanTier } from '@/context/LicenseContext';
import { HiOutlineArrowUpCircle } from 'react-icons/hi2';

const STATUS_STYLES: Record<ProjectStatus, string> = {
  Active:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  'On Hold': 'bg-amber-50 text-amber-700 border-amber-200',
  Completed: 'bg-blue-50 text-blue-700 border-blue-200',
  Archived:  'bg-slate-100 text-slate-500 border-slate-200',
};

const ALL_STATUSES: ProjectStatus[] = ['Active', 'On Hold', 'Completed', 'Archived'];

const defaultForm = () => ({
  name: '',
  client: '',
  plot_no: '',
  location: '',
  area_sqft: '',
  description: '',
  status: 'Active' as ProjectStatus,
});

export default function ProjectsPage() {
  const navigate     = useNavigate();
  const { showUndo } = useToast();
  const maxProjects  = useProjectLimit();
  const currentPlan  = usePlanTier();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'All'>('All');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState(defaultForm());
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ReturnType<typeof defaultForm>, string>>>({});

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    try {
      const data = await window.electronAPI.getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors: typeof formErrors = {};
    if (!formData.name.trim())   errors.name   = 'Project name is required.';
    if (!formData.client.trim()) errors.client = 'Client name is required.';
    if (formData.area_sqft && isNaN(parseFloat(formData.area_sqft)))
      errors.area_sqft = 'Must be a valid number.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const activeProjectCount = projects.filter((p) => p.status === 'Active').length;
  const atProjectLimit     = activeProjectCount >= maxProjects;

  const handleNewProjectClick = () => {
    if (atProjectLimit) { setShowLimitModal(true); return; }
    setFormData(defaultForm());
    setShowNewModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (atProjectLimit) { setShowLimitModal(true); return; }
    const id = generateId('proj');
    await window.electronAPI.createProject({
      id,
      name: formData.name.trim(),
      client: formData.client.trim(),
      plot_no: formData.plot_no || null,
      location: formData.location || null,
      area_sqft: parseFloat(formData.area_sqft) || 0,
      description: formData.description || null,
      status: formData.status,
      tags: '[]',
    });
    setShowNewModal(false);
    setFormData(defaultForm());
    setFormErrors({});
    loadProjects();
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !validateForm()) return;
    await window.electronAPI.updateProject(editingProject.id, {
      name: formData.name.trim(),
      client: formData.client.trim(),
      plot_no: formData.plot_no || null,
      location: formData.location || null,
      area_sqft: parseFloat(formData.area_sqft) || 0,
      description: formData.description || null,
      status: formData.status,
    });
    setEditingProject(null);
    setFormData(defaultForm());
    setFormErrors({});
    loadProjects();
  };

  const openEdit = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setEditingProject(project);
    setFormData({
      name: project.name,
      client: project.client,
      plot_no: project.plot_no || '',
      location: project.location || '',
      area_sqft: project.area_sqft ? String(project.area_sqft) : '',
      description: project.description || '',
      status: project.status || 'Active',
    });
  };

  const handleDelete = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    // Optimistically remove from UI
    setProjects((prev) => prev.filter((p) => p.id !== project.id));
    showUndo(
      `"${project.name}" deleted`,
      () => window.electronAPI.deleteProject(project.id),
      () => setProjects((prev) => {
        if (prev.find((p) => p.id === project.id)) return prev;
        return [project, ...prev];
      })
    );
  };

  const handleDuplicate = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    const newId = generateId('proj');
    await window.electronAPI.duplicateProject(project.id, newId, `${project.name} (Copy)`);
    loadProjects();
  };

  const handleStatusChange = async (e: React.MouseEvent, project: Project, newStatus: ProjectStatus) => {
    e.stopPropagation();
    await window.electronAPI.updateProject(project.id, { status: newStatus });
    setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, status: newStatus } : p));
  };

  const filteredProjects = projects.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client.toLowerCase().includes(search.toLowerCase()) ||
      (p.plot_no && p.plot_no.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* Hero Banner */}
      <div className="hero-banner p-8 mb-8">
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Project Budgets
            </h1>
            <p className="text-white/70 text-sm max-w-lg">
              Create and manage construction project budgets. All data is stored securely on your local machine.
            </p>
          </div>
          {/* Project usage counter */}
          <div className="shrink-0 text-right">
            <div className="text-white/60 text-xs mb-1">Active Projects</div>
            <div className="text-white font-extrabold text-2xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {activeProjectCount}
              <span className="text-white/50 text-sm font-semibold"> / {maxProjects}</span>
            </div>
            <div className="mt-1.5 w-28 h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${atProjectLimit ? 'bg-red-400' : 'bg-white/70'}`}
                style={{ width: `${Math.min(100, (activeProjectCount / maxProjects) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Project limit upgrade modal */}
      <AnimatePresence>
        {showLimitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowLimitModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-card p-6 max-w-sm w-full text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.12))' }}
              >
                <HiOutlineArrowUpCircle className="w-7 h-7 text-indigo-500" />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>
                Active Project Limit Reached
              </h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                Your <strong>{PLAN_DISPLAY_NAMES[currentPlan]}</strong> plan allows up to{' '}
                <strong>{maxProjects} active projects</strong>. You have reached this limit.
              </p>
              <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
                Archive completed projects to free up slots, or upgrade your plan for more capacity.
              </p>
              <div className="flex flex-col gap-2">
                <div
                  className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  <HiOutlineArrowUpCircle className="w-4 h-4" />
                  Contact HashX Labs to Upgrade
                </div>
                <button
                  onClick={() => setShowLimitModal(false)}
                  className="text-sm py-2 rounded-xl"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-md">
            <HiOutlineMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-1">
            {(['All', ...ALL_STATUSES] as (ProjectStatus | 'All')[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap ${
                  statusFilter === s
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600'
                }`}
              >
                {s}
                {s !== 'All' && (
                  <span className="ml-1 opacity-60">
                    {projects.filter((p) => p.status === s).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={async () => {
              if (confirm('This will create a new demo project with sample data. Continue?')) {
                await window.electronAPI.seedDemoProject();
                loadProjects();
              }
            }}
            className="btn-secondary flex items-center gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            title="Seed demo data"
          >
            <HiOutlineSquare3Stack3D className="w-4 h-4" />
            Seed Demo Data
          </button>
          <button
            onClick={handleNewProjectClick}
            className={`btn-primary flex items-center gap-2 ${atProjectLimit ? 'opacity-80' : ''}`}
            id="create-project-btn"
          >
            <HiOutlinePlus className="w-4 h-4" />
            New Project
            {atProjectLimit && (
              <span className="text-[10px] bg-white/20 rounded px-1.5 py-0.5 font-bold">
                {activeProjectCount}/{maxProjects}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <HiOutlineSquare3Stack3D className="w-10 h-10 text-indigo-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {search || statusFilter !== 'All' ? 'No projects found' : 'No projects yet'}
          </h3>
          <p className="text-slate-400 text-sm mb-6">
            {search || statusFilter !== 'All' ? 'Try a different search or filter' : 'Create your first project budget to get started'}
          </p>
          {!search && statusFilter === 'All' && (
            <button onClick={() => setShowNewModal(true)} className="btn-primary">
              <HiOutlinePlus className="w-4 h-4 inline mr-2" />
              Create First Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {filteredProjects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/project/${project.id}/expenses`)}
                className={`glass-card-hover p-5 group ${project.status === 'Archived' ? 'opacity-60' : ''}`}
                id={`project-card-${project.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)' }}
                    >
                      <HiOutlineFolderOpen className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      {project.plot_no && (
                        <span className="inline-block text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 mb-0.5">
                          {project.plot_no}
                        </span>
                      )}
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {project.name}
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={(e) => openEdit(e, project)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-500 transition-colors" title="Edit">
                      <HiOutlinePencilSquare className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => handleDuplicate(e, project)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-500 transition-colors" title="Duplicate">
                      <HiOutlineDocumentDuplicate className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => handleDelete(e, project)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Client: {project.client}</p>

                {project.location && (
                  <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
                    <HiOutlineMapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{project.location}</span>
                  </div>
                )}

                {/* Status badge + quick-change */}
                <div className="flex items-center gap-2 mb-3" onClick={(e) => e.stopPropagation()}>
                  <div className="relative group/status">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold border rounded-full px-2 py-0.5 cursor-pointer select-none ${STATUS_STYLES[project.status || 'Active']}`}>
                      {project.status || 'Active'}
                      <HiOutlineChevronDown className="w-2.5 h-2.5 opacity-60" />
                    </span>
                    {/* Status dropdown */}
                    <div className="absolute left-0 top-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 py-1 w-36 hidden group-hover/status:block">
                      {ALL_STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={(e) => handleStatusChange(e, project, s)}
                          className={`w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                            project.status === s ? 'text-indigo-600' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-end justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                  <div>
                    <p className="text-xs text-slate-400">Total Expenses</p>
                    <p className="text-lg font-bold gradient-text">
                      {formatCurrency(project.total_amount || 0)}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-400">{formatDate(project.updated_at)}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* New / Edit Project Modal */}
      <AnimatePresence>
        {(showNewModal || !!editingProject) && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {editingProject ? 'Edit Project' : 'New Project'}
                </h2>
                <button
                  onClick={() => { setShowNewModal(false); setEditingProject(null); setFormData(defaultForm()); }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <HiXMark className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={editingProject ? handleEdit : handleCreate} className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="input-label">Project Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      className={`input-field ${formErrors.name ? 'border-red-400 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]' : ''}`}
                      placeholder="e.g. Residential Villa"
                      value={formData.name}
                      onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setFormErrors((p) => ({ ...p, name: '' })); }}
                    />
                    {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                  </div>
                  <div>
                    <label className="input-label">Client Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      className={`input-field ${formErrors.client ? 'border-red-400 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]' : ''}`}
                      placeholder="Client Name"
                      value={formData.client}
                      onChange={(e) => { setFormData({ ...formData, client: e.target.value }); setFormErrors((p) => ({ ...p, client: '' })); }}
                    />
                    {formErrors.client && <p className="text-red-500 text-xs mt-1">{formErrors.client}</p>}
                  </div>
                  <div>
                    <label className="input-label">Plot No.</label>
                    <input type="text" className="input-field" placeholder="e.g. Plot 42"
                      value={formData.plot_no} onChange={(e) => setFormData({ ...formData, plot_no: e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">Area (Sq.ft)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`input-field ${formErrors.area_sqft ? 'border-red-400' : ''}`}
                      placeholder="e.g. 2500"
                      value={formData.area_sqft}
                      onChange={(e) => { setFormData({ ...formData, area_sqft: e.target.value }); setFormErrors((p) => ({ ...p, area_sqft: '' })); }}
                    />
                    {formErrors.area_sqft && <p className="text-red-500 text-xs mt-1">{formErrors.area_sqft}</p>}
                  </div>
                  <div>
                    <label className="input-label">Status</label>
                    <select className="input-field" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}>
                      {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="input-label">Location</label>
                    <input type="text" className="input-field" placeholder="Project Location"
                      value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="input-label">Description</label>
                    <textarea className="input-field min-h-[80px]" placeholder="Brief project description..."
                      value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                  <button type="button" onClick={() => { setShowNewModal(false); setEditingProject(null); setFormData(defaultForm()); setFormErrors({}); }} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" id="submit-project-btn">
                    {editingProject ? 'Save Changes' : 'Create Project'}
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
