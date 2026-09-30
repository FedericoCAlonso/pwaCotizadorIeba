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

  it('no ejecuta auto-guardado si no hubo cambios reales', async () => {
    (db.presupuestos.put as any).mockClear();
    const mockDraftAutoSaved = vi.fn();
    const { result } = renderHook(() =>
      usePresupuestoEditorViewModel({
        config: DEFAULT_APP_CONFIG,
        onSaved: mockOnSaved,
        onDraftAutoSaved: mockDraftAutoSaved
      })
    );

    // Sin cambios, flushAutoSave no debe guardar nada
    await act(async () => {
      await result.current.flushAutoSave();
    });

    expect(db.presupuestos.put).not.toHaveBeenCalled();
    expect(mockDraftAutoSaved).not.toHaveBeenCalled();
  });

  it('actualiza los totales de la cotización cuando se carga costo a un ítem libre', () => {
    const { result } = renderHook(() =>
      usePresupuestoEditorViewModel({
        config: DEFAULT_APP_CONFIG,
        onSaved: mockOnSaved
      })
    );

    act(() => {
      result.current.handleAddDirectItem(undefined, 'Servicio de acometida libre');
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.totales.costoGlobal).toBe(0);

    // Actualizar el ítem con un costo directo base
    act(() => {
      const target = result.current.items[0];
      result.current.handleUpdateItem(0, {
        ...target,
        costoUnitario: 35000,
        costoDirectoTotal: 35000,
        costoManoObra: 35000,
        costoTotal: 35000
      });
    });

    expect(result.current.totales.costoGlobal).toBe(35000);
    expect(result.current.totales.itemsCalculados[0].costoDirectoTotal).toBe(35000);
    expect(result.current.totales.precioFinalGlobal).toBeGreaterThan(35000);
    expect(result.current.totales.itemsCalculados[0].precioVentaTotal).toBe(result.current.totales.precioFinalGlobal);
  });

  it('permite configurar un trabajo tipo paramétrico, guardando tareaTipoConfig y parametros, y re-editar sus parámetros sin perderlos', () => {
    const { result } = renderHook(() =>
      usePresupuestoEditorViewModel({
        config: DEFAULT_APP_CONFIG,
        onSaved: mockOnSaved
      })
    );

    const parametricTarea: TareaTipo = {
      id: 'tt-parametric-1',
      nombre: 'Instalación de Tablero Paramétrico',
      categoria: 'tableros',
      unidad: 'gl',
      parametros: [
        { id: 'bocas', nombre: 'Cantidad de Bocas', tipo: 'numero', valorDefault: 4 },
        { id: 'distancia', nombre: 'Distancia (m)', tipo: 'numero', valorDefault: 10 }
      ],
      insumos: [
        { materialId: 'mat-cable-2.5-marron', cantidad: 10, formula: 'bocas * 2.5' }
      ],
      manoObra: [
        { categoriaId: 'mo-oficial', horas: 2, formula: 'bocas * 0.5' }
      ]
    };

    // 1. Agregar el trabajo tipo paramétrico por primera vez
    act(() => {
      result.current.handleConfirmParametricJob(parametricTarea, {
        parametros: { bocas: 8, distancia: 20 },
        variables: {},
        calculos: {
          cantidadPrincipal: 1,
          valoresParametros: { bocas: 8, distancia: 20 },
          valoresVariables: {},
          scope: { bocas: 8, distancia: 20 },
          costoFijoOperativo: 0,
          costoInsumosTotal: 2000,
          costoManoObraTotal: 10000,
          costoServiciosTotal: 0,
          costoDirectoTotal: 12000,
          insumosSnapshot: [
            {
              materialId: 'mat-cable-2.5-marron',
              nombre: 'Cable 2.5',
              unidad: 'm',
              cantidadTotal: 20,
              precioUnitarioCongelado: 100,
              alicuotaIVA: 21,
              subtotalInsumo: 2000
            }
          ],
          manoObraSnapshot: [
            {
              categoriaId: 'mo-oficial',
              nombreCategoria: 'Oficial',
              horasTotales: 4,
              costoHoraCongelado: 2500,
              subtotalManoObra: 10000
            }
          ]
        },
        incluirClausula: false
      });
    });

    expect(result.current.items.length).toBe(1);
    const addedItem = result.current.items[0];
    expect(addedItem.tareaTipoConfig).toBeDefined();
    expect(addedItem.tareaTipoConfig?.id).toBe('tt-parametric-1');
    expect(addedItem.valoresParametros).toEqual({ bocas: 8, distancia: 20 });
    expect(addedItem.parametros?.length).toBe(2);
    expect(addedItem.parametros?.find(p => p.id === 'bocas')?.valor).toBe(8);
    expect(addedItem.parametros?.find(p => p.id === 'distancia')?.valor).toBe(20);

    // 2. Reabrir modal para el ítem existente: no debe quedar en blanco
    act(() => {
      result.current.handleOpenParametricModalForExistingItem(0);
    });

    expect(result.current.showParametricModal).toBe(true);
    expect(result.current.editingItemIndexForParametricModal).toBe(0);
    expect(result.current.selectedTareaForParametricModal).toBeDefined();
    expect(result.current.selectedTareaForParametricModal?.parametros?.length).toBe(2);

    // 3. Confirmar nueva parametrización sobre el ítem existente
    act(() => {
      result.current.handleConfirmParametricJob(parametricTarea, {
        parametros: { bocas: 12, distancia: 25 },
        variables: {},
        calculos: {
          cantidadPrincipal: 1,
          valoresParametros: { bocas: 12, distancia: 25 },
          valoresVariables: {},
          scope: { bocas: 12, distancia: 25 },
          costoFijoOperativo: 0,
          costoInsumosTotal: 3000,
          costoManoObraTotal: 15000,
          costoServiciosTotal: 0,
          costoDirectoTotal: 18000,
          insumosSnapshot: [
            {
              materialId: 'mat-cable-2.5-marron',
              nombre: 'Cable 2.5',
              unidad: 'm',
              cantidadTotal: 30,
              precioUnitarioCongelado: 100,
              alicuotaIVA: 21,
              subtotalInsumo: 3000
            }
          ],
          manoObraSnapshot: [
            {
              categoriaId: 'mo-oficial',
              nombreCategoria: 'Oficial',
              horasTotales: 6,
              costoHoraCongelado: 2500,
              subtotalManoObra: 15000
            }
          ]
        },
        incluirClausula: false
      });
    });

    expect(result.current.items.length).toBe(1);
    const updatedItem = result.current.items[0];
    expect(updatedItem.valoresParametros).toEqual({ bocas: 12, distancia: 25 });
    expect(updatedItem.parametros?.find(p => p.id === 'bocas')?.valor).toBe(12);
    expect(updatedItem.parametros?.find(p => p.id === 'distancia')?.valor).toBe(25);
    expect(updatedItem.costoDirectoTotal).toBe(18000);
    expect(result.current.showParametricModal).toBe(false);
  });
});


