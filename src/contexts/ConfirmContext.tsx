import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

type ConfirmFunction = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFunction | null>(null);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ message: '' });
  const resolveRef = useRef<(value: boolean) => void>(() => {});

  const confirm: ConfirmFunction = useCallback((opts) => {
    return new Promise<boolean>((resolve) => {
      const normalizedOpts: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts;
      setOptions(normalizedOpts);
      resolveRef.current = resolve;
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = () => {
    setIsOpen(false);
    resolveRef.current(true);
  };

  const handleCancel = () => {
    setIsOpen(false);
    resolveRef.current(false);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden p-6 text-on-surface animate-in zoom-in-95 duration-150"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
          >
            <div className="flex items-start gap-3.5 mb-4">
              <div
                className={`p-2.5 rounded-2xl shrink-0 ${
                  options.isDestructive
                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                    : 'bg-primary/10 text-primary border border-primary/20'
                }`}
              >
                {options.isDestructive ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <HelpCircle className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="confirm-title" className="font-bold text-sm text-on-surface">
                  {options.title || (options.isDestructive ? 'Confirmar Eliminación' : 'Confirmación')}
                </h3>
                <p id="confirm-desc" className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                  {options.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 rounded-full text-xs font-semibold text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                autoFocus
              >
                {options.cancelText || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`px-4 py-2 rounded-full text-xs font-semibold shadow-sm transition-all ${
                  options.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-primary hover:bg-primary/90 text-on-primary'
                }`}
              >
                {options.confirmText || (options.isDestructive ? 'Eliminar' : 'Aceptar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm debe ser utilizado dentro de un ConfirmProvider');
  }
  return context;
}
