import React, { useState } from 'react';
import {
  Sliders,
  Plus,
  Trash2,
  Copy,
  Check,
  Variable,
  HelpCircle
} from 'lucide-react';
import { ParametroItem } from '../../../../../core/types';
import { useHaptics } from '../../../../../hooks/useHaptics';

export interface MobileDetailParamsTabProps {
  parametros?: ParametroItem[];
  calculosVariables?: Record<string, number | string>;
  onUpdateParametros: (parametros: ParametroItem[]) => void;
}

export const MobileDetailParamsTab: React.FC<MobileDetailParamsTabProps> = ({
  parametros = [],
  calculosVariables = {},
  onUpdateParametros
}) => {
  const haptics = useHaptics();
  const [newId, setNewId] = useState('');
  const [newValor, setNewValor] = useState('');
  const [newUnidad, setNewUnidad] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const handleAdd = () => {
    const rawId = newId.trim().toLowerCase().replace(/\s+/g, '_');
    if (!rawId) return;

    haptics.selection();
    const valStr = newValor.trim();
    const isFormula = valStr.startsWith('=');
    const num = Number(valStr);
    const valor = isNaN(num) || isFormula ? 0 : num;
    const formula = isFormula ? valStr : undefined;

    const existingIdx = parametros.findIndex((p) => p.id === rawId);
    let updated: ParametroItem[];

    const itemParam: ParametroItem = {
      id: rawId,
      nombre: rawId,
      valor,
      formula,
      unidad: newUnidad.trim() || undefined,
      origen: 'propio'
    };

    if (existingIdx >= 0) {
      updated = [...parametros];
      updated[existingIdx] = itemParam;
    } else {
      updated = [...parametros, itemParam];
    }

    onUpdateParametros(updated);
    setNewId('');
    setNewValor('');
    setNewUnidad('');
  };

  const handleRemove = (id: string) => {
    haptics.warning();
    onUpdateParametros(parametros.filter((p) => p.id !== id));
  };

  const handleCopyVariable = (key: string) => {
    haptics.tick();
    navigator.clipboard?.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="space-y-4 pb-6 select-none">
      {/* Banner Explicativo */}
      <div className="p-3 bg-surface-container-high rounded-2xl border border-outline-variant/30 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-on-surface">
            <Sliders className="w-4 h-4 text-primary" />
            <span>Parámetros del Ítem</span>
          </div>
          <button
            type="button"
            onClick={() => setShowHelp((p) => !p)}
            className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer font-semibold min-h-[32px] px-2"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showHelp ? 'Cerrar' : 'Ayuda'}</span>
          </button>
        </div>

        <p className="text-[11px] text-on-surface-variant leading-relaxed">
          Variables locales que aplican a las fórmulas de cómputo de este ítem.
        </p>

        {showHelp && (
          <div className="mt-2 pt-2 border-t border-outline-variant/20 text-[11px] space-y-1 font-mono text-on-surface">
            <p className="font-sans font-bold text-primary">Ejemplos de uso en fórmulas:</p>
            <p className="bg-surface-container p-1 rounded"><code>=largo * 1.15</code> (longitud con desperdicio)</p>
            <p className="bg-surface-container p-1 rounded"><code>=si(altura &gt; 3, base * 1.3, base)</code></p>
          </div>
        )}
      </div>

      {/* Formulario Táctil para Agregar Parámetro */}
      <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/30 space-y-2">
        <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
          Nuevo Parámetro Local
        </span>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Nombre (ej: largo)"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            className="col-span-2 px-3 py-2 text-xs bg-surface border border-outline-variant/40 rounded-xl text-on-surface focus:outline-none focus:border-primary font-mono min-h-[42px]"
          />
          <input
            type="text"
            placeholder="Valor o =fórmula"
            value={newValor}
            onChange={(e) => setNewValor(e.target.value)}
            className="px-3 py-2 text-xs bg-surface border border-outline-variant/40 rounded-xl text-on-surface focus:outline-none focus:border-primary font-mono min-h-[42px]"
          />
          <input
            type="text"
            placeholder="Unidad (m, u, kg)"
            value={newUnidad}
            onChange={(e) => setNewUnidad(e.target.value)}
            className="px-3 py-2 text-xs bg-surface border border-outline-variant/40 rounded-xl text-on-surface focus:outline-none focus:border-primary min-h-[42px]"
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newId.trim()}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold shadow-xs hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer min-h-[44px] active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>Guardar Parámetro</span>
        </button>
      </div>

      {/* Listado de Parámetros Locales */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider px-1">
          Parámetros Activos ({parametros.length})
        </span>

        {parametros.length === 0 ? (
          <div className="p-4 text-center rounded-2xl bg-surface-container-lowest border border-dashed border-outline-variant/30 text-xs text-on-surface-variant">
            No hay parámetros configurados para este ítem.
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/20 border border-outline-variant/30 rounded-2xl overflow-hidden bg-surface">
            {parametros.map((p) => (
              <div
                key={p.id}
                className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-surface-container-low transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary text-sm">{p.id}</span>
                    {p.unidad && (
                      <span className="text-[10px] text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded-md font-mono">
                        {p.unidad}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-xs font-semibold text-on-surface mt-0.5">
                    = {p.formula || p.valor}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(p.id)}
                  className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-xl transition-colors cursor-pointer shrink-0"
                  title="Eliminar parámetro"
                  aria-label={`Eliminar parámetro ${p.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Variables Globales Disponibles */}
      {Object.keys(calculosVariables).length > 0 && (
        <div className="pt-2 border-t border-outline-variant/20 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-on-surface font-bold px-1">
            <Variable className="w-4 h-4 text-secondary" />
            <span>Variables Globales de Obra (Tocar para copiar):</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.entries(calculosVariables).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => handleCopyVariable(k)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs bg-surface-container border border-outline-variant/30 hover:border-primary text-on-surface transition-all cursor-pointer min-h-[38px] active:scale-95"
              >
                <span className="font-mono font-bold text-primary">{k}</span>
                <span className="font-mono text-[11px] text-on-surface-variant">={String(v)}</span>
                {copiedKey === k ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-on-surface-variant/60" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
