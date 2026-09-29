import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Plus,
  Trash2,
  Edit2,
  Check,
  MoreVertical
} from 'lucide-react';
import { CapituloPresupuesto, ItemPresupuesto } from '../../../../core/types';
import { formatARS, CapituloTotalResultado } from '../../../../core/calculations';
import { useHaptics } from '../../../../hooks/useHaptics';

export interface MobileChapterCardProps {
  capitulo: CapituloPresupuesto;
  items: ItemPresupuesto[];
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
  onRenameChapter: (nombre: string) => void;
  onRemoveChapter: () => void;
}

export const MobileChapterCard: React.FC<MobileChapterCardProps> = ({
  capitulo,
  items,
  isCollapsed,
  isSelected,
  capituloTotales,
  onToggleCollapse,
  onSelect,
  onAddItem,
  onRenameChapter,
  onRemoveChapter
}) => {
  const haptics = useHaptics();
  const [isEditing, setIsEditing] = useState(false);
  const [nameValue, setNameValue] = useState(capitulo.nombre);
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameValue(capitulo.nombre);
  }, [capitulo.nombre]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleCommitRename = () => {
    if (nameValue.trim() && nameValue.trim() !== capitulo.nombre) {
      onRenameChapter(nameValue.trim());
    } else {
      setNameValue(capitulo.nombre);
    }
    setIsEditing(false);
  };

  const finalPrice =
    capituloTotales?.precioVentaTotal ??
    (capituloTotales && 'precioFinal' in capituloTotales ? (capituloTotales as any).precioFinal : undefined) ??
    items.reduce((acc, it) => acc + (it.precioFinalItem ?? it.precioVentaTotal ?? it.costoDirectoTotal ?? 0), 0);

  return (
    <div
      onClick={onSelect}
      className={`rounded-2xl border transition-all mb-2 overflow-hidden select-none ${
        isSelected
          ? 'bg-surface-container-highest border-primary/60 shadow-xs'
          : 'bg-surface-container border-outline-variant/30 shadow-2xs'
      }`}
    >
      <div className="p-3 flex items-center justify-between gap-2">
        {/* Toggle Collapse & Folder Icon */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            haptics.tickStrong();
            onToggleCollapse();
          }}
          className="w-9 h-9 -ml-1 rounded-xl flex items-center justify-center text-primary hover:bg-primary-container/30 transition-colors cursor-pointer shrink-0"
          aria-label={isCollapsed ? 'Expandir capítulo' : 'Plegar capítulo'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>

        {/* Nombre del Capítulo y Contador */}
        <div className="min-w-0 flex-1 pr-1">
          {isEditing ? (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <input
                ref={inputRef}
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleCommitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitRename();
                  if (e.key === 'Escape') {
                    setNameValue(capitulo.nombre);
                    setIsEditing(false);
                  }
                }}
                className="w-full px-2 py-1 text-sm font-bold bg-surface border border-primary rounded-lg text-on-surface focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCommitRename}
                className="p-1 rounded-lg bg-primary text-on-primary cursor-pointer shrink-0"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              onClick={(e) => {
                e.stopPropagation();
                haptics.tickStrong();
                onToggleCollapse();
              }}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-primary shrink-0" />
                <h3 className="text-sm font-bold text-on-surface truncate">
                  {capitulo.nombre}
                </h3>
              </div>
              <div className="text-[11px] text-on-surface-variant/80 font-medium mt-0.5">
                {items.length} {items.length === 1 ? 'partida' : 'partidas'}
              </div>
            </div>
          )}
        </div>

        {/* Total del Capítulo */}
        <div className="text-right shrink-0">
          <div className="font-mono font-extrabold text-sm text-primary">
            {formatARS(finalPrice)}
          </div>
        </div>

        {/* Botón rápido + Partida */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            haptics.selection();
            onAddItem();
          }}
          className="w-8 h-8 rounded-xl bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-95"
          title="Agregar partida a este capítulo"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Menú de Capítulo (Renombrar / Eliminar) */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="w-8 h-8 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Opciones del capítulo"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1 w-44 bg-surface-container-highest border border-outline-variant/40 rounded-2xl shadow-xl p-1 z-40 flex flex-col gap-0.5 animate-in fade-in duration-100"
            >
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setIsEditing(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container rounded-xl cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-primary" />
                <span>Renombrar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  haptics.warning();
                  onRemoveChapter();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-error hover:bg-error-container/30 rounded-xl cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar capítulo</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
