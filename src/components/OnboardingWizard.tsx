import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineRocketLaunch, HiOutlineBuildingOffice2, HiOutlineCurrencyRupee, HiOutlineFolderPlus, HiOutlineCheckCircle, HiOutlineArrowRight } from 'react-icons/hi2';
import { useApp } from '@/context/AppContext';
import { generateId } from '@/lib/calculations';
import { SUPPORTED_CURRENCIES } from '@/lib/calculations';

const STEPS = ['Welcome', 'Company', 'Currency', 'First Project'];

interface Props {
  onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: Props) {
  const { setCurrency } = useApp();
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('INR');
  const [projectName, setProjectName] = useState('');
  const [projectClient, setProjectClient] = useState('');
  const [saving, setSaving] = useState(false);

  const canNext = () => {
    if (step === 1) return companyName.trim().length > 0;
    if (step === 3) return projectName.trim().length > 0 && projectClient.trim().length > 0;
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      if (companyName.trim()) await window.electronAPI.setCompanyName(companyName.trim());
      await window.electronAPI.setCurrency(selectedCurrency);
      setCurrency(selectedCurrency);
      if (projectName.trim()) {
        await window.electronAPI.createProject({
          id: generateId('proj'),
          name: projectName.trim(),
          client: projectClient.trim(),
          plot_no: null,
          location: null,
          area_sqft: 0,
          description: null,
          status: 'Active',
          tags: '[]',
        });
      }
      await window.electronAPI.setOnboardingComplete();
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleFinish();
  };

  const skip = async () => {
    await window.electronAPI.setOnboardingComplete();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.93 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
      >
        {/* Progress bar */}
        <div className="h-1 bg-slate-100 dark:bg-slate-700">
          <motion.div
            className="h-full bg-indigo-500"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="p-8">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                }`}>
                  {i < step ? <HiOutlineCheckCircle className="w-4 h-4" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px w-6 transition-colors ${i < step ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600'}`} />
                )}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* Step 0: Welcome */}
            {step === 0 && (
              <motion.div key="welcome" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6">
                  <HiOutlineRocketLaunch className="w-8 h-8 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Welcome to Arch PEM!
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                  The offline project expense manager built for Indian construction & architecture businesses.
                  Let's get you set up in under a minute.
                </p>
              </motion.div>
            )}

            {/* Step 1: Company Name */}
            {step === 1 && (
              <motion.div key="company" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6">
                  <HiOutlineBuildingOffice2 className="w-8 h-8 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Your Company
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                  This appears on printed reports and exports.
                </p>
                <input
                  autoFocus
                  type="text"
                  className="input-field w-full text-base"
                  placeholder="e.g. Sharma Architects & Builders"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && canNext() && next()}
                />
              </motion.div>
            )}

            {/* Step 2: Currency */}
            {step === 2 && (
              <motion.div key="currency" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6">
                  <HiOutlineCurrencyRupee className="w-8 h-8 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Currency
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                  All amounts will be displayed in this currency. You can change it later in Settings.
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {SUPPORTED_CURRENCIES.map(({ code, label }) => {
                    const symbol = label.split(' ')[0];
                    const name = label.split(' ').slice(1).join(' ');
                    return (
                    <button
                      key={code}
                      onClick={() => setSelectedCurrency(code)}
                      className={`rounded-xl border-2 p-3 text-center transition-all ${
                        selectedCurrency === code
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                          : 'border-slate-200 dark:border-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{symbol}</p>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">{code}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{name}</p>
                    </button>
                  )})}
                </div>
              </motion.div>
            )}

            {/* Step 3: First Project */}
            {step === 3 && (
              <motion.div key="project" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6">
                  <HiOutlineFolderPlus className="w-8 h-8 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Your First Project
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                  Create your first project now, or skip and create one from the Projects page.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="input-label">Project Name *</label>
                    <input
                      autoFocus
                      type="text"
                      className="input-field w-full"
                      placeholder="e.g. Residential Villa – Plot 12"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label">Client Name *</label>
                    <input
                      type="text"
                      className="input-field w-full"
                      placeholder="e.g. Mr. Ramesh Sharma"
                      value={projectClient}
                      onChange={(e) => setProjectClient(e.target.value)}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
            <button onClick={skip} className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              Skip setup
            </button>
            <button
              onClick={next}
              disabled={!canNext() || saving}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {step === STEPS.length - 1 ? (
                saving ? 'Setting up…' : 'Launch Arch PEM'
              ) : (
                <>Continue <HiOutlineArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
