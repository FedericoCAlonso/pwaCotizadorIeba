import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Layers, Plus, Edit2, Trash2, X, Save, Package, Clock, Info, Activity } from 'lucide-react';
import { db } from '../db/database';
import { TareaTipo, Insumo, CategoriaManoDeObra, InsumoEnTarea, ManoObraEnTarea } from '../core/types';
import { calcularCostoTareaTipo, formatARS, calcularDispersionHorasTarea } from '../core/calculations';
import { BASE_UNITS } from '../core/sampleData';

export const TareasTipoManager: React.FC = () => {
  const tareasTipo = useLiveQuery(() => db.tareasTipo.toArray()) || [];
  const insumos = useLiveQuery(() => db.insumos.toArray()) || [];
  const manoObraList = useLiveQuery(() => db.manoObra.toArray()) || [];
  const registrosTrabajo = useLiveQuery(() => db.registrosTrabajo.toArray()) || [];

  const insumosMap = new Map<string, Insumo>(insumos.map((i) => [i.id, i]));
  const manoObraMap = new Map<string, CategoriaManoDeObra>(manoObraList.map((m) => [m.id, m]));

  const [editingTarea, setEditingTarea] = useState<TareaTipo | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [formData, setFormData] = useState<{
    nombre: string; categoria: string; unidad: string; notasTecnicas: string;
    insumos: InsumoEnTarea[]; manoObra: ManoObraEnTarea[];
  }>({ nombre: '', categoria: 'Bocas', unidad: 'punto', notasTecnicas: '', insumos: [], manoObra: [] });

  const handleOpenCreate = () => {
    setFormData({ nombre: '', categoria: 'Bocas', unidad: 'punto', notasTecnicas: '', insumos: [], manoObra: [] });
    setIsCreating(true);
  };

  const handleOpenEdit = (tarea: TareaTipo) => {
    setEditingTarea(tarea);
    setFormData({ nombre: tarea.nombre, categoria: tarea.categoria, unidad: tarea.unidad, notasTecnicas: tarea.notasTecnicas || '', insumos: [...tarea.insumos], manoObra: [...tarea.manoObra] });
  };

  const handleSaveTarea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) {
      await db.tareasTipo.add({ id: `tt-${crypto.randomUUID()}`, nombre: formData.nombre, categoria: formData.categoria, unidad: formData.unidad, notasTecnicas: formData.notasTecnicas || undefined, insumos: formData.insumos, manoObra: formData.manoObra, factorCorreccion: 1.0 });
      setIsCreating(false);
    } else if (editingTarea) {
      await db.tareasTipo.update(editingTarea.id, { nombre: formData.nombre, categoria: formData.categoria, unidad: formData.unidad, notasTecnicas: formData.notasTecnicas || undefined, insumos: formData.insumos, manoObra: formData.manoObra });
      setEditingTarea(null);
    }
  };

  const handleDelete = async (id: string) => { if (confirm('¿Eliminar esta tarea tipo?')) await db.tareasTipo.delete(id); };

  const addInsumoRow = () => { if (insumos.length === 0) return alert('Cargá insumos primero.'); setFormData((prev) => ({ ...prev, insumos: [...prev.insumos, { insumoId: insumos[0].id, cantidad: 1 }] })); };
  const removeInsumoRow = (index: number) => setFormData((prev) => ({ ...prev, insumos: prev.insumos.filter((_, i) => i !== index) }));
  const updateInsumoRow = (index: number, field: 'insumoId' | 'cantidad', val: any) => setFormData((prev) => { const next = [...prev.insumos]; next[index] = { ...next[index], [field]: val }; return { ...prev, insumos: next }; });
  const addManoObraRow = () => { if (manoObraList.length === 0) return alert('Cargá mano de obra primero.'); setFormData((prev) => ({ ...prev, manoObra: [...prev.manoObra, { categoriaId: manoObraList[0].id, horas: 1 }] })); };
  const removeManoObraRow = (index: number) => setFormData((prev) => ({ ...prev, manoObra: prev.manoObra.filter((_, i) => i !== index) }));
  const updateManoObraRow = (index: number, field: 'categoriaId' | 'horas', val: any) => setFormData((prev) => { const next = [...prev.manoObra]; next[index] = { ...next[index], [field]: val }; return { ...prev, manoObra: next }; });

  const inputCls = "w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-on-surface-variant/70 transition-shadow";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />Catálogo de Tareas Tipo
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">Ensambles reutilizables con materiales y mano de obra.</p>
        </div>
        <button onClick={handleOpenCreate} className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm">
          <Plus className="w-4 h-4" /><span>Nueva Tarea Tipo</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tareasTipo.map((tarea) => {
          const cost = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap);
          const horasEstimadasBase = tarea.manoObra.reduce((acc, m) => acc + m.horas, 0);
          const dispersion = calcularDispersionHorasTarea(registrosTrabajo, tarea.id, horasEstimadasBase);
          const factorEMA = tarea.factorCorreccion ?? 1.0;

          return (
            <div key={tarea.id} className="bg-surface-container-low border border-outline-variant/20 rounded-3xl overflow-hidden hover:bg-surface-container/60 transition-all flex flex-col justify-between shadow-sm">
              <div className="p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-on-tertiary-container bg-tertiary-container px-3 py-1 rounded-full uppercase tracking-wider">{tarea.categoria}</span>
                      <span className="text-[11px] font-mono font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full" title="Factor EMA de corrección por historial de obras">
                        {factorEMA.toFixed(2)}x EMA
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-on-surface mt-2">{tarea.nombre}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleOpenEdit(tarea)} className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant transition-colors" aria-label={`Editar ${tarea.nombre}`}><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(tarea.id)} className="p-2 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors" aria-label={`Eliminar ${tarea.nombre}`}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* Indicador de Dispersión (Spec v2 §1.4) */}
                <div className="bg-surface-container-highest/60 p-2.5 rounded-2xl flex items-center justify-between text-xs text-on-surface-variant border border-outline-variant/20">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Activity className="w-3.5 h-3.5 text-secondary" />
                    <span>Dispersión de Horas:</span>
                  </div>
                  {dispersion.count > 0 ? (
                    <div className="font-mono text-[11px]">
                      N={dispersion.count} · Ratio: {dispersion.minRatio.toFixed(2)}–{dispersion.maxRatio.toFixed(2)} · Desvío: ±{dispersion.desvioEstandar.toFixed(2)}
                    </div>
                  ) : (
                    <span className="text-[11px] text-on-surface-variant/70 font-sans">Sin registros reales aún</span>
                  )}
                </div>

                {tarea.notasTecnicas && (
                  <p className="text-xs text-on-surface-variant bg-surface-container-highest/60 p-3 rounded-2xl flex items-start gap-2">
                    <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    {tarea.notasTecnicas}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-surface-container-highest/50 p-3 rounded-2xl">
                    <div className="font-semibold text-on-surface flex items-center gap-1.5 mb-2"><Package className="w-3.5 h-3.5 text-primary" />Insumos ({tarea.insumos.length})</div>
                    <ul className="space-y-1 text-xs text-on-surface-variant">
                      {tarea.insumos.map((item, i) => { const ins = insumosMap.get(item.insumoId); return <li key={i} className="truncate">· {item.cantidad} {ins?.unidad || ''} × {ins?.nombre || 'Insumo'}</li>; })}
                    </ul>
                  </div>
                  <div className="bg-surface-container-highest/50 p-3 rounded-2xl">
                    <div className="font-semibold text-on-surface flex items-center gap-1.5 mb-2"><Clock className="w-3.5 h-3.5 text-primary" />Mano de Obra</div>
                    <ul className="space-y-1 text-xs text-on-surface-variant">
                      {tarea.manoObra.map((item, i) => { const mo = manoObraMap.get(item.categoriaId); return <li key={i} className="truncate">· {item.horas} hs × {mo?.nombre || 'Categoría'}</li>; })}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Footer con costo */}
              <div className="bg-surface-container border-t border-outline-variant/30 px-5 py-3.5 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-medium">Costo directo / {tarea.unidad}</span>
                  <div className="text-xs text-on-surface-variant mt-0.5">Mat: {formatARS(cost.costoInsumosUnitario)} · MO: {formatARS(cost.costoManoObraUnitario)}</div>
                </div>
                <div className="font-mono text-lg font-bold text-primary">{formatARS(cost.costoDirectoUnitario)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create / Edit */}
      {(isCreating || editingTarea) && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-on-surface">
            <div className="px-6 py-4 border-b border-outline-variant/30 flex items-center justify-between">
              <h3 className="text-base font-semibold text-on-surface">{isCreating ? 'Nueva Tarea Tipo / Ensamble' : 'Editar Tarea Tipo'}</h3>
              <button onClick={() => { setIsCreating(false); setEditingTarea(null); }} className="text-on-surface-variant hover:text-on-surface p-1"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleSaveTarea} className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-on-surface-variant mb-1">Nombre de la Tarea</label>
                  <input type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} className={inputCls} placeholder="Ej: Boca de Iluminación Completa" required />
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Categoría</label>
                  <input type="text" value={formData.categoria} onChange={(e) => setFormData({ ...formData, categoria: e.target.value })} className={inputCls} placeholder="Bocas, Tableros..." required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Unidad</label>
                  <input type="text" list="lista-unidades-tt" value={formData.unidad} onChange={(e) => setFormData({ ...formData, unidad: e.target.value })} className={inputCls} placeholder="punto, u, m" required />
                  <datalist id="lista-unidades-tt">{BASE_UNITS.map(u => <option key={u} value={u} />)}</datalist>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-on-surface-variant mb-1">Notas Técnicas / Norma AEA</label>
                  <input type="text" value={formData.notasTecnicas} onChange={(e) => setFormData({ ...formData, notasTecnicas: e.target.value })} className={inputCls} placeholder="Ej: AEA 90364-7-771" />
                </div>
              </div>

              <hr className="border-outline-variant/30" />

              {/* Insumos */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-on-surface flex items-center gap-2"><Package className="w-4 h-4 text-primary" />Insumos por Unidad</h4>
                  <button type="button" onClick={addInsumoRow} className="text-xs text-on-secondary-container bg-secondary-container hover:bg-secondary-container/80 px-3 py-1.5 rounded-full flex items-center gap-1 font-medium">
                    <Plus className="w-3.5 h-3.5" />Agregar
                  </button>
                </div>
                {formData.insumos.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20">
                    <select value={item.insumoId} onChange={(e) => updateInsumoRow(idx, 'insumoId', e.target.value)} className="flex-1 bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50">
                      {insumos.map((ins) => <option key={ins.id} value={ins.id}>{ins.nombre} ({formatARS(ins.precioActual)}/{ins.unidad})</option>)}
                    </select>
                    <div className="flex items-center gap-1 w-28">
                      <span className="text-xs text-on-surface-variant">Cant:</span>
                      <input type="number" step="0.1" value={item.cantidad} onChange={(e) => updateInsumoRow(idx, 'cantidad', parseFloat(e.target.value) || 0)} className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-2 py-1.5 text-xs text-on-surface font-mono text-center focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <button type="button" onClick={() => removeInsumoRow(idx)} className="text-on-surface-variant hover:text-error p-1.5 rounded-full hover:bg-error-container/30"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              <hr className="border-outline-variant/30" />

              {/* Mano de Obra */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-on-surface flex items-center gap-2"><Clock className="w-4 h-4 text-primary" />Horas de Mano de Obra</h4>
                  <button type="button" onClick={addManoObraRow} className="text-xs text-on-secondary-container bg-secondary-container hover:bg-secondary-container/80 px-3 py-1.5 rounded-full flex items-center gap-1 font-medium">
                    <Plus className="w-3.5 h-3.5" />Agregar
                  </button>
                </div>
                {formData.manoObra.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20">
                    <select value={item.categoriaId} onChange={(e) => updateManoObraRow(idx, 'categoriaId', e.target.value)} className="flex-1 bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50">
                      {manoObraList.map((mo) => <option key={mo.id} value={mo.id}>{mo.nombre} ({formatARS(mo.costoHora)}/h)</option>)}
                    </select>
                    <div className="flex items-center gap-1 w-28">
                      <span className="text-xs text-on-surface-variant">Hs:</span>
                      <input type="number" step="0.1" value={item.horas} onChange={(e) => updateManoObraRow(idx, 'horas', parseFloat(e.target.value) || 0)} className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-2 py-1.5 text-xs text-on-surface font-mono text-center focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <button type="button" onClick={() => removeManoObraRow(idx)} className="text-on-surface-variant hover:text-error p-1.5 rounded-full hover:bg-error-container/30"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-outline-variant/30 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsCreating(false); setEditingTarea(null); }} className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant">Cancelar</button>
                <button type="submit" className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-sm shadow-sm"><Save className="w-3.5 h-3.5" />Guardar Tarea Tipo</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
