import { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { HiOutlineExclamationTriangle, HiOutlineBellAlert, HiOutlineArrowDownTray, HiOutlineSparkles } from 'react-icons/hi2';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import { LicenseProvider } from './context/LicenseContext';
import Sidebar from './components/layout/Sidebar';
import TitleBar from './components/layout/TitleBar';
import GlobalSearch from './components/layout/GlobalSearch';
import OnboardingWizard from './components/OnboardingWizard';
import PinLockScreen from './components/PinLockScreen';
import ProjectsPage from './pages/ProjectsPage';
import SummarySheetPage from './pages/SummarySheetPage';
import VendorLedgerPage from './pages/VendorLedgerPage';
import LabourLedgerPage from './pages/LabourLedgerPage';
import ExpensesPage from './pages/ExpensesPage';
import SettingsPage from './pages/SettingsPage';
import LicensePage from './pages/LicensePage';
import DashboardPage from './pages/DashboardPage';
import PendingPaymentsPage from './pages/PendingPaymentsPage';
import GSTReportPage from './pages/GSTReportPage';
import VendorDirectoryPage from './pages/VendorDirectoryPage';
import { LicenseStatus, UpdaterStatus } from './types';

function ProjectRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/project/${id}/expenses`} replace />;
}

function ExpiryBanner({ daysLeft, inGrace }: { daysLeft: number; inGrace: boolean }) {
  if (inGrace) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-semibold print:hidden">
        <HiOutlineBellAlert className="w-4 h-4 shrink-0" />
        <span>
          License expired {Math.abs(daysLeft)} day{Math.abs(daysLeft) !== 1 ? 's' : ''} ago.
          Grace period ends in {7 + daysLeft} day{7 + daysLeft !== 1 ? 's' : ''}.
          Contact HashX Labs immediately to renew.
        </span>
      </div>
    );
  }
  if (daysLeft <= 30) {
    const urgency = daysLeft <= 7 ? 'bg-orange-500' : 'bg-amber-500';
    return (
      <div className={`flex items-center gap-2 px-4 py-2 ${urgency} text-white text-xs font-semibold print:hidden`}>
        <HiOutlineExclamationTriangle className="w-4 h-4 shrink-0" />
        <span>
          License expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''} ({new Date(Date.now() + daysLeft * 86_400_000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}).
          Contact HashX Labs to renew.
        </span>
      </div>
    );
  }
  return null;
}



function UpdaterBanner({ status, onInstall }: { status: UpdaterStatus | null; onInstall: () => void }) {
  if (!status || status.type !== 'downloaded') return null;
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold print:hidden">
      <HiOutlineArrowDownTray className="w-4 h-4 shrink-0" />
      <span className="flex-1">
        Update v{status.version} downloaded and ready to install.
      </span>
      <button
        onClick={onInstall}
        className="bg-white text-indigo-700 font-bold text-xs px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
      >
        Restart & Update
      </button>
    </div>
  );
}

function MainApp({ license, onLock }: { license: LicenseStatus; onLock: () => void }) {
  const daysLeft   = license.daysLeft ?? 999;
  const showBanner = license.showWarning || license.inGracePeriod;
  const [searchOpen, setSearchOpen] = useState(false);
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setSearchOpen((o) => !o);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Subscribe to auto-updater status events
  useEffect(() => {
    const unsub = window.electronAPI.onUpdaterStatus((s) => setUpdaterStatus(s));
    return unsub;
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TitleBar onSearchOpen={() => setSearchOpen(true)} />
      {showBanner && <ExpiryBanner daysLeft={daysLeft} inGrace={!!license.inGracePeriod} />}
      <UpdaterBanner status={updaterStatus} onInstall={() => window.electronAPI.installUpdate()} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6 print:p-0 print:overflow-visible">
          <Routes>
            <Route path="/"                              element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"                     element={<DashboardPage />} />
            <Route path="/projects"                      element={<ProjectsPage />} />
            <Route path="/project/:id"                   element={<ProjectRedirect />} />
            <Route path="/project/:id/summary"           element={<SummarySheetPage />} />
            <Route path="/project/:id/expenses"          element={<ExpensesPage />} />
            <Route path="/project/:id/ledger/labour"     element={<LabourLedgerPage />} />
            <Route path="/project/:id/ledger/vendor"     element={<VendorLedgerPage />} />
            <Route path="/pending-payments"              element={<PendingPaymentsPage />} />
            <Route path="/gst-report"                    element={<GSTReportPage />} />
            <Route path="/vendors"                       element={<VendorDirectoryPage />} />
            <Route path="/settings"                      element={<SettingsPage onLock={onLock} />} />
          </Routes>
        </main>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

function AppShell() {
  const [license,      setLicense]      = useState<LicenseStatus | null>(null);
  const [onboarding,   setOnboarding]   = useState<boolean | null>(null);
  const [pinRequired,  setPinRequired]  = useState<boolean | null>(null);
  const [pinVerified,  setPinVerified]  = useState(false);

  const reloadLicense = () => window.electronAPI.getLicenseStatus().then(setLicense);

  useEffect(() => {
    reloadLicense();
    window.electronAPI.getOnboardingComplete().then(setOnboarding);
    window.electronAPI.getPinEnabled().then(setPinRequired);
  }, []);

  if (!license || onboarding === null || pinRequired === null) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!license.valid) {
    return <LicensePage error={license.error} machineId={license.machineId} onActivated={reloadLicense} />;
  }

  if (pinRequired && !pinVerified) {
    return <PinLockScreen onUnlocked={() => setPinVerified(true)} />;
  }

  return (
    <LicenseProvider
      initialLicense={license}
      onReload={() => window.electronAPI.getLicenseStatus()}
    >
      <HashRouter>
        {!onboarding && (
          <OnboardingWizard onComplete={() => setOnboarding(true)} />
        )}
        <MainApp license={license} onLock={() => setPinVerified(false)} />
      </HashRouter>
    </LicenseProvider>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </AppProvider>
  );
}
