import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastItem = { id, message, type, duration };

    setToasts((prev) => [...prev.slice(-4), newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = {
    success: useCallback((msg: string, dur?: number) => showToast(msg, 'success', dur), [showToast]),
    error: useCallback((msg: string, dur?: number) => showToast(msg, 'error', dur), [showToast]),
    info: useCallback((msg: string, dur?: number) => showToast(msg, 'info', dur), [showToast]),
    warning: useCallback((msg: string, dur?: number) => showToast(msg, 'warning', dur), [showToast]),
  };

  return (
    <ToastContext.Provider value={{ showToast, toast }}>
      {children}
      <div
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4 sm:px-0"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => {
          let bgClass = 'bg-surface-container-high border-outline-variant/30 text-on-surface';
          let icon = <Info className="w-4 h-4 text-primary shrink-0" />;

          if (t.type === 'success') {
            bgClass = 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100 shadow-emerald-950/40';
            icon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
          } else if (t.type === 'error') {
            bgClass = 'bg-rose-950/90 border-rose-500/40 text-rose-100 shadow-rose-950/40';
            icon = <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
          } else if (t.type === 'warning') {
            bgClass = 'bg-amber-950/90 border-amber-500/40 text-amber-100 shadow-amber-950/40';
            icon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
          }

          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-xl backdrop-blur-md text-xs font-medium transition-all animate-in slide-in-from-top-3 fade-in duration-200 ${bgClass}`}
            >
              <div className="mt-0.5">{icon}</div>
              <div className="flex-1 min-w-0 break-words leading-relaxed">{t.message}</div>
              <button
                onClick={() => removeToast(t.id)}
                className="p-1 -mr-1 -mt-1 opacity-70 hover:opacity-100 rounded-lg transition-opacity shrink-0"
                aria-label="Cerrar notificación"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe ser utilizado dentro de un ToastProvider');
  }
  return context;
}
