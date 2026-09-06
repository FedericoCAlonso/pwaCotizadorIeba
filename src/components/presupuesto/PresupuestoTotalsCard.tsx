import React from 'react';
import {
  Calculator,
  X,
  ShieldAlert,
  HardHat,
  Package,
  Truck
} from 'lucide-react';
import {
  GastoPresupuestoConfig,
  TipoFactura
} from '../../core/types';
import { formatARS, formatUSD, TotalesPresupuestoResultado } from '../../core/calculations';
import { NumericInput } from '../common/NumericInput';

interface PresupuestoTotalsCardProps {
  totales: TotalesPresupuestoResultado;
  tipoFactura: TipoFactura;
  gastosConfig?: GastoPresupuestoConfig[];
  margenPorcentaje: number | null;
  margenRiesgoPorcentaje?: number;
  onToggleTax: (idx: number) => void;
  onUpdateTaxPct: (idx: number, pct: number) => void;
  onRemoveTax: (idx: number) => void;
  onAddCustomTax: () => void;
  mostrarDolar: boolean;
  nombreDolar: string;
}

export const PresupuestoTotalsCard: React.FC<PresupuestoTotalsCardProps> = ({
  totales,
  tipoFactura,
  margenPorcentaje,
  margenRiesgoPorcentaje,
  onToggleTax,
  onUpdateTaxPct,
  onRemoveTax,
  onAddCustomTax,
  mostrarDolar,
  nombreDolar
}) => {
  return (
    <div
      id="presupuesto-totales-card"
      className="bg-surface-container-low rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 space-y-4 border border-outline-variant/10 shadow-sm"
    >
      <div className="flex items-center justify-between pb-1 border-b border-outline-variant/10">
        <h3 className="text-xs sm:text-sm font-bold text-primary uppercase tracking-wide flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary shrink-0" />
          <span>Liquidación & Cadena de Precios</span>
        </h3>
      </div>

      {/* 1. COSTO DIRECTO TOTAL (C) */}
      <div className="bg-surface-container-high/60 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-outline-variant/20 space-y-3">
        <div className="flex justify-between items-center text-xs sm:text-sm font-bold text-on-surface">
          <span className="uppercase tracking-wider">1. Costo Directo Total (C):</span>
          <span className="font-mono text-sm sm:text-base font-bold text-on-surface">{formatARS(totales.costoGlobal)}</span>
        </div>

        {/* 3 Pilares Directos + Fondo de Riesgo */}
        <div className="space-y-2 pt-1 border-t border-outline-variant/10 text-xs sm:text-sm">
          {/* Materiales */}
          <div className="bg-surface-container p-2.5 rounded-xl border border-outline-variant/15 flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="font-semibold flex items-center gap-1.5 text-on-surface">
                <Package className="w-3.5 h-3.5 text-blue-500" />
                Materiales / Insumos:
              </span>
              <span className="font-mono font-bold text-on-surface">{formatARS(totales.subtotalInsumosTotal)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-on-surface-variant font-mono">
              <span>Base: {formatARS(totales.subtotalInsumosBase)}</span>
              {totales.gastosMaterialesTotal > 0 && (
                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                  +{formatARS(totales.gastosMaterialesTotal)} gastos directos
                </span>
              )}
            </div>
          </div>

          {/* Mano de Obra */}
          <div className="bg-surface-container p-2.5 rounded-xl border border-outline-variant/15 flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="font-semibold flex items-center gap-1.5 text-on-surface">
                <HardHat className="w-3.5 h-3.5 text-amber-500" />
                Mano de Obra (MOD):
              </span>
              <span className="font-mono font-bold text-on-surface">{formatARS(totales.subtotalManoObraTotal)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-on-surface-variant font-mono">
              <span>Base: {formatARS(totales.subtotalManoObraBase)}</span>
              {totales.ahorroSinergiaManoObra > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  ⚡ -{formatARS(totales.ahorroSinergiaManoObra)} sinergia
                </span>
              )}
              {totales.gastosManoObraTotal > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  +{formatARS(totales.gastosManoObraTotal)} cargas/gastos MO
                </span>
              )}
            </div>
          </div>

          {/* Servicios Tercerizados */}
          <div className="bg-surface-container p-2.5 rounded-xl border border-outline-variant/15 flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="font-semibold flex items-center gap-1.5 text-on-surface">
                <Truck className="w-3.5 h-3.5 text-purple-500" />
                Servicios Tercerizados:
              </span>
              <span className="font-mono font-bold text-on-surface">{formatARS(totales.subtotalServiciosTotal)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-on-surface-variant font-mono">
              <span>Base: {formatARS(totales.subtotalServiciosBase)}</span>
              {totales.gastosServiciosTotal > 0 && (
                <span className="text-purple-600 dark:text-purple-400 font-semibold">
                  +{formatARS(totales.gastosServiciosTotal)} gastos directos
                </span>
              )}
            </div>
          </div>

          {/* Fondo de Reserva / Riesgo */}
          {totales.montoMargenRiesgo !== undefined && totales.montoMargenRiesgo > 0 && (
            <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 flex justify-between items-center text-xs sm:text-sm">
              <span className="font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                Fondo de Reserva / Riesgo (+{margenRiesgoPorcentaje ?? 0}%):
              </span>
              <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                +{formatARS(totales.montoMargenRiesgo)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. COSTOS INDIRECTOS & GASTOS DE OBRA (GG) */}
      <div className="bg-surface-container-high/60 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-outline-variant/20 space-y-2">
        <div className="flex justify-between items-center">
          <div>
            <label className="text-xs sm:text-sm font-bold text-on-surface uppercase tracking-wider block">
              2. Costos Indirectos & Gastos (GG)
            </label>
            <span className="text-xs text-on-surface-variant">
              Logística, fletes y servicios de obra (Etapa 3)
            </span>
          </div>
          <span className="font-mono text-sm sm:text-base font-bold text-primary">
            {formatARS(totales.gastosGeneralesTotal)}
          </span>
        </div>

        {totales.gastosDesglosados && totales.gastosDesglosados.filter((g) => g.montoCalculado > 0).length > 0 ? (
          <div className="space-y-1 pt-1 border-t border-outline-variant/10 text-xs">
            {totales.gastosDesglosados
              .filter((g) => g.montoCalculado > 0)
              .map((g, idx) => (
                <div key={g.id || idx} className="flex justify-between items-center text-on-surface-variant font-mono py-0.5">
                  <span className="truncate flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                    {g.nombre}
                  </span>
                  <span className="font-semibold text-on-surface shrink-0">+{formatARS(g.montoCalculado)}</span>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-xs text-on-surface-variant/70 italic border-t border-outline-variant/10 pt-1">
            Sin costos indirectos aplicados.
          </p>
        )}
      </div>

      {/* 3. BENEFICIO COMERCIAL (B) - Reflejo en Cascada (Sin Input Duplicado) */}
      <div className="bg-surface-container-high/60 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-outline-variant/20 flex justify-between items-center">
        <div>
          <label className="text-xs sm:text-sm font-bold text-on-surface uppercase tracking-wider block">
            3. Beneficio Comercial (B)
          </label>
          <span className="text-xs text-on-surface-variant">
            +{margenPorcentaje ?? 0}% sobre Costo Total C + GG ({formatARS(totales.costoTotalObra)})
          </span>
        </div>
        <div className="text-right">
          <span className="font-mono font-black text-primary text-sm sm:text-base">
            +{formatARS(totales.beneficioMonto)}
          </span>
        </div>
      </div>

      {/* 4. SUBTOTAL SIN IMPUESTOS (S = C + GG + B) */}
      <div className="bg-surface-container p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-outline-variant/30 flex justify-between items-center text-xs sm:text-sm font-bold text-on-surface shadow-2xs">
        <span className="uppercase tracking-wider">4. Subtotal sin Impuestos (S):</span>
        <span className="font-mono text-primary text-sm sm:text-base font-bold">{formatARS(totales.subtotalSinImpuestos)}</span>
      </div>

      {/* 5. IMPUESTOS (calculados sobre S) */}
      <div className="bg-surface-container-high/60 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-outline-variant/20 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <label className="text-xs sm:text-sm font-bold text-on-surface uppercase tracking-wider block">
              5. Impuestos ({tipoFactura})
            </label>
            <span className="text-xs text-on-surface-variant">Calculados sobre Subtotal (S)</span>
          </div>
          <button
            type="button"
            onClick={onAddCustomTax}
            className="text-xs text-primary hover:underline font-bold cursor-pointer"
          >
            + Impuesto
          </button>
        </div>

        <div className="space-y-2">
          {totales.impuestosCalculados.map((tax: any, idx: number) => (
            <div
              key={tax.id || idx}
              className="bg-surface-container p-2 sm:p-2.5 rounded-xl border border-outline-variant/20 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-xs sm:text-sm text-on-surface truncate flex-1">
                  <input
                    type="checkbox"
                    checked={tax.aplica}
                    onChange={() => onToggleTax(idx)}
                    className="w-4 h-4 text-primary rounded border-outline-variant"
                  />
                  <span className="truncate">{tax.nombre}</span>
                </label>

                <div className="w-20 shrink-0">
                  <NumericInput
                    value={tax.porcentaje}
                    onChange={(val) => onUpdateTaxPct(idx, val ?? 0)}
                    min={0}
                    max={100}
                    decimals={2}
                    suffix="%"
                    className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-lg px-2 pr-5 py-0.5 text-xs text-right font-mono"
                  />
                </div>

                {idx >= 2 && (
                  <button
                    type="button"
                    onClick={() => onRemoveTax(idx)}
                    className="text-on-surface-variant hover:text-error p-1 rounded-full transition-colors ml-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {tax.aplica && (
                <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono pt-1 border-t border-outline-variant/10">
                  <span>
                    {tax.nombre} ({tax.porcentaje}% s/S):
                  </span>
                  <span className="font-bold text-primary">{formatARS(tax.montoCalculado)}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-between text-xs sm:text-sm font-bold text-primary pt-1 border-t border-outline-variant/20">
          <span>Total Impuestos ({totales.impuestosPorcentajeTotal}%):</span>
          <span className="font-mono">{formatARS(totales.montoImpuestosTotal)}</span>
        </div>
      </div>

      {/* 6. PRECIO FINAL GLOBAL & COEFICIENTE K */}
      <div className="bg-primary-container/40 border border-primary/30 p-4 sm:p-5 rounded-2xl sm:rounded-3xl space-y-2 text-center shadow-sm">
        <span className="text-xs sm:text-sm uppercase tracking-wider font-bold text-primary block">
          6. PRECIO FINAL GLOBAL COTIZADO
        </span>
        <div className="font-mono text-2xl sm:text-3xl font-black text-on-surface">{formatARS(totales.precioFinalGlobal)}</div>

        <div className="pt-2 border-t border-primary/20 flex flex-col items-center justify-center gap-1">
          <span className="text-xs sm:text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            Coeficiente de Venta K = {totales.coeficienteK.toFixed(4)}
          </span>
          <span className="text-xs text-on-surface-variant">
            Multiplicador aplicado a cada ítem para el cliente
          </span>
        </div>

        {mostrarDolar && totales.totalMonedaExtranjera && (
          <div className="text-xs text-tertiary font-mono font-semibold pt-1">
            Equivalente: {formatUSD(totales.totalMonedaExtranjera, nombreDolar)}
          </div>
        )}
      </div>
    </div>
  );
};
