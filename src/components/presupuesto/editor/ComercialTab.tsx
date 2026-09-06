import React from 'react';
import {
  Percent,
  ShieldAlert,
  CreditCard,
  MessageSquare,
  Package,
  RefreshCw,
  FileCheck,
  Save,
  ArrowLeft
} from 'lucide-react';
import {
  TipoFactura,
  GastoPresupuestoConfig,
  NivelMargenRiesgo
} from '../../../core/types';
import { formatARS, TotalesPresupuestoResultado } from '../../../core/calculations';
import { NumericInput } from '../../common/NumericInput';
import { PresupuestoTotalsCard } from '../PresupuestoTotalsCard';

interface ComercialTabProps {
  totales: TotalesPresupuestoResultado;
  tipoFactura: TipoFactura;
  gastosConfig: GastoPresupuestoConfig[];
  onOpenGastoModal: (gastoToEdit?: GastoPresupuestoConfig) => void;
  onOpenCatalogPicker?: () => void;
  onOpenParametricGastoModal?: (gasto: GastoPresupuestoConfig) => void;
  onToggleGasto: (idx: number) => void;
  onRemoveGasto: (id: string) => void;
  onResetGastos?: () => void;
  margenPorcentaje: number | null;
  onMargenPorcentajeChange: (val: number | null) => void;
  margenRiesgoPorcentaje: number;
  setMargenRiesgoPorcentaje: (val: number) => void;
  nivelMargenRiesgo: NivelMargenRiesgo;
  setNivelMargenRiesgo: (nivel: NivelMargenRiesgo) => void;
  onToggleTax: (idx: number) => void;
  onUpdateTaxPct: (idx: number, pct: number) => void;
  onRemoveTax: (idx: number) => void;
  onAddCustomTax: () => void;
  mostrarDolar: boolean;
  nombreDolar: string;
  condicionesPagoTexto: string;
  setCondicionesPagoTexto: (txt: string) => void;
  onEmitirClick: () => void;
  onOpenListaMateriales?: () => void;
  onOpenWhatsApp?: () => void;
  onOpenActualizarPrecios?: () => void;
  onSaveDraft?: () => void;
  isSaving?: boolean;
  onPrev: () => void;
}

