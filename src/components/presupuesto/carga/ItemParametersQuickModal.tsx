import React, { useState } from 'react';
import {
  X,
  Sliders,
  Plus,
  Minus,
  Check,
  ExternalLink,
  Globe,
  Pin,
  Sparkles
} from 'lucide-react';
import { ItemPresupuesto, ParametroItem } from '../../../core/types';
import { safeNum } from '../../../core/calculations';

interface ItemParametersQuickModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ItemPresupuesto;
  calculosVariables?: Record<string, number | string>;
  onUpdateParametros?: (parametros: ParametroItem[]) => void;
  onOpenFullBreakdown?: () => void;
}

export const ItemParametersQuickModal: React.FC<ItemParametersQuickModalProps> = ({
  isOpen,
  onClose,
  item,
  calculosVariables = {},
  onUpdateParametros,
  onOpenFullBreakdown
}) => {
  const [newParamId, setNewParamId] = useState('');
  const [newParamVal, setNewParamVal] = useState('1');
  const [newParamUnit, setNewParamUnit] = useState('u');
  const [isAddingNew, setIsAddingNew] = useState(false);

  if (!isOpen) return null;

  const parametros: ParametroItem[] = item.parametros || [];

  const handleUpdateValue = (paramId: string, deltaOrValue: number, isAbsolute = false) => {
    if (!onUpdateParametros) return;
    const updated = parametros.map((p) => {
      if (p.id !== paramId) return p;
      const currentVal = safeNum(p.valor);
      const nextVal = isAbsolute ? deltaOrValue : Math.max(0, currentVal + deltaOrValue);
      return {
        ...p,
        valor: Math.round(nextVal * 100) / 100
      };
    });
    onUpdateParametros(updated);
  };

  const handleToggleBoolean = (paramId: string) => {
    if (!onUpdateParametros) return;
    const updated = parametros.map((p) => {
      if (p.id !== paramId) return p;
      return {
        ...p,
        valor: p.valor === 1 ? 0 : 1
      };
    });
    onUpdateParametros(updated);
  };

  const handleAddNewParam = () => {
    const rawId = newParamId.trim().toLowerCase().replace(/\s+/g, '_');
    if (!rawId || !onUpdateParametros) return;
    const valNum = Number(newParamVal) || 1;
    const newParam: ParametroItem = {
      id: rawId,
      nombre: newParamId.trim(),
      unidad: newParamUnit.trim() || 'u',
      valor: valNum,
      origen: 'propio'
    };
    onUpdateParametros([...parametros, newParam]);
    setNewParamId('');
    setNewParamVal('1');
    setIsAddingNew(false);
  };

  const isBooleanParam = (p: ParametroItem): boolean => {
    return (
      p.unidad === 'bool' ||
      p.unidad === 'si/no' ||
      p.id.startsWith('es_') ||
      p.id.startsWith('tiene_') ||
      p.id === 'trifasica' ||
      p.id === 'activo'
    );
  };

  const globalVarEntries = Object.entries(calculosVariables);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-param-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-lg bg-surface border border-outline-variant/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-4 py-3 bg-surface-container-high border-b border-outline-variant/30">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <span className="p-1.5 rounded-lg bg-secondary/10 text-secondary shrink-0">
              <Sliders className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 id="quick-param-title" className="text-sm font-bold text-on-surface truncate">
                  Ajustar Parámetros
                </h3>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary-container/50 text-secondary font-mono">
                  📌 Partida
                </span>
              </div>
              <p className="text-xs text-on-surface-variant truncate font-medium">
                {item.descripcion}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo / Lista de Parámetros */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {parametros.length === 0 ? (
            <div className="py-6 px-4 text-center bg-surface-container-low rounded-xl border border-outline-variant/20">
              <Sparkles className="w-8 h-8 text-secondary/60 mx-auto mb-2" />
              <p className="text-xs font-semibold text-on-surface mb-1">
                Esta partida no tiene parámetros propios
              </p>
              <p className="text-[11px] text-on-surface-variant max-w-xs mx-auto mb-3">
                Los parámetros te permiten calibrar cantidades y consumos rápidamente (ej. bocas, metros, circuitos).
              </p>
              <button
                type="button"
                onClick={() => setIsAddingNew(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-secondary text-on-secondary rounded-lg shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agregar Primer Parámetro</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {parametros.map((p) => {
                const isBool = isBooleanParam(p);
                return (
                  <div
                    key={p.id}
                    className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/25 flex items-center justify-between gap-3 shadow-2xs hover:border-secondary/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-on-surface truncate">
                          {p.nombre || p.id}
                        </span>
                        <code className="text-[10px] font-mono px-1 py-0.2 rounded bg-surface-container text-on-surface-variant/80">
                          {p.id}
                        </code>
                      </div>
                      {p.formula && (
                        <p className="text-[10px] text-secondary font-mono truncate" title={p.formula}>
                          f(x) = {p.formula}
                        </p>
                      )}
                    </div>

                    {/* Controles de ajuste */}
                    <div className="shrink-0 flex items-center gap-1.5">
                      {isBool ? (
                        <button
                          type="button"
                          onClick={() => handleToggleBoolean(p.id)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer border ${
                            p.valor === 1
                              ? 'bg-secondary text-on-secondary border-secondary'
                              : 'bg-surface text-on-surface-variant border-outline-variant/40 hover:bg-surface-container'
                          }`}
                        >
                          {p.valor === 1 ? 'Sí' : 'No'}
                        </button>
                      ) : (
                        <div className="flex items-center bg-surface-container border border-outline-variant/40 rounded-lg overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateValue(p.id, -1)}
                            className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                            title="Disminuir"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            value={p.valor}
                            onChange={(e) => handleUpdateValue(p.id, safeNum(e.target.value), true)}
                            className="w-16 py-1 text-xs font-mono font-bold text-center bg-transparent text-on-surface focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateValue(p.id, 1)}
                            className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                            title="Aumentar"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          {p.unidad && (
                            <span className="px-2 text-[10px] font-mono text-on-surface-variant/80 border-l border-outline-variant/30 select-none">
                              {p.unidad}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Formulario para agregar parámetro rápido */}
          {isAddingNew && (
            <div className="p-3 bg-surface-container rounded-xl border border-secondary/40 space-y-2 animate-in fade-in duration-100">
              <p className="text-[11px] font-semibold text-secondary">Nuevo Parámetro Local:</p>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Nombre / variable (ej: bocas)"
                  value={newParamId}
                  onChange={(e) => setNewParamId(e.target.value)}
                  className="flex-1 px-2.5 py-1 text-xs bg-surface border border-outline-variant/40 rounded-lg text-on-surface focus:outline-none font-mono"
                />
                <input
                  type="number"
                  placeholder="Valor"
                  value={newParamVal}
                  onChange={(e) => setNewParamVal(e.target.value)}
                  className="w-20 px-2 py-1 text-xs font-mono text-center bg-surface border border-outline-variant/40 rounded-lg text-on-surface focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Unid."
                  value={newParamUnit}
                  onChange={(e) => setNewParamUnit(e.target.value)}
                  className="w-14 px-2 py-1 text-xs font-mono text-center bg-surface border border-outline-variant/40 rounded-lg text-on-surface focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-2.5 py-1 text-xs text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddNewParam}
                  className="px-3 py-1 text-xs font-semibold bg-secondary text-on-secondary rounded-lg shadow-xs cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </div>
          )}

          {/* Variables Globales de Contexto */}
          {globalVarEntries.length > 0 && (
            <div className="pt-2 border-t border-outline-variant/20">
              <div className="flex items-center gap-1.5 mb-2">
                <Globe className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-semibold text-on-surface-variant">
                  Variables Globales de la Obra (disponibles para fórmulas):
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {globalVarEntries.map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-container-high border border-outline-variant/30 text-[10px] font-mono text-on-surface"
                  >
                    <span className="text-primary font-bold">{k}:</span>
                    <span>{String(v)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pie de diálogo */}
        <div className="px-4 py-3 bg-surface-container-low border-t border-outline-variant/30 flex items-center justify-between gap-2">
          {onOpenFullBreakdown ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFullBreakdown();
              }}
              className="inline-flex items-center gap-1.5 text-xs text-secondary hover:underline cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver desglose completo de rubros</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {!isAddingNew && (
              <button
                type="button"
                onClick={() => setIsAddingNew(true)}
                className="px-2.5 py-1.5 text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
              >
                + Parámetro
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-bold bg-primary text-on-primary rounded-xl shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
