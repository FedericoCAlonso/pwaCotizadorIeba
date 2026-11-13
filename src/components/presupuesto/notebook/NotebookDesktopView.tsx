import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowLeft,
  Check,
  Command,
  Eye,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { formatARS } from '../../../core/calculations';
import { TERMINOLOGY } from '../../../config/terminology';
import { NotebookDocumentContext } from '../../../core/notebookDocument';
import { AppConfig, Presupuesto } from '../../../core/types';
import { useNotebookDocumentViewModel } from '../../../viewmodels/useNotebookDocumentViewModel';
import { NotebookAutocompletePopup } from './NotebookAutocompletePopup';
import { NotebookBlockLinePreview } from './NotebookBlockLinePreview';
import { NotebookClientPreviewDrawer } from './NotebookClientPreviewDrawer';
import { NotebookCommandPaletteModal } from './NotebookCommandPaletteModal';
import { NotebookShortcutsModal } from './NotebookShortcutsModal';

export interface NotebookDesktopViewProps {
  config: AppConfig;
  presupuestoId?: string;
  initialPresupuesto?: Partial<Presupuesto>;
  catalogOverride?: Partial<Omit<NotebookDocumentContext, 'config'>>;
  onBack: () => void;
  onSaved?: (id: string) => void;
}

function getLineColFromOffset(text: string, offset: number): { linea: number; columna: number } {
  const safe = Math.max(0, Math.min(offset, text.length));
  const upToCursor = text.slice(0, safe);
  const lines = upToCursor.split('\n');
  return {
    linea: lines.length,
    columna: (lines[lines.length - 1]?.length ?? 0) + 1
  };
}

function getOffsetFromLineCol(text: string, linea1Based: number, columna1Based: number): number {
  const lines = text.split('\n');
  const clampedLineIdx = Math.max(0, Math.min(linea1Based - 1, lines.length - 1));
  let offset = 0;
  for (let i = 0; i < clampedLineIdx; i++) {
    offset += lines[i].length + 1;
  }
  const lineLen = lines[clampedLineIdx]?.length ?? 0;
  return offset + Math.max(0, Math.min(columna1Based - 1, lineLen));
}

/**
 * Vista de escritorio (modo "autorar") tipo Jupyter Notebook para cotizaciones eléctricas.
 * Operable por teclado (Ctrl+K, /, Tab, Enter, Ctrl+↓, ?) con respaldo total por mouse.
 * Sin barras de botones ni lógica de negocio inline (MVVM estricto).
 */
