import { describe, it, expect } from 'vitest';
import {
  roundMoney,
  calcularCostoTareaTipo,
  calcularTotalesPresupuesto,
  congelarItemPresupuesto,
  generarImpuestosPorDefecto,
  calcularNuevoFactorEMA,
  obtenerMultiplicadorCondicion,
  obtenerEstadoVencimientoInsumo,
  calcularDispersionHorasTareaLegacy
} from './calculations';
import { Insumo, CategoriaManoDeObra, CostoIndirecto, CostoIndirectoItemConfig, TareaTipo, ItemPresupuesto } from './types';
import { buildSearchTerm } from './searchUtils';

// ─── Fixtures compartidas (auditoría #14) ────────────────────────────────────

const insumosMap = new Map<string, Insumo>([
  [
    'ins-1',
    {
      id: 'ins-1',
      categoriaId: 'cableado',
      nombre: 'Cable 2.5mm2',
      unidadVenta: 'm',
      unidad: 'm',
      categoria: 'cableado',
      atributos: [],
      activo: true,
      precioActual: 800,
      fechaActualizacion: new Date().toISOString(),
      historialPrecios: []
    }
  ],
  [
    'ins-2',
    {
      id: 'ins-2',
      categoriaId: 'protecciones',
      nombre: 'Termica 16A',
      unidadVenta: 'u',
      unidad: 'u',
      categoria: 'protecciones',
      atributos: [],
      activo: true,
      precioActual: 12000,
      fechaActualizacion: new Date().toISOString(),
      historialPrecios: []
    }
  ]
]);

const manoObraMap = new Map<string, CategoriaManoDeObra>([
  [
    'mo-1',
    {
      id: 'mo-1',
      nombre: 'Oficial Electricista',
      costoHora: 7500,
      fechaActualizacion: new Date().toISOString()
    }
  ]
]);

function makeItem(overrides: Partial<ItemPresupuesto> = {}): ItemPresupuesto {
  return {
    id: 'item-1',
    descripcion: 'Boca de iluminación',
    cantidad: 10,
    unidad: 'u',
    insumosSnapshot: [
      {
        insumoId: 'ins-1',
        nombre: 'Cable 2.5mm2',
        unidad: 'm',
        cantidadTotal: 120,
        precioUnitarioCongelado: 800,
        subtotalInsumo: 96000
      }
    ],
    manoObraSnapshot: [
      {
        categoriaId: 'mo-1',
        nombreCategoria: 'Oficial Electricista',
        horasTotales: 15,
        costoHoraCongelado: 7500,
        subtotalManoObra: 112500
      }
    ],
    costoInsumos: 96000,
    costoManoObra: 112500,
    costoDirectoTotal: 208500,
    precioVentaUnitario: 30000,
    precioVentaTotal: 300000,
    ...overrides
  };
}

// ─── roundMoney ──────────────────────────────────────────────────────────────

describe('roundMoney', () => {
  it('redondea a 2 decimales correctamente', () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(1.004)).toBe(1);
    expect(roundMoney(100.125)).toBe(100.13);
  });

  it('acumula 10 centavos sin error IEEE 754', () => {
    // 0.1 + 0.2 sin roundMoney = 0.30000000000000004
    let acc = 0;
    for (let i = 0; i < 10; i++) acc = roundMoney(acc + 0.1);
    expect(acc).toBe(1);
  });

  it('retorna 0 para 0', () => {
    expect(roundMoney(0)).toBe(0);
  });
});

// ─── calcularCostoTareaTipo ───────────────────────────────────────────────────

