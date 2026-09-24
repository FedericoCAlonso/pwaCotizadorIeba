import React from 'react';
import { ItemPresupuesto, CategoriaManoDeObra } from '../../core/types';
import { ItemRowHeader } from './row/ItemRowHeader';
import { ItemRowNotesSection } from './row/ItemRowNotesSection';
import { ItemRowNumericStrip } from './row/ItemRowNumericStrip';
import { ItemRowBreakdownAccordion } from './row/ItemRowBreakdownAccordion';

interface PresupuestoItemRowProps {
  item: ItemPresupuesto;
  index: number;
  calcItem: ItemPresupuesto;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onUpdateItemCondicion: (index: number, condicion: 'normal' | 'dificultosa' | 'favorable') => void;
  onUpdateItemQuantity: (index: number, qty: number | null, formula?: string) => void;
  onUpdateItemUnit: (index: number, unit: string) => void;
  onUpdateItemUnitDirectCost: (index: number, cost: number | null) => void;
  onUpdateItemDescription: (index: number, desc: string) => void;
  onUpdateItemNotasTecnicas?: (index: number, notas: string) => void;
  onRemoveItem: (index: number) => void;
  onSaveAsTemplate: (item: ItemPresupuesto) => void;
  onOpenParametricModal?: (index: number) => void;
  onOpenMaterialModal?: (index: number) => void;
  onOpenInSituEditor?: (index: number) => void;
  onOpenMaterialPicker?: (index: number) => void;
  onOpenMaterialBrandModal?: (itemIndex: number, materialIndex: number) => void;
  onUpdateItemMaterialQuantity?: (itemIndex: number, materialIndex: number, newQty: number | null) => void;
  onRemoveItemMaterial?: (itemIndex: number, materialIndex: number) => void;
  onUpdateItemManoObraCost?: (index: number, moCost: number | null) => void;
  onAddLaborRole?: (itemIndex: number, categoriaId: string, horas: number) => void;
  onUpdateItemLaborHours?: (itemIndex: number, laborIndex: number, newHours: number | null) => void;
  onRemoveItemLabor?: (itemIndex: number, laborIndex: number) => void;
  categoriasManoObra?: CategoriaManoDeObra[];
  condicionesTrabajo: Array<{ value: string; label: string }>;
  titleInputRef?: (el: HTMLInputElement | null) => void;
  onEnterAtEnd?: () => void;
}

export const PresupuestoItemRow: React.FC<PresupuestoItemRowProps> = ({
  item,
  index,
  calcItem,
  isExpanded,
  onToggleExpand,
  onUpdateItemCondicion,
  onUpdateItemQuantity,
  onUpdateItemUnit,
  onUpdateItemUnitDirectCost,
  onUpdateItemDescription,
  onUpdateItemNotasTecnicas,
  onRemoveItem,
  onSaveAsTemplate,
  onOpenParametricModal,
  onOpenMaterialModal,
  onOpenInSituEditor,
  onOpenMaterialPicker,
  onOpenMaterialBrandModal,
  onUpdateItemMaterialQuantity,
  onRemoveItemMaterial,
  onUpdateItemManoObraCost,
  onAddLaborRole,
  onUpdateItemLaborHours,
  onRemoveItemLabor,
  categoriasManoObra,
  condicionesTrabajo,
  titleInputRef,
  onEnterAtEnd
}) => {
  const hasSnapshots = Boolean(
    (item.insumosSnapshot && item.insumosSnapshot.length > 0) ||
    (item.manoObraSnapshot && item.manoObraSnapshot.length > 0) ||
    (item.costoServicios !== undefined && item.costoServicios > 0)
  );
  const isCustom = !item.tareaTipoId && !hasSnapshots;
  const isItemLibre = item.tipoItem === 'item_libre' || (!item.tareaTipoId && !item.materialId && !item.ofertaId);
  const hasParametrosValores = Boolean(
    (item.valoresVariables && Object.keys(item.valoresVariables).length > 0) ||
    item.parametrosTrabajoTipo ||
    item.tareaTipoId ||
    (item.tareaTipoConfig?.parametros && item.tareaTipoConfig.parametros.length > 0)
  );
  const isParametric = hasParametrosValores;
  const hasMaterialCalc = Boolean(item.parametrosEstimacionMaterial);

  return (
    <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 space-y-3.5 hover:border-outline-variant/50 transition-all shadow-2xs">
      {/* 1. Header de Partida (Índice, Título, Badge y Acción Primaria Contextual) */}
      <ItemRowHeader
        item={item}
        index={index}
        onUpdateItemDescription={onUpdateItemDescription}
        titleInputRef={titleInputRef}
        isItemLibre={isItemLibre}
        isCustom={isCustom}
        hasSnapshots={hasSnapshots}
        isParametric={isParametric}
        hasMaterialCalc={hasMaterialCalc}
        onOpenParametricModal={onOpenParametricModal}
        onOpenMaterialModal={onOpenMaterialModal}
        onOpenInSituEditor={onOpenInSituEditor}
        onOpenMaterialPicker={onOpenMaterialPicker}
        onToggleExpand={onToggleExpand}
        onSaveAsTemplate={onSaveAsTemplate}
        onRemoveItem={onRemoveItem}
      />

      {/* 2. Alcance Técnico y Chips Tonales */}
      <ItemRowNotesSection
        item={item}
        index={index}
        onUpdateItemNotasTecnicas={onUpdateItemNotasTecnicas}
        onOpenParametricModal={onOpenParametricModal}
        onOpenMaterialModal={onOpenMaterialModal}
      />

      {/* 3. Strip Numérico Limpio y Ergonómico (Cómputo x Costo = Total Venta) */}
      <ItemRowNumericStrip
        item={item}
        index={index}
        calcItem={calcItem}
        isItemLibre={isItemLibre}
        hasSnapshots={hasSnapshots}
        condicionesTrabajo={condicionesTrabajo}
        onUpdateItemQuantity={onUpdateItemQuantity}
        onUpdateItemUnit={onUpdateItemUnit}
        onUpdateItemCondicion={onUpdateItemCondicion}
        onUpdateItemUnitDirectCost={onUpdateItemUnitDirectCost}
        onUpdateItemManoObraCost={onUpdateItemManoObraCost}
        onEnterAtEnd={onEnterAtEnd}
      />

      {/* 4. Acordeón de Desglose Técnico (Progressive Disclosure) */}
      <ItemRowBreakdownAccordion
        item={item}
        index={index}
        calcItem={calcItem}
        isExpanded={isExpanded}
        isItemLibre={isItemLibre}
        hasSnapshots={hasSnapshots}
        isParametric={isParametric}
        categoriasManoObra={categoriasManoObra}
        onToggleExpand={onToggleExpand}
        onOpenInSituEditor={onOpenInSituEditor}
        onOpenParametricModal={onOpenParametricModal}
        onOpenMaterialPicker={onOpenMaterialPicker}
        onOpenMaterialBrandModal={onOpenMaterialBrandModal}
        onUpdateItemMaterialQuantity={onUpdateItemMaterialQuantity}
        onRemoveItemMaterial={onRemoveItemMaterial}
        onUpdateItemLaborHours={onUpdateItemLaborHours}
        onRemoveItemLabor={onRemoveItemLabor}
        onAddLaborRole={onAddLaborRole}
      />
    </div>
  );
};
