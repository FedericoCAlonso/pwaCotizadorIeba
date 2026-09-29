import React, { useState } from 'react';
import {
  FolderPlus,
  BookOpen
} from 'lucide-react';
import { ItemPresupuesto, CapituloPresupuesto, Insumo, CategoriaManoDeObra } from '../../../../core/types';
import { TotalesPresupuestoResultado, safeNum } from '../../../../core/calculations';
import { useTreeSheetViewModel } from '../../../../viewmodels/useTreeSheetViewModel';
import { MobileTreeItemCard } from './MobileTreeItemCard';
import { MobileChapterCard } from './MobileChapterCard';
import { MobileQuantitySheet } from './MobileQuantitySheet';

export interface TreeSheetMobileListProps {
  items: ItemPresupuesto[];
  setItems: React.Dispatch<React.SetStateAction<ItemPresupuesto[]>>;
  capitulos: CapituloPresupuesto[];
  calculatedItemsMap: Map<string, ItemPresupuesto>;
  totales: TotalesPresupuestoResultado;
  vm: ReturnType<typeof useTreeSheetViewModel>;
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
  calculosVariables?: Record<string, number | string>;
  onSaveAsTareaTipo?: (item: ItemPresupuesto) => void;
  onOpenParametricJobModal?: (tareaTipo: any, itemIndex?: number) => void;
  tareasTipo?: any[];
}

