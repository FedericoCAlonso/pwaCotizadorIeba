import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerModalInBackStack,
  handlePopstateModalClose,
  getOpenModalsCount
} from './modalBackStack';

describe('Gestor de Pila de Modales y Retroceso PWA (modalBackStack)', () => {
  beforeEach(() => {
    // Clear any open modals
    while (getOpenModalsCount() > 0) {
      handlePopstateModalClose();
    }
  });

  it('registra modales en la pila y los cierra en orden LIFO', () => {
    const onCloseModal1 = vi.fn();
    const onCloseModal2 = vi.fn();

    const unreg1 = registerModalInBackStack('modal-1', onCloseModal1);
    expect(getOpenModalsCount()).toBe(1);

    const unreg2 = registerModalInBackStack('modal-2', onCloseModal2);
    expect(getOpenModalsCount()).toBe(2);

    // Primer retroceso (popstate): debe cerrar modal-2
    const handledFirst = handlePopstateModalClose();
    expect(handledFirst).toBe(true);
    expect(onCloseModal2).toHaveBeenCalledTimes(1);
    expect(onCloseModal1).not.toHaveBeenCalled();
    expect(getOpenModalsCount()).toBe(1);

    // Segundo retroceso (popstate): debe cerrar modal-1
    const handledSecond = handlePopstateModalClose();
    expect(handledSecond).toBe(true);
    expect(onCloseModal1).toHaveBeenCalledTimes(1);
    expect(getOpenModalsCount()).toBe(0);

    // Tercer retroceso: ya no hay modales
    const handledThird = handlePopstateModalClose();
    expect(handledThird).toBe(false);
  });

  it('desregistra limpiamente cuando el modal se cierra por la UI sin popstate', () => {
    const onClose = vi.fn();
    const unregister = registerModalInBackStack('modal-ui', onClose);

    expect(getOpenModalsCount()).toBe(1);

    // Usuario toca la 'X' o botón cancelar en la UI
    unregister();
    expect(getOpenModalsCount()).toBe(0);

    // popstate no debe llamar a onClose porque ya fue desregistrado
    const handled = handlePopstateModalClose();
    expect(handled).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });
});
