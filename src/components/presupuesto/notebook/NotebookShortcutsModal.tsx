import React, { useState } from 'react';
import { BookOpen, CornerDownLeft, Keyboard, X } from 'lucide-react';
import { useEscapeKey } from '../../../hooks/useEscapeKey';

export interface NotebookShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertExample?: (snippet: string) => void;
}

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: 'Ctrl + Z', description: 'Deshacer última edición' },
  { keys: 'Ctrl + Y / Ctrl + Shift + Z', description: 'Rehacer edición deshecha' },
  { keys: 'Ctrl + Space', description: 'Abrir sugerencias contextuales (variables, funciones, materiales)' },
  { keys: 'Ctrl + K', description: 'Abrir paleta de comandos y búsqueda rápida' },
  { keys: '/', description: 'Abrir comandos rápidos (/tt, variable, tarea, item, #)' },
  { keys: 'Tab / Shift + Tab', description: 'Aceptar sugerencia o saltar al parámetro siguiente / anterior' },
  { keys: 'Esc', description: 'Cerrar sugerencias, menú o diálogo superior (sin salir del editor)' },
  { keys: 'Alt + ↑ / ↓', description: 'Mover línea actual hacia arriba o abajo' },
  { keys: 'Ctrl + D', description: 'Duplicar línea actual' },
  { keys: 'Ctrl + /', description: 'Comentar o descomentar línea actual (//)' },
  { keys: 'Ctrl + Shift + K', description: 'Eliminar línea actual' },
  { keys: 'Home', description: 'Saltar al inicio del texto indentado o inicio de línea' },
  { keys: 'Ctrl + ↓', description: 'Ir a la siguiente tarea sin valorizar (Pasada 2)' },
  { keys: 'Ctrl + Enter', description: 'Valorizar tarea actual (Material → Producto → Oferta)' },
  { keys: 'Ctrl + Shift + Enter', description: 'Valorizar todas las tareas pendientes' },
  { keys: 'Ctrl + P', description: 'Abrir o cerrar vista previa del documento al cliente' },
  { keys: 'Ctrl + S', description: 'Guardar cotización sin salir del editor' },
  { keys: '?', description: 'Mostrar u ocultar esta guía rápida' }
];

const SYNTAX_GUIDES: Array<{
  title: string;
  description: string;
  code: string;
}> = [
  {
    title: '1. Variables globales y unidades',
    description:
      'Escribí nombre = valor o fórmula sin sangría. Las unidades son opcionales y convierten automáticamente (cm ↔ m, min ↔ h, m * m → m²).',
    code: [
      'largo = 12 m',
      'ancho = 5 m',
      'sup = largo * ancho',
      'bocas = ceil(sup * 0.3) u',
      'tramo = 10 m + 80 cm'
    ].join('\n')
  },
  {
    title: '2. Trabajos tipo (/tt) y parámetros',
    description:
      'Usá /tt para insertar trabajos del catálogo. Podés sobreescribir parámetros con variables o fórmulas y ajustar componentes con - / +.',
    code: [
      '/tt recableado-completo',
      '  sup = sup',
      '  bocas = bocas + 2',
      '  -puesta-a-tierra'
    ].join('\n')
  },
  {
    title: '3. Tareas compuestas e ítems libres con parámetros locales',
    description:
      'Dentro de tarea: o item: podés declarar parámetros locales en cascada y usar fórmulas directo en cantidad, horas, precio o costo.',
    code: [
      'tarea: Circuito de tomas',
      '  circuitos = 4',
      '  metros = circuitos * 15',
      '  serv: Ensayo de aislación',
      '    cantidad = circuitos u',
      '    costo = 6500 * 1.15'
    ].join('\n')
  },
  {
    title: '4. Operadores y funciones matemáticas',
    description:
      'Soportados en variables, parámetros y cantidades: + - * / ^ %, comparaciones (> < >= <= ==), ternario (cond ? a : b) y funciones.',
    code: [
      'rollos = ceil(tramo / 100)',
      'horas_obra = round(bocas * 0.45, 1) hs',
      'recargo = bocas > 15 ? 1.2 : 1.0'
    ].join('\n')
  }
];

/**
 * Diálogo de guía rápida del notebook: pestaña de sintaxis/variables/fórmulas
 * con ejemplos insertables y pestaña de atajos de teclado.
 */
export const NotebookShortcutsModal: React.FC<NotebookShortcutsModalProps> = ({
  isOpen,
  onClose,
  onInsertExample
}) => {
  const [activeTab, setActiveTab] = useState<'syntax' | 'shortcuts'>('syntax');
  useEscapeKey(isOpen, onClose);

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
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-outline-variant bg-surface-container-high shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3.5 border-b border-outline-variant/50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-on-surface">
              Guía rápida del Notebook
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div
              role="tablist"
              aria-label="Secciones de la guía rápida"
              className="inline-flex rounded-lg bg-surface-container p-0.5 border border-outline-variant/40 text-xs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'syntax'}
                onClick={() => setActiveTab('syntax')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                  activeTab === 'syntax'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Sintaxis y Fórmulas</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'shortcuts'}
                onClick={() => setActiveTab('shortcuts')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                  activeTab === 'shortcuts'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Atajos</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ayuda de atajos"
              className="p-1.5 rounded-full hover:bg-surface-container text-on-surface-variant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {activeTab === 'syntax' ? (
            <div className="space-y-3">
              {SYNTAX_GUIDES.map(guide => (
                <section
                  key={guide.title}
                  className="rounded-xl border border-outline-variant/50 bg-surface p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-semibold text-on-surface">{guide.title}</h3>
                      <p className="text-xs text-on-surface-variant mt-0.5">{guide.description}</p>
                    </div>
                    {onInsertExample && (
                      <button
                        type="button"
                        onClick={() => {
                          onInsertExample(guide.code);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 shrink-0"
                      >
                        <CornerDownLeft className="w-3 h-3" />
                        <span>Insertar ejemplo</span>
                      </button>
                    )}
                  </div>
                  <pre className="rounded-lg bg-surface-container-low border border-outline-variant/40 px-3 py-2 font-mono text-xs text-on-surface overflow-x-auto leading-relaxed">
                    {guide.code}
                  </pre>
                </section>
              ))}
            </div>
          ) : (
            <ul className="space-y-2.5">
              {SHORTCUTS.map(item => (
                <li key={item.keys} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-on-surface-variant">{item.description}</span>
                  <kbd className="px-2 py-0.5 rounded border border-outline-variant bg-surface text-xs font-mono text-on-surface shrink-0">
                    {item.keys}
                  </kbd>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
