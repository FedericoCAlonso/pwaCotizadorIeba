import React from 'react';
import {
  AppConfig,
  ItemPresupuesto,
  TipoFactura,
  MaterialFilterContext,
  CostoIndirecto,
  CapituloPresupuesto,
  GastoPresupuestoConfig,
  Presupuesto,
  Cliente,
  TareaTipo,
  Insumo,
  CategoriaManoDeObra,
  OpcionesEmisionPresupuesto,
  ParametrosEstimacionMaterial
} from '../../../core/types';
import { TotalesPresupuestoResultado } from '../../../core/calculations';
import { ItemPickerModal } from '../ItemPickerModal';
import { EmisionPresupuestoModal } from '../EmisionPresupuestoModal';
import { WhatsAppShareModal } from '../WhatsAppShareModal';
import { ListaMaterialesModal } from '../ListaMaterialesModal';
import { ParametricJobModal } from '../ParametricJobModal';
import { ParametricMaterialModal } from '../ParametricMaterialModal';
import { GastoEditorModal } from '../GastoEditorModal';
import { GastoCatalogPickerModal } from '../GastoCatalogPickerModal';
import { ParametricGastoModal } from '../ParametricGastoModal';
import { ActualizarPreciosModal } from '../ActualizarPreciosModal';
import { MaterialBrandModal, ApplyBrandPayload } from '../MaterialBrandModal';
import { SaveAsTareaTipoModal } from '../../SaveAsTareaTipoModal';
import { TareaEditorModal, TareaFormData } from '../../tareasTipo/TareaEditorModal';
import { MaterialPickerModal, StagedItemPayload } from '../../tareasTipo/MaterialPickerModal';

export interface SaveAsTemplateData {
  nombre: string;
  notasTecnicas?: string;
  naturaleza?: 'instalacion' | 'servicio_profesional' | 'servicio_tercerizado';
  honorarioBase?: number;
  formulaHonorarios?: string;
  costoServicioDirecto?: number;
  costoFijoOperativo?: number;
  descripcionCostoFijo?: string;
  clausulaExclusiones?: string;
  parametros?: any[];
  variables?: any[];
  insumos: any[];
  manoObra: any[];
  unidad?: string;
}

export interface PresupuestoEditorModalsProps {
  // Config & Catalog Maps
  config: AppConfig;
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
  manoObraList: CategoriaManoDeObra[];
  tareasTipo: TareaTipo[];
  costosIndirectos: CostoIndirecto[];
  categoriasTarea: string[];
  tipoFactura: TipoFactura;

  // Data Objects
  items: ItemPresupuesto[];
  capitulos: CapituloPresupuesto[];
  gastosConfig: GastoPresupuestoConfig[];
  totales: TotalesPresupuestoResultado;
  currentPresupuestoObj: Presupuesto;
  selectedCliente: Cliente | null;

  // Item Picker Modal
  showItemPickerModal: boolean;
  setShowItemPickerModal: (val: boolean) => void;
  targetCapituloIdForModal?: string;
  onSelectTareaFromPicker: (tarea: TareaTipo) => void;
  onConfigureParametricTareaFromPicker: (tarea: TareaTipo) => void;
  onAddCustomItemFromPicker: (desc: string) => void;
  onAddCapituloFromPicker: () => void;

  // Parametric Job Modal
  showParametricModal: boolean;
  setShowParametricModal: (val: boolean) => void;
  selectedTareaForParametricModal: TareaTipo | null;
  setSelectedTareaForParametricModal: (t: TareaTipo | null) => void;
  editingItemIndexForParametricModal: number | null;
  setEditingItemIndexForParametricModal: (idx: number | null) => void;
  onConfirmParametricJob: (tarea: TareaTipo, res: any) => void;

  // Parametric Material Modal
  showParametricMaterialModal: boolean;
  setShowParametricMaterialModal: (val: boolean) => void;
  editingItemIndexForMaterialModal: number | null;
  setEditingItemIndexForMaterialModal: (idx: number | null) => void;
  onApplyMaterialEstimation: (resultado: {
    cantidad: number;
    formula: string;
    parametrosEstimacion: ParametrosEstimacionMaterial;
  }) => void;

  // Emisión Modal
  showEmitirModal: boolean;
  setShowEmitirModal: (val: boolean) => void;
  opcionesEmision: OpcionesEmisionPresupuesto;
  setOpcionesEmision: React.Dispatch<React.SetStateAction<OpcionesEmisionPresupuesto>>;
  condicionesPagoTexto: string;
  onConfirmEmitir: (opciones: OpcionesEmisionPresupuesto) => void;

