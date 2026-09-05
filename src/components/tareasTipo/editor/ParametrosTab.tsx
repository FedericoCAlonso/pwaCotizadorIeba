import React from 'react';
import {
  Sliders,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  X
} from 'lucide-react';
import { ParametroTrabajoTipo } from '../../../core/types';

interface ParametrosTabProps {
  parametros: ParametroTrabajoTipo[];
  addParametro: (preset?: Partial<ParametroTrabajoTipo>) => void;
  updateParametro: (index: number, updates: Partial<ParametroTrabajoTipo>) => void;
  removeParametro: (index: number) => void;
  moveParametro: (index: number, direction: 'up' | 'down') => void;
  canMoveParametro: (list: ParametroTrabajoTipo[], index: number, direction: 'up' | 'down') => boolean;
  setParametroDependency: (index: number, targetId: string) => void;
}

export const ParametrosTab: React.FC<ParametrosTabProps> = ({
  parametros,
  addParametro,
  updateParametro,
  removeParametro,
  moveParametro,
  canMoveParametro,
  setParametroDependency
}) => {
  return (
    <div className="space-y-4">
      {/* Encabezado y Explicación de la Sección de Parámetros de Entrada */}
      <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4" />
              <span>Parámetros de Entrada (Inputs del Usuario al Cotizar)</span>
            </h4>
            <p className="text-xs text-on-surface-variant">
              Define los datos que se le solicitarán al usuario al cotizar en el presupuesto (en el modal paramétrico). Las usarás por su identificador (<code className="font-mono text-primary font-bold">bocas</code>, <code className="font-mono text-primary font-bold">circuitos</code>, etc.) en los cálculos y fórmulas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => addParametro()}
              className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar Parámetro</span>
            </button>
          </div>
        </div>

        {/* Listado de Parámetros */}
        {parametros.length === 0 ? (
          <div className="p-6 bg-surface-container-highest/30 border border-dashed border-outline-variant/30 rounded-2xl text-center space-y-2">
            <p className="text-xs text-on-surface-variant font-medium">
              No hay parámetros de entrada definidos para esta tarea.
            </p>
            <p className="text-xs text-on-surface-variant/70">
              Si esta tarea tiene consumo fijo o por unidad simple, no requiere parámetros. Si depende de preguntas al usuario (ej: bocas, altura, circuitos), agrega uno.
            </p>
            <button
              type="button"
              onClick={() => addParametro()}
              className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Agregar Primer Parámetro</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {parametros.map((parametro, idx) => (
              <div
                key={idx}
                className={`p-3 sm:p-3.5 rounded-2xl space-y-2.5 transition border ${
                  parametro.condicion
                    ? 'bg-amber-500/5 border-amber-500/30'
                    : 'bg-surface-container-highest/60 border-outline-variant/25'
                }`}
              >
                {/* Barra Superior del Parámetro: Reordenamiento, Índice, Badges y Acciones */}
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-outline-variant/15">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Botones de Reordenamiento */}
                    <div className="flex items-center gap-0.5 bg-surface-container rounded-lg p-0.5 border border-outline-variant/20">
                      <button
                        type="button"
                        disabled={!canMoveParametro(parametros, idx, 'up')}
                        onClick={() => moveParametro(idx, 'up')}
                        className="p-1 text-on-surface-variant hover:text-primary disabled:opacity-25 disabled:pointer-events-none rounded transition"
                        title="Mover parámetro hacia arriba"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={!canMoveParametro(parametros, idx, 'down')}
                        onClick={() => moveParametro(idx, 'down')}
                        className="p-1 text-on-surface-variant hover:text-primary disabled:opacity-25 disabled:pointer-events-none rounded transition"
                        title="Mover parámetro hacia abajo"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="text-xs font-mono font-bold text-on-surface-variant">
                      #{idx + 1}
                    </span>

                    {/* Badge de ID en fórmulas */}
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                      ${parametro.id || 'id_variable'}
                    </span>

                    {/* Badge de Condición si tiene */}
                    {parametro.condicion && (
                      <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                        Condición: {parametro.condicion}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Botón para Condicionar si no es el primer parámetro */}
                    {idx > 0 && !parametro.condicion && (
                      <button
                        type="button"
                        onClick={() => updateParametro(idx, { condicion: `${parametros[idx - 1].id} > 0` })}
                        className="text-xs text-amber-700 dark:text-amber-300 hover:underline px-1.5 py-0.5 rounded font-medium"
                        title="Hacer que este parámetro aparezca sólo si se cumple una condición"
                      >
                        + Condición
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => removeParametro(idx)}
                      className="p-1 text-on-surface-variant hover:text-error rounded transition"
                      title="Eliminar parámetro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Campos Principales del Parámetro */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-3">
                    <label className="text-xs font-bold text-on-surface-variant block uppercase mb-0.5">
                      Identificador
                    </label>
                    <input
                      type="text"
                      value={parametro.id}
                      onChange={(e) =>
                        updateParametro(idx, {
                          id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                        })
                      }
                      className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-primary focus:outline-none"
                      placeholder="bocas"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-xs font-bold text-on-surface-variant block uppercase mb-0.5">
                      Etiqueta / Pregunta
                    </label>
                    <input
                      type="text"
                      value={parametro.nombre}
                      onChange={(e) => updateParametro(idx, { nombre: e.target.value })}
                      className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2.5 py-1.5 text-xs font-bold text-on-surface focus:outline-none"
                      placeholder="Cantidad de Bocas"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-on-surface-variant block uppercase mb-0.5">
                      Unidad
                    </label>
                    <input
                      type="text"
                      value={parametro.unidad || ''}
                      onChange={(e) => updateParametro(idx, { unidad: e.target.value })}
                      className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2 py-1.5 text-xs font-mono text-on-surface focus:outline-none"
                      placeholder="bocas, m², u"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:col-span-4 gap-2">
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block uppercase mb-0.5">
                        Tipo
                      </label>
                      <select
                        value={parametro.tipo}
                        onChange={(e) =>
                          updateParametro(idx, {
                            tipo: e.target.value as any,
                            opciones:
                              e.target.value === 'select' && (!parametro.opciones || parametro.opciones.length === 0)
                                ? [
                                    { id: 'opt-1', label: 'Estándar (1.00x)', valor: 1.0 },
                                    { id: 'opt-2', label: 'Complejo (1.25x)', valor: 1.25 }
                                  ]
                                : parametro.opciones
                          })
                        }
                        className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2 py-1.5 text-xs text-on-surface focus:outline-none"
                      >
                        <option value="numero">Número</option>
                        <option value="select">Opciones</option>
                        <option value="boolean">Switch (Sí/No)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-on-surface-variant block uppercase mb-0.5">
                        Default
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={parametro.valorDefault ?? ''}
                        onChange={(e) =>
                          updateParametro(idx, {
                            valorDefault: e.target.value === '' ? ('' as any) : (parseFloat(e.target.value) || 0)
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addParametro();
                          }
                        }}
                        className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-on-surface focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Panel de Configuración Condicional */}
                {parametro.condicion !== undefined && idx > 0 && (
                  <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/25 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1">
                        <span>↳ Regla de Visibilidad / Activación</span>
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        Este parámetro solo se mostrará si la condición es verdadera (&gt; 0)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <div className="sm:col-span-4">
                        <label className="text-xs font-bold text-on-surface-variant uppercase block mb-0.5">
                          Depende de:
                        </label>
                        <select
                          value={
                            parametros.slice(0, idx).find((p) => parametro.condicion?.includes(p.id))?.id ||
                            parametros[idx - 1].id
                          }
                          onChange={(e) => setParametroDependency(idx, e.target.value)}
                          className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-2 py-1.5 text-xs text-on-surface focus:outline-none"
                        >
                          {parametros.slice(0, idx).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre} (${p.id})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-8">
                        <label className="text-xs font-bold text-on-surface-variant uppercase block mb-0.5">
                          Fórmula de Condición (ej: <code>req_unifilar == 1</code>, <code>bocas &gt; 5</code>)
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={parametro.condicion}
                            onChange={(e) => updateParametro(idx, { condicion: e.target.value })}
                            className="w-full bg-surface-container border border-amber-500/40 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-amber-900 dark:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                            placeholder="ej: requiere_unifilar == 1"
                          />
                          <button
                            type="button"
                            onClick={() => updateParametro(idx, { condicion: undefined })}
                            className="p-1 text-on-surface-variant hover:text-error rounded"
                            title="Quitar condición"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Editor de Opciones si es Selector */}
                {parametro.tipo === 'select' && (
                  <div className="p-2.5 bg-surface-container rounded-xl border border-outline-variant/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-on-surface-variant uppercase">
                        Opciones y Multiplicadores de "{parametro.nombre}":
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const current = parametro.opciones || [];
                          updateParametro(idx, {
                            opciones: [
                              ...current,
                              { id: `opt-${current.length + 1}`, label: `Opción ${current.length + 1}`, valor: 1.0 }
                            ]
                          });
                        }}
                        className="text-xs text-primary font-bold hover:underline"
                      >
                        + Agregar Opción
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(parametro.opciones || []).map((opc, opcIdx) => (
                        <div
                          key={opcIdx}
                          className="flex items-center gap-1 bg-surface-container-highest p-1.5 rounded-lg border border-outline-variant/20"
                        >
                          <input
                            type="text"
                            value={opc.label}
                            onChange={(e) => {
                              const nextOpc = [...(parametro.opciones || [])];
                              nextOpc[opcIdx] = { ...nextOpc[opcIdx], label: e.target.value };
                              updateParametro(idx, { opciones: nextOpc });
                            }}
                            className="w-full bg-transparent text-xs text-on-surface focus:outline-none"
                            placeholder="Etiqueta"
                          />
                          <input
                            type="number"
                            step="0.05"
                            value={opc.valor ?? ''}
                            onChange={(e) => {
                              const nextOpc = [...(parametro.opciones || [])];
                              nextOpc[opcIdx] = {
                                ...nextOpc[opcIdx],
                                valor: e.target.value === '' ? ('' as any) : (parseFloat(e.target.value) || 0)
                              };
                              updateParametro(idx, { opciones: nextOpc });
                            }}
                            className="w-16 bg-surface-container text-xs font-mono font-bold text-primary text-center rounded px-1 py-0.5 focus:outline-none"
                            title="Multiplicador numérico"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const nextOpc = (parametro.opciones || []).filter((_, i) => i !== opcIdx);
                              updateParametro(idx, { opciones: nextOpc });
                            }}
                            className="text-on-surface-variant hover:text-error p-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Botón Cómodo al Pie de la Lista de Parámetros */}
            <button
              type="button"
              onClick={() => addParametro()}
              className="w-full py-2.5 px-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs transition flex items-center justify-center gap-1.5 active:scale-[0.99] shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar otro parámetro</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
