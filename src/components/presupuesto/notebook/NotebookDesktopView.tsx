import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { TERMINOLOGY } from '../../../config/terminology';
import { NotebookDocumentContext } from '../../../core/notebookDocument';
import { AppConfig, Presupuesto } from '../../../core/types';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import { useNotebookDesktopKeyboard } from '../../../hooks/useNotebookDesktopKeyboard';
import { useNotebookDocumentViewModel } from '../../../viewmodels/useNotebookDocumentViewModel';
import { NotebookAutocompletePopup } from './NotebookAutocompletePopup';
import { NotebookBlockLinePreview } from './NotebookBlockLinePreview';
import { NotebookClientPreviewDrawer } from './NotebookClientPreviewDrawer';
import { NotebookCommandPaletteModal } from './NotebookCommandPaletteModal';
import { NotebookDesktopStatusBar } from './NotebookDesktopStatusBar';
import { NotebookDesktopToolbar } from './NotebookDesktopToolbar';
import { NotebookShortcutsModal } from './NotebookShortcutsModal';
import { NotebookSyntaxOverlay } from './NotebookSyntaxOverlay';
import { NotebookVariablesBar } from './NotebookVariablesBar';

export interface NotebookDesktopViewProps {
  config: AppConfig;
  presupuestoId?: string;
  initialPresupuesto?: Partial<Presupuesto>;
  catalogOverride?: Partial<Omit<NotebookDocumentContext, 'config'>>;
  onBack: () => void;
  onSaved?: (id: string) => void;
}

