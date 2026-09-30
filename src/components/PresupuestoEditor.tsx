import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Check,
  Terminal,
  Plus,
  ChevronDown,
  Sliders,
  Command,
  FolderPlus,
  BookOpen,
  Pencil,
  UserPlus
} from 'lucide-react';
import { ModoExpertoEditor } from './presupuesto/experto/ModoExpertoEditor';
import {
  AppConfig,
  ItemPresupuesto,
  TipoFactura,
  MaterialFilterContext,
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
import { PresupuestoEditorModals, SaveAsTemplateData } from './presupuesto/editor/PresupuestoEditorModals';
import { TreeSheetView, TreeSheetViewRef } from './presupuesto/carga/TreeSheetView';
import { QuoteProjectModal } from './presupuesto/QuoteProjectModal';

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
    activeTab,
    setActiveTab,
    clienteId,
    setClienteId,
    direccionObra,
    setDireccionObra,
    numero,
    setNumero,
    revision,
    presupuestoOrigenId,
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

  type EditorMode = 'arbol' | 'experto';
  const [editorMode, setEditorMode] = useState<EditorMode>('arbol');
  const [parametricGastoToAdjust, setParametricGastoToAdjust] = useState<GastoPresupuestoConfig | null>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showListaMaterialesModal, setShowListaMaterialesModal] = useState(false);
  const [showQuoteProjectModal, setShowQuoteProjectModal] = useState(false);

  // Detección y degradación en mobile: el modo experto requiere teclado físico y desktop
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && editorMode === 'experto') {
        setEditorMode('arbol');
        toast.info('El modo experto requiere teclado físico y pantalla amplia. Se activó la vista adaptada.');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [editorMode, toast]);

  useEffect(() => {
    if (isMobile && editorMode === 'experto') {
      setEditorMode('arbol');
      toast.info('El modo experto requiere teclado físico y pantalla amplia. Se activó la vista adaptada.');
    }
  }, []);

  const handleToggleEditorMode = useCallback((target?: EditorMode) => {
    const nextMode = target || (editorMode === 'arbol' ? 'experto' : 'arbol');
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

  // Atajo global para alternar entre Árbol y Modo Experto Desktop (Alt + E)
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

  // Monitoreo de modificaciones en modo visual para marcar dslText como desfasado
  const prevItemsRef = useRef(items);
  const prevCapitulosRef = useRef(capitulos);
  const prevClienteRef = useRef(clienteId);
  const prevGastosRef = useRef(gastosConfig);
  const prevDireccionRef = useRef(direccionObra);
  const prevFacturaRef = useRef(tipoFactura);
  const prevMargenRef = useRef(margenPorcentaje);
  const prevRiesgoRef = useRef(nivelMargenRiesgo);

  useEffect(() => {
    if (editorMode !== 'experto') {
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

  const handleOpenSaveAsTemplateFromItem = useCallback((item: ItemPresupuesto) => {
    setSaveAsTemplateData({
      nombre: item.descripcion,
      unidad: item.unidad || 'u',
      naturaleza: item.naturaleza || 'instalacion',
      notasTecnicas: item.notasTecnicas || '',
      clausulaExclusiones: item.clausulaExclusiones || '',
      insumos: (item.insumosSnapshot || []).map((ins) => ({
        insumoId: ins.insumoId,
        insumoNombre: ins.nombre,
        cantidad: ins.cantidadTotal,
        unidad: ins.unidad,
        precioUnitario: ins.precioUnitarioCongelado
      })),
      manoObra: (item.manoObraSnapshot || []).map((mo) => ({
        categoriaId: mo.categoriaId,
        categoriaNombre: mo.nombreCategoria,
        horas: mo.horasTotales,
        costoHora: mo.costoHoraCongelado
      }))
    });
    setShowSaveAsTemplateModal(true);
  }, []);

  const selectedCliente = useMemo(() => {
    return clientes.find((c) => c.id === clienteId) || null;
  }, [clientes, clienteId]);

  const currentPresupuestoObj: Presupuesto = useMemo(() => ({
    id: existingPresupuesto?.id || 'pres-preview',
    numero: numero || 'IEBA-PREVIEW',
    revision: revision || 1,
    presupuestoOrigenId,
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





  const treeSheetRef = useRef<TreeSheetViewRef>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAddMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAddMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAddMenuOpen]);

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
    <div className="flex-1 min-h-0 w-full flex flex-col gap-2 overflow-hidden">
      {/* Barra de Trabajo Superior Limpia y Unificada (Fila única) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container px-3 sm:px-5 py-2.5 sm:py-3 rounded-2xl border border-outline-variant/20 shadow-xs">
        {/* Bloque Izquierdo: Volver + Encabezado Interactivo de Cliente y Obra */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={async () => {
              await flushAutoSave();
              onBack();
            }}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors shrink-0 cursor-pointer"
            title="Volver a la lista (guarda borrador automáticamente)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Tarjeta Clickeable / Botón Interactivo de Cliente y Obra */}
          <button
            type="button"
            onClick={() => setShowQuoteProjectModal(true)}
            className="group flex flex-col items-start px-2 py-1 -my-1 rounded-xl hover:bg-surface-container-highest/80 transition-colors cursor-pointer text-left min-w-0 max-w-[260px] sm:max-w-[380px] md:max-w-[480px] border border-transparent hover:border-outline-variant/30"
            title="Clic para configurar cliente, obra y condiciones de la cotización"
          >
            {/* Línea Principal: Cliente y Obra */}
            <div className="flex items-center gap-1.5 w-full min-w-0">
              <FileText className="w-4 h-4 text-primary shrink-0 group-hover:scale-110 transition-transform" />

              {selectedCliente ? (
                <span className="font-bold text-xs sm:text-sm md:text-base text-on-surface truncate group-hover:text-primary transition-colors">
                  {selectedCliente.nombre}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Asignar Cliente</span>
                </span>
              )}

              <span className="text-outline-variant/60 font-normal shrink-0">·</span>

              <span className="text-xs sm:text-sm font-medium text-on-surface-variant truncate">
                {direccionObra.trim() || 'Sin obra'}
              </span>

              <Pencil className="w-3 h-3 text-on-surface-variant/40 group-hover:text-primary group-hover:opacity-100 opacity-60 transition-all shrink-0 ml-0.5" />
            </div>

            {/* Línea Secundaria: Número de Cotización, Revisión y Estado de Autoguardado */}
            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono text-on-surface-variant/70 mt-0.5 min-w-0">
              <span className="truncate">
                {numero || (existingPresupuesto ? existingPresupuesto.numero : 'Borrador')} · Rev {revision || 1}
              </span>

              {/* Micro-indicador de Autoguardado en Línea */}
              {autoSaveStatus === 'saving' && (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 shrink-0">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  <span className="hidden sm:inline">Guardando...</span>
                </span>
              )}
              {autoSaveStatus === 'saved' && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0"
                  title={`Guardado ${lastAutoSaveTime ? `a las ${lastAutoSaveTime}` : 'automáticamente'}`}
                >
                  <Check className="w-2.5 h-2.5 text-emerald-500" />
                  <span className="hidden sm:inline">{lastAutoSaveTime ? `Guardado ${lastAutoSaveTime}` : 'Guardado'}</span>
                </span>
              )}
              {autoSaveStatus === 'error' && (
                <span className="inline-flex items-center gap-1 text-[10px] text-error shrink-0" title="Error al autoguardar">
                  <AlertCircle className="w-2.5 h-2.5" />
                  <span>Error</span>
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Bloque Central: Botón Único de Inserción + Parámetros de Obra + Paleta de Comandos (en modo árbol) */}
        {editorMode === 'arbol' && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Botón Único de Inserción: + Agregar ▾ */}
            <div ref={addMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsAddMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 min-h-[34px]"
                title="Agregar Partida, Capítulo o Tarea Tipo del Catálogo"
                aria-expanded={isAddMenuOpen}
                aria-haspopup="true"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Agregar</span>
                <ChevronDown
                  className={`w-3 h-3 transition-transform duration-200 ${
                    isAddMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Menú Desplegable Flotante Jerarquizado */}
              {isAddMenuOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-60 sm:w-64 bg-surface-container-high border border-outline-variant/40 rounded-2xl shadow-md3-2 p-1.5 z-40 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddMenuOpen(false);
                      treeSheetRef.current?.handleCreateChapter();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-surface-container-highest transition-colors cursor-pointer group"
                  >
                    <FolderPlus className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <span className="block text-xs font-bold text-on-surface">Nuevo Rubro</span>
                      <span className="block text-[10px] text-on-surface-variant">Etapa de obra o agrupación principal</span>
                    </div>
                  </button>

                  <div className="my-1 border-t border-outline-variant/20" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsAddMenuOpen(false);
                      treeSheetRef.current?.handleCreateItem();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-surface-container-highest transition-colors cursor-pointer group"
                  >
                    <Plus className="w-4 h-4 text-secondary shrink-0" />
                    <div>
                      <span className="block text-xs font-bold text-on-surface">Nuevo Ítem</span>
                      <span className="block text-[10px] text-on-surface-variant">Renglón en blanco para cómputo libre</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAddMenuOpen(false);
                      treeSheetRef.current?.openCatalogPicker();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-surface-container-highest transition-colors cursor-pointer group"
                  >
                    <BookOpen className="w-4 h-4 text-tertiary shrink-0" />
                    <div>
                      <span className="block text-xs font-bold text-on-surface">Desde Catálogo</span>
                      <span className="block text-[10px] text-on-surface-variant">Trabajo tipo con cómputo APU</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Parámetros de Obra */}
            <button
              type="button"
              onClick={() => treeSheetRef.current?.openQuoteParameters()}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-on-surface bg-surface-container-highest hover:bg-outline-variant/30 rounded-xl border border-outline-variant/30 transition-colors shadow-2xs cursor-pointer active:scale-95 min-h-[34px]"
              title="Variables globales, gastos indirectos, margen de riesgo y beneficio"
            >
              <Sliders className="w-3.5 h-3.5 text-primary" />
              <span className="hidden xs:inline">Parámetros</span>
            </button>

            {/* Paleta de Comandos Ctrl+K */}
            <button
              type="button"
              onClick={() => treeSheetRef.current?.openCommandPalette()}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-on-surface-variant hover:text-on-surface bg-surface-container-lowest hover:bg-surface-container rounded-xl border border-outline-variant/30 transition-colors cursor-pointer min-h-[34px]"
              title="Paleta de Comandos (Ctrl+K)"
            >
              <Command className="w-3.5 h-3.5" />
              <span className="text-[10px] font-mono">Ctrl+K</span>
            </button>
          </div>
        )}

        {/* Bloque Derecho: Switch Árbol/Experto + Botón Guardar */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto sm:ml-0">
          {/* Selector de Modo: Árbol vs Experto */}
          <div className="bg-surface-container-highest p-0.5 rounded-xl border border-outline-variant/30 flex items-center gap-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => handleToggleEditorMode('arbol')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                editorMode === 'arbol'
                  ? 'bg-surface text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Árbol-Planilla</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleEditorMode('experto')}
              disabled={isMobile}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
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
              <kbd className="hidden lg:inline text-[9px] opacity-70 font-mono">Alt+E</kbd>
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleSavePresupuesto('borrador')}
            className="px-3.5 py-1.5 bg-surface-container-highest hover:bg-outline-variant/30 text-on-surface font-semibold rounded-xl text-xs sm:text-sm transition-colors border border-outline-variant/30 min-h-[36px] cursor-pointer flex items-center gap-2 shadow-2xs active:scale-95"
            title="Guardar estado actual del borrador"
          >
            <Check className="w-4 h-4 text-primary" />
            <span className="hidden xs:inline">Guardar Borrador</span>
          </button>
        </div>
      </div>

      {editorMode === 'experto' ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
            onToggleGuidedMode={() => handleToggleEditorMode('arbol')}
            onOpenListaMateriales={() => setShowListaMaterialesModal(true)}
            onOpenMaterialsInCatalog={handleOpenMaterialsInCatalog}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-outline-variant/30 overflow-hidden shadow-xs bg-surface">
          <TreeSheetView
            ref={treeSheetRef}
            items={items}
            setItems={setItems}
            capitulos={capitulos}
            setCapitulos={setCapitulos}
            calculosVariables={calculosVariables}
            setCalculosVariables={setCalculosVariables}
            calculatedCells={calculatedCells}
            setCalculatedCells={setCalculatedCells}
            gastosConfig={gastosConfig}
            setGastosConfig={setGastosConfig}
            totales={totales}
            tareasTipo={tareasTipo}
            insumosMap={insumosMap}
            manoObraMap={manoObraMap}
            margenPorcentaje={margenPorcentaje}
            onUpdateMargenPorcentaje={setMargenPorcentaje}
            nivelMargenRiesgo={nivelMargenRiesgo}
            margenRiesgoPorcentaje={margenRiesgoPorcentaje}
            onUpdateMargenRiesgo={(nivel, pct) => {
              setNivelMargenRiesgo(nivel);
              setMargenRiesgoPorcentaje(pct);
            }}
            tipoFactura={tipoFactura}
            onUpdateTipoFactura={handleTipoFacturaChange}
            impuestosDetalle={impuestosDetalle}
            onToggleTax={handleToggleTax}
            onUpdateTaxPct={handleUpdateTaxPct}
            onOpenParametricJobModal={(tarea, itemIndex) => {
              if (itemIndex !== undefined && itemIndex !== null) {
                handleOpenParametricModalForExistingItem(itemIndex);
              } else {
                handleOpenParametricModalForNewTask(tarea);
              }
            }}
            onSaveAsTareaTipo={handleSaveAsTemplateAction}
            onOpenTextMode={() => handleToggleEditorMode('experto')}
            onSaveDraft={() => handleSavePresupuesto('borrador')}
          />
        </div>
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

      {/* Modal de Configuración de Cliente y Obra */}
      <QuoteProjectModal
        isOpen={showQuoteProjectModal}
        onClose={() => setShowQuoteProjectModal(false)}
        clientes={clientes}
        clienteId={clienteId}
        onSelectCliente={setClienteId}
        direccionObra={direccionObra}
        onUpdateDireccionObra={setDireccionObra}
        validezDias={validezDias}
        onUpdateValidezDias={setValidezDias}
        tipoFactura={tipoFactura}
        onUpdateTipoFactura={handleTipoFacturaChange}
        condicionesPagoTexto={condicionesPagoTexto}
        onUpdateCondicionesPagoTexto={setCondicionesPagoTexto}
        numero={numero}
        revision={revision}
      />
    </div>
  );
};
