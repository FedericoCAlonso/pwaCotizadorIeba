import React, { useRef, useEffect, useMemo, useImperativeHandle } from 'react';
import {
  TreeSheetChapterRow
} from './TreeSheetChapterRow';
import {
  TreeSheetRow
} from './TreeSheetRow';
import {
  LiveTotalsBar
} from './LiveTotalsBar';
import {
  QuoteParametersModal
} from './QuoteParametersModal';
import {
  CommandPaletteModal
} from './CommandPaletteModal';
import { ItemParametersQuickModal } from './ItemParametersQuickModal';
import { ItemPickerModal } from '../ItemPickerModal';
import { MaterialPickerModal } from '../../tareasTipo/MaterialPickerModal';
import { TareaTipo, ItemPresupuesto } from '../../../core/types';
import {
  useTreeSheetViewModel,
  UseTreeSheetViewModelProps
} from '../../../viewmodels/useTreeSheetViewModel';
import { FolderPlus, BookOpen } from 'lucide-react';

export interface TreeSheetViewRef {
  handleCreateItem: (chapterId?: string) => void;
  handleCreateChapter: (nombre?: string) => void;
  openCatalogPicker: (chapterId?: string) => void;
  openQuoteParameters: () => void;
  openCommandPalette: () => void;
}

export interface TreeSheetViewProps extends UseTreeSheetViewModelProps {
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
  onOpenParametricJobModal?: (tareaTipo: TareaTipo, itemIndex?: number) => void;
}

