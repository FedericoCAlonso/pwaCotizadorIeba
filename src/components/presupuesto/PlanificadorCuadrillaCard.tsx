import React from 'react';
import {
  Users,
  HardHat,
  Clock,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Sparkles,
  Truck
} from 'lucide-react';
import {
  EstrategiaCuadrilla,
  NivelConfianzaSinergia,
  ItemPresupuesto,
  CostoIndirecto,
  CostoIndirectoItemConfig,
  CategoriaManoDeObra
} from '../../core/types';
import {
  calcularOptimizacionCuadrilla,
  sonItemsCompatiblesParaSinergia,
  formatARS
} from '../../core/calculations';

interface PlanificadorCuadrillaCardProps {
  items: ItemPresupuesto[];
  costosIndirectosCatalog?: CostoIndirecto[];
  costosIndirectosConfig?: CostoIndirectoItemConfig[];
  categoriasManoObra?: CategoriaManoDeObra[];
  estrategiaSeleccionada: EstrategiaCuadrilla;
  nivelConfianza?: NivelConfianzaSinergia;
  aplicarOptimizacion: boolean;
  onSelectEstrategia: (estrategia: EstrategiaCuadrilla) => void;
  onSelectNivelConfianza?: (nivel: NivelConfianzaSinergia) => void;
  onToggleAplicarOptimizacion: (aplicar: boolean) => void;
}

