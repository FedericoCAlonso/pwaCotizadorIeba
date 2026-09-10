import React, { useRef, useMemo, useCallback } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { linter, lintGutter, Diagnostic } from '@codemirror/lint';
import {
  EditorView,
  ViewUpdate,
  MatchDecorator,
  ViewPlugin,
  Decoration,
  keymap
} from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import {
  DSLDiagnostic,
  findNextFillableField,
  detectSuggestTrigger,
  detectCursorContext,
  CursorContextType
} from './dslParser';

// ============================================================================
// 1. Estilo y Tema para CodeMirror 6 (Integrado con Tailwind y MD3)
// ============================================================================

const dslHighlightStyle = HighlightStyle.define([
  { tag: t.propertyName, color: '#0284c7', fontWeight: 'bold' },
  { tag: t.heading, color: '#2563eb', fontWeight: 'bold' },
  { tag: t.comment, color: '#059669', fontStyle: 'italic' },
  { tag: t.number, color: '#d97706', fontWeight: 'bold' },
  { tag: t.string, color: '#b45309' },
  { tag: t.punctuation, color: '#94a3b8' },
  { tag: t.operator, color: '#c026d3' }
]);

// Decorador incremental de alta velocidad para tokens especiales del DSL (Precios, Fórmulas, Marcas)
const dslSpecialTokenDecorator = new MatchDecorator({
  regexp: /(\$\s*[0-9]+(?:[.,][0-9]+)?)|(=[a-zA-Z0-9_.\s*+/-]+)|(\[[^\]]+\])/g,
  decoration: (match) => {
    if (match[1]) {
      return Decoration.mark({
        class: 'cm-dsl-price text-emerald-600 dark:text-emerald-400 font-bold font-mono'
      });
    }
    if (match[2]) {
      return Decoration.mark({
        class: 'cm-dsl-formula text-fuchsia-600 dark:text-fuchsia-400 font-mono font-medium'
      });
    }
    return Decoration.mark({
      class: 'cm-dsl-brand text-amber-500 dark:text-amber-300 font-semibold'
    });
  }
});

const dslTokensPlugin = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view: EditorView) {
      this.decorations = dslSpecialTokenDecorator.createDeco(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = dslSpecialTokenDecorator.updateDeco(update, this.decorations);
      }
    }
  },
  {
    decorations: (v) => v.decorations
  }
);

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    minHeight: '480px',
    fontSize: '13px',
    fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    backgroundColor: 'transparent'
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'inherit'
  },
  '.cm-content': {
    caretColor: 'var(--md-sys-color-primary, #3b82f6)',
    padding: '16px 12px',
    lineHeight: '24px'
  },
  '&.cm-focused': {
    outline: 'none'
  },
  '.cm-line': {
    padding: '0 4px',
    lineHeight: '24px'
  },
  '.cm-gutters': {
    backgroundColor: 'var(--md-sys-color-surface-container-lowest, rgba(0, 0, 0, 0.03))',
    color: 'var(--md-sys-color-on-surface-variant, #94a3b8)',
    borderRight: '1px solid var(--md-sys-color-outline-variant, rgba(0, 0, 0, 0.1))',
    padding: '16px 0',
    userSelect: 'none'
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 12px',
    minWidth: '2.75rem',
    lineHeight: '24px'
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(59, 130, 246, 0.08)'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: 'var(--md-sys-color-primary, #3b82f6)',
    fontWeight: 'bold'
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(59, 130, 246, 0.25) !important'
  },
  '.cm-foldGutter .cm-gutterElement': {
    cursor: 'pointer',
    opacity: 0.6,
    transition: 'opacity 0.15s ease',
    lineHeight: '24px'
  },
  '.cm-foldGutter .cm-gutterElement:hover': {
    opacity: 1,
    color: 'var(--md-sys-color-primary, #3b82f6)'
  },
  '.cm-tooltip': {
    borderRadius: '0.75rem',
    border: '1px solid var(--md-sys-color-outline-variant, #cbd5e1)',
    backgroundColor: 'var(--md-sys-color-surface-container, #f8fafc)',
    color: 'var(--md-sys-color-on-surface, #0f172a)',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
  },
  '.cm-tooltip-lint': {
    padding: '6px 10px',
    fontSize: '12px',
    lineHeight: '18px'
  }
});

// ============================================================================
// 2. Interfaz y Componente ModoExpertoCodeMirror
// ============================================================================

export interface SlashTriggerInfo {
  isOpen: boolean;
  query: string;
  pos?: { top: number; left: number };
  cursorPosition: number;
  slashIndex: number;
  contextType: CursorContextType;
  currentIndent: string;
  directiveType?: 'cliente' | 'obra' | 'factura' | 'validez' | 'margen' | 'riesgo' | 'dolar';
  isExplicit: boolean;
}

