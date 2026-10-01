import React from 'react';
import {
  Edit2,
  Layers,
  Sliders,
  Copy,
  ArrowUp,
  ArrowDown,
  BookmarkPlus,
  Trash2
} from 'lucide-react';

interface ItemRowActionsProps {
  isSelected: boolean;
  isExpanded?: boolean;
  isParametric?: boolean;
  hasParams?: boolean;
  onToggleExpand?: () => void;
  onStartEditName?: () => void;
  onOpenParams?: (e: React.MouseEvent) => void;
  onDuplicate?: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSaveAsTareaTipo?: () => void;
  onRemove: () => void;
}

export const ItemRowActions: React.FC<ItemRowActionsProps> = ({
  isSelected,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onSaveAsTareaTipo,
  onRemove
}) => {
  return (
    <div
      className={`flex items-center gap-0.5 justify-end shrink-0 transition-opacity ${
        isSelected ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'
      }`}
    >
      {/* 1. Mover arriba / abajo */}
      <button
        type="button"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          onMoveUp();
        }}
        className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
        title="Mover arriba"
        aria-label="Mover arriba"
      >
        <ArrowUp className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          onMoveDown();
        }}
        className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
        title="Mover abajo"
        aria-label="Mover abajo"
      >
        <ArrowDown className="w-3.5 h-3.5" />
      </button>

      {/* 2. Duplicar ítem */}
      {onDuplicate && (
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          title="Duplicar ítem con sus materiales, mano de obra y servicios"
          aria-label="Duplicar ítem"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      )}

      {/* 3. Guardar como Tarea Tipo */}
      {onSaveAsTareaTipo && (
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onSaveAsTareaTipo();
          }}
          className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-secondary transition-colors cursor-pointer"
          title="Guardar como Tarea Tipo en Catálogo"
          aria-label="Guardar en catálogo"
        >
          <BookmarkPlus className="w-3.5 h-3.5" />
        </button>
      )}

      {/* 4. Eliminar */}
      <button
        type="button"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-1 rounded hover:bg-error-container text-on-surface-variant hover:text-error transition-colors cursor-pointer"
        title="Eliminar ítem"
        aria-label="Eliminar ítem"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
