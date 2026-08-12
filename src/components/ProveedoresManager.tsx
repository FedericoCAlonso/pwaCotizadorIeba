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

  const handleOpenCreate = () => { setFormData({ nombre: '', cuit: '', telefono: '', email: '', contacto: '', direccion: '', notas: '', tipoProveedor: 'material' }); setIsCreating(true); };
  const handleOpenEdit = (p: Proveedor) => { setEditingProveedor(p); setFormData({ ...p, tipoProveedor: p.tipoProveedor || 'material' }); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) {
      await db.proveedores.add({ id: `prov-${crypto.randomUUID()}`, nombre: formData.nombre || 'Nuevo Proveedor', cuit: formData.cuit, telefono: formData.telefono, email: formData.email, contacto: formData.contacto, direccion: formData.direccion, notas: formData.notas, tipoProveedor: formData.tipoProveedor || 'material' });
      setIsCreating(false);
    } else if (editingProveedor) {
      await db.proveedores.update(editingProveedor.id, { nombre: formData.nombre, cuit: formData.cuit, telefono: formData.telefono, email: formData.email, contacto: formData.contacto, direccion: formData.direccion, notas: formData.notas, tipoProveedor: formData.tipoProveedor || 'material' });
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

  const inputCls = "w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-on-surface-variant/70 transition-shadow";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2"><Truck className="w-5 h-5 text-primary" />Directorio de Proveedores</h2>
          <p className="text-sm text-on-surface-variant mt-1">Distribuidores y condiciones comerciales.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button onClick={handleExportCSV} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-on-surface-variant hover:bg-surface-variant rounded-full text-sm font-medium transition-colors border border-outline-variant/30">
            <FileSpreadsheet className="w-4 h-4" /><span>Exportar</span>
          </button>
          <button onClick={() => setShowCSVModal(true)} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-on-surface-variant hover:bg-surface-variant rounded-full text-sm font-medium transition-colors border border-outline-variant/30">
            <FileSpreadsheet className="w-4 h-4" /><span>Importar</span>
          </button>
          <button onClick={handleOpenCreate} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm">
            <Plus className="w-4 h-4" /><span>Nuevo Proveedor</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {proveedores.map((prov) => (
          <div key={prov.id} className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 hover:bg-surface-container/60 transition-all flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-on-surface text-base">{prov.nombre}</h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container capitalize">
                      {prov.tipoProveedor || 'material'}
                    </span>
                  </div>
                  {prov.cuit && <span className="text-xs font-mono text-on-surface-variant block mt-1">CUIT: {prov.cuit}</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleOpenEdit(prov)} className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors" aria-label={`Editar ${prov.nombre}`}><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(prov.id)} className="p-2 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors" aria-label={`Eliminar ${prov.nombre}`}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs text-on-surface-variant border-t border-outline-variant/20 pt-3">
                {prov.contacto && <div className="flex items-center gap-2.5 font-medium"><User className="w-3.5 h-3.5 text-primary" />{prov.contacto}</div>}
                {prov.telefono && <div className="flex items-center gap-2.5"><Phone className="w-3.5 h-3.5 text-primary" />{prov.telefono}</div>}
                {prov.email && <div className="flex items-center gap-2.5"><Mail className="w-3.5 h-3.5 text-primary" />{prov.email}</div>}
                {prov.direccion && <div className="flex items-center gap-2.5"><MapPin className="w-3.5 h-3.5 text-primary" />{prov.direccion}</div>}
              </div>
            </div>
            {prov.notas && <p className="mt-3 text-xs text-on-surface-variant bg-surface-container-highest/60 p-3 rounded-2xl">{prov.notas}</p>}
          </div>
        ))}
      </div>

      {(isCreating || editingProveedor) && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-md shadow-2xl p-6 text-on-surface">
            <div className="flex items-center justify-between mb-5 border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-semibold text-on-surface">{isCreating ? 'Agregar Proveedor' : 'Editar Proveedor'}</h3>
              <button onClick={() => { setIsCreating(false); setEditingProveedor(null); }} className="text-on-surface-variant hover:text-on-surface p-1"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSave} onKeyDown={handleKeyDownSequential} className="space-y-4">
              <div><label className="block text-xs text-on-surface-variant mb-1">Razón Social / Distribuidora</label><input type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} className={inputCls} required /></div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Tipo de Rubro / Proveedor</label>
                <select value={formData.tipoProveedor || 'material'} onChange={(e) => setFormData({ ...formData, tipoProveedor: e.target.value as any })} className={inputCls}>
                  <option value="material">Materiales / Insumos Eléctricos</option>
                  <option value="servicio">Servicios Tercerizados (Subcontratistas)</option>
                  <option value="ambos">Ambos (Materiales y Servicios)</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-xs text-on-surface-variant mb-1">CUIT</label><input type="text" value={formData.cuit} onChange={(e) => setFormData({ ...formData, cuit: e.target.value })} className={`${inputCls} font-mono`} /></div>
                <div><label className="block text-xs text-on-surface-variant mb-1">Contacto</label><input type="text" value={formData.contacto} onChange={(e) => setFormData({ ...formData, contacto: e.target.value })} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-xs text-on-surface-variant mb-1">Teléfono</label><input type="text" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} className={inputCls} /></div>
                <div><label className="block text-xs text-on-surface-variant mb-1">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputCls} /></div>
              </div>
              <div><label className="block text-xs text-on-surface-variant mb-1">Dirección / Depósito</label><input type="text" value={formData.direccion} onChange={(e) => setFormData({ ...formData, direccion: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-xs text-on-surface-variant mb-1">Notas / Condiciones</label><textarea rows={2} value={formData.notas} onChange={(e) => setFormData({ ...formData, notas: e.target.value })} className={inputCls} placeholder="Ej: Descuento 8% contado." /></div>
              <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsCreating(false); setEditingProveedor(null); }} className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant">Cancelar</button>
                <button type="submit" className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-sm shadow-sm"><Save className="w-3.5 h-3.5" />Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: CSV */}
      {showCSVModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-lg shadow-2xl p-6 text-on-surface">
            <div className="flex items-center justify-between mb-5 border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2 text-tertiary font-semibold text-sm"><FileSpreadsheet className="w-4 h-4" />Importar Proveedores desde CSV</div>
              <button onClick={() => setShowCSVModal(false)} className="text-on-surface-variant hover:text-on-surface p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3.5">
              <p className="text-xs text-on-surface-variant">Pegá el contenido CSV. Formato:<br />
                <code className="text-primary bg-surface-container-highest px-1.5 py-0.5 rounded font-mono text-[11px] block mt-1">Nombre, CUIT, Telefono, Email, Contacto, Direccion, Notas</code>
              </p>
              <textarea rows={5} value={csvContent} onChange={(e) => setCsvContent(e.target.value)}
                placeholder={`nombre,cuit,telefono,email,contacto,direccion,notas\nDistribuidora Sur,30-11111111-9,11-5555-5555,ventas@sur.com.ar,Juan,Av Mitre 123,Desc 10%`}
                className={`${inputCls} font-mono text-xs`} />
              <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
                <button onClick={() => setShowCSVModal(false)} className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant">Cancelar</button>
                <button onClick={handleImportCSV} className="px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-sm">Importar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
