import { useCallback, useEffect, useRef, useState } from 'react';
import { TabJumpResult } from '../core/notebookDocument';
import { NotebookCursor } from '../viewmodels/useNotebookDocumentViewModel';

export function getLineColFromOffset(text: string, offset: number): { linea: number; columna: number } {
  const safe = Math.max(0, Math.min(offset, text.length));
  const upToCursor = text.slice(0, safe);
  const lines = upToCursor.split('\n');
  return {
    linea: lines.length,
    columna: (lines[lines.length - 1]?.length ?? 0) + 1
  };
}

export function getOffsetFromLineCol(text: string, linea1Based: number, columna1Based: number): number {
  const lines = text.split('\n');
  const clampedLineIdx = Math.max(0, Math.min(linea1Based - 1, lines.length - 1));
  let offset = 0;
  for (let i = 0; i < clampedLineIdx; i++) {
    offset += lines[i].length + 1;
  }
  const lineLen = lines[clampedLineIdx]?.length ?? 0;
  return offset + Math.max(0, Math.min(columna1Based - 1, lineLen));
}

export interface NotebookDesktopKeyboardDeps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  texto: string;
  lines: string[];
  cursor: NotebookCursor;
  cursorSyncSeq: number;
  autocompleteIsOpen: boolean;
  activeItemId: string | null;
  setCursor: (linea: number, columna: number) => void;
  setTexto: (nuevoTexto: string, nextCursor?: NotebookCursor) => void;
  undo: () => boolean;
  redo: () => boolean;
  forceOpenAutocomplete: () => void;
  dismissAutocomplete: () => void;
  moveAutocompleteSelection: (delta: 1 | -1) => void;
  acceptAutocomplete: (index?: number) => boolean;
  handleTabKey: (shiftKey?: boolean) => TabJumpResult;
  handleEnterKey: () => boolean;
  moveCurrentLine: (direction: -1 | 1) => boolean;
  duplicateCurrentLine: () => boolean;
  deleteCurrentLine: () => boolean;
  toggleCommentCurrentLine: () => boolean;
  valorizarItem: (itemId: string) => void;
  valorizarTodasPendientes: () => void;
  openCommandPalette: (initialQuery?: string) => void;
  irASiguienteSinValorizar: () => { linea: number } | null;
  guardar: () => Promise<unknown>;
  toggleVistaPrevia: () => void;
  toggleAyudaAtajos: () => void;
  onRefreshScrollMetrics: () => void;
}

/**
 * Encapsula la sincronización de selección DOM y todos los atajos estándar de editor
 * (Undo/Redo, Ctrl+Space, Tab/Shift+Tab, Esc, Enter auto-indent, Alt+↑/↓, Ctrl+D/K//, Smart Home)
 * manteniendo la vista `NotebookDesktopView` liviana y declarativa.
 */
