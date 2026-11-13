import React from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Contacto, Presupuesto, TipoFactura } from '../../../core/types';
import { useEscapeKey } from '../../../hooks/useEscapeKey';

export interface NotebookMetadataPopoverProps {
  isOpen: boolean;
  presupuesto: Presupuesto;
  contactos: Contacto[];
  onClose: () => void;
  onUpdate: (patch: Partial<Presupuesto>) => void;
}

const TIPOS_FACTURA: TipoFactura[] = [
  'Factura A',
  'Factura B',
  'Factura C',
  'Presupuesto X (Sin Factura)'
];

/**
 * Popover compacto del encabezado para editar metadata comercial de la cotización
 * (cliente, dirección de obra, tipo de factura, beneficio % y validez en días).
 */
export const NotebookMetadataPopover: React.FC<NotebookMetadataPopoverProps> = ({
  isOpen,
  presupuesto,
  contactos,
  onClose,
  onUpdate
}) => {
  useEscapeKey(isOpen, onClose, { pushHistory: false });

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Datos de la cotización"
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-full mt-2 z-40 w-80 rounded-xl border border-outline-variant bg-surface-container-high shadow-2xl p-4 space-y-3 text-xs"
    >
      <div className="flex items-center justify-between border-b border-outline-variant/40 pb-2">
        <div className="flex items-center gap-1.5 font-semibold text-on-surface">
          <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
          <span>Datos del presupuesto</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar datos del presupuesto"
          className="p-1 rounded-md hover:bg-surface-container text-on-surface-variant"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-on-surface-variant">Cliente</span>
        <select
          value={presupuesto.clienteId || ''}
          onChange={(e) => onUpdate({ clienteId: e.target.value })}
          className="w-full rounded-lg border border-outline-variant bg-surface px-2.5 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
        >
          <option value="">Sin cliente asignado</option>
          {contactos.map(c => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-on-surface-variant">Dirección de obra</span>
        <input
          type="text"
          value={presupuesto.direccionObra ?? ''}
          onChange={(e) => onUpdate({ direccionObra: e.target.value })}
          placeholder="Ej: Av. Libertador 1240"
          className="w-full rounded-lg border border-outline-variant bg-surface px-2.5 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
        />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-on-surface-variant">Facturación</span>
          <select
            value={presupuesto.tipoFactura}
            onChange={(e) => onUpdate({ tipoFactura: e.target.value as TipoFactura })}
            className="w-full rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
          >
            {TIPOS_FACTURA.map(tf => (
              <option key={tf} value={tf}>
                {tf}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-on-surface-variant">Beneficio (%)</span>
          <input
            type="number"
            step="0.5"
            min="0"
            value={presupuesto.beneficioPorcentaje ?? 20}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (Number.isFinite(val) && val >= 0) {
                onUpdate({ beneficioPorcentaje: val });
              }
            }}
            className="w-full rounded-lg border border-outline-variant bg-surface px-2.5 py-1.5 text-xs text-on-surface font-mono outline-none focus:border-primary"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-on-surface-variant">Validez (días)</span>
        <input
          type="number"
          min="1"
          step="1"
          value={presupuesto.validezDias ?? 15}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (Number.isFinite(val) && val >= 1) {
              onUpdate({ validezDias: val });
            }
          }}
          className="w-full rounded-lg border border-outline-variant bg-surface px-2.5 py-1.5 text-xs text-on-surface font-mono outline-none focus:border-primary"
        />
      </label>
    </div>
  );
};
