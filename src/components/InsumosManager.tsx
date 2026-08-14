import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Package, Plus, Search, TrendingUp, FileSpreadsheet,
  Edit2, Trash2, X, Save, AlertCircle, Star, Tag, Layers, RefreshCw, Zap, ExternalLink, Copy, LayoutGrid, List, Sparkles
} from 'lucide-react';
import { db } from '../db/database';
import { CategoriaMaterial, Material, Producto, Oferta } from '../core/types';
import { formatARS, obtenerEstadoVencimientoOferta } from '../core/calculations';
import { TIPOS_AJUSTE_PRECIO, DEFAULT_APP_CONFIG, INITIAL_CATEGORIAS_MATERIAL } from '../core/sampleData';
import { ImportCatalogModal } from './ImportCatalogModal';

const inputCls = "w-full px-3.5 py-2.5 text-base sm:text-xs rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]";

export const InsumosManager: React.FC = () => {
  const categorias = useLiveQuery(() => db.categoriasMaterial.toArray()) || [];
  const materiales = useLiveQuery(() => db.materiales.toArray()) || [];
  const productos = useLiveQuery(() => db.productos.toArray()) || [];
  const ofertas = useLiveQuery(() => db.ofertas.reverse().toArray()) || [];
  const proveedores = useLiveQuery(() => db.proveedores.toArray()) || [];
  const configs = useLiveQuery(() => db.config.toArray()) || [];
  const config = configs[0];

  const categoriasMap = new Map(categorias.map(c => [c.id, c]));
  const proveedoresMap = new Map(proveedores.map(p => [p.id, p]));
  const materialesMap = new Map(materiales.map(m => [m.id, m]));
  const productosMap = new Map(productos.map(p => [p.id, p]));

  const [activeTab, setActiveTab] = useState<'materiales' | 'ofertas' | 'categorias'>('materiales');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [selectedVencimiento, setSelectedVencimiento] = useState<'todos' | 'verde' | 'amarillo' | 'rojo'>('todos');

  // Modal Estados
  const [isCreatingMat, setIsCreatingMat] = useState(false);
  const [editingMat, setEditingMat] = useState<Material | null>(null);
  const [formDataMat, setFormDataMat] = useState<Partial<Material>>({
    categoriaId: '',
    nombre: '',
    unidadVenta: 'u',
    atributos: [],
    activo: true
  });

  const [isCreatingProd, setIsCreatingProd] = useState(false);
  const [targetMatId, setTargetMatId] = useState<string>('');
  const [formDataProd, setFormDataProd] = useState<Partial<Producto>>({
    materialId: '',
    marca: '',
    modelo: '',
    tierCalidad: 'estandar',
    esPreferido: false
  });

  const [isCreatingOferta, setIsCreatingOferta] = useState(false);
  const [formDataOferta, setFormDataOferta] = useState<Partial<Oferta>>({
    materialId: '',
    productoId: undefined,
    proveedorId: '',
    precio: 0,
    fuente: 'manual'
  });

  // Modal Categorías Estado
  const [isCreatingCat, setIsCreatingCat] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoriaMaterial | null>(null);
  const [formDataCat, setFormDataCat] = useState<{
    nombre: string;
    atributosSugeridos: { clave: string; etiqueta: string; unidad: string; tipo: 'texto' | 'numero' }[];
  }>({
    nombre: '',
    atributosSugeridos: []
  });

  const [selectedFichaStatus, setSelectedFichaStatus] = useState<'todas' | 'completas' | 'incompletas'>('todas');
  const [isQuickCreateMat, setIsQuickCreateMat] = useState(false);
  const [formDataQuickMat, setFormDataQuickMat] = useState({
    nombre: '',
    unidadVenta: 'u',
    precio: 0,
    proveedorId: ''
  });

  const [showMassUpdateModal, setShowMassUpdateModal] = useState(false);
  const [showImportCatalogModal, setShowImportCatalogModal] = useState(false);
  const [tipoAjusteIndice, setTipoAjusteIndice] = useState<'porcentaje' | 'dolar_blue' | 'ipc' | 'canasta'>('porcentaje');
  const [massPercentage, setMassPercentage] = useState<number>(10);

  // Helper para armar ofertas agrupadas por material
  const getOfertaVigente = (materialId: string, productoId?: string) => {
    return ofertas.find(o => o.materialId === materialId && (!productoId || o.productoId === productoId));
  };

  const [modoCargaContinua, setModoCargaContinua] = useState(false);
  const quickMatNombreRef = useRef<HTMLInputElement>(null);

  // --- Handlers Alta Rápida ---
  const handleOpenQuickCreateMat = () => {
    setFormDataQuickMat({
      nombre: '',
      unidadVenta: 'u',
      precio: 0,
      proveedorId: proveedores[0]?.id || ''
    });
    setIsQuickCreateMat(true);
  };

  const handleSaveQuickMat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDataQuickMat.nombre.trim()) return;

    const catSinCatId = 'cat-sin-categoria';
    const catExists = await db.categoriasMaterial.get(catSinCatId);
    if (!catExists) {
      await db.categoriasMaterial.put({
        id: catSinCatId,
        nombre: 'Sin categoría (No asignado)',
        atributosSugeridos: []
      });
    }

    const now = new Date().toISOString();
    const matId = `mat-${crypto.randomUUID()}`;
    const newMat: Material = {
      id: matId,
      categoriaId: catSinCatId,
      nombre: formDataQuickMat.nombre.trim(),
      unidadVenta: formDataQuickMat.unidadVenta || 'u',
      atributos: [],
      activo: true,
      fichaIncompleta: true,
      createdAt: now,
      updatedAt: now
    };

    await db.materiales.add(newMat);

    if (formDataQuickMat.precio && formDataQuickMat.precio > 0) {
      const newOferta: Oferta = {
        id: `oferta-${crypto.randomUUID()}`,
        materialId: matId,
        proveedorId: formDataQuickMat.proveedorId || proveedores[0]?.id || 'prov-general',
        precio: formDataQuickMat.precio,
        fecha: now,
        fuente: 'manual'
      };
      await db.ofertas.add(newOferta);
    }

    if (modoCargaContinua) {
      setFormDataQuickMat({
        nombre: '',
        unidadVenta: formDataQuickMat.unidadVenta,
        precio: 0,
        proveedorId: formDataQuickMat.proveedorId
      });
      setTimeout(() => {
        quickMatNombreRef.current?.focus();
      }, 50);
    } else {
      setIsQuickCreateMat(false);
    }
  };

  const handleDuplicateMat = (mat: Material) => {
    setEditingMat(null);
    setFormDataMat({
      categoriaId: mat.categoriaId,
      nombre: `${mat.nombre} (Copia)`,
      unidadVenta: mat.unidadVenta || 'u',
      atributos: mat.atributos ? mat.atributos.map(a => ({ ...a })) : [],
      urlMercadoLibre: mat.urlMercadoLibre || '',
      activo: true,
      fichaIncompleta: false
    });
    setIsCreatingMat(true);
  };

  const handleSearchML = (mat: Material, prod?: Producto) => {
    const directUrl = prod?.urlMercadoLibre || mat.urlMercadoLibre;
    if (directUrl && (directUrl.startsWith('http://') || directUrl.startsWith('https://'))) {
      window.open(directUrl, '_blank');
    } else {
      const busqueda = prod ? `${prod.marca} ${prod.modelo || ''}` : mat.nombre;
      const url = `https://listado.mercadolibre.com.ar/${encodeURIComponent(busqueda.trim())}`;
      window.open(url, '_blank');
    }
  };

  // --- Handlers Categorías ---
  const handleOpenCreateCat = () => {
    setEditingCat(null);
    setFormDataCat({
      nombre: '',
      atributosSugeridos: [
        { clave: 'seccion', etiqueta: 'Sección', unidad: 'mm²', tipo: 'numero' }
      ]
    });
    setIsCreatingCat(true);
  };

  const handleOpenEditCat = (cat: CategoriaMaterial) => {
    setEditingCat(cat);
    setFormDataCat({
      nombre: cat.nombre,
      atributosSugeridos: cat.atributosSugeridos ? cat.atributosSugeridos.map(a => ({ ...a, unidad: a.unidad || '' })) : []
    });
    setIsCreatingCat(true);
  };

  const handleAddAtributoField = () => {
    setFormDataCat(prev => ({
      ...prev,
      atributosSugeridos: [
        ...prev.atributosSugeridos,
        { clave: '', etiqueta: '', unidad: '', tipo: 'texto' }
      ]
    }));
  };

  const handleRemoveAtributoField = (index: number) => {
    setFormDataCat(prev => ({
      ...prev,
      atributosSugeridos: prev.atributosSugeridos.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateAtributoField = (index: number, field: string, value: any) => {
    setFormDataCat(prev => {
      const updated = [...prev.atributosSugeridos];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'etiqueta' && !updated[index].clave) {
        updated[index].clave = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_");
      }
      return { ...prev, atributosSugeridos: updated };
    });
  };

  const handleSaveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDataCat.nombre.trim()) return;

    const id = editingCat ? editingCat.id : `cat-${crypto.randomUUID()}`;
    const cleanAtributos = formDataCat.atributosSugeridos
      .filter(a => a.clave.trim() || a.etiqueta.trim())
      .map(a => ({
        clave: (a.clave || a.etiqueta).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_"),
        etiqueta: a.etiqueta.trim() || a.clave.trim(),
        unidad: a.unidad ? a.unidad.trim() : '',
        tipo: a.tipo || 'texto'
      }));

    const catObj: CategoriaMaterial = {
      id,
      nombre: formDataCat.nombre.trim(),
      atributosSugeridos: cleanAtributos
    };

    await db.categoriasMaterial.put(catObj);
    setIsCreatingCat(false);
    setEditingCat(null);
  };

  const handleDeleteCat = async (catId: string) => {
    const count = materiales.filter(m => m.categoriaId === catId).length;
    if (count > 0) {
      alert(`No se puede eliminar la categoría porque tiene ${count} material(es) asignado(s). Reasigna o elimina los materiales primero.`);
      return;
    }
    if (confirm('¿Deseas eliminar esta categoría de material?')) {
      await db.categoriasMaterial.delete(catId);
    }
  };

  const handleRestoreDefaultCategories = async () => {
    if (INITIAL_CATEGORIAS_MATERIAL.length > 0) {
      await db.categoriasMaterial.bulkPut(INITIAL_CATEGORIAS_MATERIAL);
    }
  };

  // --- Handlers Materiales ---
  const handleOpenCreateMat = async () => {
    let cat = categorias[0];
    if (!cat) {
      await handleRestoreDefaultCategories();
      const updatedCats = await db.categoriasMaterial.toArray();
      cat = updatedCats[0];
    }
    const initialAttrs = cat?.atributosSugeridos ? cat.atributosSugeridos.map(a => ({ clave: a.clave, valor: '' })) : [];
    const initialName = buildAutoName(cat?.id, initialAttrs);

    setFormDataMat({
      categoriaId: cat?.id || '',
      nombre: initialName || cat?.nombre || '',
      unidadVenta: 'u',
      atributos: initialAttrs,
      activo: true
    });
    setIsCreatingMat(true);
  };

  const buildAutoName = (
    catId: string | undefined,
    atributos: { clave: string; valor: string }[] | undefined
  ): string => {
    const cat = categoriasMap.get(catId || '');
    if (!cat) return '';
    const parts: string[] = [cat.nombre];

    if (atributos && atributos.length > 0 && cat.atributosSugeridos) {
      atributos.forEach(attr => {
        if (attr.valor && attr.valor.trim() !== '') {
          const tpl = cat.atributosSugeridos.find(s => s.clave === attr.clave);
          const label = tpl?.etiqueta || attr.clave;
          const unit = tpl?.unidad ? ` ${tpl.unidad}` : '';
          parts.push(`${label} = ${attr.valor}${unit}`);
        }
      });
    }

    return parts.join(' ');
  };

  const handleOpenEditMat = (mat: Material) => {
    setEditingMat(mat);
    const cat = categoriasMap.get(mat.categoriaId);
    const existingAttrs = mat.atributos || [];
    const mergedAttrs = cat?.atributosSugeridos ? cat.atributosSugeridos.map(s => {
      const found = existingAttrs.find(a => a.clave === s.clave);
      return { clave: s.clave, valor: found ? found.valor : '' };
    }) : [...existingAttrs];

    if (cat?.atributosSugeridos) {
      const sugKeys = new Set(cat.atributosSugeridos.map(s => s.clave));
      existingAttrs.forEach(a => {
        if (!sugKeys.has(a.clave)) {
          mergedAttrs.push(a);
        }
      });
    }

    setFormDataMat({
      categoriaId: mat.categoriaId,
      nombre: mat.nombre,
      unidadVenta: mat.unidadVenta || 'u',
      atributos: mergedAttrs,
      urlMercadoLibre: mat.urlMercadoLibre || '',
      activo: mat.activo ?? true,
      fichaIncompleta: mat.fichaIncompleta ?? false
    });
    setIsCreatingMat(false);
  };

  const handleCategoryChange = (catId: string) => {
    const cat = categoriasMap.get(catId);
    const prevAtributos = formDataMat.atributos || [];
    const newAtributos = cat?.atributosSugeridos?.map(a => {
      const existing = prevAtributos.find(pa => pa.clave === a.clave);
      return { clave: a.clave, valor: existing ? existing.valor : '' };
    }) || [];

    const autoName = buildAutoName(catId, newAtributos);

    setFormDataMat(prev => ({
      ...prev,
      categoriaId: catId,
      atributos: newAtributos,
      nombre: autoName || prev.nombre
    }));
  };

  const handleAttributeValueChange = (clave: string, valor: string) => {
    setFormDataMat(prev => {
      const currentAttrs = prev.atributos ? [...prev.atributos] : [];
      const idx = currentAttrs.findIndex(a => a.clave === clave);
      if (idx >= 0) {
        currentAttrs[idx] = { ...currentAttrs[idx], valor };
      } else {
        currentAttrs.push({ clave, valor });
      }

      const autoName = buildAutoName(prev.categoriaId, currentAttrs);

      return {
        ...prev,
        atributos: currentAttrs,
        nombre: autoName || prev.nombre
      };
    });
  };

  const handleAutoGenerateName = () => {
    const autoName = buildAutoName(formDataMat.categoriaId, formDataMat.atributos);
    if (!autoName) return;

    setFormDataMat(prev => ({
      ...prev,
      nombre: autoName
    }));
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();

    if (editingMat) {
      await db.materiales.update(editingMat.id, {
        categoriaId: formDataMat.categoriaId || 'cat-sin-categoria',
        nombre: formDataMat.nombre?.trim() || editingMat.nombre,
        unidadVenta: formDataMat.unidadVenta || 'u',
        atributos: formDataMat.atributos || [],
        activo: formDataMat.activo ?? true,
        urlMercadoLibre: formDataMat.urlMercadoLibre,
        notas: formDataMat.notas,
        fichaIncompleta: false,
        updatedAt: now
      });
      setEditingMat(null);
      setIsCreatingMat(false);
    } else {
      const newMat: Material = {
        id: `mat-${crypto.randomUUID()}`,
        categoriaId: formDataMat.categoriaId || 'cat-sin-categoria',
        nombre: formDataMat.nombre?.trim() || 'Nuevo Material',
        unidadVenta: formDataMat.unidadVenta || 'u',
        atributos: formDataMat.atributos || [],
        activo: formDataMat.activo ?? true,
        urlMercadoLibre: formDataMat.urlMercadoLibre,
        notas: formDataMat.notas,
        fichaIncompleta: false,
        createdAt: now,
        updatedAt: now
      };
      await db.materiales.add(newMat);
      setIsCreatingMat(false);
    }
  };

  // --- Handlers Productos ---
  const handleOpenCreateProd = (matId: string) => {
    setTargetMatId(matId);
    setFormDataProd({
      materialId: matId,
      marca: '',
      modelo: '',
      tierCalidad: 'estandar',
      esPreferido: true
    });
    setIsCreatingProd(true);
  };

  const handleSaveProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    const newProd: Producto = {
      id: `prod-${crypto.randomUUID()}`,
      materialId: targetMatId,
      marca: formDataProd.marca || 'Genérico',
      modelo: formDataProd.modelo || '',
      tierCalidad: formDataProd.tierCalidad || 'estandar',
      esPreferido: formDataProd.esPreferido ?? false
    };
    await db.productos.add(newProd);
    setIsCreatingProd(false);
  };

  const [viewModeMat, setViewModeMat] = useState<'grid' | 'table'>('grid');
  const [editingOferta, setEditingOferta] = useState<Oferta | null>(null);

  const handleDeleteMaterial = async (matId: string) => {
    const mat = materialesMap.get(matId);
    if (!confirm(`¿Eliminar el material "${mat?.nombre || 'seleccionado'}" y todas sus marcas y precios asociados?`)) return;
    await db.transaction('rw', [db.materiales, db.productos, db.ofertas], async () => {
      await db.materiales.delete(matId);
      await db.productos.where('materialId').equals(matId).delete();
      await db.ofertas.where('materialId').equals(matId).delete();
    });
  };

  const handleDeleteProducto = async (prodId: string) => {
    if (!confirm('¿Eliminar esta marca/producto registrado?')) return;
    await db.transaction('rw', [db.productos, db.ofertas], async () => {
      await db.productos.delete(prodId);
      await db.ofertas.where('productoId').equals(prodId).delete();
    });
  };

  // --- Handlers Ofertas ---
  const handleOpenCreateOferta = (matId: string, prodId?: string) => {
    setEditingOferta(null);
    setFormDataOferta({
      materialId: matId,
      productoId: prodId,
      proveedorId: proveedores[0]?.id || '',
      precio: 0,
      fuente: 'manual'
    });
    setIsCreatingOferta(true);
  };

  const handleOpenEditOferta = (oferta: Oferta) => {
    setEditingOferta(oferta);
    setFormDataOferta({
      materialId: oferta.materialId,
      productoId: oferta.productoId,
      proveedorId: oferta.proveedorId,
      precio: oferta.precio,
      fuente: oferta.fuente || 'manual',
      tipoAjustePrecio: oferta.tipoAjustePrecio
    });
    setIsCreatingOferta(true);
  };

  const handleSaveOferta = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();

    if (editingOferta) {
      await db.ofertas.update(editingOferta.id, {
        materialId: formDataOferta.materialId || editingOferta.materialId,
        productoId: formDataOferta.productoId,
        proveedorId: formDataOferta.proveedorId || editingOferta.proveedorId,
        precio: formDataOferta.precio || 0,
        fuente: formDataOferta.fuente || 'manual',
        tipoAjustePrecio: formDataOferta.tipoAjustePrecio
      });
      setEditingOferta(null);
    } else {
      const newOferta: Oferta = {
        id: `oferta-${crypto.randomUUID()}`,
        materialId: formDataOferta.materialId || '',
        productoId: formDataOferta.productoId,
        proveedorId: formDataOferta.proveedorId || proveedores[0]?.id || '',
        precio: formDataOferta.precio || 0,
        fecha: now,
        fuente: formDataOferta.fuente || 'manual',
        tipoAjustePrecio: formDataOferta.tipoAjustePrecio
      };
      await db.ofertas.add(newOferta);
    }
    setIsCreatingOferta(false);
  };

  const handleDeleteOferta = async (ofertaId: string) => {
    if (confirm('¿Deseas eliminar esta oferta/precio cargado?')) {
      await db.ofertas.delete(ofertaId);
    }
  };

  // --- Handler Aumento Masivo ---
  const handleMassUpdate = async () => {
    if (massPercentage === 0) return;
    const factor = 1 + massPercentage / 100;
    const now = new Date().toISOString();

    await db.transaction('rw', [db.ofertas], async () => {
      const latestOfertasMap = new Map<string, Oferta>();
      ofertas.forEach(o => {
        const key = `${o.materialId}_${o.productoId || 'none'}`;
        if (!latestOfertasMap.has(key)) {
          latestOfertasMap.set(key, o);
        }
      });

      for (const o of latestOfertasMap.values()) {
        const newOferta: Oferta = {
          id: `oferta-${crypto.randomUUID()}`,
          materialId: o.materialId,
          productoId: o.productoId,
          proveedorId: o.proveedorId,
          precio: Math.round(o.precio * factor * 100) / 100,
          fecha: now,
          fuente: 'indice'
        };
        await db.ofertas.add(newOferta);
      }
    });

    setShowMassUpdateModal(false);
  };

  // Filtrado de materiales
  const filteredMateriales = materiales.filter((m) => {
    const matchesSearch =
      m.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.atributos && m.atributos.some(a => a.valor.toLowerCase().includes(searchTerm.toLowerCase()) || a.clave.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchesCategory = selectedCategory === 'todas' || m.categoriaId === selectedCategory;

    const ofertaVigente = getOfertaVigente(m.id);
    const estadoVenc = ofertaVigente
      ? obtenerEstadoVencimientoOferta(
          ofertaVigente.fecha,
          config?.diasVencimientoPrecioVerde || DEFAULT_APP_CONFIG.diasVencimientoPrecioVerde,
          config?.diasVencimientoPrecioAmarillo || DEFAULT_APP_CONFIG.diasVencimientoPrecioAmarillo
        )
      : 'rojo';

    const matchesVenc = selectedVencimiento === 'todos' || estadoVenc === selectedVencimiento;
    const matchesFicha =
      selectedFichaStatus === 'todas' ||
      (selectedFichaStatus === 'incompletas' && m.fichaIncompleta) ||
      (selectedFichaStatus === 'completas' && !m.fichaIncompleta);

    return matchesSearch && matchesCategory && matchesVenc && matchesFicha;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />Catálogo Técnico de Materiales & Precios
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">Gestión de fichas técnico-normativas, marcas de productos y ofertas de proveedores.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowImportCatalogModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 font-semibold rounded-full text-xs transition-colors border border-emerald-500/30"
            title="Importar lista de precios o catálogo desde Excel (.xlsx / .csv)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>Importar Excel / CSV</span>
          </button>
          <button
            onClick={handleOpenQuickCreateMat}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 font-semibold rounded-full text-xs transition-colors border border-amber-500/30"
          >
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Alta Rápida (Obra)</span>
          </button>
          <button onClick={() => setShowMassUpdateModal(true)} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-on-surface-variant hover:bg-surface-variant rounded-full text-sm font-medium transition-colors border border-outline-variant/30">
            <TrendingUp className="w-4 h-4 text-emerald-500" /><span>Aumento por Índice</span>
          </button>
          <button onClick={handleOpenCreateMat} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm">
            <Plus className="w-4 h-4" /><span>Nuevo Material</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant/30 gap-6">
        <button
          onClick={() => setActiveTab('materiales')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'materiales' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Package className="w-4 h-4" /> Materiales & Productos ({materiales.length})
        </button>
        <button
          onClick={() => setActiveTab('ofertas')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'ofertas' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Tag className="w-4 h-4" /> Ofertas & Precios ({ofertas.length})
        </button>
        <button
          onClick={() => setActiveTab('categorias')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'categorias' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Layers className="w-4 h-4" /> Categorías de Materiales ({categorias.length})
        </button>
      </div>

      {/* Filtros para materiales u ofertas */}
      {activeTab !== 'categorias' && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar material o norma..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${inputCls} pl-9`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`${inputCls} capitalize w-auto`}
            >
              <option value="todas">Todas las categorías</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>

            <select
              value={selectedFichaStatus}
              onChange={(e) => setSelectedFichaStatus(e.target.value as any)}
              className={`${inputCls} w-auto`}
            >
              <option value="todas">Fichas: Todas</option>
              <option value="completas">Fichas completas</option>
              <option value="incompletas">⚡ Alta Rápida (Pendientes)</option>
            </select>

            <select
              value={selectedVencimiento}
              onChange={(e) => setSelectedVencimiento(e.target.value as any)}
              className={`${inputCls} w-auto`}
            >
              <option value="todos">Vencimiento: Todos</option>
              <option value="verde">🟢 Vigente (≤ 30 días)</option>
              <option value="amarillo">🟡 Alerta (31-60 días)</option>
              <option value="rojo">🔴 Vencido (&gt; 60 días)</option>
            </select>

            {activeTab === 'materiales' && (
              <div className="flex items-center gap-1 bg-surface-container-highest p-1 rounded-xl border border-outline-variant/30 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewModeMat('grid')}
                  className={`p-1.5 rounded-lg transition-colors ${viewModeMat === 'grid' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
                  title="Vista Tarjetas"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewModeMat('table')}
                  className={`p-1.5 rounded-lg transition-colors ${viewModeMat === 'table' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
                  title="Vista Lista / Tabla"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISTA: MATERIALES & PRODUCTOS */}
      {activeTab === 'materiales' && (
        <>
          {viewModeMat === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMateriales.map((mat) => {
                const cat = categoriasMap.get(mat.categoriaId);
                const prodsMat = productos.filter(p => p.materialId === mat.id);
                const ofertaVigente = getOfertaVigente(mat.id);

                const estadoVenc = ofertaVigente
                  ? obtenerEstadoVencimientoOferta(
                      ofertaVigente.fecha,
                      config?.diasVencimientoPrecioVerde || DEFAULT_APP_CONFIG.diasVencimientoPrecioVerde,
                      config?.diasVencimientoPrecioAmarillo || DEFAULT_APP_CONFIG.diasVencimientoPrecioAmarillo
                    )
                  : 'rojo';

                return (
                  <div key={mat.id} className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 hover:bg-surface-container/60 transition-all flex flex-col justify-between shadow-sm">
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
                              {cat?.nombre || 'Sin categoría (No asignado)'}
                            </span>
                            {mat.fichaIncompleta && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center gap-0.5 border border-amber-500/30">
                                <Zap className="w-3 h-3 text-amber-500" /> Pendiente de completar
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-on-surface text-base mt-0.5">{mat.nombre}</h3>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleSearchML(mat)}
                            className="p-1.5 text-on-surface-variant hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
                            title="Buscar referencia de precio en Mercado Libre"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicateMat(mat)}
                            className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="Crear material similar"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditMat(mat)}
                            className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="Editar ficha de material"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMaterial(mat.id)}
                            className="p-1.5 text-on-surface-variant hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Eliminar material"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <span className={`w-3 h-3 rounded-full ml-1 ${
                            estadoVenc === 'verde' ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' :
                            estadoVenc === 'amarillo' ? 'bg-amber-500 shadow-sm shadow-amber-500/50' : 'bg-rose-500 shadow-sm shadow-rose-500/50'
                          }`} title={`Estado precio: ${estadoVenc}`} />
                        </div>
                      </div>

                      {/* Atributos */}
                      {mat.atributos && mat.atributos.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {mat.atributos.map((at, idx) => (
                            <span key={idx} className="text-[10px] bg-surface-container-highest text-on-surface-variant px-2 py-0.5 rounded-md font-mono">
                              {at.clave}: {at.valor}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Marcas / Productos */}
                      <div className="mt-4 border-t border-outline-variant/20 pt-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-semibold text-on-surface-variant">Marcas registradas ({prodsMat.length})</span>
                          <button onClick={() => handleOpenCreateProd(mat.id)} className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-0.5">
                            <Plus className="w-3 h-3" /> Marca
                          </button>
                        </div>

                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {prodsMat.map(p => {
                            const ofProd = getOfertaVigente(mat.id, p.id);
                            return (
                              <div key={p.id} className="flex justify-between items-center text-xs p-1.5 rounded-xl bg-surface-container border border-outline-variant/10">
                                <div className="flex items-center gap-1.5">
                                  {p.esPreferido && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                                  <span className="font-medium text-on-surface">{p.marca}</span>
                                  {p.modelo && <span className="text-[10px] text-on-surface-variant">({p.modelo})</span>}
                                </div>
                                <div className="flex items-center gap-1.5 font-mono">
                                  <span className="text-primary font-semibold">{ofProd ? formatARS(ofProd.precio) : 'Sin precio'}</span>
                                  <button
                                    onClick={() => handleSearchML(mat, p)}
                                    className="p-0.5 text-on-surface-variant hover:text-amber-500"
                                    title="Buscar marca en Mercado Libre"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProducto(p.id)}
                                    className="p-0.5 text-on-surface-variant hover:text-rose-500"
                                    title="Eliminar marca"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => handleOpenCreateOferta(mat.id, p.id)} className="text-[10px] text-on-surface-variant hover:text-primary underline">
                                    + Precio
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          {prodsMat.length === 0 && (
                            <p className="text-xs text-on-surface-variant italic py-1">Sin marcas específicas (Precio genérico)</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer Oferta Vigente Principal */}
                    <div className="mt-4 border-t border-outline-variant/20 pt-3 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] text-on-surface-variant block">Precio Referencia</span>
                        <span className="text-sm font-bold font-mono text-primary">
                          {ofertaVigente ? formatARS(ofertaVigente.precio) : 'N/D'}
                        </span>
                      </div>
                      <button onClick={() => handleOpenCreateOferta(mat.id)} className="flex items-center gap-1 px-3 py-1.5 bg-surface-container-highest hover:bg-surface-variant text-on-surface text-xs rounded-full font-medium transition-colors border border-outline-variant/20">
                        <Plus className="w-3 h-3" /> Cargar Precio
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TABLA VISTA LISTA */
            <div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-high border-b border-outline-variant/30 text-on-surface-variant font-semibold">
                  <tr>
                    <th className="p-3">Material & Norma</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">Marcas Registradas</th>
                    <th className="p-3 text-right">Precio Referencia</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                  {filteredMateriales.map((mat) => {
                    const cat = categoriasMap.get(mat.categoriaId);
                    const prodsMat = productos.filter(p => p.materialId === mat.id);
                    const ofertaVigente = getOfertaVigente(mat.id);

                    const estadoVenc = ofertaVigente
                      ? obtenerEstadoVencimientoOferta(
                          ofertaVigente.fecha,
                          config?.diasVencimientoPrecioVerde || DEFAULT_APP_CONFIG.diasVencimientoPrecioVerde,
                          config?.diasVencimientoPrecioAmarillo || DEFAULT_APP_CONFIG.diasVencimientoPrecioAmarillo
                        )
                      : 'rojo';

                    return (
                      <tr key={mat.id} className="hover:bg-surface-container/50">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              estadoVenc === 'verde' ? 'bg-emerald-500' :
                              estadoVenc === 'amarillo' ? 'bg-amber-500' : 'bg-rose-500'
                            }`} title={`Estado precio: ${estadoVenc}`} />
                            <div>
                              <span className="font-semibold text-on-surface block">{mat.nombre}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
                            {cat?.nombre || 'Sin categoría (No asignado)'}
                          </span>
                          {mat.fichaIncompleta && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 block w-fit mt-1 border border-amber-500/30">
                              ⚡ Pendiente
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap items-center gap-1">
                            {prodsMat.map(p => (
                              <span key={p.id} className="text-[10px] bg-surface-container-highest px-2 py-0.5 rounded-md font-medium text-on-surface-variant flex items-center gap-1">
                                {p.esPreferido && <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />}
                                {p.marca} {p.modelo || ''}
                              </span>
                            ))}
                            {prodsMat.length === 0 && <span className="text-on-surface-variant italic text-[11px]">Genérico</span>}
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-primary">
                          {ofertaVigente ? formatARS(ofertaVigente.precio) : 'N/D'}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleSearchML(mat)}
                              className="p-1 text-on-surface-variant hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
                              title="Mercado Libre"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDuplicateMat(mat)}
                              className="p-1 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="Duplicar"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEditMat(mat)}
                              className="p-1 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteMaterial(mat.id)}
                              className="p-1 text-on-surface-variant hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* VISTA: OFERTAS & HISTORIAL */}
      {activeTab === 'ofertas' && (
        <div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-high border-b border-outline-variant/30 text-on-surface-variant font-semibold">
              <tr>
                <th className="p-3">Material</th>
                <th className="p-3">Marca / Modelo</th>
                <th className="p-3">Proveedor</th>
                <th className="p-3">Fuente</th>
                <th className="p-3">Fecha</th>
                <th className="p-3 text-right">Precio ARS</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-on-surface">
              {ofertas.map((of) => {
                const mat = materialesMap.get(of.materialId);
                const prod = of.productoId ? productosMap.get(of.productoId) : undefined;
                const prov = proveedoresMap.get(of.proveedorId);
                return (
                  <tr key={of.id} className="hover:bg-surface-container/50">
                    <td className="p-3 font-semibold text-on-surface">{mat?.nombre || 'Material eliminado'}</td>
                    <td className="p-3">{prod ? `${prod.marca} ${prod.modelo || ''}` : 'Genérico'}</td>
                    <td className="p-3">{prov?.razonSocial || prov?.nombre || 'General'}</td>
                    <td className="p-3 capitalize"><span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-mono">{of.fuente}</span></td>
                    <td className="p-3 font-mono text-on-surface-variant">{new Date(of.fecha).toLocaleDateString('es-AR')}</td>
                    <td className="p-3 text-right font-mono font-bold text-primary">{formatARS(of.precio)}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEditOferta(of)}
                          className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Editar oferta / precio"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteOferta(of.id)}
                          className="p-1.5 text-on-surface-variant hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Eliminar oferta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* VISTA: CATEGORÍAS DE MATERIALES */}
      {activeTab === 'categorias' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20">
            <div>
              <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Categorías de Materiales & Atributos Normativos
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Configura las familias de materiales e insumos y define los atributos sugeridos (Sección, Corriente, Tensión, etc.).
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleRestoreDefaultCategories}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 rounded-full transition-colors border border-emerald-500/30"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Restaurar Categorías Iniciales
              </button>
              <button
                onClick={handleOpenCreateCat}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary text-xs font-semibold rounded-full shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Nueva Categoría
              </button>
            </div>
          </div>

          {categorias.length === 0 ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-8 text-center max-w-lg mx-auto my-6 space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <h4 className="font-semibold text-on-surface text-sm">No hay categorías registradas</h4>
              <p className="text-xs text-on-surface-variant">
                Para cargar materiales en el catálogo, primero necesitas crear o cargar las categorías (ej: Cables, Protecciones, Canalizaciones).
              </p>
              <div className="pt-2 flex flex-wrap justify-center gap-3">
                <button
                  onClick={handleRestoreDefaultCategories}
                  className="px-5 py-2.5 bg-primary text-on-primary font-semibold text-xs rounded-full shadow-sm"
                >
                  Cargar Categorías por Defecto IEBA
                </button>
                <button
                  onClick={handleOpenCreateCat}
                  className="px-5 py-2.5 bg-surface-container-high text-on-surface border border-outline-variant/30 font-semibold text-xs rounded-full"
                >
                  + Crear Categoría Personalizada
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categorias.map((cat) => {
                const matCount = materiales.filter((m) => m.categoriaId === cat.id).length;
                return (
                  <div
                    key={cat.id}
                    className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-4 flex flex-col justify-between hover:border-outline-variant/60 transition-all shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-primary shrink-0" />
                          <h4 className="font-semibold text-sm text-on-surface">{cat.nombre}</h4>
                        </div>
                        <span className="text-[11px] font-medium text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded-full shrink-0">
                          {matCount} material{matCount !== 1 ? 'es' : ''}
                        </span>
                      </div>

                      <div className="mt-3">
                        <p className="text-[11px] font-semibold text-on-surface-variant mb-1">Atributos Sugeridos:</p>
                        {cat.atributosSugeridos && cat.atributosSugeridos.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {cat.atributosSugeridos.map((at, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-md border border-outline-variant/20 font-mono"
                              >
                                {at.etiqueta || at.clave} {at.unidad ? `(${at.unidad})` : ''}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-on-surface-variant italic">Sin atributos definidos</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-outline-variant/20 flex justify-end gap-1">
                      <button
                        onClick={() => handleOpenEditCat(cat)}
                        className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container-highest rounded-lg transition-colors"
                        title="Editar Categoría"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCat(cat.id)}
                        className="p-1.5 text-on-surface-variant hover:text-rose-500 hover:bg-surface-container-highest rounded-lg transition-colors"
                        title="Eliminar Categoría"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL CREAR / EDITAR CATEGORIA */}
      {isCreatingCat && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-xl shadow-2xl p-6 text-on-surface max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-outline-variant/30 pb-3 shrink-0">
              <h3 className="text-base font-semibold text-on-surface">
                {editingCat ? 'Editar Categoría de Material' : 'Nueva Categoría de Material'}
              </h3>
              <button onClick={() => setIsCreatingCat(false)} className="text-on-surface-variant hover:text-on-surface p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCat} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1 font-medium">Nombre de la Categoría</label>
                <input
                  type="text"
                  value={formDataCat.nombre}
                  onChange={(e) => setFormDataCat({ ...formDataCat, nombre: e.target.value })}
                  className={inputCls}
                  placeholder="Ej: Tableros Eléctricos, Cables, Protecciones..."
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-xs text-on-surface-variant font-medium">Atributos Técnicos Sugeridos</label>
                    <p className="text-[11px] text-on-surface-variant/80">Define los parámetros técnicos normativos que tendrán los insumos de esta familia.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAtributoField}
                    className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Atributo
                  </button>
                </div>

                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {formDataCat.atributosSugeridos.length > 0 && (
                    <div className="hidden sm:grid grid-cols-12 gap-2 px-1 text-[11px] font-semibold text-on-surface-variant">
                      <span className="col-span-4">Nombre / Etiqueta</span>
                      <span className="col-span-3">Clave (ID interno)</span>
                      <span className="col-span-2">Unidad</span>
                      <span className="col-span-2">Tipo</span>
                      <span className="col-span-1 text-center">Acción</span>
                    </div>
                  )}

                  {formDataCat.atributosSugeridos.map((at, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20 items-center">
                      <div className="sm:col-span-4">
                        <label className="block sm:hidden text-[10px] text-on-surface-variant font-medium mb-0.5">Etiqueta</label>
                        <input
                          type="text"
                          value={at.etiqueta}
                          onChange={(e) => handleUpdateAtributoField(idx, 'etiqueta', e.target.value)}
                          className={`${inputCls} text-xs`}
                          placeholder="Ej: Sección"
                          required
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block sm:hidden text-[10px] text-on-surface-variant font-medium mb-0.5">Clave slug</label>
                        <input
                          type="text"
                          value={at.clave}
                          onChange={(e) => handleUpdateAtributoField(idx, 'clave', e.target.value)}
                          className={`${inputCls} text-xs font-mono`}
                          placeholder="ej: seccion"
                          required
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block sm:hidden text-[10px] text-on-surface-variant font-medium mb-0.5">Unidad</label>
                        <input
                          type="text"
                          value={at.unidad}
                          onChange={(e) => handleUpdateAtributoField(idx, 'unidad', e.target.value)}
                          className={`${inputCls} text-xs font-mono`}
                          placeholder="mm², A, V"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block sm:hidden text-[10px] text-on-surface-variant font-medium mb-0.5">Tipo</label>
                        <select
                          value={at.tipo}
                          onChange={(e) => handleUpdateAtributoField(idx, 'tipo', e.target.value as any)}
                          className={`${inputCls} text-xs`}
                        >
                          <option value="numero">Número</option>
                          <option value="texto">Texto</option>
                        </select>
                      </div>
                      <div className="sm:col-span-1 flex justify-end sm:justify-center pt-1 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => handleRemoveAtributoField(idx)}
                          className="p-1.5 text-on-surface-variant hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Eliminar atributo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {formDataCat.atributosSugeridos.length === 0 && (
                    <div className="text-xs text-on-surface-variant italic py-6 text-center bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/30 space-y-2">
                      <p>Sin atributos técnicos normativos definidos para esta categoría.</p>
                      <button
                        type="button"
                        onClick={handleAddAtributoField}
                        className="px-3 py-1.5 bg-primary/10 text-primary font-semibold text-xs rounded-full hover:bg-primary/20 transition-colors inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Agregar primer atributo
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreatingCat(false)}
                  className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-sm shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" /> Guardar Categoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ALTA RAPIDA DE MATERIAL */}
      {isQuickCreateMat && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-md shadow-2xl p-6 text-on-surface">
            <div className="flex items-center justify-between mb-3 border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-on-surface">Alta Rápida de Material</h3>
                  <p className="text-[11px] text-on-surface-variant">Crea insumos en segundos desde la obra. Luego completas la ficha técnica.</p>
                </div>
              </div>
              <button onClick={() => setIsQuickCreateMat(false)} className="text-on-surface-variant hover:text-on-surface p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickMat} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Nombre o Descripción del Material *</label>
                <input
                  ref={quickMatNombreRef}
                  type="text"
                  value={formDataQuickMat.nombre}
                  onChange={(e) => setFormDataQuickMat({ ...formDataQuickMat, nombre: e.target.value })}
                  className={inputCls}
                  placeholder="Ej: Caño corrugado blanco 3/4, Cable unipolar 1.5..."
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Unidad de Venta</label>
                  <select
                    value={formDataQuickMat.unidadVenta}
                    onChange={(e) => setFormDataQuickMat({ ...formDataQuickMat, unidadVenta: e.target.value })}
                    className={inputCls}
                  >
                    <option value="m">Metro (m)</option>
                    <option value="u">Unidad (u)</option>
                    <option value="kg">Kilogramo (kg)</option>
                    <option value="rollo x100m">Rollo x 100m</option>
                    <option value="caja x100u">Caja x 100u</option>
                    <option value="tira x3m">Tira x 3m</option>
                    <option value="global">Global</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Precio Referencia ARS (Opcional)</label>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={formDataQuickMat.precio || ''}
                    onChange={(e) => setFormDataQuickMat({ ...formDataQuickMat, precio: parseFloat(e.target.value) || 0 })}
                    className={inputCls}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {proveedores.length > 0 && formDataQuickMat.precio > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Proveedor de Referencia</label>
                  <select
                    value={formDataQuickMat.proveedorId}
                    onChange={(e) => setFormDataQuickMat({ ...formDataQuickMat, proveedorId: e.target.value })}
                    className={inputCls}
                  >
                    {proveedores.map(p => (
                      <option key={p.id} value={p.id}>{p.razonSocial || p.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-2 border-t border-outline-variant/20">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <input
                    type="checkbox"
                    checked={modoCargaContinua}
                    onChange={(e) => setModoCargaContinua(e.target.checked)}
                    className="w-4 h-4 text-amber-500 rounded border-outline focus:ring-amber-500"
                  />
                  <span>⚡ Modo Carga Continua (Enter guarda y pasa al siguiente)</span>
                </label>
              </div>

              <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickCreateMat(false)}
                  className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-full text-sm shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" /> Guardar Alta Rápida
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR MATERIAL */}
      {(isCreatingMat || editingMat !== null) && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-md shadow-2xl p-6 text-on-surface">
            <div className="flex items-center justify-between mb-4 border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-semibold text-on-surface">
                {editingMat ? 'Editar Material Técnico' : 'Nuevo Material Técnico'}
              </h3>
              <button onClick={() => { setIsCreatingMat(false); setEditingMat(null); }} className="text-on-surface-variant hover:text-on-surface p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveMaterial} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-on-surface-variant">Categoría</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingMat(false);
                      setEditingMat(null);
                      handleOpenCreateCat();
                    }}
                    className="text-[11px] text-primary hover:underline font-semibold"
                  >
                    + Nueva Categoría
                  </button>
                </div>
                {categorias.length === 0 ? (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-600 dark:text-amber-400 mb-2 flex items-center justify-between">
                    <span>No hay categorías cargadas.</span>
                    <button
                      type="button"
                      onClick={handleRestoreDefaultCategories}
                      className="px-2.5 py-1 bg-amber-500 text-white font-semibold rounded-lg text-[10px]"
                    >
                      Cargar iniciales
                    </button>
                  </div>
                ) : (
                  <select value={formDataMat.categoriaId} onChange={(e) => handleCategoryChange(e.target.value)} className={inputCls} required>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Dynamic Suggested Attributes Section */}
              {(() => {
                const selectedCat = categoriasMap.get(formDataMat.categoriaId || '');
                const suggestedAttrs = selectedCat?.atributosSugeridos || [];
                if (!selectedCat || suggestedAttrs.length === 0) return null;
                return (
                  <div className="p-3.5 bg-surface-container-high border border-outline-variant/30 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Atributos Sugeridos ({selectedCat.nombre})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {suggestedAttrs.map(attrTpl => {
                        const attrVal = formDataMat.atributos?.find(a => a.clave === attrTpl.clave)?.valor || '';
                        return (
                          <div key={attrTpl.clave}>
                            <label className="block text-[11px] text-on-surface-variant mb-1 truncate">
                              {attrTpl.etiqueta} {attrTpl.unidad ? `(${attrTpl.unidad})` : ''}
                            </label>
                            <input
                              type={attrTpl.tipo === 'numero' ? 'number' : 'text'}
                              step={attrTpl.tipo === 'numero' ? 'any' : undefined}
                              value={attrVal}
                              onChange={(e) => handleAttributeValueChange(attrTpl.clave, e.target.value)}
                              className={inputCls}
                              placeholder={attrTpl.unidad ? `Ej: 16 ${attrTpl.unidad}` : 'Valor...'}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-on-surface-variant">Nombre Técnico (Generado automáticamente)</label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateName}
                    className="text-[11px] text-primary hover:underline font-semibold"
                    title="Restablecer nombre formateado por defecto"
                  >
                    ✨ Restablecer Formato
                  </button>
                </div>
                <input type="text" value={formDataMat.nombre || ''} onChange={(e) => setFormDataMat({ ...formDataMat, nombre: e.target.value })} className={inputCls} placeholder="Ej: Cables & Conductores Sección = 2.5 mm²" required />
              </div>

              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Unidad Venta / Comercialización</label>
                <input type="text" value={formDataMat.unidadVenta || 'u'} onChange={(e) => setFormDataMat({ ...formDataMat, unidadVenta: e.target.value })} className={inputCls} placeholder="m, u, kg, rollo x100m" required />
              </div>

              <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsCreatingMat(false); setEditingMat(null); }} className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant">Cancelar</button>
                <button type="submit" className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-sm"><Save className="w-3.5 h-3.5" />Guardar Material</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR PRODUCTO / MARCA */}
      {isCreatingProd && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-sm shadow-2xl p-6 text-on-surface">
            <div className="flex items-center justify-between mb-4 border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-semibold text-on-surface">Agregar Producto / Marca</h3>
              <button onClick={() => setIsCreatingProd(false)} className="text-on-surface-variant hover:text-on-surface p-1"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveProducto} className="space-y-4">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Marca</label>
                <input type="text" value={formDataProd.marca || ''} onChange={(e) => setFormDataProd({ ...formDataProd, marca: e.target.value })} className={inputCls} placeholder="Prysmian, Schneider..." required />
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Modelo / Serie</label>
                <input type="text" value={formDataProd.modelo || ''} onChange={(e) => setFormDataProd({ ...formDataProd, modelo: e.target.value })} className={inputCls} placeholder="Superastic, Easy9..." />
              </div>
              <div className="flex items-center pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-on-surface">
                  <input type="checkbox" checked={formDataProd.esPreferido} onChange={(e) => setFormDataProd({ ...formDataProd, esPreferido: e.target.checked })} className="w-4 h-4 text-primary rounded" />
                  <span>Marcar como marca preferida por defecto</span>
                </label>
              </div>

              <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
                <button type="button" onClick={() => setIsCreatingProd(false)} className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant">Cancelar</button>
                <button type="submit" className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-sm"><Save className="w-3.5 h-3.5" />Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR OFERTA */}
      {isCreatingOferta && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-sm shadow-2xl p-6 text-on-surface">
            <div className="flex items-center justify-between mb-4 border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-semibold text-on-surface">
                {editingOferta ? 'Editar Oferta / Precio' : 'Cargar Oferta / Precio'}
              </h3>
              <button onClick={() => { setIsCreatingOferta(false); setEditingOferta(null); }} className="text-on-surface-variant hover:text-on-surface p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveOferta} className="space-y-4">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Proveedor</label>
                <select value={formDataOferta.proveedorId} onChange={(e) => setFormDataOferta({ ...formDataOferta, proveedorId: e.target.value })} className={inputCls}>
                  {proveedores.map(p => (
                    <option key={p.id} value={p.id}>{p.razonSocial || p.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Precio Unitario ARS</label>
                <input type="number" step="0.01" value={formDataOferta.precio || ''} onChange={(e) => setFormDataOferta({ ...formDataOferta, precio: parseFloat(e.target.value) || 0 })} className={`${inputCls} font-mono text-primary font-bold`} required />
              </div>

              <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsCreatingOferta(false); setEditingOferta(null); }} className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant">Cancelar</button>
                <button type="submit" className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-sm"><Save className="w-3.5 h-3.5" />Guardar Precio</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AUMENTO MASIVO */}
      {showMassUpdateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-sm shadow-2xl p-6 text-on-surface">
            <div className="flex items-center justify-between mb-4 border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-semibold text-on-surface">Aumento Masivo por Índice</h3>
              <button onClick={() => setShowMassUpdateModal(false)} className="text-on-surface-variant hover:text-on-surface p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Mecanismo / Índice</label>
                <select value={tipoAjusteIndice} onChange={(e) => setTipoAjusteIndice(e.target.value as any)} className={inputCls}>
                  {TIPOS_AJUSTE_PRECIO.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Porcentaje de Aumento (%)</label>
                <input type="number" step="0.1" value={massPercentage} onChange={(e) => setMassPercentage(parseFloat(e.target.value) || 0)} className={`${inputCls} font-mono`} />
              </div>

              <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
                <button onClick={() => setShowMassUpdateModal(false)} className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant">Cancelar</button>
                <button onClick={handleMassUpdate} className="px-5 py-2 bg-emerald-500 text-white font-semibold rounded-full text-sm shadow-sm">Aplicar Aumento</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Catalog Modal (Excel / CSV) */}
      <ImportCatalogModal
        isOpen={showImportCatalogModal}
        onClose={() => setShowImportCatalogModal(false)}
        onSuccess={() => {
          setShowImportCatalogModal(false);
        }}
      />

      {/* Mobile M3 Extended FAB for Material creation */}
      <button
        type="button"
        onClick={handleOpenQuickCreateMat}
        className="sm:hidden fixed bottom-20 right-4 px-4 py-3.5 bg-primary text-on-primary rounded-2xl shadow-md3-2 hover:shadow-md3-3 active:scale-95 transition-all z-30 flex items-center gap-2 font-semibold text-xs"
        aria-label="Alta Rápida de Material"
      >
        <Zap className="w-5 h-5 text-amber-300" />
        <span>Alta Rápida</span>
      </button>
    </div>
  );
};
