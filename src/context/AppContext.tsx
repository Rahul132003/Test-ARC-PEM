/**
 * App-wide context for dark mode and currency preferences.
 * Wrap the whole app in <AppProvider> to give every component access.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '@/lib/calculations';

interface AppContextValue {
  // Currency
  currency:    string;
  setCurrency: (c: string) => void;
  fmt:         (amount: number) => string;
}

const AppContext = createContext<AppContextValue>({
  currency:    'INR',
  setCurrency: () => {},
  fmt:         (a) => formatCurrency(a, 'INR'),
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState('INR');

  // Ensure dark mode is always off just in case it was previously set
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  // Load persisted currency on mount
  useEffect(() => {
    window.electronAPI.getCurrency().then((c) => {
      if (c) setCurrencyState(c);
    });
  }, []);

  const setCurrency = useCallback((c: string) => {
    setCurrencyState(c);
    window.electronAPI.setCurrency(c);
  }, []);

  const fmt = useCallback(
    (amount: number) => formatCurrency(amount, currency),
    [currency]
  );

  return (
    <AppContext.Provider value={{ currency, setCurrency, fmt }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