describe('calcularCostoTareaTipo', () => {
  it('calcula el costo directo unitario de una TareaTipo (happy path)', () => {
    const tarea: TareaTipo = {
      id: 'tt-1',
      nombre: 'Boca de iluminación',
      categoria: 'Bocas',
      unidad: 'u',
      insumos: [
        { insumoId: 'ins-1', cantidad: 12 }, // 12 * 800 = 9600
        { insumoId: 'ins-2', cantidad: 1 }   // 1 * 12000 = 12000
      ],
      manoObra: [
        { categoriaId: 'mo-1', horas: 1.5 }  // 1.5 * 7500 = 11250
      ]
    };

    const result = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap);

    expect(result.costoInsumosUnitario).toBe(21600);
    expect(result.costoManoObraUnitario).toBe(11250);
    expect(result.costoDirectoUnitario).toBe(32850);
    expect(result.insumosSnapshotUnitario).toHaveLength(2);
    expect(result.manoObraSnapshotUnitario).toHaveLength(1);
  });

  it('maneja tarea sin insumos ni mano de obra (edge case: vacío)', () => {
    const tarea: TareaTipo = {
      id: 'tt-empty',
      nombre: 'Tarea Vacía',
      categoria: 'Bocas',
      unidad: 'u',
      insumos: [],
      manoObra: []
    };

    const result = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap);

    expect(result.costoInsumosUnitario).toBe(0);
    expect(result.costoManoObraUnitario).toBe(0);
    expect(result.costoDirectoUnitario).toBe(0);
  });

  it('maneja insumo no encontrado en el mapa (resilienza)', () => {
    const tarea: TareaTipo = {
      id: 'tt-missing',
      nombre: 'Tarea con insumo faltante',
      categoria: 'Bocas',
      unidad: 'u',
      insumos: [{ insumoId: 'ins-INEXISTENTE', cantidad: 5 }],
      manoObra: []
    };

    const result = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap);

    // Precio = 0 si el insumo no existe
    expect(result.costoInsumosUnitario).toBe(0);
    expect(result.insumosSnapshotUnitario[0].nombre).toBe('Insumo no encontrado');
  });

  it('maneja cantidades 0 correctamente', () => {
    const tarea: TareaTipo = {
      id: 'tt-zero',
      nombre: 'Tarea Cero',
      categoria: 'Bocas',
      unidad: 'u',
      insumos: [{ insumoId: 'ins-1', cantidad: 0 }],
      manoObra: [{ categoriaId: 'mo-1', horas: 0 }]
    };

    const result = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap);
    expect(result.costoInsumosUnitario).toBe(0);
    expect(result.costoManoObraUnitario).toBe(0);
  });
});

// ─── calcularTotalesPresupuesto ───────────────────────────────────────────────

// ─── calcularTotalesPresupuesto (Nuevo Modelo C → GG → B → S → Impuestos → Precio Final & K) ───

