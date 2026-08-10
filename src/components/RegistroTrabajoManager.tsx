import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { HardHat, Plus, Calendar, Clock, Layers, Save, Trash2, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
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
    descripcion: '',
    fecha: new Date().toISOString().slice(0, 10),
    horasReales: 3.5,
    categoriaManoObraId: manoObraList[0]?.id || '',
    cantidadEjecutada: 8,
    condicion: 'normal',
    notas: ''
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoriaManoObraId && manoObraList.length > 0) {
      formData.categoriaManoObraId = manoObraList[0].id;
    }

    const newReg: RegistroTrabajo = {
      id: `reg-${crypto.randomUUID()}`,
      descripcion: formData.descripcion || 'Registro de Trabajo',
      fecha: formData.fecha || new Date().toISOString().slice(0, 10),
      horasReales: formData.horasReales || 0,
      categoriaManoObraId: formData.categoriaManoObraId || '',
      cantidadEjecutada: formData.cantidadEjecutada || 1,
      tareaTipoId: formData.tareaTipoId,
      condicion: formData.condicion || 'normal',
      notas: formData.notas
    };

    await db.registrosTrabajo.add(newReg);
    setIsCreating(false);
    setFormData({
      descripcion: '',
      fecha: new Date().toISOString().slice(0, 10),
      horasReales: 3.5,
      categoriaManoObraId: manoObraList[0]?.id || '',
      cantidadEjecutada: 8,
      condicion: 'normal',
      notas: ''
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este registro de trabajo?')) {
      await db.registrosTrabajo.delete(id);
    }
  };

  // Variance analytics calculation (Section 6.2)
  const taskVariance = tareasTipo.map((tarea) => {
    const matchingLogs = registros.filter((r) => r.tareaTipoId === tarea.id);
    const n = matchingLogs.length;

    let horasRealesPromedioUnidad = 0;
    if (n > 0) {
      const sumHorasPorUnidad = matchingLogs.reduce(
        (acc, curr) => acc + curr.horasReales / (curr.cantidadEjecutada || 1),
        0
      );
      horasRealesPromedioUnidad = sumHorasPorUnidad / n;
    }

    const horasEstimadasUnidad = tarea.manoObra.reduce((acc, m) => acc + m.horas, 0);
    const desviacionPct =
      horasEstimadasUnidad > 0
        ? ((horasRealesPromedioUnidad - horasEstimadasUnidad) / horasEstimadasUnidad) * 100
        : 0;

    return {
      tarea,
      nMuestras: n,
      horasEstimadasUnidad,
      horasRealesPromedioUnidad,
      desviacionPct
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <HardHat className="w-5 h-5 text-amber-400" />
            <span>Registro de Trabajo Real & Calibración</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Anota las horas reales ejecutadas en obra para alimentar las estadísticas y calibrar las Tareas Tipo.
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition shadow-md shadow-amber-500/10"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Cargar Horas Reales</span>
        </button>
      </div>

      {/* Variance Analysis Preview Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span>Calibración: Horas Estimadas vs. Horas Reales por Tarea</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {taskVariance.map((tv) => (
            <div key={tv.tarea.id} className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
              <div className="font-bold text-white text-sm">{tv.tarea.nombre}</div>
              <div className="text-xs text-slate-400 flex justify-between">
                <span>Estimado:</span>
                <span className="font-mono text-amber-300">{tv.horasEstimadasUnidad} hs/{tv.tarea.unidad}</span>
              </div>
              <div className="text-xs text-slate-400 flex justify-between">
                <span>Real Promedio ({tv.nMuestras} registros):</span>
                <span className="font-mono text-emerald-400">
                  {tv.nMuestras > 0 ? `${formatNumber(tv.horasRealesPromedioUnidad)} hs/${tv.tarea.unidad}` : 'Sin datos'}
                </span>
              </div>

              {tv.nMuestras >= 3 && (
                <div
                  className={`text-[11px] font-bold pt-2 border-t border-slate-800 ${
                    tv.desviacionPct > 15
                      ? 'text-rose-400'
                      : tv.desviacionPct < -15
                      ? 'text-emerald-400'
                      : 'text-slate-400'
                  }`}
                >
                  {tv.desviacionPct > 15
                    ? `⚠️ Te estás quedando corto por +${formatNumber(tv.desviacionPct, 1)}%`
                    : tv.desviacionPct < -15
                    ? `✓ Estás rindiendo un ${formatNumber(Math.abs(tv.desviacionPct), 1)}% más rápido`
                    : '✓ Estimación alineada'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Registros History Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900 text-xs uppercase text-slate-400 border-b border-slate-800 font-semibold">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Descripción / Tarea</th>
                <th className="px-4 py-3">Mano de Obra</th>
                <th className="px-4 py-3 text-center">Cantidad Ejecutada</th>
                <th className="px-4 py-3 text-center">Horas Reales</th>
                <th className="px-4 py-3 text-center">Condición</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {registros.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No hay registros de trabajo cargados aún.
                  </td>
                </tr>
              ) : (
                registros.map((r) => {
                  const tarea = r.tareaTipoId ? tareasMap.get(r.tareaTipoId) : undefined;
                  const mo = manoObraMap.get(r.categoriaManoObraId);

                  return (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 text-xs font-mono text-slate-400">{r.fecha}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{r.descripcion}</div>
                        {tarea && (
                          <div className="text-[11px] text-amber-400 font-mono">
                            Tarea Tipo: {tarea.nombre}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">{mo ? mo.nombre : 'General'}</td>
                      <td className="px-4 py-3 text-center font-mono text-amber-300">
                        {r.cantidadEjecutada} {tarea ? tarea.unidad : 'u'}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-emerald-400">
                        {r.horasReales} hs
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                            r.condicion === 'dificultosa'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : r.condicion === 'favorable'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {r.condicion}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 transition"
                          aria-label={`Eliminar registro de ${r.descripcion} del ${r.fecha}`}
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

      {/* Modal: New Registro */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold text-white">Cargar Horas de Trabajo Real</h3>
              <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-white">
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Vinculación a Tarea Tipo (Opcional)</label>
                <select
                  value={formData.tareaTipoId || ''}
                  onChange={(e) => setFormData({ ...formData, tareaTipoId: e.target.value || undefined })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">Sin tarea tipo (Trabajo general)</option>
                  {tareasTipo.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Descripción del Trabajo</label>
                <input
                  type="text"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  placeholder="Ej: Montaje de 8 bocas de iluminación"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Cantidad Ejecutada</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.cantidadEjecutada}
                    onChange={(e) => setFormData({ ...formData, cantidadEjecutada: parseFloat(e.target.value) || 1 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Horas Reales Invertidas</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.horasReales}
                    onChange={(e) => setFormData({ ...formData, horasReales: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Condición de Obra</label>
                  <select
                    value={formData.condicion}
                    onChange={(e) => setFormData({ ...formData, condicion: e.target.value as any })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="dificultosa">Dificultosa (Altura/Obra Vieja)</option>
                    <option value="favorable">Favorable</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Registro</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
