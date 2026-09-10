import React from 'react';
import { Package, GraduationCap, Truck, Calculator, Sparkles } from 'lucide-react';
import { TareaFormData } from '../../../viewmodels/useTareaEditorModalViewModel';
import { FormulaInput } from '../../common/FormulaInput';
import { formatARS } from '../../../core/calculations';
import { evaluateMathExpression } from '../../../core/mathEvaluator';

interface GeneralTabProps {
  formData: TareaFormData;
  setFormData: React.Dispatch<React.SetStateAction<TareaFormData>>;
  categoriasList: string[];
  currentScope: Record<string, number>;
  onOpenAiAssistant?: () => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  formData,
  setFormData,
  categoriasList,
  currentScope,
  onOpenAiAssistant
}) => {
  const inputCls =
    'w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] transition-shadow';

  return (
    <div className="space-y-6">
      {/* Banner de Asistente si la tarea está vacía */}
      {!formData.nombre && onOpenAiAssistant && (
        <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-between gap-3 flex-wrap animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary text-on-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-on-surface block">¿Configuración rápida con Asistente?</span>
              <span className="text-[11px] text-on-surface-variant">Completa parámetros, materiales AEA y mano de obra en un toque.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenAiAssistant}
            className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold shadow-xs transition active:scale-95 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autocompletar Tarea</span>
          </button>
        </div>
      )}

      {/* Selector de Naturaleza de Partida */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
          Naturaleza de la Partida / Trabajo Tipo
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, naturaleza: 'instalacion' })}
            className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-2.5 ${
              !formData.naturaleza || formData.naturaleza === 'instalacion'
                ? 'bg-primary/10 border-primary text-primary font-bold shadow-2xs'
                : 'bg-surface-container border-outline-variant/25 text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <Package className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold">📦 Montaje / Obra (APU)</div>
              <div className="text-xs text-on-surface-variant font-normal leading-tight mt-0.5">
                Materiales + Mano de Obra (MOD)
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFormData({ ...formData, naturaleza: 'servicio_profesional' })}
            className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-2.5 ${
              formData.naturaleza === 'servicio_profesional'
                ? 'bg-purple-500/15 border-purple-500 text-purple-700 dark:text-purple-300 font-bold shadow-2xs'
                : 'bg-surface-container border-outline-variant/25 text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <GraduationCap className="w-4 h-4 mt-0.5 shrink-0 text-purple-600 dark:text-purple-400" />
            <div>
              <div className="text-xs font-bold">🎓 Servicio Profesional / Ensayo</div>
              <div className="text-xs text-on-surface-variant font-normal leading-tight mt-0.5">
                Protocolo SRT 900/15, Termografía, DCI
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFormData({ ...formData, naturaleza: 'servicio_tercerizado' })}
            className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-2.5 ${
              formData.naturaleza === 'servicio_tercerizado'
                ? 'bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300 font-bold shadow-2xs'
                : 'bg-surface-container border-outline-variant/25 text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <Truck className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <div className="text-xs font-bold">🚜 Servicio Tercerizado</div>
              <div className="text-xs text-on-surface-variant font-normal leading-tight mt-0.5">
                Alquiler plataforma, grúa, subcontrato
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Datos Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-on-surface uppercase tracking-wide mb-1">
            Nombre de la Tarea / Trabajo Tipo *
          </label>
          <input
            type="text"
            required
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            className={inputCls}
            placeholder={
              formData.naturaleza === 'servicio_profesional'
                ? 'Ej: Medición y Protocolo Puesta a Tierra SRT 900/15, Estudio Termográfico...'
                : 'Ej: Recableado Integral de Circuito, Boca de Iluminación...'
            }
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">Categoría</label>
          <select
            value={formData.categoria}
            onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
            className={`${inputCls} capitalize`}
          >
            {categoriasList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            Unidad de Medida del Ítem (Presupuesto/Obra)
          </label>
          <input
            type="text"
            value={formData.unidad}
            onChange={(e) => setFormData({ ...formData, unidad: e.target.value })}
            className={inputCls}
            placeholder="ej: servicio, protocolo, depto, tablero, boca, u"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            Notas / Especificaciones Técnicas Breves
          </label>
          <input
            type="text"
            value={formData.notasTecnicas}
            onChange={(e) => setFormData({ ...formData, notasTecnicas: e.target.value })}
            className={inputCls}
            placeholder={
              formData.naturaleza === 'servicio_profesional'
                ? 'Ej: Medición según IRAM 2281 / Res. SRT 900/15 con instrumental calibrado vigente.'
                : 'Especificaciones norma IRAM o detalles constructivos'
            }
          />
        </div>

        {/* Costo Fijo Operativo */}
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            Base Fija Operativa ($) <span className="opacity-70 font-normal">(Costo Fijo)</span>
          </label>
          <input
            type="number"
            min={0}
            step={100}
            value={formData.costoFijoOperativo ?? ''}
            onChange={(e) => setFormData({ ...formData, costoFijoOperativo: e.target.value === '' ? ('' as any) : parseFloat(e.target.value) || 0 })}
            className={inputCls}
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            Descripción de Base Fija Operativa
          </label>
          <input
            type="text"
            value={formData.descripcionCostoFijo || ''}
            onChange={(e) => setFormData({ ...formData, descripcionCostoFijo: e.target.value })}
            className={inputCls}
            placeholder="Ej: Traslado inicial de instrumental y logística"
          />
        </div>
      </div>

      {/* Honorarios Profesionales / Costo de Servicio si aplica */}
      {formData.naturaleza === 'servicio_profesional' && (() => {
        const formulaStr = formData.formulaHonorarios?.trim();
        const evalRes = formulaStr ? evaluateMathExpression(formulaStr, currentScope) : null;
        const evaluatedTotal = evalRes && evalRes.isValid && evalRes.value !== null ? evalRes.value : 0;

        return (
          <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/25 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4" />
                <span>Honorarios Profesionales, Aranceles y Ensayos Técnicos</span>
              </h4>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Ingresa el monto fijo de honorarios (ej: <code className="font-mono font-bold text-purple-700 dark:text-purple-300">120000</code>) o una fórmula matemática con parámetros/variables (ej: <code className="font-mono font-bold text-purple-700 dark:text-purple-300">120000 + jabalinas * 20000</code>).
              </p>
            </div>

            <div className="space-y-2">
              <FormulaInput
                value={formData.formulaHonorarios || ''}
                onChange={(val) => setFormData({ ...formData, formulaHonorarios: val })}
                parametros={formData.parametros}
                variables={formData.variables}
                showChips={true}
                placeholder="ej: 120000 + (cantidad_jabalinas > 1 ? (cantidad_jabalinas - 1) * 20000 : 0) + cantidad_tableros * 10000"
                className="w-full"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-container-highest/60 px-3 py-2 rounded-xl border border-purple-500/25">
                <span className="text-xs font-semibold text-on-surface-variant flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Honorarios Totales Evaluados (con valores default):</span>
                </span>
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg ${
                    !formulaStr || (evalRes && evalRes.isValid)
                      ? 'bg-purple-500/20 text-purple-800 dark:text-purple-200'
                      : 'bg-error/15 text-error'
                  }`}
                >
                  {!formulaStr
                    ? '$ 0'
                    : evalRes && evalRes.isValid
                    ? `= ${formatARS(evaluatedTotal)}`
                    : '⚠️ Error de sintaxis en fórmula'}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Costo de Servicio Tercerizado si aplica */}
      {formData.naturaleza === 'servicio_tercerizado' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-3">
          <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
            <Truck className="w-4 h-4" />
            <span>Costo de Servicio Tercerizado / Subcontrato</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-on-surface-variant block uppercase mb-1">
                Costo Directo del Servicio ($)
              </label>
              <input
                type="number"
                min={0}
                step={100}
                value={formData.costoServicioDirecto ?? ''}
                onChange={(e) => setFormData({ ...formData, costoServicioDirecto: e.target.value === '' ? ('' as any) : parseFloat(e.target.value) || 0 })}
                className={inputCls}
                placeholder="0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
