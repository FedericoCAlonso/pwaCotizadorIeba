import {
  FileText,
  Sliders,
  Calculator,
  Package,
  Clock,
  ShieldAlert,
  Code2
} from 'lucide-react';
import {
  TareaTipo,
  Insumo,
  CategoriaManoDeObra
} from '../../core/types';
import { ModalContainer } from '../ModalContainer';
import { MaterialPickerModal } from './MaterialPickerModal';
import { CategoryFilterMaterialModal } from './CategoryFilterMaterialModal';
import {
  useTareaEditorModalViewModel,
  TareaFormData,
  TareaEditorTab
} from '../../viewmodels/useTareaEditorModalViewModel';
import { GeneralTab } from './editor/GeneralTab';
import { ParametrosTab } from './editor/ParametrosTab';
import { VariablesTab } from './editor/VariablesTab';
import { MaterialesTab } from './editor/MaterialesTab';
import { ManoObraTab } from './editor/ManoObraTab';
import { ClausulasTab } from './editor/ClausulasTab';
import { LivePreviewFooter } from './editor/LivePreviewFooter';
import { TareaEditorExperto } from './editor/TareaEditorExperto';

export type { TareaFormData };

export interface TareaEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTarea: TareaTipo | null;
  categoriasList: string[];
  insumosMap: Map<string, Insumo>;
  manoObraList: CategoriaManoDeObra[];
  manoObraMap: Map<string, CategoriaManoDeObra>;
  onSave: (data: TareaFormData) => Promise<void>;
  titleOverride?: string;
  submitButtonText?: string;
}

