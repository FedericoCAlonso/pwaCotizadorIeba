import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Edit2,
  Folder,
  AlertTriangle,
  BookOpen
} from 'lucide-react';
import { CapituloPresupuesto } from '../../../../core/types';
import { formatARS } from '../../../../core/calculations';
import { useHaptics } from '../../../../hooks/useHaptics';
import { useEscapeKey } from '../../../../hooks/useEscapeKey';

export interface MobileChapterActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  capitulo: CapituloPresupuesto | null;
  itemCount: number;
  totalPrecio: number;
  onStartRename: () => void;
  onOpenCatalog?: () => void;
  onRemove: () => void;
}

export const MobileChapterActionSheet: React.FC<MobileChapterActionSheetProps> = ({
  isOpen,
  onClose,
  capitulo,
  itemCount,
  totalPrecio,
  onStartRename,
  onOpenCatalog,
  onRemove
}) => {
  const haptics = useHaptics();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEscapeKey(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) {
      setIsConfirmingDelete(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setIsConfirmingDelete(false);
  }, [capitulo?.id]);

  if (!isOpen || !capitulo) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface-container rounded-t-3xl border-t border-outline-variant/30 shadow-2xl flex flex-col max-h-[85vh] overflow-y-auto pb-safe animate-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Acciones del rubro"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de arrastre superior */}
        <div className="pt-3 pb-1 shrink-0">
          <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto" />
        </div>

        {/* Cabecera con datos del rubro */}
        <div className="px-5 pt-2 pb-3 border-b border-outline-variant/20 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <div className="pt-0.5 shrink-0">
                <span className="p-1 rounded-md bg-primary-container text-on-primary-container inline-block">
                  <Folder className="w-4 h-4" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-on-surface leading-snug break-words">
                  {capitulo.nombre || 'Rubro sin nombre'}
                </h3>
                <div className="flex items-center gap-2 mt-1 font-mono text-xs text-on-surface-variant">
                  <span className="font-semibold text-on-surface">
                    {itemCount} {itemCount === 1 ? 'ítem' : 'ítems'}
                  </span>
                  <span>•</span>
                  <span className="font-bold text-primary">Total: {formatARS(totalPrecio)}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-colors cursor-pointer shrink-0"
              aria-label="Cerrar opciones del rubro"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido de acciones */}
        <div className="p-5 flex flex-col gap-3">
          {/* 1. Renombrar */}
          <button
            type="button"
            onClick={() => {
              haptics.selection();
              onStartRename();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-outline-variant/30 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-semibold cursor-pointer active:scale-98 min-h-[48px] transition-colors"
          >
            <Edit2 className="w-4 h-4 text-primary" />
            <span>Renombrar rubro</span>
          </button>

          {/* 2. Agregar Tarea Tipo desde Catálogo */}
          {onOpenCatalog && (
            <button
              type="button"
              onClick={() => {
                haptics.selection();
                onClose();
                onOpenCatalog();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-tertiary/30 bg-tertiary-container/20 hover:bg-tertiary-container/40 text-on-surface text-sm font-semibold cursor-pointer active:scale-98 min-h-[48px] transition-colors"
            >
              <BookOpen className="w-4 h-4 text-tertiary" />
              <span>+ Tarea Tipo desde Catálogo</span>
            </button>
          )}

          {/* 3. Acción Destructiva con Confirmación en 2 Pasos */}
          <div className="pt-1">
            {!isConfirmingDelete ? (
              <button
                type="button"
                onClick={() => {
                  haptics.warning();
                  setIsConfirmingDelete(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-error/30 bg-error/5 hover:bg-error/10 text-error text-sm font-semibold cursor-pointer active:scale-98 min-h-[48px] transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar rubro</span>
              </button>
            ) : (
              <div className="p-3.5 rounded-2xl border border-error/40 bg-error-container/20 flex flex-col gap-3 animate-in fade-in duration-150">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-on-surface">¿Eliminar este rubro completo?</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5 leading-tight">
                      {itemCount > 0
                        ? `Se eliminarán también los ${itemCount} ítems contenidos en él.`
                        : 'El rubro no contiene ítems.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="flex-1 py-2.5 px-3 rounded-xl border border-outline-variant/40 bg-surface text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors cursor-pointer min-h-[42px]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      haptics.warning();
                      onRemove();
                      onClose();
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-error text-on-error text-xs font-bold shadow-xs hover:bg-error/90 transition-colors cursor-pointer min-h-[42px] active:scale-98"
                  >
                    Sí, Eliminar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. Botón de Cierre de Pulgar */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-surface-container-highest hover:bg-surface-container-high text-on-surface font-semibold text-sm transition-colors cursor-pointer min-h-[48px]"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
