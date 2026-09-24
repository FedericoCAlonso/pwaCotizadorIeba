import React from 'react';
import { ChevronDown, ChevronUp, Layers, GraduationCap, Edit3, Sliders } from 'lucide-react';
import { ItemPresupuesto, CategoriaManoDeObra } from '../../../core/types';
import { formatARS } from '../../../core/calculations';
import { ItemServicesSection } from './ItemServicesSection';
import { ItemMaterialsSection } from './ItemMaterialsSection';
import { ItemLaborSection } from './ItemLaborSection';

interface ItemRowBreakdownAccordionProps {
  item: ItemPresupuesto;
  index: number;
  calcItem: ItemPresupuesto;
  isExpanded: boolean;
  isItemLibre: boolean;
  hasSnapshots: boolean;
  isParametric: boolean;
  categoriasManoObra?: CategoriaManoDeObra[];
  onToggleExpand: (id: string) => void;
  onOpenInSituEditor?: (index: number) => void;
  onOpenParametricModal?: (index: number) => void;
  onOpenMaterialPicker?: (index: number) => void;
  onOpenMaterialBrandModal?: (itemIndex: number, materialIndex: number) => void;
  onUpdateItemMaterialQuantity?: (itemIndex: number, materialIndex: number, newQty: number | null) => void;
  onRemoveItemMaterial?: (itemIndex: number, materialIndex: number) => void;
  onUpdateItemLaborHours?: (itemIndex: number, laborIndex: number, newHours: number | null) => void;
  onRemoveItemLabor?: (itemIndex: number, laborIndex: number) => void;
  onAddLaborRole?: (itemIndex: number, categoriaId: string, horas: number) => void;
}

export const ItemRowBreakdownAccordion: React.FC<ItemRowBreakdownAccordionProps> = ({
  item,
  index,
  calcItem,
  isExpanded,
  isItemLibre,
  hasSnapshots,
  isParametric,
  categoriasManoObra,
  onToggleExpand,
  onOpenInSituEditor,
  onOpenParametricModal,
  onOpenMaterialPicker,
  onOpenMaterialBrandModal,
  onUpdateItemMaterialQuantity,
  onRemoveItemMaterial,
  onUpdateItemLaborHours,
  onRemoveItemLabor,
  onAddLaborRole
}) => {
  if (!hasSnapshots && !isExpanded) return null;

  return (
    <div className="pt-1.5 border-t border-outline-variant/15">
      <button
        type="button"
        onClick={() => onToggleExpand(item.id)}
        className="w-full flex items-center justify-between p-3 rounded-xl text-sm sm:text-base text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          {item.naturaleza === 'servicio_profesional' ? (
            <GraduationCap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          ) : (
            <Layers className="w-5 h-5 text-primary" />
          )}
          <span className="font-semibold">
            {item.naturaleza === 'servicio_profesional'
              ? `Honorarios: ${formatARS(item.costoServicios || 0)}${item.insumosSnapshot?.length ? ` · ${item.insumosSnapshot.length} insumos` : ''}${item.manoObraSnapshot?.length ? ` · ${item.manoObraSnapshot.length} roles MO` : ''}`
              : `Desglose: ${item.insumosSnapshot?.length || 0} materiales · ${item.manoObraSnapshot?.length || 0} categorías MO`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-mono font-medium">
          <span>{isExpanded ? 'Ocultar' : 'Ver detalle'}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isExpanded && (
        <div className="mt-2 bg-surface-container-lowest p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-outline-variant/25 space-y-3.5 text-sm animate-in fade-in-50 duration-150">
          {/* Barra de Acceso Rápido a Edición Técnica */}
          {onOpenInSituEditor && (
            <div className="flex items-center justify-between pb-2.5 border-b border-outline-variant/15 flex-wrap gap-2">
              <span className="text-xs sm:text-sm font-semibold text-on-surface-variant flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <span>
                  {isItemLibre ? 'Estructura técnica de partida libre' : 'Estructura técnica de partida'}
                </span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenInSituEditor(index)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 rounded-xl transition shadow-2xs min-h-[38px] cursor-pointer"
                  title="Editar fórmulas matemáticas, lista de materiales y categorías de mano de obra"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Editar Fórmulas y Materiales</span>
                </button>
                {isParametric && onOpenParametricModal && (
                  <button
                    type="button"
                    onClick={() => onOpenParametricModal(index)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 rounded-xl transition shadow-2xs min-h-[38px] cursor-pointer"
                    title="Reajustar parámetros de cómputo"
                  >
                    <Sliders className="w-4 h-4" />
                    <span>Parámetros</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Honorarios / Servicios Tercerizados / APU Stats */}
          <ItemServicesSection item={item} calcItem={calcItem} />

          {/* Insumos Snapshot */}
          <ItemMaterialsSection
            item={item}
            index={index}
            onOpenMaterialBrandModal={onOpenMaterialBrandModal}
            onUpdateItemMaterialQuantity={onUpdateItemMaterialQuantity}
            onRemoveItemMaterial={onRemoveItemMaterial}
            onOpenMaterialPicker={onOpenMaterialPicker}
          />

          {/* Mano de Obra Snapshot & Inline Adder */}
          <ItemLaborSection
            item={item}
            index={index}
            isItemLibre={isItemLibre}
            categoriasManoObra={categoriasManoObra}
            onUpdateItemLaborHours={onUpdateItemLaborHours}
            onRemoveItemLabor={onRemoveItemLabor}
            onAddLaborRole={onAddLaborRole}
          />
        </div>
      )}
    </div>
  );
};
