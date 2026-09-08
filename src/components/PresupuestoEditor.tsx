import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Plus,
  ArrowLeft,
  Star,
  AlertCircle,
  Layers,
  Package,
  Calendar,
  Lock,
  FolderPlus,
  Folder,
  Truck,
  Trash2,
  RefreshCw,
  MessageSquare,
  Check,
  Clock,
  Calculator,
  Terminal
} from 'lucide-react';
import { ModoExpertoEditor } from './presupuesto/experto/ModoExpertoEditor';
import {
  AppConfig,
  ItemPresupuesto,
  TipoFactura,
  MaterialFilterContext,
  CostoIndirecto,
  CapituloPresupuesto,
  GastoPresupuestoConfig,
  Presupuesto
} from '../core/types';
import {
  formatARS,
  safeNum
} from '../core/calculations';
import { useAppOptions } from '../hooks/useAppOptions';
import { useToast } from '../contexts/ToastContext';
import { usePresupuestoEditorViewModel } from '../viewmodels/usePresupuestoEditorViewModel';
import { usePresupuestoItemsOperations } from '../viewmodels/usePresupuestoItemsOperations';
import { PresupuestoEditorTabBar } from './presupuesto/editor/PresupuestoEditorTabBar';
import { ClienteTab } from './presupuesto/editor/ClienteTab';
import { PartidasTab } from './presupuesto/editor/PartidasTab';
import { CuadrillaTab } from './presupuesto/editor/CuadrillaTab';
import { ComercialTab } from './presupuesto/editor/ComercialTab';
import { PresupuestoLiveFooter } from './presupuesto/editor/PresupuestoLiveFooter';
import { PresupuestoEditorModals, SaveAsTemplateData } from './presupuesto/editor/PresupuestoEditorModals';

interface PresupuestoEditorProps {
  presupuestoId?: string;
  initialClienteId?: string;
  config: AppConfig;
  onBack: () => void;
  onSaved: (id: string) => void;
  onViewMaterialsInCatalog?: (ctx: MaterialFilterContext) => void;
  onDraftAutoSaved?: (id: string) => void;
}

