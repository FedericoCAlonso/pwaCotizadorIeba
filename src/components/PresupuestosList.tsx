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
} from 'lucide-react';
import { db, softDelete } from '../db/database';
import { Presupuesto, Cliente, AppConfig } from '../core/types';
import { formatARS, formatUSD } from '../core/calculations';
import { EstadoBadge } from './EstadoBadge';
import { exportPresupuestoToXLSX, sharePresupuesto } from '../core/exportUtils';
import { exportPresupuestoToPDF } from '../core/pdfExportUtils';
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

  const filteredPresupuestos = presupuestos.filter((p) => {
    const cliente = clientesMap.get(p.clienteId);
    const matchesSearch =
      p.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cliente && cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesEstado = selectedEstado === 'todos' || p.estado === selectedEstado;
    return matchesSearch && matchesEstado;
  });

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
              placeholder="Buscar por número o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-full pl-9 pr-8 py-2 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-on-surface-variant hover:text-on-surface p-0.5"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Chips with invisible native horizontal scroll */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden w-full md:w-auto pb-1 md:pb-0 touch-pan-x overscroll-contain">
            {['todos', 'borrador', 'enviado', 'aprobado', 'rechazado', 'vencido'].map((st) => (
              <button
                type="button"
                key={st}
                onClick={() => setSelectedEstado(st)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize whitespace-nowrap border ${
                  selectedEstado === st
                    ? 'bg-secondary-container text-on-secondary-container border-transparent shadow-xs'
                    : 'bg-surface-variant/70 text-on-surface-variant hover:bg-surface-variant border-outline-variant/30'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Desktop "+ Nueva Cotización" Button */}
          <button
            type="button"
            onClick={onNew}
            className="hidden lg:flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-xs transition-all shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Cotización</span>
          </button>
        </div>
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
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPresupuestos.map((p) => {
            const cliente = clientesMap.get(p.clienteId);

            return (
              <div
                key={p.id}
                className="bg-surface-container-low rounded-3xl p-5 hover:bg-surface-container hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4 border border-outline-variant/10"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono font-bold text-primary text-base">{p.numero}</span>
                      <span className="text-xs text-on-surface-variant block mt-0.5">
                        {new Date(p.fechaEmision).toLocaleDateString('es-AR')}
                      </span>
                    </div>

                    <EstadoBadge estado={p.estado} />
                  </div>

                  <div className="mt-4 space-y-1">
                    <div className="flex items-center gap-2 text-on-surface text-sm font-medium truncate">
                      <div className="bg-surface-variant p-1.5 rounded-full flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-on-surface-variant" />
                      </div>
                      <span className="truncate">{cliente ? cliente.nombre : 'Cliente General'}</span>
                    </div>
                    <div className="text-xs text-on-surface-variant pl-8">
                      {p.items.length} partidas · Validez {p.validezDias} días
                    </div>
                  </div>
                </div>

                {/* Total & Action Buttons */}
                <div className="pt-4 border-t border-outline-variant/30 space-y-4">
                  <div className="flex justify-between items-baseline px-1">
                    <span className="text-sm font-medium text-on-surface-variant">Total</span>
                    <div className="text-right">
                      <div className="font-mono text-lg font-bold text-on-surface">
                        {formatARS(p.totalARS)}
                      </div>
                      {p.mostrarReferenciaMonedaExtranjera && p.totalMonedaExtranjera && (
                        <div className="text-xs text-on-surface-variant font-mono">
                          {formatUSD(p.totalMonedaExtranjera, p.nombreMonedaExtranjera)}
                        </div>
                      )}
                    </div>
                  </div>
                                <div className="flex items-center gap-1.5 pt-2 border-t border-outline-variant/10">
                    <button
                      type="button"
                      onClick={() => onSelect(p.id)}
                      className="flex-1 min-h-[42px] flex items-center justify-center gap-2 px-3 py-2 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-2xs"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Ver Detalle</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => exportPresupuestoToPDF(p, cliente, config)}
                      className="min-w-[42px] min-h-[42px] flex items-center justify-center text-primary hover:bg-primary/10 rounded-xl transition-colors shrink-0 border border-primary/20"
                      title="Descargar cotización en PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => exportPresupuestoToXLSX(p, cliente, config)}
                      className="min-w-[42px] min-h-[42px] flex items-center justify-center text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-colors shrink-0 border border-emerald-500/20"
                      title="Exportar a Excel (XLSX)"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => sharePresupuesto(p, cliente)}
                      className="min-w-[42px] min-h-[42px] flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-xl transition-colors shrink-0 border border-outline-variant/20"
                      title="Compartir por WhatsApp"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onEdit(p.id)}
                      className="min-w-[42px] min-h-[42px] flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-xl transition-colors shrink-0 border border-outline-variant/20"
                      title="Editar presupuesto"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="min-w-[42px] min-h-[42px] flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-xl transition-colors shrink-0 border border-outline-variant/20"
                      title="Eliminar presupuesto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
