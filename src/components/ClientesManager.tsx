import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Users, Plus, Edit2, Trash2, X, Save, Phone, Mail, MapPin, FileSpreadsheet } from 'lucide-react';
import { db, importClientesCSV } from '../db/database';
import { Cliente } from '../core/types';

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

  const inputCls = "w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/70";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Users className="w-4 h-4 text-amber-400" />Directorio de Clientes</h2>
          <p className="text-xs text-slate-500 mt-0.5">Contactos y datos fiscales para tus presupuestos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button onClick={handleExportCSV} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition border border-slate-700/50">
            <FileSpreadsheet className="w-3.5 h-3.5" /><span>Exportar</span>
          </button>
          <button onClick={() => setShowCSVModal(true)} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition border border-slate-700/50">
            <FileSpreadsheet className="w-3.5 h-3.5" /><span>Importar</span>
          </button>
          <button onClick={handleOpenCreate} className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-semibold transition">
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" /><span>Nuevo Cliente</span>
          </button>
        </div>
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
            <form onSubmit={handleSave} onKeyDown={handleKeyDownSequential} className="space-y-3.5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nombre / Razón Social</label>
                <input type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} className={inputCls} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {/* Modal: CSV */}
      {showCSVModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700/50 rounded-xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm"><FileSpreadsheet className="w-4 h-4" />Importar Clientes desde CSV</div>
              <button onClick={() => setShowCSVModal(false)} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3.5">
              <p className="text-xs text-slate-400">Pegá el contenido CSV. Formato:<br />
                <code className="text-amber-400 bg-slate-900/60 px-1.5 py-0.5 rounded font-mono text-[11px] block mt-1">Nombre, CUIT_DNI, CondicionIVA, Telefono, Email, Direccion, Notas</code>
              </p>
              <textarea rows={5} value={csvContent} onChange={(e) => setCsvContent(e.target.value)}
                placeholder={`nombre,cuitDni,condicionIVA,telefono,email,direccion,notas\nJuan Perez,20-11111111-9,Consumidor Final,11-5555-5555,juan@gmail.com,Av Siempre Viva 123,Llamar de tarde`}
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
