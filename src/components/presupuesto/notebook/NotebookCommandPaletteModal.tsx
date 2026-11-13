import React, { useEffect, useRef } from 'react';
import { Command, CornerDownLeft, Search } from 'lucide-react';
import { CommandPaletteState } from '../../../viewmodels/useNotebookDocumentViewModel';
import { NotebookCommandPaletteItem } from '../../../core/notebookDocument';

export interface NotebookCommandPaletteModalProps {
  palette: CommandPaletteState;
  onQueryChange: (query: string) => void;
  onMoveSelection: (delta: 1 | -1) => void;
  onExecute: (commandId?: string) => void;
  onClose: () => void;
}

const CATEGORY_LABEL: Record<NotebookCommandPaletteItem['category'], string> = {
  flujo: 'Flujo',
  estructura: 'Bloque',
  trabajo_tipo: 'Trabajo tipo',
  documento: 'Documento'
};

/**
 * Paleta de comandos del notebook activada mediante `Ctrl+K` o `/`.
 */
export const NotebookCommandPaletteModal: React.FC<NotebookCommandPaletteModalProps> = ({
  palette,
  onQueryChange,
  onMoveSelection,
  onExecute,
  onClose
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (palette.isOpen) {
      inputRef.current?.focus();
    }
  }, [palette.isOpen]);

  if (!palette.isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onMoveSelection(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onMoveSelection(-1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      onExecute();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-scrim/50 backdrop-blur-xs px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos del notebook"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-outline-variant bg-surface-container-high shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/50">
          <Search className="w-4 h-4 text-on-surface-variant shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={palette.query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar trabajo tipo, acción o atajo..."
            aria-label="Buscar comando"
            className="flex-1 bg-transparent text-on-surface placeholder:text-on-surface-variant/60 text-sm focus:outline-none"
          />
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container text-[11px] font-mono text-on-surface-variant">
            <Command className="w-3 h-3" />K
          </span>
        </div>

        <ul className="max-h-80 overflow-y-auto divide-y divide-outline-variant/25" role="listbox">
          {palette.commands.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-on-surface-variant">
              No se encontraron comandos para &ldquo;{palette.query}&rdquo;.
            </li>
          ) : (
            palette.commands.map((cmd, idx) => {
              const selected = idx === palette.selectedIndex;
              return (
                <li key={cmd.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => onExecute(cmd.id)}
                    className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 transition-colors ${
                      selected
                        ? 'bg-primary-container text-on-primary-container'
                        : 'hover:bg-surface-container text-on-surface'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-surface/70 text-on-surface-variant border border-outline-variant/50">
                          {CATEGORY_LABEL[cmd.category]}
                        </span>
                        <span className="font-medium text-sm truncate">{cmd.label}</span>
                      </div>
                      <p className="text-xs text-on-surface-variant truncate mt-0.5">
                        {cmd.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {cmd.shortcut && (
                        <kbd className="px-1.5 py-0.5 rounded border border-outline-variant bg-surface text-[11px] font-mono text-on-surface-variant">
                          {cmd.shortcut}
                        </kbd>
                      )}
                      {selected && <CornerDownLeft className="w-3.5 h-3.5 opacity-70" />}
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
};