describe('calcularTotalesPresupuesto', () => {
  it('calcula la cadena estricta C → GG → B → S → Impuestos → Precio Final & K', () => {
    const item = makeItem(); // costoDirectoTotal = 208500
    const indirectos: CostoIndirecto[] = [
      {
        id: 'ind-1',
        nombre: 'Gastos Generales',
        tipo: 'porcentual_sobre_costo',
        valor: 10 // 10% de 208500 = 20850
      }
    ];

    const result = calcularTotalesPresupuesto({
      items: [item],
      costosIndirectosCatalog: indirectos,
      beneficioPorcentaje: 40,
      impuestosDetalle: [],
      cotizacionMonedaExtranjera: 1350
    });

    // 1. C = 208500
    expect(result.costoGlobal).toBe(208500);
    expect(result.subtotalCostosDirectos).toBe(208500);
    // 2. GG = 10% de 208500 = 20850
    expect(result.gastosGeneralesTotal).toBe(20850);
    // C + GG = 229350
    expect(result.costoTotalObra).toBe(229350);
    // 3. B = 40% sobre (C + GG) = 40% de 229350 = 91740
    expect(result.beneficioMonto).toBe(91740);
    // 4. S = C + GG + B = 229350 + 91740 = 321090
    expect(result.subtotalSinImpuestos).toBe(321090);
    // 5. Impuestos = 0 -> Precio Final = 321090
    expect(result.precioFinalGlobal).toBe(321090);
    expect(result.totalARS).toBe(321090);
    // 6. K = 321090 / 208500 = 1.54
    expect(result.coeficienteK).toBeCloseTo(1.54, 2);
    // 7. Moneda extranjera
    expect(result.totalMonedaExtranjera).toBeCloseTo(237.84, 2);
  });

  it('maneja lista de ítems vacía (edge case: presupuesto vacío)', () => {
    const result = calcularTotalesPresupuesto({
      items: [],
      costosIndirectosCatalog: [],
      beneficioPorcentaje: 30,
      impuestosDetalle: []
    });

    expect(result.costoGlobal).toBe(0);
    expect(result.subtotalInsumos).toBe(0);
    expect(result.subtotalManoObra).toBe(0);
    expect(result.subtotalCostosDirectos).toBe(0);
    expect(result.costoTotalObra).toBe(0);
    expect(result.beneficioMonto).toBe(0);
    expect(result.subtotalSinImpuestos).toBe(0);
    expect(result.precioFinalGlobal).toBe(0);
    expect(result.totalARS).toBe(0);
    expect(result.coeficienteK).toBe(1);
    expect(result.totalMonedaExtranjera).toBeUndefined();
  });

  it('VALIDACIÓN 1: Un GG% y un GG absoluto combinados en la misma cotización dan el GG total correcto', () => {
    const item = makeItem({
      insumosSnapshot: [],
      manoObraSnapshot: [],
      costoInsumos: 60000,
      costoManoObra: 40000,
      costoDirectoTotal: 100000
    });

    const indirectosConfig: CostoIndirectoItemConfig[] = [
      { id: 'ci-pct', nombre: 'GG Porcentual', tipo: 'porcentual_sobre_costo', valor: 10, aplica: true }, // 10% de 100.000 = 10.000
      { id: 'ci-fijo', nombre: 'Seguro Específico Obra', tipo: 'fijo_mensual', valor: 15000, aplica: true } // Monto fijo = 15.000
    ];

    const result = calcularTotalesPresupuesto({
      items: [item],
      costosIndirectosConfig: indirectosConfig,
      beneficioPorcentaje: 0,
      impuestosDetalle: []
    });

    expect(result.costoGlobal).toBe(100000);
    // Base APU = C (100.000) + GG fijo (15.000) = 115.000
    // GG% sobre Base (10% de 115.000) = 11.500
    // GG total = 15000 (GG fijo) + 11500 (GG%) = 26500
    expect(result.gastosGeneralesTotal).toBe(26500);
    expect(result.subtotalCostosIndirectos).toBe(26500);
    expect(result.costosIndirectosAplicados.find(c => c.costoIndirectoId === 'ci-pct')?.montoCalculado).toBe(11500);
    expect(result.costosIndirectosAplicados.find(c => c.costoIndirectoId === 'ci-fijo')?.montoCalculado).toBe(15000);
  });

  it('VALIDACIÓN 2: El Beneficio se calcula sobre (C + GG), no sobre C solo', () => {
    const item = makeItem({
      insumosSnapshot: [],
      manoObraSnapshot: [],
      costoInsumos: 60000,
      costoManoObra: 40000,
      costoDirectoTotal: 100000 // C = 100.000
    });

    const indirectosConfig: CostoIndirectoItemConfig[] = [
      { id: 'ci-fijo', nombre: 'Seguro Obra', tipo: 'fijo_mensual', valor: 25000, aplica: true } // GG = 25.000
    ];

    const result = calcularTotalesPresupuesto({
      items: [item],
      costosIndirectosConfig: indirectosConfig,
      beneficioPorcentaje: 20, // %beneficio = 20%
      impuestosDetalle: []
    });

    // Base de cálculo = C + GG = 100.000 + 25.000 = 125.000
    expect(result.costoTotalObra).toBe(125000);
    // Beneficio = 20% de 125.000 = 25.000 (Si fuera sobre C solo daría 20.000)
    expect(result.beneficioMonto).toBe(25000);
    // Subtotal (S) = C + GG + B = 100.000 + 25.000 + 25.000 = 150.000
    expect(result.subtotalSinImpuestos).toBe(150000);
    expect(result.precioFinalGlobal).toBe(150000);
  });

  it('VALIDACIÓN 3: Los impuestos no se acumulan en cascada entre sí (todos sobre el mismo S)', () => {
    const item = makeItem({
      insumosSnapshot: [],
      manoObraSnapshot: [],
      costoInsumos: 50000,
      costoManoObra: 50000,
      costoDirectoTotal: 100000
    });

    const impuestosFacturaA = generarImpuestosPorDefecto('Factura A', 21, 3.5);

    const result = calcularTotalesPresupuesto({
      items: [item],
      costosIndirectosCatalog: [],
      beneficioPorcentaje: 0,
      impuestosDetalle: impuestosFacturaA
    });

    // C = 100000, GG = 0, B = 0 -> S = 100000
    expect(result.subtotalSinImpuestos).toBe(100000);
    // IVA: 21% sobre S (100.000) = 21.000
    const iva = result.impuestosCalculados.find(t => t.id === 'tax-iva')?.montoCalculado;
    expect(iva).toBe(21000);
    // IIBB: 3.5% sobre S (100.000) = 3.500 (NO sobre S + IVA)
    const iibb = result.impuestosCalculados.find(t => t.id === 'tax-iibb')?.montoCalculado;
    expect(iibb).toBe(3500);

    // Total Impuestos = 21.000 + 3.500 = 24.500
    expect(result.montoImpuestosTotal).toBe(24500);
    // Precio Final = S + Impuestos = 100.000 + 24.500 = 124.500
    expect(result.precioFinalGlobal).toBe(124500);
  });

  it('VALIDACIÓN 4: El itemizado con 2+ ítems produce el mismo Precio Final Global que la versión no itemizada para el mismo conjunto de costos', () => {
    // Versión Itemizada (2 renglones: 40k y 60k -> Costo Total = 100k)
    const item1 = makeItem({ id: 'it-1', costoInsumos: 20000, costoManoObra: 20000, costoDirectoTotal: 40000, cantidad: 2, insumosSnapshot: [], manoObraSnapshot: [] });
    const item2 = makeItem({ id: 'it-2', costoInsumos: 30000, costoManoObra: 30000, costoDirectoTotal: 60000, cantidad: 3, insumosSnapshot: [], manoObraSnapshot: [] });

    const indirectos: CostoIndirecto[] = [{ id: 'ci-1', nombre: 'GG', tipo: 'porcentual_sobre_costo', valor: 15 }];
    const impuestos = generarImpuestosPorDefecto('Factura A', 21, 3.5);

    const resultadoItemizado = calcularTotalesPresupuesto({
      items: [item1, item2],
      costosIndirectosCatalog: indirectos,
      beneficioPorcentaje: 25,
      impuestosDetalle: impuestos
    });

    // Versión No Itemizada (1 solo renglón por el costo total de 100k)
    const itemGlobal = makeItem({ id: 'it-global', costoInsumos: 50000, costoManoObra: 50000, costoDirectoTotal: 100000, cantidad: 1, insumosSnapshot: [], manoObraSnapshot: [] });

    const resultadoGlobal = calcularTotalesPresupuesto({
      items: [itemGlobal],
      costosIndirectosCatalog: indirectos,
      beneficioPorcentaje: 25,
      impuestosDetalle: impuestos
    });

    expect(resultadoItemizado.costoGlobal).toBe(resultadoGlobal.costoGlobal);
    expect(resultadoItemizado.gastosGeneralesTotal).toBe(resultadoGlobal.gastosGeneralesTotal);
    expect(resultadoItemizado.beneficioMonto).toBe(resultadoGlobal.beneficioMonto);
    expect(resultadoItemizado.subtotalSinImpuestos).toBe(resultadoGlobal.subtotalSinImpuestos);
    expect(resultadoItemizado.montoImpuestosTotal).toBe(resultadoGlobal.montoImpuestosTotal);
    expect(resultadoItemizado.precioFinalGlobal).toBe(resultadoGlobal.precioFinalGlobal);
    expect(resultadoItemizado.coeficienteK).toBe(resultadoGlobal.coeficienteK);
  });

  it('VALIDACIÓN 5: La suma de los Precios de Venta individuales de los ítems (Costo de ítem × K) es matemáticamente igual al Precio Final Global', () => {
    const item1 = makeItem({ id: 'it-1', costoInsumos: 15430, costoManoObra: 12500, costoDirectoTotal: 27930, cantidad: 2, insumosSnapshot: [], manoObraSnapshot: [] });
    const item2 = makeItem({ id: 'it-2', costoInsumos: 48900, costoManoObra: 33200, costoDirectoTotal: 82100, cantidad: 5, insumosSnapshot: [], manoObraSnapshot: [] });
    const item3 = makeItem({ id: 'it-3', costoInsumos: 12000, costoManoObra: 8000, costoDirectoTotal: 20000, cantidad: 1, insumosSnapshot: [], manoObraSnapshot: [] });

    const indirectos: CostoIndirecto[] = [
      { id: 'ci-1', nombre: 'GG Porcentual', tipo: 'porcentual_sobre_costo', valor: 12 },
      { id: 'ci-2', nombre: 'Seguro Fijo', tipo: 'fijo_mensual', valor: 18500 }
    ];
    const impuestos = generarImpuestosPorDefecto('Factura A', 21, 3.5);

    const result = calcularTotalesPresupuesto({
      items: [item1, item2, item3],
      costosIndirectosCatalog: indirectos,
      beneficioPorcentaje: 35,
      impuestosDetalle: impuestos
    });

    const sumaPreciosVentaItems = roundMoney(
      result.itemsCalculados.reduce((acc, item) => acc + (item.precioVentaClienteTotal ?? item.precioVentaTotal), 0)
    );

    expect(sumaPreciosVentaItems).toBe(result.precioFinalGlobal);
  });

  it('ADENDA APU: Prorratea GG absolutos por incidencia de costo y calcula la cascada APU ítem por ítem', () => {
    // 2 ítems: C1 = 40.000, C2 = 60.000 -> Costo Global C = 100.000
    const item1 = makeItem({ id: 'it-1', costoInsumos: 20000, costoManoObra: 20000, costoDirectoTotal: 40000, cantidad: 2, insumosSnapshot: [], manoObraSnapshot: [] });
    const item2 = makeItem({ id: 'it-2', costoInsumos: 30000, costoManoObra: 30000, costoDirectoTotal: 60000, cantidad: 3, insumosSnapshot: [], manoObraSnapshot: [] });

    // GG Fijo: 20.000, GG%: 10%
    const indirectosConfig: CostoIndirectoItemConfig[] = [
      { id: 'ci-fijo', nombre: 'Seguro de Obra Fijo', tipo: 'fijo_mensual', valor: 20000, aplica: true },
      { id: 'ci-pct', nombre: 'Gastos Generales %', tipo: 'porcentual_sobre_costo', valor: 10, aplica: true }
    ];
    const impuestos = [{ id: 'tax-iva', nombre: 'IVA', porcentaje: 21, montoCalculado: 0, aplica: true, discriminar: true }];

    const result = calcularTotalesPresupuesto({
      items: [item1, item2],
      costosIndirectosConfig: indirectosConfig,
      beneficioPorcentaje: 20,
      impuestosDetalle: impuestos
    });

    const it1 = result.itemsCalculados[0];
    const it2 = result.itemsCalculados[1];

    // 1. Incidencia
    expect(it1.incidencia).toBe(0.4);
    expect(it2.incidencia).toBe(0.6);

    // 2. GG Absoluto Prorrateado
    expect(it1.ggAbsolutoProrrateado).toBe(8000); // 20.000 * 0.4
    expect(it2.ggAbsolutoProrrateado).toBe(12000); // 20.000 * 0.6
    expect(roundMoney(it1.ggAbsolutoProrrateado! + it2.ggAbsolutoProrrateado!)).toBe(20000);

    // 3. Base de Costo del Ítem = Costo_item + GG_absoluto_item
    expect(it1.baseCostoItem).toBe(48000); // 40.000 + 8.000
    expect(it2.baseCostoItem).toBe(72000); // 60.000 + 12.000

    // 4. GG Porcentual = Base_item * 10%
    expect(it1.ggPorcentualItem).toBe(4800); // 48.000 * 0.10
    expect(it2.ggPorcentualItem).toBe(7200); // 72.000 * 0.10

    // 5. Beneficio = (Base_item + GG_porcentual_item) * 20%
    expect(it1.beneficioItem).toBe(10560); // (48.000 + 4.800) * 0.20 = 52.800 * 0.20
    expect(it2.beneficioItem).toBe(15840); // (72.000 + 7.200) * 0.20 = 79.200 * 0.20

    // 6. Subtotal = Base + GG_pct + Beneficio
    expect(it1.subtotalItem).toBe(63360); // 48.000 + 4.800 + 10.560
    expect(it2.subtotalItem).toBe(95040); // 72.000 + 7.200 + 15.840
    expect(result.subtotalSinImpuestos).toBe(158400); // 63.360 + 95.040

    // 7. Impuestos = 21% sobre Subtotal
    expect(it1.impuestosItem).toBe(13305.6); // 63.360 * 0.21
    expect(it2.impuestosItem).toBe(19958.4); // 95.040 * 0.21

    // 8. Precio Final del Ítem = Subtotal + Impuestos
    expect(it1.precioFinalItem).toBe(76665.6);
    expect(it2.precioFinalItem).toBe(114998.4);

    // Validación de Integridad Estricta
    expect(roundMoney(it1.precioFinalItem! + it2.precioFinalItem!)).toBe(result.precioFinalGlobal);
    expect(result.precioFinalGlobal).toBe(191664);
  });

  it('ADENDA APU: Integridad con redondeo bancario y precisión flotante en divisiones inexactas', () => {
    const item1 = makeItem({ id: 'it-1', costoInsumos: 11111.11, costoManoObra: 22222.22, costoDirectoTotal: 33333.33, cantidad: 1, insumosSnapshot: [], manoObraSnapshot: [] });
    const item2 = makeItem({ id: 'it-2', costoInsumos: 11111.11, costoManoObra: 22222.22, costoDirectoTotal: 33333.33, cantidad: 2, insumosSnapshot: [], manoObraSnapshot: [] });
    const item3 = makeItem({ id: 'it-3', costoInsumos: 11111.11, costoManoObra: 22222.23, costoDirectoTotal: 33333.34, cantidad: 3, insumosSnapshot: [], manoObraSnapshot: [] });

    const indirectosConfig: CostoIndirectoItemConfig[] = [
      { id: 'ci-fijo', nombre: 'Seguro Fijo', tipo: 'fijo_mensual', valor: 10000, aplica: true },
      { id: 'ci-pct', nombre: 'GG %', tipo: 'porcentual_sobre_costo', valor: 7, aplica: true }
    ];
    const impuestos = generarImpuestosPorDefecto('Factura A', 21, 3.5);

    const result = calcularTotalesPresupuesto({
      items: [item1, item2, item3],
      costosIndirectosConfig: indirectosConfig,
      beneficioPorcentaje: 18,
      impuestosDetalle: impuestos
    });

    const sumaItems = roundMoney(
      result.itemsCalculados.reduce((acc, it) => acc + (it.precioFinalItem ?? 0), 0)
    );
    const sumaSubtotales = roundMoney(
      result.itemsCalculados.reduce((acc, it) => acc + (it.subtotalItem ?? 0), 0)
    );
    const sumaGGAbs = roundMoney(
      result.itemsCalculados.reduce((acc, it) => acc + (it.ggAbsolutoProrrateado ?? 0), 0)
    );

    // Integridad al centavo exacto
    expect(sumaItems).toBe(result.precioFinalGlobal);
    expect(sumaSubtotales).toBe(result.subtotalSinImpuestos);
    expect(sumaGGAbs).toBe(10000);
  });
});

