import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { ModoExpertoCodeMirror } from './ModoExpertoCodeMirror';
import { DSLDiagnostic } from './dslParser';

describe('ModoExpertoCodeMirror', () => {
  it('renders correctly with initial YAML value and invokes onEditorReady', () => {
    const onEditorReady = vi.fn();
    const initialText = 'cliente: Juan Perez\nobra: Calle 123';

    const { container } = render(
      <ModoExpertoCodeMirror
        value={initialText}
        onChange={vi.fn()}
        onEditorReady={onEditorReady}
      />
    );

    expect(container.querySelector('.cm-editor')).toBeTruthy();
    expect(container.querySelector('.cm-content')).toBeTruthy();
    expect(onEditorReady).toHaveBeenCalled();
  });

  it('supports readOnly mode', () => {
    const { container } = render(
      <ModoExpertoCodeMirror
        value="cliente: Solo Lectura"
        onChange={vi.fn()}
        readOnly={true}
      />
    );

    const cmContent = container.querySelector('.cm-content');
    expect(cmContent?.getAttribute('contenteditable')).toBe('false');
  });

  it('accepts and processes diagnostics without throwing', () => {
    const diagnostics: DSLDiagnostic[] = [
      {
        line: 1,
        type: 'error',
        message: 'Directiva inválida'
      },
      {
        line: 2,
        type: 'warning',
        message: 'Se recomienda especificar precio'
      }
    ];

    const { container } = render(
      <ModoExpertoCodeMirror
        value="directiva_erronea: valor\n- 1 u Tarea"
        onChange={vi.fn()}
        diagnostics={diagnostics}
      />
    );

    expect(container.querySelector('.cm-editor')).toBeTruthy();
  });
});
