import { useRef, useState, useCallback, useEffect } from 'react';

export type Handedness = 'right' | 'left';

export interface UseThumbArcGestureOptions {
  handedness?: Handedness;
  /** Radianes de giro angular para disparar un tick de incremento/decremento (default ~0.055 rad = ~3.15°) */
  sensitivityRad?: number;
  onStepChange?: (direction: 1 | -1) => void;
  onNextField?: () => void;
  onPrevField?: () => void;
  onConfirm?: () => void;
  enableHaptics?: boolean;
}

export interface ThumbArcGestureReturn {
  handedness: Handedness;
  setHandedness: (hand: Handedness) => void;
  toggleHandedness: () => void;
  isDragging: boolean;
  touchPosition: { x: number; y: number } | null;
  arcProgress: number; // 0 (reposo abajo) a 1 (máxima extensión arriba)
  lastGesture: 'inc' | 'dec' | 'confirm' | null;
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
}

export function useThumbArcGesture({
  handedness: initialHandedness = 'right',
  sensitivityRad = 0.055,
  onStepChange,
  onConfirm,
  enableHaptics = true
}: UseThumbArcGestureOptions = {}): ThumbArcGestureReturn {
  const [handedness, setHandedness] = useState<Handedness>(initialHandedness);
  const [isDragging, setIsDragging] = useState(false);
  const [touchPosition, setTouchPosition] = useState<{ x: number; y: number } | null>(null);
  const [arcProgress, setArcProgress] = useState<number>(0.5);
  const [lastGesture, setLastGesture] = useState<'inc' | 'dec' | 'confirm' | null>(null);

  // Referencias para seguimiento polar
  const lastAngle = useRef<number | null>(null);
  const accumulatedAngle = useRef<number>(0);
  const lastTapTime = useRef<number>(0);

  const toggleHandedness = useCallback(() => {
    setHandedness(prev => (prev === 'right' ? 'left' : 'right'));
  }, []);

  // Vibración táctil sutil
  const triggerHaptic = useCallback((duration: number = 8) => {
    if (enableHaptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {
        // Ignorar si el navegador restringe
      }
    }
  }, [enableHaptics]);

  // Calcula ángulo polar relativo al vértice de la mano correspondiente
  const getAngleFromEvent = useCallback((e: React.PointerEvent): { angle: number; progress: number } => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Centro del arco:
    // Mano derecha: esquina inferior derecha (rect.width, rect.height)
    // Mano izquierda: esquina inferior izquierda (0, rect.height)
    const pivotX = handedness === 'right' ? rect.width : 0;
    const pivotY = rect.height;

    const dx = x - pivotX;
    const dy = y - pivotY;

    const angle = Math.atan2(dy, dx);

    // Progreso normalizado de 0 a 1 a lo largo del cuadrante de 90°
    let progress = 0.5;
    if (handedness === 'right') {
      // Ángulos en el 3er cuadrante: de -Math.PI (-180° horizontal izq) a -Math.PI/2 (-90° vertical arriba)
      const normalized = (angle + Math.PI) / (Math.PI / 2);
      progress = Math.max(0, Math.min(1, normalized));
    } else {
      // Ángulos en el 4to cuadrante: de -Math.PI/2 (-90° vertical arriba) a 0 (0° horizontal der)
      const normalized = 1 - (angle + Math.PI / 2) / (Math.PI / 2);
      progress = Math.max(0, Math.min(1, normalized));
    }

    return { angle, progress };
  }, [handedness]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // Ignorar en testing
    }

    const { angle, progress } = getAngleFromEvent(e);
    lastAngle.current = angle;
    accumulatedAngle.current = 0;

    setIsDragging(true);
    setTouchPosition({ x: e.clientX, y: e.clientY });
    setArcProgress(progress);

    // Detección de doble toque rápido para confirmar
    const now = Date.now();
    if (now - lastTapTime.current < 260) {
      triggerHaptic(20);
      setLastGesture('confirm');
      onConfirm?.();
      lastTapTime.current = 0;
    } else {
      lastTapTime.current = now;
    }
  }, [getAngleFromEvent, onConfirm, triggerHaptic]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || lastAngle.current === null) return;

    setTouchPosition({ x: e.clientX, y: e.clientY });
    const { angle, progress } = getAngleFromEvent(e);
    setArcProgress(progress);

    let deltaAngle = angle - lastAngle.current;

    // Normalizar cruce de radianes
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

    // Dirección ergonómica:
    // Mano derecha: ángulo creciente (hacia arriba) es incremento (+1)
    // Mano izquierda: ángulo decreciente (hacia arriba) es incremento (+1)
    const effectiveDelta = handedness === 'right' ? deltaAngle : -deltaAngle;

    accumulatedAngle.current += effectiveDelta;

    if (Math.abs(accumulatedAngle.current) >= sensitivityRad) {
      const direction: 1 | -1 = accumulatedAngle.current > 0 ? 1 : -1;
      triggerHaptic(8);
      setLastGesture(direction === 1 ? 'inc' : 'dec');
      onStepChange?.(direction);
      accumulatedAngle.current = 0;
    }

    lastAngle.current = angle;
  }, [getAngleFromEvent, handedness, isDragging, onStepChange, sensitivityRad, triggerHaptic]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    try {
      target.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    setIsDragging(false);
    setTouchPosition(null);
    lastAngle.current = null;
    accumulatedAngle.current = 0;
  }, []);

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    onPointerUp(e);
  }, [onPointerUp]);

  // Limpiar indicador de último gesto tras 300ms
  useEffect(() => {
    if (!lastGesture) return;
    const timer = setTimeout(() => {
      setLastGesture(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [lastGesture]);

  return {
    handedness,
    setHandedness,
    toggleHandedness,
    isDragging,
    touchPosition,
    arcProgress,
    lastGesture,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel
    }
  };
}
