import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlineDocumentDuplicate,
  HiOutlineTrash,
  HiOutlineSquare3Stack3D,
} from 'react-icons/hi2';
import { Template } from '@/types';
import { formatDate } from '@/lib/calculations';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await window.electronAPI.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this template? This cannot be undone.')) {
      await window.electronAPI.deleteTemplate(id);
      loadTemplates();
    }
  };

  const getTemplateStats = (template: Template) => {
    try {
      const data = JSON.parse(template.data);
      const categories = data.categories || [];
      const totalItems = categories.reduce(
        (sum: number, c: any) => sum + (c.items || []).length,
        0
      );
      return { categories: categories.length, items: totalItems };
    } catch {
      return { categories: 0, items: 0 };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-800 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Budget Templates
        </h1>
        <p className="text-sm text-slate-400">
          Save and reuse budget structures across projects. Templates are created from the budget editor.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-3xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <HiOutlineDocumentDuplicate className="w-10 h-10 text-violet-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            No templates yet
          </h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Open a project budget and click "Template" to save its structure as a reusable template.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <AnimatePresence>
            {templates.map((template, i) => {
              const stats = getTemplateStats(template);
              return (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card p-5 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="icon-sq-violet">
                        <HiOutlineSquare3Stack3D className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
                          {template.name}
                        </h3>
                        {template.description && (
                          <p className="text-xs text-slate-400 mt-0.5">{template.description}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>{stats.categories} categories</span>
                    <span>•</span>
                    <span>{stats.items} items</span>
                    <span>•</span>
                    <span>{formatDate(template.created_at)}</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
