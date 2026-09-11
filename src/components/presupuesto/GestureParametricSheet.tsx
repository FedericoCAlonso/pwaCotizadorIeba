import React, { useState, useMemo } from 'react';
import {
  X,
  Sliders,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Check,
  RotateCcw,
  Smartphone
} from 'lucide-react';
import {
  TareaTipo,
  ParametroTrabajoTipo
} from '../../core/types';
import {
  formatARS,
  ConsumosCalculadosResultado,
  safeNum
} from '../../core/calculations';
import { evaluateCondition } from '../../core/mathEvaluator';
import { useThumbArcGesture, Handedness } from '../../hooks/useThumbArcGesture';

interface GestureParametricSheetProps {
  tarea: TareaTipo;
  parametrosValues: Record<string, number>;
  onParametroChange: (paramId: string, value: number) => void;
  calculosResultado: ConsumosCalculadosResultado;
  onConfirm: () => void;
  onClose: () => void;
  onSwitchToClassic: () => void;
}

export const GestureParametricSheet: React.FC<GestureParametricSheetProps> = ({
  tarea,
  parametrosValues,
  onParametroChange,
  calculosResultado,
  onConfirm,
  onClose,
  onSwitchToClassic
}) => {
  const [activeParamIndex, setActiveParamIndex] = useState(0);

  // Filtrar parámetros visibles según condiciones dinámicas
  const visibleParams = useMemo(() => {
    if (!tarea.parametros || tarea.parametros.length === 0) {
      // Parámetro sintético de cantidad si la tarea no tiene definidos
      const defaultParam: ParametroTrabajoTipo = {
        id: 'cantidad',
        nombre: `Cantidad de ${tarea.unidad || 'Unidades'}`,
        tipo: 'numero',
        valorDefault: 1,
        unidad: tarea.unidad || 'u'
      };
      return [defaultParam];
    }

    const currentScope: Record<string, number> = {};
    const visible: ParametroTrabajoTipo[] = [];

    tarea.parametros.forEach((p) => {
      let isVisible = true;
      if (p.condicion && p.condicion.trim()) {
        isVisible = evaluateCondition(p.condicion, currentScope);
      }
      const rawVal = parametrosValues[p.id] !== undefined
        ? safeNum(parametrosValues[p.id])
        : (p.valorDefault ?? 1);

      currentScope[p.id] = isVisible ? rawVal : 0;
      if (isVisible) visible.push(p);
    });

    return visible;
  }, [tarea.parametros, tarea.unidad, parametrosValues]);

  // Asegurar que el índice activo esté dentro del rango
  const safeIndex = Math.min(Math.max(0, activeParamIndex), Math.max(0, visibleParams.length - 1));
  const activeParam: ParametroTrabajoTipo | undefined = visibleParams[safeIndex];

  // Determinar tamaño de paso según el tipo y unidad del parámetro
  const getStepSize = (p?: ParametroTrabajoTipo): number => {
    if (!p) return 1;
    if (p.unidad === 'm' || p.id.includes('distancia') || p.id.includes('longitud')) return 0.5;
    if (p.unidad === 'm²' || p.id.includes('superficie')) return 2;
    if (p.id.includes('potencia') || p.id.includes('frigorias')) return 250;
    return 1;
  };

  const currentVal = activeParam
    ? (parametrosValues[activeParam.id] ?? activeParam.valorDefault ?? 1)
    : 1;

  // Lógica de modificación de valor al arrastrar en arco
  const handleStepChange = (direction: 1 | -1) => {
    if (!activeParam) return;

    if (activeParam.tipo === 'boolean') {
      const nextVal = currentVal === 1 ? 0 : 1;
      onParametroChange(activeParam.id, nextVal);
      return;
    }

    if (activeParam.tipo === 'select' && activeParam.opciones && activeParam.opciones.length > 0) {
      const currentIndex = activeParam.opciones.findIndex(op => op.valor === currentVal);
      let nextIndex = currentIndex + direction;
      if (nextIndex < 0) nextIndex = 0;
      if (nextIndex >= activeParam.opciones.length) nextIndex = activeParam.opciones.length - 1;
      onParametroChange(activeParam.id, activeParam.opciones[nextIndex].valor);
      return;
    }

    // Parámetro numérico continuo
    const step = getStepSize(activeParam);
    const min = activeParam.id.includes('factor') || activeParam.id.includes('coef') ? 0.1 : 0;
    const nextVal = Math.max(min, Math.round((currentVal + direction * step) * 100) / 100);
    onParametroChange(activeParam.id, nextVal);
  };

  const handleNextParam = () => {
    if (safeIndex < visibleParams.length - 1) {
      setActiveParamIndex(prev => prev + 1);
    }
  };

  const handlePrevParam = () => {
    if (safeIndex > 0) {
      setActiveParamIndex(prev => prev - 1);
    }
  };

  // Hook gestual conectado a la zona inferior (Arco del Pulgar)
  const {
    handedness,
    toggleHandedness,
    isDragging,
    touchPosition,
    lastGesture,
    handlers
  } = useThumbArcGesture({
    handedness: 'right',
    sensitivityPx: 16,
    onStepChange: handleStepChange,
    onNextField: handleNextParam,
    onPrevField: handlePrevParam,
    onConfirm: onConfirm,
    enableHaptics: true
  });

  // Etiqueta visible del valor actual
  const renderDisplayValue = () => {
    if (!activeParam) return '--';

    if (activeParam.tipo === 'boolean') {
      return currentVal === 1 ? 'SÍ' : 'NO';
    }

    if (activeParam.tipo === 'select' && activeParam.opciones) {
      const opt = activeParam.opciones.find(o => o.valor === currentVal);
      return opt ? opt.label : `${currentVal}`;
    }

    return `${currentVal} ${activeParam.unidad || ''}`.trim();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col justify-between overflow-hidden text-on-surface select-none touch-none animate-in fade-in duration-200">
      
      {/* 1. ZONA SUPERIOR: Lectura ("One Eye") - Despejada y de alto contraste */}
      <header className="px-4 pt-3 pb-2 bg-surface-container-lowest/80 border-b border-outline-variant/20 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/20 text-primary truncate">
              {tarea.categoria || 'Trabajo Tipo'}
            </span>
            <h2 className="text-sm font-bold text-on-surface truncate">{tarea.nombre}</h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Toggle Mano Diestro / Zurdo */}
            <button
              type="button"
              onClick={toggleHandedness}
              className="px-2 py-1 text-xs font-semibold rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface hover:bg-surface-container-high transition flex items-center gap-1"
              title="Cambiar orientación de mano"
            >
              <span>{handedness === 'right' ? '✋ Diestro' : '🤚 Zurdo'}</span>
            </button>

            {/* Alternar a vista clásica */}
            <button
              type="button"
              onClick={onSwitchToClassic}
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition"
              title="Ver formulario clásico"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Cerrar */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. ZONA DE IMPACTO VISUAL: Pantalla Focal */}
      <main className="flex-1 px-4 py-2 flex flex-col justify-around max-h-[48vh] overflow-hidden">
        
        {/* Selector de Parámetro (Indicador de pasos) */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handlePrevParam}
            disabled={safeIndex === 0}
            className="p-1.5 rounded-full bg-surface-container disabled:opacity-20 text-on-surface"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Parámetro {safeIndex + 1} de {visibleParams.length}
            </span>
            <h3 className="text-base font-extrabold text-on-surface leading-tight">
              {activeParam?.nombre}
            </h3>
          </div>

          <button
            type="button"
            onClick={handleNextParam}
            disabled={safeIndex === visibleParams.length - 1}
            className="p-1.5 rounded-full bg-surface-container disabled:opacity-20 text-on-surface"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Display Gigante del Valor ("Glanceable") */}
        <div className="my-1 text-center">
          <div className="inline-block px-6 py-2 rounded-3xl bg-surface-container-high/80 border border-primary/20 shadow-inner">
            <span className="font-mono text-4xl sm:text-5xl font-black text-primary tracking-tight">
              {renderDisplayValue()}
            </span>
          </div>
          {activeParam?.descripcion && (
            <p className="text-xs text-on-surface-variant mt-1.5 line-clamp-1">
              {activeParam.descripcion}
            </p>
          )}
        </div>

        {/* Cómputo en Tiempo Real (Contextual) */}
        <div className="grid grid-cols-3 gap-2 bg-surface-container-low p-2.5 rounded-2xl border border-outline-variant/20 text-center">
          <div>
            <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Materiales</span>
            <strong className="text-xs font-mono font-bold text-on-surface">
              {formatARS(calculosResultado.costoInsumosTotal)}
            </strong>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Mano de Obra</span>
            <strong className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {formatARS(calculosResultado.costoManoObraTotal)}
            </strong>
          </div>
          <div className="border-l border-outline-variant/30 pl-1">
            <span className="text-[10px] uppercase font-black text-primary block">Total</span>
            <strong className="text-xs font-mono font-black text-primary">
              {formatARS(calculosResultado.costoDirectoTotal)}
            </strong>
          </div>
        </div>
      </main>

      {/* 3. ZONA INFERIOR: Trackpad del Arco de Ataque ("One Hand") */}
      <section
        className="relative h-[44vh] bg-surface-container-high/90 border-t-2 border-primary/30 rounded-t-[2.5rem] flex flex-col justify-between p-4 overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing"
        {...handlers}
      >
        {/* Curvatura del Arco Biomecánico dibujada en SVG */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-25"
          viewBox="0 0 400 300"
          preserveAspectRatio="none"
        >
          <path
            d={
              handedness === 'right'
                ? 'M 420,320 A 300,300 0 0,0 60,80'
                : 'M -20,320 A 300,300 0 0,1 340,80'
            }
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray="6 6"
            className="text-primary animate-pulse"
          />
        </svg>

        {/* Indicador de arrastre activo */}
        {isDragging && touchPosition && (
          <div
            className="absolute w-12 h-12 rounded-full bg-primary/30 border-2 border-primary -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-75 flex items-center justify-center animate-ping"
            style={{ left: touchPosition.x, top: touchPosition.y }}
          />
        )}

        {/* Feedback visual de último gesto */}
        <div className="text-center pt-2">
          <span className="text-xs font-mono uppercase tracking-widest text-primary font-bold">
            {lastGesture === 'inc' && '▲ Aumentando...'}
            {lastGesture === 'dec' && '▼ Disminuyendo...'}
            {lastGesture === 'next' && '➔ Siguiente Parámetro'}
            {lastGesture === 'prev' && '⬅ Parámetro Previo'}
            {!lastGesture && (
              <span className="text-on-surface-variant flex items-center justify-center gap-1.5">
                <span>◄ Deslizá en arco para variar el valor ►</span>
              </span>
            )}
          </span>
        </div>

        {/* Guía gestual central limpia */}
        <div className="my-auto text-center pointer-events-none">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-container border border-outline-variant/30 text-xs text-on-surface-variant">
            <span>↕ Arriba/Abajo: Cambiar parámetro</span>
            <span>•</span>
            <span>Doble toque: Confirmar</span>
          </div>
        </div>

        {/* Botón de Confirmación Principal al alcance del pulgar */}
        <button
          type="button"
          onClick={onConfirm}
          className="w-full py-3.5 px-4 rounded-2xl bg-primary text-on-primary font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-[0.98] transition pointer-events-auto"
        >
          <Check className="w-5 h-5 stroke-[2.5]" />
          <span>Confirmar y Agregar al Presupuesto</span>
        </button>
      </section>

    </div>
  );
};
