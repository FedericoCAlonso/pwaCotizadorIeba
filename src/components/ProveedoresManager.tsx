import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Truck, Plus, Edit2, Trash2, X, Save, Phone, Mail, MapPin, User, FileSpreadsheet } from 'lucide-react';
import { db, importProveedoresCSV } from '../db/database';
import { Proveedor } from '../core/types';

export const ProveedoresManager: React.FC = () => {
  const proveedores = useLiveQuery(() => db.proveedores.toArray()) || [];
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvContent, setCsvContent] = useState('');
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

  const handleImportCSV = async () => {
    if (!csvContent.trim()) return;
    const importedCount = await importProveedoresCSV(csvContent);
    alert(`¡Se importaron ${importedCount} proveedores desde el CSV!`);
    setCsvContent(''); setShowCSVModal(false);
  };

  const handleExportCSV = () => {
    const header = "nombre,cuit,telefono,email,contacto,direccion,notas\n";
    const rows = proveedores.map(p => {
      const n = (p.nombre || '').replace(/,/g, '');
      const ct = (p.cuit || '').replace(/,/g, '');
      const t = (p.telefono || '').replace(/,/g, '');
      const e = (p.email || '').replace(/,/g, '');
      const c = (p.contacto || '').replace(/,/g, '');
      const d = (p.direccion || '').replace(/,/g, '');
      const no = (p.notas || '').replace(/,/g, '');
      return `"${n}","${ct}","${t}","${e}","${c}","${d}","${no}"`;
    }).join('\n');
    
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ieba_proveedores_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleKeyDownSequential = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
      e.preventDefault();
      const form = e.currentTarget;
      const elements = Array.from(form.elements) as HTMLElement[];
      const index = elements.indexOf(target);
      if (index > -1 && index < elements.length - 1) {
        let nextEl = elements[index + 1];
        while (nextEl && (nextEl.hasAttribute('disabled') || nextEl.tabIndex === -1 || nextEl.tagName === 'FIELDSET')) {
          nextEl = elements[elements.indexOf(nextEl) + 1];
        }
        if (nextEl) nextEl.focus();
      }
    }
  };

  const inputCls = "w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/70";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Truck className="w-4 h-4 text-amber-400" />Directorio de Proveedores</h2>
          <p className="text-xs text-slate-500 mt-0.5">Distribuidores y condiciones comerciales.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button onClick={handleExportCSV} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition border border-slate-700/50">
            <FileSpreadsheet className="w-3.5 h-3.5" /><span>Exportar</span>
          </button>
          <button onClick={() => setShowCSVModal(true)} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition border border-slate-700/50">
            <FileSpreadsheet className="w-3.5 h-3.5" /><span>Importar</span>
          </button>
          <button onClick={handleOpenCreate} className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-semibold transition">
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" /><span>Nuevo Proveedor</span>
          </button>
        </div>
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
            <form onSubmit={handleSave} onKeyDown={handleKeyDownSequential} className="space-y-3.5">
              <div><label className="block text-xs text-slate-400 mb-1">Razón Social / Distribuidora</label><input type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} className={inputCls} required /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-xs text-slate-400 mb-1">CUIT</label><input type="text" value={formData.cuit} onChange={(e) => setFormData({ ...formData, cuit: e.target.value })} className={`${inputCls} font-mono`} /></div>
                <div><label className="block text-xs text-slate-400 mb-1">Contacto</label><input type="text" value={formData.contacto} onChange={(e) => setFormData({ ...formData, contacto: e.target.value })} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {/* Modal: CSV */}
      {showCSVModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700/50 rounded-xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm"><FileSpreadsheet className="w-4 h-4" />Importar Proveedores desde CSV</div>
              <button onClick={() => setShowCSVModal(false)} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3.5">
              <p className="text-xs text-slate-400">Pegá el contenido CSV. Formato:<br />
                <code className="text-amber-400 bg-slate-900/60 px-1.5 py-0.5 rounded font-mono text-[11px] block mt-1">Nombre, CUIT, Telefono, Email, Contacto, Direccion, Notas</code>
              </p>
              <textarea rows={5} value={csvContent} onChange={(e) => setCsvContent(e.target.value)}
                placeholder={`nombre,cuit,telefono,email,contacto,direccion,notas\nDistribuidora Sur,30-11111111-9,11-5555-5555,ventas@sur.com.ar,Juan,Av Mitre 123,Desc 10%`}
                className={`${inputCls} font-mono text-xs`} />
              <div className="pt-3 border-t border-slate-700/40 flex justify-end gap-2">
                <button onClick={() => setShowCSVModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700/50">Cancelar</button>
                <button onClick={handleImportCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-lg text-sm">Importar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
