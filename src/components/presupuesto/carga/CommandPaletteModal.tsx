import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  FolderPlus,
  Plus,
  BookOpen,
  BookmarkPlus,
  Variable,
  Briefcase,
  FileCode,
  Check,
  X
} from 'lucide-react';

export interface CommandPaletteAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  shortcut?: string;
  run: () => void;
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddChapter: () => void;
  onAddItem: () => void;
  onInsertTareaTipo: () => void;
  onSaveAsTareaTipo?: () => void;
  onNewVariable: () => void;
  onConfigureGastos: () => void;
  onOpenTextMode?: () => void;
  onSaveDraft?: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onAddChapter,
  onAddItem,
  onInsertTareaTipo,
  onSaveAsTareaTipo,
  onNewVariable,
  onConfigureGastos,
  onOpenTextMode,
  onSaveDraft
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions: CommandPaletteAction[] = [
    {
      id: 'add-item',
      title: 'Agregar nuevo Ítem',
      description: 'Crear un nuevo ítem computable en la cotización',
      icon: <Plus className="w-4 h-4 text-primary" />,
      shortcut: 'Enter',
      run: onAddItem
    },
    {
      id: 'add-chapter',
      title: 'Agregar Rubro',
      description: 'Crear un nuevo rubro o etapa de trabajo (Nivel 1)',
      icon: <FolderPlus className="w-4 h-4 text-secondary" />,
      run: onAddChapter
    },
    {
      id: 'insert-task',
      title: 'Insertar Tarea Tipo del Catálogo',
      description: 'Buscar e insertar una tarea prediseñada con insumos y mano de obra',
      icon: <BookOpen className="w-4 h-4 text-tertiary" />,
      run: onInsertTareaTipo
    },
    ...(onSaveAsTareaTipo
      ? [
          {
            id: 'save-task',
            title: 'Guardar Ítem como Tarea Tipo',
            description: 'Guardar el ítem seleccionado en el catálogo para reutilizar',
            icon: <BookmarkPlus className="w-4 h-4 text-amber-500" />,
            run: onSaveAsTareaTipo
          }
        ]
      : []),
    {
      id: 'new-var',
      title: 'Nueva Variable de Cálculo',
      description: 'Definir una variable auxiliar o geométrica (ej: superficie, bocas)',
      icon: <Variable className="w-4 h-4 text-blue-500" />,
      run: onNewVariable
    },
    {
      id: 'config-gastos',
      title: 'Configurar Gastos e Indirectos',
      description: 'Ajustar recargos sobre materiales, mano de obra o Gastos Generales',
      icon: <Briefcase className="w-4 h-4 text-orange-500" />,
      run: onConfigureGastos
    },
    ...(onOpenTextMode
      ? [
          {
            id: 'open-text',
            title: 'Abrir Vista de Texto (YAML)',
            description: 'Composición y edición experta en formato YAML estructurado',
            icon: <FileCode className="w-4 h-4 text-indigo-500" />,
            run: onOpenTextMode
          }
        ]
      : []),
    ...(onSaveDraft
      ? [
          {
            id: 'save-draft',
            title: 'Guardar Borrador',
            description: 'Persistir los cambios actuales de la cotización',
            icon: <Check className="w-4 h-4 text-primary" />,
            run: onSaveDraft
          }
        ]
      : [])
  ];

  const filteredActions = actions.filter((act) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      act.title.toLowerCase().includes(q) ||
      act.description.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filteredActions.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredActions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredActions[selectedIndex];
      if (target) {
        onClose();
        target.run();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/50 select-none backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface rounded-2xl border border-outline-variant/40 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de Búsqueda */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-outline-variant/30 bg-surface-container-low">
          <Search className="w-4 h-4 text-on-surface-variant shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Escribí un comando o acción... (ej: rubro, ítem, tarea, gasto)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full text-sm bg-transparent text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lista de Acciones */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-outline-variant/10">
          {filteredActions.length === 0 ? (
            <p className="text-xs text-on-surface-variant/70 text-center py-6">
              No se encontraron comandos para "{query}"
            </p>
          ) : (
            filteredActions.map((action, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <div
                  key={action.id}
                  onClick={() => {
                    onClose();
                    action.run();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left cursor-pointer transition-colors ${
                    isSelected ? 'bg-primary-container text-on-primary-container' : 'hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 rounded-lg bg-surface border border-outline-variant/30 shrink-0">
                      {action.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-on-surface truncate">
                        {action.title}
                      </div>
                      <div className="text-[11px] text-on-surface-variant truncate">
                        {action.description}
                      </div>
                    </div>
                  </div>

                  {action.shortcut && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-outline-variant/30 text-on-surface-variant shrink-0">
                      {action.shortcut}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer con ayuda */}
        <div className="px-4 py-2 border-t border-outline-variant/20 bg-surface-container-lowest flex items-center justify-between text-[11px] text-on-surface-variant/70">
          <span>Usa ↑ ↓ para navegar, Enter para ejecutar</span>
          <span className="font-mono">Esc para cerrar</span>
        </div>
      </div>
    </div>
  );
};
