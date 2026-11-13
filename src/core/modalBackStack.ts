interface ModalStackEntry {
  id: string;
  onClose: () => void;
  pushHistory: boolean;
  dismissed?: boolean;
}

const modalStack: ModalStackEntry[] = [];
const closedViaPopstateIds = new Set<string>();
let ignoreNextPopstateCount = 0;

export interface RegisterEscapeLayerOptions {
  /** Si true (por defecto), sincroniza con window.history para el botón Atrás de PWA. False para menús/popovers efímeros. */
  pushHistory?: boolean;
}

/**
 * Registra una capa activa (modal, drawer, menú o popover) en la pila LIFO.
 * Cuando `pushHistory` es true (default), agrega un estado al historial del navegador.
 * Retorna una función de desregistro para cuando la capa se cierra desde la UI.
 */
export function registerModalInBackStack(
  id: string,
  onClose: () => void,
  options: RegisterEscapeLayerOptions = {}
): () => void {
  const pushHistory = options.pushHistory !== false;

  // Solo agregar estado al historial si estamos en entorno navegador y la capa usa historial
  if (pushHistory && typeof window !== 'undefined' && window.history) {
    window.history.pushState({ isPwaModal: true, modalId: id }, '');
  }

  const entry: ModalStackEntry = { id, onClose, pushHistory };
  modalStack.push(entry);

  let closed = false;

  return function unregister() {
    if (closed) return;
    closed = true;

    const idx = modalStack.findIndex((m) => m.id === id);
    if (idx !== -1) {
      modalStack.splice(idx, 1);
    }

    if (!pushHistory) {
      return;
    }

    // Si el modal ya fue cerrado a través de un popstate del navegador, no revertir el historial otra vez
    if (closedViaPopstateIds.has(id)) {
      closedViaPopstateIds.delete(id);
      return;
    }

    // Si el modal fue cerrado por la UI (botón Guardar, Cancelar, X, Escape, backdrop),
    // sincronizar el historial retrocediendo el pushState que se hizo al abrirlo.
    if (typeof window !== 'undefined' && window.history) {
      if (window.history.state?.modalId === id) {
        ignoreNextPopstateCount++;
        window.history.back();
      }
    }
  };
}

function findTopActiveEntry(): ModalStackEntry | undefined {
  for (let i = modalStack.length - 1; i >= 0; i--) {
    if (!modalStack[i].dismissed) {
      return modalStack[i];
    }
  }
  return undefined;
}

/**
 * Indica si `id` corresponde a la capa activa superior de la pila LIFO.
 */
export function isTopEscapeLayer(id: string): boolean {
  return findTopActiveEntry()?.id === id;
}

/**
 * Cierra únicamente la capa superior activa de la pila LIFO al presionar Escape.
 * Retorna true si había una capa abierta y se solicitó su cierre.
 */
export function handleEscapeTopLayer(): boolean {
  const top = findTopActiveEntry();
  if (!top) return false;
  top.dismissed = true;
  try {
    top.onClose();
  } catch (error) {
    console.error('Error invoking layer onClose from Escape:', error);
  }
  return true;
}

/**
 * Intenta cerrar el modal superior en la pila cuando ocurre un popstate (retroceso físico o gesto).
 * Retorna true si cerró un modal, false si no había modales abiertos.
 */
export function handlePopstateModalClose(): boolean {
  for (let i = modalStack.length - 1; i >= 0; i--) {
    if (modalStack[i].pushHistory) {
      const [top] = modalStack.splice(i, 1);
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
