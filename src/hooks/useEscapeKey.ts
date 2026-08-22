import { useEffect, useRef } from 'react';
import { registerModalInBackStack } from '../core/modalBackStack';

/**
 * Hook universal de descarte de modales:
 * 1. Cierra con la tecla Escape (en teclado físico de escritorio).
 * 2. Cierra con el botón/gesto Atrás en celulares (integración con History API y popstate).
 */
export function useEscapeKey(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const modalId = `modal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const unregister = registerModalInBackStack(modalId, () => {
      onCloseRef.current();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unregister();
    };
  }, [isOpen]);
}
