import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Package, Plus, Search, TrendingUp, History, FileSpreadsheet,
  Edit2, Trash2, X, Save, Percent, Calendar, AlertCircle
} from 'lucide-react';
import { db, importInsumosCSV } from '../db/database';
import { Insumo, Proveedor } from '../core/types';
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
    nombre: '', unidad: 'm', categoria: 'cableado',
    proveedorPreferido: '', codigoProveedor: '', precioActual: 0
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
    setFormData({ nombre: '', unidad: 'm', categoria: 'cableado', proveedorPreferido: '', codigoProveedor: '', precioActual: 0 });
    setIsCreating(true);
  };

  const handleOpenEdit = (item: Insumo) => { setEditingInsumo(item); setFormData({ ...item }); };

  const handleSaveInsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    if (isCreating) {
      const newInsumo: Insumo = {
        id: `ins-${crypto.randomUUID()}`,
        nombre: formData.nombre || 'Nuevo Insumo',
        unidad: formData.unidad || 'u',
        categoria: formData.categoria || 'general',
        proveedorPreferido: formData.proveedorPreferido || undefined,
        codigoProveedor: formData.codigoProveedor || undefined,
        precioActual: formData.precioActual || 0,
        fechaActualizacion: now,
        historialPrecios: [{ fecha: now, precio: formData.precioActual || 0, fuente: 'Creación Inicial' }]
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
        nombre: formData.nombre, unidad: formData.unidad, categoria: formData.categoria,
        proveedorPreferido: formData.proveedorPreferido, codigoProveedor: formData.codigoProveedor,
        precioActual: formData.precioActual,
        fechaActualizacion: priceChanged ? now : editingInsumo.fechaActualizacion,
        historialPrecios: history
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

  const inputCls = "w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/70";
  const modalCls = "fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4";
  const modalBoxCls = "bg-slate-800 border border-slate-700/50 rounded-xl w-full shadow-2xl p-6";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-400" />
            Catálogo de Materiales e Insumos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{insumos.length} ítems registrados</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button onClick={() => setShowMassUpdateModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-amber-400 hover:bg-slate-800/60 rounded-lg text-xs font-medium transition border border-slate-700/40">
            <TrendingUp className="w-3.5 h-3.5" /><span>Aumento %</span>
          </button>
          <button onClick={() => setShowCSVModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-emerald-400 hover:bg-slate-800/60 rounded-lg text-xs font-medium transition border border-slate-700/40">
            <FileSpreadsheet className="w-3.5 h-3.5" /><span>Importar CSV</span>
          </button>
          <button onClick={handleOpenCreate}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-semibold transition">
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" /><span>Nuevo Insumo</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input type="text" placeholder="Buscar por nombre, código o proveedor..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700/40 rounded-lg pl-8.5 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500/70 placeholder:text-slate-600" />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button onClick={() => setSelectedCategory('todas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${selectedCategory === 'todas' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'}`}>
            Todas
          </button>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize whitespace-nowrap ${selectedCategory === cat ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-800/50 text-xs text-slate-500 border-b border-slate-700/30">
              <tr>
                <th className="px-4 py-2.5 font-medium">Material / Descripción</th>
                <th className="px-4 py-2.5 font-medium">Categoría</th>
                <th className="px-4 py-2.5 font-medium">Proveedor</th>
                <th className="px-4 py-2.5 text-right font-medium">Precio Actual</th>
                <th className="px-4 py-2.5 text-center font-medium">Última Act.</th>
                <th className="px-4 py-2.5 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {filteredInsumos.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-600 text-xs">No se encontraron insumos.</td></tr>
              ) : (
                filteredInsumos.map((item) => {
                  const daysOld = Math.floor((new Date().getTime() - new Date(item.fechaActualizacion).getTime()) / (1000 * 3600 * 24));
                  const isStale = daysOld > 45;
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white text-sm">{item.nombre}</div>
                        <div className="text-xs text-slate-500">{item.unidad}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 capitalize">{item.categoria}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {item.proveedorPreferido || <span className="text-slate-600">—</span>}
                        {item.codigoProveedor && <span className="block text-[10px] text-slate-600 font-mono">{item.codigoProveedor}</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-400">
                        {formatARS(item.precioActual)}
                        <span className="text-[10px] text-slate-500 font-sans ml-1">/{item.unidad}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        <div className="flex items-center justify-center gap-1">
                          <span className={isStale ? 'text-amber-400' : 'text-slate-500'}>
                            {new Date(item.fechaActualizacion).toLocaleDateString('es-AR')}
                          </span>
                          {isStale && <AlertCircle className="w-3 h-3 text-amber-400" title="Precio desactualizado (+45 días)" />}
                        </div>
                        <span className="text-[10px] text-slate-600 block">hace {daysOld}d</span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-0.5">
                        <button onClick={() => setHistoryInsumo(item)} className="p-1.5 rounded hover:bg-slate-700/50 text-slate-500 hover:text-amber-400 transition" title="Ver historial" aria-label={`Historial de ${item.nombre}`}><History className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleOpenEdit(item)} className="p-1.5 rounded hover:bg-slate-700/50 text-slate-500 hover:text-white transition" title="Editar" aria-label={`Editar ${item.nombre}`}><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-slate-700/50 text-slate-500 hover:text-rose-400 transition" title="Eliminar" aria-label={`Eliminar ${item.nombre}`}><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create/Edit */}
      {(isCreating || editingInsumo) && (
        <div className={modalCls}>
          <div className={`${modalBoxCls} max-w-lg`}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-white">{isCreating ? 'Agregar Material / Insumo' : 'Editar Material / Insumo'}</h3>
              <button onClick={() => { setIsCreating(false); setEditingInsumo(null); }} className="text-slate-500 hover:text-white p-1" aria-label="Cerrar"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveInsumo} className="space-y-3.5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nombre / Descripción</label>
                <input id="form-nombre" type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} className={inputCls} placeholder="Ej: Cable unipolar 2.5mm²" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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
                <label className="block text-xs text-slate-400 mb-1">Precio Actual (ARS)</label>
                <div className="relative">
                  <span className="text-xs text-slate-500 absolute left-3 top-2.5 font-mono">$</span>
                  <input id="form-precio" type="number" step="0.01" min="0" value={formData.precioActual} onChange={(e) => setFormData({ ...formData, precioActual: parseFloat(e.target.value) || 0 })} className={`${inputCls} pl-7 font-mono`} required />
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
                <code className="text-amber-400 bg-slate-900/60 px-1.5 py-0.5 rounded font-mono text-[11px] block mt-1">Nombre, Unidad, Categoria, PrecioActual, CodigoProveedor</code>
              </p>
              <textarea rows={5} value={csvContent} onChange={(e) => setCsvContent(e.target.value)}
                placeholder={`nombre,unidad,categoria,precioActual,codigoProveedor\nCable Unipolar 2.5mm2,m,cableado,750,CAB-25`}
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