export const PresupuestoEditor: React.FC<PresupuestoEditorProps> = ({
  presupuestoId,
  initialClienteId,
  config,
  onBack,
  onSaved,
  onViewMaterialsInCatalog,
  onDraftAutoSaved
}) => {
  const { tiposFactura, condicionesTrabajo, categoriasTarea } = useAppOptions();
  const { toast } = useToast();

  const {
    clientes,
    tareasTipo,
    favoriteTareas,
    costosIndirectos,
    existingPresupuesto,
    insumosMap,
    manoObraList,
    manoObraMap,
    totales,
    sinergiaManoObra,
    activeTab,
    setActiveTab,
    clienteId,
    setClienteId,
    direccionObra,
    setDireccionObra,
    numero,
    setNumero,
    validezDias,
    setValidezDias,
    margenPorcentaje,
    setMargenPorcentaje,
    tipoFactura,
    setTipoFactura,
    items,
    setItems,
    costosIndirectosConfig,
    setCostosIndirectosConfig,
    mostrarDolar,
    setMostrarDolar,
    nombreDolar,
    setNombreDolar,
    cotizacionDolar,
    setCotizacionDolar,
    condicionesPagoTexto,
    setCondicionesPagoTexto,
    opcionesEmision,
    setOpcionesEmision,
    showItemPickerModal,
    setShowItemPickerModal,
    showEmitirModal,
    setShowEmitirModal,
    itemParaGuardarComoTarea,
    setItemParaGuardarComoTarea,
    showParametricModal,
    setShowParametricModal,
    selectedTareaForParametricModal,
    setSelectedTareaForParametricModal,
    editingItemIndexForParametricModal,
    setEditingItemIndexForParametricModal,
    showParametricMaterialModal,
    setShowParametricMaterialModal,
    editingItemIndexForMaterialModal,
    setEditingItemIndexForMaterialModal,
    showInSituEditorModal,
    setShowInSituEditorModal,
    editingTareaForInSituModal,
    handleAddTareaTipoItem,
    handleOpenParametricModalForNewTask,
    handleOpenParametricModalForExistingItem,
    handleOpenMaterialModalForExistingItem,
    handleApplyMaterialEstimation,
    handleOpenInSituEditorForExistingItem,
    handleSaveInSituItem,
    handleConfirmParametricJob,
    handleAddInsumoItem,
    handleAddDirectItem,
    handleAddCustomItem,
    handleAddServicioDirecto,
    capitulos,
    setCapitulos,
    handleAddCapitulo,
    handleUpdateCapitulo,
    handleRemoveCapitulo,
    gastosConfig,
    setGastosConfig,
    showGastoModal,
    setShowGastoModal,
    editingGasto,
    setEditingGasto,
    showGastoCatalogPickerModal,
    setShowGastoCatalogPickerModal,
    handleSaveGasto,
    handleRemoveGasto,
    handleAddGastosFromCatalog,
    handleResetGastos,
    handleToggleGasto,
    handleUpdateGastoParametros,
    handleUpdateItemNotasTecnicas,
    handleUpdateItem,
    handleRemoveItem,
    impuestosDetalle,
    handleToggleTax,
    handleUpdateTaxPct,
    handleRemoveTax,
    handleAddCustomTax,
    handleOpenMaterialsInCatalog,
    handleRecalcularConPreciosVigentes,
    handleSavePresupuesto,
    showActualizarPreciosModal,
    setShowActualizarPreciosModal,
    analisisPreciosModal,
    handleConfirmActualizarPrecios,
    estrategiaCuadrilla,
    setEstrategiaCuadrilla,
    nivelConfianzaCuadrilla,
    setNivelConfianzaCuadrilla,
    aplicarOptimizacionCuadrilla,
    setAplicarOptimizacionCuadrilla,
    operariosCuadrilla,
    setOperariosCuadrilla,
    horasJornadaCuadrilla,
    setHorasJornadaCuadrilla,
    modoPlanificacionCuadrilla,
    setModoPlanificacionCuadrilla,
    diasObjetivoObra,
    setDiasObjetivoObra,
    margenRiesgoPorcentaje,
    setMargenRiesgoPorcentaje,
    nivelMargenRiesgo,
    setNivelMargenRiesgo,
    autoSaveStatus,
    lastAutoSaveTime,
    flushAutoSave,
    dslText,
    setDslText,
    calculatedCells,
    setCalculatedCells,
    calculosVariables,
    setCalculosVariables,
    isDslDirtyRef,
    syncDslFromGuided
  } = usePresupuestoEditorViewModel({
    presupuestoId,
    initialClienteId,
    config,
    onSaved,
    onViewMaterialsInCatalog,
    onDraftAutoSaved
  });

  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  const [editorMode, setEditorMode] = useState<'guiado' | 'experto'>('guiado');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [parametricGastoToAdjust, setParametricGastoToAdjust] = useState<GastoPresupuestoConfig | null>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showListaMaterialesModal, setShowListaMaterialesModal] = useState(false);

  // Detección y degradación en mobile: el modo experto requiere teclado físico y desktop
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && editorMode === 'experto') {
        setEditorMode('guiado');
        toast.info('El modo experto requiere teclado físico y pantalla amplia. Se activó el modo guiado.');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [editorMode, toast]);

  useEffect(() => {
    if (isMobile && editorMode === 'experto') {
      setEditorMode('guiado');
      toast.info('El modo experto requiere teclado físico y pantalla amplia. Se activó el modo guiado.');
    }
  }, []);

  const handleToggleEditorMode = useCallback((target?: 'guiado' | 'experto') => {
    const nextMode = target || (editorMode === 'guiado' ? 'experto' : 'guiado');
    if (nextMode === 'experto') {
      if (isMobile) {
        toast.info('El modo experto requiere teclado físico y pantalla amplia (> 768px).');
        return;
      }
      if (isDslDirtyRef.current || !dslText || dslText.trim().length === 0) {
        syncDslFromGuided();
      }
    }
    setEditorMode(nextMode);
  }, [editorMode, isMobile, isDslDirtyRef, dslText, syncDslFromGuided, toast]);

  // Atajo global para alternar entre Modo Guiado y Modo Experto Desktop (Alt + E)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        handleToggleEditorMode();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleToggleEditorMode]);

  // Monitoreo de modificaciones en modo guiado para marcar dslText como desfasado
  const prevItemsRef = useRef(items);
  const prevCapitulosRef = useRef(capitulos);
  const prevClienteRef = useRef(clienteId);
  const prevGastosRef = useRef(gastosConfig);
  const prevDireccionRef = useRef(direccionObra);
  const prevFacturaRef = useRef(tipoFactura);
  const prevMargenRef = useRef(margenPorcentaje);
  const prevRiesgoRef = useRef(nivelMargenRiesgo);

  useEffect(() => {
    if (editorMode === 'guiado') {
      if (
        prevItemsRef.current !== items ||
        prevCapitulosRef.current !== capitulos ||
        prevClienteRef.current !== clienteId ||
        prevGastosRef.current !== gastosConfig ||
        prevDireccionRef.current !== direccionObra ||
        prevFacturaRef.current !== tipoFactura ||
        prevMargenRef.current !== margenPorcentaje ||
        prevRiesgoRef.current !== nivelMargenRiesgo
      ) {
        isDslDirtyRef.current = true;
      }
    }
    prevItemsRef.current = items;
    prevCapitulosRef.current = capitulos;
    prevClienteRef.current = clienteId;
    prevGastosRef.current = gastosConfig;
    prevDireccionRef.current = direccionObra;
    prevFacturaRef.current = tipoFactura;
    prevMargenRef.current = margenPorcentaje;
    prevRiesgoRef.current = nivelMargenRiesgo;
  }, [items, capitulos, clienteId, gastosConfig, direccionObra, tipoFactura, margenPorcentaje, nivelMargenRiesgo, editorMode, isDslDirtyRef]);

  const selectedCliente = useMemo(() => {
    return clientes.find((c) => c.id === clienteId) || null;
  }, [clientes, clienteId]);

  const currentPresupuestoObj: Presupuesto = useMemo(() => ({
    id: existingPresupuesto?.id || 'pres-preview',
    numero: numero || 'IEBA-PREVIEW',
    clienteId,
    direccionObra: direccionObra.trim() || undefined,
    fechaEmision: existingPresupuesto?.fechaEmision || new Date().toISOString(),
    validezDias,
    tipoFactura,
    capitulos,
    items: totales.itemsCalculados,
    gastosConfig,
    costosIndirectosAplicados: totales.costosIndirectosAplicados,
    costoGlobal: totales.costoGlobal,
    gastosGeneralesTotal: totales.gastosGeneralesTotal,
    beneficioPorcentaje: safeNum(margenPorcentaje),
    beneficioMonto: totales.beneficioMonto,
    subtotalSinImpuestos: totales.subtotalSinImpuestos,
    montoImpuestosTotal: totales.montoImpuestosTotal,
    precioFinalGlobal: totales.precioFinalGlobal,
    coeficienteK: totales.coeficienteK,
    subtotalInsumos: totales.subtotalInsumos,
    subtotalManoObra: totales.subtotalManoObra,
    subtotalServiciosTercerizados: totales.subtotalServiciosTercerizados,
    subtotalCostosDirectos: totales.subtotalCostosDirectos,
    subtotalCostosIndirectos: totales.subtotalCostosIndirectos,
    costoTotalObra: totales.costoTotalObra,
    margenPorcentaje: safeNum(margenPorcentaje),
    montoGanancia: totales.beneficioMonto,
    impuestosDetalle,
    impuestosPorcentaje: 0,
    montoImpuestos: totales.montoImpuestosTotal,
    totalARS: totales.precioFinalGlobal,
    mostrarReferenciaMonedaExtranjera: mostrarDolar,
    nombreMonedaExtranjera: nombreDolar,
    cotizacionMonedaExtranjera: cotizacionDolar,
    condicionesPagoTexto,
    opcionesEmision,
    estado: existingPresupuesto?.estado || 'borrador',
    fechaModificacion: new Date().toISOString()
  }), [
    existingPresupuesto,
    numero,
    clienteId,
    direccionObra,
    validezDias,
    tipoFactura,
    capitulos,
    totales,
    gastosConfig,
    margenPorcentaje,
    impuestosDetalle,
    mostrarDolar,
    nombreDolar,
    cotizacionDolar,
    condicionesPagoTexto,
    opcionesEmision
  ]);

  const [materialPickerItemIndex, setMaterialPickerItemIndex] = useState<number | null>(null);
  const [brandModalTarget, setBrandModalTarget] = useState<{ itemIndex: number; materialIndex: number } | null>(null);
  const [showSaveAsTemplateModal, setShowSaveAsTemplateModal] = useState(false);
  const [saveAsTemplateData, setSaveAsTemplateData] = useState<SaveAsTemplateData>({
    nombre: '',
    notasTecnicas: '',
    insumos: [],
    manoObra: [],
    unidad: 'u'
  });

  const handleSaveAsTemplateAction = (targetItem: ItemPresupuesto) => {
    if (targetItem.tareaTipoConfig) {
      setSaveAsTemplateData({
        ...targetItem.tareaTipoConfig,
        nombre: targetItem.descripcion || targetItem.tareaTipoConfig.nombre,
        unidad: targetItem.unidad || targetItem.tareaTipoConfig.unidad,
        notasTecnicas: targetItem.notasTecnicas || targetItem.tareaTipoConfig.notasTecnicas || '',
        clausulaExclusiones: targetItem.clausulaExclusiones || targetItem.tareaTipoConfig.clausulaExclusiones || '',
        costoFijoOperativo: targetItem.costoFijoOperativo ?? targetItem.tareaTipoConfig.costoFijoOperativo ?? 0,
        descripcionCostoFijo: targetItem.descripcionCostoFijo ?? targetItem.tareaTipoConfig.descripcionCostoFijo ?? ''
      });
      setShowSaveAsTemplateModal(true);
      return;
    }

    const itemInsumos = (targetItem.insumosSnapshot || []).map((ins) => ({
      insumoId: ins.materialId || ins.insumoId,
      materialId: ins.materialId || ins.insumoId,
      productoId: ins.productoId,
      cantidad: ins.cantidadTotal
    }));
    const itemManoObra = (targetItem.manoObraSnapshot || []).map((mo) => ({
      categoriaId: mo.categoriaId,
      horas: mo.horasTotales
    }));
    setSaveAsTemplateData({
      nombre: targetItem.descripcion || 'Nueva Tarea Tipo',
      notasTecnicas: targetItem.notasTecnicas || targetItem.clausulaTecnica || '',
      naturaleza: targetItem.naturaleza || (targetItem.formulaHonorarios ? 'servicio_profesional' : 'instalacion'),
      honorarioBase: targetItem.costoServicios || 0,
      formulaHonorarios: targetItem.formulaHonorarios || '',
      costoServicioDirecto: targetItem.costoServicios || 0,
      costoFijoOperativo: targetItem.costoFijoOperativo || 0,
      descripcionCostoFijo: targetItem.descripcionCostoFijo || '',
      clausulaExclusiones: targetItem.clausulaExclusiones || '',
      unidad: targetItem.unidad || 'u',
      insumos: itemInsumos,
      manoObra: itemManoObra
    });
    setShowSaveAsTemplateModal(true);
  };

  // Keyboard shortcut & auto-focus management
  const itemTitleRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const prevItemsLength = useRef(items.length);
  const [targetCapituloIdForModal, setTargetCapituloIdForModal] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (items.length > prevItemsLength.current) {
      const lastItem = items[items.length - 1];
      if (lastItem) {
        setTimeout(() => {
          const inputEl = itemTitleRefs.current.get(lastItem.id);
          inputEl?.focus();
        }, 50);
      }
    }
    prevItemsLength.current = items.length;
  }, [items]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if any modal is open
      if (
        showItemPickerModal ||
        showSaveAsTemplateModal ||
        showEmitirModal ||
        showParametricModal ||
        showParametricMaterialModal ||
        showInSituEditorModal ||
        brandModalTarget !== null ||
        materialPickerItemIndex !== null
      ) {
        return;
      }

      // Alt + N / Alt + I -> Open unified item picker
      if (e.altKey && (e.key === 'n' || e.key === 'N' || e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        setTargetCapituloIdForModal(undefined);
        setShowItemPickerModal(true);
        return;
      }

      // Alt + C / Alt + T / Ctrl + K -> Open unified item picker
      if (
        (e.altKey && (e.key === 'c' || e.key === 'C' || e.key === 't' || e.key === 'T')) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K'))
      ) {
        e.preventDefault();
        setTargetCapituloIdForModal(undefined);
        setShowItemPickerModal(true);
        return;
      }

      // Ctrl + S / Cmd + S -> Quick save budget
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSavePresupuesto('borrador');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showItemPickerModal,
    showSaveAsTemplateModal,
    showEmitirModal,
    showParametricModal,
    showParametricMaterialModal,
    showInSituEditorModal,
    handleAddDirectItem,
    handleSavePresupuesto,
    setShowItemPickerModal
  ]);

  const handleTipoFacturaChange = (newTipo: TipoFactura) => {
    setTipoFactura(newTipo);
  };

  const handleToggleExpandItem = (itemId: string) => {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const {
    handleUpdateItemCondicion,
    handleUpdateItemQuantity,
    handleUpdateItemUnit,
    handleUpdateItemUnitDirectCost,
    handleUpdateItemDescription,
    handleAddMaterialsToItem,
    handleUpdateItemMaterialQuantity,
    handleRemoveItemMaterial,
    handleApplyMaterialBrand,
    handleUpdateItemManoObraCost,
    handleAddLaborToItem,
    handleUpdateItemLaborHours,
    handleRemoveItemLabor
  } = usePresupuestoItemsOperations({
    items,
    setItems,
    config,
    tipoFactura,
    manoObraMap
  });





  useEffect(() => {
    const handleSave = () => handleSavePresupuesto('borrador');
    const handleNew = () => setShowItemPickerModal(true);

    window.addEventListener('app:shortcut-save', handleSave);
    window.addEventListener('app:shortcut-new', handleNew);

    return () => {
      window.removeEventListener('app:shortcut-save', handleSave);
      window.removeEventListener('app:shortcut-new', handleNew);
    };
  }, [clienteId, existingPresupuesto, totales, margenPorcentaje, validezDias, tipoFactura, costosIndirectosConfig, opcionesEmision, config]);

  return (
    <div className="space-y-4 sm:space-y-5 w-full pb-12">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5 sm:gap-4 bg-surface-container p-3 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm border border-outline-variant/20">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={async () => {
              await flushAutoSave();
              onBack();
            }}
            className="p-2 sm:p-2.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors shrink-0"
            title="Volver (guarda el borrador automáticamente)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-on-surface flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <span>
                {existingPresupuesto ? `Editar Cotización ${existingPresupuesto.numero}` : 'Nueva Cotización Eléctrica'}
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {autoSaveStatus === 'saving' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Guardando borrador...
                </span>
              )}
              {autoSaveStatus === 'saved' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  Borrador guardado {lastAutoSaveTime ? `a las ${lastAutoSaveTime}` : 'automáticamente'}
                </span>
              )}
              {autoSaveStatus === 'error' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-error/10 text-error border border-error/20 shadow-xs">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Error al autoguardar
                </span>
              )}
              {autoSaveStatus === 'idle' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-surface-container-highest text-on-surface-variant border border-outline-variant/30 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-primary/70"></span>
                  Autoguardado activo
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
          {/* Selector de Modo: Guiado vs Experto */}
          <div className="bg-surface-container rounded-2xl p-1 border border-outline-variant/30 flex items-center gap-1 shadow-2xs">
            <button
              type="button"
              onClick={() => handleToggleEditorMode('guiado')}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer min-h-[36px] ${
                editorMode === 'guiado'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Guiado</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleEditorMode('experto')}
              disabled={isMobile}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 min-h-[36px] ${
                isMobile
                  ? 'opacity-40 cursor-not-allowed text-on-surface-variant'
                  : editorMode === 'experto'
                  ? 'bg-primary text-on-primary shadow-xs cursor-pointer'
                  : 'text-on-surface-variant hover:text-on-surface cursor-pointer'
              }`}
              title={
                isMobile
                  ? 'El modo experto requiere teclado físico y pantalla amplia (> 768px)'
                  : 'Modo Experto Desktop: Composición por teclado sin mouse (Alt + E)'
              }
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Experto</span>
              <kbd className="hidden md:inline text-[10px] opacity-70 font-mono">Alt+E</kbd>
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleSavePresupuesto('borrador')}
            className="px-4 py-2 bg-surface-container-highest hover:bg-outline-variant/30 text-on-surface font-semibold rounded-2xl text-xs sm:text-sm transition-colors border border-outline-variant/30 min-h-[40px] cursor-pointer flex items-center gap-2 shadow-2xs active:scale-95"
            title="Guardar estado actual del borrador"
          >
            <Check className="w-4 h-4 text-primary" />
            <span>Guardar Borrador</span>
          </button>
        </div>
      </div>

      {editorMode === 'experto' ? (
        <ModoExpertoEditor
          initialDslText={dslText}
          onDslTextChange={setDslText}
          savedCalculatedCells={calculatedCells}
          onCalculatedCellsChange={setCalculatedCells}
          savedCalculosVariables={calculosVariables}
          onCalculosVariablesChange={setCalculosVariables}
          clientes={clientes}
          clienteId={clienteId}
          setClienteId={setClienteId}
          direccionObra={direccionObra}
          setDireccionObra={setDireccionObra}
          tipoFactura={tipoFactura}
          setTipoFactura={handleTipoFacturaChange}
          validezDias={validezDias}
          setValidezDias={setValidezDias}
          margenPorcentaje={margenPorcentaje}
          setMargenPorcentaje={setMargenPorcentaje}
          nivelMargenRiesgo={nivelMargenRiesgo}
          setNivelMargenRiesgo={setNivelMargenRiesgo}
          margenRiesgoPorcentaje={margenRiesgoPorcentaje}
          setMargenRiesgoPorcentaje={setMargenRiesgoPorcentaje}
          mostrarDolar={mostrarDolar}
          setMostrarDolar={setMostrarDolar}
          nombreDolar={nombreDolar}
          setNombreDolar={setNombreDolar}
          cotizacionDolar={cotizacionDolar}
          setCotizacionDolar={setCotizacionDolar}
          capitulos={capitulos}
          setCapitulos={setCapitulos}
          items={items}
          setItems={setItems}
          gastosConfig={gastosConfig}
          setGastosConfig={setGastosConfig}
          totales={totales}
          tareasTipo={tareasTipo}
          insumosMap={insumosMap}
          manoObraMap={manoObraMap}
          config={config}
          onEmitirClick={() => setShowEmitirModal(true)}
          onSaveDraft={() => handleSavePresupuesto('borrador')}
          onToggleGuidedMode={() => handleToggleEditorMode('guiado')}
        />
      ) : (
        <>
          {/* 4-Stage Navigation Bar */}
          <PresupuestoEditorTabBar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            clienteNombre={selectedCliente?.nombre}
            itemsCount={items.length}
            cuadrillaBadge={sinergiaManoObra?.sonCompatibles ? `${sinergiaManoObra.operarios || operariosCuadrilla} op` : undefined}
            precioFinalFormatted={totales.precioFinalGlobal > 0 ? formatARS(totales.precioFinalGlobal) : undefined}
          />

          {/* Stage Tab Content */}
          <div className="min-h-[420px]">
        {activeTab === 'cliente' && (
          <ClienteTab
            clientes={clientes}
            clienteId={clienteId}
            setClienteId={setClienteId}
            direccionObra={direccionObra}
            setDireccionObra={setDireccionObra}
            selectedCliente={selectedCliente}
            tipoFactura={tipoFactura}
            setTipoFactura={handleTipoFacturaChange}
            validezDias={validezDias}
            setValidezDias={setValidezDias}
            config={config}
            mostrarDolar={mostrarDolar}
            setMostrarDolar={setMostrarDolar}
            nombreDolar={nombreDolar}
            setNombreDolar={setNombreDolar}
            cotizacionDolar={cotizacionDolar}
            setCotizacionDolar={setCotizacionDolar}
            onNext={() => setActiveTab('partidas')}
          />
        )}

        {activeTab === 'partidas' && (
          <PartidasTab
            items={items}
            capitulos={capitulos}
            totales={totales}
            expandedItems={expandedItems}
            onToggleExpandItem={handleToggleExpandItem}
            itemTitleRefs={itemTitleRefs}
            onOpenItemPicker={(capId) => {
              setTargetCapituloIdForModal(capId);
              setShowItemPickerModal(true);
            }}
            onAddCapitulo={handleAddCapitulo}
            onUpdateCapitulo={handleUpdateCapitulo}
            onRemoveCapitulo={handleRemoveCapitulo}
            onAddDirectItem={handleAddDirectItem}
            onUpdateItemCondicion={handleUpdateItemCondicion}
            onUpdateItemQuantity={handleUpdateItemQuantity}
            onUpdateItemUnit={handleUpdateItemUnit}
            onUpdateItemUnitDirectCost={handleUpdateItemUnitDirectCost}
            onUpdateItemDescription={handleUpdateItemDescription}
            onUpdateItemNotasTecnicas={handleUpdateItemNotasTecnicas}
            onRemoveItem={handleRemoveItem}
            onSaveAsTemplate={handleSaveAsTemplateAction}
            onOpenParametricModal={handleOpenParametricModalForExistingItem}
            onOpenMaterialModal={handleOpenMaterialModalForExistingItem}
            onOpenInSituEditor={handleOpenInSituEditorForExistingItem}
            onOpenMaterialPicker={(itemIdx) => setMaterialPickerItemIndex(itemIdx)}
            onOpenBrandModal={(itemIdx, matIdx) => setBrandModalTarget({ itemIndex: itemIdx, materialIndex: matIdx })}
            onUpdateItemMaterialQuantity={handleUpdateItemMaterialQuantity}
            onRemoveItemMaterial={handleRemoveItemMaterial}
            onUpdateItemManoObraCost={handleUpdateItemManoObraCost}
            onAddLaborRole={handleAddLaborToItem}
            onUpdateItemLaborHours={handleUpdateItemLaborHours}
            onRemoveItemLabor={handleRemoveItemLabor}
            manoObraList={manoObraList}
            condicionesTrabajo={condicionesTrabajo}
            umbralMargenMinimo={config.umbralMargenMinimoAdvertencia ?? 20}
            onNext={() => setActiveTab('cuadrilla')}
            onPrev={() => setActiveTab('cliente')}
          />
        )}

        {activeTab === 'cuadrilla' && (
          <CuadrillaTab
            items={items}
            estrategia={estrategiaCuadrilla}
            nivelConfianza={nivelConfianzaCuadrilla}
            aplicarOptimizacion={aplicarOptimizacionCuadrilla}
            operarios={operariosCuadrilla}
            horasJornada={horasJornadaCuadrilla}
            modoPlanificacion={modoPlanificacionCuadrilla}
            diasObjetivo={diasObjetivoObra}
            manoObraList={manoObraList}
            onChangeEstrategia={setEstrategiaCuadrilla}
            onChangeNivelConfianza={setNivelConfianzaCuadrilla}
            onToggleOptimizacion={setAplicarOptimizacionCuadrilla}
            onChangeOperarios={setOperariosCuadrilla}
            onChangeHorasJornada={setHorasJornadaCuadrilla}
            onChangeModoPlanificacion={setModoPlanificacionCuadrilla}
            onChangeDiasObjetivo={setDiasObjetivoObra}
            totales={totales}
            gastosConfig={gastosConfig}
            onOpenGastoModal={(g) => {
              setEditingGasto(g || null);
              setShowGastoModal(true);
            }}
            onOpenCatalogPicker={() => setShowGastoCatalogPickerModal(true)}
            onOpenParametricGastoModal={(g) => setParametricGastoToAdjust(g)}
            onToggleGasto={handleToggleGasto}
            onRemoveGasto={handleRemoveGasto}
            onResetGastos={handleResetGastos}
            onNext={() => setActiveTab('comercial')}
            onPrev={() => setActiveTab('partidas')}
          />
        )}

        {activeTab === 'comercial' && (
          <ComercialTab
            totales={totales}
            tipoFactura={tipoFactura}
            gastosConfig={gastosConfig}
            onOpenGastoModal={(g) => {
              setEditingGasto(g || null);
              setShowGastoModal(true);
            }}
            onOpenCatalogPicker={() => setShowGastoCatalogPickerModal(true)}
            onOpenParametricGastoModal={(g) => setParametricGastoToAdjust(g)}
            onToggleGasto={handleToggleGasto}
            onRemoveGasto={handleRemoveGasto}
            onResetGastos={handleResetGastos}
            margenPorcentaje={margenPorcentaje}
            onMargenPorcentajeChange={setMargenPorcentaje}
            margenRiesgoPorcentaje={margenRiesgoPorcentaje}
            setMargenRiesgoPorcentaje={setMargenRiesgoPorcentaje}
            nivelMargenRiesgo={nivelMargenRiesgo}
            setNivelMargenRiesgo={setNivelMargenRiesgo}
            onToggleTax={handleToggleTax}
            onUpdateTaxPct={handleUpdateTaxPct}
            onRemoveTax={handleRemoveTax}
            onAddCustomTax={handleAddCustomTax}
            mostrarDolar={mostrarDolar}
            nombreDolar={nombreDolar}
            condicionesPagoTexto={condicionesPagoTexto}
            setCondicionesPagoTexto={setCondicionesPagoTexto}
            onEmitirClick={() => setShowEmitirModal(true)}
            onOpenListaMateriales={() => setShowListaMaterialesModal(true)}
            onOpenWhatsApp={() => setShowWhatsAppModal(true)}
            onOpenActualizarPrecios={handleRecalcularConPreciosVigentes}
            onSaveDraft={() => handleSavePresupuesto('borrador')}
            onPrev={() => setActiveTab('cuadrilla')}
          />
        )}
      </div>

      {/* Persistent Live Financial Footer */}
      <PresupuestoLiveFooter
        totales={totales}
        margenPorcentaje={margenPorcentaje}
        mostrarDolar={mostrarDolar}
        nombreDolar={nombreDolar}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onEmitirClick={() => setShowEmitirModal(true)}
      />
    </>
  )}

      {/* Consolidated Editor Modals */}
      <PresupuestoEditorModals
        config={config}
        insumosMap={insumosMap}
        manoObraMap={manoObraMap}
        manoObraList={manoObraList}
        tareasTipo={tareasTipo}
        costosIndirectos={costosIndirectos}
        categoriasTarea={categoriasTarea}
        tipoFactura={tipoFactura}
        items={items}
        capitulos={capitulos}
        gastosConfig={gastosConfig}
        totales={totales}
        currentPresupuestoObj={currentPresupuestoObj}
        selectedCliente={selectedCliente}
        showItemPickerModal={showItemPickerModal}
        setShowItemPickerModal={setShowItemPickerModal}
        targetCapituloIdForModal={targetCapituloIdForModal}
        onSelectTareaFromPicker={(tarea) => handleAddTareaTipoItem(tarea, 1, targetCapituloIdForModal)}
        onConfigureParametricTareaFromPicker={(tarea) => handleOpenParametricModalForNewTask(tarea, targetCapituloIdForModal)}
        onAddCustomItemFromPicker={(desc) => handleAddDirectItem(targetCapituloIdForModal, desc)}
        onAddCapituloFromPicker={handleAddCapitulo}
        showParametricModal={showParametricModal}
        setShowParametricModal={setShowParametricModal}
        selectedTareaForParametricModal={selectedTareaForParametricModal}
        setSelectedTareaForParametricModal={setSelectedTareaForParametricModal}
        editingItemIndexForParametricModal={editingItemIndexForParametricModal}
        setEditingItemIndexForParametricModal={setEditingItemIndexForParametricModal}
        onConfirmParametricJob={(tarea, res) => handleConfirmParametricJob(tarea, res)}
        showParametricMaterialModal={showParametricMaterialModal}
        setShowParametricMaterialModal={setShowParametricMaterialModal}
        editingItemIndexForMaterialModal={editingItemIndexForMaterialModal}
        setEditingItemIndexForMaterialModal={setEditingItemIndexForMaterialModal}
        onApplyMaterialEstimation={handleApplyMaterialEstimation}
        showEmitirModal={showEmitirModal}
        setShowEmitirModal={setShowEmitirModal}
        opcionesEmision={opcionesEmision}
        setOpcionesEmision={setOpcionesEmision}
        condicionesPagoTexto={condicionesPagoTexto}
        onConfirmEmitir={(opciones) => handleSavePresupuesto('enviado', opciones)}
        showSaveAsTemplateModal={showSaveAsTemplateModal}
        setShowSaveAsTemplateModal={setShowSaveAsTemplateModal}
        saveAsTemplateData={saveAsTemplateData}
        showInSituEditorModal={showInSituEditorModal}
        setShowInSituEditorModal={setShowInSituEditorModal}
        editingTareaForInSituModal={editingTareaForInSituModal}
        onSaveInSituItem={handleSaveInSituItem}
        materialPickerItemIndex={materialPickerItemIndex}
        setMaterialPickerItemIndex={setMaterialPickerItemIndex}
        onAddMaterialsToItem={handleAddMaterialsToItem}
        brandModalTarget={brandModalTarget}
        setBrandModalTarget={setBrandModalTarget}
        onApplyMaterialBrand={(payload) => {
          handleApplyMaterialBrand(brandModalTarget, payload);
          setBrandModalTarget(null);
        }}
        showGastoModal={showGastoModal}
        setShowGastoModal={setShowGastoModal}
        editingGasto={editingGasto}
        setEditingGasto={setEditingGasto}
        onSaveGasto={handleSaveGasto}
        onRemoveGasto={handleRemoveGasto}
        showGastoCatalogPickerModal={showGastoCatalogPickerModal}
        setShowGastoCatalogPickerModal={setShowGastoCatalogPickerModal}
        onAddGastosFromCatalog={handleAddGastosFromCatalog}
        parametricGastoToAdjust={parametricGastoToAdjust}
        setParametricGastoToAdjust={setParametricGastoToAdjust}
        onUpdateGastoParametros={handleUpdateGastoParametros}
        showWhatsAppModal={showWhatsAppModal}
        setShowWhatsAppModal={setShowWhatsAppModal}
        showListaMaterialesModal={showListaMaterialesModal}
        setShowListaMaterialesModal={setShowListaMaterialesModal}
        onViewMaterialsInCatalog={onViewMaterialsInCatalog}
        onOpenMaterialsInCatalog={handleOpenMaterialsInCatalog}
        showActualizarPreciosModal={showActualizarPreciosModal}
        setShowActualizarPreciosModal={setShowActualizarPreciosModal}
        analisisPreciosModal={analisisPreciosModal}
        onConfirmActualizarPrecios={handleConfirmActualizarPrecios}
      />
    </div>
  );
};
