import { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import {
  Material,
  Producto,
  Oferta,
  CategoriaMaterial,
  Contacto,
  MaterialFilterContext
} from '../core/types';
import {
  matchesMaterialContext,
  getObraQuantity,
  resolveOfertaVigente
} from '../core/materialMatching';
import { obtenerEstadoVencimientoOferta } from '../core/calculations';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import * as ExcelJS from 'exceljs';

export interface UseInsumosManagerViewModelProps {
  filterContext?: MaterialFilterContext | null;
  onClearFilter?: () => void;
  onReturnToSource?: () => void;
}

export function useInsumosManagerViewModel({
  filterContext,
  onClearFilter,
  onReturnToSource
}: UseInsumosManagerViewModelProps = {}) {
  const { toast } = useToast();
  const confirm = useConfirm();

  // ─── Data Access (Dexie Live Queries) ──────────────────────────────────────────
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

  // ─── UI & Filter State ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'materiales' | 'categorias'>('materiales');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [selectedVencimiento, setSelectedVencimiento] = useState<'todos' | 'verde' | 'amarillo' | 'rojo'>('todos');
  const [selectedFichaStatus, setSelectedFichaStatus] = useState<'todas' | 'completas' | 'incompletas'>('todas');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
  const [viewModeMat, setViewModeMat] = useState<'grid' | 'table'>('grid');

  // Modals state
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

  const [isCreatingCat, setIsCreatingCat] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoriaMaterial | null>(null);
  const [formDataCat, setFormDataCat] = useState<Partial<CategoriaMaterial>>({
    nombre: '',
    atributosSugeridos: []
  });

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
  const [showBlockPriceModal, setShowBlockPriceModal] = useState(false);
  const [showImportCatalogModal, setShowImportCatalogModal] = useState(false);
  const [tipoAjusteIndice, setTipoAjusteIndice] = useState<'porcentaje' | 'dolar_blue' | 'ipc' | 'canasta'>('porcentaje');
  const [massPercentage, setMassPercentage] = useState<number>(10);
  const [modoCargaContinua, setModoCargaContinua] = useState(false);
  const quickMatNombreRef = useRef<HTMLInputElement>(null);

  // Auto-reset filters when entering with a contextual filter from quote or task
  useEffect(() => {
    if (filterContext) {
      setActiveTab('materiales');
      setSelectedCategory('todas');
      setSearchTerm('');
      setSelectedVencimiento('todos');
      setSelectedFichaStatus('todas');
      setSelectedMaterialIds(new Set());
    }
  }, [filterContext]);

  // Helper para resolver oferta vigente
  const getOfertaVigente = (materialId: string, productoId?: string): Oferta | undefined => {
    return resolveOfertaVigente(materialId, ofertas, productos, productoId);
  };

  // ─── Filtered Materials (Domain + UI rules) ───────────────────────────────────
  const filteredMateriales = useMemo(() => {
    const sTerm = searchTerm.toLowerCase().trim();

    return materiales.filter(mat => {
      // 1. Filtro Contextual Directo (desde Cotización o Tarea Tipo)
      if (filterContext) {
        if (!matchesMaterialContext(mat, filterContext, productos)) {
          return false;
        }
      }

      // 2. Búsqueda por texto libre
      if (sTerm) {
        const cat = categoriasMap.get(mat.categoriaId);
        const matchSearch = mat.nombre.toLowerCase().includes(sTerm) ||
          (cat?.nombre && cat.nombre.toLowerCase().includes(sTerm)) ||
          (cat?.supercategoriaNombre && cat.supercategoriaNombre.toLowerCase().includes(sTerm)) ||
          (mat.atributos && mat.atributos.some(a => a.valor.toLowerCase().includes(sTerm)));
        if (!matchSearch) return false;
      }

      // 3. Filtro por Categoría
      if (selectedCategory !== 'todas') {
        if (mat.categoriaId !== selectedCategory) return false;
      }

      // 4. Filtro por Ficha Técnica
      if (selectedFichaStatus === 'completas' && mat.fichaIncompleta) return false;
      if (selectedFichaStatus === 'incompletas' && !mat.fichaIncompleta) return false;

      // 5. Filtro por Vencimiento de Precios
      if (selectedVencimiento !== 'todos') {
        const oferta = getOfertaVigente(mat.id);
        if (!oferta) {
          if (selectedVencimiento !== 'rojo') return false;
        } else {
          const st = obtenerEstadoVencimientoOferta(
            oferta.fecha,
            config?.diasVencimientoPrecioVerde ?? 30,
            config?.diasVencimientoPrecioAmarillo ?? 60
          );
          if (st !== selectedVencimiento) return false;
        }
      }

      return true;
    });
  }, [materiales, filterContext, productos, searchTerm, selectedCategory, selectedVencimiento, selectedFichaStatus, ofertas, config, categoriasMap]);

  // ─── Actions / Commands ───────────────────────────────────────────────────────
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

  const handleToggleSelectMaterial = (matId: string) => {
    setSelectedMaterialIds(prev => {
      const next = new Set(prev);
      if (next.has(matId)) next.delete(matId);
      else next.add(matId);
      return next;
    });
  };

  const handleToggleSelectAll = (matsToToggle: Material[]) => {
    if (selectedMaterialIds.size === matsToToggle.length && matsToToggle.length > 0) {
      setSelectedMaterialIds(new Set());
    } else {
      setSelectedMaterialIds(new Set(matsToToggle.map(m => m.id)));
    }
  };

  const handleApplyMassUpdate = async () => {
    if (massPercentage === 0) return;
    const factor = 1 + massPercentage / 100;
    const now = new Date().toISOString();

    const targetMats = selectedMaterialIds.size > 0
      ? materiales.filter(m => selectedMaterialIds.has(m.id))
      : (filterContext
          ? filteredMateriales
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

  const handleApplyBlockPrice = async (data: {
    precioNetoUnitario: number;
    precioFinalUnitario: number;
    alicuotaIVA: number;
    proveedorId?: string;
    proveedorNombre?: string;
    presentacionCompra?: string;
    cantidadPorPresentacion?: number;
    precioPresentacion?: number;
  }) => {
    const now = new Date().toISOString();
    const targetMats = selectedMaterialIds.size > 0
      ? materiales.filter(m => selectedMaterialIds.has(m.id))
      : (filterContext
          ? filteredMateriales
          : (selectedCategory === 'todas' && !searchTerm ? materiales : filteredMateriales));

    if (targetMats.length === 0) {
      toast.warning('No hay materiales seleccionados o en el filtro actual.');
      return;
    }

    const newOfertas: Oferta[] = [];

    for (const mat of targetMats) {
      const prods = productos.filter(p => p.materialId === mat.id);
      const prefProd = prods.find(p => p.esPreferido) || prods[0];

      newOfertas.push({
        id: `oferta-${crypto.randomUUID()}`,
        materialId: mat.id,
        productoId: prefProd?.id,
        proveedorId: data.proveedorId,
        proveedorNombre: data.proveedorNombre,
        precio: data.precioNetoUnitario,
        precioNeto: data.precioNetoUnitario,
        alicuotaIVA: data.alicuotaIVA,
        precioFinal: data.precioFinalUnitario,
        presentacionCompra: data.presentacionCompra,
        cantidadPorPresentacion: data.cantidadPorPresentacion,
        precioPresentacion: data.precioPresentacion,
        fecha: now,
        fuente: 'manual'
      });
    }

    if (newOfertas.length > 0) {
      await db.ofertas.bulkAdd(newOfertas);
      toast.success(`Precio común asignado con éxito a ${newOfertas.length} materiales`);
    }

    setShowBlockPriceModal(false);
  };

  const handleExportCatalog = async (matsToExport: Material[]) => {
    try {
      const ExcelJSModule = (ExcelJS as any).default || ExcelJS;
      const workbook = new ExcelJSModule.Workbook();
      const worksheet = workbook.addWorksheet('Catálogo Materiales');

      worksheet.columns = [
        { header: 'ID Material', key: 'id', width: 25 },
        { header: 'Categoría', key: 'categoria', width: 25 },
        { header: 'Nombre del Material', key: 'nombre', width: 40 },
        { header: 'Unidad de Venta', key: 'unidad', width: 15 },
        { header: 'Marca Preferida', key: 'marca', width: 20 },
        { header: 'Modelo', key: 'modelo', width: 20 },
        { header: 'Precio Vigente ARS', key: 'precio', width: 20 },
        { header: 'Proveedor', key: 'proveedor', width: 25 },
        { header: 'Fecha de Cotización', key: 'fecha', width: 20 }
      ];

      for (const mat of matsToExport) {
        const cat = categoriasMap.get(mat.categoriaId);
        const prods = productos.filter(p => p.materialId === mat.id);
        const vigOferta = getOfertaVigente(mat.id);
        const vigProd = vigOferta?.productoId ? prods.find(p => p.id === vigOferta.productoId) : null;
        const prov = vigOferta?.proveedorId ? proveedoresMap.get(vigOferta.proveedorId) : null;

        worksheet.addRow({
          id: mat.id,
          categoria: cat?.nombre || mat.categoriaId,
          nombre: mat.nombre,
          unidad: mat.unidadVenta || 'u',
          marca: vigProd?.marca || 'Genérico',
          modelo: vigProd?.modelo || '',
          precio: vigOferta ? vigOferta.precio : 0,
          proveedor: prov?.razonSocial || prov?.nombre || vigOferta?.proveedorNombre || 'Sin proveedor',
          fecha: vigOferta ? new Date(vigOferta.fecha).toLocaleDateString('es-AR') : '-'
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `catalogo_materiales_${new Date().toISOString().slice(0, 10)}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      toast.success('Catálogo exportado exitosamente.');
    } catch (err) {
      console.error('Error al exportar catálogo:', err);
      toast.error('Error al exportar catálogo a Excel.');
    }
  };

  return {
    // Data
    categorias,
    materiales,
    productos,
    ofertas,
    proveedores,
    config,
    categoriasMap,
    proveedoresMap,
    materialesMap,
    filteredMateriales,
    filterContext,

    // UI & Filter States
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    selectedVencimiento,
    setSelectedVencimiento,
    selectedFichaStatus,
    setSelectedFichaStatus,
    selectedMaterialIds,
    setSelectedMaterialIds,
    showFilters,
    setShowFilters,
    isSpeedDialOpen,
    setIsSpeedDialOpen,
    viewModeMat,
    setViewModeMat,

    // Modal States & Forms
    isCreatingMat,
    setIsCreatingMat,
    editingMat,
    setEditingMat,
    formDataMat,
    setFormDataMat,
    isCreatingProd,
    setIsCreatingProd,
    targetMatId,
    setTargetMatId,
    formDataProd,
    setFormDataProd,
    isCreatingOferta,
    setIsCreatingOferta,
    editingOferta,
    setEditingOferta,
    formDataOferta,
    setFormDataOferta,
    isCreatingCat,
    setIsCreatingCat,
    editingCat,
    setEditingCat,
    formDataCat,
    setFormDataCat,
    isQuickCreateMat,
    setIsQuickCreateMat,
    formDataQuickMat,
    setFormDataQuickMat,
    showMassUpdateModal,
    setShowMassUpdateModal,
    showBlockPriceModal,
    setShowBlockPriceModal,
    showImportCatalogModal,
    setShowImportCatalogModal,
    tipoAjusteIndice,
    setTipoAjusteIndice,
    massPercentage,
    setMassPercentage,
    modoCargaContinua,
    setModoCargaContinua,
    quickMatNombreRef,

    // Methods & Commands
    getOfertaVigente,
    getObraQuantity: (mat: Material | string) => getObraQuantity(typeof mat === 'string' ? mat : mat.id, filterContext?.quantities),
    handleTogglePreferido,
    handleToggleSelectMaterial,
    handleToggleSelectAll,
    handleApplyMassUpdate,
    handleApplyBlockPrice,
    handleExportCatalog,
    onClearFilter,
    onReturnToSource
  };
}
