/**
 * Global search modal — opened with Cmd+K / Ctrl+K.
 * Searches projects, vendor directory, and expense descriptions/vendors.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiOutlineMagnifyingGlass,
  HiOutlineRectangleStack,
  HiOutlineUserGroup,
  HiOutlineReceiptRefund,
  HiOutlineXMark,
} from 'react-icons/hi2';
import { SearchResults } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  labour: 'Labour', vendor: 'Vendor', contractor: 'Contractor', site: 'Site',
};

export default function GlobalSearch({ open, onClose }: Props) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor]   = useState(0);
  const inputRef              = useRef<HTMLInputElement>(null);
  const navigate              = useNavigate();

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults(null); return; }
    setLoading(true);
    const t = setTimeout(() => {
      window.electronAPI.globalSearch(query).then((r) => {
        setResults(r);
        setCursor(0);
        setLoading(false);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // Flatten all results for keyboard nav
  const allItems = results
    ? [
        ...results.projects.map((p) => ({ type: 'project' as const, id: p.id, label: p.name, sub: p.client })),
        ...results.vendors.map((v)  => ({ type: 'vendor'  as const, id: v.id, label: v.name, sub: v.category })),
        ...results.expenses.map((e) => ({ type: 'expense' as const, id: e.id, project_id: e.project_id, label: e.vendor_name || e.description || '—', sub: `${e.project_name} · ${CATEGORY_LABELS[e.category] || e.category}`, category: e.category })),
      ]
    : [];

  const navigate_to = useCallback((item: typeof allItems[0]) => {
    if (item.type === 'project')  navigate(`/project/${item.id}/expenses`);
    if (item.type === 'vendor')   navigate('/vendors');
    if (item.type === 'expense')  navigate(`/project/${(item as any).project_id}/ledger/${(item as any).category === 'labour' ? 'labour' : 'vendor'}`);
    onClose();
  }, [navigate, onClose]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, allItems.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === 'Enter' && allItems[cursor]) navigate_to(allItems[cursor]);
  };

  if (!open) return null;

  const hasResults = results && (results.projects.length + results.vendors.length + results.expenses.length) > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <HiOutlineMagnifyingGlass className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, vendors, expenses…"
            className="flex-1 bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <HiOutlineXMark className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          )}

          {!loading && query.length >= 2 && !hasResults && (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
              No results for "{query}"
            </div>
          )}

          {!loading && !query && (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
              Type at least 2 characters to search
            </div>
          )}

          {hasResults && !loading && (
            <>
              {/* Projects */}
              {results!.projects.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60">
                    Projects
                  </div>
                  {results!.projects.map((p, i) => {
                    const idx = i;
                    return (
                      <button key={p.id} onClick={() => navigate_to({ type: 'project', id: p.id, label: p.name, sub: p.client })}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${cursor === idx ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                        <HiOutlineRectangleStack className="w-4 h-4 text-indigo-400 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{p.name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{p.client}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Vendors */}
              {results!.vendors.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60">
                    Vendor Directory
                  </div>
                  {results!.vendors.map((v, i) => {
                    const idx = results!.projects.length + i;
                    return (
                      <button key={v.id} onClick={() => navigate_to({ type: 'vendor', id: v.id, label: v.name, sub: v.category })}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${cursor === idx ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                        <HiOutlineUserGroup className="w-4 h-4 text-sky-400 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{v.name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 capitalize">{v.category}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Expenses */}
              {results!.expenses.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60">
                    Expense Entries
                  </div>
                  {results!.expenses.map((e, i) => {
                    const idx = results!.projects.length + results!.vendors.length + i;
                    return (
                      <button key={e.id}
                        onClick={() => navigate_to({ type: 'expense', id: e.id, project_id: e.project_id, label: e.vendor_name || e.description || '—', sub: e.project_name, category: e.category } as any)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${cursor === idx ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                        <HiOutlineReceiptRefund className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{e.vendor_name || e.description || '—'}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{e.project_name} · {CATEGORY_LABELS[e.category] || e.category}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500">
          <span><kbd className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">↵</kbd> open</span>
          <span><kbd className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">ESC</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
