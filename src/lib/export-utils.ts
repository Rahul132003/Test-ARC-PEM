import { Project } from '@/types';

/**
 * Sanitizes a string for use in a filename or path.
 */
export function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9\s_-]/g, '').replace(/\s+/g, '_');
}

/**
 * Generates a structured filename and subfolder path for exports.
 * Format: LedgerType_Client_Month-Year.ext
 */
export function getExportMetadata(
  ledgerType: string,
  project: Project | null,
  dateFrom: string,
  dateTo: string,
  category?: string
) {
  const type = sanitize(ledgerType);
  const client = sanitize(project?.client || 'Client');
  const plotNo = sanitize(project?.plot_no || 'Plot');
  const location = sanitize(project?.location || 'Location');
  const categoryFolder = sanitize(category || 'General');
  
  // Format dates for the filename (e.g., Jan-2024 or Jan-Jun-2024)
  const dFrom = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
  const dTo = dateTo ? new Date(dateTo + 'T00:00:00') : null;
  
  let periodStr = '';
  if (dFrom && dTo && !isNaN(dFrom.getTime()) && !isNaN(dTo.getTime())) {
    const monthFrom = dFrom.toLocaleString('en-IN', { month: 'short' });
    const yearFrom = dFrom.getFullYear();
    const monthTo = dTo.toLocaleString('en-IN', { month: 'short' });
    const yearTo = dTo.getFullYear();
    
    if (monthFrom === monthTo && yearFrom === yearTo) {
      periodStr = `${monthFrom}_${yearFrom}`;
    } else if (yearFrom === yearTo) {
      periodStr = `${monthFrom}_to_${monthTo}_${yearFrom}`;
    } else {
      periodStr = `${monthFrom}_${yearFrom}_to_${monthTo}_${yearTo}`;
    }
  } else {
    periodStr = new Date().toISOString().split('T')[0];
  }

  // Requested format: "labour ledger _client_plot: plot no._month/date.pdf"
  // Filename: Type_Client_Plot_PlotNo_Period
  const filename = `${type}_${client}_Plot_${plotNo}_${periodStr}`;
  
  // SubPath: [Client]_[Location]/[Category]
  const subPath = `${client}_${location}/${categoryFolder}`;
  
  return { filename, subPath };
}
