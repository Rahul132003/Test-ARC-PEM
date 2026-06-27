import { BudgetSummaryData, Category } from '@/types';

const CURRENCY_LOCALE: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  AED: 'ar-AE',
  SAR: 'ar-SA',
  SGD: 'en-SG',
  AUD: 'en-AU',
};

export const SUPPORTED_CURRENCIES = [
  { code: 'INR', label: 'Rs. Indian Rupee' },
  { code: 'USD', label: '$ US Dollar' },
  { code: 'EUR', label: '€ Euro' },
  { code: 'GBP', label: '£ British Pound' },
  { code: 'AED', label: 'د.إ UAE Dirham' },
  { code: 'SAR', label: '﷼ Saudi Riyal' },
  { code: 'SGD', label: 'S$ Singapore Dollar' },
  { code: 'AUD', label: 'A$ Australian Dollar' },
];

/** Formats a number as currency. Defaults to INR for backwards compatibility. */
export function formatCurrency(amount: number, currency = 'INR'): string {
  // For INR, avoid the ₹ Unicode symbol (U+20B9) which doesn't render on Windows 7.
  // Use 'Rs.' prefix with Indian number formatting instead.
  if (currency === 'INR') {
    return 'Rs.' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
  }
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency] || 'en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Formats a number using Indian numbering (e.g. 1,00,000). */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num);
}

/** Formats a date string as "DD Mon YYYY" in the en-IN locale. */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Formats a Date object to YYYY-MM-DD string using local time components to avoid timezone shifts. */
export function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Generates a collision-resistant unique ID.
 * Uses crypto.randomUUID() (available in Electron/Chromium and Node 19+).
 */
export function generateId(prefix: string = 'id'): string {
  // globalThis.crypto.randomUUID is available in both Electron renderer (Chromium)
  // and Node.js 19+ (used by electron/seed.ts). The fallback handles older runtimes.
  const uid = (globalThis as any).crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
  return `${prefix}_${uid}`;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calculateBudgetSummary(
  categories: Category[],
  gstRate: number,
  contingencyRate: number,
  areaSqFt: number
): BudgetSummaryData {
  const subtotal = r2(categories.reduce((sum, cat) => {
    const catTotal = (cat.items || []).reduce(
      (itemSum, item) => itemSum + r2(item.quantity * item.rate),
      0
    );
    return sum + catTotal;
  }, 0));

  const contingency = r2(subtotal * (contingencyRate / 100));
  const beforeTax   = r2(subtotal + contingency);
  const gst         = r2(beforeTax * (gstRate / 100));
  const grandTotal  = r2(beforeTax + gst);
  const ratePerSqFt = areaSqFt > 0 ? r2(grandTotal / areaSqFt) : 0;

  return { subtotal, contingency, beforeTax, gst, grandTotal, ratePerSqFt };
}

export function getCategoryColor(color: string): { bg: string; text: string; border: string } {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    '#6366f1': { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' },
    '#0ea5e9': { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200' },
    '#10b981': { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
    '#f59e0b': { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
    '#8b5cf6': { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200' },
    '#f43f5e': { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200' },
    '#f97316': { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
    '#06b6d4': { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200' },
  };
  return colorMap[color] || { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
}

export const UNIT_OPTIONS = [
  'Lump Sum',
  'Sq.ft',
  'Running ft',
  'Cu.ft',
  'Cu.m',
  'Sq.m',
  'Nos',
  'Kg',
  'Quintal',
  'Ton',
  'Bag',
  'Bundle',
  'Brass',
  'CFT',
  'Trip',
  'Day',
  'Month',
  'Per Item',
  'Per Hour',
  'Set',
];

export const CATEGORY_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#f43f5e',
  '#f97316',
  '#06b6d4',
];
