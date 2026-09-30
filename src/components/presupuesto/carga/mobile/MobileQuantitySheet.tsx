import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  Delete,
  Plus,
  Minus,
  Calculator,
  Sliders
} from 'lucide-react';
import { ItemPresupuesto } from '../../../../core/types';
import { formatARS, safeNum } from '../../../../core/calculations';
import { evaluateMathExpression } from '../../../../core/mathEvaluator';
import { useHaptics } from '../../../../hooks/useHaptics';

export interface MobileQuantitySheetProps {
  isOpen: boolean;
  onClose: () => void;
  item: ItemPresupuesto | null;
  calculosVariables?: Record<string, number | string>;
  onConfirm: (cantidad: number, formula?: string) => void;
  onOpenQuickParams?: (itemId: string) => void;
}

export const MobileQuantitySheet: React.FC<MobileQuantitySheetProps> = ({
  isOpen,
  onClose,
  item,
  calculosVariables,
  onConfirm,
  onOpenQuickParams
}) => {
  const haptics = useHaptics();
  const [valueStr, setValueStr] = useState<string>('');
  const [isFormulaMode, setIsFormulaMode] = useState<boolean>(false);

  useEffect(() => {
    if (item && isOpen) {
      if (item.formulaCantidad) {
        setValueStr(item.formulaCantidad);
        setIsFormulaMode(true);
      } else {
        setValueStr(String(item.cantidad ?? 1));
        setIsFormulaMode(false);
      }
    }
  }, [item, isOpen]);

  // Scope de variables para evaluar en vivo
  const evaluationScope = useMemo(() => {
    const scope: Record<string, number> = {};
    if (calculosVariables) {
      for (const [k, v] of Object.entries(calculosVariables)) {
        scope[k] = typeof v === 'number' ? v : Number(v) || 0;
      }
    }
    if (item?.parametros) {
      for (const p of item.parametros) {
        scope[p.id] = p.valor;
      }
    }
    return scope;
  }, [calculosVariables, item?.parametros]);

  // Cantidad estimada en vivo
  const evaluatedQty = useMemo(() => {
    if (!valueStr.trim()) return 0;
    if (valueStr.trim().startsWith('=')) {
      try {
        const res = evaluateMathExpression(valueStr, evaluationScope);
        if (res && res.isValid && typeof res.value === 'number' && !isNaN(res.value)) {
          return Math.round(res.value * 100) / 100;
        }
      } catch {
        return null;
      }
      return null;
    }
    const n = Number(valueStr.replace(',', '.'));
    return isNaN(n) ? null : n;
  }, [valueStr, evaluationScope]);

  // Estimación de precio total en vivo
  const estimatedTotalPrice = useMemo(() => {
    if (evaluatedQty === null || !item) return null;
    const currentQty = safeNum(item.cantidad) > 0 ? safeNum(item.cantidad) : 1;
    const currentPrice = item.precioFinalItem ?? item.precioVentaTotal ?? item.costoDirectoTotal ?? 0;
    const unitPrice = currentPrice / currentQty;
    return unitPrice * evaluatedQty;
  }, [evaluatedQty, item]);

  if (!isOpen || !item) return null;

  const handleKeyPress = (char: string) => {
    haptics.tick();
    setValueStr((prev) => {
      if (prev === '0' && char !== '.') return char;
      return prev + char;
    });
  };

  const handleDelete = () => {
    haptics.tick();
    setValueStr((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    haptics.tick();
    setValueStr('');
  };

  const handleQuickStep = (step: number) => {
    haptics.tickStrong();
    const current = evaluatedQty !== null ? evaluatedQty : 0;
    const nextVal = Math.max(0, Math.round((current + step) * 100) / 100);
    setValueStr(String(nextVal));
    setIsFormulaMode(false);
  };

  const handleSave = () => {
    if (evaluatedQty === null) {
      haptics.warning();
      return;
    }
    haptics.success();
    if (valueStr.trim().startsWith('=')) {
      onConfirm(evaluatedQty, valueStr.trim());
    } else {
      onConfirm(evaluatedQty, undefined);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-surface-container rounded-t-3xl border-t border-outline-variant/30 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden pb-safe animate-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Editor táctil de cantidad"
      >
        {/* Tirador de arrastre */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-outline-variant/40" />
        </div>

        {/* Cabecera del Bottom Sheet */}
        <div className="px-4 py-2 flex items-center justify-between border-b border-outline-variant/20">
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
              Editar Cantidad
            </span>
            <h3 className="text-sm font-semibold text-on-surface truncate">
              {item.descripcion || 'Ítem sin nombre'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Display Central con Cantidad y Previsualización */}
        <div className="p-4 bg-surface-container-low flex flex-col items-center justify-center border-b border-outline-variant/20">
          <div className="flex items-baseline gap-2">
            <span className="font-mono font-extrabold text-3xl sm:text-4xl text-on-surface tracking-tight">
              {valueStr || '0'}
            </span>
            <span className="text-sm font-semibold text-on-surface-variant">
              {item.unidad || 'u'}
            </span>
          </div>

          {/* Resultado estimado o error de fórmula */}
          <div className="mt-1 flex items-center gap-2">
            {evaluatedQty !== null ? (
              <span className="text-xs font-mono font-medium text-primary">
                ≈ {formatARS(estimatedTotalPrice || 0)} Total Venta
              </span>
            ) : (
              <span className="text-xs font-semibold text-error">
                Fórmula con error sintáctico
              </span>
            )}

            {item.parametros && item.parametros.length > 0 && onOpenQuickParams && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenQuickParams(item.id);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-md hover:bg-secondary/20 cursor-pointer"
              >
                <Sliders className="w-3 h-3" />
                <span>{item.parametros.length} params</span>
              </button>
            )}
          </div>
        </div>

        {/* Steppers Rápidos (-10, -1, +1, +10) */}
        <div className="px-4 py-2.5 grid grid-cols-4 gap-2 bg-surface">
          <button
            type="button"
            onClick={() => handleQuickStep(-10)}
            className="py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-xs font-bold font-mono text-on-surface transition-colors cursor-pointer active:scale-95"
          >
            -10
          </button>
          <button
            type="button"
            onClick={() => handleQuickStep(-1)}
            className="py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-xs font-bold font-mono text-on-surface transition-colors cursor-pointer active:scale-95"
          >
            -1
          </button>
          <button
            type="button"
            onClick={() => handleQuickStep(+1)}
            className="py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-xs font-bold font-mono text-on-surface transition-colors cursor-pointer active:scale-95"
          >
            +1
          </button>
          <button
            type="button"
            onClick={() => handleQuickStep(+10)}
            className="py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-xs font-bold font-mono text-on-surface transition-colors cursor-pointer active:scale-95"
          >
            +10
          </button>
        </div>

        {/* Keypad Numérico Táctil Touch-First */}
        {!isFormulaMode ? (
          <div className="px-4 py-2 grid grid-cols-3 gap-2 bg-surface">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeyPress(digit)}
                className="h-12 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest text-lg font-bold font-mono text-on-surface flex items-center justify-center transition-colors cursor-pointer active:scale-95 shadow-2xs"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleDelete}
              className="h-12 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer active:scale-95 shadow-2xs"
              aria-label="Borrar dígito"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="px-4 py-2 flex flex-col gap-2 bg-surface">
            <input
              type="text"
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value)}
              placeholder="=largo * ancho"
              className="w-full px-3 py-2 text-base font-mono bg-surface-container-high border border-outline-variant/40 rounded-xl text-on-surface focus:outline-none focus:border-primary"
            />
            {/* Variables rápidas si existen */}
            {item.parametros && item.parametros.length > 0 && (
              <div className="flex flex-wrap gap-1.5 py-1">
                {item.parametros.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setValueStr((prev) => (prev.endsWith(' ') || prev === '=' ? prev + p.id : prev + ' ' + p.id));
                    }}
                    className="px-2 py-1 text-xs font-mono rounded-lg bg-secondary/15 text-secondary hover:bg-secondary/25 transition-colors cursor-pointer"
                  >
                    +{p.id} ({p.valor})
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Barra Inferior de Acción y Alternar Modo */}
        <div className="p-4 bg-surface flex items-center justify-between gap-3 border-t border-outline-variant/20">
          <button
            type="button"
            onClick={() => {
              haptics.selection();
              if (!isFormulaMode && !valueStr.startsWith('=')) {
                setValueStr('=' + (valueStr || '1') + ' * ');
              }
              setIsFormulaMode(!isFormulaMode);
            }}
            className="px-3 py-2.5 rounded-xl border border-outline-variant/40 text-xs font-bold text-on-surface flex items-center gap-1.5 hover:bg-surface-container-high cursor-pointer min-h-[44px]"
          >
            <Calculator className="w-4 h-4 text-primary" />
            <span>{isFormulaMode ? 'Modo Teclado' : 'Fórmula fx'}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={evaluatedQty === null}
            className="flex-1 py-3 px-4 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-40 min-h-[48px]"
          >
            <Check className="w-4 h-4" />
            <span>Confirmar Cantidad</span>
          </button>
        </div>
      </div>
    </div>
  );
};
