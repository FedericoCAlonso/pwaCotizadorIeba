import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  FileText,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  Clock,
  DollarSign,
  Calculator,
  Percent,
  Calendar,
  Layers,
  Package,
  ChevronDown,
  Lock,
  ArrowLeft,
  Info,
  X
} from 'lucide-react';
import { db } from '../db/database';
import {
  Presupuesto,
  ItemPresupuesto,
  EsquemaPago,
  HitoPago,
  AppConfig,
  TareaTipo,
  Insumo,
  CategoriaManoDeObra,
  CostoIndirecto,
  EstadoPresupuesto,
  TipoFactura,
  ImpuestoItem
} from '../core/types';
import {
  calcularCostoTareaTipo,
  calcularTotalesPresupuesto,
  formatARS,
  formatUSD,
  congelarItemPresupuesto,
  generarImpuestosPorDefecto
} from '../core/calculations';

interface PresupuestoEditorProps {
  presupuestoId?: string; // If editing existing
  config: AppConfig;
  onBack: () => void;
  onSaved: (id: string) => void;
}

export const PresupuestoEditor: React.FC<PresupuestoEditorProps> = ({
  presupuestoId,
  config,
  onBack,
  onSaved
}) => {
  const clientes = useLiveQuery(() => db.clientes.toArray()) || [];
  const tareasTipo = useLiveQuery(() => db.tareasTipo.toArray()) || [];
  const insumos = useLiveQuery(() => db.insumos.toArray()) || [];
  const manoObraList = useLiveQuery(() => db.manoObra.toArray()) || [];
  const costosIndirectos = useLiveQuery(() => db.costosIndirectos.toArray()) || [];

  const insumosMap = new Map<string, Insumo>(insumos.map((i) => [i.id, i]));
  const manoObraMap = new Map<string, CategoriaManoDeObra>(manoObraList.map((m) => [m.id, m]));

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
  
  const [mostrarDolar, setMostrarDolar] = useState<boolean>(config.mostrarDolarPorDefecto ?? true);
  const [nombreDolar, setNombreDolar] = useState<string>(config.dolarReferenciaNombre || 'USD Blue');
  const [cotizacionDolar, setCotizacionDolar] = useState<number>(config.dolarReferenciaValor || 1350);

  const [condicionesPagoTexto, setCondicionesPagoTexto] = useState<string>(
    '50% de anticipo al confirmar para acopio de materiales. 30% contra certificado de avance de obra. 20% saldo contra recepción final.'
  );

  const [items, setItems] = useState<ItemPresupuesto[]>([]);
  const [estado, setEstado] = useState<EstadoPresupuesto>('borrador');

  // Modal selector TareaTipo
  const [showItemPickerModal, setShowItemPickerModal] = useState(false);

  // Initial load if editing
  useEffect(() => {
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
    } else if (clientes.length > 0 && !clienteId) {
      setClienteId(clientes[0].id);
    }
  }, [existingPresupuesto, clientes]);

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

  // Live total calculations
  const totales = calcularTotalesPresupuesto({
    items,
    costosIndirectosCatalog: costosIndirectos,
    margenPorcentaje,
    impuestosDetalle,
    cotizacionMonedaExtranjera: mostrarDolar ? cotizacionDolar : undefined
  });

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

    setItems((prev) => [...prev, newItem]);
    setShowItemPickerModal(false);
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

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => handleSavePresupuesto('borrador')}
            className="flex-1 sm:flex-initial px-5 py-2.5 text-on-surface-variant hover:bg-surface-variant rounded-full text-sm font-medium transition-colors border border-outline-variant/30"
          >
            Guardar Borrador
          </button>

          <button
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
                  <option value="Factura A">Factura A (Discrimina IVA e IIBB)</option>
                  <option value="Factura B">Factura B (Consumidor Final / Exento)</option>
                  <option value="Factura C">Factura C (Monotributo)</option>
                  <option value="Presupuesto X (Sin Factura)">Presupuesto X (Sin Factura)</option>
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
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wide">
                Partidas & Tareas a Ejecutar ({items.length})
              </h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowItemPickerModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container rounded-full text-sm font-medium transition-colors"
                >
                  <Layers className="w-4 h-4" />
                  <span>Cargar Tarea</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomItem}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-variant hover:bg-surface-container-highest text-on-surface rounded-full text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ítem Nuevo</span>
                </button>
              </div>
            </div>

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
                      className="bg-slate-900/50 border border-slate-700/20 rounded-xl p-4 space-y-3 hover:border-slate-600/40 transition"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex-1">
                          <label className="block text-[10px] text-slate-400 font-semibold uppercase mb-0.5">
                            {isCustom ? 'Ítem Personalizado — Descripción' : 'Descripción de la Partida'}
                          </label>
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
                            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between md:justify-end gap-3">
                          {/* Quantity */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-400">Cant:</span>
                            <input
                              type="number"
                              step="0.1"
                              value={item.cantidad}
                              onChange={(e) => handleUpdateItemQuantity(idx, parseFloat(e.target.value) || 0)}
                              className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono text-center focus:outline-none focus:border-amber-500"
                            />
                            <input
                              type="text"
                              value={item.unidad}
                              onChange={(e) => handleUpdateItemUnit(idx, e.target.value)}
                              className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-slate-300 text-center focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          {/* Unit Selling Price Input */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-400">Precio Unit:</span>
                            <div className="relative">
                              <span className="text-xs text-slate-500 absolute left-2 top-1.5">$</span>
                              <input
                                type="number"
                                step="1"
                                value={item.precioVentaUnitario}
                                onChange={(e) => handleUpdateItemUnitPrice(idx, parseFloat(e.target.value) || 0)}
                                className="w-28 bg-slate-900 border border-slate-700 rounded pl-5 pr-2 py-1 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>

                          <button
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-400 transition"
                            title="Eliminar ítem"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Breakdown Cost Footer per Item */}
                      <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-3 text-slate-400">
                          {isCustom ? (
                            <div className="flex items-center gap-2">
                              <span>Costo Base Estimado (Opcional):</span>
                              <input
                                type="number"
                                step="1"
                                value={item.costoDirectoTotal}
                                onChange={(e) => handleUpdateItemDirectCost(idx, parseFloat(e.target.value) || 0)}
                                className="w-24 bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                                placeholder="0"
                              />
                            </div>
                          ) : (
                            <>
                              <span>
                                Insumos: <strong className="text-slate-200">{formatARS(item.costoInsumos)}</strong>
                              </span>
                              <span>|</span>
                              <span>
                                Mano Obra: <strong className="text-slate-200">{formatARS(item.costoManoObra)}</strong>
                              </span>
                              <span>|</span>
                              <span>
                                Costo Directo Total: <strong className="text-amber-300">{formatARS(item.costoDirectoTotal)}</strong>
                              </span>
                            </>
                          )}
                        </div>

                        <div className="font-mono font-bold text-emerald-400 text-sm">
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
          <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Condiciones de Pago & Esquema de Cobro
            </h3>
            <textarea
              rows={3}
              value={condicionesPagoTexto}
              onChange={(e) => setCondicionesPagoTexto(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Right Column: Live Financial Summary Panel */}
        <div className="space-y-6">
          <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-5 space-y-5 sticky top-16">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-amber-400" />
                <span>Desglose de Costos & Margen</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">EN TIEMPO REAL</span>
            </div>

            {/* Direct Costs Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Subtotal Insumos Materiales:</span>
                <span className="font-mono font-semibold">{formatARS(totales.subtotalInsumos)}</span>
              </div>

              <div className="flex justify-between text-slate-300">
                <span>Subtotal Mano de Obra:</span>
                <span className="font-mono font-semibold">{formatARS(totales.subtotalManoObra)}</span>
              </div>

              <div className="flex justify-between text-amber-300 font-semibold pt-1 border-t border-slate-800">
                <span>Total Costos Directos:</span>
                <span className="font-mono">{formatARS(totales.subtotalCostosDirectos)}</span>
              </div>
            </div>

            {/* Indirect Costs Breakdown */}
            <div className="space-y-2 text-xs pt-3 border-t border-slate-800">
              <div className="text-slate-400 font-semibold uppercase text-[11px] mb-1">
                Costos Indirectos Prorrateados:
              </div>
              {totales.costosIndirectosAplicados.map((ci) => (
                <div key={ci.costoIndirectoId} className="flex justify-between text-slate-400">
                  <span>
                    • {ci.nombre} {ci.tipo === 'porcentual_sobre_costo' ? `(${ci.valorAplicado}%)` : ''}:
                  </span>
                  <span className="font-mono">{formatARS(ci.montoCalculado)}</span>
                </div>
              ))}
              <div className="flex justify-between text-amber-300 font-semibold pt-1">
                <span>Total Costos Indirectos:</span>
                <span className="font-mono">{formatARS(totales.subtotalCostosIndirectos)}</span>
              </div>
            </div>

            {/* Total Cost of Job */}
            <div className="bg-slate-900/60 p-3 rounded-lg flex justify-between items-center text-xs font-semibold text-white">
              <span>COSTO TOTAL REAL OBRA:</span>
              <span className="font-mono text-amber-400">{formatARS(totales.costoTotalObra)}</span>
            </div>

            {/* Margin Percentage Input (No Range Slider) */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-200">Margen de Ganancia Neto (%):</label>
                <div className="relative w-28">
                  <input
                    type="number"
                    min="0"
                    max="500"
                    step="1"
                    value={margenPorcentaje}
                    onChange={(e) => setMargenPorcentaje(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-7 py-1.5 text-sm text-amber-400 font-mono font-bold text-right focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-xs text-amber-400 font-bold absolute right-2.5 top-2">%</span>
                </div>
              </div>

              <div className="flex justify-between text-xs text-slate-400">
                <span>Ganancia Estimada:</span>
                <span className="font-mono font-semibold text-emerald-400">{formatARS(totales.montoGanancia)}</span>
              </div>
            </div>

            {/* Itemized Taxes Breakdown Section */}
            <div className="space-y-3 pt-3 border-t border-slate-800 text-xs">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Impuestos & Tasas ({tipoFactura})
                </label>
                <button
                  type="button"
                  onClick={handleAddCustomTax}
                  className="text-[11px] text-amber-400 hover:underline font-semibold"
                >
                  + Otro Impuesto
                </button>
              </div>

              <div className="space-y-2">
                {totales.impuestosCalculados.map((tax, idx) => (
                  <div key={tax.id || idx} className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-200">
                        <input
                          type="checkbox"
                          checked={tax.aplica}
                          onChange={() => handleToggleTax(idx)}
                          className="w-3.5 h-3.5 text-amber-500 rounded border-slate-700 bg-slate-800"
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
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-right font-mono text-white focus:outline-none focus:border-amber-500 pr-5"
                          />
                          <span className="text-[10px] text-slate-400 absolute right-1.5 top-1 font-bold">%</span>
                        </div>

                        {idx >= 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTax(idx)}
                            className="text-slate-500 hover:text-rose-400 p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {tax.aplica && (
                      <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800/60">
                        <span>Monto {tax.nombre}:</span>
                        <span className="font-bold text-amber-300">{formatARS(tax.montoCalculado)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-slate-300 font-semibold pt-1">
                <span>Total Impuestos:</span>
                <span className="font-mono text-amber-400">{formatARS(totales.montoImpuestosTotal)}</span>
              </div>
            </div>

            {/* Final Grand Total ARS & Foreign Currency */}
            <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-xl space-y-1.5 text-center">
              <span className="text-xs uppercase tracking-wider font-bold text-amber-400 block">
                PRECIO TOTAL FINAL COTIZADO
              </span>
              <div className="font-mono text-xl font-bold text-white">{formatARS(totales.totalARS)}</div>

              {mostrarDolar && totales.totalMonedaExtranjera && (
                <div className="text-xs text-emerald-400 font-mono font-semibold pt-1 border-t border-amber-500/20">
                  Equivalente: {formatUSD(totales.totalMonedaExtranjera, nombreDolar)}
                </div>
              )}
            </div>

            <button
              onClick={() => handleSavePresupuesto('enviado')}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl transition flex items-center justify-center gap-2 text-sm"
            >
              <CheckCircle className="w-5 h-5 fill-slate-950 text-amber-400" />
              <span>Emitir & Congelar Presupuesto</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Item Picker from TareasTipo */}
      {showItemPickerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700/50 rounded-xl w-full max-w-2xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <span>Seleccionar Tarea Tipo del Catálogo</span>
              </h3>
              <button onClick={() => setShowItemPickerModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-2 flex-1">
              {tareasTipo.map((tarea) => {
                const cost = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap);
                return (
                  <div
                    key={tarea.id}
                    onClick={() => handleAddTareaTipoItem(tarea)}
                    className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 hover:border-amber-500/50 cursor-pointer transition flex items-center justify-between group"
                  >
                    <div>
                      <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">
                        {tarea.categoria}
                      </span>
                      <h4 className="font-bold text-white text-base group-hover:text-amber-400 transition">
                        {tarea.nombre}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {tarea.insumos.length} materiales | {tarea.manoObra.length} cat. mano de obra
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-400">Costo Directo Base:</div>
                      <div className="font-mono font-bold text-emerald-400 text-base">
                        {formatARS(cost.costoDirectoUnitario)}
                        <span className="text-xs text-slate-500 font-sans"> / {tarea.unidad}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
