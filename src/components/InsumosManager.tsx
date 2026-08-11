import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Package, Plus, Search, TrendingUp, History, FileSpreadsheet,
  Edit2, Trash2, X, Save, Percent, Calendar, AlertCircle
} from 'lucide-react';
import { db, importInsumosCSV } from '../db/database';
import { Insumo, Proveedor, OfertaProveedor } from '../core/types';
import { formatARS } from '../core/calculations';

export const InsumosManager: React.FC = () => {
  const insumos = useLiveQuery(() => db.insumos.toArray()) || [];
  const proveedores = useLiveQuery(() => db.proveedores.toArray()) || [];
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [historyInsumo, setHistoryInsumo] = useState<Insumo | null>(null);
  const [showMassUpdateModal, setShowMassUpdateModal] = useState(false);
  const [massCategory, setMassCategory] = useState('todas');
  const [massPercentage, setMassPercentage] = useState<number>(10);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvContent, setCsvContent] = useState('');

  const [formData, setFormData] = useState<Partial<Insumo>>({
    nombre: '', marca: '', modelo: '', unidad: 'm', categoria: 'cableado',
    proveedorPreferido: '', codigoProveedor: '', precioActual: 0, ofertas: []
  });

  const [newOferta, setNewOferta] = useState<Partial<OfertaProveedor>>({
    nombreProveedor: '', precio: 0, notas: ''
  });

  const categories = Array.from(new Set(insumos.map((i) => i.categoria).filter(Boolean)));
  const BASE_CATEGORIES = ['cableado', 'protecciones', 'cajas', 'canalizaciones', 'accesorios', 'iluminacion', 'insumos', 'tableros', 'medicion'];
  for (const c of BASE_CATEGORIES) { if (!categories.includes(c)) categories.push(c); }
  categories.sort();
  const BASE_UNITS = ['m', 'u', 'kg', 'rollo', 'caja', 'par', 'juego', 'litro', 'ml', 'tramo'];

  const filteredInsumos = insumos.filter((item) => {
    const matchesSearch =
      item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.codigoProveedor && item.codigoProveedor.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.proveedorPreferido && item.proveedorPreferido.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCategory === 'todas' || item.categoria === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleOpenCreate = () => {
    setFormData({ nombre: '', marca: '', modelo: '', unidad: 'm', categoria: 'cableado', proveedorPreferido: '', codigoProveedor: '', precioActual: 0, ofertas: [] });
    setNewOferta({ nombreProveedor: '', precio: 0, notas: '' });
    setIsCreating(true);
  };

  const handleOpenEdit = (item: Insumo) => { 
    setEditingInsumo(item); 
    setFormData({ ...item, ofertas: item.ofertas || [] }); 
    setNewOferta({ nombreProveedor: '', precio: 0, notas: '' });
  };

  const handleSaveInsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    if (isCreating) {
      const newInsumo: Insumo = {
        id: `ins-${crypto.randomUUID()}`,
        nombre: formData.nombre || 'Nuevo Insumo',
        marca: formData.marca || undefined,
        modelo: formData.modelo || undefined,
        unidad: formData.unidad || 'u',
        categoria: formData.categoria || 'general',
        proveedorPreferido: formData.proveedorPreferido || undefined,
        codigoProveedor: formData.codigoProveedor || undefined,
        precioActual: formData.precioActual || 0,
        fechaActualizacion: now,
        historialPrecios: [{ fecha: now, precio: formData.precioActual || 0, fuente: 'Creación Inicial' }],
        ofertas: formData.ofertas || []
      };
      await db.insumos.add(newInsumo);
      setIsCreating(false);
    } else if (editingInsumo) {
      const priceChanged = editingInsumo.precioActual !== formData.precioActual;
      const history = [...(editingInsumo.historialPrecios || [])];
      if (priceChanged && formData.precioActual !== undefined) {
        history.unshift({ fecha: now, precio: formData.precioActual, fuente: 'Actualización Manual' });
      }
      await db.insumos.update(editingInsumo.id, {
        nombre: formData.nombre,
        marca: formData.marca,
        modelo: formData.modelo,
        unidad: formData.unidad, 
        categoria: formData.categoria,
        proveedorPreferido: formData.proveedorPreferido, 
        codigoProveedor: formData.codigoProveedor,
        precioActual: formData.precioActual,
        fechaActualizacion: priceChanged ? now : editingInsumo.fechaActualizacion,
        historialPrecios: history,
        ofertas: formData.ofertas
      });
      setEditingInsumo(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este insumo del catálogo?')) await db.insumos.delete(id);
  };

  const handleApplyMassUpdate = async () => {
    if (massPercentage === 0) return;
    const now = new Date().toISOString();
    const factor = 1 + massPercentage / 100;
    const targetInsumos = insumos.filter((i) => massCategory === 'todas' || i.categoria === massCategory);
    for (const item of targetInsumos) {
      const nuevoPrecio = Math.round(item.precioActual * factor);
      const history = [...(item.historialPrecios || [])];
      history.unshift({ fecha: now, precio: nuevoPrecio, fuente: `Aumento Masivo ${massPercentage > 0 ? '+' : ''}${massPercentage}%` });
      await db.insumos.update(item.id, { precioActual: nuevoPrecio, fechaActualizacion: now, historialPrecios: history });
    }
    setShowMassUpdateModal(false);
    alert(`Se actualizaron ${targetInsumos.length} insumos.`);
  };

  const handleImportCSV = async () => {
    if (!csvContent.trim()) return;
    const importedCount = await importInsumosCSV(csvContent);
    alert(`¡Se importaron ${importedCount} insumos desde el CSV!`);
    setCsvContent(''); setShowCSVModal(false);
  };

  const handleExportCSV = () => {
    const header = "nombre,marca,modelo,unidad,categoria,precioActual,codigoProveedor,proveedorPreferido\n";
    const rows = insumos.map(i => {
      const n = (i.nombre || '').replace(/,/g, '');
      const m = (i.marca || '').replace(/,/g, '');
      const mod = (i.modelo || '').replace(/,/g, '');
      const cp = (i.codigoProveedor || '').replace(/,/g, '');
      const pp = (i.proveedorPreferido || '').replace(/,/g, '');
      return `"${n}","${m}","${mod}","${i.unidad}","${i.categoria}","${i.precioActual}","${cp}","${pp}"`;
    }).join('\n');
    
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ieba_insumos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddOferta = () => {
    if (!newOferta.nombreProveedor || !newOferta.precio) return;
    const of: OfertaProveedor = {
      id: `oferta-${crypto.randomUUID()}`,
      nombreProveedor: newOferta.nombreProveedor,
      precio: newOferta.precio,
      notas: newOferta.notas,
      fechaActualizacion: new Date().toISOString()
    };
    setFormData(prev => ({ ...prev, ofertas: [...(prev.ofertas || []), of] }));
    setNewOferta({ nombreProveedor: '', precio: 0, notas: '' });
  };

  const handleRemoveOferta = (id: string) => {
    setFormData(prev => ({ ...prev, ofertas: prev.ofertas?.filter(o => o.id !== id) }));
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
          const nextIndex = elements.indexOf(nextEl) + 1;
          nextEl = elements[nextIndex];
        }
        if (nextEl) nextEl.focus();
      }
    }
  };

  const inputCls = "w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/70";
  const modalCls = "fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4";
  const modalBoxCls = "bg-slate-800 border border-slate-700/50 rounded-xl w-full shadow-2xl p-6";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Catálogo de Materiales e Insumos
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">{insumos.length} ítems registrados</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button onClick={() => setShowMassUpdateModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-on-surface-variant hover:bg-surface-variant rounded-full text-sm font-medium transition-colors border border-outline-variant/30">
            <TrendingUp className="w-4 h-4" /><span>Aumento %</span>
          </button>
          <button onClick={handleExportCSV}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-on-surface-variant hover:bg-surface-variant rounded-full text-sm font-medium transition-colors border border-outline-variant/30">
            <FileSpreadsheet className="w-4 h-4" /><span>Exportar</span>
          </button>
          <button onClick={() => setShowCSVModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-on-surface-variant hover:bg-surface-variant rounded-full text-sm font-medium transition-colors border border-outline-variant/30">
            <FileSpreadsheet className="w-4 h-4" /><span>Importar</span>
          </button>
          <button onClick={handleOpenCreate}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm hover:shadow-md">
            <Plus className="w-4 h-4" /><span>Nuevo Insumo</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-on-surface-variant absolute left-4 top-3" />
          <input type="text" placeholder="Buscar por nombre, código o proveedor..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container-highest border-none rounded-full pl-10 pr-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-on-surface-variant/70 transition-shadow" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setSelectedCategory('todas')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap border border-outline-variant/30 ${selectedCategory === 'todas' ? 'bg-secondary-container text-on-secondary-container border-transparent' : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'}`}>
            Todas
          </button>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize whitespace-nowrap border border-outline-variant/30 ${selectedCategory === cat ? 'bg-secondary-container text-on-secondary-container border-transparent' : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-on-surface">
            <thead className="bg-surface-container text-xs text-on-surface-variant border-b border-outline-variant/30">
              <tr>
                <th className="px-5 py-3.5 font-medium">Material / Descripción</th>
                <th className="px-5 py-3.5 font-medium">Categoría</th>
                <th className="px-5 py-3.5 font-medium">Proveedor</th>
                <th className="px-5 py-3.5 text-right font-medium">Precio Actual</th>
                <th className="px-5 py-3.5 text-center font-medium">Última Act.</th>
                <th className="px-5 py-3.5 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filteredInsumos.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-on-surface-variant text-sm font-medium">No se encontraron insumos.</td></tr>
              ) : (
                filteredInsumos.map((item) => {
                  const daysOld = Math.floor((new Date().getTime() - new Date(item.fechaActualizacion).getTime()) / (1000 * 3600 * 24));
                  const isStale = daysOld > 45;
                  return (
                    <tr key={item.id} className="hover:bg-surface-container-highest/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-on-surface text-sm">{item.nombre}</div>
                        <div className="text-xs text-on-surface-variant mt-0.5 font-mono">{item.unidad}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-medium bg-tertiary-container text-on-tertiary-container capitalize">{item.categoria}</span>
                      </td>
                      <td className="px-5 py-4 text-xs text-on-surface-variant">
                        {item.proveedorPreferido || <span className="text-outline-variant">—</span>}
                        {item.codigoProveedor && <span className="block text-[10px] text-on-surface-variant/70 font-mono mt-1">{item.codigoProveedor}</span>}
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-bold text-primary">
                        {formatARS(item.precioActual)}
                        <span className="text-[10px] text-on-surface-variant font-sans ml-1">/{item.unidad}</span>
                      </td>
                      <td className="px-5 py-4 text-center text-xs">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={isStale ? 'text-error font-medium' : 'text-on-surface-variant'}>
                            {new Date(item.fechaActualizacion).toLocaleDateString('es-AR')}
                          </span>
                          {isStale && <span title="Precio desactualizado (+45 días)"><AlertCircle className="w-3.5 h-3.5 text-error" /></span>}
                        </div>
                        <span className="text-[10px] text-on-surface-variant/70 block mt-0.5">hace {daysOld}d</span>
                      </td>
                      <td className="px-5 py-4 text-right space-x-1">
                        <button onClick={() => setHistoryInsumo(item)} className="p-2 rounded-full hover:bg-surface-variant text-on-surface-variant hover:text-primary transition-colors" title="Ver historial" aria-label={`Historial de ${item.nombre}`}><History className="w-4 h-4" /></button>
                        <button onClick={() => handleOpenEdit(item)} className="p-2 rounded-full hover:bg-surface-variant text-on-surface-variant hover:text-on-surface transition-colors" title="Editar" aria-label={`Editar ${item.nombre}`}><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 rounded-full hover:bg-surface-variant text-on-surface-variant hover:text-error transition-colors" title="Eliminar" aria-label={`Eliminar ${item.nombre}`}><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(isCreating || editingInsumo) && (
        <div className={modalCls}>
          <div className={`${modalBoxCls} max-w-2xl max-h-[90vh] overflow-y-auto no-scrollbar`}>
            <div className="flex items-center justify-between mb-5 sticky top-0 bg-slate-800 py-2 z-10 border-b border-slate-700/50">
              <h3 className="text-base font-semibold text-white">{isCreating ? 'Agregar Material / Insumo' : 'Editar Material / Insumo'}</h3>
              <button onClick={() => { setIsCreating(false); setEditingInsumo(null); }} className="text-slate-500 hover:text-white p-1" aria-label="Cerrar"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveInsumo} onKeyDown={handleKeyDownSequential} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nombre / Descripción</label>
                <input id="form-nombre" type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} className={inputCls} placeholder="Ej: Cable unipolar 2.5mm²" required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Marca <span className="text-slate-600">(opc)</span></label>
                  <input id="form-marca" type="text" value={formData.marca || ''} onChange={(e) => setFormData({ ...formData, marca: e.target.value })} className={inputCls} placeholder="Prysmian, Schneider..." />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Modelo <span className="text-slate-600">(opc)</span></label>
                  <input id="form-modelo" type="text" value={formData.modelo || ''} onChange={(e) => setFormData({ ...formData, modelo: e.target.value })} className={inputCls} placeholder="Acti9, Afumex..." />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Categoría</label>
                  <input id="form-categoria" type="text" list="lista-categorias" value={formData.categoria} onChange={(e) => setFormData({ ...formData, categoria: e.target.value })} className={inputCls} required />
                  <datalist id="lista-categorias">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Unidad</label>
                  <input id="form-unidad" type="text" list="lista-unidades" value={formData.unidad} onChange={(e) => setFormData({ ...formData, unidad: e.target.value })} className={inputCls} required />
                  <datalist id="lista-unidades">{BASE_UNITS.map((u) => <option key={u} value={u} />)}</datalist>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Proveedor <span className="text-slate-600">(opcional)</span></label>
                  <input id="form-proveedor" type="text" list="lista-proveedores" value={formData.proveedorPreferido || ''} onChange={(e) => setFormData({ ...formData, proveedorPreferido: e.target.value })} className={inputCls} placeholder="Buscar o escribir..." />
                  <datalist id="lista-proveedores">{proveedores.map((p) => <option key={p.id} value={p.nombre}>{p.cuit ? `CUIT: ${p.cuit}` : ''}</option>)}</datalist>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Código <span className="text-slate-600">(opcional)</span></label>
                  <input id="form-codigo" type="text" value={formData.codigoProveedor || ''} onChange={(e) => setFormData({ ...formData, codigoProveedor: e.target.value })} className={`${inputCls} font-mono`} placeholder="SKU, ref..." />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Precio Actual / Base (ARS)</label>
                <div className="relative">
                  <span className="text-xs text-slate-500 absolute left-3 top-2.5 font-mono">$</span>
                  <input id="form-precio" type="number" step="0.01" min="0" value={formData.precioActual} onChange={(e) => setFormData({ ...formData, precioActual: parseFloat(e.target.value) || 0 })} className={`${inputCls} pl-7 font-mono text-amber-400 font-bold`} required />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Este es el precio que se usará por defecto al cotizar tareas.</p>
              </div>

              {/* Ofertas Multi-Proveedor */}
              <div className="pt-4 border-t border-slate-700/40 space-y-3">
                <h4 className="text-sm font-semibold text-slate-300">Ofertas de Proveedores <span className="text-xs text-slate-500 font-normal">({formData.ofertas?.length || 0})</span></h4>
                
                {formData.ofertas && formData.ofertas.length > 0 && (
                  <div className="space-y-2">
                    {formData.ofertas.map(of => (
                      <div key={of.id} className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/50 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex-1 min-w-[120px]">
                          <div className="text-xs font-semibold text-slate-200">{of.nombreProveedor}</div>
                          {of.notas && <div className="text-[10px] text-slate-500 truncate">{of.notas}</div>}
                        </div>
                        <div className="font-mono text-sm text-emerald-400 font-bold">{formatARS(of.precio)}</div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setFormData({ ...formData, precioActual: of.precio })} className="p-1 text-xs text-amber-500 hover:bg-slate-800 rounded px-2 transition-colors" title="Usar este precio como Base">Fijar Base</button>
                          <button type="button" onClick={() => handleRemoveOferta(of.id)} className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors" title="Eliminar oferta"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-[10px] text-slate-400 mb-1">Proveedor (Oferta)</label>
                    <input type="text" list="lista-proveedores" value={newOferta.nombreProveedor || ''} onChange={e => setNewOferta({ ...newOferta, nombreProveedor: e.target.value })} className={inputCls} placeholder="Nombre..." />
                  </div>
                  <div className="w-28">
                    <label className="block text-[10px] text-slate-400 mb-1">Precio</label>
                    <input type="number" value={newOferta.precio || ''} onChange={e => setNewOferta({ ...newOferta, precio: parseFloat(e.target.value) || 0 })} className={`${inputCls} font-mono`} placeholder="$" />
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <label className="block text-[10px] text-slate-400 mb-1">Notas</label>
                    <input type="text" value={newOferta.notas || ''} onChange={e => setNewOferta({ ...newOferta, notas: e.target.value })} className={inputCls} placeholder="Ej: Solo efvo" />
                  </div>
                  <button type="button" onClick={handleAddOferta} className="h-9 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-700/40 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsCreating(false); setEditingInsumo(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700/50">Cancelar</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm"><Save className="w-3.5 h-3.5" />Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: History */}
      {historyInsumo && (
        <div className={modalCls}>
          <div className={`${modalBoxCls} max-w-md`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">{historyInsumo.nombre}</h3>
                <p className="text-xs text-slate-500">Historial de precios</p>
              </div>
              <button onClick={() => setHistoryInsumo(null)} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {historyInsumo.historialPrecios && historyInsumo.historialPrecios.length > 0 ? (
                historyInsumo.historialPrecios.map((h, idx) => (
                  <div key={idx} className="bg-slate-900/60 p-3 rounded-lg flex justify-between items-center">
                    <div>
                      <div className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(h.fecha).toLocaleString('es-AR')}</div>
                      <div className="text-[11px] text-amber-400/70 mt-0.5">{h.fuente}</div>
                    </div>
                    <div className="font-mono font-semibold text-emerald-400 text-sm">{formatARS(h.precio)}</div>
                  </div>
                ))
              ) : <p className="text-xs text-slate-600 text-center py-4">Sin historial.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Mass Update */}
      {showMassUpdateModal && (
        <div className={modalCls}>
          <div className={`${modalBoxCls} max-w-md`}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm"><TrendingUp className="w-4 h-4" />Actualización Masiva Porcentual</div>
              <button onClick={() => setShowMassUpdateModal(false)} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Categoría</label>
                <select value={massCategory} onChange={(e) => setMassCategory(e.target.value)} className={`${inputCls} capitalize`}>
                  <option value="todas">Todas las categorías</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Porcentaje (%)</label>
                <div className="relative">
                  <input type="number" step="0.1" value={massPercentage} onChange={(e) => setMassPercentage(parseFloat(e.target.value) || 0)} className={`${inputCls} font-mono pr-8`} />
                  <Percent className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
                </div>
                <p className="text-[11px] text-slate-600 mt-1">Positivo para aumento, negativo para descuento.</p>
              </div>
              <div className="pt-3 border-t border-slate-700/40 flex justify-end gap-2">
                <button onClick={() => setShowMassUpdateModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700/50">Cancelar</button>
                <button onClick={handleApplyMassUpdate} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm">Aplicar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: CSV */}
      {showCSVModal && (
        <div className={modalCls}>
          <div className={`${modalBoxCls} max-w-lg`}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm"><FileSpreadsheet className="w-4 h-4" />Importar CSV de Precios</div>
              <button onClick={() => setShowCSVModal(false)} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3.5">
              <p className="text-xs text-slate-400">Pegá el contenido CSV. Formato:<br />
                <code className="text-amber-400 bg-slate-900/60 px-1.5 py-0.5 rounded font-mono text-[11px] block mt-1">Nombre, Marca, Modelo, Unidad, Categoria, PrecioActual, CodigoProveedor</code>
              </p>
              <textarea rows={5} value={csvContent} onChange={(e) => setCsvContent(e.target.value)}
                placeholder={`nombre,marca,modelo,unidad,categoria,precioActual,codigoProveedor\nCable Unipolar 2.5mm2,Prysmian,,m,cableado,750,CAB-25`}
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
