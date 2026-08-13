import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Package, Plus, Search, TrendingUp, History, FileSpreadsheet,
  Edit2, Trash2, X, Save, Percent, Calendar, AlertCircle, Camera, CheckCircle2, Clock, ShieldAlert, Truck
} from 'lucide-react';
import { db, importInsumosCSV } from '../db/database';
import { Insumo, Proveedor, OfertaProveedor, IndiceReferencia } from '../core/types';
import { formatARS, obtenerEstadoVencimientoInsumo } from '../core/calculations';
import { BASE_CATEGORIES, BASE_UNITS, TIPOS_AJUSTE_PRECIO, DEFAULT_APP_CONFIG } from '../core/sampleData';
import { AutocompleteInput } from './AutocompleteInput';
import { BarcodeScannerModal } from './BarcodeScannerModal';

export const InsumosManager: React.FC = () => {
  const insumos = useLiveQuery(() => db.insumos.toArray()) || [];
  const proveedores = useLiveQuery(() => db.proveedores.toArray()) || [];
  const configs = useLiveQuery(() => db.config.toArray()) || [];
  const config = configs[0];

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [selectedVencimiento, setSelectedVencimiento] = useState<'todos' | 'verde' | 'amarillo' | 'rojo'>('todos');
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [historyInsumo, setHistoryInsumo] = useState<Insumo | null>(null);
  const [showMassUpdateModal, setShowMassUpdateModal] = useState(false);
  const [massCategory, setMassCategory] = useState('todas');
  const [tipoAjusteIndice, setTipoAjusteIndice] = useState<'porcentaje' | 'dolar_blue' | 'ipc' | 'canasta'>('porcentaje');
  const [massPercentage, setMassPercentage] = useState<number>(10);
  const [ipcManualPct, setIpcManualPct] = useState<number>(5);
  const [canastaManualPct, setCanastaManualPct] = useState<number>(8);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  const [formData, setFormData] = useState<Partial<Insumo>>({
    nombre: '', marca: '', modelo: '', unidad: 'm', categoria: 'cableado',
    proveedorPreferido: '', codigoProveedor: '', precioActual: 0, ofertas: [],
    requiereCotizacionDirecta: false
  });

  const [newOferta, setNewOferta] = useState<Partial<OfertaProveedor>>({
    nombreProveedor: '', precio: 0, notas: ''
  });
  const [saveProviderToDB, setSaveProviderToDB] = useState(false);

  const categories = Array.from(new Set(insumos.map((i) => i.categoria).filter(Boolean)));
  const BASE_CATEGORIES = ['cableado', 'protecciones', 'cajas', 'canalizaciones', 'accesorios', 'iluminacion', 'insumos', 'tableros', 'medicion'];
  for (const c of BASE_CATEGORIES) { if (!categories.includes(c)) categories.push(c); }
  categories.sort();

  const filteredInsumos = insumos.filter((item) => {
    const matchesSearch =
      item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.codigoProveedor && item.codigoProveedor.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.proveedorPreferido && item.proveedorPreferido.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCategory === 'todas' || item.categoria === selectedCategory;
    
    const estadoVenc = obtenerEstadoVencimientoInsumo(
      item.fechaActualizacion,
      config?.diasVencimientoPrecioVerde ?? 30,
      config?.diasVencimientoPrecioAmarillo ?? 60
    );
    const matchesVenc = selectedVencimiento === 'todos' || estadoVenc === selectedVencimiento;

    return matchesSearch && matchesCat && matchesVenc;
  });

  const handleOpenCreate = (prefill?: Partial<Insumo>) => {
    setFormData({ nombre: '', marca: '', modelo: '', unidad: 'm', categoria: 'cableado', proveedorPreferido: '', codigoProveedor: '', precioActual: 0, ofertas: [], ...prefill });
    setNewOferta({ nombreProveedor: '', precio: 0, notas: '' });
    setIsCreating(true);
  };

  const handleOpenEdit = (item: Insumo) => { 
    setEditingInsumo(item); 
    setFormData({ ...item, ofertas: item.ofertas || [] }); 
    setNewOferta({ nombreProveedor: '', precio: 0, notas: '' });
    setIsCreating(false);
  };

  const handleScan = (scannedCode: string) => {
    setShowScanner(false);
    const existing = insumos.find(i => i.codigoProveedor === scannedCode);
    if (existing) {
      handleOpenEdit(existing);
    } else {
      handleOpenCreate({ codigoProveedor: scannedCode });
    }
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
    let porcentajeAplicar = massPercentage;
    let indiceRefObj: IndiceReferencia | undefined = undefined;

    if (tipoAjusteIndice === 'dolar_blue') {
      porcentajeAplicar = massPercentage; 
      indiceRefObj = { nombre: config?.dolarReferenciaNombre || DEFAULT_APP_CONFIG.dolarReferenciaNombre, valor: config?.dolarReferenciaValor || DEFAULT_APP_CONFIG.dolarReferenciaValor };
    } else if (tipoAjusteIndice === 'ipc') {
      porcentajeAplicar = ipcManualPct;
      indiceRefObj = { nombre: 'IPC (Índice Precios Consumidor)', valor: ipcManualPct };
    } else if (tipoAjusteIndice === 'canasta') {
      porcentajeAplicar = canastaManualPct;
      indiceRefObj = { nombre: 'Canasta Eléctrica IEBA', valor: canastaManualPct };
    }

    if (porcentajeAplicar === 0) return;

    const now = new Date().toISOString();
    const factor = 1 + porcentajeAplicar / 100;
    const targetInsumos = insumos.filter((i) => 
      (massCategory === 'todas' || i.categoria === massCategory) && !i.requiereCotizacionDirecta
    );

    for (const item of targetInsumos) {
      const nuevoPrecio = Math.round(item.precioActual * factor);
      const history = [...(item.historialPrecios || [])];
      history.unshift({
        fecha: now,
        precio: nuevoPrecio,
        fuente: `Aumento por Indice (${indiceRefObj ? indiceRefObj.nombre : 'Manual'}) ${porcentajeAplicar > 0 ? '+' : ''}${porcentajeAplicar}%`,
        indiceReferencia: indiceRefObj
      });
      await db.insumos.update(item.id, { precioActual: nuevoPrecio, fechaActualizacion: now, historialPrecios: history });
    }
    setShowMassUpdateModal(false);
    alert(`Se actualizaron ${targetInsumos.length} insumos excluyendo ítems de cotización directa.`);
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

  const handleAddOferta = async () => {
    if (!newOferta.nombreProveedor || !newOferta.precio) return;
    
    if (saveProviderToDB) {
      const exists = proveedores.find(p => p.nombre.toLowerCase() === newOferta.nombreProveedor!.toLowerCase());
      if (!exists) {
        await db.proveedores.add({
          id: `prov-${crypto.randomUUID()}`,
          nombre: newOferta.nombreProveedor,
          tipoProveedor: 'material'
        });
      }
      setSaveProviderToDB(false);
    }

    const oferta: OfertaProveedor = {
      id: `of-${crypto.randomUUID()}`,
      proveedorId: proveedores.find(p => p.nombre.toLowerCase() === newOferta.nombreProveedor!.toLowerCase())?.id,
      nombreProveedor: newOferta.nombreProveedor,
      precio: newOferta.precio,
      fechaActualizacion: new Date().toISOString(),
      notas: newOferta.notas || undefined
    };

    setFormData(prev => ({
      ...prev,
      ofertas: [...(prev.ofertas || []), oferta]
    }));
    setNewOferta({ nombreProveedor: '', precio: 0, notas: '' });
  };

  const handleRemoveOferta = (id: string) => {
    setFormData(prev => ({ ...prev, ofertas: prev.ofertas?.filter(o => o.id !== id) }));
  };

  const inputCls = "w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-on-surface-variant/70 transition-shadow";
  const modalCls = "fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4";
  const modalBoxCls = "bg-surface-container border border-outline-variant/30 rounded-3xl w-full shadow-2xl p-6 text-on-surface";
  const proveedorOptions = proveedores.map(p => p.nombre);

  return (
    <div className="space-y-6">
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
            <TrendingUp className="w-4 h-4" /><span>Aumento por Índice</span>
          </button>
          <button onClick={handleExportCSV}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-on-surface-variant hover:bg-surface-variant rounded-full text-sm font-medium transition-colors border border-outline-variant/30">
            <FileSpreadsheet className="w-4 h-4" /><span>Exportar</span>
          </button>
          <button onClick={() => setShowCSVModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-on-surface-variant hover:bg-surface-variant rounded-full text-sm font-medium transition-colors border border-outline-variant/30">
            <FileSpreadsheet className="w-4 h-4" /><span>Importar</span>
          </button>
          <button onClick={() => handleOpenCreate()}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm hover:shadow-md">
            <Plus className="w-4 h-4" /><span>Nuevo Insumo</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-on-surface-variant absolute left-4 top-3" />
              <input type="text" placeholder="Buscar por nombre, código o proveedor..."
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-container-highest border-none rounded-full pl-10 pr-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-on-surface-variant/70 transition-shadow" />
            </div>
            <button onClick={() => setShowScanner(true)} className="p-2.5 bg-surface-variant hover:bg-surface-container-highest rounded-full text-on-surface transition-colors flex-shrink-0 flex items-center justify-center border border-outline-variant/30" title="Escanear Código (SKU/EAN)">
              <Camera className="w-5 h-5 text-amber-500" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 bg-surface-container-highest p-1 rounded-full text-xs font-medium border border-outline-variant/20">
            <span className="px-3 text-on-surface-variant text-[11px]">Vencimiento:</span>
            <button onClick={() => setSelectedVencimiento('todos')} className={`px-3 py-1 rounded-full ${selectedVencimiento === 'todos' ? 'bg-surface text-on-surface font-semibold shadow-xs' : 'text-on-surface-variant'}`}>Todos</button>
            <button onClick={() => setSelectedVencimiento('verde')} className={`px-3 py-1 rounded-full flex items-center gap-1 ${selectedVencimiento === 'verde' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-on-surface-variant'}`}><CheckCircle2 className="w-3 h-3 text-emerald-500"/>Al día</button>
            <button onClick={() => setSelectedVencimiento('amarillo')} className={`px-3 py-1 rounded-full flex items-center gap-1 ${selectedVencimiento === 'amarillo' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold' : 'text-on-surface-variant'}`}><Clock className="w-3 h-3 text-amber-500"/>30-60d</button>
            <button onClick={() => setSelectedVencimiento('rojo')} className={`px-3 py-1 rounded-full flex items-center gap-1 ${selectedVencimiento === 'rojo' ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 font-semibold' : 'text-on-surface-variant'}`}><AlertCircle className="w-3 h-3 text-rose-500"/>Vencidos</button>
          </div>
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

      <div className="hidden md:block bg-surface-container-low border border-outline-variant/20 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-on-surface">
            <thead className="bg-surface-container text-xs text-on-surface-variant border-b border-outline-variant/30">
              <tr>
                <th className="px-5 py-3.5 font-medium">Material / Descripción</th>
                <th className="px-5 py-3.5 font-medium">Categoría</th>
                <th className="px-5 py-3.5 font-medium">Proveedor</th>
                <th className="px-5 py-3.5 text-right font-medium">Precio Actual</th>
                <th className="px-5 py-3.5 text-center font-medium">Estado Precio</th>
                <th className="px-5 py-3.5 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filteredInsumos.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-on-surface-variant text-sm font-medium">No se encontraron insumos.</td></tr>
              ) : (
                filteredInsumos.map((item) => {
                  const estadoVenc = obtenerEstadoVencimientoInsumo(
                    item.fechaActualizacion,
                    config?.diasVencimientoPrecioVerde ?? 30,
                    config?.diasVencimientoPrecioAmarillo ?? 60
                  );
                  const daysOld = Math.floor((new Date().getTime() - new Date(item.fechaActualizacion).getTime()) / (1000 * 3600 * 24));
                  
                  return (
                    <tr key={item.id} className="hover:bg-surface-container-highest/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-on-surface text-sm flex items-center gap-2">
                          {item.nombre}
                          {item.requiereCotizacionDirecta && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30" title="Ítem especial — requiere cotización directa del proveedor">
                              <ShieldAlert className="w-3 h-3" /> Cotiz. Directa
                            </span>
                          )}
                        </div>
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
                        {estadoVenc === 'verde' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Al día ({daysOld}d)
                          </span>
                        )}
                        {estadoVenc === 'amarillo' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <Clock className="w-3.5 h-3.5" /> Regular ({daysOld}d)
                          </span>
                        )}
                        {estadoVenc === 'rojo' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400" title="Precio desactualizado hace más de 60 días">
                            <AlertCircle className="w-3.5 h-3.5" /> Vencido ({daysOld}d)
                          </span>
                        )}
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

      {/* Mobile Card List View (< md breakpoint) */}
      <div className="block md:hidden space-y-3">
        {filteredInsumos.length === 0 ? (
          <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-8 text-center text-on-surface-variant text-sm font-medium">
            No se encontraron insumos.
          </div>
        ) : (
          filteredInsumos.map((item) => {
            const estadoVenc = obtenerEstadoVencimientoInsumo(
              item.fechaActualizacion,
              config?.diasVencimientoPrecioVerde ?? 30,
              config?.diasVencimientoPrecioAmarillo ?? 60
            );
            const daysOld = Math.floor((new Date().getTime() - new Date(item.fechaActualizacion).getTime()) / (1000 * 3600 * 24));

            return (
              <div
                key={item.id}
                className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-4 space-y-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="font-bold text-on-surface text-sm truncate flex items-center gap-1.5 flex-wrap">
                      <span>{item.nombre}</span>
                      {item.requiereCotizacionDirecta && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-2 py-0.2 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                          <ShieldAlert className="w-2.5 h-2.5" /> Cotiz. Directa
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-tertiary-container text-on-tertiary-container capitalize">
                        {item.categoria}
                      </span>
                      <span className="font-mono text-on-surface-variant text-[11px]">Unidad: {item.unidad}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-base text-primary">
                      {formatARS(item.precioActual)}
                    </div>
                    <span className="text-[10px] text-on-surface-variant font-mono">/{item.unidad}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 text-xs">
                  <div>
                    {estadoVenc === 'verde' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> Al día ({daysOld}d)
                      </span>
                    )}
                    {estadoVenc === 'amarillo' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <Clock className="w-3 h-3" /> Regular ({daysOld}d)
                      </span>
                    )}
                    {estadoVenc === 'rojo' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                        <AlertCircle className="w-3 h-3" /> Vencido ({daysOld}d)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setHistoryInsumo(item)}
                      className="p-1.5 rounded-lg hover:bg-surface-variant text-on-surface-variant hover:text-primary transition-colors"
                      title="Ver historial"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 rounded-lg hover:bg-surface-variant text-on-surface-variant hover:text-on-surface transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-lg hover:bg-surface-variant text-on-surface-variant hover:text-error transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {(isCreating || editingInsumo) && (
        <div className={modalCls}>
          <div className={`${modalBoxCls} max-w-xl max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-5 border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-semibold text-on-surface flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                {isCreating ? 'Nuevo Insumo' : 'Editar Insumo'}
              </h3>
              <button onClick={() => { setIsCreating(false); setEditingInsumo(null); }} className="text-on-surface-variant hover:text-on-surface p-1"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveInsumo} className="space-y-4">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Nombre / Descripción</label>
                <input id="form-nombre" type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} className={inputCls} required placeholder="Ej: Cable Unipolar 2.5mm2 IRAM 247-3" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Marca <span className="opacity-70">(opcional)</span></label>
                  <input id="form-marca" type="text" value={formData.marca || ''} onChange={(e) => setFormData({ ...formData, marca: e.target.value })} className={inputCls} placeholder="Prysmian, Schneider..." />
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Modelo <span className="opacity-70">(opcional)</span></label>
                  <input id="form-modelo" type="text" value={formData.modelo || ''} onChange={(e) => setFormData({ ...formData, modelo: e.target.value })} className={inputCls} placeholder="Superinmunizado..." />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Categoría</label>
                  <input id="form-categoria" type="text" list="lista-categorias" value={formData.categoria} onChange={(e) => setFormData({ ...formData, categoria: e.target.value })} className={`${inputCls} capitalize`} required />
                  <datalist id="lista-categorias">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Unidad</label>
                  <input id="form-unidad" type="text" list="lista-unidades" value={formData.unidad} onChange={(e) => setFormData({ ...formData, unidad: e.target.value })} className={inputCls} required />
                  <datalist id="lista-unidades">{BASE_UNITS.map((u) => <option key={u} value={u} />)}</datalist>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Código / SKU <span className="opacity-70">(opcional)</span></label>
                  <input id="form-codigo" type="text" value={formData.codigoProveedor || ''} onChange={(e) => setFormData({ ...formData, codigoProveedor: e.target.value })} className={`${inputCls} font-mono`} placeholder="Ref, EAN, UPC..." />
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Precio Actual / Base (ARS)</label>
                  <div className="relative">
                    <span className="text-xs text-on-surface-variant absolute left-3 top-2.5 font-mono">$</span>
                    <input id="form-precio" type="number" step="0.01" min="0" value={formData.precioActual} onChange={(e) => setFormData({ ...formData, precioActual: parseFloat(e.target.value) || 0 })} className={`${inputCls} pl-7 font-mono text-primary font-bold`} required />
                  </div>
                </div>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/30 p-3 rounded-2xl flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="cb-cotiz-directa"
                  checked={formData.requiereCotizacionDirecta || false}
                  onChange={(e) => setFormData({ ...formData, requiereCotizacionDirecta: e.target.checked })}
                  className="mt-0.5 w-4 h-4 accent-purple-600 rounded"
                />
                <div>
                  <label htmlFor="cb-cotiz-directa" className="text-xs font-semibold text-purple-950 dark:text-purple-200 cursor-pointer">
                    Requiere Cotización Directa / Puntual (Excepción)
                  </label>
                  <p className="text-[11px] text-purple-900/70 dark:text-purple-300/80 mt-0.5">
                    Marcar para tableros especiales o grupos electrógenos. Estos ítems se exceptúan automáticamente de los aumentos masivos por fórmula.
                  </p>
                </div>
              </div>

              {/* Sección de Comparativa de Precios por Proveedor (Ofertas) */}
              <div className="space-y-3 pt-3 border-t border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-primary" />
                    Comparativa de Precios por Proveedor ({formData.ofertas?.length || 0})
                  </label>
                </div>

                {/* Formulario rápido para agregar cotización de proveedor */}
                <div className="flex flex-col sm:flex-row items-center gap-2 bg-surface-container-low p-2.5 rounded-2xl border border-outline-variant/20">
                  <input
                    type="text"
                    list="lista-proveedores-oferta"
                    value={newOferta.nombreProveedor}
                    onChange={(e) => setNewOferta({ ...newOferta, nombreProveedor: e.target.value })}
                    placeholder="Nombre del Proveedor / Mayorista"
                    className="w-full sm:flex-1 bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <datalist id="lista-proveedores-oferta">
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.nombre} />
                    ))}
                  </datalist>

                  <div className="relative w-full sm:w-32 shrink-0">
                    <span className="text-xs text-on-surface-variant absolute left-2.5 top-1.5 font-mono">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newOferta.precio || ''}
                      onChange={(e) => setNewOferta({ ...newOferta, precio: parseFloat(e.target.value) || 0 })}
                      placeholder="Precio ARS"
                      className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddOferta}
                    className="w-full sm:w-auto px-3.5 py-1.5 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container rounded-xl text-xs font-semibold shrink-0 transition-colors shadow-xs"
                  >
                    + Agregar Cotización
                  </button>
                </div>

                {/* Lista de precios por proveedor registrados */}
                {formData.ofertas && formData.ofertas.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {formData.ofertas.map((of) => (
                      <div
                        key={of.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-container-highest/60 p-2.5 rounded-xl text-xs border border-outline-variant/10"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-on-surface truncate block">{of.nombreProveedor}</span>
                          <span className="text-[10px] text-on-surface-variant">
                            Cotizado el: {new Date(of.fechaActualizacion).toLocaleDateString('es-AR')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 font-mono">
                          <span className="font-bold text-primary text-xs">{formatARS(of.precio)}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, precioActual: of.precio }));
                            }}
                            className="text-[10px] px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-medium font-sans transition-colors"
                            title="Establecer este precio como el precio base del insumo"
                          >
                            Usar como Base
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveOferta(of.id)}
                            className="p-1 text-on-surface-variant hover:text-error rounded-lg hover:bg-error-container/30 transition-colors"
                            title="Eliminar esta oferta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-outline-variant/30 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsCreating(false); setEditingInsumo(null); }} className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant">Cancelar</button>
                <button type="submit" className="px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-sm shadow-sm flex items-center gap-2"><Save className="w-3.5 h-3.5" />Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyInsumo && (
        <div className={modalCls}>
          <div className={`${modalBoxCls} max-w-md`}>
            <div className="flex items-center justify-between mb-4 border-b border-outline-variant/30 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-on-surface">{historyInsumo.nombre}</h3>
                <p className="text-xs text-on-surface-variant">Historial de precios</p>
              </div>
              <button onClick={() => setHistoryInsumo(null)} className="text-on-surface-variant hover:text-on-surface p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {historyInsumo.historialPrecios && historyInsumo.historialPrecios.length > 0 ? (
                historyInsumo.historialPrecios.map((h, idx) => (
                  <div key={idx} className="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20 flex justify-between items-center">
                    <div>
                      <div className="text-xs text-on-surface-variant flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(h.fecha).toLocaleString('es-AR')}</div>
                      <div className="text-[11px] text-primary/80 mt-0.5">{h.fuente}</div>
                    </div>
                    <div className="font-mono font-semibold text-primary text-sm">{formatARS(h.precio)}</div>
                  </div>
                ))
              ) : <p className="text-xs text-on-surface-variant text-center py-4">Sin historial.</p>}
            </div>
          </div>
        </div>
      )}

      {showMassUpdateModal && (
        <div className={modalCls}>
          <div className={`${modalBoxCls} max-w-md`}>
            <div className="flex items-center justify-between mb-4 border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <TrendingUp className="w-4 h-4" /> Ajuste Masivo por Índice de Referencia
              </div>
              <button onClick={() => setShowMassUpdateModal(false)} className="text-on-surface-variant hover:text-on-surface p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Categoría Objetivo</label>
                <select value={massCategory} onChange={(e) => setMassCategory(e.target.value)} className={`${inputCls} capitalize`}>
                  <option value="todas">Todas las categorías</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Índice / Mecanismo de Referencia</label>
                <select value={tipoAjusteIndice} onChange={(e) => setTipoAjusteIndice(e.target.value as any)} className={inputCls}>
                  {TIPOS_AJUSTE_PRECIO.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.value === 'dolar_blue'
                        ? `${t.label} (Ref: $${config?.dolarReferenciaValor || DEFAULT_APP_CONFIG.dolarReferenciaValor})`
                        : t.label}
                    </option>
                  ))}
                </select>
              </div>

              {tipoAjusteIndice === 'porcentaje' && (
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Aumento / Variación (%)</label>
                  <input type="number" step="0.1" value={massPercentage} onChange={(e) => setMassPercentage(parseFloat(e.target.value) || 0)} className={`${inputCls} font-mono`} />
                </div>
              )}

              {tipoAjusteIndice === 'dolar_blue' && (
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Variación del Dólar (%)</label>
                  <input type="number" step="0.1" value={massPercentage} onChange={(e) => setMassPercentage(parseFloat(e.target.value) || 0)} className={`${inputCls} font-mono`} />
                  <p className="text-[11px] text-on-surface-variant mt-1">Ref Dólar Actual: ${config?.dolarReferenciaValor || DEFAULT_APP_CONFIG.dolarReferenciaValor}</p>
                </div>
              )}

              {tipoAjusteIndice === 'ipc' && (
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Tasa IPC del período (%)</label>
                  <input type="number" step="0.1" value={ipcManualPct} onChange={(e) => setIpcManualPct(parseFloat(e.target.value) || 0)} className={`${inputCls} font-mono`} />
                </div>
              )}

              {tipoAjusteIndice === 'canasta' && (
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Variación Canasta Eléctrica (%)</label>
                  <input type="number" step="0.1" value={canastaManualPct} onChange={(e) => setCanastaManualPct(parseFloat(e.target.value) || 0)} className={`${inputCls} font-mono`} />
                </div>
              )}

              <p className="text-[11px] text-purple-900/80 dark:text-purple-300/80 bg-purple-500/10 p-2.5 rounded-xl border border-purple-500/20">
                * Los ítems marcados como <strong>Cotización Directa</strong> quedarán exceptuados automáticamente.
              </p>

              <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
                <button onClick={() => setShowMassUpdateModal(false)} className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant">Cancelar</button>
                <button onClick={handleApplyMassUpdate} className="px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-sm">Aplicar Ajuste</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCSVModal && (
        <div className={modalCls}>
          <div className={`${modalBoxCls} max-w-lg`}>
            <div className="flex items-center justify-between mb-5 border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2 text-tertiary font-semibold text-sm"><FileSpreadsheet className="w-4 h-4" />Importar CSV de Precios</div>
              <button onClick={() => setShowCSVModal(false)} className="text-on-surface-variant hover:text-on-surface p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3.5">
              <p className="text-xs text-on-surface-variant">Pegá el contenido CSV. Formato:<br />
                <code className="text-primary bg-surface-container-highest px-1.5 py-0.5 rounded font-mono text-[11px] block mt-1">Nombre, Marca, Modelo, Unidad, Categoria, PrecioActual, CodigoProveedor</code>
              </p>
              <textarea rows={5} value={csvContent} onChange={(e) => setCsvContent(e.target.value)}
                placeholder={`nombre,marca,modelo,unidad,categoria,precioActual,codigoProveedor\nCable Unipolar 2.5mm2,Prysmian,,m,cableado,750,CAB-25`}
                className={`${inputCls} font-mono text-xs`} />
              <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
                <button onClick={() => setShowCSVModal(false)} className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant">Cancelar</button>
                <button onClick={handleImportCSV} className="px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-sm">Importar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Escáner de Código de Barras */}
      {showScanner && (
        <BarcodeScannerModal
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
};
