import React from 'react';
import { CategoriaMaterial, Material, Producto, Oferta, Contacto, MaterialFilterContext } from '../../core/types';
import { db } from '../../db/database';
import { INITIAL_CATEGORIAS_MATERIAL } from '../../core/sampleData';
import { useToast } from '../../contexts/ToastContext';
import { MaterialEditorModal } from './MaterialEditorModal';
import { QuickCreateMaterialModal } from './QuickCreateMaterialModal';
import { ProductoEditorModal } from './ProductoEditorModal';
import { OfertaEditorModal } from './OfertaEditorModal';
import { MassPriceAdjustModal } from './MassPriceAdjustModal';
import { BlockPriceModal } from './BlockPriceModal';
import { ImportCatalogModal } from '../ImportCatalogModal';

interface InsumosManagerModalsProps {
  isCreatingMat: boolean;
  setIsCreatingMat: (v: boolean) => void;
  editingMat: Material | null;
  setEditingMat: (m: Material | null) => void;
  categorias: CategoriaMaterial[];
  categoriasMap: Map<string, CategoriaMaterial>;
  formDataMat: any;
  setFormDataMat: any;
  onCategoryChange: (catId: string) => void;
  onAttributeValueChange: (k: string, v: string) => void;
  onAddCustomAttribute: () => void;
  onUpdateCustomAttrKey: (index: number, newKey: string) => void;
  onRemoveAttribute: (k: string) => void;
  onAutoGenerateName: () => void;
  onOpenCreateCat: () => void;
  onSaveMaterial: (e: React.FormEvent) => void;

  isQuickCreateMat: boolean;
  setIsQuickCreateMat: (v: boolean) => void;
  formDataQuickMat: any;
  setFormDataQuickMat: any;
  proveedores: Contacto[];
  modoCargaContinua: boolean;
  setModoCargaContinua: (v: boolean | ((prev: boolean) => boolean)) => void;
  onSaveQuickMat: (e: React.FormEvent) => void;

  isCreatingProd: boolean;
  setIsCreatingProd: (v: boolean) => void;
  formDataProd: any;
  setFormDataProd: any;
  onSaveProducto: (e: React.FormEvent) => void;

  isCreatingOferta: boolean;
  setIsCreatingOferta: (v: boolean) => void;
  editingOferta: Oferta | null;
  setEditingOferta: (o: Oferta | null) => void;
  productos: Producto[];
  targetMatId: string;
  formDataOferta: any;
  setFormDataOferta: any;
  materiales: Material[];
  onSaveOferta: (e: React.FormEvent) => void;

  showMassUpdateModal: boolean;
  setShowMassUpdateModal: (v: boolean) => void;
  tipoAjusteIndice: any;
  setTipoAjusteIndice: any;
  massPercentage: number;
  setMassPercentage: any;
  onApplyMassUpdate: any;

  showBlockPriceModal: boolean;
  setShowBlockPriceModal: (v: boolean) => void;
  selectedMaterialIds: Set<string>;
  filterContext?: MaterialFilterContext | null;
  filteredMateriales: Material[];
  selectedCategory: string;
  searchTerm: string;
  onApplyBlockPrice: any;

  showImportCatalogModal: boolean;
  setShowImportCatalogModal: (v: boolean) => void;
}

