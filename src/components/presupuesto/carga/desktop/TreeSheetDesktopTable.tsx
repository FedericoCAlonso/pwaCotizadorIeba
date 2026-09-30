import React from 'react';
import {
  FolderPlus,
  BookOpen,
  Plus
} from 'lucide-react';
import { TreeSheetChapterRow } from '../TreeSheetChapterRow';
import { TreeSheetRow } from '../TreeSheetRow';
import { ItemPresupuesto, CapituloPresupuesto, Insumo, CategoriaManoDeObra } from '../../../../core/types';
import { TotalesPresupuestoResultado } from '../../../../core/calculations';
import { useTreeSheetViewModel } from '../../../../viewmodels/useTreeSheetViewModel';

export interface TreeSheetDesktopTableProps {
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

export const TreeSheetDesktopTable: React.FC<TreeSheetDesktopTableProps> = ({
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
  const orphanItems = items.filter((it) => !it.capituloId);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-surface pb-2">
      {/* Cabecera de Columnas: Costo Directo y Precio Final Simultáneos */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 bg-surface-container-high border-b border-outline-variant/30 text-xs font-bold text-on-surface-variant uppercase tracking-wider select-none shadow-2xs">
        <div className="flex-1 min-w-0 pr-2 pl-3">Descripción del Ítem</div>
        <div className="w-20 sm:w-24 shrink-0 px-2 text-right">Cantidad</div>
        <div className="hidden sm:block w-24 sm:w-28 shrink-0 px-2 text-right">Costo Unit.</div>
        <div className="w-28 sm:w-32 shrink-0 px-2 text-right">Costo Total</div>
        <div className="hidden md:block w-24 sm:w-28 shrink-0 px-2 text-right text-primary/80">P. Unit. Final</div>
        <div className="w-28 sm:w-36 shrink-0 px-2 text-right text-primary font-bold">Precio Final</div>
        <div className="w-20 sm:w-24 shrink-0 text-right pr-1">Acciones</div>
      </div>

      {/* Estado vacío si no hay rubros ni ítems */}
      {capitulos.length === 0 && items.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-on-surface-variant/70">
          <p className="text-sm font-semibold mb-1 text-on-surface">Cotización Vacía</p>
          <p className="text-xs mb-4 max-w-sm">
            Comenzá agregando un rubro (ej. Instalaciones Eléctricas) o insertando una tarea tipo del catálogo.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => vm.handleCreateChapter('Instalaciones Eléctricas')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-on-primary rounded-xl cursor-pointer shadow-xs active:scale-95"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>+ Primer Rubro</span>
            </button>
            <button
              type="button"
              onClick={() => vm.handleOpenCatalogPicker()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-surface-container-high text-on-surface rounded-xl border border-outline-variant/30 cursor-pointer active:scale-95"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Catálogo de Tareas</span>
            </button>
          </div>
        </div>
      )}

      {/* Ítems huérfanos sin rubro */}
      {orphanItems.length > 0 && (
        <div>
          <div className="px-4 py-1.5 bg-surface-container-lowest border-b border-outline-variant/20 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
            Ítems Generales (Sin Rubro)
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
                onCommitEditCell={(field, finalValue) => vm.handleCommitEditCell(item.id, field, finalValue)}
                onCancelEditCell={vm.handleCancelEditCell}
                onMoveUp={() => vm.handleMoveItem(item.id, 'up')}
                onMoveDown={() => vm.handleMoveItem(item.id, 'down')}
                onRemove={() => vm.handleRemoveItem(item.id)}
                onSaveAsTareaTipo={onSaveAsTareaTipo ? () => onSaveAsTareaTipo(item) : undefined}
                onOpenParametric={
                  onOpenParametricJobModal
                    ? () => {
                        const idx = items.findIndex((it) => it.id === item.id);
                        const tarea = item.tareaTipoConfig || (item.tareaTipoId ? tareasTipo?.find((t) => t.id === item.tareaTipoId) : undefined) || {
                          id: item.tareaTipoId || `tt-${item.id}`,
                          nombre: item.descripcion,
                          categoria: 'Personalizado',
                          unidad: item.unidad || 'u',
                          parametros: (item.parametros || []).map(p => ({
                            id: p.id,
                            nombre: p.nombre || p.id,
                            tipo: 'numero',
                            valorDefault: p.valor,
                            unidad: p.unidad
                          }))
                        };
                        if (idx !== -1) {
                          onOpenParametricJobModal(tarea, idx);
                        }
                      }
                    : undefined
                }
                onUpdateNotas={(notas, exclusiones) => {
                  setItems((prev) =>
                    prev.map((it) =>
                      it.id === item.id ? { ...it, notasTecnicas: notas, clausulaExclusiones: exclusiones } : it
                    )
                  );
                }}
                onAddMaterial={(mat, qty, formula) => vm.handleAddMaterialToItem(item.id, mat, qty, formula)}
                onRemoveMaterial={(mIdx) => vm.handleRemoveMaterialFromItem(item.id, mIdx)}
                onUpdateMaterialFormula={(mIdx, formula) => vm.handleUpdateMaterialFormula(item.id, mIdx, formula)}
                onOpenMaterialCatalog={() => vm.handleOpenMaterialPicker(item.id)}
                onAddLabor={(catId, hs, formula) => vm.handleAddLaborToItem(item.id, catId, hs, formula)}
                onRemoveLabor={(lIdx) => vm.handleRemoveLaborFromItem(item.id, lIdx)}
                onUpdateLaborFormula={(lIdx, formula) => vm.handleUpdateLaborFormula(item.id, lIdx, formula)}
                onAddService={(desc, cost) => vm.handleAddServiceToItem(item.id, desc, cost)}
                onRemoveService={(sIdx) => vm.handleRemoveServiceFromItem(item.id, sIdx)}
                onUpdateParametros={(params) => vm.handleUpdateItemParametros(item.id, params)}
                onNavigateCell={vm.handleNavigateCell}
                onOpenQuickParamModal={vm.handleOpenQuickParamModal}
                calculosVariables={calculosVariables}
              />
            );
          })}
        </div>
      )}

      {/* Rubros y sus Ítems */}
      {capitulos.map((cap) => {
        const capRawItems = items.filter((it) => it.capituloId === cap.id);
        const capCalculatedItems = capRawItems.map((it) => calculatedItemsMap.get(it.id) || it);
        const capCalculatedTotals = totales?.capitulosTotales?.[cap.id];

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
              onOpenCatalog={() => {
                vm.handleSelectRow(null, cap.id);
                vm.handleOpenCatalogPicker(cap.id);
              }}
              onRenameChapter={(nombre) => vm.handleRenameChapter(cap.id, nombre)}
              onRemoveChapter={() => vm.handleRemoveChapter(cap.id)}
            />

            {!vm.collapsedChapters.has(cap.id) && (
              <div>
                {capRawItems.length === 0 ? (
                  <div className="px-8 py-3 text-xs text-on-surface-variant/60 italic flex items-center justify-between bg-surface-container-lowest">
                    <span>Rubro sin ítems agregados.</span>
                    <div className="flex items-center gap-3 not-italic">
                      <button
                        type="button"
                        onClick={() => vm.handleCreateItem(cap.id)}
                        className="text-primary hover:underline font-semibold cursor-pointer"
                      >
                        + Agregar ítem
                      </button>
                      <span className="text-outline-variant/50">•</span>
                      <button
                        type="button"
                        onClick={() => {
                          vm.handleSelectRow(null, cap.id);
                          vm.handleOpenCatalogPicker(cap.id);
                        }}
                        className="text-tertiary hover:underline font-semibold cursor-pointer"
                      >
                        + Desde catálogo
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {capRawItems.map((rawItem) => {
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
                          onCommitEditCell={(field, finalValue) => vm.handleCommitEditCell(item.id, field, finalValue)}
                          onCancelEditCell={vm.handleCancelEditCell}
                          onMoveUp={() => vm.handleMoveItem(item.id, 'up')}
                          onMoveDown={() => vm.handleMoveItem(item.id, 'down')}
                          onRemove={() => vm.handleRemoveItem(item.id)}
                          onSaveAsTareaTipo={onSaveAsTareaTipo ? () => onSaveAsTareaTipo(item) : undefined}
                          onOpenParametric={
                            onOpenParametricJobModal
                              ? () => {
                                  const idx = items.findIndex((it) => it.id === item.id);
                                  const tarea = item.tareaTipoConfig || (item.tareaTipoId ? tareasTipo?.find((t) => t.id === item.tareaTipoId) : undefined) || {
                                    id: item.tareaTipoId || `tt-${item.id}`,
                                    nombre: item.descripcion,
                                    categoria: 'Personalizado',
                                    unidad: item.unidad || 'u',
                                    parametros: (item.parametros || []).map(p => ({
                                      id: p.id,
                                      nombre: p.nombre || p.id,
                                      tipo: 'numero',
                                      valorDefault: p.valor,
                                      unidad: p.unidad
                                    }))
                                  };
                                  if (idx !== -1) {
                                    onOpenParametricJobModal(tarea, idx);
                                  }
                                }
                              : undefined
                          }
                          onUpdateNotas={(notas, exclusiones) => {
                            setItems((prev) =>
                              prev.map((it) =>
                                it.id === item.id ? { ...it, notasTecnicas: notas, clausulaExclusiones: exclusiones } : it
                              )
                            );
                          }}
                          onAddMaterial={(mat, qty, formula) => vm.handleAddMaterialToItem(item.id, mat, qty, formula)}
                          onRemoveMaterial={(mIdx) => vm.handleRemoveMaterialFromItem(item.id, mIdx)}
                          onUpdateMaterialFormula={(mIdx, formula) => vm.handleUpdateMaterialFormula(item.id, mIdx, formula)}
                          onOpenMaterialCatalog={() => vm.handleOpenMaterialPicker(item.id)}
                          onAddLabor={(catId, hs, formula) => vm.handleAddLaborToItem(item.id, catId, hs, formula)}
                          onRemoveLabor={(lIdx) => vm.handleRemoveLaborFromItem(item.id, lIdx)}
                          onUpdateLaborFormula={(lIdx, formula) => vm.handleUpdateLaborFormula(item.id, lIdx, formula)}
                          onAddService={(desc, cost) => vm.handleAddServiceToItem(item.id, desc, cost)}
                          onRemoveService={(sIdx) => vm.handleRemoveServiceFromItem(item.id, sIdx)}
                          onUpdateParametros={(params) => vm.handleUpdateItemParametros(item.id, params)}
                          onNavigateCell={vm.handleNavigateCell}
                          onOpenQuickParamModal={vm.handleOpenQuickParamModal}
                          calculosVariables={calculosVariables}
                        />
                      );
                    })}

                    {/* Barra de Inserción Rápida Contextual en Rubro */}
                    <div className="flex items-center gap-3 px-8 py-2 bg-surface-container-lowest/60 border-t border-dashed border-outline-variant/20 text-xs">
                      <button
                        type="button"
                        onClick={() => vm.handleCreateItem(cap.id)}
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                        title="Agregar ítem libre en este rubro"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar Ítem</span>
                      </button>
                      <span className="text-outline-variant/60">•</span>
                      <button
                        type="button"
                        onClick={() => {
                          vm.handleSelectRow(null, cap.id);
                          vm.setIsCatalogPickerOpen(true);
                        }}
                        className="inline-flex items-center gap-1 font-semibold text-tertiary hover:text-tertiary/80 transition-colors cursor-pointer"
                        title="Agregar trabajo tipo desde catálogo a este rubro"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Catálogo (Trabajo Tipo)</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