  // Save As Template Modal
  showSaveAsTemplateModal: boolean;
  setShowSaveAsTemplateModal: (val: boolean) => void;
  saveAsTemplateData: SaveAsTemplateData;

  // In Situ Task Editor Modal
  showInSituEditorModal: boolean;
  setShowInSituEditorModal: (val: boolean) => void;
  editingTareaForInSituModal: TareaTipo | null;
  onSaveInSituItem: (data: TareaFormData) => Promise<void>;

  // Material Picker Modal for Custom Items
  materialPickerItemIndex: number | null;
  setMaterialPickerItemIndex: (idx: number | null) => void;
  onAddMaterialsToItem: (itemIndex: number, stagedItems: StagedItemPayload[]) => void;

  // Material Brand Modal
  brandModalTarget: { itemIndex: number; materialIndex: number } | null;
  setBrandModalTarget: (target: { itemIndex: number; materialIndex: number } | null) => void;
  onApplyMaterialBrand: (payload: ApplyBrandPayload) => void;

  // Gastos Modals
  showGastoModal: boolean;
  setShowGastoModal: (val: boolean) => void;
  editingGasto: GastoPresupuestoConfig | null;
  setEditingGasto: (g: GastoPresupuestoConfig | null) => void;
  onSaveGasto: (gasto: GastoPresupuestoConfig) => void;
  onRemoveGasto: (id: string) => void;

  showGastoCatalogPickerModal: boolean;
  setShowGastoCatalogPickerModal: (val: boolean) => void;
  onAddGastosFromCatalog: (gastos: CostoIndirecto[]) => void;

  parametricGastoToAdjust: GastoPresupuestoConfig | null;
  setParametricGastoToAdjust: (g: GastoPresupuestoConfig | null) => void;
  onUpdateGastoParametros: (id: string, valores: Record<string, any>) => void;

  // WhatsApp & BOM Modals
  showWhatsAppModal: boolean;
  setShowWhatsAppModal: (val: boolean) => void;
  showListaMaterialesModal: boolean;
  setShowListaMaterialesModal: (val: boolean) => void;
  onViewMaterialsInCatalog?: (ctx: MaterialFilterContext) => void;
  onOpenMaterialsInCatalog: () => void;

  // Price Update Modal
  showActualizarPreciosModal: boolean;
  setShowActualizarPreciosModal: (val: boolean) => void;
  analisisPreciosModal: any;
  onConfirmActualizarPrecios: (resultado: any) => void;
}

