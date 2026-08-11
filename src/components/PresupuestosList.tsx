import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  FileText,
  PlusCircle,
  Search,
  Eye,
  Edit2,
  Copy,
  Trash2,
  User,
} from 'lucide-react';
import { db } from '../db/database';
import { Presupuesto, EstadoPresupuesto, Cliente } from '../core/types';
import { formatARS, formatUSD } from '../core/calculations';

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

  const statusConfig: Record<EstadoPresupuesto, { label: string; className: string }> = {
    borrador: { label: 'Borrador', className: 'bg-slate-700/60 text-slate-300' },
    enviado: { label: 'Enviado', className: 'bg-amber-500/15 text-amber-400' },
    aprobado: { label: 'Aprobado', className: 'bg-emerald-500/15 text-emerald-400' },
    rechazado: { label: 'Rechazado', className: 'bg-rose-500/15 text-rose-400' },
    vencido: { label: 'Vencido', className: 'bg-slate-700/40 text-slate-500' }
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="w-4.5 h-4.5 text-amber-400" />
            <span>Presupuestos & Cotizaciones</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {presupuestos.length} cotizaciones guardadas
          </p>
        </div>

        <button
          onClick={onNew}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-xs transition active:scale-95"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Nueva Cotización</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por número o cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700/40 rounded-lg pl-8.5 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500/70 placeholder:text-slate-600"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {['todos', 'borrador', 'enviado', 'aprobado', 'rechazado', 'vencido'].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedEstado(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize whitespace-nowrap ${
                selectedEstado === st
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Quotes Cards Grid */}
      {filteredPresupuestos.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/30">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-400">No se encontraron presupuestos</h3>
          <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
            Crea tu primera cotización eléctrica seleccionando tareas tipo del catálogo.
          </p>
          <button
            onClick={onNew}
            className="mt-4 px-4 py-2 bg-amber-500 text-slate-950 font-semibold text-xs rounded-lg inline-flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Crear Cotización</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPresupuestos.map((p) => {
            const cliente = clientesMap.get(p.clienteId);
            const sc = statusConfig[p.estado] || statusConfig.borrador;

            return (
              <div
                key={p.id}
                className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4 hover:border-slate-600/50 hover:bg-slate-800/60 transition flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono font-semibold text-amber-400 text-sm">{p.numero}</span>
                      <span className="text-[11px] text-slate-500 block">
                        {new Date(p.fechaEmision).toLocaleDateString('es-AR')}
                      </span>
                    </div>

                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${sc.className}`}>
                      {sc.label}
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-slate-200 text-sm font-medium truncate">
                      <User className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      <span className="truncate">{cliente ? cliente.nombre : 'Cliente General'}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {p.items.length} partidas · Validez {p.validezDias} días
                    </div>
                  </div>
                </div>

                {/* Total & Action Buttons */}
                <div className="pt-2.5 border-t border-slate-700/30 space-y-2.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500">Total:</span>
                    <div className="text-right">
                      <div className="font-mono text-base font-bold text-emerald-400">
                        {formatARS(p.totalARS)}
                      </div>
                      {p.mostrarReferenciaMonedaExtranjera && p.totalMonedaExtranjera && (
                        <div className="text-[10px] text-slate-500 font-mono">
                          {formatUSD(p.totalMonedaExtranjera, p.nombreMonedaExtranjera)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onSelect(p.id)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-amber-400 rounded-lg text-xs font-medium transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver PDF</span>
                    </button>

                    <button
                      onClick={() => onEdit(p.id)}
                      className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition"
                      title="Editar presupuesto"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDuplicate(p)}
                      className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition"
                      title="Duplicar como plantilla"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-700/50 rounded-lg transition"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
