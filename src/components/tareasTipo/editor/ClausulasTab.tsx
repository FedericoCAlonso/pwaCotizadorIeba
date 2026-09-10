import React from 'react';
import { ShieldAlert, FileText } from 'lucide-react';
import { TareaFormData } from '../../../viewmodels/useTareaEditorModalViewModel';
import {
  DEFAULT_CLAUSULA_OBRA_EXISTENTE,
  DEFAULT_CLAUSULA_SRT_900
} from '../../../core/calculations';

interface ClausulasTabProps {
  formData: TareaFormData;
  setFormData: React.Dispatch<React.SetStateAction<TareaFormData>>;
  onApplyAeaClauses?: (type?: 'exclusiones' | 'notas' | 'todas') => void;
}

export const ClausulasTab: React.FC<ClausulasTabProps> = ({ formData, setFormData, onApplyAeaClauses }) => {
  const inputCls =
    'w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] transition-shadow';

  return (
    <div className="space-y-6">
      {/* Cláusula Técnica & Exclusiones de Obra */}
      <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-bold text-on-surface uppercase tracking-wide flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span>Cláusula Técnica & Exclusiones Contractuales</span>
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {onApplyAeaClauses && (
              <button
                type="button"
                onClick={() => onApplyAeaClauses('exclusiones')}
                className="text-xs text-primary font-bold hover:underline"
              >
                + Exclusiones AEA 90364
              </button>
            )}
            {formData.naturaleza === 'servicio_profesional' ? (
              <button
                type="button"
                onClick={() => setFormData({ ...formData, clausulaExclusiones: DEFAULT_CLAUSULA_SRT_900 })}
                className="text-xs text-purple-700 dark:text-purple-300 font-bold hover:underline"
              >
                + Plantilla Res. SRT 900/15
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setFormData({ ...formData, clausulaExclusiones: DEFAULT_CLAUSULA_OBRA_EXISTENTE })}
                className="text-xs text-on-surface-variant hover:text-on-surface font-semibold hover:underline"
              >
                + Obra existente
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-on-surface-variant">
          Texto que se insertará en el presupuesto final para delimitar el alcance del trabajo, exclusiones (ej: canalizaciones obstruidas, roturas de mampostería, pintura) y resguardos legales del instalador.
        </p>
        <textarea
          rows={5}
          value={formData.clausulaExclusiones || ''}
          onChange={(e) => setFormData({ ...formData, clausulaExclusiones: e.target.value })}
          className={`${inputCls} text-xs leading-relaxed font-sans`}
          placeholder={
            formData.naturaleza === 'servicio_profesional'
              ? 'Ej: El servicio contempla la medición de puesta a tierra y verificación de protecciones diferenciales según Res. SRT 900/15...'
              : 'Ej: La cotización contempla el reemplazo a través de canalizaciones transitables sin roturas estructurales...'
          }
        />
      </div>

      {/* Notas Técnicas para el Cliente */}
      <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-bold text-on-surface uppercase tracking-wide flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-primary" />
            <span>Notas Técnicas y Normas de Aplicación</span>
          </label>
          {onApplyAeaClauses && (
            <button
              type="button"
              onClick={() => onApplyAeaClauses('notas')}
              className="text-xs text-primary font-bold hover:underline"
            >
              + Notas Técnicas AEA 90364
            </button>
          )}
        </div>
        <p className="text-xs text-on-surface-variant">
          Aclaraciones de normas aplicables (ej: Reglamentación AEA 90364, IRAM 247-3, etc.) que se adjuntan a la partida.
        </p>
        <textarea
          rows={3}
          value={formData.notasTecnicas || ''}
          onChange={(e) => setFormData({ ...formData, notasTecnicas: e.target.value })}
          className={`${inputCls} text-xs leading-relaxed`}
          placeholder="Ej: Materiales normalizados con sello IRAM. Canalización no expuesta a intemperie."
        />
      </div>
    </div>
  );
};
