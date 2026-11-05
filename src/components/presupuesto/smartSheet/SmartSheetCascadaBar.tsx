import React from 'react';
import {
  ArrowRight,
  Building2,
  TrendingUp,
  Receipt,
  Landmark,
  DollarSign,
  Layers,
  Sparkles
} from 'lucide-react';
import { ItemPresupuesto } from '../../../core/types';
import { formatARS, safeNum, roundMoney } from '../../../core/calculations';

/**
 * Propiedades del panel de Cascada APU de costos (Zona 3).
 */
export interface SmartSheetCascadaBarProps {
  /** Ítem seleccionado para visualizar su cascada */
  selectedItem: ItemPresupuesto | null;
  /** Ítem con valores calculados por el motor de cálculo */
  calculatedItem: ItemPresupuesto | null;
}

/**
 * SmartSheetCascadaBar: Zona 3 (abajo, solo lectura) de la planilla inteligente.
 * Muestra la cascada económica exacta del ítem seleccionado:
 * Costo Directo → Gastos Generales → Beneficio → Subtotal → Impuestos → Precio Final.
 * Utiliza determinísticamente los valores calculados por el motor de cálculo (sin reimplementación).
 */
export const SmartSheetCascadaBar: React.FC<SmartSheetCascadaBarProps> = ({
  selectedItem,
  calculatedItem
}) => {
  const item = calculatedItem || selectedItem;

  if (!item) {
    return (
      <div
        className="px-4 py-2.5 bg-surface-container border-t border-outline-variant/30 text-xs text-on-surface-variant text-center select-none shrink-0"
        role="region"
        aria-label="Zona 3: Cascada del ítem seleccionado"
      >
        <span className="italic text-on-surface-variant/70">
          Zona 3 · Cascada: Selecciona un ítem para visualizar su desglose económico (Costo Directo → GG → Beneficio → Subtotal → Impuestos → Precio Final).
        </span>
      </div>
    );
  }

  // Lectura directa de los valores calculados por calcularTotalesPresupuesto (cero reimplementación)
  const cant = safeNum(item.cantidad) > 0 ? safeNum(item.cantidad) : 1;
  const costoDirectoTotal = safeNum(item.costoDirectoTotal ?? item.costoTotal);
  const ggIndirectos = roundMoney(
    safeNum(item.ggAbsolutoProrrateado) + safeNum(item.ggPorcentualItem) + safeNum(item.montoMargenRiesgoItem)
  );
  const beneficio = safeNum(item.beneficioItem);
  const subtotal = safeNum(item.subtotalItem);
  const impuestos = safeNum(item.impuestosItem);
  const precioFinal = safeNum(item.precioFinalItem ?? item.precioVentaTotal ?? costoDirectoTotal);
  const precioUnitario = safeNum(item.precioVentaUnitario) > 0
    ? safeNum(item.precioVentaUnitario)
    : roundMoney(precioFinal / cant);

  const steps = [
    {
      id: 'cd',
      label: 'Costo Directo',
      icon: <DollarSign className="w-3.5 h-3.5 text-primary" />,
      amount: costoDirectoTotal,
      colorText: 'text-on-surface',
      tooltip: 'Suma de insumos, mano de obra y servicios directos'
    },
    {
      id: 'gg',
      label: 'Gastos Generales',
      icon: <Building2 className="w-3.5 h-3.5 text-amber-500" />,
      amount: ggIndirectos,
      colorText: 'text-on-surface-variant',
      tooltip: 'Indirectos prorrateados (fijos y porcentuales) + margen de riesgo'
    },
    {
      id: 'ben',
      label: 'Beneficio',
      icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />,
      amount: beneficio,
      colorText: 'text-emerald-600 dark:text-emerald-400',
      tooltip: 'Margen de ganancia calculado sobre costo directo + GG'
    },
    {
      id: 'sub',
      label: 'Subtotal',
      icon: <Receipt className="w-3.5 h-3.5 text-secondary" />,
      amount: subtotal,
      colorText: 'text-on-surface font-semibold',
      tooltip: 'Base imponible antes de impuestos (Costo + GG + Beneficio)'
    },
    {
      id: 'imp',
      label: 'Impuestos',
      icon: <Landmark className="w-3.5 h-3.5 text-rose-500" />,
      amount: impuestos,
      colorText: 'text-on-surface-variant',
      tooltip: 'Carga impositiva aplicable (IVA, IIBB, etc.)'
    },
    {
      id: 'final',
      label: 'Precio Final',
      icon: <Sparkles className="w-3.5 h-3.5 text-primary" />,
      amount: precioFinal,
      colorText: 'text-primary font-bold',
      tooltip: 'Precio total de venta al cliente para este ítem',
      isHighlight: true
    }
  ];

  return (
    <div
      className="px-3 sm:px-4 py-2.5 bg-surface-container border-t border-outline-variant/30 select-none shrink-0 overflow-x-auto shadow-xs"
      role="region"
      aria-label="Zona 3: Cascada del ítem seleccionado"
    >
      <div className="flex items-center justify-between gap-3 min-w-max">
        {/* Etiqueta del ítem analizado */}
        <div className="flex items-center gap-1.5 shrink-0 text-xs text-on-surface-variant">
          <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="font-bold text-on-surface uppercase text-[11px] tracking-wider">
            Zona 3 · Cascada:
          </span>
          <span className="truncate max-w-[200px] font-medium text-on-surface" title={item.descripcion}>
            {item.descripcion}
          </span>
          <span className="text-[10px] font-mono text-on-surface-variant/70">
            ({item.cantidad} {item.unidad || 'u'})
          </span>
        </div>

        {/* Pasos en progresión secuencial: CD → GG → Beneficio → Subtotal → Impuestos → Precio Final */}
        <div className="flex items-center gap-1 sm:gap-2 flex-nowrap">
          {steps.map((step, idx) => (
            <React.Fragment key={step.id}>
              {idx > 0 && (
                <ArrowRight className="w-3 h-3 text-outline-variant/60 shrink-0" />
              )}
              <div
                className={`flex items-center gap-1.5 px-2 py-1 rounded-xl border text-xs font-mono transition-all ${
                  step.isHighlight
                    ? 'bg-primary/10 border-primary/30 shadow-2xs'
                    : 'bg-surface-container-high border-outline-variant/20'
                }`}
                title={step.tooltip}
              >
                {step.icon}
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider text-on-surface-variant/70 font-sans font-semibold leading-none">
                    {step.label}
                  </span>
                  <span className={`text-[11px] leading-tight ${step.colorText}`}>
                    {formatARS(step.amount)}
                  </span>
                </div>
              </div>
            </React.Fragment>
          ))}

          {/* Precio Unitario Final */}
          <div className="ml-2 pl-2 border-l border-outline-variant/30 flex items-center gap-1.5 text-xs font-mono text-on-surface-variant">
            <span className="text-[10px] font-sans text-on-surface-variant/70">Unitario:</span>
            <span className="font-bold text-primary">
              {formatARS(precioUnitario)}
            </span>
            <span className="text-[10px]">/ {item.unidad || 'u'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
