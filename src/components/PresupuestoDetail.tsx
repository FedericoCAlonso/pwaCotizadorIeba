import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Printer,
  Copy,
  Zap,
  Sparkles,
  Package,
  RefreshCw
} from 'lucide-react';
import { db } from '../db/database';
import { AppConfig, Presupuesto, EstadoPresupuesto, InsumoEnTarea, ManoObraEnTarea, MaterialFilterContext } from '../core/types';
import { formatARS, formatUSD, roundMoney, calcularTotalesPresupuesto } from '../core/calculations';
import { ESTADOS_PRESUPUESTO } from '../core/sampleData';
import { SaveAsTareaTipoModal } from './SaveAsTareaTipoModal';
import { useToast } from '../contexts/ToastContext';

interface PresupuestoDetailProps {
  presupuestoId: string;
  config: AppConfig;
  onBack: () => void;
  onEdit: () => void;
  onDuplicate: (p: Presupuesto) => void;
  onViewMaterialsInCatalog?: (ctx: MaterialFilterContext) => void;
}

export const PresupuestoDetail: React.FC<PresupuestoDetailProps> = ({
  presupuestoId,
  config,
  onBack,
  onEdit,
  onDuplicate,
  onViewMaterialsInCatalog,
}) => {
  const { toast } = useToast();
  const presupuesto = useLiveQuery(() => db.presupuestos.get(presupuestoId), [presupuestoId]);
  const cliente = useLiveQuery(
    async () => {
      if (!presupuesto?.clienteId) return undefined;
      const cto = await db.contactos.get(presupuesto.clienteId);
      if (cto) return cto;
      return db.clientes.get(presupuesto.clienteId);
    },
    [presupuesto?.clienteId]
  );

  const [showSaveAsTemplateModal, setShowSaveAsTemplateModal] = useState(false);
  const [saveAsTemplateData, setSaveAsTemplateData] = useState<{
    nombre: string;
    insumos: InsumoEnTarea[];
    manoObra: ManoObraEnTarea[];
  }>({
    nombre: '',
    insumos: [],
    manoObra: []
  });

  if (!presupuesto) {
    return (
      <div className="p-8 text-center text-slate-400">
        Cargando documento de presupuesto...
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleUpdateStatus = async (nuevoEstado: EstadoPresupuesto) => {
    await db.presupuestos.update(presupuesto.id, { estado: nuevoEstado });
  };

  const handleOpenMaterialsInCatalog = () => {
    if (!presupuesto || !onViewMaterialsInCatalog) return;
    const matQtyMap: Record<string, { cantidad: number; unidad: string }> = {};
    const idsSet = new Set<string>();

    presupuesto.items.forEach((it) => {
      (it.insumosSnapshot || []).forEach((ins: any) => {
        const id = ins.materialId || ins.insumoId;
        if (id) {
          idsSet.add(id);
          const current = matQtyMap[id]?.cantidad || 0;
          matQtyMap[id] = {
            cantidad: roundMoney(current + (ins.cantidadTotal || 0)),
            unidad: ins.unidadVenta || ins.unidad || 'u'
          };
        }
      });
    });

    if (idsSet.size === 0) {
      toast.info('Esta cotización no contiene insumos cargados para ver en el catálogo.');
      return;
    }

    onViewMaterialsInCatalog({
      title: `Cotización ${presupuesto.numero}`,
      materialIds: Array.from(idsSet),
      quantities: matQtyMap,
      returnTab: 'presupuestos',
      returnViewMode: 'detail',
      returnPresupuestoId: presupuesto.id
    });
  };

  const handleRevalidateWithCatalog = async () => {
    if (!presupuesto) return;
    const allOfertas = await db.ofertas.toArray();
    const sortedOfertas = [...allOfertas].filter(o => !o.deleted).sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());

    let updatedCount = 0;
    const updatedItems = presupuesto.items.map((it) => {
      if (!it.insumosSnapshot || it.insumosSnapshot.length === 0) return it;
      const nextSnap = it.insumosSnapshot.map((ins) => {
        const matId = ins.materialId || (ins as any).insumoId;
        const latestOferta = sortedOfertas.filter(o => o.materialId === matId).pop();
        if (latestOferta && latestOferta.precio > 0) {
          const newPrice = latestOferta.precio;
          const ali = ins.alicuotaIVA ?? 21;
          const newFinalPrice = latestOferta.precioFinal ?? (newPrice * (1 + ali / 100));
          if (newPrice !== ins.precioUnitarioCongelado) {
            updatedCount++;
          }
          return {
            ...ins,
            precioUnitarioCongelado: newPrice,
            precioFinalUnitarioCongelado: newFinalPrice,
            subtotalInsumo: roundMoney(newPrice * (ins.cantidadTotal || 1)),
            subtotalInsumoFinal: roundMoney(newFinalPrice * (ins.cantidadTotal || 1))
          };
        }
        return ins;
      });

      const isFacturaC_or_X = presupuesto.tipoFactura === 'Factura C' || presupuesto.tipoFactura === 'Presupuesto X (Sin Factura)';
      const costoInsumosNeto = roundMoney(nextSnap.reduce((acc, i) => acc + i.subtotalInsumo, 0));
      const costoInsumosFinal = roundMoney(nextSnap.reduce((acc, i) => acc + (i.subtotalInsumoFinal ?? i.subtotalInsumo), 0));
      const costoInsumos = isFacturaC_or_X ? costoInsumosFinal : costoInsumosNeto;
      const costoMO = it.costoManoObra || 0;
      const costoDirectoTotal = roundMoney(costoInsumos + costoMO);

      return {
        ...it,
        insumosSnapshot: nextSnap,
        costoInsumos,
        costoDirectoTotal,
        costoUnitario: roundMoney(costoDirectoTotal / (it.cantidad || 1)),
        costoTotal: costoDirectoTotal
      };
    });

    const calculatedTotals = calcularTotalesPresupuesto({
      items: updatedItems,
      costosIndirectosConfig: presupuesto.costosIndirectosConfig,
      margenPorcentaje: presupuesto.margenPorcentaje,
      beneficioPorcentaje: presupuesto.beneficioPorcentaje,
      impuestosDetalle: presupuesto.impuestosDetalle || [],
      tipoFactura: presupuesto.tipoFactura,
      cotizacionMonedaExtranjera: presupuesto.cotizacionMonedaExtranjera
    });

    await db.presupuestos.update(presupuesto.id, {
      items: calculatedTotals.itemsCalculados || updatedItems,
      costoGlobal: calculatedTotals.costoGlobal,
      gastosGeneralesTotal: calculatedTotals.gastosGeneralesTotal,
      beneficioMonto: calculatedTotals.beneficioMonto,
      subtotalSinImpuestos: calculatedTotals.subtotalSinImpuestos,
      montoImpuestosTotal: calculatedTotals.montoImpuestosTotal,
      precioFinalGlobal: calculatedTotals.precioFinalGlobal,
      coeficienteK: calculatedTotals.coeficienteK,
      subtotalInsumos: calculatedTotals.subtotalInsumos,
      subtotalManoObra: calculatedTotals.subtotalManoObra,
      subtotalCostosDirectos: calculatedTotals.subtotalCostosDirectos,
      subtotalCostosIndirectos: calculatedTotals.subtotalCostosIndirectos,
      costoTotalObra: calculatedTotals.costoTotalObra,
      montoGanancia: calculatedTotals.montoGanancia,
      totalARS: calculatedTotals.totalARS,
      fechaModificacion: new Date().toISOString()
    });

    if (updatedCount > 0) {
      toast.success(`Se actualizaron ${updatedCount} precios de materiales con el catálogo vigente.`);
    } else {
      toast.info('Los materiales de esta cotización ya están sincronizados con los precios del catálogo.');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Action Bar (hidden when printing) */}
      <div className="no-print flex flex-wrap justify-between items-center gap-4 bg-surface-container rounded-3xl p-5 shadow-sm border border-outline-variant/20">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-on-surface font-mono">{presupuesto.numero}</h2>
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full capitalize tracking-wide ${
                {
                  borrador: 'bg-surface-variant text-on-surface-variant',
                  enviado: 'bg-primary-container text-on-primary-container',
                  aprobado: 'bg-tertiary-container text-on-tertiary-container',
                  rechazado: 'bg-error-container text-on-error-container',
                  vencido: 'bg-surface-container-highest text-on-surface-variant'
                }[presupuesto.estado]
              }`}>
                {presupuesto.estado}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              Emitido el {new Date(presupuesto.fechaEmision).toLocaleDateString('es-AR')} | Válido por {presupuesto.validezDias} días
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Emission Options Toggles in Action Bar (no-print) */}
          <div className="flex items-center gap-3 bg-surface-container-highest px-4 py-1.5 rounded-full text-xs font-medium text-on-surface">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={presupuesto.opcionesEmision?.mostrarItemizado ?? true}
                onChange={async (e) => {
                  const updated = {
                    ...presupuesto.opcionesEmision,
                    mostrarItemizado: e.target.checked
                  };
                  await db.presupuestos.update(presupuesto.id, { opcionesEmision: updated });
                }}
                className="w-3.5 h-3.5 text-primary rounded"
              />
              <span>Itemizado</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={presupuesto.opcionesEmision?.mostrarDetalleCostos ?? false}
                onChange={async (e) => {
                  const updated = {
                    ...presupuesto.opcionesEmision,
                    mostrarDetalleCostos: e.target.checked
                  };
                  await db.presupuestos.update(presupuesto.id, { opcionesEmision: updated });
                }}
                className="w-3.5 h-3.5 text-primary rounded"
              />
              <span>Detalle Costos</span>
            </label>
          </div>

          {/* Status Changer */}
          <select
            value={presupuesto.estado}
            onChange={(e) => handleUpdateStatus(e.target.value as EstadoPresupuesto)}
            className="bg-surface-container-highest border-none rounded-full px-4 py-2 text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 capitalize cursor-pointer transition-shadow hover:shadow-sm"
          >
            {ESTADOS_PRESUPUESTO.filter(e => e !== 'todos').map((st) => (
              <option key={st} value={st}>
                {st.charAt(0).toUpperCase() + st.slice(1)}
              </option>
            ))}
          </select>

          {/* View Materials in Catalog Button */}
          {onViewMaterialsInCatalog && (
            <button
              onClick={handleOpenMaterialsInCatalog}
              className="flex items-center gap-1.5 px-3.5 py-2 text-primary font-semibold hover:bg-primary/10 rounded-full text-xs transition-colors border border-primary/20 cursor-pointer"
              title="Ver y actualizar los precios de los materiales de esta cotización en el catálogo"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Ver Materiales en Catálogo</span>
            </button>
          )}

          {/* Revalidate Prices with Catalog Button */}
          <button
            onClick={handleRevalidateWithCatalog}
            className="flex items-center gap-1.5 px-3.5 py-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full text-xs font-semibold transition-colors border border-outline-variant/30 cursor-pointer"
            title="Refrescar costos congelados con las últimas ofertas vigentes del catálogo"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Revalidar Precios</span>
          </button>

          <button
            onClick={() => {
              const allInsumos = presupuesto.items.flatMap(it => 
                (it.insumosSnapshot || []).map((ins: any) => ({
                  materialId: ins.materialId || ins.insumoId,
                  productoId: ins.productoId,
                  cantidad: ins.cantidadTotal
                }))
              );
              const allManoObra = presupuesto.items.flatMap(it =>
                (it.manoObraSnapshot || []).map((mo: any) => ({
                  categoriaId: mo.categoriaId,
                  horas: mo.horasTotales
                }))
              );
              setSaveAsTemplateData({
                nombre: `Cotización ${presupuesto.numero}`,
                insumos: allInsumos,
                manoObra: allManoObra
              });
              setShowSaveAsTemplateModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-primary font-semibold hover:bg-primary/10 rounded-full text-xs transition-colors border border-primary/20"
            title="Guardar este presupuesto completo como plantilla de Trabajo Tipo"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Guardar como Trabajo Tipo</span>
          </button>

          <button
            onClick={() => onDuplicate(presupuesto)}
            className="flex items-center gap-2 px-4 py-2 text-on-surface hover:bg-surface-variant rounded-full text-sm font-medium transition-colors"
          >
            <Copy className="w-4 h-4" />
            <span>Duplicar</span>
          </button>

          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 text-on-surface hover:bg-surface-variant rounded-full text-sm font-medium transition-colors"
          >
            <span>Editar</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm hover:shadow-md"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet (Standard A4 document styling) */}
      <div className="printable-document bg-white text-slate-900 rounded-2xl shadow-2xl p-8 sm:p-12 border border-slate-200 space-y-8 font-sans">
        {/* Document Header */}
        <div className="flex justify-between items-start border-b border-slate-300 pb-6">
          <div>
            <div className="flex items-center gap-2 text-amber-600 font-extrabold text-2xl tracking-tight">
              <Zap className="w-7 h-7 fill-amber-500 text-amber-600" />
              <span>{config.nombreEmpresa}</span>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-0.5">{config.subtituloEmpresa}</p>
            <div className="text-[11px] text-slate-500 mt-2 space-y-0.5">
              <div>CUIT: {config.cuit}</div>
              <div>Tel / WhatsApp: {config.telefono}</div>
              <div>Email: {config.email}</div>
              <div>Dirección: {config.direccion}</div>
            </div>
          </div>

          <div className="text-right">
            <div className="inline-block bg-slate-100 text-slate-800 font-mono text-xl font-bold px-4 py-1.5 rounded-lg border border-slate-300">
              {presupuesto.numero}
            </div>
            <div className="mt-1">
              <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                {presupuesto.tipoFactura || 'Factura B'}
              </span>
            </div>
            <div className="text-xs text-slate-600 mt-2 space-y-1">
              <div>
                <strong>Fecha Emisión:</strong> {new Date(presupuesto.fechaEmision).toLocaleDateString('es-AR')}
              </div>
              <div>
                <strong>Validez Oferta:</strong> {presupuesto.validezDias} Días
              </div>
            </div>
          </div>
        </div>

        {/* Client Box */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">PRESUPUESTO PARA / CLIENTE</span>
            <div className="font-bold text-slate-900 text-base mt-0.5">{cliente ? cliente.nombre : 'Cliente General'}</div>
            {cliente?.cuitDni && <div className="text-xs text-slate-600">CUIT/DNI: {cliente.cuitDni}</div>}
            {cliente?.condicionIVA && (
              <div className="text-[11px] text-slate-500 font-medium">
                Condición Fiscal: {cliente.condicionIVA}
              </div>
            )}
          </div>

          <div className="text-left sm:text-right">
            {cliente?.direccion && <div className="text-xs text-slate-600">Obra / Ubicación: {cliente.direccion}</div>}
            {cliente?.telefono && <div className="text-xs text-slate-600">Contacto: {cliente.telefono}</div>}
            {cliente?.email && <div className="text-xs text-slate-600">Email: {cliente.email}</div>}
          </div>
        </div>

        {/* Items Table / Renglones de Cotización */}
        <div className="overflow-hidden border border-slate-300 rounded-xl">
          <table className="w-full text-left text-xs text-slate-800">
            <thead className="bg-slate-100 uppercase text-[10px] font-bold text-slate-600 border-b border-slate-300">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Ítem / Descripción de Trabajo</th>
                <th className="px-4 py-3 text-center">Cantidad</th>
                <th className="px-4 py-3 text-right">
                  {presupuesto.tipoFactura === 'Factura A' ? 'Precio Unit. Neto' : 'Precio Unitario'}
                </th>
                <th className="px-4 py-3 text-right">
                  {presupuesto.tipoFactura === 'Factura A' ? 'Subtotal Neto' : 'Subtotal'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(presupuesto.opcionesEmision?.mostrarItemizado ?? true) ? (
                presupuesto.items.map((item, idx) => {
                  const isFacturaA = presupuesto.tipoFactura === 'Factura A';
                  const pUnit = isFacturaA
                    ? (item.subtotalItem && item.cantidad ? item.subtotalItem / item.cantidad : (item.precioVentaClienteUnitario ?? item.precioVentaUnitario))
                    : (item.precioVentaClienteUnitario ?? item.precioVentaUnitario);
                  const pTotal = isFacturaA
                    ? (item.subtotalItem ?? item.precioVentaClienteTotal ?? item.precioVentaTotal)
                    : (item.precioVentaClienteTotal ?? item.precioVentaTotal);

                  return (
                    <React.Fragment key={idx}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-400 font-mono text-center w-10">{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {item.descripcion}
                          {item.condicionTrabajo && item.condicionTrabajo !== 'normal' && (
                            <span className="ml-2 text-[10px] text-slate-500 font-normal italic">
                              (Condición Obra: {item.condicionTrabajo})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          {item.cantidad} {item.unidad}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{formatARS(pUnit)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">{formatARS(pTotal)}</td>
                      </tr>
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td className="px-4 py-4 text-slate-400 font-mono text-center w-10">1</td>
                  <td className="px-4 py-4 font-semibold text-slate-900">
                    Provisión de materiales y mano de obra para instalaciones eléctricas según relevamiento.
                  </td>
                  <td className="px-4 py-4 text-center font-mono">1 gl</td>
                  <td className="px-4 py-4 text-right font-mono font-bold">
                    {formatARS(presupuesto.subtotalSinImpuestos || presupuesto.totalARS)}
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-bold">
                    {formatARS(presupuesto.subtotalSinImpuestos || presupuesto.totalARS)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals Summary & Payment Terms */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Terms & Payment Conditions */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Condiciones de Comercialización & Pago
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
              {presupuesto.opcionesEmision?.condicionesComerciales || presupuesto.condicionesPagoTexto}
            </p>

            <p className="text-[11px] text-slate-500 italic pt-2 border-t border-slate-200">
              * Los precios cotizados se congelan a la fecha de emisión durante los {presupuesto.validezDias} días de validez.
            </p>
          </div>

          {/* Grand Total Box */}
          <div className="bg-slate-100 p-6 rounded-2xl border border-slate-300 space-y-3 text-right">
            {(presupuesto.opcionesEmision?.mostrarDetalleCostos ?? false) ? (
              <div className="space-y-1.5 text-xs text-slate-600 border-b border-slate-300 pb-3">
                <div className="flex justify-between">
                  <span>1. Costo Insumos:</span>
                  <span className="font-mono">{formatARS(presupuesto.subtotalInsumos)}</span>
                </div>
                <div className="flex justify-between">
                  <span>1. Costo Mano de Obra:</span>
                  <span className="font-mono">{formatARS(presupuesto.subtotalManoObra)}</span>
                </div>
                {presupuesto.subtotalServiciosTercerizados ? (
                  <div className="flex justify-between">
                    <span>1. Servicios Tercerizados:</span>
                    <span className="font-mono">{formatARS(presupuesto.subtotalServiciosTercerizados)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-semibold border-t border-slate-200 pt-1">
                  <span>Costo Directo Total (C):</span>
                  <span className="font-mono">{formatARS(presupuesto.costoGlobal || presupuesto.subtotalCostosDirectos)}</span>
                </div>
                <div className="flex justify-between">
                  <span>2. Gastos Generales (GG):</span>
                  <span className="font-mono">{formatARS(presupuesto.gastosGeneralesTotal || presupuesto.subtotalCostosIndirectos)}</span>
                </div>
                <div className="flex justify-between">
                  <span>3. Beneficio ({presupuesto.beneficioPorcentaje ?? presupuesto.margenPorcentaje}% s/C+GG):</span>
                  <span className="font-mono">{formatARS(presupuesto.beneficioMonto || presupuesto.montoGanancia)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-slate-200 pt-1 text-slate-800">
                  <span>4. Subtotal (S):</span>
                  <span className="font-mono">{formatARS(presupuesto.subtotalSinImpuestos || (presupuesto.totalARS - (presupuesto.montoImpuestos || 0)))}</span>
                </div>

                {presupuesto.impuestosDetalle && presupuesto.impuestosDetalle.length > 0 && (
                  presupuesto.impuestosDetalle
                    .filter((t) => t.aplica)
                    .map((tax, idx) => (
                      <div key={idx} className="flex justify-between text-slate-700">
                        <span>5. {tax.nombre} ({tax.porcentaje}% s/S):</span>
                        <span className="font-mono">{formatARS(tax.montoCalculado)}</span>
                      </div>
                    ))
                )}
              </div>
            ) : (
              /* Simplified summary without exposing raw costs or margins */
              <div className="space-y-1.5 text-xs text-slate-600 border-b border-slate-300 pb-3">
                {presupuesto.tipoFactura === 'Factura A' ? (
                  <>
                    <div className="flex justify-between font-medium">
                      <span>Subtotal Neto Gravado:</span>
                      <span className="font-mono">{formatARS(presupuesto.subtotalSinImpuestos || (presupuesto.totalARS - (presupuesto.montoImpuestosTotal || 0)))}</span>
                    </div>
                    {presupuesto.impuestosDetalle &&
                      presupuesto.impuestosDetalle
                        .filter((t) => t.aplica && t.discriminar)
                        .map((tax, idx) => (
                          <div key={idx} className="flex justify-between text-slate-700">
                            <span>{tax.nombre} ({tax.porcentaje}%):</span>
                            <span className="font-mono">{formatARS(tax.montoCalculado)}</span>
                          </div>
                        ))}
                  </>
                ) : (
                  <div className="flex justify-between font-medium">
                    <span>Subtotal Trabajos {presupuesto.tipoFactura === 'Factura B' ? '(IVA incluido)' : ''}:</span>
                    <span className="font-mono">{formatARS(presupuesto.totalARS)}</span>
                  </div>
                )}
              </div>
            )}

            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                TOTAL PRESUPUESTO ({presupuesto.tipoFactura || 'Factura B'})
              </span>
              <div className="font-mono text-3xl font-black text-slate-900">{formatARS(presupuesto.totalARS)}</div>
            </div>

            {presupuesto.mostrarReferenciaMonedaExtranjera && presupuesto.totalMonedaExtranjera && (
              <div className="bg-slate-200/80 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-emerald-800 inline-block border border-slate-300">
                Referencia Informativa: {formatUSD(presupuesto.totalMonedaExtranjera, presupuesto.nombreMonedaExtranjera)} (Cotiz. ${presupuesto.cotizacionMonedaExtranjera})
              </div>
            )}
          </div>
        </div>

        {/* Signature Line */}
        <div className="pt-16 flex justify-between items-end text-xs text-slate-500">
          <div>
            <div className="w-48 border-b border-slate-400 mb-1"></div>
            <span>Firma / Aprobación del Cliente</span>
          </div>
          <div>
            <div className="w-48 border-b border-slate-400 mb-1"></div>
            <span>Responsable Técnico IEBA</span>
          </div>
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
