import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Clock, Plus, Search, X } from 'lucide-react';
import { TERMINOLOGY } from '../../../config/terminology';
import { evaluarVisibilidadParametroEnEsquema } from '../../../core/notebookDocument';
import { TareaTipo } from '../../../core/types';
import { MobileSchemaParameterField } from './MobileSchemaParameterField';

interface MobileTareaTipoPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  buscarTareasTipo: (query: string) => TareaTipo[];
  onSelectAndAdd: (
    tareaTipoId: string,
    valoresParametros?: Record<string, number>
  ) => Promise<void> | void;
}

const MAX_RECIENTES = 5;

function initDefaultParams(tarea: TareaTipo): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of tarea.parametros || []) {
    out[p.id] = Number.isFinite(Number(p.valorDefault)) ? Number(p.valorDefault) : 1;
  }
  return out;
}

/**
 * Selector táctil de Trabajos Tipo con búsqueda y "Recientes" arriba.
 * Al elegir un trabajo con parámetros, genera el formulario desde su esquema antes de agregar.
 */
export const MobileTareaTipoPickerSheet: React.FC<MobileTareaTipoPickerSheetProps> = ({
  isOpen,
  onClose,
  buscarTareasTipo,
  onSelectAndAdd
}) => {
  const [query, setQuery] = useState('');
  const [selectedTarea, setSelectedTarea] = useState<TareaTipo | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedTarea(null);
      setParamValues({});
      setSubmitting(false);
    }
  }, [isOpen]);

  const resultados = useMemo(
    () => (isOpen ? buscarTareasTipo(query) : []),
    [isOpen, query, buscarTareasTipo]
  );

  const { recientes, catalogoRestante } = useMemo(() => {
    if (query.trim() !== '') {
      return { recientes: [] as TareaTipo[], catalogoRestante: resultados };
    }
    const rec: TareaTipo[] = [];
    const rest: TareaTipo[] = [];
    for (const t of resultados) {
      if (rec.length < MAX_RECIENTES && (t.ultimoUsoFecha || (t.frecuenciaUso ?? 0) > 0)) {
        rec.push(t);
      } else {
        rest.push(t);
      }
    }
    return { recientes: rec, catalogoRestante: rest };
  }, [resultados, query]);

  if (!isOpen) return null;

  const handleTapTarea = async (tarea: TareaTipo) => {
    if (!tarea.parametros || tarea.parametros.length === 0) {
      setSubmitting(true);
      try {
        await onSelectAndAdd(tarea.id);
        onClose();
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setSelectedTarea(tarea);
    setParamValues(initDefaultParams(tarea));
  };

  const handleConfirmConfigured = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTarea || submitting) return;
    setSubmitting(true);
    try {
      await onSelectAndAdd(selectedTarea.id, paramValues);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const renderTareaCard = (tarea: TareaTipo) => {
    const paramCount = tarea.parametros?.length ?? 0;
    return (
      <div
        key={tarea.id}
        className="flex items-center gap-2.5 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-3 shadow-xs"
      >
        <button
          type="button"
          onClick={() => handleTapTarea(tarea)}
          disabled={submitting}
          className="min-w-0 flex-1 text-left"
        >
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-on-surface">
            {tarea.nombre}
          </p>
          <p className="mt-1 truncate text-xs text-on-surface-variant">
            {tarea.categoria}
            {paramCount > 0 ? ` · ${paramCount} parámetro${paramCount > 1 ? 's' : ''}` : ' · Directo'}
          </p>
        </button>
        <button
          type="button"
          aria-label={`Agregar rápido ${tarea.nombre}`}
          disabled={submitting}
          onClick={async () => {
            setSubmitting(true);
            try {
              await onSelectAndAdd(tarea.id, initDefaultParams(tarea));
              onClose();
            } finally {
              setSubmitting(false);
            }
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container active:scale-95"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-surface"
      role="dialog"
      aria-modal="true"
      aria-label={
        selectedTarea
          ? `Configurar ${selectedTarea.nombre}`
          : `Elegir ${TERMINOLOGY.trabajoTipoSingular}`
      }
    >
      <header className="flex items-center justify-between gap-2 border-b border-outline-variant bg-surface px-4 py-3">
        {selectedTarea ? (
          <button
            type="button"
            onClick={() => setSelectedTarea(null)}
            className="flex h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-on-surface hover:bg-surface-container"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
        ) : (
          <h2 className="text-base font-semibold text-on-surface">
            Agregar {TERMINOLOGY.trabajoTipoSingular}
          </h2>
        )}
        <button
          type="button"
          aria-label="Cerrar selector"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {selectedTarea ? (
        <form onSubmit={handleConfirmConfigured} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            <div>
              <h3 className="text-lg font-semibold text-on-surface">{selectedTarea.nombre}</h3>
              {selectedTarea.notasTecnicas && (
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {selectedTarea.notasTecnicas}
                </p>
              )}
            </div>
            {(selectedTarea.parametros || [])
              .filter(p => evaluarVisibilidadParametroEnEsquema(p, paramValues))
              .map(param => (
                <MobileSchemaParameterField
                  key={param.id}
                  param={param}
                  idPrefix="picker-param"
                  value={paramValues[param.id] ?? Number(param.valorDefault) ?? 0}
                  onChange={nextVal => setParamValues(prev => ({ ...prev, [param.id]: nextVal }))}
                />
              ))}
          </div>
          <div className="border-t border-outline-variant bg-surface p-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-on-primary shadow-sm active:scale-[0.99] disabled:opacity-50"
            >
              <Check className="h-5 w-5" />
              Agregar a la cotización
            </button>
          </div>
        </form>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-outline-variant/60 bg-surface px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="search"
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Buscar ${TERMINOLOGY.trabajoTipoSingular.toLowerCase()}...`}
                aria-label={`Buscar ${TERMINOLOGY.trabajoTipoSingular.toLowerCase()}`}
                className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-10 pr-3 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {recientes.length > 0 && (
              <section aria-label="Recientes" className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                  <Clock className="h-3.5 w-3.5" />
                  Recientes
                </h3>
                <div className="space-y-2">{recientes.map(renderTareaCard)}</div>
              </section>
            )}

            <section className="space-y-2">
              {recientes.length > 0 && catalogoRestante.length > 0 && (
                <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  Todos ({catalogoRestante.length})
                </h3>
              )}
              {catalogoRestante.length > 0 ? (
                <div className="space-y-2">{catalogoRestante.map(renderTareaCard)}</div>
              ) : recientes.length === 0 ? (
                <p className="py-10 text-center text-sm text-on-surface-variant">
                  No se encontraron {TERMINOLOGY.trabajoTipoPlural.toLowerCase()} para esa búsqueda.
                </p>
              ) : null}
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
