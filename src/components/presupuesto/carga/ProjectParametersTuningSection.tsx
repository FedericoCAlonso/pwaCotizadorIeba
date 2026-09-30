import React, { useState } from 'react';
import {
  Globe,
  Pin,
  Sliders,
  Plus,
  Minus,
  Trash2,
  Sparkles,
  HelpCircle,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { ItemPresupuesto, ParametroItem, CapituloPresupuesto } from '../../../core/types';
import { formatARS, safeNum } from '../../../core/calculations';

interface ProjectParametersTuningSectionProps {
  calculosVariables: Record<string, number | string>;
  onUpdateCalculosVariables?: (vars: Record<string, number | string>) => void;
  items?: ItemPresupuesto[];
  onUpdateItemParametros?: (itemId: string, parametros: ParametroItem[]) => void;
  capitulos?: CapituloPresupuesto[];
  costoDirectoTotal?: number;
  precioFinalGlobal?: number;
}

const PRESET_VARS = [
  { name: 'superficie', val: 120, label: 'Superficie (120 m²)' },
  { name: 'altura_techo', val: 3.5, label: 'Altura Techo (3.5 m)' },
  { name: 'trifasica', val: 1, label: 'Trifásica (1=Sí)' },
  { name: 'distancia_tablero', val: 25, label: 'Dist. Tablero (25 m)' },
  { name: 'dolar', val: 1450, label: 'Dólar USD ($1450)' },
];

export const ProjectParametersTuningSection: React.FC<ProjectParametersTuningSectionProps> = ({
  calculosVariables = {},
  onUpdateCalculosVariables,
  items = [],
  onUpdateItemParametros,
  costoDirectoTotal,
  precioFinalGlobal
}) => {
  const [activeLevel, setActiveLevel] = useState<'global' | 'items'>('global');
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [showFormulaGuide, setShowFormulaGuide] = useState(false);

  // Filtrar partidas que tienen parámetros configurados
  const itemsWithParams = items.filter((it) => it.parametros && it.parametros.length > 0);

  // Manejadores para variables globales
  const handleAddGlobalVar = (name?: string, value?: string | number) => {
    const raw = (name || newVarName).trim().toLowerCase().replace(/\s+/g, '_');
    if (!raw || !onUpdateCalculosVariables) return;
    const val = String(value !== undefined ? value : newVarValue).trim();
    const num = Number(val);
    const finalVal = isNaN(num) || val.startsWith('=') ? val : num;

    onUpdateCalculosVariables({
      ...calculosVariables,
      [raw]: finalVal
    });

    if (!name) {
      setNewVarName('');
      setNewVarValue('');
    }
  };

  const handleUpdateGlobalVarDelta = (key: string, delta: number) => {
    if (!onUpdateCalculosVariables) return;
    const current = safeNum(calculosVariables[key]);
    const next = Math.max(0, current + delta);
    onUpdateCalculosVariables({
      ...calculosVariables,
      [key]: Math.round(next * 100) / 100
    });
  };

  const handleToggleGlobalBool = (key: string) => {
    if (!onUpdateCalculosVariables) return;
    const current = safeNum(calculosVariables[key]);
    onUpdateCalculosVariables({
      ...calculosVariables,
      [key]: current === 1 ? 0 : 1
    });
  };

  const handleRemoveGlobalVar = (key: string) => {
    if (!onUpdateCalculosVariables) return;
    const copy = { ...calculosVariables };
    delete copy[key];
    onUpdateCalculosVariables(copy);
  };

  // Manejadores para parámetros de partida
  const handleUpdateItemParamValue = (itemId: string, paramId: string, deltaOrValue: number, isAbsolute = false) => {
    if (!onUpdateItemParametros) return;
    const targetItem = items.find((it) => it.id === itemId);
    if (!targetItem || !targetItem.parametros) return;

    const updated = targetItem.parametros.map((p) => {
      if (p.id !== paramId) return p;
      const cur = safeNum(p.valor);
      const next = isAbsolute ? deltaOrValue : Math.max(0, cur + deltaOrValue);
      return { ...p, valor: Math.round(next * 100) / 100 };
    });

    onUpdateItemParametros(itemId, updated);
  };

  const handleToggleItemParamBool = (itemId: string, paramId: string) => {
    if (!onUpdateItemParametros) return;
    const targetItem = items.find((it) => it.id === itemId);
    if (!targetItem || !targetItem.parametros) return;

    const updated = targetItem.parametros.map((p) => {
      if (p.id !== paramId) return p;
      return { ...p, valor: p.valor === 1 ? 0 : 1 };
    });

    onUpdateItemParametros(itemId, updated);
  };

  const isBoolName = (name: string): boolean => {
    const lower = name.toLowerCase();
    return lower.startsWith('es_') || lower.startsWith('tiene_') || lower === 'trifasica' || lower === 'activo';
  };

  const globalVarEntries = Object.entries(calculosVariables);

  return (
    <div className="space-y-4">
      {/* Sub-Navegación Multinivel */}
      <div className="flex items-center justify-between gap-2 border-b border-outline-variant/20 pb-2">
        <div className="flex items-center gap-1.5 p-1 bg-surface-container rounded-xl">
          <button
            type="button"
            onClick={() => setActiveLevel('global')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeLevel === 'global'
                ? 'bg-surface text-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>🌐 Globales Obra ({globalVarEntries.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveLevel('items')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeLevel === 'items'
                ? 'bg-surface text-secondary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
            <span>📌 Por Ítem ({itemsWithParams.length})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowFormulaGuide(!showFormulaGuide)}
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Guía de Fórmulas</span>
        </button>
      </div>

      {/* Guía colapsable */}
      {showFormulaGuide && (
        <div className="p-3 bg-primary-container/20 border border-primary/20 rounded-xl text-xs space-y-1.5 text-on-surface animate-in fade-in duration-100">
          <p className="font-semibold text-primary">Reglas de alcance y uso de parámetros:</p>
          <ul className="list-disc list-inside space-y-0.5 text-on-surface-variant text-[11px]">
            <li><strong>🌐 Ámbito Global</strong>: Accesible desde cualquier fórmula (`=superficie * 1.15`).</li>
            <li><strong>📌 Ámbito Local</strong>: Específico de cada ítem (`=bocas * 2`). Tiene prioridad sobre una global si se llaman igual.</li>
            <li><strong>Condicionales</strong>: <code>=si(altura &gt; 3, 1.25, 1.0)</code> o <code>=trifasica ? 4 : 2</code>.</li>
          </ul>
        </div>
      )}

      {/* ─── VISTA 1: Parámetros Globales ─── */}
      {activeLevel === 'global' && (
        <div className="space-y-3">
          {/* Presets Rápidos */}
          <div>
            <span className="text-[11px] font-semibold text-on-surface-variant mb-1.5 block">
              Variables frecuentes de obra (clic para insertar):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_VARS.map((p) => {
                const alreadyDefined = calculosVariables[p.name] !== undefined;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleAddGlobalVar(p.name, p.val)}
                    disabled={alreadyDefined}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer border ${
                      alreadyDefined
                        ? 'bg-surface-container-high text-on-surface-variant/50 border-outline-variant/20 cursor-default'
                        : 'bg-surface-container hover:bg-primary-container hover:text-on-primary-container border-outline-variant/30 text-on-surface'
                    }`}
                  >
                    <span>+</span>
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Formulario para agregar parámetro */}
          <div className="flex items-center gap-2 p-2 bg-surface-container rounded-xl border border-outline-variant/30">
            <input
              type="text"
              placeholder="Nombre parámetro (ej: superficie, altura)"
              value={newVarName}
              onChange={(e) => setNewVarName(e.target.value)}
              className="flex-1 px-2.5 py-1 text-xs bg-surface border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none font-mono"
            />
            <input
              type="text"
              placeholder="Valor inicial"
              value={newVarValue}
              onChange={(e) => setNewVarValue(e.target.value)}
              className="w-28 px-2.5 py-1 text-xs font-mono bg-surface border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none text-center"
            />
            <button
              type="button"
              onClick={() => handleAddGlobalVar()}
              className="p-1.5 bg-primary text-on-primary rounded-lg hover:opacity-90 transition-opacity cursor-pointer shrink-0"
              title="Guardar parámetro"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Lista interactiva de variables globales */}
          <div className="space-y-1.5">
            {globalVarEntries.length === 0 ? (
              <p className="text-xs text-on-surface-variant/70 italic text-center py-4">
                Sin parámetros globales definidos. Insertá una variable arriba o utilizá los accesos rápidos.
              </p>
            ) : (
              globalVarEntries.map(([k, v]) => {
                const isBool = isBoolName(k);
                const numVal = safeNum(v);
                return (
                  <div
                    key={k}
                    className="flex items-center justify-between p-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/20 text-xs shadow-2xs hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-primary truncate">{k}</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-primary-container/40 text-primary font-mono shrink-0">
                        🌐 Global
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isBool ? (
                        <button
                          type="button"
                          onClick={() => handleToggleGlobalBool(k)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer border ${
                            numVal === 1
                              ? 'bg-primary text-on-primary border-primary'
                              : 'bg-surface text-on-surface-variant border-outline-variant/40 hover:bg-surface-container'
                          }`}
                        >
                          {numVal === 1 ? 'Sí' : 'No'}
                        </button>
                      ) : (
                        <div className="flex items-center bg-surface-container border border-outline-variant/40 rounded-lg overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateGlobalVarDelta(k, -1)}
                            className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="text"
                            value={String(v)}
                            onChange={(e) => {
                              const val = e.target.value;
                              const parsed = Number(val);
                              onUpdateCalculosVariables?.({
                                ...calculosVariables,
                                [k]: isNaN(parsed) || val.startsWith('=') ? val : parsed
                              });
                            }}
                            className="w-16 py-0.5 text-xs font-mono font-bold text-center bg-transparent text-on-surface focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateGlobalVarDelta(k, 1)}
                            className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveGlobalVar(k)}
                        className="p-1 text-on-surface-variant hover:text-error rounded hover:bg-error-container/20 cursor-pointer"
                        title="Eliminar parámetro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ─── VISTA 2: Parámetros por Partida ─── */}
      {activeLevel === 'items' && (
        <div className="space-y-3">
          {itemsWithParams.length === 0 ? (
            <div className="py-8 px-4 text-center bg-surface-container-low rounded-xl border border-outline-variant/20">
              <Sparkles className="w-8 h-8 text-secondary/50 mx-auto mb-2" />
              <p className="text-xs font-semibold text-on-surface mb-1">
                No hay ítems con parámetros configurados
              </p>
              <p className="text-[11px] text-on-surface-variant max-w-sm mx-auto">
                Podés definir parámetros en cualquier ítem desde la planilla tocando el botón de parámetros (Sliders) en su fila.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {itemsWithParams.map((it) => (
                <div
                  key={it.id}
                  className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/25 shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-outline-variant/15 pb-1.5">
                    <span className="text-xs font-bold text-on-surface truncate">
                      {it.descripcion}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary-container/50 text-secondary font-mono shrink-0">
                      {it.parametros?.length} {it.parametros?.length === 1 ? 'parámetro' : 'parámetros'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {(it.parametros || []).map((p) => {
                      const isBool = p.unidad === 'bool' || isBoolName(p.id);
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 py-1 px-2 bg-surface-container/50 rounded-lg text-xs"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-on-surface truncate">
                              {p.nombre || p.id}:
                            </span>
                            {p.formula && (
                              <span className="text-[10px] text-secondary font-mono truncate" title={p.formula}>
                                = {p.formula}
                              </span>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5">
                            {isBool ? (
                              <button
                                type="button"
                                onClick={() => handleToggleItemParamBool(it.id, p.id)}
                                className={`px-2.5 py-0.5 text-xs font-bold rounded transition-colors cursor-pointer border ${
                                  p.valor === 1
                                    ? 'bg-secondary text-on-secondary border-secondary'
                                    : 'bg-surface text-on-surface-variant border-outline-variant/40 hover:bg-surface-container'
                                }`}
                              >
                                {p.valor === 1 ? 'Sí' : 'No'}
                              </button>
                            ) : (
                              <div className="flex items-center bg-surface border border-outline-variant/40 rounded-lg overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemParamValue(it.id, p.id, -1)}
                                  className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  value={p.valor}
                                  onChange={(e) => handleUpdateItemParamValue(it.id, p.id, safeNum(e.target.value), true)}
                                  className="w-14 py-0.5 text-xs font-mono font-bold text-center bg-transparent text-on-surface focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemParamValue(it.id, p.id, 1)}
                                  className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                {p.unidad && (
                                  <span className="px-1.5 text-[10px] font-mono text-on-surface-variant/80 border-l border-outline-variant/20 select-none">
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
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resumen de impacto económico en vivo */}
      {(costoDirectoTotal !== undefined || precioFinalGlobal !== undefined) && (
        <div className="flex items-center justify-between p-2.5 bg-surface-container-high rounded-xl border border-outline-variant/30 text-xs">
          <div className="flex items-center gap-1.5 text-on-surface-variant">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium">Impacto en la Cotización:</span>
          </div>
          <div className="flex items-center gap-3 font-mono">
            {costoDirectoTotal !== undefined && (
              <span className="text-on-surface">
                Costo Directo: <strong>{formatARS(costoDirectoTotal)}</strong>
              </span>
            )}
            {precioFinalGlobal !== undefined && (
              <span className="text-primary font-bold">
                Precio Final: {formatARS(precioFinalGlobal)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
