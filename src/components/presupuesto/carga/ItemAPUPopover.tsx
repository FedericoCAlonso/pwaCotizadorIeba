import React, { useRef, useEffect } from 'react';
import { X, Layers, TrendingUp, Building2, Landmark, DollarSign, Package, Zap, Truck } from 'lucide-react';
import { ItemPresupuesto } from '../../../core/types';
import { formatARS, safeNum } from '../../../core/calculations';

interface ItemAPUPopoverProps {
  item: ItemPresupuesto;
  indexNumber?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ItemAPUPopover: React.FC<ItemAPUPopoverProps> = ({
  item,
  indexNumber,
  isOpen,
  onClose
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cant = safeNum(item.cantidad) > 0 ? safeNum(item.cantidad) : 1;
  const costoDirectoTotal = safeNum(item.costoDirectoTotal ?? item.costoTotal);
  const costoInsumos = safeNum(item.costoInsumos);
  const costoMO = safeNum(item.costoManoObra);
  const costoServicios = safeNum(item.costoServiciosTercerizados ?? item.costoServicios);
  const incidencia = safeNum(item.incidencia);
  const indirectos = roundMoneyHelper(safeNum(item.ggAbsolutoProrrateado) + safeNum(item.ggPorcentualItem));
  const beneficio = safeNum(item.beneficioItem);
  const impuestos = safeNum(item.impuestosItem);
  const precioFinalItem = safeNum(item.precioFinalItem ?? item.precioVentaTotal ?? costoDirectoTotal);
  const precioVentaUnitario = safeNum(item.precioVentaUnitario) > 0
    ? safeNum(item.precioVentaUnitario)
    : roundMoneyHelper(precioFinalItem / cant);

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Desglose económico APU"
      className="absolute right-0 top-full mt-1.5 z-40 w-80 sm:w-96 p-4 bg-surface-container-high border border-outline-variant/50 rounded-2xl shadow-xl text-on-surface text-left animate-in fade-in zoom-in-95 duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-outline-variant/30">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Layers className="w-3.5 h-3.5" />
            <span>Desglose Económico APU</span>
            {indexNumber && (
              <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary font-mono text-[10px]">
                #{indexNumber}
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-on-surface truncate mt-0.5" title={item.descripcion}>
            {item.descripcion}
          </p>
          <p className="text-[11px] text-on-surface-variant font-mono">
            Volumen: {item.cantidad} {item.unidad || 'u'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
          aria-label="Cerrar desglose"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Cuerpo del desglose */}
      <div className="py-2.5 space-y-1.5 text-xs font-mono">
        {/* Componentes directos */}
        <div className="flex items-center justify-between text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-primary" />
            <span>Materiales / Insumos:</span>
          </span>
          <span className="font-medium text-on-surface">{formatARS(costoInsumos)}</span>
        </div>

        <div className="flex items-center justify-between text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-secondary" />
            <span>Mano de Obra:</span>
          </span>
          <span className="font-medium text-on-surface">{formatARS(costoMO)}</span>
        </div>

        {costoServicios > 0 && (
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-tertiary" />
              <span>Servicios Tercerizados:</span>
            </span>
            <span className="font-medium text-on-surface">{formatARS(costoServicios)}</span>
          </div>
        )}

        {/* Costo Directo Consolidado */}
        <div className="flex items-center justify-between pt-1.5 border-t border-outline-variant/20 font-semibold text-on-surface">
          <span>Costo Directo Total:</span>
          <span>{formatARS(costoDirectoTotal)}</span>
        </div>

        {incidencia > 0 && (
          <div className="flex items-center justify-between text-[11px] text-on-surface-variant/80">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-secondary" />
              <span>Incidencia en Cotización:</span>
            </span>
            <span className="font-bold text-secondary">{(incidencia * 100).toFixed(1)}%</span>
          </div>
        )}

        {/* Cascadas Indirectas e Impositivas */}
        <div className="pt-2 border-t border-outline-variant/20 space-y-1 text-on-surface-variant">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              <span>Costos Indirectos Prorrateados:</span>
            </span>
            <span>{formatARS(indirectos)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-tertiary" />
              <span>Margen de Beneficio:</span>
            </span>
            <span>{formatARS(beneficio)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-amber-500" />
              <span>Impuestos Asignados:</span>
            </span>
            <span>{formatARS(impuestos)}</span>
          </div>
        </div>
      </div>

      {/* Pie con Precios Finales */}
      <div className="pt-2.5 border-t border-outline-variant/40 bg-surface-container/50 -mx-4 -mb-4 p-3 rounded-b-2xl">
        <div className="flex items-baseline justify-between text-primary">
          <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" />
            <span>Precio Final Venta:</span>
          </span>
          <span className="text-base font-extrabold font-mono">
            {formatARS(precioFinalItem)}
          </span>
        </div>
        <div className="flex items-baseline justify-between text-on-surface-variant text-[11px] font-mono mt-0.5">
          <span>Precio Unitario:</span>
          <span>
            {formatARS(precioVentaUnitario)} / {item.unidad || 'u'}
          </span>
        </div>
      </div>
    </div>
  );
};

function roundMoneyHelper(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}
