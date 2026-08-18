import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfigViewModel } from './useConfigViewModel';
import { DEFAULT_APP_CONFIG } from '../core/sampleData';

// Mock contexts and database
vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn()
    }
  })
}));

vi.mock('../contexts/ConfirmContext', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true)
}));

vi.mock('../db/database', () => ({
  db: {
    config: {
      put: vi.fn().mockResolvedValue(1)
    },
    categoriasMaterial: {
      bulkPut: vi.fn().mockResolvedValue(1)
    },
    materiales: {
      bulkPut: vi.fn().mockResolvedValue(1)
    },
    manoObra: {
      bulkPut: vi.fn().mockResolvedValue(1)
    },
    costosIndirectos: {
      bulkPut: vi.fn().mockResolvedValue(1)
    }
  },
  resetDatabaseToDefaults: vi.fn().mockResolvedValue(undefined)
}));

describe('useConfigViewModel', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inicializa formData con la configuración pasada', () => {
    const { result } = renderHook(() =>
      useConfigViewModel({
        config: DEFAULT_APP_CONFIG,
        isOpen: true,
        onClose: mockOnClose,
        onSave: mockOnSave
      })
    );

    expect(result.current.formData.nombreEmpresa).toBe(DEFAULT_APP_CONFIG.nombreEmpresa);
    expect(result.current.formData.margenPorDefectoPct).toBe(DEFAULT_APP_CONFIG.margenPorDefectoPct);
  });

  it('permite actualizar campos individuales con updateFormData', () => {
    const { result } = renderHook(() =>
      useConfigViewModel({
        config: DEFAULT_APP_CONFIG,
        isOpen: true,
        onClose: mockOnClose,
        onSave: mockOnSave
      })
    );

    act(() => {
      result.current.updateFormData({ nombreEmpresa: 'Instalaciones Eléctricas Pro' });
    });

    expect(result.current.formData.nombreEmpresa).toBe('Instalaciones Eléctricas Pro');
  });

  it('permite agregar y eliminar categorías de tareas', async () => {
    const { result } = renderHook(() =>
      useConfigViewModel({
        config: DEFAULT_APP_CONFIG,
        isOpen: true,
        onClose: mockOnClose,
        onSave: mockOnSave
      })
    );

    act(() => {
      result.current.setNewCatName('Automatización Domótica');
    });

    act(() => {
      result.current.handleAddCategory();
    });

    expect(result.current.formData.categoriasTarea).toContain('Automatización Domótica');

    const index = result.current.formData.categoriasTarea!.indexOf('Automatización Domótica');
    await act(async () => {
      await result.current.handleDeleteCategory(index);
    });

    expect(result.current.formData.categoriasTarea).not.toContain('Automatización Domótica');
  });
});
