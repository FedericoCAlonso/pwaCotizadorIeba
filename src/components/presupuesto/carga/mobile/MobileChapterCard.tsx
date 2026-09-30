import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Plus,
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
  isEditingExternal?: boolean;
  onToggleCollapse: () => void;
  onSelect: () => void;
  onAddItem: () => void;
  onRenameChapter: (nombre: string) => void;
  onRemoveChapter: () => void;
  onOpenActions?: () => void;
  onFinishRename?: () => void;
}

export const MobileChapterCard: React.FC<MobileChapterCardProps> = ({
  capitulo,
  items,
  isCollapsed,
  isSelected,
  capituloTotales,
  isEditingExternal,
  onToggleCollapse,
  onSelect,
  onAddItem,
  onRenameChapter,
  onRemoveChapter,
  onOpenActions,
  onFinishRename
}) => {
  const haptics = useHaptics();
  const [isEditing, setIsEditing] = useState(false);
  const [nameValue, setNameValue] = useState(capitulo.nombre);
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  useEffect(() => {
    setNameValue(capitulo.nombre);
  }, [capitulo.nombre]);

  useEffect(() => {
    if (isEditingExternal) {
      setIsEditing(true);
    }
  }, [isEditingExternal]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handleTouchStart = () => {
    if (isEditing) return;
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      haptics.tickStrong();
      if (onOpenActions) {
        onOpenActions();
      }
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleCommitRename = () => {
    if (nameValue.trim() && nameValue.trim() !== capitulo.nombre) {
      onRenameChapter(nameValue.trim());
    } else {
      setNameValue(capitulo.nombre);
    }
    setIsEditing(false);
    if (onFinishRename) {
      onFinishRename();
    }
  };

  const handleClick = () => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    onSelect();
  };

  const finalPrice =
    capituloTotales?.precioVentaTotal ??
    (capituloTotales && 'precioFinal' in capituloTotales ? (capituloTotales as any).precioFinal : undefined) ??
    items.reduce((acc, it) => acc + (it.precioFinalItem ?? it.precioVentaTotal ?? it.costoDirectoTotal ?? 0), 0);

  return (
    <div
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchCancel={handleTouchEnd}
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
          className="w-10 h-10 -ml-1 rounded-xl flex items-center justify-center text-primary hover:bg-primary-container/30 transition-colors cursor-pointer shrink-0"
          aria-label={isCollapsed ? 'Expandir rubro' : 'Plegar rubro'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>

        {/* Nombre del Rubro y Contador */}
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
                    if (onFinishRename) onFinishRename();
                  }
                }}
                className="w-full px-2 py-1.5 text-sm font-bold bg-surface border border-primary rounded-lg text-on-surface focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCommitRename}
                className="p-1.5 rounded-lg bg-primary text-on-primary cursor-pointer shrink-0"
                aria-label="Confirmar renombrado"
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
                {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
              </div>
            </div>
          )}
        </div>

        {/* Total del Rubro */}
        <div className="text-right shrink-0">
          <div className="font-mono font-extrabold text-sm text-primary">
            {formatARS(finalPrice)}
          </div>
        </div>

        {/* Botón rápido + Ítem */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            haptics.selection();
            onAddItem();
          }}
          className="w-9 h-9 rounded-xl bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-95"
          title="Agregar ítem a este rubro"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Botón de Acciones del Rubro (Touch Target 44x44px) */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              haptics.selection();
              if (onOpenActions) {
                onOpenActions();
              } else {
                setIsEditing(true);
              }
            }}
            className="w-10 h-10 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Acciones del rubro"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
