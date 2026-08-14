import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  FileText,
  Plus,
  Trash2,
  CheckCircle,
  Calculator,
  Calendar,
  Layers,
  Package,
  Lock,
  ArrowLeft,
  X,
  RotateCcw,
  Star,
  AlertCircle,
  Sparkles
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
  calcularCostoTareaTipo,
  calcularTotalesPresupuesto,
  formatARS,
  formatUSD,
  congelarItemPresupuesto,
  generarImpuestosPorDefecto,
  obtenerMultiplicadorCondicion,
  roundMoney
} from '../core/calculations';
import {
  TIPOS_FACTURA,
  CONDICIONES_TRABAJO,
  DEFAULT_APP_CONFIG
} from '../core/sampleData';

interface PresupuestoEditorProps {
  presupuestoId?: string; // If editing existing
  initialClienteId?: string; // Pre-selected client ID
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
  const clientes = (useLiveQuery(() => db.clientes.toArray()) || []).filter(c => !c.deleted);
  const tareasTipo = (useLiveQuery(() => db.tareasTipo.toArray()) || []).filter(t => !t.deleted);
  const favoriteTareas = [...tareasTipo].sort((a, b) => (b.frecuenciaUso || 0) - (a.frecuenciaUso || 0)).slice(0, 8);

  const legacyInsumos = (useLiveQuery(() => db.insumos.toArray()) || []).filter(i => !i.deleted);
  const materiales = (useLiveQuery(() => db.materiales.toArray()) || []).filter(m => !m.deleted);
  const ofertas = (useLiveQuery(() => db.ofertas.toArray()) || []).filter(o => !o.deleted);
  const manoObraList = (useLiveQuery(() => db.manoObra.toArray()) || []).filter(m => !m.deleted);
  const costosIndirectos = (useLiveQuery(() => db.costosIndirectos.toArray()) || []).filter(c => !c.deleted);

