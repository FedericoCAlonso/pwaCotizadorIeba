import React, { useState } from 'react';
import {
  Sliders,
  Calculator,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Info
} from 'lucide-react';
import { ModoExpertoCodeMirror } from '../../presupuesto/experto/ModoExpertoCodeMirror';
import { DSLDiagnostic } from '../../presupuesto/experto/dslParser';
import { TareaFormData } from '../../../viewmodels/useTareaEditorModalViewModel';
import { ConsumosCalculadosResultado } from '../../../core/calculations';
import { Insumo, CategoriaManoDeObra } from '../../../core/types';
import { AiPromptModal } from './AiPromptModal';

export interface TareaEditorExpertoProps {
  yamlText: string;
  onYamlChange: (val: string) => void;
  diagnostics: DSLDiagnostic[];
  onInsertSnippet: (type: 'parametro' | 'calculo' | 'material' | 'mano_obra') => void;
  formData: TareaFormData;
  liveEvaluation: ConsumosCalculadosResultado;
  insumosMap?: Map<string, Insumo>;
  manoObraMap?: Map<string, CategoriaManoDeObra>;
}

export const TareaEditorExperto: React.FC<TareaEditorExpertoProps> = ({
  yamlText,
  onYamlChange,
  diagnostics,
  onInsertSnippet,
  formData,
  liveEvaluation,
  insumosMap = new Map(),
  manoObraMap = new Map()
}) => {
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const hasErrors = diagnostics.some((d) => d.type === 'error');
  const hasWarnings = diagnostics.some((d) => d.type === 'warning');
  const totalHorasHombre =
    liveEvaluation.manoObraSnapshot?.reduce((acc, m) => acc + (m.horasTotales || 0), 0) ?? 0;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Barra de herramientas para snippets rápidos */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 transition-colors font-bold shadow-2xs mr-1"
            title="Generar Trabajo Tipo con IA y Normas AEA"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Asistente IA • AEA</span>
          </button>

          <span className="text-on-surface-variant font-medium flex items-center gap-1 mr-1">
            <span>Insertar:</span>
          </span>

          <button
            type="button"
            onClick={() => onInsertSnippet('parametro')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-variant/60 text-on-surface border border-outline-variant/30 transition-colors font-medium"
            title="Añadir bloque de parámetro de entrada"
          >
            <Sliders className="w-3 h-3 text-blue-500" />
            <span>+ Parámetro</span>
          </button>

          <button
            type="button"
            onClick={() => onInsertSnippet('calculo')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-variant/60 text-on-surface border border-outline-variant/30 transition-colors font-medium"
            title="Añadir variable calculada intermedia"
          >
            <Calculator className="w-3 h-3 text-purple-500" />
            <span>+ Cálculo</span>
          </button>

          <button
            type="button"
            onClick={() => onInsertSnippet('material')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-variant/60 text-on-surface border border-outline-variant/30 transition-colors font-medium"
            title="Añadir material vinculado al catálogo"
          >
            <Package className="w-3 h-3 text-emerald-500" />
            <span>+ Material</span>
          </button>

          <button
            type="button"
            onClick={() => onInsertSnippet('mano_obra')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-variant/60 text-on-surface border border-outline-variant/30 transition-colors font-medium"
            title="Añadir partida de mano de obra"
          >
            <Clock className="w-3 h-3 text-amber-500" />
            <span>+ Mano de Obra</span>
          </button>
        </div>

        {/* Indicador de estado de sintaxis */}
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          {hasErrors ? (
            <span className="flex items-center gap-1 text-error font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Sintaxis inválida ({diagnostics.filter(d => d.type === 'error').length})</span>
            </span>
          ) : hasWarnings ? (
            <span className="flex items-center gap-1 text-amber-500 font-medium">
              <Info className="w-3.5 h-3.5" />
              <span>Avisos ({diagnostics.length})</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>YAML Válido</span>
            </span>
          )}
        </div>
      </div>

      {/* Editor CodeMirror 6 */}
      <div className="min-h-[360px] max-h-[460px] border border-outline-variant/40 rounded-xl overflow-hidden shadow-xs bg-surface">
        <ModoExpertoCodeMirror
          value={yamlText}
          onChange={onYamlChange}
          diagnostics={diagnostics}
          placeholder="Escribe aquí la definición en YAML del trabajo tipo..."
        />
      </div>

      {/* Alertas de diagnóstico si existen */}
      {diagnostics.length > 0 && (
        <div className="p-2.5 rounded-xl bg-surface-variant/40 border border-outline-variant/30 max-h-24 overflow-y-auto space-y-1 text-xs">
          {diagnostics.map((diag, i) => (
            <div
              key={i}
              className={`flex items-start gap-1.5 ${
                diag.type === 'error'
                  ? 'text-error'
                  : diag.type === 'warning'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-on-surface-variant'
              }`}
            >
              <span className="font-mono text-[10px] bg-surface px-1 py-0.5 rounded border border-outline-variant/20 shrink-0">
                L.{diag.line || 1}
              </span>
              <span>{diag.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Resumen en vivo de computación */}
      <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/30 flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <span className="text-on-surface-variant block text-[10px] uppercase font-bold">Partida</span>
            <span className="font-semibold text-on-surface truncate max-w-[180px] block">
              {formData.nombre || 'Sin título'}
            </span>
          </div>
          <div className="h-6 w-px bg-outline-variant/40" />
          <div>
            <span className="text-on-surface-variant block text-[10px] uppercase font-bold">Materiales</span>
            <span className="font-mono font-bold text-on-surface">
              $ {(liveEvaluation.costoInsumosTotal ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="h-6 w-px bg-outline-variant/40" />
          <div>
            <span className="text-on-surface-variant block text-[10px] uppercase font-bold">Mano de Obra</span>
            <span className="font-mono font-bold text-on-surface">
              $ {(liveEvaluation.costoManoObraTotal ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              <span className="text-on-surface-variant font-normal ml-1">({totalHorasHombre.toFixed(1)} hs)</span>
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-on-surface-variant block text-[10px] uppercase font-bold">Costo Directo Base</span>
          <span className="font-mono font-bold text-sm text-primary">
            $ {(liveEvaluation.costoDirectoTotal ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Modal Asistente IA */}
      {isAiModalOpen && (
        <AiPromptModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          onApplyYaml={onYamlChange}
          insumosMap={insumosMap}
          manoObraMap={manoObraMap}
        />
      )}
    </div>
  );
};
