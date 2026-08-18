import React, { useState, useRef, useEffect } from 'react';
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
import { SaveAsTareaTipoModal } from './SaveAsTareaTipoModal';
import {
  AppConfig,
  ItemPresupuesto,
  TipoFactura,
  MaterialFilterContext
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
import { ItemPickerModal } from './presupuesto/ItemPickerModal';
import { EmisionPresupuestoModal } from './presupuesto/EmisionPresupuestoModal';
import { ParametricJobModal } from './presupuesto/ParametricJobModal';
import { ParametricMaterialModal } from './presupuesto/ParametricMaterialModal';
import { usePresupuestoEditorViewModel } from '../viewmodels/usePresupuestoEditorViewModel';

interface PresupuestoEditorProps {
  presupuestoId?: string;
  initialClienteId?: string;
  config: AppConfig;
  onBack: () => void;
  onSaved: (id: string) => void;
  onViewMaterialsInCatalog?: (ctx: MaterialFilterContext) => void;
}

export const PresupuestoEditor: React.FC<PresupuestoEditorProps> = ({
  presupuestoId,
  initialClienteId,
  config,
  onBack,
  onSaved,
  onViewMaterialsInCatalog
}) => {
  const { tiposFactura, condicionesTrabajo } = useAppOptions();
  const { toast } = useToast();

  const {
    clientes,
    tareasTipo,
    favoriteTareas,
    costosIndirectos,
    existingPresupuesto,
    insumosMap,
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
    handleAddTareaTipoItem,
    handleOpenParametricModalForNewTask,
    handleOpenParametricModalForExistingItem,
    handleOpenMaterialModalForExistingItem,
    handleApplyMaterialEstimation,
    handleConfirmParametricJob,
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
  } = usePresupuestoEditorViewModel({
    presupuestoId,
    initialClienteId,
    config,
    onSaved,
    onViewMaterialsInCatalog
  });

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

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
          {onViewMaterialsInCatalog && items.length > 0 && (
            <button
              type="button"
              onClick={handleOpenMaterialsInCatalog}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-semibold rounded-full text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              title="Abrir catálogo filtrado con los materiales de esta cotización para consultar ofertas o actualizar precios"
            >
              <Package className="w-4 h-4 text-primary" />
              <span>Insumos en Catálogo</span>
            </button>
          )}
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
                      onOpenParametricModal={handleOpenParametricModalForExistingItem}
                      onOpenMaterialModal={handleOpenMaterialModalForExistingItem}
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
        insumos={saveAsTemplateData.insumos}
        manoObra={saveAsTemplateData.manoObra}
      />
    </div>
  );
};
