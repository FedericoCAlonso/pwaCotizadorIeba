import React from 'react';
import { Clock, Plus, Trash2, Calculator, X } from 'lucide-react';
import { CategoriaManoDeObra, ManoObraEnTarea } from '../../../core/types';
import { TareaFormData } from '../../../viewmodels/useTareaEditorModalViewModel';
import { FormulaInput } from '../../common/FormulaInput';
import { formatARS } from '../../../core/calculations';
import { evaluateMathExpression, evaluateCondition } from '../../../core/mathEvaluator';

interface ManoObraTabProps {
  formData: TareaFormData;
  setFormData: React.Dispatch<React.SetStateAction<TareaFormData>>;
  manoObraList: CategoriaManoDeObra[];
  manoObraMap: Map<string, CategoriaManoDeObra>;
  currentScope: Record<string, number>;
  addManoObraRow: () => void;
  removeManoObraRow: (index: number) => void;
}

export const ManoObraTab: React.FC<ManoObraTabProps> = ({
  formData,
  setFormData,
  manoObraList,
  manoObraMap,
  currentScope,
  addManoObraRow,
  removeManoObraRow
}) => {
  return (
    <div className="space-y-4">
      {/* Header y Acciones */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>Horas de Mano de Obra (con Fórmulas)</span>
          </h4>
          <p className="text-[11px] text-on-surface-variant">
            Escribe la fórmula para calcular las horas de cada categoría de mano de obra (ej: <code className="font-mono text-primary font-bold">horas_oficial</code> o <code className="font-mono text-primary font-bold">(bocas * 1.5) * k_complejidad</code>).
          </p>
        </div>
        <button
          type="button"
          onClick={addManoObraRow}
          className="px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-primary/25 active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Agregar Rol MO</span>
        </button>
      </div>

      {/* Configuración de Setup y Cuadrilla para Planificador de Sinergia */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/20">
        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
            Horas Alistamiento / Setup
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={formData.horasSetupTotal ?? ''}
            onChange={(e) => setFormData({ ...formData, horasSetupTotal: e.target.value === '' ? ('' as any) : parseFloat(e.target.value) || 0 })}
            className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-on-surface focus:ring-2 focus:ring-primary/50"
            placeholder="ej: 1.0"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
            Cuadrilla: Oficiales
          </label>
          <input
            type="number"
            step="1"
            min="0"
            value={formData.cuadrillaRecomendada?.oficiales ?? ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                cuadrillaRecomendada: {
                  oficiales: e.target.value === '' ? ('' as any) : parseInt(e.target.value) || 0,
                  ayudantes: formData.cuadrillaRecomendada?.ayudantes ?? 1
                }
              })
            }
            className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-on-surface focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
            Cuadrilla: Ayudantes
          </label>
          <input
            type="number"
            step="1"
            min="0"
            value={formData.cuadrillaRecomendada?.ayudantes ?? ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                cuadrillaRecomendada: {
                  oficiales: formData.cuadrillaRecomendada?.oficiales ?? 1,
                  ayudantes: e.target.value === '' ? ('' as any) : parseInt(e.target.value) || 0
                }
              })
            }
            className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-on-surface focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Lista de Roles */}
      <div className="space-y-3">
        {formData.manoObra.length === 0 ? (
          <div
            onClick={addManoObraRow}
            className="text-center py-8 px-4 border-2 border-dashed border-outline-variant/30 rounded-3xl bg-surface-container-low cursor-pointer hover:border-primary/50 transition-colors group"
          >
            <Clock className="w-8 h-8 text-outline-variant mx-auto mb-2 group-hover:text-primary transition-colors" />
            <p className="text-sm font-bold text-on-surface">Sin mano de obra asignada</p>
            <p className="text-xs text-primary mt-1 font-medium">+ Toca aquí para agregar roles de mano de obra</p>
          </div>
        ) : (
          formData.manoObra.map((item, idx) => {
            const cat = manoObraMap.get(item.categoriaId);
            const rate = cat?.costoHora || 0;

            const formulaStr = item.formula && item.formula.trim() ? item.formula : String(item.horas);
            const evalRes = evaluateMathExpression(formulaStr, currentScope);
            const horasEvaluadas =
              evalRes.isValid && evalRes.value !== null ? evalRes.value : parseFloat(formulaStr) || item.horas || 0;
            const isConditionMet =
              !item.condicion || item.condicion.trim() === '' || evaluateCondition(item.condicion, currentScope);
            const rowSubtotal = rate * (isConditionMet ? horasEvaluadas : 0);

            return (
              <div
                key={idx}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  isConditionMet
                    ? 'bg-surface-container-low border-outline-variant/30 hover:border-outline-variant/50 shadow-xs'
                    : 'bg-surface-container-low/40 border-dashed border-outline-variant/30 opacity-75'
                }`}
              >
                {/* Header de la Tarjeta */}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1 min-w-0">
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                        Rol de Mano de Obra
                      </label>
                      <select
                        value={item.categoriaId}
                        onChange={(e) => {
                          const next = [...formData.manoObra];
                          next[idx] = { ...next[idx], categoriaId: e.target.value };
                          setFormData({ ...formData, manoObra: next });
                        }}
                        className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        {manoObraList.map((mo) => (
                          <option key={mo.id} value={mo.id}>
                            {mo.nombre} ({formatARS(mo.costoHora)}/h)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="shrink-0 pt-0 sm:pt-4">
                      <span className="inline-flex items-center px-2.5 py-1.5 rounded-xl bg-surface-container-highest border border-outline-variant/30 text-[11px] font-mono text-on-surface-variant">
                        Tarifa: <strong className="ml-1 text-on-surface">{formatARS(rate)}/h</strong>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeManoObraRow(idx)}
                    className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition self-end sm:self-center shrink-0 min-h-[38px] min-w-[38px] flex items-center justify-center"
                    title="Quitar rol de mano de obra"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Input de Fórmula de Horas */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-on-surface flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-primary" />
                      <span>Fórmula de cálculo de horas</span>
                    </label>
                    <span className="text-[10px] text-on-surface-variant font-mono">Fórmula o valor numérico</span>
                  </div>

                  <div className="bg-surface-container-highest rounded-xl p-2.5 border border-outline-variant/30 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                    <FormulaInput
                      value={item.formula || ''}
                      onChange={(newFormula) => {
                        const next = [...formData.manoObra];
                        const res = evaluateMathExpression(newFormula, currentScope);
                        next[idx] = {
                          ...next[idx],
                          formula: newFormula,
                          horas: res.isValid && res.value !== null ? res.value : parseFloat(newFormula) || next[idx].horas
                        };
                        setFormData({ ...formData, manoObra: next });
                      }}
                      parametros={formData.parametros}
                      variables={formData.variables}
                      showChips={true}
                      placeholder="ej: horas_oficial o 1.0 + bocas * 1.5"
                    />
                  </div>
                </div>

                {/* Footer: Live Evaluation & Regla Condicional */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-outline-variant/20">
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1 min-w-0">
                    {item.condicion !== undefined && item.condicion !== null ? (
                      <div className="flex items-center gap-1.5 bg-surface-container-highest/80 px-2.5 py-1 rounded-xl border border-outline-variant/25 flex-1 max-w-md min-w-0">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase shrink-0">Condición:</span>
                        <FormulaInput
                          value={item.condicion || ''}
                          onChange={(newCond) => {
                            const next = [...formData.manoObra];
                            next[idx] = { ...next[idx], condicion: newCond };
                            setFormData({ ...formData, manoObra: next });
                          }}
                          parametros={formData.parametros}
                          variables={formData.variables}
                          showChips={false}
                          isCondition={true}
                          placeholder="ej: requiere_certificacion == 1"
                          className="w-full"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...formData.manoObra];
                            next[idx] = { ...next[idx], condicion: undefined };
                            setFormData({ ...formData, manoObra: next });
                          }}
                          className="text-on-surface-variant hover:text-error p-1 rounded-lg transition shrink-0"
                          title="Quitar condición"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...formData.manoObra];
                          next[idx] = { ...next[idx], condicion: '' };
                          setFormData({ ...formData, manoObra: next });
                        }}
                        className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 transition"
                      >
                        <span>+ Añadir condición de inclusión</span>
                      </button>
                    )}

                    {item.condicion !== undefined && item.condicion !== null && item.condicion.trim() !== '' && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                          isConditionMet
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {isConditionMet ? '✓ Incluido' : '⚡ Omitido según condición'}
                      </span>
                    )}
                  </div>

                  {/* Indicador de Horas y Subtotal en Vivo */}
                  <div className="flex items-center gap-2 bg-surface-container-high px-3 py-1.5 rounded-xl border border-outline-variant/30 shrink-0">
                    <span className="text-xs font-mono text-on-surface-variant">
                      Horas: <strong className="text-on-surface">{horasEvaluadas} hs</strong>
                    </span>
                    <span className="text-outline-variant">•</span>
                    <span
                      className={`text-xs font-mono font-bold ${
                        isConditionMet ? 'text-primary' : 'text-on-surface-variant line-through'
                      }`}
                    >
                      Subtotal: {formatARS(rowSubtotal)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Botón Cómodo al Pie */}
        {formData.manoObra.length > 0 && (
          <button
            type="button"
            onClick={addManoObraRow}
            className="w-full py-2.5 px-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs transition flex items-center justify-center gap-1.5 active:scale-[0.99] shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar otro puesto / rol de mano de obra</span>
          </button>
        )}
      </div>
    </div>
  );
};
