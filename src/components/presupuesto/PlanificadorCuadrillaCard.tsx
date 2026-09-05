import React, { useState } from 'react';
import {
  Users,
  HardHat,
  Clock,
  TrendingDown,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Minus,
  Timer
} from 'lucide-react';
import {
  ItemPresupuesto,
  CategoriaManoDeObra,
  SinergiaManoObraResultado,
  EstrategiaCuadrilla,
  ModoPlanificacionCuadrilla
} from '../../core/types';
import {
  calcularSinergiaManoObra,
  estimarCuadrillaPorPlazo,
  sonItemsCompatiblesParaSinergia,
  formatARS
} from '../../core/calculations';

interface PlanificadorCuadrillaCardProps {
  items: ItemPresupuesto[];
  operarios?: number;
  horasEfectivasJornada?: number;
  onSelectHorasEfectivasJornada?: (horas: number) => void;
  modoPlanificacion?: ModoPlanificacionCuadrilla;
  onSelectModoPlanificacion?: (modo: ModoPlanificacionCuadrilla) => void;
  diasObjetivo?: number;
  onSelectDiasObjetivo?: (dias: number) => void;
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
  horasEfectivasJornada = 8.0,
  onSelectHorasEfectivasJornada,
  modoPlanificacion = 'equipo',
  onSelectModoPlanificacion,
  diasObjetivo = 3,
  onSelectDiasObjetivo,
  aplicarOptimizacion,
  onSelectOperarios,
  onToggleAplicarOptimizacion,
  categoriasManoObra = [],
  // Props de compatibilidad
  estrategiaSeleccionada,
  onSelectEstrategia
}) => {
  // Estado local para fallback controlado / no-controlado
  const [localModo, setLocalModo] = useState<ModoPlanificacionCuadrilla>(modoPlanificacion);
  const [localHoras, setLocalHoras] = useState<number>(horasEfectivasJornada);
  const [localDias, setLocalDias] = useState<number>(diasObjetivo);
  const [isCustomHoras, setIsCustomHoras] = useState<boolean>(![4, 8, 9].includes(horasEfectivasJornada));

  const currentModo = onSelectModoPlanificacion ? modoPlanificacion : localModo;
  const currentHoras = onSelectHorasEfectivasJornada ? horasEfectivasJornada : localHoras;
  const currentDias = onSelectDiasObjetivo ? diasObjetivo : localDias;

  const handleModoChange = (modo: ModoPlanificacionCuadrilla) => {
    if (onSelectModoPlanificacion) {
      onSelectModoPlanificacion(modo);
    } else {
      setLocalModo(modo);
    }
  };

  const handleHorasChange = (horas: number) => {
    const val = Math.max(1, Math.min(16, horas));
    if (onSelectHorasEfectivasJornada) {
      onSelectHorasEfectivasJornada(val);
    } else {
      setLocalHoras(val);
    }
  };

  const handleDiasChange = (dias: number) => {
    const val = Math.max(0.5, Math.round(dias * 2) / 2);
    if (onSelectDiasObjetivo) {
      onSelectDiasObjetivo(val);
    } else {
      setLocalDias(val);
    }
  };

  if (!items || items.length === 0) return null;

  const currentOperarios = operarios ?? (estrategiaSeleccionada === 'minima' ? 1 : (estrategiaSeleccionada === 'rapida' ? 4 : 2));
  const sonCompatibles = sonItemsCompatiblesParaSinergia(items);

  const sinergia: SinergiaManoObraResultado = calcularSinergiaManoObra({
    items,
    operarios: currentOperarios,
    horasEfectivasJornada: currentHoras,
    categoriasManoObra
  });

  const estimacionPorPlazo = estimarCuadrillaPorPlazo({
    items,
    diasObjetivo: currentDias,
    horasEfectivasJornada: currentHoras,
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
        horasEfectivasJornada: currentHoras,
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
  }, [items, currentHoras, categoriasManoObra]);

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
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
                {currentOperarios} {currentOperarios === 1 ? 'Operario' : 'Operarios'}
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {sinergia.composicionCuadrillaTexto}
              </span>
              {sonCompatibles && (
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-bold">
                  -{Math.round((1 - sinergia.factorSinergia) * 100)}% ahorro MOD
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Planificación bidireccional de plazos de obra, horas hábiles diarias y composición de roles de cuadrilla.
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

      {/* ─── Configuración de Restricción Horaria (Jornada Diaria) ─── */}
      <div className="bg-surface-container p-3.5 sm:p-4 rounded-2xl border border-outline-variant/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-bold text-on-surface">
              Ventana de trabajo disponible por jornada:
            </span>
            <p className="text-xs text-on-surface-variant">
              Define las horas netas útiles en obra por día (crucial para consorcios con límites de ruido o locales comerciales).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { hs: 4, label: '4 hs/día', sub: 'Consorcio / Ruido' },
            { hs: 8, label: '8 hs/día', sub: 'Jornada Legal' },
            { hs: 9, label: '9 hs/día', sub: 'Extendida L-V' }
          ].map((preset) => {
            const isSelected = !isCustomHoras && currentHoras === preset.hs;
            return (
              <button
                key={preset.hs}
                type="button"
                onClick={() => {
                  setIsCustomHoras(false);
                  handleHorasChange(preset.hs);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  isSelected
                    ? 'bg-primary text-on-primary border-primary shadow-2xs'
                    : 'bg-surface-container-high text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-highest'
                }`}
              >
                {preset.label}
              </button>
            );
          })}

          {/* Selector libre si no es preset */}
          <div className="flex items-center gap-1 pl-1">
            <button
              type="button"
              onClick={() => setIsCustomHoras(true)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isCustomHoras
                  ? 'bg-primary text-on-primary border-primary shadow-2xs'
                  : 'bg-surface-container-high text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-highest'
              }`}
            >
              Otro
            </button>
            {isCustomHoras && (
              <div className="flex items-center gap-1 bg-surface-container-highest px-2 py-1 rounded-xl border border-primary/40">
                <input
                  type="number"
                  min={1}
                  max={16}
                  step={0.5}
                  value={currentHoras}
                  onChange={(e) => handleHorasChange(parseFloat(e.target.value) || 1)}
                  className="w-12 bg-transparent text-xs font-mono font-bold text-on-surface focus:outline-none text-center"
                />
                <span className="text-xs text-on-surface-variant">hs</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Selector de Modo de Planificación (Bidireccional) ─── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-1 bg-surface-container rounded-2xl border border-outline-variant/20 w-full sm:w-fit">
          <button
            type="button"
            onClick={() => handleModoChange('equipo')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              currentModo === 'equipo'
                ? 'bg-surface-container-highest text-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <HardHat className="w-4 h-4" />
            <span>Definir por Equipo disponible</span>
          </button>
          <button
            type="button"
            onClick={() => handleModoChange('plazo')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              currentModo === 'plazo'
                ? 'bg-surface-container-highest text-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Timer className="w-4 h-4" />
            <span>Definir por Plazo de entrega</span>
          </button>
        </div>

        {/* ─── CASO 1: MODO EQUIPO FIJO (El instalador fija cuadrilla -> calcula plazo) ─── */}
        {currentModo === 'equipo' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <HardHat className="w-4 h-4 text-primary" />
                Selección de Cuadrilla fija:
              </span>
              {currentOperarios >= 2 ? (
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/20">
                  <Sparkles className="w-3.5 h-3.5" />
                  Bono tándem activo (-10% tiempo)
                </span>
              ) : (
                <span className="text-xs text-on-surface-variant">Trabajo individual secuencial</span>
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
                      <span className="font-bold text-xs sm:text-sm text-on-surface">
                        {item.operarios} {item.operarios === 1 ? 'Operario' : 'Operarios'}
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </div>

                    {/* Plazo Destacado */}
                    <div className="space-y-0.5">
                      <div className="text-base sm:text-lg font-black font-mono text-primary leading-tight">
                        {item.diasEnteros} {item.diasEnteros === 1 ? 'Jornada' : 'Jornadas'}
                      </div>
                      <div className="text-xs text-on-surface-variant font-medium">
                        {item.horasReloj} hs reloj <span className="opacity-80">({item.jornadas} d a {currentHoras}h/d)</span>
                      </div>
                    </div>

                    {/* Composición y Costo de Nómina */}
                    <div className="pt-2 border-t border-outline-variant/20 space-y-0.5 w-full">
                      <div className="text-xs font-semibold text-on-surface truncate">
                        {item.composicionTexto}
                      </div>
                      <div className="flex items-center justify-between text-xs text-on-surface-variant font-mono">
                        <span>{formatARS(item.tarifaPonderada)}/h</span>
                        <span className="font-bold text-on-surface">{formatARS(item.costoMOD)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── CASO 2: MODO PLAZO OBJETIVO (El plazo manda -> calcula cuadrilla) ─── */}
        {currentModo === 'plazo' && (
          <div className="space-y-3.5">
            <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/20 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-primary" />
                    Plazo límite exigido para terminar la obra:
                  </span>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Ingresá los días hábiles disponibles de trabajo con jornadas de {currentHoras} hs.
                  </p>
                </div>

                {/* Control Stepper de Días */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDiasChange(Math.max(1, currentDias - 1))}
                    className="p-2 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface hover:bg-surface-container-highest"
                    title="Restar día"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="bg-surface-container-lowest px-4 py-1.5 rounded-xl border border-primary/30 text-center min-w-[5rem]">
                    <span className="text-base font-black font-mono text-primary">
                      {currentDias}
                    </span>
                    <span className="text-xs text-on-surface-variant ml-1 font-semibold">
                      {currentDias === 1 ? 'día' : 'días'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDiasChange(currentDias + 1)}
                    className="p-2 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface hover:bg-surface-container-highest"
                    title="Sumar día"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Botones de acceso rápido para días */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-outline-variant/15">
                <span className="text-xs text-on-surface-variant font-medium mr-1">Plazos típicos:</span>
                {[1, 2, 3, 5, 10].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleDiasChange(d)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${
                      currentDias === d
                        ? 'bg-secondary-container text-on-secondary-container font-bold border border-secondary/30'
                        : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest border border-outline-variant/20'
                    }`}
                  >
                    {d} {d === 1 ? 'día' : 'días'}
                  </button>
                ))}
              </div>
            </div>

            {/* Tarjeta de Recomendación de Cuadrilla */}
            <div className="p-4 sm:p-5 rounded-2xl border-2 border-primary/30 bg-primary/5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-primary text-on-primary">
                    <HardHat className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-primary uppercase tracking-wider">
                      Cuadrilla Sugerida para este plazo
                    </div>
                    <div className="text-base sm:text-lg font-black text-on-surface">
                      {estimacionPorPlazo.operariosSugeridos} {estimacionPorPlazo.operariosSugeridos === 1 ? 'Operario' : 'Operarios'}
                      <span className="text-xs font-medium text-on-surface-variant ml-2">
                        ({estimacionPorPlazo.sinergiaSugerida.composicionCuadrillaTexto})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botón de Aplicar Cuadrilla */}
                {currentOperarios !== estimacionPorPlazo.operariosSugeridos ? (
                  <button
                    type="button"
                    onClick={() => handleOperariosChange(estimacionPorPlazo.operariosSugeridos)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-xs hover:bg-primary/90 transition-all shrink-0"
                  >
                    <span>Asignar esta cuadrilla</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Cuadrilla activa en cotización</span>
                  </div>
                )}
              </div>

              {/* Explicación de cumplimiento */}
              <div className="text-xs text-on-surface-variant bg-surface-container-lowest/60 p-3 rounded-xl border border-outline-variant/15 flex items-start gap-2">
                {estimacionPorPlazo.esFactible ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <span>
                  {estimacionPorPlazo.mensaje} Tiempo estimado: <strong>{estimacionPorPlazo.sinergiaSugerida.diasEnterosObra} jornadas</strong> ({estimacionPorPlazo.sinergiaSugerida.tiempoObraHorasReloj} hs reloj en sitio).
                </span>
              </div>

              {/* Comparador de alternativas si cambia la cuadrilla */}
              <div className="pt-2 border-t border-outline-variant/15 flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
                <span>
                  Alternativas: Con {Math.max(1, estimacionPorPlazo.operariosSugeridos - 1)} op tardarías{' '}
                  <strong className="text-on-surface">
                    {calcularSinergiaManoObra({ items, operarios: Math.max(1, estimacionPorPlazo.operariosSugeridos - 1), horasEfectivasJornada: currentHoras, categoriasManoObra }).diasEnterosObra} jornadas
                  </strong>
                  . Con {estimacionPorPlazo.operariosSugeridos + 1} op tardarías{' '}
                  <strong className="text-on-surface">
                    {calcularSinergiaManoObra({ items, operarios: estimacionPorPlazo.operariosSugeridos + 1, horasEfectivasJornada: currentHoras, categoriasManoObra }).diasEnterosObra} jornadas
                  </strong>
                  .
                </span>
              </div>
            </div>
          </div>
        )}
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
            <div className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>{sinergia.tiempoObraHorasReloj} hs reloj en sitio ({currentHoras}h netas/día)</span>
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
            <div className="text-xs text-on-surface-variant font-mono mt-0.5">
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
            <div className="text-xs text-on-surface-variant">
              {sinergia.horasFinales} hs-hombre liquidables
            </div>
          </div>

          {sonCompatibles && sinergia.ahorroManoObraARS > 0 && (
            <div className="text-right shrink-0">
              <div className="text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-end gap-1">
                <TrendingDown className="w-3.5 h-3.5" />
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

        <div className="text-xs italic text-on-surface-variant">
          * Horas efectivas por jornada: {currentHoras} hs (absorbe apertura, limpieza y pausas diarias).
        </div>
      </div>
    </div>
  );
};
