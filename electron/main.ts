import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import * as fs from 'fs';
import { randomUUID, createHash } from 'crypto';
import { initDatabase, getDatabase, getCurrentDbPath, closeDatabase, getSettingsPath } from './database';
import { getLicenseStatus, activateLicense, deactivateLicense, getMachineId, PLAN_LIMITS, PLAN_FEATURES } from './license';
import { seedDemoProject } from './seed';

// ── Pin userData to a stable folder so renaming productName never loses data ──
// Must run before app.whenReady(). Uses process.env instead of app.getPath()
// because app.getPath() is not guaranteed to work before the ready event.
{
  const appData =
    process.env.APPDATA ||                                                 // Windows
    (process.platform === 'darwin'
      ? path.join(process.env.HOME ?? '', 'Library', 'Application Support')
      : path.join(process.env.HOME ?? '', '.config'));                     // Linux

  const target      = path.join(appData, 'Arch PEM');
  const legacyNames = ['Arch Budget Calculator', 'arch-budget-calculator', 'Projex'];

  let didMigrate = false;
  if (!fs.existsSync(target)) {
    for (const old of legacyNames) {
      const src = path.join(appData, old);
      if (fs.existsSync(src)) {
        try { fs.cpSync(src, target, { recursive: true }); didMigrate = true; } catch { /* start fresh */ }
        break;
      }
    }
  }

  // Even if the target directory already exists, rescue .machine-id from a legacy
  // path if it's missing — this preserves the machine ID across productName renames
  // so existing licenses continue to work without re-activation.
  const targetMachineId = path.join(target, '.machine-id');
  if (!fs.existsSync(targetMachineId)) {
    for (const old of legacyNames) {
      const src = path.join(appData, old, '.machine-id');
      if (fs.existsSync(src)) {
        try { fs.copyFileSync(src, targetMachineId); } catch { /* ignore */ }
        break;
      }
    }
  }

  // After migration, strip onboardingComplete so the setup wizard runs in the
  // new build. The database, license, PIN and company name are all preserved.
  if (didMigrate) {
    const settingsFile = path.join(target, 'app-settings.json');
    try {
      const s = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
      delete s.onboardingComplete;
      fs.writeFileSync(settingsFile, JSON.stringify(s, null, 2));
    } catch { /* no settings to patch — that's fine */ }
  }

  app.setPath('userData', target);
}

let mainWindow: BrowserWindow | null = null;

const AUTO_BACKUP_DIR = () => path.join(app.getPath('userData'), 'auto-backups');
const MAX_AUTO_BACKUPS = 30;

