import { useRef, useState, useCallback, useEffect } from 'react';

export type Handedness = 'right' | 'left';

export interface UseThumbArcGestureOptions {
  handedness?: Handedness;
  /** Radianes de giro angular para disparar un tick de incremento/decremento (default ~0.04 rad = ~2.3°) */
  sensitivityRad?: number;
  onStepChange?: (direction: 1 | -1) => void;
  /** Gesto vertical hacia arriba: Retroceder parámetro */
  onPrevField?: () => void;
  /** Gesto vertical hacia abajo: Avanzar parámetro */
  onNextField?: () => void;
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
  lastGesture: 'inc' | 'dec' | 'next' | 'prev' | 'confirm' | null;
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
}

export function useThumbArcGesture({
  handedness: initialHandedness = 'right',
  sensitivityRad = 0.04,
  onStepChange,
  onPrevField,
  onNextField,
  onConfirm,
  enableHaptics = true
}: UseThumbArcGestureOptions = {}): ThumbArcGestureReturn {
  const [handedness, setHandedness] = useState<Handedness>(initialHandedness);
  const [isDragging, setIsDragging] = useState(false);
  const [touchPosition, setTouchPosition] = useState<{ x: number; y: number } | null>(null);
  const [arcProgress, setArcProgress] = useState<number>(0.5);
  const [lastGesture, setLastGesture] = useState<'inc' | 'dec' | 'next' | 'prev' | 'confirm' | null>(null);

  // Estados del clasificador de gestos:
  // 'detecting': acumulando los primeros ~20px para clasificar la intención con precisión matemática
  // 'dial': recorrido circular por el arco (incremento / decremento)
  // 'vertical_swipe': trazo vertical consumido (arriba retroceder, abajo avanzar)
  const gestureState = useRef<'detecting' | 'dial' | 'vertical_swipe'>('detecting');
  const startPos = useRef<{ x: number; y: number; time: number; radius: number; angle: number } | null>(null);
  const lastAngle = useRef<number | null>(null);
  const accumulatedAngle = useRef<number>(0);
  const lastTapTime = useRef<number>(0);

  const toggleHandedness = useCallback(() => {
    setHandedness(prev => (prev === 'right' ? 'left' : 'right'));
  }, []);

  const triggerHaptic = useCallback((duration: number = 8) => {
    if (enableHaptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {
        // Ignorar
      }
    }
  }, [enableHaptics]);

  // Calcula ángulo polar y radio respecto al vértice biomecánico (esquina inferior derecha o izquierda)
  const getPolarFromEvent = useCallback((e: React.PointerEvent): { angle: number; radius: number; progress: number } => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const pivotX = handedness === 'right' ? rect.width : 0;
    const pivotY = rect.height;

    const dx = x - pivotX;
    const dy = y - pivotY;

    const radius = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    let progress = 0.5;
    if (handedness === 'right') {
      const normalized = (angle + Math.PI) / (Math.PI / 2);
      progress = Math.max(0, Math.min(1, normalized));
    } else {
      const normalized = 1 - (angle + Math.PI / 2) / (Math.PI / 2);
      progress = Math.max(0, Math.min(1, normalized));
    }

    return { angle, radius, progress };
  }, [handedness]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // Ignorar en testing
    }

    const { angle, radius, progress } = getPolarFromEvent(e);
    lastAngle.current = angle;
    accumulatedAngle.current = 0;
    gestureState.current = 'detecting';

    const now = Date.now();
    startPos.current = { x: e.clientX, y: e.clientY, time: now, radius, angle };

    setIsDragging(true);
    setTouchPosition({ x: e.clientX, y: e.clientY });
    setArcProgress(progress);

    if (now - lastTapTime.current < 260) {
      triggerHaptic(20);
      setLastGesture('confirm');
      onConfirm?.();
      lastTapTime.current = 0;
    } else {
      lastTapTime.current = now;
    }
  }, [getPolarFromEvent, onConfirm, triggerHaptic]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !startPos.current || lastAngle.current === null) return;

    setTouchPosition({ x: e.clientX, y: e.clientY });
    const { angle, radius, progress } = getPolarFromEvent(e);
    setArcProgress(progress);

    const deltaX = e.clientX - startPos.current.x;
    const deltaY = e.clientY - startPos.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const totalDisplacement = Math.hypot(deltaX, deltaY);

    // 1. VENTANA DE DISCRIMINACIÓN (Slop de ~20px para clasificar la intención con precisión)
    if (gestureState.current === 'detecting') {
      // Si aún no recorrió al menos 20px, no decidimos todavía
      if (totalDisplacement < 20) {
        return;
      }

      // Al alcanzar 20px de movimiento evaluamos la trayectoria:
      // ¿Es un trazo vertical? (absY dominante sobre absX con ratio >= 1.3)
      if (absY >= absX * 1.3) {
        gestureState.current = 'vertical_swipe';
        if (deltaY < 0) {
          // Desplazamiento hacia ARRIBA: RETROCEDER
          triggerHaptic(20);
          setLastGesture('prev');
          onPrevField?.();
        } else {
          // Desplazamiento hacia ABAJO: AVANZAR
          triggerHaptic(20);
          setLastGesture('next');
          onNextField?.();
        }
        return;
      }

      // Si no es un trazo vertical, es un movimiento de giro por el arco:
      gestureState.current = 'dial';
    }

    // 2. SI ES SWIPE VERTICAL: se ignora el dial durante este toque
    if (gestureState.current === 'vertical_swipe') {
      return;
    }

    // 3. MODO DIAL (Recorrido por el arco: incremento / decremento):
    let deltaAngle = angle - lastAngle.current;
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

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
  }, [getPolarFromEvent, handedness, isDragging, onNextField, onPrevField, onStepChange, sensitivityRad, triggerHaptic]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    try {
      target.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    // Si soltó rápidamente (flick vertical rápido que terminó antes de acumular 20px en moves intermedios):
    if (gestureState.current === 'detecting' && startPos.current) {
      const deltaX = e.clientX - startPos.current.x;
      const deltaY = e.clientY - startPos.current.y;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const duration = Date.now() - startPos.current.time;

      if (duration < 350 && absY >= 16 && absY >= absX * 1.2) {
        if (deltaY < 0) {
          triggerHaptic(20);
          setLastGesture('prev');
          onPrevField?.();
        } else {
          triggerHaptic(20);
          setLastGesture('next');
          onNextField?.();
        }
      }
    }

    setIsDragging(false);
    setTouchPosition(null);
    lastAngle.current = null;
    accumulatedAngle.current = 0;
    gestureState.current = 'detecting';
    startPos.current = null;
  }, [onNextField, onPrevField, triggerHaptic]);

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    onPointerUp(e);
  }, [onPointerUp]);

  useEffect(() => {
    if (!lastGesture) return;
    const timer = setTimeout(() => {
      setLastGesture(null);
    }, 450);
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
