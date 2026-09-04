import React from 'react';
import {
  Sliders,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  Variable as VariableIcon
} from 'lucide-react';
import {
  ParametroTrabajoTipo,
  VariableCalculadaTrabajoTipo
} from '../../../core/types';
import { TareaFormData } from '../../../viewmodels/useTareaEditorModalViewModel';
import { FormulaInput } from '../../common/FormulaInput';
import { evaluateMathExpression } from '../../../core/mathEvaluator';

interface ParametrosVariablesTabProps {
  formData: TareaFormData;
  currentScope: Record<string, number>;
  addParametro: (preset?: Partial<ParametroTrabajoTipo>) => void;
  updateParametro: (index: number, updates: Partial<ParametroTrabajoTipo>) => void;
  removeParametro: (index: number) => void;
  moveParametro: (index: number, direction: 'up' | 'down') => void;
  canMoveParametro: (list: ParametroTrabajoTipo[], index: number, direction: 'up' | 'down') => boolean;
  setParametroDependency: (index: number, targetId: string) => void;
  addVariable: (preset?: Partial<VariableCalculadaTrabajoTipo>) => void;
  updateVariable: (index: number, updates: Partial<VariableCalculadaTrabajoTipo>) => void;
  removeVariable: (index: number) => void;
  moveVariable: (index: number, direction: 'up' | 'down') => void;
}

