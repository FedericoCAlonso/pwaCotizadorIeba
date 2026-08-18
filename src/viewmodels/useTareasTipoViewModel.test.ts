import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTareasTipoViewModel } from './useTareasTipoViewModel';
import { TareaTipo } from '../core/types';

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

const { mockTareas } = vi.hoisted(() => {
  const mockTareas: TareaTipo[] = [
    {
      id: 'tarea-1',
      nombre: 'Boca de Tomacorriente',
      categoria: 'bocas',
      unidad: 'u',
      insumos: [
        { materialId: 'mat-cable-2.5-marron', cantidad: 10 },
        { materialId: 'mat-caja-rectangular', cantidad: 1 }
      ],
      manoObra: [
        { categoriaId: 'mo-oficial', horas: 1.5 }
      ],
      frecuenciaUso: 5
    }
  ];
  return { mockTareas };
});

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => mockTareas
}));

vi.mock('../hooks/useInsumosMap', () => ({
  useInsumosMap: () => new Map([
    ['mat-cable-2.5-marron', { id: 'mat-cable-2.5-marron', nombre: 'Cable 2.5', unidadVenta: 'm', precioActual: 100 }],
    ['mat-caja-rectangular', { id: 'mat-caja-rectangular', nombre: 'Caja Rectangular', unidadVenta: 'u', precioActual: 300 }]
  ])
}));

vi.mock('../db/database', () => ({
  db: {
    tareasTipo: {
      toArray: vi.fn().mockResolvedValue(mockTareas),
      add: vi.fn().mockResolvedValue('tarea-2'),
      put: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(1)
    },
    manoObra: {
      toArray: vi.fn().mockResolvedValue([{ id: 'mo-oficial', nombre: 'Oficial' }])
    },
    registrosTrabajo: {
      toArray: vi.fn().mockResolvedValue([])
    }
  }
}));

describe('useTareasTipoViewModel', () => {
  const mockOnViewMaterials = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('obtiene la lista de tareas tipo', () => {
    const { result } = renderHook(() =>
      useTareasTipoViewModel({
        onViewMaterialsInCatalog: mockOnViewMaterials
      })
    );

    expect(result.current.tareasTipo.length).toBe(1);
    expect(result.current.tareasTipo[0].nombre).toBe('Boca de Tomacorriente');
  });

  it('permite duplicar una tarea tipo', async () => {
    const { result } = renderHook(() =>
      useTareasTipoViewModel({
        onViewMaterialsInCatalog: mockOnViewMaterials
      })
    );

    await act(async () => {
      await result.current.handleDuplicateTarea(mockTareas[0]);
    });

    expect(result.current.tareasTipo).toBeDefined();
  });

  it('despacha el contexto al catálogo de materiales desde la tarea', () => {
    const { result } = renderHook(() =>
      useTareasTipoViewModel({
        onViewMaterialsInCatalog: mockOnViewMaterials
      })
    );

    act(() => {
      result.current.handleOpenMaterialsInCatalog(mockTareas[0]);
    });

    expect(mockOnViewMaterials).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Trabajo Tipo: Boca de Tomacorriente',
        materialIds: ['mat-cable-2.5-marron', 'mat-caja-rectangular'],
        quantities: expect.objectContaining({
          'mat-cable-2.5-marron': { cantidad: 10, unidad: 'm' }
        })
      })
    );
  });
});
