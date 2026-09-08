import React from 'react';
import { Insumo, CostoIndirecto, Contacto } from '../../../core/types';
import { MultiMaterialPickerModal } from './MultiMaterialPickerModal';
import { GastosCatalogPickerModal } from './GastosCatalogPickerModal';
import { QuickCreateMaterialModal } from '../../insumos/QuickCreateMaterialModal';
import { QuickClienteModal } from '../QuickClienteModal';

interface ModoExpertoModalsProps {
  showMultiMaterialModal: boolean;
  onCloseMultiMaterialModal: () => void;
  insumosMap: Map<string, Insumo>;
  onInsertMultipleMaterials: (formattedYamlLines: string) => void;
  currentIndentForPalette: string;

  showGastosModal: boolean;
  onCloseGastosModal: () => void;
  catalogCostosIndirectos: CostoIndirecto[];
  onInsertGastos: (formattedYamlLines: string) => void;

  isQuickCreateMatOpen: boolean;
  onCloseQuickCreateMat: () => void;
  formDataQuickMat: {
    nombre: string;
    unidadVenta: string;
    precio: number | null;
    alicuotaIVA?: number;
    modoPrecio?: 'con_iva' | 'neto';
    proveedorId: string;
    marca?: string;
  };
  setFormDataQuickMat: React.Dispatch<
    React.SetStateAction<{
      nombre: string;
      unidadVenta: string;
      precio: number | null;
      alicuotaIVA?: number;
      modoPrecio?: 'con_iva' | 'neto';
      proveedorId: string;
      marca?: string;
    }>
  >;
  proveedores: Contacto[];
  onSaveQuickMat: (e: React.FormEvent) => void;

  isQuickClienteOpen: boolean;
  onCloseQuickCliente: () => void;
  quickClienteInitialName: string;
  onClienteCreated: (newClienteId: string) => void;
}

export const ModoExpertoModals: React.FC<ModoExpertoModalsProps> = ({
  showMultiMaterialModal,
  onCloseMultiMaterialModal,
  insumosMap,
  onInsertMultipleMaterials,
  currentIndentForPalette,
  showGastosModal,
  onCloseGastosModal,
  catalogCostosIndirectos,
  onInsertGastos,
  isQuickCreateMatOpen,
  onCloseQuickCreateMat,
  formDataQuickMat,
  setFormDataQuickMat,
  proveedores,
  onSaveQuickMat,
  isQuickClienteOpen,
  onCloseQuickCliente,
  quickClienteInitialName,
  onClienteCreated
}) => {
  return (
    <>
      {/* Modal de Paleta Rápida de Insumos (Alt + M) */}
      <MultiMaterialPickerModal
        isOpen={showMultiMaterialModal}
        onClose={onCloseMultiMaterialModal}
        insumosMap={insumosMap}
        onInsertMaterials={onInsertMultipleMaterials}
        currentIndent={currentIndentForPalette}
      />

      {/* Modal de Catálogo de Gastos y Costos Indirectos (Alt + G) */}
      <GastosCatalogPickerModal
        isOpen={showGastosModal}
        onClose={onCloseGastosModal}
        costosIndirectos={catalogCostosIndirectos}
        onInsertGastos={onInsertGastos}
      />

      {/* Modal de Alta Rápida de Material al Catálogo (+ Catálogo) */}
      <QuickCreateMaterialModal
        isOpen={isQuickCreateMatOpen}
        onClose={onCloseQuickCreateMat}
        formDataQuickMat={formDataQuickMat}
        setFormDataQuickMat={setFormDataQuickMat}
        proveedores={proveedores}
        onSave={onSaveQuickMat}
      />

      {/* Modal de Alta Rápida de Cliente en Contactos */}
      <QuickClienteModal
        isOpen={isQuickClienteOpen}
        onClose={onCloseQuickCliente}
        initialName={quickClienteInitialName}
        onClienteCreated={onClienteCreated}
      />
    </>
  );
};
