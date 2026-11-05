import React, { useState, useMemo } from 'react';
import { Package, Zap, Truck, Plus } from 'lucide-react';
import { GhostRowDraft } from '../../../viewmodels/useSmartSheetLinesViewModel';
import { formatARS } from '../../../core/calculations';
import { MaterialCatalogSuggestion, searchMaterialCatalogSuggestions } from '../../../core/materialSuggestions';
import { SmartSheetMaterialAutocomplete } from './SmartSheetMaterialAutocomplete';

/**
 * Propiedades de la última fila vacía (Ghost Row) para inserción rápida de líneas.
 */
export interface SmartSheetGhostRowProps {
  /** Borrador actual de la fila vacía */
  ghostRow: GhostRowDraft;
  /** Callback para actualizar campos del borrador */
  setGhostRow: React.Dispatch<React.SetStateAction<GhostRowDraft>>;
  /** Mensaje de error de validación de fórmula en la fila vacía */
  ghostEvalError: string | null;
  /** Callback para limpiar o actualizar el error de evaluación */
  setGhostEvalError: (err: string | null) => void;
  /** Confirmar la creación de la nueva línea */
  onCommitGhostRow: () => boolean;
  /** Catálogo de sugerencias de materiales por función */
  materialSuggestions?: MaterialCatalogSuggestion[];
  /** Callback para aplicar una sugerencia del catálogo */
  onSelectSuggestion?: (sug: MaterialCatalogSuggestion) => void;
}

/**
 * SmartSheetGhostRow: Última fila vacía de la tabla de líneas.
 * Soporta autocompletado de materiales del catálogo por función (sin marca),
 * completando unidad, precio de mejor oferta y marca asociada ('sin definir' si no tiene).
 */
