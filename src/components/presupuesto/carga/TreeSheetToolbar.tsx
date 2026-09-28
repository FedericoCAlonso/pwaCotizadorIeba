import React from 'react';
import {
  FolderPlus,
  Plus,
  BookOpen,
  Sliders,
  Command,
  FileCode,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { TotalViewMode } from '../../../viewmodels/useTreeSheetViewModel';

interface TreeSheetToolbarProps {
  totalViewMode: TotalViewMode;
  onToggleTotalViewMode: () => void;
  onCreateChapter: () => void;
  onCreateItem: () => void;
  onOpenCatalogPicker: () => void;
  onOpenQuoteParameters: () => void;
  onOpenCommandPalette: () => void;
  onOpenTextMode?: () => void;
}

export const TreeSheetToolbar: React.FC<TreeSheetToolbarProps> = ({
  totalViewMode,
  onToggleTotalViewMode,
  onCreateChapter,
  onCreateItem,
  onOpenCatalogPicker,
  onOpenQuoteParameters,
  onOpenCommandPalette,
  onOpenTextMode
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-surface-container-low border-b border-outline-variant/30 select-none">
      {/* Botones de acción principales sobre el árbol */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onCreateChapter}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-on-surface bg-surface-container hover:bg-surface-container-high rounded-lg border border-outline-variant/40 transition-colors shadow-2xs cursor-pointer active:scale-95"
          title="Agregar nuevo Capítulo (Nivel 1)"
        >
          <FolderPlus className="w-3.5 h-3.5 text-primary" />
          <span>+ Capítulo</span>
        </button>

        <button
          type="button"
          onClick={onCreateItem}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-on-surface bg-surface-container hover:bg-surface-container-high rounded-lg border border-outline-variant/40 transition-colors shadow-2xs cursor-pointer active:scale-95"
          title="Agregar nuevo Ítem (Enter)"
        >
          <Plus className="w-3.5 h-3.5 text-secondary" />
          <span>+ Ítem</span>
        </button>

        <button
          type="button"
          onClick={onOpenCatalogPicker}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-on-surface bg-surface-container hover:bg-surface-container-high rounded-lg border border-outline-variant/40 transition-colors shadow-2xs cursor-pointer active:scale-95"
          title="Insertar tarea predefinida desde el Catálogo de Tareas Tipo"
        >
          <BookOpen className="w-3.5 h-3.5 text-tertiary" />
          <span>Insertar Tarea Tipo</span>
        </button>

        <button
          type="button"
          onClick={onOpenQuoteParameters}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-on-surface bg-surface-container hover:bg-surface-container-high rounded-lg border border-outline-variant/40 transition-colors shadow-2xs cursor-pointer active:scale-95"
          title="Variables globales, indirectos, margen de riesgo y beneficio"
        >
          <Sliders className="w-3.5 h-3.5 text-outline" />
          <span>Parámetros</span>
        </button>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-on-surface-variant hover:text-on-surface bg-surface-container-lowest hover:bg-surface-container rounded-lg border border-outline-variant/30 transition-colors cursor-pointer"
          title="Paleta de Comandos (Ctrl+K)"
        >
          <Command className="w-3.5 h-3.5" />
          <span className="text-[11px] font-mono">Ctrl+K</span>
        </button>
      </div>

      {/* Selector de modo de columna Total y Vistas auxiliares */}
      <div className="flex items-center gap-2">
        {/* Interruptor Costo directo vs Precio con indirectos */}
        <div className="inline-flex items-center p-0.5 bg-surface-container-highest rounded-lg border border-outline-variant/30 text-xs">
          <button
            type="button"
            onClick={onToggleTotalViewMode}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              totalViewMode === 'costo'
                ? 'bg-surface text-primary font-semibold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            title="Mostrar costo directo puro de insumos, mano de obra y servicios"
          >
            <DollarSign className="w-3 h-3" />
            <span>Costo directo</span>
          </button>
          <button
            type="button"
            onClick={onToggleTotalViewMode}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              totalViewMode === 'precio'
                ? 'bg-surface text-secondary font-semibold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            title="Mostrar precio final prorrateado con indirectos, riesgo, GG y beneficio"
          >
            <TrendingUp className="w-3 h-3" />
            <span>Precio final</span>
          </button>
        </div>

        {/* Ver Modo Experto (YAML) */}
        {onOpenTextMode && (
          <button
            type="button"
            onClick={onOpenTextMode}
            className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-on-surface bg-surface-container hover:bg-surface-container-high rounded-lg border border-outline-variant/30 transition-colors cursor-pointer"
            title="Abrir editor de texto estructurado YAML"
          >
            <FileCode className="w-3.5 h-3.5 text-primary" />
            <span>YAML</span>
          </button>
        )}
      </div>
    </div>
  );
};
