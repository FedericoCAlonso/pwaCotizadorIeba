import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  let defaultProps: Parameters<typeof useKeyboardShortcuts>[0];

  beforeEach(() => {
    defaultProps = {
      activeTab: 'presupuestos',
      viewMode: 'editor',
      setActiveTab: vi.fn(),
      setViewMode: vi.fn(),
      onNewPresupuesto: vi.fn(),
      onOpenShortcutsModal: vi.fn(),
      isAnyModalOpen: false,
      onCloseActiveModals: vi.fn()
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('previene la navegación de retroceso (e.preventDefault) cuando se presiona Backspace fuera de un campo editable', () => {
    renderHook(() => useKeyboardShortcuts(defaultProps));

    const div = document.createElement('div');
    document.body.appendChild(div);

    const event = new KeyboardEvent('keydown', {
      key: 'Backspace',
      bubbles: true,
      cancelable: true
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    div.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    document.body.removeChild(div);
  });

  it('NO bloquea Backspace (permite borrar caracteres) cuando el foco está dentro de un INPUT o TEXTAREA', () => {
    renderHook(() => useKeyboardShortcuts(defaultProps));

    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = new KeyboardEvent('keydown', {
      key: 'Backspace',
      bubbles: true,
      cancelable: true
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    input.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('dispara el evento app:shortcut-save al presionar Ctrl+S', () => {
    renderHook(() => useKeyboardShortcuts(defaultProps));

    const listener = vi.fn();
    window.addEventListener('app:shortcut-save', listener);

    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(listener).toHaveBeenCalled();

    window.removeEventListener('app:shortcut-save', listener);
  });

  it('cierra modal activo con Escape si hay modal abierto', () => {
    renderHook(() =>
      useKeyboardShortcuts({
        ...defaultProps,
        isAnyModalOpen: true
      })
    );

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    });

    window.dispatchEvent(event);

    expect(defaultProps.onCloseActiveModals).toHaveBeenCalled();
    expect(defaultProps.setViewMode).not.toHaveBeenCalled();
  });

  it('cambia a pestaña correspondiente con Alt+2', () => {
    renderHook(() => useKeyboardShortcuts(defaultProps));

    const event = new KeyboardEvent('keydown', {
      key: '2',
      altKey: true,
      bubbles: true,
      cancelable: true
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(defaultProps.setActiveTab).toHaveBeenCalledWith('insumos');
    expect(defaultProps.setViewMode).toHaveBeenCalledWith('list');
  });
});
