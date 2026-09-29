import React, { useState } from 'react';
import {
  Plus,
  Minus,
  Trash2,
  Wrench,
  Check
} from 'lucide-react';
import { ManoObraSnapshot, CategoriaManoDeObra } from '../../../../../core/types';
import { formatARS, safeNum, roundMoney } from '../../../../../core/calculations';
import { useHaptics } from '../../../../../hooks/useHaptics';

export interface MobileDetailLaborTabProps {
  manoObra: ManoObraSnapshot[];
  manoObraMap: Map<string, CategoriaManoDeObra>;
  onAddLabor: (categoriaId: string, horas: number, formula?: string) => void;
  onRemoveLabor: (index: number) => void;
  onUpdateLaborFormula: (index: number, formula: string) => void;
}

export const MobileDetailLaborTab: React.FC<MobileDetailLaborTabProps> = ({
  manoObra,
  manoObraMap,
  onAddLabor,
  onRemoveLabor,
  onUpdateLaborFormula
}) => {
  const haptics = useHaptics();
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [newHours, setNewHours] = useState<number>(1);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [formulaValue, setFormulaValue] = useState<string>('');

  const categorias = Array.from(manoObraMap.values());

  const handleStepHours = (idx: number, delta: number) => {
    haptics.tick();
    const mo = manoObra[idx];
    if (!mo) return;
    const current = safeNum(mo.horasTotales);
    const nextVal = Math.max(0, roundMoney(current + delta));
    onUpdateLaborFormula(idx, String(nextVal));
  };

  const handleCommitFormula = (idx: number) => {
    if (formulaValue.trim()) {
      onUpdateLaborFormula(idx, formulaValue.trim());
    }
    setEditingIdx(null);
  };

  const handleAddCategory = () => {
    if (!selectedCatId) return;
    haptics.success();
    onAddLabor(selectedCatId, newHours);
    setSelectedCatId('');
    setNewHours(1);
  };

  return (
    <div className="space-y-3 pb-6 select-none">
      {/* Listado de Mano de Obra */}
      {manoObra.length === 0 ? (
        <div className="p-6 text-center rounded-2xl bg-surface-container-low border border-dashed border-outline-variant/30 text-on-surface-variant">
          <p className="text-sm font-semibold mb-1 text-on-surface">Sin Mano de Obra Asignada</p>
          <p className="text-xs max-w-xs mx-auto mb-2 opacity-80">
            Agregá horas de instalador, oficial o ayudante utilizando el selector debajo.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {manoObra.map((mo, idx) => {
            const isEditing = editingIdx === idx;
            const displayHs = mo.formulaHoras || String(mo.horasTotales);

            return (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-surface border border-outline-variant/25 shadow-2xs space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs sm:text-sm font-bold text-on-surface leading-tight truncate">
                      {mo.nombreCategoria || manoObraMap.get(mo.categoriaId)?.nombre || mo.categoriaId || 'Categoría laboral'}
                    </h5>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      haptics.warning();
                      onRemoveLabor(idx);
                    }}
                    className="p-2 -mr-1 -mt-1 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-xl transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Eliminar cuadrilla"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Stepper de Horas y Subtotal */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-outline-variant/15">
                  <div className="flex items-center rounded-xl bg-surface-container-high border border-outline-variant/30 overflow-hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStepHours(idx, -0.5)}
                      className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface active:bg-surface-container-highest cursor-pointer"
                      aria-label="Restar media hora"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        haptics.selection();
                        setEditingIdx(idx);
                        setFormulaValue(displayHs);
                      }}
                      className={`px-3 h-10 font-mono text-xs font-bold flex items-center gap-1 border-x border-outline-variant/20 cursor-pointer ${
                        mo.formulaHoras ? 'bg-secondary/15 text-secondary' : 'text-on-surface'
                      }`}
                      title="Editar horas o fórmula"
                    >
                      {mo.formulaHoras && <span className="text-[10px]">fx</span>}
                      <span>{mo.horasTotales}</span>
                      <span className="text-[11px] text-on-surface-variant font-normal">hs</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStepHours(idx, 0.5)}
                      className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface active:bg-surface-container-highest cursor-pointer"
                      aria-label="Sumar media hora"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-right min-w-0">
                    <div className="font-mono font-extrabold text-xs sm:text-sm text-on-surface truncate">
                      {formatARS(mo.subtotalManoObra)}
                    </div>
                    <div className="text-[10px] font-mono text-on-surface-variant truncate">
                      Valor/h: {formatARS(mo.costoHoraCongelado || 0)}
                    </div>
                  </div>
                </div>

                {isEditing && (
                  <div className="pt-2 flex items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={formulaValue}
                      onChange={(e) => setFormulaValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitFormula(idx);
                        if (e.key === 'Escape') setEditingIdx(null);
                      }}
                      placeholder="Horas o fórmula =..."
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

      {/* Selector para Incorporar Categoría */}
      <div className="p-3 rounded-2xl bg-surface-container-high/60 border border-outline-variant/30 space-y-2">
        <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
          + Incorporar Categoría Laboral
        </span>
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <select
            value={selectedCatId}
            onChange={(e) => setSelectedCatId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary min-h-[44px]"
          >
            <option value="">Seleccionar Categoría (Oficial, Ayudante...)</option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre} — {formatARS(cat.costoHora)}/h
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={newHours}
              onChange={(e) => setNewHours(Math.max(0.5, Number(e.target.value) || 1))}
              className="w-20 px-3 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-xs font-mono font-bold text-center text-on-surface focus:outline-none min-h-[44px]"
              title="Horas iniciales"
            />
            <button
              type="button"
              disabled={!selectedCatId}
              onClick={handleAddCategory}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-secondary text-on-secondary font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 min-h-[44px] active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
