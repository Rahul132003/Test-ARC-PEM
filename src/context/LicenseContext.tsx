import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LicenseStatus, PlanTier, PlanFeatures } from '@/types';

interface LicenseContextValue {
  license: LicenseStatus | null;
  plan: PlanTier;
  maxProjects: number;
  features: PlanFeatures;
  reload: () => Promise<void>;
}

const DEFAULT_FEATURES: PlanFeatures = {
  tallyExport:     false,
  gstReport:       false,
  pendingPayments: false,
  pinLock:         false,
  customBranding:  false,
  dbSharing:       false,
  machineTransfer: false,
};

const LicenseContext = createContext<LicenseContextValue>({
  license:     null,
  plan:        'solo',
  maxProjects: 10,
  features:    DEFAULT_FEATURES,
  reload:      async () => {},
});

export function LicenseProvider({
  initialLicense,
  onReload,
  children,
}: {
  initialLicense: LicenseStatus;
  onReload: () => Promise<LicenseStatus>;
  children: ReactNode;
}) {
  const [license, setLicense] = useState<LicenseStatus>(initialLicense);

  // Re-sync when parent re-activates / changes license
  useEffect(() => {
    setLicense(initialLicense);
  }, [initialLicense]);

  const reload = async () => {
    const fresh = await onReload();
    setLicense(fresh);
  };

  const plan        = license?.plan        ?? 'solo';
  const maxProjects = license?.maxProjects ?? 10;
  const features    = license?.features    ?? DEFAULT_FEATURES;

  return (
    <LicenseContext.Provider value={{ license, plan, maxProjects, features, reload }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  return useContext(LicenseContext);
}

export function usePlanFeature(feature: keyof PlanFeatures): boolean {
  return useContext(LicenseContext).features[feature];
}

export function usePlanTier(): PlanTier {
  return useContext(LicenseContext).plan;
}

export function useProjectLimit(): number {
  return useContext(LicenseContext).maxProjects;
}