export const InsumosManagerModals: React.FC<InsumosManagerModalsProps> = ({
  isCreatingMat,
  setIsCreatingMat,
  editingMat,
  setEditingMat,
  categorias,
  categoriasMap,
  formDataMat,
  setFormDataMat,
  onCategoryChange,
  onAttributeValueChange,
  onAddCustomAttribute,
  onUpdateCustomAttrKey,
  onRemoveAttribute,
  onAutoGenerateName,
  onOpenCreateCat,
  onSaveMaterial,

  isQuickCreateMat,
  setIsQuickCreateMat,
  formDataQuickMat,
  setFormDataQuickMat,
  proveedores,
  modoCargaContinua,
  setModoCargaContinua,
  onSaveQuickMat,

  isCreatingProd,
  setIsCreatingProd,
  formDataProd,
  setFormDataProd,
  onSaveProducto,

  isCreatingOferta,
  setIsCreatingOferta,
  editingOferta,
  setEditingOferta,
  productos,
  targetMatId,
  formDataOferta,
  setFormDataOferta,
  materiales,
  onSaveOferta,

  showMassUpdateModal,
  setShowMassUpdateModal,
  tipoAjusteIndice,
  setTipoAjusteIndice,
  massPercentage,
  setMassPercentage,
  onApplyMassUpdate,

  showBlockPriceModal,
  setShowBlockPriceModal,
  selectedMaterialIds,
  filterContext,
  filteredMateriales,
  selectedCategory,
  searchTerm,
  onApplyBlockPrice,

  showImportCatalogModal,
  setShowImportCatalogModal
}) => {
  const { toast } = useToast();

  return (
    <>
      <MaterialEditorModal
        isOpen={isCreatingMat}
        onClose={() => {
          setIsCreatingMat(false);
          setEditingMat(null);
        }}
        editingMat={editingMat}
        categorias={categorias}
        categoriasMap={categoriasMap}
        formDataMat={formDataMat}
        setFormDataMat={setFormDataMat}
        onCategoryChange={onCategoryChange}
        onAttributeValueChange={onAttributeValueChange}
        onAddCustomAttribute={onAddCustomAttribute}
        onUpdateCustomAttrKey={onUpdateCustomAttrKey}
        onRemoveAttribute={onRemoveAttribute}
        onAutoGenerateName={onAutoGenerateName}
        onOpenCreateCat={onOpenCreateCat}
        onRestoreDefaultCategories={async () => {
          await db.categoriasMaterial.bulkPut(INITIAL_CATEGORIAS_MATERIAL);
          toast.success('Categorías restauradas');
        }}
        onSave={onSaveMaterial}
      />

      <QuickCreateMaterialModal
        isOpen={isQuickCreateMat}
        onClose={() => setIsQuickCreateMat(false)}
        formDataQuickMat={formDataQuickMat}
        setFormDataQuickMat={setFormDataQuickMat}
        proveedores={proveedores}
        modoCargaContinua={modoCargaContinua}
        setModoCargaContinua={setModoCargaContinua}
        onSave={onSaveQuickMat}
      />

      <ProductoEditorModal
        isOpen={isCreatingProd}
        onClose={() => setIsCreatingProd(false)}
        formDataProd={formDataProd}
        setFormDataProd={setFormDataProd}
        onSave={onSaveProducto}
      />

      <OfertaEditorModal
        isOpen={isCreatingOferta}
        onClose={() => {
          setIsCreatingOferta(false);
          setEditingOferta(null);
        }}
        editingOferta={editingOferta}
        proveedores={proveedores}
        productos={productos.filter(p => p.materialId === (formDataOferta.materialId || targetMatId))}
        formDataOferta={formDataOferta}
        setFormDataOferta={setFormDataOferta}
        unidadVenta={materiales.find(m => m.id === (formDataOferta.materialId || targetMatId))?.unidadVenta || 'u'}
        onSave={onSaveOferta}
      />

      <MassPriceAdjustModal
        isOpen={showMassUpdateModal}
        onClose={() => setShowMassUpdateModal(false)}
        tipoAjusteIndice={tipoAjusteIndice}
        setTipoAjusteIndice={setTipoAjusteIndice}
        massPercentage={massPercentage}
        setMassPercentage={setMassPercentage}
        onApply={onApplyMassUpdate}
      />

      <BlockPriceModal
        isOpen={showBlockPriceModal}
        onClose={() => setShowBlockPriceModal(false)}
        targetMaterials={
          selectedMaterialIds.size > 0
            ? materiales.filter(m => selectedMaterialIds.has(m.id))
            : (filterContext
                ? filteredMateriales
                : (selectedCategory === 'todas' && !searchTerm ? materiales : filteredMateriales))
        }
        proveedores={proveedores}
        onApply={onApplyBlockPrice}
      />

      <ImportCatalogModal
        isOpen={showImportCatalogModal}
        onClose={() => setShowImportCatalogModal(false)}
        onSuccess={() => {
          setShowImportCatalogModal(false);
          toast.success('Catálogo importado exitosamente');
        }}
      />
    </>
  );
};
