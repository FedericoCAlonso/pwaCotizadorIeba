import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  Minus
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
import { useThumbArcGesture } from '../../hooks/useThumbArcGesture';

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
  const padRef = useRef<HTMLDivElement>(null);
  const [padDimensions, setPadDimensions] = useState<{ width: number; height: number }>({ width: 380, height: 280 });

  // Medir dinámicamente el tamaño real del pad táctil para dibujo SVG exacto
  useEffect(() => {
    const el = padRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setPadDimensions({ width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    };

    updateSize();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateSize);
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, []);

  // Filtrar parámetros visibles
  const visibleParams = useMemo(() => {
    if (!tarea.parametros || tarea.parametros.length === 0) {
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

  const safeIndex = Math.min(Math.max(0, activeParamIndex), Math.max(0, visibleParams.length - 1));
  const activeParam: ParametroTrabajoTipo | undefined = visibleParams[safeIndex];

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

  // Modificación de valor
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

    const step = getStepSize(activeParam);
    const min = activeParam.id.includes('factor') || activeParam.id.includes('coef') ? 0.1 : 0;
    const nextVal = Math.max(min, Math.round((currentVal + direction * step) * 100) / 100);
    onParametroChange(activeParam.id, nextVal);
  };

  const handleNextParam = () => {
    if (safeIndex < visibleParams.length - 1) setActiveParamIndex(prev => prev + 1);
  };

  const handlePrevParam = () => {
    if (safeIndex > 0) setActiveParamIndex(prev => prev - 1);
  };

  const {
    handedness,
    toggleHandedness,
    arcProgress,
    lastGesture,
    handlers
  } = useThumbArcGesture({
    handedness: 'right',
    sensitivityRad: 0.045,
    onStepChange: handleStepChange,
    onPrevField: handlePrevParam,
    onNextField: handleNextParam,
    onConfirm: onConfirm,
    enableHaptics: true
  });

  // Geometría del arco y dial según la mano
  const W = padDimensions.width;
  const H = padDimensions.height;
  const radius = Math.min(W, H) * 0.78;
  const pivotX = handedness === 'right' ? W : 0;
  const pivotY = H;

  // Path SVG del arco principal (Centro en esquina inferior: derecha para diestro, izquierda para zurdo)
  const arcPath = useMemo(() => {
    if (handedness === 'right') {
      return `M ${W} ${H - radius} A ${radius} ${radius} 0 0 0 ${W - radius} ${H}`;
    } else {
      return `M 0 ${H - radius} A ${radius} ${radius} 0 0 1 ${radius} ${H}`;
    }
  }, [handedness, W, H, radius]);

  // Graduaciones radiales del dial (cada 5° y 15°)
  const ticks = useMemo(() => {
    const list: Array<{ x1: number; y1: number; x2: number; y2: number; isMajor: boolean }> = [];
    const count = 18; // 18 divisiones de 5° (90°)
    for (let i = 0; i <= count; i++) {
      const isMajor = i % 3 === 0;
      const tickLen = isMajor ? 14 : 7;
      const angleDeg = i * 5; // 0° a 90°

      let rad: number;
      if (handedness === 'right') {
        rad = (-180 + angleDeg) * (Math.PI / 180);
      } else {
        rad = (-90 + angleDeg) * (Math.PI / 180);
      }

      const rInner = radius - tickLen;
      const rOuter = radius + tickLen;

      list.push({
        x1: pivotX + rInner * Math.cos(rad),
        y1: pivotY + rInner * Math.sin(rad),
        x2: pivotX + rOuter * Math.cos(rad),
        y2: pivotY + rOuter * Math.sin(rad),
        isMajor
      });
    }
    return list;
  }, [handedness, pivotX, pivotY, radius]);

  // Posición del cursor/puck en el arco según el progreso actual
  const puckPosition = useMemo(() => {
    let rad: number;
    if (handedness === 'right') {
      rad = (-180 + arcProgress * 90) * (Math.PI / 180);
    } else {
      rad = (-90 + (1 - arcProgress) * 90) * (Math.PI / 180);
    }
    return {
      x: pivotX + radius * Math.cos(rad),
      y: pivotY + radius * Math.sin(rad)
    };
  }, [handedness, arcProgress, pivotX, pivotY, radius]);

  // Texto legible del valor
  const renderDisplayValue = () => {
    if (!activeParam) return '--';
    if (activeParam.tipo === 'boolean') return currentVal === 1 ? 'SÍ' : 'NO';
    if (activeParam.tipo === 'select' && activeParam.opciones) {
      const opt = activeParam.opciones.find(o => o.valor === currentVal);
      return opt ? opt.label : `${currentVal}`;
    }
    return `${currentVal} ${activeParam.unidad || ''}`.trim();
  };

  // Soporte de swipe directo en la tarjeta superior
  const topTouchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTopPointerDown = (e: React.PointerEvent) => {
    topTouchStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleTopPointerUp = (e: React.PointerEvent) => {
    if (!topTouchStart.current) return;
    const dy = e.clientY - topTouchStart.current.y;
    const dx = e.clientX - topTouchStart.current.x;
    if (Math.abs(dy) > 25 && Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) handlePrevParam();
      else handleNextParam();
    } else if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) handleNextParam();
      else handlePrevParam();
    }
    topTouchStart.current = null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-surface flex flex-col justify-between overflow-hidden text-on-surface select-none touch-none animate-in fade-in duration-200">
      
      {/* 1. HEADER: Barra de Control Superior */}
      <header className="px-4 pt-3 pb-2.5 bg-surface-container/80 border-b border-outline-variant/30 backdrop-blur-md shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container border border-primary/20 truncate">
              {tarea.categoria || 'Trabajo Tipo'}
            </span>
            <h2 className="text-xs sm:text-sm font-bold text-on-surface truncate">{tarea.nombre}</h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Toggle Mano Diestro / Zurdo */}
            <button
              type="button"
              onClick={toggleHandedness}
              className="px-2.5 py-1 text-xs font-bold rounded-xl bg-surface-container-highest border border-outline-variant/40 text-on-surface hover:bg-surface-container-high active:scale-95 transition flex items-center gap-1 shadow-xs cursor-pointer"
              title="Cambiar orientación de mano"
            >
              <span>{handedness === 'right' ? '✋ Diestro' : '🤚 Zurdo'}</span>
            </button>

            {/* Alternar a vista clásica */}
            <button
              type="button"
              onClick={onSwitchToClassic}
              className="p-1.5 rounded-xl bg-surface-container-highest text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high active:scale-95 transition border border-outline-variant/30 cursor-pointer"
              title="Ver formulario clásico"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Cerrar */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-surface-container-highest text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high active:scale-95 transition border border-outline-variant/30 cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. ZONA DE LECTURA ("One Eye" Superior) */}
      <main
        onPointerDown={handleTopPointerDown}
        onPointerUp={handleTopPointerUp}
        className="flex-1 px-4 py-2 flex flex-col justify-between max-h-[46vh] overflow-hidden"
      >
        
        {/* Selector de Parámetros Segmentado */}
        <div className="flex items-center justify-between gap-3 bg-surface-container p-2 rounded-2xl border border-outline-variant/30 shadow-xs">
          <button
            type="button"
            onClick={handlePrevParam}
            disabled={safeIndex === 0}
            className="p-2 rounded-xl bg-surface-container-highest disabled:opacity-20 text-on-surface hover:bg-surface-container-high active:scale-95 transition cursor-pointer"
            title="Parámetro anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-center min-w-0 flex-1">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              {visibleParams.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === safeIndex ? 'w-6 bg-primary' : 'w-2 bg-outline-variant'
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary font-semibold block">
              Paso {safeIndex + 1} de {visibleParams.length}
            </span>
            <h3 className="text-sm sm:text-base font-extrabold text-on-surface truncate">
              {activeParam?.nombre}
            </h3>
          </div>

          <button
            type="button"
            onClick={handleNextParam}
            disabled={safeIndex === visibleParams.length - 1}
            className="p-2 rounded-xl bg-surface-container-highest disabled:opacity-20 text-on-surface hover:bg-surface-container-high active:scale-95 transition cursor-pointer"
            title="Siguiente parámetro"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Display del Valor de Gran Formato */}
        <div className="my-auto text-center py-2">
          <div className="inline-flex items-baseline gap-2 px-6 py-2.5 rounded-3xl bg-surface-container-high border-2 border-primary/30 shadow-md3-1">
            <span className="font-mono text-4xl sm:text-5xl font-black text-primary tracking-tight">
              {renderDisplayValue()}
            </span>
          </div>
          {activeParam?.descripcion && (
            <p className="text-xs text-on-surface-variant mt-1.5 max-w-sm mx-auto line-clamp-1">
              {activeParam.descripcion}
            </p>
          )}
        </div>

        {/* Cómputo Contextual en Tiempo Real */}
        <div className="grid grid-cols-3 gap-2 bg-surface-container p-2 rounded-2xl border border-outline-variant/30 text-center">
          <div className="px-1">
            <span className="text-[9px] uppercase font-bold text-on-surface-variant block tracking-wider">Materiales</span>
            <strong className="text-xs font-mono font-bold text-on-surface">
              {formatARS(calculosResultado.costoInsumosTotal)}
            </strong>
          </div>
          <div className="px-1 border-l border-outline-variant/30">
            <span className="text-[9px] uppercase font-bold text-secondary block tracking-wider">M. Obra</span>
            <strong className="text-xs font-mono font-bold text-secondary">
              {formatARS(calculosResultado.costoManoObraTotal)}
            </strong>
          </div>
          <div className="px-1 border-l border-outline-variant/30">
            <span className="text-[9px] uppercase font-black text-primary block tracking-wider">Total</span>
            <strong className="text-xs font-mono font-black text-primary">
              {formatARS(calculosResultado.costoDirectoTotal)}
            </strong>
          </div>
        </div>
      </main>

      {/* 3. ZONA DEL ARCO DE ATAQUE ("One Hand" Inferior) */}
      <section
        ref={padRef}
        className="relative h-[48vh] bg-surface-container-low border-t border-outline-variant/40 rounded-t-[2.5rem] flex flex-col justify-between p-4 overflow-hidden shadow-md3-3 cursor-grab active:cursor-grabbing"
        {...handlers}
      >
        {/* Dial de Precisión SVG Interactivo */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${W} ${H}`}
        >
          <defs>
            <linearGradient id="arcGlowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ca8a04" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#eab308" stopOpacity="0.3" />
            </linearGradient>
            <radialGradient id="puckGlow">
              <stop offset="0%" stopColor="#eab308" stopOpacity="1" />
              <stop offset="50%" stopColor="#ca8a04" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#854d0e" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Halo difuso del arco */}
          <path
            d={arcPath}
            fill="none"
            stroke="#ca8a04"
            strokeWidth="16"
            strokeOpacity="0.12"
            strokeLinecap="round"
          />

          {/* Arco guía principal */}
          <path
            d={arcPath}
            fill="none"
            stroke="url(#arcGlowGradient)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Graduaciones radiales (ticks) */}
          {ticks.map((t, idx) => (
            <line
              key={idx}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.isMajor ? '#ca8a04' : '#94a3b8'}
              strokeWidth={t.isMajor ? 2 : 1}
              strokeOpacity={t.isMajor ? 0.9 : 0.4}
            />
          ))}

          {/* Cursor luminoso que viaja por el arco */}
          <circle
            cx={puckPosition.x}
            cy={puckPosition.y}
            r="20"
            fill="url(#puckGlow)"
          />
          <circle
            cx={puckPosition.x}
            cy={puckPosition.y}
            r="8"
            fill="#ffffff"
            stroke="#ca8a04"
            strokeWidth="3"
          />
        </svg>

        {/* Marcadores de orientación polar (+ / -) */}
        <div className="relative z-10 flex items-center justify-between text-xs font-mono font-bold px-3 pt-1 pointer-events-none">
          <span className="flex items-center gap-1 text-primary">
            <span>▲ Barrer hacia arriba: +</span>
          </span>
          <span className="flex items-center gap-1 text-on-surface-variant">
            <span>Barrer hacia abajo: - ▼</span>
          </span>
        </div>

        {/* Feedback visual dinámico al mover el pulgar */}
        <div className="relative z-10 my-auto text-center pointer-events-none">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-container-highest/90 border border-outline-variant/40 shadow-xs backdrop-blur-sm">
            {lastGesture === 'inc' && (
              <span className="text-xs font-mono font-bold text-primary flex items-center gap-1 animate-pulse">
                <Plus className="w-3.5 h-3.5" /> Incrementando...
              </span>
            )}
            {lastGesture === 'dec' && (
              <span className="text-xs font-mono font-bold text-secondary flex items-center gap-1 animate-pulse">
                <Minus className="w-3.5 h-3.5" /> Disminuyendo...
              </span>
            )}
            {lastGesture === 'prev' && (
              <span className="text-xs font-mono font-bold text-tertiary flex items-center gap-1 animate-pulse">
                <span>⬆ Retrocediendo dato</span>
              </span>
            )}
            {lastGesture === 'next' && (
              <span className="text-xs font-mono font-bold text-primary flex items-center gap-1 animate-pulse">
                <span>⬇ Avanzando dato</span>
              </span>
            )}
            {!lastGesture && (
              <span className="text-xs text-on-surface-variant flex items-center gap-1.5">
                <span>◄ Arco: valor • ↕ Arriba: retroceder / Abajo: avanzar ►</span>
              </span>
            )}
          </div>
        </div>

        {/* Botón de Confirmación Principal al alcance natural del pulgar */}
        <div className="relative z-10 pt-2">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-3.5 px-4 rounded-2xl bg-primary text-on-primary font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 active:scale-[0.98] transition pointer-events-auto cursor-pointer"
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
            <span>Confirmar e Insertar en Presupuesto</span>
          </button>
        </div>
      </section>

    </div>
  );
};