export const PresupuestoEditorModals: React.FC<PresupuestoEditorModalsProps> = ({
  config,
  insumosMap,
  manoObraMap,
  manoObraList,
  tareasTipo,
  costosIndirectos,
  categoriasTarea,
  tipoFactura,
  items,
  capitulos,
  gastosConfig,
  totales,
  currentPresupuestoObj,
  selectedCliente,

  showItemPickerModal,
  setShowItemPickerModal,
  onSelectTareaFromPicker,
  onConfigureParametricTareaFromPicker,
  onAddCustomItemFromPicker,
  onAddCapituloFromPicker,

  showParametricModal,
  setShowParametricModal,
  selectedTareaForParametricModal,
  setSelectedTareaForParametricModal,
  editingItemIndexForParametricModal,
  setEditingItemIndexForParametricModal,
  onConfirmParametricJob,

  showParametricMaterialModal,
  setShowParametricMaterialModal,
  editingItemIndexForMaterialModal,
  setEditingItemIndexForMaterialModal,
  onApplyMaterialEstimation,

  showEmitirModal,
  setShowEmitirModal,
  opcionesEmision,
  setOpcionesEmision,
  condicionesPagoTexto,
  onConfirmEmitir,

  showSaveAsTemplateModal,
  setShowSaveAsTemplateModal,
  saveAsTemplateData,

  showInSituEditorModal,
  setShowInSituEditorModal,
  editingTareaForInSituModal,
  onSaveInSituItem,

  materialPickerItemIndex,
  setMaterialPickerItemIndex,
  onAddMaterialsToItem,

  brandModalTarget,
  setBrandModalTarget,
  onApplyMaterialBrand,

  showGastoModal,
  setShowGastoModal,
  editingGasto,
  setEditingGasto,
  onSaveGasto,
  onRemoveGasto,

  showGastoCatalogPickerModal,
  setShowGastoCatalogPickerModal,
  onAddGastosFromCatalog,

  parametricGastoToAdjust,
  setParametricGastoToAdjust,
  onUpdateGastoParametros,

  showWhatsAppModal,
  setShowWhatsAppModal,
  showListaMaterialesModal,
  setShowListaMaterialesModal,
  onViewMaterialsInCatalog,
  onOpenMaterialsInCatalog,

  showActualizarPreciosModal,
  setShowActualizarPreciosModal,
  analisisPreciosModal,
  onConfirmActualizarPrecios
}) => {
  return (
    <>
      {/* 1. Item Picker Modal */}
      <ItemPickerModal
        isOpen={showItemPickerModal}
        onClose={() => setShowItemPickerModal(false)}
        tareasTipo={tareasTipo}
        insumosMap={insumosMap}
        manoObraMap={manoObraMap}
        onSelectTarea={onSelectTareaFromPicker}
        onConfigureParametricTarea={onConfigureParametricTareaFromPicker}
        onAddCustomItem={onAddCustomItemFromPicker}
        onAddCapitulo={onAddCapituloFromPicker}
      />

      {/* 2. Parametric Job Dynamic Variables & Formulas Modal */}
      {selectedTareaForParametricModal && (
        <ParametricJobModal
          isOpen={showParametricModal}
          onClose={() => {
            setShowParametricModal(false);
            setSelectedTareaForParametricModal(null);
            setEditingItemIndexForParametricModal(null);
          }}
          tarea={selectedTareaForParametricModal}
          initialParametros={
            editingItemIndexForParametricModal !== null
              ? items[editingItemIndexForParametricModal]?.valoresParametros
              : undefined
          }
          initialVariables={
            editingItemIndexForParametricModal !== null
              ? items[editingItemIndexForParametricModal]?.valoresVariables
              : undefined
          }
          initialClausula={
            editingItemIndexForParametricModal !== null
              ? items[editingItemIndexForParametricModal]?.clausulaExclusiones
              : undefined
          }
          insumosMap={insumosMap}
          manoObraMap={manoObraMap}
          tipoFactura={tipoFactura}
          onConfirm={(resultado) => {
            onConfirmParametricJob(selectedTareaForParametricModal, resultado);
          }}
        />
      )}

      {/* 3. Parametric Material Estimation Modal */}
      {showParametricMaterialModal &&
        editingItemIndexForMaterialModal !== null &&
        items[editingItemIndexForMaterialModal] && (
          <ParametricMaterialModal
            isOpen={showParametricMaterialModal}
            onClose={() => {
              setShowParametricMaterialModal(false);
              setEditingItemIndexForMaterialModal(null);
            }}
            materialNombre={items[editingItemIndexForMaterialModal].descripcion}
            unidad={items[editingItemIndexForMaterialModal].unidad || 'm'}
            initialCantidad={items[editingItemIndexForMaterialModal].cantidad}
            initialParametros={items[editingItemIndexForMaterialModal].parametrosEstimacionMaterial}
            onConfirm={onApplyMaterialEstimation}
          />
        )}

      {/* 4. Emisión Modal */}
      <EmisionPresupuestoModal
        isOpen={showEmitirModal}
        onClose={() => setShowEmitirModal(false)}
        opcionesEmision={opcionesEmision}
        setOpcionesEmision={setOpcionesEmision}
        condicionesPagoTexto={condicionesPagoTexto}
        totales={totales}
        onConfirmEmitir={onConfirmEmitir}
      />

      {/* 5. Save as Template Modal */}
      <SaveAsTareaTipoModal
        isOpen={showSaveAsTemplateModal}
        onClose={() => setShowSaveAsTemplateModal(false)}
        defaultNombre={saveAsTemplateData.nombre}
        defaultNotasTecnicas={saveAsTemplateData.notasTecnicas}
        naturaleza={saveAsTemplateData.naturaleza}
        honorarioBase={saveAsTemplateData.honorarioBase}
        formulaHonorarios={saveAsTemplateData.formulaHonorarios}
        costoServicioDirecto={saveAsTemplateData.costoServicioDirecto}
        costoFijoOperativo={saveAsTemplateData.costoFijoOperativo}
        descripcionCostoFijo={saveAsTemplateData.descripcionCostoFijo}
        clausulaExclusiones={saveAsTemplateData.clausulaExclusiones}
        parametros={saveAsTemplateData.parametros}
        variables={saveAsTemplateData.variables}
        unidad={saveAsTemplateData.unidad}
        insumos={saveAsTemplateData.insumos}
        manoObra={saveAsTemplateData.manoObra}
      />

      {/* 6. In-Situ Task APU Editor Modal */}
      {showInSituEditorModal && (
        <TareaEditorModal
          isOpen={showInSituEditorModal}
          onClose={() => setShowInSituEditorModal(false)}
          editingTarea={editingTareaForInSituModal}
          categoriasList={categoriasTarea}
          insumosMap={insumosMap}
          manoObraList={manoObraList}
          manoObraMap={manoObraMap}
          onSave={onSaveInSituItem}
          titleOverride="Componer Partida para esta Cotización (In-Situ)"
          submitButtonText="Aplicar a la Cotización"
        />
      )}

      {/* 7. Material Picker Modal for Custom Items */}
      {materialPickerItemIndex !== null && items[materialPickerItemIndex] && (
        <MaterialPickerModal
          isOpen={materialPickerItemIndex !== null}
          onClose={() => setMaterialPickerItemIndex(null)}
          insumosMap={insumosMap}
          alreadySelectedIds={(items[materialPickerItemIndex]?.insumosSnapshot || [])
            .map((i) => i.insumoId || i.materialId || '')
            .filter(Boolean)}
          titleOverride={`Materiales para "${items[materialPickerItemIndex]?.descripcion || 'Partida'}"`}
          subtitleOverride="Selecciona los insumos del catálogo que componen este trabajo"
          onAddMaterial={(mat, qty, formula) => {
            onAddMaterialsToItem(materialPickerItemIndex, [{ material: mat, cantidad: qty, formula }]);
          }}
          onAddMultipleMaterials={(stagedItems) => {
            onAddMaterialsToItem(materialPickerItemIndex, stagedItems);
          }}
        />
      )}

      {/* 8. Material Brand Modal */}
      {brandModalTarget !== null &&
        items[brandModalTarget.itemIndex]?.insumosSnapshot?.[brandModalTarget.materialIndex] && (
          <MaterialBrandModal
            isOpen={brandModalTarget !== null}
            onClose={() => setBrandModalTarget(null)}
            materialSnapshot={items[brandModalTarget.itemIndex].insumosSnapshot[brandModalTarget.materialIndex]}
            itemDescription={items[brandModalTarget.itemIndex]?.descripcion || 'Partida'}
            onApplyBrand={onApplyMaterialBrand}
          />
        )}

      {/* 9. Gasto Editor Modal */}
      <GastoEditorModal
        isOpen={showGastoModal}
        onClose={() => {
          setShowGastoModal(false);
          setEditingGasto(null);
        }}
        gastoToEdit={editingGasto}
        capitulos={capitulos}
        costosIndirectosCatalog={costosIndirectos}
        onSave={onSaveGasto}
        onDelete={onRemoveGasto}
        baseMateriales={totales.subtotalInsumosBase}
        baseManoObra={totales.subtotalManoObraBase}
        baseServicios={totales.subtotalServiciosBase}
        baseCostoDirecto={totales.costoGlobal}
      />

      {/* 10. Gasto Catalog Picker Modal */}
      <GastoCatalogPickerModal
        isOpen={showGastoCatalogPickerModal}
        onClose={() => setShowGastoCatalogPickerModal(false)}
        catalogGastos={costosIndirectos}
        currentGastosConfig={gastosConfig}
        onAddGastos={onAddGastosFromCatalog}
      />

      {/* 11. Parametric Gasto Modal */}
      {parametricGastoToAdjust && (
        <ParametricGastoModal
          isOpen={parametricGastoToAdjust !== null}
          onClose={() => setParametricGastoToAdjust(null)}
          gasto={parametricGastoToAdjust}
          baseMateriales={totales.subtotalInsumosBase}
          baseManoObra={totales.subtotalManoObraBase}
          baseServicios={totales.subtotalServiciosBase}
          baseCostoDirecto={totales.costoGlobal}
          onConfirm={(gastoId, valores) => {
            onUpdateGastoParametros(gastoId, valores);
            setParametricGastoToAdjust(null);
          }}
        />
      )}

      {/* 12. WhatsApp Share Modal */}
      <WhatsAppShareModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        presupuesto={currentPresupuestoObj}
        cliente={selectedCliente}
        config={config}
      />

      {/* 13. BOM Modal */}
      <ListaMaterialesModal
        isOpen={showListaMaterialesModal}
        onClose={() => setShowListaMaterialesModal(false)}
        presupuesto={currentPresupuestoObj}
        cliente={selectedCliente}
        config={config}
        onOpenInCatalog={onViewMaterialsInCatalog ? onOpenMaterialsInCatalog : undefined}
      />

      {/* 14. Actualizar Precios Modal */}
      <ActualizarPreciosModal
        isOpen={showActualizarPreciosModal}
        onClose={() => setShowActualizarPreciosModal(false)}
        analisis={analisisPreciosModal}
        onConfirm={onConfirmActualizarPrecios}
      />
    </>
  );
};