export const ParametrosVariablesTab: React.FC<ParametrosVariablesTabProps> = ({
  formData,
  currentScope,
  addParametro,
  updateParametro,
  removeParametro,
  moveParametro,
  canMoveParametro,
  setParametroDependency,
  addVariable,
  updateVariable,
  removeVariable,
  moveVariable
}) => {
  return (
    <div className="space-y-6">
      {/* 1. Parámetros de Entrada (Inputs del Usuario) */}
      <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4" />
              <span>Parámetros de Entrada (Inputs del Usuario al Cotizar)</span>
            </h4>
            <p className="text-[11px] text-on-surface-variant">
              Define los datos que se le solicitarán al usuario al cotizar en el presupuesto. Las usarás por su nombre (<code className="font-mono text-primary font-bold">bocas</code>, <code className="font-mono text-primary font-bold">circuitos</code>, etc.) en las fórmulas.
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
        <div className="space-y-3">
          {formData.parametros.map((parametro, idx) => (
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
                      disabled={!canMoveParametro(formData.parametros, idx, 'up')}
                      onClick={() => moveParametro(idx, 'up')}
                      className="p-1 text-on-surface-variant hover:text-primary disabled:opacity-25 disabled:pointer-events-none rounded transition"
                      title="Mover parámetro hacia arriba"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!canMoveParametro(formData.parametros, idx, 'down')}
                      onClick={() => moveParametro(idx, 'down')}
                      className="p-1 text-on-surface-variant hover:text-primary disabled:opacity-25 disabled:pointer-events-none rounded transition"
                      title="Mover parámetro hacia abajo"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="text-[11px] font-mono font-bold text-on-surface-variant">
                    #{idx + 1}
                  </span>

                  {parametro.condicion && (
                    <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/25 flex items-center gap-1">
                      <span>↳ Condicional:</span>
                      <code className="font-mono">{parametro.condicion}</code>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (parametro.condicion) {
                          updateParametro(idx, { condicion: undefined });
                        } else {
                          const prevParam = formData.parametros[idx - 1];
                          const defaultCond =
                            prevParam.tipo === 'boolean'
                              ? `${prevParam.id} == 1`
                              : `${prevParam.id} > 0`;
                          updateParametro(idx, { condicion: defaultCond });
                        }
                      }}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition ${
                        parametro.condicion
                          ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40'
                          : 'bg-surface-container text-on-surface-variant hover:text-on-surface border-outline-variant/30'
                      }`}
                      title="Definir si este parámetro depende del valor de un parámetro anterior"
                    >
                      {parametro.condicion ? '⚡ Condicional Activo' : '+ Condición'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => removeParametro(idx)}
                    className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition"
                    title="Eliminar parámetro"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Campos Principales: Identificador, Nombre, Tipo, Default */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                <div className="sm:col-span-3">
                  <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-0.5">
                    Identificador
                  </label>
                  <div className="flex items-center gap-1 bg-surface-container border border-outline-variant/30 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-primary/40">
                    <code className="text-xs font-mono font-bold text-primary">$</code>
                    <input
                      type="text"
                      id={`param-id-${idx}`}
                      required
                      value={parametro.id}
                      onChange={(e) =>
                        updateParametro(idx, {
                          id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                        })
                      }
                      className="w-full bg-transparent text-xs font-mono font-bold text-primary focus:outline-none"
                      placeholder="ej: bocas, sup, k_estado"
                    />
                  </div>
                </div>

                <div className="sm:col-span-5">
                  <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-0.5">
                    Nombre Visible
                  </label>
                  <input
                    type="text"
                    id={`param-nombre-${idx}`}
                    required
                    value={parametro.nombre}
                    onChange={(e) => updateParametro(idx, { nombre: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="ej: Cantidad de Bocas"
                  />
                </div>

                <div className="grid grid-cols-2 sm:col-span-4 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-0.5">
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
                    <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-0.5">
                      Default
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={parametro.valorDefault}
                      onChange={(e) =>
                        updateParametro(idx, { valorDefault: parseFloat(e.target.value) || 0 })
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
                    <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1">
                      <span>↳ Regla de Visibilidad / Activación</span>
                    </span>
                    <span className="text-[10px] text-on-surface-variant">
                      Este parámetro solo se mostrará si la condición es verdadera (&gt; 0)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-4">
                      <label className="text-[9px] font-bold text-on-surface-variant uppercase block mb-0.5">
                        Depende de:
                      </label>
                      <select
                        value={
                          formData.parametros.slice(0, idx).find((p) => parametro.condicion?.includes(p.id))?.id ||
                          formData.parametros[idx - 1].id
                        }
                        onChange={(e) => setParametroDependency(idx, e.target.value)}
                        className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-2 py-1.5 text-xs text-on-surface focus:outline-none"
                      >
                        {formData.parametros.slice(0, idx).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} (${p.id})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-8">
                      <label className="text-[9px] font-bold text-on-surface-variant uppercase block mb-0.5">
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
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase">
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
                      className="text-[10px] text-primary font-bold hover:underline"
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
                          value={opc.valor}
                          onChange={(e) => {
                            const nextOpc = [...(parametro.opciones || [])];
                            nextOpc[opcIdx] = { ...nextOpc[opcIdx], valor: parseFloat(e.target.value) || 0 };
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
      </div>

      {/* 2. Variables de Cálculo Interno (Fórmulas Matemáticas) */}
      <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <VariableIcon className="w-4 h-4" />
              <span>Variables de Cálculo Interno (Fórmulas Intermedias)</span>
            </h4>
            <p className="text-[11px] text-on-surface-variant">
              Cálculos automáticos con fórmulas y funciones (<code className="font-mono text-emerald-700 dark:text-emerald-300">ceil</code>, <code className="font-mono text-emerald-700 dark:text-emerald-300">floor</code>, <code className="font-mono text-emerald-700 dark:text-emerald-300">round</code>, <code className="font-mono text-emerald-700 dark:text-emerald-300">int</code>, <code className="font-mono text-emerald-700 dark:text-emerald-300">min</code>, <code className="font-mono text-emerald-700 dark:text-emerald-300">max</code>).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => addVariable()}
              className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-xl transition flex items-center gap-1 border border-emerald-500/25"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar Variable</span>
            </button>
          </div>
        </div>

        {/* Listado de Variables Calculadas */}
        {formData.variables.length === 0 ? (
          <div className="p-3 bg-surface-container-highest/30 border border-dashed border-outline-variant/30 rounded-2xl text-center">
            <p className="text-[11px] text-on-surface-variant">
              No hay variables calculadas definidas. Puedes agregar fórmulas matemáticas para evitar repetir cálculos en los materiales o mano de obra.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {formData.variables.map((variable, idx) => {
              const evalRes = evaluateMathExpression(variable.formula, currentScope);
              const valCalc = evalRes.isValid && evalRes.value !== null ? evalRes.value : 0;

              return (
                <div
                  key={idx}
                  className="p-3 sm:p-3.5 bg-surface-container-highest/60 border border-emerald-500/25 rounded-2xl space-y-2.5"
                >
                  {/* Fila Superior: Identificador, Nombre, Unidad y Botones */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                    <div className="flex items-center gap-0.5 bg-surface-container rounded-lg p-0.5 border border-outline-variant/20 self-end sm:self-center mt-3 sm:mt-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveVariable(idx, 'up')}
                        className="p-1 text-on-surface-variant hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-25 disabled:pointer-events-none rounded transition"
                        title="Mover variable hacia arriba"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === formData.variables.length - 1}
                        onClick={() => moveVariable(idx, 'down')}
                        className="p-1 text-on-surface-variant hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-25 disabled:pointer-events-none rounded transition"
                        title="Mover variable hacia abajo"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="w-full sm:w-44 shrink-0">
                      <label className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block uppercase mb-0.5">
                        Identificador
                      </label>
                      <div className="flex items-center gap-1 bg-surface-container border border-outline-variant/30 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/40">
                        <code className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-300">⚡$</code>
                        <input
                          type="text"
                          id={`var-id-${idx}`}
                          required
                          value={variable.id}
                          onChange={(e) =>
                            updateVariable(idx, {
                              id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                            })
                          }
                          className="w-full bg-transparent text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 focus:outline-none"
                          placeholder="id_variable"
                        />
                      </div>
                    </div>

                    <div className="flex-1 min-w-[140px]">
                      <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-0.5">
                        Nombre Descriptivo
                      </label>
                      <input
                        type="text"
                        id={`var-nombre-${idx}`}
                        required
                        value={variable.nombre}
                        onChange={(e) => updateVariable(idx, { nombre: e.target.value })}
                        className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                        placeholder="ej: Módulos DIN Requeridos"
                      />
                    </div>

                    <div className="w-20 shrink-0">
                      <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-0.5 text-center">
                        Unidad
                      </label>
                      <input
                        type="text"
                        value={variable.unidad || ''}
                        onChange={(e) => updateVariable(idx, { unidad: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addVariable();
                          }
                        }}
                        className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2 py-1.5 text-xs font-mono text-center text-on-surface focus:outline-none"
                        placeholder="m, u, hs"
                      />
                    </div>

                    <div className="self-end sm:self-center pt-3 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => removeVariable(idx)}
                        className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition"
                        title="Eliminar variable calculada"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Fila Inferior: Editor de Fórmula */}
                  <div className="pt-1 border-t border-emerald-500/15">
                    <label className="text-[10px] font-bold text-on-surface-variant block uppercase mb-1 flex items-center justify-between">
                      <span>Fórmula Matemática / Condicional</span>
                      <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 normal-case hidden sm:inline">
                        Soporta +, -, *, /, %, ^, cond ? a : b, ==, !=, &lt;, &gt;, &lt;=, &gt;=, si, ceil, round...
                      </span>
                    </label>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2 bg-surface-container border border-outline-variant/30 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-primary/50">
                      <FormulaInput
                        value={variable.formula}
                        onChange={(val) => updateVariable(idx, { formula: val })}
                        placeholder="ej: 4 + ceil(circuitos / 2) * 2"
                        parametros={formData.parametros}
                        variables={formData.variables.slice(0, idx)}
                        required
                      />
                      <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 px-1 border-t sm:border-t-0 border-outline-variant/15 pt-1 sm:pt-0 sm:mt-1">
                        <span className="text-[10px] text-on-surface-variant font-medium sm:hidden">Resultado:</span>
                        <span
                          className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                            evalRes.isValid
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-error/15 text-error'
                          }`}
                          title={evalRes.isValid ? 'Resultado evaluado en tiempo real' : 'Fórmula inválida o incompleta'}
                        >
                          {evalRes.isValid ? `= ${valCalc} ${variable.unidad || ''}` : '⚠️ Error sintaxis'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => addVariable()}
              className="w-full py-2.5 px-4 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-xs transition flex items-center justify-center gap-1.5 active:scale-[0.99] shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar otra variable calculada</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
