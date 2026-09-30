import React, { useRef, useEffect, useMemo } from 'react';
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
        <div className="absolute right-1 top-1/2 -translate-y-1/2 z-30 flex items-center gap-1.5 p-1 bg-surface border border-primary rounded-xl shadow-lg min-w-[200px] sm:min-w-[280px] md:min-w-[340px]">
          <span
            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
              editingValue.startsWith('=')
                ? 'bg-secondary/20 text-secondary'
                : 'text-on-surface-variant'
            }`}
          >
            fx
          </span>
          <input
            ref={qtyInputRef}
            type="text"
            value={editingValue}
            onChange={(e) => onUpdateEditingCellValue(e.target.value)}
            onBlur={(e) => onCommitEditCell('cantidad', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                onCommitEditCell('cantidad', e.currentTarget.value);
                if (onNavigateCell) {
                  onNavigateCell(e.shiftKey ? 'prev' : 'next', 'cantidad');
                }
              } else if (e.key === 'Enter') {
                e.preventDefault();
                onCommitEditCell('cantidad', e.currentTarget.value);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancelEditCell();
              }
            }}
            placeholder="10 o =superficie * 2"
            className="flex-1 px-2 py-1 text-xs font-mono bg-surface border border-outline-variant/40 rounded-lg text-on-surface focus:outline-none focus:border-primary"
          />
          {liveEvaluatedQty !== null && (
            <span
              className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-primary-container text-on-primary-container shrink-0"
              title="Resultado estimado en vivo"
            >
              ≈ {liveEvaluatedQty}
            </span>
          )}
          {onUpdateItemUnidad && (
            <ItemUnidadSelector
              unidad={item.unidad || 'u'}
              onChangeUnidad={onUpdateItemUnidad}
            />
          )}
        </div>
      ) : (
        <div className="flex items-center justify-end gap-1">
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              onStartEditQty();
            }}
            className="font-mono text-xs text-on-surface hover:text-primary transition-colors cursor-text"
            title="Doble clic para editar cantidad o fórmula"
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
          </span>

          {/* Selector interactivo de unidad de medida */}
          {onUpdateItemUnidad ? (
            <ItemUnidadSelector
              unidad={item.unidad || 'u'}
              onChangeUnidad={onUpdateItemUnidad}
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
