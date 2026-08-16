import React from 'react';
import { X, Keyboard, Plus, Layers } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose
}) => {
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  const shortcutSections = [
    {
      title: 'Acciones Rápidas Globales',
      icon: Plus,
      shortcuts: [
        { keys: ['+', 'o', 'N'], desc: 'Crear nuevo elemento en la vista activa (Presupuesto, Material, APU, etc.)' },
        { keys: ['Ctrl', 'S'], desc: 'Guardar presupuesto / formulario activo' },
        { keys: ['/', 'o', 'Ctrl', 'K'], desc: 'Poner foco en el buscador de la pantalla actual' },
        { keys: ['Esc'], desc: 'Cerrar ventana emergente o volver a la lista principal' },
        { keys: ['?'], desc: 'Abrir esta guía de atajos de teclado' },
      ]
    },
    {
      title: 'Navegación Rápida entre Secciones',
      icon: Layers,
      shortcuts: [
        { keys: ['Alt', '1'], desc: 'Ir a Presupuestos' },
        { keys: ['Alt', '2'], desc: 'Ir a Materiales & Precios' },
        { keys: ['Alt', '3'], desc: 'Ir a Contactos' },
        { keys: ['Alt', '4'], desc: 'Ir a Registro de Obra' },
        { keys: ['Alt', '5'], desc: 'Ir a Laboratorio de Tareas (APU)' },
        { keys: ['Alt', '6'], desc: 'Ir a Mano de Obra' },
        { keys: ['Alt', '7'], desc: 'Ir a Solicitudes RFQ' },
        { keys: ['Alt', '8'], desc: 'Ir a Logística' },
      ]
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-surface-container rounded-2xl w-full max-w-2xl shadow-2xl p-6 text-on-surface max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-container text-on-primary-container rounded-xl">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-on-surface">Atajos de Teclado</h3>
              <p className="text-xs text-on-surface-variant">Acelera tu trabajo diario cotizando y gestionando obras sin tocar el mouse</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] p-2 rounded-full text-on-surface-variant hover:text-on-surface state-layer transition-colors flex items-center justify-center cursor-pointer"
            aria-label="Cerrar ventana de atajos"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto space-y-6 flex-1 pr-1">
          {shortcutSections.map((sec, sIdx) => {
            const Icon = sec.icon;
            return (
              <div key={sIdx} className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-primary tracking-wide uppercase">
                  <Icon className="w-4 h-4" />
                  <span>{sec.title}</span>
                </div>

                <div className="grid grid-cols-1 gap-2 bg-surface-container-high/40 rounded-2xl p-3 border border-outline-variant/20">
                  {sec.shortcuts.map((sc, scIdx) => (
                    <div
                      key={scIdx}
                      className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-surface-container-high/80 transition-colors"
                    >
                      <span className="text-xs text-on-surface font-medium">{sc.desc}</span>
                      <div className="flex items-center gap-1 shrink-0 ml-3">
                        {sc.keys.map((k, kIdx) => (
                          <React.Fragment key={kIdx}>
                            {k === 'o' ? (
                              <span className="text-[10px] text-on-surface-variant px-0.5">o</span>
                            ) : (
                              <kbd className="px-2 py-1 text-[11px] font-mono font-bold bg-surface-container-highest border border-outline-variant/50 text-primary rounded-lg shadow-2xs">
                                {k}
                              </kbd>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20 text-center">
            <p className="text-[11px] text-on-surface-variant">
              💡 <strong>Nota:</strong> Los atajos de tecla simple como <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-surface-container-high rounded border border-outline-variant/40 text-on-surface">+</kbd> o <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-surface-container-high rounded border border-outline-variant/40 text-on-surface">/</kbd> se pausan automáticamente mientras estás escribiendo en un campo de texto para no interferir.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-outline-variant/20 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-primary text-on-primary font-semibold rounded-full text-xs state-layer transition-colors cursor-pointer shadow-xs"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
