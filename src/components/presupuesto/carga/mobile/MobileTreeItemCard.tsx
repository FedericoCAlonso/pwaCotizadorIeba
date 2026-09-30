import React, { useRef, useEffect } from 'react';
import {
  Link2,
  Unlink2,
  FileSpreadsheet,
  AlertCircle,
  MoreVertical,
  Sliders,
  ChevronRight,
  Plus,
  Minus,
  Layers
} from 'lucide-react';
import { ItemPresupuesto, Insumo, CategoriaManoDeObra, ParametroItem } from '../../../../core/types';
import { formatARS } from '../../../../core/calculations';
import { useHaptics } from '../../../../hooks/useHaptics';

export interface MobileTreeItemCardProps {
  item: ItemPresupuesto;
  isSelected: boolean;
  onSelect: () => void;
  onOpenQuantitySheet: () => void;
  onQuickStepQty: (delta: number) => void;
  onOpenQuickParamModal?: (itemId: string) => void;
  onOpenParametric?: () => void;
  onOpenDetail: () => void;
  onOpenActions: () => void;
  // Optional / backwards compatibility
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
  onSaveAsTareaTipo?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  insumosMap?: Map<string, Insumo>;
  manoObraMap?: Map<string, CategoriaManoDeObra>;
  calculosVariables?: Record<string, number | string>;
  onAddMaterial?: (material: Insumo, cantidad: number, formula?: string) => void;
  onRemoveMaterial?: (index: number) => void;
  onUpdateMaterialFormula?: (index: number, formula: string) => void;
  onOpenMaterialCatalog?: () => void;
  onAddLabor?: (categoriaId: string, horas: number, formula?: string) => void;
  onRemoveLabor?: (index: number) => void;
  onUpdateLaborFormula?: (index: number, formula: string) => void;
  onAddService?: (descripcion: string, costo: number) => void;
  onRemoveService?: (index: number) => void;
  onUpdateNotas?: (notas: string, exclusiones?: string) => void;
  onUpdateParametros?: (parametros: ParametroItem[]) => void;
}

