import React from 'react';
import { X } from 'lucide-react';
import { TIPOS_AJUSTE_PRECIO } from '../../core/sampleData';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface MassPriceAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  tipoAjusteIndice: 'porcentaje' | 'dolar_blue' | 'ipc' | 'canasta';
  setTipoAjusteIndice: (val: 'porcentaje' | 'dolar_blue' | 'ipc' | 'canasta') => void;
  massPercentage: number;
  setMassPercentage: (val: number) => void;
  onApply: () => void;
}

export const MassPriceAdjustModal: React.FC<MassPriceAdjustModalProps> = ({
  isOpen,
  onClose,
  tipoAjusteIndice,
  setTipoAjusteIndice,
  massPercentage,
  setMassPercentage,
  onApply,
}) => {
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  const inputCls =
    'w-full px-3.5 py-2.5 text-base sm:text-xs rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-sm shadow-2xl p-6 text-on-surface">
        <div className="flex items-center justify-between mb-4 border-b border-outline-variant/30 pb-3">
          <h3 className="text-base font-semibold text-on-surface">Aumento Masivo por Índice</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Mecanismo / Índice</label>
            <select
              value={tipoAjusteIndice}
              onChange={(e) => setTipoAjusteIndice(e.target.value as any)}
              className={inputCls}
            >
              {TIPOS_AJUSTE_PRECIO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Porcentaje de Aumento (%)</label>
            <input
              type="number"
              step="0.1"
              value={massPercentage}
              onChange={(e) => setMassPercentage(parseFloat(e.target.value) || 0)}
              className={`${inputCls} font-mono`}
            />
          </div>

          <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant"
            >
              Cancelar
            </button>
            <button
              onClick={onApply}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-full text-sm shadow-sm transition-colors"
            >
              Aplicar Aumento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
