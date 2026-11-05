import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import { ItemPresupuesto } from '../../../core/types';
import { formatARS, safeNum, roundMoney } from '../../../core/calculations';

export interface SmartSheetNarrowCascadaProps {
  selectedItem: ItemPresupuesto | null;
  calculatedItem: ItemPresupuesto | null;
}

/**
 * SmartSheetNarrowCascada: Bloque plegable de la Cascada APU para pantallas angostas (< 700px).
 * Plegado por defecto para maximizar el espacio de las líneas; se expande con un clic.
 */
export const SmartSheetNarrowCascada: React.FC<SmartSheetNarrowCascadaProps> = ({
  selectedItem,
  calculatedItem
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const item = calculatedItem || selectedItem;

  if (!item) return null;

  const cant = safeNum(item.cantidad) > 0 ? safeNum(item.cantidad) : 1;
  const costoDirecto = safeNum(item.costoDirectoTotal ?? item.costoTotal);
  const gastosGenerales = roundMoney(
    safeNum(item.ggAbsolutoProrrateado) + safeNum(item.ggPorcentualItem) + safeNum(item.montoMargenRiesgoItem)
  );
  const beneficio = safeNum(item.beneficioItem);
  const subtotalNeto = safeNum(item.subtotalItem || item.precioVentaTotal || (costoDirecto + gastosGenerales + beneficio));
  const impuestos = safeNum(item.impuestosItem);
  const precioFinal = safeNum(item.precioFinalItem ?? item.precioVentaTotal ?? costoDirecto);
  const precioUnitario = safeNum(item.precioVentaUnitario) > 0
    ? safeNum(item.precioVentaUnitario)
    : roundMoney(precioFinal / cant);

  return (
    <div className="bg-surface-container border-t border-outline-variant/30 text-xs font-sans select-none shrink-0">
      {/* Botón de alternancia plegable */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-3 py-2 flex items-center justify-between text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 font-semibold text-secondary">
          <Calculator className="w-3.5 h-3.5" />
          <span>Cascada APU (Costos y Precio Final)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-primary">
            {formatARS(precioFinal)}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-on-surface-variant" /> : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
        </div>
      </button>

      {/* Desglose de la cascada visible solo al expandir */}
      {isOpen && (
        <div className="p-3 bg-surface-container-low border-t border-outline-variant/20 space-y-1.5 animate-in slide-in-from-top-2 duration-150 text-[11px]">
          <div className="flex justify-between items-center text-on-surface-variant">
            <span>Costo Directo Total:</span>
            <span className="font-mono font-medium text-on-surface">{formatARS(costoDirecto)}</span>
          </div>
          {gastosGenerales > 0 && (
            <div className="flex justify-between items-center text-on-surface-variant">
              <span>Gastos Generales:</span>
              <span className="font-mono font-medium text-on-surface">{formatARS(gastosGenerales)}</span>
            </div>
          )}
          {beneficio > 0 && (
            <div className="flex justify-between items-center text-on-surface-variant">
              <span>Beneficio:</span>
              <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{formatARS(beneficio)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-on-surface-variant pt-1 border-t border-outline-variant/15">
            <span>Subtotal Neto:</span>
            <span className="font-mono font-semibold text-on-surface">{formatARS(subtotalNeto)}</span>
          </div>
          {impuestos > 0 && (
            <div className="flex justify-between items-center text-on-surface-variant">
              <span>Impuestos (IVA):</span>
              <span className="font-mono font-medium text-on-surface">{formatARS(impuestos)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-xs font-bold pt-1.5 border-t border-outline-variant/30 text-primary">
            <span>Precio Final ({cant} {item.unidad || 'u'}):</span>
            <span className="font-mono">{formatARS(precioFinal)}</span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-on-surface-variant/70 italic">
            <span>Unitario:</span>
            <span className="font-mono">{formatARS(precioUnitario)} / {item.unidad || 'u'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
