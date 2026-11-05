import React, { useState, useMemo } from 'react';
import { Package, Zap, Truck, Trash2 } from 'lucide-react';
import { UnifiedLineaRow, EditableLineField, EditingLineCellState } from '../../../viewmodels/useSmartSheetLinesViewModel';
import { formatARS } from '../../../core/calculations';
import { MaterialCatalogSuggestion, searchMaterialCatalogSuggestions } from '../../../core/materialSuggestions';
import { SmartSheetMaterialAutocomplete } from './SmartSheetMaterialAutocomplete';

/**
 * Propiedades de cada fila de línea en la planilla inteligente (Zona 2).
 */
export interface SmartSheetLineaRowProps {
  /** Objeto de línea consolidado (material, mano de obra o servicio) */
  linea: UnifiedLineaRow;
  /** Estado de la celda actualmente en edición */
  editingCell: EditingLineCellState | null;
  /** Valor de texto del input durante la edición */
  editingValue: string;
  /** Callback para actualizar el texto en edición */
  setEditingValue: (val: string) => void;
  /** Mensaje de error de validación de fórmula de cantidad */
  evalError: string | null;
  /** Callback para limpiar o actualizar el error de evaluación */
  setEvalError: (err: string | null) => void;
  /** Iniciar edición de una celda específica */
  onStartEdit: (lineId: string, field: EditableLineField, initialVal: string) => void;
  /** Cancelar edición (Escape) */
  onCancelEdit: () => void;
  /** Confirmar y persistir edición (Enter o blur) */
  onCommitEdit: (lineId: string, field: EditableLineField, val?: string) => boolean;
  /** Navegar a la celda anterior o siguiente (Tab / Shift+Tab) */
  onNavigateCell: (direction: 'next' | 'prev') => void;
  /** Callback para solicitar eliminación con confirmación */
  onRemoveLine: (linea: UnifiedLineaRow) => void;
  /** Catálogo de sugerencias de materiales por función */
  materialSuggestions?: MaterialCatalogSuggestion[];
  /** Callback para seleccionar sugerencia de material del catálogo */
  onSelectSuggestion?: (sug: MaterialCatalogSuggestion, target: { lineId: string }) => void;
}

/**
 * SmartSheetLineaRow: Componente modular que renderiza una fila editable de línea.
 * Soporta edición en el lugar (in-place), validación de fórmulas sin perder texto y atajos de teclado.
 */
