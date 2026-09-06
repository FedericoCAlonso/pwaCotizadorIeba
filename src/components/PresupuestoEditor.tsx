import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Calculator
} from 'lucide-react';
import { SaveAsTareaTipoModal } from './SaveAsTareaTipoModal';
import { TareaEditorModal } from './tareasTipo/TareaEditorModal';
import { MaterialPickerModal, StagedItemPayload } from './tareasTipo/MaterialPickerModal';
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
  formatUSD,
  obtenerMultiplicadorCondicion,
  roundMoney,
  safeNum
} from '../core/calculations';
import { useAppOptions } from '../hooks/useAppOptions';
import { useToast } from '../contexts/ToastContext';
import { ItemPickerModal } from './presupuesto/ItemPickerModal';
import { EmisionPresupuestoModal } from './presupuesto/EmisionPresupuestoModal';
import { WhatsAppShareModal } from './presupuesto/WhatsAppShareModal';
import { ListaMaterialesModal } from './presupuesto/ListaMaterialesModal';
import { ParametricJobModal } from './presupuesto/ParametricJobModal';
import { ParametricMaterialModal } from './presupuesto/ParametricMaterialModal';
import { GastoEditorModal } from './presupuesto/GastoEditorModal';
import { GastoCatalogPickerModal } from './presupuesto/GastoCatalogPickerModal';
import { ParametricGastoModal } from './presupuesto/ParametricGastoModal';
import { ClienteCombobox } from './presupuesto/ClienteCombobox';
import { ActualizarPreciosModal } from './presupuesto/ActualizarPreciosModal';
import { MaterialBrandModal, ApplyBrandPayload } from './presupuesto/MaterialBrandModal';
import { usePresupuestoEditorViewModel } from '../viewmodels/usePresupuestoEditorViewModel';
import { PresupuestoEditorTabBar } from './presupuesto/editor/PresupuestoEditorTabBar';
import { ClienteTab } from './presupuesto/editor/ClienteTab';
import { PartidasTab } from './presupuesto/editor/PartidasTab';
import { CuadrillaTab } from './presupuesto/editor/CuadrillaTab';
import { ComercialTab } from './presupuesto/editor/ComercialTab';
import { PresupuestoLiveFooter } from './presupuesto/editor/PresupuestoLiveFooter';

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
    handleAddCapitulo,
    handleUpdateCapitulo,
    handleRemoveCapitulo,
    gastosConfig,
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
    flushAutoSave
  } = usePresupuestoEditorViewModel({
    presupuestoId,
    initialClienteId,
    config,
    onSaved,
    onViewMaterialsInCatalog,
    onDraftAutoSaved
  });

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [parametricGastoToAdjust, setParametricGastoToAdjust] = useState<GastoPresupuestoConfig | null>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showListaMaterialesModal, setShowListaMaterialesModal] = useState(false);

  const selectedCliente = useMemo(() => {
    return clientes.find((c) => c.id === clienteId) || null;
  }, [clientes, clienteId]);

  const currentPresupuestoObj: Presupuesto = useMemo(() => ({
    id: existingPresupuesto?.id || 'pres-preview',
    numero: numero || 'IEBA-PREVIEW',
    clienteId,
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
  const [saveAsTemplateData, setSaveAsTemplateData] = useState<{
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
  }>({
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

  const handleUpdateItemCondicion = (index: number, condicion: 'normal' | 'dificultosa' | 'favorable') => {
    setItems((prev) => {
      const next = [...prev];
      const target = next[index];
      const mult = obtenerMultiplicadorCondicion(condicion, {
        multiplicadorCondicionNormal: config.multiplicadorCondicionNormal,
        multiplicadorCondicionDificultosa: config.multiplicadorCondicionDificultosa,
        multiplicadorCondicionFavorable: config.multiplicadorCondicionFavorable
      });

      const manoObraSnap = target.manoObraSnapshot || [];
      const manoObraActualizada = manoObraSnap.map(mo => {
        const horasAjustadas = mo.horasTotales * mult;
        return {
          ...mo,
          subtotalManoObra: roundMoney(mo.costoHoraCongelado * horasAjustadas)
        };
      });

      const costoManoObra = roundMoney(manoObraActualizada.reduce((acc, m) => acc + m.subtotalManoObra, 0));
      const costoInsumos = safeNum(target.costoInsumos);
      const costoServicios = safeNum(target.costoServiciosTercerizados);
      const hasSnapshots = (target.insumosSnapshot && target.insumosSnapshot.length > 0) || manoObraSnap.length > 0;

      const costoDirectoTotal = hasSnapshots
        ? roundMoney(costoInsumos + costoManoObra + costoServicios)
        : safeNum(target.costoDirectoTotal);

      next[index] = {
        ...target,
        condicionTrabajo: condicion,
        manoObraSnapshot: manoObraActualizada,
        costoManoObra,
        costoDirectoTotal,
        costoUnitario: roundMoney(costoDirectoTotal / (target.cantidad || 1)),
        costoTotal: costoDirectoTotal
      };
      return next;
    });
  };

  const handleUpdateItemQuantity = (index: number, qty: number | null, formula?: string) => {
    setItems((prev) => {
      const next = [...prev];
      const target = next[index];
      if (!target) return prev;

      if (qty === null || isNaN(qty as number)) {
        next[index] = {
          ...target,
          cantidad: null as any,
          formulaCantidad: formula,
        };
        return next;
      }

      const safeQty = Math.max(0.001, safeNum(qty));
      const prevQty = safeNum(target.cantidad) || 1;

      const insumosSnap = target.insumosSnapshot || [];
      const manoObraSnap = target.manoObraSnapshot || [];

      const insumosActualizados = insumosSnap.map(i => {
        const unitQty = i.cantidadUnitaria !== undefined ? i.cantidadUnitaria : i.cantidadTotal / prevQty;
        const cantTotal = roundMoney(unitQty * safeQty);
        return {
          ...i,
          cantidadUnitaria: unitQty,
          cantidadTotal: cantTotal,
          subtotalInsumo: roundMoney(i.precioUnitarioCongelado * cantTotal)
        };
      });

      const manoObraActualizada = manoObraSnap.map(m => {
        const unitHoras = m.horasUnitarias !== undefined ? m.horasUnitarias : m.horasTotales / prevQty;
        const hTotales = roundMoney(unitHoras * safeQty);
        return {
          ...m,
          horasUnitarias: unitHoras,
          horasTotales: hTotales,
          subtotalManoObra: roundMoney(m.costoHoraCongelado * hTotales)
        };
      });

      const costoInsumos = roundMoney(insumosActualizados.reduce((acc, i) => acc + i.subtotalInsumo, 0));
      const costoManoObra = roundMoney(manoObraActualizada.reduce((acc, m) => acc + m.subtotalManoObra, 0));
      const hasSnapshots = insumosSnap.length > 0 || manoObraSnap.length > 0;
      
      const unitDirectCost = target.costoUnitario !== undefined 
        ? target.costoUnitario 
        : roundMoney((target.costoDirectoTotal || 0) / prevQty);

      const costoDirectoTotal = hasSnapshots
        ? roundMoney(costoInsumos + costoManoObra + safeNum(target.costoServiciosTercerizados))
        : roundMoney(unitDirectCost * safeQty);

      const updatedCostoManoObra = hasSnapshots
        ? costoManoObra
        : Math.max(0, roundMoney(costoDirectoTotal - costoInsumos - safeNum(target.costoServiciosTercerizados)));

      next[index] = {
        ...target,
        cantidad: safeQty,
        formulaCantidad: formula,
        insumosSnapshot: insumosActualizados,
        manoObraSnapshot: manoObraActualizada,
        costoInsumos,
        costoManoObra: updatedCostoManoObra,
        costoDirectoTotal,
        costoUnitario: hasSnapshots ? roundMoney(costoDirectoTotal / safeQty) : unitDirectCost,
        costoTotal: costoDirectoTotal
      };
      return next;
    });
  };

  const handleUpdateItemUnitDirectCost = (index: number, cost: number | null) => {
    setItems((prev) => {
      const next = [...prev];
      const target = next[index];
      if (!target) return prev;

      if (cost === null || isNaN(cost as number)) {
        next[index] = {
          ...target,
          costoUnitario: null as any,
          costoManoObra: 0,
          costoDirectoTotal: 0,
          costoTotal: 0
        };
        return next;
      }

      const safeCost = Math.max(0, safeNum(cost));
      const qty = safeNum(target.cantidad) || 1;
      const costoDirectoTotal = roundMoney(safeCost * qty);

      const hasSnapshots = (target.insumosSnapshot && target.insumosSnapshot.length > 0) ||
                           (target.manoObraSnapshot && target.manoObraSnapshot.length > 0);
      const costoInsumos = safeNum(target.costoInsumos);
      const costoServicios = safeNum(target.costoServiciosTercerizados);
      const costoManoObra = hasSnapshots
        ? safeNum(target.costoManoObra)
        : Math.max(0, roundMoney(costoDirectoTotal - costoInsumos - costoServicios));

      next[index] = {
        ...target,
        costoUnitario: safeCost,
        costoManoObra,
        costoDirectoTotal,
        costoTotal: costoDirectoTotal
      };
      return next;
    });
  };

  const handleUpdateItemDescription = (index: number, desc: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], descripcion: desc };
      return next;
    });
  };

  const handleUpdateItemUnit = (index: number, unit: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], unidad: unit };
      return next;
    });
  };

  const handleAddMaterialsToItem = (itemIndex: number, stagedItems: StagedItemPayload[]) => {
    if (!stagedItems || stagedItems.length === 0) return;

    setItems((prev) => {
      const next = [...prev];
      const target = next[itemIndex];
      if (!target) return prev;

      const isFacturaC_or_X = tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
      const existingSnapshots = [...(target.insumosSnapshot || [])];

      for (const staged of stagedItems) {
        const { material, cantidad } = staged;
        const ali = material.alicuotaIVA ?? config.alicuotaIVAPorDefecto ?? 21;
        const precioNeto = roundMoney(safeNum(material.precioActual));
        const precioFinal = roundMoney(precioNeto * (1 + ali / 100));

        const existingIdx = existingSnapshots.findIndex(
          (s) => s.insumoId === material.id || s.materialId === material.id
        );

        if (existingIdx >= 0) {
          const cur = existingSnapshots[existingIdx];
          const newQty = roundMoney(cur.cantidadTotal + cantidad);
          existingSnapshots[existingIdx] = {
            ...cur,
            cantidadTotal: newQty,
            cantidadUnitaria: roundMoney(newQty / (target.cantidad || 1)),
            subtotalInsumo: roundMoney(cur.precioUnitarioCongelado * newQty),
            subtotalInsumoFinal: roundMoney((cur.precioFinalUnitarioCongelado || precioFinal) * newQty)
          };
        } else {
          existingSnapshots.push({
            insumoId: material.id,
            materialId: material.id,
            nombre: material.nombre,
            marca: material.marca,
            productoId: material.productoId,
            unidad: material.unidadVenta || material.unidad || 'u',
            cantidadTotal: cantidad,
            cantidadUnitaria: roundMoney(cantidad / (target.cantidad || 1)),
            precioUnitarioCongelado: precioNeto,
            alicuotaIVA: ali,
            precioFinalUnitarioCongelado: precioFinal,
            subtotalInsumo: roundMoney(precioNeto * cantidad),
            subtotalInsumoFinal: roundMoney(precioFinal * cantidad)
          });
        }
      }

      const costoInsumos = isFacturaC_or_X
        ? roundMoney(
            existingSnapshots.reduce(
              (acc, i) =>
                acc +
                (i.subtotalInsumoFinal ??
                  roundMoney(i.precioUnitarioCongelado * (1 + (i.alicuotaIVA ?? 21) / 100) * i.cantidadTotal)),
              0
            )
          )
        : roundMoney(existingSnapshots.reduce((acc, i) => acc + i.subtotalInsumo, 0));

      let costoManoObra = safeNum(target.costoManoObra);
      if (
        costoManoObra === 0 &&
        (!target.insumosSnapshot || target.insumosSnapshot.length === 0) &&
        safeNum(target.costoDirectoTotal) > 0
      ) {
        costoManoObra = safeNum(target.costoDirectoTotal);
      }

      const costoServicios = safeNum(target.costoServiciosTercerizados);
      const costoDirectoTotal = roundMoney(costoInsumos + costoManoObra + costoServicios);
      const safeQty = target.cantidad || 1;

      next[itemIndex] = {
        ...target,
        insumosSnapshot: existingSnapshots,
        costoInsumos,
        costoManoObra,
        costoDirectoTotal,
        costoUnitario: roundMoney(costoDirectoTotal / safeQty),
        costoTotal: costoDirectoTotal
      };

      return next;
    });

    toast.success(
      stagedItems.length === 1
        ? `Material "${stagedItems[0].material.nombre}" incorporado a la partida`
        : `${stagedItems.length} materiales incorporados a la partida`
    );
  };

  const handleUpdateItemMaterialQuantity = (itemIndex: number, materialIndex: number, newQty: number | null) => {
    const safeQty = Math.max(0, safeNum(newQty));
    if (safeQty === 0) {
      handleRemoveItemMaterial(itemIndex, materialIndex);
      return;
    }

    setItems((prev) => {
      const next = [...prev];
      const target = next[itemIndex];
      if (!target || !target.insumosSnapshot) return prev;

      const snapshots = [...target.insumosSnapshot];
      const snap = snapshots[materialIndex];
      if (!snap) return prev;

      snapshots[materialIndex] = {
        ...snap,
        cantidadTotal: safeQty,
        cantidadUnitaria: roundMoney(safeQty / (target.cantidad || 1)),
        subtotalInsumo: roundMoney(snap.precioUnitarioCongelado * safeQty),
        subtotalInsumoFinal: roundMoney(
          (snap.precioFinalUnitarioCongelado || snap.precioUnitarioCongelado * 1.21) * safeQty
        )
      };

      const isFacturaC_or_X = tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
      const costoInsumos = isFacturaC_or_X
        ? roundMoney(
            snapshots.reduce(
              (acc, i) =>
                acc +
                (i.subtotalInsumoFinal ??
                  roundMoney(i.precioUnitarioCongelado * (1 + (i.alicuotaIVA ?? 21) / 100) * i.cantidadTotal)),
              0
            )
          )
        : roundMoney(snapshots.reduce((acc, i) => acc + i.subtotalInsumo, 0));

      const costoDirectoTotal = roundMoney(
        costoInsumos + safeNum(target.costoManoObra) + safeNum(target.costoServiciosTercerizados)
      );
      const targetQty = target.cantidad || 1;

      next[itemIndex] = {
        ...target,
        insumosSnapshot: snapshots,
        costoInsumos,
        costoDirectoTotal,
        costoUnitario: roundMoney(costoDirectoTotal / targetQty),
        costoTotal: costoDirectoTotal
      };
      return next;
    });
  };

  const handleRemoveItemMaterial = (itemIndex: number, materialIndex: number) => {
    setItems((prev) => {
      const next = [...prev];
      const target = next[itemIndex];
      if (!target || !target.insumosSnapshot) return prev;

      const snapshots = target.insumosSnapshot.filter((_, idx) => idx !== materialIndex);
      const isFacturaC_or_X = tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
      const costoInsumos = isFacturaC_or_X
        ? roundMoney(
            snapshots.reduce(
              (acc, i) =>
                acc +
                (i.subtotalInsumoFinal ??
                  roundMoney(i.precioUnitarioCongelado * (1 + (i.alicuotaIVA ?? 21) / 100) * i.cantidadTotal)),
              0
            )
          )
        : roundMoney(snapshots.reduce((acc, i) => acc + i.subtotalInsumo, 0));

      const costoDirectoTotal = roundMoney(
        costoInsumos + safeNum(target.costoManoObra) + safeNum(target.costoServiciosTercerizados)
      );
      const targetQty = target.cantidad || 1;

      next[itemIndex] = {
        ...target,
        insumosSnapshot: snapshots,
        costoInsumos,
        costoDirectoTotal,
        costoUnitario: roundMoney(costoDirectoTotal / targetQty),
        costoTotal: costoDirectoTotal
      };
      return next;
    });
    toast.info('Material quitado de la partida');
  };

  const handleApplyMaterialBrand = (payload: ApplyBrandPayload) => {
    if (!brandModalTarget) return;
    const { itemIndex, materialIndex } = brandModalTarget;

    setItems((prev) => {
      const next = [...prev];
      const target = next[itemIndex];
      if (!target || !target.insumosSnapshot) return prev;

      const snapshots = [...target.insumosSnapshot];
      const snap = snapshots[materialIndex];
      if (!snap) return prev;

      const newPrice = roundMoney(payload.precioUnitario > 0 ? payload.precioUnitario : snap.precioUnitarioCongelado);
      const ali = snap.alicuotaIVA ?? config.alicuotaIVAPorDefecto ?? 21;
      const newPriceFinal = roundMoney(newPrice * (1 + ali / 100));

      snapshots[materialIndex] = {
        ...snap,
        marca: payload.marca || undefined,
        productoId: payload.productoId,
        ofertaId: payload.ofertaId,
        precioUnitarioCongelado: newPrice,
        precioFinalUnitarioCongelado: newPriceFinal,
        subtotalInsumo: roundMoney(newPrice * snap.cantidadTotal),
        subtotalInsumoFinal: roundMoney(newPriceFinal * snap.cantidadTotal)
      };

      const isFacturaC_or_X = tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
      const costoInsumos = isFacturaC_or_X
        ? roundMoney(
            snapshots.reduce(
              (acc, i) =>
                acc +
                (i.subtotalInsumoFinal ??
                  roundMoney(i.precioUnitarioCongelado * (1 + (i.alicuotaIVA ?? 21) / 100) * i.cantidadTotal)),
              0
            )
          )
        : roundMoney(snapshots.reduce((acc, i) => acc + i.subtotalInsumo, 0));

      const costoDirectoTotal = roundMoney(
        costoInsumos + safeNum(target.costoManoObra) + safeNum(target.costoServiciosTercerizados)
      );
      const targetQty = target.cantidad || 1;

      next[itemIndex] = {
        ...target,
        insumosSnapshot: snapshots,
        costoInsumos,
        costoDirectoTotal,
        costoUnitario: roundMoney(costoDirectoTotal / targetQty),
        costoTotal: costoDirectoTotal
      };
      return next;
    });

    toast.success(
      payload.marca
        ? `Marca "${payload.marca}" asignada al material`
        : 'Material actualizado a genérico / sin marca'
    );
    setBrandModalTarget(null);
  };

  const handleUpdateItemManoObraCost = (index: number, moCost: number | null) => {
    const safeMOCost = Math.max(0, safeNum(moCost));
    setItems((prev) => {
      const next = [...prev];
      const target = next[index];
      const costoInsumos = safeNum(target.costoInsumos);
      const costoServicios = safeNum(target.costoServiciosTercerizados);
      const costoDirectoTotal = roundMoney(costoInsumos + safeMOCost + costoServicios);
      const qty = target.cantidad || 1;

      next[index] = {
        ...target,
        costoManoObra: safeMOCost,
        costoDirectoTotal,
        costoUnitario: roundMoney(costoDirectoTotal / qty),
        costoTotal: costoDirectoTotal
      };
      return next;
    });
  };

  const handleAddLaborToItem = (itemIndex: number, categoriaId: string, horas: number) => {
    const catMO = manoObraMap.get(categoriaId);
    if (!catMO) return;

    const safeHoras = Math.max(0.1, safeNum(horas) || 1);
    const costoHora = roundMoney(safeNum(catMO.costoHora));

    setItems((prev) => {
      const next = [...prev];
      const target = next[itemIndex];
      if (!target) return prev;

      const mult = obtenerMultiplicadorCondicion(target.condicionTrabajo || 'normal', {
        multiplicadorCondicionNormal: config.multiplicadorCondicionNormal,
        multiplicadorCondicionDificultosa: config.multiplicadorCondicionDificultosa,
        multiplicadorCondicionFavorable: config.multiplicadorCondicionFavorable
      });

      const existingSnapshots = [...(target.manoObraSnapshot || [])];
      const existingIdx = existingSnapshots.findIndex((s) => s.categoriaId === categoriaId);

      if (existingIdx >= 0) {
        const cur = existingSnapshots[existingIdx];
        const newHoras = roundMoney(cur.horasTotales + safeHoras);
        existingSnapshots[existingIdx] = {
          ...cur,
          horasTotales: newHoras,
          horasUnitarias: roundMoney(newHoras / (target.cantidad || 1)),
          subtotalManoObra: roundMoney(cur.costoHoraCongelado * (newHoras * mult))
        };
      } else {
        existingSnapshots.push({
          categoriaId: catMO.id,
          nombreCategoria: catMO.nombre,
          horasUnitarias: roundMoney(safeHoras / (target.cantidad || 1)),
          horasTotales: safeHoras,
          costoHoraCongelado: costoHora,
          subtotalManoObra: roundMoney(costoHora * (safeHoras * mult))
        });
      }

      const costoManoObra = roundMoney(existingSnapshots.reduce((acc, m) => acc + m.subtotalManoObra, 0));
      const isFacturaC_or_X = tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
      const insumosSnap = target.insumosSnapshot || [];
      const costoInsumos = insumosSnap.length > 0
        ? (isFacturaC_or_X
            ? roundMoney(
                insumosSnap.reduce(
                  (acc, i) =>
                    acc +
                    (i.subtotalInsumoFinal ??
                      roundMoney(i.precioUnitarioCongelado * (1 + (i.alicuotaIVA ?? 21) / 100) * i.cantidadTotal)),
                  0
                )
              )
            : roundMoney(insumosSnap.reduce((acc, i) => acc + i.subtotalInsumo, 0)))
        : safeNum(target.costoInsumos);

      const costoServicios = safeNum(target.costoServiciosTercerizados);
      const costoDirectoTotal = roundMoney(costoInsumos + costoManoObra + costoServicios);
      const safeQty = target.cantidad || 1;

      next[itemIndex] = {
        ...target,
        manoObraSnapshot: existingSnapshots,
        costoManoObra,
        costoDirectoTotal,
        costoUnitario: roundMoney(costoDirectoTotal / safeQty),
        costoTotal: costoDirectoTotal
      };

      return next;
    });

    toast.success(`Mano de obra "${catMO.nombre}" agregada a la partida`);
  };

  const handleUpdateItemLaborHours = (itemIndex: number, laborIndex: number, newHours: number | null) => {
    const safeHours = Math.max(0, safeNum(newHours));
    if (safeHours === 0) {
      handleRemoveItemLabor(itemIndex, laborIndex);
      return;
    }

    setItems((prev) => {
      const next = [...prev];
      const target = next[itemIndex];
      if (!target || !target.manoObraSnapshot) return prev;

      const mult = obtenerMultiplicadorCondicion(target.condicionTrabajo || 'normal', {
        multiplicadorCondicionNormal: config.multiplicadorCondicionNormal,
        multiplicadorCondicionDificultosa: config.multiplicadorCondicionDificultosa,
        multiplicadorCondicionFavorable: config.multiplicadorCondicionFavorable
      });

      const snapshots = [...target.manoObraSnapshot];
      const snap = snapshots[laborIndex];
      if (!snap) return prev;

      snapshots[laborIndex] = {
        ...snap,
        horasTotales: safeHours,
        horasUnitarias: roundMoney(safeHours / (target.cantidad || 1)),
        subtotalManoObra: roundMoney(snap.costoHoraCongelado * (safeHours * mult))
      };

      const costoManoObra = roundMoney(snapshots.reduce((acc, m) => acc + m.subtotalManoObra, 0));
      const isFacturaC_or_X = tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
      const insumosSnap = target.insumosSnapshot || [];
      const costoInsumos = insumosSnap.length > 0
        ? (isFacturaC_or_X
            ? roundMoney(
                insumosSnap.reduce(
                  (acc, i) =>
                    acc +
                    (i.subtotalInsumoFinal ??
                      roundMoney(i.precioUnitarioCongelado * (1 + (i.alicuotaIVA ?? 21) / 100) * i.cantidadTotal)),
                  0
                )
              )
            : roundMoney(insumosSnap.reduce((acc, i) => acc + i.subtotalInsumo, 0)))
        : safeNum(target.costoInsumos);

      const costoServicios = safeNum(target.costoServiciosTercerizados);
      const costoDirectoTotal = roundMoney(costoInsumos + costoManoObra + costoServicios);
      const targetQty = target.cantidad || 1;

      next[itemIndex] = {
        ...target,
        manoObraSnapshot: snapshots,
        costoManoObra,
        costoDirectoTotal,
        costoUnitario: roundMoney(costoDirectoTotal / targetQty),
        costoTotal: costoDirectoTotal
      };

      return next;
    });
  };

  const handleRemoveItemLabor = (itemIndex: number, laborIndex: number) => {
    setItems((prev) => {
      const next = [...prev];
      const target = next[itemIndex];
      if (!target || !target.manoObraSnapshot) return prev;

      const snapshots = target.manoObraSnapshot.filter((_, idx) => idx !== laborIndex);
      const costoManoObra = roundMoney(snapshots.reduce((acc, m) => acc + m.subtotalManoObra, 0));
      const isFacturaC_or_X = tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
      const insumosSnap = target.insumosSnapshot || [];
      const costoInsumos = insumosSnap.length > 0
        ? (isFacturaC_or_X
            ? roundMoney(
                insumosSnap.reduce(
                  (acc, i) =>
                    acc +
                    (i.subtotalInsumoFinal ??
                      roundMoney(i.precioUnitarioCongelado * (1 + (i.alicuotaIVA ?? 21) / 100) * i.cantidadTotal)),
                  0
                )
              )
            : roundMoney(insumosSnap.reduce((acc, i) => acc + i.subtotalInsumo, 0)))
        : safeNum(target.costoInsumos);

      const costoServicios = safeNum(target.costoServiciosTercerizados);
      const costoDirectoTotal = roundMoney(costoInsumos + costoManoObra + costoServicios);
      const targetQty = target.cantidad || 1;

      next[itemIndex] = {
        ...target,
        manoObraSnapshot: snapshots,
        costoManoObra,
        costoDirectoTotal,
        costoUnitario: roundMoney(costoDirectoTotal / targetQty),
        costoTotal: costoDirectoTotal
      };

      return next;
    });

    toast.info('Rol de mano de obra quitado de la partida');
  };





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
    <div className="space-y-4 sm:space-y-5 max-w-7xl mx-auto pb-12">
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
              <p className="text-xs text-on-surface-variant">
                Cálculo de costos en capas (materiales, mano de obra, indirectos, margen, impuestos).
              </p>
              {autoSaveStatus === 'saving' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Guardando borrador...
                </span>
              )}
              {autoSaveStatus === 'saved' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  Borrador guardado {lastAutoSaveTime ? `a las ${lastAutoSaveTime}` : 'automáticamente'}
                </span>
              )}
              {autoSaveStatus === 'error' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-error/10 text-error border border-error/20 shadow-xs">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Error al autoguardar
                </span>
              )}
              {autoSaveStatus === 'idle' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-container-highest text-on-surface-variant border border-outline-variant/30 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-primary/70"></span>
                  Autoguardado de borrador activo
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto flex-wrap">
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleRecalcularConPreciosVigentes}
              className="flex-1 sm:flex-none px-3.5 sm:px-4 py-2 sm:py-2.5 bg-surface-variant hover:bg-surface-container-highest text-on-surface font-semibold rounded-full text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-xs min-h-[38px]"
              title="Actualiza los precios de todos los insumos congelados de la cotización con los valores vigentes del catálogo"
            >
              <RefreshCw className="w-4 h-4 text-primary" />
              <span>Actualizar Precios</span>
            </button>
          )}
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setShowListaMaterialesModal(true)}
              className="flex-1 sm:flex-none px-3.5 sm:px-4 py-2 sm:py-2.5 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-semibold rounded-full text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-xs min-h-[38px]"
              title="Ver la lista consolidada de materiales (BOM), abrir en catálogo, exportar a Excel o enviar por WhatsApp"
            >
              <Package className="w-4 h-4 text-primary" />
              <span>Lista Materiales</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSavePresupuesto('borrador')}
            className="flex-1 sm:flex-none px-4 sm:px-5 py-2 sm:py-2.5 bg-surface-variant hover:bg-surface-container-highest text-on-surface font-semibold rounded-full text-xs sm:text-sm transition-colors min-h-[38px]"
          >
            Guardar Borrador
          </button>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setShowWhatsAppModal(true)}
              className="flex-1 sm:flex-none px-3.5 sm:px-4 py-2 sm:py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold rounded-full text-xs sm:text-sm shadow-sm flex items-center justify-center gap-1.5 transition-all min-h-[38px]"
              title="Compartir cotización por WhatsApp (formato directo o plataformas como Vaitty)"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowEmitirModal(true)}
            className="flex-1 sm:flex-none px-5 sm:px-6 py-2 sm:py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 min-h-[38px]"
          >
            <Lock className="w-4 h-4" />
            <span>Emitir Presupuesto</span>
          </button>
        </div>
      </div>

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

      {/* Item Picker Modal */}
      <ItemPickerModal
        isOpen={showItemPickerModal}
        onClose={() => setShowItemPickerModal(false)}
        tareasTipo={tareasTipo}
        insumosMap={insumosMap}
        manoObraMap={manoObraMap}
        onSelectTarea={(tarea) => handleAddTareaTipoItem(tarea, 1, targetCapituloIdForModal)}
        onConfigureParametricTarea={(tarea) => handleOpenParametricModalForNewTask(tarea, targetCapituloIdForModal)}
        onAddCustomItem={(desc) => handleAddDirectItem(targetCapituloIdForModal, desc)}
      />

      {/* Parametric Job Dynamic Variables & Formulas Modal */}
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
            handleConfirmParametricJob(selectedTareaForParametricModal, resultado);
          }}
        />
      )}

      {/* Parametric Material Estimation Modal (Superficie, Cañería, Desperdicio) */}
      {showParametricMaterialModal && editingItemIndexForMaterialModal !== null && items[editingItemIndexForMaterialModal] && (
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
          onConfirm={handleApplyMaterialEstimation}
        />
      )}

      {/* Emisión Modal */}
      <EmisionPresupuestoModal
        isOpen={showEmitirModal}
        onClose={() => setShowEmitirModal(false)}
        opcionesEmision={opcionesEmision}
        setOpcionesEmision={setOpcionesEmision}
        condicionesPagoTexto={condicionesPagoTexto}
        totales={totales}
        onConfirmEmitir={(opciones) => handleSavePresupuesto('enviado', opciones)}
      />

      {/* Save as Template Modal */}
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

      {/* In-Situ Task APU Editor Modal */}
      {showInSituEditorModal && (
        <TareaEditorModal
          isOpen={showInSituEditorModal}
          onClose={() => setShowInSituEditorModal(false)}
          editingTarea={editingTareaForInSituModal}
          categoriasList={categoriasTarea}
          insumosMap={insumosMap}
          manoObraList={manoObraList}
          manoObraMap={manoObraMap}
          onSave={handleSaveInSituItem}
          titleOverride="Componer Partida para esta Cotización (In-Situ)"
          submitButtonText="Aplicar a la Cotización"
        />
      )}

      {/* Selector de Materiales del Catálogo para Partidas Libres / Directas */}
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
            handleAddMaterialsToItem(materialPickerItemIndex, [{ material: mat, cantidad: qty, formula }]);
          }}
          onAddMultipleMaterials={(stagedItems) => {
            handleAddMaterialsToItem(materialPickerItemIndex, stagedItems);
          }}
        />
      )}

      {/* Selector de Marca / Modelo para Material en Partida */}
      {brandModalTarget !== null &&
        items[brandModalTarget.itemIndex]?.insumosSnapshot?.[brandModalTarget.materialIndex] && (
          <MaterialBrandModal
            isOpen={brandModalTarget !== null}
            onClose={() => setBrandModalTarget(null)}
            materialSnapshot={items[brandModalTarget.itemIndex].insumosSnapshot[brandModalTarget.materialIndex]}
            itemDescription={items[brandModalTarget.itemIndex]?.descripcion || 'Partida'}
            onApplyBrand={handleApplyMaterialBrand}
          />
        )}

      {/* Gasto & Modificadores Modal */}
      <GastoEditorModal
        isOpen={showGastoModal}
        onClose={() => {
          setShowGastoModal(false);
          setEditingGasto(null);
        }}
        gastoToEdit={editingGasto}
        capitulos={capitulos}
        costosIndirectosCatalog={costosIndirectos}
        onSave={handleSaveGasto}
        onDelete={handleRemoveGasto}
        baseMateriales={totales.subtotalInsumosBase}
        baseManoObra={totales.subtotalManoObraBase}
        baseServicios={totales.subtotalServiciosBase}
        baseCostoDirecto={totales.costoGlobal}
      />

      {/* Gasto Catalog Picker Modal */}
      <GastoCatalogPickerModal
        isOpen={showGastoCatalogPickerModal}
        onClose={() => setShowGastoCatalogPickerModal(false)}
        catalogGastos={costosIndirectos}
        currentGastosConfig={gastosConfig}
        onAddGastos={handleAddGastosFromCatalog}
      />

      {/* Parametric Gasto Variables Modal */}
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
            handleUpdateGastoParametros(gastoId, valores);
            setParametricGastoToAdjust(null);
          }}
        />
      )}

      {/* Modal de Envío por WhatsApp */}
      <WhatsAppShareModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        presupuesto={currentPresupuestoObj}
        cliente={selectedCliente}
        config={config}
      />

      {/* Modal de Lista Consolidada de Materiales (BOM) */}
      <ListaMaterialesModal
        isOpen={showListaMaterialesModal}
        onClose={() => setShowListaMaterialesModal(false)}
        presupuesto={currentPresupuestoObj}
        cliente={selectedCliente}
        config={config}
        onOpenInCatalog={onViewMaterialsInCatalog ? handleOpenMaterialsInCatalog : undefined}
      />

      {/* Modal de Actualización Integral de Precios y Tarifas */}
      <ActualizarPreciosModal
        isOpen={showActualizarPreciosModal}
        onClose={() => setShowActualizarPreciosModal(false)}
        analisis={analisisPreciosModal}
        onConfirm={handleConfirmActualizarPrecios}
      />
    </div>
  );
};
