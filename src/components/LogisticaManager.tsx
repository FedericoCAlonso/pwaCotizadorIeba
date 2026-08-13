import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Truck, CheckSquare, Square, ShoppingCart, Send, Mail, Copy } from 'lucide-react';
import { db } from '../db/database';
import { Proveedor, InsumoSnapshot } from '../core/types';
import { formatARS } from '../core/calculations';

interface ConsolidatedItem {
  key: string;
  materialId: string;
  materialNombre: string;
  productoId?: string;
  marcaModelo?: string;
  unidadVenta: string;
  cantidadTotal: number;
  proveedorId: string;
  proveedorNombre: string;
  precioUnitario: number;
  subtotal: number;
}

export const LogisticaManager: React.FC = () => {
  const presupuestos = useLiveQuery(() => db.presupuestos.toArray()) || [];
  const materiales = useLiveQuery(() => db.materiales.toArray()) || [];
  const productos = useLiveQuery(() => db.productos.toArray()) || [];
  const ofertas = useLiveQuery(() => db.ofertas.reverse().toArray()) || [];
  const proveedores = useLiveQuery(() => db.proveedores.toArray()) || [];
  const clientes = useLiveQuery(() => db.clientes.toArray()) || [];

  const clientesMap = new Map(clientes.map(c => [c.id, c]));
  const materialesMap = new Map(materiales.map(m => [m.id, m]));
  const productosMap = new Map(productos.map(p => [p.id, p]));
  const proveedoresMap = new Map(proveedores.map(p => [p.id, p]));

  // Selected Budget IDs
  const [selectedPresupuestoIds, setSelectedPresupuestoIds] = useState<string[]>([]);
  const [copiedSupplierId, setCopiedSupplierId] = useState<string | null>(null);

  // Toggle selection
  const togglePresupuesto = (id: string) => {
    setSelectedPresupuestoIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllApproved = () => {
    const approvedIds = presupuestos
      .filter(p => p.estado === 'aprobado' || p.estado === 'enviado')
      .map(p => p.id);
    setSelectedPresupuestoIds(approvedIds);
  };

  const clearSelection = () => {
    setSelectedPresupuestoIds([]);
  };

  // Helper para buscar la oferta vigente de un material/producto
  const getOfertaVigente = (materialId: string, productoId?: string) => {
    return ofertas.find(o => o.materialId === materialId && (!productoId || o.productoId === productoId));
  };

  // Consolidación de Insumos a Comprar
  const selectedPresupuestos = presupuestos.filter(p => selectedPresupuestoIds.includes(p.id));

  const consolidatedMap = new Map<string, ConsolidatedItem>();

  selectedPresupuestos.forEach(presupuesto => {
    if (!presupuesto.items) return;

    presupuesto.items.forEach(item => {
      const itemQuantity = item.cantidad || 1;
      const insumosList: InsumoSnapshot[] = item.insumosSnapshot || [];

      insumosList.forEach(ins => {
        const matId = ins.materialId || ins.insumoId || `ins-${ins.nombre}`;
        const mat = ins.materialId ? materialesMap.get(ins.materialId) : undefined;
        const prod = ins.productoId ? productosMap.get(ins.productoId) : undefined;
        const oferta = ins.materialId ? getOfertaVigente(ins.materialId, ins.productoId) : undefined;

        const cantidadNecesaria = (ins.cantidadTotal || 1) * itemQuantity;
        const provId = oferta?.proveedorId || proveedores[0]?.id || 'prov-general';
        const prov = proveedoresMap.get(provId);

        const key = `${matId}_${ins.productoId || 'none'}_${provId}`;

        if (consolidatedMap.has(key)) {
          const current = consolidatedMap.get(key)!;
          current.cantidadTotal += cantidadNecesaria;
          current.subtotal = current.cantidadTotal * current.precioUnitario;
        } else {
          const precioUnitario = oferta ? oferta.precio : ins.precioUnitarioCongelado || 0;
          consolidatedMap.set(key, {
            key,
            materialId: matId,
            materialNombre: ins.nombre || mat?.nombre || 'Material / Insumo',
            productoId: ins.productoId,
            marcaModelo: prod ? `${prod.marca} ${prod.modelo || ''}`.trim() : ins.marca || 'Genérico / Sin Marca',
            unidadVenta: ins.unidad || mat?.unidadVenta || 'u',
            cantidadTotal: cantidadNecesaria,
            proveedorId: provId,
            proveedorNombre: prov?.razonSocial || prov?.nombre || 'Proveedor por Defecto',
            precioUnitario,
            subtotal: cantidadNecesaria * precioUnitario
          });
        }
      });
    });
  });

  const consolidatedItems = Array.from(consolidatedMap.values());

  // Agrupación por Proveedor
  const supplierGroupsMap = new Map<string, ConsolidatedItem[]>();
  consolidatedItems.forEach(item => {
    const list = supplierGroupsMap.get(item.proveedorId) || [];
    list.push(item);
    supplierGroupsMap.set(item.proveedorId, list);
  });

  const supplierGroups = Array.from(supplierGroupsMap.entries()).map(([provId, items]) => {
    const prov = proveedoresMap.get(provId);
    const totalGroup = items.reduce((acc, i) => acc + i.subtotal, 0);
    return {
      provId,
      prov,
      items,
      totalGroup
    };
  });

  // Helper para formatear texto del pedido
  const buildOrderText = (provName: string, items: ConsolidatedItem[], totalGroup: number) => {
    const headerText = `*PEDIDO DE MATERIALES - IEBA COTIZADOR*\nProveedor: ${provName}\nFecha: ${new Date().toLocaleDateString('es-AR')}\n\n*LISTADO DE MATERIALES:*`;
    const itemsText = items.map((it, idx) =>
      `${idx + 1}. ${it.materialNombre} (${it.marcaModelo}) -> *${Math.ceil(it.cantidadTotal)} ${it.unidadVenta}* (Ref: ${formatARS(it.precioUnitario)})`
    ).join('\n');
    const footerText = `\n\n*ESTIMADO TOTAL:* ${formatARS(totalGroup)}\n\nPor favor confirmar disponibilidad y cotización final. ¡Muchas gracias!`;
    return `${headerText}\n${itemsText}${footerText}`;
  };

  const handleCopyOrder = (provId: string, provName: string, items: ConsolidatedItem[], totalGroup: number) => {
    const text = buildOrderText(provName, items, totalGroup);
    navigator.clipboard.writeText(text);
    setCopiedSupplierId(provId);
    setTimeout(() => setCopiedSupplierId(null), 2500);
  };

  const handleSendWhatsApp = (prov: Proveedor | undefined, items: ConsolidatedItem[], totalGroup: number) => {
    const provName = prov?.razonSocial || prov?.nombre || 'Proveedor';
    const text = buildOrderText(provName, items, totalGroup);
    const phone = prov?.telefono || (prov?.contactos && prov.contactos[0]?.canales?.find(c => c.tipo === 'telefono')?.valor);
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleSendEmail = (prov: Proveedor | undefined, items: ConsolidatedItem[], totalGroup: number) => {
    const provName = prov?.razonSocial || prov?.nombre || 'Proveedor';
    const text = buildOrderText(provName, items, totalGroup);
    const email = prov?.email || (prov?.contactos && prov.contactos[0]?.canales?.find(c => c.tipo === 'email')?.valor);
    const subject = encodeURIComponent(`Solicitud de Pedido de Materiales - IEBA`);
    const body = encodeURIComponent(text);
    const url = email ? `mailto:${email}?subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" /> Módulo de Logística & Lista de Compras Agregada
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Consolida las cantidades de insumos de una o varias obras y genera pedidos agrupados por proveedor.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Panel Izquierdo: Selección de Presupuestos */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <h3 className="font-semibold text-sm text-on-surface flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-primary" /> Obras & Presupuestos ({presupuestos.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllApproved}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Seleccionar Aprobados / Enviados
                </button>
                <span className="text-outline-variant">|</span>
                <button
                  onClick={clearSelection}
                  className="text-[11px] font-medium text-on-surface-variant hover:underline"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {presupuestos.map(p => {
                const isSelected = selectedPresupuestoIds.includes(p.id);
                const cli = clientesMap.get(p.clienteId);
                return (
                  <div
                    key={p.id}
                    onClick={() => togglePresupuesto(p.id)}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-on-surface shadow-sm'
                        : 'bg-surface-container border-outline-variant/20 hover:bg-surface-container-highest text-on-surface-variant'
                    }`}
                  >
                    <div className="pt-0.5">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4 text-on-surface-variant/50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-on-surface truncate">
                          {p.numero} - {cli?.nombre || 'Cliente General'}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0 ${
                          p.estado === 'aprobado' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                          p.estado === 'enviado' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                          'bg-surface-container-highest text-on-surface-variant'
                        }`}>
                          {p.estado}
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                        Emisión: {p.fechaEmision ? new Date(p.fechaEmision).toLocaleDateString('es-AR') : 'S/D'}
                      </p>
                      <div className="flex items-center justify-between text-[11px] font-mono mt-1 pt-1 border-t border-outline-variant/10">
                        <span>{p.items?.length || 0} partidas</span>
                        <span className="font-bold text-primary">{formatARS(p.totalARS || 0)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {presupuestos.length === 0 && (
                <p className="text-xs text-on-surface-variant italic py-6 text-center">
                  No hay presupuestos creados. Crea una cotización para generar listas de compras acumuladas.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Panel Derecho: Lista Agregada de Compras por Proveedor */}
        <div className="lg:col-span-7 space-y-4">
          {selectedPresupuestos.length === 0 ? (
            <div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-12 text-center text-on-surface-variant space-y-3 shadow-sm">
              <ShoppingCart className="w-10 h-10 text-on-surface-variant/40 mx-auto" />
              <h3 className="font-semibold text-base text-on-surface">No hay obras seleccionadas</h3>
              <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                Selecciona una o más obras del panel izquierdo para consolidar las cantidades totales de cables, térmicas, caños e insumos a pedir.
              </p>
              <button
                onClick={selectAllApproved}
                className="px-4 py-2 bg-primary text-on-primary font-semibold text-xs rounded-full shadow-sm"
              >
                Cargar Presupuestos Aprobados / Enviados
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Resumen Superior */}
              <div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-4 flex flex-wrap justify-between items-center gap-3 shadow-sm">
                <div>
                  <h3 className="font-semibold text-sm text-on-surface">
                    Consolidado de {selectedPresupuestos.length} obra{selectedPresupuestos.length !== 1 ? 's' : ''}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    {consolidatedItems.length} insumos totales agrupados en {supplierGroups.length} proveedores.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-on-surface-variant block uppercase font-medium">Estimado Total Materiales</span>
                  <span className="text-base font-bold font-mono text-primary">
                    {formatARS(consolidatedItems.reduce((acc, i) => acc + i.subtotal, 0))}
                  </span>
                </div>
              </div>

              {/* Grupos por Proveedor */}
              {supplierGroups.map(({ provId, prov, items, totalGroup }) => {
                const provName = prov?.razonSocial || prov?.nombre || 'Proveedor por Defecto';
                const isCopied = copiedSupplierId === provId;

                return (
                  <div key={provId} className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 space-y-4 shadow-sm">
                    {/* Header Proveedor */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-outline-variant/20 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-primary shrink-0" />
                          <h4 className="font-semibold text-base text-on-surface">{provName}</h4>
                        </div>
                        {prov?.contacto && (
                          <span className="text-xs text-on-surface-variant block mt-0.5">
                            Contacto: {prov.contacto} {prov.telefono ? `(${prov.telefono})` : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleCopyOrder(provId, provName, items, totalGroup)}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-3 py-1.5 bg-surface-container-highest hover:bg-surface-variant text-on-surface text-xs font-medium rounded-full transition-colors border border-outline-variant/20"
                          title="Copiar pedido en texto plano"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{isCopied ? '¡Copiado!' : 'Copiar Texto'}</span>
                        </button>
                        <button
                          onClick={() => handleSendWhatsApp(prov, items, totalGroup)}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-full shadow-sm transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </button>
                        {prov?.email && (
                          <button
                            onClick={() => handleSendEmail(prov, items, totalGroup)}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-on-primary text-xs font-semibold rounded-full shadow-sm transition-colors"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>Email</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tabla de Insumos */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-container-high border-b border-outline-variant/30 text-on-surface-variant font-semibold">
                          <tr>
                            <th className="p-2.5">Material / Insumo</th>
                            <th className="p-2.5">Marca / Modelo</th>
                            <th className="p-2.5 text-center">Cantidad Total</th>
                            <th className="p-2.5 text-right">Precio Ref.</th>
                            <th className="p-2.5 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                          {items.map(it => (
                            <tr key={it.key} className="hover:bg-surface-container/50">
                              <td className="p-2.5 font-medium text-on-surface">{it.materialNombre}</td>
                              <td className="p-2.5 text-on-surface-variant">{it.marcaModelo}</td>
                              <td className="p-2.5 text-center font-bold font-mono text-primary bg-primary/5 rounded-lg">
                                {Math.ceil(it.cantidadTotal)} {it.unidadVenta}
                              </td>
                              <td className="p-2.5 text-right font-mono text-on-surface-variant">{formatARS(it.precioUnitario)}</td>
                              <td className="p-2.5 text-right font-mono font-bold text-on-surface">{formatARS(it.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer Grupo */}
                    <div className="pt-2 flex justify-between items-center text-xs font-mono border-t border-outline-variant/10">
                      <span className="text-on-surface-variant">{items.length} tipo(s) de materiales en la orden</span>
                      <div className="flex items-center gap-2">
                        <span className="text-on-surface-variant font-sans">Total Proveedor:</span>
                        <span className="text-sm font-bold text-primary">{formatARS(totalGroup)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
