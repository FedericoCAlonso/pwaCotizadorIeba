import React, { useState } from 'react';
import { Plus, Truck } from 'lucide-react';

interface InlineServiceAddProps {
  onAddService: (descripcion: string, costo: number) => void;
}

export const InlineServiceAdd: React.FC<InlineServiceAddProps> = ({
  onAddService
}) => {
  const [descripcion, setDescripcion] = useState('');
  const [costoStr, setCostoStr] = useState('');

  const handleConfirm = () => {
    const descTrimmed = descripcion.trim();
    if (!descTrimmed) return;

    const parsedCosto = Number(costoStr.replace(',', '.'));
    const costo = isNaN(parsedCosto) || parsedCosto < 0 ? 0 : parsedCosto;

    onAddService(descTrimmed, costo);
    setDescripcion('');
    setCostoStr('');
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap text-xs">
      {/* Input de Descripción del Servicio */}
      <div className="relative flex-1 min-w-[180px]">
        <input
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirm();
            }
          }}
          placeholder="Descripción del servicio (ej: Flete y descarga, Zanjeo)..."
          className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-xl text-on-surface text-xs focus:outline-none focus:border-tertiary placeholder:text-on-surface-variant/50"
        />
      </div>

      {/* Input de Costo Estimado */}
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="text"
          value={costoStr}
          onChange={(e) => setCostoStr(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirm();
            }
          }}
          placeholder="Costo ($)"
          title="Costo total estimado del servicio tercerizado"
          className="w-24 px-2 py-1.5 text-right font-mono bg-surface border border-outline-variant/40 rounded-xl text-on-surface focus:outline-none focus:border-tertiary text-xs"
        />

        {/* Botón rápido de agregar */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!descripcion.trim()}
          className={`inline-flex items-center gap-1 px-3 py-1.5 font-semibold rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 ${
            descripcion.trim()
              ? 'bg-tertiary text-on-tertiary hover:bg-tertiary/90'
              : 'bg-surface-container-high text-on-surface-variant/40 cursor-not-allowed'
          }`}
          title="Agregar servicio a la partida"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Servicio</span>
        </button>
      </div>
    </div>
  );
};
