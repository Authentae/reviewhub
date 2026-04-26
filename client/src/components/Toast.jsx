import React, { createContext, useContext, useState, useCallback } from 'react';
import { useI18n } from '../context/I18nContext';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const { t } = useI18n();

  const show = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const dismiss = useCallback((id) => setToasts(prev => prev.filter(toast => toast.id !== id)), []);

  const STYLES = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-blue-600 text-white',
    warning: 'bg-amber-500 text-white',
  };

  // Error toasts get role="alert" (implicit assertive) so screen readers
  // interrupt the user — they signal something went wrong and need attention.
  // Success/info/warning toasts get role="status" (implicit polite) so they
  // queue behind any in-flight announcement and don't interrupt typing or
  // reading. Mixing both into a single aria-live region caused screen
  // readers to read every toast as if it were urgent.
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            aria-atomic="true"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium pointer-events-auto max-w-xs animate-fade-in ${STYLES[toast.type] || STYLES.info}`}
          >
            <span className="flex-1">{toast.message}</span>
            <button type="button" onClick={() => dismiss(toast.id)} aria-label={t('toast.dismissAria')} className="opacity-70 hover:opacity-100 text-lg leading-none">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
