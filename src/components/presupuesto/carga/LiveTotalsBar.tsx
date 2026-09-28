import React from 'react';
import {
  DollarSign,
  ShieldAlert,
  Briefcase,
  TrendingUp,
  Receipt,
  CheckCircle2,
  SlidersHorizontal
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
  const directNetCost = (totales.subtotalInsumos || 0) + (totales.subtotalManoObra || 0) + (totales.subtotalServiciosTercerizados || 0);

  return (
    <div className="bg-surface-container border-t border-outline-variant/40 px-3 py-2 select-none shadow-md shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 max-w-7xl mx-auto">
        {/* Pasos de la Cascada Determinística */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {/* 1. Costo Directo Neto */}
          <div
            onClick={onOpenQuoteParameters}
            className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
            title="Costo directo neto de insumos, mano de obra y servicios"
          >
            <DollarSign className="w-3.5 h-3.5 text-on-surface-variant opacity-70" />
            <span className="text-on-surface-variant">Directo:</span>
            <span className="font-mono font-semibold text-on-surface">
              {formatARS(directNetCost)}
            </span>
          </div>

          <span className="text-outline-variant opacity-50">+</span>

          {/* 2. Margen de Riesgo */}
          <div
            onClick={onOpenQuoteParameters}
            className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
            title="Margen de riesgo e imprevistos sobre costo directo"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500 opacity-80" />
            <span className="text-on-surface-variant">Riesgo:</span>
            <span className="font-mono font-semibold text-on-surface">
              {formatARS(totales.montoMargenRiesgo || 0)}
            </span>
          </div>

          <span className="text-outline-variant opacity-50">+</span>

          {/* 3. Gastos Generales (GG) */}
          <div
            onClick={onOpenQuoteParameters}
            className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
            title="Gastos Generales (GG) fijos y porcentuales"
          >
            <Briefcase className="w-3.5 h-3.5 text-blue-500 opacity-80" />
            <span className="text-on-surface-variant">GG:</span>
            <span className="font-mono font-semibold text-on-surface">
              {formatARS(totales.gastosGeneralesTotal || 0)}
            </span>
          </div>

          <span className="text-outline-variant opacity-50">+</span>

          {/* 4. Beneficio / Utilidad */}
          <div
            onClick={onOpenQuoteParameters}
            className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
            title="Beneficio pretendido sobre costo directo + GG"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500 opacity-80" />
            <span className="text-on-surface-variant">Beneficio:</span>
            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              {formatARS(totales.beneficioMonto || 0)}
            </span>
          </div>

          <span className="text-outline-variant opacity-50">+</span>

          {/* 5. Impuestos */}
          <div
            onClick={onOpenQuoteParameters}
            className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
            title="Carga impositiva (IVA / Ingresos Brutos)"
          >
            <Receipt className="w-3.5 h-3.5 text-purple-500 opacity-80" />
            <span className="text-on-surface-variant">Impuestos:</span>
            <span className="font-mono font-semibold text-on-surface">
              {formatARS(totales.montoImpuestosTotal || 0)}
            </span>
          </div>
        </div>

        {/* 6. Total Final y Coeficiente K */}
        <div className="flex items-center gap-3 ml-auto">
          {totales.coeficienteK !== undefined && totales.coeficienteK > 0 && (
            <span
              className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant"
              title="Coeficiente K = Precio Final / Costo Global"
            >
              K = {totales.coeficienteK.toFixed(3)}
            </span>
          )}

          <div
            onClick={onOpenQuoteParameters}
            className="flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
          >
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span className="text-xs uppercase tracking-wider font-bold text-on-surface">
              Total:
            </span>
            <span className="font-mono font-extrabold text-sm sm:text-base text-primary">
              {formatARS(totales.precioFinalGlobal || totales.totalARS || 0)}
            </span>
          </div>

          {onOpenQuoteParameters && (
            <button
              type="button"
              onClick={onOpenQuoteParameters}
              className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
              title="Abrir panel de configuración de parámetros económicos"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
