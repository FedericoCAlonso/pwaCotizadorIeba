import React from 'react';
import { GastoEditorModal } from './presupuesto/GastoEditorModal';
import { ManoObraEditorModal } from './manoObra/ManoObraEditorModal';
import { ManoObraSummaryHeader } from './manoObra/ManoObraSummaryHeader';
import { ManoObraDesktopTable } from './manoObra/ManoObraDesktopTable';
import { ManoObraMobileList } from './manoObra/ManoObraMobileList';
import { ManoObraGastosTable } from './manoObra/ManoObraGastosTable';
import { ConveniosTable } from './manoObra/ConveniosTable';
import { ConvenioEditorModal } from './manoObra/ConvenioEditorModal';
import { useManoObraViewModel } from '../viewmodels/useManoObraViewModel';

export const ManoObraManager: React.FC = () => {
  const {
    // Navigation / Tabs & Search Filters
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filterRol,
    setFilterRol,
    filterConvenio,
    setFilterConvenio,
    filterDestino,
    setFilterDestino,
    conveniosList,

    // Mano de Obra
    manoObraList,
    filteredManoObraList,
    editingMO,
    isCreatingMO,
    moForm,
    openCreateMO,
    openEditMO,
    closeMOModal,
    handleNombreChange,
    handleRolChange,
    handleHorasJornadaChange,
    handleCostoHoraChange,
    handleCostoJornadaChange,
    handleSaveMO,
    handleDeleteMO,
    handleDuplicateMO,
    handleUpdateMOField,
    handleBatchParitariaUpdate,
    handleQuickCreateMO,

    // Gastos Catálogo
    gastosCatalogList,
    filteredGastosList,
    showGastoModal,
    editingGasto,
    handleOpenCreateGasto,
    handleOpenEditGasto,
    handleCloseGastoModal,
    handleSaveCatalogGasto,
    handleDeleteCatalogGasto,
    handleDuplicateGasto,
    handleQuickCreateGasto,
    handleUpdateGastoField,
    handleToggleIncluirPorDefecto,

    // Convenios Laborales
    filteredConveniosList,
    showConvenioModal,
    editingConvenio,
    openCreateConvenio,
    openEditConvenio,
    closeConvenioModal,
    handleSaveConvenio,
    handleDeleteConvenio,
    handleDuplicateConvenio,
    handleQuickCreateConvenio,
    handleUpdateConvenioField
  } = useManoObraViewModel();

  return (
    <div className="space-y-6">
      {/* Header con resumen, pestañas segmentadas, buscador, filtros y botón de paritarias */}
      <ManoObraSummaryHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        totalCategorias={manoObraList.length}
        totalGastos={gastosCatalogList.length}
        totalConvenios={conveniosList.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterRol={filterRol}
        onFilterRolChange={setFilterRol}
        filterConvenio={filterConvenio}
        onFilterConvenioChange={setFilterConvenio}
        filterDestino={filterDestino}
        onFilterDestinoChange={setFilterDestino}
        conveniosList={conveniosList}
        onOpenCreateMO={() => openCreateMO()}
        onOpenCreateGasto={handleOpenCreateGasto}
        onOpenCreateConvenio={openCreateConvenio}
        onApplyParitaria={handleBatchParitariaUpdate}
      />

      {/* Contenido según pestaña activa */}
      {activeTab === 'cuadrilla' && (
        <div className="space-y-4">
          {/* Vista Desktop: Tabla estilo TreeSheet de alta densidad con acordeón de desglose */}
          <div className="hidden md:block">
            <ManoObraDesktopTable
              manoObraList={filteredManoObraList}
              conveniosList={conveniosList}
              onUpdateField={handleUpdateMOField}
              onOpenEdit={openEditMO}
              onDelete={handleDeleteMO}
              onDuplicate={handleDuplicateMO}
              onQuickCreate={handleQuickCreateMO}
            />
          </div>

          {/* Vista Mobile: Tarjetas táctiles optimizadas */}
          <div className="md:hidden">
            <ManoObraMobileList
              activeTab="cuadrilla"
              manoObraList={filteredManoObraList}
              gastosList={filteredGastosList}
              conveniosList={filteredConveniosList}
              onOpenEditMO={openEditMO}
              onDeleteMO={handleDeleteMO}
              onDuplicateMO={handleDuplicateMO}
              onUpdateMOField={handleUpdateMOField}
              onOpenEditGasto={handleOpenEditGasto}
              onDeleteGasto={handleDeleteCatalogGasto}
              onDuplicateGasto={handleDuplicateGasto}
              onToggleDefaultGasto={handleToggleIncluirPorDefecto}
              onOpenEditConvenio={openEditConvenio}
              onDeleteConvenio={handleDeleteConvenio}
              onDuplicateConvenio={handleDuplicateConvenio}
            />
          </div>
        </div>
      )}

      {activeTab === 'cargas' && (
        <div className="space-y-4">
          {/* Vista Desktop: Planilla de Gastos de Obra y Cargas Globales de alta densidad */}
          <div className="hidden md:block">
            <ManoObraGastosTable
              gastosList={filteredGastosList}
              onOpenCreate={handleOpenCreateGasto}
              onOpenEdit={handleOpenEditGasto}
              onDelete={handleDeleteCatalogGasto}
              onDuplicate={handleDuplicateGasto}
              onToggleDefault={handleToggleIncluirPorDefecto}
              onUpdateField={handleUpdateGastoField}
              onQuickCreate={handleQuickCreateGasto}
            />
          </div>

          {/* Vista Mobile: Tarjetas táctiles de Gastos */}
          <div className="md:hidden">
            <ManoObraMobileList
              activeTab="cargas"
              manoObraList={filteredManoObraList}
              gastosList={filteredGastosList}
              conveniosList={filteredConveniosList}
              onOpenEditMO={openEditMO}
              onDeleteMO={handleDeleteMO}
              onDuplicateMO={handleDuplicateMO}
              onUpdateMOField={handleUpdateMOField}
              onOpenEditGasto={handleOpenEditGasto}
              onDeleteGasto={handleDeleteCatalogGasto}
              onDuplicateGasto={handleDuplicateGasto}
              onToggleDefaultGasto={handleToggleIncluirPorDefecto}
              onOpenEditConvenio={openEditConvenio}
              onDeleteConvenio={handleDeleteConvenio}
              onDuplicateConvenio={handleDuplicateConvenio}
            />
          </div>
        </div>
      )}

      {activeTab === 'convenios' && (
        <div className="space-y-4">
          {/* Vista Desktop: Tabla de Convenios Laborales y Cargas Sociales de alta densidad */}
          <div className="hidden md:block">
            <ConveniosTable
              conveniosList={filteredConveniosList}
              onOpenCreate={openCreateConvenio}
              onOpenEdit={openEditConvenio}
              onDelete={handleDeleteConvenio}
              onDuplicate={handleDuplicateConvenio}
              onUpdateField={handleUpdateConvenioField}
              onQuickCreate={handleQuickCreateConvenio}
            />
          </div>

          {/* Vista Mobile: Tarjetas de Convenios */}
          <div className="md:hidden">
            <ManoObraMobileList
              activeTab="convenios"
              manoObraList={filteredManoObraList}
              gastosList={filteredGastosList}
              conveniosList={filteredConveniosList}
              onOpenEditMO={openEditMO}
              onDeleteMO={handleDeleteMO}
              onDuplicateMO={handleDuplicateMO}
              onUpdateMOField={handleUpdateMOField}
              onOpenEditGasto={handleOpenEditGasto}
              onDeleteGasto={handleDeleteCatalogGasto}
              onDuplicateGasto={handleDuplicateGasto}
              onToggleDefaultGasto={handleToggleIncluirPorDefecto}
              onOpenEditConvenio={openEditConvenio}
              onDeleteConvenio={handleDeleteConvenio}
              onDuplicateConvenio={handleDuplicateConvenio}
            />
          </div>
        </div>
      )}

      {/* Modal: Mano de Obra (Doble entrada UOCRA & Hora) */}
      <ManoObraEditorModal
        isOpen={isCreatingMO || editingMO !== null}
        isCreating={isCreatingMO}
        form={moForm}
        onClose={closeMOModal}
        onNombreChange={handleNombreChange}
        onRolChange={handleRolChange}
        onHorasJornadaChange={handleHorasJornadaChange}
        onCostoHoraChange={handleCostoHoraChange}
        onCostoJornadaChange={handleCostoJornadaChange}
        onSave={handleSaveMO}
      />

      {/* Modal: Gasto del Catálogo Global */}
      <GastoEditorModal
        isOpen={showGastoModal}
        onClose={handleCloseGastoModal}
        gastoToEdit={editingGasto}
        showIncluirPorDefecto={true}
        onSave={handleSaveCatalogGasto}
        onDelete={editingGasto ? handleDeleteCatalogGasto : undefined}
      />

      {/* Modal: Convenio Laboral */}
      <ConvenioEditorModal
        isOpen={showConvenioModal}
        onClose={closeConvenioModal}
        convenio={editingConvenio}
        onSave={handleSaveConvenio}
        onDelete={handleDeleteConvenio}
      />
    </div>
  );
};
