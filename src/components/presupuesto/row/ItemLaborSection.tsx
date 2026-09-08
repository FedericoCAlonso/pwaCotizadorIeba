import React, { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { ItemPresupuesto, CategoriaManoDeObra } from '../../../core/types';
import { formatARS, safeNum } from '../../../core/calculations';
import { MathInput } from '../../common/MathInput';

interface ItemLaborSectionProps {
  item: ItemPresupuesto;
  index: number;
  isItemLibre: boolean;
  categoriasManoObra?: CategoriaManoDeObra[];
  onUpdateItemLaborHours?: (itemIndex: number, laborIndex: number, newHours: number | null) => void;
  onRemoveItemLabor?: (itemIndex: number, laborIndex: number) => void;
  onAddLaborRole?: (itemIndex: number, categoriaId: string, horas: number) => void;
}

export const ItemLaborSection: React.FC<ItemLaborSectionProps> = ({
  item,
  index,
  isItemLibre,
  categoriasManoObra,
  onUpdateItemLaborHours,
  onRemoveItemLabor,
  onAddLaborRole
}) => {
  const [showAddLaborInline, setShowAddLaborInline] = useState(false);
  const [newLaborCatId, setNewLaborCatId] = useState<string>('');
  const [newLaborHours, setNewLaborHours] = useState<number | null>(4);

  if (!isItemLibre && (!item.manoObraSnapshot || item.manoObraSnapshot.length === 0)) {
    return null;
  }

  return (
    <div className="space-y-2 pt-2.5 border-t border-outline-variant/20">
      <div className="flex justify-between items-center text-sm sm:text-base font-bold text-primary tracking-wide">
        <span>Mano de Obra ({item.manoObraSnapshot?.length || 0})</span>
        <span className="font-mono text-base">{formatARS(item.costoManoObra || 0)}</span>
      </div>

      {item.manoObraSnapshot && item.manoObraSnapshot.length > 0 ? (
        <div className="space-y-1.5 divide-y divide-outline-variant/10">
          {item.manoObraSnapshot.map((mo, mIdx) => (
            <div key={mIdx} className="pt-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 text-on-surface-variant text-sm">
              <span className="truncate flex-1 min-w-[130px] font-semibold text-on-surface text-sm">{mo.nombreCategoria}</span>
              <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3.5 font-mono shrink-0 w-full sm:w-auto text-sm">
                {onUpdateItemLaborHours ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-22 sm:w-28">
                      <MathInput
                        value={mo.horasTotales}
                        onChange={(val) => onUpdateItemLaborHours(index, mIdx, val)}
                        size="sm"
                        min={0.1}
                        step={0.5}
                        suffix="hs"
                        inputMode="decimal"
                      />
                    </div>
                    <span className="text-xs sm:text-sm text-on-surface-variant">× {formatARS(mo.costoHoraCongelado)}/h</span>
                  </div>
                ) : (
                  <span>
                    {mo.horasTotales} hs × {formatARS(mo.costoHoraCongelado)}/h
                  </span>
                )}
                <strong className="text-on-surface font-bold text-sm sm:text-base">{formatARS(mo.subtotalManoObra)}</strong>

                {onRemoveItemLabor && (
                  <button
                    type="button"
                    onClick={() => onRemoveItemLabor(index, mIdx)}
                    className="p-2 text-on-surface-variant hover:text-error rounded-xl transition min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                    title="Quitar rol"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs sm:text-sm text-on-surface-variant/70 italic py-1.5">
          Sin roles de mano de obra asignados por horas.
        </p>
      )}

      {/* Inline Labor Adder */}
      {isItemLibre && onAddLaborRole && categoriasManoObra && categoriasManoObra.length > 0 && (
        <div className="pt-2">
          {showAddLaborInline ? (
            <div className="p-3 bg-surface-container rounded-xl sm:rounded-2xl border border-outline-variant/30 flex flex-wrap items-center gap-2.5 animate-in fade-in-50 duration-150">
              <select
                value={newLaborCatId || categoriasManoObra[0]?.id || ''}
                onChange={(e) => setNewLaborCatId(e.target.value)}
                className="bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm font-semibold text-on-surface focus:outline-none flex-1 min-w-[150px] min-h-[42px]"
              >
                {categoriasManoObra.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({formatARS(c.costoHora)}/h)
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm text-on-surface-variant font-mono">Horas:</span>
                <div className="w-22 sm:w-28">
                  <MathInput
                    value={newLaborHours}
                    onChange={(val) => setNewLaborHours(val)}
                    fallbackOnBlur={4}
                    size="sm"
                    min={0.1}
                    step={0.5}
                    suffix="hs"
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    const targetCatId = newLaborCatId || categoriasManoObra[0]?.id;
                    if (targetCatId) {
                      onAddLaborRole(index, targetCatId, safeNum(newLaborHours) || 4);
                      setShowAddLaborInline(false);
                    }
                  }}
                  className="px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary/90 transition shadow-2xs min-h-[42px] cursor-pointer"
                >
                  Asignar
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddLaborInline(false)}
                  className="px-3 py-2 text-sm text-on-surface-variant hover:text-on-surface rounded-xl transition min-h-[42px] cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNewLaborCatId(categoriasManoObra[0]?.id || '');
                setShowAddLaborInline(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 rounded-xl transition min-h-[38px] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Asignar rol de mano de obra</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
