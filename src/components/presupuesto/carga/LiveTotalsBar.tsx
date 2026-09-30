import React, { useState } from 'react';
import {
  DollarSign,
  ShieldAlert,
  Briefcase,
  TrendingUp,
  Receipt,
  CheckCircle2,
  SlidersHorizontal,
  ChevronUp,
  X
} from 'lucide-react';
import { formatARS, TotalesPresupuestoResultado } from '../../../core/calculations';

interface LiveTotalsBarProps {
  totales: TotalesPresupuestoResultado;
  onOpenQuoteParameters?: () => void;
}

export const LiveTotalsBar: React.FC<LiveTotalsBarProps> = ({
  totales,
  onOpenQuoteParameters
}) => {
  const [showCascadeSheet, setShowCascadeSheet] = useState(false);
  const directNetCost = (totales.subtotalInsumos || 0) + (totales.subtotalManoObra || 0) + (totales.subtotalServiciosTercerizados || 0);
  const finalPrice = totales.precioFinalGlobal || totales.totalARS || 0;

  return (
    <>
      <div className="w-full bg-surface-container border-t border-outline-variant/30 px-2.5 sm:px-3 py-1 select-none shadow-md shrink-0 min-h-[34px] sm:h-9 flex items-center pb-safe">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 w-full min-w-0">
          {/* Vista Desktop (≥ 768px): Pasos de la Cascada Determinística Horizontal Ultra-Compacta */}
          <div className="hidden md:flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-w-0 text-[11px] text-on-surface whitespace-nowrap">
            {/* 1. Costo Directo Neto */}
            <div
              onClick={onOpenQuoteParameters}
              className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-md bg-surface-container-high/60 hover:bg-surface-container-highest border border-outline-variant/20 cursor-pointer transition-colors"
              title="Costo directo neto de insumos, mano de obra y servicios"
            >
              <DollarSign className="w-3 h-3 text-on-surface-variant opacity-70" />
              <span className="text-on-surface-variant">Directo:</span>
              <span className="font-mono font-semibold text-on-surface">
                {formatARS(directNetCost)}
              </span>
            </div>

            <span className="text-outline-variant/60 shrink-0 font-bold select-none text-[10px]">+</span>

            {/* 2. Margen de Riesgo */}
            <div
              onClick={onOpenQuoteParameters}
              className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-md bg-surface-container-high/60 hover:bg-surface-container-highest border border-outline-variant/20 cursor-pointer transition-colors"
              title="Margen de riesgo e imprevistos"
            >
              <ShieldAlert className="w-3 h-3 text-amber-500 opacity-80" />
              <span className="text-on-surface-variant">Riesgo:</span>
              <span className="font-mono font-semibold text-on-surface">
                {formatARS(totales.montoMargenRiesgo || 0)}
              </span>
            </div>

            <span className="text-outline-variant/60 shrink-0 font-bold select-none text-[10px]">+</span>

            {/* 3. Gastos Generales (GG) */}
            <div
              onClick={onOpenQuoteParameters}
              className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-md bg-surface-container-high/60 hover:bg-surface-container-highest border border-outline-variant/20 cursor-pointer transition-colors"
              title="Gastos Generales fijos y porcentuales"
            >
              <Briefcase className="w-3 h-3 text-blue-500 opacity-80" />
              <span className="text-on-surface-variant">GG:</span>
              <span className="font-mono font-semibold text-on-surface">
                {formatARS(totales.gastosGeneralesTotal || 0)}
              </span>
            </div>

            <span className="text-outline-variant/60 shrink-0 font-bold select-none text-[10px]">+</span>

            {/* 4. Beneficio / Utilidad */}
            <div
              onClick={onOpenQuoteParameters}
              className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-md bg-surface-container-high/60 hover:bg-surface-container-highest border border-outline-variant/20 cursor-pointer transition-colors"
              title="Beneficio pretendido"
            >
              <TrendingUp className="w-3 h-3 text-emerald-500 opacity-80" />
              <span className="text-on-surface-variant">Beneficio:</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {formatARS(totales.beneficioMonto || 0)}
              </span>
            </div>

            <span className="text-outline-variant/60 shrink-0 font-bold select-none text-[10px]">+</span>

            {/* 5. Impuestos */}
            <div
              onClick={onOpenQuoteParameters}
              className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-md bg-surface-container-high/60 hover:bg-surface-container-highest border border-outline-variant/20 cursor-pointer transition-colors"
              title="Carga impositiva (IVA / Ingresos Brutos)"
            >
              <Receipt className="w-3 h-3 text-purple-500 opacity-80" />
              <span className="text-on-surface-variant">Impuestos:</span>
              <span className="font-mono font-semibold text-on-surface">
                {formatARS(totales.montoImpuestosTotal || 0)}
              </span>
            </div>
          </div>

          {/* Vista Móvil (< 768px): Botón Desglose Cascada Económica */}
          <div className="flex md:hidden items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => setShowCascadeSheet(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/30 text-xs font-semibold text-on-surface cursor-pointer active:scale-95 min-h-[32px]"
            >
              <DollarSign className="w-3.5 h-3.5 text-primary" />
              <span>Cascada</span>
              <ChevronUp className="w-3 h-3 opacity-70" />
            </button>
            {totales.coeficienteK !== undefined && totales.coeficienteK > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-surface-container-highest text-on-surface-variant">
                K={totales.coeficienteK.toFixed(2)}
              </span>
            )}
          </div>

          {/* Total Final y Ajuste de Parámetros (Fijo a la derecha) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto pl-1">
            {totales.coeficienteK !== undefined && totales.coeficienteK > 0 && (
              <span
                className="hidden lg:inline-flex text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant shrink-0"
                title="Coeficiente K = Precio Final / Costo Global"
              >
                K = {totales.coeficienteK.toFixed(3)}
              </span>
            )}

            <div
              onClick={onOpenQuoteParameters}
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity shrink-0 px-2 sm:px-2.5 py-1 rounded-xl bg-primary/10 border border-primary/20 min-h-[30px] sm:min-h-[32px]"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-[11px] sm:text-xs uppercase tracking-wider font-bold text-on-surface">
                Total:
              </span>
              <span className="font-mono font-extrabold text-xs sm:text-sm text-primary">
                {formatARS(finalPrice)}
              </span>
            </div>

            {onOpenQuoteParameters && (
              <button
                type="button"
                onClick={onOpenQuoteParameters}
                className="p-1.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer shrink-0 min-h-[30px] min-w-[30px] sm:min-h-[32px] sm:min-w-[32px] flex items-center justify-center"
                title="Abrir panel de configuración de parámetros económicos"
                aria-label="Configuración de parámetros"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Sheet de Cascada Económica para Móvil */}
      {showCascadeSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-surface-container rounded-t-3xl border-t border-outline-variant/30 shadow-2xl p-4 pb-safe flex flex-col gap-3 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span>Estructura de Cascada Económica</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCascadeSheet(false)}
                className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2 py-1 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low">
                <span className="text-on-surface-variant">1. Costo Directo Neto:</span>
                <span className="font-mono font-bold text-on-surface">{formatARS(directNetCost)}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low">
                <span className="text-on-surface-variant">2. Margen de Riesgo:</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {formatARS(totales.montoMargenRiesgo || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low">
                <span className="text-on-surface-variant">3. Gastos Generales (GG):</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {formatARS(totales.gastosGeneralesTotal || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low">
                <span className="text-on-surface-variant">4. Beneficio / Utilidad:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatARS(totales.beneficioMonto || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low">
                <span className="text-on-surface-variant">5. Impuestos:</span>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                  {formatARS(totales.montoImpuestosTotal || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-primary/10 border border-primary/20 text-sm font-bold mt-1">
                <span className="text-on-surface">Precio de Venta Final:</span>
                <span className="font-mono text-primary font-extrabold">{formatARS(finalPrice)}</span>
              </div>
            </div>

            {onOpenQuoteParameters && (
              <button
                type="button"
                onClick={() => {
                  setShowCascadeSheet(false);
                  onOpenQuoteParameters();
                }}
                className="w-full py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-xs font-bold text-primary flex items-center justify-center gap-2 cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Configurar Márgenes y Parámetros</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
