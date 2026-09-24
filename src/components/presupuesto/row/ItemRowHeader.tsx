import React, { useState } from 'react';
import {
  Sparkles,
  Layers,
  Package,
  Edit3,
  Sliders,
  Ruler,
  Trash2,
  MoreVertical,
  GraduationCap,
  Truck,
  FileText
} from 'lucide-react';
import { ItemPresupuesto } from '../../../core/types';

interface ItemRowHeaderProps {
  item: ItemPresupuesto;
  index: number;
  onUpdateItemDescription: (index: number, desc: string) => void;
  titleInputRef?: (el: HTMLInputElement | null) => void;
  isItemLibre: boolean;
  isCustom: boolean;
  hasSnapshots: boolean;
  isParametric: boolean;
  hasMaterialCalc: boolean;
  onOpenParametricModal?: (index: number) => void;
  onOpenMaterialModal?: (index: number) => void;
  onOpenInSituEditor?: (index: number) => void;
  onOpenMaterialPicker?: (index: number) => void;
  onToggleExpand: (id: string) => void;
  onSaveAsTemplate: (item: ItemPresupuesto) => void;
  onRemoveItem: (index: number) => void;
}

export const ItemRowHeader: React.FC<ItemRowHeaderProps> = ({
  item,
  index,
  onUpdateItemDescription,
  titleInputRef,
  isItemLibre,
  hasSnapshots,
  isParametric,
  hasMaterialCalc,
  onOpenParametricModal,
  onOpenMaterialModal,
  onOpenInSituEditor,
  onOpenMaterialPicker,
  onToggleExpand,
  onSaveAsTemplate,
  onRemoveItem
}) => {
  const [showItemMenu, setShowItemMenu] = useState(false);

  const renderItemMenu = () => {
    if (!showItemMenu) return null;
    return (
      <>
        <div
          className="fixed inset-0 z-20"
          onClick={() => setShowItemMenu(false)}
        />
        <div className="absolute right-0 top-full mt-1.5 z-30 bg-surface-container-high rounded-2xl shadow-xl py-2 min-w-[230px] border border-outline-variant/30 text-on-surface animate-in fade-in zoom-in-95 duration-150">
          <button
            type="button"
            onClick={() => {
              onSaveAsTemplate(item);
              setShowItemMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-primary hover:bg-primary/10 transition-colors text-left font-semibold min-h-[42px] cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Guardar en Catálogo</span>
          </button>

          {isItemLibre && !hasSnapshots && (
            <button
              type="button"
              onClick={() => {
                onToggleExpand(item.id);
                setShowItemMenu(false);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-surface-container-highest transition-colors text-left font-semibold min-h-[42px] cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>Desglosar Costos (Materiales / MO)</span>
            </button>
          )}

          {onOpenMaterialPicker && (
            <button
              type="button"
              onClick={() => {
                onOpenMaterialPicker(index);
                setShowItemMenu(false);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-primary hover:bg-primary/10 transition-colors text-left font-semibold min-h-[42px] cursor-pointer"
            >
              <Package className="w-4 h-4" />
              <span>Agregar Materiales del Catálogo</span>
            </button>
          )}

          {onOpenInSituEditor && (
            <button
              type="button"
              onClick={() => {
                onOpenInSituEditor(index);
                setShowItemMenu(false);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-surface-container-highest transition-colors text-left font-semibold min-h-[42px] cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>Editar Fórmulas y Materiales</span>
            </button>
          )}

          {isParametric && onOpenParametricModal && (
            <button
              type="button"
              onClick={() => {
                onOpenParametricModal(index);
                setShowItemMenu(false);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-highest transition-colors text-left font-medium min-h-[42px] cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-on-surface-variant" />
              <span>Reajustar Parámetros</span>
            </button>
          )}

          {hasMaterialCalc && onOpenMaterialModal && (
            <button
              type="button"
              onClick={() => {
                onOpenMaterialModal(index);
                setShowItemMenu(false);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-highest transition-colors text-left font-medium min-h-[42px] cursor-pointer"
            >
              <Ruler className="w-4 h-4 text-on-surface-variant" />
              <span>Cálculo Paramétrico</span>
            </button>
          )}

          <hr className="border-outline-variant/20 my-1" />

          <button
            type="button"
            onClick={() => {
              onRemoveItem(index);
              setShowItemMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-error hover:bg-error-container/20 transition-colors text-left font-semibold min-h-[42px] cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Eliminar Partida</span>
          </button>
        </div>
      </>
    );
  };

  const getNatureBadge = () => {
    if (item.naturaleza === 'servicio_profesional') {
      return (
        <span className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 items-center gap-1.5 shrink-0">
          <GraduationCap className="w-3.5 h-3.5" />
          <span>Servicio Profesional</span>
        </span>
      );
    }
    if (item.naturaleza === 'servicio_tercerizado') {
      return (
        <span className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 items-center gap-1.5 shrink-0">
          <Truck className="w-3.5 h-3.5" />
          <span>Servicio Tercerizado</span>
        </span>
      );
    }
    if (isItemLibre) {
      return (
        <span className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 items-center gap-1.5 shrink-0">
          <FileText className="w-3.5 h-3.5" />
          <span>{hasSnapshots ? 'Desglosado' : 'Directo'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 items-center gap-1.5 shrink-0">
        <Layers className="w-3.5 h-3.5" />
        <span>Catálogo</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
      {/* Lado izquierdo: Índice, Título y Menú móvil */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <span className="text-xs sm:text-sm font-mono font-bold text-on-surface-variant px-2.5 py-1.5 rounded-xl bg-surface-container shrink-0">
          #{index + 1}
        </span>
        <input
          ref={titleInputRef}
          type="text"
          placeholder="Título del trabajo / partida..."
          value={item.descripcion}
          onChange={(e) => onUpdateItemDescription(index, e.target.value)}
          className="w-full bg-surface-container-lowest border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/30 rounded-xl px-3.5 py-2 text-sm sm:text-base font-bold text-on-surface placeholder:text-on-surface-variant/40 transition shadow-2xs min-h-[42px]"
        />

        {/* Menú móvil (3 puntos) */}
        <div className="sm:hidden relative shrink-0">
          <button
            type="button"
            onClick={() => setShowItemMenu((v) => !v)}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
            title="Más acciones para esta partida"
            aria-label="Más acciones"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {renderItemMenu()}
        </div>
      </div>

      {/* Lado derecho: Badge y Botón de acción principal único */}
      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 flex-wrap sm:flex-nowrap">
        {getNatureBadge()}

        <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
          {/* Único botón de acción primaria contextual */}
          {isParametric && onOpenParametricModal ? (
            <button
              type="button"
              onClick={() => onOpenParametricModal(index)}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 px-3 py-1.5 rounded-xl transition shadow-2xs min-h-[38px] cursor-pointer"
              title="Configurar parámetros y variables de la tarea"
            >
              <Sliders className="w-4 h-4" />
              <span>Parámetros</span>
            </button>
          ) : onOpenInSituEditor ? (
            <button
              type="button"
              onClick={() => onOpenInSituEditor(index)}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 px-3 py-1.5 rounded-xl transition shadow-2xs min-h-[38px] cursor-pointer"
              title="Componer o editar insumos y horas para esta partida"
            >
              <Edit3 className="w-4 h-4" />
              <span>{hasSnapshots ? 'Desglose' : 'Desglosar'}</span>
            </button>
          ) : onOpenMaterialPicker ? (
            <button
              type="button"
              onClick={() => onOpenMaterialPicker(index)}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 px-3 py-1.5 rounded-xl transition shadow-2xs min-h-[38px] cursor-pointer"
              title="Seleccionar y agregar materiales desde el catálogo"
            >
              <Package className="w-4 h-4" />
              <span>+ Materiales</span>
            </button>
          ) : null}

          {/* Menú de acciones en escritorio (3 puntos) */}
          <div className="hidden sm:block relative">
            <button
              type="button"
              onClick={() => setShowItemMenu((v) => !v)}
              className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
              title="Más acciones para esta partida"
              aria-label="Más acciones"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {renderItemMenu()}
          </div>
        </div>
      </div>
    </div>
  );
};
