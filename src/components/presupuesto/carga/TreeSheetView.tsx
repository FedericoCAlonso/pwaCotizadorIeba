import React, { useRef, useEffect, useMemo, useImperativeHandle } from 'react';
import { TreeSheetDesktopTable } from './desktop/TreeSheetDesktopTable';
import { TreeSheetMobileList } from './mobile/TreeSheetMobileList';
import { MobileEditorActionBar } from './mobile/MobileEditorActionBar';
import { LiveTotalsBar } from './LiveTotalsBar';
import { QuoteParametersModal } from './QuoteParametersModal';
import { CommandPaletteModal } from './CommandPaletteModal';
import { ItemParametersQuickModal } from './ItemParametersQuickModal';
import { ItemPickerModal } from '../ItemPickerModal';
import { MaterialPickerModal } from '../../tareasTipo/MaterialPickerModal';
import { TareaTipo, ItemPresupuesto } from '../../../core/types';
import {
  useTreeSheetViewModel,
  UseTreeSheetViewModelProps
} from '../../../viewmodels/useTreeSheetViewModel';

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
  onOpenParametricJobModal?: (tareaTipo: TareaTipo, itemIndex?: number, targetChapterId?: string) => void;
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
      vm.handleOpenCatalogPicker(chapterId);
    },
    openQuoteParameters: () => vm.setIsQuoteParametersOpen(true),
    openCommandPalette: () => vm.setIsCommandPaletteOpen(true)
  }));

  // Enfocar contenedor para capturar eventos de teclado al montar o cambiar selección en desktop
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

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={vm.handleKeyDown}
      className="flex flex-col h-full bg-surface select-none outline-none overflow-hidden"
      role="treegrid"
      aria-label="Planilla Árbol de Cotización"
    >
      {/* ─── Vista Desktop: Planilla Tabular de Alta Densidad (≥ 768px / md:) ─── */}
      <div className="hidden md:flex flex-1 flex-col min-h-0 overflow-hidden">
        <TreeSheetDesktopTable
          items={props.items}
          setItems={props.setItems}
          capitulos={props.capitulos}
          calculatedItemsMap={calculatedItemsMap}
          totales={props.totales}
          vm={vm}
          insumosMap={insumosMap}
          manoObraMap={manoObraMap}
          calculosVariables={props.calculosVariables}
          onSaveAsTareaTipo={props.onSaveAsTareaTipo}
          onOpenParametricJobModal={props.onOpenParametricJobModal}
          tareasTipo={props.tareasTipo}
        />
      </div>

      {/* ─── Vista Móvil: Lista de Tarjetas Táctiles (< 768px / md:hidden) ─── */}
      <div className="flex md:hidden flex-1 flex-col min-h-0 overflow-hidden">
        <TreeSheetMobileList
          items={props.items}
          setItems={props.setItems}
          capitulos={props.capitulos}
          calculatedItemsMap={calculatedItemsMap}
          totales={props.totales}
          vm={vm}
          insumosMap={insumosMap}
          manoObraMap={manoObraMap}
          calculosVariables={props.calculosVariables}
          onSaveAsTareaTipo={props.onSaveAsTareaTipo}
          onOpenParametricJobModal={props.onOpenParametricJobModal}
          tareasTipo={props.tareasTipo}
        />
        {/* Barra de Pulgar Táctil Móvil */}
        <MobileEditorActionBar
          onAddItem={() => vm.handleCreateItem(vm.selectedChapterId || undefined)}
          onOpenCatalog={() => vm.setIsCatalogPickerOpen(true)}
          onAddChapter={() => vm.handleCreateChapter()}
          onOpenParameters={() => vm.setIsQuoteParametersOpen(true)}
        />
      </div>

      {/* ─── Barra de Totales Fija ─── */}
      <LiveTotalsBar
        totales={props.totales}
        onOpenQuoteParameters={() => vm.setIsQuoteParametersOpen(true)}
      />

      {/* ─── Modales Globales ─── */}
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
        onSaveDraft={props.onSaveDraft}
      />

      {/* Selector de Catálogo de Tareas Tipo */}
      {vm.isCatalogPickerOpen && (
        <ItemPickerModal
          isOpen={vm.isCatalogPickerOpen}
          onClose={() => vm.setIsCatalogPickerOpen(false)}
          onSelectTarea={(tt: any) => {
            const targetCapId = vm.catalogPickerTargetChapterId || vm.selectedChapterId || undefined;
            vm.setIsCatalogPickerOpen(false);
            if (
              props.onOpenParametricJobModal &&
              ((tt.parametros && tt.parametros.length > 0) ||
               (tt.variables && tt.variables.length > 0) ||
               Boolean(tt.formulaHonorarios))
            ) {
              props.onOpenParametricJobModal(tt, undefined, targetCapId);
            } else {
              vm.handleInsertTareaTipo(tt, targetCapId);
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
          subtitleOverride="Selecciona insumos para incorporar al ítem"
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
