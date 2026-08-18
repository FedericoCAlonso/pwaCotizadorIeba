import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Package,
  Plus,
  Search,
  TrendingUp,
  FileSpreadsheet,
  Edit2,
  Trash2,
  AlertCircle,
  Star,
  Tag,
  Layers,
  Zap,
  ExternalLink,
  Copy,
  LayoutGrid,
  List,
  SlidersHorizontal,
  FileText,
  Check,
  ArrowLeft,
  X
} from 'lucide-react';
import { db, softDelete } from '../db/database';
import { CategoriaMaterial, Material, Producto, Oferta, Contacto, MaterialFilterContext } from '../core/types';
import { formatARS, obtenerEstadoVencimientoOferta, calcularPrecioNeto, calcularPrecioFinal } from '../core/calculations';
import { INITIAL_CATEGORIAS_MATERIAL } from '../core/sampleData';
import { ImportCatalogModal } from './ImportCatalogModal';
import { OnlinePriceButton } from './OnlinePriceButton';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { CategoriasMaterialTab } from './insumos/CategoriasMaterialTab';
import { MaterialEditorModal } from './insumos/MaterialEditorModal';
import { QuickCreateMaterialModal } from './insumos/QuickCreateMaterialModal';
import { ProductoEditorModal } from './insumos/ProductoEditorModal';
import { OfertaEditorModal } from './insumos/OfertaEditorModal';
import { MassPriceAdjustModal } from './insumos/MassPriceAdjustModal';

interface InsumosManagerProps {
  filterContext?: MaterialFilterContext | null;
  onClearFilter?: () => void;
  onReturnToSource?: () => void;
}