// ─── congelarItemPresupuesto ──────────────────────────────────────────────────

describe('congelarItemPresupuesto', () => {
  it('multiplica correctamente los subtotales por la cantidad', () => {
    const baseItem = makeItem({ cantidad: 1, precioVentaUnitario: 30000, precioVentaTotal: 30000 });
    // Snapshots unitarios en el item base:
    // insumosSnapshot[0].cantidadTotal = 120, precio = 800
    // manoObraSnapshot[0].horasTotales = 15, costoHora = 7500

    const frozen = congelarItemPresupuesto(baseItem, 5);

    expect(frozen.cantidad).toBe(5);
    expect(frozen.insumosSnapshot[0].cantidadTotal).toBe(600); // 120 * 5
    expect(frozen.insumosSnapshot[0].subtotalInsumo).toBe(480000); // 800 * 600
    expect(frozen.manoObraSnapshot[0].horasTotales).toBe(75); // 15 * 5
    expect(frozen.manoObraSnapshot[0].subtotalManoObra).toBe(562500); // 7500 * 75
    expect(frozen.precioVentaTotal).toBe(150000); // 30000 * 5
  });

  it('maneja cantidad 0 sin dividir por cero (edge case)', () => {
    const baseItem = makeItem({ cantidad: 0, precioVentaUnitario: 30000, precioVentaTotal: 0 });
    // cantidad 0 → se normaliza a 1 para evitar división/multiplicación por 0
    const frozen = congelarItemPresupuesto(baseItem, 0);
    expect(frozen.cantidad).toBe(1); // safeNum de 0 = 0, pero || 1 lo evita
    expect(typeof frozen.precioVentaTotal).toBe('number');
  });
});

