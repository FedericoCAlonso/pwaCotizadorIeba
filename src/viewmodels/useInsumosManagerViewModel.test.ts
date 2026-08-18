import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInsumosManagerViewModel } from './useInsumosManagerViewModel';
import { Material, Producto, Oferta } from '../core/types';

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

const { mockMateriales, mockProductos, mockOfertas } = vi.hoisted(() => {
  const mockMateriales: Material[] = [
    { id: 'mat-cable-2.5-marron', nombre: 'Cable Unipolar 2.5 mm² Marrón', categoriaId: 'cat-cables', unidadVenta: 'm', atributos: [], activo: true },
    { id: 'mat-caja-octogonal', nombre: 'Caja Octogonal Chica Chapa', categoriaId: 'cat-cajas', unidadVenta: 'u', atributos: [], activo: true },
    { id: 'mat-termica-2x16', nombre: 'Interruptor Termomagnético 2x16A', categoriaId: 'cat-termicas', unidadVenta: 'u', atributos: [], activo: true }
  ];

  const mockProductos: Producto[] = [
    { id: 'prod-pirelli-2.5', materialId: 'mat-cable-2.5-marron', marca: 'Prysmian', modelo: 'Superastic', tierCalidad: 'premium', esPreferido: true }
  ];

  const mockOfertas: Oferta[] = [
    { id: 'of-1', materialId: 'mat-cable-2.5-marron', productoId: 'prod-pirelli-2.5', proveedorId: 'prov-1', precio: 1250, fecha: new Date().toISOString(), fuente: 'manual' }
  ];

  return { mockMateriales, mockProductos, mockOfertas };
});

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => mockMateriales
}));

vi.mock('../db/database', () => ({
  db: {
    materiales: {
      toArray: vi.fn().mockResolvedValue(mockMateriales),
      put: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(1)
    },
    productos: {
      toArray: vi.fn().mockResolvedValue(mockProductos),
      update: vi.fn().mockResolvedValue(1)
    },
    ofertas: {
      reverse: () => ({ toArray: vi.fn().mockResolvedValue(mockOfertas) }),
      toArray: vi.fn().mockResolvedValue(mockOfertas),
      bulkAdd: vi.fn().mockResolvedValue(1)
    },
    categoriasMaterial: {
      toArray: vi.fn().mockResolvedValue([{ id: 'cat-cables', nombre: 'Conductores' }])
    },
    contactos: {
      toArray: vi.fn().mockResolvedValue([])
    },
    proveedores: {
      toArray: vi.fn().mockResolvedValue([])
    },
    config: {
      toArray: vi.fn().mockResolvedValue([])
    }
  }
}));

describe('useInsumosManagerViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite seleccionar y deseleccionar materiales para acciones en lote', () => {
    const { result } = renderHook(() => useInsumosManagerViewModel());

    act(() => {
      result.current.handleToggleSelectMaterial('mat-cable-2.5-marron');
    });

    expect(result.current.selectedMaterialIds.has('mat-cable-2.5-marron')).toBe(true);

    act(() => {
      result.current.handleToggleSelectMaterial('mat-cable-2.5-marron');
    });

    expect(result.current.selectedMaterialIds.has('mat-cable-2.5-marron')).toBe(false);
  });

  it('permite alternar la selección de todos los materiales', () => {
    const { result } = renderHook(() => useInsumosManagerViewModel());

    act(() => {
      result.current.handleToggleSelectAll(mockMateriales);
    });

    expect(result.current.selectedMaterialIds.size).toBe(mockMateriales.length);

    act(() => {
      result.current.handleToggleSelectAll(mockMateriales);
    });

    expect(result.current.selectedMaterialIds.size).toBe(0);
  });

  it('filtra por término de búsqueda en memoria', () => {
    const { result } = renderHook(() => useInsumosManagerViewModel());

    act(() => {
      result.current.setSearchTerm('cable');
    });

    expect(result.current.searchTerm).toBe('cable');
  });
});
