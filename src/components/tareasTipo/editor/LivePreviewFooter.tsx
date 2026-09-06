import React from 'react';
import { Calculator, Save } from 'lucide-react';
import { formatARS } from '../../../core/calculations';

interface LivePreviewFooterProps {
  liveEvaluation: {
    costoDirectoTotal: number;
    costoServiciosTotal?: number;
    costoInsumosTotal: number;
    costoManoObraTotal: number;
    costoFijoOperativo: number;
    manoObraSnapshot: Array<{ horasTotales: number }>;
  };
  onClose: () => void;
  submitButtonText?: string;
}

export const LivePreviewFooter: React.FC<LivePreviewFooterProps> = ({
  liveEvaluation,
  onClose,
  submitButtonText
}) => {
  const totalHorasMO = liveEvaluation.manoObraSnapshot.reduce((acc, m) => acc + m.horasTotales, 0);

  return (
    <div className="space-y-3 pt-3 border-t border-outline-variant/30">
      {/* Live Preview Cost Box */}
      <div className="p-3 sm:p-4 rounded-2xl bg-primary/10 border border-primary/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div>
          <span className="text-xs font-bold text-primary uppercase tracking-wide flex items-center gap-1">
            <Calculator className="w-3.5 h-3.5" />
            <span>Costo Directo Calculado (Valores Default)</span>
          </span>
          <div className="text-xl font-black font-mono text-on-surface mt-0.5">
            {formatARS(liveEvaluation.costoDirectoTotal)}
          </div>
        </div>

        <div className="text-left sm:text-right font-mono text-xs text-on-surface-variant space-y-0.5">
          {liveEvaluation.costoServiciosTotal !== undefined && liveEvaluation.costoServiciosTotal > 0 && (
            <div>
              🎓 Honorarios / Servicios:{' '}
              <strong className="text-purple-700 dark:text-purple-300 font-bold">
                {formatARS(liveEvaluation.costoServiciosTotal)}
              </strong>
            </div>
          )}
          <div>
            Insumos: <strong className="text-on-surface">{formatARS(liveEvaluation.costoInsumosTotal)}</strong>
          </div>
          <div>
            Mano de Obra:{' '}
            <strong className="text-on-surface">
              {totalHorasMO} hs ({formatARS(liveEvaluation.costoManoObraTotal)})
            </strong>
          </div>
          {liveEvaluation.costoFijoOperativo > 0 && (
            <div>
              Base Fija Operativa:{' '}
              <strong className="text-primary">{formatARS(liveEvaluation.costoFijoOperativo)}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="w-full sm:w-auto px-5 py-2.5 sm:py-2 rounded-full text-xs font-semibold text-on-surface-variant hover:bg-surface-variant text-center min-h-[40px] flex items-center justify-center transition"
        >
          Cancelar
        </button>

        <button
          type="submit"
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 sm:py-2 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-full text-xs shadow-sm active:scale-95 transition min-h-[40px]"
        >
          <Save className="w-4 h-4" />
          <span>{submitButtonText || 'Guardar Trabajo Tipo'}</span>
        </button>
      </div>
    </div>
  );
};