export const ComercialTab: React.FC<ComercialTabProps> = ({
  totales,
  tipoFactura,
  gastosConfig,
  onOpenGastoModal,
  onOpenCatalogPicker,
  onOpenParametricGastoModal,
  onToggleGasto,
  onRemoveGasto,
  onResetGastos,
  margenPorcentaje,
  onMargenPorcentajeChange,
  margenRiesgoPorcentaje,
  setMargenRiesgoPorcentaje,
  nivelMargenRiesgo,
  setNivelMargenRiesgo,
  onToggleTax,
  onUpdateTaxPct,
  onRemoveTax,
  onAddCustomTax,
  mostrarDolar,
  nombreDolar,
  condicionesPagoTexto,
  setCondicionesPagoTexto,
  onEmitirClick,
  onOpenListaMateriales,
  onOpenWhatsApp,
  onOpenActualizarPrecios,
  onSaveDraft,
  isSaving = false,
  onPrev
}) => {
  const marginPresets = [20, 25, 30, 35, 40, 50];

  const handleNivelRiesgoChange = (nivel: NivelMargenRiesgo) => {
    setNivelMargenRiesgo(nivel);
    switch (nivel) {
      case 'bajo':
        setMargenRiesgoPorcentaje(10);
        break;
      case 'medio':
        setMargenRiesgoPorcentaje(20);
        break;
      case 'alto':
        setMargenRiesgoPorcentaje(35);
        break;
      case 'personalizado':
        break;
      default:
        break;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Estrategia de Margen, Riesgo y Condiciones (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Margen de Beneficio */}
          <div className="bg-surface-container-low rounded-3xl p-4 sm:p-6 border border-outline-variant/20 shadow-xs space-y-4">
            <div className="flex items-center gap-3 pb-3.5 border-b border-outline-variant/15">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Percent className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-on-surface">
                  Margen de Beneficio / Ganancia Neta
                </h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Porcentaje comercial aplicado sobre el costo total directo e indirecto.
                </p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm sm:text-base font-bold text-on-surface">
                  Margen de Beneficio Objetivo:
                </span>
                <div className="w-32">
                  <NumericInput
                    value={margenPorcentaje}
                    onChange={(val) => onMargenPorcentajeChange(val)}
                    fallbackOnBlur={30}
                    min={0}
                    max={500}
                    decimals={1}
                    suffix="%"
                    className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl px-3.5 py-2 text-base text-primary font-mono font-black text-right focus:ring-2 focus:ring-primary/50 min-h-[46px]"
                  />
                </div>
              </div>

              {/* Presets de margen rápido */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-xs sm:text-sm text-on-surface-variant font-bold mr-1">Rápidos:</span>
                {marginPresets.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => onMargenPorcentajeChange(pct)}
                    className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer min-h-[40px] ${
                      margenPorcentaje === pct
                        ? 'bg-primary text-on-primary shadow-2xs'
                        : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface hover:bg-outline-variant/30'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              <div className="p-3.5 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex justify-between items-center text-sm">
                <span className="text-on-surface-variant font-medium">Ganancia Neta en ARS:</span>
                <span className="font-mono font-bold text-primary text-base sm:text-lg">
                  {formatARS(totales.beneficioMonto)}
                </span>
              </div>
            </div>
          </div>

          {/* Margen de Riesgo e Imprevistos de Obra */}
          <div className="bg-surface-container-low rounded-3xl p-4 sm:p-6 border border-outline-variant/20 shadow-xs space-y-4">
            <div className="flex items-center gap-3 pb-3.5 border-b border-outline-variant/15">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-on-surface">
                  Contingencias & Margen de Riesgo
                </h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Cobertura ante imprevistos de obra, retrabajo o volatilidad en obra.
                </p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: 'bajo', label: 'Bajo (10%)' },
                  { id: 'medio', label: 'Medio (20%)' },
                  { id: 'alto', label: 'Alto (35%)' },
                  { id: 'personalizado', label: 'Personalizado' }
                ].map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => handleNivelRiesgoChange(lvl.id as NivelMargenRiesgo)}
                    className={`p-3 rounded-xl text-sm font-bold text-center border transition-all cursor-pointer min-h-[46px] ${
                      nivelMargenRiesgo === lvl.id
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 shadow-2xs'
                        : 'bg-surface-container-highest border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>

              {nivelMargenRiesgo === 'personalizado' && (
                <div className="flex items-center gap-3 pt-1">
                  <label className="text-sm font-semibold text-on-surface-variant">
                    Porcentaje de contingencia (%):
                  </label>
                  <NumericInput
                    value={margenRiesgoPorcentaje}
                    onChange={(v) => setMargenRiesgoPorcentaje(v ?? 0)}
                    min={0}
                    max={100}
                    className="w-28 bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm font-mono font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-amber-500/50 min-h-[44px]"
                  />
                </div>
              )}

              {totales.montoMargenRiesgo !== undefined && totales.montoMargenRiesgo > 0 && (
                <div className="p-3.5 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex justify-between items-center text-sm">
                  <span className="text-on-surface-variant font-medium">
                    Fondo de Reserva ({margenRiesgoPorcentaje}%):
                  </span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-base">
                    +{formatARS(totales.montoMargenRiesgo)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Condiciones Comerciales & de Pago */}
          <div className="bg-surface-container-low rounded-3xl p-4 sm:p-6 border border-outline-variant/20 shadow-xs space-y-4">
            <div className="flex items-center gap-3 pb-3.5 border-b border-outline-variant/15">
              <div className="w-11 h-11 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-on-surface">
                  Condiciones Comerciales y Plazos de Pago
                </h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Texto que se incluirá en el PDF/presupuesto formal entregado al cliente.
                </p>
              </div>
            </div>

            <div>
              <textarea
                value={condicionesPagoTexto}
                onChange={(e) => setCondicionesPagoTexto(e.target.value)}
                rows={4}
                className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl p-4 text-sm sm:text-base text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y shadow-2xs leading-relaxed min-h-[120px]"
                placeholder="Ejemplo: 50% de anticipo al inicio de los trabajos, 50% contra entrega conforme de la instalación. Validez de precios sujeta a condiciones vigentes."
              />
            </div>
          </div>

          {/* Navegación a Etapa Anterior */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onPrev}
              className="inline-flex items-center gap-2 px-6 py-3 bg-surface-container-highest text-on-surface rounded-2xl text-sm sm:text-base font-bold hover:bg-outline-variant/30 transition-all border border-outline-variant/30 cursor-pointer min-h-[48px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a Etapa 3: Cuadrilla & Gastos</span>
            </button>
          </div>
        </div>

        {/* Columna Derecha: Liquidación Financiera & Acciones de Emisión (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <PresupuestoTotalsCard
            totales={totales}
            tipoFactura={tipoFactura}
            gastosConfig={gastosConfig}
            margenPorcentaje={margenPorcentaje}
            margenRiesgoPorcentaje={margenRiesgoPorcentaje}
            onToggleTax={onToggleTax}
            onUpdateTaxPct={onUpdateTaxPct}
            onRemoveTax={onRemoveTax}
            onAddCustomTax={onAddCustomTax}
            mostrarDolar={mostrarDolar}
            nombreDolar={nombreDolar}
          />

          {/* Panel Unificado de Emisión y Cierre */}
          <div className="bg-surface-container-low rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-outline-variant/20 shadow-xs space-y-3.5">
            <h3 className="text-xs sm:text-sm font-bold text-on-surface-variant uppercase tracking-wider">
              Acciones de Emisión y Entrega
            </h3>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={onEmitirClick}
                className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-primary hover:bg-primary/90 text-on-primary rounded-2xl text-base font-bold shadow-md hover:shadow-lg active:scale-98 transition-all cursor-pointer min-h-[52px]"
              >
                <FileCheck className="w-5 h-5" />
                <span>Emitir Presupuesto / PDF</span>
              </button>

              {onOpenWhatsApp && (
                <button
                  type="button"
                  onClick={onOpenWhatsApp}
                  className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm sm:text-base font-bold shadow-md active:scale-98 transition-all cursor-pointer min-h-[48px]"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>Enviar por WhatsApp</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {onOpenListaMateriales && (
                  <button
                    type="button"
                    onClick={onOpenListaMateriales}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-container-highest text-on-surface rounded-xl text-sm font-semibold hover:bg-outline-variant/30 transition-all border border-outline-variant/30 cursor-pointer min-h-[44px]"
                  >
                    <Package className="w-4 h-4 text-blue-500" />
                    <span>Insumos (BOM)</span>
                  </button>
                )}

                {onOpenActualizarPrecios && (
                  <button
                    type="button"
                    onClick={onOpenActualizarPrecios}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-container-highest text-on-surface rounded-xl text-sm font-semibold hover:bg-outline-variant/30 transition-all border border-outline-variant/30 cursor-pointer min-h-[44px]"
                  >
                    <RefreshCw className="w-4 h-4 text-primary" />
                    <span>Actualizar Precios</span>
                  </button>
                )}
              </div>

              {onSaveDraft && (
                <div className="pt-1 flex justify-center">
                  <button
                    type="button"
                    onClick={onSaveDraft}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10 rounded-xl transition-colors cursor-pointer min-h-[40px]"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Guardando...' : 'Guardar Borrador Manual'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