export const TareaEditorModal: React.FC<TareaEditorModalProps> = ({
  isOpen,
  onClose,
  editingTarea,
  categoriasList,
  insumosMap,
  manoObraList,
  manoObraMap,
  onSave,
  titleOverride,
  submitButtonText
}) => {
  const {
    activeTab,
    setActiveTab,
    formData,
    setFormData,
    currentScope,
    liveEvaluation,
    // Material picker
    isMaterialPickerOpen,
    setIsMaterialPickerOpen,
    isCategoryFilterModalOpen,
    setIsCategoryFilterModalOpen,
    editingCategoryFilterIdx,
    setEditingCategoryFilterIdx,
    handleAddMaterialFromPicker,
    handleAddMultipleMaterialsFromPicker,
    removeInsumoRow,
    handleSaveCategoryFilter,
    // Mano de obra
    addManoObraRow,
    removeManoObraRow,
    // Parametros
    addParametro,
    updateParametro,
    removeParametro,
    moveParametro,
    canMoveParametro,
    setParametroDependency,
    // Variables
    addVariable,
    updateVariable,
    removeVariable,
    moveVariable,
    // Submit
    handleSubmit,
    // Modo Experto (YAML DSL)
    isExpertMode,
    yamlText,
    yamlDiagnostics,
    toggleExpertMode,
    handleYamlChange,
    insertYamlSnippet,
    // Badges / Counts
    parametrosCount,
    variablesCount,
    insumosCount,
    manoObraCount
  } = useTareaEditorModalViewModel({
    isOpen,
    onClose,
    editingTarea,
    categoriasList,
    insumosMap,
    manoObraList,
    manoObraMap,
    onSave
  });

  const tabs: Array<{ id: TareaEditorTab; label: string; icon: React.FC<{ className?: string }>; badge?: number | string }> = [
    { id: 'general', label: 'General', icon: FileText },
    {
      id: 'parametros',
      label: 'Parámetros',
      icon: Sliders,
      badge: parametrosCount > 0 ? parametrosCount : undefined
    },
    {
      id: 'variables',
      label: 'Cálculos',
      icon: Calculator,
      badge: variablesCount > 0 ? variablesCount : undefined
    },
    {
      id: 'materiales',
      label: 'Materiales',
      icon: Package,
      badge: insumosCount > 0 ? insumosCount : undefined
    },
    {
      id: 'mano_obra',
      label: 'Mano de Obra',
      icon: Clock,
      badge: manoObraCount > 0 ? manoObraCount : undefined
    },
    { id: 'clausulas', label: 'Cláusulas y Textos', icon: ShieldAlert }
  ];

  return (
    <>
      <ModalContainer
        isOpen={isOpen}
        onClose={onClose}
        title={titleOverride || (editingTarea ? 'Editar Trabajo Tipo' : 'Crear Nuevo Trabajo Tipo')}
        maxWidth="3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Barra superior de Modo: Visual vs Experto */}
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-xs text-on-surface-variant font-medium">
              {isExpertMode ? 'Modo Experto: Edición directa en YAML' : 'Modo Visual: Configuración asistida por pestañas'}
            </span>
            <button
              type="button"
              onClick={toggleExpertMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                isExpertMode
                  ? 'bg-primary text-on-primary border-primary shadow-xs'
                  : 'bg-surface hover:bg-surface-variant/40 text-on-surface border-outline-variant/40'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>{isExpertMode ? 'Volver a Pestañas' : 'Modo Experto (YAML)'}</span>
            </button>
          </div>

          {isExpertMode ? (
            <div className="min-h-[420px]">
              <TareaEditorExperto
                yamlText={yamlText}
                onYamlChange={handleYamlChange}
                diagnostics={yamlDiagnostics}
                onInsertSnippet={insertYamlSnippet}
                formData={formData}
                liveEvaluation={liveEvaluation}
                insumosMap={insumosMap}
                manoObraMap={manoObraMap}
              />
            </div>
          ) : (
            <>
              {/* Navegación por Pestañas (M3 Tab Bar) */}
              <div className="flex items-center gap-1.5 p-1 bg-surface-container rounded-2xl border border-outline-variant/30 overflow-x-auto scrollbar-none">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                        isActive
                          ? 'bg-surface text-primary shadow-xs'
                          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : 'text-on-surface-variant'}`} />
                      <span>{tab.label}</span>
                      {tab.badge !== undefined && (
                        <span
                          className={`text-xs font-mono px-2 py-0.5 rounded-full font-bold ${
                            isActive
                              ? 'bg-primary/15 text-primary'
                              : 'bg-surface-variant text-on-surface-variant'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Contenido de la Pestaña Activa */}
              <div className="min-h-[380px] py-1">
                {activeTab === 'general' && (
                  <GeneralTab
                    formData={formData}
                    setFormData={setFormData}
                    categoriasList={categoriasList}
                    currentScope={currentScope}
                  />
                )}

                {activeTab === 'parametros' && (
                  <ParametrosTab
                    parametros={formData.parametros}
                    addParametro={addParametro}
                    updateParametro={updateParametro}
                    removeParametro={removeParametro}
                    moveParametro={moveParametro}
                    canMoveParametro={canMoveParametro}
                    setParametroDependency={setParametroDependency}
                  />
                )}

                {activeTab === 'variables' && (
                  <VariablesTab
                    variables={formData.variables}
                    parametros={formData.parametros}
                    currentScope={currentScope}
                    addVariable={addVariable}
                    updateVariable={updateVariable}
                    removeVariable={removeVariable}
                    moveVariable={moveVariable}
                  />
                )}

                {activeTab === 'materiales' && (
                  <MaterialesTab
                    formData={formData}
                    setFormData={setFormData}
                    insumosMap={insumosMap}
                    currentScope={currentScope}
                    setIsMaterialPickerOpen={setIsMaterialPickerOpen}
                    setIsCategoryFilterModalOpen={setIsCategoryFilterModalOpen}
                    setEditingCategoryFilterIdx={setEditingCategoryFilterIdx}
                    removeInsumoRow={removeInsumoRow}
                  />
                )}

                {activeTab === 'mano_obra' && (
                  <ManoObraTab
                    formData={formData}
                    setFormData={setFormData}
                    manoObraList={manoObraList}
                    manoObraMap={manoObraMap}
                    currentScope={currentScope}
                    addManoObraRow={addManoObraRow}
                    removeManoObraRow={removeManoObraRow}
                  />
                )}

                {activeTab === 'clausulas' && (
                  <ClausulasTab formData={formData} setFormData={setFormData} />
                )}
              </div>
            </>
          )}

          {/* Live Preview Cost Box y Botones de Acción */}
          <LivePreviewFooter
            liveEvaluation={liveEvaluation}
            onClose={onClose}
            submitButtonText={submitButtonText}
          />
        </form>
      </ModalContainer>

      {/* Modal Selector de Materiales del Catálogo */}
      {isMaterialPickerOpen && (
        <MaterialPickerModal
          isOpen={isMaterialPickerOpen}
          onClose={() => setIsMaterialPickerOpen(false)}
          insumosMap={insumosMap}
          alreadySelectedIds={formData.insumos
            .map((i) => i.materialId || i.insumoId || '')
            .filter(Boolean)}
          currentScope={currentScope}
          onAddMaterial={handleAddMaterialFromPicker}
          onAddMultipleMaterials={handleAddMultipleMaterialsFromPicker}
        />
      )}

      {/* Modal de Selector por Categoría Dinámica */}
      {isCategoryFilterModalOpen && (
        <CategoryFilterMaterialModal
          isOpen={isCategoryFilterModalOpen}
          onClose={() => {
            setIsCategoryFilterModalOpen(false);
            setEditingCategoryFilterIdx(null);
          }}
          initialData={
            editingCategoryFilterIdx !== null && formData.insumos[editingCategoryFilterIdx]?.filtroMaterial
              ? {
                  nombreSlot: formData.insumos[editingCategoryFilterIdx].nombreSlot || '',
                  filtroMaterial: formData.insumos[editingCategoryFilterIdx].filtroMaterial!,
                  cantidad: formData.insumos[editingCategoryFilterIdx].cantidad,
                  formula: formData.insumos[editingCategoryFilterIdx].formula
                }
              : undefined
          }
          insumosMap={insumosMap}
          parametros={formData.parametros}
          variables={formData.variables}
          currentScope={currentScope}
          onSaveCategoryFilter={handleSaveCategoryFilter}
        />
      )}
    </>
  );
};
