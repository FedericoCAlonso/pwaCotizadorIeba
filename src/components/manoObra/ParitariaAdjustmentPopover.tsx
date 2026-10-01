import React, { useState, useRef, useEffect } from 'react';
import { TrendingUp, Percent, Check, X, ArrowRight, AlertCircle } from 'lucide-react';
import { formatARS } from '../../core/calculations';

interface ParitariaAdjustmentPopoverProps {
  promedioHora: number;
  totalCategorias: number;
  onApply: (percentage: number) => Promise<void>;
}

export const ParitariaAdjustmentPopover: React.FC<ParitariaAdjustmentPopoverProps> = ({
  promedioHora,
  totalCategorias,
  onApply
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [percentageInput, setPercentageInput] = useState<string>('10');
  const [isApplying, setIsApplying] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const numericPercent = parseFloat(percentageInput) || 0;
  const simulatedHora = Math.round(promedioHora * (1 + numericPercent / 100));
  const diffHora = simulatedHora - promedioHora;

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleConfirm = async () => {
    if (numericPercent === 0) return;
    setIsApplying(true);
    try {
      await onApply(numericPercent);
      setIsOpen(false);
    } finally {
      setIsApplying(false);
    }
  };

  const PRESETS = [5, 10, 15, 20, 25];

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={totalCategorias === 0}
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all shadow-2xs cursor-pointer ${
          isOpen
            ? 'bg-primary text-on-primary shadow-sm'
            : 'bg-surface-container-high hover:bg-surface-variant text-on-surface border border-outline-variant/30'
        } ${totalCategorias === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="Aplicar aumento o ajuste porcentual por paritarias a la cuadrilla"
        aria-expanded={isOpen}
      >
        <TrendingUp className="w-3.5 h-3.5 text-primary" />
        <span>Ajuste Paritaria (%)</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-92 bg-surface-container-high border border-outline-variant/30 rounded-2xl shadow-xl z-50 p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Percent className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-on-surface">Ajuste Masivo de Paritarias</h4>
                <p className="text-[11px] text-on-surface-variant">Aplica a {totalCategorias} categorías activas</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Input de porcentaje y Presets */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-on-surface block">
              Porcentaje de incremento o ajuste (%):
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="number"
                  step="0.5"
                  value={percentageInput}
                  onChange={(e) => setPercentageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirm();
                    }
                  }}
                  placeholder="Ej: 12.5"
                  className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm font-mono font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 text-right pr-7"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">
                  %
                </span>
              </div>

              {/* Botón de signo negativo / positivo */}
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(percentageInput) || 0;
                  setPercentageInput((-val).toString());
                }}
                title="Invertir signo (aumento / deducción)"
                className="px-2.5 py-2 rounded-xl text-xs font-mono font-bold bg-surface-container hover:bg-surface-variant border border-outline-variant/30 text-on-surface-variant"
              >
                ±
              </button>
            </div>

            {/* Presets rápidos */}
            <div className="flex items-center gap-1.5 pt-1">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPercentageInput(p.toString())}
                  className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-mono font-bold transition-all border ${
                    numericPercent === p
                      ? 'bg-primary text-on-primary border-primary shadow-2xs'
                      : 'bg-surface-container hover:bg-surface-variant border-outline-variant/20 text-on-surface-variant'
                  }`}
                >
                  +{p}%
                </button>
              ))}
            </div>
          </div>

          {/* Previsualización en tiempo real */}
          <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-1">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
              Impacto en tarifa promedio:
            </span>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-on-surface-variant">{formatARS(promedioHora)}/h</span>
              <ArrowRight className="w-3.5 h-3.5 text-on-surface-variant/60" />
              <span className={`font-bold ${diffHora >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatARS(simulatedHora)}/h
              </span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                diffHora >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}>
                {diffHora >= 0 ? `+${formatARS(diffHora)}` : formatARS(diffHora)}
              </span>
            </div>
          </div>

          {/* Aviso informativo */}
          <div className="flex items-start gap-1.5 text-[11px] text-on-surface-variant/80">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span>Se recalcularán automáticamente los jornales en base a las horas de cada categoría.</span>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 rounded-full text-xs font-medium text-on-surface-variant hover:bg-surface-variant cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isApplying || numericPercent === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-full text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {isApplying ? (
                <span>Aplicando...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Aplicar Ajuste</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
