import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Plus,
  Trash2,
  Edit2,
  Check,
  BookOpen
} from 'lucide-react';
import { CapituloPresupuesto, ItemPresupuesto } from '../../../core/types';
import { formatARS, CapituloTotalResultado } from '../../../core/calculations';

interface TreeSheetChapterRowProps {
  capitulo: CapituloPresupuesto;
  items: ItemPresupuesto[];
  indexNumber?: string;
  isCollapsed: boolean;
  isSelected: boolean;
  capituloTotales?: CapituloTotalResultado | {
    costoDirecto?: number;
    precioFinal?: number;
    costoDirectoTotal?: number;
    precioVentaTotal?: number;
  };
  onToggleCollapse: () => void;
  onSelect: () => void;
  onAddItem: () => void;
  onOpenCatalog?: () => void;
  onRenameChapter: (nombre: string) => void;
  onRemoveChapter: () => void;
}

export const TreeSheetChapterRow: React.FC<TreeSheetChapterRowProps> = ({
  capitulo,
  items,
  indexNumber,
  isCollapsed,
  isSelected,
  capituloTotales,
  onToggleCollapse,
  onSelect,
  onAddItem,
  onOpenCatalog,
  onRenameChapter,
  onRemoveChapter
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(capitulo.nombre);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameValue(capitulo.nombre);
  }, [capitulo.nombre]);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  const handleCommitName = () => {
    setIsEditingName(false);
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== capitulo.nombre) {
      onRenameChapter(trimmed);
    } else {
      setNameValue(capitulo.nombre);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommitName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditingName(false);
      setNameValue(capitulo.nombre);
    }
  };

  // Subtotales del capítulo calculados con precisión por el motor
  const chapterCostoDirecto =
    ('costoDirectoTotal' in (capituloTotales || {})
      ? (capituloTotales as CapituloTotalResultado).costoDirectoTotal
      : (capituloTotales as { costoDirecto?: number })?.costoDirecto) ??
    items.reduce((acc, it) => acc + (it.costoDirectoTotal || 0), 0);

  const chapterPrecioFinal =
    ('precioVentaTotal' in (capituloTotales || {})
      ? (capituloTotales as CapituloTotalResultado).precioVentaTotal
      : (capituloTotales as { precioFinal?: number })?.precioFinal) ??
    items.reduce((acc, it) => acc + (it.precioFinalItem ?? it.precioVentaTotal ?? it.costoDirectoTotal ?? 0), 0);

  return (
    <div
      role="row"
      aria-selected={isSelected}
      onClick={onSelect}
      className={`group flex items-center justify-between px-3 py-2 text-sm border-b border-outline-variant/30 select-none transition-colors cursor-pointer ${
        isSelected
          ? 'bg-primary-container/30 border-l-4 border-l-primary'
          : 'bg-surface-container-low hover:bg-surface-container/60'
      }`}
    >
      {/* Columna Izquierda: Chevron, Ícono de carpeta y Título del capítulo */}
      <div className="flex items-center gap-2 flex-1 min-w-0 pr-4">
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-transform cursor-pointer"
          title={isCollapsed ? 'Expandir rubro' : 'Plegar rubro'}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-primary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-primary" />
          )}
        </button>

        <Folder className="w-4 h-4 text-primary shrink-0 opacity-80" />

        {isEditingName ? (
          <div className="flex items-center gap-1 flex-1 max-w-md">
            <input
              ref={inputRef}
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleCommitName}
              onKeyDown={handleKeyDown}
              className="w-full px-2 py-0.5 text-sm font-semibold bg-surface border border-primary rounded text-on-surface focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCommitName}
              className="p-1 text-primary hover:bg-primary-container rounded cursor-pointer"
              title="Guardar nombre"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 truncate">
            {indexNumber && (
              <span className="font-mono text-xs font-bold text-primary shrink-0 select-none px-1.5 py-0.5 rounded bg-primary/10">
                {indexNumber}
              </span>
            )}
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingName(true);
              }}
              className="font-bold text-on-surface truncate text-sm"
              title="Doble clic para renombrar"
            >
              {capitulo.nombre}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-medium">
              {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
            </span>
          </div>
        )}
      </div>

      {/* Columna Derecha: Subtotal de Precio Final y Acciones alineados con la grilla */}
      <div className="flex items-center shrink-0">
        {/* Spacer para Cantidad / Unidad */}
        <div className="w-28 sm:w-32 md:w-36 shrink-0" aria-hidden="true" />

        {/* Spacer para P. Unitario Final */}
        <div className="hidden sm:block w-28 sm:w-32 shrink-0" aria-hidden="true" />

        {/* Subtotal de Precio Final Consolidado del Rubro */}
        <div className="w-32 sm:w-40 shrink-0 px-2 text-right">
          <span className="text-xs sm:text-sm font-mono font-bold text-primary">
            {formatARS(chapterPrecioFinal)}
          </span>
          <span className="block text-[9px] text-primary/80 uppercase tracking-wider font-bold">
            Total Rubro
          </span>
        </div>

        {/* Acciones de rubro visibles en hover o selección */}
        <div className="w-32 sm:w-36 shrink-0 flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity pr-1">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onAddItem();
            }}
            className="p-1 rounded-md bg-surface-container-high hover:bg-surface-container-highest text-primary transition-colors cursor-pointer"
            title="Agregar ítem libre en este rubro"
            aria-label="Agregar ítem"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {onOpenCatalog && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onOpenCatalog();
              }}
              className="p-1 rounded-md bg-surface-container-high hover:bg-surface-container-highest text-tertiary transition-colors cursor-pointer"
              title="Agregar trabajo tipo desde catálogo a este rubro"
              aria-label="Agregar desde catálogo"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              setIsEditingName(true);
            }}
            className="p-1 rounded-md hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title="Renombrar rubro"
            aria-label="Renombrar rubro"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`¿Eliminar rubro "${capitulo.nombre}"? Se eliminarán los ítems contenidos en él.`)) {
                onRemoveChapter();
              }
            }}
            className="p-1 rounded-md hover:bg-error-container text-on-surface-variant hover:text-error transition-colors cursor-pointer"
            title="Eliminar rubro"
            aria-label="Eliminar rubro"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
