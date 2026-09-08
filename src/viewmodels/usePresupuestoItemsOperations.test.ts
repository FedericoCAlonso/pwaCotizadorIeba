import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePresupuestoItemsOperations } from './usePresupuestoItemsOperations';
import { DEFAULT_APP_CONFIG } from '../core/sampleData';
import { ItemPresupuesto, CategoriaManoDeObra, Insumo } from '../core/types';

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

describe('usePresupuestoItemsOperations', () => {
  const mockManoObraMap = new Map<string, CategoriaManoDeObra>([
    [
      'mo-oficial',
      { id: 'mo-oficial', nombre: 'Oficial Electricista', costoHora: 5000, fechaActualizacion: '2026-01-01' }
    ],
    [
      'mo-ayudante',
      { id: 'mo-ayudante', nombre: 'Ayudante', costoHora: 3000, fechaActualizacion: '2026-01-01' }
    ]
  ]);

  const initialItem: ItemPresupuesto = {
    id: 'item-1',
    descripcion: 'Instalación de Tablero',
    unidad: 'u',
    cantidad: 1,
    costoUnitario: 10000,
    costoTotal: 10000,
    costoDirectoTotal: 10000,
    costoInsumos: 2000,
    costoManoObra: 8000,
    costoServiciosTercerizados: 0,
    precioVentaUnitario: 12000,
    precioVentaTotal: 12000,
    insumosSnapshot: [
      {
        insumoId: 'mat-termomagnetica',
        materialId: 'mat-termomagnetica',
        nombre: 'Termomagnética 2x16A',
        unidad: 'u',
        cantidadTotal: 1,
        cantidadUnitaria: 1,
        precioUnitarioCongelado: 2000,
        subtotalInsumo: 2000
      }
    ],
    manoObraSnapshot: [
      {
        categoriaId: 'mo-oficial',
        nombreCategoria: 'Oficial Electricista',
        horasTotales: 1.6,
        horasUnitarias: 1.6,
        costoHoraCongelado: 5000,
        subtotalManoObra: 8000
      }
    ]
  };

  it('actualiza la cantidad recalculando proporcionalmente snapshots de insumos y mano de obra', () => {
    let itemsState = [initialItem];
    const setItems = vi.fn((updater) => {
      itemsState = typeof updater === 'function' ? updater(itemsState) : updater;
    });

    const { result } = renderHook(() =>
      usePresupuestoItemsOperations({
        items: itemsState,
        setItems,
        config: DEFAULT_APP_CONFIG,
        tipoFactura: 'Factura B',
        manoObraMap: mockManoObraMap
      })
    );

    act(() => {
      result.current.handleUpdateItemQuantity(0, 2);
    });

    expect(itemsState[0].cantidad).toBe(2);
    expect(itemsState[0].insumosSnapshot?.[0].cantidadTotal).toBe(2);
    expect(itemsState[0].manoObraSnapshot?.[0].horasTotales).toBe(3.2);
    expect(itemsState[0].costoDirectoTotal).toBe(20000);
  });

  it('aplica multiplicador según condición de trabajo (favorable, dificultosa)', () => {
    let itemsState = [initialItem];
    const setItems = vi.fn((updater) => {
      itemsState = typeof updater === 'function' ? updater(itemsState) : updater;
    });

    const { result } = renderHook(() =>
      usePresupuestoItemsOperations({
        items: itemsState,
        setItems,
        config: {
          ...DEFAULT_APP_CONFIG,
          multiplicadorCondicionDificultosa: 1.25
        },
        tipoFactura: 'Factura B',
        manoObraMap: mockManoObraMap
      })
    );

    act(() => {
      result.current.handleUpdateItemCondicion(0, 'dificultosa');
    });

    expect(itemsState[0].condicionTrabajo).toBe('dificultosa');
    // Horas con multiplicador 1.25 -> 1.6 * 1.25 = 2 horas
    expect(itemsState[0].manoObraSnapshot?.[0].subtotalManoObra).toBe(10000);
  });

  it('agrega nuevo material a la partida', () => {
    let itemsState = [initialItem];
    const setItems = vi.fn((updater) => {
      itemsState = typeof updater === 'function' ? updater(itemsState) : updater;
    });

    const { result } = renderHook(() =>
      usePresupuestoItemsOperations({
        items: itemsState,
        setItems,
        config: DEFAULT_APP_CONFIG,
        tipoFactura: 'Factura B',
        manoObraMap: mockManoObraMap
      })
    );

    const nuevoMaterial: Insumo = {
      id: 'mat-cable-4',
      nombre: 'Cable 4mm',
      categoriaId: 'cat-conductores',
      precioActual: 500,
      unidad: 'm',
      unidadVenta: 'm',
      atributos: [],
      activo: true
    };

    act(() => {
      result.current.handleAddMaterialsToItem(0, [{ material: nuevoMaterial, cantidad: 10 }]);
    });

    expect(itemsState[0].insumosSnapshot?.length).toBe(2);
    expect(itemsState[0].insumosSnapshot?.[1].nombre).toBe('Cable 4mm');
    expect(itemsState[0].insumosSnapshot?.[1].subtotalInsumo).toBe(5000);
  });

  it('agrega rol de mano de obra a la partida', () => {
    let itemsState = [initialItem];
    const setItems = vi.fn((updater) => {
      itemsState = typeof updater === 'function' ? updater(itemsState) : updater;
    });

    const { result } = renderHook(() =>
      usePresupuestoItemsOperations({
        items: itemsState,
        setItems,
        config: DEFAULT_APP_CONFIG,
        tipoFactura: 'Factura B',
        manoObraMap: mockManoObraMap
      })
    );

    act(() => {
      result.current.handleAddLaborToItem(0, 'mo-ayudante', 2);
    });

    expect(itemsState[0].manoObraSnapshot?.length).toBe(2);
    expect(itemsState[0].manoObraSnapshot?.[1].categoriaId).toBe('mo-ayudante');
    expect(itemsState[0].manoObraSnapshot?.[1].subtotalManoObra).toBe(6000);
  });
});
