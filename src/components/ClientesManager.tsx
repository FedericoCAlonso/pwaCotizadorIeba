import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Users, Plus, Edit2, Trash2, X, Save, Phone, Mail, MapPin } from 'lucide-react';
import { db } from '../db/database';
import { Cliente } from '../core/types';

export const ClientesManager: React.FC = () => {
  const clientes = useLiveQuery(() => db.clientes.toArray()) || [];
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<Cliente>>({ nombre: '', cuitDni: '', telefono: '', email: '', direccion: '', notas: '' });

  const handleOpenCreate = () => { setFormData({ nombre: '', cuitDni: '', telefono: '', email: '', direccion: '', notas: '' }); setIsCreating(true); };
  const handleOpenEdit = (c: Cliente) => { setEditingCliente(c); setFormData({ ...c }); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) {
      await db.clientes.add({ id: `cli-${crypto.randomUUID()}`, nombre: formData.nombre || 'Nuevo Cliente', cuitDni: formData.cuitDni, condicionIVA: formData.condicionIVA || 'Consumidor Final', telefono: formData.telefono, email: formData.email, direccion: formData.direccion, notas: formData.notas });
      setIsCreating(false);
    } else if (editingCliente) {
      await db.clientes.update(editingCliente.id, { nombre: formData.nombre, cuitDni: formData.cuitDni, condicionIVA: formData.condicionIVA, telefono: formData.telefono, email: formData.email, direccion: formData.direccion, notas: formData.notas });
      setEditingCliente(null);
    }
  };

  const handleDelete = async (id: string) => { if (confirm('¿Eliminar este cliente?')) await db.clientes.delete(id); };

  const inputCls = "w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/70";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Users className="w-4 h-4 text-amber-400" />Directorio de Clientes</h2>
          <p className="text-xs text-slate-500 mt-0.5">Contactos y datos fiscales para tus presupuestos.</p>
        </div>
        <button onClick={handleOpenCreate} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-semibold transition">
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" /><span>Nuevo Cliente</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {clientes.map((cliente) => (
          <div key={cliente.id} className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4 hover:border-slate-600/50 transition">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-white">{cliente.nombre}</h3>
                {cliente.cuitDni && <span className="text-[11px] font-mono text-slate-500 block mt-0.5">CUIT/DNI: {cliente.cuitDni}</span>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleOpenEdit(cliente)} className="p-1.5 text-slate-500 hover:text-white rounded hover:bg-slate-700/50 transition" aria-label={`Editar ${cliente.nombre}`}><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(cliente.id)} className="p-1.5 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-700/50 transition" aria-label={`Eliminar ${cliente.nombre}`}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            <div className="mt-3 space-y-1.5 text-xs text-slate-400">
              {cliente.telefono && <div className="flex items-center gap-2"><Phone className="w-3 h-3 text-slate-500" />{cliente.telefono}</div>}
              {cliente.email && <div className="flex items-center gap-2"><Mail className="w-3 h-3 text-slate-500" />{cliente.email}</div>}
              {cliente.direccion && <div className="flex items-center gap-2"><MapPin className="w-3 h-3 text-slate-500" />{cliente.direccion}</div>}
            </div>
            {cliente.notas && <p className="mt-2.5 text-xs text-slate-500 bg-slate-900/40 p-2 rounded-lg">{cliente.notas}</p>}
          </div>
        ))}
      </div>

      {(isCreating || editingCliente) && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700/50 rounded-xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-white">{isCreating ? 'Agregar Nuevo Cliente' : 'Editar Cliente'}</h3>
              <button onClick={() => { setIsCreating(false); setEditingCliente(null); }} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nombre / Razón Social</label>
                <input type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} className={inputCls} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">CUIT / DNI</label>
                  <input type="text" value={formData.cuitDni} onChange={(e) => setFormData({ ...formData, cuitDni: e.target.value })} className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Condición IVA</label>
                  <select value={formData.condicionIVA || 'Consumidor Final'} onChange={(e) => setFormData({ ...formData, condicionIVA: e.target.value as any })} className={inputCls}>
                    <option>Responsable Inscripto</option>
                    <option>Monotributo</option>
                    <option>Consumidor Final</option>
                    <option>Exento</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-slate-400 mb-1">Teléfono</label><input type="text" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} className={inputCls} /></div>
                <div><label className="block text-xs text-slate-400 mb-1">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputCls} /></div>
              </div>
              <div><label className="block text-xs text-slate-400 mb-1">Dirección</label><input type="text" value={formData.direccion} onChange={(e) => setFormData({ ...formData, direccion: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-xs text-slate-400 mb-1">Notas</label><textarea rows={2} value={formData.notas} onChange={(e) => setFormData({ ...formData, notas: e.target.value })} className={inputCls} /></div>
              <div className="pt-3 border-t border-slate-700/40 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsCreating(false); setEditingCliente(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700/50">Cancelar</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm"><Save className="w-3.5 h-3.5" />Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
