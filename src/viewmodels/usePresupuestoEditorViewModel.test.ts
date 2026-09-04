import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePresupuestoEditorViewModel } from './usePresupuestoEditorViewModel';
import { DEFAULT_APP_CONFIG } from '../core/sampleData';
import { TareaTipo } from '../core/types';
import { db } from '../db/database';

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

const emptyArray: any[] = [];
const mockInsumosMap = new Map<string, any>([
  ['mat-cable-2.5-marron', { id: 'mat-cable-2.5-marron', nombre: 'Cable 2.5', precioActual: 100, unidad: 'm' }],
  ['mat-caja-octogonal', { id: 'mat-caja-octogonal', nombre: 'Caja Octogonal', precioActual: 500, unidad: 'u' }]
]);

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => emptyArray
}));

vi.mock('../hooks/useInsumosMap', () => ({
  useInsumosMap: () => mockInsumosMap
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

  it('permite recalcular snapshots de insumos con los precios vigentes del catálogo', () => {
    const { result } = renderHook(() =>
      usePresupuestoEditorViewModel({
        config: DEFAULT_APP_CONFIG,
        onSaved: mockOnSaved
      })
    );

    act(() => {
      result.current.handleAddTareaTipoItem(mockTarea, 1);
    });

    expect(result.current.items.length).toBe(1);

    act(() => {
      result.current.handleRecalcularConPreciosVigentes();
    });

    expect(result.current.items[0].insumosSnapshot.length).toBe(2);
  });

  it('preserva fórmulas y materiales al editar un ítem libre in-situ', () => {
    const { result } = renderHook(() =>
      usePresupuestoEditorViewModel({
        config: DEFAULT_APP_CONFIG,
        onSaved: mockOnSaved
      })
    );

    act(() => {
      result.current.handleAddDirectItem();
    });

    expect(result.current.items.length).toBe(1);

    act(() => {
      result.current.handleOpenInSituEditorForExistingItem(0);
    });
    expect(result.current.showInSituEditorModal).toBe(true);

    // Guardar configuración in-situ con fórmulas personalizadas
    const customData = {
      nombre: 'Instalación Tablero Especial',
      categoria: 'Tableros',
      unidad: 'gl',
      notasTecnicas: 'Detalle de conexiones y térmicas',
      parametros: [{ id: 'circuitos', nombre: 'Cantidad de Circuitos', tipo: 'numero' as const, valorDefault: 6 }],
      variables: [{ id: 'factor', nombre: 'Factor', formula: 'circuitos * 1.5' }],
      insumos: [
        {
          insumoId: 'mat-cable-2.5-marron',
          cantidad: 1,
          formula: 'circuitos * 10'
        }
      ],
      manoObra: [
        {
          categoriaId: 'mo-oficial',
          horas: 1,
          formula: 'circuitos * 2'
        }
      ]
    };

    act(() => {
      result.current.handleSaveInSituItem(customData);
    });

    // Verificar que la partida guardó tareaTipoConfig con fórmulas
    expect(result.current.items[0].tareaTipoConfig).toBeDefined();
    expect(result.current.items[0].tareaTipoConfig?.insumos[0].formula).toBe('circuitos * 10');
    expect(result.current.items[0].tareaTipoConfig?.manoObra[0].formula).toBe('circuitos * 2');

    // Reabrir editor in-situ y comprobar que restaura fórmulas intactas
    act(() => {
      result.current.handleOpenInSituEditorForExistingItem(0);
    });

    expect(result.current.showInSituEditorModal).toBe(true);
    expect(result.current.editingTareaForInSituModal).toBeDefined();
    expect(result.current.editingTareaForInSituModal?.insumos[0].formula).toBe('circuitos * 10');
    expect(result.current.editingTareaForInSituModal?.manoObra[0].formula).toBe('circuitos * 2');
  });

  it('guarda automáticamente en borrador y ejecuta flushAutoSave', async () => {
    const mockDraftAutoSaved = vi.fn();
    const { result } = renderHook(() =>
      usePresupuestoEditorViewModel({
        config: DEFAULT_APP_CONFIG,
        onSaved: mockOnSaved,
        onDraftAutoSaved: mockDraftAutoSaved
      })
    );

    act(() => {
      result.current.handleAddDirectItem();
    });

    expect(result.current.items.length).toBe(1);

    await act(async () => {
      await result.current.flushAutoSave();
    });

    expect(db.presupuestos.put).toHaveBeenCalled();
    const savedPresupuesto = (db.presupuestos.put as any).mock.calls.at(-1)[0];
    expect(savedPresupuesto.estado).toBe('borrador');
    expect(savedPresupuesto.items.length).toBe(1);
    expect(mockDraftAutoSaved).toHaveBeenCalledWith(savedPresupuesto.id);
  });

  it('permite guardar un borrador aun sin cliente asignado', async () => {
    const { result } = renderHook(() =>
      usePresupuestoEditorViewModel({
        config: DEFAULT_APP_CONFIG,
        onSaved: mockOnSaved
      })
    );

    act(() => {
      result.current.handleAddDirectItem();
    });

    await act(async () => {
      await result.current.handleSavePresupuesto('borrador');
    });

    expect(db.presupuestos.put).toHaveBeenCalled();
    expect(mockOnSaved).toHaveBeenCalled();
  });
});

