import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import {
  Presupuesto,
  ItemPresupuesto,
  AppConfig,
  TareaTipo,
  Insumo,
  CategoriaManoDeObra,
  CostoIndirectoItemConfig,
  EstadoPresupuesto,
  TipoFactura,
  OpcionesEmisionPresupuesto,
  ImpuestoItem,
  ParametrosTrabajoTipo,
  ParametrosEstimacionMaterial,
  MaterialFilterContext
} from '../core/types';
import {
  calcularTotalesPresupuesto,
  calcularCostoTareaTipo,
  calcularCostoParametricoTareaTipo,
  calcularConsumosTareaTipo,
  ConsumosCalculadosResultado,
  generarImpuestosPorDefecto,
  obtenerMultiplicadorCondicion,
  roundMoney,
  safeNum
} from '../core/calculations';
import { useInsumosMap } from '../hooks/useInsumosMap';
import { useToast } from '../contexts/ToastContext';

export interface UsePresupuestoEditorViewModelProps {
  presupuestoId?: string;
  initialClienteId?: string;
  config: AppConfig;
  onSaved: (id: string) => void;
  onViewMaterialsInCatalog?: (ctx: MaterialFilterContext) => void;
}

export function usePresupuestoEditorViewModel({
  presupuestoId,
  initialClienteId,
  config,
  onSaved,
  onViewMaterialsInCatalog
}: UsePresupuestoEditorViewModelProps) {
  const { toast } = useToast();

  // ─── Data Access ──────────────────────────────────────────────────────────────
  const rawContactos = useLiveQuery(() => db.contactos.toArray()) || [];
  const rawClientes = useLiveQuery(() => db.clientes.toArray()) || [];
  const clientes = useMemo(() => {
    const fromContactos = rawContactos.filter(c => !c.deleted && (c.roles?.includes('cliente') || !c.roles?.length));
    if (fromContactos.length > 0) return fromContactos;
    return rawClientes.filter(c => !c.deleted);
  }, [rawContactos, rawClientes]);

  const tareasTipo = (useLiveQuery(() => db.tareasTipo.toArray()) || []).filter(t => !t.deleted);
  const favoriteTareas = [...tareasTipo].sort((a, b) => (b.frecuenciaUso || 0) - (a.frecuenciaUso || 0)).slice(0, 8);

  const manoObraList = (useLiveQuery(() => db.manoObra.toArray()) || []).filter(m => !m.deleted);
  const costosIndirectos = (useLiveQuery(() => db.costosIndirectos.toArray()) || []).filter(c => !c.deleted);
  const existingPresupuestos = useLiveQuery<Presupuesto[]>(() => presupuestoId ? db.presupuestos.where('id').equals(presupuestoId).toArray() : Promise.resolve([]), [presupuestoId]);
  const existingPresupuesto: Presupuesto | null = existingPresupuestos && existingPresupuestos.length > 0 ? existingPresupuestos[0] : null;

  // Unified Insumos Map (MVVM Model Layer)
  const insumosMap = useInsumosMap();
  const manoObraMap = useMemo(() => new Map(manoObraList.map(m => [m.id, m])), [manoObraList]);

  // ─── Form State ───────────────────────────────────────────────────────────────
  const [clienteId, setClienteId] = useState<string>(initialClienteId || '');
  const [numero, setNumero] = useState<string>('');
  const [validezDias, setValidezDias] = useState<number>(config.validezDiasPorDefecto || 15);
  const [margenPorcentaje, setMargenPorcentaje] = useState<number>(config.margenPorDefectoPct || 30);
  const [tipoFactura, setTipoFactura] = useState<TipoFactura>(config.tipoFacturaPorDefecto || 'Factura C');
  const [items, setItems] = useState<ItemPresupuesto[]>([]);
  const [costosIndirectosConfig, setCostosIndirectosConfig] = useState<CostoIndirectoItemConfig[]>([]);

  const [mostrarDolar, setMostrarDolar] = useState<boolean>(config.mostrarDolarPorDefecto ?? false);
  const [nombreDolar, setNombreDolar] = useState<string>(config.dolarReferenciaNombre || 'Dólar Blue');
  const [cotizacionDolar, setCotizacionDolar] = useState<number>(config.dolarReferenciaValor || 1200);

  const [condicionesPagoTexto, setCondicionesPagoTexto] = useState<string>('');
  const [impuestosDetalle, setImpuestosDetalle] = useState<ImpuestoItem[]>(() =>
    generarImpuestosPorDefecto(config.tipoFacturaPorDefecto || 'Factura C', config.alicuotaIVAPorDefecto ?? config.porcentajeIVAPorDefecto ?? 21)
  );

  const [opcionesEmision, setOpcionesEmision] = useState<OpcionesEmisionPresupuesto>({
    mostrarItemizado: true,
    mostrarDetalleCostos: false,
    condicionesComerciales: ''
  });

  const [showItemPickerModal, setShowItemPickerModal] = useState<boolean>(false);
  const [showEmitirModal, setShowEmitirModal] = useState<boolean>(false);
  const [itemParaGuardarComoTarea, setItemParaGuardarComoTarea] = useState<ItemPresupuesto | null>(null);

  // Estados de Modal Paramétrico de Trabajo Tipo
  const [showParametricModal, setShowParametricModal] = useState(false);
  const [selectedTareaForParametricModal, setSelectedTareaForParametricModal] = useState<TareaTipo | null>(null);
  const [editingItemIndexForParametricModal, setEditingItemIndexForParametricModal] = useState<number | null>(null);

  // Modal de Cómputo Paramétrico de Materiales (Superficie, Trazado, Error)
  const [showParametricMaterialModal, setShowParametricMaterialModal] = useState(false);
  const [editingItemIndexForMaterialModal, setEditingItemIndexForMaterialModal] = useState<number | null>(null);

  // Inicialización desde Presupuesto Existente o Nuevo
  useEffect(() => {
    if (existingPresupuesto) {
      setClienteId(existingPresupuesto.clienteId);
      setNumero(existingPresupuesto.numero);
      setValidezDias(existingPresupuesto.validezDias);
      setMargenPorcentaje(existingPresupuesto.beneficioPorcentaje ?? existingPresupuesto.margenPorcentaje ?? 30);
      setTipoFactura(existingPresupuesto.tipoFactura);
      setItems(existingPresupuesto.items || []);
      setCostosIndirectosConfig(existingPresupuesto.costosIndirectosConfig || []);
      if (existingPresupuesto.impuestosDetalle && existingPresupuesto.impuestosDetalle.length > 0) {
        setImpuestosDetalle(existingPresupuesto.impuestosDetalle);
      }
      setMostrarDolar(existingPresupuesto.mostrarReferenciaMonedaExtranjera ?? false);
      setNombreDolar(existingPresupuesto.nombreMonedaExtranjera || 'Dólar Blue');
      setCotizacionDolar(existingPresupuesto.cotizacionMonedaExtranjera || 1200);
      setCondicionesPagoTexto(existingPresupuesto.condicionesPagoTexto || '');
      if (existingPresupuesto.opcionesEmision) {
        setOpcionesEmision(existingPresupuesto.opcionesEmision);
      }
    } else {
      const year = new Date().getFullYear();
      const seq = config.siguienteNumeroCorrelativo || 1001;
      setNumero(`${config.prefijoPresupuesto || 'IEBA'}-${year}-${seq.toString().padStart(4, '0')}`);
      setCostosIndirectosConfig(
        costosIndirectos.map(ci => ({
          id: ci.id,
          nombre: ci.nombre,
          tipo: ci.tipo,
          valor: ci.valor,
          aplica: true
        }))
      );
    }
  }, [existingPresupuesto, config]);

  // ─── Real-Time Layered Calculations (Model Layer) ─────────────────────────────
  const totales = useMemo(() => {
    return calcularTotalesPresupuesto({
      items,
      costosIndirectosConfig,
      costosIndirectosCatalog: costosIndirectos,
      beneficioPorcentaje: margenPorcentaje,
      tipoFactura,
      impuestosDetalle,
      cotizacionMonedaExtranjera: cotizacionDolar
    });
  }, [items, costosIndirectosConfig, costosIndirectos, margenPorcentaje, tipoFactura, impuestosDetalle, cotizacionDolar, config]);

  const handleToggleTax = (index: number) => {
    setImpuestosDetalle(prev => {
      const next = [...prev];
      next[index] = { ...next[index], aplica: !next[index].aplica };
      return next;
    });
  };

  const handleUpdateTaxPct = (index: number, pct: number) => {
    setImpuestosDetalle(prev => {
      const next = [...prev];
      next[index] = { ...next[index], porcentaje: Math.max(0, safeNum(pct)) };
      return next;
    });
  };

  const handleRemoveTax = (index: number) => {
    setImpuestosDetalle(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleAddCustomTax = () => {
    setImpuestosDetalle(prev => [
      ...prev,
      {
        id: `tax-custom-${Date.now()}`,
        nombre: 'Nuevo Impuesto',
        porcentaje: 3.0,
        aplica: true,
        discriminar: false,
        montoCalculado: 0
      }
    ]);
  };

  // ─── Actions / Commands ───────────────────────────────────────────────────────
  const handleAddTareaTipoItem = (tarea: TareaTipo, cantidad = 1) => {
    const costData = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap, {
      tipoFactura,
      alicuotaIVADefault: config.alicuotaIVAPorDefecto ?? config.porcentajeIVAPorDefecto ?? 21
    });

    const costoUnitarioDirecto = costData.costoDirectoUnitario;
    const costoInsumos = costData.costoInsumosUnitario;
    const costoMO = costData.costoManoObraUnitario;

    const newItem: ItemPresupuesto = {
      id: `item-${crypto.randomUUID()}`,
      tareaTipoId: tarea.id,
      descripcion: tarea.nombre,
      cantidad,
      unidad: 'u',
      costoUnitario: costoUnitarioDirecto,
      costoInsumos: roundMoney(costoInsumos * cantidad),
      costoManoObra: roundMoney(costoMO * cantidad),
      costoDirectoTotal: roundMoney(costoUnitarioDirecto * cantidad),
      costoTotal: roundMoney(costoUnitarioDirecto * cantidad),
      precioVentaUnitario: 0,
      precioVentaTotal: 0,
      insumosSnapshot: costData.insumosSnapshotUnitario.map(i => ({
        ...i,
        cantidadTotal: roundMoney(i.cantidadTotal * cantidad),
        subtotalInsumo: roundMoney(i.subtotalInsumo * cantidad),
        subtotalInsumoFinal: roundMoney((i.subtotalInsumoFinal ?? i.subtotalInsumo) * cantidad)
      })),
      manoObraSnapshot: costData.manoObraSnapshotUnitario.map(m => ({
        ...m,
        horasTotales: roundMoney(m.horasTotales * cantidad),
        subtotalManoObra: roundMoney(m.subtotalManoObra * cantidad)
      }))
    };

    setItems(prev => [...prev, newItem]);
    toast.success(`Tarea "${tarea.nombre}" agregada`);
  };

  const handleOpenParametricModalForNewTask = (tarea: TareaTipo) => {
    setSelectedTareaForParametricModal(tarea);
    setEditingItemIndexForParametricModal(null);
    setShowParametricModal(true);
  };

  const handleOpenParametricModalForExistingItem = (index: number) => {
    const item = items[index];
    if (!item) return;

    let tarea = item.tareaTipoId ? tareasTipo.find(t => t.id === item.tareaTipoId) : undefined;
    if (!tarea) {
      tarea = {
        id: item.tareaTipoId || `tt-custom-${index}`,
        nombre: item.descripcion,
        categoria: 'Trabajo Especial',
        unidad: item.unidad || 'u',
        insumos: (item.insumosSnapshot || []).map(i => ({
          materialId: i.materialId || i.insumoId,
          cantidad: i.cantidadUnitaria ?? (item.cantidad > 0 ? i.cantidadTotal / item.cantidad : i.cantidadTotal)
        })),
        manoObra: (item.manoObraSnapshot || []).filter(m => m.categoriaId !== 'mo-adicional-desarmado').map(m => ({
          categoriaId: m.categoriaId,
          horas: m.horasUnitarias ?? (item.cantidad > 0 ? m.horasTotales / item.cantidad : m.horasTotales)
        }))
      };
    }

    setSelectedTareaForParametricModal(tarea);
    setEditingItemIndexForParametricModal(index);
    setShowParametricModal(true);
  };

  const handleConfirmParametricJob = (
    tarea: TareaTipo,
    resultado: {
      variables: Record<string, number>;
      calculos: ConsumosCalculadosResultado;
      clausulaExclusiones?: string;
      incluirClausula: boolean;
    }
  ) => {
    const { variables, calculos, clausulaExclusiones } = resultado;
    const unit = tarea.unidad || 'u';
    const cant = calculos.cantidadPrincipal || 1;
    const costoDirecto = calculos.costoDirectoTotal;
    const costoUnit = roundMoney(costoDirecto / (cant > 0 ? cant : 1));

    if (editingItemIndexForParametricModal !== null) {
      // Modificando ítem existente
      const index = editingItemIndexForParametricModal;
      setItems(prev => {
        const next = [...prev];
        const item = next[index];
        if (!item) return prev;

        next[index] = {
          ...item,
          cantidad: cant,
          unidad: unit,
          costoUnitario: costoUnit,
          costoInsumos: calculos.costoInsumosTotal,
          costoManoObra: calculos.costoManoObraTotal,
          costoFijoOperativo: calculos.costoFijoOperativo,
          descripcionCostoFijo: tarea.descripcionCostoFijo,
          costoDirectoTotal: costoDirecto,
          costoTotal: costoDirecto,
          valoresVariables: variables,
          clausulaExclusiones,
          insumosSnapshot: calculos.insumosSnapshot,
          manoObraSnapshot: calculos.manoObraSnapshot
        };
        return next;
      });
      toast.success(`Parámetros de "${tarea.nombre}" actualizados`);
    } else {
      // Agregando nuevo ítem
      const newItem: ItemPresupuesto = {
        id: `item-${crypto.randomUUID()}`,
        tareaTipoId: tarea.id,
        descripcion: tarea.nombre,
        cantidad: cant,
        unidad: unit,
        costoUnitario: costoUnit,
        costoInsumos: calculos.costoInsumosTotal,
        costoManoObra: calculos.costoManoObraTotal,
        costoFijoOperativo: calculos.costoFijoOperativo,
        descripcionCostoFijo: tarea.descripcionCostoFijo,
        costoDirectoTotal: costoDirecto,
        costoTotal: costoDirecto,
        precioVentaUnitario: 0,
        precioVentaTotal: 0,
        valoresVariables: variables,
        clausulaExclusiones,
        insumosSnapshot: calculos.insumosSnapshot,
        manoObraSnapshot: calculos.manoObraSnapshot
      };
      setItems(prev => [...prev, newItem]);
      toast.success(`Trabajo tipo "${tarea.nombre}" configurado y añadido`);
    }

    setEditingItemIndexForParametricModal(null);
    setSelectedTareaForParametricModal(null);
    setShowParametricModal(false);
  };

  const handleOpenMaterialModalForExistingItem = (index: number) => {
    const item = items[index];
    if (!item) return;
    setEditingItemIndexForMaterialModal(index);
    setShowParametricMaterialModal(true);
  };

  const handleApplyMaterialEstimation = (resultado: {
    cantidad: number;
    formula: string;
    parametrosEstimacion: ParametrosEstimacionMaterial;
  }) => {
    if (editingItemIndexForMaterialModal === null) return;
    const index = editingItemIndexForMaterialModal;

    setItems(prev => {
      const next = [...prev];
      const item = next[index];
      if (!item) return prev;

      const unitCost = item.costoUnitario !== undefined
        ? item.costoUnitario
        : roundMoney((item.costoDirectoTotal || 0) / (item.cantidad || 1));
      
      const newDirectCost = roundMoney(unitCost * resultado.cantidad);

      next[index] = {
        ...item,
        cantidad: resultado.cantidad,
        formulaCantidad: resultado.formula,
        parametrosEstimacionMaterial: resultado.parametrosEstimacion,
        costoInsumos: item.insumosSnapshot?.length ? newDirectCost : item.costoInsumos,
        costoDirectoTotal: newDirectCost,
        costoTotal: newDirectCost
      };

      // Si tiene insumosSnapshot (es un material directo), actualizar también el snapshot
      if (next[index].insumosSnapshot && next[index].insumosSnapshot.length === 1) {
        next[index].insumosSnapshot = [{
          ...next[index].insumosSnapshot[0],
          cantidadTotal: resultado.cantidad,
          subtotalInsumo: newDirectCost,
          parametrosEstimacion: resultado.parametrosEstimacion
        }];
      }

      return next;
    });

    toast.success(`Cómputo métrico aplicado: ${resultado.cantidad} ${items[index]?.unidad || 'u'}`);
    setShowParametricMaterialModal(false);
    setEditingItemIndexForMaterialModal(null);
  };

  const handleAddInsumoItem = (insumo: Insumo, cantidad = 1) => {
    const ali = insumo.alicuotaIVA ?? config.alicuotaIVAPorDefecto ?? 21;
    const precioNeto = roundMoney(safeNum(insumo.precioActual));
    const precioFinal = roundMoney(precioNeto * (1 + ali / 100));
    const isFacturaC_or_X = tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
    const precioUnitarioComputable = isFacturaC_or_X ? precioFinal : precioNeto;

    const newItem: ItemPresupuesto = {
      id: `item-${crypto.randomUUID()}`,
      descripcion: insumo.nombre,
      cantidad,
      unidad: insumo.unidad || 'u',
      costoUnitario: precioUnitarioComputable,
      costoInsumos: roundMoney(precioUnitarioComputable * cantidad),
      costoManoObra: 0,
      costoDirectoTotal: roundMoney(precioUnitarioComputable * cantidad),
      costoTotal: roundMoney(precioUnitarioComputable * cantidad),
      precioVentaUnitario: 0,
      precioVentaTotal: 0,
      insumosSnapshot: [
        {
          insumoId: insumo.id,
          materialId: insumo.id,
          nombre: insumo.nombre,
          unidad: insumo.unidad || 'u',
          cantidadTotal: cantidad,
          precioUnitarioCongelado: precioNeto,
          alicuotaIVA: ali,
          precioFinalUnitarioCongelado: precioFinal,
          subtotalInsumo: roundMoney(precioNeto * cantidad),
          subtotalInsumoFinal: roundMoney(precioFinal * cantidad)
        }
      ],
      manoObraSnapshot: []
    };

    setItems(prev => [...prev, newItem]);
    toast.success(`Material "${insumo.nombre}" agregado`);
  };

  const handleAddCustomItem = () => {
    const newItem: ItemPresupuesto = {
      id: `item-${crypto.randomUUID()}`,
      descripcion: 'Nueva Partida Libre',
      cantidad: 1,
      unidad: 'gl',
      precioManual: 0,
      costoUnitario: 0,
      costoInsumos: 0,
      costoManoObra: 0,
      costoDirectoTotal: 0,
      costoTotal: 0,
      precioVentaUnitario: 0,
      precioVentaTotal: 0,
      insumosSnapshot: [],
      manoObraSnapshot: []
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleAddAdHocItem = () => {
    const newItem: ItemPresupuesto = {
      id: `item-${crypto.randomUUID()}`,
      descripcion: 'Material / Insumo Especial No Catalogado',
      cantidad: 1,
      unidad: 'u',
      costoUnitario: 0,
      costoInsumos: 0,
      costoManoObra: 0,
      costoDirectoTotal: 0,
      costoTotal: 0,
      precioVentaUnitario: 0,
      precioVentaTotal: 0,
      insumosSnapshot: [
        {
          insumoId: `ins-adhoc-${crypto.randomUUID()}`,
          materialId: `ins-adhoc-${crypto.randomUUID()}`,
          nombre: 'Material Ad-Hoc',
          unidad: 'u',
          cantidadTotal: 1,
          precioUnitarioCongelado: 0,
          subtotalInsumo: 0
        }
      ],
      manoObraSnapshot: []
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleUpdateItem = (index: number, updatedItem: ItemPresupuesto) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = updatedItem;
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
    toast.info('Partida eliminada');
  };

  const handleOpenMaterialsInCatalog = () => {
    if (!onViewMaterialsInCatalog) return;
    const matQtyMap: Record<string, { cantidad: number; unidad: string }> = {};
    const idsSet = new Set<string>();
    const namesSet = new Set<string>();

    items.forEach((it) => {
      (it.insumosSnapshot || []).forEach((ins: any) => {
        const id = ins.materialId || ins.insumoId || ins.id;
        if (id) {
          idsSet.add(id);
          const current = matQtyMap[id]?.cantidad || 0;
          matQtyMap[id] = {
            cantidad: roundMoney(current + (ins.cantidadTotal || 0)),
            unidad: ins.unidadVenta || ins.unidad || 'u'
          };
        }
        if (ins.nombre && ins.nombre.trim() && ins.nombre !== 'Insumo no encontrado') {
          namesSet.add(ins.nombre.trim());
        }
      });
    });

    if (idsSet.size === 0 && namesSet.size === 0) {
      toast.info('Esta cotización está compuesta por partidas libres sin despiece de insumos catalogados.');
      return;
    }

    onViewMaterialsInCatalog({
      title: `Cotización ${existingPresupuesto?.numero || 'en borrador'}`,
      materialIds: Array.from(idsSet),
      materialNames: Array.from(namesSet),
      quantities: matQtyMap,
      returnTab: 'presupuestos',
      returnViewMode: 'editor',
      returnPresupuestoId: presupuestoId
    });
  };

  const handleSavePresupuesto = async (
    targetEstado: EstadoPresupuesto = 'borrador',
    emissionOptionsOverride?: OpcionesEmisionPresupuesto
  ) => {
    if (!clienteId) {
      toast.warning('Por favor, selecciona un cliente solicitante.');
      return;
    }
    if (items.length === 0) {
      toast.warning('Agrega al menos una partida o tarea a la cotización.');
      return;
    }

    const now = new Date().toISOString();
    let numeroStr = numero;

    if (!existingPresupuesto) {
      const year = new Date().getFullYear();
      const seq = config.siguienteNumeroCorrelativo || 1001;
      numeroStr = `${config.prefijoPresupuesto || 'IEBA'}-${year}-${seq.toString().padStart(4, '0')}`;
      await db.config.update(config.id, { siguienteNumeroCorrelativo: seq + 1 });
    }

    const finalEmission = emissionOptionsOverride || opcionesEmision;

    const finalPresupuesto: Presupuesto = {
      id: existingPresupuesto?.id || `pres-${crypto.randomUUID()}`,
      numero: numeroStr,
      clienteId,
      fechaEmision: existingPresupuesto?.fechaEmision || now,
      validezDias,
      tipoFactura,
      items: totales.itemsCalculados,
      costosIndirectosConfig,
      costosIndirectosAplicados: totales.costosIndirectosAplicados,

      // Calculation Engine
      costoGlobal: totales.costoGlobal,
      gastosGeneralesTotal: totales.gastosGeneralesTotal,
      beneficioPorcentaje: margenPorcentaje,
      beneficioMonto: totales.beneficioMonto,
      subtotalSinImpuestos: totales.subtotalSinImpuestos,
      montoImpuestosTotal: totales.montoImpuestosTotal,
      precioFinalGlobal: totales.precioFinalGlobal,
      coeficienteK: totales.coeficienteK,
      opcionesEmision: finalEmission,

      // Compatibility fields
      subtotalInsumos: totales.subtotalInsumos,
      subtotalManoObra: totales.subtotalManoObra,
      subtotalServiciosTercerizados: totales.subtotalServiciosTercerizados,
      subtotalCostosDirectos: totales.costoGlobal,
      subtotalCostosIndirectos: totales.gastosGeneralesTotal,
      costoTotalObra: totales.costoTotalObra,
      margenPorcentaje,
      montoGanancia: totales.beneficioMonto,
      impuestosDetalle: totales.impuestosCalculados,
      impuestosPorcentaje: totales.impuestosPorcentajeTotal,
      montoImpuestos: totales.montoImpuestosTotal,
      totalARS: totales.precioFinalGlobal,
      mostrarReferenciaMonedaExtranjera: mostrarDolar,
      nombreMonedaExtranjera: nombreDolar,
      cotizacionMonedaExtranjera: cotizacionDolar,
      totalMonedaExtranjera: totales.totalMonedaExtranjera,
      condicionesPagoTexto: finalEmission.condicionesComerciales || condicionesPagoTexto,
      estado: targetEstado,
      fechaModificacion: now,
      createdAt: existingPresupuesto?.createdAt || now,
      updatedAt: now,
      deleted: false
    };

    await db.presupuestos.put(finalPresupuesto);
    setShowEmitirModal(false);
    toast.success(targetEstado === 'enviado' ? '¡Presupuesto emitido con éxito!' : 'Presupuesto guardado en borrador');
    onSaved(finalPresupuesto.id);
  };

  return {
    // Data
    clientes,
    tareasTipo,
    favoriteTareas,
    costosIndirectos,
    existingPresupuesto,
    insumosMap,
    manoObraMap,
    totales,

    // Form States
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
    impuestosDetalle,
    setImpuestosDetalle,
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

    // Modal States
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

    // Actions & Commands
    handleAddTareaTipoItem,
    handleOpenParametricModalForNewTask,
    handleOpenParametricModalForExistingItem,
    handleConfirmParametricJob,
    handleOpenMaterialModalForExistingItem,
    handleApplyMaterialEstimation,
    handleAddInsumoItem,
    handleAddCustomItem,
    handleAddAdHocItem,
    handleUpdateItem,
    handleRemoveItem,
    handleToggleTax,
    handleUpdateTaxPct,
    handleRemoveTax,
    handleAddCustomTax,
    handleOpenMaterialsInCatalog,
    handleSavePresupuesto
  };
}
