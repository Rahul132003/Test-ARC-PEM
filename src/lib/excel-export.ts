import * as XLSX from 'xlsx';
import { Project, Category, BudgetSummaryData, Expense } from '@/types';
import { getExportMetadata } from './export-utils';

const CATEGORY_LABELS: Record<string, string> = {
  labour:     "Labour's Expenses",
  site:       'Site Expenses',
  contractor: "Contractor's Expenses",
  vendor:     "Vendor's Expenses",
};

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function exportExpensesToExcel(
  project: Project,
  expenses: Expense[],
  dateFrom: string,
  dateTo: string
) {
  const wb = XLSX.utils.book_new();
  const periodLabel = `${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`;

  // ── Sheet 1: Summary by category ──────────────────────────────
  const summaryRows: any[][] = [];
  summaryRows.push([project.location || project.name]);
  summaryRows.push([`Expenses Sheet — ${periodLabel}`]);
  summaryRows.push([]);
  summaryRows.push(['Sr No', 'Description', 'Amount (Rs.)', 'Cash Payment (Rs.)', 'Cheque Payment (Rs.)', 'Pending Payment (Rs.)']);

  let srNo = 1;
  const ROMAN = ['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii'];
  let catTotal = 0;

  for (const cat of ['labour','site','contractor','vendor']) {
    const catExps = expenses.filter((e) => e.category === cat);
    if (catExps.length === 0) continue;

    const isSimple = cat === 'labour' || cat === 'site';
    const partyMap: Record<string, { amount: number; cash: number; cheque: number; pending: number }> = {};

    catExps.forEach((e) => {
      const key = isSimple ? 'TOTAL' : (e.vendor_name?.trim() || e.description?.trim() || 'Other');
      if (!partyMap[key]) partyMap[key] = { amount: 0, cash: 0, cheque: 0, pending: 0 };
      partyMap[key].amount  += e.amount;
      partyMap[key].cash    += e.cash_payment;
      partyMap[key].cheque  += e.cheque_payment;
      partyMap[key].pending += e.pending_payment;
    });

    const parties = Object.entries(partyMap);
    const catSum = parties.reduce((s, [, v]) => s + v.amount, 0);
    catTotal += catSum;

    if (isSimple) {
      summaryRows.push([srNo++, CATEGORY_LABELS[cat], catSum, parties[0][1].cash, parties[0][1].cheque, parties[0][1].pending]);
    } else {
      summaryRows.push([srNo++, CATEGORY_LABELS[cat], '', '', '', '']);
      parties.forEach(([name, v], i) => {
        summaryRows.push(['', `  (${ROMAN[i]}) ${name}`, v.amount, v.cash, v.cheque, v.pending]);
      });
    }
  }

  summaryRows.push([]);
  summaryRows.push(['', 'TOTAL EXPENSE', catTotal, expenses.reduce((s,e)=>s+e.cash_payment,0), expenses.reduce((s,e)=>s+e.cheque_payment,0), expenses.reduce((s,e)=>s+e.pending_payment,0)]);

  const gstTotal = expenses.reduce((s, e) => s + (e.gst_amount || 0), 0);
  if (gstTotal > 0) {
    summaryRows.push(['', 'GST Component (incl. above)', gstTotal, '', '', '']);
  }

  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1['!cols'] = [{ wch: 8 }, { wch: 35 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

  // ── Sheet 2: All Expenses (raw) ─────────────────────────────────
  const buildDetailSheet = (rows: Expense[], sheetName: string) => {
    const data: any[][] = [
      ['Date', 'Category', 'Vendor / Party', 'Description', 'Qty', 'Rate', 'Amount (Rs.)', 'Cash (Rs.)', 'Cheque (Rs.)', 'Pending (Rs.)', 'Cheque No', 'Payment Date', 'GST?', 'GST Rate%', 'GST Amount (Rs.)', 'Remarks'],
    ];
    rows.forEach((e) => {
      data.push([
        e.expense_date,
        CATEGORY_LABELS[e.category] || e.category,
        e.vendor_name || '',
        e.description || '',
        e.quantity ?? '',
        e.rate_unit ?? '',
        e.amount,
        e.cash_payment,
        e.cheque_payment,
        e.pending_payment,
        e.cheque_no || '',
        e.payment_date || '',
        e.has_gst ? 'Yes' : 'No',
        e.has_gst ? e.gst_rate : '',
        e.has_gst ? e.gst_amount : '',
        e.remarks || '',
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 28 },
      { wch: 8 },  { wch: 10 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
      { wch: 8 },  { wch: 10 }, { wch: 14 }, { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  };

  buildDetailSheet(expenses, 'All Expenses');

  const gstExpenses = expenses.filter((e) => e.has_gst === 1);
  if (gstExpenses.length > 0) {
    buildDetailSheet(gstExpenses, 'GST Bills Only');
  }

  const { filename } = getExportMetadata('Summary Sheet', project, dateFrom, dateTo);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToExcel(project: Project, categories: Category[], summary: BudgetSummaryData) {
  const wb = XLSX.utils.book_new();

  // ========== SHEET 1: Budget Details ==========
  const rows: any[][] = [];

  // Header rows
  rows.push(['PROJECT BUDGET ESTIMATE']);
  rows.push([]);
  rows.push(['Project Name', project.name]);
  rows.push(['Client', project.client]);
  if (project.plot_no) rows.push(['Plot No.', project.plot_no]);
  if (project.location) rows.push(['Location', project.location]);
  if (project.area_sqft > 0) rows.push(['Area (Sq.ft)', project.area_sqft]);
  rows.push(['Generated Date', new Date().toLocaleDateString('en-IN')]);
  rows.push([]);

  // For each category
  categories.forEach((category) => {
    const catTotal = (category.items || []).reduce((sum, item) => sum + item.quantity * item.rate, 0);

    rows.push([`${category.name}`, '', '', '', `Rs.${catTotal.toLocaleString('en-IN')}`]);
    rows.push(['Description', 'Unit', 'Quantity', 'Rate (Rs.)', 'Amount (Rs.)']);

    (category.items || []).forEach((item) => {
      rows.push([
        item.description || '—',
        item.unit,
        item.quantity,
        item.rate,
        item.quantity * item.rate,
      ]);
    });

    rows.push([]);
  });

  // Summary
  rows.push([]);
  rows.push(['', '', '', 'Subtotal', summary.subtotal]);
  rows.push(['', '', '', `Contingency (${project.contingency_rate}%)`, summary.contingency]);
  rows.push(['', '', '', 'Before Tax', summary.beforeTax]);
  rows.push(['', '', '', `GST (${project.gst_rate}%)`, summary.gst]);
  rows.push(['', '', '', 'GRAND TOTAL', summary.grandTotal]);
  if (project.area_sqft > 0) {
    rows.push(['', '', '', 'Rate per Sq.ft', Math.round(summary.ratePerSqFt)]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 35 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Budget Details');

  // ========== SHEET 2: Category Summary ==========
  const summaryRows: any[][] = [
    ['Category', 'Items', 'Total Amount (Rs.)', '% of Budget'],
  ];

  categories.forEach((cat) => {
    const total = (cat.items || []).reduce((sum, item) => sum + item.quantity * item.rate, 0);
    const pct = summary.subtotal > 0 ? ((total / summary.subtotal) * 100).toFixed(1) + '%' : '0%';
    summaryRows.push([cat.name, (cat.items || []).length, total, pct]);
  });

  summaryRows.push([]);
  summaryRows.push(['TOTAL', categories.reduce((sum, c) => sum + (c.items?.length || 0), 0), summary.subtotal, '100%']);

  const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws2['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 18 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Category Summary');

  // Save
  const { filename } = getExportMetadata('Budget Estimate', project, '', '');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
