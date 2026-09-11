import { useRef, useState, useCallback, useEffect } from 'react';

export type Handedness = 'right' | 'left';

export interface UseThumbArcGestureOptions {
  handedness?: Handedness;
  sensitivityPx?: number; // Píxeles de recorrido para disparar un tick de cambio (default 18)
  onStepChange?: (direction: 1 | -1) => void;
  onNextField?: () => void;
  onPrevField?: () => void;
  onConfirm?: () => void;
  onFastIncrement?: () => void;
  onFastDecrement?: () => void;
  enableHaptics?: boolean;
}

export interface ThumbArcGestureReturn {
  handedness: Handedness;
  setHandedness: (hand: Handedness) => void;
  toggleHandedness: () => void;
  isDragging: boolean;
  touchPosition: { x: number; y: number } | null;
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
  sensitivityPx = 18,
  onStepChange,
  onNextField,
  onPrevField,
  onConfirm,
  enableHaptics = true
}: UseThumbArcGestureOptions = {}): ThumbArcGestureReturn {
  const [handedness, setHandedness] = useState<Handedness>(initialHandedness);
  const [isDragging, setIsDragging] = useState(false);
  const [touchPosition, setTouchPosition] = useState<{ x: number; y: number } | null>(null);
  const [lastGesture, setLastGesture] = useState<'inc' | 'dec' | 'next' | 'prev' | 'confirm' | null>(null);

  // Referencias para seguimiento de trayectoria
  const startPos = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const accumulatedArc = useRef<number>(0);
  const totalDragDistance = useRef<number>(0);
  const lastTapTime = useRef<number>(0);
  const isVerticalSwipe = useRef<boolean>(false);

  const toggleHandedness = useCallback(() => {
    setHandedness(prev => (prev === 'right' ? 'left' : 'right'));
  }, []);

  // Vibración táctil si está habilitada
  const triggerHaptic = useCallback((duration: number = 10) => {
    if (enableHaptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {
        // Silencio en caso de políticas de navegador
      }
    }
  }, [enableHaptics]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Captura del puntero para que no se pierda al deslizar fuera del elemento
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // Ignorar en entornos de test/compatibilidad
    }

    const pos = { x: e.clientX, y: e.clientY };
    const now = Date.now();

    startPos.current = { ...pos, time: now };
    lastPos.current = pos;
    accumulatedArc.current = 0;
    totalDragDistance.current = 0;
    isVerticalSwipe.current = false;
    setIsDragging(true);
    setTouchPosition(pos);

    // Detección de doble toque rápido para confirmar
    if (now - lastTapTime.current < 280) {
      triggerHaptic(25);
      setLastGesture('confirm');
      onConfirm?.();
      lastTapTime.current = 0;
    } else {
      lastTapTime.current = now;
    }
  }, [onConfirm, triggerHaptic]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!startPos.current || !lastPos.current) return;

    const currentPos = { x: e.clientX, y: e.clientY };
    setTouchPosition(currentPos);

    const deltaX = currentPos.x - lastPos.current.x;
    const deltaY = currentPos.y - lastPos.current.y;
    const totalDeltaX = currentPos.x - startPos.current.x;
    const totalDeltaY = currentPos.y - startPos.current.y;

    totalDragDistance.current += Math.hypot(deltaX, deltaY);

    // Detección de gesto vertical prioritario (arriba = siguiente, abajo = previo)
    if (
      !isVerticalSwipe.current &&
      Math.abs(totalDeltaY) > 45 &&
      Math.abs(totalDeltaY) > Math.abs(totalDeltaX) * 1.6
    ) {
      isVerticalSwipe.current = true;
      if (totalDeltaY < 0) {
        triggerHaptic(18);
        setLastGesture('next');
        onNextField?.();
      } else {
        triggerHaptic(18);
        setLastGesture('prev');
        onPrevField?.();
      }
      lastPos.current = currentPos;
      return;
    }

    // Si ya se consumió como swipe vertical en esta pulsación, no mover valores horizontales
    if (isVerticalSwipe.current) {
      lastPos.current = currentPos;
      return;
    }

    // Cálculo del vector de arco según la mano
    // Para mano derecha: arrastre hacia la derecha o arriba incrementa; izquierda/abajo decrementa.
    // Para mano izquierda: arrastre hacia la derecha o arriba incrementa; izquierda/abajo decrementa.
    // Proyección con componente diagonal natural:
    const arcDelta = handedness === 'right'
      ? (deltaX * 0.85 - deltaY * 0.5)
      : (deltaX * 0.85 - deltaY * 0.5);

    accumulatedArc.current += arcDelta;

    if (Math.abs(accumulatedArc.current) >= sensitivityPx) {
      const direction: 1 | -1 = accumulatedArc.current > 0 ? 1 : -1;
      triggerHaptic(8);
      setLastGesture(direction === 1 ? 'inc' : 'dec');
      onStepChange?.(direction);
      accumulatedArc.current = 0;
    }

    lastPos.current = currentPos;
  }, [handedness, onNextField, onPrevField, onStepChange, sensitivityPx, triggerHaptic]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    try {
      target.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    setIsDragging(false);
    setTouchPosition(null);
    startPos.current = null;
    lastPos.current = null;
    accumulatedArc.current = 0;
    isVerticalSwipe.current = false;
  }, []);

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    onPointerUp(e);
  }, [onPointerUp]);

  // Limpieza de feedback visual después de 400ms
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
    lastGesture,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel
    }
  };
}
