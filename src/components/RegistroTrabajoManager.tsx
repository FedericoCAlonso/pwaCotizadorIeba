import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { HardHat, Plus, Save, Trash2, TrendingUp, X, AlertTriangle } from 'lucide-react';
import { db } from '../db/database';
import { RegistroTrabajo, TareaTipo, CategoriaManoDeObra, MotivoDesvio, MOTIVO_DESVIO_ETIQUETAS } from '../core/types';
import { formatNumber, calcularNuevoFactorEMA } from '../core/calculations';

export const RegistroTrabajoManager: React.FC = () => {
  const registros = useLiveQuery(() => db.registrosTrabajo.reverse().toArray()) || [];
  const tareasTipo = useLiveQuery(() => db.tareasTipo.toArray()) || [];
  const manoObraList = useLiveQuery(() => db.manoObra.toArray()) || [];
  const configs = useLiveQuery(() => db.config.toArray()) || [];
  const config = configs[0];

  const tareasMap = new Map<string, TareaTipo>(tareasTipo.map((t) => [t.id, t]));
  const manoObraMap = new Map<string, CategoriaManoDeObra>(manoObraList.map((m) => [m.id, m]));

  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<RegistroTrabajo>>({
    descripcion: '', fecha: new Date().toISOString().slice(0, 10),
    horasReales: 3.5, categoriaManoObraId: manoObraList[0]?.id || '',
    cantidadEjecutada: 8, condicion: 'normal', motivoDesvio: undefined, notas: ''
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoriaManoObraId && manoObraList.length > 0) formData.categoriaManoObraId = manoObraList[0].id;
    
    const horasReales = formData.horasReales || 0;
    const cantidadEjecutada = formData.cantidadEjecutada || 1;
    const tareaId = formData.tareaTipoId;

    await db.registrosTrabajo.add({
      id: `reg-${crypto.randomUUID()}`,
      descripcion: formData.descripcion || 'Registro de Trabajo',
      fecha: formData.fecha || new Date().toISOString().slice(0, 10),
      horasReales,
      categoriaManoObraId: formData.categoriaManoObraId || '',
      cantidadEjecutada,
      tareaTipoId: tareaId,
      condicion: formData.condicion || 'normal',
      motivoDesvio: formData.motivoDesvio,
      notas: formData.notas
    });

    // Recálculo incremental de factorCorreccion EMA por TareaTipo (Spec v2 §1.1)
    if (tareaId) {
      const tareaObj = tareasMap.get(tareaId);
      if (tareaObj) {
        const horasEstimadasBase = tareaObj.manoObra.reduce((acc, m) => acc + m.horas, 0);
        const horasEstimadasTotales = horasEstimadasBase * cantidadEjecutada;
        if (horasEstimadasTotales > 0) {
          const alpha = config?.alphaEmaManoObra ?? 0.3;
          const factorAnterior = tareaObj.factorCorreccion ?? 1.0;
          const factorNuevo = calcularNuevoFactorEMA(factorAnterior, horasReales, horasEstimadasTotales, alpha);
          
          await db.tareasTipo.update(tareaId, { factorCorreccion: factorNuevo });
        }
      }
    }

    setIsCreating(false);
    setFormData({ descripcion: '', fecha: new Date().toISOString().slice(0, 10), horasReales: 3.5, categoriaManoObraId: manoObraList[0]?.id || '', cantidadEjecutada: 8, condicion: 'normal', motivoDesvio: undefined, notas: '' });
  };

  const handleDelete = async (id: string) => { if (confirm('¿Eliminar este registro?')) await db.registrosTrabajo.delete(id); };

  const taskVariance = tareasTipo.map((tarea) => {
    const logs = registros.filter((r) => r.tareaTipoId === tarea.id);
    const n = logs.length;
    const horasRealesPromedioUnidad = n > 0 ? logs.reduce((acc, curr) => acc + curr.horasReales / (curr.cantidadEjecutada || 1), 0) / n : 0;
    const horasEstimadasUnidad = tarea.manoObra.reduce((acc, m) => acc + m.horas, 0);
    const factorEMA = tarea.factorCorreccion ?? 1.0;
    const horasConFactor = horasEstimadasUnidad * factorEMA;
    const desviacionPct = horasEstimadasUnidad > 0 ? ((horasRealesPromedioUnidad - horasEstimadasUnidad) / horasEstimadasUnidad) * 100 : 0;
    return { tarea, nMuestras: n, horasEstimadasUnidad, horasConFactor, factorEMA, horasRealesPromedioUnidad, desviacionPct };
  });

  const inputCls = "w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-on-surface-variant/70 transition-shadow";
  const condBadge = (c?: string) => c === 'dificultosa' ? 'bg-error-container text-on-error-container' : c === 'favorable' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-variant text-on-surface-variant';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2"><HardHat className="w-5 h-5 text-primary" />Registro de Trabajo Real</h2>
          <p className="text-sm text-on-surface-variant mt-1">Horas ejecutadas en obra para calibración EMA de Tareas Tipo.</p>
        </div>
        <button onClick={() => setIsCreating(true)} className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm">
          <Plus className="w-4 h-4" /><span>Cargar Horas</span>
        </button>
      </div>

      {/* Variance Panel */}
      <div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 space-y-4 shadow-sm">
        <h3 className="text-xs font-semibold text-on-surface uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />Calibración EMA: Factor de Corrección por Tarea
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {taskVariance.map((tv) => (
            <div key={tv.tarea.id} className="bg-surface-container-highest/50 p-4 rounded-2xl border border-outline-variant/20 space-y-2">
              <div className="flex justify-between items-start">
                <div className="font-semibold text-on-surface text-sm">{tv.tarea.nombre}</div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container" title="Factor de corrección EMA acumulado">
                  {tv.factorEMA.toFixed(2)}x EMA
                </span>
              </div>
              <div className="text-xs text-on-surface-variant flex justify-between"><span>Base:</span><span className="font-mono text-on-surface-variant">{tv.horasEstimadasUnidad} hs/{tv.tarea.unidad}</span></div>
              <div className="text-xs text-on-surface-variant flex justify-between"><span>Con EMA:</span><span className="font-mono text-primary font-bold">{formatNumber(tv.horasConFactor)} hs/{tv.tarea.unidad}</span></div>
              <div className="text-xs text-on-surface-variant flex justify-between"><span>Real ({tv.nMuestras} reg.):</span><span className="font-mono text-primary">{tv.nMuestras > 0 ? `${formatNumber(tv.horasRealesPromedioUnidad)} hs/${tv.tarea.unidad}` : '—'}</span></div>
              {tv.nMuestras >= 1 && (
                <div className={`text-xs font-medium pt-2 border-t border-outline-variant/20 ${tv.desviacionPct > 15 ? 'text-error' : tv.desviacionPct < -15 ? 'text-tertiary' : 'text-on-surface-variant'}`}>
                  {tv.desviacionPct > 15 ? `⚠ Corto por +${formatNumber(tv.desviacionPct, 1)}%` : tv.desviacionPct < -15 ? `✓ Rinde ${formatNumber(Math.abs(tv.desviacionPct), 1)}% más rápido` : '✓ Alineado'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-on-surface">
            <thead className="bg-surface-container text-xs text-on-surface-variant border-b border-outline-variant/30">
              <tr>
                <th className="px-5 py-3.5 font-medium">Fecha</th>
                <th className="px-5 py-3.5 font-medium">Descripción</th>
                <th className="px-5 py-3.5 font-medium">Mano de Obra</th>
                <th className="px-5 py-3.5 text-center font-medium">Cantidad</th>
                <th className="px-5 py-3.5 text-center font-medium">Horas</th>
                <th className="px-5 py-3.5 text-center font-medium">Condición</th>
                <th className="px-5 py-3.5 text-center font-medium">Motivo Desvío</th>
                <th className="px-5 py-3.5 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {registros.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-on-surface-variant text-sm font-medium">Sin registros cargados.</td></tr>
              ) : (
                registros.map((r) => {
                  const tarea = r.tareaTipoId ? tareasMap.get(r.tareaTipoId) : undefined;
                  const mo = manoObraMap.get(r.categoriaManoObraId);
                  return (
                    <tr key={r.id} className="hover:bg-surface-container-highest/50 transition-colors">
                      <td className="px-5 py-4 text-xs font-mono text-on-surface-variant">{r.fecha}</td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-on-surface text-sm">{r.descripcion}</div>
                        {tarea && <div className="text-xs text-primary font-mono mt-0.5">{tarea.nombre}</div>}
                      </td>
                      <td className="px-5 py-4 text-xs text-on-surface-variant">{mo ? mo.nombre : 'General'}</td>
                      <td className="px-5 py-4 text-center font-mono font-bold text-on-surface text-sm">{r.cantidadEjecutada} {tarea ? tarea.unidad : 'u'}</td>
                      <td className="px-5 py-4 text-center font-mono font-bold text-primary text-sm">{r.horasReales}h</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`text-[11px] font-medium px-3 py-1 rounded-full capitalize ${condBadge(r.condicion)}`}>{r.condicion}</span>
                      </td>
                      <td className="px-5 py-4 text-center text-xs">
                        {r.motivoDesvio ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium">
                            {MOTIVO_DESVIO_ETIQUETAS[r.motivoDesvio]}
                          </span>
                        ) : <span className="text-outline-variant">—</span>}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => handleDelete(r.id)} className="p-2 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors" aria-label={`Eliminar registro ${r.descripcion}`}><Trash2 className="w-4 h-4" /></button>
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
          <div className="bg-surface-container border border-outline-variant/30 rounded-3xl w-full max-w-md shadow-2xl p-6 text-on-surface">
            <div className="flex items-center justify-between mb-5 border-b border-outline-variant/30 pb-3">
              <h3 className="text-base font-semibold text-on-surface">Cargar Horas de Trabajo</h3>
              <button onClick={() => setIsCreating(false)} className="text-on-surface-variant hover:text-on-surface p-1"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Tarea Tipo (opcional)</label>
                <select value={formData.tareaTipoId || ''} onChange={(e) => setFormData({ ...formData, tareaTipoId: e.target.value || undefined })} className={inputCls}>
                  <option value="">Trabajo general (sin tarea)</option>
                  {tareasTipo.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Descripción</label>
                <input type="text" value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} className={inputCls} placeholder="Ej: Montaje de 8 bocas de iluminación" required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-xs text-on-surface-variant mb-1">Fecha</label><input type="date" value={formData.fecha} onChange={(e) => setFormData({ ...formData, fecha: e.target.value })} className={inputCls} required /></div>
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Condición de Obra</label>
                  <select value={formData.condicion} onChange={(e) => setFormData({ ...formData, condicion: e.target.value as any })} className={inputCls}>
                    <option value="normal">Normal (1.0x)</option>
                    <option value="dificultosa">Dificultosa (1.25x)</option>
                    <option value="favorable">Favorable (0.9x)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Horas Reales Trabajadas</label>
                  <input type="number" step="0.5" value={formData.horasReales} onChange={(e) => setFormData({ ...formData, horasReales: parseFloat(e.target.value) || 0 })} className={`${inputCls} font-mono text-primary font-bold`} required />
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Cantidad de Tareas Ejecutadas</label>
                  <input type="number" step="0.1" value={formData.cantidadEjecutada} onChange={(e) => setFormData({ ...formData, cantidadEjecutada: parseFloat(e.target.value) || 0 })} className={`${inputCls} font-mono`} />
                </div>
              </div>

              {/* Selector Motivo de Desvío (Spec v2 §1.3) */}
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Motivo de Desvío <span className="opacity-70">(opcional — informativo)</span></label>
                <select value={formData.motivoDesvio || ''} onChange={(e) => setFormData({ ...formData, motivoDesvio: (e.target.value || undefined) as MotivoDesvio })} className={inputCls}>
                  <option value="">Sin motivo particular</option>
                  <option value="material">Material (demoras/defectos de proveedores)</option>
                  <option value="diseno_cliente">Diseño / Modificación de Cliente</option>
                  <option value="clima">Clima / Factores Ambientales</option>
                  <option value="error_calculo">Error de cálculo en la estimación inicial</option>
                  <option value="otro">Otro imprevisible</option>
                </select>
                <p className="text-[10px] text-on-surface-variant/80 mt-1">Este campo no afecta el cálculo automático del factor EMA.</p>
              </div>

              <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
                <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-variant">Cancelar</button>
                <button type="submit" className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-semibold rounded-full text-sm shadow-sm"><Save className="w-3.5 h-3.5" />Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

