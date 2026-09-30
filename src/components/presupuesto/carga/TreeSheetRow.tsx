import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Link2,
  Unlink2,
  FileSpreadsheet,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Edit2,
  Check,
  X
} from 'lucide-react';
import {
  ItemPresupuesto,
  Insumo,
  CategoriaManoDeObra,
  ParametroItem
} from '../../../core/types';
import { EditingCellState } from '../../../viewmodels/useTreeSheetViewModel';
import { formatARS, safeNum } from '../../../core/calculations';
import { TreeSheetItemBreakdown } from './TreeSheetItemBreakdown';
import { ItemQuantityCell } from './ItemQuantityCell';
import { ItemRowActions } from './ItemRowActions';

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
  onCommitEditCell: (field: 'descripcion' | 'cantidad', finalValue?: string) => void;
  onCancelEditCell: () => void;
  onNavigateCell?: (direction: 'next' | 'prev', fromField: 'descripcion' | 'cantidad') => void;
  onOpenQuickParamModal?: (itemId: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onDuplicate?: () => void;
  onUpdateItemUnidad?: (nuevaUnidad: string) => void;
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
  onDuplicate,
  onUpdateItemUnidad,
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

  useEffect(() => {
    if (isEditingDesc && descInputRef.current) {
      descInputRef.current.focus();
      descInputRef.current.select();
    }
  }, [isEditingDesc]);

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

  const handleOpenBreakdownTab = (tab: 'materiales' | 'mano_obra' | 'servicios') => {
    setOverrideTab(tab);
    if (!isExpanded) {
      onToggleExpand();
    }
  };

  const insumosCount = item.insumosSnapshot?.length || 0;
  const moCount = item.manoObraSnapshot?.length || 0;
  const servCount = item.serviciosTercerizados?.length || 0;
  const totalComponentes = insumosCount + moCount + servCount;
  const hasParams = Boolean(item.parametros && item.parametros.length > 0);

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
        {/* ─── Columna 1: Descripción con expandir, badges y botón lápiz ─── */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2 pl-2">
          {/* Botón para expandir/plegar rubros hijos */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-1 -ml-1 text-on-surface-variant hover:text-primary rounded-lg transition-colors cursor-pointer"
            title={isExpanded ? 'Plegar despiece' : 'Desplegar despiece (Materiales, Mano de Obra, Servicios, Notas)'}
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
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 min-w-0 flex-1 py-0.5"
            >
              <input
                ref={descInputRef}
                type="text"
                value={editingCell?.value ?? ''}
                onChange={(e) => onUpdateEditingCellValue(e.target.value)}
                onBlur={(e) => onCommitEditCell('descripcion', e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    onCommitEditCell('descripcion', e.currentTarget.value);
                    if (onNavigateCell) {
                      onNavigateCell(e.shiftKey ? 'prev' : 'next', 'descripcion');
                    }
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    onCommitEditCell('descripcion', e.currentTarget.value);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    onCancelEditCell();
                  }
                }}
                className="flex-1 px-2 py-1 text-sm bg-surface border border-primary rounded-lg text-on-surface focus:outline-none shadow-2xs"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCommitEditCell('descripcion', editingCell?.value);
                }}
                className="p-1 rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors cursor-pointer shrink-0"
                title="Guardar nombre del ítem"
                aria-label="Guardar nombre"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelEditCell();
                }}
                className="p-1 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer shrink-0"
                title="Cancelar edición"
                aria-label="Cancelar edición"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <div
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onStartEditCell('descripcion');
                }}
                className="truncate text-on-surface font-medium hover:text-primary transition-colors cursor-text"
                title="Doble clic o clic en el lápiz para editar descripción"
              >
                {item.descripcion}
              </div>

              {/* Botón de lápiz visible para editar nombre con un solo clic */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartEditCell('descripcion');
                }}
                className="p-0.5 rounded text-on-surface-variant/40 hover:text-primary hover:bg-surface-container-high transition-colors cursor-pointer shrink-0"
                title="Editar descripción del ítem"
                aria-label="Editar descripción"
              >
                <Edit2 className="w-3 h-3" />
              </button>

              {/* Botón para asignar despiece si no tiene componentes */}
              {totalComponentes === 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenBreakdownTab('materiales');
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.2 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-on-primary transition-all shrink-0 cursor-pointer"
                  title="Asignar materiales, mano de obra o servicios a este ítem"
                >
                  <span>+ Despiece</span>
                </button>
              )}

              {/* Chips interactivos de componentes por rubro */}
              {insumosCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenBreakdownTab('materiales');
                  }}
                  className="text-[10px] px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface-variant font-mono shrink-0 hover:bg-primary-container hover:text-on-primary-container transition-colors cursor-pointer"
                  title="Ver y editar materiales asignados"
                >
                  📦 {insumosCount} {insumosCount === 1 ? 'mat' : 'mat'}
                </button>
              )}

              {moCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenBreakdownTab('mano_obra');
                  }}
                  className="text-[10px] px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface-variant font-mono shrink-0 hover:bg-secondary-container hover:text-on-secondary-container transition-colors cursor-pointer"
                  title="Ver y editar mano de obra asignada"
                >
                  ⚡ {moCount} {moCount === 1 ? 'mo' : 'mo'}
                </button>
              )}

              {servCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenBreakdownTab('servicios');
                  }}
                  className="text-[10px] px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface-variant font-mono shrink-0 hover:bg-tertiary-container hover:text-on-tertiary-container transition-colors cursor-pointer"
                  title="Ver y editar servicios tercerizados"
                >
                  🚚 {servCount} {servCount === 1 ? 'serv' : 'serv'}
                </button>
              )}

              {hasParams && (
                <button
                  type="button"
                  onClick={handleOpenParams}
                  className="text-[10px] px-1.5 py-0.2 rounded bg-secondary-container/40 text-secondary hover:bg-secondary-container hover:text-on-secondary-container font-mono shrink-0 cursor-pointer transition-colors"
                  title="Clic para configurar parámetros del ítem"
                >
                  ⚙️ {item.parametros?.length} p
                </button>
              )}
            </div>
          )}
        </div>

        {/* ─── Columna 2: Cantidad, Fórmulas y Unidad ─── */}
        <ItemQuantityCell
          item={item}
          isEditingQty={isEditingQty}
          editingValue={editingCell?.value}
          onStartEditQty={() => onStartEditCell('cantidad')}
          onUpdateEditingCellValue={onUpdateEditingCellValue}
          onCommitEditCell={onCommitEditCell}
          onCancelEditCell={onCancelEditCell}
          onNavigateCell={onNavigateCell}
          onUpdateItemUnidad={onUpdateItemUnidad}
          calculosVariables={calculosVariables}
        />

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

        {/* ─── Acciones Rápidas Agrupadas ─── */}
        <div className="w-24 sm:w-28 shrink-0 flex justify-end">
          <ItemRowActions
            isSelected={isSelected}
            isExpanded={isExpanded}
            isParametric={isParametric}
            hasParams={hasParams}
            onToggleExpand={onToggleExpand}
            onStartEditName={() => onStartEditCell('descripcion')}
            onOpenParams={handleOpenParams}
            onDuplicate={onDuplicate}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onSaveAsTareaTipo={onSaveAsTareaTipo}
            onRemove={onRemove}
          />
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