export const PlanificadorCuadrillaCard: React.FC<PlanificadorCuadrillaCardProps> = ({
  items,
  costosIndirectosCatalog = [],
  costosIndirectosConfig,
  categoriasManoObra = [],
  estrategiaSeleccionada,
  nivelConfianza = 80,
  aplicarOptimizacion,
  onSelectEstrategia,
  onSelectNivelConfianza,
  onToggleAplicarOptimizacion
}) => {
  if (!items || items.length === 0) return null;

  const sonCompatibles = sonItemsCompatiblesParaSinergia(items);

  const resultado = calcularOptimizacionCuadrilla({
    items,
    costosIndirectosCatalog,
    costosIndirectosConfig,
    categoriasManoObra,
    estrategiaSeleccionada,
    nivelConfianza,
    aplicarOptimizacion: aplicarOptimizacion && sonCompatibles
  });

  const { opciones, opcionActiva, horasTeoricasTotal, horasSetupTotal, desvioEstandarTotal, coeficienteVariacionPct, costoDiarioMovilidad, planificacion } = resultado;

  const nivelesConfianza: { valor: NivelConfianzaSinergia; label: string; sub: string; z: string }[] = [
    { valor: 50, label: '50% Competitivo', sub: 'Media pura (Z=0)', z: '0.00' },
    { valor: 80, label: '80% Equilibrado', sub: 'Estándar obra (Z=0.84)', z: '0.84' },
    { valor: 90, label: '90% Conservador', sub: 'Mayor cobertura (Z=1.28)', z: '1.28' },
    { valor: 95, label: '95% Blindado', sub: 'Cero riesgo (Z=1.64)', z: '1.64' }
  ];

  return (
    <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl p-4 sm:p-6 space-y-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-outline-variant/20">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shrink-0">
            <HardHat className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-on-surface">
                Planificación de Cuadrilla & Sinergia Estocástica
              </h3>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
                {opcionActiva.operariosTotales} {opcionActiva.operariosTotales === 1 ? 'Operario' : 'Operarios'} · {opcionActiva.jornadasDias} Días
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Confianza: {nivelConfianza}% (Z={planificacion.zScore?.toFixed(2)})
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Composición probabilística de mano de obra (PERT / T.C.L.) con reducción de setup compartido y tándem.
            </p>
          </div>
        </div>

        {/* Switch Aplicar al Presupuesto */}
        <label
          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border border-outline-variant/20 shrink-0 select-none ${
            sonCompatibles
              ? 'cursor-pointer bg-surface-container'
              : 'opacity-60 cursor-not-allowed bg-surface-container/50'
          }`}
          title={
            sonCompatibles
              ? 'Aplica el coeficiente de sinergia estocástica de cuadrilla a la mano de obra del presupuesto'
              : 'La sinergia requiere al menos 2 ítems de obra compatibles en la cotización'
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
            {sonCompatibles ? 'Aplicar sinergia al precio' : 'Sinergia no aplicable (1 solo ítem)'}
          </span>
        </label>
      </div>

      {/* Probabilistic Confidence Level Selector */}
      {sonCompatibles && onSelectNivelConfianza && (
        <div className="p-3 bg-surface-container rounded-2xl border border-outline-variant/20 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <span className="font-bold text-on-surface flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              Nivel de Certeza / Confianza Probabilística:
            </span>
            <span className="text-[11px] text-on-surface-variant font-mono">
              σ Total = ±{desvioEstandarTotal} hs (CV: {coeficienteVariacionPct}%)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {nivelesConfianza.map((nc) => {
              const isSelected = nivelConfianza === nc.valor;
              return (
                <button
                  key={nc.valor}
                  type="button"
                  onClick={() => onSelectNivelConfianza(nc.valor)}
                  className={`p-2 rounded-xl text-left border transition-all ${
                    isSelected
                      ? 'bg-primary/15 border-primary text-primary font-bold shadow-xs'
                      : 'bg-surface-container-high border-outline-variant/20 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
                  }`}
                >
                  <div className="text-xs">{nc.label}</div>
                  <div className="text-[10px] opacity-80">{nc.sub}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3 Strategy Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* 1. Cuadrilla Mínima */}
        <div
          onClick={() => onSelectEstrategia('minima')}
          className={`cursor-pointer rounded-2xl p-4 border transition-all space-y-3 relative ${
            estrategiaSeleccionada === 'minima'
              ? 'bg-surface-container-high border-primary ring-2 ring-primary/40 shadow-xs'
              : 'bg-surface-container hover:bg-surface-container-high border-outline-variant/30 opacity-90 hover:opacity-100'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-on-surface block">{opciones.minima.titulo}</span>
              <span className="text-[11px] text-on-surface-variant">{opciones.minima.subtitulo}</span>
            </div>
            {estrategiaSeleccionada === 'minima' && (
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-on-surface-variant">
              <span>Días estimados:</span>
              <strong className="text-on-surface font-mono">{opciones.minima.jornadasDias} días</strong>
            </div>
            <div className="flex justify-between text-on-surface-variant">
              <span>Horas efectivas:</span>
              <span className="font-mono">{opciones.minima.horasTotales} hs</span>
            </div>
            <div className="flex justify-between text-on-surface-variant">
              <span>Costo ejecución:</span>
              <span className="font-mono font-bold text-on-surface">{formatARS(opciones.minima.costoTotalEjecucionARS)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-outline-variant/15 flex items-center justify-between text-[10px]">
            <span className="text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Riesgo Parate: Muy Bajo
            </span>
            <span className="text-on-surface-variant">100% horas base</span>
          </div>
        </div>

        {/* 2. Cuadrilla Óptima (Recomendada) */}
        <div
          onClick={() => onSelectEstrategia('optima')}
          className={`cursor-pointer rounded-2xl p-4 border transition-all space-y-3 relative ${
            estrategiaSeleccionada === 'optima'
              ? 'bg-primary-container/20 border-primary ring-2 ring-primary shadow-sm'
              : 'bg-surface-container hover:bg-surface-container-high border-primary/40'
          }`}
        >
          <div className="absolute -top-2.5 right-4 bg-primary text-on-primary text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1 uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            Recomendado
          </div>

          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-primary block">{opciones.optima.titulo}</span>
              <span className="text-[11px] text-on-surface-variant">{opciones.optima.subtitulo}</span>
            </div>
            {estrategiaSeleccionada === 'optima' && (
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-on-surface-variant">
              <span>Días estimados:</span>
              <strong className="text-primary font-mono font-bold">{opciones.optima.jornadasDias} días</strong>
            </div>
            <div className="flex justify-between text-on-surface-variant">
              <span>Horas optimizadas:</span>
              <span className="font-mono font-bold text-on-surface">
                {opciones.optima.horasTotales} hs <span className="text-emerald-600 text-[10px]">(-15%)</span>
              </span>
            </div>
            <div className="flex justify-between text-on-surface-variant">
              <span>Costo ejecución:</span>
              <span className="font-mono font-bold text-primary">{formatARS(opciones.optima.costoTotalEjecucionARS)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-outline-variant/15 flex items-center justify-between text-[10px]">
            <span className="text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Riesgo Parate: Bajo
            </span>
            {opciones.optima.ahorroRespectoBaseARS > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 font-mono">
                <TrendingDown className="w-3 h-3" />
                Ahorro {formatARS(opciones.optima.ahorroRespectoBaseARS)}
              </span>
            )}
          </div>
        </div>

        {/* 3. Cuadrilla Rápida / Crash */}
        <div
          onClick={() => onSelectEstrategia('rapida')}
          className={`cursor-pointer rounded-2xl p-4 border transition-all space-y-3 relative ${
            estrategiaSeleccionada === 'rapida'
              ? 'bg-surface-container-high border-amber-500 ring-2 ring-amber-500/40 shadow-xs'
              : 'bg-surface-container hover:bg-surface-container-high border-outline-variant/30 opacity-90 hover:opacity-100'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-on-surface block">{opciones.rapida.titulo}</span>
              <span className="text-[11px] text-on-surface-variant">{opciones.rapida.subtitulo}</span>
            </div>
            {estrategiaSeleccionada === 'rapida' && (
              <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-on-surface-variant">
              <span>Días estimados:</span>
              <strong className="text-on-surface font-mono">{opciones.rapida.jornadasDias} días</strong>
            </div>
            <div className="flex justify-between text-on-surface-variant">
              <span>Horas efectivas:</span>
              <span className="font-mono">{opciones.rapida.horasTotales} hs</span>
            </div>
            <div className="flex justify-between text-on-surface-variant">
              <span>Costo ejecución:</span>
              <span className="font-mono font-bold text-on-surface">{formatARS(opciones.rapida.costoTotalEjecucionARS)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-outline-variant/15 flex items-center justify-between text-[10px]">
            <span className="text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Riesgo Parate: Alto
            </span>
            <span className="text-on-surface-variant">1h parate = 4h salario</span>
          </div>
        </div>
      </div>

      {/* Strategic Insights Footer */}
      <div className="bg-surface-container/70 p-3.5 rounded-2xl border border-outline-variant/20 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-on-surface-variant">
            • Horas Teóricas Sumadas: <strong className="text-on-surface font-mono">{horasTeoricasTotal} hs</strong>
          </span>
          <span className="text-on-surface-variant">
            • Setup Consolidado: <strong className="text-on-surface font-mono">{horasSetupTotal} hs</strong>
          </span>
          <span className="text-on-surface-variant">
            • Logística Diaria: <strong className="text-on-surface font-mono">{formatARS(costoDiarioMovilidad)}/día</strong>
          </span>
        </div>

        <div className="text-[11px] text-primary font-semibold flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" />
          <span>{opcionActiva.descripcionRiesgo}</span>
        </div>
      </div>
    </div>
  );
};
