export type ProjectStatus = 'Active' | 'On Hold' | 'Completed' | 'Archived';

export type PlanTier = 'solo' | 'studio' | 'enterprise';

export interface PlanFeatures {
  tallyExport:     boolean;
  gstReport:       boolean;
  pendingPayments: boolean;
  pinLock:         boolean;
  customBranding:  boolean;
  dbSharing:       boolean;
  machineTransfer: boolean;
}

export const PLAN_DISPLAY_NAMES: Record<PlanTier, string> = {
  solo:       'Solo',
  studio:     'Studio',
  enterprise: 'Enterprise',
};

export const PLAN_COLORS: Record<PlanTier, { badge: string; text: string }> = {
  solo:       { badge: 'bg-slate-100',   text: 'text-slate-600'   },
  studio:     { badge: 'bg-indigo-100',  text: 'text-indigo-700'  },
  enterprise: { badge: 'bg-violet-100',  text: 'text-violet-700'  },
};

export interface Project {
  id: string;
  name: string;
  client: string;
  plot_no: string | null;
  location: string | null;
  area_sqft: number;
  description: string | null;
  gst_rate: number;
  contingency_rate: number;
  status: ProjectStatus;
  tags: string; // JSON-encoded string[]
  created_at: string;
  updated_at: string;
  total_amount?: number;
}

export interface Category {
  id: string;
  project_id: string;
  name: string;
  color: string;
  sort_order: number;
  subtotal: number;
  items: LineItem[];
}

export interface LineItem {
  id: string;
  category_id: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  notes: string | null;
  sort_order: number;
}

export interface Template {
  id: string;
  name: string;
  description: string | null;
  data: string;
  created_at: string;
}

export interface BudgetSummaryData {
  subtotal: number;
  contingency: number;
  beforeTax: number;
  gst: number;
  grandTotal: number;
  ratePerSqFt: number;
}

export interface Expense {
  id: string;
  project_id: string;
  expense_date: string;
  category: 'labour' | 'site' | 'contractor' | 'vendor';
  vendor_name: string | null;
  description: string | null;
  quantity: number | null;
  rate_unit: number | null;
  amount: number;
  advance_amt: number;
  cash_payment: number;
  cheque_payment: number;
  pending_payment: number;
  cheque_no: string | null;
  payment_date: string | null;
  remarks: string | null;

  // Specific for Labour
  mason_count?: number;
  mason_rate?: number;
  coolie_count?: number;
  coolie_rate?: number;
  helper_count?: number;
  helper_rate?: number;
  other_count?: number;
  other_rate?: number;

  unit?: string | null;
  has_gst?: number;
  gst_rate?: number;
  gst_amount?: number;
  round_off?: number;   // 1 = rounded, 0 = not
  round_off_amount?: number;
  attachment_path?: string | null;
  invoice_no?: string | null;

  sort_order: number;
  created_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: 'vendor' | 'contractor' | 'labour' | 'site';
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  notes: string | null;
  created_at: string;
}

export interface VendorSettlement {
  id: string;
  project_id: string;
  vendor_name: string;
  work_description: string | null;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  settled_amount: number | null;
  use_settlement: number; // 0 or 1
  created_at: string;
}

export interface PendingPayment {
  id: string;
  project_id: string;
  project_name: string;
  vendor_name: string | null;
  description: string | null;
  category: string;
  expense_date: string;
  amount: number;
  pending_payment: number;
}

export interface GSTReportEntry {
  id: string;
  project_id: string;
  project_name: string;
  project_plot_no: string | null;
  project_location: string | null;
  vendor_name: string | null;
  description: string | null;
  invoice_no: string | null;
  cheque_no: string | null;
  expense_date: string;
  amount: number;
  gst_rate: number;
  gst_amount: number;
  taxable_amount: number;
}

export interface DashboardStats {
  totalProjects: number;
  totalExpensesThisMonth: number;
  totalPending: number;
  projectStats: Array<{
    id: string;
    name: string;
    client: string;
    totalExpenses: number;
    pendingPayments: number;
  }>;
  monthlyTrend: Array<{ month: string; amount: number }>;
  categoryBreakdown: Array<{ category: string; amount: number }>;
}

export interface SearchResults {
  projects: Array<{ id: string; name: string; client: string }>;
  vendors:  Array<{ id: string; name: string; category: string }>;
  expenses: Array<{ id: string; project_id: string; project_name: string; vendor_name: string | null; description: string | null; category: string }>;
}

export interface ManpowerReport {
  period: string;
  project: string;
  supervisor: string;
  mason: number;
  coolie: number;
  helper: number;
  other: number;
  grandTotal: number;
  entries: number;
  refNo: string;
  generatedDate: string;
  error?: string;
}

export interface ElectronAPI {
  platform: string;
  getProjects: () => Promise<Project[]>;
  getProject: (id: string) => Promise<Project>;
  createProject: (project: Partial<Project>) => Promise<{ success: boolean }>;
  updateProject: (id: string, data: Partial<Project>) => Promise<{ success: boolean }>;
  deleteProject: (id: string) => Promise<{ success: boolean }>;
  duplicateProject: (sourceId: string, newId: string, newName: string) => Promise<{ success: boolean }>;

  getCategories: (projectId: string) => Promise<Category[]>;
  createCategory: (category: Partial<Category>) => Promise<{ success: boolean }>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<{ success: boolean }>;
  deleteCategory: (id: string) => Promise<{ success: boolean }>;

