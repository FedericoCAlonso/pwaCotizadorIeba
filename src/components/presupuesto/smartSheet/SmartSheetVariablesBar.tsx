import React from 'react';
import { Sliders, Variable } from 'lucide-react';

/**
 * Propiedades del componente SmartSheetVariablesBar.
 * Recibe el diccionario de variables globales de la obra (ej: bocas, superficie, etc.)
 */
export interface SmartSheetVariablesBarProps {
  /** Diccionario de variables globales de obra que alimentan las fórmulas */
  calculosVariables?: Record<string, number | string>;
}

/**
 * SmartSheetVariablesBar: Barra superior fija que exhibe las variables de la obra.
 * Estas variables alimentan reactivamente las fórmulas de las líneas de los ítems.
 */
export const SmartSheetVariablesBar: React.FC<SmartSheetVariablesBarProps> = ({
  calculosVariables = {}
}) => {
  const entries = Object.entries(calculosVariables);

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-low border-b border-outline-variant/20 overflow-x-auto text-xs text-on-surface-variant select-none shrink-0"
      role="region"
      aria-label="Variables de la obra"
    >
      <div className="flex items-center gap-1.5 font-semibold text-primary shrink-0">
        <Sliders className="w-3.5 h-3.5" />
        <span className="uppercase tracking-wider text-[11px] font-bold">Variables de Obra:</span>
      </div>

      {entries.length > 0 ? (
        <div className="flex items-center gap-1.5 flex-nowrap">
          {entries.map(([nombre, valor]) => (
            <span
              key={nombre}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-container-high border border-outline-variant/30 font-mono text-[11px] text-on-surface shrink-0"
              title={`Variable de obra: ${nombre} = ${valor}`}
            >
              <Variable className="w-3 h-3 text-secondary shrink-0" />
              <span className="font-semibold text-on-surface">{nombre}:</span>
              <span className="text-secondary font-bold">{String(valor)}</span>
            </span>
          ))}
        </div>
      ) : (
        <span className="text-on-surface-variant/60 text-[11px] italic">
          Sin variables globales definidas (ej. bocas, superficie, antigüedad). Se pueden ingresar fórmulas directas en las líneas.
        </span>
      )}
    </div>
  );
};
