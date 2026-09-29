import React from 'react';
import {
  Plus,
  BookOpen,
  FolderPlus,
  Sliders
} from 'lucide-react';
import { useHaptics } from '../../../../hooks/useHaptics';

export interface MobileEditorActionBarProps {
  onAddItem: () => void;
  onOpenCatalog: () => void;
  onAddChapter: () => void;
  onOpenParameters: () => void;
}

export const MobileEditorActionBar: React.FC<MobileEditorActionBarProps> = ({
  onAddItem,
  onOpenCatalog,
  onAddChapter,
  onOpenParameters
}) => {
  const haptics = useHaptics();

  return (
    <div className="w-full bg-surface-container-high/90 backdrop-blur-md border-t border-outline-variant/30 px-3 py-2 flex items-center justify-between gap-2 shadow-lg shrink-0 select-none z-20">
      {/* Botón Principal: + Partida */}
      <button
        type="button"
        onClick={() => {
          haptics.tickStrong();
          onAddItem();
        }}
        className="flex-1 py-2 px-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs hover:bg-primary/90 transition-all cursor-pointer active:scale-95 min-h-[44px]"
      >
        <Plus className="w-4 h-4 stroke-[2.5]" />
        <span>+ Partida</span>
      </button>

      {/* Botón Catálogo */}
      <button
        type="button"
        onClick={() => {
          haptics.selection();
          onOpenCatalog();
        }}
        className="flex-1 py-2 px-2 rounded-xl bg-surface-container-highest hover:bg-surface-container text-on-surface font-semibold text-xs flex items-center justify-center gap-1.5 border border-outline-variant/30 transition-all cursor-pointer active:scale-95 min-h-[44px]"
        title="Catálogo de Tareas Tipo"
      >
        <BookOpen className="w-4 h-4 text-tertiary" />
        <span>Catálogo</span>
      </button>

      {/* Botón + Capítulo */}
      <button
        type="button"
        onClick={() => {
          haptics.selection();
          onAddChapter();
        }}
        className="py-2 px-3 rounded-xl bg-surface-container-highest hover:bg-surface-container text-on-surface font-semibold text-xs flex items-center justify-center gap-1.5 border border-outline-variant/30 transition-all cursor-pointer active:scale-95 min-h-[44px]"
        title="Nuevo Capítulo"
      >
        <FolderPlus className="w-4 h-4 text-secondary" />
        <span className="hidden xs:inline">Capítulo</span>
      </button>

      {/* Botón Parámetros */}
      <button
        type="button"
        onClick={() => {
          haptics.selection();
          onOpenParameters();
        }}
        className="p-2.5 rounded-xl bg-surface-container-highest hover:bg-surface-container text-on-surface font-semibold text-xs flex items-center justify-center border border-outline-variant/30 transition-all cursor-pointer active:scale-95 min-h-[44px]"
        title="Configuración de Parámetros Globales"
        aria-label="Parámetros de Cotización"
      >
        <Sliders className="w-4 h-4 text-primary" />
      </button>
    </div>
  );
};
