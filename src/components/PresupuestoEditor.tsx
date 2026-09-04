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
  Clock
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
import { PresupuestoItemRow } from './presupuesto/PresupuestoItemRow';
import { PresupuestoTotalsCard } from './presupuesto/PresupuestoTotalsCard';
import { PlanificadorCuadrillaCard } from './presupuesto/PlanificadorCuadrillaCard';
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
import { usePresupuestoEditorViewModel } from '../viewmodels/usePresupuestoEditorViewModel';

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
    beneficioPorcentaje: margenPorcentaje,
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
    margenPorcentaje,
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
        showInSituEditorModal
      ) {
        return;
      }

      // Alt + N / Alt + I -> Add Direct Item
      if (e.altKey && (e.key === 'n' || e.key === 'N' || e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        handleAddDirectItem();
        return;
      }

      // Alt + C / Alt + T / Ctrl + K -> Open Catalog Picker
      if (
        (e.altKey && (e.key === 'c' || e.key === 'C' || e.key === 't' || e.key === 'T')) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K'))
      ) {
        e.preventDefault();
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

  const handleUpdateItemQuantity = (index: number, qty: number, formula?: string) => {
    const safeQty = Math.max(0.01, safeNum(qty) || 1);
    setItems((prev) => {
      const next = [...prev];
      const target = next[index];
      const prevQty = target.cantidad || 1;

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

      next[index] = {
        ...target,
        cantidad: safeQty,
        formulaCantidad: formula,
        insumosSnapshot: insumosActualizados,
        manoObraSnapshot: manoObraActualizada,
        costoInsumos,
        costoManoObra,
        costoDirectoTotal,
        costoUnitario: hasSnapshots ? roundMoney(costoDirectoTotal / safeQty) : unitDirectCost,
        costoTotal: costoDirectoTotal
      };
      return next;
    });
  };

  const handleUpdateItemUnitDirectCost = (index: number, cost: number) => {
    const safeCost = Math.max(0, safeNum(cost));
    setItems((prev) => {
      const next = [...prev];
      const target = next[index];
      const qty = target.cantidad || 1;
      const costoDirectoTotal = roundMoney(safeCost * qty);

      next[index] = {
        ...target,
        costoUnitario: safeCost,
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

  const handleUpdateItemMaterialQuantity = (itemIndex: number, materialIndex: number, newQty: number) => {
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

  const handleUpdateItemManoObraCost = (index: number, moCost: number) => {
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
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container p-5 rounded-3xl shadow-sm border border-outline-variant/20">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={async () => {
              await flushAutoSave();
              onBack();
            }}
            className="p-2.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors"
            title="Volver (guarda el borrador automáticamente)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <span>
                {existingPresupuesto ? `Editar Cotización ${existingPresupuesto.numero}` : 'Nueva Cotización Eléctrica'}
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <p className="text-xs text-on-surface-variant">
                Cálculo de costos en capas (materiales, mano de obra, indirectos, margen, impuestos).
              </p>
              {autoSaveStatus === 'saving' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Guardando borrador...
                </span>
              )}
              {autoSaveStatus === 'saved' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                  <Check className="w-3 h-3 text-emerald-500" />
                  Borrador guardado {lastAutoSaveTime ? `a las ${lastAutoSaveTime}` : 'automáticamente'}
                </span>
              )}
              {autoSaveStatus === 'error' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-error/10 text-error border border-error/20 shadow-xs">
                  <AlertCircle className="w-3 h-3" />
                  Error al autoguardar
                </span>
              )}
              {autoSaveStatus === 'idle' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-surface-container-highest text-on-surface-variant border border-outline-variant/30 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/70"></span>
                  Autoguardado de borrador activo
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleRecalcularConPreciosVigentes}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-surface-variant hover:bg-surface-container-highest text-on-surface font-semibold rounded-full text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
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
              className="flex-1 sm:flex-none px-4 py-2.5 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-semibold rounded-full text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              title="Ver la lista consolidada de materiales (BOM), abrir en catálogo, exportar a Excel o enviar por WhatsApp"
            >
              <Package className="w-4 h-4 text-primary" />
              <span>Lista Materiales</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSavePresupuesto('borrador')}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-surface-variant hover:bg-surface-container-highest text-on-surface font-semibold rounded-full text-xs transition-colors"
          >
            Guardar Borrador
          </button>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setShowWhatsAppModal(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold rounded-full text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all"
              title="Compartir cotización por WhatsApp (formato directo o plataformas como Vaitty)"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowEmitirModal(true)}
            className="flex-1 sm:flex-none px-6 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-xs shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Lock className="w-4 h-4" />
            <span>Emitir Presupuesto</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Header Info & Items List (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Metadata Card */}
          <div className="bg-surface-container-low rounded-3xl p-6 space-y-5 border border-outline-variant/10 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wide">
              Datos Generales & Tipo de Comprobante
            </h3>

            <div className="space-y-4">
              {/* Cliente Solicitante */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Cliente Solicitante
                </label>
                <ClienteCombobox
                  clientes={clientes}
                  selectedClienteId={clienteId}
                  onSelectCliente={(newId) => setClienteId(newId)}
                />
              </div>

              {/* Tipo de Factura & Validez Oferta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Tipo de Factura
                  </label>
                  <select
                    value={tipoFactura}
                    onChange={(e) => handleTipoFacturaChange(e.target.value as TipoFactura)}
                    className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl px-4 py-2.5 text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] transition-shadow shadow-2xs"
                  >
                    {tiposFactura.map((tf) => (
                      <option key={tf} value={tf}>
                        {tf}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Validez Oferta (Días)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={validezDias}
                      onChange={(e) => setValidezDias(parseInt(e.target.value) || 15)}
                      className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl px-4 py-2.5 text-sm text-on-surface font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] transition-shadow shadow-2xs"
                    />
                    <Calendar className="w-5 h-5 text-on-surface-variant absolute right-3 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Currency Option Toggle */}
            <div className="bg-surface-variant p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <label className="flex items-center gap-3 cursor-pointer text-sm font-medium text-on-surface">
                <input
                  type="checkbox"
                  checked={mostrarDolar}
                  onChange={(e) => setMostrarDolar(e.target.checked)}
                  className="w-5 h-5 text-primary rounded border-outline bg-surface-container-highest focus:ring-primary"
                />
                <span>Mostrar Cotización Equivalente</span>
              </label>

              {mostrarDolar && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nombreDolar}
                    onChange={(e) => setNombreDolar(e.target.value)}
                    className="w-24 bg-surface-container-highest border-none rounded-lg px-3 py-1.5 text-sm text-on-surface focus:ring-2 focus:ring-primary/50"
                  />
                  <span className="text-sm text-on-surface-variant font-medium">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={cotizacionDolar}
                    onChange={(e) => setCotizacionDolar(parseFloat(e.target.value) || 0)}
                    className="w-24 bg-surface-container-highest border-none rounded-lg px-3 py-1.5 text-sm text-on-surface font-mono focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Items / Partidas Section */}
          <div className="bg-surface-container-low rounded-3xl p-5 sm:p-6 space-y-5 border border-outline-variant/10 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-primary uppercase tracking-wide flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <span>Partidas de la Cotización ({items.length})</span>
                </h3>
                {capitulos.length > 0 && (
                  <span className="text-[11px] text-on-surface-variant">
                    {capitulos.length} {capitulos.length === 1 ? 'capítulo organizado' : 'capítulos organizados'}
                  </span>
                )}
              </div>

              {/* M3 Actions Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowItemPickerModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-full text-xs font-bold transition-all"
                  title="Seleccionar tarea tipificada del catálogo (Alt + C)"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Trabajo Tipo</span>
                  <span className="text-[10px] opacity-60 font-mono hidden md:inline">Alt+C</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCustomItem()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-on-primary rounded-full text-xs font-bold transition-all shadow-xs"
                  title="Agregar un renglón o partida directa para esta cotización (Alt + N)"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ítem Libre</span>
                  <span className="text-[10px] opacity-75 font-mono hidden md:inline">Alt+N</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddServicioDirecto()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-full text-xs font-bold transition-all"
                  title="Agregar Alquiler de Equipo / Servicio Tercerizado"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Servicio</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCapitulo()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-container-highest hover:bg-outline-variant/30 text-on-surface rounded-full text-xs font-bold transition-all border border-outline-variant/30"
                  title="Crear un nuevo capítulo o ambiente de obra"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-primary" />
                  <span>Nuevo Capítulo</span>
                </button>
              </div>
            </div>

            {/* Alerta de Margen Bajo */}
            {totales.totalARS > 0 && (
              (() => {
                const netMarginPct = ((totales.totalARS - totales.costoTotalObra) / totales.totalARS) * 100;
                const umbralMinimo = config.umbralMargenMinimoAdvertencia ?? 20;
                if (netMarginPct < umbralMinimo) {
                  return (
                    <div className="p-4 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-700 dark:text-amber-300 flex items-start gap-3 shadow-sm">
                      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <p className="font-bold text-sm">⚠️ Advertencia de Margen Bajo ({netMarginPct.toFixed(1)}%)</p>
                        <p>
                          El margen neto estimado de esta cotización está por debajo del umbral mínimo de seguridad configurado (<strong>{umbralMinimo}%</strong>).
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()
            )}

            {/* Items Rendering (With or Without Chapters) */}
            {items.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-outline-variant/50 rounded-2xl bg-surface-container">
                <Layers className="w-10 h-10 text-outline mx-auto mb-3" />
                <p className="text-base font-medium text-on-surface">Aún no agregaste partidas a esta cotización.</p>
                <p className="text-sm text-on-surface-variant mt-2 max-w-md mx-auto">
                  Presiona <strong>"Ítem Libre"</strong> (Alt+N), <strong>"Trabajo Tipo"</strong> (Alt+C) o <strong>"Servicio"</strong> para comenzar.
                </p>
              </div>
            ) : capitulos.length === 0 ? (
              <div className="space-y-3">
                {items.map((item, idx) => {
                  const isExpanded = !!expandedItems[item.id];
                  const calcItem = totales.itemsCalculados[idx] || item;

                  return (
                    <PresupuestoItemRow
                      key={item.id}
                      item={item}
                      index={idx}
                      calcItem={calcItem}
                      isExpanded={isExpanded}
                      titleInputRef={(el) => {
                        if (el) {
                          itemTitleRefs.current.set(item.id, el);
                        } else {
                          itemTitleRefs.current.delete(item.id);
                        }
                      }}
                      onEnterAtEnd={handleAddDirectItem}
                      onToggleExpand={handleToggleExpandItem}
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
                      onUpdateItemMaterialQuantity={handleUpdateItemMaterialQuantity}
                      onRemoveItemMaterial={handleRemoveItemMaterial}
                      onUpdateItemManoObraCost={handleUpdateItemManoObraCost}
                      condicionesTrabajo={condicionesTrabajo}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="space-y-6">
                {capitulos.map((cap) => {
                  const capItems = items
                    .map((item, idx) => ({ item, originalIdx: idx }))
                    .filter(({ item }) => item.capituloId === cap.id);
                  const capTotal = totales.capitulosTotales?.[cap.id];

                  return (
                    <div
                      key={cap.id}
                      className="bg-surface-container/50 border border-outline-variant/30 rounded-3xl p-4 sm:p-5 space-y-3.5"
                    >
                      {/* Chapter Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/20 pb-3">
                        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                          <Folder className="w-4 h-4 text-primary shrink-0" />
                          <input
                            type="text"
                            value={cap.nombre}
                            onChange={(e) => handleUpdateCapitulo(cap.id, e.target.value)}
                            className="bg-transparent border-none p-0 text-sm font-bold text-on-surface focus:ring-0 w-full"
                            placeholder="Nombre del Capítulo..."
                          />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {capTotal && (
                            <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                              Subtotal: {formatARS(capTotal.precioVentaTotal)}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveCapitulo(cap.id)}
                            className="p-1.5 text-on-surface-variant hover:text-error rounded-full transition-colors"
                            title="Eliminar Capítulo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Chapter Items */}
                      {capItems.length === 0 ? (
                        <p className="text-xs text-on-surface-variant/70 italic py-2">
                          Sin partidas en este capítulo.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {capItems.map(({ item, originalIdx }) => {
                            const isExpanded = !!expandedItems[item.id];
                            const calcItem = totales.itemsCalculados[originalIdx] || item;

                            return (
                              <PresupuestoItemRow
                                key={item.id}
                                item={item}
                                index={originalIdx}
                                calcItem={calcItem}
                                isExpanded={isExpanded}
                                titleInputRef={(el) => {
                                  if (el) itemTitleRefs.current.set(item.id, el);
                                  else itemTitleRefs.current.delete(item.id);
                                }}
                                onEnterAtEnd={() => handleAddCustomItem(cap.id)}
                                onToggleExpand={handleToggleExpandItem}
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
                                onUpdateItemMaterialQuantity={handleUpdateItemMaterialQuantity}
                                onRemoveItemMaterial={handleRemoveItemMaterial}
                                onUpdateItemManoObraCost={handleUpdateItemManoObraCost}
                                condicionesTrabajo={condicionesTrabajo}
                              />
                            );
                          })}
                        </div>
                      )}

                      {/* Add Item to this Chapter button */}
                      <div className="pt-2 border-t border-outline-variant/15 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => handleAddCustomItem(cap.id)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Partida en este Capítulo</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Unassigned Items Block */}
                {(() => {
                  const unassigned = items
                    .map((item, idx) => ({ item, originalIdx: idx }))
                    .filter(({ item }) => !item.capituloId);

                  if (unassigned.length === 0) return null;

                  return (
                    <div className="bg-surface-container/30 border border-dashed border-outline-variant/30 rounded-3xl p-4 sm:p-5 space-y-3">
                      <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                          Partidas Generales (Sin Capítulo Asignado)
                        </span>
                        <span className="text-xs font-mono font-bold text-on-surface-variant">
                          {unassigned.length} {unassigned.length === 1 ? 'partida' : 'partidas'}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {unassigned.map(({ item, originalIdx }) => {
                          const isExpanded = !!expandedItems[item.id];
                          const calcItem = totales.itemsCalculados[originalIdx] || item;

                          return (
                            <PresupuestoItemRow
                              key={item.id}
                              item={item}
                              index={originalIdx}
                              calcItem={calcItem}
                              isExpanded={isExpanded}
                              titleInputRef={(el) => {
                                if (el) itemTitleRefs.current.set(item.id, el);
                                else itemTitleRefs.current.delete(item.id);
                              }}
                              onEnterAtEnd={handleAddDirectItem}
                              onToggleExpand={handleToggleExpandItem}
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
                              onUpdateItemMaterialQuantity={handleUpdateItemMaterialQuantity}
                              onRemoveItemMaterial={handleRemoveItemMaterial}
                              onUpdateItemManoObraCost={handleUpdateItemManoObraCost}
                              condicionesTrabajo={condicionesTrabajo}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Planificador de Cuadrilla & Sinergia de Obra */}
          {items.length > 0 && (
            <PlanificadorCuadrillaCard
              items={items}
              operarios={operariosCuadrilla}
              margenRiesgoPct={margenRiesgoPorcentaje}
              nivelMargenRiesgo={nivelMargenRiesgo}
              aplicarOptimizacion={aplicarOptimizacionCuadrilla}
              onSelectOperarios={setOperariosCuadrilla}
              onSelectMargenRiesgo={(pct, nivel) => {
                setMargenRiesgoPorcentaje(pct);
                if (nivel) setNivelMargenRiesgo(nivel);
              }}
              onToggleAplicarOptimizacion={setAplicarOptimizacionCuadrilla}
              costosIndirectosCatalog={costosIndirectos}
              costosIndirectosConfig={costosIndirectosConfig}
              categoriasManoObra={manoObraList}
              estrategiaSeleccionada={estrategiaCuadrilla}
              nivelConfianza={nivelConfianzaCuadrilla}
              onSelectEstrategia={setEstrategiaCuadrilla}
              onSelectNivelConfianza={setNivelConfianzaCuadrilla}
            />
          )}

          {/* Payment Conditions */}
          <div className="bg-surface-container-low border border-outline-variant/10 rounded-3xl p-6 space-y-3 shadow-sm">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wide">
              Condiciones de Pago & Esquema de Cobro
            </h3>

            <div>
              <textarea
                value={condicionesPagoTexto}
                onChange={(e) => setCondicionesPagoTexto(e.target.value)}
                rows={3}
                className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y shadow-2xs"
                placeholder="Ingresa las condiciones comerciales y plazos de pago acordados con el cliente..."
              />
            </div>
          </div>
        </div>

        {/* Right Column: Calculations Sidebar */}
        <div className="space-y-6">
          <PresupuestoTotalsCard
            totales={totales}
            tipoFactura={tipoFactura}
            gastosConfig={gastosConfig}
            onOpenGastoModal={(g) => {
              setEditingGasto(g || null);
              setShowGastoModal(true);
            }}
            onOpenCatalogPicker={() => setShowGastoCatalogPickerModal(true)}
            onResetGastos={handleResetGastos}
            onOpenParametricGastoModal={(g) => setParametricGastoToAdjust(g)}
            onToggleGasto={handleToggleGasto}
            onRemoveGasto={handleRemoveGasto}
            margenPorcentaje={margenPorcentaje}
            onMargenPorcentajeChange={setMargenPorcentaje}
            onToggleTax={handleToggleTax}
            onUpdateTaxPct={handleUpdateTaxPct}
            onRemoveTax={handleRemoveTax}
            onAddCustomTax={handleAddCustomTax}
            mostrarDolar={mostrarDolar}
            nombreDolar={nombreDolar}
            onEmitirClick={() => setShowEmitirModal(true)}
            onOpenListaMateriales={() => setShowListaMaterialesModal(true)}
          />
        </div>
      </div>

      {/* Item Picker Modal */}
      <ItemPickerModal
        isOpen={showItemPickerModal}
        onClose={() => setShowItemPickerModal(false)}
        tareasTipo={tareasTipo}
        insumosMap={insumosMap}
        manoObraMap={manoObraMap}
        onSelectTarea={handleAddTareaTipoItem}
        onConfigureParametricTarea={handleOpenParametricModalForNewTask}
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
