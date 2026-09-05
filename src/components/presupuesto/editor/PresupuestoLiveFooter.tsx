import React from 'react';
import {
  Calculator,
  ArrowRight,
  FileCheck,
  Percent
} from 'lucide-react';
import { formatARS, formatUSD, TotalesPresupuestoResultado } from '../../../core/calculations';
import { PresupuestoEditorTab } from '../../../viewmodels/usePresupuestoEditorViewModel';

interface PresupuestoLiveFooterProps {
  totales: TotalesPresupuestoResultado;
  margenPorcentaje: number | null;
  mostrarDolar: boolean;
  nombreDolar: string;
  activeTab: PresupuestoEditorTab;
  onSelectTab: (tab: PresupuestoEditorTab) => void;
  onEmitirClick: () => void;
}

export const PresupuestoLiveFooter: React.FC<PresupuestoLiveFooterProps> = ({
  totales,
  margenPorcentaje,
  mostrarDolar,
  nombreDolar,
  activeTab,
  onSelectTab,
  onEmitirClick
}) => {
  return (
    <aside
      aria-label="Resumen económico en tiempo real"
      className="sticky bottom-3 z-30 transition-all duration-300 mx-1 sm:mx-0"
    >
      <div className="bg-surface-container-high/95 backdrop-blur-md border border-outline-variant/40 rounded-3xl p-3 sm:p-4 shadow-xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 text-on-surface">
        {/* Costo Directo & Coeficiente K */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Calculator className="w-5 h-5" />
          </div>

          <div className="space-y-0.5">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
              Costo Directo Base
            </span>
            <div className="font-mono font-bold text-sm sm:text-base text-on-surface leading-tight">
              {formatARS(totales.costoGlobal)}
            </div>
          </div>

          <div className="hidden md:block pl-3 border-l border-outline-variant/20 space-y-0.5">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
              Margen / Factor K
            </span>
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-primary">
              <span>K: {totales.coeficienteK.toFixed(2)}</span>
              <span className="text-on-surface-variant">({margenPorcentaje ?? 0}%)</span>
            </div>
          </div>
        </div>

        {/* Total Cotización & Acciones */}
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 flex-1 sm:flex-initial w-full sm:w-auto border-t sm:border-t-0 border-outline-variant/15 pt-2 sm:pt-0">
          <div className="text-left sm:text-right">
            <span className="text-xs font-bold text-primary uppercase tracking-wider block">
              Venta Total
            </span>
            <div className="font-mono font-black text-lg sm:text-xl text-primary leading-tight">
              {formatARS(totales.precioFinalGlobal)}
            </div>
            {mostrarDolar && totales.totalMonedaExtranjera !== undefined && (
              <span className="text-xs font-mono text-on-surface-variant block">
                {formatUSD(totales.totalMonedaExtranjera)} ({nombreDolar})
              </span>
            )}
          </div>

          <div className="shrink-0">
            {activeTab !== 'comercial' ? (
              <button
                type="button"
                onClick={() => onSelectTab('comercial')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary text-on-primary rounded-2xl text-xs sm:text-sm font-bold shadow-xs hover:bg-primary/90 transition-all cursor-pointer active:scale-95"
              >
                <span>Ir al Cierre</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onEmitirClick}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-on-primary rounded-2xl text-xs sm:text-sm font-bold shadow-md hover:bg-primary/90 transition-all cursor-pointer active:scale-95"
              >
                <FileCheck className="w-4 h-4" />
                <span>Emitir</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
