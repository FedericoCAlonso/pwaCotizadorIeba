import React from 'react';
import { X } from 'lucide-react';

interface ModalContainerProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const ModalContainer: React.FC<ModalContainerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  maxWidth = 'md',
  children,
  footer
}) => {
  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl'
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className={`bg-surface-container border-t sm:border border-outline-variant/30 rounded-t-3xl sm:rounded-3xl w-full ${maxWidthClass} shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] text-on-surface pb-safe`}
      >
        {/* Mobile M3 Bottom Sheet Drag Indicator */}
        <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto mt-2.5 mb-1 shrink-0 sm:hidden" />

        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-outline-variant/20 bg-surface-container-low flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && <div className="bg-primary/10 p-2 rounded-xl text-primary shrink-0">{icon}</div>}
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-on-surface truncate">{title}</h3>
              {subtitle && <p className="text-xs text-on-surface-variant truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors shrink-0"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 touch-pan-y overscroll-contain">
          {children}
        </div>

        {/* Modal Footer if provided */}
        {footer && (
          <div className="px-4 sm:px-6 py-3.5 border-t border-outline-variant/20 bg-surface-container-low shrink-0 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