export const TreeSheetMobileList: React.FC<TreeSheetMobileListProps> = ({
  items,
  setItems,
  capitulos,
  calculatedItemsMap,
  totales,
  vm,
  insumosMap,
  manoObraMap,
  calculosVariables,
  onSaveAsTareaTipo,
  onOpenParametricJobModal,
  tareasTipo
}) => {
  const [quantitySheetItemId, setQuantitySheetItemId] = useState<string | null>(null);

  const quantitySheetItem = items.find((it) => it.id === quantitySheetItemId) || null;

  const handleQuickStepQty = (itemId: string, delta: number) => {
    const raw = items.find((it) => it.id === itemId);
    if (!raw) return;
    const current = safeNum(raw.cantidad) > 0 ? safeNum(raw.cantidad) : 1;
    const nextVal = Math.max(0, Math.round((current + delta) * 100) / 100);
    vm.handleUpdateItemCantidad(itemId, nextVal, undefined);
  };

  const handleConfirmQuantity = (qty: number, formula?: string) => {
    if (quantitySheetItemId) {
      vm.handleUpdateItemCantidad(quantitySheetItemId, qty, formula);
    }
  };

  const orphanItems = items.filter((it) => !it.capituloId);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 bg-surface select-none pb-28">
      {/* Estado vacío si no hay capítulos ni partidas */}
      {capitulos.length === 0 && items.length === 0 && (
        <div className="flex flex-col items-center justify-center p-8 text-center text-on-surface-variant/70 min-h-[300px]">
          <p className="text-base font-semibold mb-1 text-on-surface">Cotización Vacía</p>
          <p className="text-xs mb-5 max-w-xs leading-relaxed">
            Comenzá agregando una etapa de obra o incorporando tareas tipo desde el catálogo oficial.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full max-w-xs">
            <button
              type="button"
              onClick={() => vm.handleCreateChapter('Instalaciones Eléctricas')}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold bg-primary text-on-primary rounded-xl cursor-pointer shadow-xs active:scale-95 min-h-[44px]"
            >
              <FolderPlus className="w-4 h-4" />
              <span>+ Primer Capítulo</span>
            </button>
            <button
              type="button"
              onClick={() => vm.setIsCatalogPickerOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold bg-surface-container-high text-on-surface rounded-xl border border-outline-variant/30 cursor-pointer active:scale-95 min-h-[44px]"
            >
              <BookOpen className="w-4 h-4 text-tertiary" />
              <span>Explorar Catálogo</span>
            </button>
          </div>
        </div>
      )}

      {/* Partidas Generales sin Capítulo */}
      {orphanItems.length > 0 && (
        <div className="mb-4">
          <div className="px-2 py-1.5 mb-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center justify-between">
            <span>Partidas Generales</span>
            <span className="font-mono text-[10px] text-on-surface-variant/70">
              {orphanItems.length} {orphanItems.length === 1 ? 'partida' : 'partidas'}
            </span>
          </div>

          {orphanItems.map((rawItem) => {
            const item = calculatedItemsMap.get(rawItem.id) || rawItem;
            return (
              <MobileTreeItemCard
                key={item.id}
                item={item}
                isSelected={vm.selectedItemId === item.id}
                isExpanded={vm.expandedItems.has(item.id)}
                onToggleExpand={() => vm.toggleItemExpand(item.id)}
                onSelect={() => vm.handleSelectRow(item.id, null)}
                onOpenQuantitySheet={() => setQuantitySheetItemId(item.id)}
                onQuickStepQty={(delta) => handleQuickStepQty(item.id, delta)}
                onOpenQuickParamModal={vm.handleOpenQuickParamModal}
                onMoveUp={() => vm.handleMoveItem(item.id, 'up')}
                onMoveDown={() => vm.handleMoveItem(item.id, 'down')}
                onRemove={() => vm.handleRemoveItem(item.id)}
                onSaveAsTareaTipo={onSaveAsTareaTipo ? () => onSaveAsTareaTipo(item) : undefined}
                insumosMap={insumosMap}
                manoObraMap={manoObraMap}
                calculosVariables={calculosVariables}
                onAddMaterial={(mat, qty, formula) => vm.handleAddMaterialToItem(item.id, mat, qty, formula)}
                onRemoveMaterial={(mIdx) => vm.handleRemoveMaterialFromItem(item.id, mIdx)}
                onUpdateMaterialFormula={(mIdx, formula) => vm.handleUpdateMaterialFormula(item.id, mIdx, formula)}
                onOpenMaterialCatalog={() => vm.handleOpenMaterialPicker(item.id)}
                onAddLabor={(catId, hs, formula) => vm.handleAddLaborToItem(item.id, catId, hs, formula)}
                onRemoveLabor={(lIdx) => vm.handleRemoveLaborFromItem(item.id, lIdx)}
                onUpdateLaborFormula={(lIdx, formula) => vm.handleUpdateLaborFormula(item.id, lIdx, formula)}
                onAddService={(desc, cost) => vm.handleAddServiceToItem(item.id, desc, cost)}
                onRemoveService={(sIdx) => vm.handleRemoveServiceFromItem(item.id, sIdx)}
                onUpdateNotas={(notas, exclusiones) => {
                  setItems((prev) =>
                    prev.map((it) => (it.id === item.id ? { ...it, notasTecnicas: notas, clausulaExclusiones: exclusiones } : it))
                  );
                }}
                onUpdateParametros={(params) => vm.handleUpdateItemParametros(item.id, params)}
              />
            );
          })}
        </div>
      )}

      {/* Capítulos y sus Partidas */}
      {capitulos.map((cap) => {
        const capRawItems = items.filter((it) => it.capituloId === cap.id);
        const capCalculatedItems = capRawItems.map((it) => calculatedItemsMap.get(it.id) || it);
        const capTotals = totales?.capitulosTotales?.[cap.id];
        const isCollapsed = vm.collapsedChapters.has(cap.id);

        return (
          <div key={cap.id} className="mb-3">
            <MobileChapterCard
              capitulo={cap}
              items={capCalculatedItems}
              capituloTotales={capTotals}
              isCollapsed={isCollapsed}
              isSelected={vm.selectedChapterId === cap.id}
              onToggleCollapse={() => vm.toggleChapterCollapse(cap.id)}
              onSelect={() => vm.handleSelectRow(null, cap.id)}
              onAddItem={() => vm.handleCreateItem(cap.id)}
              onRenameChapter={(nombre) => vm.handleRenameChapter(cap.id, nombre)}
              onRemoveChapter={() => vm.handleRemoveChapter(cap.id)}
            />

            {!isCollapsed && (
              <div className="pl-1 pr-0.5">
                {capRawItems.length === 0 ? (
                  <div className="p-4 mb-2 rounded-2xl bg-surface-container-lowest border border-dashed border-outline-variant/30 text-xs text-on-surface-variant flex items-center justify-between">
                    <span>Capítulo sin partidas agregadas.</span>
                    <button
                      type="button"
                      onClick={() => vm.handleCreateItem(cap.id)}
                      className="font-bold text-primary hover:underline cursor-pointer"
                    >
                      + Agregar
                    </button>
                  </div>
                ) : (
                  capRawItems.map((rawItem) => {
                    const item = calculatedItemsMap.get(rawItem.id) || rawItem;
                    return (
                      <MobileTreeItemCard
                        key={item.id}
                        item={item}
                        isSelected={vm.selectedItemId === item.id}
                        isExpanded={vm.expandedItems.has(item.id)}
                        onToggleExpand={() => vm.toggleItemExpand(item.id)}
                        onSelect={() => vm.handleSelectRow(item.id, item.capituloId || null)}
                        onOpenQuantitySheet={() => setQuantitySheetItemId(item.id)}
                        onQuickStepQty={(delta) => handleQuickStepQty(item.id, delta)}
                        onOpenQuickParamModal={vm.handleOpenQuickParamModal}
                        onMoveUp={() => vm.handleMoveItem(item.id, 'up')}
                        onMoveDown={() => vm.handleMoveItem(item.id, 'down')}
                        onRemove={() => vm.handleRemoveItem(item.id)}
                        onSaveAsTareaTipo={onSaveAsTareaTipo ? () => onSaveAsTareaTipo(item) : undefined}
                        insumosMap={insumosMap}
                        manoObraMap={manoObraMap}
                        calculosVariables={calculosVariables}
                        onAddMaterial={(mat, qty, formula) => vm.handleAddMaterialToItem(item.id, mat, qty, formula)}
                        onRemoveMaterial={(mIdx) => vm.handleRemoveMaterialFromItem(item.id, mIdx)}
                        onUpdateMaterialFormula={(mIdx, formula) => vm.handleUpdateMaterialFormula(item.id, mIdx, formula)}
                        onOpenMaterialCatalog={() => vm.handleOpenMaterialPicker(item.id)}
                        onAddLabor={(catId, hs, formula) => vm.handleAddLaborToItem(item.id, catId, hs, formula)}
                        onRemoveLabor={(lIdx) => vm.handleRemoveLaborFromItem(item.id, lIdx)}
                        onUpdateLaborFormula={(lIdx, formula) => vm.handleUpdateLaborFormula(item.id, lIdx, formula)}
                        onAddService={(desc, cost) => vm.handleAddServiceToItem(item.id, desc, cost)}
                        onRemoveService={(sIdx) => vm.handleRemoveServiceFromItem(item.id, sIdx)}
                        onUpdateNotas={(notas, exclusiones) => {
                          setItems((prev) =>
                            prev.map((it) => (it.id === item.id ? { ...it, notasTecnicas: notas, clausulaExclusiones: exclusiones } : it))
                          );
                        }}
                        onUpdateParametros={(params) => vm.handleUpdateItemParametros(item.id, params)}
                      />
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Bottom Sheet de Edición de Cantidad */}
      {quantitySheetItem && (
        <MobileQuantitySheet
          isOpen={Boolean(quantitySheetItemId)}
          onClose={() => setQuantitySheetItemId(null)}
          item={quantitySheetItem}
          calculosVariables={calculosVariables}
          onConfirm={handleConfirmQuantity}
          onOpenQuickParams={vm.handleOpenQuickParamModal}
        />
      )}
    </div>
  );
};
