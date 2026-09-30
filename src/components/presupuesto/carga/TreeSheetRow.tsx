import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Link2,
  Unlink2,
  FileSpreadsheet,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Trash2,
  Sliders,
  BookmarkPlus,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import {
  ItemPresupuesto,
  Insumo,
  CategoriaManoDeObra,
  ParametroItem
} from '../../../core/types';
import { EditingCellState } from '../../../viewmodels/useTreeSheetViewModel';
import { formatARS, safeNum } from '../../../core/calculations';
import { evaluateMathExpression } from '../../../core/mathEvaluator';
import { TreeSheetItemBreakdown } from './TreeSheetItemBreakdown';

interface TreeSheetRowProps {
  item: ItemPresupuesto;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  editingCell: EditingCellState | null;
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
  onSelect: () => void;
  onStartEditCell: (field: 'descripcion' | 'cantidad') => void;
  onUpdateEditingCellValue: (value: string) => void;
  onCommitEditCell: (field: 'descripcion' | 'cantidad') => void;
  onCancelEditCell: () => void;
  onNavigateCell?: (direction: 'next' | 'prev', fromField: 'descripcion' | 'cantidad') => void;
  onOpenQuickParamModal?: (itemId: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onSaveAsTareaTipo?: () => void;
  onOpenParametric?: () => void;
  onUpdateNotas?: (notas: string, exclusiones?: string) => void;
  onAddMaterial: (material: Insumo, cantidad: number, formula?: string) => void;
  onRemoveMaterial: (index: number) => void;
  onUpdateMaterialFormula: (index: number, formula: string) => void;
  onOpenMaterialCatalog: () => void;
  onAddLabor: (categoriaId: string, horas: number, formula?: string) => void;
  onRemoveLabor: (index: number) => void;
  onUpdateLaborFormula: (index: number, formula: string) => void;
  onAddService: (descripcion: string, costo: number) => void;
  onRemoveService: (index: number) => void;
  onUpdateParametros?: (parametros: ParametroItem[]) => void;
  calculosVariables?: Record<string, number | string>;
}

export const TreeSheetRow: React.FC<TreeSheetRowProps> = ({
  item,
  isSelected,
  isExpanded,
  onToggleExpand,
  editingCell,
  insumosMap,
  manoObraMap,
  onSelect,
  onStartEditCell,
  onUpdateEditingCellValue,
  onCommitEditCell,
  onCancelEditCell,
  onNavigateCell,
  onOpenQuickParamModal,
  onMoveUp,
  onMoveDown,
  onRemove,
  onSaveAsTareaTipo,
  onOpenParametric,
  onUpdateNotas,
  onAddMaterial,
  onRemoveMaterial,
  onUpdateMaterialFormula,
  onOpenMaterialCatalog,
  onAddLabor,
  onRemoveLabor,
  onUpdateLaborFormula,
  onAddService,
  onRemoveService,
  onUpdateParametros,
  calculosVariables
}) => {
  const [overrideTab, setOverrideTab] = useState<'materiales' | 'mano_obra' | 'servicios' | 'parametros' | 'notas' | undefined>(undefined);
  const isEditingDesc = editingCell?.itemId === item.id && editingCell.field === 'descripcion';
  const isEditingQty = editingCell?.itemId === item.id && editingCell.field === 'cantidad';

  const descInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Previsualización evaluada en vivo cuando se edita una fórmula que inicia con '='
  const liveEvaluatedQty = useMemo(() => {
    if (!isEditingQty || !editingCell?.value?.trim().startsWith('=')) return null;
    try {
      const scope: Record<string, number> = {};
      if (calculosVariables) {
        for (const [k, v] of Object.entries(calculosVariables)) {
          scope[k] = typeof v === 'number' ? v : Number(v) || 0;
        }
      }
      if (item.parametros) {
        for (const p of item.parametros) {
          scope[p.id] = p.valor;
        }
      }
      const evalRes = evaluateMathExpression(editingCell.value, scope);
      if (evalRes && evalRes.isValid && typeof evalRes.value === 'number' && !isNaN(evalRes.value)) {
        return Math.round(evalRes.value * 100) / 100;
      }
      return null;
    } catch {
      return null;
    }
  }, [isEditingQty, editingCell?.value, calculosVariables, item.parametros]);

  useEffect(() => {
    if (isEditingDesc && descInputRef.current) {
      descInputRef.current.focus();
      descInputRef.current.select();
    }
  }, [isEditingDesc]);

  useEffect(() => {
    if (isEditingQty && qtyInputRef.current) {
      qtyInputRef.current.focus();
      qtyInputRef.current.select();
    }
  }, [isEditingQty]);

  // Cálculos deterministas por partida
  const cant = safeNum(item.cantidad) > 0 ? safeNum(item.cantidad) : 1;
  const costoDirectoTotal = item.costoDirectoTotal ?? item.costoTotal ?? 0;
  const costoUnitario = item.costoUnitario !== undefined && safeNum(item.costoUnitario) > 0
    ? item.costoUnitario
    : (costoDirectoTotal / cant);
  const precioFinalItem = item.precioFinalItem ?? item.precioVentaTotal ?? item.costoDirectoTotal ?? 0;
  const precioVentaUnitario = item.precioVentaUnitario !== undefined && safeNum(item.precioVentaUnitario) > 0
    ? item.precioVentaUnitario
    : (precioFinalItem / cant);

  // Distintivo de procedencia
  const isLinked = Boolean(item.tareaTipoId && !item.desacoplado);
  const isDecoupled = Boolean(item.tareaTipoId && item.desacoplado);
  const hasFormulaErrors = Boolean(item.erroresFormulas && Object.keys(item.erroresFormulas).length > 0);
  const isParametricJob = Boolean(
    (item.tareaTipoId || item.tareaTipoConfig) &&
    !item.desacoplado &&
    (
      (item.tareaTipoConfig?.parametros && item.tareaTipoConfig.parametros.length > 0) ||
      (item.valoresParametros && Object.keys(item.valoresParametros).length > 0) ||
      Boolean(item.formulaHonorarios) ||
      Boolean(item.tareaTipoId)
    )
  );
  const isParametric = Boolean(
    isParametricJob ||
    (item.parametros && item.parametros.length > 0) ||
    item.formulaHonorarios
  );

  const handleOpenParams = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isParametricJob && onOpenParametric) {
      onOpenParametric();
    } else if (onOpenQuickParamModal) {
      onOpenQuickParamModal(item.id);
    } else {
      if (!isExpanded) {
        onToggleExpand();
      }
      setOverrideTab('parametros');
    }
  };

  const insumosCount = item.insumosSnapshot?.length || 0;
  const moCount = item.manoObraSnapshot?.length || 0;
  const servCount = item.serviciosTercerizados?.length || 0;
  const totalComponentes = insumosCount + moCount + servCount;

  return (
    <div className="flex flex-col border-b border-outline-variant/15">
      {/* ─── Fila Principal de Partida ─── */}
      <div
        role="row"
        aria-selected={isSelected}
        onClick={onSelect}
        className={`group flex items-center justify-between px-3 py-1.5 text-sm transition-colors select-none cursor-pointer ${
          isSelected
            ? 'bg-surface-container-highest/80 border-l-4 border-l-primary'
            : 'bg-surface hover:bg-surface-container-low'
        }`}
      >
        {/* ─── Columna 1: Descripción con botón expandir ─── */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2 pl-2">
          {/* Botón para expandir/plegar rubros hijos */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-1 -ml-1 text-on-surface-variant hover:text-primary rounded-lg transition-colors cursor-pointer"
            title={isExpanded ? 'Plegar rubros hijos' : 'Desplegar rubros (Materiales, Mano de Obra, Servicios, Notas)'}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-primary" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
            )}
          </button>

          {/* Indicador de vinculación o error */}
          {hasFormulaErrors ? (
            <span title="Hay errores en las fórmulas de este ítem">
              <AlertCircle className="w-3.5 h-3.5 text-error shrink-0" />
            </span>
          ) : isLinked ? (
            <span title="Vinculado a tarea tipo del catálogo">
              <Link2 className="w-3.5 h-3.5 text-secondary shrink-0 opacity-70" />
            </span>
          ) : isDecoupled ? (
            <span title="Desacoplado de la tarea tipo">
              <Unlink2 className="w-3.5 h-3.5 text-tertiary shrink-0 opacity-70" />
            </span>
          ) : (
            <span title="Ítem propio">
              <FileSpreadsheet className="w-3.5 h-3.5 text-outline shrink-0 opacity-40" />
            </span>
          )}

          {isEditingDesc ? (
            <input
              ref={descInputRef}
              type="text"
              value={editingCell?.value ?? ''}
              onChange={(e) => onUpdateEditingCellValue(e.target.value)}
              onBlur={() => onCommitEditCell('descripcion')}
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                  e.preventDefault();
                  if (onNavigateCell) {
                    onNavigateCell(e.shiftKey ? 'prev' : 'next', 'descripcion');
                  } else {
                    onCommitEditCell('descripcion');
                  }
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (onNavigateCell) {
                    onNavigateCell('next', 'descripcion');
                  } else {
                    onCommitEditCell('descripcion');
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancelEditCell();
                }
              }}
              className="w-full px-2 py-0.5 text-sm bg-surface border border-primary rounded text-on-surface focus:outline-none"
            />
          ) : (
            <div
              onDoubleClick={(e) => {
                e.stopPropagation();
                onStartEditCell('descripcion');
              }}
              className="truncate text-on-surface flex items-center gap-1.5"
              title="Doble clic para editar descripción"
            >
              <span className="truncate font-medium">{item.descripcion}</span>
              {totalComponentes > 0 && !isExpanded && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand();
                  }}
                  className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-container-high text-on-surface-variant font-mono shrink-0 hover:bg-primary-container hover:text-on-primary-container transition-colors"
                  title="Clic para ver componentes"
                >
                  {totalComponentes} {totalComponentes === 1 ? 'componente' : 'componentes'}
                </span>
              )}
              {item.parametros && item.parametros.length > 0 && (
                <button
                  type="button"
                  onClick={handleOpenParams}
                  className="text-[10px] px-1.5 py-0.2 rounded bg-secondary-container/40 text-secondary hover:bg-secondary-container hover:text-on-secondary-container font-mono shrink-0 cursor-pointer transition-colors"
                  title="Clic para configurar parámetros del ítem"
                >
                  {item.parametros.length} p
                </button>
              )}
            </div>
          )}
        </div>

        {/* ─── Columna 2: Cantidad y Fórmulas ─── */}
        <div className="relative w-24 sm:w-28 md:w-32 shrink-0 px-2 text-right">
          {isEditingQty ? (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 z-30 flex items-center gap-1.5 p-1 bg-surface border border-primary rounded-xl shadow-lg min-w-[200px] sm:min-w-[280px] md:min-w-[340px]">
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                editingCell?.value?.startsWith('=') ? 'bg-secondary/20 text-secondary' : 'text-on-surface-variant'
              }`}>
                fx
              </span>
              <input
                ref={qtyInputRef}
                type="text"
                value={editingCell?.value ?? ''}
                onChange={(e) => onUpdateEditingCellValue(e.target.value)}
                onBlur={() => onCommitEditCell('cantidad')}
                onKeyDown={(e) => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    if (onNavigateCell) {
                      onNavigateCell(e.shiftKey ? 'prev' : 'next', 'cantidad');
                    } else {
                      onCommitEditCell('cantidad');
                    }
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (onNavigateCell) {
                      onNavigateCell('next', 'cantidad');
                    } else {
                      onCommitEditCell('cantidad');
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    onCancelEditCell();
                  }
                }}
                placeholder="10 o =superficie * 2"
                className="flex-1 px-2 py-1 text-xs font-mono bg-surface border border-outline-variant/40 rounded-lg text-on-surface focus:outline-none focus:border-primary"
              />
              {liveEvaluatedQty !== null && (
                <span
                  className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-primary-container text-on-primary-container shrink-0"
                  title="Resultado estimado en vivo"
                >
                  ≈ {liveEvaluatedQty} {item.unidad || 'u'}
                </span>
              )}
            </div>
          ) : (
            <div
              onDoubleClick={(e) => {
                e.stopPropagation();
                onStartEditCell('cantidad');
              }}
              className="truncate font-mono text-xs text-on-surface hover:text-primary transition-colors cursor-text flex items-center justify-end gap-1"
              title="Doble clic para editar cantidad o fórmula"
            >
              {item.formulaCantidad ? (
                <span className="flex items-center gap-1 text-secondary font-semibold" title={`Fórmula: ${item.formulaCantidad}`}>
                  <span className="text-[10px] px-1 py-0.2 rounded bg-secondary/15 text-secondary">fx</span>
                  <span>{item.cantidad} {item.unidad || 'u'}</span>
                </span>
              ) : (
                <span>
                  {item.cantidad} {item.unidad || 'u'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ─── Columna 3: Costo Directo Unitario ─── */}
        <div className="hidden sm:block w-24 sm:w-28 shrink-0 px-2 text-right font-mono text-xs text-on-surface-variant">
          <span title="Costo directo por unidad">
            {formatARS(costoUnitario)}
          </span>
        </div>

        {/* ─── Columna 4: Costo Directo Total ─── */}
        <div className="w-28 sm:w-32 shrink-0 px-2 text-right font-mono text-xs font-medium text-on-surface">
          <span title="Costo directo total de materiales, mano de obra y servicios">
            {formatARS(costoDirectoTotal)}
          </span>
        </div>

        {/* ─── Columna 5: Precio Unitario Final ─── */}
        <div className="hidden md:block w-24 sm:w-28 shrink-0 px-2 text-right font-mono text-xs text-primary/80 font-medium">
          <span title="Precio de venta unitario final (con gastos indirectos, margen e impuestos)">
            {formatARS(precioVentaUnitario)}
          </span>
        </div>

        {/* ─── Columna 6: Precio Final Total ─── */}
        <div className="w-28 sm:w-36 shrink-0 px-2 text-right font-mono text-xs sm:text-sm font-bold text-primary">
          <span title="Precio final de venta total del ítem">
            {formatARS(precioFinalItem)}
          </span>
        </div>

        {/* ─── Acciones Rápidas (visibles en hover o al seleccionar) ─── */}
        <div className="flex items-center gap-1 w-20 sm:w-24 justify-end shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title="Mover arriba"
          >
            <ArrowUp className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title="Mover abajo"
          >
            <ArrowDown className="w-3 h-3" />
          </button>

          {/* Configurar parámetros y variables (disponible para todos los ítems) */}
          <button
            type="button"
            onClick={handleOpenParams}
            className={`p-1 rounded transition-colors cursor-pointer ${
              (item.parametros && item.parametros.length > 0) || isParametric
                ? 'text-primary hover:bg-primary-container/40'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
            title="Configurar parámetros y variables del ítem"
          >
            <Sliders className="w-3 h-3" />
          </button>

          {onSaveAsTareaTipo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSaveAsTareaTipo();
              }}
              className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-secondary transition-colors cursor-pointer"
              title="Guardar como Tarea Tipo en Catálogo"
            >
              <BookmarkPlus className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 rounded hover:bg-error-container text-on-surface-variant hover:text-error transition-colors cursor-pointer"
            title="Eliminar ítem"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ─── Lista Hija Desplegada de Rubros (Materiales, Mano de Obra, Servicios, Parámetros, Notas) ─── */}
      {isExpanded && (
        <TreeSheetItemBreakdown
          item={item}
          insumosMap={insumosMap}
          manoObraMap={manoObraMap}
          calculosVariables={calculosVariables}
          initialTab={overrideTab}
          onAddMaterial={onAddMaterial}
          onRemoveMaterial={onRemoveMaterial}
          onUpdateMaterialFormula={onUpdateMaterialFormula}
          onOpenMaterialCatalog={onOpenMaterialCatalog}
          onAddLabor={onAddLabor}
          onRemoveLabor={onRemoveLabor}
          onUpdateLaborFormula={onUpdateLaborFormula}
          onAddService={onAddService}
          onRemoveService={onRemoveService}
          onUpdateNotasTecnicas={onUpdateNotas}
          onUpdateParametros={onUpdateParametros}
        />
      )}
    </div>
  );
};
