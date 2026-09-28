import React, { useState, useMemo } from 'react';
import { Plus, Wrench } from 'lucide-react';
import { CategoriaManoDeObra } from '../../../core/types';
import { formatARS } from '../../../core/calculations';

interface InlineLaborAddProps {
  manoObraMap: Map<string, CategoriaManoDeObra>;
  onAddLabor: (categoriaId: string, horas: number, formula?: string) => void;
}

export const InlineLaborAdd: React.FC<InlineLaborAddProps> = ({
  manoObraMap,
  onAddLabor
}) => {
  const categorias = useMemo(() => Array.from(manoObraMap.values()), [manoObraMap]);
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string>(
    categorias[0]?.id || ''
  );
  const [horasStr, setHorasStr] = useState('1');

  // Si cambia la lista de categorías y no hay seleccionada
  if (!selectedCategoriaId && categorias.length > 0) {
    setSelectedCategoriaId(categorias[0].id);
  }

  const handleConfirm = () => {
    if (!selectedCategoriaId) return;

    const trimmed = horasStr.trim();
    let horas = 1;
    let formula: string | undefined = undefined;

    if (trimmed.startsWith('=')) {
      formula = trimmed;
    } else {
      const parsed = Number(trimmed.replace(',', '.'));
      horas = isNaN(parsed) || parsed <= 0 ? 1 : parsed;
    }

    onAddLabor(selectedCategoriaId, horas, formula);
    setHorasStr('1');
  };

  if (categorias.length === 0) {
    return (
      <div className="text-xs text-on-surface-variant/70 italic py-1">
        No hay categorías de mano de obra configuradas en el sistema.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap text-xs">
      {/* Selector de Categoría */}
      <div className="relative flex-1 min-w-[180px]">
        <select
          value={selectedCategoriaId}
          onChange={(e) => setSelectedCategoriaId(e.target.value)}
          className="w-full pl-2.5 pr-8 py-1.5 bg-surface border border-outline-variant/40 rounded-xl text-on-surface text-xs focus:outline-none focus:border-secondary cursor-pointer"
        >
          {categorias.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.nombre} — {formatARS(cat.costoHora)}/hs
            </option>
          ))}
        </select>
      </div>

      {/* Input de Horas o fórmula */}
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="text"
          value={horasStr}
          onChange={(e) => setHorasStr(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirm();
            }
          }}
          placeholder="Hs / ="
          title="Horas requeridas o fórmula matemática empezando con ="
          className="w-20 px-2 py-1.5 text-center font-mono bg-surface border border-outline-variant/40 rounded-xl text-on-surface focus:outline-none focus:border-secondary text-xs"
        />
        <span className="text-[11px] font-mono text-on-surface-variant font-semibold px-0.5">
          hs
        </span>

        {/* Botón rápido de agregar */}
        <button
          type="button"
          onClick={handleConfirm}
          className="inline-flex items-center gap-1 px-3 py-1.5 font-semibold bg-secondary text-on-secondary hover:bg-secondary/90 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
          title="Agregar mano de obra a la partida"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Mano de Obra</span>
        </button>
      </div>
    </div>
  );
};
