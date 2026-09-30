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
import { MobileItemDetailSheet } from './MobileItemDetailSheet';
import { MobileItemActionSheet } from './MobileItemActionSheet';
import { MobileChapterActionSheet } from './MobileChapterActionSheet';

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
  const [activeDetailItemId, setActiveDetailItemId] = useState<string | null>(null);
  const [actionSheetItemId, setActionSheetItemId] = useState<string | null>(null);
  const [actionSheetChapterId, setActionSheetChapterId] = useState<string | null>(null);
  const [renamingChapterId, setRenamingChapterId] = useState<string | null>(null);

  const quantitySheetItem = items.find((it) => it.id === quantitySheetItemId) || null;

  const currentDetailIndex = activeDetailItemId ? items.findIndex((it) => it.id === activeDetailItemId) : -1;
  const activeDetailItem = activeDetailItemId
    ? (calculatedItemsMap.get(activeDetailItemId) || items.find((it) => it.id === activeDetailItemId) || null)
    : null;

  // Resolución del item para el Bottom Sheet de Acciones
  const actionSheetItem = actionSheetItemId
    ? (calculatedItemsMap.get(actionSheetItemId) || items.find((it) => it.id === actionSheetItemId) || null)
    : null;

  let isItemFirst = false;
  let isItemLast = false;
  if (actionSheetItem) {
    if (actionSheetItem.capituloId) {
      const chapterItems = items.filter((it) => it.capituloId === actionSheetItem.capituloId);
      const idx = chapterItems.findIndex((it) => it.id === actionSheetItem.id);
      isItemFirst = idx === 0;
      isItemLast = idx === chapterItems.length - 1;
    } else {
      const orphanItemsList = items.filter((it) => !it.capituloId);
      const idx = orphanItemsList.findIndex((it) => it.id === actionSheetItem.id);
      isItemFirst = idx === 0;
      isItemLast = idx === orphanItemsList.length - 1;
    }
  }

  // Resolución del capítulo para el Bottom Sheet de Acciones
  const actionSheetChapter = actionSheetChapterId
    ? capitulos.find((c) => c.id === actionSheetChapterId) || null
    : null;
  const actionSheetChapterItems = actionSheetChapter
    ? items.filter((it) => it.capituloId === actionSheetChapter.id)
    : [];
  const actionSheetChapterTotals = actionSheetChapter
    ? totales?.capitulosTotales?.[actionSheetChapter.id]
    : undefined;
  const actionSheetChapterFinalPrice =
    actionSheetChapterTotals?.precioVentaTotal ??
    (actionSheetChapterTotals && 'precioFinal' in actionSheetChapterTotals ? (actionSheetChapterTotals as any).precioFinal : undefined) ??
    actionSheetChapterItems.reduce((acc, it) => acc + (it.precioFinalItem ?? it.precioVentaTotal ?? it.costoDirectoTotal ?? 0), 0);

  const handleNextDetailItem = () => {
    if (currentDetailIndex >= 0 && currentDetailIndex < items.length - 1) {
      setActiveDetailItemId(items[currentDetailIndex + 1].id);
    }
  };

  const handlePrevDetailItem = () => {
    if (currentDetailIndex > 0) {
      setActiveDetailItemId(items[currentDetailIndex - 1].id);
    }
  };

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

  const handleOpenParametricForItem = (item: ItemPresupuesto) => {
    if (!onOpenParametricJobModal) return;
    const taskConfig = item.tareaTipoConfig || (tareasTipo ? tareasTipo.find((t: any) => t.id === item.tareaTipoId) : null) || {
      id: item.tareaTipoId || `tt-${item.id}`,
      nombre: item.descripcion,
      categoria: 'Personalizado',
      unidad: item.unidad || 'u',
      parametros: (item.parametros || []).map((p: any) => ({
        id: p.id,
        nombre: p.nombre || p.id,
        tipo: 'numero',
        valorDefault: p.valor,
        unidad: p.unidad
      }))
    };
    const itemIndex = items.findIndex((it) => it.id === item.id);
    onOpenParametricJobModal(taskConfig, itemIndex >= 0 ? itemIndex : undefined);
  };

  const orphanItems = items.filter((it) => !it.capituloId);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 bg-surface select-none pb-28">
      {/* Estado vacío si no hay rubros ni ítems */}
      {capitulos.length === 0 && items.length === 0 && (
        <div className="flex flex-col items-center justify-center p-8 text-center text-on-surface-variant/70 min-h-[300px]">
          <p className="text-base font-semibold mb-1 text-on-surface">Cotización Vacía</p>
          <p className="text-xs mb-5 max-w-xs leading-relaxed">
            Comenzá agregando un rubro o incorporando tareas tipo desde el catálogo oficial.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full max-w-xs">
            <button
              type="button"
              onClick={() => vm.handleCreateChapter('Instalaciones Eléctricas')}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold bg-primary text-on-primary rounded-xl cursor-pointer shadow-xs active:scale-95 min-h-[44px]"
            >
              <FolderPlus className="w-4 h-4" />
              <span>+ Primer Rubro</span>
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

      {/* Ítems Generales sin Rubro */}
      {orphanItems.length > 0 && (
        <div className="mb-4">
          <div className="px-2 py-1.5 mb-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center justify-between">
            <span>Ítems Generales</span>
            <span className="font-mono text-[10px] text-on-surface-variant/70">
              {orphanItems.length} {orphanItems.length === 1 ? 'ítem' : 'ítems'}
            </span>
          </div>

          {orphanItems.map((rawItem) => {
            const item = calculatedItemsMap.get(rawItem.id) || rawItem;
            return (
              <MobileTreeItemCard
                key={item.id}
                item={item}
                isSelected={vm.selectedItemId === item.id}
                onSelect={() => vm.handleSelectRow(item.id, null)}
                onOpenQuantitySheet={() => setQuantitySheetItemId(item.id)}
                onQuickStepQty={(delta) => handleQuickStepQty(item.id, delta)}
                onOpenQuickParamModal={vm.handleOpenQuickParamModal}
                onOpenParametric={
                  (item.tareaTipoId || item.tareaTipoConfig) && onOpenParametricJobModal
                    ? () => handleOpenParametricForItem(item)
                    : undefined
                }
                onOpenDetail={() => setActiveDetailItemId(item.id)}
                onOpenActions={() => setActionSheetItemId(item.id)}
                onMoveUp={() => vm.handleMoveItem(item.id, 'up')}
                onMoveDown={() => vm.handleMoveItem(item.id, 'down')}
                onRemove={() => vm.handleRemoveItem(item.id)}
                onSaveAsTareaTipo={onSaveAsTareaTipo ? () => onSaveAsTareaTipo(item) : undefined}
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
              isEditingExternal={renamingChapterId === cap.id}
              onToggleCollapse={() => vm.toggleChapterCollapse(cap.id)}
              onSelect={() => vm.handleSelectRow(null, cap.id)}
              onAddItem={() => vm.handleCreateItem(cap.id)}
              onRenameChapter={(nombre) => vm.handleRenameChapter(cap.id, nombre)}
              onFinishRename={() => setRenamingChapterId(null)}
              onRemoveChapter={() => vm.handleRemoveChapter(cap.id)}
              onOpenActions={() => setActionSheetChapterId(cap.id)}
            />

            {!isCollapsed && (
              <div className="pl-1 pr-0.5">
                {capRawItems.length === 0 ? (
                  <div className="p-4 mb-2 rounded-2xl bg-surface-container-lowest border border-dashed border-outline-variant/30 text-xs text-on-surface-variant flex items-center justify-between">
                    <span>Rubro sin ítems agregados.</span>
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
                        onSelect={() => vm.handleSelectRow(item.id, item.capituloId || null)}
                        onOpenQuantitySheet={() => setQuantitySheetItemId(item.id)}
                        onQuickStepQty={(delta) => handleQuickStepQty(item.id, delta)}
                        onOpenQuickParamModal={vm.handleOpenQuickParamModal}
                        onOpenParametric={
                          (item.tareaTipoId || item.tareaTipoConfig) && onOpenParametricJobModal
                            ? () => handleOpenParametricForItem(item)
                            : undefined
                        }
                        onOpenDetail={() => setActiveDetailItemId(item.id)}
                        onOpenActions={() => setActionSheetItemId(item.id)}
                        onMoveUp={() => vm.handleMoveItem(item.id, 'up')}
                        onMoveDown={() => vm.handleMoveItem(item.id, 'down')}
                        onRemove={() => vm.handleRemoveItem(item.id)}
                        onSaveAsTareaTipo={onSaveAsTareaTipo ? () => onSaveAsTareaTipo(item) : undefined}
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

      {/* Bottom Sheet de Detalle y Despiece de Ítem (Un Ojo, Una Mano) */}
      {activeDetailItem && (
        <MobileItemDetailSheet
          isOpen={Boolean(activeDetailItemId)}
          onClose={() => setActiveDetailItemId(null)}
          item={activeDetailItem}
          insumosMap={insumosMap}
          manoObraMap={manoObraMap}
          calculosVariables={calculosVariables}
          currentIndex={currentDetailIndex}
          totalItems={items.length}
          onPrevItem={handlePrevDetailItem}
          onNextItem={handleNextDetailItem}
          onAddMaterial={(mat, qty, formula) => vm.handleAddMaterialToItem(activeDetailItem.id, mat, qty, formula)}
          onRemoveMaterial={(mIdx) => vm.handleRemoveMaterialFromItem(activeDetailItem.id, mIdx)}
          onUpdateMaterialFormula={(mIdx, formula) => vm.handleUpdateMaterialFormula(activeDetailItem.id, mIdx, formula)}
          onOpenMaterialCatalog={() => vm.handleOpenMaterialPicker(activeDetailItem.id)}
          onAddLabor={(catId, hs, formula) => vm.handleAddLaborToItem(activeDetailItem.id, catId, hs, formula)}
          onRemoveLabor={(lIdx) => vm.handleRemoveLaborFromItem(activeDetailItem.id, lIdx)}
          onUpdateLaborFormula={(lIdx, formula) => vm.handleUpdateLaborFormula(activeDetailItem.id, lIdx, formula)}
          onAddService={(desc, cost) => vm.handleAddServiceToItem(activeDetailItem.id, desc, cost)}
          onRemoveService={(sIdx) => vm.handleRemoveServiceFromItem(activeDetailItem.id, sIdx)}
          onUpdateNotas={(notas, exclusiones) => {
            setItems((prev) =>
              prev.map((it) => (it.id === activeDetailItem.id ? { ...it, notasTecnicas: notas, clausulaExclusiones: exclusiones } : it))
            );
          }}
          onUpdateParametros={(params) => vm.handleUpdateItemParametros(activeDetailItem.id, params)}
        />
      )}

      {/* Bottom Sheet de Acciones de Ítem (Un Ojo, Una Mano) */}
      {actionSheetItem && (
        <MobileItemActionSheet
          isOpen={Boolean(actionSheetItemId)}
          onClose={() => setActionSheetItemId(null)}
          item={actionSheetItem}
          isFirst={isItemFirst}
          isLast={isItemLast}
          onMoveUp={() => vm.handleMoveItem(actionSheetItem.id, 'up')}
          onMoveDown={() => vm.handleMoveItem(actionSheetItem.id, 'down')}
          onOpenQuickParams={vm.handleOpenQuickParamModal}
          onOpenParametric={
            (actionSheetItem.tareaTipoId || actionSheetItem.tareaTipoConfig) && onOpenParametricJobModal
              ? () => handleOpenParametricForItem(actionSheetItem)
              : undefined
          }
          onSaveAsTareaTipo={onSaveAsTareaTipo ? () => onSaveAsTareaTipo(actionSheetItem) : undefined}
          onRemove={() => vm.handleRemoveItem(actionSheetItem.id)}
        />
      )}

      {/* Bottom Sheet de Acciones de Rubro (Un Ojo, Una Mano) */}
      {actionSheetChapter && (
        <MobileChapterActionSheet
          isOpen={Boolean(actionSheetChapterId)}
          onClose={() => setActionSheetChapterId(null)}
          capitulo={actionSheetChapter}
          itemCount={actionSheetChapterItems.length}
          totalPrecio={actionSheetChapterFinalPrice}
          onStartRename={() => {
            if (actionSheetChapter) {
              setRenamingChapterId(actionSheetChapter.id);
            }
          }}
          onOpenCatalog={() => {
            if (actionSheetChapter) {
              vm.handleSelectRow(null, actionSheetChapter.id);
              vm.handleOpenCatalogPicker(actionSheetChapter.id);
            }
          }}
          onRemove={() => {
            if (actionSheetChapter) {
              vm.handleRemoveChapter(actionSheetChapter.id);
            }
          }}
        />
      )}
    </div>
  );
};