export const SmartSheetGhostRow: React.FC<SmartSheetGhostRowProps> = ({
  ghostRow,
  setGhostRow,
  ghostEvalError,
  setGhostEvalError,
  onCommitGhostRow,
  materialSuggestions = [],
  onSelectSuggestion
}) => {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Sugerencias filtradas en tiempo real mientras el usuario escribe en función
  const filteredSuggestions = useMemo(() => {
    if (ghostRow.tipo !== 'material' || !ghostRow.funcion.trim()) return [];
    return searchMaterialCatalogSuggestions(ghostRow.funcion, materialSuggestions, 8);
  }, [ghostRow.tipo, ghostRow.funcion, materialSuggestions]);

  const handleSelectSug = (sug: MaterialCatalogSuggestion) => {
    if (onSelectSuggestion) {
      onSelectSuggestion(sug);
    } else {
      setGhostRow((prev) => ({
        ...prev,
        tipo: 'material',
        funcion: sug.nombre,
        marcaModelo: sug.marcaModelo || 'sin definir',
        precioUnitario: sug.precioVigente > 0 ? String(sug.precioVigente) : (prev.precioUnitario || '0'),
        unidad: sug.unidad || 'u'
      }));
    }
    setShowAutocomplete(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showAutocomplete && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowAutocomplete(false);
        return;
      }
      if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
        e.preventDefault();
        handleSelectSug(filteredSuggestions[highlightedIndex]);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      onCommitGhostRow();
    }
  };

  // Alternar tipo de línea cíclicamente en el borrador
  const handleCycleTipo = () => {
    const nextType: 'material' | 'mano_obra' | 'servicio' =
      ghostRow.tipo === 'material'
        ? 'mano_obra'
        : ghostRow.tipo === 'mano_obra'
        ? 'servicio'
        : 'material';
    setGhostRow((prev) => ({ ...prev, tipo: nextType }));
    setShowAutocomplete(false);
  };

  // Cálculo estimativo del subtotal para preview en tiempo real
  const previewQty = Number(ghostRow.cantidad.replace(',', '.')) || 1;
  const previewUnit = Number(ghostRow.precioUnitario.replace(',', '.')) || 0;
  const previewSubtotal = previewQty * previewUnit;

  return (
    <div
      className="flex items-center px-3 py-1.5 text-xs bg-surface-container-low/40 border-b border-dashed border-outline-variant/30 select-none group focus-within:bg-surface-container-high/30 transition-colors"
      role="row"
    >
      {/* ─── Columna 1: Tipo de la nueva línea ─── */}
      <div className="w-10 sm:w-12 shrink-0 flex items-center justify-center">
        <button
          type="button"
          onClick={handleCycleTipo}
          className="p-1 rounded-lg transition-transform active:scale-95 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-primary"
          title={`Tipo: ${
            ghostRow.tipo === 'material'
              ? 'Material'
              : ghostRow.tipo === 'mano_obra'
              ? 'Mano de Obra'
              : 'Servicio'
          } (clic para cambiar)`}
          aria-label="Alternar tipo de nueva línea"
        >
          {ghostRow.tipo === 'material' && (
            <span className="p-1 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Package className="w-3.5 h-3.5" />
            </span>
          )}
          {ghostRow.tipo === 'mano_obra' && (
            <span className="p-1 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
              <Zap className="w-3.5 h-3.5" />
            </span>
          )}
          {ghostRow.tipo === 'servicio' && (
            <span className="p-1 rounded-lg bg-tertiary/10 text-tertiary flex items-center justify-center">
              <Truck className="w-3.5 h-3.5" />
            </span>
          )}
        </button>
      </div>

      {/* ─── Columna 2: Función / Descripción con Autocompletado del Catálogo ─── */}
      <div className="flex-1 min-w-0 px-2 relative">
        <input
          type="text"
          value={ghostRow.funcion}
          onChange={(e) => {
            setGhostRow((prev) => ({ ...prev, funcion: e.target.value }));
            setShowAutocomplete(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            if (ghostRow.funcion.trim()) setShowAutocomplete(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="+ Nueva línea (función o descripción)..."
          className="w-full px-2 py-1 text-xs bg-transparent hover:bg-surface-container-lowest focus:bg-surface-container-lowest border border-transparent focus:border-primary rounded-md outline-hidden text-on-surface placeholder:text-on-surface-variant/40 transition-colors font-sans"
        />

        {/* Menú flotante de sugerencias por función */}
        <SmartSheetMaterialAutocomplete
          suggestions={filteredSuggestions}
          isOpen={showAutocomplete && filteredSuggestions.length > 0}
          onSelect={handleSelectSug}
          onClose={() => setShowAutocomplete(false)}
          highlightedIndex={highlightedIndex}
        />
      </div>

      {/* ─── Columna 3: Marca / Modelo ─── */}
      <div className="w-28 sm:w-36 shrink-0 px-2 truncate">
        {ghostRow.tipo === 'mano_obra' ? (
          <span className="text-on-surface-variant/30 italic text-[11px] px-2">—</span>
        ) : (
          <input
            type="text"
            value={ghostRow.marcaModelo}
            onChange={(e) => setGhostRow((prev) => ({ ...prev, marcaModelo: e.target.value }))}
            onKeyDown={handleKeyDown}
            placeholder="Marca / Modelo"
            className="w-full px-2 py-1 text-xs bg-transparent hover:bg-surface-container-lowest focus:bg-surface-container-lowest border border-transparent focus:border-primary rounded-md outline-hidden text-on-surface placeholder:text-on-surface-variant/40 transition-colors font-sans"
          />
        )}
      </div>

      {/* ─── Columna 4: Cantidad (Número o fórmula) ─── */}
      <div className="w-32 sm:w-44 shrink-0 px-2 text-right font-mono flex flex-col items-end justify-center">
        <input
          type="text"
          value={ghostRow.cantidad}
          onChange={(e) => {
            setGhostRow((prev) => ({ ...prev, cantidad: e.target.value }));
            if (ghostEvalError) setGhostEvalError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="1 o =fórmula"
          className={`w-full px-2 py-1 text-xs text-right font-mono bg-transparent hover:bg-surface-container-lowest focus:bg-surface-container-lowest rounded-md outline-hidden transition-colors ${
            ghostEvalError
              ? 'border border-error ring-1 ring-error text-error bg-error-container/20'
              : 'border border-transparent focus:border-primary text-on-surface placeholder:text-on-surface-variant/40'
          }`}
        />
        {ghostEvalError && (
          <span
            className="text-[10px] text-error font-sans font-medium mt-0.5 max-w-full truncate text-right"
            title={ghostEvalError}
          >
            {ghostEvalError}
          </span>
        )}
      </div>

      {/* ─── Columna 5: Precio Unitario ─── */}
      <div className="w-24 sm:w-28 shrink-0 px-2 text-right font-mono">
        <input
          type="text"
          value={ghostRow.precioUnitario}
          onChange={(e) => setGhostRow((prev) => ({ ...prev, precioUnitario: e.target.value }))}
          onKeyDown={handleKeyDown}
          placeholder="0.00"
          className="w-full px-2 py-1 text-xs text-right font-mono bg-transparent hover:bg-surface-container-lowest focus:bg-surface-container-lowest border border-transparent focus:border-primary rounded-md outline-hidden text-on-surface placeholder:text-on-surface-variant/40 transition-colors"
        />
      </div>

      {/* ─── Columna 6: Subtotal Preview ─── */}
      <div className="w-28 sm:w-32 shrink-0 pr-2 text-right font-mono text-on-surface-variant/60 font-semibold">
        {previewSubtotal > 0 ? formatARS(previewSubtotal) : '$ 0,00'}
      </div>

      {/* ─── Columna 7: Botón Confirmar Adición ─── */}
      <div className="w-8 shrink-0 flex items-center justify-center">
        <button
          type="button"
          onClick={() => onCommitGhostRow()}
          disabled={!ghostRow.funcion.trim()}
          className="p-1 text-primary hover:bg-primary/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-all cursor-pointer"
          title="Agregar nueva línea (Enter)"
          aria-label="Agregar nueva línea"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
