import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePresupuestoEditorViewModel } from './usePresupuestoEditorViewModel';
import { DEFAULT_APP_CONFIG } from '../core/sampleData';
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

const { mockTarea } = vi.hoisted(() => {
  const mockTarea: TareaTipo = {
    id: 'tarea-boca-ilum',
    nombre: 'Boca de Iluminación',
    categoria: 'bocas',
    unidad: 'u',
    insumos: [
      { materialId: 'mat-cable-2.5-marron', cantidad: 15 },
      { materialId: 'mat-caja-octogonal', cantidad: 1 }
    ],
    manoObra: [
      { categoriaId: 'mo-oficial', horas: 2 }
    ]
  };
  return { mockTarea };
});

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => []
}));

vi.mock('../hooks/useInsumosMap', () => ({
  useInsumosMap: () => new Map([
    ['mat-cable-2.5-marron', { id: 'mat-cable-2.5-marron', nombre: 'Cable 2.5', precioActual: 100, unidad: 'm' }],
    ['mat-caja-octogonal', { id: 'mat-caja-octogonal', nombre: 'Caja Octogonal', precioActual: 500, unidad: 'u' }]
  ])
}));

vi.mock('../db/database', () => ({
  db: {
    presupuestos: {
      put: vi.fn().mockResolvedValue(1),
      where: () => ({ toArray: vi.fn().mockResolvedValue([]) })
    },
    config: {
      update: vi.fn().mockResolvedValue(1)
    },
    contactos: {
      toArray: vi.fn().mockResolvedValue([])
    },
    clientes: {
      toArray: vi.fn().mockResolvedValue([])
    },
    tareasTipo: {
      toArray: vi.fn().mockResolvedValue([mockTarea])
    },
    manoObra: {
      toArray: vi.fn().mockResolvedValue([{ id: 'mo-oficial', nombre: 'Oficial', costoHora: 2500 }])
    },
    costosIndirectos: {
      toArray: vi.fn().mockResolvedValue([])
    }
  }
}));

describe('usePresupuestoEditorViewModel', () => {
  const mockOnSaved = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inicializa un presupuesto nuevo con número correlativo y tipo de factura por defecto', () => {
    const { result } = renderHook(() =>
      usePresupuestoEditorViewModel({
        config: DEFAULT_APP_CONFIG,
        onSaved: mockOnSaved
      })
    );

    expect(result.current.numero).toContain('IEBA-');
    expect(result.current.tipoFactura).toBe(DEFAULT_APP_CONFIG.tipoFacturaPorDefecto);
    expect(result.current.items.length).toBe(0);
  });

  it('permite agregar ítems de Tareas Tipo con snapshots calculados', () => {
    const { result } = renderHook(() =>
      usePresupuestoEditorViewModel({
        config: DEFAULT_APP_CONFIG,
        onSaved: mockOnSaved
      })
    );

    act(() => {
      result.current.handleAddTareaTipoItem(mockTarea, 3);
    });

    expect(result.current.items.length).toBe(1);
    expect(result.current.items[0].descripcion).toBe('Boca de Iluminación');
    expect(result.current.items[0].cantidad).toBe(3);
    expect(result.current.items[0].insumosSnapshot.length).toBe(2);
  });

  it('calcula totales y margen en tiempo real al agregar partidas', () => {
    const { result } = renderHook(() =>
      usePresupuestoEditorViewModel({
        config: DEFAULT_APP_CONFIG,
        onSaved: mockOnSaved
      })
    );

    act(() => {
      result.current.handleAddTareaTipoItem(mockTarea, 1);
    });

    expect(result.current.totales.costoGlobal).toBeGreaterThan(0);
    expect(result.current.totales.itemsCalculados.length).toBe(1);
    expect(result.current.totales.itemsCalculados[0].costoDirectoTotal).toBeGreaterThan(0);
  });
});
