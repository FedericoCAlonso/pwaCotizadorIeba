import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import {
  TareaTipo,
  CategoriaManoDeObra,
  MaterialFilterContext
} from '../core/types';
import { useInsumosMap } from '../hooks/useInsumosMap';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';

export interface UseTareasTipoViewModelProps {
  onViewMaterialsInCatalog?: (ctx: MaterialFilterContext) => void;
}

export function useTareasTipoViewModel({
  onViewMaterialsInCatalog
}: UseTareasTipoViewModelProps = {}) {
  const { toast } = useToast();
  const confirm = useConfirm();

  // ─── Data Access ──────────────────────────────────────────────────────────────
  const rawTareas = useLiveQuery(() => db.tareasTipo.toArray()) || [];
  const tareasTipo = useMemo(() => rawTareas.filter(t => !t.deleted), [rawTareas]);

  const manoObraList = (useLiveQuery(() => db.manoObra.toArray()) || []).filter(m => !m.deleted);
  const registrosTrabajo = (useLiveQuery(() => db.registrosTrabajo.toArray()) || []).filter(r => !r.deleted);

  // Unified Insumos Map (MVVM Model Layer)
  const insumosMap = useInsumosMap();
  const manoObraMap = useMemo(() => new Map<string, CategoriaManoDeObra>(manoObraList.map(m => [m.id, m])), [manoObraList]);

  // ─── UI State ─────────────────────────────────────────────────────────────────
  const [activeSubmodulo, setActiveSubmodulo] = useState<'catalogo' | 'simulacion' | 'calibracion' | 'auditoria'>('catalogo');
  const [isCreating, setIsCreating] = useState(false);
  const [editingTarea, setEditingTarea] = useState<TareaTipo | null>(null);
  const [simulandoTarea, setSimulandoTarea] = useState<TareaTipo | null>(null);
  const [calibrandoTarea, setCalibrandoTarea] = useState<TareaTipo | null>(null);

  // ─── Actions & Commands ───────────────────────────────────────────────────────
  const handleSaveTarea = async (tareaData: Partial<TareaTipo>) => {
    const now = new Date().toISOString();
    if (editingTarea) {
      const updated: TareaTipo = {
        ...editingTarea,
        ...tareaData,
        nombre: tareaData.nombre || editingTarea.nombre,
        categoria: tareaData.categoria || editingTarea.categoria,
        unidad: tareaData.unidad || editingTarea.unidad,
        insumos: tareaData.insumos || editingTarea.insumos,
        manoObra: tareaData.manoObra || editingTarea.manoObra,
        parametros: tareaData.parametros || editingTarea.parametros,
        variables: tareaData.variables || editingTarea.variables,
        costoFijoOperativo: tareaData.costoFijoOperativo !== undefined ? tareaData.costoFijoOperativo : editingTarea.costoFijoOperativo,
        descripcionCostoFijo: tareaData.descripcionCostoFijo !== undefined ? tareaData.descripcionCostoFijo : editingTarea.descripcionCostoFijo,
        clausulaExclusiones: tareaData.clausulaExclusiones !== undefined ? tareaData.clausulaExclusiones : editingTarea.clausulaExclusiones,
        notasTecnicas: tareaData.notasTecnicas !== undefined ? tareaData.notasTecnicas : editingTarea.notasTecnicas,
        clausulaTecnicaDefault: tareaData.clausulaTecnicaDefault !== undefined ? tareaData.clausulaTecnicaDefault : editingTarea.clausulaTecnicaDefault,
        esParametrico: tareaData.esParametrico !== undefined ? tareaData.esParametrico : editingTarea.esParametrico,
        tipoParametrizacion: tareaData.tipoParametrizacion || editingTarea.tipoParametrizacion,
        parametrosDefault: tareaData.parametrosDefault || editingTarea.parametrosDefault,
        updatedAt: now
      };
      await db.tareasTipo.put(updated);
      toast.success('Tarea Tipo actualizada exitosamente');
    } else {
      const newTarea: TareaTipo = {
        id: `tarea-${crypto.randomUUID()}`,
        nombre: tareaData.nombre || 'Nueva Tarea',
        categoria: tareaData.categoria || 'general',
        unidad: tareaData.unidad || 'u',
        notasTecnicas: tareaData.notasTecnicas || '',
        clausulaTecnicaDefault: tareaData.clausulaTecnicaDefault || '',
        clausulaExclusiones: tareaData.clausulaExclusiones || '',
        costoFijoOperativo: tareaData.costoFijoOperativo || 0,
        descripcionCostoFijo: tareaData.descripcionCostoFijo || '',
        parametros: tareaData.parametros || [],
        variables: tareaData.variables || [],
        esParametrico: tareaData.esParametrico ?? Boolean(tareaData.parametros?.length || tareaData.variables?.length),
        tipoParametrizacion: tareaData.tipoParametrizacion || 'recableado_integral',
        parametrosDefault: tareaData.parametrosDefault,
        insumos: tareaData.insumos || [],
        manoObra: tareaData.manoObra || [],
        frecuenciaUso: 0,
        createdAt: now,
        updatedAt: now,
        deleted: false
      };
      await db.tareasTipo.add(newTarea);
      toast.success('Tarea Tipo creada exitosamente');
    }
    setIsCreating(false);
    setEditingTarea(null);
  };

  const handleDeleteTarea = async (id: string) => {
    const tarea = tareasTipo.find(t => t.id === id);
    const ok = await confirm({
      title: 'Eliminar Tarea Tipo',
      message: `¿Estás seguro de eliminar "${tarea?.nombre || 'esta tarea'}"?`,
      confirmText: 'Eliminar',
      isDestructive: true
    });
    if (ok) {
      await db.tareasTipo.update(id, { deleted: true, updatedAt: new Date().toISOString() });
      toast.info('Tarea Tipo eliminada');
    }
  };

  const handleDuplicateTarea = async (tarea: TareaTipo) => {
    const now = new Date().toISOString();
    const duplicated: TareaTipo = {
      ...tarea,
      id: `tarea-${crypto.randomUUID()}`,
      nombre: `${tarea.nombre} (Copia)`,
      frecuenciaUso: 0,
      createdAt: now,
      updatedAt: now,
      deleted: false
    };
    await db.tareasTipo.add(duplicated);
    toast.success(`Tarea duplicada como "${duplicated.nombre}"`);
  };

  const handleOpenMaterialsInCatalog = (tarea: TareaTipo) => {
    if (!onViewMaterialsInCatalog || !tarea.insumos.length) return;
    const ids = tarea.insumos.map(i => i.materialId || i.insumoId).filter(Boolean) as string[];
    const quantities: Record<string, { cantidad: number; unidad: string }> = {};
    const names: string[] = [];

    tarea.insumos.forEach(i => {
      const id = i.materialId || i.insumoId;
      const mat = insumosMap.get(id || '');
      if (id) {
        quantities[id] = { cantidad: i.cantidad, unidad: mat?.unidadVenta || mat?.unidad || 'u' };
      }
      if (mat?.nombre) {
        names.push(mat.nombre.trim());
      }
    });

    onViewMaterialsInCatalog({
      title: `Trabajo Tipo: ${tarea.nombre}`,
      materialIds: ids,
      materialNames: names,
      quantities,
      returnTab: 'tareasTipo'
    });
  };

  return {
    // Data
    tareasTipo,
    insumosMap,
    manoObraList,
    manoObraMap,
    registrosTrabajo,

    // UI States
    activeSubmodulo,
    setActiveSubmodulo,
    isCreating,
    setIsCreating,
    editingTarea,
    setEditingTarea,
    simulandoTarea,
    setSimulandoTarea,
    calibrandoTarea,
    setCalibrandoTarea,

    // Actions & Commands
    handleSaveTarea,
    handleDeleteTarea,
    handleDuplicateTarea,
    handleOpenMaterialsInCatalog,
    onViewMaterialsInCatalog
  };
}
