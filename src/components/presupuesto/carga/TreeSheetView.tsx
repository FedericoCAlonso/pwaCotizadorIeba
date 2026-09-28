import React, { useRef, useEffect } from 'react';
import {
  TreeSheetToolbar
} from './TreeSheetToolbar';
import {
  TreeSheetChapterRow
} from './TreeSheetChapterRow';
import {
  TreeSheetRow
} from './TreeSheetRow';
import {
  ItemDetailPanel
} from './ItemDetailPanel';
import {
  LiveTotalsBar
} from './LiveTotalsBar';
import {
  QuoteParametersModal
} from './QuoteParametersModal';
import {
  CommandPaletteModal
} from './CommandPaletteModal';
import { ItemPickerModal } from '../ItemPickerModal';
import { MaterialPickerModal } from '../../tareasTipo/MaterialPickerModal';
import {
  useTreeSheetViewModel,
  UseTreeSheetViewModelProps
} from '../../../viewmodels/useTreeSheetViewModel';
import { Plus, FolderPlus, BookOpen } from 'lucide-react';

interface TreeSheetViewProps extends UseTreeSheetViewModelProps {
  onSaveDraft?: () => void;
  margenPorcentaje?: number | null;
  onUpdateMargenPorcentaje?: (margen: number) => void;
  nivelMargenRiesgo?: any;
  margenRiesgoPorcentaje?: number;
  onUpdateMargenRiesgo?: (nivel: any, pct: number) => void;
  tipoFactura?: any;
  onUpdateTipoFactura?: (tipo: any) => void;
  impuestosDetalle?: any[];
  onToggleTax?: (index: number) => void;
  onUpdateTaxPct?: (index: number, pct: number) => void;
}