  createLineItem: (item: Partial<LineItem>) => Promise<{ success: boolean }>;
  updateLineItem: (id: string, data: Partial<LineItem>) => Promise<{ success: boolean }>;
  deleteLineItem: (id: string) => Promise<{ success: boolean }>;

  getTemplates: () => Promise<Template[]>;
  createTemplate: (template: Partial<Template>) => Promise<{ success: boolean }>;
  deleteTemplate: (id: string) => Promise<{ success: boolean }>;
  applyTemplate: (projectId: string, templateData: string) => Promise<{ success: boolean }>;

  openAndParseManpower: () => Promise<ManpowerReport | null>;

  getExpenses: (projectId: string, dateFrom?: string, dateTo?: string) => Promise<Expense[]>;
  getExpensesByVendor: (projectId: string, vendorName: string, dateFrom?: string, dateTo?: string) => Promise<Expense[]>;
  getExpensesByCategory: (projectId: string, category: string, dateFrom?: string, dateTo?: string) => Promise<Expense[]>;
  seedDemoProject: () => Promise<string>;
  createExpense: (expense: Partial<Expense>) => Promise<{ success: boolean }>;
  updateExpense: (id: string, data: Partial<Expense>) => Promise<{ success: boolean }>;
  deleteExpense: (id: string) => Promise<{ success: boolean }>;
  bulkDeleteExpenses: (ids: string[]) => Promise<{ success: boolean }>;
  bulkMarkPaid: (ids: string[]) => Promise<{ success: boolean }>;
  deleteExpensesByVendor: (projectId: string, vendorName: string) => Promise<{ success: boolean }>;

  exportData: () => Promise<string>;
  importData: (jsonData: string) => Promise<{ success: boolean }>;

  backupDbFile: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
  restoreDbFile: () => Promise<{ success: boolean; error?: string }>;

  getDbPath: () => Promise<string>;
  changeDbPath: () => Promise<{ success: boolean; newPath?: string; error?: string }>;
  resetDbPath: () => Promise<{ success: boolean; error?: string }>;

  attachPhoto: (expenseId: string) => Promise<{ success: boolean; filePath?: string }>;
  openAttachment: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  removeAttachment: (expenseId: string) => Promise<{ success: boolean }>;

  getLicenseStatus: () => Promise<LicenseStatus>;
  activateLicense: (key: string) => Promise<{ success: boolean; client?: string; error?: string }>;
  deactivateLicense: () => Promise<{ success: boolean }>;
  getMachineId: () => Promise<string>;

  // Vendor directory
  getVendors: () => Promise<Vendor[]>;
  createVendor: (vendor: Partial<Vendor>) => Promise<{ success: boolean }>;
  updateVendor: (id: string, data: Partial<Vendor>) => Promise<{ success: boolean }>;
  deleteVendor: (id: string) => Promise<{ success: boolean }>;
  getVendorSettlement: (projectId: string, vendorName: string) => Promise<VendorSettlement | null>;
  saveVendorSettlement: (settlement: Partial<VendorSettlement>) => Promise<{ success: boolean }>;

  // Cross-project reports
  getPendingPayments: () => Promise<PendingPayment[]>;
  getGSTReport: (dateFrom?: string, dateTo?: string, projectId?: string) => Promise<GSTReportEntry[]>;
  getDashboardStats: (dateFrom?: string, dateTo?: string) => Promise<DashboardStats>;
  globalSearch: (query: string) => Promise<SearchResults>;

  // PIN lock
  getPinEnabled: () => Promise<boolean>;
  setPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  removePin: () => Promise<{ success: boolean; error?: string }>;
  verifyPin: (pin: string) => Promise<boolean>;

  // App preferences
  getCurrency: () => Promise<string>;
  setCurrency: (currency: string) => Promise<{ success: boolean }>;
  getCompanyName: () => Promise<string>;
  setCompanyName: (name: string) => Promise<{ success: boolean }>;
  getOnboardingComplete: () => Promise<boolean>;
  setOnboardingComplete: () => Promise<{ success: boolean }>;

  // Tally / CSV export
  exportTally: (projectId: string, dateFrom?: string, dateTo?: string) => Promise<{ success: boolean; error?: string }>;

  // PDF export
  printToPDF: (defaultFileName?: string, subPath?: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  saveFile: (content: string | Uint8Array, defaultFileName: string, subPath?: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;

  // Auto backups
  listAutoBackups: () => Promise<Array<{ filename: string; date: string; sizeKb: number }>>;
  openAutoBackupFolder: () => Promise<void>;
  restoreAutoBackup: (filename: string) => Promise<{ success: boolean; error?: string }>;

  // Window controls (custom title bar on Windows)
  minimizeWindow?: () => Promise<void>;
  maximizeWindow?: () => Promise<void>;
  closeWindow?: () => Promise<void>;
  isMaximized?: () => Promise<boolean>;

  // App info
  getAppVersion: () => Promise<string>;

  // Auto-updater
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
  onUpdaterStatus: (cb: (status: UpdaterStatus) => void) => () => void;
}

export interface LicenseStatus {
  valid: boolean;
  trial?: boolean;
  trialDaysLeft?: number;
  client?: string;
  email?: string;
  seats?: number;
  expiry?: string;
  daysLeft?: number;
  inGracePeriod?: boolean;
  showWarning?: boolean;
  machineId?: string;
  error?: string;
  // Plan tier — populated for valid licenses; legacy keys without plan default to 'solo'
  plan?:        PlanTier;
  maxProjects?: number;
  maxSeats?:    number;
  features?:    PlanFeatures;
}

export type UpdaterStatus =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available' }
  | { type: 'downloading'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string };

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