export const SmartSheetLineaRow: React.FC<SmartSheetLineaRowProps> = ({
  linea,
  editingCell,
  editingValue,
  setEditingValue,
  evalError,
  setEvalError,
  onStartEdit,
  onCancelEdit,
  onCommitEdit,
  onNavigateCell,
  onRemoveLine,
  materialSuggestions = [],
  onSelectSuggestion
}) => {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const isEditing = (field: EditableLineField) =>
    editingCell?.lineId === linea.id && editingCell?.field === field;

  // Sugerencias de catálogo cuando se edita la función de un material
  const filteredSuggestions = useMemo(() => {
    if (!isEditing('funcion') || linea.sourceType !== 'material' || !editingValue.trim()) {
      return [];
    }
    return searchMaterialCatalogSuggestions(editingValue, materialSuggestions, 8);
  }, [isEditing('funcion'), linea.sourceType, editingValue, materialSuggestions]);

  const handleSelectSug = (sug: MaterialCatalogSuggestion) => {
    if (onSelectSuggestion) {
      onSelectSuggestion(sug, { lineId: linea.id });
    } else {
      onCommitEdit(linea.id, 'funcion', sug.nombre);
    }
    setShowAutocomplete(false);
    setHighlightedIndex(-1);
  };

  // Manejador centralizado de teclas de navegación (Enter, Esc, Tab, Shift+Tab)
  const handleKeyDown = (field: EditableLineField) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (field === 'funcion' && showAutocomplete && filteredSuggestions.length > 0) {
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
      onCommitEdit(linea.id, field, editingValue);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelEdit();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onNavigateCell(e.shiftKey ? 'prev' : 'next');
    }
  };

  // Alternar tipo de línea cíclicamente (Material -> Mano de Obra -> Servicio -> Material)
  const handleCycleTipo = () => {
    const nextType: 'material' | 'mano_obra' | 'servicio' =
      linea.sourceType === 'material'
        ? 'mano_obra'
        : linea.sourceType === 'mano_obra'
        ? 'servicio'
        : 'material';
    onCommitEdit(linea.id, 'tipo', nextType);
  };

  return (
    <div
      className="flex items-center px-3 py-1.5 text-xs hover:bg-surface-container-high/40 transition-colors group select-none border-b border-outline-variant/10"
      role="row"
    >
      {/* ─── Columna 1: Tipo con Icono y Selector Rápido ─── */}
      <div className="w-10 sm:w-12 shrink-0 flex items-center justify-center">
        <button
          type="button"
          onClick={handleCycleTipo}
          className="p-1 rounded-lg transition-transform active:scale-95 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-primary"
          title={`Tipo: ${linea.tipoLabel} (clic para cambiar a ${
            linea.sourceType === 'material' ? 'Mano de Obra' : linea.sourceType === 'mano_obra' ? 'Servicio' : 'Material'
          })`}
          aria-label={`Tipo ${linea.tipoLabel}`}
        >
          {linea.sourceType === 'material' && (
            <span className="p-1 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Package className="w-3.5 h-3.5" />
            </span>
          )}
          {linea.sourceType === 'mano_obra' && (
            <span className="p-1 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
              <Zap className="w-3.5 h-3.5" />
            </span>
          )}
          {linea.sourceType === 'servicio' && (
            <span className="p-1 rounded-lg bg-tertiary/10 text-tertiary flex items-center justify-center">
              <Truck className="w-3.5 h-3.5" />
            </span>
          )}
        </button>
      </div>

      {/* ─── Columna 2: Función / Descripción (Editable in-place) ─── */}
      <div className="flex-1 min-w-0 px-2 relative">
        {isEditing('funcion') ? (
          <>
            <input
              type="text"
              autoFocus
              value={editingValue}
              onChange={(e) => {
                setEditingValue(e.target.value);
                setShowAutocomplete(true);
                setHighlightedIndex(-1);
              }}
              onFocus={() => {
                if (editingValue.trim()) setShowAutocomplete(true);
              }}
              onKeyDown={handleKeyDown('funcion')}
              onBlur={() => {
                setTimeout(() => {
                  onCommitEdit(linea.id, 'funcion', editingValue);
                  setShowAutocomplete(false);
                }, 150);
              }}
              className="w-full px-2 py-1 text-xs bg-surface-container-lowest border border-primary rounded-md outline-hidden text-on-surface shadow-2xs font-sans"
              placeholder="Función o descripción"
            />
            <SmartSheetMaterialAutocomplete
              suggestions={filteredSuggestions}
              isOpen={showAutocomplete && filteredSuggestions.length > 0}
              onSelect={handleSelectSug}
              onClose={() => setShowAutocomplete(false)}
              highlightedIndex={highlightedIndex}
            />
          </>
        ) : (
          <div
            onClick={() => onStartEdit(linea.id, 'funcion', linea.funcion)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onStartEdit(linea.id, 'funcion', linea.funcion);
            }}
            className="cursor-pointer hover:bg-surface-container-high/60 rounded px-1.5 py-0.5 transition-colors focus:ring-1 focus:ring-primary focus:outline-hidden"
            title="Clic para editar función / descripción"
          >
            <div className="font-medium text-on-surface truncate">{linea.funcion}</div>
            <div className="text-[10px] text-on-surface-variant/60 sm:hidden">{linea.tipoLabel}</div>
          </div>
        )}
      </div>

      {/* ─── Columna 3: Marca / Modelo (Editable in-place, excepto mano de obra) ─── */}
      <div className="w-28 sm:w-36 shrink-0 px-2 truncate text-on-surface-variant">
        {linea.sourceType === 'mano_obra' ? (
          <span className="text-on-surface-variant/40 italic text-[11px]" title="No aplica marca en mano de obra">
            —
          </span>
        ) : isEditing('marcaModelo') ? (
          <input
            type="text"
            autoFocus
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onKeyDown={handleKeyDown('marcaModelo')}
            onBlur={() => onCommitEdit(linea.id, 'marcaModelo', editingValue)}
            onFocus={(e) => e.target.select()}
            className="w-full px-2 py-1 text-xs bg-surface-container-lowest border border-primary rounded-md outline-hidden text-on-surface shadow-2xs font-sans"
            placeholder="Marca / Modelo"
          />
        ) : (
          <div
            onClick={() => onStartEdit(linea.id, 'marcaModelo', linea.marcaModelo || '')}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onStartEdit(linea.id, 'marcaModelo', linea.marcaModelo || '');
            }}
            className="cursor-pointer hover:bg-surface-container-high/60 rounded px-1.5 py-0.5 transition-colors focus:ring-1 focus:ring-primary focus:outline-hidden truncate"
            title="Clic para editar marca o modelo"
          >
            {linea.marcaModelo ? (
              <span className="font-medium text-on-surface">{linea.marcaModelo}</span>
            ) : (
              <span className="text-on-surface-variant/45 italic">Sin definir</span>
            )}
          </div>
        )}
      </div>

      {/* ─── Columna 4: Cantidad (Editable: número o fórmula; muestra resultado y fórmula en gris) ─── */}
      <div className="w-32 sm:w-44 shrink-0 px-2 text-right font-mono flex flex-col items-end justify-center">
        {isEditing('cantidad') ? (
          <div className="w-full flex flex-col items-end">
            <input
              type="text"
              autoFocus
              value={editingValue}
              onChange={(e) => {
                setEditingValue(e.target.value);
                if (evalError) setEvalError(null);
              }}
              onKeyDown={handleKeyDown('cantidad')}
              onBlur={() => onCommitEdit(linea.id, 'cantidad', editingValue)}
              onFocus={(e) => e.target.select()}
              className={`w-full px-2 py-1 text-xs text-right font-mono rounded-md outline-hidden shadow-2xs bg-surface-container-lowest ${
                evalError
                  ? 'border border-error ring-1 ring-error text-error bg-error-container/20'
                  : 'border border-primary text-on-surface'
              }`}
              placeholder="Número o =fórmula"
            />
            {evalError && (
              <span
                className="text-[10px] text-error font-sans font-medium mt-0.5 max-w-full truncate text-right"
                title={evalError}
              >
                {evalError}
              </span>
            )}
          </div>
        ) : (
          <div
            onClick={() =>
              onStartEdit(
                linea.id,
                'cantidad',
                linea.formula ? (linea.formula.startsWith('=') ? linea.formula : `=${linea.formula}`) : String(linea.cantidadCalculada)
              )
            }
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onStartEdit(
                  linea.id,
                  'cantidad',
                  linea.formula ? (linea.formula.startsWith('=') ? linea.formula : `=${linea.formula}`) : String(linea.cantidadCalculada)
                );
              }
            }}
            className="cursor-pointer hover:bg-surface-container-high/60 rounded px-1.5 py-0.5 transition-colors focus:ring-1 focus:ring-primary focus:outline-hidden flex flex-col items-end"
            title="Clic para editar cantidad o fórmula"
          >
            <div className="text-on-surface font-semibold">
              {linea.cantidadCalculada} {linea.unidad}
            </div>
            {linea.formula && (
              <div
                className="text-[10px] text-on-surface-variant/60 truncate max-w-full font-normal"
                title={`Fórmula de cálculo: ${linea.formula}`}
              >
                {linea.formula.startsWith('=') ? linea.formula : `=${linea.formula}`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Columna 5: Unitario (Editable in-place) ─── */}
      <div className="w-24 sm:w-28 shrink-0 px-2 text-right font-mono text-on-surface-variant">
        {isEditing('precioUnitario') ? (
          <input
            type="text"
            autoFocus
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onKeyDown={handleKeyDown('precioUnitario')}
            onBlur={() => onCommitEdit(linea.id, 'precioUnitario', editingValue)}
            onFocus={(e) => e.target.select()}
            className="w-full px-2 py-1 text-xs text-right bg-surface-container-lowest border border-primary rounded-md outline-hidden text-on-surface shadow-2xs font-mono"
            placeholder="0.00"
          />
        ) : (
          <div
            onClick={() => onStartEdit(linea.id, 'precioUnitario', String(linea.precioUnitario))}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onStartEdit(linea.id, 'precioUnitario', String(linea.precioUnitario));
            }}
            className="cursor-pointer hover:bg-surface-container-high/60 rounded px-1.5 py-0.5 transition-colors focus:ring-1 focus:ring-primary focus:outline-hidden"
            title="Clic para editar precio unitario"
          >
            {formatARS(linea.precioUnitario)}
          </div>
        )}
      </div>

      {/* ─── Columna 6: Subtotal (Solo Lectura) ─── */}
      <div className="w-28 sm:w-32 shrink-0 pr-2 text-right font-mono font-bold text-on-surface">
        {formatARS(linea.subtotal)}
      </div>

      {/* ─── Columna 7: Acción Eliminar con Confirmación ─── */}
      <div className="w-8 shrink-0 flex items-center justify-center">
        <button
          type="button"
          onClick={() => onRemoveLine(linea)}
          className="p-1 text-on-surface-variant/50 hover:text-error hover:bg-error-container/30 rounded-lg transition-colors cursor-pointer opacity-70 group-hover:opacity-100 focus:opacity-100"
          title={`Eliminar línea "${linea.funcion}"`}
          aria-label={`Eliminar línea ${linea.funcion}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