export const TreeSheetView = React.forwardRef<TreeSheetViewRef, TreeSheetViewProps>((props, ref) => {
  const vm = useTreeSheetViewModel(props);
  const containerRef = useRef<HTMLDivElement>(null);

  const insumosMap = props.insumosMap || new Map();
  const manoObraMap = props.manoObraMap || new Map();

  // Exponer métodos imperativos para la barra superior unificada
  useImperativeHandle(ref, () => ({
    handleCreateItem: (chapterId?: string) => vm.handleCreateItem(chapterId),
    handleCreateChapter: (nombre?: string) => vm.handleCreateChapter(nombre),
    openCatalogPicker: (chapterId?: string) => {
      vm.setCatalogPickerTargetChapterId(chapterId);
      vm.setIsCatalogPickerOpen(true);
    },
    openQuoteParameters: () => vm.setIsQuoteParametersOpen(true),
    openCommandPalette: () => vm.setIsCommandPaletteOpen(true)
  }));

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

  // Mapa de ítems calculados determinísticamente por el motor de cálculo
  const calculatedItemsMap = useMemo(() => {
    const map = new Map<string, ItemPresupuesto>();
    (props.totales?.itemsCalculados || []).forEach((ci) => {
      map.set(ci.id, ci);
    });
    return map;
  }, [props.totales?.itemsCalculados]);

  // Partida seleccionada para el diálogo rápido de parámetros
  const quickParamItem = useMemo(() => {
    if (!vm.quickParamModalItemId) return null;
    return props.items.find((it) => it.id === vm.quickParamModalItemId) || null;
  }, [props.items, vm.quickParamModalItemId]);

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
      {/* Área Central: Tabla Árbol a pantalla completa (100% de ancho) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-surface pb-2">
        {/* Cabecera de Columnas: Costo Directo y Precio Final Simultáneos */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 bg-surface-container-high border-b border-outline-variant/30 text-xs font-bold text-on-surface-variant uppercase tracking-wider select-none shadow-2xs">
          <div className="flex-1 min-w-0 pr-2 pl-3">Descripción de la Partida</div>
          <div className="w-20 sm:w-24 shrink-0 px-2 text-right">Cantidad</div>
          <div className="hidden sm:block w-24 sm:w-28 shrink-0 px-2 text-right">Costo Unit.</div>
          <div className="w-28 sm:w-32 shrink-0 px-2 text-right">Costo Total</div>
          <div className="hidden md:block w-24 sm:w-28 shrink-0 px-2 text-right text-primary/80">P. Unit. Final</div>
          <div className="w-28 sm:w-36 shrink-0 px-2 text-right text-primary font-bold">Precio Final</div>
          <div className="w-20 sm:w-24 shrink-0 text-right pr-1">Acciones</div>
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
            {orphanItems.map((rawItem) => {
              const item = calculatedItemsMap.get(rawItem.id) || rawItem;
              return (
                <TreeSheetRow
                  key={item.id}
                  item={item}
                  isSelected={vm.selectedItemId === item.id}
                  isExpanded={vm.expandedItems.has(item.id)}
                  onToggleExpand={() => vm.toggleItemExpand(item.id)}
                  editingCell={vm.editingCell}
                  insumosMap={insumosMap}
                  manoObraMap={manoObraMap}
                  onSelect={() => vm.handleSelectRow(item.id, item.capituloId || null)}
                  onStartEditCell={(field) => vm.handleStartEditCell(item.id, field)}
                  onUpdateEditingCellValue={vm.handleUpdateEditingCellValue}
                  onCommitEditCell={(field) => vm.handleCommitEditCell(item.id, field)}
                  onCancelEditCell={vm.handleCancelEditCell}
                  onMoveUp={() => vm.handleMoveItem(item.id, 'up')}
                  onMoveDown={() => vm.handleMoveItem(item.id, 'down')}
                  onRemove={() => vm.handleRemoveItem(item.id)}
                  onSaveAsTareaTipo={
                    props.onSaveAsTareaTipo ? () => props.onSaveAsTareaTipo?.(item) : undefined
                  }
                  onOpenParametric={
                    props.onOpenParametricJobModal
                      ? () => {
                          const idx = props.items.findIndex((it) => it.id === item.id);
                          const tarea = item.tareaTipoConfig || (item.tareaTipoId ? props.tareasTipo?.find((t) => t.id === item.tareaTipoId) : undefined);
                          if (tarea && idx !== -1) {
                            props.onOpenParametricJobModal?.(tarea, idx);
                          }
                        }
                      : undefined
                  }
                  onUpdateNotas={(notas, exclusiones) => {
                    props.setItems((prev) =>
                      prev.map((it) =>
                        it.id === item.id
                          ? { ...it, notasTecnicas: notas, clausulaExclusiones: exclusiones }
                          : it
                      )
                    );
                  }}
                  onAddMaterial={(mat, qty, formula) =>
                    vm.handleAddMaterialToItem(item.id, mat, qty, formula)
                  }
                  onRemoveMaterial={(mIdx) => vm.handleRemoveMaterialFromItem(item.id, mIdx)}
                  onUpdateMaterialFormula={(mIdx, formula) =>
                    vm.handleUpdateMaterialFormula(item.id, mIdx, formula)
                  }
                  onOpenMaterialCatalog={() => vm.handleOpenMaterialPicker(item.id)}
                  onAddLabor={(catId, hs, formula) =>
                    vm.handleAddLaborToItem(item.id, catId, hs, formula)
                  }
                  onRemoveLabor={(lIdx) => vm.handleRemoveLaborFromItem(item.id, lIdx)}
                  onUpdateLaborFormula={(lIdx, formula) =>
                    vm.handleUpdateLaborFormula(item.id, lIdx, formula)
                  }
                  onAddService={(desc, cost) => vm.handleAddServiceToItem(item.id, desc, cost)}
                  onRemoveService={(sIdx) => vm.handleRemoveServiceFromItem(item.id, sIdx)}
                  onUpdateParametros={(params) => vm.handleUpdateItemParametros(item.id, params)}
                  onNavigateCell={vm.handleNavigateCell}
                  onOpenQuickParamModal={vm.handleOpenQuickParamModal}
                  calculosVariables={props.calculosVariables}
                />
              );
            })}
          </div>
        )}

        {/* Capítulos y sus Partidas */}
        {props.capitulos.map((cap) => {
          const capRawItems = props.items.filter((it) => it.capituloId === cap.id);
          const capCalculatedItems = capRawItems.map((it) => calculatedItemsMap.get(it.id) || it);
          const capCalculatedTotals = props.totales?.capitulosTotales?.[cap.id];

          return (
            <div key={cap.id} className="border-b border-outline-variant/30 last:border-b-0">
              <TreeSheetChapterRow
                capitulo={cap}
                items={capCalculatedItems}
                capituloTotales={capCalculatedTotals}
                isCollapsed={vm.collapsedChapters.has(cap.id)}
                isSelected={vm.selectedChapterId === cap.id}
                onToggleCollapse={() => vm.toggleChapterCollapse(cap.id)}
                onSelect={() => vm.handleSelectRow(null, cap.id)}
                onAddItem={() => vm.handleCreateItem(cap.id)}
                onRenameChapter={(nombre) => vm.handleRenameChapter(cap.id, nombre)}
                onRemoveChapter={() => vm.handleRemoveChapter(cap.id)}
              />

              {!vm.collapsedChapters.has(cap.id) && (
                <div>
                  {capRawItems.length === 0 ? (
                    <div className="px-8 py-3 text-xs text-on-surface-variant/60 italic flex items-center justify-between bg-surface-container-lowest">
                      <span>Capítulo sin partidas agregadas.</span>
                      <button
                        type="button"
                        onClick={() => vm.handleCreateItem(cap.id)}
                        className="text-primary hover:underline font-semibold cursor-pointer"
                      >
                        + Agregar partida
                      </button>
                    </div>
                  ) : (
                    capRawItems.map((rawItem) => {
                      const item = calculatedItemsMap.get(rawItem.id) || rawItem;
                      return (
                        <TreeSheetRow
                          key={item.id}
                          item={item}
                          isSelected={vm.selectedItemId === item.id}
                          isExpanded={vm.expandedItems.has(item.id)}
                          onToggleExpand={() => vm.toggleItemExpand(item.id)}
                          editingCell={vm.editingCell}
                          insumosMap={insumosMap}
                          manoObraMap={manoObraMap}
                          onSelect={() => vm.handleSelectRow(item.id, item.capituloId || null)}
                          onStartEditCell={(field) => vm.handleStartEditCell(item.id, field)}
                          onUpdateEditingCellValue={vm.handleUpdateEditingCellValue}
                          onCommitEditCell={(field) => vm.handleCommitEditCell(item.id, field)}
                          onCancelEditCell={vm.handleCancelEditCell}
                          onMoveUp={() => vm.handleMoveItem(item.id, 'up')}
                          onMoveDown={() => vm.handleMoveItem(item.id, 'down')}
                          onRemove={() => vm.handleRemoveItem(item.id)}
                          onSaveAsTareaTipo={
                            props.onSaveAsTareaTipo ? () => props.onSaveAsTareaTipo?.(item) : undefined
                          }
                          onOpenParametric={
                            props.onOpenParametricJobModal
                              ? () => {
                                  const idx = props.items.findIndex((it) => it.id === item.id);
                                  const tarea = item.tareaTipoConfig || (item.tareaTipoId ? props.tareasTipo?.find((t) => t.id === item.tareaTipoId) : undefined);
                                  if (tarea && idx !== -1) {
                                    props.onOpenParametricJobModal?.(tarea, idx);
                                  }
                                }
                              : undefined
                          }
                          onUpdateNotas={(notas, exclusiones) => {
                            props.setItems((prev) =>
                              prev.map((it) =>
                                it.id === item.id
                                  ? { ...it, notasTecnicas: notas, clausulaExclusiones: exclusiones }
                                  : it
                              )
                            );
                          }}
                          onAddMaterial={(mat, qty, formula) =>
                            vm.handleAddMaterialToItem(item.id, mat, qty, formula)
                          }
                          onRemoveMaterial={(mIdx) => vm.handleRemoveMaterialFromItem(item.id, mIdx)}
                          onUpdateMaterialFormula={(mIdx, formula) =>
                            vm.handleUpdateMaterialFormula(item.id, mIdx, formula)
                          }
                          onOpenMaterialCatalog={() => vm.handleOpenMaterialPicker(item.id)}
                          onAddLabor={(catId, hs, formula) =>
                            vm.handleAddLaborToItem(item.id, catId, hs, formula)
                          }
                          onRemoveLabor={(lIdx) => vm.handleRemoveLaborFromItem(item.id, lIdx)}
                          onUpdateLaborFormula={(lIdx, formula) =>
                            vm.handleUpdateLaborFormula(item.id, lIdx, formula)
                          }
                          onAddService={(desc, cost) => vm.handleAddServiceToItem(item.id, desc, cost)}
                          onRemoveService={(sIdx) => vm.handleRemoveServiceFromItem(item.id, sIdx)}
                          onUpdateParametros={(params) => vm.handleUpdateItemParametros(item.id, params)}
                          onNavigateCell={vm.handleNavigateCell}
                          onOpenQuickParamModal={vm.handleOpenQuickParamModal}
                          calculosVariables={props.calculosVariables}
                        />
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
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
        items={props.items}
        onUpdateItemParametros={vm.handleUpdateItemParametros}
        costoDirectoTotal={props.totales?.subtotalCostosDirectos}
        precioFinalGlobal={props.totales?.totalARS ?? props.totales?.precioFinalGlobal}
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

      {/* Modal Rápido de Parámetros de Partida (In-Situ) */}
      {quickParamItem && (
        <ItemParametersQuickModal
          isOpen={Boolean(vm.quickParamModalItemId)}
          onClose={vm.handleCloseQuickParamModal}
          item={quickParamItem}
          calculosVariables={props.calculosVariables}
          onUpdateParametros={(params) => vm.handleUpdateItemParametros(quickParamItem.id, params)}
          onOpenFullBreakdown={() => {
            if (!vm.expandedItems.has(quickParamItem.id)) {
              vm.toggleItemExpand(quickParamItem.id);
            }
          }}
        />
      )}

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
          onSelectTarea={(tt: any) => {
            vm.setIsCatalogPickerOpen(false);
            if (
              props.onOpenParametricJobModal &&
              ((tt.parametros && tt.parametros.length > 0) ||
               (tt.variables && tt.variables.length > 0) ||
               Boolean(tt.formulaHonorarios))
            ) {
              props.onOpenParametricJobModal(tt);
            } else {
              vm.handleInsertTareaTipo(tt);
            }
          }}
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
            vm.handleCloseMaterialPicker();
          }}
        />
      )}
    </div>
  );
});

TreeSheetView.displayName = 'TreeSheetView';