function performAutoBackup(): void {
  try {
    const srcPath = getCurrentDbPath();
    if (!fs.existsSync(srcPath)) return;

    const dir = AUTO_BACKUP_DIR();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const today = new Date().toISOString().split('T')[0];
    const destPath = path.join(dir, `auto-backup-${today}.db`);

    // Idempotent — skip if today's backup already exists
    if (!fs.existsSync(destPath)) {
      try { getDatabase().pragma('wal_checkpoint(FULL)'); } catch { /* db may already be closed */ }
      fs.copyFileSync(srcPath, destPath);
    }

    // Keep only the most recent MAX_AUTO_BACKUPS files
    const files = fs.readdirSync(dir)
      .filter((f) => f.startsWith('auto-backup-') && f.endsWith('.db'))
      .sort(); // YYYY-MM-DD sorts lexicographically = chronologically
    if (files.length > MAX_AUTO_BACKUPS) {
      files.slice(0, files.length - MAX_AUTO_BACKUPS).forEach((f) =>
        fs.unlinkSync(path.join(dir, f))
      );
    }
  } catch (err) {
    console.error('[auto-backup] Failed:', err);
  }
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (status: object) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', status);
    }
  };

  autoUpdater.on('checking-for-update', () => send({ type: 'checking' }));
  autoUpdater.on('update-available', (info) => send({ type: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => send({ type: 'not-available' }));
  autoUpdater.on('download-progress', (p) => send({ type: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => send({ type: 'downloaded', version: info.version }));
  autoUpdater.on('error', (err) => send({ type: 'error', message: err.message }));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 16, y: 16 } } : {}),
    backgroundColor: '#f5f6fa',
    icon: path.join(__dirname, '../public/arc-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  initDatabase();
  registerIpcHandlers();
  createWindow();
  setupAutoUpdater();

  // Check for updates 5 seconds after launch (only in packaged app)
  if (app.isPackaged) {
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  performAutoBackup();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ── Column whitelists for dynamic UPDATE statements ────────────────────────
const PROJECT_COLS    = new Set(['name','client','plot_no','location','area_sqft','description','gst_rate','contingency_rate','status','tags']);
const CATEGORY_COLS   = new Set(['name','color','sort_order']);
const LINE_ITEM_COLS  = new Set(['description','unit','quantity','rate','notes','sort_order']);
const EXPENSE_COLS    = new Set(['expense_date','category','vendor_name','description','quantity','rate_unit','unit','amount','advance_amt','cash_payment','cheque_payment','pending_payment','cheque_no','payment_date','mason_count','mason_rate','coolie_count','coolie_rate','helper_count','helper_rate','other_count','other_rate','remarks','sort_order','has_gst','gst_rate','gst_amount','attachment_path','invoice_no','round_off','round_off_amount']);
const VENDOR_COLS     = new Set(['name','category','contact_person','phone','email','gstin','notes']);

function buildUpdate(data: Record<string, any>, allowed: Set<string>) {
  const keys = Object.keys(data).filter((k) => allowed.has(k));
  if (keys.length === 0) throw new Error('No valid columns to update');
  return { fields: keys.map((k) => `${k} = ?`).join(', '), values: keys.map((k) => data[k]) };
}

function registerIpcHandlers() {
  const db = getDatabase();

  // ========== PROJECTS ==========
  ipcMain.handle('db:getProjects', () => {
    return db.prepare(`
      SELECT p.*,
        (SELECT COALESCE(SUM(e.amount), 0)
         FROM expenses e
         WHERE e.project_id = p.id) as total_amount
      FROM projects p
      ORDER BY p.updated_at DESC
    `).all();
  });

  ipcMain.handle('db:getProject', (_event, id: string) => {
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  });

  ipcMain.handle('db:createProject', (_event, project: any) => {
    const licStatus = getLicenseStatus();
    if (licStatus.valid) {
      const tier       = licStatus.plan ?? 'solo';
      const maxProj    = PLAN_LIMITS[tier].maxProjects;
      const activeCount = (db.prepare(`SELECT COUNT(*) as cnt FROM projects WHERE status = 'Active'`).get() as any).cnt as number;
      if (activeCount >= maxProj) {
        return { success: false, error: `Active project limit reached for your ${tier} plan (${maxProj} projects). Archive existing projects or upgrade your plan.` };
      }
    }

    const stmt = db.prepare(`
      INSERT INTO projects (id, name, client, plot_no, location, area_sqft, description, gst_rate, contingency_rate, status, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      project.id,
      project.name,
      project.client,
      project.plot_no || null,
      project.location || null,
      project.area_sqft || 0,
      project.description || null,
      project.gst_rate ?? 18,
      project.contingency_rate ?? 10,
      project.status || 'Active',
      project.tags || '[]'
    );

    // Create default categories
    const defaultCategories = [
      { name: 'Materials', color: '#6366f1', sort_order: 0 },
      { name: 'Labor', color: '#0ea5e9', sort_order: 1 },
      { name: 'Equipment', color: '#10b981', sort_order: 2 },
      { name: 'Professional Fees', color: '#f59e0b', sort_order: 3 },
      { name: 'Permits & Approvals', color: '#8b5cf6', sort_order: 4 },
      { name: 'Miscellaneous', color: '#f43f5e', sort_order: 5 },
    ];

    const catStmt = db.prepare(`
      INSERT INTO categories (id, project_id, name, color, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const cat of defaultCategories) {
      catStmt.run(`cat_${randomUUID()}`, project.id, cat.name, cat.color, cat.sort_order);
    }

    return { success: true };
  });

  ipcMain.handle('db:updateProject', (_event, id: string, data: any) => {
    const { fields, values } = buildUpdate(data, PROJECT_COLS);
    db.prepare(`UPDATE projects SET ${fields}, updated_at = datetime('now') WHERE id = ?`).run(...values, id);
    return { success: true };
  });

  ipcMain.handle('db:deleteProject', (_event, id: string) => {
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return { success: true };
  });

  ipcMain.handle('db:duplicateProject', (_event, sourceId: string, newId: string, newName: string) => {
    const source = db.prepare('SELECT * FROM projects WHERE id = ?').get(sourceId) as any;
    if (!source) return { success: false, error: 'Source project not found' };

    const run = db.transaction(() => {
      db.prepare(`
        INSERT INTO projects (id, name, client, plot_no, location, area_sqft, description, gst_rate, contingency_rate, status, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newId, newName, source.client, source.plot_no, source.location, source.area_sqft, source.description, source.gst_rate, source.contingency_rate, source.status || 'Active', source.tags || '[]');

      const categories = db.prepare('SELECT * FROM categories WHERE project_id = ? ORDER BY sort_order').all(sourceId) as any[];
      for (const cat of categories) {
        const newCatId = `cat_${randomUUID()}`;
        db.prepare('INSERT INTO categories (id, project_id, name, color, sort_order) VALUES (?, ?, ?, ?, ?)').run(newCatId, newId, cat.name, cat.color, cat.sort_order);

        const items = db.prepare('SELECT * FROM line_items WHERE category_id = ? ORDER BY sort_order').all(cat.id) as any[];
        for (const item of items) {
          db.prepare('INSERT INTO line_items (id, category_id, description, unit, quantity, rate, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(`li_${randomUUID()}`, newCatId, item.description, item.unit, item.quantity, item.rate, item.notes, item.sort_order);
        }
      }
    });

    try {
      run();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `Duplication failed: ${err?.message ?? String(err)}` };
    }
  });

  // ========== CATEGORIES ==========
  ipcMain.handle('db:getCategories', (_event, projectId: string) => {
    const categories = db.prepare(`
      SELECT c.*,
        (SELECT COALESCE(SUM(li.quantity * li.rate), 0) FROM line_items li WHERE li.category_id = c.id) as subtotal
      FROM categories c
      WHERE c.project_id = ?
      ORDER BY c.sort_order
    `).all(projectId) as any[];

    // Fetch all line items for the project in one query, then group by category
    const allItems = db.prepare(`
      SELECT li.* FROM line_items li
      JOIN categories c ON c.id = li.category_id
      WHERE c.project_id = ?
      ORDER BY li.sort_order
    `).all(projectId) as any[];

    const itemsByCategory = new Map<string, any[]>();
    for (const item of allItems) {
      if (!itemsByCategory.has(item.category_id)) itemsByCategory.set(item.category_id, []);
      itemsByCategory.get(item.category_id)!.push(item);
    }

    return categories.map((cat) => ({
      ...cat,
      items: itemsByCategory.get(cat.id) || [],
    }));
  });

  ipcMain.handle('db:createCategory', (_event, category: any) => {
    db.prepare('INSERT INTO categories (id, project_id, name, color, sort_order) VALUES (?, ?, ?, ?, ?)').run(
      category.id,
      category.project_id,
      category.name,
      category.color || '#6366f1',
      category.sort_order ?? 0
    );
    return { success: true };
  });

  ipcMain.handle('db:updateCategory', (_event, id: string, data: any) => {
    const { fields, values } = buildUpdate(data, CATEGORY_COLS);
    db.prepare(`UPDATE categories SET ${fields} WHERE id = ?`).run(...values, id);
    return { success: true };
  });

  ipcMain.handle('db:deleteCategory', (_event, id: string) => {
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return { success: true };
  });

  // ========== LINE ITEMS ==========
  ipcMain.handle('db:createLineItem', (_event, item: any) => {
    db.prepare(`
      INSERT INTO line_items (id, category_id, description, unit, quantity, rate, notes, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.category_id, item.description, item.unit || 'Lump Sum', item.quantity ?? 1, item.rate ?? 0, item.notes || null, item.sort_order ?? 0);

    // Update project timestamp
    db.prepare(`
      UPDATE projects SET updated_at = datetime('now')
      WHERE id = (SELECT project_id FROM categories WHERE id = ?)
    `).run(item.category_id);

    return { success: true };
  });

  ipcMain.handle('db:updateLineItem', (_event, id: string, data: any) => {
    const { fields, values } = buildUpdate(data, LINE_ITEM_COLS);
    db.prepare(`UPDATE line_items SET ${fields} WHERE id = ?`).run(...values, id);

    // Update project timestamp
    db.prepare(`
      UPDATE projects SET updated_at = datetime('now')
      WHERE id = (SELECT c.project_id FROM categories c JOIN line_items li ON li.category_id = c.id WHERE li.id = ?)
    `).run(id);

    return { success: true };
  });

  ipcMain.handle('db:deleteLineItem', (_event, id: string) => {
    db.prepare('DELETE FROM line_items WHERE id = ?').run(id);
    return { success: true };
  });

  // ========== TEMPLATES ==========
  ipcMain.handle('db:getTemplates', () => {
    return db.prepare('SELECT * FROM templates ORDER BY created_at DESC').all();
  });

  ipcMain.handle('db:createTemplate', (_event, template: any) => {
    db.prepare('INSERT INTO templates (id, name, description, data) VALUES (?, ?, ?, ?)').run(
      template.id,
      template.name,
      template.description || null,
      template.data
    );
    return { success: true };
  });

  ipcMain.handle('db:deleteTemplate', (_event, id: string) => {
    db.prepare('DELETE FROM templates WHERE id = ?').run(id);
    return { success: true };
  });

  ipcMain.handle('db:applyTemplate', (_event, projectId: string, templateData: string) => {
    let data: any;
    try {
      data = JSON.parse(templateData);
    } catch {
      return { success: false, error: 'Template data is corrupted or invalid.' };
    }

    if (!Array.isArray(data.categories) || data.categories.length === 0) {
      return { success: false, error: 'Template has no categories.' };
    }

    const run = db.transaction(() => {
      db.prepare('DELETE FROM categories WHERE project_id = ?').run(projectId);

      for (const cat of data.categories) {
        const newCatId = `cat_${randomUUID()}`;
        db.prepare('INSERT INTO categories (id, project_id, name, color, sort_order) VALUES (?, ?, ?, ?, ?)').run(newCatId, projectId, cat.name, cat.color ?? '#6366f1', cat.sort_order ?? 0);

        for (const item of cat.items || []) {
          db.prepare('INSERT INTO line_items (id, category_id, description, unit, quantity, rate, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(`li_${randomUUID()}`, newCatId, item.description, item.unit, item.quantity, item.rate, item.notes, item.sort_order ?? 0);
        }
      }
    });

    try {
      run();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `Template apply failed: ${err?.message ?? String(err)}` };
    }
  });

  // ========== BACKUP ==========
  ipcMain.handle('db:exportData', () => {
    const projects           = db.prepare('SELECT * FROM projects').all();
    const categories         = db.prepare('SELECT * FROM categories').all();
    const lineItems          = db.prepare('SELECT * FROM line_items').all();
    const templates          = db.prepare('SELECT * FROM templates').all();
    const expenses           = db.prepare('SELECT * FROM expenses').all();
    const vendors            = db.prepare('SELECT * FROM vendors').all();
    const vendorSettlements  = db.prepare('SELECT * FROM vendor_settlements').all();
    return JSON.stringify({ projects, categories, lineItems, templates, expenses, vendors, vendorSettlements }, null, 2);
  });

  // ========== EXPENSES ==========
  ipcMain.handle('db:getExpenses', (_event, projectId: string, dateFrom?: string, dateTo?: string) => {
    if (dateFrom && dateTo) {
      return db.prepare(`
        SELECT * FROM expenses
        WHERE project_id = ? AND expense_date >= ? AND expense_date <= ?
        ORDER BY expense_date, sort_order
      `).all(projectId, dateFrom, dateTo);
    }
    return db.prepare('SELECT * FROM expenses WHERE project_id = ? ORDER BY expense_date, sort_order').all(projectId);
  });

  ipcMain.handle('db:getExpensesByVendor', (_event, projectId: string, vendorName: string, dateFrom?: string, dateTo?: string) => {
    const trimmed = vendorName.trim();
    if (dateFrom && dateTo) {
      return db.prepare(`
        SELECT * FROM expenses
        WHERE project_id = ? AND TRIM(COALESCE(vendor_name,'')) = ? AND expense_date >= ? AND expense_date <= ?
        ORDER BY expense_date, sort_order
      `).all(projectId, trimmed, dateFrom, dateTo);
    }
    return db.prepare('SELECT * FROM expenses WHERE project_id = ? AND TRIM(COALESCE(vendor_name,\'\')) = ? ORDER BY expense_date, sort_order').all(projectId, trimmed);
  });

  ipcMain.handle('db:getExpensesByCategory', (_event, projectId: string, category: string, dateFrom?: string, dateTo?: string) => {
    if (dateFrom && dateTo) {
      return db.prepare(`
        SELECT * FROM expenses
        WHERE project_id = ? AND category = ? AND expense_date >= ? AND expense_date <= ?
        ORDER BY expense_date, sort_order
      `).all(projectId, category, dateFrom, dateTo);
    }
    return db.prepare('SELECT * FROM expenses WHERE project_id = ? AND category = ? ORDER BY expense_date, sort_order').all(projectId, category);
  });

  ipcMain.handle('seed-demo-project', async () => {
    return seedDemoProject();
  });

  ipcMain.handle('db:createExpense', (_event, expense: any) => {
    db.prepare(`
      INSERT INTO expenses (id, project_id, expense_date, category, vendor_name, description,
        quantity, rate_unit, unit, amount, advance_amt, cash_payment, cheque_payment, pending_payment,
        cheque_no, payment_date, mason_count, mason_rate, coolie_count, coolie_rate,
        helper_count, helper_rate, other_count, other_rate, remarks, sort_order,
        has_gst, gst_rate, gst_amount, invoice_no, round_off, round_off_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      expense.id,
      expense.project_id,
      expense.expense_date,
      expense.category,
      expense.vendor_name || null,
      expense.description || null,
      expense.quantity ?? null,
      expense.rate_unit ?? null,
      expense.unit || null,
      expense.amount || 0,
      expense.advance_amt || 0,
      expense.cash_payment || 0,
      expense.cheque_payment || 0,
      expense.pending_payment || 0,
      expense.cheque_no || null,
      expense.payment_date || null,
      expense.mason_count || 0,
      expense.mason_rate || 0,
      expense.coolie_count || 0,
      expense.coolie_rate || 0,
      expense.helper_count || 0,
      expense.helper_rate || 0,
      expense.other_count || 0,
      expense.other_rate || 0,
      expense.remarks || null,
      expense.sort_order ?? 0,
      expense.has_gst || 0,
      expense.gst_rate || 0,
      expense.gst_amount || 0,
      expense.invoice_no || null,
      expense.round_off || 0,
      expense.round_off_amount || 0
    );
    return { success: true };
  });

  ipcMain.handle('db:updateExpense', (_event, id: string, data: any) => {
    const { fields, values } = buildUpdate(data, EXPENSE_COLS);
    db.prepare(`UPDATE expenses SET ${fields} WHERE id = ?`).run(...values, id);
    return { success: true };
  });

  ipcMain.handle('db:deleteExpense', (_event, id: string) => {
    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    return { success: true };
  });

  ipcMain.handle('db:bulkDeleteExpenses', (_event, ids: string[]) => {
    if (!ids || ids.length === 0) return { success: true };
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM expenses WHERE id IN (${placeholders})`).run(...ids);
    return { success: true };
  });

  ipcMain.handle('db:deleteExpensesByVendor', (_event, projectId: string, vendorName: string) => {
    const trimmed = vendorName.trim();
    db.prepare(`DELETE FROM expenses WHERE project_id = ? AND TRIM(COALESCE(vendor_name,'')) = ?`).run(projectId, trimmed);
    return { success: true };
  });

  ipcMain.handle('db:bulkMarkPaid', (_event, ids: string[]) => {
    if (!ids || ids.length === 0) return { success: true };
    const today = new Date().toISOString().split('T')[0];
    const stmt = db.prepare(`UPDATE expenses SET pending_payment = 0, payment_date = ? WHERE id = ?`);
    const run = db.transaction(() => { for (const id of ids) stmt.run(today, id); });
    run();
    return { success: true };
  });

  // ========== MANPOWER PDF IMPORT ==========
  ipcMain.handle('pdf:openAndParseManpower', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win!, {
      title: 'Select Manpower Report PDF',
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (result.canceled || !result.filePaths[0]) return null;

    try {
      // pdf2json works reliably in Electron's main process (pure Node.js, no DOM needed)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const PDFParser = require('pdf2json');

      const rawText: string = await new Promise((resolve, reject) => {
        const parser = new PDFParser(null, 1); // 1 = raw text mode
        parser.on('pdfParser_dataReady', () => {
          resolve(parser.getRawTextContent() as string);
        });
        parser.on('pdfParser_dataError', (errData: any) => {
          reject(new Error(errData?.parserError ?? 'pdf2json error'));
        });
        parser.loadPDF(result.filePaths[0]);
      });

      return parseManpowerPdf(rawText);
    } catch (err: any) {
      console.error('PDF parse error:', err);
      return { error: `Failed to parse PDF: ${err?.message ?? String(err)}` };
    }
  });

  ipcMain.handle('db:importData', (_event, jsonData: string) => {
    let data: any;
    try {
      data = JSON.parse(jsonData);
    } catch {
      return { success: false, error: 'Backup file is corrupted or not valid JSON.' };
    }

    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM vendor_settlements').run();
      db.prepare('DELETE FROM expenses').run();
      db.prepare('DELETE FROM line_items').run();
      db.prepare('DELETE FROM categories').run();
      db.prepare('DELETE FROM projects').run();
      db.prepare('DELETE FROM templates').run();
      db.prepare('DELETE FROM vendors').run();

      for (const p of data.projects || []) {
        db.prepare(`
          INSERT INTO projects (id, name, client, plot_no, location, area_sqft, description,
            gst_rate, contingency_rate, status, tags, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          p.id, p.name, p.client, p.plot_no, p.location, p.area_sqft, p.description,
          p.gst_rate, p.contingency_rate,
          p.status || 'Active', p.tags || '[]',
          p.created_at, p.updated_at
        );
      }
      for (const c of data.categories || []) {
        db.prepare('INSERT INTO categories (id, project_id, name, color, sort_order) VALUES (?, ?, ?, ?, ?)').run(c.id, c.project_id, c.name, c.color, c.sort_order);
      }
      for (const li of data.lineItems || []) {
        db.prepare('INSERT INTO line_items (id, category_id, description, unit, quantity, rate, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(li.id, li.category_id, li.description, li.unit, li.quantity, li.rate, li.notes, li.sort_order);
      }
      for (const t of data.templates || []) {
        db.prepare('INSERT INTO templates (id, name, description, data, created_at) VALUES (?, ?, ?, ?, ?)').run(t.id, t.name, t.description, t.data, t.created_at);
      }
      for (const e of data.expenses || []) {
        db.prepare(`
          INSERT INTO expenses (id, project_id, expense_date, category, vendor_name, description,
            quantity, rate_unit, unit, amount, advance_amt, cash_payment, cheque_payment, pending_payment,
            cheque_no, payment_date, mason_count, mason_rate, coolie_count, coolie_rate,
            helper_count, helper_rate, other_count, other_rate, remarks, sort_order,
            has_gst, gst_rate, gst_amount, invoice_no, attachment_path, round_off, round_off_amount, created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          e.id, e.project_id, e.expense_date, e.category, e.vendor_name ?? null,
          e.description ?? null, e.quantity ?? null, e.rate_unit ?? null,
          e.unit ?? null,
          e.amount || 0, e.advance_amt || 0, e.cash_payment || 0,
          e.cheque_payment || 0, e.pending_payment || 0,
          e.cheque_no ?? null, e.payment_date ?? null,
          e.mason_count || 0, e.mason_rate || 0,
          e.coolie_count || 0, e.coolie_rate || 0,
          e.helper_count || 0, e.helper_rate || 0,
          e.other_count || 0, e.other_rate || 0,
          e.remarks ?? null, e.sort_order ?? 0,
          e.has_gst || 0, e.gst_rate || 0, e.gst_amount || 0,
          e.invoice_no ?? null,
          e.attachment_path ?? null, e.round_off ?? 0, e.round_off_amount ?? 0, e.created_at ?? null
        );
      }
      for (const v of data.vendors || []) {
        db.prepare(`
          INSERT INTO vendors (id, name, category, contact_person, phone, email, gstin, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          v.id, v.name, v.category || 'vendor',
          v.contact_person ?? null, v.phone ?? null,
          v.email ?? null, v.gstin ?? null, v.notes ?? null,
          v.created_at ?? null
        );
      }
      for (const s of data.vendorSettlements || []) {
        db.prepare(`
          INSERT INTO vendor_settlements (id, project_id, vendor_name, work_description, quantity, unit, rate, settled_amount, use_settlement, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          s.id, s.project_id, s.vendor_name,
          s.work_description ?? null, s.quantity ?? null,
          s.unit ?? null, s.rate ?? null, s.settled_amount ?? null,
          s.use_settlement ?? 0, s.created_at ?? null
        );
      }
    });
    try {
      transaction();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `Import failed: ${err?.message ?? String(err)}` };
    }
  });

  // ========== DB FILE BACKUP / RESTORE ==========
  ipcMain.handle('db:backupDbFile', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(win!, {
      title: 'Save Database Backup',
      defaultPath: `budget-backup-${new Date().toISOString().split('T')[0]}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });
    if (result.canceled || !result.filePath) return { success: false };
    try {
      db.pragma('wal_checkpoint(FULL)');
      fs.copyFileSync(getCurrentDbPath(), result.filePath);
      return { success: true, filePath: result.filePath };
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('db:restoreDbFile', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win!, {
      title: 'Select Database Backup to Restore',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return { success: false };
    try {
      closeDatabase();
      fs.copyFileSync(result.filePaths[0], getCurrentDbPath());
      app.relaunch();
      app.quit();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  });

  // ========== AUTO BACKUP MANAGEMENT ==========
  ipcMain.handle('backup:listAuto', () => {
    try {
      const dir = AUTO_BACKUP_DIR();
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir)
        .filter((f) => f.startsWith('auto-backup-') && f.endsWith('.db'))
        .sort()
        .reverse()
        .slice(0, 30)
        .map((f) => {
          const fullPath = path.join(dir, f);
          const stat = fs.statSync(fullPath);
          return {
            filename: f,
            date: f.replace('auto-backup-', '').replace('.db', ''),
            sizeKb: Math.round(stat.size / 1024),
          };
        });
    } catch { return []; }
  });

  ipcMain.handle('backup:openFolder', () => {
    const dir = AUTO_BACKUP_DIR();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
  });

  ipcMain.handle('backup:restoreAuto', async (_event, filename: string) => {
    const dir = AUTO_BACKUP_DIR();
    const srcPath = path.join(dir, filename);
    if (!fs.existsSync(srcPath)) return { success: false, error: 'Backup file not found.' };
    try {
      closeDatabase();
      fs.copyFileSync(srcPath, getCurrentDbPath());
      app.relaunch();
      app.quit();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  });

  // ========== SHARED DATABASE / SETTINGS ==========
  ipcMain.handle('settings:getDbPath', () => getCurrentDbPath());

  ipcMain.handle('settings:changeDbPath', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win!, {
      title: 'Select Folder for Shared Database',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return { success: false };

    const newPath = path.join(result.filePaths[0], 'budget-calculator.db');
    try {
      db.pragma('wal_checkpoint(FULL)');
      fs.copyFileSync(getCurrentDbPath(), newPath);
      // Read-then-patch so existing settings (PIN, company, currency) are preserved
      let s: any = {};
      try { s = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8')); } catch { /* new file */ }
      s.dbPath = newPath;
      fs.writeFileSync(getSettingsPath(), JSON.stringify(s, null, 2));
      return { success: true, newPath };
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('settings:resetDbPath', () => {
    try {
      // Only remove the dbPath key — never delete the whole file,
      // as that would wipe the PIN hash, company name, onboarding flag, etc.
      let s: any = {};
      try { s = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8')); } catch { /* new file */ }
      delete s.dbPath;
      fs.writeFileSync(getSettingsPath(), JSON.stringify(s, null, 2));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  });

  // ========== EXPENSE ATTACHMENTS ==========
  ipcMain.handle('expense:attachPhoto', async (event, expenseId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win!, {
      title: 'Attach Bill / Photo',
      properties: ['openFile'],
      filters: [{ name: 'Images & PDFs', extensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'] }],
    });
    if (result.canceled || !result.filePaths[0]) return { success: false };

    const srcPath = result.filePaths[0];
    const attachDir = path.join(app.getPath('userData'), 'attachments');
    if (!fs.existsSync(attachDir)) fs.mkdirSync(attachDir, { recursive: true });

    const ext = path.extname(srcPath);
    const destPath = path.join(attachDir, `${expenseId}${ext}`);
    fs.copyFileSync(srcPath, destPath);

    db.prepare('UPDATE expenses SET attachment_path = ? WHERE id = ?').run(destPath, expenseId);
    return { success: true, filePath: destPath };
  });

  ipcMain.handle('expense:openAttachment', async (_event, filePath: string) => {
    const err = await shell.openPath(filePath);
    return err ? { success: false, error: err } : { success: true };
  });

  ipcMain.handle('expense:removeAttachment', (_event, expenseId: string) => {
    const row = db.prepare('SELECT attachment_path FROM expenses WHERE id = ?').get(expenseId) as any;
    if (row?.attachment_path) {
      try { fs.unlinkSync(row.attachment_path); } catch { /* file already gone */ }
    }
    db.prepare('UPDATE expenses SET attachment_path = NULL WHERE id = ?').run(expenseId);
    return { success: true };
  });

  // ========== VENDOR DIRECTORY ==========
  ipcMain.handle('vendor:getAll', () => {
    return db.prepare('SELECT * FROM vendors ORDER BY name ASC').all();
  });

  ipcMain.handle('vendor:create', (_event, vendor: any) => {
    db.prepare(`
      INSERT INTO vendors (id, name, category, contact_person, phone, email, gstin, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      vendor.id, vendor.name, vendor.category || 'vendor',
      vendor.contact_person || null, vendor.phone || null,
      vendor.email || null, vendor.gstin || null, vendor.notes || null
    );
    return { success: true };
  });

  ipcMain.handle('vendor:update', (_event, id: string, data: any) => {
    const { fields, values } = buildUpdate(data, VENDOR_COLS);
    db.prepare(`UPDATE vendors SET ${fields} WHERE id = ?`).run(...values, id);
    return { success: true };
  });

  ipcMain.handle('vendor:delete', (_event, id: string) => {
    db.prepare('DELETE FROM vendors WHERE id = ?').run(id);
    return { success: true };
  });

  ipcMain.handle('db:getVendorSettlement', (_event, projectId: string, vendorName: string) => {
    return db.prepare('SELECT * FROM vendor_settlements WHERE project_id = ? AND vendor_name = ?').get(projectId, vendorName);
  });

  ipcMain.handle('db:saveVendorSettlement', (_event, s: any) => {
    db.prepare(`
      INSERT OR REPLACE INTO vendor_settlements (id, project_id, vendor_name, work_description, quantity, unit, rate, settled_amount, use_settlement)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s.id, s.project_id, s.vendor_name, s.work_description || null, s.quantity ?? null, s.unit || null, s.rate ?? null, s.settled_amount ?? null, s.use_settlement ?? 0);
    return { success: true };
  });

  // ========== CROSS-PROJECT REPORTS ==========
  ipcMain.handle('db:getPendingPayments', () => {
    return db.prepare(`
      SELECT e.id, e.project_id, p.name AS project_name,
             e.vendor_name, e.description, e.category,
             e.expense_date, e.amount, e.pending_payment
      FROM expenses e
      JOIN projects p ON p.id = e.project_id
      WHERE e.pending_payment > 0
      ORDER BY e.expense_date ASC
    `).all();
  });

  ipcMain.handle('db:getGSTReport', (_event, dateFrom?: string, dateTo?: string, projectId?: string) => {
    const BASE = `
      SELECT e.id, e.project_id, p.name AS project_name,
             p.plot_no AS project_plot_no, p.location AS project_location,
             e.vendor_name, e.description, e.invoice_no, e.cheque_no,
             e.expense_date, e.amount, e.gst_rate, e.gst_amount,
             (e.amount - e.gst_amount - e.round_off_amount) AS taxable_amount
      FROM expenses e
      JOIN projects p ON p.id = e.project_id
      WHERE e.has_gst = 1`;

    if (dateFrom && dateTo && projectId) {
      return db.prepare(`${BASE} AND e.expense_date >= ? AND e.expense_date <= ? AND e.project_id = ? ORDER BY e.expense_date ASC`).all(dateFrom, dateTo, projectId);
    }
    if (dateFrom && dateTo) {
      return db.prepare(`${BASE} AND e.expense_date >= ? AND e.expense_date <= ? ORDER BY e.expense_date ASC`).all(dateFrom, dateTo);
    }
    if (projectId) {
      return db.prepare(`${BASE} AND e.project_id = ? ORDER BY e.expense_date ASC`).all(projectId);
    }
    return db.prepare(`${BASE} ORDER BY e.expense_date ASC`).all();
  });

  ipcMain.handle('db:getDashboardStats', (_event, dateFrom?: string, dateTo?: string) => {
    const totalProjects = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as any).c;

    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    const monthStr = thisMonthStart.toISOString().split('T')[0];
    const totalExpensesThisMonth = (db.prepare(
      `SELECT COALESCE(SUM(amount),0) as t FROM expenses WHERE expense_date >= ?`
    ).get(monthStr) as any).t;

    const totalPending = (db.prepare(
      `SELECT COALESCE(SUM(pending_payment),0) as t FROM expenses`
    ).get() as any).t;

    const dateFilter = dateFrom && dateTo ? `AND e.expense_date >= '${dateFrom}' AND e.expense_date <= '${dateTo}'` : '';

    const projectStats = db.prepare(`
      SELECT p.id, p.name, p.client,
             COALESCE(SUM(e.amount), 0)          AS totalExpenses,
             COALESCE(SUM(e.pending_payment), 0) AS pendingPayments
      FROM projects p
      LEFT JOIN expenses e ON e.project_id = p.id ${dateFilter}
      GROUP BY p.id
      ORDER BY totalExpenses DESC
      LIMIT 10
    `).all();

    const trendFilter = dateFrom && dateTo
      ? `WHERE expense_date >= '${dateFrom}' AND expense_date <= '${dateTo}'`
      : '';
    const monthlyTrend = db.prepare(`
      SELECT strftime('%Y-%m', expense_date) AS month,
             SUM(amount) AS amount
      FROM expenses
      ${trendFilter}
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `).all().reverse();

    const categoryBreakdown = db.prepare(`
      SELECT category, SUM(amount) AS amount
      FROM expenses
      ${trendFilter}
      GROUP BY category
    `).all();

    return { totalProjects, totalExpensesThisMonth, totalPending, projectStats, monthlyTrend, categoryBreakdown };
  });

  ipcMain.handle('db:globalSearch', (_event, query: string) => {
    if (!query || query.trim().length < 2) return { projects: [], vendors: [], expenses: [] };
    const q = `%${query.trim()}%`;

    const projects = db.prepare(`
      SELECT id, name, client FROM projects
      WHERE name LIKE ? OR client LIKE ? LIMIT 5
    `).all(q, q);

    const vendors = db.prepare(`
      SELECT id, name, category FROM vendors
      WHERE name LIKE ? OR gstin LIKE ? LIMIT 5
    `).all(q, q);

    const expenses = db.prepare(`
      SELECT e.id, e.project_id, p.name AS project_name,
             e.vendor_name, e.description, e.category
      FROM expenses e
      JOIN projects p ON p.id = e.project_id
      WHERE e.vendor_name LIKE ? OR e.description LIKE ?
      LIMIT 5
    `).all(q, q);

    return { projects, vendors, expenses };
  });

  // ========== APP PREFERENCES ==========
  ipcMain.handle('settings:getCurrency', () => {
    try {
      const s = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8'));
      return s.currency || 'INR';
    } catch { return 'INR'; }
  });

  ipcMain.handle('settings:setCurrency', (_event, currency: string) => {
    try {
      let s: any = {};
      try { s = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8')); } catch { /* new file */ }
      s.currency = currency;
      fs.writeFileSync(getSettingsPath(), JSON.stringify(s, null, 2));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  });

  // ========== PIN LOCK ==========
  ipcMain.handle('settings:getPin', () => {
    try {
      const s = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8'));
      return s.pinHash ? true : false;
    } catch { return false; }
  });

  ipcMain.handle('settings:setPin', (_event, pin: string) => {
    const licStatus = getLicenseStatus();
    if (licStatus.valid) {
      const tier = licStatus.plan ?? 'solo';
      if (!PLAN_FEATURES[tier].pinLock) {
        return { success: false, error: `PIN lock requires the Studio plan or higher. Your current plan is ${tier}.` };
      }
    }
    try {
      let s: any = {};
      try { s = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8')); } catch { /* new */ }
      s.pinHash = createHash('sha256').update(pin + 'projex-salt').digest('hex');
      fs.writeFileSync(getSettingsPath(), JSON.stringify(s, null, 2));
      return { success: true };
    } catch (err: any) { return { success: false, error: String(err) }; }
  });

  ipcMain.handle('settings:removePin', () => {
    try {
      let s: any = {};
      try { s = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8')); } catch { /* new */ }
      delete s.pinHash;
      fs.writeFileSync(getSettingsPath(), JSON.stringify(s, null, 2));
      return { success: true };
    } catch (err: any) { return { success: false, error: String(err) }; }
  });

  ipcMain.handle('settings:verifyPin', (_event, pin: string) => {
    try {
      const s = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8'));
      if (!s.pinHash) return true;
      const hash = createHash('sha256').update(pin + 'projex-salt').digest('hex');
      return hash === s.pinHash;
    } catch { return false; }
  });

  // ========== LICENSE ==========
  ipcMain.handle('license:getStatus', () => getLicenseStatus());

  ipcMain.handle('license:activate', (_event, key: string) => activateLicense(key));

  ipcMain.handle('license:deactivate', () => {
    deactivateLicense();
    return { success: true };
  });

  ipcMain.handle('license:getMachineId', () => getMachineId());

  // ========== TALLY / CSV EXPORT ==========
  ipcMain.handle('db:exportTally', async (event, projectId: string, dateFrom?: string, dateTo?: string) => {
    const licStatus = getLicenseStatus();
    if (licStatus.valid) {
      const tier = licStatus.plan ?? 'solo';
      if (!PLAN_FEATURES[tier].tallyExport) {
        return { success: false, error: `Tally CSV export requires the Studio plan or higher. Your current plan is ${tier}.` };
      }
    }

    const win = BrowserWindow.fromWebContents(event.sender);
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
    if (!project) return { success: false, error: 'Project not found' };

    let expenses: any[];
    if (dateFrom && dateTo) {
      expenses = db.prepare(`
        SELECT * FROM expenses WHERE project_id = ? AND expense_date >= ? AND expense_date <= ?
        ORDER BY expense_date, sort_order
      `).all(projectId, dateFrom, dateTo) as any[];
    } else {
      expenses = db.prepare(`
        SELECT * FROM expenses WHERE project_id = ? ORDER BY expense_date, sort_order
      `).all(projectId) as any[];
    }

    // Build Tally-compatible CSV (standard import format)
    const rows: string[] = [
      'Date,Voucher Type,Ledger/Party Name,Dr Amount,Cr Amount,Narration,GST Rate,GST Amount,Cheque No,Category'
    ];
    let voucherNo = 1;
    for (const e of expenses) {
      const date = new Date(e.expense_date + 'T00:00:00').toLocaleDateString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      }).replace(/\//g, '-');
      const party = (e.vendor_name || 'Cash').replace(/"/g, '""');
      const narration = (e.description || '').replace(/"/g, '""');
      const vType = e.cheque_payment > 0 ? 'Bank Payment' : 'Cash Payment';

      // Debit row (expense account)
      rows.push(`${date},${vType},${voucherNo},"${party}",${e.amount},,` +
        `"${narration}",${e.gst_rate || 0},${e.gst_amount || 0},"${e.cheque_no || ''}","${e.category}"`);
      voucherNo++;
    }

    const csv = rows.join('\r\n');
    const safeProjectName = project.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const defaultPath = `${safeProjectName}_Tally_${new Date().toISOString().split('T')[0]}.csv`;

    const result = await dialog.showSaveDialog(win!, {
      title: 'Export Tally CSV',
      defaultPath,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    });
    if (result.canceled || !result.filePath) return { success: false };
    fs.writeFileSync(result.filePath, '﻿' + csv, 'utf8'); // BOM for Excel compatibility
    return { success: true };
  });

  // ========== COMPANY NAME & ONBOARDING ==========
  ipcMain.handle('settings:getCompanyName', () => {
    try {
      const s = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8'));
      return s.companyName || '';
    } catch { return ''; }
  });

  ipcMain.handle('settings:setCompanyName', (_event, name: string) => {
    try {
      let s: any = {};
      try { s = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8')); } catch { /* new */ }
      s.companyName = name;
      fs.writeFileSync(getSettingsPath(), JSON.stringify(s, null, 2));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('settings:getOnboardingComplete', () => {
    try {
      const s = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8'));
      return !!s.onboardingComplete;
    } catch { return false; }
  });

  ipcMain.handle('settings:setOnboardingComplete', () => {
    try {
      let s: any = {};
      try { s = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8')); } catch { /* new */ }
      s.onboardingComplete = true;
      fs.writeFileSync(getSettingsPath(), JSON.stringify(s, null, 2));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  });

  // ========== PDF EXPORT ==========
  ipcMain.handle('window:printToPDF', async (event, defaultFileName: string, subPath?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false };

    // Construct a structured default path if subPath is provided
    let defaultPath = defaultFileName;
    if (subPath) {
      try {
        const dbDir = path.dirname(getCurrentDbPath());
        // Structure: DatabasePath/Arch PEM Exports/Client_Location/Category
        const exportDir = path.join(dbDir, 'Arch PEM Exports', subPath);
        if (!fs.existsSync(exportDir)) {
          fs.mkdirSync(exportDir, { recursive: true });
        }
        defaultPath = path.join(exportDir, defaultFileName);
      } catch (err) {
        console.error('Failed to create export directory:', err);
      }
    }

    const result = await dialog.showSaveDialog(win, {
      title: 'Save as PDF',
      defaultPath: defaultPath || `ledger-${new Date().toISOString().split('T')[0]}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (result.canceled || !result.filePath) return { success: false };

    try {
      // Ensure the directory exists (in case user changed it in the dialog but picked a non-existent one)
      const dir = path.dirname(result.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const data = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        landscape: true,
      });
      fs.writeFileSync(result.filePath, data);
      return { success: true, filePath: result.filePath };
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('window:saveFile', async (event, content: any, defaultFileName: string, subPath?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false };

    let defaultPath = defaultFileName;
    if (subPath) {
      try {
        const dbDir = path.dirname(getCurrentDbPath());
        const exportDir = path.join(dbDir, 'Arch PEM Exports', subPath);
        if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
        defaultPath = path.join(exportDir, defaultFileName);
      } catch (err) {
        console.error('Failed to create export directory:', err);
      }
    }

    const result = await dialog.showSaveDialog(win, {
      title: 'Save File',
      defaultPath,
    });

    if (result.canceled || !result.filePath) return { success: false };

    try {
      const dir = path.dirname(result.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
      fs.writeFileSync(result.filePath, buffer);
      return { success: true, filePath: result.filePath };
    } catch (err: any) {
      return { success: false, error: String(err) };
    }
  });

  // ========== WINDOW CONTROLS ==========
  ipcMain.handle('window:minimize', () => { mainWindow?.minimize(); });
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle('window:close', () => { mainWindow?.close(); });
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

  // ========== RECENT ACTIVITY ==========
  ipcMain.handle('activity:log', (_event, entry: {
    type: string; project_id: string; project_name: string;
    client_name?: string; sub_label?: string; route: string;
  }) => {
    const d = getDatabase();
    d.prepare(`
      INSERT INTO recent_activity (id, type, project_id, project_name, client_name, sub_label, route, accessed_at)
      VALUES (lower(hex(randomblob(8))), ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(type, project_id) DO UPDATE SET
        project_name = excluded.project_name,
        client_name  = excluded.client_name,
        sub_label    = excluded.sub_label,
        route        = excluded.route,
        accessed_at  = datetime('now')
    `).run(entry.type, entry.project_id, entry.project_name, entry.client_name ?? '', entry.sub_label ?? '', entry.route);
    // Cap at 20 most-recent entries
    d.prepare(`
      DELETE FROM recent_activity WHERE id NOT IN (
        SELECT id FROM recent_activity ORDER BY accessed_at DESC LIMIT 20
      )
    `).run();
    return { success: true };
  });

  ipcMain.handle('activity:getRecent', (_event, limit: number = 10) =>
    getDatabase()
      .prepare('SELECT * FROM recent_activity ORDER BY accessed_at DESC LIMIT ?')
      .all(limit)
  );

  ipcMain.handle('activity:clear', () => {
    getDatabase().prepare('DELETE FROM recent_activity').run();
    return { success: true };
  });

  // ========== APP INFO ==========
  ipcMain.handle('app:getVersion', () => app.getVersion());

  // ========== AUTO UPDATER ==========
  ipcMain.handle('updater:checkForUpdates', async () => {
    if (app.isPackaged) await autoUpdater.checkForUpdates().catch(() => {});
  });

  ipcMain.handle('updater:installUpdate', () => {
    autoUpdater.quitAndInstall(false, true);
  });
}

// ── Manpower PDF text parser ───────────────────────────────────────
function parseManpowerPdf(rawText: string) {
  // pdf2json getRawTextContent() encodes spaces as %20 in some fields
  const decoded = rawText.replace(/%20/g, ' ').replace(/%2C/g, ',');

  // Split into lines, strip page-break markers, trim and drop blanks
  const lines = decoded
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('---'));

  // Single-space collapsed version for regex strategies
  const t = lines.join(' ');

  // ── helpers ──────────────────────────────────────────────────────
  // Find the first integer that appears right after `label` in the collapsed text.
  // Also falls back to reading the very next line after a line matching `label`.
  const numAfterLabel = (label: string): number => {
    const re = new RegExp(label.replace(/\s+/g, '\\s+') + '\\D{0,10}?(\\d+)', 'i');
    const m = t.match(re);
    if (m) return parseInt(m[1], 10) || 0;
    const idx = lines.findIndex((l) => l.replace(/\s+/g, ' ').toUpperCase() === label.toUpperCase());
    if (idx !== -1) {
      // next line that is purely numeric
      for (let i = idx + 1; i < Math.min(idx + 4, lines.length); i++) {
        const n = parseInt(lines[i], 10);
        if (!isNaN(n) && lines[i].trim().match(/^\d+$/)) return n;
      }
    }
    return 0;
  };

  // Return the value on the same line after label, or on the next line.
  const strAfterLabel = (label: string): string => {
    const re = new RegExp(label + '[:\\s]+(.+)', 'i');
    for (const line of lines) {
      const m = line.match(re);
      if (m) return m[1].trim();
    }
    const idx = lines.findIndex((l) => l.toUpperCase().startsWith(label.toUpperCase()));
    if (idx !== -1) {
      const rest = lines[idx].replace(new RegExp('^' + label, 'i'), '').trim();
      if (rest) return rest;
      return lines[idx + 1] ?? '';
    }
    return '';
  };

  // ── extract fields ────────────────────────────────────────────────
  const mason      = numAfterLabel('MASON');
  const coolie     = numAfterLabel('COOLIE');
  const helper     = numAfterLabel('HELPER');
  // "OTHER" must not accidentally match "GRAND TOTAL" — search before that
  const otherIdx   = t.toUpperCase().indexOf('OTHER');
  const otherSnip  = otherIdx >= 0 ? t.slice(otherIdx, otherIdx + 20) : '';
  const other      = parseInt(otherSnip.match(/OTHER\D{0,5}(\d+)/i)?.[1] ?? '0', 10) || 0;
  const grandTotal = numAfterLabel('GRAND TOTAL');
  const entries    = numAfterLabel('ENTRIES');

  const periodRaw  = strAfterLabel('PERIOD');
  const period     = periodRaw.match(/([A-Za-z]+ \d{4})/)?.[1] ?? periodRaw.trim();

  const projectRaw = strAfterLabel('PROJECT');
  // Strip "All Projects" placeholder — keep the real project name if present
  const project    = projectRaw.replace(/^All Projects$/i, '').trim() || projectRaw.trim();

  const supervisorRaw = strAfterLabel('SUPERVISOR');
  const supervisor    = supervisorRaw.replace(/^All Supervisors$/i, '').trim() || supervisorRaw.trim();

  const refMatch      = t.match(/Ref[:\s]+([A-Z0-9/]+)/i);
  const refNo         = refMatch ? refMatch[1] : '';

  const genMatch      = t.match(/Generated[:\s]+(\d{1,2}\s+\w+\s+\d{4}|\d{1,2}\s+\w+,?\s+\d{4})/i);
  const generatedDate = genMatch ? genMatch[1] : '';

  return { period, project, supervisor, mason, coolie, helper, other, grandTotal, entries, refNo, generatedDate };
}
