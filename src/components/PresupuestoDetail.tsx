import React, { useState } from 'react';
import {
  ArrowLeft,
  Copy,
  Zap,
  Sparkles,
  Package,
  RefreshCw,
  ShieldAlert,
  FileSpreadsheet,
  Download,
  Share2,
  Edit2,
  MoreVertical,
  Printer,
  Check
} from 'lucide-react';
import { AppConfig, Presupuesto, EstadoPresupuesto, InsumoEnTarea, ManoObraEnTarea, MaterialFilterContext } from '../core/types';
import { formatARS } from '../core/calculations';
import { ESTADOS_PRESUPUESTO } from '../core/sampleData';
import { SaveAsTareaTipoModal } from './SaveAsTareaTipoModal';
import { usePresupuestoDetailViewModel } from '../viewmodels/usePresupuestoDetailViewModel';
import { exportPresupuestoToXLSX, sharePresupuesto } from '../core/exportUtils';
import { exportPresupuestoToPDF, getPresupuestoPDFBlob } from '../core/pdfExportUtils';

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
  const {
    presupuesto,
    cliente,
    isUpdatingPrices,
    handleUpdateStatus,
    handleOpenMaterialsInCatalog,
    handleRevalidateWithCatalog,
    handleUpdateOpcionesEmision
  } = usePresupuestoDetailViewModel({
    presupuestoId,
    config,
    onEdit,
    onDuplicate,
    onViewMaterialsInCatalog
  });

  const [showMoreMenu, setShowMoreMenu] = useState(false);
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
      <div className="text-center py-12">
        <p className="text-on-surface-variant">Cargando presupuesto...</p>
      </div>
    );
  }

  const handlePrintOfficialPDF = () => {
    try {
      const blob = getPresupuestoPDFBlob(presupuesto, cliente, config);
      const blobUrl = URL.createObjectURL(blob);
      const printWindow = window.open(blobUrl, '_blank');
      if (printWindow) {
        printWindow.focus();
      }
    } catch {
      exportPresupuestoToPDF(presupuesto, cliente, config);
    }
  };

  const getEstadoBadgeClass = (estado: EstadoPresupuesto) => {
    switch (estado) {
      case 'aprobado':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
      case 'enviado':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
      case 'rechazado':
      case 'vencido':
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30';
      default:
        return 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/30';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Action Bar (Mobile-First M3 Layout) */}
      <div className="no-print bg-surface-container rounded-3xl p-4 sm:p-5 shadow-sm border border-outline-variant/20 space-y-4">
        {/* Main Header Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors shrink-0"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight truncate">
                  {presupuesto.numero}
                </h2>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border capitalize ${getEstadoBadgeClass(presupuesto.estado)}`}>
                  {presupuesto.estado}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-on-surface-variant truncate">
                Cliente: <strong className="text-on-surface">{cliente ? cliente.nombre : 'Sin asignar'}</strong>
              </p>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Primary Action: PDF */}
            <button
              onClick={() => exportPresupuestoToPDF(presupuesto, cliente, config)}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-xs sm:text-sm shadow-sm transition-all min-h-[40px]"
              title="Descargar cotización oficial en PDF"
            >
              <Download className="w-4 h-4" />
              <span>PDF</span>
            </button>

            {/* Excel Button */}
            <button
              onClick={() => exportPresupuestoToXLSX(presupuesto, cliente, config)}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-full text-xs font-semibold transition-colors border border-emerald-500/30 min-h-[40px]"
              title="Exportar a Excel (XLSX) con APU y Lista de Materiales"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
            </button>

            {/* Share WhatsApp */}
            <button
              onClick={() => sharePresupuesto(presupuesto, cliente)}
              className="p-2 sm:px-3 sm:py-2 text-primary hover:bg-primary/10 rounded-full text-xs font-medium transition-colors border border-primary/20 flex items-center gap-1 min-h-[40px] min-w-[40px] justify-center"
              title="Compartir por WhatsApp"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden md:inline">Compartir</span>
            </button>

            {/* Edit Button */}
            <button
              onClick={onEdit}
              className="p-2 sm:px-3 sm:py-2 text-on-surface hover:bg-surface-variant rounded-full text-xs font-medium transition-colors border border-outline-variant/30 flex items-center gap-1 min-h-[40px] min-w-[40px] justify-center"
              title="Editar cotización"
            >
              <Edit2 className="w-4 h-4" />
              <span className="hidden sm:inline">Editar</span>
            </button>

            {/* More Options Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu((v) => !v)}
                className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center border border-outline-variant/30"
                title="Más opciones"
                aria-label="Más opciones"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {showMoreMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowMoreMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 z-30 bg-surface-container-high rounded-2xl shadow-xl py-2 min-w-[240px] border border-outline-variant/30 text-on-surface animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/20 mb-1">
                      Cambiar Estado
                    </div>
                    <div className="grid grid-cols-2 gap-1 px-2 pb-2 border-b border-outline-variant/20 mb-1">
                      {ESTADOS_PRESUPUESTO.filter(e => e !== 'todos').map((st) => (
                        <button
                          key={st}
                          onClick={() => {
                            handleUpdateStatus(st as EstadoPresupuesto);
                            setShowMoreMenu(false);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs text-left capitalize transition-colors flex items-center justify-between ${
                            presupuesto.estado === st
                              ? 'bg-primary/20 text-primary font-bold'
                              : 'hover:bg-surface-variant text-on-surface'
                          }`}
                        >
                          <span>{st}</span>
                          {presupuesto.estado === st && <Check className="w-3 h-3 text-primary" />}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        handlePrintOfficialPDF();
                        setShowMoreMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <Printer className="w-4 h-4 text-primary" />
                      <span>Imprimir PDF Oficial</span>
                    </button>

                    <button
                      onClick={() => {
                        onDuplicate(presupuesto);
                        setShowMoreMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <Copy className="w-4 h-4 text-on-surface-variant" />
                      <span>Duplicar Presupuesto</span>
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
                        setShowMoreMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-primary hover:bg-primary/10 transition-colors text-left font-medium"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Guardar como Trabajo Tipo</span>
                    </button>

                    <button
                      onClick={() => {
                        handleRevalidateWithCatalog();
                        setShowMoreMenu(false);
                      }}
                      disabled={isUpdatingPrices}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                    >
                      <RefreshCw className={`w-4 h-4 text-on-surface-variant ${isUpdatingPrices ? 'animate-spin' : ''}`} />
                      <span>Revalidar Precios Catálogo</span>
                    </button>

                    {onViewMaterialsInCatalog && (
                      <button
                        onClick={() => {
                          handleOpenMaterialsInCatalog();
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                      >
                        <Package className="w-4 h-4 text-on-surface-variant" />
                        <span>Ver Materiales en Catálogo</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Document Presentation Toggles Pill */}
        <div className="pt-2 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-on-surface-variant text-[11px] font-medium">Opciones de vista del documento:</span>
          <div className="flex items-center gap-4 bg-surface-container-highest px-3.5 py-1.5 rounded-full text-on-surface">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={presupuesto.opcionesEmision?.mostrarItemizado ?? true}
                onChange={(e) => handleUpdateOpcionesEmision({ mostrarItemizado: e.target.checked })}
                className="w-3.5 h-3.5 text-primary rounded"
              />
              <span>Itemizado</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={presupuesto.opcionesEmision?.mostrarDetalleCostos ?? false}
                onChange={(e) => handleUpdateOpcionesEmision({ mostrarDetalleCostos: e.target.checked })}
                className="w-3.5 h-3.5 text-primary rounded"
              />
              <span>Detalle de Costos</span>
            </label>
          </div>
        </div>
      </div>

      {/* Printable Sheet (Standard A4 document styling) */}
      <div className="printable-document bg-white text-slate-900 rounded-2xl shadow-xl p-6 sm:p-12 border border-slate-200 space-y-6 sm:space-y-8 font-sans">
        {/* Document Header */}
        <div className="flex justify-between items-start border-b border-slate-300 pb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-600 font-extrabold text-xl sm:text-2xl tracking-tight">
              <Zap className="w-6 h-6 sm:w-7 sm:h-7 fill-amber-500 text-amber-600" />
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

          <div className="text-left sm:text-right">
            <div className="inline-block bg-slate-100 text-slate-800 font-mono text-lg sm:text-xl font-bold px-3.5 py-1.5 rounded-lg border border-slate-300">
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
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Destinatario / Cliente
            </div>
            <div className="font-bold text-slate-900 text-base">{cliente ? cliente.nombre : 'Consumidor Final / General'}</div>
            {cliente?.razonSocial && cliente.razonSocial !== cliente.nombre && (
              <div className="text-xs text-slate-600">{cliente.razonSocial}</div>
            )}
            <div className="text-xs text-slate-600 mt-1">
              <span>CUIT / DNI: </span>
              <span className="font-mono">{cliente?.cuitDni || 'S/D'}</span>
            </div>
          </div>

          <div className="sm:text-right space-y-1 text-xs text-slate-600">
            <div>
              <strong>Condición IVA:</strong> {cliente?.condicionIVA || 'Consumidor Final'}
            </div>
            {cliente?.telefono && (
              <div>
                <strong>Teléfono:</strong> {cliente.telefono}
              </div>
            )}
            {cliente?.email && (
              <div>
                <strong>Email:</strong> {cliente.email}
              </div>
            )}
            {cliente?.direccion && (
              <div>
                <strong>Ubicación Obra:</strong> {cliente.direccion}
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-900 text-white uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-3 sm:px-4 py-3 text-center w-10">#</th>
                <th className="px-3 sm:px-4 py-3">Descripción de la Partida</th>
                <th className="px-3 sm:px-4 py-3 text-center">Unidad</th>
                <th className="px-3 sm:px-4 py-3 text-right">
                  {presupuesto.tipoFactura === 'Factura A' ? 'P. Unit. Neto' : 'P. Unitario'}
                </th>
                <th className="px-3 sm:px-4 py-3 text-right">
                  {presupuesto.tipoFactura === 'Factura A' ? 'Subtotal Neto' : 'Subtotal'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {(presupuesto.opcionesEmision?.mostrarItemizado ?? true) ? (
                presupuesto.items.map((item, idx) => {
                  const isFacturaA = presupuesto.tipoFactura === 'Factura A';
                  const pUnit = isFacturaA
                    ? (item.subtotalItem && item.cantidad ? item.subtotalItem / item.cantidad : (item.precioVentaClienteUnitario ?? item.precioVentaUnitario ?? 0))
                    : (item.precioVentaClienteUnitario ?? item.precioVentaUnitario ?? 0);
                  const pTotal = isFacturaA
                    ? (item.subtotalItem ?? item.precioVentaClienteTotal ?? item.precioVentaTotal ?? ((item.cantidad || 1) * pUnit))
                    : (item.precioVentaClienteTotal ?? item.precioVentaTotal ?? ((item.cantidad || 1) * pUnit));

                  return (
                    <React.Fragment key={item.id || idx}>
                      <tr className="hover:bg-slate-50/50">
                        <td className="px-3 sm:px-4 py-3 text-slate-400 font-mono text-center">{idx + 1}</td>
                        <td className="px-3 sm:px-4 py-3">
                          <div className="font-semibold text-slate-900">{item.descripcion || 'Sin descripción'}</div>
                          {item.notasTecnicas && (
                            <div className="text-xs text-slate-600 mt-1 whitespace-pre-line leading-relaxed">
                              {item.notasTecnicas}
                            </div>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-center font-mono">
                          {item.cantidad} {item.unidad}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right font-mono">{formatARS(pUnit)}</td>
                        <td className="px-3 sm:px-4 py-3 text-right font-mono font-bold">{formatARS(pTotal)}</td>
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

        {/* Footer Notes & Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-start pt-4 border-t border-slate-300">
          <div className="space-y-4">
            <div className="space-y-2 text-xs text-slate-600">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Condiciones Comerciales</h4>
              <p className="whitespace-pre-line leading-relaxed">
                {presupuesto.opcionesEmision?.condicionesComerciales || presupuesto.condicionesPagoTexto || 'Pago: 50% anticipo al inicio y 50% contra entrega de obra finalizada.'}
              </p>

              <p className="text-[11px] text-slate-500 italic pt-2 border-t border-slate-200">
                * Los precios cotizados se congelan a la fecha de emisión durante los {presupuesto.validezDias} días de validez.
              </p>
            </div>

            {/* Technical Risk Clauses & Exclusions Section */}
            {(() => {
              const clausulas = Array.from(
                new Set(
                  presupuesto.items
                    .map((i) => i.clausulaExclusiones || i.clausulaTecnica)
                    .filter((c): c is string => Boolean(c && c.trim().length > 0))
                )
              );

              if (clausulas.length === 0) return null;

              return (
                <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    Condiciones Técnicas de Obra & Resguardo Constructivo
                  </h4>
                  <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
                    {clausulas.map((c, cIdx) => (
                      <p key={cIdx} className="italic text-[11px] leading-relaxed">
                        • {c}
                      </p>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Grand Total Box */}
          <div className="bg-slate-100 p-5 sm:p-6 rounded-2xl border border-slate-300 space-y-3 text-right">
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
                {((presupuesto.gastosGeneralesTotal || presupuesto.subtotalCostosIndirectos || 0) > 0) && (
                  <>
                    <div className="flex justify-between">
                      <span>2. Gastos Generales (GG):</span>
                      <span className="font-mono">{formatARS(presupuesto.gastosGeneralesTotal || presupuesto.subtotalCostosIndirectos)}</span>
                    </div>
                    {presupuesto.costosIndirectosAplicados && presupuesto.costosIndirectosAplicados.filter(c => c.montoCalculado > 0).map((ci, cIdx) => (
                      <div key={cIdx} className="flex justify-between text-[11px] text-slate-500 pl-2">
                        <span>• {ci.nombre}:</span>
                        <span className="font-mono">{formatARS(ci.montoCalculado)}</span>
                      </div>
                    ))}
                  </>
                )}
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
                    <div className="flex justify-between font-medium">
                      <span>IVA Discriminado (21%):</span>
                      <span className="font-mono">{formatARS(presupuesto.montoImpuestosTotal || 0)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between font-medium">
                    <span>Subtotal Trabajos:</span>
                    <span className="font-mono">{formatARS(presupuesto.totalARS)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center text-base sm:text-lg font-extrabold text-slate-900 pt-1">
              <span>TOTAL FINAL:</span>
              <span className="font-mono text-xl sm:text-2xl text-amber-600">
                {formatARS(presupuesto.totalARS)}
              </span>
            </div>

            {presupuesto.mostrarReferenciaMonedaExtranjera && presupuesto.cotizacionMonedaExtranjera && (
              <div className="text-xs text-slate-500 font-mono pt-1">
                Ref. {presupuesto.nombreMonedaExtranjera || 'USD'}:{' '}
                <strong className="text-slate-700">
                  u$s {(presupuesto.totalMonedaExtranjera || (presupuesto.totalARS / presupuesto.cotizacionMonedaExtranjera)).toFixed(2)}
                </strong>{' '}
                (T/C ${presupuesto.cotizacionMonedaExtranjera})
              </div>
            )}
          </div>
        </div>
      </div>

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
