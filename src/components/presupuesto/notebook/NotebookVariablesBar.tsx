import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  ChevronDown,
  ChevronUp,
  Hash,
  ListPlus,
  Pencil,
  Plus,
  Sigma,
  Trash2,
  Wrench,
  X
} from 'lucide-react';
import { evaluateUnitExpression, UnitScopedValue } from '../../../core/unitAlgebra';
import { VariableCotizacion } from '../../../core/types';
import { useEscapeKey } from '../../../hooks/useEscapeKey';

export interface NotebookVariablesBarProps {
  variables: VariableCotizacion[];
  scopeVariables: Record<string, number>;
  onInsertText: (snippet: string, cursorOffset?: number) => void;
  onUpsertVariable: (id: string, expresion: string, unidad?: string, previousId?: string) => boolean;
  onDeleteVariable: (id: string) => boolean;
  onInsertQuickBlock: (kind: 'tt' | 'tarea' | 'item' | 'capitulo') => void;
}

const QUICK_UNITS = ['', 'm', 'm²', 'u', 'hs', 'gl'] as const;

const MATH_FUNCTION_SNIPPETS: Array<{
  label: string;
  snippet: string;
  cursorOffset: number;
  desc: string;
}> = [
  { label: 'ceil(x)', snippet: 'ceil()', cursorOffset: 5, desc: 'Redondea hacia arriba' },
  { label: 'floor(x)', snippet: 'floor()', cursorOffset: 6, desc: 'Redondea hacia abajo' },
  { label: 'round(x, 2)', snippet: 'round(, 2)', cursorOffset: 6, desc: 'Redondea decimales' },
  { label: 'min(a, b)', snippet: 'min(, )', cursorOffset: 4, desc: 'Mínimo entre valores' },
  { label: 'max(a, b)', snippet: 'max(, )', cursorOffset: 4, desc: 'Máximo entre valores' },
  { label: 'si(cond, a, b)', snippet: 'si(, , )', cursorOffset: 3, desc: 'Condicional tipo Excel' },
  { label: 'cond ? a : b', snippet: ' ?  : ', cursorOffset: 3, desc: 'Operador ternario' }
];

