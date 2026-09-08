import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  FileText,
  Plus,
  Search,
  Eye,
  Edit2,
  Copy,
  Trash2,
  User,
  FileSpreadsheet,
  Download,
  Share2,
  X,
  MessageSquare,
  MapPin,
  RotateCcw
} from 'lucide-react';
import { db, softDelete } from '../db/database';
import { Presupuesto, Cliente, AppConfig } from '../core/types';
import { formatARS, formatUSD } from '../core/calculations';
import { EstadoBadge } from './EstadoBadge';
import { exportPresupuestoToXLSX } from '../core/exportUtils';
import { exportPresupuestoToPDF } from '../core/pdfExportUtils';
import { WhatsAppShareModal } from './presupuesto/WhatsAppShareModal';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';

interface PresupuestosListProps {
  onNew: () => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
}

export const PresupuestosList: React.FC<PresupuestosListProps> = ({
  onNew,
  onSelect,
  onEdit
}) => {
  const { toast } = useToast();
  const confirm = useConfirm();
  const presupuestos = (useLiveQuery(() => db.presupuestos.reverse().toArray()) || []).filter((p) => !p.deleted);
  const rawContactos = useLiveQuery(() => db.contactos.toArray()) || [];
  const rawClientes = useLiveQuery(() => db.clientes.toArray()) || [];
  const config = useLiveQuery(() => db.config.toCollection().first());
  const clientesMap = useMemo(() => {
    const map = new Map<string, any>();
    rawClientes.filter((c) => !c.deleted).forEach((c) => map.set(c.id, c));
    rawContactos.filter((c) => !c.deleted).forEach((c) => map.set(c.id, c));
    return map;
  }, [rawContactos, rawClientes]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEstado, setSelectedEstado] = useState<string>('todos');
  const [presupuestoForWhatsApp, setPresupuestoForWhatsApp] = useState<Presupuesto | null>(null);

  const filteredPresupuestos = presupuestos.filter((p) => {
    const cliente = clientesMap.get(p.clienteId);
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      p.numero.toLowerCase().includes(q) ||
      (p.direccionObra && p.direccionObra.toLowerCase().includes(q)) ||
      (cliente && (
        (cliente.nombre && cliente.nombre.toLowerCase().includes(q)) ||
        (cliente.razonSocial && cliente.razonSocial.toLowerCase().includes(q)) ||
        (cliente.direccion && cliente.direccion.toLowerCase().includes(q)) ||
        (cliente.localidad && cliente.localidad.toLowerCase().includes(q))
      ));
    const matchesEstado = selectedEstado === 'todos' || p.estado === selectedEstado;
    return matchesSearch && matchesEstado;
  });

  const countsByEstado = useMemo(() => {
    const counts: Record<string, number> = {
      todos: presupuestos.length,
      borrador: 0,
      enviado: 0,
      aprobado: 0,
      rechazado: 0,
      vencido: 0
    };
    presupuestos.forEach((p) => {
      if (counts[p.estado] !== undefined) {
        counts[p.estado]++;
      }
    });
    return counts;
  }, [presupuestos]);

  const handleDuplicate = async (p: Presupuesto) => {
    const year = new Date().getFullYear();
    const configList = await db.config.toArray();
    const config = configList[0];
    const seq = config?.siguienteNumeroCorrelativo || 1001;

    const newNumero = `${config?.prefijoPresupuesto || 'IEBA'}-${year}-${seq.toString().padStart(4, '0')}`;
    if (config) {
      await db.config.update(config.id, { siguienteNumeroCorrelativo: seq + 1 });
    }

    const now = new Date().toISOString();
    const duplicated: Presupuesto = {
      ...p,
      id: `pres-${crypto.randomUUID()}`,
      numero: newNumero,
      fechaEmision: now,
      estado: 'borrador',
      fechaModificacion: now,
      createdAt: now,
      updatedAt: now,
      deleted: false
    };

    await db.presupuestos.add(duplicated);
    toast.success('Presupuesto duplicado correctamente');
    onSelect(duplicated.id);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Eliminar Presupuesto',
      message: '¿Estás seguro de eliminar este presupuesto?',
      confirmText: 'Eliminar',
      isDestructive: true
    });
    if (ok) {
      await softDelete('presupuestos', id);
      toast.success('Presupuesto eliminado');
    }
  };

  return (
    <div className="space-y-4 relative pb-24 lg:pb-6 max-w-7xl mx-auto">
      {/* Search & Filter Bar */}
      <div className="bg-surface-container-low p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-outline-variant/20 space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por cliente, obra o número..."
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

          {/* Status Filter Chips with visual edge fade and count badges on mobile */}
          <div className="relative w-full md:w-auto overflow-hidden">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden w-full md:w-auto pb-1 md:pb-0 touch-pan-x overscroll-contain pr-6">
              {[
                { key: 'todos', label: 'Todos' },
                { key: 'borrador', label: 'Borrador' },
                { key: 'enviado', label: 'Enviado' },
                { key: 'aprobado', label: 'Aprobado' },
                { key: 'rechazado', label: 'Rechazado' },
                { key: 'vencido', label: 'Vencido' }
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
            {/* Soft edge fade hint on mobile */}
            <div className="md:hidden pointer-events-none absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-surface-container-low to-transparent" />
          </div>

          {/* Desktop "+ Nueva Cotización" Button */}
          <button
            type="button"
            onClick={onNew}
            className="hidden lg:flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-xs transition-all shadow-xs shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Cotización</span>
          </button>
        </div>

        {/* Results & Active Filters Feedback Bar */}
        {(searchTerm || selectedEstado !== 'todos') && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/15 text-xs text-on-surface-variant flex-wrap animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="font-bold text-on-surface">
                {filteredPresupuestos.length} {filteredPresupuestos.length === 1 ? 'cotización' : 'cotizaciones'}
              </span>
              <span className="text-outline-variant">•</span>
              {selectedEstado !== 'todos' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-medium text-[11px] capitalize">
                  {selectedEstado}
                  <button
                    type="button"
                    onClick={() => setSelectedEstado('todos')}
                    className="hover:opacity-75 p-0.5 cursor-pointer"
                    aria-label="Quitar filtro de estado"
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
                    aria-label="Quitar término de búsqueda"
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
                setSelectedEstado('todos');
              }}
              className="text-primary hover:text-primary-hover font-semibold text-xs shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-primary/10 transition-colors ml-auto cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpiar filtros</span>
            </button>
          </div>
        )}
      </div>

      {/* Quotes Cards Grid */}
      {filteredPresupuestos.length === 0 ? (
        <div className="text-center py-16 px-4 bg-surface-container-low rounded-3xl border border-outline-variant/20">
          <FileText className="w-12 h-12 text-outline mx-auto mb-3" />
          <h3 className="text-base font-bold text-on-surface">No se encontraron presupuestos</h3>
          <p className="text-xs text-on-surface-variant mt-1 max-w-sm mx-auto">
            {searchTerm || selectedEstado !== 'todos'
              ? 'Prueba ajustando los filtros o la búsqueda.'
              : 'Crea tu primera cotización eléctrica usando el botón flotante (+).'}
          </p>
          {(searchTerm || selectedEstado !== 'todos') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedEstado('todos');
              }}
              className="mt-3 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-full text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer filtros</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPresupuestos.map((p) => {
            const cliente = clientesMap.get(p.clienteId);
            const clienteNombre = cliente
              ? (cliente.nombre || cliente.razonSocial)
              : (p.estado === 'borrador' ? 'Borrador sin cliente asignado' : 'Cliente General');
            const razonSocialSub =
              cliente?.razonSocial && cliente?.nombre && cliente.razonSocial !== cliente.nombre
                ? cliente.razonSocial
                : null;
            const direccionObra = p.direccionObra || (cliente
              ? [cliente.direccion, cliente.localidad].filter(Boolean).join(', ')
              : '');

            return (
              <div
                key={p.id}
                className="bg-surface-container-low rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 hover:bg-surface-container hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-3.5 border border-outline-variant/10"
              >
                <div className="space-y-3">
                  {/* Fila Superior: Número y Fecha (más chicos) + Estado */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-outline-variant/15">
                    <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-mono">
                      <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                        {p.numero}
                      </span>
                      <span>•</span>
                      <span>{new Date(p.fechaEmision).toLocaleDateString('es-AR')}</span>
                    </div>

                    <EstadoBadge estado={p.estado} />
                  </div>

                  {/* Datos Principales: Cliente & Dirección de Obra (Destacados) */}
                  <div className="space-y-2">
                    {/* Nombre del Cliente (Grande y protagónico) */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="bg-primary/10 text-primary p-1.5 rounded-xl shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4
                          className="text-base sm:text-lg font-bold text-on-surface truncate tracking-tight leading-snug"
                          title={razonSocialSub ? `${clienteNombre} (${razonSocialSub})` : clienteNombre}
                        >
                          {clienteNombre}
                        </h4>
                        {razonSocialSub && (
                          <div className="text-xs text-on-surface-variant truncate">
                            {razonSocialSub}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Dirección de Obra (Destacada e importante) */}
                    <div className="flex items-start gap-2 text-xs sm:text-sm text-on-surface-variant pl-0.5">
                      <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      {direccionObra ? (
                        <span className="text-on-surface font-medium line-clamp-1" title={direccionObra}>
                          {direccionObra}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant/60 italic">
                          Sin dirección de obra cargada
                        </span>
                      )}
                    </div>

                    {/* Metadatos secundarios */}
                    <div className="text-xs text-on-surface-variant pl-6 pt-0.5">
                      {p.items.length} {p.items.length === 1 ? 'partida' : 'partidas'} · Validez {p.validezDias} días
                    </div>
                  </div>
                </div>

                {/* Total & Action Buttons */}
                <div className="pt-3.5 border-t border-outline-variant/30 space-y-3.5">
                  <div className="flex justify-between items-baseline px-1">
                    <span className="text-xs sm:text-sm font-medium text-on-surface-variant">Total</span>
                    <div className="text-right">
                      <div className="font-mono text-xl sm:text-2xl font-black text-on-surface">
                        {formatARS(p.totalARS)}
                      </div>
                      {p.mostrarReferenciaMonedaExtranjera && p.totalMonedaExtranjera && (
                        <div className="text-xs text-on-surface-variant font-mono">
                          {formatUSD(p.totalMonedaExtranjera, p.nombreMonedaExtranjera)}
                        </div>
                      )}
                    </div>
                  </div>
                                <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/10">
                  {/* Fila 1: Acción Principal destacada */}
                  {p.estado === 'borrador' ? (
                    <button
                      type="button"
                      onClick={() => onEdit(p.id)}
                      className="w-full min-h-[40px] flex items-center justify-center gap-2 px-3 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-2xs"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>Continuar Editando</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelect(p.id)}
                      className="w-full min-h-[40px] flex items-center justify-center gap-2 px-3 py-2 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-2xs"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Ver Detalle</span>
                    </button>
                  )}

                  {/* Fila 2: Barra de utilidades y exportación (5 columnas balanceadas) */}
                  <div className="grid grid-cols-5 gap-1.5">
                    <button
                      type="button"
                      onClick={() => exportPresupuestoToPDF(p, cliente, config)}
                      className="min-h-[38px] flex items-center justify-center text-primary hover:bg-primary/10 rounded-xl transition-colors border border-primary/20"
                      title="Descargar cotización en PDF"
                      aria-label="Descargar cotización en PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => exportPresupuestoToXLSX(p, cliente, config)}
                      className="min-h-[38px] flex items-center justify-center text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-colors border border-emerald-500/20"
                      title="Exportar a Excel (XLSX)"
                      aria-label="Exportar a Excel (XLSX)"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setPresupuestoForWhatsApp(p)}
                      className="min-h-[38px] flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-colors border border-emerald-500/30"
                      title="Compartir por WhatsApp con formato inteligente"
                      aria-label="Compartir por WhatsApp"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>

                    {p.estado === 'borrador' ? (
                      <button
                        type="button"
                        onClick={() => onSelect(p.id)}
                        className="min-h-[38px] flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-xl transition-colors border border-outline-variant/20"
                        title="Ver resumen y detalle del borrador"
                        aria-label="Ver resumen y detalle del borrador"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onEdit(p.id)}
                        className="min-h-[38px] flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-xl transition-colors border border-outline-variant/20"
                        title="Editar presupuesto"
                        aria-label="Editar presupuesto"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="min-h-[38px] flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-xl transition-colors border border-outline-variant/20"
                      title="Eliminar presupuesto"
                      aria-label="Eliminar presupuesto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Envío por WhatsApp */}
      {presupuestoForWhatsApp && (
        <WhatsAppShareModal
          isOpen={presupuestoForWhatsApp !== null}
          onClose={() => setPresupuestoForWhatsApp(null)}
          presupuesto={presupuestoForWhatsApp}
          cliente={clientesMap.get(presupuestoForWhatsApp.clienteId)}
          config={config}
        />
      )}

      {/* Mobile M3 Extended FAB */}
      <button
        type="button"
        onClick={onNew}
        className="lg:hidden fixed bottom-20 right-4 px-4 py-3.5 bg-primary text-on-primary rounded-2xl shadow-md3-2 hover:shadow-md3-3 active:scale-95 transition-all z-30 floating-action-btn flex items-center gap-2 font-semibold text-xs sm:text-sm"
        aria-label="Nueva cotización"
      >
        <Plus className="w-5 h-5" />
        <span>Nueva Cotización</span>
      </button>
    </div>
  );
};
