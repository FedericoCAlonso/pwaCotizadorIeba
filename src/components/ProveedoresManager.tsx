import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Truck, Plus, Edit2, Trash2, X, Save, Phone, Mail, MapPin, User } from 'lucide-react';
import { db } from '../db/database';
import { Proveedor } from '../core/types';

export const ProveedoresManager: React.FC = () => {
  const proveedores = useLiveQuery(() => db.proveedores.toArray()) || [];
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<Proveedor>>({ nombre: '', cuit: '', telefono: '', email: '', contacto: '', direccion: '', notas: '' });

  const handleOpenCreate = () => { setFormData({ nombre: '', cuit: '', telefono: '', email: '', contacto: '', direccion: '', notas: '' }); setIsCreating(true); };
  const handleOpenEdit = (p: Proveedor) => { setEditingProveedor(p); setFormData({ ...p }); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) {
      await db.proveedores.add({ id: `prov-${crypto.randomUUID()}`, nombre: formData.nombre || 'Nuevo Proveedor', cuit: formData.cuit, telefono: formData.telefono, email: formData.email, contacto: formData.contacto, direccion: formData.direccion, notas: formData.notas });
      setIsCreating(false);
    } else if (editingProveedor) {
      await db.proveedores.update(editingProveedor.id, { nombre: formData.nombre, cuit: formData.cuit, telefono: formData.telefono, email: formData.email, contacto: formData.contacto, direccion: formData.direccion, notas: formData.notas });
      setEditingProveedor(null);
    }
  };

  const handleDelete = async (id: string) => { if (confirm('¿Eliminar este proveedor?')) await db.proveedores.delete(id); };

  const inputCls = "w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/70";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Truck className="w-4 h-4 text-amber-400" />Directorio de Proveedores</h2>
          <p className="text-xs text-slate-500 mt-0.5">Distribuidores y condiciones comerciales.</p>
        </div>
        <button onClick={handleOpenCreate} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-semibold transition">
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" /><span>Nuevo Proveedor</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {proveedores.map((prov) => (
          <div key={prov.id} className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4 hover:border-slate-600/50 transition">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-white">{prov.nombre}</h3>
                {prov.cuit && <span className="text-[11px] font-mono text-slate-500 block mt-0.5">CUIT: {prov.cuit}</span>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleOpenEdit(prov)} className="p-1.5 text-slate-500 hover:text-white rounded hover:bg-slate-700/50 transition" aria-label={`Editar ${prov.nombre}`}><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(prov.id)} className="p-1.5 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-700/50 transition" aria-label={`Eliminar ${prov.nombre}`}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            <div className="mt-3 space-y-1.5 text-xs text-slate-400">
              {prov.contacto && <div className="flex items-center gap-2 font-medium"><User className="w-3 h-3 text-slate-500" />{prov.contacto}</div>}
              {prov.telefono && <div className="flex items-center gap-2"><Phone className="w-3 h-3 text-slate-500" />{prov.telefono}</div>}
              {prov.email && <div className="flex items-center gap-2"><Mail className="w-3 h-3 text-slate-500" />{prov.email}</div>}
              {prov.direccion && <div className="flex items-center gap-2"><MapPin className="w-3 h-3 text-slate-500" />{prov.direccion}</div>}
            </div>
            {prov.notas && <p className="mt-2.5 text-xs text-slate-500 bg-slate-900/40 p-2 rounded-lg">{prov.notas}</p>}
          </div>
        ))}
      </div>

      {(isCreating || editingProveedor) && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700/50 rounded-xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-white">{isCreating ? 'Agregar Proveedor' : 'Editar Proveedor'}</h3>
              <button onClick={() => { setIsCreating(false); setEditingProveedor(null); }} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3.5">
              <div><label className="block text-xs text-slate-400 mb-1">Razón Social / Distribuidora</label><input type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} className={inputCls} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-slate-400 mb-1">CUIT</label><input type="text" value={formData.cuit} onChange={(e) => setFormData({ ...formData, cuit: e.target.value })} className={`${inputCls} font-mono`} /></div>
                <div><label className="block text-xs text-slate-400 mb-1">Contacto</label><input type="text" value={formData.contacto} onChange={(e) => setFormData({ ...formData, contacto: e.target.value })} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-slate-400 mb-1">Teléfono</label><input type="text" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} className={inputCls} /></div>
                <div><label className="block text-xs text-slate-400 mb-1">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputCls} /></div>
              </div>
              <div><label className="block text-xs text-slate-400 mb-1">Dirección / Depósito</label><input type="text" value={formData.direccion} onChange={(e) => setFormData({ ...formData, direccion: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-xs text-slate-400 mb-1">Notas / Condiciones</label><textarea rows={2} value={formData.notas} onChange={(e) => setFormData({ ...formData, notas: e.target.value })} className={inputCls} placeholder="Ej: Descuento 8% contado." /></div>
              <div className="pt-3 border-t border-slate-700/40 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsCreating(false); setEditingProveedor(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700/50">Cancelar</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm"><Save className="w-3.5 h-3.5" />Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
