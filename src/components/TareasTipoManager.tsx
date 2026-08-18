import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Calculator, Plus, BookOpen, Sliders, BarChart3, ShieldAlert } from 'lucide-react';
import { db, softDelete } from '../db/database';
import { TareaTipo, Insumo, CategoriaManoDeObra, Oferta, Producto, MaterialFilterContext } from '../core/types';
import { useAppConfig } from '../hooks/useAppConfig';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { CatalogoSubmodulo } from './tareasTipo/CatalogoSubmodulo';
import { SimulacionWhatIfSubmodulo } from './tareasTipo/SimulacionWhatIfSubmodulo';
import { CalibracionEmaSubmodulo } from './tareasTipo/CalibracionEmaSubmodulo';
import { AuditoriaSubmodulo } from './tareasTipo/AuditoriaSubmodulo';
import { TareaEditorModal, TareaFormData } from './tareasTipo/TareaEditorModal';

interface TareasTipoManagerProps {
  onViewMaterialsInCatalog?: (ctx: MaterialFilterContext) => void;
}

export const TareasTipoManager: React.FC<TareasTipoManagerProps> = ({
  onViewMaterialsInCatalog,
}) => {
  const { config, categoriasTarea } = useAppConfig();
  const { toast } = useToast();
  const confirm = useConfirm();

  const tareasTipo = (useLiveQuery(() => db.tareasTipo.toArray()) || []).filter((t) => !t.deleted);
  const legacyInsumos = (useLiveQuery(() => db.insumos.toArray()) || []).filter((i) => !i.deleted);
  const materiales = (useLiveQuery(() => db.materiales.toArray()) || []).filter((m) => !m.deleted);
  const productos = (useLiveQuery(() => db.productos.toArray()) || []).filter((p) => !p.deleted);
  const ofertas = (useLiveQuery(() => db.ofertas.toArray()) || []).filter((o) => !o.deleted);
  const manoObraList = (useLiveQuery(() => db.manoObra.toArray()) || []).filter((m) => !m.deleted);
  const registrosTrabajo = (useLiveQuery(() => db.registrosTrabajo.toArray()) || []).filter((r) => !r.deleted);

  const insumosMap = new Map<string, Insumo>();
  legacyInsumos.forEach((i) => insumosMap.set(i.id, i));
  const sortedOfertas = [...ofertas].sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());
  materiales.forEach((m) => {
    const matProds = productos.filter((p) => p.materialId === m.id);
    const preferido = matProds.find((p) => p.esPreferido);
    let oferta: Oferta | undefined;
    if (preferido) {
      oferta = sortedOfertas.filter((o) => o.materialId === m.id && o.productoId === preferido.id).pop();
    }
    if (!oferta) {
      oferta = sortedOfertas.filter((o) => o.materialId === m.id).pop();
    }
    insumosMap.set(m.id, {
      ...m,
      id: m.id,
      nombre: m.nombre,
      unidad: m.unidadVenta || 'u',
      categoria: m.categoriaId,
      precioActual: oferta ? oferta.precio : (m as any).precioActual || 0,
      fechaActualizacion: oferta ? oferta.fecha : new Date().toISOString(),
      historialPrecios: [],
    });
  });
  const manoObraMap = new Map<string, CategoriaManoDeObra>(manoObraList.map((m) => [m.id, m]));

  const [activeSubmodulo, setActiveSubmodulo] = useState<'catalogo' | 'simulacion' | 'calibracion' | 'auditoria'>('catalogo');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('todas');

  // Simulation State
  const [simulatedTareaId, setSimulatedTareaId] = useState<string>('');
  const [simMaterialesPct, setSimMaterialesPct] = useState<number>(0);
  const [simManoObraPct, setSimManoObraPct] = useState<number>(0);
  const [simHorasExtra, setSimHorasExtra] = useState<number>(0);
  const [simMargenPct, setSimMargenPct] = useState<number>(config?.margenPorDefectoPct || 35);

  // Editor Modal States
  const [editingTarea, setEditingTarea] = useState<TareaTipo | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleOpenCreate = () => {
    setEditingTarea(null);
    setIsCreating(true);
  };

  useEffect(() => {
    const handleNew = () => handleOpenCreate();
    window.addEventListener('app:shortcut-new', handleNew);
    return () => window.removeEventListener('app:shortcut-new', handleNew);
  }, []);

  const handleOpenEdit = (tarea: TareaTipo) => {
    setEditingTarea(tarea);
    setIsCreating(false);
  };

  const handleDuplicateTarea = (t: TareaTipo) => {
    setEditingTarea({
      ...t,
      id: '',
      nombre: `${t.nombre} (Copia)`,
    });
    setIsCreating(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Eliminar Tarea Tipo',
      message: '¿Estás seguro de eliminar esta tarea tipo del catálogo?',
      confirmText: 'Eliminar',
      isDestructive: true,
    });
    if (ok) {
      await softDelete('tareasTipo', id);
      toast.success('Tarea tipo eliminada correctamente');
    }
  };

  const handleSaveTarea = async (formData: TareaFormData) => {
    const now = new Date().toISOString();

    if (isCreating || !editingTarea?.id) {
      await db.tareasTipo.add({
        id: `tt-${crypto.randomUUID()}`,
        nombre: formData.nombre.trim(),
        categoria: formData.categoria.trim(),
        unidad: formData.unidad.trim() || 'punto',
        notasTecnicas: formData.notasTecnicas.trim() || undefined,
        insumos: formData.insumos,
        manoObra: formData.manoObra,
        factorCorreccion: 1.0,
        createdAt: now,
        updatedAt: now,
        deleted: false,
      });
      toast.success('¡Tarea tipo creada con éxito!');
      setIsCreating(false);
      setEditingTarea(null);
    } else {
      await db.tareasTipo.update(editingTarea.id, {
        nombre: formData.nombre.trim(),
        categoria: formData.categoria.trim(),
        unidad: formData.unidad.trim() || 'punto',
        notasTecnicas: formData.notasTecnicas.trim() || undefined,
        insumos: formData.insumos,
        manoObra: formData.manoObra,
        updatedAt: now,
      });
      toast.success('Tarea tipo actualizada correctamente');
      setEditingTarea(null);
    }
  };

  const handleCalibrarEma = async (tareaId: string, factorSugerido: number) => {
    await db.tareasTipo.update(tareaId, { factorCorreccion: factorSugerido });
    toast.success(`¡Factor EMA calibrado con éxito a ${factorSugerido.toFixed(2)}x!`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            <span>Laboratorio de Tareas Tipo (Modo Experto)</span>
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Diseño de ensambles, simulación What-If de escenarios, calibración EMA y auditoría de rentabilidad.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Tarea Tipo</span>
        </button>
      </div>

      {/* Submodule Navigation Tabs */}
      <div className="flex border-b border-outline-variant/30 overflow-x-auto no-scrollbar gap-2 sm:gap-6">
        <button
          onClick={() => setActiveSubmodulo('catalogo')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubmodulo === 'catalogo'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Catálogo & Diseñador ({tareasTipo.length})</span>
        </button>

        <button
          onClick={() => {
            if (!simulatedTareaId && tareasTipo.length > 0) setSimulatedTareaId(tareasTipo[0].id);
            setActiveSubmodulo('simulacion');
          }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubmodulo === 'simulacion'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Simulación What-If</span>
        </button>

        <button
          onClick={() => setActiveSubmodulo('calibracion')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubmodulo === 'calibracion'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Motor Estadístico EMA</span>
        </button>

        <button
          onClick={() => setActiveSubmodulo('auditoria')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubmodulo === 'auditoria'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Auditoría de Rentabilidad</span>
        </button>
      </div>

      {/* Submódulos */}
      {activeSubmodulo === 'catalogo' && (
        <CatalogoSubmodulo
          tareas={tareasTipo}
          insumosMap={insumosMap}
          manoObraMap={manoObraMap}
          config={config}
          categoriasList={categoriasTarea}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedCategoryFilter={selectedCategoryFilter}
          onCategoryFilterChange={setSelectedCategoryFilter}
          onDuplicate={handleDuplicateTarea}
          onEdit={handleOpenEdit}
          onDelete={handleDelete}
          onSimulate={(id) => {
            setSimulatedTareaId(id);
            setActiveSubmodulo('simulacion');
          }}
          onViewMaterialsInCatalog={onViewMaterialsInCatalog}
        />
      )}

      {activeSubmodulo === 'simulacion' && (
        <SimulacionWhatIfSubmodulo
          tareas={tareasTipo}
          selectedTareaId={simulatedTareaId || (tareasTipo[0]?.id || '')}
          onSelectTareaId={setSimulatedTareaId}
          insumosMap={insumosMap}
          manoObraMap={manoObraMap}
          manoObraList={manoObraList}
          config={config}
          simMaterialesPct={simMaterialesPct}
          setSimMaterialesPct={setSimMaterialesPct}
          simManoObraPct={simManoObraPct}
          setSimManoObraPct={setSimManoObraPct}
          simHorasExtra={simHorasExtra}
          setSimHorasExtra={setSimHorasExtra}
          simMargenPct={simMargenPct}
          setSimMargenPct={setSimMargenPct}
        />
      )}

      {activeSubmodulo === 'calibracion' && (
        <CalibracionEmaSubmodulo
          tareas={tareasTipo}
          registrosTrabajo={registrosTrabajo}
          config={config}
          onCalibrarEma={handleCalibrarEma}
        />
      )}

      {activeSubmodulo === 'auditoria' && (
        <AuditoriaSubmodulo
          tareas={tareasTipo}
          insumosMap={insumosMap}
          manoObraMap={manoObraMap}
          config={config}
          onEdit={handleOpenEdit}
        />
      )}

      {/* Modal Editor / Diseñador */}
      <TareaEditorModal
        isOpen={isCreating || !!editingTarea}
        onClose={() => {
          setIsCreating(false);
          setEditingTarea(null);
        }}
        editingTarea={editingTarea}
        categoriasList={categoriasTarea}
        insumosMap={insumosMap}
        manoObraList={manoObraList}
        manoObraMap={manoObraMap}
        onSave={handleSaveTarea}
      />
    </div>
  );
};
