import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Printer,
  Download,
  Copy,
  CheckCircle2,
  Clock,
  Zap,
  Building,
  Calendar,
  FileText,
  DollarSign
} from 'lucide-react';
import { db } from '../db/database';
import { AppConfig, Presupuesto, EstadoPresupuesto } from '../core/types';
import { formatARS, formatUSD } from '../core/calculations';

interface PresupuestoDetailProps {
  presupuestoId: string;
  config: AppConfig;
  onBack: () => void;
  onEdit: () => void;
  onDuplicate: (p: Presupuesto) => void;
}

export const PresupuestoDetail: React.FC<PresupuestoDetailProps> = ({
  presupuestoId,
  config,
  onBack,
  onEdit,
  onDuplicate
}) => {
  const presupuesto = useLiveQuery(() => db.presupuestos.get(presupuestoId), [presupuestoId]);
  const cliente = useLiveQuery(
    () => (presupuesto?.clienteId ? db.clientes.get(presupuesto.clienteId) : undefined),
    [presupuesto?.clienteId]
  );

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

  const statusBadge = {
    borrador: { label: 'BORRADOR', bg: 'bg-slate-800 text-slate-300 border-slate-700' },
    enviado: { label: 'ENVIADO', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    aprobado: { label: 'APROBADO', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    rechazado: { label: 'RECHAZADO', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
    vencido: { label: 'VENCIDO', bg: 'bg-slate-800 text-slate-500 border-slate-700' }
  }[presupuesto.estado];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Action Bar (hidden when printing) */}
      <div className="no-print flex flex-wrap justify-between items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white font-mono">{presupuesto.numero}</h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusBadge.bg}`}>
                {statusBadge.label}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Emitido el {new Date(presupuesto.fechaEmision).toLocaleDateString('es-AR')} | Válido por {presupuesto.validezDias} días
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Changer */}
          <select
            value={presupuesto.estado}
            onChange={(e) => handleUpdateStatus(e.target.value as EstadoPresupuesto)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 capitalize"
          >
            <option value="borrador">Borrador</option>
            <option value="enviado">Enviado</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
            <option value="vencido">Vencido</option>
          </select>

          <button
            onClick={() => onDuplicate(presupuesto)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition"
          >
            <Copy className="w-4 h-4" />
            <span>Duplicar</span>
          </button>

          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition"
          >
            <span>Editar</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition shadow-md shadow-amber-500/10"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / Descargar PDF</span>
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
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">PRESUNTANTE / CLIENTE</span>
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

        {/* Items Table */}
        <div className="overflow-hidden border border-slate-300 rounded-xl">
          <table className="w-full text-left text-xs text-slate-800">
            <thead className="bg-slate-100 uppercase text-[10px] font-bold text-slate-600 border-b border-slate-300">
              <tr>
                <th className="px-4 py-3">Ítem / Descripción de Trabajo</th>
                <th className="px-4 py-3 text-center">Cantidad</th>
                <th className="px-4 py-3 text-right">Precio Unitario</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {presupuesto.items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{item.descripcion}</td>
                  <td className="px-4 py-3 text-center font-mono">
                    {item.cantidad} {item.unidad}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatARS(item.precioVentaUnitario)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{formatARS(item.precioVentaTotal)}</td>
                </tr>
              ))}
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
              {presupuesto.condicionesPagoTexto}
            </p>

            <p className="text-[11px] text-slate-500 italic pt-2 border-t border-slate-200">
              * Los precios presupuestados se congelan a la fecha de emisión durante los {presupuesto.validezDias} días de validez.
            </p>
          </div>

          {/* Grand Total Box */}
          <div className="bg-slate-100 p-6 rounded-2xl border border-slate-300 space-y-3 text-right">
            <div className="space-y-1.5 text-xs text-slate-600 border-b border-slate-300 pb-3">
              <div className="flex justify-between">
                <span>Subtotal Neto Gravado:</span>
                <span className="font-mono">{formatARS(presupuesto.subtotalCostosDirectos ? (presupuesto.totalARS - presupuesto.montoImpuestos) : (presupuesto.totalARS - (presupuesto.montoImpuestos || 0)))}</span>
              </div>

              {presupuesto.impuestosDetalle && presupuesto.impuestosDetalle.length > 0 ? (
                presupuesto.impuestosDetalle
                  .filter((t) => t.aplica)
                  .map((tax, idx) => (
                    <div key={idx} className="flex justify-between text-slate-700">
                      <span>{tax.nombre} ({tax.porcentaje}%):</span>
                      <span className="font-mono">{formatARS(tax.montoCalculado)}</span>
                    </div>
                  ))
              ) : (
                presupuesto.montoImpuestos > 0 && (
                  <div className="flex justify-between">
                    <span>Impuestos ({presupuesto.impuestosPorcentaje}%):</span>
                    <span className="font-mono">{formatARS(presupuesto.montoImpuestos)}</span>
                  </div>
                )
              )}
            </div>

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
    </div>
  );
};