export const TreeSheetView: React.FC<TreeSheetViewProps> = (props) => {
  const vm = useTreeSheetViewModel(props);
  const containerRef = useRef<HTMLDivElement>(null);

  const insumosMap = props.insumosMap || new Map();
  const manoObraMap = props.manoObraMap || new Map();

  // Enfocar contenedor para capturar eventos de teclado al montar o cambiar selección
  useEffect(() => {
    if (
      !vm.editingCell &&
      !vm.isCommandPaletteOpen &&
      !vm.isQuoteParametersOpen &&
      !vm.isCatalogPickerOpen &&
      !vm.materialPickerItemId
    ) {
      containerRef.current?.focus({ preventScroll: true });
    }
  }, [
    vm.editingCell,
    vm.isCommandPaletteOpen,
    vm.isQuoteParametersOpen,
    vm.isCatalogPickerOpen,
    vm.materialPickerItemId
  ]);

  // Ítems huérfanos (sin capítulo asignado)
  const orphanItems = props.items.filter((it) => !it.capituloId);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={vm.handleKeyDown}
      className="flex flex-col h-full bg-surface select-none outline-none overflow-hidden"
      role="treegrid"
      aria-label="Planilla Árbol de Cotización"
    >
      {/* Barra de herramientas superior */}
      <TreeSheetToolbar
        totalViewMode={vm.totalViewMode}
        onToggleTotalViewMode={vm.toggleTotalViewMode}
        onCreateChapter={() => vm.handleCreateChapter()}
        onCreateItem={() => vm.handleCreateItem()}
        onOpenCatalogPicker={() => vm.setIsCatalogPickerOpen(true)}
        onOpenQuoteParameters={() => vm.setIsQuoteParametersOpen(true)}
        onOpenCommandPalette={() => vm.setIsCommandPaletteOpen(true)}
        onOpenTextMode={props.onOpenTextMode}
      />

      {/* Área Central: Árbol-Planilla a la izquierda + Panel Inspector a la derecha */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tabla Árbol */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-surface">
          {/* Cabecera de Columnas */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 bg-surface-container-high border-b border-outline-variant/30 text-xs font-bold text-on-surface-variant uppercase tracking-wider select-none shadow-2xs">
            <div className="flex-1 min-w-0 pr-2 pl-3">Descripción de la Partida</div>
            <div className="w-28 shrink-0 px-2 text-right">Cantidad</div>
            <div className="w-32 shrink-0 px-2 text-right">
              {vm.totalViewMode === 'costo' ? 'Costo Directo' : 'Precio Final'}
            </div>
            <div className="w-24 shrink-0 text-right pr-1">Acciones</div>
          </div>

          {/* Estado vacío si no hay capítulos ni partidas */}
          {props.capitulos.length === 0 && props.items.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-on-surface-variant/70">
              <p className="text-sm font-semibold mb-1 text-on-surface">Cotización Vacía</p>
              <p className="text-xs mb-4 max-w-sm">
                Comenzá agregando un capítulo (ej. Instalaciones Eléctricas) o insertando una tarea tipo del catálogo.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => vm.handleCreateChapter('Instalaciones Eléctricas')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-on-primary rounded-xl cursor-pointer shadow-xs active:scale-95"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>+ Primer Capítulo</span>
                </button>
                <button
                  type="button"
                  onClick={() => vm.setIsCatalogPickerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-surface-container-high text-on-surface rounded-xl border border-outline-variant/30 cursor-pointer active:scale-95"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Catálogo de Tareas</span>
                </button>
              </div>
            </div>
          )}

          {/* Partidas huérfanas sin capítulo */}
          {orphanItems.length > 0 && (
            <div>
              <div className="px-4 py-1.5 bg-surface-container-lowest border-b border-outline-variant/20 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Partidas Generales (Sin Capítulo)
              </div>
              {orphanItems.map((item) => (
                <TreeSheetRow
                  key={item.id}
                  item={item}
                  isSelected={vm.selectedItemId === item.id}
                  isExpanded={vm.expandedItems.has(item.id)}
                  onToggleExpand={() => vm.toggleItemExpand(item.id)}
                  editingCell={vm.editingCell}
                  totalViewMode={vm.totalViewMode}
                  insumosMap={insumosMap}
                  manoObraMap={manoObraMap}
                  onSelect={() => vm.handleSelectRow(item.id, null)}
                  onStartEditCell={(field) => vm.handleStartEditCell(item.id, field)}
                  onUpdateEditingCellValue={vm.handleUpdateEditingCellValue}
                  onCommitEditCell={(field) => vm.handleCommitEditCell(item.id, field)}
                  onCancelEditCell={vm.handleCancelEditCell}
                  onMoveUp={() => vm.handleMoveItem(item.id, 'up')}
                  onMoveDown={() => vm.handleMoveItem(item.id, 'down')}
                  onRemove={() => vm.handleRemoveItem(item.id)}
                  onOpenDetail={() => vm.handleSelectRow(item.id, null)}
                  onAddMaterial={(mat, qty, formula) =>
                    vm.handleAddMaterialToItem(item.id, mat, qty, formula)
                  }
                  onRemoveMaterial={(idx) => vm.handleRemoveMaterialFromItem(item.id, idx)}
                  onUpdateMaterialFormula={(idx, formula) =>
                    vm.handleUpdateMaterialFormula(item.id, idx, formula)
                  }
                  onOpenMaterialCatalog={() => vm.handleOpenMaterialPicker(item.id)}
                  onAddLabor={(catId, hs, formula) =>
                    vm.handleAddLaborToItem(item.id, catId, hs, formula)
                  }
                  onRemoveLabor={(idx) => vm.handleRemoveLaborFromItem(item.id, idx)}
                  onUpdateLaborFormula={(idx, formula) =>
                    vm.handleUpdateLaborFormula(item.id, idx, formula)
                  }
                  onAddService={(desc, costo) =>
                    vm.handleAddServiceToItem(item.id, desc, costo)
                  }
                  onRemoveService={(idx) => vm.handleRemoveServiceFromItem(item.id, idx)}
                />
              ))}
            </div>
          )}

          {/* Capítulos y sus ítems */}
          {props.capitulos.map((cap) => {
            const capItems = props.items.filter((it) => it.capituloId === cap.id);
            const isCollapsed = vm.collapsedChapters.has(cap.id);
            const isChapterSelected = vm.selectedChapterId === cap.id && !vm.selectedItemId;

            return (
              <div key={cap.id} className="border-b border-outline-variant/10">
                <TreeSheetChapterRow
                  capitulo={cap}
                  items={capItems}
                  isCollapsed={isCollapsed}
                  isSelected={isChapterSelected}
                  totalViewMode={vm.totalViewMode}
                  onToggleCollapse={() => vm.toggleChapterCollapse(cap.id)}
                  onSelect={() => vm.handleSelectRow(null, cap.id)}
                  onAddItem={() => vm.handleCreateItem(cap.id, 'end')}
                  onRenameChapter={(nombre) => vm.handleRenameChapter(cap.id, nombre)}
                  onRemoveChapter={() => vm.handleRemoveChapter(cap.id)}
                />

                {/* Ítems del capítulo si no está colapsado */}
                {!isCollapsed && (
                  <div>
                    {capItems.length === 0 ? (
                      <div className="py-2 px-8 text-xs text-on-surface-variant/60 italic flex items-center justify-between">
                        <span>Sin partidas en este capítulo</span>
                        <button
                          type="button"
                          onClick={() => vm.handleCreateItem(cap.id, 'end')}
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Agregar partida</span>
                        </button>
                      </div>
                    ) : (
                      capItems.map((item) => (
                        <TreeSheetRow
                          key={item.id}
                          item={item}
                          isSelected={vm.selectedItemId === item.id}
                          isExpanded={vm.expandedItems.has(item.id)}
                          onToggleExpand={() => vm.toggleItemExpand(item.id)}
                          editingCell={vm.editingCell}
                          totalViewMode={vm.totalViewMode}
                          insumosMap={insumosMap}
                          manoObraMap={manoObraMap}
                          onSelect={() => vm.handleSelectRow(item.id, cap.id)}
                          onStartEditCell={(field) => vm.handleStartEditCell(item.id, field)}
                          onUpdateEditingCellValue={vm.handleUpdateEditingCellValue}
                          onCommitEditCell={(field) => vm.handleCommitEditCell(item.id, field)}
                          onCancelEditCell={vm.handleCancelEditCell}
                          onMoveUp={() => vm.handleMoveItem(item.id, 'up')}
                          onMoveDown={() => vm.handleMoveItem(item.id, 'down')}
                          onRemove={() => vm.handleRemoveItem(item.id)}
                          onOpenDetail={() => vm.handleSelectRow(item.id, cap.id)}
                          onAddMaterial={(mat, qty, formula) =>
                            vm.handleAddMaterialToItem(item.id, mat, qty, formula)
                          }
                          onRemoveMaterial={(idx) =>
                            vm.handleRemoveMaterialFromItem(item.id, idx)
                          }
                          onUpdateMaterialFormula={(idx, formula) =>
                            vm.handleUpdateMaterialFormula(item.id, idx, formula)
                          }
                          onOpenMaterialCatalog={() => vm.handleOpenMaterialPicker(item.id)}
                          onAddLabor={(catId, hs, formula) =>
                            vm.handleAddLaborToItem(item.id, catId, hs, formula)
                          }
                          onRemoveLabor={(idx) =>
                            vm.handleRemoveLaborFromItem(item.id, idx)
                          }
                          onUpdateLaborFormula={(idx, formula) =>
                            vm.handleUpdateLaborFormula(item.id, idx, formula)
                          }
                          onAddService={(desc, costo) =>
                            vm.handleAddServiceToItem(item.id, desc, costo)
                          }
                          onRemoveService={(idx) =>
                            vm.handleRemoveServiceFromItem(item.id, idx)
                          }
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Panel Lateral de Detalle / Inspector (Opción 1) */}
        <ItemDetailPanel
          item={vm.selectedItem}
          isOpen={vm.isDetailPanelOpen}
          isCollapsed={vm.isInspectorCollapsed}
          onToggleCollapse={vm.toggleInspectorCollapsed}
          tareasTipo={props.tareasTipo}
          insumosMap={insumosMap}
          manoObraMap={manoObraMap}
          totales={props.totales}
          onClose={() => vm.setIsDetailPanelOpen(false)}
          onUpdateParametros={(params) => {
            if (vm.selectedItemId) vm.handleUpdateItemParametros(vm.selectedItemId, params);
          }}
          onUpdateCantidad={(cant, formula) => {
            if (vm.selectedItemId) vm.handleUpdateItemCantidad(vm.selectedItemId, cant, formula);
          }}
          onUpdateLines={(updates) => {
            if (vm.selectedItemId) vm.handleUpdateItemLines(vm.selectedItemId, updates);
          }}
          onDesacoplar={() => {
            if (vm.selectedItemId) vm.handleDesacoplarItem(vm.selectedItemId);
          }}
          onActualizarVersion={() => {
            if (vm.selectedItemId) vm.handleActualizarVersionTareaTipo(vm.selectedItemId);
          }}
          onSaveAsTareaTipo={props.onSaveAsTareaTipo}
          onOpenMaterialPicker={
            vm.selectedItemId ? () => vm.handleOpenMaterialPicker(vm.selectedItemId!) : undefined
          }
        />
      </div>

      {/* Barra de Totales Fija */}
      <LiveTotalsBar
        totales={props.totales}
        onOpenQuoteParameters={() => vm.setIsQuoteParametersOpen(true)}
      />

      {/* Modal de Parámetros de Cotización */}
      <QuoteParametersModal
        isOpen={vm.isQuoteParametersOpen}
        onClose={() => vm.setIsQuoteParametersOpen(false)}
        calculosVariables={props.calculosVariables}
        onUpdateCalculosVariables={props.setCalculosVariables}
        gastosConfig={props.gastosConfig}
        onUpdateGastosConfig={props.setGastosConfig}
        capitulos={props.capitulos}
        margenPorcentaje={props.margenPorcentaje}
        onUpdateMargenPorcentaje={props.onUpdateMargenPorcentaje}
        nivelMargenRiesgo={props.nivelMargenRiesgo}
        margenRiesgoPorcentaje={props.margenRiesgoPorcentaje}
        onUpdateMargenRiesgo={props.onUpdateMargenRiesgo}
        tipoFactura={props.tipoFactura}
        onUpdateTipoFactura={props.onUpdateTipoFactura}
        impuestosDetalle={props.impuestosDetalle}
        onToggleTax={props.onToggleTax}
        onUpdateTaxPct={props.onUpdateTaxPct}
      />

      {/* Paleta de Comandos (Ctrl+K) */}
      <CommandPaletteModal
        isOpen={vm.isCommandPaletteOpen}
        onClose={() => vm.setIsCommandPaletteOpen(false)}
        onAddChapter={() => vm.handleCreateChapter()}
        onAddItem={() => vm.handleCreateItem()}
        onInsertTareaTipo={() => vm.setIsCatalogPickerOpen(true)}
        onSaveAsTareaTipo={
          vm.selectedItem ? () => props.onSaveAsTareaTipo?.(vm.selectedItem!) : undefined
        }
        onNewVariable={() => vm.setIsQuoteParametersOpen(true)}
        onConfigureGastos={() => vm.setIsQuoteParametersOpen(true)}
        onTogglePriceView={vm.toggleTotalViewMode}
        onOpenTextMode={props.onOpenTextMode}
        onSaveDraft={props.onSaveDraft}
      />

      {/* Selector de Catálogo de Tareas Tipo */}
      {vm.isCatalogPickerOpen && (
        <ItemPickerModal
          isOpen={vm.isCatalogPickerOpen}
          onClose={() => vm.setIsCatalogPickerOpen(false)}
          onSelectTarea={(tt: any) => vm.handleInsertTareaTipo(tt)}
          insumosMap={insumosMap}
          manoObraMap={manoObraMap}
          tareasTipo={props.tareasTipo || []}
        />
      )}

      {/* Selector de Materiales del Catálogo Completo */}
      {Boolean(vm.materialPickerItemId) && (
        <MaterialPickerModal
          isOpen={Boolean(vm.materialPickerItemId)}
          onClose={vm.handleCloseMaterialPicker}
          insumosMap={insumosMap}
          titleOverride="Catálogo de Materiales"
          subtitleOverride="Selecciona insumos para incorporar a la partida"
          onAddMaterial={(mat, qty, formula) => {
            if (vm.materialPickerItemId) {
              vm.handleAddMaterialToItem(vm.materialPickerItemId, mat, qty, formula);
            }
          }}
          onAddMultipleMaterials={(staged) => {
            if (vm.materialPickerItemId) {
              staged.forEach((s) => {
                vm.handleAddMaterialToItem(
                  vm.materialPickerItemId!,
                  s.material,
                  s.cantidad,
                  s.formula
                );
              });
            }
          }}
        />
      )}
    </div>
  );
};
