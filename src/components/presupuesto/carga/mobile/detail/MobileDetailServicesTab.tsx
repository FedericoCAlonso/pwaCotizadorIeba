import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Truck
} from 'lucide-react';
import { ServicioTercerizado } from '../../../../../core/types';
import { formatARS } from '../../../../../core/calculations';
import { useHaptics } from '../../../../../hooks/useHaptics';

export interface MobileDetailServicesTabProps {
  servicios: ServicioTercerizado[];
  onAddService: (descripcion: string, costo: number) => void;
  onRemoveService: (index: number) => void;
}

export const MobileDetailServicesTab: React.FC<MobileDetailServicesTabProps> = ({
  servicios,
  onAddService,
  onRemoveService
}) => {
  const haptics = useHaptics();
  const [desc, setDesc] = useState('');
  const [costo, setCosto] = useState<number | ''>('');

  const handleAdd = () => {
    if (!desc.trim() || !costo || Number(costo) <= 0) return;
    haptics.success();
    onAddService(desc.trim(), Number(costo));
    setDesc('');
    setCosto('');
  };

  return (
    <div className="space-y-3 pb-6 select-none">
      {servicios.length === 0 ? (
        <div className="p-6 text-center rounded-2xl bg-surface-container-low border border-dashed border-outline-variant/30 text-on-surface-variant">
          <p className="text-sm font-semibold mb-1 text-on-surface">Sin Servicios Tercerizados</p>
          <p className="text-xs max-w-xs mx-auto mb-2 opacity-80">
            Podés incorporar servicios externos directos como alquiler de grúa, zanjeo o ensayos de laboratorio.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {servicios.map((s, idx) => (
            <div
              key={idx}
              className="p-3 rounded-2xl bg-surface border border-outline-variant/25 shadow-2xs flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <h5 className="text-xs sm:text-sm font-bold text-on-surface truncate">
                  {s.descripcion}
                </h5>
                <span className="text-xs font-mono font-extrabold text-tertiary">
                  {formatARS((s.costo || 0) * (s.cantidad || 1))}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  haptics.warning();
                  onRemoveService(idx);
                }}
                className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-xl transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Eliminar servicio"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Formulario Táctil para Agregar Servicio */}
      <div className="p-3 rounded-2xl bg-surface-container-high/60 border border-outline-variant/30 space-y-2">
        <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
          + Nuevo Servicio Directo
        </span>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Descripción (ej: Alquiler hidrogrúa 4hs)..."
            className="w-full px-3 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-xs text-on-surface focus:outline-none min-h-[44px]"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={costo}
              onChange={(e) => setCosto(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Costo ARS ($)"
              className="flex-1 px-3 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-xs font-mono font-bold text-on-surface focus:outline-none min-h-[44px]"
            />
            <button
              type="button"
              disabled={!desc.trim() || !costo}
              onClick={handleAdd}
              className="px-4 py-2.5 rounded-xl bg-tertiary text-on-tertiary font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 min-h-[44px] active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
