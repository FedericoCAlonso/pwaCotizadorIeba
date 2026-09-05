import React from 'react';
import {
  Calculator,
  RotateCcw,
  X,
  CheckCircle,
  Plus,
  Edit2,
  HardHat,
  Package,
  Truck,
  Globe,
  Sliders,
  Zap,
  BookOpen
} from 'lucide-react';
import {
  GastoPresupuestoConfig,
  TipoFactura,
  DestinoGasto
} from '../../core/types';
import { formatARS, formatUSD, TotalesPresupuestoResultado } from '../../core/calculations';
import { NumericInput } from '../common/NumericInput';

interface PresupuestoTotalsCardProps {
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
  onToggleTax: (idx: number) => void;
  onUpdateTaxPct: (idx: number, pct: number) => void;
  onRemoveTax: (idx: number) => void;
  onAddCustomTax: () => void;
  mostrarDolar: boolean;
  nombreDolar: string;
  onEmitirClick: () => void;
  onOpenListaMateriales?: () => void;
}

export const PresupuestoTotalsCard: React.FC<PresupuestoTotalsCardProps> = ({
  totales,
  tipoFactura,
  gastosConfig = [],
  onOpenGastoModal,
  onOpenCatalogPicker,
  onOpenParametricGastoModal,
  onToggleGasto,
  onRemoveGasto,
  onResetGastos,
  margenPorcentaje,
  onMargenPorcentajeChange,
  onToggleTax,
  onUpdateTaxPct,
  onRemoveTax,
  onAddCustomTax,
  mostrarDolar,
  nombreDolar,
  onEmitirClick,
  onOpenListaMateriales
}) => {
  const getDestinoBadge = (destino: DestinoGasto) => {
    switch (destino) {
      case 'mano_obra':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full">
            <HardHat className="w-3.5 h-3.5" /> MO
          </span>
        );
      case 'materiales':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full">
            <Package className="w-3.5 h-3.5" /> Materiales
          </span>
        );
      case 'servicios':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2.5 py-1 rounded-full">
            <Truck className="w-3.5 h-3.5" /> Servicios
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full">
            <Globe className="w-3.5 h-3.5" /> Indirecto
          </span>
        );
    }
  };

  return (
    <div
      id="presupuesto-totales-card"
      className="bg-surface-container-low rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 space-y-4 border border-outline-variant/10 shadow-sm sticky top-6"
    >
      <div className="flex items-center justify-between">
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

        {/* 3 Pilares Directos (Materiales, Mano de Obra, Servicios) */}
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
              {onOpenListaMateriales && (
                <button
                  type="button"
                  onClick={onOpenListaMateriales}
                  className="text-primary hover:underline font-sans font-semibold flex items-center gap-1 cursor-pointer ml-auto"
                >
                  <Package className="w-3 h-3" /> Ver / Exportar Insumos
                </button>
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
        </div>
      </div>

      {/* 2. GASTOS Y COSTOS INDIRECTOS (GG) */}
      <div className="bg-surface-container-high/60 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-outline-variant/20 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <label className="text-xs sm:text-sm font-bold text-on-surface uppercase tracking-wider block">
              2. Gastos & Modificadores
            </label>
            <span className="text-xs text-on-surface-variant">
              Directos (s/Rubro) o Indirectos (s/Costo Total C)
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {onResetGastos && (
              <button
                type="button"
                onClick={onResetGastos}
                className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                title="Restablecer gastos por defecto del catálogo"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            {onOpenCatalogPicker && (
              <button
                type="button"
                onClick={onOpenCatalogPicker}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-bold hover:bg-secondary-container/80 transition-colors"
                title="Elegir gastos existentes del catálogo"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Desde Lista</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenGastoModal()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
              title="Crear un nuevo gasto personalizado"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Gasto</span>
            </button>
          </div>
        </div>

        {gastosConfig.length === 0 ? (
          <div className="p-3.5 rounded-xl bg-surface-container/50 border border-dashed border-outline-variant/30 text-center space-y-2">
            <p className="text-xs text-on-surface-variant">
              Sin gastos aplicados en esta cotización.
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap pt-0.5">
              {onOpenCatalogPicker && (
                <button
                  type="button"
                  onClick={onOpenCatalogPicker}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary-container text-on-secondary-container text-xs font-bold hover:bg-secondary-container/80 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Elegir de la Lista</span>
                </button>
              )}
              {onResetGastos && (
                <button
                  type="button"
                  onClick={onResetGastos}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface text-xs font-medium hover:bg-surface-container-highest transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Cargar por Defecto</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenGastoModal()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crear Nuevo</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {gastosConfig.map((g, idx) => {
              const desg = totales.gastosDesglosados.find((d) => d.id === g.id);
              const monto = desg ? desg.montoCalculado : 0;

              return (
                <div
                  key={g.id || idx}
                  className={`p-2.5 rounded-xl border transition-all space-y-1.5 ${
                    g.aplica
                      ? 'bg-surface-container border-outline-variant/30 shadow-xs'
                      : 'bg-surface-container/40 border-dashed border-outline-variant/20 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-xs text-on-surface truncate flex-1">
                      <input
                        type="checkbox"
                        checked={g.aplica}
                        onChange={() => onToggleGasto(idx)}
                        className="w-4 h-4 text-primary rounded border-outline-variant"
                      />
                      <span className="truncate font-medium">{g.nombre}</span>
                    </label>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {getDestinoBadge(g.destino || 'costo_indirecto')}

                      {g.parametros && g.parametros.length > 0 && onOpenParametricGastoModal && (
                        <button
                          type="button"
                          onClick={() => onOpenParametricGastoModal(g)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors shadow-2xs"
                          title="Ajustar variables de obra de este gasto"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Variables ({g.parametros.length})</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onOpenGastoModal(g)}
                        className="p-1 text-on-surface-variant hover:text-primary rounded-lg transition-colors"
                        title="Editar Gasto"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onRemoveGasto(g.id)}
                        className="p-1 text-on-surface-variant hover:text-error rounded-lg transition-colors"
                        title="Eliminar Gasto"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {g.aplica && (
                    <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono pt-1 border-t border-outline-variant/10">
                      <span className="flex items-center gap-1 truncate">
                        {g.modalidad === 'porcentual' ? `${g.valor}%` : g.modalidad === 'parametrico' ? (
                          <span className="text-primary font-bold inline-flex items-center gap-0.5">
                            <Zap className="w-3 h-3" /> Fórmula ⚡
                          </span>
                        ) : 'Fijo'}:
                      </span>
                      <span className="font-bold text-primary">+{formatARS(monto)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-between text-xs font-bold text-primary pt-1 border-t border-outline-variant/20">
          <span>Costos Indirectos (GG sobre C):</span>
          <span className="font-mono">{formatARS(totales.gastosGeneralesTotal)}</span>
        </div>
      </div>

      {/* 3. BENEFICIO (B) */}
      <div className="bg-surface-container-high/60 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-outline-variant/20 space-y-2">
        <div className="flex justify-between items-center">
          <div>
            <label className="text-xs sm:text-sm font-bold text-on-surface uppercase tracking-wider block">
              3. Beneficio (B)
            </label>
            <span className="text-xs text-on-surface-variant">
              Calculado sobre Costo Directo + Indirectos ({formatARS(totales.costoTotalObra)})
            </span>
          </div>
          <div className="w-24">
            <NumericInput
              value={margenPorcentaje}
              onChange={(val) => onMargenPorcentajeChange(val)}
              fallbackOnBlur={0}
              min={0}
              max={500}
              decimals={1}
              suffix="%"
              className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl pl-3 pr-7 py-1.5 text-sm sm:text-base text-primary font-mono font-bold text-right focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[38px]"
            />
          </div>
        </div>

        <div className="flex justify-between text-xs sm:text-sm font-bold text-tertiary pt-1 border-t border-outline-variant/10">
          <span>Monto Beneficio ({margenPorcentaje ?? 0}%):</span>
          <span className="font-mono font-semibold">{formatARS(totales.beneficioMonto)}</span>
        </div>
      </div>

      {/* 4. SUBTOTAL SIN IMPUESTOS (S = C + GG + B) */}
      <div className="bg-surface-container p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-outline-variant/30 flex justify-between items-center text-xs sm:text-sm font-bold text-on-surface shadow-2xs">
        <span className="uppercase tracking-wider">4. Subtotal sin Impuestos (S):</span>
        <span className="font-mono text-primary text-sm sm:text-base font-bold">{formatARS(totales.subtotalSinImpuestos)}</span>
      </div>

      {/* 5. IMPUESTOS (independientes calculados sobre S) */}
      <div className="bg-surface-container-high/60 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-outline-variant/20 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <label className="text-xs sm:text-sm font-bold text-on-surface uppercase tracking-wider block">
              5. Impuestos ({tipoFactura})
            </label>
            <span className="text-xs text-on-surface-variant">Calculados sobre Subtotal (S), sin cascada</span>
          </div>
          <button
            type="button"
            onClick={onAddCustomTax}
            className="text-xs text-primary hover:underline font-bold"
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
                    className="text-on-surface-variant hover:text-error p-1 rounded-full transition-colors ml-1"
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

      <button
        type="button"
        onClick={onEmitirClick}
        className="w-full py-3 sm:py-3.5 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full transition-all flex items-center justify-center gap-2 text-sm sm:text-base shadow-md hover:shadow-lg active:scale-98 cursor-pointer min-h-[46px]"
      >
        <CheckCircle className="w-5 h-5 text-on-primary" />
        <span>Emitir Presupuesto...</span>
      </button>
    </div>
  );
};
