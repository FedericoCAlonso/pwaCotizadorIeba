import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Users, Plus, Edit2, Trash2, X, Save, Phone, Mail, MapPin, FileSpreadsheet } from 'lucide-react';
import { db, importClientesCSV } from '../db/database';
import { Cliente } from '../core/types';
import { CONDICIONES_IVA } from '../core/sampleData';

export const ClientesManager: React.FC = () => {
  const clientes = useLiveQuery(() => db.clientes.toArray()) || [];
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvContent, setCsvContent] = useState('');
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

  const handleImportCSV = async () => {
    if (!csvContent.trim()) return;
    const importedCount = await importClientesCSV(csvContent);
    alert(`¡Se importaron ${importedCount} clientes desde el CSV!`);
    setCsvContent(''); setShowCSVModal(false);
  };

  const handleExportCSV = () => {
    const header = "nombre,cuitDni,condicionIVA,telefono,email,direccion,notas\n";
    const rows = clientes.map(c => {
      const n = (c.nombre || '').replace(/,/g, '');
      const ct = (c.cuitDni || '').replace(/,/g, '');
      const iva = (c.condicionIVA || '').replace(/,/g, '');
      const t = (c.telefono || '').replace(/,/g, '');
      const e = (c.email || '').replace(/,/g, '');
      const d = (c.direccion || '').replace(/,/g, '');
      const no = (c.notas || '').replace(/,/g, '');
      return `"${n}","${ct}","${iva}","${t}","${e}","${d}","${no}"`;
    }).join('\n');
    
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ieba_clientes_${new Date().toISOString().split('T')[0]}.csv`);
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
          <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2"><Users className="w-5 h-5 text-primary" />Directorio de Clientes</h2>
          <p className="text-sm text-on-surface-variant mt-1">Contactos y datos fiscales para tus presupuestos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button onClick={handleExportCSV} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-on-surface-variant hover:bg-surface-variant rounded-full text-sm font-medium transition-colors border border-outline-variant/30">
            <FileSpreadsheet className="w-4 h-4" /><span>Exportar</span>
          </button>
          <button onClick={() => setShowCSVModal(true)} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-on-surface-variant hover:bg-surface-variant rounded-full text-sm font-medium transition-colors border border-outline-variant/30">
            <FileSpreadsheet className="w-4 h-4" /><span>Importar</span>
          </button>
          <button onClick={handleOpenCreate} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm">
            <Plus className="w-4 h-4" /><span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clientes.map((cliente) => (
          <div key={cliente.id} className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 hover:bg-surface-container/60 transition-all flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-on-surface text-base">{cliente.nombre}</h3>
                  {cliente.cuitDni && <span className="text-xs font-mono text-on-surface-variant block mt-1">CUIT/DNI: {cliente.cuitDni}</span>}
                  {cliente.condicionIVA && <span className="inline-block mt-2 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">{cliente.condicionIVA}</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleOpenEdit(cliente)} className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors" aria-label={`Editar ${cliente.nombre}`}><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(cliente.id)} className="p-2 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors" aria-label={`Eliminar ${cliente.nombre}`}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs text-on-surface-variant border-t border-outline-variant/20 pt-3">
                {cliente.telefono && <div className="flex items-center gap-2.5"><Phone className="w-3.5 h-3.5 text-primary" />{cliente.telefono}</div>}
                {cliente.email && <div className="flex items-center gap-2.5"><Mail className="w-3.5 h-3.5 text-primary" />{cliente.email}</div>}
                {cliente.direccion && <div className="flex items-center gap-2.5"><MapPin className="w-3.5 h-3.5 text-primary" />{cliente.direccion}</div>}
              </div>
            </div>
            {cliente.notas && <p className="mt-3 text-xs text-on-surface-variant bg-surface-container-highest/60 p-3 rounded-2xl">{cliente.notas}</p>}
          </div>
        ))}
      </div>

      {(isCreating || editingCliente) && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-md shadow-2xl p-6 text-on-surface">
            <div className="flex items-center justify-between mb-5 border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-semibold text-on-surface">{isCreating ? 'Agregar Nuevo Cliente' : 'Editar Cliente'}</h3>
              <button onClick={() => { setIsCreating(false); setEditingCliente(null); }} className="text-on-surface-variant hover:text-on-surface p-1"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSave} onKeyDown={handleKeyDownSequential} className="space-y-4">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Nombre / Razón Social</label>
                <input type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} className={inputCls} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">CUIT / DNI</label>
                  <input type="text" value={formData.cuitDni} onChange={(e) => setFormData({ ...formData, cuitDni: e.target.value })} className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Condición IVA</label>
                  <select value={formData.condicionIVA || 'Consumidor Final'} onChange={(e) => setFormData({ ...formData, condicionIVA: e.target.value as any })} className={inputCls}>
                    {CONDICIONES_IVA.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-xs text-on-surface-variant mb-1">Teléfono</label><input type="text" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} className={inputCls} /></div>
                <div><label className="block text-xs text-on-surface-variant mb-1">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputCls} /></div>
              </div>
              <div><label className="block text-xs text-on-surface-variant mb-1">Dirección</label><input type="text" value={formData.direccion} onChange={(e) => setFormData({ ...formData, direccion: e.target.value })} className={inputCls} /></div>
              <div><label className="block text-xs text-on-surface-variant mb-1">Notas</label><textarea rows={2} value={formData.notas} onChange={(e) => setFormData({ ...formData, notas: e.target.value })} className={inputCls} /></div>
              <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsCreating(false); setEditingCliente(null); }} className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant">Cancelar</button>
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
              <div className="flex items-center gap-2 text-tertiary font-semibold text-sm"><FileSpreadsheet className="w-4 h-4" />Importar Clientes desde CSV</div>
              <button onClick={() => setShowCSVModal(false)} className="text-on-surface-variant hover:text-on-surface p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3.5">
              <p className="text-xs text-on-surface-variant">Pegá el contenido CSV. Formato:<br />
                <code className="text-primary bg-surface-container-highest px-1.5 py-0.5 rounded font-mono text-[11px] block mt-1">Nombre, CUIT_DNI, CondicionIVA, Telefono, Email, Direccion, Notas</code>
              </p>
              <textarea rows={5} value={csvContent} onChange={(e) => setCsvContent(e.target.value)}
                placeholder={`nombre,cuitDni,condicionIVA,telefono,email,direccion,notas\nJuan Perez,20-11111111-9,Consumidor Final,11-5555-5555,juan@gmail.com,Av Siempre Viva 123,Llamar de tarde`}
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
