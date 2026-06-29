/**
 * Context-bridge between the Electron main process and the React renderer.
 *
 * All IPC calls are funnelled through window.electronAPI so the renderer
 * never has direct access to Node.js APIs (contextIsolation = true).
 * The full type definition lives in src/types/index.ts (ElectronAPI interface).
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // ── Projects ────────────────────────────────────────────────────────────────
  getProjects:      ()                                       => ipcRenderer.invoke('db:getProjects'),
  getProject:       (id: string)                             => ipcRenderer.invoke('db:getProject', id),
  createProject:    (project: any)                           => ipcRenderer.invoke('db:createProject', project),
  updateProject:    (id: string, data: any)                  => ipcRenderer.invoke('db:updateProject', id, data),
  deleteProject:    (id: string)                             => ipcRenderer.invoke('db:deleteProject', id),
  duplicateProject: (sourceId: string, newId: string, newName: string) =>
    ipcRenderer.invoke('db:duplicateProject', sourceId, newId, newName),

  // ── Budget (Categories & Line Items) ────────────────────────────────────────
  getCategories:  (projectId: string)          => ipcRenderer.invoke('db:getCategories', projectId),
  createCategory: (category: any)              => ipcRenderer.invoke('db:createCategory', category),
  updateCategory: (id: string, data: any)      => ipcRenderer.invoke('db:updateCategory', id, data),
  deleteCategory: (id: string)                 => ipcRenderer.invoke('db:deleteCategory', id),

  createLineItem: (item: any)             => ipcRenderer.invoke('db:createLineItem', item),
  updateLineItem: (id: string, data: any) => ipcRenderer.invoke('db:updateLineItem', id, data),
  deleteLineItem: (id: string)            => ipcRenderer.invoke('db:deleteLineItem', id),

  // ── Templates ───────────────────────────────────────────────────────────────
  getTemplates:    ()                                            => ipcRenderer.invoke('db:getTemplates'),
  createTemplate:  (template: any)                               => ipcRenderer.invoke('db:createTemplate', template),
  deleteTemplate:  (id: string)                                  => ipcRenderer.invoke('db:deleteTemplate', id),
  applyTemplate:   (projectId: string, templateData: string)     =>
    ipcRenderer.invoke('db:applyTemplate', projectId, templateData),

  // ── Expenses ────────────────────────────────────────────────────────────────
  getExpenses:           (projectId: string, dateFrom?: string, dateTo?: string) =>
    ipcRenderer.invoke('db:getExpenses', projectId, dateFrom, dateTo),
  getExpensesByVendor:   (projectId: string, vendorName: string, dateFrom?: string, dateTo?: string) =>
    ipcRenderer.invoke('db:getExpensesByVendor', projectId, vendorName, dateFrom, dateTo),
  getExpensesByCategory: (projectId: string, category: string, dateFrom?: string, dateTo?: string) =>
    ipcRenderer.invoke('db:getExpensesByCategory', projectId, category, dateFrom, dateTo),
  seedDemoProject: ()                      => ipcRenderer.invoke('seed-demo-project'),
  createExpense:   (expense: any)          => ipcRenderer.invoke('db:createExpense', expense),
  updateExpense:   (id: string, data: any) => ipcRenderer.invoke('db:updateExpense', id, data),
  deleteExpense:   (id: string)            => ipcRenderer.invoke('db:deleteExpense', id),
  bulkDeleteExpenses: (ids: string[])      => ipcRenderer.invoke('db:bulkDeleteExpenses', ids),
  bulkMarkPaid:    (ids: string[])         => ipcRenderer.invoke('db:bulkMarkPaid', ids),
  deleteExpensesByVendor: (projectId: string, vendorName: string) => ipcRenderer.invoke('db:deleteExpensesByVendor', projectId, vendorName),

  // ── Manpower PDF Import ──────────────────────────────────────────────────────
  openAndParseManpower: () => ipcRenderer.invoke('pdf:openAndParseManpower'),

  // ── JSON Backup / Restore ────────────────────────────────────────────────────
  exportData:  ()                    => ipcRenderer.invoke('db:exportData'),
  importData:  (jsonData: string)    => ipcRenderer.invoke('db:importData', jsonData),

  // ── SQLite File Backup / Restore ─────────────────────────────────────────────
  backupDbFile:  () => ipcRenderer.invoke('db:backupDbFile'),
  restoreDbFile: () => ipcRenderer.invoke('db:restoreDbFile'),

  // ── Shared Database Path ─────────────────────────────────────────────────────
  getDbPath:    () => ipcRenderer.invoke('settings:getDbPath'),
  changeDbPath: () => ipcRenderer.invoke('settings:changeDbPath'),
  resetDbPath:  () => ipcRenderer.invoke('settings:resetDbPath'),

  // ── Expense Attachments ──────────────────────────────────────────────────────
  attachPhoto:      (expenseId: string) => ipcRenderer.invoke('expense:attachPhoto', expenseId),
  openAttachment:   (filePath: string)  => ipcRenderer.invoke('expense:openAttachment', filePath),
  removeAttachment: (expenseId: string) => ipcRenderer.invoke('expense:removeAttachment', expenseId),

  // ── License ──────────────────────────────────────────────────────────────────
  getLicenseStatus:  ()              => ipcRenderer.invoke('license:getStatus'),
  activateLicense:   (key: string)   => ipcRenderer.invoke('license:activate', key),
  deactivateLicense: ()              => ipcRenderer.invoke('license:deactivate'),
  getMachineId:      ()              => ipcRenderer.invoke('license:getMachineId'),

  // ── Vendor Directory ─────────────────────────────────────────────────────────
  getVendors:    ()                          => ipcRenderer.invoke('vendor:getAll'),
  createVendor:  (vendor: any)               => ipcRenderer.invoke('vendor:create', vendor),
  updateVendor:  (id: string, data: any)     => ipcRenderer.invoke('vendor:update', id, data),
  deleteVendor:  (id: string)                => ipcRenderer.invoke('vendor:delete', id),
  getVendorSettlement: (projectId: string, vendorName: string) => ipcRenderer.invoke('db:getVendorSettlement', projectId, vendorName),
  saveVendorSettlement: (settlement: any)                     => ipcRenderer.invoke('db:saveVendorSettlement', settlement),

  // ── Cross-project reports ────────────────────────────────────────────────────
  getPendingPayments: ()                                               => ipcRenderer.invoke('db:getPendingPayments'),
  getGSTReport:       (dateFrom?: string, dateTo?: string, projectId?: string) => ipcRenderer.invoke('db:getGSTReport', dateFrom, dateTo, projectId),
  getDashboardStats:  (dateFrom?: string, dateTo?: string)             => ipcRenderer.invoke('db:getDashboardStats', dateFrom, dateTo),
  globalSearch:       (query: string)                                  => ipcRenderer.invoke('db:globalSearch', query),

  // ── PIN Lock ─────────────────────────────────────────────────────────────────
  getPinEnabled:  ()              => ipcRenderer.invoke('settings:getPin'),
  setPin:         (pin: string)   => ipcRenderer.invoke('settings:setPin', pin),
  removePin:      ()              => ipcRenderer.invoke('settings:removePin'),
  verifyPin:      (pin: string)   => ipcRenderer.invoke('settings:verifyPin', pin),

  // ── App preferences ──────────────────────────────────────────────────────────
  getCurrency:           ()                  => ipcRenderer.invoke('settings:getCurrency'),
  setCurrency:           (currency: string)  => ipcRenderer.invoke('settings:setCurrency', currency),
  getCompanyName:        ()                  => ipcRenderer.invoke('settings:getCompanyName'),
  setCompanyName:        (name: string)      => ipcRenderer.invoke('settings:setCompanyName', name),
  getOnboardingComplete: ()                  => ipcRenderer.invoke('settings:getOnboardingComplete'),
  setOnboardingComplete: ()                  => ipcRenderer.invoke('settings:setOnboardingComplete'),

  // ── Tally / CSV Export ───────────────────────────────────────────────────────
  exportTally: (projectId: string, dateFrom?: string, dateTo?: string) =>
    ipcRenderer.invoke('db:exportTally', projectId, dateFrom, dateTo),

  // PDF & File Export
  printToPDF: (defaultFileName?: string, subPath?: string) => ipcRenderer.invoke('window:printToPDF', defaultFileName, subPath),
  saveFile: (content: any, defaultFileName: string, subPath?: string) => ipcRenderer.invoke('window:saveFile', content, defaultFileName, subPath),

  // ── Auto Backups ─────────────────────────────────────────────────────────────
  listAutoBackups:      ()                    => ipcRenderer.invoke('backup:listAuto'),
  openAutoBackupFolder: ()                    => ipcRenderer.invoke('backup:openFolder'),
  restoreAutoBackup:    (filename: string)    => ipcRenderer.invoke('backup:restoreAuto', filename),

  // ── Window Controls (Windows/Linux custom title bar) ─────────────────────────
  minimizeWindow:  ()   => ipcRenderer.invoke('window:minimize'),
  maximizeWindow:  ()   => ipcRenderer.invoke('window:maximize'),
  closeWindow:     ()   => ipcRenderer.invoke('window:close'),
  isMaximized:     ()   => ipcRenderer.invoke('window:isMaximized'),

  // ── Recent Activity ──────────────────────────────────────────────────────────
  logActivity:       (entry: any)          => ipcRenderer.invoke('activity:log', entry),
  getRecentActivity: (limit?: number)      => ipcRenderer.invoke('activity:getRecent', limit),
  clearActivity:     ()                    => ipcRenderer.invoke('activity:clear'),

  // ── App Info ─────────────────────────────────────────────────────────────────
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

  // ── Auto Updater ─────────────────────────────────────────────────────────────
  checkForUpdates: ()   => ipcRenderer.invoke('updater:checkForUpdates'),
  installUpdate:   ()   => ipcRenderer.invoke('updater:installUpdate'),
  onUpdaterStatus: (cb: (status: any) => void) => {
    const handler = (_event: any, status: any) => cb(status);
    ipcRenderer.on('updater:status', handler);
    return () => ipcRenderer.removeListener('updater:status', handler);
  },

});
