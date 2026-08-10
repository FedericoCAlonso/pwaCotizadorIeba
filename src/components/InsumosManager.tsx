import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Package,
  Plus,
  Search,
  TrendingUp,
  History,
  FileSpreadsheet,
  Edit2,
  Trash2,
  X,
  Save,
  Percent,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { db, importInsumosCSV } from '../db/database';
import { Insumo, Proveedor } from '../core/types';
import { formatARS } from '../core/calculations';

export const InsumosManager: React.FC = () => {
  const insumos = useLiveQuery(() => db.insumos.toArray()) || [];
  const proveedores = useLiveQuery(() => db.proveedores.toArray()) || [];
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  
  // Modals state
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [historyInsumo, setHistoryInsumo] = useState<Insumo | null>(null);
  
  const [showMassUpdateModal, setShowMassUpdateModal] = useState(false);
  const [massCategory, setMassCategory] = useState('todas');
  const [massPercentage, setMassPercentage] = useState<number>(10);
  
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvContent, setCsvContent] = useState('');

  // Form State for create/edit
  const [formData, setFormData] = useState<Partial<Insumo>>({
    nombre: '',
    unidad: 'm',
    categoria: 'cableado',
    proveedorPreferido: '',
    codigoProveedor: '',
    precioActual: 0
  });

  const categories = Array.from(new Set(insumos.map((i) => i.categoria).filter(Boolean)));
  // Categorías base del rubro eléctrico
  const BASE_CATEGORIES = ['cableado', 'protecciones', 'cajas', 'canalizaciones', 'accesorios', 'iluminacion', 'insumos', 'tableros', 'medicion'];
  for (const c of BASE_CATEGORIES) {
    if (!categories.includes(c)) categories.push(c);
  }
  categories.sort();

  // Unidades comunes para el rubro
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
    setFormData({
      nombre: '',
      unidad: 'm',
      categoria: 'cableado',
      proveedorPreferido: '',
      codigoProveedor: '',
      precioActual: 0
    });
    setIsCreating(true);
  };

  const handleOpenEdit = (item: Insumo) => {
    setEditingInsumo(item);
    setFormData({ ...item });
  };

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
        historialPrecios: [
          {
            fecha: now,
            precio: formData.precioActual || 0,
            fuente: 'Creación Inicial'
          }
        ]
      };
      await db.insumos.add(newInsumo);
      setIsCreating(false);
    } else if (editingInsumo) {
      const priceChanged = editingInsumo.precioActual !== formData.precioActual;
      const history = [...(editingInsumo.historialPrecios || [])];
      if (priceChanged && formData.precioActual !== undefined) {
        history.unshift({
          fecha: now,
          precio: formData.precioActual,
          fuente: 'Actualización Manual'
        });
      }

      await db.insumos.update(editingInsumo.id, {
        nombre: formData.nombre,
        unidad: formData.unidad,
        categoria: formData.categoria,
        proveedorPreferido: formData.proveedorPreferido,
        codigoProveedor: formData.codigoProveedor,
        precioActual: formData.precioActual,
        fechaActualizacion: priceChanged ? now : editingInsumo.fechaActualizacion,
        historialPrecios: history
      });
      setEditingInsumo(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este insumo del catálogo?')) {
      await db.insumos.delete(id);
    }
  };

  const handleApplyMassUpdate = async () => {
    if (massPercentage === 0) return;
    const now = new Date().toISOString();
    const factor = 1 + massPercentage / 100;

    const targetInsumos = insumos.filter(
      (i) => massCategory === 'todas' || i.categoria === massCategory
    );

    for (const item of targetInsumos) {
      const nuevoPrecio = Math.round(item.precioActual * factor);
      const history = [...(item.historialPrecios || [])];
      history.unshift({
        fecha: now,
        precio: nuevoPrecio,
        fuente: `Aumento Masivo ${massPercentage > 0 ? '+' : ''}${massPercentage}%`
      });

      await db.insumos.update(item.id, {
        precioActual: nuevoPrecio,
        fechaActualizacion: now,
        historialPrecios: history
      });
    }

    setShowMassUpdateModal(false);
    alert(`Se actualizaron los precios de ${targetInsumos.length} insumos correctamente.`);
  };

  const handleImportCSV = async () => {
    if (!csvContent.trim()) return;
    const importedCount = await importInsumosCSV(csvContent);
    alert(`¡Se importaron ${importedCount} insumos desde el CSV!`);
    setCsvContent('');
    setShowCSVModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            <span>Catálogo de Materiales e Insumos</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {insumos.length} ítems registrados (materiales, cables, cajas e insumos consumibles). Precios con trazabilidad.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowMassUpdateModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-lg text-xs font-semibold transition"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Aumento Masivo %</span>
          </button>

          <button
            onClick={() => setShowCSVModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-lg text-xs font-semibold transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Importar CSV</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition shadow-md shadow-amber-500/10"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nuevo Insumo</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por nombre, código o proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setSelectedCategory('todas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              selectedCategory === 'todas'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Todas
          </button>

          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Supplies Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900 text-xs uppercase text-slate-400 border-b border-slate-800 font-semibold">
              <tr>
                <th className="px-4 py-3">Material / Descripción</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Proveedor / Cód.</th>
                <th className="px-4 py-3 text-right">Precio Actual</th>
                <th className="px-4 py-3 text-center">Última Act.</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredInsumos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No se encontraron insumos que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredInsumos.map((item) => {
                  const daysOld = Math.floor(
                    (new Date().getTime() - new Date(item.fechaActualizacion).getTime()) /
                      (1000 * 3600 * 24)
                  );
                  const isStale = daysOld > 45;

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{item.nombre}</div>
                        <div className="text-xs text-slate-500">Unidad: {item.unidad}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-amber-300 border border-amber-500/20 capitalize">
                          {item.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {item.proveedorPreferido || 'Sin proveedor'}
                        {item.codigoProveedor && (
                          <span className="block text-[10px] text-slate-500 font-mono">
                            Cód: {item.codigoProveedor}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                        {formatARS(item.precioActual)}
                        <span className="text-[10px] text-slate-500 font-sans ml-1">/ {item.unidad}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        <div className="flex items-center justify-center gap-1">
                          <span className={isStale ? 'text-amber-400 font-medium' : 'text-slate-400'}>
                            {new Date(item.fechaActualizacion).toLocaleDateString('es-AR')}
                          </span>
                          {isStale && (
                            <span title="Precio no actualizado hace más de 45 días">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block">hace {daysOld} días</span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <button
                          onClick={() => setHistoryInsumo(item)}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition"
                          title="Ver historial de precios"
                          aria-label={`Ver historial de precios de ${item.nombre}`}
                        >
                          <History className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                          title="Editar insumo"
                          aria-label={`Editar insumo ${item.nombre}`}
                        >
                          <Edit2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                          title="Eliminar"
                          aria-label={`Eliminar insumo ${item.nombre}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create or Edit Insumo */}
      {(isCreating || editingInsumo) && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold text-white">
                {isCreating ? 'Agregar Material / Insumo' : 'Editar Material / Insumo'}
              </h3>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingInsumo(null);
                }}
                className="text-slate-400 hover:text-white"
                aria-label="Cerrar formulario"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveInsumo} className="space-y-4">
              {/* Nombre */}
              <div>
                <label htmlFor="form-nombre" className="block text-xs text-slate-300 mb-1">
                  Nombre / Descripción
                </label>
                <input
                  id="form-nombre"
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  placeholder='Ej: Cable unipolar 2.5mm², Cinta aisladora 20m...'
                  required
                />
              </div>

              {/* Categoría + Unidad */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="form-categoria" className="block text-xs text-slate-300 mb-1">
                    Categoría
                    <span className="ml-1 text-slate-500">(o escribí una nueva)</span>
                  </label>
                  <input
                    id="form-categoria"
                    type="text"
                    list="lista-categorias"
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    placeholder="cableado, insumos..."
                    required
                  />
                  <datalist id="lista-categorias">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label htmlFor="form-unidad" className="block text-xs text-slate-300 mb-1">
                    Unidad de Medida
                    <span className="ml-1 text-slate-500">(o escribí una nueva)</span>
                  </label>
                  <input
                    id="form-unidad"
                    type="text"
                    list="lista-unidades"
                    value={formData.unidad}
                    onChange={(e) => setFormData({ ...formData, unidad: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    placeholder="m, u, rollo..."
                    required
                  />
                  <datalist id="lista-unidades">
                    {BASE_UNITS.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Proveedor — combobox con búsqueda desde BD o texto libre */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="form-proveedor" className="block text-xs text-slate-300 mb-1">
                    Proveedor Preferido
                    <span className="ml-1 text-slate-500">(opcional)</span>
                  </label>
                  <input
                    id="form-proveedor"
                    type="text"
                    list="lista-proveedores"
                    value={formData.proveedorPreferido || ''}
                    onChange={(e) => {
                      // Si el usuario seleccionó un proveedor de la lista, no sobreescribimos el código manualmente
                      setFormData({ ...formData, proveedorPreferido: e.target.value });
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    placeholder="Buscar o escribir nombre..."
                  />
                  <datalist id="lista-proveedores">
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.nombre}>
                        {p.cuit ? `CUIT: ${p.cuit}` : ''}
                      </option>
                    ))}
                  </datalist>
                  {proveedores.length === 0 && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      No hay proveedores cargados. Podés agregar desde la pestaña Proveedores.
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="form-codigo" className="block text-xs text-slate-300 mb-1">
                    Código del Proveedor
                    <span className="ml-1 text-slate-500">(opcional)</span>
                  </label>
                  <input
                    id="form-codigo"
                    type="text"
                    value={formData.codigoProveedor || ''}
                    onChange={(e) => setFormData({ ...formData, codigoProveedor: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                    placeholder="SKU, ref. interna..."
                  />
                </div>
              </div>

              {/* Precio */}
              <div>
                <label htmlFor="form-precio" className="block text-xs text-slate-300 mb-1">Precio Actual (ARS)</label>
                <div className="relative">
                  <span className="text-xs text-slate-400 absolute left-3 top-2.5 font-mono font-bold">$</span>
                  <input
                    id="form-precio"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precioActual}
                    onChange={(e) => setFormData({ ...formData, precioActual: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingInsumo(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg"
                >
                  <Save className="w-4 h-4" aria-hidden="true" />
                  <span>Guardar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: History Timeline */}
      {historyInsumo && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-white">{historyInsumo.nombre}</h3>
                <p className="text-xs text-slate-400">Historial de precios registrados</p>
              </div>
              <button onClick={() => setHistoryInsumo(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {historyInsumo.historialPrecios && historyInsumo.historialPrecios.length > 0 ? (
                historyInsumo.historialPrecios.map((h, idx) => (
                  <div key={idx} className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/50 flex justify-between items-center">
                    <div>
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(h.fecha).toLocaleString('es-AR')}</span>
                      </div>
                      <div className="text-[11px] text-amber-400/80 mt-0.5">{h.fuente}</div>
                    </div>
                    <div className="font-mono font-bold text-emerald-400 text-sm">
                      {formatARS(h.precio)}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">No hay historial disponible.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Mass Price Increase */}
      {showMassUpdateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <TrendingUp className="w-5 h-5" />
                <span>Actualización Masiva Porcentual</span>
              </div>
              <button onClick={() => setShowMassUpdateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Categoría a Actualizar</label>
                <select
                  value={massCategory}
                  onChange={(e) => setMassCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 capitalize"
                >
                  <option value="todas">Todas las categorías</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Porcentaje de Ajuste (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={massPercentage}
                    onChange={(e) => setMassPercentage(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-500 pr-8"
                    placeholder="Ej: 15 para +15%"
                  />
                  <Percent className="w-4 h-4 text-slate-500 absolute right-2.5 top-2.5" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Ingresa un valor positivo para aumento o negativo para descuento.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  onClick={() => setShowMassUpdateModal(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleApplyMassUpdate}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-sm"
                >
                  Aplicar Aumento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: CSV Importer */}
      {showCSVModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <FileSpreadsheet className="w-5 h-5" />
                <span>Importación de Lista de Precios en CSV</span>
              </div>
              <button onClick={() => setShowCSVModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-300">
                Pega el contenido del CSV de tu proveedor. El formato por columna debe ser:
                <br />
                <code className="text-amber-400 bg-slate-800 px-1 py-0.5 rounded font-mono block mt-1">
                  Nombre Material, Unidad, Categoria, PrecioActual, CodigoProveedor
                </code>
              </p>

              <textarea
                rows={6}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder={`nombre,unidad,categoria,precioActual,codigoProveedor
Cable Unipolar 2.5mm2,m,cableado,750,CAB-25
Termica 2x16A,u,protecciones,14500,SCH-16`}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  onClick={() => setShowCSVModal(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportCSV}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-sm"
                >
                  Procesar e Importar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
