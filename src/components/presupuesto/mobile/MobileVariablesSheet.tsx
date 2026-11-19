import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Pencil, Plus, Trash2, Variable, X } from 'lucide-react';
import { evaluateUnitExpression, UnitScopedValue } from '../../../core/unitAlgebra';
import { VariableCotizacion } from '../../../core/types';
import { useEscapeKey } from '../../../hooks/useEscapeKey';

export interface MobileVariablesSheetProps {
  isOpen: boolean;
  onClose: () => void;
  variables: VariableCotizacion[];
  onUpsertVariable: (id: string, expresion: string, unidad?: string, previousId?: string) => boolean;
  onDeleteVariable: (id: string) => void;
}

const COMMON_UNITS = ['', 'm', 'cm', 'm²', 'u', 'bocas', 'hs', 'min', 'gl', 'kg'];

function formatVarNumber(val: number): string {
  const rounded = Math.round(val * 100) / 100;
  return Number.isInteger(rounded)
    ? rounded.toLocaleString('es-AR')
    : rounded.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Sheet móvil para consultar, crear, editar y eliminar variables globales de obra
 * con soporte de fórmulas y álgebra pragmática de unidades.
 */
export const MobileVariablesSheet: React.FC<MobileVariablesSheetProps> = ({
  isOpen,
  onClose,
  variables,
  onUpsertVariable,
  onDeleteVariable
}) => {
  useEscapeKey(isOpen, onClose, { pushHistory: false });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [expr, setExpr] = useState('');
  const [unit, setUnit] = useState('');

  const unitScope = useMemo<Record<string, UnitScopedValue>>(() => {
    const out: Record<string, UnitScopedValue> = {};
    for (const v of variables) {
      if (v.valorEvaluado !== undefined && Number.isFinite(v.valorEvaluado)) {
        out[v.id] = { value: v.valorEvaluado, ...(v.unidad ? { unit: v.unidad } : {}) };
      }
    }
    return out;
  }, [variables]);

  const livePreview = useMemo(() => {
    const trimmed = expr.trim();
    if (!trimmed) return null;
    return evaluateUnitExpression(trimmed, unitScope);
  }, [expr, unitScope]);

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setExpr('');
    setUnit('');
  };

  const handleEdit = (v: VariableCotizacion) => {
    setEditingId(v.id);
    setName(v.id);
    setExpr(v.expresion);
    setUnit(v.unidad || '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onUpsertVariable(name, expr, unit, editingId ?? undefined);
    if (ok) {
      resetForm();
    }
  };

  const handleInsertVarToken = (varId: string) => {
    setExpr(prev => {
      const trimmedEnd = prev.trimEnd();
      if (!trimmedEnd) return varId;
      if (/[+\-*/(^,]\s*$/.test(trimmedEnd)) return `${trimmedEnd} ${varId}`;
      return `${trimmedEnd} * ${varId}`;
    });
  };

  const canSubmit = name.trim().length > 0 && expr.trim().length > 0;
  const effectivePreviewUnit = unit.trim() || livePreview?.unit;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-surface"
      role="dialog"
      aria-modal="true"
      aria-label="Variables de obra"
    >
      <header className="flex items-center justify-between gap-2 border-b border-outline-variant bg-surface px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Variable className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-on-surface">
              Variables de obra ({variables.length})
            </h2>
            <p className="truncate text-xs text-on-surface-variant">
              Medidas globales reutilizables en parámetros y fórmulas
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Cerrar variables de obra"
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-2xl border border-outline-variant/70 bg-surface-container-low p-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">
              {editingId ? `Editando ${editingId}` : 'Nueva variable'}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-medium text-on-surface-variant hover:text-on-surface"
              >
                Cancelar edición
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="mobile-var-name"
                className="mb-1 block text-xs font-medium text-on-surface-variant"
              >
                Nombre (identificador)
              </label>
              <input
                id="mobile-var-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="ej: superficie, bocas, largo"
                className="h-11 w-full rounded-xl border border-outline-variant bg-surface px-3 font-mono text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="mobile-var-expr"
                className="mb-1 block text-xs font-medium text-on-surface-variant"
              >
                Valor o fórmula
              </label>
              <input
                id="mobile-var-expr"
                type="text"
                value={expr}
                onChange={e => setExpr(e.target.value)}
                placeholder="ej: 80  o  largo * ancho"
                className="h-11 w-full rounded-xl border border-outline-variant bg-surface px-3 font-mono text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {variables.length > 0 && (
            <div className="space-y-1">
              <span className="block text-[11px] font-medium text-on-surface-variant">
                Tocar para usar en la fórmula:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {variables
                  .filter(v => v.id !== editingId)
                  .map(v => (
                    <button
                      key={`ref-${v.id}`}
                      type="button"
                      onClick={() => handleInsertVarToken(v.id)}
                      className="min-h-[34px] rounded-lg border border-outline-variant/60 bg-surface px-2.5 py-1 font-mono text-xs text-on-surface hover:border-primary/50 hover:bg-primary-container/20"
                    >
                      {v.id}
                      {v.valorEvaluado !== undefined && (
                        <span className="ml-1 text-[11px] text-primary">
                          ={formatVarNumber(v.valorEvaluado)}
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <span className="block text-[11px] font-medium text-on-surface-variant">
              Unidad (opcional)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_UNITS.map(u => {
                const selected = unit === u;
                return (
                  <button
                    key={u || 'none'}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`min-h-[34px] rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'border border-outline-variant/60 bg-surface text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {u || 'Sin unidad'}
                  </button>
                );
              })}
            </div>
          </div>

          {livePreview && (
            <div
              className={`rounded-xl border px-3 py-2 text-xs font-mono flex items-center justify-between gap-2 ${
                livePreview.isValid && livePreview.value !== null
                  ? livePreview.warning
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                    : 'border-primary/30 bg-primary-container/20 text-primary'
                  : 'border-error/40 bg-error-container/30 text-on-error-container'
              }`}
            >
              {livePreview.isValid && livePreview.value !== null ? (
                <span>
                  Vista previa: <strong>= {formatVarNumber(livePreview.value)}</strong>
                  {effectivePreviewUnit ? ` ${effectivePreviewUnit}` : ''}
                </span>
              ) : (
                <span>{livePreview.error || 'Expresión incompleta'}</span>
              )}
              {livePreview.warning && (
                <span className="inline-flex items-center gap-1 font-sans text-[11px]">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{livePreview.warning}</span>
                </span>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-on-primary shadow-xs active:scale-[0.99] disabled:opacity-40"
          >
            {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span>{editingId ? 'Guardar variable' : 'Agregar variable'}</span>
          </button>
        </form>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Variables definidas
          </h3>
          {variables.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-5 text-center text-xs text-on-surface-variant">
              Todavía no definiste variables globales. Creá medidas como <code className="font-mono text-on-surface">largo = 12 m</code> o <code className="font-mono text-on-surface">bocas = 24</code> para reutilizarlas en cualquier ítem.
            </div>
          ) : (
            <div className="space-y-2">
              {variables.map(v => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-outline-variant/60 bg-surface-container-low px-3.5 py-2.5"
                >
                  <button
                    type="button"
                    onClick={() => handleEdit(v)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-sm font-semibold text-on-surface truncate">
                        {v.id}
                      </span>
                      {v.valorEvaluado !== undefined && Number.isFinite(v.valorEvaluado) ? (
                        <span className="font-mono text-xs font-bold text-primary shrink-0">
                          = {formatVarNumber(v.valorEvaluado)}
                          {v.unidad ? ` ${v.unidad}` : ''}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-on-surface-variant">
                      {v.expresion}
                    </p>
                    {v.error && (
                      <p className="mt-0.5 text-[11px] font-medium text-error">{v.error}</p>
                    )}
                    {!v.error && v.advertencia && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>{v.advertencia}</span>
                      </p>
                    )}
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Editar variable ${v.id}`}
                      onClick={() => handleEdit(v)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Eliminar variable ${v.id}`}
                      onClick={() => {
                        if (editingId === v.id) resetForm();
                        onDeleteVariable(v.id);
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
