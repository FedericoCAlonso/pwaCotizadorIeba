import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  FileText,
  Plus,
  ArrowLeft,
  Star,
  AlertCircle,
  Layers,
  Package,
  Calendar,
  Lock
} from 'lucide-react';
import { db } from '../db/database';
import { SaveAsTareaTipoModal } from './SaveAsTareaTipoModal';
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
  ImpuestoItem,
  Oferta,
  OpcionesEmisionPresupuesto
} from '../core/types';
import {
  calcularTotalesPresupuesto,
  calcularCostoTareaTipo,
  formatARS,
  formatUSD,
  generarImpuestosPorDefecto,
  obtenerMultiplicadorCondicion,
  roundMoney,
  safeNum
} from '../core/calculations';
import { useAppOptions } from '../hooks/useAppOptions';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { PresupuestoItemRow } from './presupuesto/PresupuestoItemRow';
import { PresupuestoTotalsCard } from './presupuesto/PresupuestoTotalsCard';
import { ItemPickerModal } from './presupuesto/ItemPickerModal';
import { EmisionPresupuestoModal } from './presupuesto/EmisionPresupuestoModal';

interface PresupuestoEditorProps {
  presupuestoId?: string;
  initialClienteId?: string;
  config: AppConfig;
  onBack: () => void;
  onSaved: (id: string) => void;
}

