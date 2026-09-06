import React from 'react';
import {
  Users,
  HardHat,
  Clock,
  Calendar,
  Sparkles,
  Plus,
  Minus
} from 'lucide-react';
import {
  ItemPresupuesto,
  CategoriaManoDeObra,
  SinergiaManoObraResultado,
  EstrategiaCuadrilla
} from '../../core/types';
import {
  calcularSinergiaManoObra,
  estimarCuadrillaPorPlazo,
  sonItemsCompatiblesParaSinergia,
  formatARS
} from '../../core/calculations';
import { NumericInput } from '../common/NumericInput';

interface PlanificadorCuadrillaCardProps {
  items: ItemPresupuesto[];
  operarios?: number;
  horasEfectivasJornada?: number;
  onSelectHorasEfectivasJornada?: (horas: number) => void;
  diasObjetivo?: number;
  onSelectDiasObjetivo?: (dias: number) => void;
  aplicarOptimizacion: boolean;
  onSelectOperarios?: (operarios: number) => void;
  onToggleAplicarOptimizacion: (aplicar: boolean) => void;
  categoriasManoObra?: CategoriaManoDeObra[];

  // Props de compatibilidad
  modoPlanificacion?: any;
  onSelectModoPlanificacion?: any;
  margenRiesgoPct?: number;
  nivelMargenRiesgo?: any;
  onSelectMargenRiesgo?: (pct: number, nivel?: any) => void;
  estrategiaSeleccionada?: EstrategiaCuadrilla;
  onSelectEstrategia?: (estrategia: EstrategiaCuadrilla) => void;
  costosIndirectosCatalog?: any[];
  costosIndirectosConfig?: any[];
  nivelConfianza?: any;
  onSelectNivelConfianza?: (nivel: any) => void;
}

