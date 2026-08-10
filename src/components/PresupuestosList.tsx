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
  DollarSign,
  Calendar,
  User,
  CheckCircle,
  Lock,
  Clock
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

  const statusBadge = (st: EstadoPresupuesto) => {
    const map = {
      borrador: 'bg-slate-800 text-slate-300 border-slate-700',
      enviado: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      aprobado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      rechazado: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      vencido: 'bg-slate-800 text-slate-500 border-slate-700'
    };
    return map[st] || 'bg-slate-800 text-slate-400';
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <span>Presupuestos & Cotizaciones Emitidas</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {presupuestos.length} cotizaciones guardadas. Precios con snapshot inmutable al emitir.
          </p>
        </div>

        <button
          onClick={onNew}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-lg text-xs transition shadow-md shadow-amber-500/20"
        >
          <PlusCircle className="w-4 h-4 fill-slate-950 text-amber-500" />
          <span>Nueva Cotización</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por número correlativo o cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {['todos', 'borrador', 'enviado', 'aprobado', 'rechazado', 'vencido'].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedEstado(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize whitespace-nowrap ${
                selectedEstado === st
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Quotes Cards Grid */}
      {filteredPresupuestos.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/60 border border-slate-800 rounded-xl">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-300">No se encontraron presupuestos</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Crea tu primera cotización eléctrica seleccionando tareas tipo del catálogo para generar costos automáticos.
          </p>
          <button
            onClick={onNew}
            className="mt-4 px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg inline-flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
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
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition flex flex-col justify-between space-y-4 shadow-xl group"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono font-bold text-amber-400 text-base">{p.numero}</span>
                      <span className="text-[11px] text-slate-500 block">
                        {new Date(p.fechaEmision).toLocaleDateString('es-AR')}
                      </span>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border capitalize ${statusBadge(p.estado)}`}>
                      {p.estado}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-200 text-sm font-semibold truncate">
                      <User className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span className="truncate">{cliente ? cliente.nombre : 'Cliente General'}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {p.items.length} partidas | Validez: {p.validezDias} días
                    </div>
                  </div>
                </div>

                {/* Total & Action Buttons */}
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-400">Total Cotizado:</span>
                    <div className="text-right">
                      <div className="font-mono text-xl font-extrabold text-emerald-400">
                        {formatARS(p.totalARS)}
                      </div>
                      {p.mostrarReferenciaMonedaExtranjera && p.totalMonedaExtranjera && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formatUSD(p.totalMonedaExtranjera, p.nombreMonedaExtranjera)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1 pt-1">
                    <button
                      onClick={() => onSelect(p.id)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded text-xs font-semibold border border-slate-700 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver PDF</span>
                    </button>

                    <button
                      onClick={() => onEdit(p.id)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                      title="Editar presupuesto"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDuplicate(p)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                      title="Duplicar como plantilla"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded border border-slate-700 transition"
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