export const MobileTreeItemCard: React.FC<MobileTreeItemCardProps> = ({
  item,
  isSelected,
  onSelect,
  onOpenQuantitySheet,
  onQuickStepQty,
  onOpenQuickParamModal,
  onOpenParametric,
  onOpenDetail,
  onOpenActions
}) => {
  const haptics = useHaptics();
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handleTouchStart = () => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      haptics.tickStrong();
      onOpenActions();
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

  const handleClick = () => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    onSelect();
  };

  // Cálculos deterministas
  const costoDirectoTotal = item.costoDirectoTotal ?? item.costoTotal ?? 0;
  const precioFinalItem = item.precioFinalItem ?? item.precioVentaTotal ?? item.costoDirectoTotal ?? 0;

  // Estado de vinculación
  const isLinked = Boolean(item.tareaTipoId && !item.desacoplado);
  const isDecoupled = Boolean(item.tareaTipoId && item.desacoplado);
  const hasFormulaErrors = Boolean(item.erroresFormulas && Object.keys(item.erroresFormulas).length > 0);
  const isParametricJob = Boolean(item.tareaTipoId || item.tareaTipoConfig);

  const insumosCount = item.insumosSnapshot?.length || 0;
  const moCount = item.manoObraSnapshot?.length || 0;
  const servCount = item.serviciosTercerizados?.length || 0;
  const paramsCount = item.parametros?.length || 0;
  const totalComponentes = insumosCount + moCount + servCount;

  return (
    <div
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchCancel={handleTouchEnd}
      className={`rounded-2xl border transition-all mb-2.5 overflow-hidden select-none ${
        isSelected
          ? 'bg-surface-container-high/90 border-primary shadow-xs ring-1 ring-primary/40'
          : 'bg-surface border-outline-variant/30 hover:border-outline-variant/60 shadow-2xs'
      }`}
    >
      {/* ─── Fila 1: Cabecera con Chip, Título y Botón de Acciones ─── */}
      <div className="p-3 pb-2 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {/* Indicador de procedencia */}
          <div className="pt-0.5 shrink-0">
            {hasFormulaErrors ? (
              <span className="p-1 rounded-md bg-error/10 text-error inline-block" title="Error en fórmulas">
                <AlertCircle className="w-3.5 h-3.5" />
              </span>
            ) : isLinked ? (
              <span className="p-1 rounded-md bg-secondary/15 text-secondary inline-block" title="Catálogo">
                <Link2 className="w-3.5 h-3.5" />
              </span>
            ) : isDecoupled ? (
              <span className="p-1 rounded-md bg-tertiary/15 text-tertiary inline-block" title="Desacoplado">
                <Unlink2 className="w-3.5 h-3.5" />
              </span>
            ) : (
              <span className="p-1 rounded-md bg-surface-container-highest text-on-surface-variant/70 inline-block" title="Ítem propio">
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </span>
            )}
          </div>

          {/* Título de la partida / ítem */}
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-on-surface leading-tight break-words">
              {item.descripcion || 'Sin descripción'}
            </h4>

            {/* Badges de componentes y parámetros */}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {totalComponentes > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-container-highest text-on-surface-variant font-mono">
                  {totalComponentes} {totalComponentes === 1 ? 'componente' : 'componentes'}
                </span>
              )}
              {paramsCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    haptics.selection();
                    if (isParametricJob && onOpenParametric) {
                      onOpenParametric();
                    } else if (onOpenQuickParamModal) {
                      onOpenQuickParamModal(item.id);
                    }
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary-container text-on-primary-container font-mono cursor-pointer active:scale-95"
                >
                  <Sliders className="w-2.5 h-2.5" />
                  <span>{paramsCount} p</span>
                </button>
              )}
              {item.formulaCantidad && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary/15 text-secondary font-mono">
                  fx
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Botón de Acciones (Touch Target 44x44px garantizado para pulgar) */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              haptics.selection();
              onOpenActions();
            }}
            className="w-11 h-11 -mr-1 -mt-1 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
            aria-label="Acciones del ítem"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ─── Fila 2: Stepper de Cantidad + Precios ─── */}
      <div className="px-3 py-2 bg-surface-container-low flex items-center justify-between gap-3 border-t border-outline-variant/15">
        {/* Stepper Rápido de Cantidad */}
        <div className="flex items-center rounded-xl bg-surface border border-outline-variant/30 shadow-2xs overflow-hidden shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              haptics.tick();
              onQuickStepQty(-1);
            }}
            className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer active:scale-95"
            aria-label="Restar 1 unidad"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              haptics.selection();
              onOpenQuantitySheet();
            }}
            className="px-3 h-10 flex items-center gap-1 font-mono text-xs font-bold text-on-surface hover:text-primary transition-colors cursor-pointer border-x border-outline-variant/20"
            title="Tocar para editar cantidad con keypad"
          >
            <span>{item.cantidad}</span>
            <span className="text-[11px] text-on-surface-variant font-medium">
              {item.unidad || 'u'}
            </span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              haptics.tick();
              onQuickStepQty(+1);
            }}
            className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer active:scale-95"
            aria-label="Sumar 1 unidad"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bloque de Precios: Final y Directo */}
        <div className="text-right min-w-0">
          <div className="font-mono font-extrabold text-sm sm:text-base text-primary tracking-tight leading-none truncate">
            {formatARS(precioFinalItem)}
          </div>
          <div className="text-[11px] font-mono text-on-surface-variant/80 mt-0.5 truncate">
            CD: {formatARS(costoDirectoTotal)}
          </div>
        </div>
      </div>

      {/* ─── Fila 3: Botón Ergonómico de Detalle y Despiece ─── */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          haptics.selection();
          onOpenDetail();
        }}
        className="w-full px-3 py-2.5 bg-surface hover:bg-surface-container-low border-t border-outline-variant/15 flex items-center justify-between text-xs text-on-surface-variant cursor-pointer transition-colors active:bg-surface-container"
        aria-label={`Ver desglose y despiece de ${item.descripcion}`}
      >
        <div className="flex items-center gap-2 font-medium text-primary">
          <Layers className="w-4 h-4 text-primary" />
          <span>Detalle y Despiece {totalComponentes > 0 ? `(${totalComponentes} comp.)` : ''}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-primary shrink-0" />
      </button>
    </div>
  );
};
