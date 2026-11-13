import React, { useState } from 'react';
import { AlertTriangle, ArrowDownCircle } from 'lucide-react';
import { NotebookErrorDocumento } from '../../../core/notebookDocument';
import { NotebookCursor } from '../../../viewmodels/useNotebookDocumentViewModel';

export interface NotebookDesktopStatusBarProps {
  cursor: NotebookCursor;
  errores: NotebookErrorDocumento[];
  esTotalParcial: boolean;
  cantidadSinValorizar: number;
  onJumpToLine: (linea: number) => void;
  onJumpNextUnvalorized: () => void;
}

/**
 * Barra de estado inferior del Notebook de escritorio: posición de cursor,
 * errores navegables al clic, progreso de Pasada 2 y acceso a ayuda de atajos.
 */
export const NotebookDesktopStatusBar: React.FC<NotebookDesktopStatusBarProps> = ({
  cursor,
  errores,
  esTotalParcial,
  cantidadSinValorizar,
  onJumpToLine,
  onJumpNextUnvalorized
}) => {
  const [activeErrorIdx, setActiveErrorIdx] = useState(0);

  const handleCycleError = () => {
    if (errores.length === 0) return;
    const idx = activeErrorIdx % errores.length;
    const err = errores[idx];
    if (err) {
      onJumpToLine(err.linea);
    }
    setActiveErrorIdx((idx + 1) % errores.length);
  };

  return (
    <footer className="px-4 py-2 border-t border-outline-variant/50 bg-surface-container-low flex items-center justify-between gap-4 text-xs shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-on-surface-variant shrink-0">
          Ln {cursor.linea}, Col {cursor.columna}
        </span>
        {errores.length > 0 && (
          <button
            type="button"
            onClick={handleCycleError}
            title="Clic para saltar al siguiente error"
            className="inline-flex items-center gap-1 text-error font-medium truncate hover:underline text-left"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {errores.length} {errores.length === 1 ? 'error' : 'errores'}:{' '}
              {errores[activeErrorIdx % errores.length]?.mensaje}
            </span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {esTotalParcial && (
          <button
            type="button"
            onClick={onJumpNextUnvalorized}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 font-medium"
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
            <span>{cantidadSinValorizar} sin valorizar · Siguiente (Ctrl+↓)</span>
          </button>
        )}
        <span className="text-on-surface-variant hidden md:inline">
          <kbd className="font-mono px-1 rounded bg-surface-container">Ctrl+Space</kbd> sugerencias ·{' '}
          <kbd className="font-mono px-1 rounded bg-surface-container">?</kbd> atajos
        </span>
      </div>
    </footer>
  );
};
