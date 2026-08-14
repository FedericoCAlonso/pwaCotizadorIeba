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
  Oferta
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
  const clientes = useLiveQuery(() => db.clientes.toArray()) || [];
  const tareasTipo = useLiveQuery(() => db.tareasTipo.toArray()) || [];
  const favoriteTareas = [...tareasTipo].sort((a, b) => (b.frecuenciaUso || 0) - (a.frecuenciaUso || 0)).slice(0, 8);

  const legacyInsumos = useLiveQuery(() => db.insumos.toArray()) || [];
  const materiales = useLiveQuery(() => db.materiales.toArray()) || [];
  const ofertas = useLiveQuery(() => db.ofertas.toArray()) || [];
  const manoObraList = useLiveQuery(() => db.manoObra.toArray()) || [];
  const costosIndirectos = useLiveQuery(() => db.costosIndirectos.toArray()) || [];

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
        setMargenPorcentaje(existingPresupuesto.margenPorcentaje);
        setMostrarDolar(existingPresupuesto.mostrarReferenciaMonedaExtranjera);
        setNombreDolar(existingPresupuesto.nombreMonedaExtranjera || 'USD Blue');
        setCotizacionDolar(existingPresupuesto.cotizacionMonedaExtranjera || 1350);
        setCondicionesPagoTexto(existingPresupuesto.condicionesPagoTexto);
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

  // Live total calculations memoized for performance
  const totales = useMemo(() => {
    return calcularTotalesPresupuesto({
      items,
      costosIndirectosCatalog: costosIndirectos,
      costosIndirectosConfig,
      margenPorcentaje,
      impuestosDetalle,
      cotizacionMonedaExtranjera: mostrarDolar ? cotizacionDolar : undefined
    });
  }, [items, costosIndirectos, costosIndirectosConfig, margenPorcentaje, impuestosDetalle, mostrarDolar, cotizacionDolar]);

  // Add Item from TareaTipo Template
  const handleAddTareaTipoItem = (tarea: TareaTipo) => {
    const cost = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap);
    
    // Default unit sale price includes base margin
    const costoDirectoUnitario = cost.costoDirectoUnitario;
    const precioVentaUnitario = Math.round(costoDirectoUnitario * (1 + margenPorcentaje / 100));

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

  // Add Custom Free Text Item
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
      esAdHoc: true,
      precioVentaUnitario: Math.round(5000 * (1 + margenPorcentaje / 100)),
      precioVentaTotal: Math.round(5000 * (1 + margenPorcentaje / 100))
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
      const precioVentaUnitario = Math.round(costoDirectoTotal * (1 + margenPorcentaje / 100));

      next[index] = {
        ...target,
        condicionTrabajo: condicion,
        manoObraSnapshot: manoObraActualizada,
        costoManoObra,
        costoDirectoTotal,
        precioVentaUnitario,
        precioVentaTotal: precioVentaUnitario * target.cantidad
      };
      return next;
    });
  };

  const handleUpdateItemQuantity = (index: number, cantidad: number) => {
    setItems((prev) => {
      const next = [...prev];
      const target = next[index];
      const cant = Math.max(0.1, cantidad);
      
      const itemRecalculado = congelarItemPresupuesto(target, cant);
      next[index] = itemRecalculado;
      return next;
    });
  };

  const handleUpdateItemUnitPrice = (index: number, precioUnitario: number) => {
    setItems((prev) => {
      const next = [...prev];
      const target = next[index];
      const pUnit = Math.max(0, precioUnitario);
      next[index] = {
        ...target,
        precioVentaUnitario: pUnit,
        precioVentaTotal: pUnit * target.cantidad
      };
      return next;
    });
  };

  const handleUpdateItemUnit = (index: number, unidad: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], unidad };
      return next;
    });
  };

  const handleUpdateItemDirectCost = (index: number, costoDirecto: number) => {
    setItems((prev) => {
      const next = [...prev];
      const cDirecto = Math.max(0, costoDirecto);
      next[index] = { ...next[index], costoDirectoTotal: cDirecto };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Save / Emit Action
  const handleSavePresupuesto = async (targetEstado: EstadoPresupuesto) => {
    if (!clienteId) {
      alert('Por favor selecciona un cliente para el presupuesto.');
      return;
    }
    if (items.length === 0) {
      alert('Agrega al menos un ítem o partida al presupuesto.');
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

    // Freeze inmutable snapshots
    const itemsFrozen = items.map((item) => congelarItemPresupuesto(item, item.cantidad));

    const finalPresupuesto: Presupuesto = {
      id: existingPresupuesto?.id || `pres-${crypto.randomUUID()}`,
      numero: numeroStr,
      clienteId,
      fechaEmision: existingPresupuesto?.fechaEmision || now,
      validezDias,
      tipoFactura,
      items: itemsFrozen,
      costosIndirectosConfig,
      costosIndirectosAplicados: totales.costosIndirectosAplicados,
      subtotalInsumos: totales.subtotalInsumos,
      subtotalManoObra: totales.subtotalManoObra,
      subtotalCostosDirectos: totales.subtotalCostosDirectos,
      subtotalCostosIndirectos: totales.subtotalCostosIndirectos,
      costoTotalObra: totales.costoTotalObra,
      margenPorcentaje,
      montoGanancia: totales.montoGanancia,
      impuestosDetalle: totales.impuestosCalculados,
      impuestosPorcentaje: totales.impuestosPorcentajeTotal,
      montoImpuestos: totales.montoImpuestosTotal,
      totalARS: totales.totalARS,
      mostrarReferenciaMonedaExtranjera: mostrarDolar,
      nombreMonedaExtranjera: nombreDolar,
      cotizacionMonedaExtranjera: cotizacionDolar,
      totalMonedaExtranjera: totales.totalMonedaExtranjera,
      condicionesPagoTexto,
      estado: targetEstado,
      fechaModificacion: now
    };

    await db.presupuestos.put(finalPresupuesto);
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
            <p className="text-sm text-on-surface-variant mt-1">
              Cálculo de costos en capas (materiales, mano de obra, indirectos, margen, impuestos).
            </p>
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

                      {/* Breakdown Cost Footer per Item */}
                      <div className="bg-surface-container-highest/60 p-3 rounded-xl border border-outline-variant/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-3 text-on-surface-variant">
                          {isCustom ? (
                            <div className="flex items-center gap-2">
                              <span>Costo Base Estimado (Opcional):</span>
                              <input
                                type="number"
                                step="1"
                                value={item.costoDirectoTotal}
                                onChange={(e) => handleUpdateItemDirectCost(idx, parseFloat(e.target.value) || 0)}
                                className="w-24 bg-surface-container-highest border border-outline-variant/30 rounded-lg px-2 py-0.5 text-xs text-primary font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="0"
                              />
                            </div>
                          ) : (
                            <>
                              <span>
                                Insumos: <strong className="text-on-surface">{formatARS(item.costoInsumos)}</strong>
                              </span>
                              <span>|</span>
                              <span>
                                Mano Obra: <strong className="text-on-surface">{formatARS(item.costoManoObra)}</strong>
                              </span>
                              <span>|</span>
                              <span>
                                Costo Directo Total: <strong className="text-primary font-bold">{formatARS(item.costoDirectoTotal)}</strong>
                              </span>
                            </>
                          )}
                        </div>

                        <div className="font-mono font-bold text-primary text-sm">
                          Subtotal Venta: {formatARS(item.precioVentaTotal)}
                        </div>
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
            <textarea
              rows={3}
              value={condicionesPagoTexto}
              onChange={(e) => setCondicionesPagoTexto(e.target.value)}
              className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-2xl p-4 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Right Column: Live Financial Summary Panel & Indirect Costs */}
        <div className="space-y-6">
          <div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-6 space-y-6 sticky top-20 shadow-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                <span>Desglose & Costos Fijos</span>
              </h3>
              <span className="text-[10px] text-on-surface-variant font-mono uppercase bg-surface-variant px-2.5 py-0.5 rounded-full">EN TIEMPO REAL</span>
            </div>

            {/* Direct Costs Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-on-surface-variant">
                <span>Subtotal Insumos Materiales:</span>
                <span className="font-mono font-semibold text-on-surface">{formatARS(totales.subtotalInsumos)}</span>
              </div>

              <div className="flex justify-between text-on-surface-variant">
                <span>Subtotal Mano de Obra:</span>
                <span className="font-mono font-semibold text-on-surface">{formatARS(totales.subtotalManoObra)}</span>
              </div>

              <div className="flex justify-between text-primary font-bold pt-2 border-t border-outline-variant/20">
                <span>Total Costos Directos:</span>
                <span className="font-mono">{formatARS(totales.subtotalCostosDirectos)}</span>
              </div>
            </div>

            {/* Costos Indirectos / Fijos Propios del Presupuesto */}
            <div className="space-y-3 pt-3 border-t border-outline-variant/30 text-xs">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider">
                  Costos Fijos / Indirectos ({costosIndirectosConfig.filter(c => c.aplica).length} activos)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetIndirectCosts}
                    className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                    title="Restablecer desde plantilla global"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomIndirectCost}
                    className="text-[11px] text-primary hover:underline font-semibold"
                  >
                    + Nuevo Costo
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {costosIndirectosConfig.map((ci, idx) => (
                  <div key={ci.id || idx} className="bg-surface-container-highest/60 p-3 rounded-2xl border border-outline-variant/20 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-on-surface truncate">
                        <input
                          type="checkbox"
                          checked={ci.aplica}
                          onChange={() => handleToggleIndirectCost(idx)}
                          className="w-4 h-4 text-primary rounded border-outline-variant bg-surface-container-highest focus:ring-primary"
                        />
                        <input
                          type="text"
                          value={ci.nombre}
                          onChange={(e) => {
                            const newName = e.target.value;
                            setCostosIndirectosConfig((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], nombre: newName };
                              return next;
                            });
                          }}
                          className="bg-transparent border-none p-0 text-xs font-medium text-on-surface focus:ring-0 truncate"
                        />
                      </label>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="relative w-20">
                          {ci.tipo !== 'porcentual_sobre_costo' && <span className="text-[10px] text-on-surface-variant absolute left-1.5 top-1 font-mono">$</span>}
                          <input
                            type="number"
                            step="0.1"
                            value={ci.valor}
                            onChange={(e) => handleUpdateIndirectCostValor(idx, parseFloat(e.target.value) || 0)}
                            className={`w-full bg-surface-container-highest border border-outline-variant/30 rounded-lg px-1.5 py-0.5 text-xs text-right font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary ${ci.tipo !== 'porcentual_sobre_costo' ? 'pl-4' : 'pr-4'}`}
                          />
                          {ci.tipo === 'porcentual_sobre_costo' && <span className="text-[10px] text-on-surface-variant absolute right-1.5 top-1 font-bold">%</span>}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveIndirectCost(idx)}
                          className="text-on-surface-variant hover:text-error p-1 rounded-full hover:bg-error-container/30 transition-colors"
                          title="Eliminar costo fijo"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {ci.aplica && (
                      <div className="flex justify-between items-center text-[11px] text-on-surface-variant font-mono pt-1 border-t border-outline-variant/20">
                        <span className="capitalize text-[10px] bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full">
                          {ci.tipo === 'porcentual_sobre_costo' ? 'Porcentual' : ci.tipo === 'fijo_mensual' ? 'Fijo Mensual' : 'Por Visita'}
                        </span>
                        <span className="font-bold text-primary">
                          {formatARS(
                            ci.tipo === 'porcentual_sobre_costo'
                              ? (totales.subtotalCostosDirectos * (ci.valor / 100))
                              : ci.valor
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-primary font-bold pt-1">
                <span>Total Costos Indirectos Fijos:</span>
                <span className="font-mono">{formatARS(totales.subtotalCostosIndirectos)}</span>
              </div>
            </div>

            {/* Total Cost of Job */}
            <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/30 flex justify-between items-center text-xs font-bold text-on-surface">
              <span>COSTO TOTAL REAL OBRA:</span>
              <span className="font-mono text-primary text-sm">{formatARS(totales.costoTotalObra)}</span>
            </div>

            {/* Margin Percentage Input */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-on-surface">Margen de Ganancia Neto (%):</label>
                <div className="relative w-28">
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

              <div className="flex justify-between text-xs text-on-surface-variant">
                <span>Ganancia Estimada:</span>
                <span className="font-mono font-semibold text-tertiary">{formatARS(totales.montoGanancia)}</span>
              </div>
            </div>

            {/* Itemized Taxes Breakdown Section */}
            <div className="space-y-3 pt-3 border-t border-outline-variant/30 text-xs">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider">
                  Impuestos & Tasas ({tipoFactura})
                </label>
                <button
                  type="button"
                  onClick={handleAddCustomTax}
                  className="text-[11px] text-primary hover:underline font-semibold"
                >
                  + Otro Impuesto
                </button>
              </div>

              <div className="space-y-2">
                {totales.impuestosCalculados.map((tax, idx) => (
                  <div key={tax.id || idx} className="bg-surface-container-highest/60 p-3 rounded-2xl border border-outline-variant/20 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-on-surface">
                        <input
                          type="checkbox"
                          checked={tax.aplica}
                          onChange={() => handleToggleTax(idx)}
                          className="w-4 h-4 text-primary rounded border-outline-variant bg-surface-container-highest focus:ring-primary"
                        />
                        <span className="truncate">{tax.nombre}</span>
                      </label>

                      <div className="flex items-center gap-1.5">
                        <div className="relative w-16">
                          <input
                            type="number"
                            step="0.1"
                            value={tax.porcentaje}
                            onChange={(e) => handleUpdateTaxPct(idx, parseFloat(e.target.value) || 0)}
                            className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-lg px-1.5 py-0.5 text-xs text-right font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary pr-5"
                          />
                          <span className="text-[10px] text-on-surface-variant absolute right-1.5 top-1 font-bold">%</span>
                        </div>

                        {idx >= 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTax(idx)}
                            className="text-on-surface-variant hover:text-error p-1 rounded-full hover:bg-error-container/30 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {tax.aplica && (
                      <div className="flex justify-between items-center text-[11px] text-on-surface-variant font-mono pt-1 border-t border-outline-variant/20">
                        <span>Monto {tax.nombre}:</span>
                        <span className="font-bold text-primary">{formatARS(tax.montoCalculado)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-on-surface font-semibold pt-1">
                <span>Total Impuestos:</span>
                <span className="font-mono text-primary">{formatARS(totales.montoImpuestosTotal)}</span>
              </div>
            </div>

            {/* Final Grand Total ARS & Foreign Currency */}
            <div className="bg-primary-container/40 border border-primary/30 p-5 rounded-2xl space-y-2 text-center shadow-sm">
              <span className="text-xs uppercase tracking-wider font-bold text-primary block">
                PRECIO TOTAL FINAL COTIZADO
              </span>
              <div className="font-mono text-2xl font-black text-on-surface">{formatARS(totales.totalARS)}</div>

              {mostrarDolar && totales.totalMonedaExtranjera && (
                <div className="text-xs text-tertiary font-mono font-semibold pt-2 border-t border-primary/20">
                  Equivalente: {formatUSD(totales.totalMonedaExtranjera, nombreDolar)}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleSavePresupuesto('enviado')}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full transition-all flex items-center justify-center gap-2 text-sm shadow-md hover:shadow-lg"
            >
              <CheckCircle className="w-5 h-5 text-on-primary" />
              <span>Emitir & Congelar Presupuesto</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Item Picker (TareasTipo) */}
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
            onClick={() => handleSavePresupuesto('enviado')}
            className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Emitir</span>
          </button>
        </div>
      </div>

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
