import React from 'react';
import {
  Calculator,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import {
  ParametroTrabajoTipo,
  VariableCalculadaTrabajoTipo
} from '../../../core/types';
import { FormulaInput } from '../../common/FormulaInput';
import { evaluateMathExpression } from '../../../core/mathEvaluator';

interface VariablesTabProps {
  variables: VariableCalculadaTrabajoTipo[];
  parametros: ParametroTrabajoTipo[];
  currentScope: Record<string, number>;
  addVariable: (preset?: Partial<VariableCalculadaTrabajoTipo>) => void;
  updateVariable: (index: number, updates: Partial<VariableCalculadaTrabajoTipo>) => void;
  removeVariable: (index: number) => void;
  moveVariable: (index: number, direction: 'up' | 'down') => void;
}

export const VariablesTab: React.FC<VariablesTabProps> = ({
  variables,
  parametros,
  currentScope,
  addVariable,
  updateVariable,
  removeVariable,
  moveVariable
}) => {
  return (
    <div className="space-y-4">
      {/* Encabezado y Explicación de Variables Calculadas */}
      <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="w-4 h-4" />
              <span>Variables y Cálculos Intermedios (Fórmulas Matemáticas)</span>
            </h4>
            <p className="text-xs text-on-surface-variant">
              Cálculos automáticos con fórmulas y funciones (<code className="font-mono text-emerald-700 dark:text-emerald-300">ceil</code>, <code className="font-mono text-emerald-700 dark:text-emerald-300">floor</code>, <code className="font-mono text-emerald-700 dark:text-emerald-300">round</code>, <code className="font-mono text-emerald-700 dark:text-emerald-300">int</code>, <code className="font-mono text-emerald-700 dark:text-emerald-300">min</code>, <code className="font-mono text-emerald-700 dark:text-emerald-300">max</code>). Se calculan a partir de los parámetros de entrada para evitar repetir cálculos en los materiales o en la mano de obra.
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
        {variables.length === 0 ? (
          <div className="p-6 bg-surface-container-highest/30 border border-dashed border-outline-variant/30 rounded-2xl text-center space-y-2">
            <p className="text-xs text-on-surface-variant font-medium">
              No hay variables calculadas definidas.
            </p>
            <p className="text-xs text-on-surface-variant">
              Puedes agregar fórmulas matemáticas intermedias (ej: <code className="font-mono">modulos_totales = 4 + circuitos * 2</code>) para simplificar la formulación de los materiales y mano de obra.
            </p>
            <button
              type="button"
              onClick={() => addVariable()}
              className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Agregar Primera Variable</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {variables.map((variable, idx) => {
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
                        disabled={idx === variables.length - 1}
                        onClick={() => moveVariable(idx, 'down')}
                        className="p-1 text-on-surface-variant hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-25 disabled:pointer-events-none rounded transition"
                        title="Mover variable hacia abajo"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="w-full sm:w-1/4">
                      <label className="text-xs font-bold text-on-surface-variant block uppercase mb-0.5">
                        Identificador
                      </label>
                      <input
                        type="text"
                        value={variable.id}
                        onChange={(e) =>
                          updateVariable(idx, {
                            id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                          })
                        }
                        className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 focus:outline-none"
                        placeholder="modulos_totales"
                      />
                    </div>

                    <div className="w-full sm:w-2/4">
                      <label className="text-xs font-bold text-on-surface-variant block uppercase mb-0.5">
                        Nombre Descriptivo
                      </label>
                      <input
                        type="text"
                        value={variable.nombre}
                        onChange={(e) => updateVariable(idx, { nombre: e.target.value })}
                        className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2.5 py-1.5 text-xs font-bold text-on-surface focus:outline-none"
                        placeholder="Módulos DIN Totales Requeridos"
                      />
                    </div>

                    <div className="w-24 shrink-0">
                      <label className="text-xs font-bold text-on-surface-variant block uppercase mb-0.5">
                        Unidad
                      </label>
                      <input
                        type="text"
                        value={variable.unidad || ''}
                        onChange={(e) => updateVariable(idx, { unidad: e.target.value })}
                        className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-2 py-1.5 text-xs font-mono text-on-surface focus:outline-none"
                        placeholder="módulos, m, hs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeVariable(idx)}
                      className="p-1.5 text-on-surface-variant hover:text-error rounded self-end sm:self-center mt-3 sm:mt-0 transition"
                      title="Eliminar variable calculada"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Fila Inferior: Editor de Fórmula y Previsualización de Valor Calculado */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface-variant block uppercase">
                      Fórmula Matemática de Cálculo
                    </label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <FormulaInput
                        value={variable.formula}
                        onChange={(val) => updateVariable(idx, { formula: val })}
                        placeholder="ej: 4 + circuitos * 2"
                        parametros={parametros}
                        variables={variables.slice(0, idx)}
                        required
                      />
                      <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 px-1 border-t sm:border-t-0 border-outline-variant/15 pt-1 sm:pt-0 sm:mt-1">
                        <span className="text-xs text-on-surface-variant font-medium sm:hidden">Resultado:</span>
                        <span
                          className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                            evalRes.isValid
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-error/15 text-error'
                          }`}
                          title={evalRes.isValid ? 'Resultado evaluado en tiempo real con los valores por defecto' : 'Fórmula inválida o incompleta'}
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
