interface ModalStackEntry {
  id: string;
  onClose: () => void;
}

const modalStack: ModalStackEntry[] = [];
const closedViaPopstateIds = new Set<string>();
let ignoreNextPopstateCount = 0;

/**
 * Registra un modal activo en la pila de navegación del historial.
 * Cuando el modal se abre, se agrega un estado al historial del navegador.
 * Retorna una función de desregistro para cuando el modal se cierra desde la UI.
 */
export function registerModalInBackStack(id: string, onClose: () => void): () => void {
  // Solo agregar estado al historial si estamos en entorno navegador
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

    // Si el modal ya fue cerrado a través de un popstate del navegador, no revertir el historial otra vez
    if (closedViaPopstateIds.has(id)) {
      closedViaPopstateIds.delete(id);
      return;
    }

    // Si el modal fue cerrado por la UI (botón Guardar, Cancelar, X, backdrop),
    // sincronizar el historial retrocediendo el pushState que se hizo al abrirlo.
    if (typeof window !== 'undefined' && window.history) {
      if (window.history.state?.modalId === id) {
        ignoreNextPopstateCount++;
        window.history.back();
      }
    }
  };
}

/**
 * Intenta cerrar el modal superior en la pila cuando ocurre un popstate (retroceso físico o gesto).
 * Retorna true si cerró un modal, false si no había modales abiertos.
 */
export function handlePopstateModalClose(): boolean {
  if (modalStack.length > 0) {
    const top = modalStack.pop();
    if (top) {
      closedViaPopstateIds.add(top.id);
      try {
        top.onClose();
      } catch (error) {
        console.error('Error invoking modal onClose from popstate:', error);
      }
      return true;
    }
  }
  return false;
}

/**
 * Comprueba y consume si el popstate actual fue generado programáticamente
 * por la sincronización de cierre de un modal desde la UI.
 */
export function shouldIgnorePopstate(): boolean {
  if (ignoreNextPopstateCount > 0) {
    ignoreNextPopstateCount--;
    return true;
  }
  return false;
}

/**
 * Retorna la cantidad de modales actualmente abiertos.
 */
export function getOpenModalsCount(): number {
  return modalStack.length;
}

/**
 * Función de utilidad para limpiar la pila (usada en pruebas unitarias).
 */
export function clearModalBackStackForTests(): void {
  modalStack.length = 0;
  closedViaPopstateIds.clear();
  ignoreNextPopstateCount = 0;
}
