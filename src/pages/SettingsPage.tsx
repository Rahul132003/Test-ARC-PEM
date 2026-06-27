import { useState, useEffect } from 'react';
import PlanGate from '@/components/PlanGate';
import {
  HiOutlineArrowDownTray,
  HiOutlineArrowUpTray,
  HiOutlineShieldCheck,
  HiOutlineInformationCircle,
  HiOutlineCircleStack,
  HiOutlineArrowPath,
  HiOutlineUsers,
  HiOutlineFolderOpen,
  HiOutlineKey,
  HiOutlineCheckBadge,
  HiOutlineExclamationTriangle,
  HiOutlineMoon,
  HiOutlineCurrencyDollar,
  HiOutlineLockClosed,
  HiOutlineEye,
  HiOutlineEyeSlash,
  HiOutlineXMark,
  HiOutlineCloudArrowDown,
  HiOutlineSparkles,
} from 'react-icons/hi2';
import { LicenseStatus, UpdaterStatus } from '@/types';
import { useApp } from '@/context/AppContext';
import { SUPPORTED_CURRENCIES } from '@/lib/calculations';

export default function SettingsPage({ onLock }: { onLock?: () => void }) {
  const { currency, setCurrency } = useApp();

  const [license, setLicense]           = useState<LicenseStatus | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // PIN state
  const [pinEnabled, setPinEnabled]     = useState(false);
  const [showPinModal, setShowPinModal] = useState<'set' | 'change' | 'remove' | null>(null);
  const [pinCurrent, setPinCurrent]     = useState('');
  const [pinNew, setPinNew]             = useState('');
  const [pinConfirm, setPinConfirm]     = useState('');
  const [pinError, setPinError]         = useState('');
  const [pinSaving, setPinSaving]       = useState(false);
  const [showPinNew, setShowPinNew]     = useState(false);
  const [exporting, setExporting]       = useState(false);
  const [importing, setImporting]       = useState(false);
  const [jsonMsg, setJsonMsg]           = useState('');
  const [backingUp, setBackingUp]       = useState(false);
  const [restoring, setRestoring]       = useState(false);
  const [fileMsg, setFileMsg]           = useState('');
  const [dbPath, setDbPath]             = useState('');
  const [changingPath, setChangingPath] = useState(false);
  const [pathMsg, setPathMsg]           = useState('');

  const [autoBackups, setAutoBackups]         = useState<Array<{ filename: string; date: string; sizeKb: number }>>([]);
  const [restoringAuto, setRestoringAuto]     = useState('');
  const [autoBackupMsg, setAutoBackupMsg]     = useState('');

  // Update checker
  const [appVersion, setAppVersion]           = useState('');
  const [checkingUpdate, setCheckingUpdate]   = useState(false);
  const [updaterStatus, setUpdaterStatus]     = useState<UpdaterStatus | null>(null);

  useEffect(() => {
    window.electronAPI.getLicenseStatus().then(setLicense);
    window.electronAPI.getDbPath().then(setDbPath);
    window.electronAPI.getPinEnabled().then(setPinEnabled);
    window.electronAPI.listAutoBackups().then(setAutoBackups);
    window.electronAPI.getAppVersion().then(setAppVersion);
    const unsub = window.electronAPI.onUpdaterStatus((s) => {
      setUpdaterStatus(s);
      if (s.type !== 'checking' && s.type !== 'downloading') setCheckingUpdate(false);
    });
    return unsub;
  }, []);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdaterStatus(null);
    await window.electronAPI.checkForUpdates();
  };

  const openPinModal = (mode: 'set' | 'change' | 'remove') => {
    setPinCurrent(''); setPinNew(''); setPinConfirm(''); setPinError('');
    setShowPinModal(mode);
  };

  const handlePinSave = async () => {
    setPinError('');
    if (showPinModal === 'remove') {
      if (!/^\d{4,6}$/.test(pinCurrent)) { setPinError('Enter your current PIN.'); return; }
      const ok = await window.electronAPI.verifyPin(pinCurrent);
      if (!ok) { setPinError('Incorrect current PIN.'); return; }
      setPinSaving(true);
      await window.electronAPI.removePin();
      setPinEnabled(false);
      setShowPinModal(null);
      setPinSaving(false);
      return;
    }
    if (showPinModal === 'change') {
      if (!/^\d{4,6}$/.test(pinCurrent)) { setPinError('Enter your current PIN.'); return; }
      const ok = await window.electronAPI.verifyPin(pinCurrent);
      if (!ok) { setPinError('Incorrect current PIN.'); return; }
    }
    if (!/^\d{4,6}$/.test(pinNew)) { setPinError('New PIN must be 4–6 digits.'); return; }
    if (pinNew !== pinConfirm)      { setPinError('PINs do not match.'); return; }
    setPinSaving(true);
    await window.electronAPI.setPin(pinNew);
    setPinEnabled(true);
    setShowPinModal(null);
    setPinSaving(false);
  };

  const handleDeactivate = async () => {
    if (!confirm('Deactivate this machine? You will need to re-import your .lic file to use the app again.')) return;
    setDeactivating(true);
    await window.electronAPI.deactivateLicense();
    window.location.reload();
  };

  // ── JSON backup ────────────────────────────────────────────────
  const handleExportBackup = async () => {
    setExporting(true);
    setJsonMsg('');
    try {
      const data = await window.electronAPI.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `projex-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setJsonMsg('✅ JSON backup exported successfully.');
    } catch {
      setJsonMsg('❌ Failed to export.');
    } finally {
      setExporting(false);
    }
  };

  const handleImportBackup = async () => {
    const input    = document.createElement('input');
    input.type     = 'file';
    input.accept   = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!confirm('Importing will REPLACE all existing data. Are you sure?')) return;
      setImporting(true);
      setJsonMsg('');
      try {
        const text = await file.text();
        await window.electronAPI.importData(text);
        setJsonMsg('✅ Data restored from JSON backup.');
      } catch {
        setJsonMsg('❌ Failed to import. File may be corrupted.');
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  // ── DB file backup / restore ───────────────────────────────────
  const handleBackupFile = async () => {
    setBackingUp(true);
    setFileMsg('');
    const res = await window.electronAPI.backupDbFile();
    setFileMsg(res.success ? '✅ Database file saved.' : `❌ ${res.error ?? 'Backup failed.'}`);
    setBackingUp(false);
  };

  const handleRestoreFile = async () => {
    if (!confirm('This will replace all current data with the selected backup and restart the app. Continue?')) return;
    setRestoring(true);
    setFileMsg('');
    const res = await window.electronAPI.restoreDbFile();
    if (!res.success) {
      setFileMsg(`❌ ${res.error ?? 'Restore failed.'}`);
      setRestoring(false);
    }
  };

  // ── Shared database path ───────────────────────────────────────
  const handleChangePath = async () => {
    setChangingPath(true);
    setPathMsg('');
    const res = await window.electronAPI.changeDbPath();
    if (res.success) {
      setDbPath(res.newPath!);
      setPathMsg('✅ Location saved. Please restart the app to use the new database.');
    } else {
      setPathMsg(res.error ? `❌ ${res.error}` : '');
    }
    setChangingPath(false);
  };

  const handleResetPath = async () => {
    if (!confirm('Reset to default location? Restart required.')) return;
    await window.electronAPI.resetDbPath();
    setPathMsg('✅ Reset to default. Please restart the app.');
    window.electronAPI.getDbPath().then(setDbPath);
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold mb-2" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text-primary)' }}>
          Settings
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage preferences, backups, and application configuration.</p>
      </div>


      {/* ── Currency ────────────────────────────────────────────── */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="icon-sq-emerald">
            <HiOutlineCurrencyDollar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text-primary)' }}>
              Currency
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Default currency for all expense amounts</p>
          </div>
        </div>

        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Display Currency</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Applied to all amounts across the app</p>
          </div>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="input-compact w-48"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── License ─────────────────────────────────────────────── */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="icon-sq-indigo">
            <HiOutlineKey className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text-primary)' }}>
              License
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Your software license details</p>
          </div>
        </div>

        {license?.valid ? (
          <>
            <div className="space-y-3 mb-5">
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Licensed To</span>
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{license.client}</span>
              </div>
              {license.email && (
                <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Email</span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{license.email}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Seats</span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{license.seats} machine{(license.seats ?? 1) > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Valid Until</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {license.expiry && new Date(license.expiry + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                  {license.inGracePeriod ? (
                    <span className="text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded">
                      GRACE PERIOD
                    </span>
                  ) : license.showWarning ? (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded">
                      {license.daysLeft}d left
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                      {license.daysLeft}d left
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-start justify-between py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <span className="text-sm shrink-0 mr-4" style={{ color: 'var(--text-secondary)' }}>Machine ID</span>
                <span className="text-xs font-mono break-all text-right select-all" style={{ color: 'var(--text-muted)' }}>{license.machineId}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Status</span>
                <div className="flex items-center gap-1.5 text-emerald-500">
                  <HiOutlineCheckBadge className="w-4 h-4" />
                  <span className="text-sm font-bold">Active</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleDeactivate}
              disabled={deactivating}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Deactivate this Machine
            </button>
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              Use this when moving to a new computer. Re-import your .lic file on the new machine.
            </p>
          </>
        ) : (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <HiOutlineExclamationTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-400">{license?.error ?? 'No license found.'}</p>
          </div>
        )}
      </div>

      {/* ── JSON Backup ─────────────────────────────────────────── */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="icon-sq-emerald">
            <HiOutlineShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text-primary)' }}>
              JSON Backup &amp; Restore
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>All projects and expenses exported as a portable JSON file</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <button
            onClick={handleExportBackup}
            disabled={exporting}
            className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-300 transition-all font-semibold text-sm disabled:opacity-50"
          >
            <HiOutlineArrowDownTray className="w-5 h-5" />
            {exporting ? 'Exporting…' : 'Export JSON Backup'}
          </button>
          <button
            onClick={handleImportBackup}
            disabled={importing}
            className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-300 transition-all font-semibold text-sm disabled:opacity-50"
          >
            <HiOutlineArrowUpTray className="w-5 h-5" />
            {importing ? 'Importing…' : 'Restore from JSON'}
          </button>
        </div>
        {jsonMsg && (
          <p className="text-sm text-center py-2 px-4 rounded-lg" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            {jsonMsg}
          </p>
        )}
      </div>

      {/* ── DB File Backup ───────────────────────────────────────── */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="icon-sq-indigo">
            <HiOutlineCircleStack className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text-primary)' }}>
              Database File Backup
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Save or restore the raw SQLite .db file — fastest full backup</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <button
            onClick={handleBackupFile}
            disabled={backingUp}
            className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300 transition-all font-semibold text-sm disabled:opacity-50"
          >
            <HiOutlineArrowDownTray className="w-5 h-5" />
            {backingUp ? 'Saving…' : 'Save .db File'}
          </button>
          <button
            onClick={handleRestoreFile}
            disabled={restoring}
            className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 transition-all font-semibold text-sm disabled:opacity-50"
          >
            <HiOutlineArrowPath className="w-5 h-5" />
            {restoring ? 'Restoring…' : 'Restore .db File'}
          </button>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          Note: bill photo attachments are stored in the <code className="px-1 rounded" style={{ background: 'var(--bg-elevated)' }}>attachments/</code> folder
          next to the database — back up that folder separately.
        </p>
        {fileMsg && (
          <p className="text-sm text-center py-2 px-4 rounded-lg" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            {fileMsg}
          </p>
        )}
      </div>

      {/* ── Automatic Backups ───────────────────────────────────── */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="icon-sq-emerald">
            <HiOutlineCloudArrowDown className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text-primary)' }}>
              Automatic Backups
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              One backup is saved automatically every time you close the app — last 30 days kept
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {autoBackups.length === 0
                ? 'No automatic backups yet'
                : `${autoBackups.length} backup${autoBackups.length !== 1 ? 's' : ''} stored`}
            </p>
            {autoBackups.length > 0 && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Most recent: {autoBackups[0].date} ({autoBackups[0].sizeKb} KB)
              </p>
            )}
          </div>
          <button
            onClick={() => window.electronAPI.openAutoBackupFolder()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          >
            <HiOutlineFolderOpen className="w-4 h-4" />
            Open Folder
          </button>
        </div>

        {autoBackups.length > 0 && (
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-color)' }}>
            {autoBackups.slice(0, 7).map((b, idx) => (
              <div
                key={b.filename}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
                style={{
                  background: idx % 2 === 0 ? 'var(--bg-elevated)' : 'transparent',
                  borderBottom: idx < Math.min(autoBackups.length, 7) - 1 ? '1px solid var(--border-color)' : 'none',
                }}
              >
                <div className="flex items-center gap-2">
                  <HiOutlineCircleStack className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{b.date}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.sizeKb} KB</span>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`Restore backup from ${b.date}? All current data will be replaced and the app will restart.`)) return;
                    setRestoringAuto(b.filename);
                    setAutoBackupMsg('');
                    const res = await window.electronAPI.restoreAutoBackup(b.filename);
                    if (!res.success) {
                      setAutoBackupMsg(`❌ ${res.error ?? 'Restore failed.'}`);
                      setRestoringAuto('');
                    }
                  }}
                  disabled={!!restoringAuto}
                  className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-40"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {restoringAuto === b.filename ? 'Restoring…' : 'Restore'}
                </button>
              </div>
            ))}
          </div>
        )}

        {autoBackupMsg && (
          <p className="text-sm text-center py-2 px-4 rounded-lg mt-3" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            {autoBackupMsg}
          </p>
        )}
      </div>

      {/* ── Shared Database ──────────────────────────────────────── */}
      <PlanGate feature="dbSharing">
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="icon-sq-violet">
            <HiOutlineUsers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text-primary)' }}>
              Shared Database (Multi-user)
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Point both computers to the same file on a shared drive (Google Drive, OneDrive, LAN folder)
            </p>
          </div>
        </div>

        <div className="rounded-xl p-3 mb-4 flex items-start gap-2" style={{ background: 'var(--bg-elevated)' }}>
          <HiOutlineFolderOpen className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <p className="text-xs break-all leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{dbPath || 'Loading…'}</p>
        </div>

        <div className="flex gap-3 mb-3">
          <button
            onClick={handleChangePath}
            disabled={changingPath}
            className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-900/10 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:border-violet-300 transition-all font-semibold text-sm disabled:opacity-50"
          >
            <HiOutlineFolderOpen className="w-4 h-4" />
            {changingPath ? 'Selecting…' : 'Change Location'}
          </button>
          <button
            onClick={handleResetPath}
            className="px-4 py-3 rounded-xl border text-sm font-medium transition-colors"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          >
            Reset to Default
          </button>
        </div>

        <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>
          After changing, restart the app on this computer. Then install the app on the second computer,
          go to Settings, and set the same folder path. Both users should avoid editing at the exact same time.
        </p>
        {pathMsg && (
          <p className="text-sm text-center py-2 px-4 rounded-lg" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            {pathMsg}
          </p>
        )}
      </div>
      </PlanGate>

      {/* ── Security (PIN) ──────────────────────────────────────── */}
      <PlanGate feature="pinLock">
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="icon-sq-rose">
            <HiOutlineLockClosed className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text-primary)' }}>
              Security — PIN Lock
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Require a 4–6 digit PIN every time the app opens
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>PIN Lock</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {pinEnabled ? 'A PIN is currently set. App prompts for PIN on every launch.' : 'No PIN set — app opens without authentication.'}
            </p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${pinEnabled ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
            {pinEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        <div className="flex gap-3 mt-4 flex-wrap">
          {!pinEnabled ? (
            <button onClick={() => openPinModal('set')} className="btn-primary text-sm py-2 px-4">
              Set PIN
            </button>
          ) : (
            <>
              <button onClick={() => openPinModal('change')} className="btn-secondary text-sm py-2 px-4">
                Change PIN
              </button>
              <button onClick={() => openPinModal('remove')}
                className="text-sm py-2 px-4 rounded-xl border font-semibold transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                Remove PIN
              </button>
              {onLock && (
                <button
                  onClick={onLock}
                  className="flex items-center gap-1.5 text-sm py-2 px-4 rounded-xl border font-semibold transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                >
                  <HiOutlineLockClosed className="w-4 h-4" />
                  Lock Now
                </button>
              )}
            </>
          )}
        </div>
      </div>
      </PlanGate>

      {/* PIN modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <h2 className="text-base font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text-primary)' }}>
                {showPinModal === 'set' ? 'Set PIN' : showPinModal === 'change' ? 'Change PIN' : 'Remove PIN'}
              </h2>
              <button onClick={() => setShowPinModal(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                <HiOutlineXMark className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {(showPinModal === 'change' || showPinModal === 'remove') && (
                <div>
                  <label className="input-label">Current PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    className="input-field font-mono tracking-widest text-center text-lg"
                    placeholder="••••"
                    value={pinCurrent}
                    onChange={(e) => { setPinCurrent(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                  />
                </div>
              )}
              {showPinModal !== 'remove' && (
                <>
                  <div>
                    <label className="input-label">New PIN <span className="text-slate-400 font-normal">(4–6 digits)</span></label>
                    <div className="relative">
                      <input
                        type={showPinNew ? 'text' : 'password'}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        autoFocus={showPinModal === 'set'}
                        className="input-field font-mono tracking-widest text-center text-lg pr-10"
                        placeholder="••••"
                        value={pinNew}
                        onChange={(e) => { setPinNew(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                      />
                      <button type="button" onClick={() => setShowPinNew((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPinNew ? <HiOutlineEyeSlash className="w-4 h-4" /> : <HiOutlineEye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="input-label">Confirm New PIN</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      className="input-field font-mono tracking-widest text-center text-lg"
                      placeholder="••••"
                      value={pinConfirm}
                      onChange={(e) => { setPinConfirm(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handlePinSave()}
                    />
                  </div>
                </>
              )}
              {pinError && <p className="text-sm text-red-500">{pinError}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowPinModal(null)} className="flex-1 btn-ghost border" style={{ borderColor: 'var(--border-color)' }}>
                  Cancel
                </button>
                <button
                  onClick={handlePinSave}
                  disabled={pinSaving}
                  className={`flex-1 ${showPinModal === 'remove' ? 'btn-danger' : 'btn-primary'} text-sm`}
                >
                  {pinSaving ? 'Saving…' : showPinModal === 'remove' ? 'Remove PIN' : showPinModal === 'change' ? 'Update PIN' : 'Set PIN'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── App Updates ──────────────────────────────────────────── */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="icon-sq-indigo">
            <HiOutlineSparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text-primary)' }}>
              App Updates
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Check for and install the latest version</p>
          </div>
        </div>

        <div className="flex items-center justify-between py-3 border-b mb-4" style={{ borderColor: 'var(--border-color)' }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Current Version</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {appVersion ? `v${appVersion}` : 'Loading…'}
            </p>
          </div>
          <button
            onClick={handleCheckUpdate}
            disabled={checkingUpdate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-semibold transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          >
            <HiOutlineArrowPath className={`w-4 h-4 ${checkingUpdate ? 'animate-spin' : ''}`} />
            {checkingUpdate ? 'Checking…' : 'Check for Updates'}
          </button>
        </div>

        {/* Status row */}
        {updaterStatus && (
          <div className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl ${
            updaterStatus.type === 'downloaded'     ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' :
            updaterStatus.type === 'error'          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' :
            updaterStatus.type === 'not-available'  ? 'bg-slate-50 dark:bg-slate-700/40 text-slate-600 dark:text-slate-400' :
                                                      'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
          }`}>
            {updaterStatus.type === 'checking'      && <><HiOutlineArrowPath className="w-4 h-4 animate-spin shrink-0" /> Checking for updates…</>}
            {updaterStatus.type === 'available'     && <><HiOutlineArrowDownTray className="w-4 h-4 shrink-0" /> Update v{updaterStatus.version} found — downloading…</>}
            {updaterStatus.type === 'downloading'   && <><HiOutlineArrowDownTray className="w-4 h-4 shrink-0" /> Downloading update… {updaterStatus.percent}%</>}
            {updaterStatus.type === 'not-available' && <><HiOutlineCheckBadge className="w-4 h-4 shrink-0" /> You are on the latest version.</>}
            {updaterStatus.type === 'error'         && <><HiOutlineExclamationTriangle className="w-4 h-4 shrink-0" /> {updaterStatus.message}</>}
            {updaterStatus.type === 'downloaded'    && (
              <div className="flex items-center justify-between w-full">
                <span className="flex items-center gap-2">
                  <HiOutlineCheckBadge className="w-4 h-4 shrink-0" />
                  v{updaterStatus.version} downloaded and ready to install.
                </span>
                <button
                  onClick={() => window.electronAPI.installUpdate()}
                  className="ml-3 shrink-0 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Restart & Install
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── About ────────────────────────────────────────────────── */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="icon-sq-indigo">
            <HiOutlineInformationCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text-primary)' }}>
              About
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Application information</p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            { label: 'App Name',  value: 'Arch PEM — Project Expense Manager' },
            { label: 'Version',   value: appVersion ? `v${appVersion}` : '…' },
            { label: 'Storage',   value: 'Local SQLite Database' },
            { label: 'Built By',  value: 'HashX Labs' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border-color)' }}>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Network</span>
            <span className="text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
              100% Offline
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