export const InsumosManager: React.FC<InsumosManagerProps> = ({
  filterContext,
  onClearFilter,
  onReturnToSource,
}) => {
  const { toast } = useToast();
  const confirm = useConfirm();

  const rawCategorias = useLiveQuery(() => db.categoriasMaterial.toArray());
  const rawMateriales = useLiveQuery(() => db.materiales.toArray());
  const rawProductos = useLiveQuery(() => db.productos.toArray());
  const rawOfertas = useLiveQuery(() => db.ofertas.reverse().toArray());
  const rawContactos = useLiveQuery(() => db.contactos.toArray()) || [];
  const rawProveedores = useLiveQuery(() => db.proveedores.toArray()) || [];

  const categorias = useMemo(() => (rawCategorias || []).filter(c => !c.deleted), [rawCategorias]);
  const materiales = useMemo(() => (rawMateriales || []).filter(m => !m.deleted), [rawMateriales]);
  const productos = useMemo(() => (rawProductos || []).filter(p => !p.deleted), [rawProductos]);
  const ofertas = useMemo(() => (rawOfertas || []).filter(o => !o.deleted), [rawOfertas]);

  const proveedores: Contacto[] = useMemo(() => {
    const fromContactos = rawContactos.filter(c => !c.deleted && (c.roles?.includes('proveedor') || !c.roles?.length));
    if (fromContactos.length > 0) return fromContactos;
    return rawProveedores.filter(p => !p.deleted);
  }, [rawContactos, rawProveedores]);
  const configs = useLiveQuery(() => db.config.toArray()) || [];
  const config = configs[0];

  const categoriasMap = useMemo(() => new Map(categorias.map(c => [c.id, c])), [categorias]);
  const proveedoresMap = useMemo(() => new Map(proveedores.map(p => [p.id, p])), [proveedores]);
  const materialesMap = useMemo(() => new Map(materiales.map(m => [m.id, m])), [materiales]);
  const _productosMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

  const [activeTab, setActiveTab] = useState<'materiales' | 'categorias'>('materiales');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [selectedVencimiento, setSelectedVencimiento] = useState<'todos' | 'verde' | 'amarillo' | 'rojo'>('todos');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);

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
  const [editingOferta, setEditingOferta] = useState<Oferta | null>(null);
  const [formDataOferta, setFormDataOferta] = useState<Partial<Oferta>>({
    materialId: '',
    productoId: undefined,
    proveedorId: '',
    precio: 0,
    fuente: 'manual'
  });

  // Modal Categorías Estado
  const [isCreatingCat, setIsCreatingCat] = useState(false);

  const [selectedFichaStatus, setSelectedFichaStatus] = useState<'todas' | 'completas' | 'incompletas'>('todas');
  const [isQuickCreateMat, setIsQuickCreateMat] = useState(false);
  const [formDataQuickMat, setFormDataQuickMat] = useState<{
    nombre: string;
    unidadVenta: string;
    precio: number;
    alicuotaIVA?: number;
    modoPrecio?: 'con_iva' | 'neto';
    proveedorId: string;
  }>({
    nombre: '',
    unidadVenta: 'u',
    precio: 0,
    alicuotaIVA: 21,
    modoPrecio: 'con_iva',
    proveedorId: ''
  });

  const [showMassUpdateModal, setShowMassUpdateModal] = useState(false);
  const [showImportCatalogModal, setShowImportCatalogModal] = useState(false);
  const [tipoAjusteIndice, setTipoAjusteIndice] = useState<'porcentaje' | 'dolar_blue' | 'ipc' | 'canasta'>('porcentaje');
  const [massPercentage, setMassPercentage] = useState<number>(10);
  const [viewModeMat, setViewModeMat] = useState<'grid' | 'table'>('grid');
  const [onlySelectedFilter, setOnlySelectedFilter] = useState(false);
  const [modoCargaContinua, setModoCargaContinua] = useState(false);
  const quickMatNombreRef = useRef<HTMLInputElement>(null);
  const lastProcessedContextRef = useRef<string | null>(null);

  // Auto-select materials when entering with a contextual filter from quote or task
  useEffect(() => {
    if (!filterContext) {
      lastProcessedContextRef.current = null;
      return;
    }

    if (materiales.length === 0) {
      return;
    }

    const contextKey = `${filterContext.title}__${(filterContext.materialIds || []).join(',')}__${(filterContext.materialNames || []).join(',')}`;
    if (lastProcessedContextRef.current === contextKey) {
      return;
    }
    lastProcessedContextRef.current = contextKey;

    setActiveTab('materiales');
    setSelectedCategory('todas');
    setSearchTerm('');
    setSelectedVencimiento('todos');
    setSelectedFichaStatus('todas');

    // Match materials by ID, alternate prefix, product ID, or name
    const targetIds = new Set(filterContext.materialIds || []);
    const targetNames = (filterContext.materialNames || []).map(n => n.toLowerCase().trim()).filter(Boolean);

    const matchedIds = new Set<string>();
    materiales.forEach((mat) => {
      const matIdLower = mat.id.toLowerCase();
      const matNameLower = mat.nombre.toLowerCase().trim();

      const directMatch = targetIds.has(mat.id) || targetIds.has(matIdLower);
      const altPrefixMatch = targetIds.has(mat.id.replace(/^mat-/, 'ins-')) || targetIds.has(mat.id.replace(/^ins-/, 'mat-'));
      const prodMatch = productos.some(p => p.materialId === mat.id && (targetIds.has(p.id) || targetIds.has(p.id.toLowerCase())));
      const nameMatch = targetNames.some(tName => matNameLower.includes(tName) || tName.includes(matNameLower));

      if (directMatch || altPrefixMatch || prodMatch || nameMatch) {
        matchedIds.add(mat.id);
      }
    });

    setSelectedMaterialIds(matchedIds);
    if (matchedIds.size > 0) {
      setOnlySelectedFilter(true);
      toast.success(`Se seleccionaron ${matchedIds.size} materiales de: ${filterContext.title}`);
    } else {
      setOnlySelectedFilter(false);
      toast.info(`Mostrando catálogo completo (${materiales.length} materiales). No se encontraron insumos específicos en la cotización para pre-seleccionar.`);
    }
  }, [filterContext, materiales, productos]);

  const getObraQuantity = (mat: Material) => {
    if (!filterContext?.quantities) return undefined;
    if (filterContext.quantities[mat.id]) return filterContext.quantities[mat.id];
    const altId1 = mat.id.replace(/^mat-/, 'ins-');
    if (filterContext.quantities[altId1]) return filterContext.quantities[altId1];
    const altId2 = mat.id.replace(/^ins-/, 'mat-');
    if (filterContext.quantities[altId2]) return filterContext.quantities[altId2];
    return undefined;
  };

  // Helper para armar ofertas agrupadas por material (priorizando marca preferida)
  const getOfertaVigente = (materialId: string, productoId?: string): Oferta | undefined => {
    if (productoId) {
      return ofertas.find(o => o.materialId === materialId && o.productoId === productoId);
    }
    // 1. Si el material tiene un producto preferido con precio, tomarlo
    const matProds = productos.filter(p => p.materialId === materialId);
    const preferido = matProds.find(p => p.esPreferido);
    if (preferido) {
      const ofertaPreferido = ofertas.find(o => o.materialId === materialId && o.productoId === preferido.id);
      if (ofertaPreferido) return ofertaPreferido;
    }
    // 2. Si no, tomar la oferta más reciente (genérica o de cualquier marca)
    return ofertas.find(o => o.materialId === materialId);
  };

  const handleTogglePreferido = async (p: Producto) => {
    const isNowPreferido = !p.esPreferido;
    const sameMatProds = productos.filter(prod => prod.materialId === p.materialId);
    for (const prod of sameMatProds) {
      if (prod.id === p.id) {
        await db.productos.update(prod.id, { esPreferido: isNowPreferido });
      } else if (isNowPreferido && prod.esPreferido) {
        await db.productos.update(prod.id, { esPreferido: false });
      }
    }
    toast.success(isNowPreferido ? `${p.marca} establecida como marca preferida ⭐` : 'Marca preferida desmarcada');
  };

  // --- Handlers Alta Rápida ---
  const handleOpenQuickCreateMat = () => {
    setFormDataQuickMat({
      nombre: '',
      unidadVenta: 'u',
      precio: 0,
      alicuotaIVA: 21,
      modoPrecio: 'con_iva',
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
      const modo = formDataQuickMat.modoPrecio || 'con_iva';
      const alicuota = formDataQuickMat.alicuotaIVA ?? 21;
      const precioNeto = modo === 'con_iva' ? calcularPrecioNeto(formDataQuickMat.precio, alicuota) : formDataQuickMat.precio;
      const precioFinal = modo === 'con_iva' ? formDataQuickMat.precio : calcularPrecioFinal(formDataQuickMat.precio, alicuota);

      const newOferta: Oferta = {
        id: `oferta-${crypto.randomUUID()}`,
        materialId: matId,
        proveedorId: formDataQuickMat.proveedorId || proveedores[0]?.id || 'prov-general',
        precio: precioNeto, // Canonical neto (GMT)
        precioNeto,
        alicuotaIVA: alicuota,
        precioFinal,
        fecha: now,
        fuente: 'manual'
      };
      await db.ofertas.add(newOferta);
    }

    toast.success(`Material "${newMat.nombre}" creado`);

    if (modoCargaContinua) {
      setFormDataQuickMat({
        nombre: '',
        unidadVenta: formDataQuickMat.unidadVenta,
        precio: 0,
        alicuotaIVA: formDataQuickMat.alicuotaIVA ?? 21,
        modoPrecio: formDataQuickMat.modoPrecio || 'con_iva',
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

  const buildAutoName = (catId?: string, attrs?: { clave: string; valor: string }[]): string => {
    const cat = categoriasMap.get(catId || '');
    if (!cat) return '';
    const parts: string[] = [];
    if (attrs && attrs.length > 0) {
      attrs.forEach(a => {
        if (a.valor && a.valor.trim() !== '') {
          const tpl = cat.atributosSugeridos?.find(s => s.clave === a.clave);
          const etiqueta = tpl ? tpl.etiqueta : a.clave;
          const unidad = tpl && tpl.unidad ? ` ${tpl.unidad}` : '';
          parts.push(`${etiqueta} = ${a.valor}${unidad}`);
        }
      });
    }
    if (parts.length === 0) return cat.nombre;
    return `${cat.nombre} | ${parts.join(' | ')}`;
  };

  const handleOpenCreateMat = () => {
    setEditingMat(null);
    const defaultCat = categorias[0]?.id || '';
    const suggestedAttrs = categorias[0]?.atributosSugeridos?.map(a => ({ clave: a.clave, valor: '' })) || [];
    setFormDataMat({
      categoriaId: defaultCat,
      nombre: categorias[0]?.nombre || '',
      unidadVenta: 'u',
      atributos: suggestedAttrs,
      activo: true,
      fichaIncompleta: false
    });
    setIsCreatingMat(true);
  };

  useEffect(() => {
    const handleNew = () => handleOpenCreateMat();
    window.addEventListener('app:shortcut-new', handleNew);
    return () => window.removeEventListener('app:shortcut-new', handleNew);
  }, [categorias]);

  const handleOpenEditMat = (mat: Material) => {
    setEditingMat(mat);
    setFormDataMat({
      categoriaId: mat.categoriaId,
      nombre: mat.nombre,
      unidadVenta: mat.unidadVenta || 'u',
      atributos: mat.atributos ? mat.atributos.map(a => ({ ...a })) : [],
      activo: mat.activo ?? true,
      urlMercadoLibre: mat.urlMercadoLibre,
      notas: mat.notas,
      fichaIncompleta: mat.fichaIncompleta ?? false
    });
    setIsCreatingMat(true);
  };

  const applyAttributeDependencies = (
    cat: CategoriaMaterial | undefined,
    attrs: { clave: string; valor: string }[]
  ): { clave: string; valor: string }[] => {
    if (!cat?.atributosSugeridos) return attrs;
    let nextAttrs = [...attrs];

    let changed = true;
    let iterations = 0;
    while (changed && iterations < 5) {
      changed = false;
      iterations++;
      for (const tpl of cat.atributosSugeridos) {
        if (!tpl.dependencias || tpl.dependencias.length === 0) continue;
        let blockedVal: string | null = null;
        const allFixedValues: string[] = [];

        for (const dep of tpl.dependencias) {
          if (dep.valorFijo) {
            allFixedValues.push(dep.valorFijo);
          }
          const parentVal = nextAttrs.find(a => a.clave === dep.dependeVinculo)?.valor;
          if (parentVal && parentVal.includes(dep.valorEsperado) && dep.bloqueado && dep.valorFijo) {
            blockedVal = dep.valorFijo;
          }
        }

        const currentIdx = nextAttrs.findIndex(a => a.clave === tpl.clave);
        const currentVal = currentIdx >= 0 ? nextAttrs[currentIdx].valor : '';

        if (blockedVal !== null) {
          if (currentVal !== blockedVal) {
            if (currentIdx >= 0) {
              nextAttrs[currentIdx] = { ...nextAttrs[currentIdx], valor: blockedVal };
            } else {
              nextAttrs.push({ clave: tpl.clave, valor: blockedVal });
            }
            changed = true;
          }
        } else if (allFixedValues.length > 0 && allFixedValues.includes(currentVal)) {
          if (currentIdx >= 0) {
            nextAttrs[currentIdx] = { ...nextAttrs[currentIdx], valor: '' };
            changed = true;
          }
        }
      }
    }
    return nextAttrs;
  };

  const handleCategoryChange = (catId: string) => {
    const cat = categoriasMap.get(catId);
    const prevAtributos = formDataMat.atributos || [];
    let newAtributos = cat?.atributosSugeridos?.map(a => {
      const existing = prevAtributos.find(pa => pa.clave === a.clave);
      return { clave: a.clave, valor: existing ? existing.valor : '' };
    }) || [];

    newAtributos = applyAttributeDependencies(cat, newAtributos);
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
      let currentAttrs = prev.atributos ? [...prev.atributos] : [];
      const idx = currentAttrs.findIndex(a => a.clave === clave);
      if (idx >= 0) {
        currentAttrs[idx] = { ...currentAttrs[idx], valor };
      } else {
        currentAttrs.push({ clave, valor });
      }

      const cat = categoriasMap.get(prev.categoriaId || '');
      currentAttrs = applyAttributeDependencies(cat, currentAttrs);

      const autoName = buildAutoName(prev.categoriaId, currentAttrs);

      return {
        ...prev,
        atributos: currentAttrs,
        nombre: autoName || prev.nombre
      };
    });
  };

  const handleAddCustomAttribute = () => {
    setFormDataMat(prev => ({
      ...prev,
      atributos: [
        ...(prev.atributos || []),
        { clave: `attr_custom_${Date.now().toString().slice(-4)}`, valor: '' }
      ]
    }));
  };

  const handleUpdateCustomAttrKey = (index: number, newKey: string) => {
    setFormDataMat(prev => {
      const next = [...(prev.atributos || [])];
      next[index] = { ...next[index], clave: newKey };
      return { ...prev, atributos: next };
    });
  };

  const handleRemoveAttribute = (clave: string) => {
    setFormDataMat(prev => {
      const next = (prev.atributos || []).filter(a => a.clave !== clave);
      return { ...prev, atributos: next };
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
    const cat = categoriasMap.get(formDataMat.categoriaId || '');
    const cleanAtributos = applyAttributeDependencies(cat, formDataMat.atributos || []);

    if (editingMat) {
      await db.materiales.update(editingMat.id, {
        categoriaId: formDataMat.categoriaId || 'cat-sin-categoria',
        nombre: formDataMat.nombre?.trim() || editingMat.nombre,
        unidadVenta: formDataMat.unidadVenta || 'u',
        atributos: cleanAtributos,
        activo: formDataMat.activo ?? true,
        urlMercadoLibre: formDataMat.urlMercadoLibre,
        notas: formDataMat.notas,
        fichaIncompleta: false,
        updatedAt: now
      });
      setEditingMat(null);
      setIsCreatingMat(false);
      toast.success('Ficha técnica actualizada');
    } else {
      const newMat: Material = {
        id: `mat-${crypto.randomUUID()}`,
        categoriaId: formDataMat.categoriaId || 'cat-sin-categoria',
        nombre: formDataMat.nombre?.trim() || 'Nuevo Material',
        unidadVenta: formDataMat.unidadVenta || 'u',
        atributos: cleanAtributos,
        activo: formDataMat.activo ?? true,
        urlMercadoLibre: formDataMat.urlMercadoLibre,
        notas: formDataMat.notas,
        fichaIncompleta: false,
        createdAt: now,
        updatedAt: now
      };
      await db.materiales.add(newMat);
      setIsCreatingMat(false);
      toast.success('Material agregado al catálogo');
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
    toast.success('Marca/Producto añadido');
  };

  const handleToggleSelectMaterial = (id: string) => {
    setSelectedMaterialIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = (filtered: Material[]) => {
    if (selectedMaterialIds.size === filtered.length) {
      setSelectedMaterialIds(new Set());
    } else {
      setSelectedMaterialIds(new Set(filtered.map(m => m.id)));
    }
  };

  const handleExportCatalog = async (filtered: Material[]) => {
    const targetMats = selectedMaterialIds.size > 0
      ? materiales.filter(m => selectedMaterialIds.has(m.id))
      : filtered;

    if (targetMats.length === 0) {
      toast.warning('No hay materiales seleccionados para exportar.');
      return;
    }

    try {
      const ExcelModule = await import('exceljs');
      const ExcelJS = ExcelModule.default || ExcelModule;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Cotizador IEBA';
      const ws = workbook.addWorksheet('Catálogo de Materiales', {
        views: [{ showGridLines: true }]
      });

      ws.columns = [
        { header: 'ID Material', key: 'id', width: 24 },
        { header: 'Categoría', key: 'categoria', width: 28 },
        { header: 'Material / Descripción Técnica', key: 'material', width: 55 },
        { header: 'Unidad', key: 'unidad', width: 12 },
        { header: 'Atributos Técnicos', key: 'atributos', width: 45 }
      ];

      targetMats.forEach(m => {
        const cat = categoriasMap.get(m.categoriaId);
        const attrStr = m.atributos?.map(a => `${a.clave}: ${a.valor}`).join(' | ') || '';
        ws.addRow({
          id: m.id,
          categoria: cat?.nombre || m.categoriaId,
          material: m.nombre,
          unidad: m.unidadVenta || 'u',
          atributos: attrStr
        });
      });

      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Catalogo_Materiales_IEBA_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Catálogo de materiales exportado a Excel.');
    } catch (err) {
      console.error('Error al exportar catálogo:', err);
      toast.error('Error al generar planilla del catálogo.');
    }
  };

  const handleDeleteMaterial = async (matId: string) => {
    const mat = materialesMap.get(matId);
    const ok = await confirm({
      title: 'Eliminar Material',
      message: `¿Eliminar el material "${mat?.nombre || 'seleccionado'}" y todas sus marcas y precios asociados?`,
      confirmText: 'Eliminar',
      isDestructive: true,
    });
    if (!ok) return;

    await softDelete('materiales', matId);
    const relatedProds = productos.filter(p => p.materialId === matId);
    for (const p of relatedProds) {
      await softDelete('productos', p.id);
    }
    const relatedOfertas = ofertas.filter(o => o.materialId === matId);
    for (const o of relatedOfertas) {
      await softDelete('ofertas', o.id);
    }
    toast.success('Material eliminado');
  };

  const handleDeleteProducto = async (prodId: string) => {
    const ok = await confirm({
      title: 'Eliminar Producto',
      message: '¿Eliminar esta marca/producto registrado?',
      confirmText: 'Eliminar',
      isDestructive: true,
    });
    if (!ok) return;

    await softDelete('productos', prodId);
    const relatedOfertas = ofertas.filter(o => o.productoId === prodId);
    for (const o of relatedOfertas) {
      await softDelete('ofertas', o.id);
    }
    toast.success('Producto eliminado');
  };

  // --- Handlers Ofertas ---
  const handleOpenCreateOferta = (matId: string, prodId?: string) => {
    setEditingOferta(null);
    setFormDataOferta({
      materialId: matId,
      productoId: prodId,
      proveedorId: proveedores[0]?.id || undefined,
      proveedorNombre: proveedores[0]?.razonSocial || proveedores[0]?.nombre || '',
      precio: 0,
      fuente: 'manual',
      presentacionCompra: undefined,
      cantidadPorPresentacion: 1,
      precioPresentacion: 0,
      notas: ''
    });
    setIsCreatingOferta(true);
  };

  const handleOpenEditOferta = (oferta: Oferta) => {
    setEditingOferta(oferta);
    setFormDataOferta({
      materialId: oferta.materialId,
      productoId: oferta.productoId,
      proveedorId: oferta.proveedorId,
      proveedorNombre: oferta.proveedorNombre,
      precio: oferta.precio,
      precioNeto: oferta.precioNeto,
      alicuotaIVA: oferta.alicuotaIVA,
      precioFinal: oferta.precioFinal,
      presentacionCompra: oferta.presentacionCompra,
      cantidadPorPresentacion: oferta.cantidadPorPresentacion,
      precioPresentacion: oferta.precioPresentacion,
      fuente: oferta.fuente || 'manual',
      tipoAjustePrecio: oferta.tipoAjustePrecio,
      notas: oferta.notas || ''
    });
    setIsCreatingOferta(true);
  };

  const handleSaveOferta = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const neto = formDataOferta.precio || 0;
    const alicuota = formDataOferta.alicuotaIVA ?? 21;
    const finalVal = formDataOferta.precioFinal ?? calcularPrecioFinal(neto, alicuota);

    if (editingOferta) {
      await db.ofertas.update(editingOferta.id, {
        productoId: formDataOferta.productoId,
        proveedorId: formDataOferta.proveedorId,
        proveedorNombre: formDataOferta.proveedorNombre,
        precio: neto, // Canonical neto por unidad de consumo
        precioNeto: neto,
        alicuotaIVA: alicuota,
        precioFinal: finalVal,
        presentacionCompra: formDataOferta.presentacionCompra,
        cantidadPorPresentacion: formDataOferta.cantidadPorPresentacion,
        precioPresentacion: formDataOferta.precioPresentacion,
        fecha: now,
        fuente: formDataOferta.fuente || 'manual',
        tipoAjustePrecio: formDataOferta.tipoAjustePrecio,
        notas: formDataOferta.notas
      });
      toast.success('Precio actualizado');
    } else {
      const newOferta: Oferta = {
        id: `oferta-${crypto.randomUUID()}`,
        materialId: formDataOferta.materialId!,
        productoId: formDataOferta.productoId,
        proveedorId: formDataOferta.proveedorId,
        proveedorNombre: formDataOferta.proveedorNombre,
        precio: neto,
        precioNeto: neto,
        alicuotaIVA: alicuota,
        precioFinal: finalVal,
        presentacionCompra: formDataOferta.presentacionCompra,
        cantidadPorPresentacion: formDataOferta.cantidadPorPresentacion,
        precioPresentacion: formDataOferta.precioPresentacion,
        fecha: now,
        fuente: formDataOferta.fuente || 'manual',
        notas: formDataOferta.notas
      };
      await db.ofertas.add(newOferta);
      toast.success('Nuevo precio registrado');
    }

    setIsCreatingOferta(false);
    setEditingOferta(null);
  };

  const handleMassUpdate = async () => {
    if (massPercentage === 0) return;

    const factor = 1 + massPercentage / 100;
    const now = new Date().toISOString();

    const targetMats = selectedMaterialIds.size > 0
      ? materiales.filter(m => selectedMaterialIds.has(m.id))
      : (filterContext && filterContext.materialIds.length > 0
          ? materiales.filter(m => filterContext.materialIds.includes(m.id))
          : (selectedCategory === 'todas' ? materiales : materiales.filter(m => m.categoriaId === selectedCategory)));

    if (targetMats.length === 0) {
      toast.warning('No hay materiales en la selección o categoría indicada.');
      return;
    }

    const newOfertas: Oferta[] = [];

    for (const mat of targetMats) {
      const prods = productos.filter(p => p.materialId === mat.id);
      if (prods.length > 0) {
        for (const prod of prods) {
          const vig = getOfertaVigente(mat.id, prod.id);
          if (vig) {
            newOfertas.push({
              id: `oferta-${crypto.randomUUID()}`,
              materialId: mat.id,
              productoId: prod.id,
              proveedorId: vig.proveedorId,
              precio: Math.round(vig.precio * factor * 100) / 100,
              fecha: now,
              fuente: 'indice',
              tipoAjustePrecio: tipoAjusteIndice
            });
          }
        }
      } else {
        const vig = getOfertaVigente(mat.id);
        if (vig) {
          newOfertas.push({
            id: `oferta-${crypto.randomUUID()}`,
            materialId: mat.id,
            proveedorId: vig.proveedorId,
            precio: Math.round(vig.precio * factor * 100) / 100,
            fecha: now,
            fuente: 'indice',
            tipoAjustePrecio: tipoAjusteIndice
          });
        }
      }
    }

    if (newOfertas.length > 0) {
      await db.ofertas.bulkAdd(newOfertas);
      toast.success(`Aumento de ${massPercentage}% aplicado a ${newOfertas.length} ofertas`);
    } else {
      toast.info('No se encontraron ofertas previas para ajustar.');
    }

    setShowMassUpdateModal(false);
  };

  // Filtrado de materiales
  const filteredMateriales = useMemo(() => {
    const sTerm = searchTerm.toLowerCase().trim();

    return materiales.filter(mat => {
      const cat = categoriasMap.get(mat.categoriaId);
      const matchSearch = !sTerm ||
        mat.nombre.toLowerCase().includes(sTerm) ||
        (cat?.nombre && cat.nombre.toLowerCase().includes(sTerm)) ||
        (cat?.supercategoriaNombre && cat.supercategoriaNombre.toLowerCase().includes(sTerm)) ||
        (mat.atributos && mat.atributos.some(a => a.valor.toLowerCase().includes(sTerm)));
      const matchCat = selectedCategory === 'todas' || mat.categoriaId === selectedCategory;

      let matchFicha = true;
      if (selectedFichaStatus === 'completas') matchFicha = !mat.fichaIncompleta;
      if (selectedFichaStatus === 'incompletas') matchFicha = !!mat.fichaIncompleta;

      let matchVenc = true;
      if (selectedVencimiento !== 'todos') {
        const oferta = getOfertaVigente(mat.id);
        if (!oferta) {
          matchVenc = selectedVencimiento === 'rojo';
        } else {
          const st = obtenerEstadoVencimientoOferta(
            oferta.fecha,
            config?.diasVencimientoPrecioVerde ?? 30,
            config?.diasVencimientoPrecioAmarillo ?? 60
          );
          matchVenc = st === selectedVencimiento;
        }
      }

      let matchSelected = true;
      if (onlySelectedFilter) {
        matchSelected = selectedMaterialIds.has(mat.id);
      }

      return matchSearch && matchCat && matchVenc && matchFicha && matchSelected;
    });
  }, [materiales, searchTerm, selectedCategory, selectedVencimiento, selectedFichaStatus, onlySelectedFilter, selectedMaterialIds, ofertas, config, categoriasMap]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Contextual Filter Banner when viewing from Budget or Task */}
      {filterContext && (
        <div className="bg-primary-container/80 backdrop-blur-sm text-on-primary-container p-4 sm:p-5 rounded-3xl border border-primary/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-primary text-on-primary rounded-2xl shadow-xs shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                  Filtro de Insumos Activo
                </span>
                <span className="text-xs font-mono font-bold text-on-primary-container">
                  {filteredMateriales.length} {filteredMateriales.length === 1 ? 'material listado' : 'materiales listados'}
                </span>
              </div>
              <h3 className="font-bold text-base sm:text-lg text-on-primary-container leading-snug">
                {filterContext.title}
              </h3>
              <p className="text-xs text-on-primary-container/80 mt-0.5">
                Mostrando exclusivamente los insumos de esta obra o tarea para actualizar precios o aplicar índices.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-primary/20">
            {onClearFilter && (
              <button
                type="button"
                onClick={onClearFilter}
                className="px-3.5 py-2 rounded-full text-xs font-semibold hover:bg-on-primary-container/10 transition-colors flex items-center gap-1.5 cursor-pointer text-on-primary-container"
                title="Quitar filtro y ver todo el catálogo"
              >
                <X className="w-4 h-4" />
                <span>Ver Todo</span>
              </button>
            )}
            {onReturnToSource && (
              <button
                type="button"
                onClick={onReturnToSource}
                className="px-4 py-2 bg-primary text-on-primary rounded-full text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                title="Volver a la pantalla de origen"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver al Origen</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-low p-4 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2.5">
            <Package className="w-6 h-6 text-primary" />
            <span>Catálogo de Materiales & Insumos</span>
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Gestión de fichas técnicas normalizadas, marcas comerciales, historial de precios y ofertas por proveedor.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-surface-container p-1 rounded-2xl self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('materiales')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 state-layer transition-all cursor-pointer ${
              activeTab === 'materiales'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Materiales ({materiales.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categorias')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 state-layer transition-all cursor-pointer ${
              activeTab === 'categorias'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Familias & Categorías ({categorias.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'categorias' ? (
        <CategoriasMaterialTab
          categorias={categorias}
          materiales={materiales}
          isCreatingCat={isCreatingCat}
          setIsCreatingCat={setIsCreatingCat}
        />
      ) : (
        <div className="space-y-4">
          {/* Main Action Bar */}
          <div className="bg-surface-container-low p-4 rounded-2xl space-y-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Buscar por nombre técnico, atributos (sección, norma, calibre)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                    showFilters || selectedCategory !== 'todas' || selectedVencimiento !== 'todos' || selectedFichaStatus !== 'todas'
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-surface-container-high border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Filtros</span>
                </button>

                <div className="flex items-center bg-surface-container-high rounded-xl p-1 border border-outline-variant/30">
                  <button
                    type="button"
                    onClick={() => setViewModeMat('grid')}
                    className={`p-1.5 rounded-lg transition-colors ${
                      viewModeMat === 'grid' ? 'bg-surface-container text-primary shadow-xs' : 'text-on-surface-variant'
                    }`}
                    title="Vista en Cuadrícula"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewModeMat('table')}
                    className={`p-1.5 rounded-lg transition-colors ${
                      viewModeMat === 'table' ? 'bg-surface-container text-primary shadow-xs' : 'text-on-surface-variant'
                    }`}
                    title="Vista en Tabla"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMassUpdateModal(true)}
                  className="px-3.5 py-2 bg-surface-container-high hover:bg-surface-variant text-on-surface border border-outline-variant/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Aumento Masivo de Precios"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline">Aumento %</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowImportCatalogModal(true)}
                  className="px-3.5 py-2 bg-surface-container-high hover:bg-surface-variant text-on-surface border border-outline-variant/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Importar catálogo desde Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Importar</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportCatalog(filteredMateriales)}
                  className="px-3.5 py-2 bg-surface-container-high hover:bg-surface-variant text-on-surface border border-outline-variant/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Exportar catálogo de materiales a planilla Excel (XLSX)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Exportar Catálogo</span>
                </button>
              </div>
            </div>

            {/* Quick Filter Chips (Material Design 3) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pt-1 pb-0.5 touch-pan-x overscroll-contain">
              {selectedMaterialIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setOnlySelectedFilter(!onlySelectedFilter)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    onlySelectedFilter
                      ? 'bg-amber-500 text-slate-950 font-bold ring-2 ring-amber-500/50'
                      : 'bg-surface-container-high hover:bg-surface-variant text-on-surface-variant hover:text-on-surface border border-outline-variant/30'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${onlySelectedFilter ? 'fill-slate-950 text-slate-950' : 'text-amber-500'}`} />
                  <span>Solo Seleccionados ({selectedMaterialIds.size})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('todas');
                  setOnlySelectedFilter(false);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  selectedCategory === 'todas' && !onlySelectedFilter
                    ? 'bg-primary text-on-primary font-bold'
                    : 'bg-surface-container-high hover:bg-surface-variant text-on-surface-variant hover:text-on-surface border border-outline-variant/30'
                }`}
              >
                <span>Todas</span>
                <span className="text-[10px] opacity-75 font-mono">({materiales.length})</span>
              </button>

              {categorias.map((cat) => {
                const count = materiales.filter((m) => m.categoriaId === cat.id).length;
                if (count === 0) return null;
                const isSelected = selectedCategory === cat.id && !onlySelectedFilter;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setOnlySelectedFilter(false);
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs ${
                      isSelected
                        ? 'bg-primary-container text-on-primary-container border border-primary/30 font-bold'
                        : 'bg-surface-container-high hover:bg-surface-variant text-on-surface-variant hover:text-on-surface border border-outline-variant/30'
                    }`}
                  >
                    <span>{cat.nombre}</span>
                    <span className="text-[10px] opacity-75 font-mono">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Filter Drawers / Pills */}
            {showFilters && (
              <div className="pt-3 border-t border-outline-variant/20 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">Familia / Categoría</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-surface-container-high border border-outline-variant/30 text-xs text-on-surface focus:outline-none"
                  >
                    <option value="todas">Todas las Categorías ({materiales.length})</option>
                    {(() => {
                      const groups = categorias.reduce((acc, c) => {
                        const superName = c.supercategoriaNombre || 'General / Otros';
                        if (!acc[superName]) acc[superName] = [];
                        acc[superName].push(c);
                        return acc;
                      }, {} as Record<string, typeof categorias>);

                      return Object.entries(groups).map(([supercat, cats]) => (
                        <optgroup key={supercat} label={supercat}>
                          {cats.map((c) => {
                            const count = materiales.filter((m) => m.categoriaId === c.id).length;
                            return (
                              <option key={c.id} value={c.id}>
                                {c.nombre} ({count})
                              </option>
                            );
                          })}
                        </optgroup>
                      ));
                    })()}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">Vigencia del Precio</label>
                  <select
                    value={selectedVencimiento}
                    onChange={(e) => setSelectedVencimiento(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-xl bg-surface-container-high border border-outline-variant/30 text-xs text-on-surface focus:outline-none"
                  >
                    <option value="todos">Todos los Estados</option>
                    <option value="verde">🟢 Vigente (&le; 30 días)</option>
                    <option value="amarillo">🟡 Por Vencer (31 - 60 días)</option>
                    <option value="rojo">🔴 Vencido / Sin Precio (&gt; 60 días)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">Estado de Ficha Técnica</label>
                  <select
                    value={selectedFichaStatus}
                    onChange={(e) => setSelectedFichaStatus(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-xl bg-surface-container-high border border-outline-variant/30 text-xs text-on-surface focus:outline-none"
                  >
                    <option value="todas">Todas las Fichas</option>
                    <option value="completas">Fichas Técnicas Completas</option>
                    <option value="incompletas">⚠️ Fichas Pendientes / Alta Rápida</option>
                  </select>
                </div>
              </div>
            )}

            {/* Mass Selection Toolbar */}
            {selectedMaterialIds.size > 0 && (
              <div className="pt-3 border-t border-outline-variant/20 flex items-center justify-between bg-primary/5 p-3 rounded-2xl border border-primary/20">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-primary">
                    {selectedMaterialIds.size} material{selectedMaterialIds.size > 1 ? 'es' : ''} seleccionado{selectedMaterialIds.size > 1 ? 's' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(filteredMateriales)}
                    className="text-xs text-on-surface-variant hover:text-on-surface underline"
                  >
                    {selectedMaterialIds.size === filteredMateriales.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMassUpdateModal(true)}
                    className="px-3 py-1 bg-primary text-on-primary text-xs font-semibold rounded-lg shadow-xs"
                  >
                    Ajustar Seleccionados
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportCatalog(filteredMateriales)}
                    className="px-3 py-1 bg-surface-container-high hover:bg-surface-variant text-on-surface text-xs font-semibold rounded-lg"
                    title="Exportar materiales seleccionados a Excel"
                  >
                    Exportar Catálogo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Materiales List / Grid */}
          {filteredMateriales.length === 0 ? (
            <div className="text-center py-16 bg-surface-container-low border border-dashed border-outline-variant/30 rounded-3xl p-6 space-y-3">
              <Package className="w-10 h-10 text-outline mx-auto" />
              <p className="text-sm font-semibold text-on-surface">
                {filterContext
                  ? `No se encontraron materiales coincidentes en el catálogo para "${filterContext.title}".`
                  : 'No se encontraron materiales con los filtros aplicados.'}
              </p>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                {filterContext
                  ? 'Es posible que los materiales de esta tarea o cotización hayan sido creados con nombres personalizados o eliminados del catálogo.'
                  : 'Puedes dar de alta un material rápido o crear una ficha técnica completa.'}
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {(onlySelectedFilter || selectedCategory !== 'todas' || searchTerm || selectedVencimiento !== 'todos' || selectedFichaStatus !== 'todas') && (
                  <button
                    type="button"
                    onClick={() => {
                      setOnlySelectedFilter(false);
                      setSelectedCategory('todas');
                      setSearchTerm('');
                      setSelectedVencimiento('todos');
                      setSelectedFichaStatus('todas');
                    }}
                    className="px-4 py-2 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-semibold rounded-full text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" /> Quitar Filtros / Ver Todo
                  </button>
                )}
                {filterContext && onClearFilter && (
                  <button
                    type="button"
                    onClick={onClearFilter}
                    className="px-4 py-2 bg-surface-variant hover:bg-surface-variant/80 text-on-surface font-semibold rounded-full text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" /> Cerrar Vista Contextual
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenQuickCreateMat}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-full text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" /> Alta Rápida
                </button>
                <button
                  type="button"
                  onClick={handleOpenCreateMat}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Ficha Completa
                </button>
              </div>
            </div>
          ) : viewModeMat === 'table' ? (
            <div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-outline-variant/20 bg-surface-container-high/60 text-on-surface-variant font-semibold">
                      <th className="p-3 w-8">
                        <input
                          type="checkbox"
                          checked={selectedMaterialIds.size > 0 && selectedMaterialIds.size === filteredMateriales.length}
                          onChange={() => handleToggleSelectAll(filteredMateriales)}
                          className="w-4 h-4 text-primary rounded"
                        />
                      </th>
                      <th className="p-3">Material / Ficha Técnica</th>
                      <th className="p-3">Familia</th>
                      <th className="p-3">Unidad</th>
                      <th className="p-3">Marcas / Oferta Vigente</th>
                      <th className="p-3 text-right">Precio Vigente ARS</th>
                      <th className="p-3 text-center">Estado</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {filteredMateriales.map((mat) => {
                      const cat = categoriasMap.get(mat.categoriaId);
                      const prods = productos.filter((p) => p.materialId === mat.id);
                      const vigOferta = getOfertaVigente(mat.id);
                      const vigProd = vigOferta?.productoId ? prods.find(p => p.id === vigOferta.productoId) : null;
                      const provNombre = vigOferta
                        ? vigOferta.proveedorId
                          ? (proveedoresMap.get(vigOferta.proveedorId)?.razonSocial || proveedoresMap.get(vigOferta.proveedorId)?.nombre)
                          : vigOferta.proveedorNombre
                        : null;
                      const isSelected = selectedMaterialIds.has(mat.id);

                      const vencState = vigOferta
                        ? obtenerEstadoVencimientoOferta(
                            vigOferta.fecha,
                            config?.diasVencimientoPrecioVerde ?? 30,
                            config?.diasVencimientoPrecioAmarillo ?? 60
                          )
                        : 'rojo';

                      return (
                        <tr
                          key={mat.id}
                          className={`hover:bg-surface-container/60 transition-colors ${
                            isSelected ? 'bg-primary/5' : ''
                          }`}
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectMaterial(mat.id)}
                              className="w-4 h-4 text-primary rounded cursor-pointer"
                            />
                          </td>
                          <td className="p-3 max-w-xs">
                            <div className="font-semibold text-on-surface truncate flex items-center gap-2" title={mat.nombre}>
                              <span>{mat.nombre}</span>
                              {filterContext?.quantities?.[mat.id] && (
                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md shrink-0">
                                  Obra: {filterContext.quantities[mat.id].cantidad} {filterContext.quantities[mat.id].unidad}
                                </span>
                              )}
                            </div>
                            {mat.fichaIncompleta && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                                <AlertCircle className="w-3 h-3" /> Ficha Incompleta (Alta Rápida)
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-on-surface-variant truncate">{cat?.nombre || 'Sin categoría'}</td>
                          <td className="p-3 font-mono">{mat.unidadVenta || 'u'}</td>
                          <td className="p-3">
                            {prods.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {prods.map((p) => {
                                  const prodOferta = getOfertaVigente(mat.id, p.id);
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => handleTogglePreferido(p)}
                                      className={`text-[10px] px-2 py-0.5 rounded-lg font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                                        p.esPreferido
                                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                          : 'bg-surface-container-highest text-on-surface-variant'
                                      }`}
                                      title={p.esPreferido ? 'Marca preferida para presupuestos (clic para alternar)' : 'Clic para marcar como preferida'}
                                    >
                                      {p.esPreferido && <Star className="w-2.5 h-2.5 fill-current" />}
                                      <span>{p.marca} {p.modelo ? `(${p.modelo})` : ''}</span>
                                      {prodOferta && <span className="font-mono text-primary font-bold">({formatARS(prodOferta.precio)})</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-on-surface-variant italic text-[11px]">Genérico</span>
                            )}
                            {provNombre && (
                              <div className="text-[10px] text-on-surface-variant mt-1 truncate max-w-[180px]">
                                Ref: {provNombre}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono text-sm">
                            {vigOferta ? (
                              <div>
                                <span className="font-bold text-primary block">
                                  {formatARS(vigOferta.precio)} <span className="text-[10px] font-normal text-on-surface-variant">Neto/{mat.unidadVenta || 'u'}</span>
                                </span>
                                <span className="text-[10px] text-on-surface-variant font-medium block">
                                  c/IVA ({vigOferta.alicuotaIVA ?? 21}%): {formatARS(vigOferta.precioFinal ?? calcularPrecioFinal(vigOferta.precio, vigOferta.alicuotaIVA ?? 21))}
                                </span>
                                {vigOferta.presentacionCompra && (vigOferta.cantidadPorPresentacion || 1) > 1 && (
                                  <span className="text-[10px] text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-md inline-block mt-0.5" title={`Cotizado por ${vigOferta.presentacionCompra}`}>
                                    📦 {vigOferta.presentacionCompra}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-on-surface-variant">-</span>
                            )}
                            {vigProd && (
                              <span className="text-[10px] text-on-surface-variant font-normal block">
                                {vigProd.marca} {vigProd.esPreferido ? '⭐' : ''}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`w-2.5 h-2.5 rounded-full inline-block ${
                                vencState === 'verde'
                                  ? 'bg-emerald-500'
                                  : vencState === 'amarillo'
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              title={`Vigencia: ${vencState}`}
                            />
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <OnlinePriceButton
                                tipo="material"
                                customNombre={mat.nombre}
                                size="xs"
                                variant="icon"
                              />
                              <button
                                type="button"
                                onClick={() => handleOpenCreateOferta(mat.id)}
                                className="p-1 text-on-surface-variant hover:text-emerald-500 rounded-lg hover:bg-surface-variant"
                                title="Cargar nuevo precio / oferta"
                              >
                                <TrendingUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditMat(mat)}
                                className="p-1 text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-variant"
                                title="Editar ficha técnica"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMaterial(mat.id)}
                                className="p-1 text-on-surface-variant hover:text-rose-500 rounded-lg hover:bg-surface-variant"
                                title="Eliminar material"
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
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMateriales.map((mat) => {
                const cat = categoriasMap.get(mat.categoriaId);
                const prods = productos.filter((p) => p.materialId === mat.id);
                const vigOferta = getOfertaVigente(mat.id);
                const vigProd = vigOferta?.productoId ? prods.find(p => p.id === vigOferta.productoId) : null;
                const provNombre = vigOferta
                  ? vigOferta.proveedorId
                    ? (proveedoresMap.get(vigOferta.proveedorId)?.razonSocial || proveedoresMap.get(vigOferta.proveedorId)?.nombre)
                    : vigOferta.proveedorNombre
                  : null;
                const isSelected = selectedMaterialIds.has(mat.id);

                const vencState = vigOferta
                  ? obtenerEstadoVencimientoOferta(
                      vigOferta.fecha,
                      config?.diasVencimientoPrecioVerde ?? 30,
                      config?.diasVencimientoPrecioAmarillo ?? 60
                    )
                  : 'rojo';

                return (
                  <div
                    key={mat.id}
                    className={`bg-surface-container-low hover:bg-surface-container-high rounded-2xl p-5 transition-colors flex flex-col justify-between relative ${
                      isSelected ? 'ring-2 ring-primary bg-primary-container/10' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectMaterial(mat.id)}
                            className="w-4 h-4 text-primary rounded cursor-pointer"
                          />
                          <span className="text-[11px] font-semibold text-on-primary-container bg-primary-container px-2.5 py-0.5 rounded-lg select-none">
                            {cat?.nombre || 'General'}
                          </span>
                          {filterContext?.quantities?.[mat.id] && (
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg select-none">
                              Obra: {filterContext.quantities[mat.id].cantidad} {filterContext.quantities[mat.id].unidad}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              vencState === 'verde'
                                ? 'bg-emerald-500'
                                : vencState === 'amarillo'
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            title={`Estado de Vigencia: ${vencState}`}
                          />
                          <OnlinePriceButton tipo="material" customNombre={mat.nombre} size="xs" variant="icon" />
                        </div>
                      </div>

                      <h4 className="font-bold text-on-surface text-sm mt-2.5 leading-snug line-clamp-2">
                        {mat.nombre}
                      </h4>

                      {mat.fichaIncompleta && (
                        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold select-none">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Ficha Incompleta (Alta Rápida)</span>
                        </div>
                      )}

                      {/* Technical Attributes Chips (8dp) */}
                      {mat.atributos && mat.atributos.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {mat.atributos
                            .filter((a) => a.valor)
                            .map((a, idx) => (
                              <span
                                key={idx}
                                className="text-[11px] bg-surface-container text-on-surface-variant px-2.5 py-0.5 rounded-lg font-mono select-none"
                              >
                                {a.clave}: {a.valor}
                              </span>
                            ))}
                        </div>
                      )}

                      {/* Products / Brands Breakdown */}
                      <div className="mt-3 pt-2.5 border-t border-outline-variant/15 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-medium">
                          <span>Marcas & Modelos ({prods.length}):</span>
                          <button
                            type="button"
                            onClick={() => handleOpenCreateProd(mat.id)}
                            className="text-primary hover:underline font-semibold text-[11px] cursor-pointer"
                          >
                            + Agregar Marca
                          </button>
                        </div>
                        {prods.length > 0 ? (
                          <div className="space-y-1.5">
                            {prods.map((p) => {
                              const prodOferta = getOfertaVigente(mat.id, p.id);
                              const prodProv = prodOferta
                                ? prodOferta.proveedorId
                                  ? (proveedoresMap.get(prodOferta.proveedorId)?.razonSocial || proveedoresMap.get(prodOferta.proveedorId)?.nombre)
                                  : prodOferta.proveedorNombre
                                : null;
                              return (
                                <div
                                  key={p.id}
                                  className="text-[11px] bg-surface-container-highest/60 hover:bg-surface-container-highest text-on-surface p-2 rounded-xl flex items-center justify-between gap-2 group transition-colors"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <button
                                      type="button"
                                      onClick={() => handleTogglePreferido(p)}
                                      title={p.esPreferido ? 'Marca preferida para presupuestos (clic para alternar)' : 'Establecer como marca preferida'}
                                      className="cursor-pointer"
                                    >
                                      <Star
                                        className={`w-3.5 h-3.5 ${
                                          p.esPreferido ? 'text-amber-500 fill-amber-500' : 'text-on-surface-variant/40 hover:text-amber-500'
                                        }`}
                                      />
                                    </button>
                                    <span className="font-semibold truncate">
                                      {p.marca} {p.modelo ? `(${p.modelo})` : ''}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {prodOferta ? (
                                      <div className="text-right font-mono text-[11px]">
                                        <span className="font-bold text-primary">{formatARS(prodOferta.precio)}</span>
                                        {prodProv && (
                                          <span className="text-[10px] text-on-surface-variant block truncate max-w-[100px]" title={prodProv}>
                                            {prodProv}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-on-surface-variant italic">Sin precio</span>
                                    )}

                                    <OnlinePriceButton
                                      tipo="material"
                                      customNombre={`${mat.nombre} ${p.marca} ${p.modelo || ''}`.trim()}
                                      size="xs"
                                      variant="icon"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleOpenCreateOferta(mat.id, p.id)}
                                      className="p-1 rounded-full text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                      title={`Cargar nuevo precio para ${p.marca}`}
                                    >
                                      <TrendingUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteProducto(p.id)}
                                      className="text-on-surface-variant hover:text-error opacity-40 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5"
                                      title="Eliminar marca"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[11px] text-on-surface-variant italic">Genérico / Sin marca registrada</p>
                        )}
                      </div>
                    </div>

                    {/* Pricing & Footer Actions */}
                    <div className="mt-4 pt-3 border-t border-outline-variant/15 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-on-surface-variant block font-mono">
                          Precio Vigente /{mat.unidadVenta || 'u'}:
                        </span>
                        {vigOferta ? (
                          <div>
                            <div className="font-mono text-base font-bold text-primary">
                              {formatARS(vigOferta.precio)} <span className="text-[11px] font-normal text-on-surface-variant">Neto/{mat.unidadVenta || 'u'}</span>
                            </div>
                            <div className="text-[11px] font-mono text-on-surface-variant">
                              c/IVA ({vigOferta.alicuotaIVA ?? 21}%): <strong className="text-on-surface">{formatARS(vigOferta.precioFinal ?? calcularPrecioFinal(vigOferta.precio, vigOferta.alicuotaIVA ?? 21))}</strong>
                            </div>
                            {vigOferta.presentacionCompra && (vigOferta.cantidadPorPresentacion || 1) > 1 && (
                              <div className="text-[10px] text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-md inline-block mt-0.5" title={`Cotizado por ${vigOferta.presentacionCompra}`}>
                                📦 {vigOferta.presentacionCompra}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="font-mono text-sm font-semibold text-on-surface-variant italic">
                            Sin precio
                          </div>
                        )}
                        {provNombre && (
                          <span className="text-[10px] text-on-surface-variant block truncate max-w-[150px] mt-0.5" title={provNombre}>
                            {provNombre} {vigProd ? `(${vigProd.marca})` : ''}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleOpenCreateOferta(mat.id)}
                          className="min-w-[40px] min-h-[40px] p-2 text-on-surface-variant hover:text-primary rounded-full state-layer transition-colors flex items-center justify-center cursor-pointer"
                          title="Cargar nuevo precio / oferta"
                          aria-label="Cargar nuevo precio"
                        >
                          <TrendingUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateMat(mat)}
                          className="min-w-[40px] min-h-[40px] p-2 text-on-surface-variant hover:text-primary rounded-full state-layer transition-colors flex items-center justify-center cursor-pointer"
                          title="Duplicar material"
                          aria-label="Duplicar material"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditMat(mat)}
                          className="min-w-[40px] min-h-[40px] p-2 text-on-surface-variant hover:text-primary rounded-full state-layer transition-colors flex items-center justify-center cursor-pointer"
                          title="Editar ficha técnica"
                          aria-label="Editar ficha técnica"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMaterial(mat.id)}
                          className="min-w-[40px] min-h-[40px] p-2 text-on-surface-variant hover:text-error rounded-full state-layer transition-colors flex items-center justify-center cursor-pointer"
                          title="Eliminar material"
                          aria-label="Eliminar material"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <MaterialEditorModal
        isOpen={isCreatingMat}
        onClose={() => {
          setIsCreatingMat(false);
          setEditingMat(null);
        }}
        editingMat={editingMat}
        categorias={categorias}
        categoriasMap={categoriasMap}
        formDataMat={formDataMat}
        setFormDataMat={setFormDataMat}
        onCategoryChange={handleCategoryChange}
        onAttributeValueChange={handleAttributeValueChange}
        onAddCustomAttribute={handleAddCustomAttribute}
        onUpdateCustomAttrKey={handleUpdateCustomAttrKey}
        onRemoveAttribute={handleRemoveAttribute}
        onAutoGenerateName={handleAutoGenerateName}
        onOpenCreateCat={() => {
          setIsCreatingMat(false);
          setIsCreatingCat(true);
        }}
        onRestoreDefaultCategories={async () => {
          await db.categoriasMaterial.bulkPut(INITIAL_CATEGORIAS_MATERIAL);
          toast.success('Categorías restauradas');
        }}
        onSave={handleSaveMaterial}
      />

      <QuickCreateMaterialModal
        isOpen={isQuickCreateMat}
        onClose={() => setIsQuickCreateMat(false)}
        formDataQuickMat={formDataQuickMat}
        setFormDataQuickMat={setFormDataQuickMat}
        proveedores={proveedores}
        modoCargaContinua={modoCargaContinua}
        setModoCargaContinua={setModoCargaContinua}
        onSave={handleSaveQuickMat}
      />

      <ProductoEditorModal
        isOpen={isCreatingProd}
        onClose={() => setIsCreatingProd(false)}
        formDataProd={formDataProd}
        setFormDataProd={setFormDataProd}
        onSave={handleSaveProducto}
      />

      <OfertaEditorModal
        isOpen={isCreatingOferta}
        onClose={() => {
          setIsCreatingOferta(false);
          setEditingOferta(null);
        }}
        editingOferta={editingOferta}
        proveedores={proveedores}
        productos={productos.filter(p => p.materialId === (formDataOferta.materialId || targetMatId))}
        formDataOferta={formDataOferta}
        setFormDataOferta={setFormDataOferta}
        unidadVenta={materiales.find(m => m.id === (formDataOferta.materialId || targetMatId))?.unidadVenta || 'u'}
        onSave={handleSaveOferta}
      />

      <MassPriceAdjustModal
        isOpen={showMassUpdateModal}
        onClose={() => setShowMassUpdateModal(false)}
        tipoAjusteIndice={tipoAjusteIndice}
        setTipoAjusteIndice={setTipoAjusteIndice}
        massPercentage={massPercentage}
        setMassPercentage={setMassPercentage}
        onApply={handleMassUpdate}
      />

      <ImportCatalogModal
        isOpen={showImportCatalogModal}
        onClose={() => setShowImportCatalogModal(false)}
        onSuccess={() => {
          setShowImportCatalogModal(false);
          toast.success('Catálogo importado exitosamente');
        }}
      />

      {/* Floating Speed Dial FAB */}
      <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-30 floating-action-btn flex flex-col items-end gap-2.5">
        {isSpeedDialOpen && (
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-2xs z-20"
            onClick={() => setIsSpeedDialOpen(false)}
          />
        )}

        {isSpeedDialOpen && (
          <div className="flex flex-col items-end gap-2.5 z-30 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1.5 rounded-xl bg-surface-container-high text-xs font-semibold text-on-surface shadow-md border border-outline-variant/30 select-none">
                Alta Rápida (1 Clic)
              </span>
              <button
                type="button"
                onClick={() => {
                  handleOpenQuickCreateMat();
                  setIsSpeedDialOpen(false);
                }}
                className="w-12 h-12 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg active:scale-95 transition-all"
                title="Alta Rápida de Material"
              >
                <Zap className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1.5 rounded-xl bg-surface-container-high text-xs font-semibold text-on-surface shadow-md border border-outline-variant/30 select-none">
                Ficha Técnica Completa
              </span>
              <button
                type="button"
                onClick={() => {
                  handleOpenCreateMat();
                  setIsSpeedDialOpen(false);
                }}
                className="w-12 h-12 rounded-2xl bg-primary hover:bg-primary/90 text-on-primary flex items-center justify-center shadow-lg active:scale-95 transition-all"
                title="Nuevo Material (Ficha Completa)"
              >
                <FileText className="w-5 h-5" />
              </button>
            </div>

            {activeTab === 'categorias' && (
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1.5 rounded-xl bg-surface-container-high text-xs font-semibold text-on-surface shadow-md border border-outline-variant/30 select-none">
                  Nueva Categoría
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingCat(true);
                    setIsSpeedDialOpen(false);
                  }}
                  className="w-12 h-12 rounded-2xl bg-secondary hover:bg-secondary/90 text-on-secondary flex items-center justify-center shadow-lg active:scale-95 transition-all"
                  title="Nueva Categoría"
                >
                  <Layers className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            if (activeTab === 'categorias' && !isSpeedDialOpen) {
              setIsSpeedDialOpen(true);
            } else {
              setIsSpeedDialOpen((prev) => !prev);
            }
          }}
          className={`w-14 h-14 rounded-2xl md:rounded-3xl bg-primary hover:bg-primary/90 text-on-primary shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center transition-all z-30 ${
            isSpeedDialOpen ? 'bg-primary-container text-on-primary-container' : ''
          }`}
          aria-label={isSpeedDialOpen ? 'Cerrar opciones' : 'Nuevo material o ficha'}
          title="Nuevo Material / Alta Rápida"
        >
          <Plus
            className={`w-7 h-7 transition-transform duration-200 ${
              isSpeedDialOpen ? 'rotate-45' : ''
            }`}
          />
        </button>
      </div>
    </div>
  );
};