export const PresupuestoEditor: React.FC<PresupuestoEditorProps> = ({
  presupuestoId,
  initialClienteId,
  config,
  onBack,
  onSaved
}) => {
  const { tiposFactura, condicionesTrabajo } = useAppOptions();
  const { toast } = useToast();
  const _confirm = useConfirm();

  const rawContactos = useLiveQuery(() => db.contactos.toArray()) || [];
  const rawClientes = useLiveQuery(() => db.clientes.toArray()) || [];
  const clientes = useMemo(() => {
    const fromContactos = rawContactos.filter(c => !c.deleted && (c.roles?.includes('cliente') || !c.roles?.length));
    if (fromContactos.length > 0) return fromContactos;
    return rawClientes.filter(c => !c.deleted);
  }, [rawContactos, rawClientes]);

  const tareasTipo = (useLiveQuery(() => db.tareasTipo.toArray()) || []).filter(t => !t.deleted);
  const favoriteTareas = [...tareasTipo].sort((a, b) => (b.frecuenciaUso || 0) - (a.frecuenciaUso || 0)).slice(0, 8);

  const legacyInsumos = (useLiveQuery(() => db.insumos.toArray()) || []).filter(i => !i.deleted);
  const materiales = (useLiveQuery(() => db.materiales.toArray()) || []).filter(m => !m.deleted);
  const productos = (useLiveQuery(() => db.productos.toArray()) || []).filter(p => !p.deleted);
  const ofertas = (useLiveQuery(() => db.ofertas.toArray()) || []).filter(o => !o.deleted);
  const manoObraList = (useLiveQuery(() => db.manoObra.toArray()) || []).filter(m => !m.deleted);
  const costosIndirectos = (useLiveQuery(() => db.costosIndirectos.toArray()) || []).filter(c => !c.deleted);

  const insumosMap = useMemo(() => {
    const sortedOfertas = [...ofertas].sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());

    const map = new Map<string, Insumo>();
    legacyInsumos.forEach(i => map.set(i.id, i));
    materiales.forEach(m => {
      // 1. Si el material tiene una marca preferida con oferta, priorizarla
      const matProds = productos.filter(p => p.materialId === m.id);
      const preferido = matProds.find(p => p.esPreferido);
      let oferta: Oferta | undefined;
      if (preferido) {
        oferta = sortedOfertas.filter(o => o.materialId === m.id && o.productoId === preferido.id).pop();
      }
      // 2. Si no hay preferido o no tiene precio, tomar la oferta más reciente
      if (!oferta) {
        oferta = sortedOfertas.filter(o => o.materialId === m.id).pop();
      }

      map.set(m.id, {
        ...m,
        id: m.id,
        nombre: m.nombre,
        unidad: m.unidadVenta || 'u',
        categoria: m.categoriaId,
        precioActual: oferta ? oferta.precio : (m as any).precioActual || 0,
        fechaActualizacion: oferta ? oferta.fecha : new Date().toISOString(),
        historialPrecios: []
      });
    });
    return map;
  }, [legacyInsumos, materiales, productos, ofertas]);

  const manoObraMap = useMemo(
    () => new Map<string, CategoriaManoDeObra>(manoObraList.map((m) => [m.id, m])),
    [manoObraList]
  );

  const existingPresupuesto = useLiveQuery(
    () => (presupuestoId ? db.presupuestos.get(presupuestoId) : undefined),
    [presupuestoId]
  );

  const [tipoFactura, setTipoFactura] = useState<TipoFactura>(
    config.tipoFacturaPorDefecto || 'Factura B'
  );
  const [impuestosDetalle, setImpuestosDetalle] = useState<ImpuestoItem[]>(
    generarImpuestosPorDefecto(
      config.tipoFacturaPorDefecto || 'Factura B',
      config.porcentajeIVAPorDefecto ?? 21,
      config.porcentajeIIBBPorDefecto ?? 3.5
    )
  );

  const [clienteId, setClienteId] = useState<string>('');
  const [validezDias, setValidezDias] = useState<number>(config.validezDiasPorDefecto || 15);
  const [margenPorcentaje, setMargenPorcentaje] = useState<number>(config.margenPorDefectoPct || 35);
  
  const [mostrarDolar, setMostrarDolar] = useState<boolean>(config.mostrarDolarPorDefecto ?? false);
  const [nombreDolar, setNombreDolar] = useState<string>(config.dolarReferenciaNombre || 'USD');
  const [cotizacionDolar, setCotizacionDolar] = useState<number>(config.dolarReferenciaValor || 1250);

  const [condicionesPagoTexto, setCondicionesPagoTexto] = useState<string>(
    '50% de anticipo al confirmar para acopio de materiales. 30% contra certificado de avance de obra. 20% saldo contra recepción final.'
  );

  const [opcionesEmision, setOpcionesEmision] = useState<OpcionesEmisionPresupuesto>({
    mostrarItemizado: true,
    mostrarDetalleCostos: false,
    condicionesComerciales: ''
  });
  const [showEmitirModal, setShowEmitirModal] = useState(false);

  const [items, setItems] = useState<ItemPresupuesto[]>([]);
  const [costosIndirectosConfig, setCostosIndirectosConfig] = useState<CostoIndirectoItemConfig[]>([]);
  const [_estado, setEstado] = useState<EstadoPresupuesto>('borrador');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const [showItemPickerModal, setShowItemPickerModal] = useState(false);

  const isInitializedRef = useRef<boolean>(false);
  const currentPresupuestoIdRef = useRef<string | undefined>(presupuestoId);

  const [showSaveAsTemplateModal, setShowSaveAsTemplateModal] = useState(false);
  const [saveAsTemplateData, setSaveAsTemplateData] = useState<{
    nombre: string;
    insumos: any[];
    manoObra: any[];
  }>({
    nombre: '',
    insumos: [],
    manoObra: []
  });

  // Reset initialization flag when switching presupuestoId
  if (currentPresupuestoIdRef.current !== presupuestoId) {
    currentPresupuestoIdRef.current = presupuestoId;
    isInitializedRef.current = false;
  }

  // Initial load
  useEffect(() => {
    if (isInitializedRef.current) return;

    if (presupuestoId) {
      if (existingPresupuesto) {
        setTipoFactura(existingPresupuesto.tipoFactura || 'Factura B');
        setImpuestosDetalle(
          existingPresupuesto.impuestosDetalle && existingPresupuesto.impuestosDetalle.length > 0
            ? existingPresupuesto.impuestosDetalle
            : generarImpuestosPorDefecto(
                existingPresupuesto.tipoFactura || 'Factura B',
                config.porcentajeIVAPorDefecto ?? 21,
                config.porcentajeIIBBPorDefecto ?? 3.5
              )
        );
        setClienteId(existingPresupuesto.clienteId);
        setValidezDias(existingPresupuesto.validezDias || 15);
        setMargenPorcentaje(
          existingPresupuesto.beneficioPorcentaje ?? existingPresupuesto.margenPorcentaje ?? (config.margenPorDefectoPct || 35)
        );
        setMostrarDolar(existingPresupuesto.mostrarReferenciaMonedaExtranjera ?? (config.mostrarDolarPorDefecto || false));
        setNombreDolar(existingPresupuesto.nombreMonedaExtranjera || config.dolarReferenciaNombre || 'USD');
        setCotizacionDolar(existingPresupuesto.cotizacionMonedaExtranjera || config.dolarReferenciaValor || 1250);
        setCondicionesPagoTexto(
          existingPresupuesto.condicionesPagoTexto ||
            '50% de anticipo al confirmar para acopio de materiales. 30% contra certificado de avance de obra. 20% saldo contra recepción final.'
        );
        if (existingPresupuesto.opcionesEmision) {
          setOpcionesEmision(existingPresupuesto.opcionesEmision);
        }
        setEstado(existingPresupuesto.estado);

        // Normalize items with safe fallbacks
        const normalizedItems = (existingPresupuesto.items || []).map((item) => {
          const prevQty = item.cantidad || 1;
          const insumosSnap = (item.insumosSnapshot || []).map((i) => ({
            ...i,
            cantidadUnitaria: i.cantidadUnitaria !== undefined ? i.cantidadUnitaria : i.cantidadTotal / prevQty
          }));
          const manoObraSnap = (item.manoObraSnapshot || []).map((m) => ({
            ...m,
            horasUnitarias: m.horasUnitarias !== undefined ? m.horasUnitarias : m.horasTotales / prevQty
          }));
          return {
            ...item,
            insumosSnapshot: insumosSnap,
            manoObraSnapshot: manoObraSnap
          };
        });
        setItems(normalizedItems);

        // Indirect costs
        if (existingPresupuesto.costosIndirectosConfig && existingPresupuesto.costosIndirectosConfig.length > 0) {
          setCostosIndirectosConfig(existingPresupuesto.costosIndirectosConfig);
        } else if (costosIndirectos.length > 0) {
          setCostosIndirectosConfig(
            costosIndirectos.map((ci) => ({
              id: ci.id,
              nombre: ci.nombre,
              tipo: ci.tipo,
              valor: ci.valor,
              aplica: true
            }))
          );
        }

        isInitializedRef.current = true;
      }
    } else {
      // New budget
      if (initialClienteId) setClienteId(initialClienteId);
      if (costosIndirectos.length > 0 && costosIndirectosConfig.length === 0) {
        setCostosIndirectosConfig(
          costosIndirectos.map((ci) => ({
            id: ci.id,
            nombre: ci.nombre,
            tipo: ci.tipo,
            valor: ci.valor,
            aplica: true
          }))
        );
      }
      isInitializedRef.current = true;
    }
  }, [presupuestoId, existingPresupuesto, initialClienteId, config, costosIndirectos, costosIndirectosConfig.length]);

  const handleTipoFacturaChange = (newTipo: TipoFactura) => {
    setTipoFactura(newTipo);
    setImpuestosDetalle(
      generarImpuestosPorDefecto(
        newTipo,
        config.porcentajeIVAPorDefecto ?? 21,
        config.porcentajeIIBBPorDefecto ?? 3.5
      )
    );
  };

  // Calculations
  const totales = useMemo(() => {
    return calcularTotalesPresupuesto({
      items,
      costosIndirectosConfig,
      margenPorcentaje,
      impuestosDetalle,
      tipoFactura,
      cotizacionMonedaExtranjera: mostrarDolar ? cotizacionDolar : undefined
    });
  }, [items, costosIndirectosConfig, margenPorcentaje, impuestosDetalle, tipoFactura, mostrarDolar, cotizacionDolar]);

  // Add items handlers
  const handleAddTareaTipoItem = (tarea: TareaTipo) => {
    const costData = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap, {
      tipoFactura,
      alicuotaIVADefault: config.alicuotaIVAPorDefecto ?? 21
    });
    const unitInsumos = costData.insumosSnapshotUnitario.map(i => ({
      ...i,
      cantidadUnitaria: i.cantidadTotal,
      cantidadTotal: i.cantidadTotal,
      subtotalInsumo: i.subtotalInsumo
    }));
    const unitManoObra = costData.manoObraSnapshotUnitario.map(m => ({
      ...m,
      horasUnitarias: m.horasTotales,
      horasTotales: m.horasTotales,
      subtotalManoObra: m.subtotalManoObra
    }));

    const newItem: ItemPresupuesto = {
      id: `item-${crypto.randomUUID()}`,
      tareaTipoId: tarea.id,
      descripcion: tarea.nombre,
      cantidad: 1,
      unidad: tarea.unidad || 'punto',
      condicionTrabajo: 'normal',
      costoUnitario: costData.costoDirectoUnitario,
      costoDirectoTotal: costData.costoDirectoUnitario,
      costoInsumos: costData.costoInsumosUnitario,
      costoManoObra: costData.costoManoObraUnitario,
      costoServiciosTercerizados: 0,
      costoTotal: costData.costoDirectoUnitario,
      precioVentaUnitario: 0,
      precioVentaTotal: 0,
      insumosSnapshot: unitInsumos,
      manoObraSnapshot: unitManoObra,
      serviciosTercerizados: []
    };

    setItems((prev) => [...prev, newItem]);
    toast.success(`Tarea "${tarea.nombre}" agregada`);
  };

  const handleAddCustomItem = () => {
    const newItem: ItemPresupuesto = {
      id: `item-${crypto.randomUUID()}`,
      descripcion: 'Nueva Partida / Trabajo Libre',
      cantidad: 1,
      unidad: 'gl',
      condicionTrabajo: 'normal',
      costoUnitario: 0,
      costoDirectoTotal: 0,
      costoInsumos: 0,
      costoManoObra: 0,
      costoServiciosTercerizados: 0,
      costoTotal: 0,
      precioVentaUnitario: 0,
      precioVentaTotal: 0,
      insumosSnapshot: [],
      manoObraSnapshot: [],
      serviciosTercerizados: []
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleAddAdHocItem = () => {
    const newItem: ItemPresupuesto = {
      id: `item-adhoc-${crypto.randomUUID()}`,
      descripcion: 'Material / Partida Ad-Hoc no catalogada',
      cantidad: 1,
      unidad: 'u',
      condicionTrabajo: 'normal',
      esAdHoc: true,
      costoUnitario: 0,
      costoDirectoTotal: 0,
      costoInsumos: 0,
      costoManoObra: 0,
      costoServiciosTercerizados: 0,
      costoTotal: 0,
      precioVentaUnitario: 0,
      precioVentaTotal: 0,
      insumosSnapshot: [],
      manoObraSnapshot: [],
      serviciosTercerizados: []
    };
    setItems((prev) => [...prev, newItem]);
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

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    toast.info('Partida eliminada');
  };

  // Indirect Costs handlers
  const handleToggleIndirectCost = (index: number) => {
    setCostosIndirectosConfig((prev) => {
      const next = [...prev];
      next[index].aplica = !next[index].aplica;
      return next;
    });
  };

  const handleUpdateIndirectCostValor = (index: number, val: number) => {
    setCostosIndirectosConfig((prev) => {
      const next = [...prev];
      next[index].valor = Math.max(0, safeNum(val));
      return next;
    });
  };

  const handleUpdateIndirectCostName = (index: number, name: string) => {
    setCostosIndirectosConfig((prev) => {
      const next = [...prev];
      next[index].nombre = name;
      return next;
    });
  };

  const handleRemoveIndirectCost = (index: number) => {
    setCostosIndirectosConfig((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddCustomIndirectCost = () => {
    setCostosIndirectosConfig((prev) => [
      ...prev,
      {
        id: `ci-custom-${Date.now()}`,
        nombre: 'Nuevo Gasto General',
        tipo: 'porcentual_sobre_costo',
        valor: 5,
        aplica: true
      }
    ]);
  };

  const handleResetIndirectCosts = () => {
    setCostosIndirectosConfig(
      costosIndirectos.map((ci) => ({
        id: ci.id,
        nombre: ci.nombre,
        tipo: ci.tipo,
        valor: ci.valor,
        aplica: true
      }))
    );
    toast.success('Gastos Generales restablecidos del catálogo');
  };

  // Tax handlers
  const handleToggleTax = (index: number) => {
    setImpuestosDetalle((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], aplica: !next[index].aplica };
      return next;
    });
  };

  const handleUpdateTaxPct = (index: number, pct: number) => {
    setImpuestosDetalle((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], porcentaje: Math.max(0, safeNum(pct)) };
      return next;
    });
  };

  const handleRemoveTax = (index: number) => {
    setImpuestosDetalle((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddCustomTax = () => {
    setImpuestosDetalle((prev) => [
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

  // Save budget
  const handleSavePresupuesto = async (
    targetEstado: EstadoPresupuesto = 'borrador',
    customEmission?: OpcionesEmisionPresupuesto
  ) => {
    if (!clienteId) {
      toast.warning('Por favor selecciona un cliente para el presupuesto.');
      return;
    }

    const now = new Date().toISOString();
    let numeroStr = existingPresupuesto?.numero;

    if (!numeroStr) {
      const seq = config.siguienteNumeroCorrelativo || 1001;
      const year = new Date().getFullYear();
      numeroStr = `${config.prefijoPresupuesto || 'IEBA'}-${year}-${seq.toString().padStart(4, '0')}`;

      await db.config.update(config.id, {
        siguienteNumeroCorrelativo: seq + 1
      });
    }

    const finalEmission = customEmission || opcionesEmision;

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
            onClick={onBack}
            className="p-2.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors"
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
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Autoguardado local activo
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          <button
            type="button"
            onClick={() => handleSavePresupuesto('borrador')}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-surface-variant hover:bg-surface-container-highest text-on-surface font-semibold rounded-full text-xs transition-colors"
          >
            Guardar Borrador
          </button>
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">Cliente Solicitante</label>
                <select
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                >
                  <option value="">Selecciona un cliente...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.cuitDni ? `(${c.cuitDni})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">Tipo de Factura</label>
                <select
                  value={tipoFactura}
                  onChange={(e) => handleTipoFacturaChange(e.target.value as TipoFactura)}
                  className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-2.5 text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                >
                  {tiposFactura.map((tf) => (
                    <option key={tf} value={tf}>
                      {tf}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">Validez Oferta (Días)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={validezDias}
                    onChange={(e) => setValidezDias(parseInt(e.target.value) || 15)}
                    className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-2.5 text-sm text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                  />
                  <Calendar className="w-5 h-5 text-on-surface-variant absolute right-3 top-2.5" />
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
          <div className="bg-surface-container-low rounded-3xl p-6 space-y-5 border border-outline-variant/10 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wide">
                Partidas & Tareas a Ejecutar ({items.length})
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowItemPickerModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container rounded-full text-xs font-semibold transition-colors"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Cargar Tarea</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddAdHocItem}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-500/15 text-purple-700 dark:text-purple-300 hover:bg-purple-500/25 border border-purple-500/30 rounded-full text-xs font-semibold transition-colors"
                  title="Material / Partida especial única no catalogada"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Ítem Ad-Hoc</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomItem}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-variant hover:bg-surface-container-highest text-on-surface rounded-full text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ítem Libre</span>
                </button>
              </div>
            </div>

            {/* Favorites Bar */}
            {favoriteTareas.length > 0 && (
              <div className="bg-surface-container/60 p-3 rounded-2xl border border-outline-variant/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Accesos Directos (Tócalo en Obra)
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {favoriteTareas.map((tarea) => (
                    <button
                      key={tarea.id}
                      type="button"
                      onClick={() => handleAddTareaTipoItem(tarea)}
                      className="px-3 py-1.5 bg-surface-container-highest hover:bg-primary/10 text-on-surface hover:text-primary border border-outline-variant/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 touch-manipulation shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-primary" />
                      <span>{tarea.nombre}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

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

            {/* Items Table */}
            {items.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-outline-variant/50 rounded-2xl bg-surface-container">
                <Layers className="w-10 h-10 text-outline mx-auto mb-3" />
                <p className="text-base font-medium text-on-surface">Aún no agregaste partidas a esta cotización.</p>
                <p className="text-sm text-on-surface-variant mt-2 max-w-md mx-auto">
                  Haz clic en "Cargar Tarea" para seleccionar del catálogo e incorporar insumos y mano de obra automáticamente.
                </p>
              </div>
            ) : (
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
                      onToggleExpand={handleToggleExpandItem}
                      onUpdateItemCondicion={handleUpdateItemCondicion}
                      onUpdateItemQuantity={handleUpdateItemQuantity}
                      onUpdateItemUnit={handleUpdateItemUnit}
                      onUpdateItemUnitDirectCost={handleUpdateItemUnitDirectCost}
                      onUpdateItemDescription={handleUpdateItemDescription}
                      onRemoveItem={handleRemoveItem}
                      onSaveAsTemplate={(targetItem) => {
                        const itemInsumos = (targetItem.insumosSnapshot || []).map((ins) => ({
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
                          insumos: itemInsumos,
                          manoObra: itemManoObra
                        });
                        setShowSaveAsTemplateModal(true);
                      }}
                      condicionesTrabajo={condicionesTrabajo}
                    />
                  );
                })}
              </div>
            )}
          </div>

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
                className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl p-4 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
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
            costosIndirectosConfig={costosIndirectosConfig}
            onToggleIndirectCost={handleToggleIndirectCost}
            onUpdateIndirectCostName={handleUpdateIndirectCostName}
            onUpdateIndirectCostValor={handleUpdateIndirectCostValor}
            onRemoveIndirectCost={handleRemoveIndirectCost}
            onAddCustomIndirectCost={handleAddCustomIndirectCost}
            onResetIndirectCosts={handleResetIndirectCosts}
            margenPorcentaje={margenPorcentaje}
            onMargenPorcentajeChange={setMargenPorcentaje}
            onToggleTax={handleToggleTax}
            onUpdateTaxPct={handleUpdateTaxPct}
            onRemoveTax={handleRemoveTax}
            onAddCustomTax={handleAddCustomTax}
            mostrarDolar={mostrarDolar}
            nombreDolar={nombreDolar}
            onEmitirClick={() => setShowEmitirModal(true)}
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
      />

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
        insumos={saveAsTemplateData.insumos}
        manoObra={saveAsTemplateData.manoObra}
      />
    </div>
  );
};
