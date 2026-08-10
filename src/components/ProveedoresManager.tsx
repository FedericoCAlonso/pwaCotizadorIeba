import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Truck, Plus, Edit2, Trash2, X, Save, Phone, Mail, MapPin, User, FileText } from 'lucide-react';
import { db } from '../db/database';
import { Proveedor } from '../core/types';

export const ProveedoresManager: React.FC = () => {
  const proveedores = useLiveQuery(() => db.proveedores.toArray()) || [];

  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [formData, setFormData] = useState<Partial<Proveedor>>({
    nombre: '',
    cuit: '',
    telefono: '',
    email: '',
    contacto: '',
    direccion: '',
    notas: ''
  });

  const handleOpenCreate = () => {
    setFormData({ nombre: '', cuit: '', telefono: '', email: '', contacto: '', direccion: '', notas: '' });
    setIsCreating(true);
  };

  const handleOpenEdit = (prov: Proveedor) => {
    setEditingProveedor(prov);
    setFormData({ ...prov });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) {
      await db.proveedores.add({
        id: `prov-${crypto.randomUUID()}`,
        nombre: formData.nombre || 'Nuevo Proveedor',
        cuit: formData.cuit,
        telefono: formData.telefono,
        email: formData.email,
        contacto: formData.contacto,
        direccion: formData.direccion,
        notas: formData.notas
      });
      setIsCreating(false);
    } else if (editingProveedor) {
      await db.proveedores.update(editingProveedor.id, {
        nombre: formData.nombre,
        cuit: formData.cuit,
        telefono: formData.telefono,
        email: formData.email,
        contacto: formData.contacto,
        direccion: formData.direccion,
        notas: formData.notas
      });
      setEditingProveedor(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este proveedor del catálogo?')) {
      await db.proveedores.delete(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-400" />
            <span>Directorio de Proveedores</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Registra distribuidores, contactos comerciales y condiciones de descuento de tus insumos eléctricos.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition shadow-md shadow-amber-500/10"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nuevo Proveedor</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {proveedores.map((prov) => (
          <div
            key={prov.id}
            className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition flex flex-col justify-between space-y-4 shadow-xl"
          >
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white text-base">{prov.nombre}</h3>
                  {prov.cuit && (
                    <span className="text-[11px] font-mono text-amber-400/80 block mt-0.5">
                      CUIT: {prov.cuit}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleOpenEdit(prov)} className="p-1 text-slate-400 hover:text-white" aria-label={`Editar proveedor ${prov.nombre}`}>
                    <Edit2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button onClick={() => handleDelete(prov.id)} className="p-1 text-slate-400 hover:text-rose-400" aria-label={`Eliminar proveedor ${prov.nombre}`}>
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-slate-300">
                {prov.contacto && (
                  <div className="flex items-center gap-2 text-slate-300 font-semibold">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span>{prov.contacto}</span>
                  </div>
                )}
                {prov.telefono && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Phone className="w-3.5 h-3.5 text-amber-400" />
                    <span>{prov.telefono}</span>
                  </div>
                )}
                {prov.email && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Mail className="w-3.5 h-3.5 text-amber-400" />
                    <span>{prov.email}</span>
                  </div>
                )}
                {prov.direccion && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    <span>{prov.direccion}</span>
                  </div>
                )}
              </div>

              {prov.notas && (
                <p className="mt-3 text-xs text-slate-400 bg-slate-950/40 p-2 rounded border border-slate-800">
                  {prov.notas}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {(isCreating || editingProveedor) && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold text-white">
                {isCreating ? 'Agregar Nuevo Proveedor' : 'Editar Proveedor'}
              </h3>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingProveedor(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Razón Social / Distribuidora</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">CUIT</label>
                  <input
                    type="text"
                    value={formData.cuit}
                    onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Vendedor / Contacto</label>
                  <input
                    type="text"
                    value={formData.contacto}
                    onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Dirección / Depósito</label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Notas / Condiciones Comerciales</label>
                <textarea
                  rows={2}
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  placeholder="Ej: Descuento 8% pago contado. Entregas en 48hs."
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingProveedor(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Proveedor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
