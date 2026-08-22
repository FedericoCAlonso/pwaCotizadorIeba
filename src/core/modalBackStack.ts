interface ModalStackEntry {
  id: string;
  onClose: () => void;
}

const modalStack: ModalStackEntry[] = [];
let isPoppingFromPopstate = false;

/**
 * Registra un modal activo en la pila de navegación del historial.
 * Cuando el modal se abre, se agrega un estado al historial del navegador.
 * Retorna una función de desregistro para cuando el modal se cierra desde la UI.
 */
export function registerModalInBackStack(id: string, onClose: () => void): () => void {
  // Solo agregar estado al historial si no estamos en medio de un popstate
  if (typeof window !== 'undefined' && window.history) {
    window.history.pushState({ isPwaModal: true, modalId: id }, '');
  }

  const entry: ModalStackEntry = { id, onClose };
  modalStack.push(entry);

  let closed = false;

  return function unregister() {
    if (closed) return;
    closed = true;

    const idx = modalStack.findIndex((m) => m.id === id);
    if (idx !== -1) {
      modalStack.splice(idx, 1);
    }

    // Si el modal fue cerrado por la UI (botón X, backdrop, submit), sincronizar el historial
    if (!isPoppingFromPopstate && typeof window !== 'undefined' && window.history) {
      if (window.history.state?.modalId === id) {
        window.history.back();
      }
    }
  };
}

/**
 * Intenta cerrar el modal superior en la pila cuando ocurre un popstate.
 * Retorna true si cerró un modal, false si no había modales abiertos.
 */
export function handlePopstateModalClose(): boolean {
  if (modalStack.length > 0) {
    const top = modalStack.pop();
    if (top) {
      isPoppingFromPopstate = true;
      try {
        top.onClose();
      } finally {
        setTimeout(() => {
          isPoppingFromPopstate = false;
        }, 50);
      }
      return true;
    }
  }
  return false;
}

/**
 * Retorna la cantidad de modales actualmente abiertos.
 */
export function getOpenModalsCount(): number {
  return modalStack.length;
}
