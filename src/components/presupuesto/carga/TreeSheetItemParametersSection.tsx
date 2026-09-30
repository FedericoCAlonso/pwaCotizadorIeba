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
import { ParametroItem } from '../../../core/types';

interface TreeSheetItemParametersSectionProps {
  parametros?: ParametroItem[];
  calculosVariables?: Record<string, number | string>;
  onUpdateParametros: (parametros: ParametroItem[]) => void;
}

export const TreeSheetItemParametersSection: React.FC<TreeSheetItemParametersSectionProps> = ({
  parametros = [],
  calculosVariables = {},
  onUpdateParametros
}) => {
  const [newId, setNewId] = useState('');
  const [newValor, setNewValor] = useState('');
  const [newUnidad, setNewUnidad] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const handleAdd = () => {
    const rawId = newId.trim().toLowerCase().replace(/\s+/g, '_');
    if (!rawId) return;

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
    onUpdateParametros(parametros.filter((p) => p.id !== id));
  };

  const handleCopyVariable = (key: string) => {
    navigator.clipboard?.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="space-y-3 p-1">
      {/* Banner de Ámbito Local vs Global */}
      <div className="p-2.5 bg-surface-container rounded-xl border border-outline-variant/30 text-xs space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-on-surface">
            <Sliders className="w-3.5 h-3.5 text-primary" />
            <span>📌 Parámetros Locales de este Ítem</span>
          </div>
          <button
            type="button"
            onClick={() => setShowHelp((p) => !p)}
            className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer font-semibold"
          >
            <HelpCircle className="w-3 h-3" />
            <span>{showHelp ? 'Ocultar' : '¿Cómo se usan?'}</span>
          </button>
        </div>

        <p className="text-[11px] text-on-surface-variant">
          Los parámetros definidos aquí pertenecen exclusivamente a este ítem y tienen máxima prioridad sobre los parámetros de rubro o globales.
        </p>

        {showHelp && (
          <div className="mt-2 pt-2 border-t border-outline-variant/20 text-[11px] space-y-1 font-mono text-on-surface">
            <p className="font-sans font-bold text-primary">Uso en fórmulas de materiales y mano de obra:</p>
            <p className="bg-surface-container-high p-1 rounded"><code>=largo * 1.15</code> (computa longitud local con desperdicio)</p>
            <p className="bg-surface-container-high p-1 rounded"><code>=si(altura_techo &gt; 3, horas_base * 1.3, horas_base)</code> (decisión condicional)</p>
            <p className="bg-surface-container-high p-1 rounded"><code>=si(trifasica == 1, 4, 2) * largo</code> (combina global con local)</p>
          </div>
        )}
      </div>

      {/* Formulario para agregar parámetro local */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-surface rounded-xl border border-outline-variant/30">
        <input
          type="text"
          placeholder="Identificador (ej: largo, bocas)"
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          className="flex-1 min-w-[120px] px-2.5 py-1 text-xs bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none font-mono"
        />
        <input
          type="text"
          placeholder="Valor o =fórmula"
          value={newValor}
          onChange={(e) => setNewValor(e.target.value)}
          className="w-28 px-2.5 py-1 text-xs bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none font-mono"
        />
        <input
          type="text"
          placeholder="Unidad (m, u)"
          value={newUnidad}
          onChange={(e) => setNewUnidad(e.target.value)}
          className="w-20 px-2.5 py-1 text-xs bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shrink-0"
        >
          <Plus className="w-3 h-3" />
          <span>Guardar</span>
        </button>
      </div>

      {/* Listado de parámetros locales */}
      <div className="space-y-1">
        {parametros.length === 0 ? (
          <p className="text-xs text-on-surface-variant/60 italic py-1 text-center">
            Este ítem no tiene parámetros locales configurados.
          </p>
        ) : (
          <div className="divide-y divide-outline-variant/15 border border-outline-variant/20 rounded-xl overflow-hidden bg-surface">
            {parametros.map((p) => (
              <div
                key={p.id}
                className="p-2 flex items-center justify-between gap-2 text-xs hover:bg-surface-container-low transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-primary">{p.id}</span>
                  {p.unidad && (
                    <span className="text-[10px] text-on-surface-variant bg-surface-container px-1 rounded">
                      {p.unidad}
                    </span>
                  )}
                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-secondary/10 text-secondary font-mono">
                    📌 Local
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono">
                  <span className="font-bold text-on-surface">
                    {p.formula || p.valor}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(p.id)}
                    className="p-1 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded transition-colors cursor-pointer"
                    title="Eliminar parámetro"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Variables Globales Disponibles */}
      {Object.keys(calculosVariables).length > 0 && (
        <div className="pt-2 border-t border-outline-variant/20 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-on-surface font-semibold">
            <Variable className="w-3.5 h-3.5 text-secondary" />
            <span>Variables Globales Disponibles (Scope: Toda la obra):</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {Object.entries(calculosVariables).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => handleCopyVariable(k)}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs bg-surface-container border border-outline-variant/30 hover:border-primary text-on-surface transition-all cursor-pointer group"
                title={`Clic para copiar '${k}' y pegar en fórmulas de este ítem`}
              >
                <span className="font-mono font-semibold text-primary">{k}</span>
                <span className="font-mono text-[11px] text-on-surface-variant">={String(v)}</span>
                {copiedKey === k ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3 text-on-surface-variant opacity-40 group-hover:opacity-100" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
