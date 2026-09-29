import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTreeSheetViewModel } from './useTreeSheetViewModel';
import {
  ItemPresupuesto,
  CapituloPresupuesto,
  TareaTipo
} from '../core/types';
import { TotalesPresupuestoResultado } from '../core/calculations';

describe('useTreeSheetViewModel - Árbol-Planilla de Cotización', () => {
  const mockCapitulos: CapituloPresupuesto[] = [
    { id: 'cap-1', nombre: 'Demoliciones', orden: 1 },
    { id: 'cap-2', nombre: 'Instalaciones Eléctricas', orden: 2 }
  ];

  const mockItems: ItemPresupuesto[] = [
    {
      id: 'it-1',
      capituloId: 'cap-1',
      descripcion: 'Picado de revoques',
      cantidad: 10,
      unidad: 'm2',
      costoInsumos: 0,
      costoManoObra: 20000,
      costoDirectoTotal: 20000,
      precioVentaUnitario: 3000,
      precioVentaTotal: 30000,
      insumosSnapshot: [],
      manoObraSnapshot: []
    },
    {
      id: 'it-2',
      capituloId: 'cap-2',
      descripcion: 'Boca de iluminación',
      cantidad: 15,
      unidad: 'boca',
      costoInsumos: 50000,
      costoManoObra: 60000,
      costoDirectoTotal: 110000,
      precioVentaUnitario: 10000,
      precioVentaTotal: 150000,
      insumosSnapshot: [],
      manoObraSnapshot: []
    }
  ];

  const mockTotales: TotalesPresupuestoResultado = {
    subtotalInsumos: 50000,
    subtotalManoObra: 80000,
    subtotalServiciosTercerizados: 0,
    subtotalCostosDirectos: 130000,
    montoMargenRiesgo: 6500,
    costoGlobal: 136500,
    subtotalCostosIndirectos: 15000,
    gastosGeneralesTotal: 15000,
    costoTotalObra: 151500,
    beneficioMonto: 30000,
    subtotalSinImpuestos: 181500,
    montoImpuestos: 38115,
    montoImpuestosTotal: 38115,
    precioFinalGlobal: 219615,
    coeficienteK: 1.689,
    totalARS: 219615
  } as any;

  const createHook = (initialItems = mockItems, initialCapitulos = mockCapitulos) => {
    let items = initialItems;
    let capitulos = initialCapitulos;

    const setItems = vi.fn((updater) => {
      items = typeof updater === 'function' ? updater(items) : updater;
    });

    const setCapitulos = vi.fn((updater) => {
      capitulos = typeof updater === 'function' ? updater(capitulos) : updater;
    });

    const hook = renderHook(() =>
      useTreeSheetViewModel({
        items,
        setItems,
        capitulos,
        setCapitulos,
        totales: mockTotales
      })
    );

    return { hook, getItems: () => items, getCapitulos: () => capitulos };
  };

  it('inicializa correctamente las filas visibles jerárquicas y modos por defecto', () => {
    const { hook } = createHook();

    expect(hook.result.current.totalViewMode).toBe('costo');
    expect(hook.result.current.collapsedChapters.size).toBe(0);

    // Filas visibles esperadas: Capítulo 1, Ítem 1, Capítulo 2, Ítem 2
    const rows = hook.result.current.visibleRows;
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ type: 'chapter', id: 'cap-1' });
    expect(rows[1]).toMatchObject({ type: 'item', id: 'it-1' });
    expect(rows[2]).toMatchObject({ type: 'chapter', id: 'cap-2' });
    expect(rows[3]).toMatchObject({ type: 'item', id: 'it-2' });
  });

  it('permite alternar el modo de visualización de totales (costo vs precio)', () => {
    const { hook } = createHook();

    expect(hook.result.current.totalViewMode).toBe('costo');
    act(() => {
      hook.result.current.toggleTotalViewMode();
    });
    expect(hook.result.current.totalViewMode).toBe('precio');
    act(() => {
      hook.result.current.toggleTotalViewMode();
    });
    expect(hook.result.current.totalViewMode).toBe('costo');
  });

  it('pliega capítulos y oculta sus ítems de las filas visibles', () => {
    const { hook } = createHook();

    act(() => {
      hook.result.current.toggleChapterCollapse('cap-1');
    });

    expect(hook.result.current.collapsedChapters.has('cap-1')).toBe(true);

    // Al estar plegado cap-1, it-1 no aparece en visibleRows
    const rows = hook.result.current.visibleRows;
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.id)).toEqual(['cap-1', 'cap-2', 'it-2']);
  });

  it('inicia, actualiza y confirma edición de celda de descripción y cantidad', () => {
    const { hook, getItems } = createHook();

    // 1. Iniciar edición de descripción
    act(() => {
      hook.result.current.handleStartEditCell('it-1', 'descripcion');
    });

    expect(hook.result.current.editingCell).toEqual({
      itemId: 'it-1',
      field: 'descripcion',
      value: 'Picado de revoques'
    });

    // 2. Modificar texto
    act(() => {
      hook.result.current.handleUpdateEditingCellValue('Demolición integral de mampostería');
    });

    expect(hook.result.current.editingCell?.value).toBe('Demolición integral de mampostería');

    // 3. Confirmar cambio
    act(() => {
      hook.result.current.handleCommitEditCell('it-1', 'descripcion', 'Demolición integral de mampostería');
    });

    expect(hook.result.current.editingCell).toBeNull();
    const updatedItem = getItems().find((i) => i.id === 'it-1');
    expect(updatedItem?.descripcion).toBe('Demolición integral de mampostería');
  });

  it('navega filas visibles con flechas de teclado (ArrowDown, ArrowUp)', () => {
    const { hook } = createHook();

    // Seleccionar primera fila (cap-1)
    act(() => {
      hook.result.current.handleSelectRow(null, 'cap-1');
    });

    // Flecha abajo: pasa a it-1
    act(() => {
      hook.result.current.handleKeyDown({
        key: 'ArrowDown',
        preventDefault: vi.fn()
      } as any);
    });

    expect(hook.result.current.selectedItemId).toBe('it-1');

    // Flecha abajo: pasa a cap-2
    act(() => {
      hook.result.current.handleKeyDown({
        key: 'ArrowDown',
        preventDefault: vi.fn()
      } as any);
    });

    expect(hook.result.current.selectedChapterId).toBe('cap-2');
    expect(hook.result.current.selectedItemId).toBeNull();
  });

  it('crea un ítem hermano con Enter y activa edición de descripción', () => {
    const { hook, getItems } = createHook();

    // Seleccionar it-1
    act(() => {
      hook.result.current.handleSelectRow('it-1', 'cap-1');
    });

    // Presionar Enter sin estar editando celda: crea hermano en cap-1
    act(() => {
      hook.result.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn()
      } as any);
    });

    const items = getItems();
    expect(items).toHaveLength(3);
    const newItem = items[1]; // Ubicado inmediatamente después de it-1
    expect(newItem.capituloId).toBe('cap-1');
    expect(hook.result.current.selectedItemId).toBe(newItem.id);
    expect(hook.result.current.editingCell).toMatchObject({
      itemId: newItem.id,
      field: 'descripcion'
    });
  });

  it('desacopla automáticamente un ítem vinculado a tarea tipo al editar sus líneas', () => {
    const itemVinculado: ItemPresupuesto = {
      id: 'it-linked',
      capituloId: 'cap-2',
      descripcion: 'Circuito nuevo',
      cantidad: 1,
      unidad: 'u',
      tipoItem: 'tarea_tipo',
      tareaTipoId: 'tt-circuito',
      tareaTipoVersion: 1,
      desacoplado: false,
      costoInsumos: 1000,
      costoManoObra: 1000,
      costoDirectoTotal: 2000,
      precioVentaUnitario: 3000,
      precioVentaTotal: 3000,
      insumosSnapshot: [{ insumoId: 'cable', nombre: 'Cable', unidad: 'm', cantidadUnitaria: 10, cantidadTotal: 10, precioUnitarioCongelado: 100, subtotalInsumo: 1000 }],
      manoObraSnapshot: []
    };

    const { hook, getItems } = createHook([itemVinculado]);

    // Modificar líneas
    act(() => {
      hook.result.current.handleUpdateItemLines('it-linked', {
        insumosSnapshot: [
          ...itemVinculado.insumosSnapshot,
          { insumoId: 'termica', nombre: 'Térmica 16A', unidad: 'u', cantidadUnitaria: 1, cantidadTotal: 1, precioUnitarioCongelado: 5000, subtotalInsumo: 5000 }
        ]
      });
    });

    const updated = getItems().find((i) => i.id === 'it-linked');
    expect(updated?.desacoplado).toBe(true);
    expect(updated?.insumosSnapshot).toHaveLength(2);
  });

  it('abre y cierra la paleta de comandos con Ctrl+K', () => {
    const { hook } = createHook();

    expect(hook.result.current.isCommandPaletteOpen).toBe(false);

    act(() => {
      hook.result.current.handleKeyDown({
        key: 'k',
        ctrlKey: true,
        preventDefault: vi.fn()
      } as any);
    });

    expect(hook.result.current.isCommandPaletteOpen).toBe(true);

    act(() => {
      hook.result.current.setIsCommandPaletteOpen(false);
    });

    expect(hook.result.current.isCommandPaletteOpen).toBe(false);
  });

  it('permite alternar la expansión de una partida para ver su lista hija', () => {
    const { hook } = createHook();

    expect(hook.result.current.expandedItems.has('it-1')).toBe(false);

    act(() => {
      hook.result.current.toggleItemExpand('it-1');
    });

    expect(hook.result.current.expandedItems.has('it-1')).toBe(true);

    act(() => {
      hook.result.current.toggleItemExpand('it-1');
    });

    expect(hook.result.current.expandedItems.has('it-1')).toBe(false);
  });

  it('agrega, actualiza y elimina materiales inline recalculando subtotales', () => {
    const mockInsumo: any = {
      id: 'ins-cable-25',
      nombre: 'Cable Unipolar 2.5mm',
      precioActual: 800,
      unidad: 'm'
    };

    const { hook, getItems } = createHook();

    // Agregar material
    act(() => {
      hook.result.current.handleAddMaterialToItem('it-1', mockInsumo, 20);
    });

    let item = getItems().find((i) => i.id === 'it-1');
    expect(item?.insumosSnapshot).toHaveLength(1);
    expect(item?.insumosSnapshot[0].nombre).toBe('Cable Unipolar 2.5mm');
    expect(item?.insumosSnapshot[0].cantidadTotal).toBe(20);
    expect(item?.insumosSnapshot[0].precioUnitarioCongelado).toBe(800);
    expect(item?.insumosSnapshot[0].subtotalInsumo).toBe(16000);

    // Actualizar fórmula
    act(() => {
      hook.result.current.handleUpdateMaterialFormula('it-1', 0, '= 50');
    });

    item = getItems().find((i) => i.id === 'it-1');
    expect(item?.insumosSnapshot[0].formulaCantidad).toBe('= 50');

    // Eliminar material
    act(() => {
      hook.result.current.handleRemoveMaterialFromItem('it-1', 0);
    });

    item = getItems().find((i) => i.id === 'it-1');
    expect(item?.insumosSnapshot).toHaveLength(0);
  });

  it('agrega y elimina mano de obra inline con cálculo horario', () => {
    const mockCategoriasMO = new Map([
      ['cat-oficial', { id: 'cat-oficial', nombre: 'Oficial Electricista', costoHora: 7500 } as any]
    ]);

    let items = mockItems;
    const setItems = vi.fn((updater) => {
      items = typeof updater === 'function' ? updater(items) : updater;
    });

    const hook = renderHook(() =>
      useTreeSheetViewModel({
        items,
        setItems,
        capitulos: mockCapitulos,
        setCapitulos: vi.fn(),
        totales: mockTotales,
        manoObraMap: mockCategoriasMO
      })
    );

    // Agregar mano de obra
    act(() => {
      hook.result.current.handleAddLaborToItem('it-1', 'cat-oficial', 4);
    });

    let item = items.find((i) => i.id === 'it-1');
    expect(item?.manoObraSnapshot).toHaveLength(1);
    expect(item?.manoObraSnapshot[0].nombreCategoria).toBe('Oficial Electricista');
    expect(item?.manoObraSnapshot[0].horasTotales).toBe(4);
    expect(item?.manoObraSnapshot[0].subtotalManoObra).toBe(30000);

    // Eliminar mano de obra
    act(() => {
      hook.result.current.handleRemoveLaborFromItem('it-1', 0);
    });

    item = items.find((i) => i.id === 'it-1');
    expect(item?.manoObraSnapshot).toHaveLength(0);
  });

  it('agrega y elimina servicios tercerizados inline', () => {
    const { hook, getItems } = createHook();

    act(() => {
      hook.result.current.handleAddServiceToItem('it-1', 'Zanjeo mecanizado', 45000);
    });

    let item = getItems().find((i) => i.id === 'it-1');
    expect(item?.serviciosTercerizados).toHaveLength(1);
    expect(item?.serviciosTercerizados?.[0].descripcion).toBe('Zanjeo mecanizado');
    expect(item?.serviciosTercerizados?.[0].costo).toBe(45000);

    act(() => {
      hook.result.current.handleRemoveServiceFromItem('it-1', 0);
    });

    item = getItems().find((i) => i.id === 'it-1');
    expect(item?.serviciosTercerizados).toHaveLength(0);
  });

  it('gestiona el colapso del inspector lateral y el modal de catálogo de materiales', () => {
    const { hook } = createHook();

    expect(hook.result.current.isInspectorCollapsed).toBe(false);
    act(() => {
      hook.result.current.toggleInspectorCollapsed();
    });
    expect(hook.result.current.isInspectorCollapsed).toBe(true);

    expect(hook.result.current.materialPickerItemId).toBeNull();
    act(() => {
      hook.result.current.handleOpenMaterialPicker('it-1');
    });
    expect(hook.result.current.materialPickerItemId).toBe('it-1');

    act(() => {
      hook.result.current.handleCloseMaterialPicker();
    });
    expect(hook.result.current.materialPickerItemId).toBeNull();
  });

  it('navega fluidamente entre celdas (Tab y Shift+Tab) y crea fila automáticamente al final', () => {
    const { hook } = createHook();

    // 1. Iniciar en descripción del primer ítem
    act(() => {
      hook.result.current.handleStartEditCell('it-1', 'descripcion', 'Demolición manual');
    });
    expect(hook.result.current.editingCell).toMatchObject({
      itemId: 'it-1',
      field: 'descripcion'
    });

    // 2. Tab desde descripción -> debe saltar a cantidad del mismo ítem
    act(() => {
      hook.result.current.handleNavigateCell('next', 'descripcion');
    });
    expect(hook.result.current.editingCell).toMatchObject({
      itemId: 'it-1',
      field: 'cantidad'
    });

    // 3. Tab desde cantidad -> debe saltar a descripción del siguiente ítem (it-2)
    act(() => {
      hook.result.current.handleNavigateCell('next', 'cantidad');
    });
    expect(hook.result.current.editingCell).toMatchObject({
      itemId: 'it-2',
      field: 'descripcion'
    });

    // 4. Shift+Tab desde descripción de it-2 -> debe volver a cantidad de it-1
    act(() => {
      hook.result.current.handleNavigateCell('prev', 'descripcion');
    });
    expect(hook.result.current.editingCell).toMatchObject({
      itemId: 'it-1',
      field: 'cantidad'
    });

    // 5. Shift+Tab desde cantidad de it-1 -> debe volver a descripción de it-1
    act(() => {
      hook.result.current.handleNavigateCell('prev', 'cantidad');
    });
    expect(hook.result.current.editingCell).toMatchObject({
      itemId: 'it-1',
      field: 'descripcion'
    });

    // 6. Ir a cantidad del último ítem y presionar Tab -> debe crear una nueva partida
    act(() => {
      hook.result.current.handleStartEditCell('it-2', 'cantidad', '25');
    });
    act(() => {
      hook.result.current.handleNavigateCell('next', 'cantidad');
    });
    // Debe haber creado un nuevo ítem y tenerlo en edición de descripción
    expect(hook.result.current.editingCell?.field).toBe('descripcion');
    expect(hook.result.current.editingCell?.itemId).not.toBe('it-1');
    expect(hook.result.current.editingCell?.itemId).not.toBe('it-2');
  });

  it('gestiona la apertura y cierre del diálogo rápido de parámetros de partida', () => {
    const { hook } = createHook();

    expect(hook.result.current.quickParamModalItemId).toBeNull();
    act(() => {
      hook.result.current.handleOpenQuickParamModal('it-1');
    });
    expect(hook.result.current.quickParamModalItemId).toBe('it-1');

    act(() => {
      hook.result.current.handleCloseQuickParamModal();
    });
    expect(hook.result.current.quickParamModalItemId).toBeNull();
  });
});
