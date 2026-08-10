import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Package,
  Clock,
  Info,
  ChevronRight,
  Zap
} from 'lucide-react';
import { db } from '../db/database';
import { TareaTipo, Insumo, CategoriaManoDeObra, InsumoEnTarea, ManoObraEnTarea } from '../core/types';
import { calcularCostoTareaTipo, formatARS } from '../core/calculations';

export const TareasTipoManager: React.FC = () => {
  const tareasTipo = useLiveQuery(() => db.tareasTipo.toArray()) || [];
  const insumos = useLiveQuery(() => db.insumos.toArray()) || [];
  const manoObraList = useLiveQuery(() => db.manoObra.toArray()) || [];

  const insumosMap = new Map<string, Insumo>(insumos.map((i) => [i.id, i]));
  const manoObraMap = new Map<string, CategoriaManoDeObra>(manoObraList.map((m) => [m.id, m]));

  const [editingTarea, setEditingTarea] = useState<TareaTipo | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    nombre: string;
    categoria: string;
    unidad: string;
    notasTecnicas: string;
    insumos: InsumoEnTarea[];
    manoObra: ManoObraEnTarea[];
  }>({
    nombre: '',
    categoria: 'Bocas',
    unidad: 'punto',
    notasTecnicas: '',
    insumos: [],
    manoObra: []
  });

  const handleOpenCreate = () => {
    setFormData({
      nombre: '',
      categoria: 'Bocas',
      unidad: 'punto',
      notasTecnicas: '',
      insumos: [],
      manoObra: []
    });
    setIsCreating(true);
  };

  const handleOpenEdit = (tarea: TareaTipo) => {
    setEditingTarea(tarea);
    setFormData({
      nombre: tarea.nombre,
      categoria: tarea.categoria,
      unidad: tarea.unidad,
      notasTecnicas: tarea.notasTecnicas || '',
      insumos: [...tarea.insumos],
      manoObra: [...tarea.manoObra]
    });
  };

  const handleSaveTarea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) {
      const newTarea: TareaTipo = {
        id: `tt-${crypto.randomUUID()}`,
        nombre: formData.nombre,
        categoria: formData.categoria,
        unidad: formData.unidad,
        notasTecnicas: formData.notasTecnicas || undefined,
        insumos: formData.insumos,
        manoObra: formData.manoObra
      };
      await db.tareasTipo.add(newTarea);
      setIsCreating(false);
    } else if (editingTarea) {
      await db.tareasTipo.update(editingTarea.id, {
        nombre: formData.nombre,
        categoria: formData.categoria,
        unidad: formData.unidad,
        notasTecnicas: formData.notasTecnicas || undefined,
        insumos: formData.insumos,
        manoObra: formData.manoObra
      });
      setEditingTarea(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta tarea tipo del catálogo?')) {
      await db.tareasTipo.delete(id);
    }
  };

  // Handlers for adding/removing items in form
  const addInsumoRow = () => {
    if (insumos.length === 0) return alert('Debes cargar al menos un insumo en el catálogo.');
    setFormData((prev) => ({
      ...prev,
      insumos: [...prev.insumos, { insumoId: insumos[0].id, cantidad: 1 }]
    }));
  };

  const removeInsumoRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      insumos: prev.insumos.filter((_, i) => i !== index)
    }));
  };

  const updateInsumoRow = (index: number, field: 'insumoId' | 'cantidad', val: any) => {
    setFormData((prev) => {
      const next = [...prev.insumos];
      next[index] = { ...next[index], [field]: val };
      return { ...prev, insumos: next };
    });
  };

  const addManoObraRow = () => {
    if (manoObraList.length === 0) return alert('Debes cargar categorías de mano de obra primero.');
    setFormData((prev) => ({
      ...prev,
      manoObra: [...prev.manoObra, { categoriaId: manoObraList[0].id, horas: 1 }]
    }));
  };

  const removeManoObraRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      manoObra: prev.manoObra.filter((_, i) => i !== index)
    }));
  };

  const updateManoObraRow = (index: number, field: 'categoriaId' | 'horas', val: any) => {
    setFormData((prev) => {
      const next = [...prev.manoObra];
      next[index] = { ...next[index], [field]: val };
      return { ...prev, manoObra: next };
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <span>Catálogo de Tareas Tipo (Ensambles Reutilizables)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Combina materiales y horas de trabajo en plantillas estandarizadas para cotizar en segundos.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition shadow-md shadow-amber-500/10"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nueva Tarea Tipo</span>
        </button>
      </div>

      {/* Task Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tareasTipo.map((tarea) => {
          const cost = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap);

          return (
            <div
              key={tarea.id}
              className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition flex flex-col justify-between space-y-4 shadow-xl"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                      {tarea.categoria}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-1.5">{tarea.nombre}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(tarea)}
                      className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                      aria-label={`Editar tarea tipo ${tarea.nombre}`}
                    >
                      <Edit2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => handleDelete(tarea.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800"
                      aria-label={`Eliminar tarea tipo ${tarea.nombre}`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {tarea.notasTecnicas && (
                  <p className="text-xs text-slate-400 mt-2 bg-slate-950/40 p-2 rounded border border-slate-800/80 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>{tarea.notasTecnicas}</span>
                  </p>
                )}

                {/* Items & Labor Preview */}
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                    <div className="font-semibold text-slate-300 flex items-center gap-1 mb-1.5">
                      <Package className="w-3.5 h-3.5 text-amber-400" />
                      <span>Insumos ({tarea.insumos.length})</span>
                    </div>
                    <ul className="space-y-1 text-[11px] text-slate-400">
                      {tarea.insumos.map((item, i) => {
                        const ins = insumosMap.get(item.insumoId);
                        return (
                          <li key={i} className="truncate">
                            • {item.cantidad} {ins ? ins.unidad : ''} × {ins ? ins.nombre : 'Insumo'}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                    <div className="font-semibold text-slate-300 flex items-center gap-1 mb-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Mano de Obra</span>
                    </div>
                    <ul className="space-y-1 text-[11px] text-slate-400">
                      {tarea.manoObra.map((item, i) => {
                        const mo = manoObraMap.get(item.categoriaId);
                        return (
                          <li key={i} className="truncate">
                            • {item.horas} hs × {mo ? mo.nombre : 'Categoría'}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Total Unit Cost Footer */}
              <div className="pt-3 border-t border-slate-800 flex justify-between items-center bg-slate-950/60 -mx-5 -mb-5 p-4 rounded-b-xl">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    Costo Directo por {tarea.unidad}
                  </span>
                  <div className="text-[11px] text-slate-500">
                    Mat: {formatARS(cost.costoInsumosUnitario)} | MO: {formatARS(cost.costoManoObraUnitario)}
                  </div>
                </div>
                <div className="font-mono text-xl font-extrabold text-emerald-400">
                  {formatARS(cost.costoDirectoUnitario)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create / Edit TareaTipo */}
      {(isCreating || editingTarea) && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {isCreating ? 'Nueva Tarea Tipo / Ensamble' : 'Editar Tarea Tipo'}
              </h3>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingTarea(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTarea} className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Header Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-300 mb-1">Nombre de la Tarea Tipo</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    placeholder="Ej: Boca de Iluminación Completa"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Categoría</label>
                  <input
                    type="text"
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    placeholder="Bocas, Tableros, Circuitos..."
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Unidad de Medida</label>
                  <input
                    type="text"
                    value={formData.unidad}
                    onChange={(e) => setFormData({ ...formData, unidad: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    placeholder="punto, u, m, obra"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-300 mb-1">Notas Técnicas / Norma AEA</label>
                  <input
                    type="text"
                    value={formData.notasTecnicas}
                    onChange={(e) => setFormData({ ...formData, notasTecnicas: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    placeholder="Ej: AEA 90364-7-771"
                  />
                </div>
              </div>

              <hr className="border-slate-800" />

              {/* Insumos Section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-400" />
                    <span>Insumos Requeridos por Unidad</span>
                  </h4>
                  <button
                    type="button"
                    onClick={addInsumoRow}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 px-3 py-1 rounded border border-slate-700 flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Insumo</span>
                  </button>
                </div>

                {formData.insumos.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <select
                      value={item.insumoId}
                      onChange={(e) => updateInsumoRow(idx, 'insumoId', e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      {insumos.map((ins) => (
                        <option key={ins.id} value={ins.id}>
                          {ins.nombre} ({formatARS(ins.precioActual)} / {ins.unidad})
                        </option>
                      ))}
                    </select>

                    <div className="w-28 flex items-center gap-1">
                      <span className="text-xs text-slate-400">Cant:</span>
                      <input
                        type="number"
                        step="0.1"
                        value={item.cantidad}
                        onChange={(e) => updateInsumoRow(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeInsumoRow(idx)}
                      className="text-slate-400 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <hr className="border-slate-800" />

              {/* Mano de Obra Section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>Horas de Mano de Obra por Unidad</span>
                  </h4>
                  <button
                    type="button"
                    onClick={addManoObraRow}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 px-3 py-1 rounded border border-slate-700 flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Mano de Obra</span>
                  </button>
                </div>

                {formData.manoObra.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <select
                      value={item.categoriaId}
                      onChange={(e) => updateManoObraRow(idx, 'categoriaId', e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      {manoObraList.map((mo) => (
                        <option key={mo.id} value={mo.id}>
                          {mo.nombre} ({formatARS(mo.costoHora)}/h)
                        </option>
                      ))}
                    </select>

                    <div className="w-28 flex items-center gap-1">
                      <span className="text-xs text-slate-400">Horas:</span>
                      <input
                        type="number"
                        step="0.1"
                        value={item.horas}
                        onChange={(e) => updateManoObraRow(idx, 'horas', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeManoObraRow(idx)}
                      className="text-slate-400 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Form Footer */}
              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingTarea(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Tarea Tipo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
