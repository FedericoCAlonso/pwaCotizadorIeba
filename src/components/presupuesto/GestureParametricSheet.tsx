import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Check,
  RotateCcw,
  Sparkles,
  Package,
  Clock,
  ShieldCheck,
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
    isDragging,
    touchPosition,
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
      // Desde arriba en borde derecho (W, H - radius) hasta izquierda en borde inferior (W - radius, H)
      return `M ${W} ${H - radius} A ${radius} ${radius} 0 0 0 ${W - radius} ${H}`;
    } else {
      // Desde arriba en borde izquierdo (0, H - radius) hasta derecha en borde inferior (radius, H)
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
        // Desde horizontal izq (-180°) hasta vertical arriba (-90°)
        rad = (-180 + angleDeg) * (Math.PI / 180);
      } else {
        // Desde vertical arriba (-90°) hasta horizontal der (0°)
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
      if (dy < 0) handlePrevParam(); // Arriba: retroceder
      else handleNextParam();        // Abajo: avanzar
    } else if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) handleNextParam();
      else handlePrevParam();
    }
    topTouchStart.current = null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#070A11] flex flex-col justify-between overflow-hidden text-slate-100 select-none touch-none animate-in fade-in duration-200">
      
      {/* 1. HEADER: Barra de Control Superior */}
      <header className="px-4 pt-3 pb-2.5 bg-slate-900/60 border-b border-slate-800/80 backdrop-blur-md shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 truncate">
              {tarea.categoria || 'Trabajo Tipo'}
            </span>
            <h2 className="text-xs sm:text-sm font-bold text-slate-100 truncate">{tarea.nombre}</h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Toggle Mano Diestro / Zurdo */}
            <button
              type="button"
              onClick={toggleHandedness}
              className="px-2.5 py-1 text-xs font-bold rounded-xl bg-slate-800/90 border border-slate-700/80 text-cyan-300 hover:bg-slate-700 active:scale-95 transition flex items-center gap-1 shadow-xs"
              title="Cambiar orientación de mano"
            >
              <span>{handedness === 'right' ? '✋ Diestro' : '🤚 Zurdo'}</span>
            </button>

            {/* Alternar a vista clásica */}
            <button
              type="button"
              onClick={onSwitchToClassic}
              className="p-1.5 rounded-xl bg-slate-800/70 text-slate-400 hover:text-slate-200 hover:bg-slate-700 active:scale-95 transition border border-slate-700/50"
              title="Ver formulario clásico"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Cerrar */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800/70 text-slate-400 hover:text-slate-200 hover:bg-slate-700 active:scale-95 transition border border-slate-700/50"
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
        <div className="flex items-center justify-between gap-3 bg-slate-900/80 p-2 rounded-2xl border border-slate-800/80 shadow-md">
          <button
            type="button"
            onClick={handlePrevParam}
            disabled={safeIndex === 0}
            className="p-2 rounded-xl bg-slate-800 disabled:opacity-20 text-slate-200 hover:bg-slate-700 active:scale-95 transition"
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
                    idx === safeIndex ? 'w-6 bg-cyan-400' : 'w-2 bg-slate-700'
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-semibold block">
              Paso {safeIndex + 1} de {visibleParams.length}
            </span>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-100 truncate">
              {activeParam?.nombre}
            </h3>
          </div>

          <button
            type="button"
            onClick={handleNextParam}
            disabled={safeIndex === visibleParams.length - 1}
            className="p-2 rounded-xl bg-slate-800 disabled:opacity-20 text-slate-200 hover:bg-slate-700 active:scale-95 transition"
            title="Siguiente parámetro"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Display del Valor de Gran Formato */}
        <div className="my-auto text-center py-2">
          <div className="inline-flex items-baseline gap-2 px-6 py-2.5 rounded-3xl bg-slate-900/90 border-2 border-cyan-500/30 shadow-[0_0_25px_rgba(6,182,212,0.15)]">
            <span className="font-mono text-4xl sm:text-5xl font-black text-cyan-300 tracking-tight drop-shadow-sm">
              {renderDisplayValue()}
            </span>
          </div>
          {activeParam?.descripcion && (
            <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto line-clamp-1">
              {activeParam.descripcion}
            </p>
          )}
        </div>

        {/* Cómputo Contextual en Tiempo Real */}
        <div className="grid grid-cols-3 gap-2 bg-slate-900/70 p-2 rounded-2xl border border-slate-800/80 text-center">
          <div className="px-1">
            <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Materiales</span>
            <strong className="text-xs font-mono font-bold text-slate-200">
              {formatARS(calculosResultado.costoInsumosTotal)}
            </strong>
          </div>
          <div className="px-1 border-l border-slate-800">
            <span className="text-[9px] uppercase font-bold text-emerald-400/90 block tracking-wider">M. Obra</span>
            <strong className="text-xs font-mono font-bold text-emerald-400">
              {formatARS(calculosResultado.costoManoObraTotal)}
            </strong>
          </div>
          <div className="px-1 border-l border-slate-800">
            <span className="text-[9px] uppercase font-black text-cyan-400 block tracking-wider">Total</span>
            <strong className="text-xs font-mono font-black text-cyan-300">
              {formatARS(calculosResultado.costoDirectoTotal)}
            </strong>
          </div>
        </div>
      </main>

      {/* 3. ZONA DEL ARCO DE ATAQUE ("One Hand" Inferior) */}
      <section
        ref={padRef}
        className="relative h-[48vh] bg-gradient-to-b from-slate-900/90 via-slate-950 to-black border-t-2 border-cyan-500/30 rounded-t-[2.5rem] flex flex-col justify-between p-4 overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing"
        {...handlers}
      >
        {/* Dial de Precisión SVG Interactivo */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${W} ${H}`}
        >
          <defs>
            <linearGradient id="arcGlowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.2" />
            </linearGradient>
            <radialGradient id="puckGlow">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="1" />
              <stop offset="40%" stopColor="#06b6d4" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Halo difuso del arco */}
          <path
            d={arcPath}
            fill="none"
            stroke="#06b6d4"
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
              stroke={t.isMajor ? '#22d3ee' : '#64748b'}
              strokeWidth={t.isMajor ? 2 : 1}
              strokeOpacity={t.isMajor ? 0.8 : 0.4}
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
            stroke="#06b6d4"
            strokeWidth="3"
          />
        </svg>

        {/* Marcadores de orientación polar (+ / -) */}
        <div className="relative z-10 flex items-center justify-between text-xs font-mono font-bold text-slate-500 px-3 pt-1 pointer-events-none">
          <span className="flex items-center gap-1 text-cyan-400/80">
            <span>▲ Barrer hacia arriba: +</span>
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <span>Barrer hacia abajo: - ▼</span>
          </span>
        </div>

        {/* Feedback visual dinámico al mover el pulgar */}
        <div className="relative z-10 my-auto text-center pointer-events-none">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/60 shadow-lg backdrop-blur-sm">
            {lastGesture === 'inc' && (
              <span className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-1 animate-pulse">
                <Plus className="w-3.5 h-3.5" /> Incrementando...
              </span>
            )}
            {lastGesture === 'dec' && (
              <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1 animate-pulse">
                <Minus className="w-3.5 h-3.5" /> Disminuyendo...
              </span>
            )}
            {lastGesture === 'prev' && (
              <span className="text-xs font-mono font-bold text-purple-300 flex items-center gap-1 animate-pulse">
                <span>⬆ Retrocediendo dato</span>
              </span>
            )}
            {lastGesture === 'next' && (
              <span className="text-xs font-mono font-bold text-emerald-300 flex items-center gap-1 animate-pulse">
                <span>⬇ Avanzando dato</span>
              </span>
            )}
            {!lastGesture && (
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
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
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(6,182,212,0.3)] hover:brightness-110 active:scale-[0.98] transition pointer-events-auto"
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
            <span>Confirmar e Insertar en Presupuesto</span>
          </button>
        </div>
      </section>

    </div>
  );
};
