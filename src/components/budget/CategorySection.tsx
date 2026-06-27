import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlineChevronDown,
  HiOutlineChevronRight,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlinePencilSquare,
  HiOutlineCheck,
  HiXMark,
} from 'react-icons/hi2';
import { Category } from '@/types';
import { formatCurrency, getCategoryColor, generateId, CATEGORY_COLORS } from '@/lib/calculations';
import LineItemRow from './LineItemRow';

interface CategorySectionProps {
  category: Category;
  onRefresh: () => void;
}

export default function CategorySection({ category, onRefresh }: CategorySectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const [editColor, setEditColor] = useState(category.color);
  const colors = getCategoryColor(category.color);

  const categoryTotal = (category.items || []).reduce(
    (sum, item) => sum + item.quantity * item.rate,
    0
  );

  const handleSaveName = async () => {
    await window.electronAPI.updateCategory(category.id, {
      name: editName,
      color: editColor,
    });
    setEditing(false);
    onRefresh();
  };

  const handleDelete = async () => {
    if (confirm(`Delete category "${category.name}" and all its items? This cannot be undone.`)) {
      await window.electronAPI.deleteCategory(category.id);
      onRefresh();
    }
  };

  const handleAddItem = async () => {
    const itemId = generateId('li');
    await window.electronAPI.createLineItem({
      id: itemId,
      category_id: category.id,
      description: '',
      unit: 'Lump Sum',
      quantity: 1,
      rate: 0,
      notes: null,
      sort_order: (category.items || []).length,
    });
    onRefresh();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden"
    >
      {/* Category Header */}
      <div
        className={`flex items-center justify-between px-5 py-3.5 cursor-pointer transition-colors hover:bg-slate-50/50 border-l-4`}
        style={{ borderLeftColor: category.color }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {expanded ? (
            <HiOutlineChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <HiOutlineChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          )}

          <div className="category-dot" style={{ backgroundColor: category.color }} />

          {editing ? (
            <div className="flex items-center gap-2 no-drag" onClick={(e) => e.stopPropagation()}>
              <input
                autoFocus
                className="input-compact w-48"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setEditing(false);
                }}
              />
              <div className="flex gap-1">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setEditColor(c)}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${editColor === c ? 'border-slate-700 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button onClick={handleSaveName} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded-lg">
                <HiOutlineCheck className="w-4 h-4" />
              </button>
              <button onClick={() => setEditing(false)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg">
                <HiXMark className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <h3 className="text-sm font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {category.name}
            </h3>
          )}

          <span className={`badge ${colors.bg} ${colors.text} ml-2`}>
            {(category.items || []).length} items
          </span>
        </div>

        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm font-bold text-slate-700 mr-2">{formatCurrency(categoryTotal)}</p>
          {!editing && (
            <>
              <button
                onClick={() => { setEditName(category.name); setEditColor(category.color); setEditing(true); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                title="Rename"
              >
                <HiOutlinePencilSquare className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Delete Category"
              >
                <HiOutlineTrash className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Items Table */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_120px_100px_120px_140px_80px] gap-2 px-5 py-2 bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                <span>Description</span>
                <span>Unit</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Rate (Rs.)</span>
                <span className="text-right">Amount (Rs.)</span>
                <span className="text-center">Actions</span>
              </div>

              {/* Items */}
              {(category.items || []).map((item) => (
                <LineItemRow key={item.id} item={item} onRefresh={onRefresh} />
              ))}

              {(category.items || []).length === 0 && (
                <div className="text-center py-6 text-sm text-slate-400">
                  No items yet. Click below to add one.
                </div>
              )}

              {/* Add Item */}
              <button
                onClick={handleAddItem}
                className="w-full py-3 text-sm text-slate-400 hover:text-indigo-500 hover:bg-indigo-50/30 transition-colors flex items-center justify-center gap-1.5 border-t border-slate-100"
              >
                <HiOutlinePlus className="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
