import { useState, useRef, useEffect } from 'react';
import { HiOutlineTrash } from 'react-icons/hi2';
import { LineItem } from '@/types';
import { formatCurrency, UNIT_OPTIONS } from '@/lib/calculations';

interface LineItemRowProps {
  item: LineItem;
  onRefresh: () => void;
}

export default function LineItemRow({ item, onRefresh }: LineItemRowProps) {
  const [description, setDescription] = useState(item.description);
  const [unit, setUnit] = useState(item.unit);
  const [quantity, setQuantity] = useState(item.quantity.toString());
  const [rate, setRate] = useState(item.rate.toString());
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const descRef = useRef<HTMLInputElement>(null);

  // Focus on description if it's empty (new item)
  useEffect(() => {
    if (!item.description && descRef.current) {
      descRef.current.focus();
    }
  }, []);

  const amount = (parseFloat(quantity) || 0) * (parseFloat(rate) || 0);

  const saveField = (field: string, value: any) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      await window.electronAPI.updateLineItem(item.id, { [field]: value });
      onRefresh();
    }, 400);
  };

  const handleDelete = async () => {
    await window.electronAPI.deleteLineItem(item.id);
    onRefresh();
  };

  return (
    <div className="grid grid-cols-[1fr_120px_100px_120px_140px_80px] gap-2 px-5 py-1.5 items-center border-t border-slate-50 hover:bg-slate-50/30 transition-colors group">
      {/* Description */}
      <input
        ref={descRef}
        className="input-compact border-transparent hover:border-slate-200 focus:border-indigo-400 bg-transparent"
        value={description}
        placeholder="Enter description..."
        onChange={(e) => {
          setDescription(e.target.value);
          saveField('description', e.target.value);
        }}
      />

      {/* Unit */}
      <select
        className="input-compact border-transparent hover:border-slate-200 focus:border-indigo-400 bg-transparent cursor-pointer"
        value={unit}
        onChange={(e) => {
          setUnit(e.target.value);
          saveField('unit', e.target.value);
        }}
      >
        {UNIT_OPTIONS.map((u) => (
          <option key={u} value={u}>{u}</option>
        ))}
      </select>

      {/* Quantity */}
      <input
        type="number"
        step="0.01"
        min="0"
        className="input-compact border-transparent hover:border-slate-200 focus:border-indigo-400 bg-transparent text-right tabular-nums"
        value={quantity}
        onChange={(e) => {
          setQuantity(e.target.value);
          saveField('quantity', parseFloat(e.target.value) || 0);
        }}
      />

      {/* Rate */}
      <input
        type="number"
        step="0.01"
        min="0"
        className="input-compact border-transparent hover:border-slate-200 focus:border-indigo-400 bg-transparent text-right tabular-nums"
        value={rate}
        onChange={(e) => {
          setRate(e.target.value);
          saveField('rate', parseFloat(e.target.value) || 0);
        }}
      />

      {/* Amount */}
      <p className="text-sm font-semibold text-slate-700 text-right tabular-nums pr-1">
        {formatCurrency(amount)}
      </p>

      {/* Actions */}
      <div className="flex justify-center">
        <button
          onClick={handleDelete}
          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
          title="Delete Item"
        >
          <HiOutlineTrash className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
