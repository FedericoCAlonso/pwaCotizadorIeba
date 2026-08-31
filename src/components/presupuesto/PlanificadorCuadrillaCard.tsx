import React from 'react';
import {
  Users,
  HardHat,
  Clock,
  TrendingDown,
  Calendar,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import {
  ItemPresupuesto,
  CategoriaManoDeObra,
  SinergiaManoObraResultado,
  EstrategiaCuadrilla
} from '../../core/types';
import {
  calcularSinergiaManoObra,
  sonItemsCompatiblesParaSinergia,
  formatARS
} from '../../core/calculations';

interface PlanificadorCuadrillaCardProps {
  items: ItemPresupuesto[];
  operarios?: number;
  horasEfectivasJornada?: number;
  aplicarOptimizacion: boolean;
  onSelectOperarios?: (operarios: number) => void;
  onToggleAplicarOptimizacion: (aplicar: boolean) => void;
  categoriasManoObra?: CategoriaManoDeObra[];

  // Props de compatibilidad
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
  horasEfectivasJornada = 7.0,
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
  const sonCompatibles = sonItemsCompatiblesParaSinergia(items);

  const sinergia: SinergiaManoObraResultado = calcularSinergiaManoObra({
    items,
    operarios: currentOperarios,
    horasEfectivasJornada,
    categoriasManoObra
  });

  const handleOperariosChange = (n: number) => {
    if (onSelectOperarios) {
      onSelectOperarios(n);
    }
    if (onSelectEstrategia) {
      const est: EstrategiaCuadrilla = n === 1 ? 'minima' : (n >= 4 ? 'rapida' : 'optima');
      onSelectEstrategia(est);
    }
  };

  const cuadrillasPreview = React.useMemo(() => {
    return [1, 2, 3, 4].map((num) => {
      const res = calcularSinergiaManoObra({
        items,
        operarios: num,
        horasEfectivasJornada,
        categoriasManoObra
      });
      return {
        operarios: num,
        jornadas: res.jornadasEstimadas,
        diasEnteros: res.diasEnterosObra,
        horasReloj: res.tiempoObraHorasReloj,
        horasFinales: res.horasFinales,
        composicionTexto: res.composicionCuadrillaTexto,
        tarifaPonderada: res.tarifaPonderadaCuadrilla,
        costoMOD: res.costoManoObraSinergico
      };
    });
  }, [items, horasEfectivasJornada, categoriasManoObra]);

  return (
    <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl p-4 sm:p-6 space-y-5 shadow-2xs hover:shadow-xs transition-shadow">
      {/* ─── Header M3: Título, Roles y Switch ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-outline-variant/20">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-on-surface">
                Planificador de Cuadrilla & Plazos de Obra
              </h3>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
                {currentOperarios} {currentOperarios === 1 ? 'Operario' : 'Operarios'}
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {sinergia.composicionCuadrillaTexto}
              </span>
              {sonCompatibles && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-bold">
                  -{Math.round((1 - sinergia.factorSinergia) * 100)}% ahorro MOD
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Optimización física de mano de obra en tándem, composición de roles y cálculo de jornadas de convenio.
            </p>
          </div>
        </div>

        {/* Switch Aplicar al Presupuesto */}
        <label
          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border border-outline-variant/20 shrink-0 select-none transition-all ${
            sonCompatibles
              ? 'cursor-pointer bg-surface-container hover:bg-surface-container-high'
              : 'opacity-60 cursor-not-allowed bg-surface-container/50'
          }`}
          title={
            sonCompatibles
              ? 'Aplica la reducción de horas por sinergia y cálculo de jornales al presupuesto'
              : 'La sinergia requiere al menos 2 partidas con mano de obra real en la cotización'
          }
        >
          <input
            type="checkbox"
            checked={aplicarOptimizacion && sonCompatibles}
            disabled={!sonCompatibles}
            onChange={(e) => onToggleAplicarOptimizacion(e.target.checked)}
            className="w-4 h-4 text-primary rounded border-outline bg-surface-container-highest focus:ring-primary disabled:opacity-50"
          />
          <span className="text-xs font-semibold text-on-surface">
            {sonCompatibles ? 'Aplicar al presupuesto' : 'Sinergia no aplicable (1 ítem solo)'}
          </span>
        </label>
      </div>

      {/* ─── Grid de Opciones de Cuadrilla (M3 Cards) ─── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
            <HardHat className="w-4 h-4 text-primary" />
            Selección de Cuadrilla de Obra:
          </span>
          {currentOperarios >= 2 ? (
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/20">
              <Sparkles className="w-3 h-3" />
              Bono tándem activo (-10% tiempo de tracción)
            </span>
          ) : (
            <span className="text-[10px] text-on-surface-variant">Trabajo individual secuencial</span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cuadrillasPreview.map((item) => {
            const isSelected = currentOperarios === item.operarios;
            return (
              <button
                key={item.operarios}
                type="button"
                onClick={() => handleOperariosChange(item.operarios)}
                className={`p-3.5 rounded-2xl text-left border transition-all flex flex-col justify-between space-y-2.5 relative ${
                  isSelected
                    ? 'bg-primary/10 border-primary ring-2 ring-primary/30 shadow-xs'
                    : 'bg-surface-container border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/60 hover:bg-surface-container-high'
                }`}
              >
                {/* Header de la tarjeta */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs sm:text-sm text-on-surface">
                      {item.operarios} {item.operarios === 1 ? 'Operario' : 'Operarios'}
                    </span>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  )}
                </div>

                {/* Plazo Destacado */}
                <div className="space-y-0.5">
                  <div className="text-base sm:text-lg font-black font-mono text-primary leading-tight">
                    {item.diasEnteros} {item.diasEnteros === 1 ? 'Jornada' : 'Jornadas'}
                  </div>
                  <div className="text-[11px] text-on-surface-variant font-medium">
                    {item.horasReloj} hs reloj en obra <span className="opacity-75">({item.jornadas} d)</span>
                  </div>
                </div>

                {/* Composición y Costo de Nómina */}
                <div className="pt-2 border-t border-outline-variant/20 space-y-0.5 w-full">
                  <div className="text-[11px] font-semibold text-on-surface truncate">
                    {item.composicionTexto}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-on-surface-variant font-mono">
                    <span>{formatARS(item.tarifaPonderada)}/h</span>
                    <span className="font-bold text-on-surface">{formatARS(item.costoMOD)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Banner Destacado M3: Resumen Ejecutivo de Obra ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-surface-container rounded-2xl border border-outline-variant/20 items-center">
        {/* A. Plazo Físico */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-on-surface-variant font-medium">
              Plazo de Entrega:
            </div>
            <div className="text-xs sm:text-sm font-black text-primary font-mono">
              {sinergia.diasEnterosObra} {sinergia.diasEnterosObra === 1 ? 'Jornada completa' : 'Jornadas completas'}
            </div>
            <div className="text-[11px] text-on-surface-variant flex items-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>{sinergia.tiempoObraHorasReloj} hs reloj en sitio ({sinergia.horasEfectivasJornada}h netas/día)</span>
            </div>
          </div>
        </div>

        {/* B. Composición & Tarifa */}
        <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-outline-variant/20 pt-2.5 md:pt-0 md:pl-4">
          <div className="p-2.5 rounded-xl bg-secondary-container text-on-secondary-container shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-on-surface-variant font-medium">
              Nómina Asignada:
            </div>
            <div className="text-xs sm:text-sm font-bold text-on-surface">
              {sinergia.composicionCuadrillaTexto}
            </div>
            <div className="text-[11px] text-on-surface-variant font-mono mt-0.5">
              Tarifa Ponderada: <strong>{formatARS(sinergia.tarifaPonderadaCuadrilla)}/h</strong>
            </div>
          </div>
        </div>

        {/* C. Consumo MOD & Ahorro */}
        <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 md:border-l border-outline-variant/20 pt-2.5 md:pt-0 md:pl-4">
          <div className="text-left md:text-right">
            <div className="text-xs text-on-surface-variant font-medium">
              Costo Nómina Presupuesto:
            </div>
            <div className="text-sm font-black text-on-surface font-mono">
              {formatARS(sinergia.costoManoObraSinergico)}
            </div>
            <div className="text-[11px] text-on-surface-variant">
              {sinergia.horasFinales} hs-hombre liquidables
            </div>
          </div>

          {sonCompatibles && sinergia.ahorroManoObraARS > 0 && (
            <div className="text-right shrink-0">
              <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-end gap-1">
                <TrendingDown className="w-3 h-3" />
                Ahorro:
              </div>
              <div className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">
                {formatARS(sinergia.ahorroManoObraARS)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Footer de Métricas Sinérgicas M3 ─── */}
      <div className="bg-surface-container/50 p-3 rounded-2xl border border-outline-variant/20 flex flex-wrap items-center justify-between gap-3 text-xs text-on-surface-variant">
        <div className="flex items-center gap-3 flex-wrap">
          <span>
            Setup consolidado: <strong className="text-on-surface font-mono">{sinergia.horasSetupConsolidado} hs</strong> (-{sinergia.ahorroSetupHs} hs)
          </span>
          {currentOperarios >= 2 && (
            <span>
              Bono tándem: <strong className="text-on-surface font-mono">-{sinergia.bonoTandemHs} hs</strong>
            </span>
          )}
        </div>

        <div className="text-[11px] italic text-on-surface-variant">
          * Horas efectivas por jornada: {sinergia.horasEfectivasJornada} hs (absorbe apertura, limpieza y pausas diarias).
        </div>
      </div>
    </div>
  );
};
