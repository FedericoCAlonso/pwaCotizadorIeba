import React from 'react';
import { Keyboard, X } from 'lucide-react';

export interface NotebookShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: 'Ctrl + K', description: 'Abrir paleta de comandos y búsqueda de trabajos tipo' },
  { keys: '/', description: 'Iniciar comando /tt al comienzo de una línea' },
  { keys: 'Tab', description: 'Aceptar sugerencia fantasma o saltar al siguiente parámetro' },
  { keys: 'Enter', description: 'Confirmar sugerencia seleccionada o insertar nueva línea' },
  { keys: 'Ctrl + ↓', description: 'Ir a la siguiente tarea sin valorizar (Pasada 2)' },
  { keys: 'Ctrl + Enter', description: 'Valorizar tarea actual (Material → Producto → Oferta)' },
  { keys: 'Ctrl + Shift + Enter', description: 'Valorizar todas las tareas pendientes' },
  { keys: 'Ctrl + P', description: 'Abrir o cerrar vista previa del documento al cliente' },
  { keys: 'Ctrl + S', description: 'Guardar cotización en IndexedDB' },
  { keys: '?', description: 'Mostrar u ocultar esta ayuda de atajos' }
];

/**
 * Diálogo de referencia rápida de atajos de teclado del notebook de cotizaciones.
 */
export const NotebookShortcutsModal: React.FC<NotebookShortcutsModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 backdrop-blur-xs px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Atajos de teclado del notebook"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-outline-variant bg-surface-container-high shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3.5 border-b border-outline-variant/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-on-surface">Atajos de teclado</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ayuda de atajos"
            className="p-1.5 rounded-full hover:bg-surface-container text-on-surface-variant"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <ul className="p-4 space-y-2.5">
          {SHORTCUTS.map(item => (
            <li key={item.keys} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-on-surface-variant">{item.description}</span>
              <kbd className="px-2 py-0.5 rounded border border-outline-variant bg-surface text-xs font-mono text-on-surface shrink-0">
                {item.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
