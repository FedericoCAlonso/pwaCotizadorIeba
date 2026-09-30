import React, { useState } from 'react';
import {
  Plus,
  Minus,
  Trash2,
  BookOpen,
  Calculator,
  Check
} from 'lucide-react';
import { Insumo, InsumoSnapshot } from '../../../../../core/types';
import { formatARS, safeNum, roundMoney } from '../../../../../core/calculations';
import { useHaptics } from '../../../../../hooks/useHaptics';

export interface MobileDetailMaterialsTabProps {
  insumos: InsumoSnapshot[];
  itemCantidad: number;
  insumosMap: Map<string, Insumo>;
  onAddMaterial: (material: Insumo, cantidad: number, formula?: string) => void;
  onRemoveMaterial: (index: number) => void;
  onUpdateMaterialFormula: (index: number, formula: string) => void;
  onOpenMaterialCatalog: () => void;
}

export const MobileDetailMaterialsTab: React.FC<MobileDetailMaterialsTabProps> = ({
  insumos,
  itemCantidad,
  onRemoveMaterial,
  onUpdateMaterialFormula,
  onOpenMaterialCatalog
}) => {
  const haptics = useHaptics();
  const [editingFormulaIdx, setEditingFormulaIdx] = useState<number | null>(null);
  const [formulaValue, setFormulaValue] = useState<string>('');

  const handleStartFormula = (idx: number, currentVal: string) => {
    haptics.selection();
    setEditingFormulaIdx(idx);
    setFormulaValue(currentVal);
  };

  const handleCommitFormula = (idx: number) => {
    if (formulaValue.trim()) {
      onUpdateMaterialFormula(idx, formulaValue.trim());
    }
    setEditingFormulaIdx(null);
  };

  const handleStepQty = (idx: number, delta: number) => {
    haptics.tick();
    const ins = insumos[idx];
    if (!ins) return;
    const current = safeNum(ins.cantidadTotal);
    const nextVal = Math.max(0, roundMoney(current + delta));
    onUpdateMaterialFormula(idx, String(nextVal));
  };

  return (
    <div className="space-y-3 pb-6 select-none">
      {/* Listado de Insumos */}
      {insumos.length === 0 ? (
        <div className="p-6 text-center rounded-2xl bg-surface-container-low border border-dashed border-outline-variant/30 text-on-surface-variant">
          <p className="text-sm font-semibold mb-1 text-on-surface">Sin Materiales Incorporados</p>
          <p className="text-xs max-w-xs mx-auto mb-4 opacity-80">
            Este ítem no tiene cómputo de insumos. Agregá cables, caños o artefactos desde el catálogo.
          </p>
          <button
            type="button"
            onClick={() => {
              haptics.selection();
              onOpenMaterialCatalog();
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-xs cursor-pointer active:scale-95"
          >
            <BookOpen className="w-4 h-4" />
            <span>Explorar Catálogo</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {insumos.map((ins, idx) => {
            const isEditing = editingFormulaIdx === idx;
            const displayQty = ins.formulaCantidad || String(ins.cantidadTotal);

            return (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-surface border border-outline-variant/25 shadow-2xs space-y-2"
              >
                {/* Cabecera del Insumo */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs sm:text-sm font-bold text-on-surface leading-tight break-words">
                      {ins.nombre}
                    </h5>
                    {ins.marca && (
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        Marca: {ins.marca}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      haptics.warning();
                      onRemoveMaterial(idx);
                    }}
                    className="p-2 -mr-1 -mt-1 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-xl transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Eliminar insumo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Fila de Cantidad, Stepper y Precios */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-outline-variant/15">
                  {/* Stepper Táctil */}
                  <div className="flex items-center rounded-xl bg-surface-container-high border border-outline-variant/30 overflow-hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStepQty(idx, -1)}
                      className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface active:bg-surface-container-highest cursor-pointer"
                      aria-label="Restar 1"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartFormula(idx, displayQty)}
                      className={`px-3 h-10 font-mono text-xs font-bold flex items-center gap-1 border-x border-outline-variant/20 cursor-pointer ${
                        ins.formulaCantidad ? 'bg-secondary/15 text-secondary' : 'text-on-surface'
                      }`}
                      title="Editar fórmula o cantidad"
                    >
                      {ins.formulaCantidad && <span className="text-[10px]">fx</span>}
                      <span>{ins.cantidadTotal}</span>
                      <span className="text-[11px] text-on-surface-variant font-normal">
                        {ins.unidad || 'u'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStepQty(idx, 1)}
                      className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface active:bg-surface-container-highest cursor-pointer"
                      aria-label="Sumar 1"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Precios Unitario y Subtotal */}
                  <div className="text-right min-w-0">
                    <div className="font-mono font-extrabold text-xs sm:text-sm text-on-surface truncate">
                      {formatARS(ins.subtotalInsumo)}
                    </div>
                    <div className="text-[10px] font-mono text-on-surface-variant truncate">
                      PU: {formatARS(ins.precioUnitarioCongelado)}
                    </div>
                  </div>
                </div>

                {/* Editor de Fórmula si está activo */}
                {isEditing && (
                  <div className="pt-2 flex items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={formulaValue}
                      onChange={(e) => setFormulaValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitFormula(idx);
                        if (e.key === 'Escape') setEditingFormulaIdx(null);
                      }}
                      placeholder="15 o =superficie * 2.5"
                      className="flex-1 px-3 py-2 text-sm font-mono bg-surface-container-high border border-primary rounded-xl text-on-surface focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCommitFormula(idx)}
                      className="px-3 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center gap-1 cursor-pointer min-h-[40px]"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Botón de Inserción Rápida desde Catálogo */}
      <button
        type="button"
        onClick={() => {
          haptics.selection();
          onOpenMaterialCatalog();
        }}
        className="w-full py-3 px-4 rounded-2xl bg-surface-container-highest hover:bg-outline-variant/30 border border-outline-variant/40 text-on-surface font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 min-h-[48px] shadow-2xs"
      >
        <BookOpen className="w-4 h-4 text-primary" />
        <span>+ Agregar Insumo desde Catálogo</span>
      </button>
    </div>
  );
};
