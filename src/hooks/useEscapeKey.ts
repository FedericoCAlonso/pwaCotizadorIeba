import { useEffect, useRef } from 'react';
import {
  isTopEscapeLayer,
  registerModalInBackStack,
  RegisterEscapeLayerOptions
} from '../core/modalBackStack';

/**
 * Hook universal de descarte por pila LIFO:
 * 1. Cierra únicamente la capa superior con Escape (menú -> popover -> modal -> vista).
 * 2. Cierra con el botón/gesto Atrás en celulares cuando `pushHistory !== false`.
 */
export function useEscapeKey(
  isOpen: boolean,
  onClose: () => void,
  options: RegisterEscapeLayerOptions = {}
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pushHistory = options.pushHistory !== false;

  useEffect(() => {
    if (!isOpen) return;

    const modalId = `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const unregister = registerModalInBackStack(
      modalId,
      () => {
        onCloseRef.current();
      },
      { pushHistory }
    );

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopEscapeLayer(modalId)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unregister();
    };
  }, [isOpen, pushHistory]);
}
