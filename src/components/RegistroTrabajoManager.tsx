import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { HardHat, Plus, Save, Trash2, TrendingUp } from 'lucide-react';
import { db, softDelete } from '../db/database';
import { RegistroTrabajo, TareaTipo, MotivoDesvio, MOTIVO_DESVIO_ETIQUETAS } from '../core/types';
import { formatNumber, calcularNuevoFactorEMA } from '../core/calculations';
import { CONDICIONES_TRABAJO, MOTIVOS_DESVIO } from '../core/sampleData';
import { ModalContainer } from './ModalContainer';

export const RegistroTrabajoManager: React.FC = () => {
  const allRegistros = useLiveQuery(() => db.registrosTrabajo.reverse().toArray()) || [];
  const registros = allRegistros.filter(r => !r.deleted);
  const tareasTipo = (useLiveQuery(() => db.tareasTipo.toArray()) || []).filter(t => !t.deleted);
  const manoObraList = (useLiveQuery(() => db.manoObra.toArray()) || []).filter(m => !m.deleted);
  const presupuestos = (useLiveQuery(() => db.presupuestos.reverse().toArray()) || []).filter(p => !p.deleted);
  const clientes = (useLiveQuery(() => db.clientes.toArray()) || []).filter(c => !c.deleted);
  const configs = useLiveQuery(() => db.config.toArray()) || [];
  const config = configs[0];

  const tareasMap = new Map<string, TareaTipo>(tareasTipo.map((t) => [t.id, t]));
  const clientesMap = new Map(clientes.map((c) => [c.id, c]));

  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<RegistroTrabajo>>({
    presupuestoId: '',
    tareaTipoId: undefined,
    descripcion: '',
    fecha: new Date().toISOString().slice(0, 10),
    horasReales: 2.0,
    categoriaManoObraId: manoObraList[0]?.id || '',
    cantidadEjecutada: 1,
    condicion: 'normal',
    motivoDesvio: undefined,
    notas: ''
  });

  const handleOpenCreate = () => {
    setFormData({
      presupuestoId: presupuestos[0]?.id || '',
      tareaTipoId: tareasTipo[0]?.id || undefined,
      descripcion: tareasTipo[0]?.nombre || '',
      fecha: new Date().toISOString().slice(0, 10),
      horasReales: 2.0,
      categoriaManoObraId: manoObraList[0]?.id || '',
      cantidadEjecutada: 1,
      condicion: 'normal',
      motivoDesvio: undefined,
      notas: ''
    });
    setIsCreating(true);
  };

  const handleTareaChange = (tareaId: string) => {
    const t = tareasMap.get(tareaId);
    setFormData((prev) => ({
      ...prev,
      tareaTipoId: tareaId || undefined,
      descripcion: t ? t.nombre : prev.descripcion
    }));
  };

  const adjustHoras = (delta: number) => {
    setFormData((prev) => {
      const newHoras = Math.max(0.25, Math.round(((prev.horasReales || 0) + delta) * 100) / 100);
      return { ...prev, horasReales: newHoras };
    });
  };

  const adjustCantidad = (delta: number) => {
    setFormData((prev) => {
      const newCant = Math.max(1, Math.round(((prev.cantidadEjecutada || 1) + delta) * 10) / 10);
      return { ...prev, cantidadEjecutada: newCant };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoriaManoObraId && manoObraList.length > 0) formData.categoriaManoObraId = manoObraList[0].id;
    
    const horasReales = formData.horasReales || 0.5;
    const cantidadEjecutada = formData.cantidadEjecutada || 1;
    const tareaId = formData.tareaTipoId;
    const now = new Date().toISOString();

    await db.registrosTrabajo.add({
      id: `reg-${crypto.randomUUID()}`,
      presupuestoId: formData.presupuestoId || undefined,
      descripcion: formData.descripcion || 'Registro de Trabajo',
      fecha: formData.fecha || now.slice(0, 10),
      horasReales,
      categoriaManoObraId: formData.categoriaManoObraId || '',
      cantidadEjecutada,
      tareaTipoId: tareaId,
      condicion: formData.condicion || 'normal',
      motivoDesvio: formData.motivoDesvio,
      notas: formData.notas,
      createdAt: now,
      updatedAt: now,
      deleted: false
    });

    // Recálculo incremental de factorCorreccion EMA por TareaTipo
    if (tareaId) {
      const tareaObj = tareasMap.get(tareaId);
      if (tareaObj) {
        const horasEstimadasBase = tareaObj.manoObra.reduce((acc, m) => acc + m.horas, 0);
        const horasEstimadasTotales = horasEstimadasBase * cantidadEjecutada;
        if (horasEstimadasTotales > 0) {
          const alpha = config?.alphaEmaManoObra ?? 0.3;
          const factorAnterior = tareaObj.factorCorreccion ?? 1.0;
          const factorNuevo = calcularNuevoFactorEMA(factorAnterior, horasReales, horasEstimadasTotales, alpha);
          
          await db.tareasTipo.update(tareaId, {
            factorCorreccion: factorNuevo,
            updatedAt: now
          });
        }
      }
    }

    setIsCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este registro de trabajo?')) {
      await softDelete('registrosTrabajo', id);
    }
  };

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

  const inputCls = "w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] transition-shadow";
  const condBadge = (c?: string) => c === 'dificultosa' ? 'bg-error-container text-on-error-container' : c === 'favorable' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-variant text-on-surface-variant';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2">
            <HardHat className="w-5 h-5 text-primary" />
            <span>Registro de Trabajo en Obra (Carga Ágil)</span>
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Recolección de horas reales en campo para calibración estadística (EMA).
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full text-sm transition-all shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Cargar Horas (Obra)</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-5 space-y-4 shadow-sm">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-semibold text-on-surface uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span>Resumen de Calibración EMA & Desvíos por Tarea</span>
          </h3>
          <span className="text-xs text-on-surface-variant font-mono">{registros.length} registros cargados</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {taskVariance.map((tv) => (
            <div key={tv.tarea.id} className="bg-surface-container-highest/50 p-4 rounded-2xl border border-outline-variant/20 space-y-2">
              <div className="flex justify-between items-start">
                <div className="font-semibold text-on-surface text-sm truncate pr-2">{tv.tarea.nombre}</div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container shrink-0" title="Factor de corrección EMA acumulado">
                  {tv.factorEMA.toFixed(2)}x EMA
                </span>
              </div>
              <div className="text-xs text-on-surface-variant flex justify-between">
                <span>Estimado Base:</span>
                <span className="font-mono text-on-surface-variant">{tv.horasEstimadasUnidad} hs/{tv.tarea.unidad}</span>
              </div>
              <div className="text-xs text-on-surface-variant flex justify-between">
                <span>Tiempo Calibrado:</span>
                <span className="font-mono text-primary font-bold">{formatNumber(tv.horasConFactor)} hs/{tv.tarea.unidad}</span>
              </div>
              <div className="text-xs text-on-surface-variant flex justify-between">
                <span>Real Promedio ({tv.nMuestras} reg.):</span>
                <span className="font-mono text-primary">{tv.nMuestras > 0 ? `${formatNumber(tv.horasRealesPromedioUnidad)} hs` : '—'}</span>
              </div>
              {tv.nMuestras >= 1 && (
                <div className={`text-xs font-medium pt-2 border-t border-outline-variant/20 ${tv.desviacionPct > 15 ? 'text-error' : tv.desviacionPct < -15 ? 'text-tertiary' : 'text-on-surface-variant'}`}>
                  {tv.desviacionPct > 15 ? `⚠ Exceso +${formatNumber(tv.desviacionPct, 1)}%` : tv.desviacionPct < -15 ? `✓ Rinde ${formatNumber(Math.abs(tv.desviacionPct), 1)}% más rápido` : '✓ Alineado'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* History Log Table & Mobile Stack */}
      <div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-outline-variant/20 flex justify-between items-center">
          <h3 className="font-bold text-on-surface text-sm">Historial de Partes de Obra</h3>
          <span className="text-xs text-on-surface-variant">{registros.length} partes</span>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm text-on-surface">
            <thead className="bg-surface-container text-xs text-on-surface-variant border-b border-outline-variant/30">
              <tr>
                <th className="px-5 py-3.5 font-medium">Fecha</th>
                <th className="px-5 py-3.5 font-medium">Presupuesto / Obra</th>
                <th className="px-5 py-3.5 font-medium">Tarea & Descripción</th>
                <th className="px-5 py-3.5 text-center font-medium">Cantidad</th>
                <th className="px-5 py-3.5 text-center font-medium">Horas Reales</th>
                <th className="px-5 py-3.5 text-center font-medium">Condición</th>
                <th className="px-5 py-3.5 text-center font-medium">Motivo Desvío</th>
                <th className="px-5 py-3.5 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {registros.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-on-surface-variant text-sm font-medium">
                    Sin registros de trabajo cargados. Haz clic en "+ Cargar Horas" para ingresar datos de obra.
                  </td>
                </tr>
              ) : (
                registros.map((r) => {
                  const tarea = r.tareaTipoId ? tareasMap.get(r.tareaTipoId) : undefined;
                  const pres = r.presupuestoId ? presupuestos.find(p => p.id === r.presupuestoId) : undefined;
                  const cliente = pres ? clientesMap.get(pres.clienteId) : undefined;

                  return (
                    <tr key={r.id} className="hover:bg-surface-container-highest/50 transition-colors">
                      <td className="px-5 py-4 text-xs font-mono text-on-surface-variant">{r.fecha}</td>
                      <td className="px-5 py-4 text-xs">
                        {pres ? (
                          <div>
                            <span className="font-bold text-primary font-mono block">{pres.numero}</span>
                            <span className="text-on-surface-variant truncate block max-w-[150px]">{cliente?.nombre || 'Cliente General'}</span>
                          </div>
                        ) : (
                          <span className="text-on-surface-variant italic">General / Sin obra</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-on-surface text-sm">{r.descripcion}</div>
                        {tarea && <div className="text-xs text-primary font-mono mt-0.5">{tarea.nombre}</div>}
                      </td>
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
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-2 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors"
                          aria-label={`Eliminar registro ${r.descripcion}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Stack View */}
        <div className="md:hidden divide-y divide-outline-variant/20">
          {registros.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant text-sm">
              Sin registros cargados. Usa el botón flotante para agregar tu primera jornada de obra.
            </div>
          ) : (
            registros.map((r) => {
              const tarea = r.tareaTipoId ? tareasMap.get(r.tareaTipoId) : undefined;
              const pres = r.presupuestoId ? presupuestos.find(p => p.id === r.presupuestoId) : undefined;

              return (
                <div key={r.id} className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-mono text-on-surface-variant">{r.fecha}</span>
                      <h4 className="font-bold text-on-surface text-base mt-0.5">{r.descripcion}</h4>
                      {tarea && <span className="text-xs text-primary font-mono block">{tarea.nombre}</span>}
                      {pres && <span className="text-xs text-on-surface-variant block">Obra: {pres.numero}</span>}
                    </div>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="p-2 text-on-surface-variant hover:text-error rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 text-xs">
                    <div>
                      <span className="text-on-surface-variant">Cantidad: </span>
                      <span className="font-bold font-mono text-on-surface">{r.cantidadEjecutada} {tarea?.unidad || 'u'}</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant">Tiempo: </span>
                      <span className="font-bold font-mono text-primary text-sm">{r.horasReales} hs</span>
                    </div>
                  </div>

                  {r.motivoDesvio && (
                    <div className="mt-1">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium">
                        Motivo desvío: {MOTIVO_DESVIO_ETIQUETAS[r.motivoDesvio]}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Mobile M3 Extended FAB */}
      <button
        type="button"
        onClick={handleOpenCreate}
        className="sm:hidden fixed bottom-20 right-4 px-4 py-3.5 bg-primary text-on-primary rounded-2xl shadow-md3-2 hover:shadow-md3-3 active:scale-95 transition-all z-30 flex items-center gap-2 font-semibold text-xs"
        aria-label="Cargar Horas de Obra"
      >
        <HardHat className="w-5 h-5" />
        <span>Cargar Horas</span>
      </button>

      {/* Quick Logging Bottom Sheet / Modal */}
      <ModalContainer
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        title="Carga Ágil de Horas en Obra"
        subtitle="Recolección ultra rápida de tiempo real para calibración EMA"
        icon={<HardHat className="w-5 h-5 text-primary" />}
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Obra / Presupuesto select */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">Presupuesto / Obra Activa</label>
            <select
              value={formData.presupuestoId || ''}
              onChange={(e) => setFormData({ ...formData, presupuestoId: e.target.value || undefined })}
              className={inputCls}
            >
              <option value="">Trabajo general (sin obra específica)</option>
              {presupuestos.map((p) => {
                const c = clientesMap.get(p.clienteId);
                return (
                  <option key={p.id} value={p.id}>
                    {p.numero} — {c?.nombre || 'Cliente General'} ({p.estado})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Tarea Tipo select */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">Tarea Tipo Ejecutada</label>
            <select
              value={formData.tareaTipoId || ''}
              onChange={(e) => handleTareaChange(e.target.value)}
              className={inputCls}
            >
              <option value="">Seleccionar Tarea Tipo...</option>
              {tareasTipo.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.categoria}] {t.nombre} ({t.manoObra.reduce((acc, m) => acc + m.horas, 0)}h est/{t.unidad})
                </option>
              ))}
            </select>
          </div>

          {/* Descripcion */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">Descripción de la Actividad</label>
            <input
              type="text"
              value={formData.descripcion || ''}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className={inputCls}
              placeholder="Ej: Cableado y montaje de 10 bocas IUG"
              required
            />
          </div>

          {/* Fecha & Condicion */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Fecha de Ejecución</label>
              <input
                type="date"
                value={formData.fecha || ''}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                className={inputCls}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Condición de Trabajo</label>
              <select
                value={formData.condicion || 'normal'}
                onChange={(e) => setFormData({ ...formData, condicion: e.target.value as any })}
                className={inputCls}
              >
                {CONDICIONES_TRABAJO.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Steppers for Horas Reales & Cantidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/20">
            {/* Horas Stepper */}
            <div>
              <label className="block text-xs font-bold text-primary mb-1.5 text-center">Horas Reales Ocupadas</label>
              <div className="flex items-center justify-between gap-1 bg-surface-container-highest p-1.5 rounded-2xl border border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => adjustHoras(-0.5)}
                  className="w-10 h-10 rounded-xl bg-surface-container hover:bg-surface-variant font-bold text-lg text-on-surface flex items-center justify-center shrink-0 active:scale-95"
                >
                  -
                </button>
                <div className="text-center font-mono font-extrabold text-lg text-primary">
                  {formData.horasReales || 0.5} <span className="text-xs font-sans font-normal text-on-surface-variant">hs</span>
                </div>
                <button
                  type="button"
                  onClick={() => adjustHoras(0.5)}
                  className="w-10 h-10 rounded-xl bg-surface-container hover:bg-surface-variant font-bold text-lg text-on-surface flex items-center justify-center shrink-0 active:scale-95"
                >
                  +
                </button>
              </div>
              <div className="flex justify-around gap-1 mt-1.5">
                {[0.5, 1, 2, 4, 8].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, horasReales: h }))}
                    className="px-2 py-0.5 rounded-lg text-[11px] font-mono bg-surface-container hover:bg-primary-container hover:text-on-primary-container text-on-surface-variant transition-colors"
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            {/* Cantidad Stepper */}
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5 text-center">Cantidad Realizada</label>
              <div className="flex items-center justify-between gap-1 bg-surface-container-highest p-1.5 rounded-2xl border border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => adjustCantidad(-1)}
                  className="w-10 h-10 rounded-xl bg-surface-container hover:bg-surface-variant font-bold text-lg text-on-surface flex items-center justify-center shrink-0 active:scale-95"
                >
                  -
                </button>
                <div className="text-center font-mono font-extrabold text-lg text-on-surface">
                  {formData.cantidadEjecutada || 1}
                </div>
                <button
                  type="button"
                  onClick={() => adjustCantidad(1)}
                  className="w-10 h-10 rounded-xl bg-surface-container hover:bg-surface-variant font-bold text-lg text-on-surface flex items-center justify-center shrink-0 active:scale-95"
                >
                  +
                </button>
              </div>
              <div className="flex justify-around gap-1 mt-1.5">
                {[1, 5, 10, 20].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, cantidadEjecutada: q }))}
                    className="px-2 py-0.5 rounded-lg text-[11px] font-mono bg-surface-container hover:bg-primary-container hover:text-on-primary-container text-on-surface-variant transition-colors"
                  >
                    +{q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Motivo de desvío selector pills */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
              Motivo de Desvío <span className="text-on-surface-variant/70 font-normal">(Opcional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MOTIVOS_DESVIO.map((m) => {
                const isSelected = formData.motivoDesvio === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        motivoDesvio: isSelected ? undefined : (m.value as MotivoDesvio)
                      }))
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 font-bold border-amber-500 shadow-sm'
                        : 'bg-surface-container-high border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Botones */}
          <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2.5 rounded-full text-xs font-semibold text-on-surface-variant hover:bg-surface-variant"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-full text-xs shadow-sm active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Registro</span>
            </button>
          </div>
        </form>
      </ModalContainer>
    </div>
  );
};