export interface ModoExpertoCodeMirrorProps {
  value: string;
  onChange: (value: string) => void;
  diagnostics?: DSLDiagnostic[];
  readOnly?: boolean;
  placeholder?: string;
  onEditorReady?: (view: EditorView) => void;
  onCursorChange?: (line: number, col: number, pos: number) => void;
  onNavigateField?: () => void;
  onSlashTrigger?: (info: SlashTriggerInfo) => void;
}

export const ModoExpertoCodeMirror: React.FC<ModoExpertoCodeMirrorProps> = ({
  value,
  onChange,
  diagnostics = [],
  readOnly = false,
  placeholder,
  onEditorReady,
  onCursorChange,
  onNavigateField,
  onSlashTrigger
}) => {
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const editorViewRef = useRef<EditorView | null>(null);

  // Linter reactivo conectado al motor de diagnóstico DSL
  const dslLinterExtension = useMemo(() => {
    return linter((view) => {
      const doc = view.state.doc;
      const cmDiagnostics: Diagnostic[] = [];

      for (const diag of diagnostics) {
        if (!diag.line || diag.line < 1 || diag.line > doc.lines) continue;
        const line = doc.line(diag.line);
        cmDiagnostics.push({
          from: line.from,
          to: line.to,
          severity: diag.type === 'error' ? 'error' : diag.type === 'warning' ? 'warning' : 'info',
          message: diag.message
        });
      }

      return cmDiagnostics;
    });
  }, [diagnostics]);

  // Keymaps personalizados (Alt+Enter para navegar al siguiente campo)
  const customKeymap = useMemo(() => {
    return keymap.of([
      {
        key: 'Alt-Enter',
        run: (view) => {
          if (onNavigateField) {
            onNavigateField();
            return true;
          }

          const doc = view.state.doc.toString();
          const curPos = view.state.selection.main.head;
          const nextField = findNextFillableField({
            text: doc,
            cursorPos: curPos,
            direction: 'forward'
          });

          if (nextField) {
            view.dispatch({
              selection: { anchor: nextField.start, head: nextField.end },
              scrollIntoView: true
            });
            return true;
          }
          return false;
        }
      }
    ]);
  }, [onNavigateField]);

  // Extensiones integradas de CodeMirror 6
  const extensions = useMemo(() => {
    return [
      yaml(),
      syntaxHighlighting(dslHighlightStyle),
      dslTokensPlugin,
      dslLinterExtension,
      lintGutter(),
      customKeymap,
      editorTheme
    ];
  }, [dslLinterExtension, customKeymap]);

  const handleUpdate = useCallback(
    (viewUpdate: ViewUpdate) => {
      const view = viewUpdate.view;
      const state = viewUpdate.state;
      const pos = state.selection.main.head;

      // Actualizar información de línea y columna
      const line = state.doc.lineAt(pos);
      const lineNum = line.number;
      const colNum = pos - line.from + 1;

      if (onCursorChange) {
        onCursorChange(lineNum, colNum, pos);
      }

      // Detectar trigger para menú contextual / autocompletado si el documento o la selección cambiaron
      if (onSlashTrigger && (viewUpdate.docChanged || viewUpdate.selectionSet)) {
        const lineTextBefore = line.text.slice(0, pos - line.from);
        const { currentIndent, contextType } = detectCursorContext(state.doc.sliceString(0, pos));
        const trigger = detectSuggestTrigger(lineTextBefore, contextType);

        if (trigger) {
          const coords = view.coordsAtPos(pos);
          const editorRect = view.dom.getBoundingClientRect();
          let top = 40;
          let left = 60;

          if (coords) {
            top = coords.bottom - editorRect.top + 8;
            left = Math.max(16, Math.min(coords.left - editorRect.left, editorRect.width - 340));
          }

          const slashIndex = line.from + trigger.queryIndexInLine;
          onSlashTrigger({
            isOpen: true,
            query: trigger.query,
            pos: { top, left },
            cursorPosition: pos,
            slashIndex,
            contextType,
            currentIndent,
            directiveType: trigger.directiveType,
            isExplicit: trigger.isExplicit
          });
        }
      }
    },
    [onCursorChange, onSlashTrigger]
  );

  const handleCreateEditor = useCallback(
    (view: EditorView) => {
      editorViewRef.current = view;
      if (onEditorReady) {
        onEditorReady(view);
      }
    },
    [onEditorReady]
  );

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest/30 focus-within:border-primary/40 transition-colors">
      <CodeMirror
        ref={cmRef}
        value={value}
        height="100%"
        minHeight="480px"
        readOnly={readOnly}
        editable={!readOnly}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          foldGutter: true,
          history: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false, // Usamos nuestro SlashCommandMenu enriquecido
          highlightActiveLine: true
        }}
        extensions={extensions}
        onChange={onChange}
        onUpdate={handleUpdate}
        onCreateEditor={handleCreateEditor}
      />
    </div>
  );
};
