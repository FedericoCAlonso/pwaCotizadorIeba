import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTreeSheetViewModel } from './useTreeSheetViewModel';
import {
  ItemPresupuesto,
  CapituloPresupuesto,
  ParametroItem,
  InsumoSnapshot,
  ManoObraSnapshot,
  TareaTipo,
  GastoPresupuestoConfig
} from '../core/types';
import {
  calcularTotalesPresupuesto,
  TotalesPresupuestoResultado
} from '../core/calculations';

describe('Workflow Real de Cotización: Recableado Departamento (3 ambientes, 60 m²)', () => {
  it('permite estructurar capítulos, ítems, parámetros derivados y cascada de precios desde teclado', () => {
    const calculosVariables: Record<string, number | string> = {
      superficie_total: 60,
      ambientes: 3
    };
    const gastosConfig: GastoPresupuestoConfig[] = [];

    const mockTotalesInit: TotalesPresupuestoResultado = calcularTotalesPresupuesto({
      items: [],
      capitulos: [],
      gastosConfig,
      impuestosDetalle: [{ id: 'iva_21', nombre: 'IVA 21%', porcentaje: 21, aplica: true } as any],
      margenPorcentaje: 35
    });

    const { result } = renderHook(() => {
      const [items, setItems] = useState<ItemPresupuesto[]>([]);
      const [capitulos, setCapitulos] = useState<CapituloPresupuesto[]>([]);
      const vm = useTreeSheetViewModel({
        items,
        setItems,
        capitulos,
        setCapitulos,
        calculosVariables,
        totales: mockTotalesInit,
        gastosConfig
      });
      return { vm, items, capitulos };
    });

    // 1. Crear Capítulo: "Instalación Eléctrica y Recableado"
    act(() => {
      result.current.vm.handleCreateChapter('Instalación Eléctrica y Recableado');
    });

    expect(result.current.capitulos.length).toBe(1);
    const capId = result.current.capitulos[0].id;
    expect(result.current.capitulos[0].nombre).toBe('Instalación Eléctrica y Recableado');

    // 2. Crear Ítem dentro del Capítulo
    act(() => {
      result.current.vm.handleCreateItem(capId);
    });

    expect(result.current.items.length).toBe(1);
    const itemRecableadoId = result.current.items[0].id;
    expect(result.current.items[0].capituloId).toBe(capId);

    // 3. Edición en celda: Descripción y Cantidad de bocas (25 bocas)
    act(() => {
      result.current.vm.handleStartEditCell(itemRecableadoId, 'descripcion');
      result.current.vm.handleUpdateEditingCellValue('Recableado general y adecuación de bocas');
      result.current.vm.handleCommitEditCell(itemRecableadoId, 'descripcion');
    });
    expect(result.current.items[0].descripcion).toBe('Recableado general y adecuación de bocas');

    act(() => {
      result.current.vm.handleStartEditCell(itemRecableadoId, 'cantidad');
      result.current.vm.handleUpdateEditingCellValue('25');
      result.current.vm.handleCommitEditCell(itemRecableadoId, 'cantidad');
    });
    expect(result.current.items[0].cantidad).toBe(25);

    // 4. Agregar parámetros al ítem: 'metros_por_boca' = 12
    const nuevoParametro: ParametroItem = {
      id: 'param-metros',
      nombre: 'metros_por_boca',
      valor: 12,
      unidad: 'm',
      origen: 'propio'
    };

    act(() => {
      result.current.vm.handleUpdateItemParametros(itemRecableadoId, [nuevoParametro]);
    });

    expect(result.current.items[0].parametros![0].nombre).toBe('metros_por_boca');
    expect(result.current.items[0].parametros![0].valor).toBe(12);

    // 5. Configurar desglose de líneas con fórmula paramétrica
    // Insumo con fórmula: = cantidad * metros_por_boca (25 * 12 = 300 metros)
    const insumoCable: InsumoSnapshot = {
      insumoId: 'mat-cable-2.5',
      nombre: 'Cable Unipolar 2.5 mm² Normalizado',
      unidad: 'm',
      cantidadUnitaria: 12,
      cantidadTotal: 300,
      formulaCantidad: '= cantidad * metros_por_boca',
      precioUnitarioCongelado: 450,
      subtotalInsumo: 135000
    };

    // Mano de obra: 0.8 hs por boca = 20 horas totales
    const moOficial: ManoObraSnapshot = {
      categoriaId: 'cat-oficial',
      nombreCategoria: 'Oficial Electricista',
      horasUnitarias: 0.8,
      horasTotales: 20,
      formulaHoras: '= cantidad * 0.8',
      costoHoraCongelado: 8000,
      subtotalManoObra: 160000
    };

    act(() => {
      result.current.vm.handleUpdateItemLines(itemRecableadoId, {
        insumosSnapshot: [insumoCable],
        manoObraSnapshot: [moOficial]
      });
    });

    // Verificar que las fórmulas se evaluaron y los costos se calcularon
    const itemCalculado = result.current.items[0];
    expect(itemCalculado.costoInsumos).toBe(135000);
    expect(itemCalculado.costoManoObra).toBe(160000);
    expect(itemCalculado.costoDirectoTotal).toBe(295000);

    // 6. Enter crea un ítem hermano en el mismo capítulo
    act(() => {
      result.current.vm.handleSelectRow(itemRecableadoId, capId);
      result.current.vm.handleKeyDown({
        key: 'Enter',
        preventDefault: () => {}
      } as any);
    });

    expect(result.current.items.length).toBe(2);
    const itemTableroId = result.current.items[1].id;
    expect(result.current.items[1].capituloId).toBe(capId);

    // Nombrar el segundo ítem: Tablero Seccional
    act(() => {
      result.current.vm.handleStartEditCell(itemTableroId, 'descripcion');
      result.current.vm.handleUpdateEditingCellValue('Armado e instalación de Tablero Seccional');
      result.current.vm.handleCommitEditCell(itemTableroId, 'descripcion');

      result.current.vm.handleStartEditCell(itemTableroId, 'cantidad');
      result.current.vm.handleUpdateEditingCellValue('1');
      result.current.vm.handleCommitEditCell(itemTableroId, 'cantidad');
    });

    expect(result.current.items[1].descripcion).toBe('Armado e instalación de Tablero Seccional');
    expect(result.current.items[1].cantidad).toBe(1);

    // 7. Simular inserción y desacople de Tarea Tipo
    const mockTareaTipo: TareaTipo = {
      id: 'tt-tablero-8m',
      nombre: 'Tablero Seccional 8 Módulos',
      categoria: 'Tableros',
      unidad: 'u',
      version: 1,
      insumos: [],
      manoObra: []
    };

    act(() => {
      result.current.vm.handleInsertTareaTipo(mockTareaTipo);
    });

    expect(result.current.items.length).toBe(3);
    const itemInsertado = result.current.items[2];
    expect(itemInsertado.tipoItem).toBe('tarea_tipo');
    expect(itemInsertado.tareaTipoId).toBe('tt-tablero-8m');
    expect(itemInsertado.desacoplado).toBe(false);

    // Desacoplar ítem de tarea tipo
    act(() => {
      result.current.vm.handleDesacoplarItem(itemInsertado.id);
    });
    expect(result.current.items[2].desacoplado).toBe(true);

    // 8. Alternar modo de visualización Costo Directo <-> Precio de Venta
    expect(result.current.vm.totalViewMode).toBe('costo');
    act(() => {
      result.current.vm.toggleTotalViewMode();
    });
    expect(result.current.vm.totalViewMode).toBe('precio');

    // 9. Verificar colapsado de capítulos
    expect(result.current.vm.collapsedChapters.has(capId)).toBe(false);
    act(() => {
      result.current.vm.toggleChapterCollapse(capId);
    });
    expect(result.current.vm.collapsedChapters.has(capId)).toBe(true);

    // 10. Cascada Determinística de Totales Financieros
    const totalesFinales = calcularTotalesPresupuesto({
      items: result.current.items,
      capitulos: result.current.capitulos,
      gastosConfig: [],
      impuestosDetalle: [{ id: 'iva', nombre: 'IVA', porcentaje: 21, aplica: true } as any],
      margenPorcentaje: 35,
      margenRiesgoPorcentaje: 10
    });

    // Verificaciones de Cascada:
    // C = Directo Base + Riesgo (10%)
    expect(totalesFinales.subtotalCostosDirectos).toBeGreaterThanOrEqual(295000);
    expect(totalesFinales.montoMargenRiesgo).toBeGreaterThan(0);
    // B = Beneficio sobre Costo (35%)
    expect(totalesFinales.beneficioMonto).toBeGreaterThan(0);
    // Precio Final = Subtotal + IVA (21%)
    expect(totalesFinales.precioFinalGlobal).toBeGreaterThan(totalesFinales.subtotalSinImpuestos);
    // Coeficiente K > 1.0
    expect(totalesFinales.coeficienteK).toBeGreaterThan(1.0);
  });
});
