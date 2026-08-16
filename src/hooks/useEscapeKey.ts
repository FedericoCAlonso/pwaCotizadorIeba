import { useEffect } from 'react';

/**
 * Hook que cierra automáticamente un modal cuando el usuario presiona la tecla Escape,
 * incluso si un input, select o textarea dentro del modal tiene el foco.
 */
export function useEscapeKey(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
}
