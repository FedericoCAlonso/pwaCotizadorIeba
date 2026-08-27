import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePwaBackNavigation } from './usePwaBackNavigation';
import {
  registerModalInBackStack,
  clearModalBackStackForTests
} from '../core/modalBackStack';

describe('usePwaBackNavigation', () => {
  beforeEach(() => {
    clearModalBackStackForTests();
  });

  it('NO redirige a presupuestos cuando se guarda/cierra un modal desde la UI en la pestaña de tareasTipo', () => {
    const setActiveTab = vi.fn();
    const setViewMode = vi.fn();
    const onClearMaterialFilter = vi.fn();
    const toast = { info: vi.fn() };

    renderHook(() =>
      usePwaBackNavigation({
        activeTab: 'tareasTipo',
        setActiveTab,
        viewMode: 'list',
        setViewMode,
        materialFilterContext: null,
        onClearMaterialFilter,
        toast
      })
    );

    // Usuario abre modal de editar tarea tipo
    const onCloseModal = vi.fn();
    let unregister: () => void;
    act(() => {
      unregister = registerModalInBackStack('modal-tarea-1', onCloseModal);
      Object.defineProperty(window.history, 'state', {
        value: { isPwaModal: true, modalId: 'modal-tarea-1' },
        configurable: true
      });
    });

    // Usuario hace clic en "Guardar": modal se cierra por UI
    act(() => {
      unregister!();
      // Browser dispara popstate tras el history.back()
      window.dispatchEvent(new PopStateEvent('popstate', { state: { appRoot: true } }));
    });

    // NO debe haber cambiado la pestaña a 'presupuestos'
    expect(setActiveTab).not.toHaveBeenCalledWith('presupuestos');
    expect(setViewMode).not.toHaveBeenCalled();
  });

  it('NO resetea el viewMode de editor a list cuando se guarda/cierra un modal desde la UI dentro de un presupuesto', () => {
    const setActiveTab = vi.fn();
    const setViewMode = vi.fn();
    const onClearMaterialFilter = vi.fn();
    const toast = { info: vi.fn() };

    renderHook(() =>
      usePwaBackNavigation({
        activeTab: 'presupuestos',
        setActiveTab,
        viewMode: 'editor',
        setViewMode,
        materialFilterContext: null,
        onClearMaterialFilter,
        toast
      })
    );

    // Usuario abre modal para agregar gasto / insumo en el editor
    const onCloseModal = vi.fn();
    let unregister: () => void;
    act(() => {
      unregister = registerModalInBackStack('modal-gasto-1', onCloseModal);
      Object.defineProperty(window.history, 'state', {
        value: { isPwaModal: true, modalId: 'modal-gasto-1' },
        configurable: true
      });
    });

    // Usuario guarda el gasto
    act(() => {
      unregister!();
      window.dispatchEvent(new PopStateEvent('popstate', { state: { viewMode: 'editor', tab: 'presupuestos' } }));
    });

    // NO debe haber cambiado a list
    expect(setViewMode).not.toHaveBeenCalledWith('list');
  });

  it('cierra el modal cuando el usuario presiona el botón Atrás por hardware y no cambia de pestaña', () => {
    const setActiveTab = vi.fn();
    const setViewMode = vi.fn();
    const onClearMaterialFilter = vi.fn();
    const toast = { info: vi.fn() };

    renderHook(() =>
      usePwaBackNavigation({
        activeTab: 'contactos',
        setActiveTab,
        viewMode: 'list',
        setViewMode,
        materialFilterContext: null,
        onClearMaterialFilter,
        toast
      })
    );

    const onCloseModal = vi.fn();
    act(() => {
      registerModalInBackStack('modal-cliente-1', onCloseModal);
    });

    // Usuario presiona Atrás en Android/PWA
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { appRoot: true } }));
    });

    // Se debe haber llamado a onClose del modal y NO haber redirigido a presupuestos
    expect(onCloseModal).toHaveBeenCalledTimes(1);
    expect(setActiveTab).not.toHaveBeenCalledWith('presupuestos');
  });
});
