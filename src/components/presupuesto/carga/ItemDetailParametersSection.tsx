import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  X
} from 'lucide-react';
import { ParametroItem } from '../../../core/types';

interface ItemDetailParametersSectionProps {
  parametros?: ParametroItem[];
  erroresFormulas?: Record<string, string>;
  onUpdateParametros: (parametros: ParametroItem[]) => void;
}

export const ItemDetailParametersSection: React.FC<ItemDetailParametersSectionProps> = ({
  parametros = [],
  erroresFormulas = {},
  onUpdateParametros
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newParamId, setNewParamId] = useState('');
  const [newParamValue, setNewParamValue] = useState('');
  const [newParamUnidad, setNewParamUnidad] = useState('');

  const handleSaveNewParam = () => {
    const rawId = newParamId.trim().toLowerCase().replace(/\s+/g, '_');
    if (!rawId) return;

    if (rawId === 'cantidad') {
      alert("El nombre 'cantidad' es una palabra reservada del ítem y no puede usarse como parámetro auxiliar.");
      return;
    }

    const trimmedVal = newParamValue.trim();
    let numVal = 0;
    let formula: string | undefined = undefined;

    if (trimmedVal.startsWith('=')) {
      formula = trimmedVal;
    } else {
      const parsed = Number(trimmedVal.replace(',', '.'));
      numVal = isNaN(parsed) ? 0 : parsed;
    }

    const newParam: ParametroItem = {
      id: rawId,
      nombre: newParamId.trim(),
      unidad: newParamUnidad.trim() || undefined,
      valor: numVal,
      formula,
      origen: formula ? 'propio' : 'propio'
    };

    onUpdateParametros([...parametros, newParam]);
    setIsAdding(false);
    setNewParamId('');
    setNewParamValue('');
    setNewParamUnidad('');
  };

  const handleUpdateParamValue = (index: number, valStr: string) => {
    const trimmed = valStr.trim();
    const updated = [...parametros];
    const target = { ...updated[index] };

    if (trimmed.startsWith('=')) {
      target.formula = trimmed;
      target.origen = 'propio';
    } else {
      const parsed = Number(trimmed.replace(',', '.'));
      target.valor = isNaN(parsed) ? 0 : parsed;
      target.formula = undefined;
      target.origen = 'propio';
    }

    updated[index] = target;
    onUpdateParametros(updated);
  };

  const handleRemoveParam = (index: number) => {
    const updated = parametros.filter((_, i) => i !== index);
    onUpdateParametros(updated);
  };

  return (
    <div className="p-3.5 border-b border-outline-variant/30 select-none">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface uppercase tracking-wider">
          <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
          <span>Parámetros</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-container text-on-surface-variant font-mono">
            {parametros.length}
          </span>
        </div>

        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary-container/40 rounded-lg transition-colors cursor-pointer"
            title="Agregar nuevo parámetro al ítem"
          >
            <Plus className="w-3 h-3" />
            <span>Agregar</span>
          </button>
        )}
      </div>

      {/* Formulario rápido para nuevo parámetro */}
      {isAdding && (
        <div className="p-2 mb-2 bg-surface-container rounded-lg border border-primary/40 space-y-2">
          <div className="text-[11px] font-semibold text-primary">Nuevo Parámetro Auxiliar</div>
          <div className="grid grid-cols-3 gap-1.5">
            <input
              type="text"
              placeholder="Nombre (ej: modulos)"
              value={newParamId}
              onChange={(e) => setNewParamId(e.target.value)}
              className="col-span-2 px-2 py-1 text-xs bg-surface border border-outline-variant/40 rounded text-on-surface focus:outline-none focus:border-primary"
            />
            <input
              type="text"
              placeholder="Unidad (opc)"
              value={newParamUnidad}
              onChange={(e) => setNewParamUnidad(e.target.value)}
              className="px-2 py-1 text-xs bg-surface border border-outline-variant/40 rounded text-on-surface focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Valor o fórmula =..."
              value={newParamValue}
              onChange={(e) => setNewParamValue(e.target.value)}
              className="flex-1 px-2 py-1 text-xs font-mono bg-surface border border-outline-variant/40 rounded text-on-surface focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={handleSaveNewParam}
              className="p-1.5 bg-primary text-on-primary rounded hover:opacity-90 transition-opacity cursor-pointer"
              title="Guardar parámetro"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="p-1.5 text-on-surface-variant hover:bg-surface-container-high rounded cursor-pointer"
              title="Cancelar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Lista de parámetros existentes */}
      {parametros.length === 0 && !isAdding ? (
        <p className="text-xs text-on-surface-variant/70 italic py-1">
          Sin parámetros definidos. Podés agregar variables auxiliares con "+ Agregar".
        </p>
      ) : (
        <div className="space-y-1.5">
          {parametros.map((param, idx) => {
            const errorMsg = erroresFormulas[`param_${param.id}`];
            const displayVal = param.formula || String(param.valor);
            const originBadge = param.formula
              ? '= fórmula'
              : param.origen === 'tarea_tipo'
              ? 'defecto'
              : 'manual';

            return (
              <div
                key={param.id}
                className="p-1.5 bg-surface-container-lowest rounded border border-outline-variant/20 hover:border-outline-variant/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-medium text-on-surface truncate">
                      {param.nombre || param.id}
                    </span>
                    {param.unidad && (
                      <span className="text-[10px] text-on-surface-variant">({param.unidad})</span>
                    )}
                    <span className="text-[9px] px-1 py-0.2 rounded bg-surface-container-high text-on-surface-variant font-mono">
                      {originBadge}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveParam(idx)}
                    className="p-1 text-on-surface-variant hover:text-error rounded hover:bg-error-container/20 transition-colors cursor-pointer"
                    title="Eliminar parámetro"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    defaultValue={displayVal}
                    onBlur={(e) => handleUpdateParamValue(idx, e.target.value)}
                    className="w-full px-2 py-0.5 text-xs font-mono bg-surface border border-outline-variant/30 rounded text-on-surface focus:outline-none focus:border-primary"
                    placeholder="Valor o =fórmula"
                  />
                  {param.formula && (
                    <span className="text-xs font-mono font-semibold text-secondary shrink-0">
                      = {param.valor}
                    </span>
                  )}
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-error font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
