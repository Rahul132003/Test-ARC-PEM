import { generateId } from '../src/lib/calculations';
import { getDatabase } from './database';

export async function seedDemoProject() {
  const db = getDatabase();
  const projectId = 'proj-w7-3-sec76';

  db.prepare(`
    INSERT OR REPLACE INTO projects (id, name, client, location, plot_no, area_sqft, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    'W7-3 Sector-76',
    'Faridabad Residential',
    'Sector-76, Faridabad',
    'W7-3',
    0,
    new Date().toISOString(),
    new Date().toISOString()
  );

  db.prepare('DELETE FROM expenses WHERE project_id = ?').run(projectId);

  const expenses: any[] = [
    // ── LABOUR EXPENSES — 20 entries, total 3,43,500 ─────────────
    { expense_date: '2025-12-09', category: 'labour', description: 'Daily Labour',
      mason_count: 9,  mason_rate: 700, coolie_count: 0,  coolie_rate: 0,
      helper_count: 12, helper_rate: 500, other_count: 0, other_rate: 0,
      amount: 12300, cash_payment: 12300, payment_date: '2025-12-13' },

    { expense_date: '2025-12-13', category: 'labour', description: 'Daily Labour',
      mason_count: 13, mason_rate: 700, coolie_count: 9,  coolie_rate: 500,
      helper_count: 8,  helper_rate: 600, other_count: 0, other_rate: 0,
      amount: 18400, cash_payment: 18400, payment_date: '2025-12-13' },

    { expense_date: '2025-12-14', category: 'labour', description: 'Daily Labour',
      mason_count: 3, mason_rate: 700, coolie_count: 2, coolie_rate: 500,
      helper_count: 3, helper_rate: 600, other_count: 0, other_rate: 0,
      amount: 4900, cash_payment: 4900, payment_date: '2025-12-14' },

    { expense_date: '2025-12-16', category: 'labour', description: 'Daily Labour',
      mason_count: 2, mason_rate: 700, coolie_count: 4, coolie_rate: 500,
      helper_count: 1, helper_rate: 600, other_count: 0, other_rate: 0,
      amount: 4000, cash_payment: 4000, payment_date: '2025-12-16' },

    { expense_date: '2025-12-18', category: 'labour', description: 'Daily Labour',
      mason_count: 2, mason_rate: 700, coolie_count: 4, coolie_rate: 500,
      helper_count: 1, helper_rate: 600, other_count: 0, other_rate: 0,
      amount: 4000, cash_payment: 4000, payment_date: '2025-12-18' },

    { expense_date: '2025-12-23', category: 'labour', description: 'Daily Labour',
      mason_count: 11, mason_rate: 700, coolie_count: 18, coolie_rate: 500,
      helper_count: 7,  helper_rate: 600, other_count: 0, other_rate: 0,
      amount: 20900, cash_payment: 20900, payment_date: '2025-12-23' },

    { expense_date: '2025-12-27', category: 'labour', description: 'Daily Labour',
      mason_count: 2, mason_rate: 700, coolie_count: 3, coolie_rate: 500,
      helper_count: 0, helper_rate: 0, other_count: 0, other_rate: 0,
      amount: 2900, cash_payment: 2900, payment_date: '2025-12-27' },

    // Row 8: amount 20,000 as stated in PDF (worker costs compute to 10,900 — client's recorded figure used)
    { expense_date: '2025-12-27', category: 'labour', description: 'Daily Labour',
      mason_count: 5, mason_rate: 700, coolie_count: 10, coolie_rate: 500,
      helper_count: 4, helper_rate: 600, other_count: 0, other_rate: 0,
      amount: 20000, cash_payment: 20000, payment_date: '2025-12-27' },

    { expense_date: '2026-01-09', category: 'labour', description: 'Daily Labour',
      mason_count: 11, mason_rate: 700, coolie_count: 12, coolie_rate: 500,
      helper_count: 5,  helper_rate: 600, other_count: 0, other_rate: 0,
      amount: 16700, cash_payment: 16700, payment_date: '2026-01-09' },

    { expense_date: '2026-01-15', category: 'labour', description: 'Daily Labour',
      mason_count: 12, mason_rate: 700, coolie_count: 21, coolie_rate: 500,
      helper_count: 6,  helper_rate: 600, other_count: 0, other_rate: 0,
      amount: 22500, cash_payment: 22500, payment_date: '2026-01-15' },

    { expense_date: '2026-01-20', category: 'labour', description: 'Daily Labour',
      mason_count: 7,  mason_rate: 700, coolie_count: 16, coolie_rate: 500,
      helper_count: 5,  helper_rate: 600, other_count: 0, other_rate: 0,
      amount: 15900, cash_payment: 15900, payment_date: '2026-01-20' },

    { expense_date: '2026-01-24', category: 'labour', description: 'Daily Labour',
      mason_count: 6,  mason_rate: 700, coolie_count: 17, coolie_rate: 500,
      helper_count: 6,  helper_rate: 600, other_count: 0, other_rate: 0,
      amount: 16300, cash_payment: 16300, payment_date: '2026-01-24' },

    { expense_date: '2026-01-30', category: 'labour', description: 'Daily Labour',
      mason_count: 7,  mason_rate: 700, coolie_count: 18, coolie_rate: 500,
      helper_count: 9,  helper_rate: 600, other_count: 0, other_rate: 0,
      amount: 19300, cash_payment: 19300, payment_date: '2026-01-30' },

    { expense_date: '2026-02-06', category: 'labour', description: 'Daily Labour',
      mason_count: 4,  mason_rate: 700, coolie_count: 18, coolie_rate: 500,
      helper_count: 4,  helper_rate: 600, other_count: 0, other_rate: 0,
      amount: 14200, cash_payment: 14200, payment_date: '2026-02-06' },

    { expense_date: '2026-02-14', category: 'labour', description: 'Daily Labour',
      mason_count: 12, mason_rate: 700, coolie_count: 22, coolie_rate: 500,
      helper_count: 11, helper_rate: 600, other_count: 0, other_rate: 0,
      amount: 26000, cash_payment: 26000, payment_date: '2026-02-14' },

    { expense_date: '2026-02-21', category: 'labour', description: 'Daily Labour',
      mason_count: 10, mason_rate: 700, coolie_count: 20, coolie_rate: 500,
      helper_count: 9,  helper_rate: 600, other_count: 0, other_rate: 0,
      amount: 22400, cash_payment: 22400, payment_date: '2026-02-21' },

    { expense_date: '2026-03-02', category: 'labour', description: 'Daily Labour',
      mason_count: 16, mason_rate: 700, coolie_count: 30, coolie_rate: 500,
      helper_count: 15, helper_rate: 600, other_count: 0, other_rate: 0,
      amount: 35200, cash_payment: 35200, payment_date: '2026-03-02' },

    { expense_date: '2026-03-11', category: 'labour', description: 'Daily Labour',
      mason_count: 13, mason_rate: 700, coolie_count: 25, coolie_rate: 500,
      helper_count: 8,  helper_rate: 600, other_count: 0, other_rate: 0,
      amount: 26400, cash_payment: 26400, payment_date: '2026-03-11' },

    { expense_date: '2026-03-17', category: 'labour', description: 'Daily Labour',
      mason_count: 2, mason_rate: 700, coolie_count: 7, coolie_rate: 500,
      helper_count: 1, helper_rate: 600, other_count: 0, other_rate: 0,
      amount: 5500, cash_payment: 5500, payment_date: '2026-03-17' },

    { expense_date: '2026-03-28', category: 'labour', description: 'Daily Labour',
      mason_count: 15, mason_rate: 700, coolie_count: 30, coolie_rate: 500,
      helper_count: 17, helper_rate: 600, other_count: 0, other_rate: 0,
      amount: 35700, cash_payment: 35700, payment_date: '2026-03-28' },

    // ── SITE EXPENSES — 24 entries, total 1,81,205 ───────────────
    { expense_date: '2025-12-09', category: 'site', description: 'Site Expenses', amount: 400,    cash_payment: 400,    payment_date: '2025-12-09' },
    { expense_date: '2025-12-13', category: 'site', description: 'Site Expenses', amount: 9470,   cash_payment: 9470,   payment_date: '2025-12-13' },
    { expense_date: '2025-12-23', category: 'site', description: 'Site Expenses', amount: 26230,  cash_payment: 26230,  payment_date: '2025-12-13' },
    { expense_date: '2025-12-23', category: 'site', description: 'Site Expenses', amount: 4000,   cash_payment: 4000,   payment_date: '2025-12-23' },
    { expense_date: '2025-12-24', category: 'site', description: 'Site Expenses', amount: 9000,   cash_payment: 9000,   payment_date: '2025-12-24' },
    { expense_date: '2025-12-27', category: 'site', description: 'Site Expenses', amount: 3550,   cash_payment: 3550,   payment_date: '2025-12-27' },
    { expense_date: '2026-01-02', category: 'site', description: 'Site Expenses', amount: 4890,   cash_payment: 4890,   payment_date: '2026-01-02' },
    { expense_date: '2026-01-09', category: 'site', description: 'Site Expenses', amount: 6270,   cash_payment: 6270,   payment_date: '2026-01-09' },
    { expense_date: '2026-01-09', category: 'site', description: 'Site Expenses', amount: 4000,   cash_payment: 4000,   payment_date: '2026-01-09' },
    { expense_date: '2026-01-10', category: 'site', description: 'Site Expenses', amount: 5500,   cash_payment: 5500,   payment_date: '2026-01-10' },
    { expense_date: '2026-01-15', category: 'site', description: 'Site Expenses', amount: 14150,  cash_payment: 14150,  payment_date: '2026-01-15' },
    { expense_date: '2026-01-20', category: 'site', description: 'Site Expenses', amount: 4730,   cash_payment: 4730,   payment_date: '2026-01-20' },
    { expense_date: '2026-01-24', category: 'site', description: 'Site Expenses', amount: 2650,   cash_payment: 2650,   payment_date: '2026-01-24' },
    { expense_date: '2026-01-30', category: 'site', description: 'Site Expenses', amount: 7670,   cash_payment: 7670,   payment_date: '2026-01-30' },
    { expense_date: '2026-02-06', category: 'site', description: 'Site Expenses', amount: 7345,   cash_payment: 7345,   payment_date: '2026-02-06' },
    { expense_date: '2026-02-14', category: 'site', description: 'Site Expenses', amount: 10010,  cash_payment: 10010,  payment_date: '2026-02-14' },
    { expense_date: '2026-02-15', category: 'site', description: 'Site Foreman',  amount: 12000,  cash_payment: 12000,  payment_date: '2026-02-15' },
    { expense_date: '2026-02-21', category: 'site', description: 'Site Expenses', amount: 13780,  cash_payment: 13780,  payment_date: '2026-02-21' },
    { expense_date: '2026-03-02', category: 'site', description: 'Site Expenses', amount: 3420,   cash_payment: 3420,   payment_date: '2026-03-02' },
    { expense_date: '2026-03-02', category: 'site', description: 'Site Expenses', amount: 4000,   cash_payment: 4000,   payment_date: '2026-03-02' },
    { expense_date: '2026-03-11', category: 'site', description: 'Site Expenses', amount: 5700,   cash_payment: 5700,   payment_date: '2026-03-11' },
    { expense_date: '2026-03-11', category: 'site', description: 'Site Expenses', amount: 4000,   cash_payment: 4000,   payment_date: '2026-03-11' },
    { expense_date: '2026-03-17', category: 'site', description: 'Site Expenses', amount: 4250,   cash_payment: 4250,   payment_date: '2026-03-17' },
    { expense_date: '2026-03-28', category: 'site', description: 'Site Expenses', amount: 14190,  cash_payment: 14190,  payment_date: '2026-03-28' },

    // ── CONTRACTOR — AGGARWAL RMC (2 entries, total 2,77,447.50) ─
    { expense_date: '2026-01-09', category: 'contractor', vendor_name: 'Aggarwal RMC Contractor',
      description: 'RMC Concrete (Incl 5 Invoices)',
      quantity: 32.50, rate_unit: 5605,
      amount: 182162.50, cash_payment: 0, cheque_payment: 182162,
      cheque_no: null, pending_payment: 0.50, payment_date: '2026-01-09' },

    { expense_date: '2026-02-21', category: 'contractor', vendor_name: 'Aggarwal RMC Contractor',
      description: 'RMC Concrete (Incl 3 Invoices)',
      quantity: 17.00, rate_unit: 5605,
      amount: 95285, cash_payment: 0, cheque_payment: 95285,
      cheque_no: '529751', pending_payment: 0, payment_date: '2026-02-21' },

    // ── VENDOR — RAKESH BUILDING MATERIALS (2 entries, total 1,27,159.50) ─
    { expense_date: '2025-12-03', category: 'vendor', vendor_name: 'Rakesh Building Materials',
      description: 'Dust',
      quantity: 52.11, rate_unit: 1250,
      amount: 65137.50, cash_payment: 35750, cheque_payment: 0,
      pending_payment: 29387.50, payment_date: '2025-12-03' },

    { expense_date: '2025-12-03', category: 'vendor', vendor_name: 'Rakesh Building Materials',
      description: 'Rodi',
      quantity: 51.69, rate_unit: 1200,
      amount: 62022, cash_payment: 35750, cheque_payment: 55659,
      pending_payment: -29387, payment_date: '2025-12-03' },

    // ── VENDOR — RAJINDER BUILDING MATERIALS (3 entries, total 1,12,514.40) ─
    { expense_date: '2026-02-09', category: 'vendor', vendor_name: 'Rajinder Building Materials',
      description: 'Dust',
      quantity: 8, rate_unit: 5500,
      amount: 44000, cash_payment: 44000, cheque_payment: 0,
      pending_payment: 0, payment_date: '2026-02-09' },

    { expense_date: '2026-02-09', category: 'vendor', vendor_name: 'Rajinder Building Materials',
      description: 'JCB',
      amount: 6500, cash_payment: 6500, cheque_payment: 0,
      pending_payment: 0, payment_date: '2026-02-09' },

    { expense_date: '2026-02-23', category: 'vendor', vendor_name: 'Rajinder Building Materials',
      description: 'Dust',
      quantity: 55.37, rate_unit: 1120,
      amount: 62014.40, cash_payment: 62000, cheque_payment: 0,
      pending_payment: 14.40, payment_date: '2026-02-23' },

    // ── VENDOR — MR. VIJAY GOUR (4 entries, total 37,000) ────────
    { expense_date: '2025-12-30', category: 'vendor', vendor_name: 'Mr. Vijay Gour',
      description: 'Steel Binder',
      amount: 10000, cash_payment: 10000, pending_payment: 0, payment_date: '2025-12-30' },

    { expense_date: '2026-01-02', category: 'vendor', vendor_name: 'Mr. Vijay Gour',
      description: 'Steel Binder',
      amount: 12000, cash_payment: 12000, pending_payment: 0, payment_date: '2026-01-02' },

    { expense_date: '2026-01-12', category: 'vendor', vendor_name: 'Mr. Vijay Gour',
      description: 'Steel Binder',
      amount: 10000, cash_payment: 10000, pending_payment: 0, payment_date: '2026-01-12' },

    { expense_date: '2026-01-24', category: 'vendor', vendor_name: 'Mr. Vijay Gour',
      description: 'Steel Binder',
      amount: 5000, cash_payment: 5000, pending_payment: 0, payment_date: '2026-01-24' },

    // ── VENDOR — SONU BAR BINDER WORKS (5 entries, total 56,000) ─
    { expense_date: '2026-02-02', category: 'vendor', vendor_name: 'Sonu Bar Binder Works',
      description: 'Binding',
      quantity: 2.5, rate_unit: 7000,
      amount: 17500, cash_payment: 17500, pending_payment: 0, payment_date: '2026-02-02' },

    { expense_date: '2026-02-09', category: 'vendor', vendor_name: 'Sonu Bar Binder Works',
      description: 'Binding',
      amount: 8000, cash_payment: 8000, pending_payment: 0, payment_date: '2026-02-09' },

    { expense_date: '2026-02-14', category: 'vendor', vendor_name: 'Sonu Bar Binder Works',
      description: 'Binding',
      amount: 10500, cash_payment: 10500, pending_payment: 0, payment_date: '2026-02-14' },

    { expense_date: '2026-03-17', category: 'vendor', vendor_name: 'Sonu Bar Binder Works',
      description: 'Binding',
      amount: 10000, cash_payment: 10000, pending_payment: 0, payment_date: '2026-03-17' },

    { expense_date: '2026-04-01', category: 'vendor', vendor_name: 'Sonu Bar Binder Works',
      description: 'Binding',
      amount: 10000, cash_payment: 10000, pending_payment: 0, payment_date: '2026-04-01' },

    // ── VENDOR — MAHALAXMI CEMENT AGENCY (1 entry, total 17,250) ─
    { expense_date: '2026-02-21', category: 'vendor', vendor_name: 'Mahalaxmi Cement Agency',
      description: 'Cement',
      quantity: 50, rate_unit: 345,
      amount: 17250, cash_payment: 0, cheque_payment: 0,
      pending_payment: 17250, payment_date: '2026-02-21' },

    // ── VENDOR — CHOUDHARY STEEL TRADER (10 entries, total 9,49,404) ─
    { expense_date: '2025-12-30', category: 'vendor', vendor_name: 'Choudhary Steel Trader',
      description: 'Steel',
      amount: 287860, cash_payment: 0, cheque_payment: 287860,
      cheque_no: null, pending_payment: 0, payment_date: '2025-12-30' },

    { expense_date: '2025-12-30', category: 'vendor', vendor_name: 'Choudhary Steel Trader',
      description: 'Cement',
      amount: 34504, cash_payment: 0, cheque_payment: 34504,
      cheque_no: null, pending_payment: 0, payment_date: '2025-12-30' },

    { expense_date: '2026-01-10', category: 'vendor', vendor_name: 'Choudhary Steel Trader',
      description: 'Steel',
      amount: 144565, cash_payment: 0, cheque_payment: 144565,
      cheque_no: null, pending_payment: 0, payment_date: '2026-01-10' },

    { expense_date: '2026-01-10', category: 'vendor', vendor_name: 'Choudhary Steel Trader',
      description: 'Unloading',
      amount: 3000, cash_payment: 0, cheque_payment: 0,
      pending_payment: 3000, payment_date: '2026-01-10' },

    { expense_date: '2026-01-10', category: 'vendor', vendor_name: 'Choudhary Steel Trader',
      description: 'Cartage',
      amount: 3000, cash_payment: 0, cheque_payment: 0,
      pending_payment: 3000, payment_date: '2026-01-10' },

    // Cash 10,000 paid for 4,000 item → pending = -6,000 (overpayment/advance)
    { expense_date: '2026-01-10', category: 'vendor', vendor_name: 'Choudhary Steel Trader',
      description: 'Bind Wire',
      quantity: 2, rate_unit: 2000,
      amount: 4000, cash_payment: 10000, cheque_payment: 0,
      pending_payment: -6000, payment_date: '2026-01-10' },

    { expense_date: '2026-01-16', category: 'vendor', vendor_name: 'Choudhary Steel Trader',
      description: 'Bags',
      quantity: 70, rate_unit: 345,
      amount: 24150, cash_payment: 0, cheque_payment: 24150,
      cheque_no: null, pending_payment: 0, payment_date: '2026-01-16' },

    { expense_date: '2026-02-10', category: 'vendor', vendor_name: 'Choudhary Steel Trader',
      description: 'Steel',
      amount: 95087, cash_payment: 7000, cheque_payment: 88087,
      cheque_no: null, pending_payment: 0, payment_date: '2026-02-10' },

    { expense_date: '2026-03-24', category: 'vendor', vendor_name: 'Choudhary Steel Trader',
      description: 'Steel',
      amount: 336738, cash_payment: 0, cheque_payment: 336738,
      cheque_no: null, pending_payment: 0, payment_date: '2026-03-24' },

    { expense_date: '2026-03-24', category: 'vendor', vendor_name: 'Choudhary Steel Trader',
      description: 'Steel',
      amount: 16500, cash_payment: 0, cheque_payment: 0,
      pending_payment: 16500, payment_date: '2026-03-24' },

    // ── VENDOR — CHINTOO BRICKS (from summary sheet, 1,02,120 pending) ─
    { expense_date: '2026-01-20', category: 'vendor', vendor_name: 'Chintoo Bricks',
      description: 'Bricks',
      amount: 102120, cash_payment: 0, cheque_payment: 0,
      pending_payment: 102120, payment_date: '2026-01-20' },
  ];

  // ── VENDOR DIRECTORY — seed all unique names used in expenses ──────────────
  const insertVendor = db.prepare(`
    INSERT OR IGNORE INTO vendors (id, name, category, contact_person, phone, email, gstin, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedVendors = [
    { id: 'vnd-seed-001', name: 'Aggarwal RMC Contractor',    category: 'contractor', phone: null, notes: 'RMC concrete supplier — Sector 76' },
    { id: 'vnd-seed-002', name: 'Rakesh Building Materials',  category: 'vendor',     phone: null, notes: 'Dust and Rodi supplier' },
    { id: 'vnd-seed-003', name: 'Rajinder Building Materials',category: 'vendor',     phone: null, notes: 'Dust and JCB services' },
    { id: 'vnd-seed-004', name: 'Mr. Vijay Gour',             category: 'vendor',     phone: null, notes: 'Steel binder' },
    { id: 'vnd-seed-005', name: 'Sonu Bar Binder Works',      category: 'vendor',     phone: null, notes: 'Bar binding works' },
    { id: 'vnd-seed-006', name: 'Mahalaxmi Cement Agency',    category: 'vendor',     phone: null, notes: 'Cement supplier' },
    { id: 'vnd-seed-007', name: 'Choudhary Steel Trader',     category: 'vendor',     phone: null, notes: 'Steel, cement, and materials' },
    { id: 'vnd-seed-008', name: 'Chintoo Bricks',             category: 'vendor',     phone: null, notes: 'Bricks supplier' },
  ];

  const now = new Date().toISOString();
  seedVendors.forEach((v) => {
    insertVendor.run(v.id, v.name, v.category, null, v.phone, null, null, v.notes, now);
  });

  const insertExp = db.prepare(`
    INSERT INTO expenses (
      id, project_id, expense_date, category, vendor_name, description,
      quantity, rate_unit, amount, advance_amt, cash_payment, cheque_payment, cheque_no,
      pending_payment, payment_date, remarks, sort_order,
      mason_count, mason_rate, coolie_count, coolie_rate,
      helper_count, helper_rate, other_count, other_rate
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  expenses.forEach((exp, idx) => {
    insertExp.run(
      generateId('exp'),
      projectId,
      exp.expense_date,
      exp.category,
      exp.vendor_name   ?? null,
      exp.description   ?? null,
      exp.quantity      ?? null,
      exp.rate_unit     ?? null,
      exp.amount        ?? 0,
      0,
      exp.cash_payment    ?? 0,
      exp.cheque_payment  ?? 0,
      exp.cheque_no       ?? null,
      exp.pending_payment ?? 0,
      exp.payment_date    ?? null,
      exp.remarks         ?? null,
      idx,
      exp.mason_count  ?? 0, exp.mason_rate  ?? 0,
      exp.coolie_count ?? 0, exp.coolie_rate ?? 0,
      exp.helper_count ?? 0, exp.helper_rate ?? 0,
      exp.other_count  ?? 0, exp.other_rate  ?? 0
    );
  });

  return projectId;
}