export const PlanificadorCuadrillaCard: React.FC<PlanificadorCuadrillaCardProps> = ({
  items,
  operarios = 2,
  horasEfectivasJornada = 8.0,
  onSelectHorasEfectivasJornada,
  diasObjetivo,
  onSelectDiasObjetivo,
  aplicarOptimizacion,
  onSelectOperarios,
  onToggleAplicarOptimizacion,
  categoriasManoObra = [],
  // Props de compatibilidad
  estrategiaSeleccionada,
  onSelectEstrategia
}) => {
  if (!items || items.length === 0) return null;

  const currentOperarios = operarios ?? (estrategiaSeleccionada === 'minima' ? 1 : (estrategiaSeleccionada === 'rapida' ? 4 : 2));
  const currentHoras = horasEfectivasJornada > 0 ? horasEfectivasJornada : 8.0;
  const sonCompatibles = sonItemsCompatiblesParaSinergia(items);

  const sinergia: SinergiaManoObraResultado = calcularSinergiaManoObra({
    items,
    operarios: currentOperarios,
    horasEfectivasJornada: currentHoras,
    categoriasManoObra
  });

  // Los días mostrados son el plazo objetivo si fue fijado, o las jornadas calculadas por cuadrilla
  const displayedDias = diasObjetivo && diasObjetivo > 0 ? diasObjetivo : sinergia.diasEnterosObra;

  // ─── Manejador: Cambiar Operarios -> Sincroniza Días automáticamente ───
  const handleOperariosChange = (n: number) => {
    const val = Math.max(1, Math.min(10, Math.round(n)));
    if (onSelectOperarios) {
      onSelectOperarios(val);
    }
    if (onSelectEstrategia) {
      const est: EstrategiaCuadrilla = val === 1 ? 'minima' : (val >= 4 ? 'rapida' : 'optima');
      onSelectEstrategia(est);
    }

    // Recalcular días resultantes para la nueva cuadrilla
    const res = calcularSinergiaManoObra({
      items,
      operarios: val,
      horasEfectivasJornada: currentHoras,
      categoriasManoObra
    });
    if (onSelectDiasObjetivo) {
      onSelectDiasObjetivo(res.diasEnterosObra);
    }
  };

  // ─── Manejador: Cambiar Días de Plazo -> Sincroniza Operarios automáticamente ───
  const handleDiasChange = (dias: number) => {
    const val = Math.max(0.5, Math.round(dias * 2) / 2);
    if (onSelectDiasObjetivo) {
      onSelectDiasObjetivo(val);
    }

    // Estimar cuántos operarios se requieren para ese plazo
    const estimacion = estimarCuadrillaPorPlazo({
      items,
      diasObjetivo: val,
      horasEfectivasJornada: currentHoras,
      categoriasManoObra
    });

    if (onSelectOperarios && estimacion.operariosSugeridos !== currentOperarios) {
      onSelectOperarios(estimacion.operariosSugeridos);
    }
    if (onSelectEstrategia) {
      const est: EstrategiaCuadrilla = estimacion.operariosSugeridos === 1
        ? 'minima'
        : (estimacion.operariosSugeridos >= 4 ? 'rapida' : 'optima');
      onSelectEstrategia(est);
    }
  };

  // ─── Manejador: Cambiar Horas de Jornada ───
  const handleHorasChange = (hs: number) => {
    const val = Math.max(1, Math.min(16, hs));
    if (onSelectHorasEfectivasJornada) {
      onSelectHorasEfectivasJornada(val);
    }

    // Recalcular días con la nueva capacidad diaria
    const res = calcularSinergiaManoObra({
      items,
      operarios: currentOperarios,
      horasEfectivasJornada: val,
      categoriasManoObra
    });
    if (onSelectDiasObjetivo) {
      onSelectDiasObjetivo(res.diasEnterosObra);
    }
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-4 shadow-2xs hover:shadow-xs transition-shadow">
      {/* ─── Encabezado: Título y Switch de Sinergia ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-outline-variant/20">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-on-surface">
                Planificación de Obra & Cuadrilla
              </h3>
              {sonCompatibles && aplicarOptimizacion && (
                <span className="text-xs sm:text-sm font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  -{Math.round((1 - sinergia.factorSinergia) * 100)}% ahorro MOD
                </span>
              )}
            </div>
            <p className="text-sm text-on-surface-variant mt-0.5 leading-relaxed">
              Ajustá la cuadrilla o los días de entrega; el sistema los sincroniza en tiempo real según las horas de trabajo.
            </p>
          </div>
        </div>

        {/* Switch directo: Aplicar sinergia de obra */}
        <label
          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-outline-variant/20 shrink-0 select-none transition-all min-h-[44px] ${
            sonCompatibles
              ? 'cursor-pointer bg-surface-container hover:bg-surface-container-high'
              : 'opacity-60 cursor-not-allowed bg-surface-container/50'
          }`}
          title={
            sonCompatibles
              ? 'Aplica consolidación de setup y bono tándem al presupuesto'
              : 'Requiere al menos 2 partidas con mano de obra'
          }
        >
          <input
            type="checkbox"
            checked={aplicarOptimizacion && sonCompatibles}
            disabled={!sonCompatibles}
            onChange={(e) => onToggleAplicarOptimizacion(e.target.checked)}
            className="w-5 h-5 text-primary rounded border-outline bg-surface-container-highest focus:ring-primary disabled:opacity-50"
          />
          <span className="text-sm font-bold text-on-surface">
            {sonCompatibles ? 'Aplicar sinergia' : 'Sinergia no aplicable'}
          </span>
        </label>
      </div>

      {/* ─── Controles Directos en Una Sola Fila/Grid (Sin Tarjetas ni Pestañas) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* 1. Cuadrilla de Trabajo */}
        <div className="bg-surface-container p-3.5 sm:p-4 rounded-2xl border border-outline-variant/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-on-surface flex items-center gap-2">
              <HardHat className="w-4 h-4 text-primary" />
              Cuadrilla de Obra:
            </span>
            {currentOperarios >= 2 && (
              <span className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Tándem
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2.5 bg-surface-container-lowest p-2 rounded-xl border border-outline-variant/30 min-h-[52px]">
            <button
              type="button"
              onClick={() => handleOperariosChange(currentOperarios - 1)}
              disabled={currentOperarios <= 1}
              className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface disabled:opacity-30 disabled:pointer-events-none transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              title="Quitar un operario"
            >
              <Minus className="w-5 h-5" />
            </button>

            <div className="text-center flex-1">
              <div className="text-lg sm:text-xl font-black font-mono text-primary leading-tight">
                {currentOperarios} {currentOperarios === 1 ? 'Operario' : 'Operarios'}
              </div>
              <div className="text-xs sm:text-sm text-on-surface-variant font-medium truncate">
                {sinergia.composicionCuadrillaTexto}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOperariosChange(currentOperarios + 1)}
              disabled={currentOperarios >= 10}
              className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface disabled:opacity-30 disabled:pointer-events-none transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              title="Agregar un operario"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Plazo de Entrega (Días de Obra) */}
        <div className="bg-surface-container p-3.5 sm:p-4 rounded-2xl border border-outline-variant/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-on-surface flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Plazo de Entrega:
            </span>
            <span className="text-xs sm:text-sm text-on-surface-variant font-mono font-semibold">
              {sinergia.tiempoObraHorasReloj} hs reloj
            </span>
          </div>

          <div className="flex items-center justify-between gap-2.5 bg-surface-container-lowest p-2 rounded-xl border border-outline-variant/30 min-h-[52px]">
            <button
              type="button"
              onClick={() => handleDiasChange(Math.max(1, displayedDias - 1))}
              disabled={displayedDias <= 1}
              className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface disabled:opacity-30 disabled:pointer-events-none transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              title="Reducir plazo objetivo"
            >
              <Minus className="w-5 h-5" />
            </button>

            <div className="text-center flex-1">
              <div className="text-lg sm:text-xl font-black font-mono text-primary leading-tight">
                {displayedDias} {displayedDias === 1 ? 'Jornada' : 'Jornadas'}
              </div>
              <div className="text-xs sm:text-sm text-on-surface-variant font-medium">
                {displayedDias === 1 ? '1 día hábil de obra' : `${displayedDias} días hábiles de obra`}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleDiasChange(displayedDias + 1)}
              className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              title="Aumentar plazo objetivo"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3. Horas por Jornada (Restricción de Sitio) */}
        <div className="bg-surface-container p-3.5 sm:p-4 rounded-2xl border border-outline-variant/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-on-surface flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Jornada de Trabajo:
            </span>
            <span className="text-xs sm:text-sm text-on-surface-variant font-medium">Capacidad diaria</span>
          </div>

          <div className="flex items-center gap-2 bg-surface-container-lowest p-2 rounded-xl border border-outline-variant/30 min-h-[52px]">
            {[
              { hs: 4, label: '4h', tip: '4 hs/día (Consorcio / ruidos)' },
              { hs: 8, label: '8h', tip: '8 hs/día (Jornada legal)' },
              { hs: 9, label: '9h', tip: '9 hs/día (Extendida L-V)' }
            ].map((preset) => {
              const isSelected = currentHoras === preset.hs;
              return (
                <button
                  key={preset.hs}
                  type="button"
                  onClick={() => handleHorasChange(preset.hs)}
                  title={preset.tip}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all min-h-[44px] cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-on-primary shadow-2xs'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}

            {/* Input para horas personalizadas */}
            <div className="w-18">
              <NumericInput
                value={currentHoras}
                onChange={(val) => {
                  if (val !== null && val >= 1 && val <= 24) {
                    handleHorasChange(val);
                  }
                }}
                fallbackOnBlur={8}
                min={1}
                max={24}
                decimals={1}
                suffix="h"
                className="w-full bg-surface-container rounded-xl border border-outline-variant/20 px-1.5 py-2 text-sm font-mono font-bold text-on-surface text-center focus:outline-none min-h-[44px]"
                title="Horas personalizadas por jornada"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Resumen Compacto de Ejecución ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-surface-container rounded-2xl border border-outline-variant/15 text-sm text-on-surface-variant">
        <div className="flex items-center gap-5 flex-wrap">
          <div>
            <span className="font-bold text-on-surface">Nómina: </span>
            <span className="font-medium">{sinergia.composicionCuadrillaTexto}</span>
            <span className="font-mono text-on-surface ml-1 font-bold">({formatARS(sinergia.tarifaPonderadaCuadrilla)}/h)</span>
          </div>

          <div>
            <span className="font-bold text-on-surface">Costo MOD: </span>
            <span className="font-mono font-bold text-primary text-base">{formatARS(sinergia.costoManoObraSinergico)}</span>
            <span className="ml-1 opacity-80 font-mono">({sinergia.horasFinales} hs-hombre)</span>
          </div>
        </div>

        {sonCompatibles && aplicarOptimizacion && sinergia.ahorroManoObraARS > 0 && (
          <div className="text-emerald-700 dark:text-emerald-300 font-bold font-mono text-sm sm:text-base">
            Ahorro sinérgico: -{formatARS(sinergia.ahorroManoObraARS)}
          </div>
        )}
      </div>
    </div>
  );
};