export function useNotebookDesktopKeyboard(deps: NotebookDesktopKeyboardDeps) {
  const {
    textareaRef,
    texto,
    lines,
    cursor,
    cursorSyncSeq,
    autocompleteIsOpen,
    activeItemId,
    setCursor,
    setTexto,
    undo,
    redo,
    forceOpenAutocomplete,
    dismissAutocomplete,
    moveAutocompleteSelection,
    acceptAutocomplete,
    handleTabKey,
    handleEnterKey,
    moveCurrentLine,
    duplicateCurrentLine,
    deleteCurrentLine,
    toggleCommentCurrentLine,
    valorizarItem,
    valorizarTodasPendientes,
    openCommandPalette,
    irASiguienteSinValorizar,
    guardar,
    toggleVistaPrevia,
    toggleAyudaAtajos,
    onRefreshScrollMetrics
  } = deps;

  const [pendingSelection, setPendingSelection] = useState<{ start: number; end: number } | null>(
    null
  );
  const latestCursorDataRef = useRef({ texto, cursor });
  latestCursorDataRef.current = { texto, cursor };

  useEffect(() => {
    if (cursorSyncSeq === 0 || !textareaRef.current) return;
    const { texto: currentTexto, cursor: currentCursor } = latestCursorDataRef.current;
    const startCol = currentCursor.selectionStartCol ?? currentCursor.columna;
    const start = getOffsetFromLineCol(currentTexto, currentCursor.linea, startCol);
    const end =
      currentCursor.selectionEndCol !== undefined
        ? getOffsetFromLineCol(currentTexto, currentCursor.linea, currentCursor.selectionEndCol)
        : start;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(start, end);
  }, [cursorSyncSeq, textareaRef]);

  useEffect(() => {
    if (!pendingSelection || !textareaRef.current) return;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(pendingSelection.start, pendingSelection.end);
    setPendingSelection(null);
  }, [pendingSelection, texto, textareaRef]);

  const moveDomCursor = useCallback(
    (textoActual: string, linea: number, startCol: number, endCol?: number) => {
      const start = getOffsetFromLineCol(textoActual, linea, startCol);
      const end = endCol !== undefined ? getOffsetFromLineCol(textoActual, linea, endCol) : start;
      setPendingSelection({ start, end });
    },
    []
  );

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const keyLower = e.key.toLowerCase();

      if (ctrl && keyLower === 'k' && !e.shiftKey) {
        e.preventDefault();
        openCommandPalette('');
        return;
      }
      if (ctrl && e.key === 'ArrowDown' && !e.altKey) {
        e.preventDefault();
        const next = irASiguienteSinValorizar();
        if (next) {
          moveDomCursor(texto, next.linea, 1);
        }
        return;
      }
      if (ctrl && keyLower === 's') {
        e.preventDefault();
        void guardar();
        return;
      }
      if (ctrl && keyLower === 'p') {
        e.preventDefault();
        toggleVistaPrevia();
        return;
      }
      if (
        e.key === '?' &&
        document.activeElement !== textareaRef.current &&
        !(document.activeElement instanceof HTMLInputElement) &&
        !(document.activeElement instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        toggleAyudaAtajos();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    textareaRef,
    texto,
    openCommandPalette,
    irASiguienteSinValorizar,
    guardar,
    toggleVistaPrevia,
    toggleAyudaAtajos,
    moveDomCursor
  ]);

  const syncCursorFromTextarea = useCallback(
    (el: HTMLTextAreaElement) => {
      const { linea, columna } = getLineColFromOffset(el.value, el.selectionStart ?? 0);
      setCursor(linea, columna);
    },
    [setCursor]
  );

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = e.target.value;
      const { linea, columna } = getLineColFromOffset(nextValue, e.target.selectionStart ?? 0);
      setTexto(nextValue, { linea, columna });
      onRefreshScrollMetrics();
    },
    [setTexto, onRefreshScrollMetrics]
  );

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const keyLower = e.key.toLowerCase();

      if (ctrl && !e.altKey && !e.shiftKey && keyLower === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (ctrl && !e.altKey && (keyLower === 'y' || (e.shiftKey && keyLower === 'z'))) {
        e.preventDefault();
        redo();
        return;
      }
      if (ctrl && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
        onRefreshScrollMetrics();
        forceOpenAutocomplete();
        return;
      }
      if (e.key === 'Escape' && autocompleteIsOpen) {
        e.preventDefault();
        e.stopPropagation();
        dismissAutocomplete();
        return;
      }
      if (ctrl && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        valorizarTodasPendientes();
        return;
      }
      if (ctrl && e.key === 'Enter') {
        e.preventDefault();
        if (activeItemId) {
          valorizarItem(activeItemId);
        }
        return;
      }
      if (ctrl && e.shiftKey && keyLower === 'k') {
        e.preventDefault();
        deleteCurrentLine();
        return;
      }
      if (ctrl && !e.shiftKey && keyLower === 'd') {
        e.preventDefault();
        duplicateCurrentLine();
        return;
      }
      if (ctrl && e.key === '/') {
        e.preventDefault();
        toggleCommentCurrentLine();
        return;
      }
      if (e.altKey && !ctrl && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        moveCurrentLine(e.key === 'ArrowUp' ? -1 : 1);
        return;
      }

      if (autocompleteIsOpen) {
        if (e.key === 'ArrowDown' && !ctrl) {
          e.preventDefault();
          moveAutocompleteSelection(1);
          return;
        }
        if (e.key === 'ArrowUp' && !ctrl) {
          e.preventDefault();
          moveAutocompleteSelection(-1);
          return;
        }
        if (e.key === 'Enter' && !ctrl && !e.shiftKey) {
          e.preventDefault();
          acceptAutocomplete();
          return;
        }
      }

      if (e.key === 'Enter' && !ctrl && !e.shiftKey && !e.altKey) {
        if (handleEnterKey()) {
          e.preventDefault();
          return;
        }
      }

      if (e.key === 'Home' && !ctrl && !e.shiftKey && !e.altKey) {
        const currentLineText = lines[Math.max(0, cursor.linea - 1)] ?? '';
        const firstNonSpaceCol = currentLineText.search(/\S/) + 1;
        if (firstNonSpaceCol > 1) {
          e.preventDefault();
          const targetCol = cursor.columna === firstNonSpaceCol ? 1 : firstNonSpaceCol;
          setCursor(cursor.linea, targetCol);
          moveDomCursor(texto, cursor.linea, targetCol);
          return;
        }
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        const res = handleTabKey(e.shiftKey);
        if (res.handled) {
          moveDomCursor(texto, res.linea, res.selectionStartCol ?? res.columna, res.selectionEndCol);
        }
      }
    },
    [
      undo,
      redo,
      onRefreshScrollMetrics,
      forceOpenAutocomplete,
      autocompleteIsOpen,
      dismissAutocomplete,
      valorizarTodasPendientes,
      activeItemId,
      valorizarItem,
      deleteCurrentLine,
      duplicateCurrentLine,
      toggleCommentCurrentLine,
      moveCurrentLine,
      moveAutocompleteSelection,
      acceptAutocomplete,
      handleEnterKey,
      lines,
      cursor.linea,
      cursor.columna,
      setCursor,
      moveDomCursor,
      texto,
      handleTabKey
    ]
  );

  const handleTextareaKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        autocompleteIsOpen &&
        (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Escape')
      ) {
        return;
      }
      syncCursorFromTextarea(e.currentTarget);
    },
    [autocompleteIsOpen, syncCursorFromTextarea]
  );

  return {
    moveDomCursor,
    syncCursorFromTextarea,
    handleTextareaChange,
    handleTextareaKeyDown,
    handleTextareaKeyUp
  };
}
