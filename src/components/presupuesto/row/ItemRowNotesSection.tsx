import React from 'react';
import { Sliders, Ruler, ShieldAlert } from 'lucide-react';
import { ItemPresupuesto } from '../../../core/types';

interface ItemRowNotesSectionProps {
  item: ItemPresupuesto;
  index: number;
  onUpdateItemNotasTecnicas?: (index: number, notas: string) => void;
  onOpenParametricModal?: (index: number) => void;
  onOpenMaterialModal?: (index: number) => void;
}

export const ItemRowNotesSection: React.FC<ItemRowNotesSectionProps> = ({
  item,
  index,
  onUpdateItemNotasTecnicas,
  onOpenParametricModal,
  onOpenMaterialModal
}) => {
  const hasParamValues = Boolean(item.valoresParametros || item.valoresVariables);
  const hasMaterialEstimates = Boolean(item.parametrosEstimacionMaterial);
  const hasExclusiones = Boolean(item.clausulaExclusiones);
  const hasChips = hasParamValues || hasMaterialEstimates || hasExclusiones;

  return (
    <div className="space-y-2">
      <textarea
        rows={item.notasTecnicas || item.clausulaTecnica ? 2 : 1}
        placeholder="Alcance técnico y notas: marcas, materiales incluidos, desmonte, pruebas..."
        value={item.notasTecnicas || item.clausulaTecnica || ''}
        onChange={(e) => onUpdateItemNotasTecnicas?.(index, e.target.value)}
        className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl sm:rounded-2xl px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 resize-y leading-relaxed transition shadow-2xs min-h-[44px]"
      />

      {/* Chips Tonales (Parámetros, Fórmulas y Exclusiones) */}
      {hasChips && (
        <div className="flex flex-wrap items-center gap-2 max-w-full">
          {hasParamValues && (
            <button
              type="button"
              onClick={() => onOpenParametricModal?.(index)}
              className="text-xs sm:text-sm font-mono px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 flex flex-wrap items-center gap-1.5 transition text-left max-w-full cursor-pointer"
              title="Clic para reajustar los parámetros de este trabajo tipo"
            >
              <span className="font-bold flex items-center gap-1 shrink-0">
                <Sliders className="w-4 h-4" />
                <span>Parámetros:</span>
              </span>
              <span className="flex flex-wrap items-center gap-1">
                {Object.entries(item.valoresParametros || item.valoresVariables || {}).map(([key, val]) => (
                  <span
                    key={key}
                    className="bg-primary/20 px-2 py-0.5 rounded text-xs sm:text-sm font-semibold break-words"
                  >
                    {key}: {typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(2)) : val}
                  </span>
                ))}
              </span>
            </button>
          )}

          {item.parametrosEstimacionMaterial && (
            <button
              type="button"
              onClick={() => onOpenMaterialModal?.(index)}
              className="text-xs sm:text-sm font-mono px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 flex items-center gap-1.5 transition text-left max-w-full cursor-pointer"
              title="Clic para reajustar cálculo métrico de material"
            >
              <Ruler className="w-4 h-4 shrink-0" />
              <span className="break-words truncate max-w-xs sm:max-w-md">
                {item.parametrosEstimacionMaterial.explicacionCalculo}
              </span>
            </button>
          )}

          {item.clausulaExclusiones && (
            <span
              className="text-xs sm:text-sm px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 flex items-center gap-1 font-medium max-w-full truncate"
              title={item.clausulaExclusiones}
            >
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="truncate">Exclusiones Activas</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
