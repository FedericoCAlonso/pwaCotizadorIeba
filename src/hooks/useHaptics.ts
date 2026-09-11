/**
 * useHaptics
 * Hook ligero para emitir vibraciones hápticas sutiles en el dispositivo móvil
 * bajo la filosofía "One Eye, One Hand" (sentir la confirmación sin mirar).
 */

export interface HapticsApi {
  isSupported: boolean;
  tick: () => void;
  tickStrong: () => void;
  selection: () => void;
  success: () => void;
  warning: () => void;
}

export function useHaptics(): HapticsApi {
  const isSupported = typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const vibrate = (pattern: number | number[]) => {
    if (!isSupported) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Silently ignore if blocked by browser policy
    }
  };

  return {
    isSupported,
    // Tick ultra corto (10ms) para cada incremento / giro del dial
    tick: () => vibrate(10),
    // Tick un poco más notorio (20ms) para saltos de campo o pasos
    tickStrong: () => vibrate(20),
    // Tick de selección suave (15ms)
    selection: () => vibrate(15),
    // Doble pulso de confirmación / guardado
    success: () => vibrate([20, 50, 30]),
    // Pulso largo de aviso / límite normativo superado
    warning: () => vibrate(80),
  };
}
