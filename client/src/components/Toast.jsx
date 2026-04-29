import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useI18n } from '../context/I18nContext';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const { t } = useI18n();
  // Per-toast dismissal timers so hover can pause + resume them.
  // Without this, an info toast with a token / URL would auto-dismiss
  // mid-read; users couldn't pause to copy or finish reading.
  const timersRef = useRef(new Map());
  const DEFAULT_TTL_MS = 4500;
  const ERROR_TTL_MS = 7000; // errors deserve longer to read

  const dismiss = useCallback((id) => {
    const t = timersRef.current.get(id);
    if (t) { clearTimeout(t); timersRef.current.delete(id); }
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const armTimer = useCallback((id, ttl) => {
    const handle = setTimeout(() => {
      timersRef.current.delete(id);
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, ttl);
    timersRef.current.set(id, handle);
  }, []);

  const pauseTimer = useCallback((id) => {
    const t = timersRef.current.get(id);
    if (t) { clearTimeout(t); timersRef.current.delete(id); }
  }, []);

  const resumeTimer = useCallback((id, type) => {
    if (timersRef.current.has(id)) return;
    armTimer(id, type === 'error' ? ERROR_TTL_MS : DEFAULT_TTL_MS);
  }, [armTimer]);

  const show = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    armTimer(id, type === 'error' ? ERROR_TTL_MS : DEFAULT_TTL_MS);
  }, [armTimer]);

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
            // Pause auto-dismiss while the user is hovering (mouse) or
            // keyboard-focused on the toast. Without this, an info toast
            // carrying a one-time token / URL would vanish mid-read.
            // Resume on leave so the toast still goes away eventually.
            onMouseEnter={() => pauseTimer(toast.id)}
            onMouseLeave={() => resumeTimer(toast.id, toast.type)}
            onFocus={() => pauseTimer(toast.id)}
            onBlur={() => resumeTimer(toast.id, toast.type)}
            tabIndex={0}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium pointer-events-auto max-w-xs animate-fade-in focus:outline-none focus:ring-2 focus:ring-white/40 ${STYLES[toast.type] || STYLES.info}`}
          >
            <span className="flex-1">{toast.message}</span>
            <button type="button" onClick={() => dismiss(toast.id)} aria-label={t('toast.dismissAria')} className="opacity-70 hover:opacity-100 text-lg leading-none">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
