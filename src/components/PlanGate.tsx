import { ReactNode } from 'react';
import { HiOutlineLockClosed, HiOutlineSparkles, HiOutlineArrowUpCircle } from 'react-icons/hi2';
import { PlanFeatures, PlanTier, PLAN_DISPLAY_NAMES, PLAN_COLORS } from '@/types';
import { usePlanFeature, usePlanTier } from '@/context/LicenseContext';

const REQUIRED_PLAN: Record<keyof PlanFeatures, PlanTier> = {
  tallyExport:     'studio',
  gstReport:       'studio',
  pendingPayments: 'studio',
  pinLock:         'studio',
  customBranding:  'enterprise',
  dbSharing:       'studio',
  machineTransfer: 'enterprise',
};

const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  tallyExport:     'Tally CSV Export',
  gstReport:       'GST Purchase Register',
  pendingPayments: 'Pending Payments Report',
  pinLock:         'PIN Lock & Security',
  customBranding:  'Custom Branding on Reports',
  dbSharing:       'Multi-User Database Sharing',
  machineTransfer: 'Machine Transfer Support',
};

const FEATURE_DESCRIPTIONS: Record<keyof PlanFeatures, string> = {
  tallyExport:     'Export expenses directly to Tally-compatible CSV format for seamless accounting.',
  gstReport:       'Generate GST Purchase Register reports across all projects with invoice tracking.',
  pendingPayments: 'Cross-project pending payments report to track all outstanding dues at a glance.',
  pinLock:         'Secure the app with a PIN lock to protect sensitive financial data.',
  customBranding:  'Add your firm\'s logo and contact details to all exported PDF reports.',
  dbSharing:       'Share the project database across multiple team members on a network drive.',
  machineTransfer: 'Transfer your license to a new machine without contacting support.',
};

function PlanBadge({ plan }: { plan: PlanTier }) {
  const colors = PLAN_COLORS[plan];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${colors.badge} ${colors.text}`}>
      <HiOutlineSparkles className="w-3 h-3" />
      {PLAN_DISPLAY_NAMES[plan]}
    </span>
  );
}

interface PlanGateProps {
  feature: keyof PlanFeatures;
  children: ReactNode;
}

export default function PlanGate({ feature, children }: PlanGateProps) {
  const hasFeature    = usePlanFeature(feature);
  const currentPlan   = usePlanTier();
  const requiredPlan  = REQUIRED_PLAN[feature];

  if (hasFeature) return <>{children}</>;

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.12))' }}
        >
          <HiOutlineLockClosed className="w-8 h-8 text-indigo-500" />
        </div>

        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>
          {FEATURE_LABELS[feature]}
        </h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
          {FEATURE_DESCRIPTIONS[feature]}
        </p>

        <div
          className="rounded-xl p-4 mb-5 text-left"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>YOUR PLAN</span>
            <PlanBadge plan={currentPlan} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>REQUIRED</span>
            <PlanBadge plan={requiredPlan} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <HiOutlineArrowUpCircle className="w-5 h-5 shrink-0" />
            <span>
              Upgrade to <strong>{PLAN_DISPLAY_NAMES[requiredPlan]}</strong> to unlock this feature
            </span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Contact HashX Labs or your reseller to upgrade your license.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Inline locked button — use inside an existing page to block a single action */
export function LockedButton({
  feature,
  children,
  className = '',
}: {
  feature: keyof PlanFeatures;
  children: ReactNode;
  className?: string;
}) {
  const hasFeature   = usePlanFeature(feature);
  const requiredPlan = REQUIRED_PLAN[feature];

  if (hasFeature) return <>{children}</>;

  return (
    <div
      className={`relative inline-flex items-center gap-1.5 cursor-not-allowed opacity-60 ${className}`}
      title={`Requires ${PLAN_DISPLAY_NAMES[requiredPlan]} plan`}
    >
      <HiOutlineLockClosed className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
      <span className="pointer-events-none">{children}</span>
    </div>
  );
}
