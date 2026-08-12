import React, { useState } from 'react';
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
} from 'lucide-react';
import { db } from '../db/database';
import { Presupuesto, Cliente } from '../core/types';
import { formatARS, formatUSD } from '../core/calculations';
import { EstadoBadge } from './EstadoBadge';

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
  const presupuestos = useLiveQuery(() => db.presupuestos.reverse().toArray()) || [];
  const clientes = useLiveQuery(() => db.clientes.toArray()) || [];
  const clientesMap = new Map<string, Cliente>(clientes.map((c) => [c.id, c]));

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

    const duplicated: Presupuesto = {
      ...p,
      id: `pres-${crypto.randomUUID()}`,
      numero: newNumero,
      fechaEmision: new Date().toISOString(),
      estado: 'borrador',
      fechaModificacion: new Date().toISOString()
    };

    await db.presupuestos.add(duplicated);
    onSelect(duplicated.id);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este presupuesto?')) {
      await db.presupuestos.delete(id);
    }
  };

  return (
    <div className="space-y-6 relative pb-24 lg:pb-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <span>Presupuestos & Cotizaciones</span>
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            {presupuestos.length} cotizaciones guardadas
          </p>
        </div>

        <button
          type="button"
          onClick={onNew}
          className="hidden lg:flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm hover:shadow-md active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Cotización</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-on-surface-variant absolute left-4 top-3" />
          <input
            type="text"
            placeholder="Buscar por número o cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container-highest border-none rounded-full pl-10 pr-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-on-surface-variant/70 transition-shadow"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {['todos', 'borrador', 'enviado', 'aprobado', 'rechazado', 'vencido'].map((st) => (
            <button
              type="button"
              key={st}
              onClick={() => setSelectedEstado(st)}
              className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors capitalize whitespace-nowrap border border-outline-variant/30 ${
                selectedEstado === st
                  ? 'bg-secondary-container text-on-secondary-container border-transparent'
                  : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Quotes Cards Grid */}
      {filteredPresupuestos.length === 0 ? (
        <div className="text-center py-16 px-4 bg-surface-container rounded-3xl border border-outline-variant/20">
          <FileText className="w-12 h-12 text-outline mx-auto mb-4" />
          <h3 className="text-base font-semibold text-on-surface">No se encontraron presupuestos</h3>
          <p className="text-sm text-on-surface-variant mt-2 max-w-md mx-auto">
            Crea tu primera cotización eléctrica seleccionando tareas tipo del catálogo.
          </p>
          <button
            type="button"
            onClick={onNew}
            className="mt-6 px-6 py-2.5 bg-primary text-on-primary font-medium text-sm rounded-full inline-flex items-center gap-2 shadow-sm hover:shadow-md transition-shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Cotización</span>
          </button>
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

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelect(p.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container rounded-xl text-xs sm:text-sm font-medium transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Ver Detalles</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onEdit(p.id)}
                      className="p-2.5 text-on-surface-variant hover:text-primary hover:bg-primary-container rounded-xl transition-colors shrink-0"
                      title="Editar presupuesto"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDuplicate(p)}
                      className="p-2.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-xl transition-colors shrink-0"
                      title="Duplicar como plantilla"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="p-2.5 text-on-surface-variant hover:text-error hover:bg-error-container rounded-xl transition-colors shrink-0"
                      title="Eliminar"
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

      {/* Mobile FAB */}
      <button
        type="button"
        onClick={onNew}
        className="lg:hidden fixed bottom-6 right-6 p-4 bg-primary text-on-primary rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all z-40"
        aria-label="Nueva cotización"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
};
