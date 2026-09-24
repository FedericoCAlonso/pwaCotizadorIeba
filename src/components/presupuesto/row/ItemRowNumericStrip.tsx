import React from 'react';
import { ItemPresupuesto } from '../../../core/types';
import { formatARS, roundMoney } from '../../../core/calculations';
import { MathInput } from '../../common/MathInput';

interface ItemRowNumericStripProps {
  item: ItemPresupuesto;
  index: number;
  calcItem: ItemPresupuesto;
  isItemLibre: boolean;
  hasSnapshots: boolean;
  condicionesTrabajo: Array<{ value: string; label: string }>;
  onUpdateItemQuantity: (index: number, qty: number | null, formula?: string) => void;
  onUpdateItemUnit: (index: number, unit: string) => void;
  onUpdateItemCondicion: (index: number, condicion: 'normal' | 'dificultosa' | 'favorable') => void;
  onUpdateItemUnitDirectCost: (index: number, cost: number | null) => void;
  onUpdateItemManoObraCost?: (index: number, moCost: number | null) => void;
  onEnterAtEnd?: () => void;
}

export const ItemRowNumericStrip: React.FC<ItemRowNumericStripProps> = ({
  item,
  index,
  calcItem,
  isItemLibre,
  hasSnapshots,
  condicionesTrabajo,
  onUpdateItemQuantity,
  onUpdateItemUnit,
  onUpdateItemCondicion,
  onUpdateItemUnitDirectCost,
  onUpdateItemManoObraCost,
  onEnterAtEnd
}) => {
  return (
    <div className="bg-surface-container/40 rounded-2xl p-3 sm:p-4 border border-outline-variant/20 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
      {/* Bloque Cómputo: Cantidad, Unidad, Condición de Obra */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 flex-wrap sm:flex-nowrap flex-1">
        {/* Cantidad */}
        <div className="flex flex-col gap-1 w-28 sm:w-36 flex-1 sm:flex-none">
          <span className="text-xs sm:text-sm font-bold text-on-surface-variant">Cantidad</span>
          <MathInput
            value={item.cantidad}
            formula={item.formulaCantidad}
            onChange={(val, form) => onUpdateItemQuantity(index, val, form)}
            suffix={item.unidad}
            size="md"
            fallbackOnBlur={1}
            min={0.01}
            step={0.1}
          />
        </div>

        {/* Unidad */}
        <div className="flex flex-col gap-1 w-18 sm:w-24">
          <span className="text-xs sm:text-sm font-bold text-on-surface-variant text-center">Unidad</span>
          <input
            type="text"
            value={item.unidad}
            onChange={(e) => onUpdateItemUnit(index, e.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-2.5 py-2 text-sm sm:text-base text-on-surface text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-2xs min-h-[44px]"
            title="Unidad de medida (ej: u, boca, m, gl)"
          />
        </div>

        {/* Condición de Obra */}
        <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
          <span className="text-xs sm:text-sm font-bold text-on-surface-variant">Condición</span>
          <select
            value={item.condicionTrabajo || 'normal'}
            onChange={(e) => onUpdateItemCondicion(index, e.target.value as any)}
            className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-3 pr-8 py-2 text-sm sm:text-base text-on-surface font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-2xs min-h-[44px]"
            title="Condición de trabajo en obra (afecta rendimiento de MO)"
          >
            {condicionesTrabajo.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bloque Económico: Costo Base y Precio de Venta */}
      <div className="flex items-center justify-between sm:justify-end gap-3.5 sm:gap-5 pt-2.5 lg:pt-0 border-t lg:border-t-0 lg:border-l border-outline-variant/20 lg:pl-5 shrink-0">
        {/* Costo Directo / Insumos / Mano de Obra */}
        <div className="flex flex-col gap-1 min-w-[120px]">
          <span className="text-xs sm:text-sm font-bold text-on-surface-variant">Costo Base</span>
          {isItemLibre ? (
            hasSnapshots ? (
              <div className="flex flex-col gap-1 text-xs sm:text-sm">
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="font-bold text-on-surface-variant">Insumos:</span>
                  <span className="font-bold text-primary">
                    {formatARS(calcItem.costoInsumos || item.costoInsumos || 0)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-on-surface-variant">M. Obra:</span>
                  {item.manoObraSnapshot && item.manoObraSnapshot.length > 0 ? (
                    <span
                      className="font-bold text-primary font-mono text-sm"
                      title="Calculado por horas en el desglose de roles"
                    >
                      {formatARS(item.costoManoObra || 0)}
                    </span>
                  ) : (
                    <div className="w-28 sm:w-32" title="Mano de obra o adicionales directos para esta partida">
                      <MathInput
                        value={item.costoManoObra}
                        onChange={(val) =>
                          onUpdateItemManoObraCost
                            ? onUpdateItemManoObraCost(index, val)
                            : onUpdateItemUnitDirectCost(index, val)
                        }
                        prefix="$"
                        size="md"
                        min={0}
                        step={100}
                        placeholder="0"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-32 sm:w-36">
                <MathInput
                  value={
                    item.costoUnitario !== undefined
                      ? item.costoUnitario
                      : roundMoney((item.costoDirectoTotal || 0) / (item.cantidad || 1))
                  }
                  onChange={(val) => onUpdateItemUnitDirectCost(index, val)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter' && onEnterAtEnd) {
                      e.preventDefault();
                      onEnterAtEnd();
                    }
                  }}
                  prefix="$"
                  size="md"
                  min={0}
                  step={1}
                />
              </div>
            )
          ) : (
            <div className="font-mono text-xs sm:text-sm">
              <span className="font-bold text-on-surface-variant block">Directo:</span>
              <span className="font-bold text-on-surface text-sm sm:text-base">
                {formatARS(calcItem.costoDirectoTotal ?? item.costoDirectoTotal)}
              </span>
            </div>
          )}
        </div>

        {/* Total Venta Partida */}
        <div className="bg-primary/10 border border-primary/25 px-4 py-2.5 rounded-2xl flex flex-col items-end text-right shrink-0">
          <span className="text-xs sm:text-sm font-bold text-primary tracking-wider uppercase">Venta Total</span>
          <div className="font-mono font-black text-xl sm:text-2xl text-primary leading-tight">
            {formatARS(calcItem.precioVentaClienteTotal ?? item.precioVentaTotal)}
          </div>
          <span className="text-xs sm:text-sm font-mono text-primary/80">
            ({formatARS(calcItem.precioVentaClienteUnitario ?? item.precioVentaUnitario)}/{item.unidad || 'u'})
          </span>
        </div>
      </div>
    </div>
  );
};
