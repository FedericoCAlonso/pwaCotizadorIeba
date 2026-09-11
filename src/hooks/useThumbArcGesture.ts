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

  // Clasificador de intención: 'unknown' -> 'dial' (recorrido por el arco) o 'vertical_swipe' (avance/retroceso)
  const gestureMode = useRef<'unknown' | 'dial' | 'vertical_swipe'>('unknown');
  const startPos = useRef<{ x: number; y: number; time: number; radius: number } | null>(null);
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

  // Calcula ángulo polar y radio respecto al pivote
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
    gestureMode.current = 'unknown';

    const now = Date.now();
    startPos.current = { x: e.clientX, y: e.clientY, time: now, radius };

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
    const deltaRadius = Math.abs(radius - startPos.current.radius);

    // 1. CLASIFICACIÓN DE INTENCIÓN:
    if (gestureMode.current === 'unknown') {
      // Swipe vertical claro (corta a través del radio, desplazamiento vertical dominante):
      if (absY > 36 && absY > absX * 1.5 && deltaRadius > 20) {
        gestureMode.current = 'vertical_swipe';
        if (deltaY < 0) {
          // Desplazamiento hacia ARRIBA: RETROCEDER
          triggerHaptic(18);
          setLastGesture('prev');
          onPrevField?.();
        } else {
          // Desplazamiento hacia ABAJO: AVANZAR
          triggerHaptic(18);
          setLastGesture('next');
          onNextField?.();
        }
        return;
      }

      // Si el movimiento angular es dominante o el radio se mantiene en el arco:
      let initialAngleDiff = angle - lastAngle.current;
      if (initialAngleDiff > Math.PI) initialAngleDiff -= 2 * Math.PI;
      if (initialAngleDiff < -Math.PI) initialAngleDiff += 2 * Math.PI;

      if (Math.abs(initialAngleDiff) >= sensitivityRad * 0.6) {
        gestureMode.current = 'dial';
      }
    }

    // 2. MODO SWIPE VERTICAL: si ya se consumió como swipe de avance/retroceso, no alterar el dial
    if (gestureMode.current === 'vertical_swipe') {
      return;
    }

    // 3. MODO DIAL (Recorrido por el arco: incremento/decremento):
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
      gestureMode.current = 'dial';
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

    // Si terminó con trazo vertical rápido sin haber disparado:
    if (gestureMode.current === 'unknown' && startPos.current) {
      const deltaX = e.clientX - startPos.current.x;
      const deltaY = e.clientY - startPos.current.y;
      const duration = Date.now() - startPos.current.time;

      if (duration < 350 && Math.abs(deltaY) > 30 && Math.abs(deltaY) > Math.abs(deltaX) * 1.4) {
        if (deltaY < 0) {
          triggerHaptic(18);
          setLastGesture('prev');
          onPrevField?.();
        } else {
          triggerHaptic(18);
          setLastGesture('next');
          onNextField?.();
        }
      }
    }

    setIsDragging(false);
    setTouchPosition(null);
    lastAngle.current = null;
    accumulatedAngle.current = 0;
    gestureMode.current = 'unknown';
    startPos.current = null;
  }, [onNextField, onPrevField, triggerHaptic]);

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    onPointerUp(e);
  }, [onPointerUp]);

  useEffect(() => {
    if (!lastGesture) return;
    const timer = setTimeout(() => {
      setLastGesture(null);
    }, 400);
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
