import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { HardHat, Plus, Save, Trash2, TrendingUp } from 'lucide-react';
import { db } from '../db/database';
import { RegistroTrabajo, TareaTipo, CategoriaManoDeObra } from '../core/types';
import { formatNumber } from '../core/calculations';

export const RegistroTrabajoManager: React.FC = () => {
  const registros = useLiveQuery(() => db.registrosTrabajo.reverse().toArray()) || [];
  const tareasTipo = useLiveQuery(() => db.tareasTipo.toArray()) || [];
  const manoObraList = useLiveQuery(() => db.manoObra.toArray()) || [];

  const tareasMap = new Map<string, TareaTipo>(tareasTipo.map((t) => [t.id, t]));
  const manoObraMap = new Map<string, CategoriaManoDeObra>(manoObraList.map((m) => [m.id, m]));

  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<RegistroTrabajo>>({
    descripcion: '', fecha: new Date().toISOString().slice(0, 10),
    horasReales: 3.5, categoriaManoObraId: manoObraList[0]?.id || '',
    cantidadEjecutada: 8, condicion: 'normal', notas: ''
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoriaManoObraId && manoObraList.length > 0) formData.categoriaManoObraId = manoObraList[0].id;
    await db.registrosTrabajo.add({
      id: `reg-${crypto.randomUUID()}`,
      descripcion: formData.descripcion || 'Registro de Trabajo',
      fecha: formData.fecha || new Date().toISOString().slice(0, 10),
      horasReales: formData.horasReales || 0,
      categoriaManoObraId: formData.categoriaManoObraId || '',
      cantidadEjecutada: formData.cantidadEjecutada || 1,
      tareaTipoId: formData.tareaTipoId,
      condicion: formData.condicion || 'normal',
      notas: formData.notas
    });
    setIsCreating(false);
    setFormData({ descripcion: '', fecha: new Date().toISOString().slice(0, 10), horasReales: 3.5, categoriaManoObraId: manoObraList[0]?.id || '', cantidadEjecutada: 8, condicion: 'normal', notas: '' });
  };

  const handleDelete = async (id: string) => { if (confirm('¿Eliminar este registro?')) await db.registrosTrabajo.delete(id); };

  const taskVariance = tareasTipo.map((tarea) => {
    const logs = registros.filter((r) => r.tareaTipoId === tarea.id);
    const n = logs.length;
    const horasRealesPromedioUnidad = n > 0 ? logs.reduce((acc, curr) => acc + curr.horasReales / (curr.cantidadEjecutada || 1), 0) / n : 0;
    const horasEstimadasUnidad = tarea.manoObra.reduce((acc, m) => acc + m.horas, 0);
    const desviacionPct = horasEstimadasUnidad > 0 ? ((horasRealesPromedioUnidad - horasEstimadasUnidad) / horasEstimadasUnidad) * 100 : 0;
    return { tarea, nMuestras: n, horasEstimadasUnidad, horasRealesPromedioUnidad, desviacionPct };
  });

  const inputCls = "w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/70";
  const condBadge = (c?: string) => c === 'dificultosa' ? 'bg-rose-500/10 text-rose-400' : c === 'favorable' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/40 text-slate-400';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><HardHat className="w-4 h-4 text-amber-400" />Registro de Trabajo Real</h2>
          <p className="text-xs text-slate-500 mt-0.5">Horas ejecutadas en obra para calibrar las Tareas Tipo.</p>
        </div>
        <button onClick={() => setIsCreating(true)} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-semibold transition">
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" /><span>Cargar Horas</span>
        </button>
      </div>

      {/* Variance Panel */}
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />Calibración: Estimado vs. Real
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {taskVariance.map((tv) => (
            <div key={tv.tarea.id} className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/20 space-y-1.5">
              <div className="font-medium text-white text-xs">{tv.tarea.nombre}</div>
              <div className="text-[11px] text-slate-500 flex justify-between"><span>Estimado:</span><span className="font-mono text-amber-300">{tv.horasEstimadasUnidad} hs/{tv.tarea.unidad}</span></div>
              <div className="text-[11px] text-slate-500 flex justify-between"><span>Real ({tv.nMuestras} reg.):</span><span className="font-mono text-emerald-400">{tv.nMuestras > 0 ? `${formatNumber(tv.horasRealesPromedioUnidad)} hs/${tv.tarea.unidad}` : '—'}</span></div>
              {tv.nMuestras >= 3 && (
                <div className={`text-[10px] font-medium pt-1.5 border-t border-slate-700/30 ${tv.desviacionPct > 15 ? 'text-rose-400' : tv.desviacionPct < -15 ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {tv.desviacionPct > 15 ? `⚠ Corto por +${formatNumber(tv.desviacionPct, 1)}%` : tv.desviacionPct < -15 ? `✓ Rinde ${formatNumber(Math.abs(tv.desviacionPct), 1)}% más rápido` : '✓ Alineado'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-800/50 text-xs text-slate-500 border-b border-slate-700/30">
              <tr>
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Descripción</th>
                <th className="px-4 py-2.5 font-medium">Mano de Obra</th>
                <th className="px-4 py-2.5 text-center font-medium">Cantidad</th>
                <th className="px-4 py-2.5 text-center font-medium">Horas</th>
                <th className="px-4 py-2.5 text-center font-medium">Condición</th>
                <th className="px-4 py-2.5 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {registros.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-600 text-xs">Sin registros cargados.</td></tr>
              ) : (
                registros.map((r) => {
                  const tarea = r.tareaTipoId ? tareasMap.get(r.tareaTipoId) : undefined;
                  const mo = manoObraMap.get(r.categoriaManoObraId);
                  return (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">{r.fecha}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white text-sm">{r.descripcion}</div>
                        {tarea && <div className="text-[11px] text-amber-400/70 font-mono">{tarea.nombre}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{mo ? mo.nombre : 'General'}</td>
                      <td className="px-4 py-3 text-center font-mono text-amber-300 text-sm">{r.cantidadEjecutada} {tarea ? tarea.unidad : 'u'}</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-emerald-400 text-sm">{r.horasReales}h</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${condBadge(r.condicion)}`}>{r.condicion}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-700/50 transition" aria-label={`Eliminar registro ${r.descripcion}`}><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700/50 rounded-xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-white">Cargar Horas de Trabajo</h3>
              <button onClick={() => setIsCreating(false)} className="text-slate-500 hover:text-white p-1"><Plus className="w-4 h-4 rotate-45" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tarea Tipo (opcional)</label>
                <select value={formData.tareaTipoId || ''} onChange={(e) => setFormData({ ...formData, tareaTipoId: e.target.value || undefined })} className={inputCls}>
                  <option value="">Trabajo general (sin tarea)</option>
                  {tareasTipo.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Descripción</label>
                <input type="text" value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} className={inputCls} placeholder="Ej: Montaje de 8 bocas de iluminación" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-slate-400 mb-1">Fecha</label><input type="date" value={formData.fecha} onChange={(e) => setFormData({ ...formData, fecha: e.target.value })} className={inputCls} required /></div>
                <div><label className="block text-xs text-slate-400 mb-1">Cantidad Ejecutada</label><input type="number" step="0.1" value={formData.cantidadEjecutada} onChange={(e) => setFormData({ ...formData, cantidadEjecutada: parseFloat(e.target.value) || 1 })} className={`${inputCls} font-mono`} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-slate-400 mb-1">Horas Reales</label><input type="number" step="0.1" value={formData.horasReales} onChange={(e) => setFormData({ ...formData, horasReales: parseFloat(e.target.value) || 0 })} className={`${inputCls} font-mono`} required /></div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Condición de Obra</label>
                  <select value={formData.condicion} onChange={(e) => setFormData({ ...formData, condicion: e.target.value as any })} className={inputCls}>
                    <option value="normal">Normal</option>
                    <option value="dificultosa">Dificultosa</option>
                    <option value="favorable">Favorable</option>
                  </select>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-700/40 flex justify-end gap-2">
                <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700/50">Cancelar</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm"><Save className="w-3.5 h-3.5" />Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
