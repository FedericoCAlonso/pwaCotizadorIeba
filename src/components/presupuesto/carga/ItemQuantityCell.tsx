import React, { useRef, useEffect, useMemo } from 'react';
import { Edit2 } from 'lucide-react';
import { ItemPresupuesto } from '../../../core/types';
import { evaluateMathExpression } from '../../../core/mathEvaluator';
import { ItemUnidadSelector } from './ItemUnidadSelector';

interface ItemQuantityCellProps {
  item: ItemPresupuesto;
  isEditingQty: boolean;
  editingValue?: string;
  onStartEditQty: () => void;
  onUpdateEditingCellValue: (value: string) => void;
  onCommitEditCell: (field: 'cantidad', finalValue?: string) => void;
  onCancelEditCell: () => void;
  onNavigateCell?: (direction: 'next' | 'prev', fromField: 'descripcion' | 'cantidad') => void;
  onUpdateItemUnidad?: (nuevaUnidad: string) => void;
  calculosVariables?: Record<string, number | string>;
}

export const ItemQuantityCell: React.FC<ItemQuantityCellProps> = ({
  item,
  isEditingQty,
  editingValue = '',
  onStartEditQty,
  onUpdateEditingCellValue,
  onCommitEditCell,
  onCancelEditCell,
  onNavigateCell,
  onUpdateItemUnidad,
  calculosVariables
}) => {
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const unitBtnRef = useRef<HTMLButtonElement>(null);

  // Previsualización evaluada en vivo cuando se edita una fórmula que inicia con '='
  const liveEvaluatedQty = useMemo(() => {
    if (!isEditingQty || !editingValue.trim().startsWith('=')) return null;
    try {
      const scope: Record<string, number> = {};
      if (calculosVariables) {
        for (const [k, v] of Object.entries(calculosVariables)) {
          scope[k] = typeof v === 'number' ? v : Number(v) || 0;
        }
      }
      if (item.parametros) {
        for (const p of item.parametros) {
          scope[p.id] = p.valor;
        }
      }
      const evalRes = evaluateMathExpression(editingValue, scope);
      if (evalRes && evalRes.isValid && typeof evalRes.value === 'number' && !isNaN(evalRes.value)) {
        return Math.round(evalRes.value * 100) / 100;
      }
      return null;
    } catch {
      return null;
    }
  }, [isEditingQty, editingValue, calculosVariables, item.parametros]);

  useEffect(() => {
    if (isEditingQty && qtyInputRef.current) {
      qtyInputRef.current.focus();
      qtyInputRef.current.select();
    }
  }, [isEditingQty]);

  return (
    <div className="relative w-28 sm:w-32 md:w-36 shrink-0 px-2 text-right flex items-center justify-end gap-1">
      {isEditingQty ? (
        <div className="flex items-center justify-end gap-1 w-full">
          {editingValue.startsWith('=') && (
            <span
              className="text-[10px] font-mono font-bold px-1 py-0.2 rounded bg-secondary/20 text-secondary"
            >
              fx
            </span>
          )}
          <input
            ref={qtyInputRef}
            type="text"
            value={editingValue}
            onChange={(e) => onUpdateEditingCellValue(e.target.value)}
            onBlur={(e) => onCommitEditCell('cantidad', e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Tab') {
                e.preventDefault();
                if (e.shiftKey) {
                  onCommitEditCell('cantidad', e.currentTarget.value);
                  if (onNavigateCell) {
                    onNavigateCell('prev', 'cantidad');
                  }
                } else {
                  // Con Tab hacia adelante, enfocar selector de unidad si está presente
                  if (onUpdateItemUnidad && unitBtnRef.current) {
                    unitBtnRef.current.focus();
                  } else {
                    onCommitEditCell('cantidad', e.currentTarget.value);
                    if (onNavigateCell) {
                      onNavigateCell('next', 'cantidad');
                    }
                  }
                }
              } else if (e.key === 'Enter') {
                e.preventDefault();
                onCommitEditCell('cantidad', e.currentTarget.value);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancelEditCell();
              }
            }}
            placeholder="1"
            aria-label="Editar cantidad"
            className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold text-right bg-surface border border-primary rounded-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
          />
          {liveEvaluatedQty !== null && (
            <span
              className="absolute -bottom-5 right-2 z-30 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-primary text-on-primary shadow-md shrink-0 whitespace-nowrap"
              title="Resultado estimado en vivo"
            >
              ≈ {liveEvaluatedQty}
            </span>
          )}
          {onUpdateItemUnidad ? (
            <ItemUnidadSelector
              unidad={item.unidad || 'u'}
              onChangeUnidad={onUpdateItemUnidad}
              buttonRef={unitBtnRef}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Tab') {
                  e.preventDefault();
                  if (e.shiftKey) {
                    qtyInputRef.current?.focus();
                    qtyInputRef.current?.select();
                  } else {
                    onCommitEditCell('cantidad');
                    if (onNavigateCell) {
                      onNavigateCell('next', 'cantidad');
                    }
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancelEditCell();
                }
              }}
            />
          ) : (
            <span className="text-xs font-mono text-on-surface-variant font-medium">
              {item.unidad || 'u'}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartEditQty();
            }}
            onFocus={() => {
              onStartEditQty();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                if (e.shiftKey) {
                  if (onNavigateCell) {
                    onNavigateCell('prev', 'cantidad');
                  }
                } else {
                  if (onUpdateItemUnidad && unitBtnRef.current) {
                    unitBtnRef.current.focus();
                  } else if (onNavigateCell) {
                    onNavigateCell('next', 'cantidad');
                  }
                }
              } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'F2') {
                e.preventDefault();
                onStartEditQty();
              } else if (e.key === 'Backspace') {
                e.preventDefault();
                e.stopPropagation();
                onStartEditQty();
                onUpdateEditingCellValue('');
              } else if (/^[0-9,.=]$/.test(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                onStartEditQty();
                onUpdateEditingCellValue(e.key);
              }
            }}
            className="group/qty flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-surface-container-high border border-transparent hover:border-outline-variant/40 font-mono text-xs text-on-surface hover:text-primary transition-all cursor-pointer text-right focus:outline-none focus:ring-1 focus:ring-primary"
            title="Clic o Tab para editar cantidad o fórmula"
            aria-label={`Editar cantidad: ${item.cantidad}`}
          >
            {item.formulaCantidad ? (
              <span
                className="flex items-center gap-1 text-secondary font-semibold"
                title={`Fórmula: ${item.formulaCantidad}`}
              >
                <span className="text-[10px] px-1 py-0.2 rounded bg-secondary/15 text-secondary">
                  fx
                </span>
                <span>{item.cantidad}</span>
              </span>
            ) : (
              <span>{item.cantidad}</span>
            )}
            <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover/qty:opacity-70 text-on-surface-variant transition-opacity ml-0.5 shrink-0" />
          </button>

          {/* Selector interactivo de unidad de medida */}
          {onUpdateItemUnidad ? (
            <ItemUnidadSelector
              unidad={item.unidad || 'u'}
              onChangeUnidad={onUpdateItemUnidad}
              buttonRef={unitBtnRef}
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                  e.preventDefault();
                  if (e.shiftKey) {
                    onStartEditQty();
                  } else {
                    if (onNavigateCell) {
                      onNavigateCell('next', 'cantidad');
                    }
                  }
                }
              }}
            />
          ) : (
            <span className="text-xs font-mono text-on-surface-variant font-medium">
              {item.unidad || 'u'}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
