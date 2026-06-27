import { useState, useEffect, useCallback } from 'react';
import { HiOutlineSquare3Stack3D, HiOutlineBackspace, HiOutlineLockClosed } from 'react-icons/hi2';

const PIN_LENGTH = 4;
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

interface Props {
  onUnlocked: () => void;
}

export default function PinLockScreen({ onUnlocked }: Props) {
  const [digits, setDigits]       = useState<string[]>([]);
  const [error, setError]         = useState('');
  const [shake, setShake]         = useState(false);
  const [attempts, setAttempts]   = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntil(null);
        setAttempts(0);
        setError('');
        setCountdown(0);
      } else {
        setCountdown(remaining);
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleDigit = useCallback((d: string) => {
    if (lockedUntil) return;
    setDigits((prev) => {
      if (prev.length >= PIN_LENGTH) return prev;
      return [...prev, d];
    });
    setError('');
  }, [lockedUntil]);

  const handleBackspace = useCallback(() => {
    if (lockedUntil) return;
    setDigits((prev) => prev.slice(0, -1));
    setError('');
  }, [lockedUntil]);

  // Auto-verify when 4 digits entered
  useEffect(() => {
    if (digits.length !== PIN_LENGTH) return;
    const pin = digits.join('');
    window.electronAPI.verifyPin(pin).then((ok) => {
      if (ok) {
        onUnlocked();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setDigits([]);
        triggerShake();
        if (newAttempts >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCKOUT_SECONDS * 1000);
          setError(`Too many attempts. Locked for ${LOCKOUT_SECONDS}s.`);
        } else {
          setError(`Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? 's' : ''} remaining.`);
        }
      }
    });
  }, [digits]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      else if (e.key === 'Backspace') handleBackspace();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleDigit, handleBackspace]);

  const isLocked = !!lockedUntil;

  return (
    <div className="h-screen flex flex-col items-center justify-center select-none"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>

      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 8px 32px rgba(99,102,241,0.5)' }}>
          <HiOutlineSquare3Stack3D className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold text-white mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Arch PEM
        </h1>
        <p className="text-slate-400 text-sm">Enter your PIN to continue</p>
      </div>

      {/* PIN dots */}
      <div className={`flex items-center gap-4 mb-8 ${shake ? 'animate-shake' : ''}`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
              i < digits.length
                ? 'bg-indigo-400 border-indigo-400 scale-110'
                : 'bg-transparent border-slate-500'
            }`}
          />
        ))}
      </div>

      {/* Error / lockout message */}
      <div className="h-7 mb-4 flex items-center">
        {isLocked ? (
          <p className="text-red-400 text-sm font-medium text-center">
            <HiOutlineLockClosed className="inline w-4 h-4 mr-1 mb-0.5" />
            Locked — try again in {countdown}s
          </p>
        ) : error ? (
          <p className="text-red-400 text-sm font-medium">{error}</p>
        ) : null}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-64">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, idx) => {
          if (key === '') return <div key={idx} />;
          const isBackspace = key === '⌫';
          return (
            <button
              key={key}
              onClick={() => isBackspace ? handleBackspace() : handleDigit(key)}
              disabled={isLocked}
              className={`
                h-16 rounded-2xl text-xl font-bold transition-all duration-150
                active:scale-95 disabled:opacity-30
                ${isBackspace
                  ? 'text-slate-400 hover:text-white hover:bg-slate-700'
                  : 'text-white hover:bg-indigo-600/60 active:bg-indigo-600'
                }
              `}
              style={{ background: isBackspace ? 'transparent' : 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {isBackspace ? <HiOutlineBackspace className="w-6 h-6 mx-auto" /> : key}
            </button>
          );
        })}
      </div>

      <p className="text-slate-600 text-xs mt-12">Protected by Arch PEM PIN Lock</p>
    </div>
  );
}