/**
 * Vista de escritorio (modo "autorar") tipo Jupyter Notebook para cotizaciones eléctricas.
 * Operable por teclado (Ctrl+K, Ctrl+Space, Ctrl+Z/Y, /, Tab/Shift+Tab, Enter, Esc LIFO, ?)
 * con respaldo total por mouse. Arquitectura MVVM estricta.
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const editorColumnRef = useRef<HTMLDivElement>(null);

  const [scrollMetrics, setScrollMetrics] = useState({
    scrollLeft: 0,
    scrollTop: 0,
    containerHeight: 0,
    containerWidth: 720
  });

  const vm = useNotebookDocumentViewModel({
    config,
    presupuestoId,
    initialPresupuesto,
    catalogOverride,
    onSaved: (p) => onSaved?.(p.id)
  });

  useEscapeKey(vm.autocomplete.isOpen, vm.dismissAutocomplete, { pushHistory: false });

  const lines = useMemo(() => vm.texto.split('\n'), [vm.texto]);

  const refreshScrollMetrics = useCallback(() => {
    const scrollEl = scrollContainerRef.current;
    const editorEl = editorColumnRef.current;
    const taEl = textareaRef.current;
    setScrollMetrics({
      scrollLeft: taEl?.scrollLeft ?? 0,
      scrollTop: scrollEl?.scrollTop ?? 0,
      containerHeight: scrollEl?.clientHeight ?? 0,
      containerWidth: editorEl?.clientWidth ?? 720
    });
  }, []);

  const {
    moveDomCursor,
    syncCursorFromTextarea,
    handleTextareaChange,
    handleTextareaKeyDown,
    handleTextareaKeyUp
  } = useNotebookDesktopKeyboard({
    textareaRef,
    texto: vm.texto,
    lines,
    cursor: vm.cursor,
    cursorSyncSeq: vm.cursorSyncSeq,
    autocompleteIsOpen: vm.autocomplete.isOpen,
    activeItemId: vm.activeItemId,
    setCursor: vm.setCursor,
    setTexto: vm.setTexto,
    undo: vm.undo,
    redo: vm.redo,
    forceOpenAutocomplete: vm.forceOpenAutocomplete,
    dismissAutocomplete: vm.dismissAutocomplete,
    moveAutocompleteSelection: vm.moveAutocompleteSelection,
    acceptAutocomplete: vm.acceptAutocomplete,
    handleTabKey: vm.handleTabKey,
    handleEnterKey: vm.handleEnterKey,
    moveCurrentLine: vm.moveCurrentLine,
    duplicateCurrentLine: vm.duplicateCurrentLine,
    deleteCurrentLine: vm.deleteCurrentLine,
    toggleCommentCurrentLine: vm.toggleCommentCurrentLine,
    valorizarItem: vm.valorizarItem,
    valorizarTodasPendientes: vm.valorizarTodasPendientes,
    openCommandPalette: vm.openCommandPalette,
    irASiguienteSinValorizar: vm.irASiguienteSinValorizar,
    guardar: vm.guardar,
    toggleVistaPrevia: vm.toggleVistaPrevia,
    toggleAyudaAtajos: vm.toggleAyudaAtajos,
    onRefreshScrollMetrics: refreshScrollMetrics
  });

  const handleSelectSuggestion = (idx: number) => {
    vm.acceptAutocomplete(idx);
    textareaRef.current?.focus();
  };

  const handleJumpToLine = (linea: number) => {
    vm.setCursor(linea, 1);
    moveDomCursor(vm.texto, linea, 1);
  };

  const handleJumpNextUnvalorized = () => {
    const next = vm.irASiguienteSinValorizar();
    if (next) {
      moveDomCursor(vm.texto, next.linea, 1);
    }
  };

  const handleRequestBack = () => {
    if (
      vm.isDirty &&
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function' &&
      window.confirm('Hay cambios sin guardar en la cotización. ¿Salir igualmente?') === false
    ) {
      return;
    }
    onBack();
  };

  const activeLineText = lines[Math.max(0, vm.cursor.linea - 1)] || '';
  const ghostPrefixText = activeLineText.slice(0, Math.max(0, vm.cursor.columna - 1));

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-background text-on-background">
      <NotebookDesktopToolbar
        presupuesto={vm.presupuesto}
        contactos={vm.contactos}
        clienteActual={vm.clienteActual}
        passMode={vm.passMode}
        isDirty={vm.isDirty}
        saveStatus={vm.saveStatus}
        canUndo={vm.canUndo}
        canRedo={vm.canRedo}
        esTotalParcial={vm.esTotalParcial}
        precioFinalGlobal={vm.totales.precioFinalGlobal}
        onRequestBack={handleRequestBack}
        onTogglePassMode={() =>
          vm.setPassMode(vm.passMode === 'esqueleto' ? 'valorizacion' : 'esqueleto')
        }
        onUndo={() => void vm.undo()}
        onRedo={() => void vm.redo()}
        onSave={() => void vm.guardar()}
        onUpdateMetadata={vm.actualizarMetadataPresupuesto}
        onOpenPalette={() => vm.openCommandPalette('')}
        onTogglePreview={vm.toggleVistaPrevia}
        onToggleHelp={vm.toggleAyudaAtajos}
      />

      <NotebookVariablesBar
        variables={vm.variablesCotizacion}
        scopeVariables={vm.scopeVariables}
        onInsertText={(snippet, offset) => {
          vm.insertTextAtCursor(snippet, offset);
          textareaRef.current?.focus();
        }}
        onUpsertVariable={vm.upsertVariable}
        onDeleteVariable={vm.deleteVariable}
        onInsertQuickBlock={(kind) => {
          vm.insertQuickBlock(kind);
          textareaRef.current?.focus();
        }}
      />

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

      <div
        ref={scrollContainerRef}
        onScroll={refreshScrollMetrics}
        className="flex-1 min-h-0 flex overflow-y-auto bg-surface"
      >
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

        <div ref={editorColumnRef} className="relative flex-1 min-w-0 py-3">
          {vm.texto.length > 0 && (
            <NotebookSyntaxOverlay
              lines={lines}
              activeLine={vm.cursor.linea}
              variableNames={vm.variablesCotizacion.map(v => v.id)}
              errores={vm.errores}
              scrollLeft={scrollMetrics.scrollLeft}
            />
          )}

          {vm.autocomplete.ghostText && vm.texto.length > 0 && (
            <div
              aria-hidden="true"
              style={{ top: `${12 + (vm.cursor.linea - 1) * 28}px` }}
              className="pointer-events-none absolute left-4 right-4 h-7 leading-7 font-mono text-sm whitespace-pre overflow-hidden"
            >
              <div style={{ transform: `translateX(-${scrollMetrics.scrollLeft}px)` }}>
                <span className="invisible">{ghostPrefixText}</span>
                <span data-testid="notebook-ghost-text" className="text-on-surface-variant/45">
                  {vm.autocomplete.ghostText}
                </span>
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={vm.texto}
            onChange={handleTextareaChange}
            onKeyDown={handleTextareaKeyDown}
            onKeyUp={handleTextareaKeyUp}
            onClick={(e) => syncCursorFromTextarea(e.currentTarget)}
            onScroll={refreshScrollMetrics}
            onBlur={vm.dismissAutocomplete}
            spellCheck={false}
            aria-label="Editor notebook de cotización"
            placeholder="Escribí variables (ej. sup = 60), /tt para trabajo tipo, tarea: / item: o Ctrl+Space..."
            rows={Math.max(lines.length + 2, 18)}
            className="relative z-10 w-full h-full min-h-[420px] px-4 py-0 border-0 bg-transparent text-transparent selection:bg-primary/25 placeholder:text-on-surface-variant/45 font-mono text-sm leading-7 whitespace-pre overflow-x-auto resize-none focus:outline-none caret-primary"
          />

          <NotebookAutocompletePopup
            autocomplete={vm.autocomplete}
            selectedIndex={vm.autocompleteSelectedIndex}
            cursorLinea={vm.cursor.linea}
            cursorCol={vm.cursor.columna}
            scrollTop={scrollMetrics.scrollTop}
            containerHeight={scrollMetrics.containerHeight}
            containerWidth={scrollMetrics.containerWidth}
            onSelect={handleSelectSuggestion}
            onDismiss={vm.dismissAutocomplete}
          />
        </div>

        <div className="py-3">
          <NotebookBlockLinePreview
            lines={lines}
            linesCount={lines.length}
            activeLine={vm.cursor.linea}
            bloques={vm.bloques}
            blockLineNumbers={vm.blockLineNumbers}
            subtotalesPorBloque={vm.subtotalesPorBloque}
            items={vm.presupuesto.items}
            variablesCotizacion={vm.variablesCotizacion}
            notasUnidadesPorLinea={vm.notasUnidadesPorLinea}
            contexto={vm.contexto}
            errores={vm.errores}
            onSelectLine={handleJumpToLine}
            onValorizarItem={vm.valorizarItem}
          />
        </div>
      </div>

      <NotebookDesktopStatusBar
        cursor={vm.cursor}
        errores={vm.errores}
        esTotalParcial={vm.esTotalParcial}
        cantidadSinValorizar={vm.cantidadSinValorizar}
        onJumpToLine={handleJumpToLine}
        onJumpNextUnvalorized={handleJumpNextUnvalorized}
      />

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
        onInsertExample={(snippet) => {
          const base = vm.texto.trimEnd();
          const next = base ? `${base}\n\n${snippet}` : snippet;
          vm.setTexto(next);
          textareaRef.current?.focus();
        }}
      />
    </div>
  );
};
