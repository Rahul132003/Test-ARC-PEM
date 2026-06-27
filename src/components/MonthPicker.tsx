import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineCalendarDays, HiChevronDown } from 'react-icons/hi2';

interface MonthPickerProps {
  onSelect: (year: number, month: number) => void;
}

export default function MonthPicker({ onSelect }: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const generateMonths = () => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
        year: d.getFullYear(),
        month: d.getMonth(),
        key: `${d.getFullYear()}-${d.getMonth()}`
      });
    }
    return months;
  };

  const monthOptions = generateMonths();

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm hover:border-indigo-300 transition-colors"
      >
        <HiOutlineCalendarDays className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-semibold text-slate-700">Select Month</span>
        <HiChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full left-0 mt-2 w-56 max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-[100] py-1 custom-scrollbar"
          >
            {monthOptions.map((opt, idx) => (
              <React.Fragment key={opt.key}>
                {idx === 12 && <div className="border-t border-slate-100 my-1 mx-2" />}
                <button
                  onClick={() => {
                    onSelect(opt.year, opt.month);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-between group"
                >
                  <span className="font-medium">{opt.label}</span>
                </button>
              </React.Fragment>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
