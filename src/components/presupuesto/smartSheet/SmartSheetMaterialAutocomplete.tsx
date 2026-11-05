import React, { useEffect, useRef } from 'react';
import { Package, Tag, Check } from 'lucide-react';
import { MaterialCatalogSuggestion } from '../../../core/materialSuggestions';
import { formatARS } from '../../../core/calculations';

export interface SmartSheetMaterialAutocompleteProps {
  suggestions: MaterialCatalogSuggestion[];
  isOpen: boolean;
  onSelect: (sug: MaterialCatalogSuggestion) => void;
  onClose: () => void;
  highlightedIndex: number;
}

/**
 * SmartSheetMaterialAutocomplete: Menú flotante de sugerencias de materiales
 * del catálogo por función (sin marca).
 * Muestra unidad, precio vigente de la mejor oferta y marca asociada (o 'sin definir').
 */
export const SmartSheetMaterialAutocomplete: React.FC<SmartSheetMaterialAutocompleteProps> = ({
  suggestions,
  isOpen,
  onSelect,
  onClose,
  highlightedIndex
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || suggestions.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute left-0 top-full mt-1 w-80 sm:w-96 max-h-60 overflow-y-auto bg-surface-container-highest border border-outline-variant/50 rounded-xl shadow-xl z-50 py-1 divide-y divide-outline-variant/15 font-sans select-none animate-in fade-in zoom-in-95 duration-100"
      role="listbox"
      aria-label="Sugerencias de materiales del catálogo"
    >
      <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-secondary flex items-center justify-between bg-surface-container">
        <span>Catálogo por Función</span>
        <span>Mejor Oferta</span>
      </div>

      {suggestions.map((sug, idx) => {
        const isHighlighted = idx === highlightedIndex;
        return (
          <div
            key={sug.id}
            role="option"
            aria-selected={isHighlighted}
            onMouseDown={(e) => {
              // Prevenir pérdida de foco prematura en el input
              e.preventDefault();
              onSelect(sug);
            }}
            className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between gap-2 ${
              isHighlighted
                ? 'bg-primary text-on-primary'
                : 'hover:bg-surface-container-high text-on-surface'
            }`}
          >
            {/* Función y Marca */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Package className={`w-3.5 h-3.5 shrink-0 ${isHighlighted ? 'text-on-primary' : 'text-primary'}`} />
                <span className="font-semibold text-xs truncate">
                  {sug.nombre}
                </span>
                <span
                  className={`text-[10px] px-1 py-0.2 rounded font-mono font-medium ${
                    isHighlighted
                      ? 'bg-on-primary/20 text-on-primary'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {sug.unidad}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 ml-5 text-[11px]">
                <span className={`${isHighlighted ? 'text-on-primary/80' : 'text-on-surface-variant/70'}`}>
                  Marca:{' '}
                  <span className={`font-medium ${sug.marcaModelo === 'sin definir' ? 'italic opacity-80' : ''}`}>
                    {sug.marcaModelo}
                  </span>
                </span>
              </div>
            </div>

            {/* Precio vigente de mejor oferta */}
            <div className="text-right shrink-0">
              {sug.precioVigente > 0 ? (
                <span className={`font-mono font-bold text-xs ${isHighlighted ? 'text-on-primary' : 'text-secondary'}`}>
                  {formatARS(sug.precioVigente)}
                </span>
              ) : (
                <span className={`text-[10px] italic ${isHighlighted ? 'text-on-primary/70' : 'text-on-surface-variant/50'}`}>
                  Sin oferta
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