function formatEvalNumber(val: number): string {
  const rounded = Math.round(val * 100) / 100;
  return Number.isInteger(rounded)
    ? rounded.toLocaleString('es-AR')
    : rounded.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Cinta compacta sobre el Notebook para ver, crear, editar e insertar variables,
 * funciones matemáticas y bloques rápidos sin memorizar sintaxis.
 */
export const NotebookVariablesBar: React.FC<NotebookVariablesBarProps> = ({
  variables,
  scopeVariables,
  onInsertText,
  onUpsertVariable,
  onDeleteVariable,
  onInsertQuickBlock
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showVarPopover, setShowVarPopover] = useState(false);
  const [showFnPopover, setShowFnPopover] = useState(false);
  const [editingOriginalId, setEditingOriginalId] = useState<string | undefined>(undefined);
  const [varName, setVarName] = useState('');
  const [varExpr, setVarExpr] = useState('');
  const [varUnit, setVarUnit] = useState('');

  useEscapeKey(showVarPopover, () => setShowVarPopover(false), { pushHistory: false });
  useEscapeKey(showFnPopover, () => setShowFnPopover(false), { pushHistory: false });

  const openNewVariable = () => {
    setShowFnPopover(false);
    setEditingOriginalId(undefined);
    setVarName('');
    setVarExpr('');
    setVarUnit('');
    setShowVarPopover(true);
  };

  const openEditVariable = (v: VariableCotizacion) => {
    setShowFnPopover(false);
    setEditingOriginalId(v.id);
    setVarName(v.id);
    setVarExpr(v.expresion);
    setVarUnit(v.unidad || '');
    setShowVarPopover(true);
  };

  const previewEval = useMemo(() => {
    const trimmed = varExpr.trim();
    if (!trimmed) return null;
    const scopeExcludingSelf: Record<string, UnitScopedValue> = {};
    const selfLower = (editingOriginalId || varName).trim().toLowerCase();
    const unitById = new Map(variables.map(v => [v.id.toLowerCase(), v.unidad]));
    for (const [k, val] of Object.entries(scopeVariables)) {
      if (k.toLowerCase() !== selfLower) {
        const u = unitById.get(k.toLowerCase());
        scopeExcludingSelf[k] = { value: val, ...(u ? { unit: u } : {}) };
      }
    }
    return evaluateUnitExpression(trimmed, scopeExcludingSelf);
  }, [varExpr, scopeVariables, variables, editingOriginalId, varName]);

  const handleSubmitVar = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onUpsertVariable(varName, varExpr, varUnit, editingOriginalId);
    if (ok) {
      setShowVarPopover(false);
    }
  };

  if (collapsed) {
    return (
      <div className="px-4 py-1 border-b border-outline-variant/40 bg-surface-container-low/70 flex items-center justify-between text-[11px] text-on-surface-variant shrink-0">
        <div className="flex items-center gap-2">
          <Calculator className="w-3.5 h-3.5 text-primary" />
          <span>
            Variables ({variables.length}) y barra rápida
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Mostrar barra de variables"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-surface-container-high text-on-surface-variant"
        >
          <span>Mostrar</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="notebook-variables-bar"
      className="px-4 py-1.5 border-b border-outline-variant/40 bg-surface-container-low/80 flex items-center justify-between gap-3 flex-wrap shrink-0 text-xs"
    >
      {/* Zona izquierda: Variables globales interactivas */}
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mr-1 shrink-0">
          <Calculator className="w-3.5 h-3.5 text-primary" />
          <span>Variables</span>
        </span>

        {variables.length === 0 ? (
          <span className="text-[11px] text-on-surface-variant/70 hidden sm:inline">
            Definí medidas o parámetros (ej. <code className="font-mono text-primary">sup = 60</code>)
          </span>
        ) : (
          variables.map(v => {
            const hasErr = Boolean(v.error);
            const hasWarn = !hasErr && Boolean(v.advertencia);
            const valLabel =
              !hasErr && v.valorEvaluado !== undefined
                ? `${formatEvalNumber(v.valorEvaluado)}${v.unidad ? ` ${v.unidad}` : ''}`
                : 'err';
            return (
              <div
                key={v.id}
                className={`inline-flex items-center rounded-lg border text-[11px] font-mono transition-colors ${
                  hasErr
                    ? 'bg-error-container/40 text-error border-error/40'
                    : hasWarn
                      ? 'bg-amber-500/10 text-on-surface border-amber-500/40'
                      : 'bg-surface-container-high text-on-surface border-outline-variant/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onInsertText(v.id)}
                  title={
                    hasErr
                      ? v.error
                      : hasWarn
                        ? `${v.advertencia} · Clic para insertar '${v.id}'`
                        : `Clic para insertar '${v.id}' en el cursor (${v.expresion} = ${valLabel})`
                  }
                  className="inline-flex items-center gap-1 px-2 py-0.5 hover:bg-primary-container/40 rounded-l-lg"
                >
                  {(hasErr || hasWarn) && (
                    <AlertTriangle
                      className={`w-3 h-3 shrink-0 ${hasWarn ? 'text-amber-600 dark:text-amber-400' : ''}`}
                    />
                  )}
                  <span className="font-semibold text-primary">{v.id}</span>
                  <span className="text-on-surface-variant">=</span>
                  <span className="font-medium tabular-nums">{valLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openEditVariable(v)}
                  aria-label={`Editar variable ${v.id}`}
                  title={`Editar ${v.id}`}
                  className="px-1 py-0.5 text-on-surface-variant/70 hover:text-primary hover:bg-surface-container-highest rounded-r-lg border-l border-outline-variant/40"
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })
        )}

        {/* Botón + Variable con popover inline */}
        <div className="relative">
          <button
            type="button"
            onClick={() => (showVarPopover ? setShowVarPopover(false) : openNewVariable())}
            aria-expanded={showVarPopover}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>Variable</span>
          </button>

          {showVarPopover && (
            <div
              role="dialog"
              aria-label={editingOriginalId ? 'Editar variable' : 'Nueva variable'}
              onClick={e => e.stopPropagation()}
              className="absolute left-0 top-full mt-1.5 z-40 w-80 rounded-xl border border-outline-variant bg-surface-container-high shadow-2xl p-3.5 space-y-2.5 text-xs"
            >
              <div className="flex items-center justify-between border-b border-outline-variant/40 pb-1.5">
                <span className="font-semibold text-on-surface flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-primary" />
                  {editingOriginalId ? `Editar variable '${editingOriginalId}'` : 'Declarar variable'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowVarPopover(false)}
                  aria-label="Cerrar formulario de variable"
                  className="p-0.5 rounded hover:bg-surface-container text-on-surface-variant"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleSubmitVar} className="space-y-2.5">
                <label className="block space-y-1">
                  <span className="text-[11px] font-medium text-on-surface-variant">
                    Nombre (identificador)
                  </span>
                  <input
                    type="text"
                    autoFocus
                    required
                    value={varName}
                    onChange={e =>
                      setVarName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))
                    }
                    placeholder="ej: superficie, bocas, pisos"
                    className="w-full rounded-lg border border-outline-variant bg-surface px-2.5 py-1.5 font-mono text-xs text-on-surface outline-none focus:border-primary"
                  />
                </label>

                <label className="block space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-on-surface-variant">
                      Valor o fórmula
                    </span>
                    {previewEval && previewEval.isValid && previewEval.value !== null && (
                      <span className="font-mono text-[11px] font-semibold text-primary">
                        = {formatEvalNumber(previewEval.value)}
                        {varUnit || previewEval.unit ? ` ${varUnit || previewEval.unit}` : ''}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={varExpr}
                    onChange={e => setVarExpr(e.target.value)}
                    placeholder="ej: 80  o  ceil(superficie * 0.3)"
                    className="w-full rounded-lg border border-outline-variant bg-surface px-2.5 py-1.5 font-mono text-xs text-on-surface outline-none focus:border-primary"
                  />
                </label>

                {variables.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-on-surface-variant">Usar:</span>
                    {variables
                      .filter(v => v.id !== editingOriginalId)
                      .slice(0, 6)
                      .map(v => (
                        <button
                          key={`ref-${v.id}`}
                          type="button"
                          onClick={() => setVarExpr(prev => (prev ? `${prev} ${v.id}` : v.id))}
                          className="px-1.5 py-0.5 rounded bg-surface-container hover:bg-primary-container/50 font-mono text-[10px] text-primary border border-outline-variant/50"
                        >
                          {v.id}
                        </button>
                      ))}
                  </div>
                )}

                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-on-surface-variant">
                    Unidad (opcional)
                  </span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {QUICK_UNITS.map(u => (
                      <button
                        key={u || 'none'}
                        type="button"
                        onClick={() => setVarUnit(u)}
                        className={`px-2 py-0.5 rounded-md font-mono text-[11px] border transition-colors ${
                          varUnit === u
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-surface text-on-surface-variant border-outline-variant/60 hover:bg-surface-container'
                        }`}
                      >
                        {u || 'sin unidad'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  {editingOriginalId ? (
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteVariable(editingOriginalId);
                        setShowVarPopover(false);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-error hover:bg-error-container/40"
                    >
                      <Trash2 className="w-3 h-3" />
                      Eliminar
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="submit"
                    disabled={!varName.trim() || !varExpr.trim()}
                    className="px-3 py-1 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 disabled:opacity-40"
                  >
                    {editingOriginalId ? 'Actualizar' : 'Agregar'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Zona derecha: Inserción rápida de bloques y funciones */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onInsertQuickBlock('tt')}
          title="Insertar Trabajo Tipo (/tt)"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-on-surface-variant bg-surface-container hover:bg-surface-container-high border border-outline-variant/50"
        >
          <Wrench className="w-3 h-3 text-tertiary" />
          <span>/tt</span>
        </button>

        <button
          type="button"
          onClick={() => onInsertQuickBlock('tarea')}
          title="Insertar tarea libre con materiales y mano de obra (tarea:)"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-on-surface-variant bg-surface-container hover:bg-surface-container-high border border-outline-variant/50"
        >
          <ListPlus className="w-3 h-3 text-primary" />
          <span>Tarea</span>
        </button>

        <button
          type="button"
          onClick={() => onInsertQuickBlock('item')}
          title="Insertar ítem libre rápido (item:)"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-on-surface-variant bg-surface-container hover:bg-surface-container-high border border-outline-variant/50"
        >
          <Plus className="w-3 h-3 text-primary" />
          <span>Ítem</span>
        </button>

        <button
          type="button"
          onClick={() => onInsertQuickBlock('capitulo')}
          title="Insertar capítulo o rubro (#)"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-on-surface-variant bg-surface-container hover:bg-surface-container-high border border-outline-variant/50"
        >
          <Hash className="w-3 h-3" />
          <span className="hidden xl:inline">Capítulo</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowVarPopover(false);
              setShowFnPopover(v => !v);
            }}
            aria-expanded={showFnPopover}
            aria-label="Insertar función matemática"
            title="Insertar función u operador matemático"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono text-amber-800 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25"
          >
            <Sigma className="w-3 h-3" />
            <span>ƒ(x)</span>
          </button>

          {showFnPopover && (
            <div
              role="menu"
              aria-label="Funciones matemáticas disponibles"
              className="absolute right-0 top-full mt-1.5 z-40 w-64 rounded-xl border border-outline-variant bg-surface-container-high shadow-2xl p-1.5 space-y-0.5"
            >
              {MATH_FUNCTION_SNIPPETS.map(fn => (
                <button
                  key={fn.label}
                  type="button"
                  role="menuitem"
                  onMouseDown={e => {
                    e.preventDefault();
                    onInsertText(fn.snippet, fn.cursorOffset);
                    setShowFnPopover(false);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between gap-2 hover:bg-surface-container text-on-surface"
                >
                  <span className="font-mono text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                    {fn.label}
                  </span>
                  <span className="text-[10px] text-on-surface-variant truncate">{fn.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Ocultar barra de variables"
          title="Ocultar barra de variables"
          className="p-1 rounded-md text-on-surface-variant hover:bg-surface-container-high"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
