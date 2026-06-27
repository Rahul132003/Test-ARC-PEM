import { useState, useRef } from 'react';
import {
  HiOutlineShieldCheck,
  HiOutlineDocumentArrowUp,
  HiOutlineKey,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineSquare3Stack3D,
} from 'react-icons/hi2';

interface Props {
  onActivated: (clientName: string) => void;
  error?: string;
  machineId?: string;
}

export default function LicensePage({ onActivated, error: initialError, machineId }: Props) {
  const [mode, setMode]           = useState<'import' | 'paste'>('import');
  const [pasteText, setPasteText] = useState('');
  const [status, setStatus]       = useState<'idle' | 'checking' | 'error' | 'success'>(initialError ? 'error' : 'idle');
  const [message, setMessage]     = useState(initialError || '');
  const fileInputRef              = useRef<HTMLInputElement>(null);

  const isExpired = initialError?.toLowerCase().includes('expired');

  const activate = async (key: string) => {
    const trimmed = key.trim();
    if (!trimmed) { setStatus('error'); setMessage('Please provide a license key.'); return; }
    setStatus('checking');
    setMessage('');
    const res = await window.electronAPI.activateLicense(trimmed);
    if (res.success) {
      setStatus('success');
      setMessage(`Welcome, ${res.client}!`);
      setTimeout(() => onActivated(res.client!), 1200);
    } else {
      setStatus('error');
      setMessage(res.error || 'Activation failed.');
    }
  };

  const handleFileImport = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    activate(text);
    e.target.value = '';
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    activate(pasteText);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 8px 32px rgba(99,102,241,0.4)' }}
          >
            <HiOutlineSquare3Stack3D className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Project Expense Manager
          </h1>
          <p className="text-slate-400 text-sm">by HashX Labs</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <HiOutlineShieldCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Activate License
              </h2>
              <p className="text-xs text-slate-400">Enter your license to get started</p>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex rounded-xl overflow-hidden border border-white/10 mb-6 text-sm font-medium">
            <button
              onClick={() => setMode('import')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors ${
                mode === 'import' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-white/5'
              }`}
            >
              <HiOutlineDocumentArrowUp className="w-4 h-4" />
              Import .lic File
            </button>
            <button
              onClick={() => setMode('paste')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 border-l border-white/10 transition-colors ${
                mode === 'paste' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-white/5'
              }`}
            >
              <HiOutlineKey className="w-4 h-4" />
              Paste Key
            </button>
          </div>

          {/* Import mode */}
          {mode === 'import' && (
            <div>
              <input ref={fileInputRef} type="file" accept=".lic,.txt" className="hidden" onChange={handleFileChange} />
              <button
                onClick={handleFileImport}
                disabled={status === 'checking'}
                className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border-2 border-dashed border-white/20 hover:border-indigo-400/60 hover:bg-indigo-500/5 transition-all disabled:opacity-50"
              >
                <HiOutlineDocumentArrowUp className="w-10 h-10 text-indigo-400" />
                <span className="text-white font-semibold">Click to select your .lic file</span>
                <span className="text-xs text-slate-400">The file was emailed to you by HashX Labs</span>
              </button>
            </div>
          )}

          {/* Paste mode */}
          {mode === 'paste' && (
            <form onSubmit={handlePasteSubmit}>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your license key here..."
                rows={5}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-xs font-mono placeholder-slate-500 outline-none focus:border-indigo-400/60 resize-none mb-4"
              />
              <button
                type="submit"
                disabled={status === 'checking' || !pasteText.trim()}
                className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm transition-colors disabled:opacity-50"
              >
                {status === 'checking' ? 'Verifying…' : 'Activate'}
              </button>
            </form>
          )}

          {/* Status messages */}
          {status === 'error' && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <HiOutlineExclamationTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-300">{message}</p>
            </div>
          )}
          {status === 'success' && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <HiOutlineCheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-sm text-emerald-300 font-semibold">{message} License activated!</p>
            </div>
          )}
        </div>

        {/* Machine ID — for support and new-machine transfers */}
        {machineId && (
          <div className="mt-5 bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">Your Machine ID</p>
            <p className="text-xs font-mono text-slate-300 break-all select-all">{machineId}</p>
            <p className="text-[10px] text-slate-500 mt-1.5">
              Share this with HashX Labs when requesting a license or moving to a new machine.
            </p>
          </div>
        )}

        {/* Renewal notice when expired */}
        {isExpired && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
            <p className="text-sm text-red-300 font-semibold mb-1">License Renewal Required</p>
            <p className="text-xs text-slate-400">
              Contact HashX Labs with your Machine ID above to get a renewed license file.
            </p>
          </div>
        )}

        <p className="text-center text-xs text-slate-500 mt-4">
          Need a license?{' '}
          <span className="text-indigo-400">Contact HashX Labs</span>
          {' · '}This software is licensed, not sold.
        </p>
      </div>
    </div>
  );
}