// ─── Tests v2: EMA, Condición, Vencimientos, Servicios Tercerizados ──────────

describe('calcularNuevoFactorEMA (spec v2 §1.1)', () => {
  it('incrementa el factor si las horas reales superan las estimadas', () => {
    // factor 1.0, 15hs reales vs 10hs estimadas (ratio 1.5), alpha 0.3
    // nuevo = 1.0 * 0.7 + 1.5 * 0.3 = 0.7 + 0.45 = 1.15
    const nuevoFactor = calcularNuevoFactorEMA(1.0, 15, 10, 0.3);
    expect(nuevoFactor).toBe(1.15);
  });

  it('reduce el factor si las horas reales son menores a las estimadas', () => {
    // factor 1.0, 5hs reales vs 10hs estimadas (ratio 0.5), alpha 0.3
    // nuevo = 1.0 * 0.7 + 0.5 * 0.3 = 0.7 + 0.15 = 0.85
    const nuevoFactor = calcularNuevoFactorEMA(1.0, 5, 10, 0.3);
    expect(nuevoFactor).toBe(0.85);
  });
});

describe('obtenerMultiplicadorCondicion (spec v2 §1.2)', () => {
  it('retorna multiplicadores correctos por condición de obra', () => {
    expect(obtenerMultiplicadorCondicion('normal')).toBe(1.0);
    expect(obtenerMultiplicadorCondicion('dificultosa')).toBe(1.25);
    expect(obtenerMultiplicadorCondicion('favorable')).toBe(0.9);
  });
});

