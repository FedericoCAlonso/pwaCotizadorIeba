import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus,
  Send,
  Copy,
  DollarSign,
  Trash2,
  X,
  Save,
  Check,
  FileSpreadsheet,
  Search,
  RotateCcw
} from 'lucide-react';
import { db, softDelete } from '../db/database';
import { SolicitudCotizacion, SolicitudCotizacionItem, Oferta, Contacto } from '../core/types';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';

export const SolicitudCotizacionManager: React.FC = () => {
  const { toast } = useToast();
  const confirm = useConfirm();
  const solicitudes = (useLiveQuery(() => db.solicitudesCotizacion.reverse().toArray()) || []).filter(s => !s.deleted);
  const rawContactos = useLiveQuery(() => db.contactos.toArray()) || [];
  const rawProveedores = useLiveQuery(() => db.proveedores.toArray()) || [];
  const proveedores: Contacto[] = useMemo(() => {
    const fromContactos = rawContactos.filter(c => !c.deleted && (c.roles?.includes('proveedor') || !c.roles?.length));
    if (fromContactos.length > 0) return fromContactos;
    return rawProveedores.filter(p => !p.deleted);
  }, [rawContactos, rawProveedores]);
  const materiales = (useLiveQuery(() => db.materiales.toArray()) || []).filter(m => !m.deleted);
  const productos = (useLiveQuery(() => db.productos.toArray()) || []).filter(p => !p.deleted);

  const proveedoresMap = new Map(proveedores.map(p => [p.id, p]));
  const materialesMap = new Map(materiales.map(m => [m.id, m]));
  const productosMap = new Map(productos.map(pr => [pr.id, pr]));

  const [isCreating, setIsCreating] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudCotizacion | null>(null);
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);

  // Search and status filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEstado, setSelectedEstado] = useState<string>('todas');

  const filteredSolicitudes = useMemo(() => {
    return solicitudes.filter((req) => {
      const prov = proveedoresMap.get(req.proveedorId);
      const provName = (prov?.razonSocial || prov?.nombre || '').toLowerCase();
      const q = searchTerm.toLowerCase();

      const matchSearch =
        !q ||
        provName.includes(q) ||
        (req.notas && req.notas.toLowerCase().includes(q)) ||
        req.items.some((it) => {
          const mat = materialesMap.get(it.materialId);
          return mat?.nombre.toLowerCase().includes(q);
        });

      const matchEstado = selectedEstado === 'todas' || req.estado === selectedEstado;

      return matchSearch && matchEstado;
    });
  }, [solicitudes, searchTerm, selectedEstado, proveedoresMap, materialesMap]);

  const countsByEstado = useMemo(() => {
    const counts: Record<string, number> = {
      todas: solicitudes.length,
      borrador: 0,
      enviada: 0,
      respondida: 0
    };
    solicitudes.forEach((s) => {
      if (counts[s.estado] !== undefined) {
        counts[s.estado]++;
      }
    });
    return counts;
  }, [solicitudes]);

  // Form para crear nueva solicitud
  const [proveedorId, setProveedorId] = useState('');
  const [items, setItems] = useState<Partial<SolicitudCotizacionItem>[]>([]);
  const [notas, setNotas] = useState('');

  const handleOpenCreate = () => {
    setProveedorId(proveedores[0]?.id || '');
    setItems([{ id: crypto.randomUUID(), materialId: materiales[0]?.id || '', cantidad: 10 }]);
    setNotas('');
    setIsCreating(true);
  };

  useEffect(() => {
    const handleNew = () => handleOpenCreate();
    window.addEventListener('app:shortcut-new', handleNew);
    return () => window.removeEventListener('app:shortcut-new', handleNew);
  }, [proveedores, materiales]);

  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      { id: crypto.randomUUID(), materialId: materiales[0]?.id || '', cantidad: 1 }
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorId || items.length === 0) return;

    const newReq: SolicitudCotizacion = {
      id: `rfq-${crypto.randomUUID()}`,
      proveedorId,
      estado: 'borrador',
      fechaCreacion: new Date().toISOString(),
      items: items.map(it => ({
        id: it.id || crypto.randomUUID(),
        materialId: it.materialId || '',
        productoId: it.productoId,
        cantidad: it.cantidad || 1
      })),
      notas
    };

    await db.solicitudesCotizacion.add(newReq);
    setIsCreating(false);
  };

  const handleGenerateSummaryText = (req: SolicitudCotizacion): string => {
    const prov = proveedoresMap.get(req.proveedorId);
    let text = `📋 *SOLICITUD DE COTIZACIÓN — IEBA*\n`;
    text += `Proveedor: ${prov?.razonSocial || prov?.nombre || 'General'}\n`;
    text += `Fecha: ${new Date(req.fechaCreacion).toLocaleDateString('es-AR')}\n\n`;
    text += `Por favor cotizar los siguientes materiales:\n`;

    req.items.forEach((it, idx) => {
      const mat = materialesMap.get(it.materialId);
      const prod = it.productoId ? productosMap.get(it.productoId) : undefined;
      const cantStr = it.cantidad ? `${it.cantidad} ${mat?.unidadVenta || 'u'}` : '';
      const marcaStr = prod ? ` (Marca: ${prod.marca}${prod.modelo ? ' ' + prod.modelo : ''})` : '';
      text += `${idx + 1}. ${mat?.nombre || 'Material'}${marcaStr} — Cant: ${cantStr}\n`;
    });

    if (req.notas) {
      text += `\nNotas adicionales: ${req.notas}\n`;
    }

    text += `\n¡Gracias!`;
    return text;
  };

  const handleCopyText = (req: SolicitudCotizacion) => {
    const text = handleGenerateSummaryText(req);
    navigator.clipboard.writeText(text);
    setCopiedTextId(req.id);
    setTimeout(() => setCopiedTextId(null), 2500);
  };

  const handleExportRFQExcel = async (req: SolicitudCotizacion) => {
    try {
      const prov = proveedoresMap.get(req.proveedorId);
      const provNombre = prov?.razonSocial || prov?.nombre || 'General';
      const fechaStr = new Date(req.fechaCreacion).toLocaleDateString('es-AR');

      const ExcelModule = await import('exceljs');
      const ExcelJS = ExcelModule.default || ExcelModule;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Cotizador IEBA';
      const ws = workbook.addWorksheet('Solicitud de Cotización', {
        views: [{ showGridLines: true }]
      });

      // Título y datos del proveedor
      ws.addRow(['SOLICITUD DE COTIZACIÓN DE MATERIALES — IEBA']);
      ws.addRow([`Proveedor: ${provNombre}`]);
      ws.addRow([`Fecha: ${fechaStr} | Estado: ${req.estado.toUpperCase()}`]);
      if (prov?.telefono || prov?.email) {
        ws.addRow([`Contacto: ${[prov?.telefono, prov?.email].filter(Boolean).join(' | ')}`]);
      }
      if (req.notas) {
        ws.addRow([`Observaciones: ${req.notas}`]);
      }
      ws.addRow([]); // Fila en blanco

      // Encabezados de la tabla
      const headerRowIndex = ws.rowCount + 1;
      ws.addRow([
        '#',
        'Material / Descripción Técnica',
        'Marca Solicitada / Modelo',
        'Cantidad',
        'Unidad',
        'Marca Ofrecida',
        'Precio Unitario (sin IVA)',
        'Subtotal (ARS)',
        'Plazo / Disponibilidad'
      ]);

      // Filas de materiales
      req.items.forEach((it, idx) => {
        const mat = materialesMap.get(it.materialId);
        const prod = it.productoId ? productosMap.get(it.productoId) : undefined;
        const marcaSolicitada = prod ? `${prod.marca}${prod.modelo ? ' ' + prod.modelo : ''}` : 'Cualquiera / Indistinta';
        const rowNum = ws.rowCount + 1;

        ws.addRow([
          idx + 1,
          mat?.nombre || 'Material',
          marcaSolicitada,
          it.cantidad || 1,
          mat?.unidadVenta || 'u',
          '',
          it.precioRespuesta || '',
          { formula: `D${rowNum}*G${rowNum}` },
          ''
        ]);
      });

      // Ancho de columnas
      ws.getColumn(1).width = 6;
      ws.getColumn(2).width = 45;
      ws.getColumn(3).width = 25;
      ws.getColumn(4).width = 12;
      ws.getColumn(5).width = 10;
      ws.getColumn(6).width = 24;
      ws.getColumn(7).width = 24;
      ws.getColumn(8).width = 20;
      ws.getColumn(9).width = 22;

      // Estilos
      const titleRow = ws.getRow(1);
      titleRow.font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };

      const headerRow = ws.getRow(headerRowIndex);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const sanitizedProv = provNombre.replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Solicitud_Cotizacion_${sanitizedProv}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Planilla XLSX para ${provNombre} descargada.`);
    } catch (err) {
      console.error('Error al exportar RFQ a Excel:', err);
      toast.error('Ocurrió un error al generar la planilla Excel.');
    }
  };

  const handleMarkSent = async (req: SolicitudCotizacion) => {
    await db.solicitudesCotizacion.update(req.id, {
      estado: 'enviada',
      fechaEnvio: new Date().toISOString()
    });
  };

  const handleSaveResponsePrices = async (req: SolicitudCotizacion, responseItems: SolicitudCotizacionItem[]) => {
    const now = new Date().toISOString();
    const newOfertas: Oferta[] = [];

    const updatedItems = responseItems.map(it => {
      if (it.precioRespuesta && it.precioRespuesta > 0) {
        const ofertaId = `of-rfq-${crypto.randomUUID()}`;
        newOfertas.push({
          id: ofertaId,
          materialId: it.materialId,
          productoId: it.productoId,
          proveedorId: req.proveedorId,
          precio: it.precioRespuesta,
          fecha: now,
          fuente: 'cotizacion_directa',
          solicitudCotizacionId: req.id
        });
        return { ...it, ofertaGeneradaId: ofertaId };
      }
      return it;
    });

    if (newOfertas.length > 0) {
      await db.ofertas.bulkAdd(newOfertas);
    }

    await db.solicitudesCotizacion.update(req.id, {
      estado: 'respondida',
      items: updatedItems
    });

    toast.success(`Precios guardados. Se crearon ${newOfertas.length} nuevas ofertas.`);
    setSelectedSolicitud(null);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Eliminar Solicitud',
      message: '¿Estás seguro de eliminar esta solicitud de cotización?',
      confirmText: 'Eliminar',
      isDestructive: true
    });
    if (ok) {
      await softDelete('solicitudesCotizacion', id);
      toast.success('Solicitud eliminada');
    }
  };

  const inputCls = "w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-on-surface-variant/70 transition-shadow";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />Solicitudes de Cotización (RFQ)
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">Armado de pedidos, envío rápido a proveedores y carga de respuestas.</p>
        </div>
        <button onClick={handleOpenCreate} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm">
          <Plus className="w-4 h-4" /><span>Nueva Solicitud</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-surface-container-low p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-outline-variant/20 space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por proveedor o material..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-full pl-9 pr-9 py-2.5 text-xs sm:text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all min-h-[40px]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-variant transition-colors"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Chips with mobile scroll fade and count badges */}
          <div className="relative w-full md:w-auto overflow-hidden">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-1 touch-pan-x overscroll-contain pr-6">
              {[
                { key: 'todas', label: 'Todas' },
                { key: 'borrador', label: 'Borrador' },
                { key: 'enviada', label: 'Enviada' },
                { key: 'respondida', label: 'Respondida' }
              ].map((st) => {
                const isSelected = selectedEstado === st.key;
                const count = countsByEstado[st.key] ?? 0;
                return (
                  <button
                    type="button"
                    key={st.key}
                    onClick={() => setSelectedEstado(st.key)}
                    className={`px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap border min-h-[34px] flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      isSelected
                        ? 'bg-secondary-container text-on-secondary-container border-transparent shadow-xs'
                        : 'bg-surface-variant/70 text-on-surface-variant hover:bg-surface-variant border-outline-variant/30'
                    }`}
                  >
                    <span>{st.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected
                          ? 'bg-on-secondary-container/20 text-on-secondary-container'
                          : 'bg-surface-container-highest text-on-surface-variant'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Mobile edge fade */}
            <div className="md:hidden pointer-events-none absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-surface-container-low to-transparent" />
          </div>
        </div>

        {/* Results & Active Filters Bar */}
        {(searchTerm || selectedEstado !== 'todas') && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/15 text-xs text-on-surface-variant flex-wrap animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="font-bold text-on-surface">
                {filteredSolicitudes.length} {filteredSolicitudes.length === 1 ? 'solicitud' : 'solicitudes'}
              </span>
              <span className="text-outline-variant">•</span>
              {selectedEstado !== 'todas' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-medium text-[11px] capitalize">
                  {selectedEstado}
                  <button
                    type="button"
                    onClick={() => setSelectedEstado('todas')}
                    className="hover:opacity-75 p-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-mono text-[11px] max-w-[150px] truncate">
                  "{searchTerm}"
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="hover:opacity-75 p-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedEstado('todas');
              }}
              className="text-primary hover:text-primary-hover font-semibold text-xs shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-primary/10 transition-colors ml-auto cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpiar filtros</span>
            </button>
          </div>
        )}
      </div>

      {/* Grid de Solicitudes */}
      {filteredSolicitudes.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-low border border-dashed border-outline-variant/30 rounded-3xl p-6 space-y-3">
          <p className="text-sm font-semibold text-on-surface">No se encontraron solicitudes de cotización</p>
          <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
            {searchTerm || selectedEstado !== 'todas'
              ? 'Prueba ajustando los filtros o la búsqueda.'
              : 'Arma tu primera solicitud de cotización para enviar a proveedores.'}
          </p>
          {(searchTerm || selectedEstado !== 'todas') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedEstado('todas');
              }}
              className="px-4 py-2 bg-surface-container-highest hover:bg-surface-variant text-on-surface rounded-full text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer filtros</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSolicitudes.map((req) => {
            const prov = proveedoresMap.get(req.proveedorId);
            return (
              <div key={req.id} className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 hover:bg-surface-container/60 transition-all flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-on-surface text-base">{prov?.razonSocial || prov?.nombre || 'Proveedor'}</h3>
                      <span className="text-xs font-mono text-on-surface-variant block mt-0.5">
                        {new Date(req.fechaCreacion).toLocaleDateString('es-AR')}
                      </span>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                      req.estado === 'respondida' ? 'bg-emerald-500/10 text-emerald-500' :
                      req.estado === 'enviada' ? 'bg-primary/10 text-primary' : 'bg-surface-container-highest text-on-surface-variant'
                    }`}>
                      {req.estado}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="mt-4 space-y-2 border-t border-outline-variant/20 pt-3 text-xs text-on-surface-variant">
                    {req.items.map((it, idx) => {
                      const mat = materialesMap.get(it.materialId);
                      const prod = it.productoId ? productosMap.get(it.productoId) : undefined;
                      return (
                        <div key={idx} className="flex items-center justify-between bg-surface-container-highest/40 px-3 py-1.5 rounded-xl">
                          <span className="truncate font-medium text-on-surface">{mat?.nombre || 'Material'} {prod ? `(${prod.marca})` : ''}</span>
                          <span className="font-mono text-primary font-bold shrink-0 ml-2">{it.cantidad} {mat?.unidadVenta || 'u'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="mt-4 pt-3 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopyText(req)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-surface-container-highest hover:bg-surface-variant text-on-surface rounded-xl transition-colors"
                      title="Copiar texto resumen formateado para WhatsApp"
                    >
                      {copiedTextId === req.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-primary" />}
                      <span>{copiedTextId === req.id ? 'Copiado' : 'Texto WA'}</span>
                    </button>
                    <button
                      onClick={() => handleExportRFQExcel(req)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-surface-container-highest hover:bg-surface-variant text-on-surface rounded-xl transition-colors"
                      title="Exportar planilla XLSX de cotización para enviar al proveedor"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Excel</span>
                    </button>
                    {req.estado === 'borrador' && (
                      <button
                        onClick={() => handleMarkSent(req)}
                        className="px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-colors"
                      >
                        Marcar Enviada
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedSolicitud(req)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-xl transition-colors"
                    >
                      <DollarSign className="w-3.5 h-3.5" /> Cargar Precios
                    </button>
                    <button onClick={() => handleDelete(req.id)} className="p-1.5 text-on-surface-variant hover:text-error rounded-full">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Crear Nueva Solicitud */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-lg shadow-2xl p-6 text-on-surface max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-semibold text-on-surface">Armar Solicitud de Cotización</h3>
              <button onClick={() => setIsCreating(false)} className="text-on-surface-variant hover:text-on-surface p-1"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveCreate} className="space-y-4">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Proveedor Destino</label>
                <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className={inputCls} required>
                  {proveedores.map(p => (
                    <option key={p.id} value={p.id}>{p.razonSocial || p.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 border-t border-outline-variant/30 pt-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-primary uppercase">Materiales a Cotizar</h4>
                  <button type="button" onClick={handleAddItemRow} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Agregar Ítem
                  </button>
                </div>

                {items.map((it, idx) => {
                  const prodsMat = productos.filter(pr => pr.materialId === it.materialId);
                  return (
                    <div key={it.id || idx} className="p-3 bg-surface-container-highest/40 border border-outline-variant/30 rounded-2xl space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={it.materialId || ''}
                          onChange={(e) => {
                            const updated = [...items];
                            updated[idx].materialId = e.target.value;
                            updated[idx].productoId = undefined;
                            setItems(updated);
                          }}
                          className={inputCls}
                        >
                          {materiales.map(m => (
                            <option key={m.id} value={m.id}>{m.nombre}</option>
                          ))}
                        </select>

                        <select
                          value={it.productoId || ''}
                          onChange={(e) => {
                            const updated = [...items];
                            updated[idx].productoId = e.target.value || undefined;
                            setItems(updated);
                          }}
                          className={inputCls}
                        >
                          <option value="">Marca Genérica (Cualquiera)</option>
                          {prodsMat.map(pr => (
                            <option key={pr.id} value={pr.id}>{pr.marca} {pr.modelo}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-on-surface-variant">Cantidad:</span>
                          <input
                            type="number"
                            step="0.1"
                            value={it.cantidad ?? ''}
                            onChange={(e) => {
                              const updated = [...items];
                              updated[idx].cantidad = e.target.value === '' ? ('' as any) : parseFloat(e.target.value) || 0;
                              setItems(updated);
                            }}
                            onBlur={() => {
                              if (!it.cantidad || it.cantidad <= 0) {
                                const updated = [...items];
                                updated[idx].cantidad = 1;
                                setItems(updated);
                              }
                            }}
                            className={`${inputCls} w-24 font-mono text-center py-1`}
                          />
                        </div>
                        <button type="button" onClick={() => handleRemoveItemRow(idx)} className="text-error hover:bg-error/10 p-1.5 rounded-xl">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Notas Adicionales</label>
                <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)} className={inputCls} placeholder="Ej: Plazo de entrega urgente." />
              </div>

              <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
                <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant">Cancelar</button>
                <button type="submit" className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-sm"><Save className="w-3.5 h-3.5" />Guardar Solicitud</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cargar Precios de Respuesta */}
      {selectedSolicitud && (
        <ResponsePriceModal
          solicitud={selectedSolicitud}
          materialesMap={materialesMap}
          productosMap={productosMap}
          onClose={() => setSelectedSolicitud(null)}
          onSave={handleSaveResponsePrices}
        />
      )}
    </div>
  );
};

interface ResponsePriceModalProps {
  solicitud: SolicitudCotizacion;
  materialesMap: Map<string, any>;
  productosMap: Map<string, any>;
  onClose: () => void;
  onSave: (req: SolicitudCotizacion, items: SolicitudCotizacionItem[]) => void;
}

const ResponsePriceModal: React.FC<ResponsePriceModalProps> = ({
  solicitud,
  materialesMap,
  productosMap,
  onClose,
  onSave
}) => {
  const [responseItems, setResponseItems] = useState<SolicitudCotizacionItem[]>([...solicitud.items]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(solicitud, responseItems);
  };

  const inputCls = "w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-on-surface-variant/70 transition-shadow";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-md shadow-2xl p-6 text-on-surface">
        <div className="flex items-center justify-between mb-4 border-b border-outline-variant/30 pb-3">
          <h3 className="text-base font-semibold text-on-surface">Cargar Precios Cotizados</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface p-1"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-on-surface-variant">
            Ingresá los precios finales cotizados por el proveedor. Cada precio generará automáticamente una <strong className="text-primary">Oferta de Cotización Directa</strong>.
          </p>

          <div className="space-y-3">
            {responseItems.map((it, idx) => {
              const mat = materialesMap.get(it.materialId);
              const prod = it.productoId ? productosMap.get(it.productoId) : undefined;
              return (
                <div key={it.id || idx} className="p-3 bg-surface-container-highest/40 border border-outline-variant/30 rounded-2xl flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-semibold text-on-surface">{mat?.nombre || 'Material'}</h4>
                    <span className="text-xs text-on-surface-variant">{prod ? `Marca: ${prod.marca}` : 'Genérico'}</span>
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Precio ARS"
                      value={it.precioRespuesta ?? ''}
                      onChange={(e) => {
                        const updated = [...responseItems];
                        updated[idx].precioRespuesta = e.target.value === '' ? ('' as any) : parseFloat(e.target.value) || 0;
                        setResponseItems(updated);
                      }}
                      className={`${inputCls} font-mono text-primary font-bold text-right py-1`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant">Cancelar</button>
            <button type="submit" className="flex items-center gap-2 px-5 py-2 bg-emerald-500 text-white font-semibold rounded-full text-sm shadow-sm"><Save className="w-3.5 h-3.5" />Confirmar Precios</button>
          </div>
        </form>
      </div>
    </div>
  );
};
