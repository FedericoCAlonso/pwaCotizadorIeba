import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerModalInBackStack,
  handlePopstateModalClose,
  getOpenModalsCount,
  shouldIgnorePopstate,
  clearModalBackStackForTests
} from './modalBackStack';

describe('Gestor de Pila de Modales y Retroceso PWA (modalBackStack)', () => {
  beforeEach(() => {
    clearModalBackStackForTests();
  });

  it('registra modales en la pila y los cierra en orden LIFO', () => {
    const onCloseModal1 = vi.fn();
    const onCloseModal2 = vi.fn();

    registerModalInBackStack('modal-1', onCloseModal1);
    expect(getOpenModalsCount()).toBe(1);

    registerModalInBackStack('modal-2', onCloseModal2);
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

    // Usuario toca la 'X', 'Guardar' o botón cancelar en la UI
    unregister();
    expect(getOpenModalsCount()).toBe(0);

    // popstate no debe llamar a onClose porque ya fue desregistrado
    const handled = handlePopstateModalClose();
    expect(handled).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('marca shouldIgnorePopstate cuando el modal se cierra por la UI y revierte el historial', () => {
    const originalState = window.history.state;
    const historyBackSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    try {
      const onClose = vi.fn();
      const unregister = registerModalInBackStack('modal-guardar', onClose);

      // Simular que el estado actual del historial es el modal recién registrado
      Object.defineProperty(window.history, 'state', {
        value: { isPwaModal: true, modalId: 'modal-guardar' },
        configurable: true
      });

      // El usuario hace submit en el formulario y el modal se desmonta
      unregister();

      // Debe haber llamado a history.back() para limpiar la entrada del historial
      expect(historyBackSpy).toHaveBeenCalled();

      // Debe indicar que el siguiente popstate debe ser ignorado por el router/navegador principal
      expect(shouldIgnorePopstate()).toBe(true);

      // Tras consumirlo, el siguiente popstate vuelve a ser normal
      expect(shouldIgnorePopstate()).toBe(false);
    } finally {
      historyBackSpy.mockRestore();
      Object.defineProperty(window.history, 'state', {
        value: originalState,
        configurable: true
      });
    }
  });

  it('no ejecuta history.back() en unregister() si el modal fue cerrado por un popstate previo', () => {
    const historyBackSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    try {
      const onClose = vi.fn();
      const unregister = registerModalInBackStack('modal-hardware-back', onClose);

      // Ocurre retroceso por hardware / gesto (dispara handlePopstateModalClose)
      const handled = handlePopstateModalClose();
      expect(handled).toBe(true);
      expect(onClose).toHaveBeenCalledTimes(1);

      // Luego React desmonta el componente y se ejecuta el unregister
      unregister();

      // No debe llamar a history.back() adicional ni setear shouldIgnorePopstate
      expect(historyBackSpy).not.toHaveBeenCalled();
      expect(shouldIgnorePopstate()).toBe(false);
    } finally {
      historyBackSpy.mockRestore();
    }
  });
});
