import React from 'react';
import { Package, Plus, Sparkles, Trash2, Sliders } from 'lucide-react';
import { Insumo, InsumoEnTarea } from '../../../core/types';
import { TareaFormData } from '../../../viewmodels/useTareaEditorModalViewModel';
import { FormulaInput } from '../../common/FormulaInput';
import {
  resolverMaterialPorFiltro,
  formatARS
} from '../../../core/calculations';
import { evaluateMathExpression, evaluateCondition } from '../../../core/mathEvaluator';

interface MaterialesTabProps {
  formData: TareaFormData;
  setFormData: React.Dispatch<React.SetStateAction<TareaFormData>>;
  insumosMap: Map<string, Insumo>;
  currentScope: Record<string, number>;
  setIsMaterialPickerOpen: (open: boolean) => void;
  setIsCategoryFilterModalOpen: (open: boolean) => void;
  setEditingCategoryFilterIdx: (idx: number | null) => void;
  removeInsumoRow: (index: number) => void;
  onSuggestAeaMaterials?: () => void;
}

export const MaterialesTab: React.FC<MaterialesTabProps> = ({
  formData,
  setFormData,
  insumosMap,
  currentScope,
  setIsMaterialPickerOpen,
  setIsCategoryFilterModalOpen,
  setEditingCategoryFilterIdx,
  removeInsumoRow,
  onSuggestAeaMaterials
}) => {
  return (
    <div className="space-y-4">
      {/* Header y Acciones de Materiales */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-4 h-4" />
            <span>Despiece de Insumos & Materiales (con Fórmulas)</span>
          </h4>
          <p className="text-xs text-on-surface-variant">
            Agrega materiales directos del catálogo o ranuras dinámicas que seleccionen automáticamente por categoría y parámetros.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {onSuggestAeaMaterials && (
            <button
              type="button"
              onClick={onSuggestAeaMaterials}
              className="px-3 py-1.5 bg-secondary/10 hover:bg-secondary/20 text-secondary font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-secondary/30 shadow-2xs active:scale-95"
              title="Sugerir e insertar materiales según reglamentación AEA 90364"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sugerir AEA</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsMaterialPickerOpen(true)}
            className="px-3 py-1.5 bg-surface-container-highest hover:bg-surface-container-highest/80 text-on-surface font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-outline-variant/30"
            title="Seleccionar un material puntual fijo del catálogo"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Material Directo</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingCategoryFilterIdx(null);
              setIsCategoryFilterModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-primary/25 shadow-2xs"
            title="Definir una ranura que elija materiales según categoría y parámetros/variables"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Agregar por Categoría</span>
          </button>
        </div>
      </div>

      {/* Chips de variables disponibles para fórmulas */}
      {(formData.parametros.length > 0 || formData.variables.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 px-1 text-xs text-on-surface-variant">
          <span className="font-semibold text-xs uppercase">Variables disponibles:</span>
          {formData.parametros.map((p) => (
            <span key={p.id} className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
              ${p.id}
            </span>
          ))}
          {formData.variables.map((v) => (
            <span key={v.id} className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              ⚡${v.id}
            </span>
          ))}
        </div>
      )}

      {/* Lista de Insumos */}
      <div className="space-y-2.5">
        {formData.insumos.length === 0 ? (
          <div
            onClick={() => setIsMaterialPickerOpen(true)}
            className="text-center py-10 px-4 border-2 border-dashed border-outline-variant/30 rounded-2xl bg-surface-container-low cursor-pointer hover:border-primary/50 transition"
          >
            <Package className="w-8 h-8 text-outline-variant mx-auto mb-2" />
            <p className="text-sm font-bold text-on-surface">Sin materiales asignados a esta tarea</p>
            <p className="text-xs text-primary mt-1">+ Toca para agregar materiales directos o por categoría</p>
          </div>
        ) : (
          formData.insumos.map((item, idx) => {
            let resolvedId = item.materialId || item.insumoId || '';
            let matchingRuleName = '';
            const isDynamic = Boolean(item.reglasDinamicas && item.reglasDinamicas.length > 0);
            const isCategoryFilter = Boolean(item.filtroMaterial);

            if (isCategoryFilter && item.filtroMaterial) {
              const resolved = resolverMaterialPorFiltro(item.filtroMaterial, currentScope, insumosMap);
              if (resolved) {
                resolvedId = resolved.id;
                matchingRuleName = resolved.nombre;
              } else {
                resolvedId = '';
              }
            } else if (isDynamic && item.reglasDinamicas) {
              const match = item.reglasDinamicas.find((r) => !r.condicion || evaluateCondition(r.condicion, currentScope));
              if (match) {
                resolvedId = match.materialId;
                matchingRuleName = match.descripcion || '';
              } else {
                resolvedId = '';
              }
            }

            const selectedMat = insumosMap.get(resolvedId);
            const unitPrice = selectedMat?.precioActual || 0;
            const unit = selectedMat?.unidadVenta || selectedMat?.unidad || 'u';

            const formulaStr = item.formula || String(item.cantidad);
            const evalRes = evaluateMathExpression(formulaStr, currentScope);
            const cantEvaluada = evalRes.isValid && evalRes.value !== null ? evalRes.value : item.cantidad;
            const isConditionMet =
              (!item.condicion || evaluateCondition(item.condicion, currentScope)) &&
              (isDynamic || isCategoryFilter ? Boolean(resolvedId) : true);
            const rowSubtotal = unitPrice * (isConditionMet ? cantEvaluada : 0);

            return (
              <div
                key={idx}
                className={`p-3 sm:p-3.5 rounded-2xl border transition space-y-2.5 ${
                  isConditionMet
                    ? 'bg-surface-container-low border-outline-variant/20 hover:border-outline-variant/40'
                    : 'bg-surface-container-low/40 border-dashed border-outline-variant/30 opacity-75'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-surface-variant text-on-surface-variant font-mono">
                        #{idx + 1}
                      </span>
                      {isCategoryFilter ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono flex items-center gap-1">
                          <span>⚡ Por Categoría: {item.nombreSlot || item.filtroMaterial?.etiqueta || 'Dinámico'}</span>
                        </span>
                      ) : isDynamic ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-mono flex items-center gap-1">
                          <span>⚡ Slot: {item.nombreSlot || 'Dinámico'}</span>
                        </span>
                      ) : null}
                      <h5 className="text-xs font-bold text-on-surface truncate">
                        {selectedMat?.nombre || (isDynamic || isCategoryFilter ? '(Sin coincidencia para parámetros)' : resolvedId)}
                      </h5>
                    </div>
                    <div className="text-xs text-on-surface-variant font-mono flex items-center gap-2">
                      <span>Unit: {formatARS(unitPrice)}</span>
                      <span>•</span>
                      <span className={`font-bold ${isConditionMet ? 'text-primary' : 'text-on-surface-variant line-through'}`}>
                        Consumo: {cantEvaluada} {unit} = {formatARS(rowSubtotal)}
                      </span>
                    </div>
                  </div>

                  {/* Formula Input */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end min-w-0">
                    <div className="flex items-center gap-1.5 bg-surface-container-highest px-3 py-1.5 rounded-xl border border-outline-variant/30 flex-1 sm:flex-initial sm:w-64 min-w-0">
                      <span className="text-xs font-bold text-on-surface-variant uppercase shrink-0">Fórmula:</span>
                      <FormulaInput
                        value={item.formula || ''}
                        onChange={(newFormula) => {
                          const next = [...formData.insumos];
                          const res = evaluateMathExpression(newFormula, currentScope);
                          next[idx] = {
                            ...next[idx],
                            formula: newFormula,
                            cantidad: res.isValid && res.value !== null ? res.value : next[idx].cantidad
                          };
                          setFormData({ ...formData, insumos: next });
                        }}
                        parametros={formData.parametros}
                        variables={formData.variables}
                        showChips={false}
                        placeholder="ej: bocas * 12"
                        className="w-full"
                      />
                      <span className="text-xs font-mono font-bold text-on-surface bg-surface-container px-2 py-0.5 rounded-md shrink-0">
                        = {cantEvaluada} {unit}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeInsumoRow(idx)}
                      className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition shrink-0"
                      title="Quitar material"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Regla Condicional de Inclusión Opcional o Info de Slot */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-outline-variant/15 text-xs">
                  {isCategoryFilter ? (
                    <div className="flex items-center justify-between gap-2 w-full flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant flex-wrap min-w-0">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300">Criterios:</span>
                        <span className="font-mono text-xs bg-surface-container px-2 py-0.5 rounded-md break-all">
                          {item.filtroMaterial?.criterios?.map((c) => `${c.atributo} ${c.operador} ${c.valor}`).join(' • ')}
                        </span>
                        {matchingRuleName && (
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md truncate max-w-xs">
                            ✓ {matchingRuleName}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategoryFilterIdx(idx);
                          setIsCategoryFilterModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-xl transition flex items-center gap-1.5 shrink-0 active:scale-95"
                        title="Editar reglas y criterios del material por categoría"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Editar Criterios</span>
                      </button>
                    </div>
                  ) : isDynamic ? (
                    <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                      <span className="font-semibold text-primary">Reglas ({item.reglasDinamicas?.length || 0}):</span>
                      <span className="font-mono text-xs bg-surface-container px-2 py-0.5 rounded-md">
                        {matchingRuleName ? `Activo: ${matchingRuleName}` : 'Ninguna activa'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-surface-container-highest/80 px-2.5 py-1 rounded-xl border border-outline-variant/25 w-full sm:w-auto min-w-0 sm:min-w-[240px]">
                      <span className="text-xs font-bold text-on-surface-variant uppercase shrink-0">Condición:</span>
                      <FormulaInput
                        value={item.condicion || ''}
                        onChange={(newCond) => {
                          const next = [...formData.insumos];
                          next[idx] = { ...next[idx], condicion: newCond };
                          setFormData({ ...formData, insumos: next });
                        }}
                        parametros={formData.parametros}
                        variables={formData.variables}
                        showChips={false}
                        isCondition={true}
                        placeholder="Siempre (o ej: calibre_principal <= 25)"
                        className="w-full"
                      />
                    </div>
                  )}
                  {item.condicion !== undefined && item.condicion !== null && item.condicion.trim() !== '' && (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                        isConditionMet
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {isConditionMet ? '✓ Incluido' : '⚡ Omitido según parámetros'}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Botones al Pie de Materiales */}
        {formData.insumos.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsMaterialPickerOpen(true)}
              className="flex-1 py-2 px-3 bg-surface-container-highest/60 hover:bg-surface-container-highest border border-dashed border-outline-variant/40 text-on-surface font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 active:scale-[0.99] shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-primary" />
              <span>Agregar Material del Catálogo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingCategoryFilterIdx(null);
                setIsCategoryFilterModalOpen(true);
              }}
              className="py-2 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-emerald-500/30 active:scale-[0.99]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Material Dinámico</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
