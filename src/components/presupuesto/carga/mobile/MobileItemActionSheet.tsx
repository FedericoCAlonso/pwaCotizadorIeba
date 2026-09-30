import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowUp,
  ArrowDown,
  Trash2,
  Sliders,
  BookmarkPlus,
  AlertTriangle,
  Link2,
  Unlink2,
  FileSpreadsheet
} from 'lucide-react';
import { ItemPresupuesto } from '../../../../core/types';
import { formatARS } from '../../../../core/calculations';
import { useHaptics } from '../../../../hooks/useHaptics';
import { useEscapeKey } from '../../../../hooks/useEscapeKey';

export interface MobileItemActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  item: ItemPresupuesto | null;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onOpenQuickParams?: (itemId: string) => void;
  onSaveAsTareaTipo?: (item: ItemPresupuesto) => void;
  onRemove: () => void;
}

export const MobileItemActionSheet: React.FC<MobileItemActionSheetProps> = ({
  isOpen,
  onClose,
  item,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onOpenQuickParams,
  onSaveAsTareaTipo,
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
  }, [item?.id]);

  if (!isOpen || !item) return null;

  const costoDirectoTotal = item.costoDirectoTotal ?? item.costoTotal ?? 0;
  const precioFinalItem = item.precioFinalItem ?? item.precioVentaTotal ?? item.costoDirectoTotal ?? 0;
  const paramsCount = item.parametros?.length || 0;
  const isLinked = Boolean(item.tareaTipoId && !item.desacoplado);
  const isDecoupled = Boolean(item.tareaTipoId && item.desacoplado);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface-container rounded-t-3xl border-t border-outline-variant/30 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto pb-safe animate-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Acciones de la partida"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de arrastre superior */}
        <div className="pt-3 pb-1 shrink-0">
          <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto" />
        </div>

        {/* Cabecera con datos de la partida */}
        <div className="px-5 pt-2 pb-3 border-b border-outline-variant/20 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <div className="pt-0.5 shrink-0">
                {isLinked ? (
                  <span className="p-1 rounded-md bg-secondary/15 text-secondary inline-block" title="Catálogo">
                    <Link2 className="w-4 h-4" />
                  </span>
                ) : isDecoupled ? (
                  <span className="p-1 rounded-md bg-tertiary/15 text-tertiary inline-block" title="Desacoplado">
                    <Unlink2 className="w-4 h-4" />
                  </span>
                ) : (
                  <span className="p-1 rounded-md bg-surface-container-highest text-on-surface-variant inline-block" title="Partida propia">
                    <FileSpreadsheet className="w-4 h-4" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-on-surface leading-snug break-words">
                  {item.descripcion || 'Sin descripción'}
                </h3>
                <div className="flex items-center gap-2 mt-1 font-mono text-xs text-on-surface-variant flex-wrap">
                  <span className="font-semibold text-on-surface">
                    {item.cantidad} {item.unidad || 'u'}
                  </span>
                  <span>•</span>
                  <span>CD: {formatARS(costoDirectoTotal)}</span>
                  <span>•</span>
                  <span className="font-bold text-primary">Final: {formatARS(precioFinalItem)}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-colors cursor-pointer shrink-0"
              aria-label="Cerrar opciones"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido de acciones */}
        <div className="p-5 flex flex-col gap-3">
          {/* 1. Reordenamiento de posición */}
          <div>
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-2">
              Posición en la lista
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={isFirst}
                onClick={() => {
                  haptics.tick();
                  onMoveUp();
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-2xl border text-sm font-semibold transition-all min-h-[48px] ${
                  isFirst
                    ? 'opacity-40 border-outline-variant/30 text-on-surface-variant/40 bg-surface-container-low cursor-not-allowed'
                    : 'border-outline-variant/40 text-on-surface bg-surface-container-high hover:bg-surface-container-highest cursor-pointer active:scale-98'
                }`}
                aria-label="Subir partida de posición"
              >
                <ArrowUp className="w-4 h-4 text-primary" />
                <span>Subir</span>
              </button>

              <button
                type="button"
                disabled={isLast}
                onClick={() => {
                  haptics.tick();
                  onMoveDown();
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-2xl border text-sm font-semibold transition-all min-h-[48px] ${
                  isLast
                    ? 'opacity-40 border-outline-variant/30 text-on-surface-variant/40 bg-surface-container-low cursor-not-allowed'
                    : 'border-outline-variant/40 text-on-surface bg-surface-container-high hover:bg-surface-container-highest cursor-pointer active:scale-98'
                }`}
                aria-label="Bajar partida de posición"
              >
                <ArrowDown className="w-4 h-4 text-primary" />
                <span>Bajar</span>
              </button>
            </div>
          </div>

          {/* 2. Acciones Técnicas */}
          <div>
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-2">
              Acciones Técnicas
            </span>
            <div className="flex flex-col gap-2">
              {onOpenQuickParams && (
                <button
                  type="button"
                  onClick={() => {
                    haptics.selection();
                    onOpenQuickParams(item.id);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-outline-variant/30 bg-surface-container-high hover:bg-surface-container-highest text-secondary text-sm font-semibold cursor-pointer active:scale-98 min-h-[48px] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Sliders className="w-4 h-4 text-secondary" />
                    <span>Configurar Parámetros</span>
                  </div>
                  {paramsCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-mono font-bold">
                      {paramsCount} p
                    </span>
                  )}
                </button>
              )}

              {onSaveAsTareaTipo && (
                <button
                  type="button"
                  onClick={() => {
                    haptics.selection();
                    onSaveAsTareaTipo(item);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-outline-variant/30 bg-surface-container-high hover:bg-surface-container-highest text-tertiary text-sm font-semibold cursor-pointer active:scale-98 min-h-[48px] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <BookmarkPlus className="w-4 h-4 text-tertiary" />
                    <span>Guardar en Catálogo (Tarea Tipo)</span>
                  </div>
                </button>
              )}
            </div>
          </div>

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
                <span>Eliminar partida</span>
              </button>
            ) : (
              <div className="p-3.5 rounded-2xl border border-error/40 bg-error-container/20 flex flex-col gap-3 animate-in fade-in duration-150">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-on-surface">¿Eliminar esta partida de la cotización?</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5 leading-tight">
                      Se quitarán también sus materiales, mano de obra y servicios asociados.
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

          {/* 4. Botón de Cierre de Pulgar */}
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