  const insumosMap = useMemo(() => {
    const latestOfertaMap = new Map<string, Oferta>();
    // Sort ofertas ascending by date so newest date stays in Map
    const sortedOfertas = [...ofertas].sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());
    sortedOfertas.forEach(o => {
      if (o.materialId) {
        latestOfertaMap.set(o.materialId, o);
      }
    });

    const map = new Map<string, Insumo>();
    legacyInsumos.forEach(i => map.set(i.id, i));
    materiales.forEach(m => {
      const oferta = latestOfertaMap.get(m.id);
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
  }, [legacyInsumos, materiales, ofertas]);

  const manoObraMap = useMemo(
    () => new Map<string, CategoriaManoDeObra>(manoObraList.map((m) => [m.id, m])),
    [manoObraList]
  );

  const existingPresupuesto = useLiveQuery(
    () => (presupuestoId ? db.presupuestos.get(presupuestoId) : undefined),
    [presupuestoId]
  );

  const [tipoFactura, setTipoFactura] = useState<TipoFactura>(
    config.tipoFacturaPorDefecto || DEFAULT_APP_CONFIG.tipoFacturaPorDefecto
  );
  const [impuestosDetalle, setImpuestosDetalle] = useState<ImpuestoItem[]>(
    generarImpuestosPorDefecto(
      config.tipoFacturaPorDefecto || DEFAULT_APP_CONFIG.tipoFacturaPorDefecto,
      config.porcentajeIVAPorDefecto ?? DEFAULT_APP_CONFIG.porcentajeIVAPorDefecto,
      config.porcentajeIIBBPorDefecto ?? DEFAULT_APP_CONFIG.porcentajeIIBBPorDefecto
    )
  );

  const [clienteId, setClienteId] = useState<string>('');
  const [validezDias, setValidezDias] = useState<number>(config.validezDiasPorDefecto || DEFAULT_APP_CONFIG.validezDiasPorDefecto);
  const [margenPorcentaje, setMargenPorcentaje] = useState<number>(config.margenPorDefectoPct || DEFAULT_APP_CONFIG.margenPorDefectoPct);
  
  const [mostrarDolar, setMostrarDolar] = useState<boolean>(config.mostrarDolarPorDefecto ?? DEFAULT_APP_CONFIG.mostrarDolarPorDefecto);
  const [nombreDolar, setNombreDolar] = useState<string>(config.dolarReferenciaNombre || DEFAULT_APP_CONFIG.dolarReferenciaNombre);
  const [cotizacionDolar, setCotizacionDolar] = useState<number>(config.dolarReferenciaValor || DEFAULT_APP_CONFIG.dolarReferenciaValor);

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

  // Modal selector TareaTipo
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

  // Initial load if editing or creating (runs ONCE per opened budget)
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
        setValidezDias(existingPresupuesto.validezDias);
        setMargenPorcentaje(existingPresupuesto.beneficioPorcentaje ?? existingPresupuesto.margenPorcentaje);
        setMostrarDolar(existingPresupuesto.mostrarReferenciaMonedaExtranjera);
        setNombreDolar(existingPresupuesto.nombreMonedaExtranjera || 'USD Blue');
        setCotizacionDolar(existingPresupuesto.cotizacionMonedaExtranjera || 1350);
        setCondicionesPagoTexto(existingPresupuesto.condicionesPagoTexto);
        setOpcionesEmision(existingPresupuesto.opcionesEmision || {
          mostrarItemizado: true,
          mostrarDetalleCostos: false,
          condicionesComerciales: existingPresupuesto.condicionesPagoTexto || ''
        });
        setItems(existingPresupuesto.items);
        setEstado(existingPresupuesto.estado);

        // Cargar configuración de costos indirectos del presupuesto
        if (existingPresupuesto.costosIndirectosConfig && existingPresupuesto.costosIndirectosConfig.length > 0) {
          setCostosIndirectosConfig(existingPresupuesto.costosIndirectosConfig);
        } else if (existingPresupuesto.costosIndirectosAplicados && existingPresupuesto.costosIndirectosAplicados.length > 0) {
          setCostosIndirectosConfig(
            existingPresupuesto.costosIndirectosAplicados.map((ci) => ({
              id: ci.costoIndirectoId,
              nombre: ci.nombre,
              tipo: ci.tipo,
              valor: ci.valorAplicado,
              aplica: true
            }))
          );
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
      if (initialClienteId) {
        setClienteId(initialClienteId);
      } else if (clientes.length > 0 && !clienteId) {
        setClienteId(clientes[0].id);
      }

      if (costosIndirectos.length > 0) {
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
  }, [presupuestoId, existingPresupuesto, clientes, initialClienteId, costosIndirectos]);

  const handleTipoFacturaChange = (nuevoTipo: TipoFactura) => {
    setTipoFactura(nuevoTipo);
    setImpuestosDetalle(
      generarImpuestosPorDefecto(
        nuevoTipo,
        config.porcentajeIVAPorDefecto ?? 21,
        config.porcentajeIIBBPorDefecto ?? 3.5
      )
    );
  };

  const handleAddCustomTax = () => {
    const newTax: ImpuestoItem = {
      id: `tax-${crypto.randomUUID()}`,
      nombre: 'Nuevo Impuesto / Percepción',
      porcentaje: 1.5,
      aplica: true,
      discriminar: tipoFactura === 'Factura A',
      montoCalculado: 0
    };
    setImpuestosDetalle((prev) => [...prev, newTax]);
  };

  const handleToggleTax = (index: number) => {
    setImpuestosDetalle((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], aplica: !next[index].aplica };
      return next;
    });
  };

  const handleUpdateTaxPct = (index: number, porcentaje: number) => {
    setImpuestosDetalle((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], porcentaje: Math.max(0, porcentaje) };
      return next;
    });
  };

  const handleRemoveTax = (index: number) => {
    setImpuestosDetalle((prev) => prev.filter((_, i) => i !== index));
  };

  // Handlers para Costos Indirectos / Fijos del presupuesto
  const handleToggleIndirectCost = (index: number) => {
    setCostosIndirectosConfig((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], aplica: !next[index].aplica };
      return next;
    });
  };

  const handleUpdateIndirectCostValor = (index: number, valor: number) => {
    setCostosIndirectosConfig((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], valor: Math.max(0, valor) };
      return next;
    });
  };

  const handleAddCustomIndirectCost = () => {
    const newCost: CostoIndirectoItemConfig = {
      id: `ci-${crypto.randomUUID()}`,
      nombre: 'Costo Fijo / Estructura Especial',
      tipo: 'porcentual_sobre_costo',
      valor: 5,
      aplica: true
    };
    setCostosIndirectosConfig((prev) => [...prev, newCost]);
  };

  const handleRemoveIndirectCost = (index: number) => {
    setCostosIndirectosConfig((prev) => prev.filter((_, i) => i !== index));
  };

  const handleResetIndirectCosts = () => {
    if (confirm('¿Restablecer los costos fijos a la plantilla global por defecto?')) {
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
  };

  // Live total calculations memoized for performance (C → GG → B → S → Impuestos → Precio Final & K)
  const totales = useMemo(() => {
    return calcularTotalesPresupuesto({
      items,
      costosIndirectosCatalog: costosIndirectos,
      costosIndirectosConfig,
      beneficioPorcentaje: margenPorcentaje,
      impuestosDetalle,
      cotizacionMonedaExtranjera: mostrarDolar ? cotizacionDolar : undefined
    });
  }, [items, costosIndirectos, costosIndirectosConfig, margenPorcentaje, impuestosDetalle, mostrarDolar, cotizacionDolar]);

  // Add Item from TareaTipo Template
  const handleAddTareaTipoItem = (tarea: TareaTipo) => {
    const cost = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap);
    
    // Default unit direct cost
    const costoDirectoUnitario = cost.costoDirectoUnitario;
    const precioVentaUnitario = costoDirectoUnitario;

    const newItem: ItemPresupuesto = {
      id: `item-${crypto.randomUUID()}`,
      tareaTipoId: tarea.id,
      descripcion: tarea.nombre,
      cantidad: 1,
      unidad: tarea.unidad,
      insumosSnapshot: cost.insumosSnapshotUnitario,
      manoObraSnapshot: cost.manoObraSnapshotUnitario,
      costoInsumos: cost.costoInsumosUnitario,
      costoManoObra: cost.costoManoObraUnitario,
      costoDirectoTotal: costoDirectoUnitario,
      costoUnitario: costoDirectoUnitario,
      costoTotal: costoDirectoUnitario,
      precioVentaUnitario,
      precioVentaTotal: precioVentaUnitario
    };

    // Incrementar índice de frecuencia de uso (Spec v2 §1.2)
    db.tareasTipo.update(tarea.id, {
      frecuenciaUso: (tarea.frecuenciaUso || 0) + 1,
      ultimoUsoFecha: new Date().toISOString()
    }).catch(() => {});

    setItems((prev) => [...prev, newItem]);
    setShowItemPickerModal(false);
  };

  // Add Ad-Hoc / Non-Cataloged Item (Spec v2 §2.4)
  const handleAddAdHocItem = () => {
    const newItem: ItemPresupuesto = {
      id: `item-${crypto.randomUUID()}`,
      descripcion: 'Material / Insumo Especial No Catalogado (Ad-Hoc)',
      cantidad: 1,
      unidad: 'u',
      insumosSnapshot: [{
        insumoId: `ins-adhoc-${crypto.randomUUID()}`,
        nombre: 'Material Ad-Hoc No Catalogado',
        unidad: 'u',
        cantidadTotal: 1,
        precioUnitarioCongelado: 5000,
        subtotalInsumo: 5000,
        esAdHoc: true
      }],
      manoObraSnapshot: [],
      costoInsumos: 5000,
      costoManoObra: 0,
      costoDirectoTotal: 5000,
      costoUnitario: 5000,
      costoTotal: 5000,
      esAdHoc: true,
      precioVentaUnitario: 5000,
      precioVentaTotal: 5000
    };
    setItems((prev) => [...prev, newItem]);
  };

  // Add Custom Free Text Item
  const handleAddCustomItem = () => {
    const newItem: ItemPresupuesto = {
      id: `item-${crypto.randomUUID()}`,
      descripcion: 'Trabajo / Partida Personalizada',
      cantidad: 1,
      unidad: 'u',
      insumosSnapshot: [],
      manoObraSnapshot: [],
      costoInsumos: 0,
      costoManoObra: 0,
      costoDirectoTotal: 0,
      costoUnitario: 0,
      costoTotal: 0,
      precioVentaUnitario: 10000,
      precioVentaTotal: 10000
    };
    setItems((prev) => [...prev, newItem]);
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

      // Recalcular mano de obra con multiplicador de condición (Spec v2 §1.2)
      const manoObraActualizada = target.manoObraSnapshot.map(mo => {
        const horasAjustadas = mo.horasTotales * mult;
        return {
          ...mo,
          subtotalManoObra: roundMoney(mo.costoHoraCongelado * horasAjustadas)
        };
      });

      const costoManoObra = roundMoney(manoObraActualizada.reduce((acc, m) => acc + m.subtotalManoObra, 0));
      const costoDirectoTotal = roundMoney(target.costoInsumos + costoManoObra + (target.costoServiciosTercerizados || 0));

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

  const handleUpdateItemQuantity = (index: number, qty: number) => {
    const safeQty = Math.max(0.01, qty);
    setItems((prev) => {
      const next = [...prev];
      const target = next[index];
      const prevQty = target.cantidad || 1;

      // Escalar insumos
      const insumosActualizados = target.insumosSnapshot.map(i => {
        const unitQty = i.cantidadUnitaria !== undefined ? i.cantidadUnitaria : i.cantidadTotal / prevQty;
        const cantTotal = roundMoney(unitQty * safeQty);
        return {
          ...i,
          cantidadUnitaria: unitQty,
          cantidadTotal: cantTotal,
          subtotalInsumo: roundMoney(i.precioUnitarioCongelado * cantTotal)
        };
      });

      // Escalar mano de obra
      const manoObraActualizada = target.manoObraSnapshot.map(m => {
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
      const hasSnapshots = target.insumosSnapshot.length > 0 || target.manoObraSnapshot.length > 0;
      const costoDirectoTotal = hasSnapshots
        ? roundMoney(costoInsumos + costoManoObra + (target.costoServiciosTercerizados || 0))
        : roundMoney((target.costoDirectoTotal / prevQty) * safeQty);

      next[index] = {
        ...target,
        cantidad: safeQty,
        insumosSnapshot: insumosActualizados,
        manoObraSnapshot: manoObraActualizada,
        costoInsumos,
        costoManoObra,
        costoDirectoTotal,
        costoUnitario: roundMoney(costoDirectoTotal / safeQty),
        costoTotal: costoDirectoTotal
      };
      return next;
    });
  };

  const handleUpdateItemUnitPrice = (index: number, price: number) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        precioVentaUnitario: price,
        precioVentaTotal: price * next[index].cantidad
      };
      return next;
    });
  };

  const handleUpdateItemUnit = (index: number, unit: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        unidad: unit
      };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSavePresupuesto = async (
    targetEstado: EstadoPresupuesto = 'borrador',
    customEmission?: OpcionesEmisionPresupuesto
  ) => {
    if (!clienteId) {
      alert('Por favor selecciona un cliente para el presupuesto.');
      return;
    }

    const now = new Date().toISOString();
    let numeroStr = existingPresupuesto?.numero;

    if (!numeroStr) {
      const seq = config.siguienteNumeroCorrelativo || 1001;
      const year = new Date().getFullYear();
      numeroStr = `${config.prefijoPresupuesto || 'IEBA'}-${year}-${seq.toString().padStart(4, '0')}`;

      // Update next correlative in config
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

      // Nuevo Motor de Cálculo: C → GG → B → S → Impuestos → Precio Final & K
      costoGlobal: totales.costoGlobal,
      gastosGeneralesTotal: totales.gastosGeneralesTotal,
      beneficioPorcentaje: margenPorcentaje,
      beneficioMonto: totales.beneficioMonto,
      subtotalSinImpuestos: totales.subtotalSinImpuestos,
      montoImpuestosTotal: totales.montoImpuestosTotal,
      precioFinalGlobal: totales.precioFinalGlobal,
      coeficienteK: totales.coeficienteK,
      opcionesEmision: finalEmission,

      // Campos de compatibilidad
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
    onSaved(finalPresupuesto.id);
  };

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
            onClick={() => {
              const allInsumos = items.flatMap(it => 
                (it.insumosSnapshot || []).map(ins => ({
                  materialId: ins.materialId || ins.insumoId,
                  productoId: ins.productoId,
                  cantidad: ins.cantidadTotal
                }))
              );
              const allManoObra = items.flatMap(it =>
                (it.manoObraSnapshot || []).map(mo => ({
                  categoriaId: mo.categoriaId,
                  horas: mo.horasTotales
                }))
              );
              setSaveAsTemplateData({
                nombre: existingPresupuesto ? `Cotización ${existingPresupuesto.numero}` : 'Cotización Completa',
                insumos: allInsumos,
                manoObra: allManoObra
              });
              setShowSaveAsTemplateModal(true);
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary/10 text-primary hover:bg-primary/20 font-semibold rounded-full text-xs transition-colors border border-primary/30"
            title="Guardar toda esta cotización como un Trabajo Tipo / Plantilla"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Guardar como Trabajo Tipo</span>
          </button>

          <button
            type="button"
            onClick={() => handleSavePresupuesto('borrador')}
            className="flex-1 sm:flex-initial px-5 py-2.5 text-on-surface-variant hover:bg-surface-variant rounded-full text-sm font-medium transition-colors border border-outline-variant/30"
          >
            Guardar Borrador
          </button>

          <button
            type="button"
            onClick={() => handleSavePresupuesto('enviado')}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm hover:shadow-md"
          >
            <Lock className="w-4 h-4" />
            <span>Emitir & Congelar</span>
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
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
                  {TIPOS_FACTURA.map((tf) => (
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

            {/* Favorites Bar / Accesos Directos Táctiles (Spec v2 §1.3) */}
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

            {/* Alerta de Margen Bajo (Spec v2 §4.2) */}
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
                        <p className="text-[11px] opacity-90">Revisa los costos directos, mano de obra o incrementa el margen para resguardar la rentabilidad.</p>
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
                  const isCustom = !item.tareaTipoId || item.insumosSnapshot.length === 0;

                  return (
                    <div
                      key={item.id}
                      className="bg-surface-container-highest/40 border border-outline-variant/20 rounded-2xl p-4 space-y-3 hover:border-outline-variant/40 transition"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <label className="text-[10px] text-on-surface-variant font-semibold uppercase">
                              {item.esAdHoc ? 'Ítem Ad-Hoc (Sin Catálogo)' : isCustom ? 'Partida Libre — Descripción' : 'Descripción de la Partida'}
                            </label>
                            {item.esAdHoc && (
                              <span className="text-[9px] font-bold px-2 py-0.2 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300">
                                Ad-Hoc
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={item.descripcion}
                            onChange={(e) => {
                              const newDesc = e.target.value;
                              setItems((prev) => {
                                const next = [...prev];
                                next[idx].descripcion = newDesc;
                                return next;
                              });
                            }}
                            className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-1.5 text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5">
                          {/* Modificador por Condición de Obra (Spec v2 §1.2) */}
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-on-surface-variant">Obra:</span>
                            <select
                              value={item.condicionTrabajo || 'normal'}
                              onChange={(e) => handleUpdateItemCondicion(idx, e.target.value as any)}
                              className="bg-surface-container-highest border border-outline-variant/30 rounded-xl px-2 py-1 text-xs text-on-surface focus:outline-none"
                            >
                              {CONDICIONES_TRABAJO.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Quantity with Touch Stepper (Spec v2 §1.3) */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-on-surface-variant">Cant:</span>
                            <div className="flex items-center gap-0.5 bg-surface-container-highest border border-outline-variant/30 rounded-xl p-0.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantity(idx, Math.max(0.1, item.cantidad - 1))}
                                className="w-8 h-8 flex items-center justify-center font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg transition-colors active:scale-95 touch-manipulation text-base"
                                title="Restar 1"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                step="0.1"
                                inputMode="decimal"
                                value={item.cantidad}
                                onChange={(e) => handleUpdateItemQuantity(idx, parseFloat(e.target.value) || 0)}
                                className="w-12 bg-transparent border-none text-xs text-on-surface font-mono font-bold text-center focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantity(idx, item.cantidad + 1)}
                                className="w-8 h-8 flex items-center justify-center font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg transition-colors active:scale-95 touch-manipulation text-base"
                                title="Sumar 1"
                              >
                                +
                              </button>
                            </div>
                            <input
                              type="text"
                              value={item.unidad}
                              onChange={(e) => handleUpdateItemUnit(idx, e.target.value)}
                              className="w-12 bg-surface-container-highest border border-outline-variant/30 rounded-xl px-1.5 py-1 text-xs text-on-surface text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>

                          {/* Unit Selling Price Input */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-on-surface-variant">Precio Unit:</span>
                            <div className="relative">
                              <span className="text-xs text-on-surface-variant absolute left-2 top-1.5">$</span>
                              <input
                                type="number"
                                step="1"
                                inputMode="decimal"
                                value={item.precioVentaUnitario}
                                onChange={(e) => handleUpdateItemUnitPrice(idx, parseFloat(e.target.value) || 0)}
                                className="w-28 bg-surface-container-highest border border-outline-variant/30 rounded-xl pl-5 pr-2 py-1 text-xs text-primary font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const itemInsumos = (item.insumosSnapshot || []).map(ins => ({
                                materialId: ins.materialId || ins.insumoId,
                                productoId: ins.productoId,
                                cantidad: ins.cantidadTotal
                              }));
                              const itemManoObra = (item.manoObraSnapshot || []).map(mo => ({
                                categoriaId: mo.categoriaId,
                                horas: mo.horasTotales
                              }));
                              setSaveAsTemplateData({
                                nombre: item.descripcion || 'Nueva Tarea Tipo',
                                insumos: itemInsumos,
                                manoObra: itemManoObra
                              });
                              setShowSaveAsTemplateModal(true);
                            }}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-xl transition-colors"
                            title="Guardar este módulo/partida como Trabajo Tipo"
                          >
                            <Sparkles className="w-4 h-4 text-primary" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors"
                            title="Eliminar ítem"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Breakdown Cost Footer per Item (Internal Cost vs. Client Sale Price with K) */}
                      <div className="bg-surface-container-highest/60 p-3 rounded-xl border border-outline-variant/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex flex-wrap items-center gap-3 text-on-surface-variant">
                          {isCustom ? (
                            <div className="flex items-center gap-2">
                              <span>Costo Base Estimado (C):</span>
                              <input
                                type="number"
                                step="1"
                                value={item.costoDirectoTotal}
                                onChange={(e) => {
                                  const c = parseFloat(e.target.value) || 0;
                                  setItems(prev => {
                                    const next = [...prev];
                                    next[idx] = {
                                      ...next[idx],
                                      costoDirectoTotal: c,
                                      costoUnitario: roundMoney(c / (next[idx].cantidad || 1)),
                                      costoTotal: c
                                    };
                                    return next;
                                  });
                                }}
                                className="w-24 bg-surface-container-highest border border-outline-variant/30 rounded-lg px-2 py-0.5 text-xs text-primary font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="0"
                              />
                            </div>
                          ) : (
                            <>
                              <span>
                                Insumos: <strong className="text-on-surface">{formatARS(item.costoInsumos)}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Mano Obra: <strong className="text-on-surface">{formatARS(item.costoManoObra)}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Costo Directo (C): <strong className="text-on-surface font-mono font-bold">{formatARS(totales.itemsCalculados[idx]?.costoDirectoTotal ?? item.costoDirectoTotal)}</strong>
                                <span className="text-[10px] text-on-surface-variant ml-1 font-normal">
                                  ({formatARS(totales.itemsCalculados[idx]?.costoUnitario ?? (item.costoDirectoTotal / (item.cantidad || 1)))}/{item.unidad || 'u'})
                                </span>
                              </span>
                            </>
                          )}
                        </div>

                        {/* Client Sale Price calculated with APU */}
                        <div className="bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
                          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                            Venta Cliente (APU):
                          </span>
                          <span className="font-mono font-bold text-primary text-sm">
                            {formatARS(totales.itemsCalculados[idx]?.precioVentaClienteTotal ?? item.precioVentaTotal)}
                          </span>
                          <span className="text-[10px] text-primary/80 font-mono">
                            ({formatARS(totales.itemsCalculados[idx]?.precioVentaClienteUnitario ?? (item.precioVentaTotal / (item.cantidad || 1)))}/{item.unidad || 'u'})
                          </span>
                        </div>

                        {/* APU Prorated Micro-Breakdown when GG absolutes exist */}
                        {totales.itemsCalculados[idx]?.ggAbsolutoProrrateado ? (
                          <div className="w-full flex flex-wrap items-center justify-between gap-2 text-[10px] text-on-surface-variant font-mono pt-1 border-t border-outline-variant/10">
                            <span>Incidencia: {((totales.itemsCalculados[idx]?.incidencia || 0) * 100).toFixed(1)}%</span>
                            <span>GG Fijo Prorr.: +{formatARS(totales.itemsCalculados[idx]?.ggAbsolutoProrrateado || 0)}</span>
                            <span>Base APU: {formatARS(totales.itemsCalculados[idx]?.baseCostoItem || 0)}</span>
                            <span>Beneficio: {formatARS(totales.itemsCalculados[idx]?.beneficioItem || 0)}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Conditions & Milestones */}
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

        {/* Right Column: Dynamic Chain Calculation Sidebar (C → GG → B → S → Impuestos → Precio Final & K) */}
        <div className="space-y-6">
          <div className="bg-surface-container-low rounded-3xl p-6 space-y-5 border border-outline-variant/10 shadow-sm sticky top-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wide flex items-center gap-2">
                <Calculator className="w-4 h-4 text-primary" />
                <span>Liquidación & Cadena de Precios</span>
              </h3>
            </div>

            {/* 1. COSTO DIRECTO (C) */}
            <div className="bg-surface-container-high/60 p-4 rounded-2xl border border-outline-variant/20 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-on-surface">
                <span className="uppercase tracking-wider">1. Costo Directo Total (C):</span>
                <span className="font-mono text-sm font-bold text-on-surface">{formatARS(totales.costoGlobal)}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px] text-on-surface-variant font-mono pt-1 border-t border-outline-variant/10">
                <div>Insumos: <strong className="text-on-surface block">{formatARS(totales.subtotalInsumos)}</strong></div>
                <div>Mano Obra: <strong className="text-on-surface block">{formatARS(totales.subtotalManoObra)}</strong></div>
                <div>Servicios: <strong className="text-on-surface block">{formatARS(totales.subtotalServiciosTercerizados)}</strong></div>
              </div>
            </div>

            {/* 2. GASTOS GENERALES (GG) */}
            <div className="bg-surface-container-high/60 p-4 rounded-2xl border border-outline-variant/20 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                    2. Gastos Generales (GG)
                  </label>
                  <span className="text-[10px] text-on-surface-variant">
                    {costosIndirectosConfig.filter(c => c.aplica).length} activos (GG% se aplica sobre C)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetIndirectCosts}
                    className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                    title="Restablecer desde catálogo global"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomIndirectCost}
                    className="text-[11px] text-primary hover:underline font-semibold"
                  >
                    + Agregar GG
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {costosIndirectosConfig.map((ci, idx) => {
                  const montoCalculado = ci.tipo === 'porcentual_sobre_costo'
                    ? roundMoney(totales.costoGlobal * (ci.valor / 100))
                    : roundMoney(ci.valor);

                  return (
                    <div key={ci.id || idx} className="bg-surface-container p-2.5 rounded-xl border border-outline-variant/20 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-xs text-on-surface truncate flex-1">
                          <input
                            type="checkbox"
                            checked={ci.aplica}
                            onChange={() => handleToggleIndirectCost(idx)}
                            className="w-4 h-4 text-primary rounded border-outline-variant"
                          />
                          <input
                            type="text"
                            value={ci.nombre}
                            onChange={(e) => {
                              const newName = e.target.value;
                              setCostosIndirectosConfig(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], nombre: newName };
                                return next;
                              });
                            }}
                            className="bg-transparent border-none p-0 text-xs font-medium text-on-surface focus:ring-0 truncate w-full"
                          />
                        </label>

                        <div className="flex items-center gap-1 shrink-0">
                          {ci.tipo !== 'porcentual_sobre_costo' && <span className="text-[10px] text-on-surface-variant font-mono">$</span>}
                          <input
                            type="number"
                            step="0.5"
                            value={ci.valor}
                            onChange={(e) => handleUpdateIndirectCostValor(idx, parseFloat(e.target.value) || 0)}
                            className="w-16 bg-surface-container-highest border border-outline-variant/30 rounded-lg px-1.5 py-0.5 text-xs text-right font-mono"
                          />
                          {ci.tipo === 'porcentual_sobre_costo' && <span className="text-[10px] text-on-surface-variant font-bold">%</span>}

                          <button
                            type="button"
                            onClick={() => handleRemoveIndirectCost(idx)}
                            className="text-on-surface-variant hover:text-error p-1 rounded-full transition-colors ml-1"
                            title="Eliminar"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {ci.aplica && (
                        <div className="flex justify-between items-center text-[11px] text-on-surface-variant font-mono pt-1 border-t border-outline-variant/10">
                          <span>
                            {ci.nombre} ({ci.tipo === 'porcentual_sobre_costo' ? `${ci.valor}% s/Costo` : 'Fijo'}):
                          </span>
                          <span className="font-bold text-primary">{formatARS(montoCalculado)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between text-xs font-bold text-primary pt-1 border-t border-outline-variant/20">
                <span>Total Gastos Generales (GG):</span>
                <span className="font-mono">{formatARS(totales.gastosGeneralesTotal)}</span>
              </div>
            </div>

            {/* 3. BENEFICIO (B) */}
            <div className="bg-surface-container-high/60 p-4 rounded-2xl border border-outline-variant/20 space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                    3. Beneficio (B)
                  </label>
                  <span className="text-[10px] text-on-surface-variant">
                    Calculado sobre Costo + GG ({formatARS(totales.costoTotalObra)})
                  </span>
                </div>
                <div className="relative w-24">
                  <input
                    type="number"
                    min="0"
                    max="500"
                    step="1"
                    value={margenPorcentaje}
                    onChange={(e) => setMargenPorcentaje(parseFloat(e.target.value) || 0)}
                    className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl pl-3 pr-7 py-1.5 text-sm text-primary font-mono font-bold text-right focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <span className="text-xs text-primary font-bold absolute right-2.5 top-2">%</span>
                </div>
              </div>

              <div className="flex justify-between text-xs font-bold text-tertiary pt-1 border-t border-outline-variant/10">
                <span>Monto Beneficio ({margenPorcentaje}%):</span>
                <span className="font-mono font-semibold">{formatARS(totales.beneficioMonto)}</span>
              </div>
            </div>

            {/* 4. SUBTOTAL SIN IMPUESTOS (S = C + GG + B) */}
            <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/30 flex justify-between items-center text-xs font-bold text-on-surface shadow-2xs">
              <span className="uppercase tracking-wider">4. Subtotal sin Impuestos (S):</span>
              <span className="font-mono text-primary text-sm">{formatARS(totales.subtotalSinImpuestos)}</span>
            </div>

            {/* 5. IMPUESTOS (independientes calculados sobre S) */}
            <div className="bg-surface-container-high/60 p-4 rounded-2xl border border-outline-variant/20 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                    5. Impuestos ({tipoFactura})
                  </label>
                  <span className="text-[10px] text-on-surface-variant">
                    Calculados sobre Subtotal (S), sin cascada
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomTax}
                  className="text-[11px] text-primary hover:underline font-semibold"
                >
                  + Impuesto
                </button>
              </div>

              <div className="space-y-2">
                {totales.impuestosCalculados.map((tax, idx) => (
                  <div key={tax.id || idx} className="bg-surface-container p-2.5 rounded-xl border border-outline-variant/20 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-xs text-on-surface truncate flex-1">
                        <input
                          type="checkbox"
                          checked={tax.aplica}
                          onChange={() => handleToggleTax(idx)}
                          className="w-4 h-4 text-primary rounded border-outline-variant"
                        />
                        <span className="truncate">{tax.nombre}</span>
                      </label>

                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          step="0.1"
                          value={tax.porcentaje}
                          onChange={(e) => handleUpdateTaxPct(idx, parseFloat(e.target.value) || 0)}
                          className="w-16 bg-surface-container-highest border border-outline-variant/30 rounded-lg px-1.5 py-0.5 text-xs text-right font-mono"
                        />
                        <span className="text-[10px] text-on-surface-variant font-bold">%</span>

                        {idx >= 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTax(idx)}
                            className="text-on-surface-variant hover:text-error p-1 rounded-full transition-colors ml-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {tax.aplica && (
                      <div className="flex justify-between items-center text-[11px] text-on-surface-variant font-mono pt-1 border-t border-outline-variant/10">
                        <span>{tax.nombre} ({tax.porcentaje}% s/S):</span>
                        <span className="font-bold text-primary">{formatARS(tax.montoCalculado)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-xs font-bold text-primary pt-1 border-t border-outline-variant/20">
                <span>Total Impuestos ({totales.impuestosPorcentajeTotal}%):</span>
                <span className="font-mono">{formatARS(totales.montoImpuestosTotal)}</span>
              </div>
            </div>

            {/* 6. PRECIO FINAL GLOBAL & COEFICIENTE K */}
            <div className="bg-primary-container/40 border border-primary/30 p-5 rounded-3xl space-y-2 text-center shadow-sm">
              <span className="text-xs uppercase tracking-wider font-bold text-primary block">
                6. PRECIO FINAL GLOBAL COTIZADO
              </span>
              <div className="font-mono text-3xl font-black text-on-surface">{formatARS(totales.precioFinalGlobal)}</div>

              <div className="pt-2 border-t border-primary/20 flex flex-col items-center justify-center gap-1">
                <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                  Coeficiente de Venta K = {totales.coeficienteK.toFixed(4)}
                </span>
                <span className="text-[10px] text-on-surface-variant">
                  Multiplicador aplicado a cada ítem para el cliente
                </span>
              </div>

              {mostrarDolar && totales.totalMonedaExtranjera && (
                <div className="text-xs text-tertiary font-mono font-semibold pt-1">
                  Equivalente: {formatUSD(totales.totalMonedaExtranjera, nombreDolar)}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowEmitirModal(true)}
              className="w-full py-3.5 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full transition-all flex items-center justify-center gap-2 text-sm shadow-md hover:shadow-lg active:scale-98 cursor-pointer"
            >
              <CheckCircle className="w-5 h-5 text-on-primary" />
              <span>Emitir Presupuesto...</span>
            </button>
          </div>
        </div>
      </div>

      {showItemPickerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-on-surface">
            <div className="px-6 py-4 border-b border-outline-variant/30 flex items-center justify-between">
              <h3 className="font-semibold text-on-surface text-base flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <span>Seleccionar Tarea Tipo del Catálogo</span>
              </h3>
              <button
                onClick={() => setShowItemPickerModal(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-variant transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {tareasTipo.length === 0 ? (
                <p className="text-center text-on-surface-variant text-sm py-8">
                  No hay Tareas Tipo cargadas en el catálogo. Puedes cargarlas desde la pestaña "Tareas Tipo".
                </p>
              ) : (
                tareasTipo.map((tarea) => {
                  const cost = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap);
                  return (
                    <div
                      key={tarea.id}
                      onClick={() => handleAddTareaTipoItem(tarea)}
                      className="bg-surface-container-low border border-outline-variant/20 hover:border-primary/50 hover:bg-surface-container/80 p-4 rounded-2xl cursor-pointer transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 group"
                    >
                      <div>
                        <span className="text-[10px] font-bold text-on-tertiary-container bg-tertiary-container px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          {tarea.categoria}
                        </span>
                        <h4 className="font-bold text-on-surface group-hover:text-primary transition-colors mt-1">
                          {tarea.nombre}
                        </h4>
                        <div className="text-xs text-on-surface-variant mt-1 flex items-center gap-3">
                          <span>Insumos: {tarea.insumos.length}</span>
                          <span>•</span>
                          <span>MO: {tarea.manoObra.length} hs</span>
                        </div>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-[10px] text-on-surface-variant uppercase tracking-wider block">
                          Costo Base / {tarea.unidad}
                        </span>
                        <span className="font-mono text-base font-bold text-primary">
                          {formatARS(cost.costoDirectoUnitario)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky Quote Total & Action Bar */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 z-30 bg-surface-container-high/95 backdrop-blur-md border-t border-outline-variant/30 px-4 py-2.5 flex items-center justify-between shadow-2xl">
        <div>
          <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">Total Cotización</span>
          <div className="font-mono text-base font-bold text-primary">
            {formatARS(totales.totalARS)}
          </div>
          {mostrarDolar && totales.totalMonedaExtranjera !== undefined && (
            <div className="text-[10px] font-mono text-on-surface-variant">
              {formatUSD(totales.totalMonedaExtranjera, nombreDolar)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSavePresupuesto('borrador')}
            className="px-3 py-2 bg-surface-variant text-on-surface hover:bg-surface-container-highest rounded-xl text-xs font-semibold"
          >
            Borrador
          </button>
          <button
            type="button"
            onClick={() => setShowEmitirModal(true)}
            className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Emitir</span>
          </button>
        </div>
      </div>

      {/* Modal de Opciones al Emitir Presupuesto */}
      {showEmitirModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-on-surface">
            <div className="px-6 py-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-high">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-on-surface text-base">
                  Opciones de Emisión del Presupuesto
                </h3>
              </div>
              <button
                onClick={() => setShowEmitirModal(false)}
                className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-full hover:bg-surface-variant transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                  Presentación para el Cliente (Documento / PDF)
                </h4>

                <label className="flex items-start gap-3 p-2 rounded-xl hover:bg-surface-container transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={opcionesEmision.mostrarItemizado ?? true}
                    onChange={(e) => setOpcionesEmision(prev => ({ ...prev, mostrarItemizado: e.target.checked }))}
                    className="w-4 h-4 text-primary rounded border-outline mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-semibold text-on-surface block">Mostrar Itemizado (Precios por Renglón)</span>
                    <span className="text-xs text-on-surface-variant">
                      Si está activo, el cliente ve cada partida con su Precio de Venta unitario y total (Costo × K).
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-2 rounded-xl hover:bg-surface-container transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={opcionesEmision.mostrarDetalleCostos ?? false}
                    onChange={(e) => setOpcionesEmision(prev => ({ ...prev, mostrarDetalleCostos: e.target.checked }))}
                    className="w-4 h-4 text-primary rounded border-outline mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-semibold text-on-surface block">Mostrar Detalle de Costos Internos</span>
                    <span className="text-xs text-on-surface-variant">
                      Si está desactivado (recomendado), oculta los costos puros de materiales, mano de obra, GG y margen, mostrando solo los Precios de Venta cerrados.
                    </span>
                  </div>
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-primary block">
                  Condiciones Comerciales y Aclaraciones
                </label>
                <textarea
                  rows={4}
                  value={opcionesEmision.condicionesComerciales ?? condicionesPagoTexto}
                  onChange={(e) => setOpcionesEmision(prev => ({ ...prev, condicionesComerciales: e.target.value }))}
                  className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl p-4 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Notas, condiciones de pago, validez de la oferta o aclaraciones sobre el alcance de la obra..."
                />
                <p className="text-[11px] text-on-surface-variant">
                  Estas notas se guardan como parte del snapshot inmutable de esta emisión.
                </p>
              </div>

              {/* Summary box before emitting */}
              <div className="bg-primary-container/30 border border-primary/20 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-on-surface-variant block">Precio Total Final a Facturar:</span>
                  <span className="font-mono text-xl font-bold text-primary">{formatARS(totales.precioFinalGlobal)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-on-surface-variant block">Coeficiente K:</span>
                  <span className="font-mono text-xs font-bold text-on-surface bg-surface-container px-2.5 py-0.5 rounded-full">
                    {totales.coeficienteK.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-outline-variant/30 flex justify-end gap-3 bg-surface-container-high">
              <button
                type="button"
                onClick={() => setShowEmitirModal(false)}
                className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSavePresupuesto('enviado', opcionesEmision)}
                className="px-6 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold text-sm rounded-full transition-colors flex items-center gap-2 shadow-sm"
              >
                <Lock className="w-4 h-4" />
                <span>Confirmar & Emitir</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