export const NotebookDesktopView: React.FC<NotebookDesktopViewProps> = ({
  config,
  presupuestoId,
  initialPresupuesto,
  catalogOverride,
  onBack,
  onSaved
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pendingSelection, setPendingSelection] = useState<{ start: number; end: number } | null>(
    null
  );

  const vm = useNotebookDocumentViewModel({
    config,
    presupuestoId,
    initialPresupuesto,
    catalogOverride,
    onSaved: (p) => onSaved?.(p.id)
  });

  const lines = useMemo(() => vm.texto.split('\n'), [vm.texto]);

  // Aplica selección de cursor programática (Tab entre parámetros, Ctrl+↓, autocompletado)
  useEffect(() => {
    if (!pendingSelection || !textareaRef.current) return;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(pendingSelection.start, pendingSelection.end);
    setPendingSelection(null);
  }, [pendingSelection, vm.texto]);

  const moveDomCursor = useCallback(
    (textoActual: string, linea: number, startCol: number, endCol?: number) => {
      const start = getOffsetFromLineCol(textoActual, linea, startCol);
      const end = endCol !== undefined ? getOffsetFromLineCol(textoActual, linea, endCol) : start;
      setPendingSelection({ start, end });
    },
    []
  );

  // Atajos globales del notebook
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        vm.openCommandPalette('');
        return;
      }
      if (ctrl && e.key === 'ArrowDown') {
        e.preventDefault();
        const next = vm.irASiguienteSinValorizar();
        if (next) {
          moveDomCursor(vm.texto, next.linea, 1);
        }
        return;
      }
      if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void vm.guardar();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        vm.toggleVistaPrevia();
        return;
      }
      if (e.key === '?' && document.activeElement !== textareaRef.current && !(document.activeElement instanceof HTMLInputElement)) {
        e.preventDefault();
        vm.toggleAyudaAtajos();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [vm, moveDomCursor]);

  const syncCursorFromTextarea = useCallback(
    (el: HTMLTextAreaElement) => {
      const { linea, columna } = getLineColFromOffset(el.value, el.selectionStart ?? 0);
      vm.setCursor(linea, columna);
    },
    [vm]
  );

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    const { linea, columna } = getLineColFromOffset(nextValue, e.target.selectionStart ?? 0);
    vm.setTexto(nextValue);
    vm.setCursor(linea, columna);
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      vm.valorizarTodasPendientes();
      return;
    }

    if (ctrl && e.key === 'Enter') {
      e.preventDefault();
      if (vm.activeItemId) {
        vm.valorizarItem(vm.activeItemId);
      }
      return;
    }

    if (vm.autocomplete.isOpen) {
      if (e.key === 'ArrowDown' && !ctrl) {
        e.preventDefault();
        vm.moveAutocompleteSelection(1);
        return;
      }
      if (e.key === 'ArrowUp' && !ctrl) {
        e.preventDefault();
        vm.moveAutocompleteSelection(-1);
        return;
      }
      if (e.key === 'Enter' && !ctrl) {
        e.preventDefault();
        vm.acceptAutocomplete();
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (vm.autocomplete.isOpen && !vm.autocomplete.ghostText) {
        vm.acceptAutocomplete();
        return;
      }
      const res = vm.handleTabKey();
      if (res.handled) {
        moveDomCursor(
          vm.texto,
          res.linea,
          res.selectionStartCol ?? res.columna,
          res.selectionEndCol
        );
      }
    }
  };

  const handleSelectSuggestion = (idx: number) => {
    vm.acceptAutocomplete(idx);
    textareaRef.current?.focus();
  };

  const handleSelectLineInMargin = (linea: number) => {
    vm.setCursor(linea, 1);
    moveDomCursor(vm.texto, linea, 1);
  };

  const handleJumpNextUnvalorized = () => {
    const next = vm.irASiguienteSinValorizar();
    if (next) {
      moveDomCursor(vm.texto, next.linea, 1);
    }
  };

  const activeLineText = lines[Math.max(0, vm.cursor.linea - 1)] || '';
  const ghostPrefixText = activeLineText.slice(0, Math.max(0, vm.cursor.columna - 1));

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-background text-on-background">
      {/* Cabecera minimalista sin barra de herramientas densa */}
      <header className="px-4 py-2.5 border-b border-outline-variant/50 bg-surface-container-low flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver al listado"
            className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold truncate">{vm.presupuesto.numero}</h1>
              <button
                type="button"
                onClick={() =>
                  vm.setPassMode(vm.passMode === 'esqueleto' ? 'valorizacion' : 'esqueleto')
                }
                title="Alternar modo de carga (Pasada 1 Esqueleto / Pasada 2 Valorización)"
                className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-container-high text-on-surface-variant border border-outline-variant/60 hover:bg-surface-container-highest"
              >
                {vm.passMode === 'esqueleto' ? 'Pasada 1 · Esqueleto' : 'Pasada 2 · Valorización'}
              </button>
              {vm.saveStatus === 'saved' && (
                <span className="inline-flex items-center gap-1 text-[11px] text-tertiary">
                  <Check className="w-3 h-3" /> Guardado
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => vm.openCommandPalette('')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-on-surface-variant bg-surface-container hover:bg-surface-container-high border border-outline-variant/50"
          >
            <Command className="w-3.5 h-3.5" />
            <span>Paleta</span>
            <kbd className="text-[10px] font-mono opacity-75">Ctrl+K</kbd>
          </button>

          <button
            type="button"
            onClick={vm.toggleVistaPrevia}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-on-surface-variant bg-surface-container hover:bg-surface-container-high border border-outline-variant/50"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Cliente</span>
          </button>

          <button
            type="button"
            onClick={vm.toggleAyudaAtajos}
            aria-label="Ayuda de atajos de teclado"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-on-surface-variant hover:bg-surface-container-high"
          >
            <HelpCircle className="w-4 h-4" />
            <kbd className="text-[11px] font-mono">?</kbd>
          </button>

          <div
            data-testid="notebook-total-header"
            className="pl-3 border-l border-outline-variant/50 text-right"
          >
            <span className="block text-[10px] uppercase tracking-wider text-on-surface-variant">
              {vm.esTotalParcial ? 'Total parcial' : 'Total cotización'}
            </span>
            <span
              className={`font-mono font-bold text-sm tabular-nums ${
                vm.esTotalParcial ? 'text-amber-700 dark:text-amber-300' : 'text-primary'
              }`}
            >
              {formatARS(vm.totales.precioFinalGlobal)}
            </span>
          </div>
        </div>
      </header>

      {/* Banner de sugerencia al detectar tareas libres repetidas */}
      {vm.sugerenciasConversion.length > 0 && (
        <div className="px-4 py-2 bg-tertiary-container/40 border-b border-tertiary/30 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-on-tertiary-container">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>
              Se repite &ldquo;{vm.sugerenciasConversion[0].descripcionEjemplo}&rdquo; (
              {vm.sugerenciasConversion[0].cantidadRepeticiones}x). ¿Convertirlo en{' '}
              {TERMINOLOGY.trabajoTipoSingular.toLowerCase()} reutilizable?
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              void vm.convertirTareaLibreATareaTipo(
                vm.sugerenciasConversion[0].descripcionNormalizada
              )
            }
            className="px-2.5 py-1 rounded-md bg-tertiary text-on-tertiary font-medium hover:opacity-90 shrink-0"
          >
            Convertir en /tt {vm.sugerenciasConversion[0].slugSugerido}
          </button>
        </div>
      )}

      {/* Área principal del Notebook: editor monospace + ghost text + margen derecho de outputs */}
      <div className="flex-1 min-h-0 flex overflow-y-auto bg-surface">
        {/* Gutter con números de línea */}
        <div
          aria-hidden="true"
          className="w-11 shrink-0 py-3 pr-2 text-right font-mono text-xs text-on-surface-variant/50 select-none bg-surface-container-low/40 border-r border-outline-variant/30"
        >
          {lines.map((_, idx) => {
            const lineNum = idx + 1;
            const hasErr = vm.errores.some(er => er.linea === lineNum);
            return (
              <div
                key={lineNum}
                className={`h-7 leading-7 ${
                  lineNum === vm.cursor.linea ? 'text-primary font-bold' : ''
                } ${hasErr ? 'text-error font-bold' : ''}`}
              >
                {lineNum}
              </div>
            );
          })}
        </div>

        {/* Lienzo de código / celdas tipadas + Ghost Text + Popup de autocompletado */}
        <div className="relative flex-1 min-w-0 py-3">
          {/* Capa visual de Ghost Text sincronizada */}
          {vm.autocomplete.ghostText && (
            <div
              aria-hidden="true"
              style={{ top: `${12 + (vm.cursor.linea - 1) * 28}px` }}
              className="pointer-events-none absolute left-4 right-4 h-7 leading-7 font-mono text-sm whitespace-pre overflow-hidden"
            >
              <span className="invisible">{ghostPrefixText}</span>
              <span data-testid="notebook-ghost-text" className="text-on-surface-variant/45">
                {vm.autocomplete.ghostText}
              </span>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={vm.texto}
            onChange={handleTextareaChange}
            onKeyDown={handleTextareaKeyDown}
            onClick={(e) => syncCursorFromTextarea(e.currentTarget)}
            onKeyUp={(e) => syncCursorFromTextarea(e.currentTarget)}
            spellCheck={false}
            aria-label="Editor notebook de cotización"
            placeholder="Escribí /tt para insertar un trabajo tipo, # para un capítulo o Ctrl+K para ver comandos..."
            rows={Math.max(lines.length + 2, 18)}
            className="relative z-10 w-full h-full min-h-[420px] px-4 bg-transparent text-on-surface placeholder:text-on-surface-variant/45 font-mono text-sm leading-7 whitespace-pre overflow-x-auto resize-none focus:outline-none caret-primary"
          />

          <NotebookAutocompletePopup
            autocomplete={vm.autocomplete}
            selectedIndex={vm.autocompleteSelectedIndex}
            cursorLinea={vm.cursor.linea}
            onSelect={handleSelectSuggestion}
          />
        </div>

        {/* Margen derecho con subtotales y chips por línea */}
        <div className="py-3">
          <NotebookBlockLinePreview
            linesCount={lines.length}
            activeLine={vm.cursor.linea}
            bloques={vm.bloques}
            blockLineNumbers={vm.blockLineNumbers}
            subtotalesPorBloque={vm.subtotalesPorBloque}
            items={vm.presupuesto.items}
            contexto={vm.contexto}
            errores={vm.errores}
            onSelectLine={handleSelectLineInMargin}
            onValorizarItem={vm.valorizarItem}
          />
        </div>
      </div>

      {/* Barra inferior de estado: Pasada 2, errores visibles y resumen de total */}
      <footer className="px-4 py-2 border-t border-outline-variant/50 bg-surface-container-low flex items-center justify-between gap-4 text-xs shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-on-surface-variant">
            Ln {vm.cursor.linea}, Col {vm.cursor.columna}
          </span>
          {vm.errores.length > 0 && (
            <span className="inline-flex items-center gap-1 text-error font-medium truncate">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                {vm.errores.length} {vm.errores.length === 1 ? 'error' : 'errores'}:{' '}
                {vm.errores[0].mensaje}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {vm.esTotalParcial && (
            <button
              type="button"
              onClick={handleJumpNextUnvalorized}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 font-medium"
            >
              <ArrowDownCircle className="w-3.5 h-3.5" />
              <span>
                {vm.cantidadSinValorizar} sin valorizar · Siguiente (Ctrl+↓)
              </span>
            </button>
          )}
          <span className="text-on-surface-variant hidden md:inline">
            Presioná <kbd className="font-mono px-1 rounded bg-surface-container">?</kbd> para atajos
          </span>
        </div>
      </footer>

      <NotebookCommandPaletteModal
        palette={vm.commandPalette}
        onQueryChange={vm.setCommandPaletteQuery}
        onMoveSelection={vm.moveCommandPaletteSelection}
        onExecute={(id) => void vm.executeCommandPaletteItem(id)}
        onClose={vm.closeCommandPalette}
      />

      <NotebookClientPreviewDrawer
        isOpen={vm.mostrarVistaPrevia}
        presupuesto={vm.presupuesto}
        totales={vm.totales}
        alcanceYAdvertencias={vm.alcanceYAdvertencias}
        esTotalParcial={vm.esTotalParcial}
        cantidadSinValorizar={vm.cantidadSinValorizar}
        config={config}
        onClose={vm.toggleVistaPrevia}
      />

      <NotebookShortcutsModal
        isOpen={vm.mostrarAyudaAtajos}
        onClose={vm.toggleAyudaAtajos}
      />
    </div>
  );
};
