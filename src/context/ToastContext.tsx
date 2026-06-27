import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HiOutlineTrash, HiOutlineArrowUturnLeft, HiOutlineCheckCircle } from 'react-icons/hi2';

interface Toast {
  id: string;
  message: string;
  onUndo?: () => void;
}

interface ToastContextValue {
  showUndo: (message: string, onConfirm: () => void, onUndo?: () => void) => void;
  showSuccess: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showUndo: () => {},
  showSuccess: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const showUndo = useCallback((message: string, onConfirm: () => void, onUndo?: () => void) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, onUndo }]);
    const timer = setTimeout(() => {
      onConfirm();
      remove(id);
    }, 4000);
    timers.current.set(id, timer);
  }, [remove]);

  const showSuccess = useCallback((message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message }]);
    const timer = setTimeout(() => remove(id), 3000);
    timers.current.set(id, timer);
  }, [remove]);

  const handleUndo = (toast: Toast) => {
    toast.onUndo?.();
    remove(toast.id);
  };

  return (
    <ToastContext.Provider value={{ showUndo, showSuccess }}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto flex items-center gap-3 bg-slate-800 dark:bg-slate-700 text-white text-sm px-4 py-3 rounded-2xl shadow-xl min-w-[280px] max-w-sm"
            >
              {toast.onUndo ? (
                <HiOutlineTrash className="w-4 h-4 text-red-400 shrink-0" />
              ) : (
                <HiOutlineCheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span className="flex-1 font-medium">{toast.message}</span>
              {toast.onUndo && (
                <button
                  onClick={() => handleUndo(toast)}
                  className="flex items-center gap-1 text-indigo-300 hover:text-white font-bold text-xs shrink-0 transition-colors"
                >
                  <HiOutlineArrowUturnLeft className="w-3.5 h-3.5" />
                  Undo
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
