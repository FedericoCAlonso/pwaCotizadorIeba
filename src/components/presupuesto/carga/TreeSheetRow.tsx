import React, { useRef, useEffect } from 'react';
import {
  Link2,
  Unlink2,
  FileSpreadsheet,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Trash2,
  PanelRightOpen,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import {
  ItemPresupuesto,
  Insumo,
  CategoriaManoDeObra
} from '../../../core/types';
import { TotalViewMode, EditingCellState } from '../../../viewmodels/useTreeSheetViewModel';
import { formatARS } from '../../../core/calculations';
import { TreeSheetItemBreakdown } from './TreeSheetItemBreakdown';

interface TreeSheetRowProps {
  item: ItemPresupuesto;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  editingCell: EditingCellState | null;
  totalViewMode: TotalViewMode;
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
  onSelect: () => void;
  onStartEditCell: (field: 'descripcion' | 'cantidad') => void;
  onUpdateEditingCellValue: (value: string) => void;
  onCommitEditCell: (field: 'descripcion' | 'cantidad') => void;
  onCancelEditCell: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onOpenDetail: () => void;
  onAddMaterial: (material: Insumo, cantidad: number, formula?: string) => void;
  onRemoveMaterial: (index: number) => void;
  onUpdateMaterialFormula: (index: number, formula: string) => void;
  onOpenMaterialCatalog: () => void;
  onAddLabor: (categoriaId: string, horas: number, formula?: string) => void;
  onRemoveLabor: (index: number) => void;
  onUpdateLaborFormula: (index: number, formula: string) => void;
  onAddService: (descripcion: string, costo: number) => void;
  onRemoveService: (index: number) => void;
}

export const TreeSheetRow: React.FC<TreeSheetRowProps> = ({
  item,
  isSelected,
  isExpanded,
  onToggleExpand,
  editingCell,
  totalViewMode,
  insumosMap,
  manoObraMap,
  onSelect,
  onStartEditCell,
  onUpdateEditingCellValue,
  onCommitEditCell,
  onCancelEditCell,
  onMoveUp,
  onMoveDown,
  onRemove,
  onOpenDetail,
  onAddMaterial,
  onRemoveMaterial,
  onUpdateMaterialFormula,
  onOpenMaterialCatalog,
  onAddLabor,
  onRemoveLabor,
  onUpdateLaborFormula,
  onAddService,
  onRemoveService
}) => {
  const isEditingDesc = editingCell?.itemId === item.id && editingCell.field === 'descripcion';
  const isEditingQty = editingCell?.itemId === item.id && editingCell.field === 'cantidad';

  const descInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

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

  // Total a mostrar según el modo activo
  const totalAmount =
    totalViewMode === 'costo'
      ? item.costoDirectoTotal || 0
      : (item.precioFinalItem ?? item.precioVentaTotal ?? item.costoDirectoTotal ?? 0);

  // Distintivo de procedencia
  const isLinked = Boolean(item.tareaTipoId && !item.desacoplado);
  const isDecoupled = Boolean(item.tareaTipoId && item.desacoplado);
  const hasFormulaErrors = Boolean(item.erroresFormulas && Object.keys(item.erroresFormulas).length > 0);

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
            title={isExpanded ? 'Plegar rubros hijos' : 'Desplegar rubros (Materiales, Mano de Obra, Servicios)'}
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
            <span title="Partida propia">
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
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onCommitEditCell('descripcion');
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
              <span className="truncate">{item.descripcion}</span>
              {totalComponentes > 0 && !isExpanded && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand();
                  }}
                  className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-container-high text-on-surface-variant font-mono shrink-0 hover:bg-primary-container hover:text-on-primary-container transition-colors"
                  title="Clic para ver componentes"
                >
                  {totalComponentes} {totalComponentes === 1 ? 'rubro' : 'rubros'}
                </span>
              )}
              {item.parametros && item.parametros.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant shrink-0">
                  {item.parametros.length} p
                </span>
              )}
            </div>
          )}
        </div>

        {/* ─── Columna 2: Cantidad ─── */}
        <div className="w-28 shrink-0 px-2 text-right">
          {isEditingQty ? (
            <input
              ref={qtyInputRef}
              type="text"
              value={editingCell?.value ?? ''}
              onChange={(e) => onUpdateEditingCellValue(e.target.value)}
              onBlur={() => onCommitEditCell('cantidad')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onCommitEditCell('cantidad');
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancelEditCell();
                }
              }}
              className="w-full px-2 py-0.5 text-xs font-mono text-right bg-surface border border-primary rounded text-on-surface focus:outline-none"
            />
          ) : (
            <div
              onDoubleClick={(e) => {
                e.stopPropagation();
                onStartEditCell('cantidad');
              }}
              className="truncate font-mono text-xs text-on-surface hover:text-primary transition-colors cursor-text"
              title="Doble clic para editar cantidad o fórmula"
            >
              {item.formulaCantidad ? (
                <span className="text-secondary font-semibold" title={item.formulaCantidad}>
                  {item.cantidad} {item.unidad || 'u'}
                </span>
              ) : (
                <span>
                  {item.cantidad} {item.unidad || 'u'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ─── Columna 3: Total ─── */}
        <div className="w-32 shrink-0 px-2 text-right">
          <span
            className={`font-mono font-medium text-xs ${
              totalViewMode === 'costo' ? 'text-on-surface' : 'text-secondary font-semibold'
            }`}
          >
            {formatARS(totalAmount)}
          </span>
        </div>

        {/* ─── Acciones Rápidas (visibles en hover o al seleccionar) ─── */}
        <div className="flex items-center gap-1 w-24 justify-end shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
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

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail();
            }}
            className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            title="Abrir inspector de la partida"
          >
            <PanelRightOpen className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 rounded hover:bg-error-container text-on-surface-variant hover:text-error transition-colors cursor-pointer"
            title="Eliminar partida"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ─── Lista Hija Desplegada de Rubros (Materiales, Mano de Obra, Servicios) ─── */}
      {isExpanded && (
        <TreeSheetItemBreakdown
          item={item}
          insumosMap={insumosMap}
          manoObraMap={manoObraMap}
          onAddMaterial={onAddMaterial}
          onRemoveMaterial={onRemoveMaterial}
          onUpdateMaterialFormula={onUpdateMaterialFormula}
          onOpenMaterialCatalog={onOpenMaterialCatalog}
          onAddLabor={onAddLabor}
          onRemoveLabor={onRemoveLabor}
          onUpdateLaborFormula={onUpdateLaborFormula}
          onAddService={onAddService}
          onRemoveService={onRemoveService}
        />
      )}
    </div>
  );
};
