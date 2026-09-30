import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Settings2,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { ItemPresupuesto } from '../../../core/types';

interface ItemDetailAdvancedSectionProps {
  item: ItemPresupuesto;
  onUpdateItem: (updates: Partial<ItemPresupuesto>) => void;
}

export const ItemDetailAdvancedSection: React.FC<ItemDetailAdvancedSectionProps> = ({
  item,
  onUpdateItem
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const isConditionActive = item.condicionTrabajo && item.condicionTrabajo !== 'normal';
  const isManualPriceActive = Boolean(item.precioManual && item.precioManual > 0);
  const hasActiveAdvancedSetting = isConditionActive || isManualPriceActive;

  return (
    <div className="p-3.5 border-b border-outline-variant/30 select-none">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant" />
          )}
          <Settings2 className="w-3.5 h-3.5 text-outline" />
          <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
            Avanzado
          </span>
          {hasActiveAdvancedSetting && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded-full bg-secondary-container text-on-secondary-container font-medium">
              <AlertTriangle className="w-3 h-3 text-secondary" />
              <span>Activo</span>
            </span>
          )}
        </div>

        <span className="text-[11px] text-on-surface-variant/70">
          {isOpen ? 'Ocultar' : 'Mostrar'}
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3 pt-2 border-t border-outline-variant/20">
          {/* Condición de Trabajo */}
          <div>
            <label className="block text-xs font-medium text-on-surface mb-1">
              Condición de Trabajo
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['normal', 'dificultosa', 'favorable'] as const).map((cond) => (
                <button
                  key={cond}
                  type="button"
                  onClick={() => onUpdateItem({ condicionTrabajo: cond })}
                  className={`py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer capitalize ${
                    (item.condicionTrabajo || 'normal') === cond
                      ? 'bg-primary-container text-on-primary-container border-primary font-semibold shadow-xs'
                      : 'bg-surface text-on-surface-variant border-outline-variant/30 hover:bg-surface-container'
                  }`}
                >
                  {cond}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-on-surface-variant/70 mt-1">
              Dificultosa incrementa rendimientos de mano de obra en 25%. Favorable los reduce en 15%.
            </p>
          </div>

          {/* Precio Manual de Venta (Forzado opcional) */}
          <div>
            <label className="block text-xs font-medium text-on-surface mb-1">
              Precio de Venta Forzado / Manual ($)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={item.precioManual || ''}
                placeholder="Automático por APU"
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateItem({ precioManual: val > 0 ? val : undefined });
                }}
                className="flex-1 px-2.5 py-1 text-xs font-mono bg-surface border border-outline-variant/30 rounded text-on-surface focus:outline-none focus:border-primary"
              />
              {item.precioManual && (
                <button
                  type="button"
                  onClick={() => onUpdateItem({ precioManual: undefined })}
                  className="px-2 py-1 text-[11px] text-on-surface-variant hover:text-error rounded hover:bg-surface-container transition-colors cursor-pointer"
                >
                  Restablecer
                </button>
              )}
            </div>
            <p className="text-[10px] text-on-surface-variant/70 mt-1">
              Si se especifica, anula la cascada de indirectos y fija el precio unitario final para el cliente.
            </p>
          </div>

          {/* Notas Técnicas / Observaciones */}
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-on-surface mb-1">
              <FileText className="w-3 h-3 text-outline" />
              <span>Notas Técnicas del Ítem</span>
            </label>
            <textarea
              rows={2}
              value={item.notasTecnicas || ''}
              onChange={(e) => onUpdateItem({ notasTecnicas: e.target.value })}
              placeholder="Aclaraciones específicas de ejecución, materiales o límites..."
              className="w-full px-2.5 py-1.5 text-xs bg-surface border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none focus:border-primary resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};
