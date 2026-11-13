import React from 'react';
import { NotebookAutocompleteResult, NotebookAutocompleteSuggestion } from '../../../core/notebookDocument';

export interface NotebookAutocompletePopupProps {
  autocomplete: NotebookAutocompleteResult;
  selectedIndex: number;
  cursorLinea: number;
  onSelect: (index: number) => void;
}

const KIND_LABELS: Record<NotebookAutocompleteSuggestion['kind'], string> = {
  comando: 'Cmd',
  tarea_tipo: 'Trabajo tipo',
  parametro: 'Parám',
  ajuste_quitar: 'Quitar',
  ajuste_agregar: 'Agregar',
  material: 'Material',
  mano_obra: 'M.O.',
  supuesto_clave: 'Supuesto',
  supuesto_estado: 'Estado',
  variable: 'Var'
};

/**
 * Popover de autocompletado contextual y fuzzy ordenado por frecuencia de uso.
 * Soporta navegación por teclado (Tab/Enter/Flechas) y selección por mouse.
 */
export const NotebookAutocompletePopup: React.FC<NotebookAutocompletePopupProps> = ({
  autocomplete,
  selectedIndex,
  cursorLinea,
  onSelect
}) => {
  if (!autocomplete.isOpen || autocomplete.suggestions.length === 0) {
    return null;
  }

  const topOffsetPx = Math.min(cursorLinea * 28 + 8, 360);

  return (
    <div
      role="listbox"
      aria-label="Sugerencias de autocompletado"
      style={{ top: `${topOffsetPx}px` }}
      className="absolute left-12 z-30 w-[440px] max-w-[calc(100%-3rem)] rounded-xl border border-outline-variant bg-surface-container-high shadow-xl overflow-hidden"
    >
      <div className="px-3 py-1.5 bg-surface-container-highest/60 border-b border-outline-variant/40 flex items-center justify-between text-[11px] text-on-surface-variant">
        <span>Sugerencias contextuales (por uso frecuente)</span>
        <span className="font-mono">Tab / Enter · ↑↓</span>
      </div>
      <ul className="max-h-60 overflow-y-auto divide-y divide-outline-variant/25">
        {autocomplete.suggestions.map((sug, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <li key={sug.id}>
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(idx);
                }}
                className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 text-sm transition-colors ${
                  isSelected
                    ? 'bg-primary-container text-on-primary-container'
                    : 'hover:bg-surface-container text-on-surface'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-surface/70 text-on-surface-variant border border-outline-variant/50 shrink-0">
                    {KIND_LABELS[sug.kind]}
                  </span>
                  <span className="font-mono font-medium truncate">{sug.label}</span>
                  {sug.detail && (
                    <span className="text-xs text-on-surface-variant truncate">
                      {sug.detail}
                    </span>
                  )}
                </div>
                {sug.frecuenciaUso > 0 && (
                  <span className="text-[11px] text-on-surface-variant shrink-0 font-mono">
                    {sug.frecuenciaUso}x
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
