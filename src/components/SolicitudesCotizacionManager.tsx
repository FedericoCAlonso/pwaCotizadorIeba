import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus,
  Send,
  Copy,
  DollarSign,
  Trash2,
  X,
  Save,
  Check
} from 'lucide-react';
import { db, softDelete } from '../db/database';
import { SolicitudCotizacion, SolicitudCotizacionItem, Oferta } from '../core/types';

export const SolicitudCotizacionManager: React.FC = () => {
  const solicitudes = (useLiveQuery(() => db.solicitudesCotizacion.reverse().toArray()) || []).filter(s => !s.deleted);
  const proveedores = (useLiveQuery(() => db.proveedores.toArray()) || []).filter(p => !p.deleted);
  const materiales = (useLiveQuery(() => db.materiales.toArray()) || []).filter(m => !m.deleted);
  const productos = (useLiveQuery(() => db.productos.toArray()) || []).filter(p => !p.deleted);

  const proveedoresMap = new Map(proveedores.map(p => [p.id, p]));
  const materialesMap = new Map(materiales.map(m => [m.id, m]));
  const productosMap = new Map(productos.map(pr => [pr.id, pr]));

  const [isCreating, setIsCreating] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudCotizacion | null>(null);
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);

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

    setSelectedSolicitud(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta solicitud de cotización?')) {
      await softDelete('solicitudesCotizacion', id);
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

      {/* Grid de Solicitudes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {solicitudes.map((req) => {
          const prov = proveedoresMap.get(req.proveedorId);
          return (
            <div key={req.id} className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 hover:bg-surface-container/60 transition-all flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-on-surface text-base">{prov?.razonSocial || prov?.nombre || 'Proveedor'}</h3>
                    <span className="text-[10px] font-mono text-on-surface-variant block mt-0.5">
                      {new Date(req.fechaCreacion).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize ${
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
                  >
                    {copiedTextId === req.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-primary" />}
                    <span>{copiedTextId === req.id ? 'Copiado' : 'Texto WA'}</span>
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
                            value={it.cantidad || 1}
                            onChange={(e) => {
                              const updated = [...items];
                              updated[idx].cantidad = parseFloat(e.target.value) || 1;
                              setItems(updated);
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
                    <span className="text-[11px] text-on-surface-variant">{prod ? `Marca: ${prod.marca}` : 'Genérico'}</span>
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Precio ARS"
                      value={it.precioRespuesta || ''}
                      onChange={(e) => {
                        const updated = [...responseItems];
                        updated[idx].precioRespuesta = parseFloat(e.target.value) || 0;
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
