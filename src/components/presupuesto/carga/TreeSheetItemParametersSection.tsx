import React, { useState, useMemo } from 'react';
import {
  Sliders,
  Plus,
  Trash2,
  Copy,
  Check,
  Variable as VariableIcon,
  HelpCircle,
  Calculator,
  AlertCircle
} from 'lucide-react';
import { ParametroItem } from '../../../core/types';
import { evaluateMathExpression } from '../../../core/mathEvaluator';

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
  const [kind, setKind] = useState<'parametro' | 'variable'>('parametro');
  const [newId, setNewId] = useState('');
  const [newDescripcion, setNewDescripcion] = useState('');
  const [newValor, setNewValor] = useState('');
  const [newUnidad, setNewUnidad] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Ámbito de cálculo actual para previsualizar fórmulas en vivo
  const currentScope = useMemo(() => {
    const scope: Record<string, number> = {};
    if (calculosVariables) {
      for (const [k, v] of Object.entries(calculosVariables)) {
        scope[k] = typeof v === 'number' ? v : Number(v) || 0;
      }
    }
    for (const p of parametros) {
      scope[p.id] = p.valor;
    }
    return scope;
  }, [calculosVariables, parametros]);

  // Previsualización evaluada en tiempo real de la fórmula ingresada
  const liveResult = useMemo(() => {
    const trimmed = newValor.trim();
    if (!trimmed) return null;
    const isFormula = trimmed.startsWith('=');
    if (!isFormula && kind !== 'variable') return null;

    const expr = isFormula ? trimmed.substring(1) : trimmed;
    try {
      const res = evaluateMathExpression(expr, currentScope);
      return res;
    } catch {
      return null;
    }
  }, [newValor, kind, currentScope]);

  const handleAdd = () => {
    const rawId = newId.trim().toLowerCase().replace(/\s+/g, '_');
    if (!rawId) return;

    if (rawId === 'cantidad') {
      alert("El nombre 'cantidad' es una palabra reservada del ítem y no puede usarse como parámetro o variable auxiliar.");
      return;
    }

    const valStr = newValor.trim();
    const isFormula = valStr.startsWith('=') || kind === 'variable';
    let valor = 0;
    let formula: string | undefined = undefined;

    if (isFormula) {
      formula = valStr.startsWith('=') ? valStr : `=${valStr}`;
      const expr = formula.substring(1);
      const evalRes = evaluateMathExpression(expr, currentScope);
      valor = evalRes && evalRes.isValid && typeof evalRes.value === 'number' && !isNaN(evalRes.value)
        ? evalRes.value
        : 0;
    } else {
      const num = Number(valStr.replace(',', '.'));
      valor = isNaN(num) ? 0 : num;
    }

    const existingIdx = parametros.findIndex((p) => p.id === rawId);
    let updated: ParametroItem[];

    const itemParam: ParametroItem = {
      id: rawId,
      nombre: newDescripcion.trim() || rawId,
      descripcion: newDescripcion.trim() || undefined,
      tipo: kind,
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
    setNewDescripcion('');
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

  // Separación nítida entre Parámetros de Entrada y Variables de Cálculo
  const inputParametros = parametros.filter((p) => p.tipo === 'parametro' || (!p.tipo && !p.formula));
  const calcVariables = parametros.filter((p) => p.tipo === 'variable' || Boolean(p.formula));

  return (
    <div className="space-y-3 p-1">
      {/* Banner Explicativo de Parámetros vs Variables */}
      <div className="p-3 bg-surface-container rounded-2xl border border-outline-variant/30 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-on-surface">
            <Sliders className="w-3.5 h-3.5 text-primary" />
            <span>📌 Parámetros y Variables de este Ítem</span>
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
          Los <strong>Parámetros</strong> son datos de entrada que el diálogo interactivo (⚙️) le solicitará al cotizar.
          Las <strong>Variables</strong> son cálculos matemáticos internos evaluados por fórmula para computar insumos y mano de obra.
        </p>

        {showHelp && (
          <div className="mt-2 pt-2 border-t border-outline-variant/20 text-[11px] space-y-1 font-mono text-on-surface">
            <p className="font-sans font-bold text-primary">Ejemplos de fórmulas en variables y consumos:</p>
            <p className="bg-surface-container-high p-1 rounded"><code>=4 + circuitos * 2</code> (cálculo de módulos DIN necesarios)</p>
            <p className="bg-surface-container-high p-1 rounded"><code>=largo * 1.15</code> (longitud con 15% de desperdicio)</p>
            <p className="bg-surface-container-high p-1 rounded"><code>=si(altura &gt; 3, horas * 1.25, horas)</code> (recargo por altura)</p>
          </div>
        )}
      </div>

      {/* Formulario con Redistribución Ergonómica de Campos */}
      <div className="p-3 bg-surface rounded-2xl border border-outline-variant/30 space-y-2.5 shadow-2xs">
        {/* Fila 0: Selector de Modalidad (Parámetro vs Variable) */}
        <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-outline-variant/20">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
            Definir en este ítem:
          </span>
          <div className="flex items-center p-0.5 bg-surface-container-high rounded-xl">
            <button
              type="button"
              onClick={() => setKind('parametro')}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                kind === 'parametro'
                  ? 'bg-surface text-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Sliders className="w-3 h-3" />
              <span>⚙️ Parámetro (Input usuario)</span>
            </button>
            <button
              type="button"
              onClick={() => setKind('variable')}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                kind === 'variable'
                  ? 'bg-surface text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Calculator className="w-3 h-3" />
              <span>🧮 Variable (Cálculo interno)</span>
            </button>
          </div>
        </div>

        {/* Fila 1: Identificador (compacto), Unidad (compacto) y Descripción (amplio) */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <div className="w-full sm:w-36 shrink-0">
            <input
              type="text"
              placeholder="Identificador (ej: bocas)"
              value={newId}
              onChange={(e) => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              className="w-full px-2.5 py-1.5 text-xs bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-primary font-mono font-bold focus:outline-none focus:border-primary"
            />
          </div>

          <div className="w-24 shrink-0">
            <input
              type="text"
              placeholder="Unidad (m, u)"
              value={newUnidad}
              onChange={(e) => setNewUnidad(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-on-surface font-mono focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex-1 min-w-[180px]">
            <input
              type="text"
              placeholder="Descripción / Etiqueta humana (ej: Bocas en living, Módulos DIN)..."
              value={newDescripcion}
              onChange={(e) => setNewDescripcion(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Fila 2: Valor o Fórmula Matemática (generoso) + Previsualización en vivo + Botón Guardar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative flex items-center">
            <input
              type="text"
              placeholder={
                kind === 'variable'
                  ? 'Fórmula matemática =... (ej: =4 + circuitos * 2, =largo * 1.15)'
                  : 'Valor o =fórmula inicial (ej: 10, =superficie * 2)'
              }
              value={newValor}
              onChange={(e) => setNewValor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className={`w-full px-2.5 py-1.5 text-xs bg-surface-container-lowest border rounded-xl font-mono focus:outline-none ${
                kind === 'variable'
                  ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 focus:border-emerald-500'
                  : 'border-outline-variant/30 text-on-surface focus:border-primary'
              }`}
            />
            {liveResult && (
              <span
                className={`absolute right-2 text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg ${
                  liveResult.isValid
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-error/15 text-error'
                }`}
                title={liveResult.isValid ? 'Resultado evaluado en tiempo real' : liveResult.error || 'Error de sintaxis'}
              >
                {liveResult.isValid ? `≈ ${liveResult.value}` : '⚠️ Error sintaxis'}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-1 px-4 py-1.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer shrink-0 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Guardar</span>
          </button>
        </div>
      </div>

      {/* Listado Diferenciado de Parámetros y Variables */}
      <div className="space-y-3">
        {parametros.length === 0 ? (
          <p className="text-xs text-on-surface-variant/60 italic py-2 text-center bg-surface rounded-xl border border-outline-variant/20">
            Este ítem no tiene parámetros ni variables locales configuradas.
          </p>
        ) : (
          <>
            {/* 1. Bloque de Parámetros de Entrada */}
            {inputParametros.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-1 text-[11px] font-bold text-primary uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Sliders className="w-3 h-3" />
                    <span>Parámetros de Entrada ({inputParametros.length})</span>
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-normal normal-case">
                    Se solicitan al cotizar en el diálogo rápido (⚙️)
                  </span>
                </div>

                <div className="divide-y divide-outline-variant/15 border border-outline-variant/20 rounded-xl overflow-hidden bg-surface shadow-2xs">
                  {inputParametros.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 flex items-center justify-between gap-3 text-xs hover:bg-surface-container-low transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-mono font-bold text-primary shrink-0">${p.id}</span>
                        {p.unidad && (
                          <span className="text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.2 rounded font-mono shrink-0">
                            {p.unidad}
                          </span>
                        )}
                        <span className="text-on-surface text-xs truncate">
                          {p.descripcion || p.nombre || p.id}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 font-mono shrink-0">
                        <span className="font-bold text-on-surface px-2 py-0.5 rounded bg-surface-container">
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
              </div>
            )}

            {/* 2. Bloque de Variables de Cálculo Interno */}
            {calcVariables.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Calculator className="w-3 h-3" />
                    <span>Variables de Cálculo Interno ({calcVariables.length})</span>
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-normal normal-case">
                    Fórmulas automáticas que no se piden al usuario
                  </span>
                </div>

                <div className="divide-y divide-outline-variant/15 border border-emerald-500/25 rounded-xl overflow-hidden bg-surface shadow-2xs">
                  {calcVariables.map((v) => {
                    const cleanFormula = v.formula?.startsWith('=') ? v.formula.substring(1) : v.formula || '';
                    const evalRes = evaluateMathExpression(cleanFormula, currentScope);
                    const valEvaluado = evalRes && evalRes.isValid && typeof evalRes.value === 'number'
                      ? evalRes.value
                      : v.valor;

                    return (
                      <div
                        key={v.id}
                        className="p-2.5 flex items-center justify-between gap-3 text-xs hover:bg-surface-container-low transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                            ${v.id}
                          </span>
                          {v.unidad && (
                            <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 bg-emerald-500/10 px-1.5 py-0.2 rounded font-mono shrink-0">
                              {v.unidad}
                            </span>
                          )}
                          <span className="text-on-surface text-xs truncate">
                            {v.descripcion || v.nombre || v.id}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 font-mono shrink-0">
                          <span className="text-on-surface-variant font-medium text-[11px] max-w-[200px] truncate" title={v.formula}>
                            {v.formula}
                          </span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/10">
                            = {valEvaluado}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemove(v.id)}
                            className="p-1 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded transition-colors cursor-pointer"
                            title="Eliminar variable"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Variables Globales Disponibles en la Obra */}
      {Object.keys(calculosVariables).length > 0 && (
        <div className="pt-2 border-t border-outline-variant/20 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-on-surface font-semibold">
            <VariableIcon className="w-3.5 h-3.5 text-secondary" />
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
