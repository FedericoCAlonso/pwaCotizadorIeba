import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePresupuestoDetailViewModel } from './usePresupuestoDetailViewModel';
import { DEFAULT_APP_CONFIG } from '../core/sampleData';
import { Presupuesto } from '../core/types';

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

const { mockPresupuesto } = vi.hoisted(() => {
  const mockPresupuesto: Presupuesto = {
    id: 'pres-123',
    numero: 'IEBA-2026-0042',
    clienteId: 'cli-1',
    fechaEmision: new Date().toISOString(),
    validezDias: 15,
    tipoFactura: 'Factura C',
    items: [
      {
        id: 'it-1',
        descripcion: 'Boca de Iluminación',
        cantidad: 10,
        unidad: 'u',
        costoUnitario: 2500,
        costoInsumos: 150000,
        costoManoObra: 0,
        costoDirectoTotal: 25000,
        costoTotal: 25000,
        precioVentaUnitario: 3250,
        precioVentaTotal: 32500,
        insumosSnapshot: [
          {
            insumoId: 'mat-cable-2.5-marron',
            materialId: 'mat-cable-2.5-marron',
            nombre: 'Cable Unipolar 2.5 mm²',
            unidad: 'm',
            cantidadTotal: 150,
            precioUnitarioCongelado: 1000,
            subtotalInsumo: 150000
          }
        ],
        manoObraSnapshot: []
      }
    ],
    costosIndirectosConfig: [],
    costosIndirectosAplicados: [],
    subtotalInsumos: 150000,
    subtotalManoObra: 0,
    subtotalCostosDirectos: 150000,
    subtotalCostosIndirectos: 0,
    costoTotalObra: 150000,
    margenPorcentaje: 30,
    montoGanancia: 45000,
    impuestosDetalle: [],
    impuestosPorcentaje: 0,
    montoImpuestos: 0,
    mostrarReferenciaMonedaExtranjera: false,
    nombreMonedaExtranjera: 'Dólar Blue',
    cotizacionMonedaExtranjera: 1200,
    totalMonedaExtranjera: 0,
    condicionesPagoTexto: '',
    costoGlobal: 25000,
    precioFinalGlobal: 32500,
    totalARS: 32500,
    estado: 'borrador',
    fechaModificacion: new Date().toISOString(),
    deleted: false
  };
  return { mockPresupuesto };
});

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => [mockPresupuesto]
}));

vi.mock('../db/database', () => ({
  db: {
    presupuestos: {
      where: () => ({ toArray: vi.fn().mockResolvedValue([mockPresupuesto]) }),
      update: vi.fn().mockResolvedValue(1),
      delete: vi.fn().mockResolvedValue(1)
    },
    contactos: {
      toArray: vi.fn().mockResolvedValue([])
    },
    clientes: {
      toArray: vi.fn().mockResolvedValue([])
    },
    ofertas: {
      toArray: vi.fn().mockResolvedValue([
        { id: 'of-1', materialId: 'mat-cable-2.5-marron', precio: 1200, fecha: new Date().toISOString() }
      ])
    }
  }
}));

describe('usePresupuestoDetailViewModel', () => {
  const mockOnEdit = vi.fn();
  const mockOnDuplicate = vi.fn();
  const mockOnViewMaterials = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('obtiene los datos del presupuesto correctamente', () => {
    const { result } = renderHook(() =>
      usePresupuestoDetailViewModel({
        presupuestoId: 'pres-123',
        config: DEFAULT_APP_CONFIG,
        onEdit: mockOnEdit,
        onDuplicate: mockOnDuplicate,
        onViewMaterialsInCatalog: mockOnViewMaterials
      })
    );

    expect(result.current.presupuesto?.numero).toBe('IEBA-2026-0042');
  });

  it('permite cambiar el estado del presupuesto', async () => {
    const { result } = renderHook(() =>
      usePresupuestoDetailViewModel({
        presupuestoId: 'pres-123',
        config: DEFAULT_APP_CONFIG,
        onEdit: mockOnEdit,
        onDuplicate: mockOnDuplicate,
        onViewMaterialsInCatalog: mockOnViewMaterials
      })
    );

    await act(async () => {
      await result.current.handleUpdateStatus('aprobado');
    });

    expect(result.current.presupuesto).toBeDefined();
  });

  it('despacha el contexto de materiales al catálogo con IDs y cantidades de obra', () => {
    const { result } = renderHook(() =>
      usePresupuestoDetailViewModel({
        presupuestoId: 'pres-123',
        config: DEFAULT_APP_CONFIG,
        onEdit: mockOnEdit,
        onDuplicate: mockOnDuplicate,
        onViewMaterialsInCatalog: mockOnViewMaterials
      })
    );

    act(() => {
      result.current.handleOpenMaterialsInCatalog();
    });

    expect(mockOnViewMaterials).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cotización IEBA-2026-0042',
        materialIds: ['mat-cable-2.5-marron'],
        quantities: expect.objectContaining({
          'mat-cable-2.5-marron': { cantidad: 150, unidad: 'm' }
        })
      })
    );
  });
});
