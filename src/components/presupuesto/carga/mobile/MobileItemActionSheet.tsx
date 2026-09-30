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
  FileSpreadsheet,
  Edit2,
  Copy,
  Layers,
  Wrench,
  Truck,
  Check
} from 'lucide-react';
import { ItemPresupuesto } from '../../../../core/types';
import { formatARS } from '../../../../core/calculations';
import { useHaptics } from '../../../../hooks/useHaptics';
import { useEscapeKey } from '../../../../hooks/useEscapeKey';
import { MobileDetailTab } from './MobileItemDetailSheet';

export interface MobileItemActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  item: ItemPresupuesto | null;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate?: () => void;
  onRename?: (newDesc: string) => void;
  onUpdateUnidad?: (newUnidad: string) => void;
  onOpenDetailTab?: (tab: MobileDetailTab) => void;
  onOpenQuickParams?: (itemId: string) => void;
  onOpenParametric?: () => void;
  onSaveAsTareaTipo?: (item: ItemPresupuesto) => void;
  onRemove: () => void;
}

const UNIDADES_RAPIDAS = ['u', 'm', 'ml', 'm²', 'boca', 'gl', 'hs', 'pto', 'tramo', 'kg'];

export const MobileItemActionSheet: React.FC<MobileItemActionSheetProps> = ({
  isOpen,
  onClose,
  item,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRename,
  onUpdateUnidad,
  onOpenDetailTab,
  onOpenQuickParams,
  onOpenParametric,
  onSaveAsTareaTipo,
  onRemove
}) => {
  const haptics = useHaptics();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  useEscapeKey(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) {
      setIsConfirmingDelete(false);
      setIsEditingTitle(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setIsConfirmingDelete(false);
    setIsEditingTitle(false);
    if (item) {
      setEditedTitle(item.descripcion || '');
    }
  }, [item?.id]);

  if (!isOpen || !item) return null;

  const costoDirectoTotal = item.costoDirectoTotal ?? item.costoTotal ?? 0;
  const precioFinalItem = item.precioFinalItem ?? item.precioVentaTotal ?? item.costoDirectoTotal ?? 0;
  const paramsCount = item.parametros?.length || 0;
  const insumosCount = item.insumosSnapshot?.length || 0;
  const moCount = item.manoObraSnapshot?.length || 0;
  const servCount = item.serviciosTercerizados?.length || 0;
  const isLinked = Boolean(item.tareaTipoId && !item.desacoplado);
  const isDecoupled = Boolean(item.tareaTipoId && item.desacoplado);
  const isParametricJob = Boolean(item.tareaTipoId || item.tareaTipoConfig);

  const handleConfirmRename = () => {
    if (editedTitle.trim() && onRename) {
      onRename(editedTitle.trim());
    }
    setIsEditingTitle(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface-container rounded-t-3xl border-t border-outline-variant/30 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto pb-safe animate-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Acciones del ítem"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de arrastre superior */}
        <div className="pt-3 pb-1 shrink-0">
          <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto" />
        </div>

        {/* Cabecera con datos del ítem */}
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
                  <span className="p-1 rounded-md bg-surface-container-highest text-on-surface-variant inline-block" title="Ítem propio">
                    <FileSpreadsheet className="w-4 h-4" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                {isEditingTitle ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirmRename();
                        if (e.key === 'Escape') setIsEditingTitle(false);
                      }}
                      className="flex-1 px-2.5 py-1 text-sm bg-surface border border-primary rounded-xl text-on-surface focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleConfirmRename}
                      className="p-1.5 rounded-xl bg-primary text-on-primary cursor-pointer active:scale-95"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-on-surface leading-snug break-words">
                      {item.descripcion || 'Sin descripción'}
                    </h3>
                    {onRename && (
                      <button
                        type="button"
                        onClick={() => {
                          haptics.selection();
                          setEditedTitle(item.descripcion || '');
                          setIsEditingTitle(true);
                        }}
                        className="p-1 text-on-surface-variant/50 hover:text-primary rounded-md shrink-0 cursor-pointer"
                        title="Cambiar nombre del ítem"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
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
        <div className="p-5 flex flex-col gap-3.5">
          {/* 1. Selector rápido de unidad de medida */}
          {onUpdateUnidad && (
            <div>
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                Unidad de medida
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {UNIDADES_RAPIDAS.map((u) => {
                  const isSelected = (item.unidad || 'u').toLowerCase() === u.toLowerCase();
                  return (
                    <button
                      key={u}
                      type="button"
                      onClick={() => {
                        haptics.tick();
                        onUpdateUnidad(u);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-primary text-on-primary font-bold shadow-xs'
                          : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
                      }`}
                    >
                      {u}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Accesos Rápidos a Despiece APU */}
          {onOpenDetailTab && (
            <div>
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                Despiece y Composición APU
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    haptics.selection();
                    onOpenDetailTab('materiales');
                    onClose();
                  }}
                  className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-2xl border border-outline-variant/30 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-medium cursor-pointer active:scale-95 transition-all"
                >
                  <Layers className="w-4 h-4 text-primary" />
                  <span>Materiales</span>
                  <span className="text-[10px] text-on-surface-variant font-mono">
                    {insumosCount} {insumosCount === 1 ? 'item' : 'items'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    haptics.selection();
                    onOpenDetailTab('mano_obra');
                    onClose();
                  }}
                  className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-2xl border border-outline-variant/30 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-medium cursor-pointer active:scale-95 transition-all"
                >
                  <Wrench className="w-4 h-4 text-secondary" />
                  <span>Mano de Obra</span>
                  <span className="text-[10px] text-on-surface-variant font-mono">
                    {moCount} {moCount === 1 ? 'item' : 'items'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    haptics.selection();
                    onOpenDetailTab('servicios');
                    onClose();
                  }}
                  className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-2xl border border-outline-variant/30 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-medium cursor-pointer active:scale-95 transition-all"
                >
                  <Truck className="w-4 h-4 text-tertiary" />
                  <span>Servicios</span>
                  <span className="text-[10px] text-on-surface-variant font-mono">
                    {servCount} {servCount === 1 ? 'item' : 'items'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* 3. Reordenamiento y Duplicación */}
          <div>
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
              Organización
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isFirst}
                onClick={() => {
                  haptics.tick();
                  onMoveUp();
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl border text-xs font-semibold transition-all min-h-[44px] ${
                  isFirst
                    ? 'opacity-40 border-outline-variant/30 text-on-surface-variant/40 bg-surface-container-low cursor-not-allowed'
                    : 'border-outline-variant/40 text-on-surface bg-surface-container-high hover:bg-surface-container-highest cursor-pointer active:scale-98'
                }`}
                aria-label="Subir ítem de posición"
              >
                <ArrowUp className="w-3.5 h-3.5 text-primary" />
                <span>Subir</span>
              </button>

              <button
                type="button"
                disabled={isLast}
                onClick={() => {
                  haptics.tick();
                  onMoveDown();
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl border text-xs font-semibold transition-all min-h-[44px] ${
                  isLast
                    ? 'opacity-40 border-outline-variant/30 text-on-surface-variant/40 bg-surface-container-low cursor-not-allowed'
                    : 'border-outline-variant/40 text-on-surface bg-surface-container-high hover:bg-surface-container-highest cursor-pointer active:scale-98'
                }`}
                aria-label="Bajar ítem de posición"
              >
                <ArrowDown className="w-3.5 h-3.5 text-primary" />
                <span>Bajar</span>
              </button>

              {onDuplicate && (
                <button
                  type="button"
                  onClick={() => {
                    haptics.selection();
                    onDuplicate();
                    onClose();
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl border border-outline-variant/40 text-on-surface bg-surface-container-high hover:bg-surface-container-highest text-xs font-semibold cursor-pointer active:scale-98 min-h-[44px] transition-all"
                  aria-label="Duplicar ítem"
                >
                  <Copy className="w-3.5 h-3.5 text-primary" />
                  <span>Duplicar</span>
                </button>
              )}
            </div>
          </div>

          {/* 4. Acciones Técnicas */}
          <div>
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
              Acciones Técnicas
            </span>
            <div className="flex flex-col gap-2">
              {(onOpenParametric || onOpenQuickParams) && (
                <button
                  type="button"
                  onClick={() => {
                    haptics.selection();
                    if (isParametricJob && onOpenParametric) {
                      onOpenParametric();
                    } else if (onOpenQuickParams) {
                      onOpenQuickParams(item.id);
                    }
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl border border-outline-variant/30 bg-surface-container-high hover:bg-surface-container-highest text-secondary text-xs font-semibold cursor-pointer active:scale-98 min-h-[44px] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
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
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl border border-outline-variant/30 bg-surface-container-high hover:bg-surface-container-highest text-tertiary text-xs font-semibold cursor-pointer active:scale-98 min-h-[44px] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <BookmarkPlus className="w-4 h-4 text-tertiary" />
                    <span>Guardar en Catálogo (Tarea Tipo)</span>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* 5. Acción Destructiva con Confirmación en 2 Pasos */}
          <div className="pt-1">
            {!isConfirmingDelete ? (
              <button
                type="button"
                onClick={() => {
                  haptics.warning();
                  setIsConfirmingDelete(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-error/30 bg-error/5 hover:bg-error/10 text-error text-xs font-semibold cursor-pointer active:scale-98 min-h-[44px] transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar ítem</span>
              </button>
            ) : (
              <div className="p-3.5 rounded-2xl border border-error/40 bg-error-container/20 flex flex-col gap-3 animate-in fade-in duration-150">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-on-surface">¿Eliminar este ítem de la cotización?</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5 leading-tight">
                      Se quitarán también sus materiales, mano de obra y servicios asociados.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="flex-1 py-2 px-3 rounded-xl border border-outline-variant/40 bg-surface text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors cursor-pointer min-h-[40px]"
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
                    className="flex-1 py-2 px-3 rounded-xl bg-error text-on-error text-xs font-bold shadow-xs hover:bg-error/90 transition-colors cursor-pointer min-h-[40px] active:scale-98"
                  >
                    Sí, Eliminar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 6. Botón de Cierre de Pulgar */}
          <div className="pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-2xl bg-surface-container-highest hover:bg-surface-container-high text-on-surface font-semibold text-xs transition-colors cursor-pointer min-h-[44px]"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
