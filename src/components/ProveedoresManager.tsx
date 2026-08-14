import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Truck, Plus, Edit2, Trash2, X, Save, Phone, Mail, User, FileSpreadsheet, MessageCircle, Globe, UserPlus } from 'lucide-react';
import { db, importProveedoresCSV, softDelete } from '../db/database';
import { Proveedor } from '../core/types';
import { TIPOS_PROVEEDOR } from '../core/sampleData';

export const ProveedoresManager: React.FC = () => {
  const proveedores = (useLiveQuery(() => db.proveedores.toArray()) || []).filter((p) => !p.deleted);
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvContent, setCsvContent] = useState('');

  const [formData, setFormData] = useState<Partial<Proveedor>>({
    razonSocial: '',
    cuit: '',
    tipoProveedor: 'material',
    contactos: [],
    notas: ''
  });

  const handleImportFromContacts = async () => {
    if (!('contacts' in navigator && 'select' in (navigator as any).contacts)) {
      alert('La importación de contactos desde la agenda no está disponible en este dispositivo/navegador. Puedes ingresar los datos manualmente.');
      return;
    }
    try {
      const contacts = await (navigator as any).contacts.select(['name', 'tel', 'email'], { multiple: false });
      if (contacts && contacts.length > 0) {
        const c = contacts[0];
        const nameVal = (c.name && c.name[0]) || '';
        const phoneVal = (c.tel && c.tel[0]) || '';
        const emailVal = (c.email && c.email[0]) || '';

        setFormData(prev => ({
          ...prev,
          razonSocial: prev.razonSocial || nameVal,
          contacto: nameVal || prev.contacto,
          telefono: phoneVal || prev.telefono,
          email: emailVal || prev.email
        }));
      }
    } catch (err) {
      console.log('Contacto no seleccionado:', err);
    }
  };

  const handleOpenCreate = () => {
    setFormData({
      razonSocial: '',
      cuit: '',
      tipoProveedor: 'material',
      contactos: [],
      notas: ''
    });
    setIsCreating(true);
  };

  const handleOpenEdit = (p: Proveedor) => {
    setEditingProveedor(p);
    setFormData({ ...p });
  };

  const handleAddContacto = () => {
    setFormData(prev => ({
      ...prev,
      contactos: [
        ...(prev.contactos || []),
        { id: `cnt-${crypto.randomUUID()}`, nombrePersona: '', rol: 'Ventas', canales: [{ tipo: 'telefono', valor: '', esPrincipal: true }] }
      ]
    }));
  };

  const handleRemoveContacto = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      contactos: (prev.contactos || []).filter((_, i) => i !== idx)
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const razonSocial = formData.razonSocial || 'Nuevo Proveedor';
    const contactosClean = (formData.contactos || []).filter(c => c.nombrePersona.trim() || c.canales.some(cn => cn.valor.trim()));
    const now = new Date().toISOString();

    if (isCreating) {
      await db.proveedores.add({
        id: `prov-${crypto.randomUUID()}`,
        razonSocial,
        nombre: razonSocial,
        cuit: formData.cuit,
        tipoProveedor: formData.tipoProveedor || 'material',
        contactos: contactosClean,
        notas: formData.notas,
        createdAt: now,
        updatedAt: now,
        deleted: false
      });
      setIsCreating(false);
    } else if (editingProveedor) {
      await db.proveedores.update(editingProveedor.id, {
        razonSocial,
        nombre: razonSocial,
        cuit: formData.cuit,
        tipoProveedor: formData.tipoProveedor || 'material',
        contactos: contactosClean,
        notas: formData.notas,
        updatedAt: now
      });
      setEditingProveedor(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este proveedor?')) {
      await softDelete('proveedores', id);
    }
  };

  const handleImportCSV = async () => {
    if (!csvContent.trim()) return;
    const importedCount = await importProveedoresCSV(csvContent);
    alert(`¡Se importaron ${importedCount} proveedores desde el CSV!`);
    setCsvContent('');
    setShowCSVModal(false);
  };

  const handleExportCSV = () => {
    const header = "razonSocial,cuit,telefono,email,contacto,direccion,notas\n";
    const rows = proveedores.map(p => {
      const r = (p.razonSocial || p.nombre || '').replace(/,/g, '');
      const ct = (p.cuit || '').replace(/,/g, '');
      const mainPhone = p.contactos?.[0]?.canales?.find(c => c.tipo === 'telefono' || c.tipo === 'whatsapp')?.valor || p.telefono || '';
      const mainEmail = p.contactos?.[0]?.canales?.find(c => c.tipo === 'email')?.valor || p.email || '';
      const cName = p.contactos?.[0]?.nombrePersona || p.contacto || '';
      const d = (p.direccion || '').replace(/,/g, '');
      const no = (p.notas || '').replace(/,/g, '');
      return `"${r}","${ct}","${mainPhone}","${mainEmail}","${cName}","${d}","${no}"`;
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

  const formatWhatsAppUrl = (phoneVal: string) => {
    const digits = phoneVal.replace(/[^\d]/g, '');
    return `https://wa.me/${digits}`;
  };

  const inputCls = "w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-on-surface-variant/70 transition-shadow";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />Directorio de Proveedores & Contactos
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">Distribuidores, agentes comerciales y canales directos.</p>
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
                    <h3 className="font-semibold text-on-surface text-base">{prov.razonSocial || prov.nombre}</h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container capitalize">
                      {prov.tipoProveedor || 'material'}
                    </span>
                  </div>
                  {prov.cuit && <span className="text-xs font-mono text-on-surface-variant block mt-1">CUIT: {prov.cuit}</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleOpenEdit(prov)} className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors" aria-label={`Editar ${prov.razonSocial || prov.nombre}`}><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(prov.id)} className="p-2 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors" aria-label={`Eliminar ${prov.razonSocial || prov.nombre}`}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Contactos y Canales */}
              <div className="mt-4 space-y-3 border-t border-outline-variant/20 pt-3">
                {prov.contactos && prov.contactos.length > 0 ? (
                  prov.contactos.map((cnt) => (
                    <div key={cnt.id} className="bg-surface-container-highest/40 p-3 rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-primary" />{cnt.nombrePersona || 'Sin Nombre'}
                        </span>
                        {cnt.rol && <span className="text-[10px] text-on-surface-variant/80 bg-surface-container px-2 py-0.5 rounded-full">{cnt.rol}</span>}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {cnt.canales.map((can, idx) => {
                          if (!can.valor) return null;
                          if (can.tipo === 'whatsapp') {
                            return (
                              <a key={idx} href={formatWhatsAppUrl(can.valor)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded-xl transition-colors">
                                <MessageCircle className="w-3 h-3" /> WhatsApp
                              </a>
                            );
                          }
                          if (can.tipo === 'email') {
                            return (
                              <a key={idx} href={`mailto:${can.valor}`} className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-xl transition-colors">
                                <Mail className="w-3 h-3" /> Email
                              </a>
                            );
                          }
                          if (can.tipo === 'telefono') {
                            return (
                              <a key={idx} href={`tel:${can.valor}`} className="inline-flex items-center gap-1 text-[11px] font-medium text-on-surface-variant bg-surface-container px-2 py-1 rounded-xl hover:bg-surface-variant transition-colors">
                                <Phone className="w-3 h-3" /> {can.valor}
                              </a>
                            );
                          }
                          return (
                            <a key={idx} href={can.valor} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-tertiary bg-tertiary/10 px-2 py-1 rounded-xl hover:bg-tertiary/20 transition-colors">
                              <Globe className="w-3 h-3" /> Web
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-on-surface-variant/70 italic">Sin contactos directos cargados.</div>
                )}
              </div>
            </div>
            {prov.notas && <p className="mt-3 text-xs text-on-surface-variant bg-surface-container-highest/60 p-3 rounded-2xl">{prov.notas}</p>}
          </div>
        ))}
      </div>

      {/* Modal Edición/Creación */}
      {(isCreating || editingProveedor) && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-lg shadow-2xl p-6 text-on-surface max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5 border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-on-surface">{isCreating ? 'Agregar Proveedor' : 'Editar Proveedor'}</h3>
                {'contacts' in navigator && (
                  <button
                    type="button"
                    onClick={handleImportFromContacts}
                    className="flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-full transition-colors"
                    title="Importar de los contactos del teléfono"
                  >
                    <UserPlus className="w-3 h-3" /> Agenda
                  </button>
                )}
              </div>
              <button onClick={() => { setIsCreating(false); setEditingProveedor(null); }} className="text-on-surface-variant hover:text-on-surface p-1"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Razón Social / Distribuidora</label>
                <input type="text" value={formData.razonSocial || ''} onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })} className={inputCls} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Rubro</label>
                  <select value={formData.tipoProveedor || 'material'} onChange={(e) => setFormData({ ...formData, tipoProveedor: e.target.value as any })} className={inputCls}>
                    {TIPOS_PROVEEDOR.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">CUIT</label>
                  <input type="text" value={formData.cuit || ''} onChange={(e) => setFormData({ ...formData, cuit: e.target.value })} className={`${inputCls} font-mono`} />
                </div>
              </div>

              {/* Sección de Contactos */}
              <div className="border-t border-outline-variant/30 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Contactos & Canales</h4>
                  <button
                    type="button"
                    onClick={() => {
                      const list = formData.contactos || [];
                      setFormData({
                        ...formData,
                        contactos: [
                          ...list,
                          {
                            id: crypto.randomUUID(),
                            nombrePersona: '',
                            rol: 'Ventas',
                            canales: [{ tipo: 'whatsapp', valor: '', esPrincipal: true }]
                          }
                        ]
                      });
                    }}
                    className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Persona
                  </button>
                </div>

                {(formData.contactos || []).map((cnt, cIdx) => (
                  <div key={cnt.id || cIdx} className="p-3 bg-surface-container-highest/50 border border-outline-variant/30 rounded-2xl space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Nombre de la persona"
                        value={cnt.nombrePersona}
                        onChange={(e) => {
                          const updated = [...(formData.contactos || [])];
                          updated[cIdx].nombrePersona = e.target.value;
                          setFormData({ ...formData, contactos: updated });
                        }}
                        className={inputCls}
                      />
                      <input
                        type="text"
                        placeholder="Rol (Ventas, Técnico...)"
                        value={cnt.rol || ''}
                        onChange={(e) => {
                          const updated = [...(formData.contactos || [])];
                          updated[cIdx].rol = e.target.value;
                          setFormData({ ...formData, contactos: updated });
                        }}
                        className={inputCls}
                      />
                    </div>

                    {/* Canales de la persona */}
                    {cnt.canales.map((can, canIdx) => (
                      <div key={canIdx} className="flex items-center gap-2">
                        <select
                          value={can.tipo}
                          onChange={(e) => {
                            const updated = [...(formData.contactos || [])];
                            updated[cIdx].canales[canIdx].tipo = e.target.value as any;
                            setFormData({ ...formData, contactos: updated });
                          }}
                          className="bg-surface-container border border-outline-variant/30 rounded-xl px-2 py-1.5 text-xs text-on-surface"
                        >
                          <option value="whatsapp">WhatsApp</option>
                          <option value="email">Email</option>
                          <option value="telefono">Teléfono</option>
                          <option value="web">Web</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Número / Email / URL"
                          value={can.valor}
                          onChange={(e) => {
                            const updated = [...(formData.contactos || [])];
                            updated[cIdx].canales[canIdx].valor = e.target.value;
                            setFormData({ ...formData, contactos: updated });
                          }}
                          className={`${inputCls} py-1 text-xs`}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Notas / Condiciones Comercializables</label>
                <textarea rows={2} value={formData.notas || ''} onChange={(e) => setFormData({ ...formData, notas: e.target.value })} className={inputCls} placeholder="Ej: Descuento 8% contado." />
              </div>

              <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsCreating(false); setEditingProveedor(null); }} className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant">Cancelar</button>
                <button type="submit" className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-sm shadow-sm"><Save className="w-3.5 h-3.5" />Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal CSV */}
      {showCSVModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-lg shadow-2xl p-6 text-on-surface">
            <div className="flex items-center justify-between mb-5 border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2 text-tertiary font-semibold text-sm"><FileSpreadsheet className="w-4 h-4" />Importar Proveedores desde CSV</div>
              <button onClick={() => setShowCSVModal(false)} className="text-on-surface-variant hover:text-on-surface p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3.5">
              <p className="text-xs text-on-surface-variant">Pegá el contenido CSV:<br />
                <code className="text-primary bg-surface-container-highest px-1.5 py-0.5 rounded font-mono text-[11px] block mt-1">RazonSocial, CUIT, Telefono, Email, Contacto, Direccion, Notas</code>
              </p>
              <textarea rows={5} value={csvContent} onChange={(e) => setCsvContent(e.target.value)} className={`${inputCls} font-mono text-xs`} />
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
