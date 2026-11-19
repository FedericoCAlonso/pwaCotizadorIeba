import React, { useMemo } from 'react';
import { NotebookErrorDocumento } from '../../../core/notebookDocument';
import { HighlightTokenKind, tokenizeNotebookLine } from '../../../core/notebookHighlight';

export interface NotebookSyntaxOverlayProps {
  lines: string[];
  activeLine: number;
  variableNames: string[];
  errores: NotebookErrorDocumento[];
  scrollLeft: number;
}

const TOKEN_CLASSES: Record<HighlightTokenKind, string> = {
  plain: 'text-on-surface',
  comment: 'text-on-surface-variant/55 italic',
  heading: 'text-primary font-semibold',
  directive: 'text-tertiary font-semibold',
  variable_def: 'text-primary font-semibold',
  variable_ref: 'text-primary',
  param_key: 'text-secondary font-medium',
  operator: 'text-on-surface-variant',
  function: 'text-amber-700 dark:text-amber-300 font-medium',
  number: 'text-emerald-700 dark:text-emerald-300',
  unit: 'text-on-surface-variant/85',
  adjustment: 'text-amber-700 dark:text-amber-300 font-semibold',
  brand: 'text-secondary font-medium'
};

/**
 * Capa visual liviana de resaltado de sintaxis y subrayado de errores sincronizada
 * carácter a carácter con el <textarea> del Notebook de escritorio.
 */
export const NotebookSyntaxOverlay: React.FC<NotebookSyntaxOverlayProps> = ({
  lines,
  activeLine,
  variableNames,
  errores,
  scrollLeft
}) => {
  const varSet = useMemo(() => {
    const s = new Set<string>();
    for (const v of variableNames) {
      s.add(v);
      s.add(v.toLowerCase());
    }
    return s;
  }, [variableNames]);

  const errorByLine = useMemo(() => {
    const map = new Map<number, NotebookErrorDocumento>();
    for (const err of errores) {
      if (err.codigo === 'exceso_advertencias') continue;
      if (!map.has(err.linea)) map.set(err.linea, err);
    }
    return map;
  }, [errores]);

  return (
    <div
      aria-hidden="true"
      data-testid="notebook-syntax-overlay"
      className="pointer-events-none absolute inset-0 py-3 px-4 font-mono text-sm leading-7 whitespace-pre overflow-hidden select-none"
    >
      <div style={{ transform: `translateX(-${scrollLeft}px)` }}>
        {lines.map((line, idx) => {
          const lineNum = idx + 1;
          const isActive = lineNum === activeLine;
          const err = errorByLine.get(lineNum);
          const spans = tokenizeNotebookLine(line, { variableNames: varSet, error: err });

          return (
            <div
              key={lineNum}
              className={`h-7 leading-7 -mx-4 px-4 ${
                err
                  ? 'bg-error/5'
                  : isActive
                    ? 'bg-primary-container/15'
                    : ''
              }`}
            >
              {spans.length === 0 ? (
                '\u00A0'
              ) : (
                spans.map((span, sIdx) => (
                  <span
                    key={sIdx}
                    className={`${TOKEN_CLASSES[span.kind]} ${
                      span.isError
                        ? 'underline decoration-wavy decoration-error bg-error/15 text-error rounded-[2px]'
                        : ''
                    }`}
                  >
                    {span.text}
                  </span>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
