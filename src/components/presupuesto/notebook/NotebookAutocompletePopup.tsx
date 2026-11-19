import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { NotebookAutocompleteResult, NotebookAutocompleteSuggestion } from '../../../core/notebookDocument';

export interface NotebookAutocompletePopupProps {
  autocomplete: NotebookAutocompleteResult;
  selectedIndex: number;
  cursorLinea: number;
  cursorCol?: number;
  scrollTop?: number;
  containerHeight?: number;
  containerWidth?: number;
  onSelect: (index: number) => void;
  onDismiss?: () => void;
}

const KIND_LABELS: Record<NotebookAutocompleteSuggestion['kind'], string> = {
  comando: 'Cmd',
  tarea_tipo: 'Trabajo',
  parametro: 'Parám',
  opcion_parametro: 'Opción',
  ajuste_quitar: 'Quitar',
  ajuste_agregar: 'Agregar',
  material: 'Material',
  producto: 'Marca',
  mano_obra: 'M.O.',
  supuesto_clave: 'Supuesto',
  supuesto_estado: 'Estado',
  variable: 'Var',
  funcion: 'ƒ(x)'
};

/**
 * Popover compacto de autocompletado contextual y fuzzy ordenado por frecuencia/relevancia.
 * Se posiciona cerca del cursor, admite cierre con Esc/× y scroll automático en navegación ↑↓.
 */
export const NotebookAutocompletePopup: React.FC<NotebookAutocompletePopupProps> = ({
  autocomplete,
  selectedIndex,
  cursorLinea,
  cursorCol = 1,
  scrollTop = 0,
  containerHeight = 0,
  containerWidth = 720,
  onSelect,
  onDismiss
}) => {
  const activeOptionRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeOptionRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedIndex, autocomplete.isOpen, autocomplete.suggestions.length]);

  if (!autocomplete.isOpen || autocomplete.suggestions.length === 0) {
    return null;
  }

  const popupWidth = 380;
  const headerAndFooterPx = 32;
  const rowHeightPx = 38;
  const estimatedHeight = Math.min(240, headerAndFooterPx + autocomplete.suggestions.length * rowHeightPx);
  const lineTopPx = 16 + (cursorLinea - 1) * 28;
  const belowTopPx = lineTopPx + 28;
  const viewportRelY = belowTopPx - scrollTop;

  const shouldFlipUp =
    containerHeight > 0 &&
    viewportRelY + estimatedHeight > containerHeight - 12 &&
    lineTopPx - scrollTop > estimatedHeight + 12;

  const topOffsetPx = shouldFlipUp
    ? Math.max(8, lineTopPx - estimatedHeight - 4)
    : belowTopPx + 2;

  const maxLeftPx = Math.max(48, (containerWidth || 720) - popupWidth - 16);
  const leftOffsetPx = Math.max(48, Math.min(64 + Math.max(0, cursorCol - 1) * 7.8, maxLeftPx));

  return (
    <div
      role="listbox"
      aria-label="Sugerencias de autocompletado"
      style={{ top: `${topOffsetPx}px`, left: `${leftOffsetPx}px` }}
      className="absolute z-30 w-[380px] max-w-[calc(100%-3rem)] rounded-xl border border-outline-variant bg-surface-container-high shadow-xl overflow-hidden"
    >
      <div className="px-2.5 py-1 bg-surface-container-highest/70 border-b border-outline-variant/40 flex items-center justify-between gap-2 text-[11px] text-on-surface-variant">
        <span className="truncate font-medium">Sugerencias · ↑↓ · Tab/Enter · Esc</span>
        {onDismiss && (
          <button
            type="button"
            aria-label="Cerrar sugerencias"
            title="Cerrar (Esc)"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDismiss();
            }}
            className="p-0.5 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <ul className="max-h-52 overflow-y-auto divide-y divide-outline-variant/20">
        {autocomplete.suggestions.map((sug, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <li key={sug.id}>
              <button
                ref={isSelected ? activeOptionRef : null}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(idx);
                }}
                className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between gap-2 text-xs transition-colors ${
                  isSelected
                    ? 'bg-primary-container text-on-primary-container'
                    : 'hover:bg-surface-container text-on-surface'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-surface/75 text-on-surface-variant border border-outline-variant/50 shrink-0">
                    {KIND_LABELS[sug.kind]}
                  </span>
                  <span className="font-mono font-medium truncate">{sug.label}</span>
                  {sug.detail && (
                    <span className="text-[11px] text-on-surface-variant truncate">
                      {sug.detail}
                    </span>
                  )}
                </div>
                {sug.frecuenciaUso > 0 && (
                  <span className="text-[10px] text-on-surface-variant shrink-0 font-mono">
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
