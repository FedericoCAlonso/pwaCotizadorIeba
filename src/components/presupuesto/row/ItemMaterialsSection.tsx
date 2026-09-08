import React from 'react';
import { Tag, ChevronDown, Trash2, Plus } from 'lucide-react';
import { ItemPresupuesto } from '../../../core/types';
import { formatARS } from '../../../core/calculations';
import { OnlinePriceButton } from '../../OnlinePriceButton';
import { MathInput } from '../../common/MathInput';

interface ItemMaterialsSectionProps {
  item: ItemPresupuesto;
  index: number;
  onOpenMaterialBrandModal?: (itemIndex: number, materialIndex: number) => void;
  onUpdateItemMaterialQuantity?: (itemIndex: number, materialIndex: number, newQty: number | null) => void;
  onRemoveItemMaterial?: (itemIndex: number, materialIndex: number) => void;
  onOpenMaterialPicker?: (index: number) => void;
}

export const ItemMaterialsSection: React.FC<ItemMaterialsSectionProps> = ({
  item,
  index,
  onOpenMaterialBrandModal,
  onUpdateItemMaterialQuantity,
  onRemoveItemMaterial,
  onOpenMaterialPicker
}) => {
  if (!item.insumosSnapshot || item.insumosSnapshot.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm sm:text-base font-bold text-primary tracking-wide">
        <span>Materiales e Insumos ({item.insumosSnapshot.length})</span>
        <span className="font-mono text-base">{formatARS(item.costoInsumos)}</span>
      </div>
      <div className="space-y-1.5 divide-y divide-outline-variant/10">
        {item.insumosSnapshot.map((ins, iIdx) => (
          <div key={iIdx} className="pt-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 text-on-surface-variant text-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2.5 truncate flex-1 min-w-[130px]">
              <div className="flex items-center gap-2 truncate">
                <span className="truncate font-semibold text-on-surface text-sm">{ins.nombre}</span>
                <OnlinePriceButton tipo="material" customNombre={ins.nombre} size="xs" variant="icon" />
              </div>

              {/* Selector / Badge de Marca & Modelo */}
              {onOpenMaterialBrandModal ? (
                <button
                  type="button"
                  onClick={() => onOpenMaterialBrandModal(index, iIdx)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-medium border transition-all shrink-0 max-w-fit min-h-[30px] cursor-pointer ${
                    ins.marca
                      ? 'bg-primary/10 text-primary border-primary/25 hover:bg-primary/20'
                      : 'bg-surface-variant/50 text-on-surface-variant/80 border-outline-variant/30 hover:bg-surface-variant hover:text-on-surface'
                  }`}
                  title="Asignar o cambiar marca y modelo de este material en la cotización"
                >
                  <Tag className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate max-w-[140px] sm:max-w-[180px]">
                    {ins.marca || 'Asignar marca...'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
                </button>
              ) : (
                ins.marca && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-primary/10 text-primary border border-primary/25 shrink-0 max-w-fit">
                    <Tag className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[140px] sm:max-w-[180px]">{ins.marca}</span>
                  </span>
                )
              )}
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3.5 font-mono shrink-0 w-full sm:w-auto text-sm">
              {onUpdateItemMaterialQuantity ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-22 sm:w-28">
                    <MathInput
                      value={ins.cantidadTotal}
                      onChange={(val) => onUpdateItemMaterialQuantity(index, iIdx, val)}
                      size="sm"
                      min={0.01}
                      step={0.5}
                      inputMode="decimal"
                    />
                  </div>
                  <span className="text-xs sm:text-sm text-on-surface-variant min-w-[18px]">{ins.unidad}</span>
                  <span className="text-on-surface-variant opacity-75">× {formatARS(ins.precioUnitarioCongelado)}</span>
                </div>
              ) : (
                <span>
                  {ins.cantidadTotal} {ins.unidad} × {formatARS(ins.precioUnitarioCongelado)}
                </span>
              )}
              <strong className="text-on-surface font-bold text-sm sm:text-base">{formatARS(ins.subtotalInsumo)}</strong>
              {onRemoveItemMaterial && (
                <button
                  type="button"
                  onClick={() => onRemoveItemMaterial(index, iIdx)}
                  className="p-2 text-on-surface-variant/60 hover:text-error hover:bg-error-container/20 rounded-xl transition shrink-0 min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                  title="Quitar este material de la partida"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {onOpenMaterialPicker && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => onOpenMaterialPicker(index)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 rounded-xl transition min-h-[38px] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar más materiales</span>
          </button>
        </div>
      )}
    </div>
  );
};