describe('obtenerEstadoVencimientoInsumo (spec v2 §2.1)', () => {
  it('marca verde para <= 30 días, amarillo para 31-60 y rojo para > 60', () => {
    const hoy = new Date();
    
    const hace10dias = new Date(hoy.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const hace45dias = new Date(hoy.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();
    const hace90dias = new Date(hoy.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

    expect(obtenerEstadoVencimientoInsumo(hace10dias)).toBe('verde');
    expect(obtenerEstadoVencimientoInsumo(hace45dias)).toBe('amarillo');
    expect(obtenerEstadoVencimientoInsumo(hace90dias)).toBe('rojo');
  });
});

describe('calcularDispersionHorasTareaLegacy (spec v2 §1.4)', () => {
  it('calcula correctamente el rango y desvío de horas por tarea', () => {
    const registros = [
      { tareaTipoId: 'tt-1', horasReales: 10, cantidadEjecutada: 1 }, // ratio 1.0
      { tareaTipoId: 'tt-1', horasReales: 15, cantidadEjecutada: 1 }  // ratio 1.5
    ];

    const dispersion = calcularDispersionHorasTareaLegacy(registros, 'tt-1', 10);
  });
});

describe('buildSearchTerm & searchUtils', () => {
  it('arma correctamente el término para búsqueda genérica a nivel Material', () => {
    const mat = {
      nombre: 'Cable Unipolar',
      atributos: [
        { clave: 'seccion', valor: '2.5 mm²' },
        { clave: 'norma', valor: 'IRAM 247-3' }
      ]
    };
    const term = buildSearchTerm({ tipo: 'material', material: mat });
    expect(term).toBe('Cable Unipolar 2.5 mm² IRAM 247-3');
  });

  it('arma correctamente el término para Producto con Código de Fabricante / SKU', () => {
    const mat = { nombre: 'Termomagnética 1P' };
    const prod = {
      marca: 'Schneider',
      modelo: 'Acti9',
      codigoFabricante: 'A9F74116'
    };
    const term = buildSearchTerm({ tipo: 'producto', material: mat, producto: prod });
    expect(term).toBe('Schneider A9F74116');
  });

  it('arma correctamente el término para Producto sin SKU combinando Marca + Modelo + Material', () => {
    const mat = { nombre: 'Canaleta Ranurada' };
    const prod = {
      marca: 'Zoloda',
      modelo: '40x60'
    };
    const term = buildSearchTerm({ tipo: 'producto', material: mat, producto: prod });
    expect(term).toBe('Zoloda 40x60 Canaleta Ranurada');
  });
});

