import { describe, it, expect } from 'vitest';
import {
  roundMoney,
  calcularPrecioNeto,
  calcularPrecioFinal,
  calcularPrecioUnitarioDesdePresentacion,
  obtenerPresentacionesSugeridas,
  calcularCostoTareaTipo,
  calcularTotalesPresupuesto,
  congelarItemPresupuesto,
  generarImpuestosPorDefecto,
  calcularNuevoFactorEMA,
  obtenerMultiplicadorCondicion,
  obtenerEstadoVencimientoInsumo,
  calcularDispersionHorasTareaLegacy,
  obtenerCoeficienteEstado,
  obtenerCoeficienteAccesibilidad,
  obtenerCoeficienteAltura,
  calcularCoeficienteComplejidad,
  calcularCostoParametricoTareaTipo,
  calcularEstimacionParametricaMaterial,
  calcularConsumosTareaTipo,
  resolverMaterialPorFiltro,
  calcularSinergiaManoObra,
  estimarCuadrillaPorPlazo,
  calcularOptimizacionCuadrilla,
  sonItemsCompatiblesParaSinergia,
  actualizarSnapshotsInsumosConCatalogo,
  analizarCambiosPreciosPresupuesto,
  aplicarActualizacionPreciosPresupuesto,
  DEFAULT_CLAUSULA_OBRA_EXISTENTE
} from './calculations';
import { evaluateCondition, evaluateMathExpression } from './mathEvaluator';
import { Insumo, CategoriaManoDeObra, CostoIndirecto, CostoIndirectoItemConfig, TareaTipo, ItemPresupuesto, GastoPresupuestoConfig, CapituloPresupuesto } from './types';
import { buildSearchTerm } from './searchUtils';
import { INITIAL_CATEGORIAS_MATERIAL, INITIAL_MATERIALES, INITIAL_MANO_OBRA, INITIAL_COSTOS_INDIRECTOS, INITIAL_TAREAS_TIPO } from './sampleData';

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

  it('no incluye costos indirectos del catálogo que tengan incluirPorDefecto: false', () => {
    const item = makeItem({
      insumosSnapshot: [],
      manoObraSnapshot: [],
      costoInsumos: 100000,
      costoManoObra: 0,
      costoServiciosTercerizados: 0,
      costoDirectoTotal: 100000,
      cantidad: 1
    });

    const indirectos: CostoIndirecto[] = [
      {
        id: 'ind-def',
        nombre: 'Herramientas y Amortización',
        tipo: 'porcentual_sobre_costo',
        valor: 5,
        incluirPorDefecto: true
      },
      {
        id: 'ind-no-def',
        nombre: 'Viáticos Especiales',
        tipo: 'porcentual_sobre_costo',
        valor: 10,
        incluirPorDefecto: false
      }
    ];

    const result = calcularTotalesPresupuesto({
      items: [item],
      costosIndirectosCatalog: indirectos,
      beneficioPorcentaje: 0,
      impuestosDetalle: []
    });

    // Solo debe aplicar el 5% de ind-def (5000), no el 10% de ind-no-def
    expect(result.gastosGeneralesTotal).toBe(5000);
    expect(result.costosIndirectosAplicados).toHaveLength(1);
    expect(result.costosIndirectosAplicados[0].costoIndirectoId).toBe('ind-def');
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
        { clave: 'norma', valor: 'IRAM 247-3' },
        { clave: 'color', valor: 'Celeste (Neutro)' }
      ]
    };
    const term = buildSearchTerm({ tipo: 'material', material: mat });
    expect(term).toBe('Cable Unipolar 2.5 mm² IRAM 247-3 Celeste (Neutro)');
  });

  it('verifica que la categoría de cables en bdDefault incluya la propiedad color con código de colores', () => {
    const cablesCat = INITIAL_CATEGORIAS_MATERIAL.find(c => c.id === 'cat-cables');
    expect(cablesCat).toBeDefined();
    const colorAttr = cablesCat?.atributosSugeridos.find(a => a.clave === 'color');
    expect(colorAttr).toBeDefined();
    expect(colorAttr?.opciones).toContain('Marrón (Fase)');
    expect(colorAttr?.opciones).toContain('Celeste (Neutro)');
    expect(colorAttr?.opciones).toContain('Verde/Amarillo (Tierra)');
    expect(colorAttr?.dependencias).toBeDefined();
  });

  it('verifica que los materiales por defecto contengan cables, cajas, gabinetes, caños, conectores y bandejas válidos', () => {
    expect(INITIAL_MATERIALES.length).toBeGreaterThanOrEqual(170);

    // Cables unipolares
    const cables15 = INITIAL_MATERIALES.filter(m => m.categoriaId === 'cat-cables' && m.atributos.some(a => a.clave === 'seccion' && a.valor === '1.5'));
    expect(cables15.length).toBe(7); // 7 colores

    const cables25 = INITIAL_MATERIALES.filter(m => m.categoriaId === 'cat-cables' && m.atributos.some(a => a.clave === 'seccion' && a.valor === '2.5'));
    expect(cables25.length).toBe(5); // 5 colores principales

    // Cajas (Chapa y PVC)
    const cajas = INITIAL_MATERIALES.filter(m => m.categoriaId === 'cat-cajas');
    expect(cajas.length).toBe(8); // 4 tipos x 2 materiales

    // Gabinetes
    const tableros = INITIAL_MATERIALES.filter(m => m.categoriaId === 'cat-tableros');
    expect(tableros.length).toBeGreaterThanOrEqual(10);

    // Caños RS (pulgadas) y PVC (milimétricos)
    const canos = INITIAL_MATERIALES.filter(m => m.categoriaId === 'cat-canos');
    expect(canos.length).toBeGreaterThanOrEqual(8);
    // Verificar que los caños de PVC usen mm (ej. 20 mm para 3/4)
    const canoPvc20 = INITIAL_MATERIALES.find(m => m.id === 'mat-cano-pvc-20');
    expect(canoPvc20).toBeDefined();
    expect(canoPvc20?.nombre).toBe('Caño PVC Rígido 20 mm Gris IRAM 2005 - Tira 3m');

    // Conectores caño a caja
    const conectores = INITIAL_MATERIALES.filter(m => m.categoriaId === 'cat-accesorios-caneria');
    expect(conectores.length).toBeGreaterThanOrEqual(8);
    const conectorPvc20 = INITIAL_MATERIALES.find(m => m.id === 'mat-conector-pvc-20');
    expect(conectorPvc20).toBeDefined();
    expect(conectorPvc20?.nombre).toBe('Conector Caño a Caja PVC Rígido 20 mm con Tuerca');

    // Bandejas portacables y accesorios
    const bandejas = INITIAL_MATERIALES.filter(m => m.categoriaId === 'cat-bandejas' || m.categoriaId === 'cat-accesorios-bandejas');
    expect(bandejas.length).toBeGreaterThanOrEqual(25);

    // Protecciones (PIAs y Diferenciales en sus categorías separadas)
    const pias = INITIAL_MATERIALES.filter(m => m.categoriaId === 'cat-termomagneticas');
    expect(pias.length).toBeGreaterThanOrEqual(20);
    const difs = INITIAL_MATERIALES.filter(m => m.categoriaId === 'cat-diferenciales');
    expect(difs.length).toBeGreaterThanOrEqual(8);

    // Módulos, Llaves, Bastidores y Tapas
    const modulos = INITIAL_MATERIALES.filter(m => m.categoriaId === 'cat-modulos-llaves' || m.categoriaId === 'cat-bastidores-tapas');
    expect(modulos.length).toBeGreaterThanOrEqual(15);
    const tomas = modulos.filter(m => m.atributos.some(a => a.clave === 'tipo_modulo' && a.valor.includes('Tomacorriente')));
    expect(tomas.length).toBeGreaterThanOrEqual(4);

    // Terminales TIF y Distribuidores Tetrapolares / Neutro / Tierra
    const tif = INITIAL_MATERIALES.filter(m => m.categoriaId === 'cat-terminales');
    expect(tif.length).toBeGreaterThanOrEqual(12);

    const distTetra = INITIAL_MATERIALES.filter(m => m.categoriaId === 'cat-accesorios-tablero' && m.atributos.some(a => a.clave === 'tipo_accesorio' && a.valor.includes('Repartidor Tetrapolar')));
    expect(distTetra.length).toBe(5);

    const distNeutroTierra = INITIAL_MATERIALES.filter(m => m.categoriaId === 'cat-accesorios-tablero' && m.atributos.some(a => a.clave === 'tipo_accesorio' && a.valor.includes('Bornera Repartidora')));
    expect(distNeutroTierra.length).toBe(6);

    // Puesta a Tierra (Jabalinas, Tomacables, Cajas de Inspección)
    const pat = INITIAL_MATERIALES.filter(m => m.categoriaId === 'cat-tierra');
    expect(pat.length).toBeGreaterThanOrEqual(10);
    const jabalinas = pat.filter(m => m.atributos.some(a => a.clave === 'tipo_elemento' && a.valor === 'Jabalina Copperweld'));
    expect(jabalinas.length).toBe(4);
    const cajasPAT = pat.filter(m => m.atributos.some(a => a.clave === 'tipo_elemento' && a.valor === 'Cámara de Inspección PAT'));
    expect(cajasPAT.length).toBe(3);
  });

  it('verifica que la mano de obra por defecto incluya los roles comunes con costo inicial en 0', () => {
    expect(INITIAL_MANO_OBRA.length).toBeGreaterThanOrEqual(8);
    INITIAL_MANO_OBRA.forEach(mo => {
      expect(mo.costoHora).toBe(0);
      expect(mo.nombre).toBeTruthy();
    });
    const roles = INITIAL_MANO_OBRA.map(mo => mo.nombre);
    expect(roles).toContain('Oficial Electricista Especializado');
    expect(roles).toContain('Oficial Electricista');
    expect(roles).toContain('Ayudante Electricista');
    expect(roles).toContain('Técnico Electricista Matriculado (Firma / Habilitación)');
  });

  it('verifica que los gastos generales y de estructura por defecto incluyan los conceptos comunes con valor inicial en 0', () => {
    expect(INITIAL_COSTOS_INDIRECTOS.length).toBeGreaterThanOrEqual(9);
    INITIAL_COSTOS_INDIRECTOS.forEach(ci => {
      expect(ci.valor).toBe(0);
      expect(ci.nombre).toBeTruthy();
      expect(['por_visita', 'fijo_mensual', 'porcentual_sobre_costo']).toContain(ci.tipo);
    });
    const nombres = INITIAL_COSTOS_INDIRECTOS.map(ci => ci.nombre);
    expect(nombres.some(n => n.includes('Movilidad'))).toBe(true);
    expect(nombres.some(n => n.includes('Seguro'))).toBe(true);
    expect(nombres.some(n => n.includes('EPP'))).toBe(true);
    expect(nombres.some(n => n.includes('Herramientas'))).toBe(true);
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

// ─── Tests: Conversión Canónica de Precios e IVA (GMT) y Tratamiento Fiscal ───

describe('calcularPrecioNeto y calcularPrecioFinal (Conversión Canónica GMT)', () => {
  it('convierte precio final con IVA 21% a base neta', () => {
    expect(calcularPrecioNeto(12100, 21)).toBe(10000);
    expect(calcularPrecioNeto(2420, 21)).toBe(2000);
  });

  it('convierte precio final con IVA 10.5% a base neta', () => {
    expect(calcularPrecioNeto(11050, 10.5)).toBe(10000);
  });

  it('convierte precio neto a precio final con IVA 21%', () => {
    expect(calcularPrecioFinal(10000, 21)).toBe(12100);
  });

  it('convierte precio neto a precio final con IVA 10.5%', () => {
    expect(calcularPrecioFinal(10000, 10.5)).toBe(11050);
  });

  it('maneja alícuota 0% sin alteraciones', () => {
    expect(calcularPrecioNeto(5000, 0)).toBe(5000);
    expect(calcularPrecioFinal(5000, 0)).toBe(5000);
  });
});

describe('Tratamiento Fiscal y Prevención de Doble IVA (Facturas A, B, C, X)', () => {
  const insumoConIva = {
    id: 'mat-1',
    precioActual: 10000, // Base Neta = 10.000
    alicuotaIVA: 21      // Final = 12.100
  };

  const itemConSnapshots: ItemPresupuesto = {
    id: 'it-1',
    descripcion: 'Instalación circuito',
    cantidad: 1,
    unidad: 'gl',
    insumosSnapshot: [
      {
        insumoId: 'mat-1',
        nombre: 'Material Eléctrico',
        unidad: 'u',
        cantidadTotal: 1,
        precioUnitarioCongelado: 10000,
        alicuotaIVA: 21,
        precioFinalUnitarioCongelado: 12100,
        subtotalInsumo: 10000,
        subtotalInsumoFinal: 12100
      }
    ],
    manoObraSnapshot: [
      {
        categoriaId: 'mo-1',
        nombreCategoria: 'Oficial',
        horasTotales: 1,
        costoHoraCongelado: 5000,
        subtotalManoObra: 5000
      }
    ],
    costoInsumos: 10000,
    costoManoObra: 5000,
    costoDirectoTotal: 15000,
    precioVentaUnitario: 0,
    precioVentaTotal: 0
  };

  it('FACTURA A (Responsable Inscripto): Toma costo neto, calcula margen y discrimina IVA al final', () => {
    const impuestos = generarImpuestosPorDefecto('Factura A', 21, 0);

    const result = calcularTotalesPresupuesto({
      items: [itemConSnapshots],
      costosIndirectosCatalog: [],
      beneficioPorcentaje: 30, // 30% sobre 15.000 = 4.500
      impuestosDetalle: impuestos,
      tipoFactura: 'Factura A'
    });

    // Costo Global = Insumo Neto (10.000) + MO (5.000) = 15.000
    expect(result.costoGlobal).toBe(15000);
    // Subtotal Neto Gravado (S) = 15.000 + 4.500 = 19.500
    expect(result.subtotalSinImpuestos).toBe(19500);
    // IVA 21% sobre S = 4.095 (discriminado)
    const ivaTax = result.impuestosCalculados.find(t => t.id === 'tax-iva');
    expect(ivaTax?.montoCalculado).toBe(4095);
    expect(ivaTax?.discriminar).toBe(true);
    // Precio Final = 19.500 + 4.095 = 23.595
    expect(result.precioFinalGlobal).toBe(23595);
  });

  it('FACTURA B (Responsable Inscripto a Consumidor): Mismo total que Factura A con IVA no discriminado', () => {
    const impuestos = generarImpuestosPorDefecto('Factura B', 21, 0);

    const result = calcularTotalesPresupuesto({
      items: [itemConSnapshots],
      costosIndirectosCatalog: [],
      beneficioPorcentaje: 30,
      impuestosDetalle: impuestos,
      tipoFactura: 'Factura B'
    });

    expect(result.costoGlobal).toBe(15000);
    expect(result.subtotalSinImpuestos).toBe(19500);
    expect(result.precioFinalGlobal).toBe(23595);
    const ivaTax = result.impuestosCalculados.find(t => t.id === 'tax-iva');
    expect(ivaTax?.discriminar).toBe(false);
  });

  it('FACTURA C (Monotributista): Absorbe IVA en el costo de compra y no agrega IVA en la venta (0%)', () => {
    const impuestos = generarImpuestosPorDefecto('Factura C', 21, 0);

    const result = calcularTotalesPresupuesto({
      items: [itemConSnapshots],
      costosIndirectosCatalog: [],
      beneficioPorcentaje: 30,
      impuestosDetalle: impuestos,
      tipoFactura: 'Factura C'
    });

    // Costo Global = Insumo con IVA pagado (12.100) + MO (5.000) = 17.100
    expect(result.costoGlobal).toBe(17100);
    // Beneficio 30% sobre 17.100 = 5.130
    expect(result.beneficioMonto).toBe(5130);
    // Subtotal = 17.100 + 5.130 = 22.230
    expect(result.subtotalSinImpuestos).toBe(22230);
    // IVA = 0%
    expect(result.montoImpuestosTotal).toBe(0);
    expect(result.precioFinalGlobal).toBe(22230);
  });

  it('PRESUPUESTO X (Sin Factura): No agrega IVA fiscal de venta', () => {
    const impuestos = generarImpuestosPorDefecto('Presupuesto X (Sin Factura)', 21, 0);

    const result = calcularTotalesPresupuesto({
      items: [itemConSnapshots],
      costosIndirectosCatalog: [],
      beneficioPorcentaje: 20,
      impuestosDetalle: impuestos,
      tipoFactura: 'Presupuesto X (Sin Factura)'
    });

    expect(result.costoGlobal).toBe(17100);
    expect(result.montoImpuestosTotal).toBe(0);
  });
});

describe('Presentaciones de Compra y Factores de Empaque (Rollos, Cajas, Bobinas)', () => {
  it('calcula precio unitario por metro para un Rollo de 100m a $45.000', () => {
    const precioUnitario = calcularPrecioUnitarioDesdePresentacion(45000, 100);
    expect(precioUnitario).toBe(450);
  });

  it('calcula precio unitario por metro para una Bobina de 500m a $190.000', () => {
    const precioUnitario = calcularPrecioUnitarioDesdePresentacion(190000, 500);
    expect(precioUnitario).toBe(380);
  });

  it('calcula precio unitario por metro para fraccionado directo (1m)', () => {
    const precioUnitario = calcularPrecioUnitarioDesdePresentacion(650, 1);
    expect(precioUnitario).toBe(650);
  });

  it('calcula precio unitario por unidad para una Caja de 100u a $8.000', () => {
    const precioUnitario = calcularPrecioUnitarioDesdePresentacion(8000, 100);
    expect(precioUnitario).toBe(80);
  });

  it('retorna presets sugeridos según la unidad del material', () => {
    const presetsMetro = obtenerPresentacionesSugeridas('m');
    expect(presetsMetro.some(p => p.cantidad === 100)).toBe(true);
    expect(presetsMetro.some(p => p.cantidad === 500)).toBe(true);

    const presetsUnidad = obtenerPresentacionesSugeridas('u');
    expect(presetsUnidad.some(p => p.cantidad === 100)).toBe(true);
  });
});

describe('Modelado Paramétrico de Trabajos Tipo y Coeficientes de Complejidad', () => {
  const tareaEjemplo: TareaTipo = {
    id: 'tt-recableado-boca',
    nombre: 'Recableado de Boca Existente',
    categoria: 'Bocas',
    unidad: 'boca',
    insumos: [
      { materialId: 'ins-1', cantidad: 12 } // 12m de cable 2.5mm ($800/m = $9.600)
    ],
    manoObra: [
      { categoriaId: 'mo-1', horas: 1.5 } // 1.5 hs Oficial ($5.000/h = $7.500)
    ]
  };

  it('obtiene los coeficientes correctos para cada nivel de estado, acceso y altura', () => {
    expect(obtenerCoeficienteEstado('moderna')).toBe(1.0);
    expect(obtenerCoeficienteEstado('intermedia')).toBe(1.25);
    expect(obtenerCoeficienteEstado('antigua')).toBe(1.60);
    expect(obtenerCoeficienteEstado('personalizado', 1.85)).toBe(1.85);

    expect(obtenerCoeficienteAccesibilidad('despejada')).toBe(1.0);
    expect(obtenerCoeficienteAccesibilidad('habitada')).toBe(1.15);
    expect(obtenerCoeficienteAccesibilidad('obstruida')).toBe(1.35);

    expect(obtenerCoeficienteAltura('estandar')).toBe(1.0);
    expect(obtenerCoeficienteAltura('doble_altura')).toBe(1.25);
    expect(obtenerCoeficienteAltura('gran_altura')).toBe(1.50);
  });

  it('calcula el coeficiente de complejidad compuesto (K_estado * K_acceso * K_altura)', () => {
    // Antigua (1.6) * Habitada (1.15) * Doble Altura (1.25) = 1.6 * 1.15 * 1.25 = 2.30
    const kComp = calcularCoeficienteComplejidad(1.60, 1.15, 1.25);
    expect(kComp).toBe(2.3);
  });

  it('calcula costo de trabajo tipo con parámetros estándar (K=1.0, sin adicionales)', () => {
    const res = calcularCostoParametricoTareaTipo(
      tareaEjemplo,
      {
        cantidad: 10,
        unidad: 'boca',
        estadoAntiguedad: 'moderna',
        coeficienteEstado: 1.0,
        accesibilidad: 'despejada',
        coeficienteAccesibilidad: 1.0,
        altura: 'estandar',
        coeficienteAltura: 1.0,
        coeficienteComplejidadTotal: 1.0
      },
      insumosMap,
      manoObraMap
    );

    // Insumos: 10 bocas * 12m * $800 = $96.000 (Unitario $9.600)
    expect(res.costoInsumosUnitario).toBe(9600);
    expect(res.costoInsumosTotal).toBe(96000);

    // Mano de Obra: 10 bocas * 1.5 hs * $7.500 = $112.500 (Unitario $11.250)
    expect(res.costoManoObraUnitario).toBe(11250);
    expect(res.costoManoObraTotal).toBe(112500);

    // Costo Directo Total: $96.000 + $112.500 = $208.500 (Unitario $20.850)
    expect(res.costoDirectoTotal).toBe(208500);
    expect(res.costoDirectoUnitario).toBe(20850);
    expect(res.coeficienteComplejidadTotal).toBe(1.0);
  });

  it('aplica multiplicadores de complejidad y adicionales por desarmado especial', () => {
    // 6 bocas, Instalación Antigua (1.6), Habitada (1.15), Altura Estándar (1.0)
    // K_comp = 1.6 * 1.15 = 1.84
    // MO Base = 6 * (1.5 hs * $7.500) = $67.500
    // MO Ajustada por K_comp = $67.500 * 1.84 = $124.200
    // Adicionales: 2 ventiladores de techo a $15.000 c/u = $30.000
    // MO Total = $124.200 + $30.000 = $154.200
    // Insumos = 6 * (12m * $800) = $57.600
    // Costo Directo Total = $57.600 + $154.200 = $211.800
    const res = calcularCostoParametricoTareaTipo(
      tareaEjemplo,
      {
        cantidad: 6,
        unidad: 'boca',
        estadoAntiguedad: 'antigua',
        coeficienteEstado: 1.60,
        accesibilidad: 'habitada',
        coeficienteAccesibilidad: 1.15,
        altura: 'estandar',
        coeficienteAltura: 1.0,
        coeficienteComplejidadTotal: 1.84,
        artefactosEspecialesCantidad: 2,
        artefactosEspecialesDescripcion: 'Ventiladores de techo pesados',
        artefactosEspecialesCostoUnitario: 15000,
        incluirClausulaEnPresupuesto: true
      },
      insumosMap,
      manoObraMap
    );

    expect(res.coeficienteComplejidadTotal).toBe(1.84);
    expect(res.adicionalesDesarmadoTotal).toBe(30000);
    expect(res.costoInsumosTotal).toBe(57600);
    expect(res.costoManoObraTotal).toBe(154200);
    expect(res.costoDirectoTotal).toBe(211800);
    expect(res.clausulaTecnica).toBe(DEFAULT_CLAUSULA_OBRA_EXISTENTE);

    // Debe contener el snapshot del adicional de desarmado
    expect(res.manoObraSnapshot.some(m => m.categoriaId === 'mo-adicional-desarmado')).toBe(true);
  });
});

describe('Cómputo Métrico Paramétrico de Materiales (Superficie, Trazado, Error)', () => {
  it('calcula cantidad de cable por superficie (m²) con margen de desperdicio', () => {
    // 80 m² de propiedad con 3.5 m de cable por m² y +10% de desperdicio/curvas/empalmes
    // Base = 80 * 3.5 = 280 m
    // Con +10% error = 280 * 1.10 = 308 m
    const res = calcularEstimacionParametricaMaterial({
      modelo: 'superficie_m2',
      superficieM2: 80,
      factorDensidadM2: 3.5,
      margenDesperdicioErrorPct: 10
    }, 'm');

    expect(res.cantidadEstimadaTotal).toBe(308);
    expect(res.formulaGenerada).toBe('(80 * 3.5) * 1.10');
    expect(res.explicacionCalculo).toContain('80 m² × 3.5 m/m² (+10% desperdicio/curvas)');
  });

  it('calcula cantidad de conductores por metraje de cañería, cantidad de hilos y bajadas a cajas', () => {
    // 40 m de cañería con 3 hilos (F+N+PE), +15% de bajadas a tomas/llaves y +10% de desperdicio/corte
    // Base = 40 * 3 = 120 m
    // Con +15% bajadas = 120 * 1.15 = 138 m
    // Con +10% desperdicio = 138 * 1.10 = 151.8 m
    const res = calcularEstimacionParametricaMaterial({
      modelo: 'longitud_caneria_fases',
      longitudCaneriaM: 40,
      conductoresPorCaneria: 3,
      adicionalBajadasPct: 15,
      margenDesperdicioErrorPct: 10
    }, 'm');

    expect(res.cantidadEstimadaTotal).toBe(151.8);
    expect(res.formulaGenerada).toBe('(40 * 3 * 1.15) * 1.10');
    expect(res.explicacionCalculo).toContain('40 m cañería × 3 hilos');
  });

  it('calcula conductores por cantidad de bocas y distancia media entre centros', () => {
    // 10 bocas a 4 metros de distancia promedio con 3 hilos y +10% desperdicio
    // Base = 10 * 4 * 3 = 120 m
    // Con +10% = 120 * 1.10 = 132 m
    const res = calcularEstimacionParametricaMaterial({
      modelo: 'bocas_distancia',
      cantidadBocas: 10,
      distanciaPromedioBocasM: 4,
      conductoresPorCaneria: 3,
      margenDesperdicioErrorPct: 10
    }, 'm');

    expect(res.cantidadEstimadaTotal).toBe(132);
    expect(res.formulaGenerada).toBe('(10 * 4 * 3) * 1.10');
  });
});

describe('Motor Universal de Fórmulas y Variables para Trabajos Tipo', () => {
  it('evalúa dinámicamente insumos y mano de obra a partir de los parámetros y variables calculadas', () => {
    const tareaDinamica: TareaTipo = {
      id: 'tt-dinamica-recableado',
      nombre: 'Recableado Personalizado',
      categoria: 'Bocas',
      unidad: 'boca',
      clausulaExclusiones: 'No incluye apertura de losas.',
      parametros: [
        { id: 'bocas', nombre: 'Bocas', tipo: 'numero', valorDefault: 10 },
        { id: 'k_estado', nombre: 'Estado', tipo: 'select', valorDefault: 1.6 },
        { id: 'k_altura', nombre: 'Altura', tipo: 'select', valorDefault: 1.0 },
        { id: 'desarmes', nombre: 'Desarmes', tipo: 'numero', valorDefault: 2 }
      ],
      variables: [
        { id: 'metros_cable', nombre: 'Metros de Cable', formula: 'bocas * 12 * 1.10' },
        { id: 'k_complejidad', nombre: 'Complejidad MO', formula: 'k_estado * k_altura' }
      ],
      insumos: [
        {
          materialId: 'mat-cable-25-marron',
          cantidad: 12,
          formula: 'metros_cable'
        }
      ],
      manoObra: [
        {
          categoriaId: 'mo-oficial',
          horas: 1.5,
          formula: '(bocas * 1.5) * k_complejidad + (desarmes * 1.5)'
        },
        {
          categoriaId: 'mo-ayudante',
          horas: 0.8,
          formula: '(bocas * 0.8) * k_complejidad'
        }
      ]
    };

    const variablesInput = {
      bocas: 10,
      k_estado: 1.6,
      k_altura: 1.0,
      desarmes: 2
    };

    const testInsumosMap = new Map<string, Insumo>([
      [
        'mat-cable-25-marron',
        {
          id: 'mat-cable-25-marron',
          categoriaId: 'cableado',
          nombre: 'Cable Unipolar 2.5 mm2 Marrón',
          unidadVenta: 'm',
          atributos: [],
          activo: true,
          precioActual: 800
        }
      ]
    ]);

    const testManoObraMap = new Map<string, CategoriaManoDeObra>([
      [
        'mo-oficial',
        {
          id: 'mo-oficial',
          nombre: 'Oficial Electricista',
          costoHora: 7500,
          fechaActualizacion: new Date().toISOString()
        }
      ],
      [
        'mo-ayudante',
        {
          id: 'mo-ayudante',
          nombre: 'Ayudante',
          costoHora: 5000,
          fechaActualizacion: new Date().toISOString()
        }
      ]
    ]);

    const resultado = calcularConsumosTareaTipo(
      tareaDinamica,
      variablesInput,
      testInsumosMap,
      testManoObraMap,
      { tipoFactura: 'Factura A' }
    );

    // Parámetros y variables evaluadas
    expect(resultado.valoresParametros['bocas']).toBe(10);
    expect(resultado.valoresVariables['metros_cable']).toBe(132);
    expect(resultado.valoresVariables['k_complejidad']).toBe(1.6);

    // Insumos: 10 * 12 * 1.10 = 132 m de cable a $800 = $105.600
    expect(resultado.insumosSnapshot[0].cantidadTotal).toBe(132);
    expect(resultado.costoInsumosTotal).toBe(105600);

    // Oficial: (10 * 1.5) * 1.6 * 1.0 + (2 * 1.5) = 24 + 3 = 27 horas a $7.500 = $202.500
    expect(resultado.manoObraSnapshot[0].horasTotales).toBe(27);
    expect(resultado.manoObraSnapshot[0].subtotalManoObra).toBe(202500);

    // Ayudante: (10 * 0.8) * 1.6 * 1.0 = 12.8 horas a $5.000 = $64.000
    expect(resultado.manoObraSnapshot[1].horasTotales).toBe(12.8);
    expect(resultado.manoObraSnapshot[1].subtotalManoObra).toBe(64000);

    // Costo Total = Insumos ($105.600) + Oficial ($202.500) + Ayudante ($64.000) = $372.100
    expect(resultado.costoManoObraTotal).toBe(266500);
    expect(resultado.costoDirectoTotal).toBe(372100);
    expect(resultado.clausulaExclusiones).toBe('No incluye apertura de losas.');
  });

  it('calcula dinámicamente horas de setup/salida de mano de obra en función de tarifas vigentes y variables', () => {
    const tareaConSetupDinamico: TareaTipo = {
      id: 'tt-con-setup-dinamico',
      nombre: 'Instalación con Setup Calculado',
      categoria: 'Bocas',
      unidad: 'boca',
      parametros: [
        { id: 'bocas', nombre: 'Bocas', tipo: 'numero', valorDefault: 2 },
        { id: 'visitas', nombre: 'Visitas a Obra', tipo: 'numero', valorDefault: 1 }
      ],
      insumos: [
        // 5 metros fijos de cabecera/bajada + 10 m por boca
        { materialId: 'mat-cable-25-marron', cantidad: 10, formula: '5 + (bocas * 10)' }
      ],
      manoObra: [
        // 1.5 hs fijas de oficial por visita + 1.2 hs por boca
        { categoriaId: 'mo-oficial', horas: 1.0, formula: '(visitas * 1.5) + (bocas * 1.2)' },
        // 1.0 hs fija de ayudante por visita + 0.8 hs por boca
        { categoriaId: 'mo-ayudante', horas: 0.8, formula: '(visitas * 1.0) + (bocas * 0.8)' }
      ]
    };

    const testInsumosMap = new Map<string, Insumo>([
      [
        'mat-cable-25-marron',
        {
          id: 'mat-cable-25-marron',
          categoriaId: 'cableado',
          nombre: 'Cable',
          unidadVenta: 'm',
          atributos: [],
          activo: true,
          precioActual: 1000
        }
      ]
    ]);

    const testManoObraMap = new Map<string, CategoriaManoDeObra>([
      [
        'mo-oficial',
        {
          id: 'mo-oficial',
          nombre: 'Oficial Electricista',
          costoHora: 10000,
          fechaActualizacion: new Date().toISOString()
        }
      ],
      [
        'mo-ayudante',
        {
          id: 'mo-ayudante',
          nombre: 'Ayudante',
          costoHora: 6000,
          fechaActualizacion: new Date().toISOString()
        }
      ]
    ]);

    // Para 2 bocas y 1 visita:
    // Insumos = 5 + (2 * 10) = 25 m * $1000 = $25.000
    // Oficial = (1 * 1.5) + (2 * 1.2) = 1.5 + 2.4 = 3.9 hs * $10.000 = $39.000
    // Ayudante = (1 * 1.0) + (2 * 0.8) = 1.0 + 1.6 = 2.6 hs * $6.000 = $15.600
    // Total Directo = $25.000 + $39.000 + $15.600 = $79.600
    const res = calcularConsumosTareaTipo(
      tareaConSetupDinamico,
      { bocas: 2, visitas: 1 },
      testInsumosMap,
      testManoObraMap,
      { tipoFactura: 'Factura A' }
    );

    expect(res.insumosSnapshot[0].cantidadTotal).toBe(25);
    expect(res.costoInsumosTotal).toBe(25000);
    expect(res.manoObraSnapshot[0].horasTotales).toBe(3.9);
    expect(res.manoObraSnapshot[0].subtotalManoObra).toBe(39000);
    expect(res.manoObraSnapshot[1].horasTotales).toBe(2.6);
    expect(res.manoObraSnapshot[1].subtotalManoObra).toBe(15600);
    expect(res.costoManoObraTotal).toBe(54600);
    expect(res.costoDirectoTotal).toBe(79600);
  });

  it('evalúa condiciones lógicas y comparaciones de materiales/MO correctamente (evaluateCondition)', () => {
    expect(evaluateCondition('', {})).toBe(true);
    expect(evaluateCondition(undefined, {})).toBe(true);
    expect(evaluateCondition('calibre_principal <= 25', { calibre_principal: 25 })).toBe(true);
    expect(evaluateCondition('calibre_principal <= 25', { calibre_principal: 32 })).toBe(false);
    expect(evaluateCondition('calibre_principal > 25 && calibre_principal <= 40', { calibre_principal: 32 })).toBe(true);
    expect(evaluateCondition('calibre_principal > 25 && calibre_principal <= 40', { calibre_principal: 50 })).toBe(false);
    expect(evaluateCondition('requiere_certificacion == 1', { requiere_certificacion: 0 })).toBe(false);
    expect(evaluateCondition('requiere_certificacion == 1', { requiere_certificacion: 1 })).toBe(true);
  });

  it('aplica selección condicional de protecciones (térmicas y disyuntores coordinados) en TareaTipo', () => {
    const testInsumosMap = new Map<string, Insumo>([
      ['mat-pia-25', { id: 'mat-pia-25', categoriaId: 'cat-protecciones', nombre: 'PIA 2x25A', unidadVenta: 'u', atributos: [], activo: true, precioActual: 10000 }],
      ['mat-pia-32', { id: 'mat-pia-32', categoriaId: 'cat-protecciones', nombre: 'PIA 2x32A', unidadVenta: 'u', atributos: [], activo: true, precioActual: 12000 }],
      ['mat-dif-25', { id: 'mat-dif-25', categoriaId: 'cat-protecciones', nombre: 'Diferencial 2x25A', unidadVenta: 'u', atributos: [], activo: true, precioActual: 30000 }],
      ['mat-dif-40', { id: 'mat-dif-40', categoriaId: 'cat-protecciones', nombre: 'Diferencial 2x40A', unidadVenta: 'u', atributos: [], activo: true, precioActual: 35000 }]
    ]);

    const testManoObraMap = new Map<string, CategoriaManoDeObra>([
      ['mo-oficial', { id: 'mo-oficial', nombre: 'Oficial', costoHora: 10000, fechaActualizacion: '' }]
    ]);

    const tareaTablero: TareaTipo = {
      id: 'tt-test-tablero',
      nombre: 'Tablero Seccional',
      categoria: 'Tableros',
      unidad: 'tablero',
      parametros: [
        { id: 'calibre_principal', nombre: 'Calibre', tipo: 'select', valorDefault: 25 },
        { id: 'requiere_certificacion', nombre: 'Certificado', tipo: 'boolean', valorDefault: 0 }
      ],
      insumos: [
        { materialId: 'mat-pia-25', cantidad: 1, condicion: 'calibre_principal == 25' },
        { materialId: 'mat-pia-32', cantidad: 1, condicion: 'calibre_principal == 32' },
        { materialId: 'mat-dif-25', cantidad: 1, condicion: 'calibre_principal <= 25' },
        { materialId: 'mat-dif-40', cantidad: 1, condicion: 'calibre_principal > 25 && calibre_principal <= 40' }
      ],
      manoObra: [
        { categoriaId: 'mo-oficial', horas: 3, formula: '3' },
        { categoriaId: 'mo-oficial', horas: 1.5, condicion: 'requiere_certificacion == 1' }
      ]
    };

    // Caso 1: Calibre 25A sin certificación
    const res25 = calcularConsumosTareaTipo(tareaTablero, { calibre_principal: 25, requiere_certificacion: 0 }, testInsumosMap, testManoObraMap, { tipoFactura: 'Factura A' });
    expect(res25.insumosSnapshot.map(i => i.materialId)).toEqual(['mat-pia-25', 'mat-dif-25']);
    expect(res25.costoInsumosTotal).toBe(40000); // 10000 + 30000
    expect(res25.manoObraSnapshot[0].horasTotales).toBe(3);
    expect(res25.costoManoObraTotal).toBe(30000);

    // Caso 2: Calibre 32A con certificación
    const res32 = calcularConsumosTareaTipo(tareaTablero, { calibre_principal: 32, requiere_certificacion: 1 }, testInsumosMap, testManoObraMap, { tipoFactura: 'Factura A' });
    expect(res32.insumosSnapshot.map(i => i.materialId)).toEqual(['mat-pia-32', 'mat-dif-40']);
    expect(res32.costoInsumosTotal).toBe(47000); // 12000 + 35000
    expect(res32.manoObraSnapshot.length).toBe(2);
    expect(res32.costoManoObraTotal).toBe(45000); // (3 + 1.5) * 10000
  });

  it('resuelve correctamente slots dinámicos por reglas (Opción A) en TareaTipo', () => {
    const testInsumosMap = new Map<string, Insumo>([
      ['mat-tablero-8', { id: 'mat-tablero-8', categoriaId: 'cat-tableros', nombre: 'Gabinete 8M', unidadVenta: 'u', atributos: [], activo: true, precioActual: 15000 }],
      ['mat-tablero-12', { id: 'mat-tablero-12', categoriaId: 'cat-tableros', nombre: 'Gabinete 12M', unidadVenta: 'u', atributos: [], activo: true, precioActual: 22000 }],
      ['mat-tablero-18', { id: 'mat-tablero-18', categoriaId: 'cat-tableros', nombre: 'Gabinete 18M', unidadVenta: 'u', atributos: [], activo: true, precioActual: 30000 }],
      ['mat-pia-25', { id: 'mat-pia-25', categoriaId: 'cat-protecciones', nombre: 'PIA 2x25A', unidadVenta: 'u', atributos: [], activo: true, precioActual: 10000 }],
      ['mat-pia-32', { id: 'mat-pia-32', categoriaId: 'cat-protecciones', nombre: 'PIA 2x32A', unidadVenta: 'u', atributos: [], activo: true, precioActual: 12000 }],
      ['mat-dif-25', { id: 'mat-dif-25', categoriaId: 'cat-protecciones', nombre: 'Diferencial 2x25A', unidadVenta: 'u', atributos: [], activo: true, precioActual: 30000 }],
      ['mat-dif-40', { id: 'mat-dif-40', categoriaId: 'cat-protecciones', nombre: 'Diferencial 2x40A', unidadVenta: 'u', atributos: [], activo: true, precioActual: 35000 }],
      ['mat-pia-16', { id: 'mat-pia-16', categoriaId: 'cat-protecciones', nombre: 'PIA 2x16A', unidadVenta: 'u', atributos: [], activo: true, precioActual: 9000 }]
    ]);

    const testManoObraMap = new Map<string, CategoriaManoDeObra>([
      ['mo-oficial', { id: 'mo-oficial', nombre: 'Oficial', costoHora: 10000, fechaActualizacion: '' }],
      ['mo-ayudante', { id: 'mo-ayudante', nombre: 'Ayudante', costoHora: 6000, fechaActualizacion: '' }]
    ]);

    const tareaSlotTablero: TareaTipo = {
      id: 'tt-test-slots',
      nombre: 'Tablero Monofásico',
      categoria: 'Tableros',
      unidad: 'tablero',
      parametros: [
        { id: 'circuitos', nombre: 'Circuitos', tipo: 'numero', valorDefault: 4 },
        { id: 'calibre_principal', nombre: 'Térmica Cabecera', tipo: 'select', valorDefault: 32 },
        { id: 'requiere_certificacion', nombre: 'Certificación', tipo: 'boolean', valorDefault: 0 }
      ],
      insumos: [
        // Slot 1: Gabinete
        {
          nombreSlot: 'Gabinete DIN',
          cantidad: 1,
          reglasDinamicas: [
            { condicion: 'circuitos <= 2', materialId: 'mat-tablero-8' },
            { condicion: 'circuitos > 2 && circuitos <= 4', materialId: 'mat-tablero-12' },
            { condicion: 'circuitos > 4', materialId: 'mat-tablero-18' }
          ]
        },
        // Slot 2: Térmica General
        {
          nombreSlot: 'Térmica General',
          cantidad: 1,
          reglasDinamicas: [
            { condicion: 'calibre_principal == 25', materialId: 'mat-pia-25' },
            { condicion: 'calibre_principal == 32', materialId: 'mat-pia-32' }
          ]
        },
        // Slot 3: Diferencial Coordinado
        {
          nombreSlot: 'Diferencial Coordinado',
          cantidad: 1,
          reglasDinamicas: [
            { condicion: 'calibre_principal <= 25', materialId: 'mat-dif-25' },
            { condicion: 'calibre_principal > 25', materialId: 'mat-dif-40' }
          ]
        },
        // Insumo 4: Térmicas derivadas
        {
          materialId: 'mat-pia-16',
          cantidad: 1,
          formula: 'circuitos'
        }
      ],
      manoObra: [
        { categoriaId: 'mo-oficial', horas: 2.5, formula: '2.5 + circuitos * 0.75' },
        { categoriaId: 'mo-ayudante', horas: 1.0, formula: '1.0 + circuitos * 0.35' },
        { categoriaId: 'mo-oficial', horas: 1.5, condicion: 'requiere_certificacion == 1' }
      ]
    };

    // Caso 1: 4 circuitos, Térmica 32A, Sin certificación
    const res = calcularConsumosTareaTipo(
      tareaSlotTablero,
      { circuitos: 4, calibre_principal: 32, requiere_certificacion: 0 },
      testInsumosMap,
      testManoObraMap,
      { tipoFactura: 'Factura A' }
    );

    // Debe resolver: Gabinete 12M (22k), Térmica 32A (12k), Diferencial 40A (35k), 4 Térmicas 16A (36k)
    expect(res.insumosSnapshot.map(i => i.materialId)).toEqual(['mat-tablero-12', 'mat-pia-32', 'mat-dif-40', 'mat-pia-16']);
    expect(res.insumosSnapshot.find(i => i.materialId === 'mat-pia-16')?.cantidadTotal).toBe(4);
    expect(res.costoInsumosTotal).toBe(22000 + 12000 + 35000 + 36000); // 105.000

    // Horas: Oficial = 2.5 + 4*0.75 = 5.5hs ($55.000), Ayudante = 1.0 + 4*0.35 = 2.4hs ($14.400)
    expect(res.manoObraSnapshot[0].horasTotales).toBe(5.5);
    expect(res.manoObraSnapshot[1].horasTotales).toBe(2.4);
    expect(res.manoObraSnapshot.length).toBe(2);
    expect(res.costoManoObraTotal).toBe(69400);

    // Caso 2: 1 circuito, Térmica 25A, Con certificación
    const resCert = calcularConsumosTareaTipo(
      tareaSlotTablero,
      { circuitos: 1, calibre_principal: 25, requiere_certificacion: 1 },
      testInsumosMap,
      testManoObraMap,
      { tipoFactura: 'Factura A' }
    );

    // Debe resolver: Gabinete 8M (15k), Térmica 25A (10k), Diferencial 25A (30k), 1 Térmica 16A (9k)
    expect(resCert.insumosSnapshot.map(i => i.materialId)).toEqual(['mat-tablero-8', 'mat-pia-25', 'mat-dif-25', 'mat-pia-16']);
    expect(resCert.insumosSnapshot.find(i => i.materialId === 'mat-pia-16')?.cantidadTotal).toBe(1);
    expect(resCert.costoInsumosTotal).toBe(15000 + 10000 + 30000 + 9000); // 64.000
    // Oficial tiene 2 renglones: Base (2.5 + 0.75 = 3.25hs) + Certificación (1.5hs)
    expect(resCert.manoObraSnapshot.length).toBe(3);
  });

  it('resuelve correctamente materiales por filtro dinámico de categoría y atributos técnicos (filtroMaterial)', () => {
    const testInsumosMap = new Map<string, Insumo>([
      ['mat-tablero-din-8-emb', { id: 'mat-tablero-din-8-emb', categoriaId: 'cat-tableros', nombre: 'Gabinete DIN 8M Embutir', unidadVenta: 'u', atributos: [{ clave: 'tipo_tablero', valor: 'Gabinete DIN' }, { clave: 'tipo_instalacion', valor: 'Embutir' }, { clave: 'capacidad_modulos', valor: '8' }], activo: true, precioActual: 15000 }],
      ['mat-tablero-din-12-emb', { id: 'mat-tablero-din-12-emb', categoriaId: 'cat-tableros', nombre: 'Gabinete DIN 12M Embutir', unidadVenta: 'u', atributos: [{ clave: 'tipo_tablero', valor: 'Gabinete DIN' }, { clave: 'tipo_instalacion', valor: 'Embutir' }, { clave: 'capacidad_modulos', valor: '12' }], activo: true, precioActual: 22000 }],
      ['mat-tablero-din-18-emb', { id: 'mat-tablero-din-18-emb', categoriaId: 'cat-tableros', nombre: 'Gabinete DIN 18M Embutir', unidadVenta: 'u', atributos: [{ clave: 'tipo_tablero', valor: 'Gabinete DIN' }, { clave: 'tipo_instalacion', valor: 'Embutir' }, { clave: 'capacidad_modulos', valor: '18' }], activo: true, precioActual: 30000 }],
      ['mat-pia-2x25', { id: 'mat-pia-2x25', categoriaId: 'cat-termomagneticas', nombre: 'PIA 2P 25A', unidadVenta: 'u', atributos: [{ clave: 'polos', valor: '2' }, { clave: 'In', valor: '25' }, { clave: 'curva', valor: 'Curva C' }], activo: true, precioActual: 10000 }],
      ['mat-pia-2x32', { id: 'mat-pia-2x32', categoriaId: 'cat-termomagneticas', nombre: 'PIA 2P 32A', unidadVenta: 'u', atributos: [{ clave: 'polos', valor: '2' }, { clave: 'In', valor: '32' }, { clave: 'curva', valor: 'Curva C' }], activo: true, precioActual: 12000 }],
      ['mat-pia-2x40', { id: 'mat-pia-2x40', categoriaId: 'cat-termomagneticas', nombre: 'PIA 2P 40A', unidadVenta: 'u', atributos: [{ clave: 'polos', valor: '2' }, { clave: 'In', valor: '40' }, { clave: 'curva', valor: 'Curva C' }], activo: true, precioActual: 14000 }],
      ['mat-dif-2x25', { id: 'mat-dif-2x25', categoriaId: 'cat-diferenciales', nombre: 'Diferencial 2P 25A 30mA', unidadVenta: 'u', atributos: [{ clave: 'polos', valor: '2' }, { clave: 'In', valor: '25' }, { clave: 'sensibilidad', valor: '30 mA' }], activo: true, precioActual: 30000 }],
      ['mat-dif-2x40', { id: 'mat-dif-2x40', categoriaId: 'cat-diferenciales', nombre: 'Diferencial 2P 40A 30mA', unidadVenta: 'u', atributos: [{ clave: 'polos', valor: '2' }, { clave: 'In', valor: '40' }, { clave: 'sensibilidad', valor: '30 mA' }], activo: true, precioActual: 35000 }],
      ['mat-dif-2x63', { id: 'mat-dif-2x63', categoriaId: 'cat-diferenciales', nombre: 'Diferencial 2P 63A 30mA', unidadVenta: 'u', atributos: [{ clave: 'polos', valor: '2' }, { clave: 'In', valor: '63' }, { clave: 'sensibilidad', valor: '30 mA' }], activo: true, precioActual: 45000 }],
      ['mat-pia-2x16', { id: 'mat-pia-2x16', categoriaId: 'cat-termomagneticas', nombre: 'PIA 2P 16A', unidadVenta: 'u', atributos: [{ clave: 'polos', valor: '2' }, { clave: 'In', valor: '16' }], activo: true, precioActual: 9000 }]
    ]);

    const testManoObraMap = new Map<string, CategoriaManoDeObra>([
      ['mo-oficial-electricista', { id: 'mo-oficial-electricista', nombre: 'Oficial', costoHora: 10000, fechaActualizacion: '' }],
      ['mo-ayudante', { id: 'mo-ayudante', nombre: 'Ayudante', costoHora: 6000, fechaActualizacion: '' }]
    ]);

    // Test 1: Búsqueda directa con resolverMaterialPorFiltro
    const matTérmica = resolverMaterialPorFiltro(
      {
        categoriaId: 'cat-termomagneticas',
        criterios: [
          { atributo: 'polos', operador: '==', valor: '2' },
          { atributo: 'In', operador: '==', valor: '$calibre_principal' },
          { atributo: 'curva', operador: '==', valor: 'Curva C' }
        ]
      },
      { calibre_principal: 32 },
      testInsumosMap
    );
    expect(matTérmica?.id).toBe('mat-pia-2x32');

    // Test 2: Búsqueda con condición >= y selección del menor calibre comercial que cumpla
    // Si la térmica es 32A, el diferencial coordinado debe ser >= 32A -> selecciona el de 40A
    const matDif = resolverMaterialPorFiltro(
      {
        categoriaId: 'cat-diferenciales',
        criterios: [
          { atributo: 'polos', operador: '==', valor: '2' },
          { atributo: 'In', operador: '>=', valor: '$calibre_principal' }
        ],
        estrategiaSeleccion: 'menor_valor_que_cumpla',
        atributoOrden: 'In'
      },
      { calibre_principal: 32 },
      testInsumosMap
    );
    expect(matDif?.id).toBe('mat-dif-2x40');

    // Test 3: Tablero completo con slots dinámicos
    const tareaTablero: TareaTipo = {
      id: 'test-tablero-seccional',
      nombre: 'Armado de Tablero Test',
      categoria: 'Tableros',
      unidad: 'tablero',
      parametros: [
        { id: 'circuitos', nombre: 'Circuitos', tipo: 'numero', valorDefault: 4 },
        { id: 'calibre_principal', nombre: 'Térmica General', tipo: 'numero', valorDefault: 32 }
      ],
      variables: [
        { id: 'modulos_requeridos', nombre: 'Módulos', formula: '4 + circuitos * 2' }
      ],
      insumos: [
        {
          nombreSlot: 'Gabinete DIN Embutir',
          cantidad: 1,
          filtroMaterial: {
            categoriaId: 'cat-tableros',
            criterios: [
              { atributo: 'tipo_tablero', operador: '==', valor: 'Gabinete DIN' },
              { atributo: 'tipo_instalacion', operador: '==', valor: 'Embutir' },
              { atributo: 'capacidad_modulos', operador: '>=', valor: '$modulos_requeridos' }
            ],
            estrategiaSeleccion: 'menor_valor_que_cumpla',
            atributoOrden: 'capacidad_modulos'
          }
        },
        {
          nombreSlot: 'Interruptor Termomagnético General',
          cantidad: 1,
          filtroMaterial: {
            categoriaId: 'cat-termomagneticas',
            criterios: [
              { atributo: 'polos', operador: '==', valor: '2' },
              { atributo: 'In', operador: '==', valor: '$calibre_principal' }
            ]
          }
        },
        {
          nombreSlot: 'Interruptor Diferencial Coordinado',
          cantidad: 1,
          filtroMaterial: {
            categoriaId: 'cat-diferenciales',
            criterios: [
              { atributo: 'polos', operador: '==', valor: '2' },
              { atributo: 'In', operador: '>=', valor: '$calibre_principal' }
            ],
            estrategiaSeleccion: 'menor_valor_que_cumpla',
            atributoOrden: 'In'
          }
        },
        {
          materialId: 'mat-pia-2x16',
          cantidad: 1,
          formula: 'circuitos'
        }
      ],
      manoObra: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const res = calcularConsumosTareaTipo(
      tareaTablero,
      { circuitos: 4, calibre_principal: 32 },
      testInsumosMap,
      testManoObraMap,
      { tipoFactura: 'Factura A' }
    );

    // Módulos requeridos = 4 + 4*2 = 12 módulos -> Selecciona Gabinete 12M
    // Térmica general = 32A -> Selecciona PIA 2x32A
    // Diferencial coordinado >= 32A -> Selecciona Diferencial 2x40A
    // Térmicas derivadas = 4 circuitos -> 4 x PIA 2x16A
    expect(res.insumosSnapshot.map(i => i.materialId)).toEqual([
      'mat-tablero-din-12-emb',
      'mat-pia-2x32',
      'mat-dif-2x40',
      'mat-pia-2x16'
    ]);
    expect(res.insumosSnapshot.find(i => i.materialId === 'mat-pia-2x16')?.cantidadTotal).toBe(4);
    expect(res.costoInsumosTotal).toBe(22000 + 12000 + 35000 + 36000); // 105.000
  });

  it('evalúa correctamente funciones matemáticas nativas (ceil, floor, round, int, min, max, etc.)', () => {
    // Ceil / Techo (redondeo hacia arriba)
    expect(evaluateMathExpression('ceil(14 / 4)').value).toBe(4);
    expect(evaluateMathExpression('techo(14 / 4)').value).toBe(4);
    expect(evaluateMathExpression('ceil(bocas / 4)', { bocas: 14 }).value).toBe(4);
    expect(evaluateMathExpression('ceil(bocas / 4)', { bocas: 16 }).value).toBe(4);
    expect(evaluateMathExpression('ceil(bocas / 4)', { bocas: 17 }).value).toBe(5);

    // Floor / Piso (redondeo hacia abajo / división entera)
    expect(evaluateMathExpression('floor(14 / 4)').value).toBe(3);
    expect(evaluateMathExpression('piso(14 / 4)').value).toBe(3);
    expect(evaluateMathExpression('floor(bocas / 4)', { bocas: 14 }).value).toBe(3);

    // Trunc / Int / Entero (truncamiento de decimales)
    expect(evaluateMathExpression('trunc(14 / 4)').value).toBe(3);
    expect(evaluateMathExpression('int(14 / 4)').value).toBe(3);
    expect(evaluateMathExpression('entero(14 / 4)').value).toBe(3);

    // Round / Redondear (al entero más cercano o con N decimales)
    expect(evaluateMathExpression('round(3.4)').value).toBe(3);
    expect(evaluateMathExpression('round(3.5)').value).toBe(4);
    expect(evaluateMathExpression('round(3.5678, 2)').value).toBe(3.57);
    expect(evaluateMathExpression('redondear(3.5678; 2)').value).toBe(3.57);

    // Min / Max / Abs / Sqrt
    expect(evaluateMathExpression('min(10, 5, 20)').value).toBe(5);
    expect(evaluateMathExpression('minimo(10; 5; 20)').value).toBe(5);
    expect(evaluateMathExpression('max(10, 5, 20)').value).toBe(20);
    expect(evaluateMathExpression('maximo(10; 5; 20)').value).toBe(20);
    expect(evaluateMathExpression('abs(-45.5)').value).toBe(45.5);
    expect(evaluateMathExpression('sqrt(144)').value).toBe(12);
    expect(evaluateMathExpression('raiz(144)').value).toBe(12);

    // Fórmulas combinadas y anidadas
    expect(evaluateMathExpression('4 + ceil(circuitos / 2) * 2', { circuitos: 5 }).value).toBe(10); // 4 + 3*2 = 10
    expect(evaluateMathExpression('max(ceil(bocas / 4), 2)', { bocas: 3 }).value).toBe(2);
    expect(evaluateMathExpression('max(ceil(bocas / 4), 2)', { bocas: 15 }).value).toBe(4);
  });
});

describe('14. Motor de Optimización de Sinergia de Obra & Cuadrilla', () => {
  const mockItems: ItemPresupuesto[] = [
    {
      id: 'it-1',
      descripcion: 'Cableado Vivienda',
      cantidad: 1,
      unidad: 'u',
      costoInsumos: 50000,
      costoManoObra: 120000,
      costoDirectoTotal: 170000,
      costoTotal: 170000,
      precioVentaUnitario: 170000,
      precioVentaTotal: 170000,
      insumosSnapshot: [],
      manoObraSnapshot: [
        {
          categoriaId: 'mo-oficial-electricista',
          nombreCategoria: 'Oficial Electricista',
          horasUnitarias: 6,
          horasTotales: 6,
          costoHoraCongelado: 12000,
          subtotalManoObra: 72000
        },
        {
          categoriaId: 'mo-ayudante',
          nombreCategoria: 'Ayudante',
          horasUnitarias: 6,
          horasTotales: 6,
          costoHoraCongelado: 8000,
          subtotalManoObra: 48000
        }
      ]
    },
    {
      id: 'it-2',
      descripcion: 'Montaje de Tablero',
      cantidad: 1,
      unidad: 'u',
      costoInsumos: 40000,
      costoManoObra: 60000,
      costoDirectoTotal: 100000,
      costoTotal: 100000,
      precioVentaUnitario: 100000,
      precioVentaTotal: 100000,
      insumosSnapshot: [],
      manoObraSnapshot: [
        {
          categoriaId: 'mo-oficial-electricista',
          nombreCategoria: 'Oficial Electricista',
          horasUnitarias: 5,
          horasTotales: 5,
          costoHoraCongelado: 12000,
          subtotalManoObra: 60000
        }
      ]
    }
  ];

  it('calcula la sinergia determinística de mano de obra (consolidación de setup y bono tándem)', () => {
    // 1 Operario (sin bono tándem, solo setup consolidado)
    const sinergia1Op = calcularSinergiaManoObra({
      items: mockItems,
      operarios: 1,
      horasEfectivasJornada: 7.0
    });

    expect(sinergia1Op.horasTeoricasTotal).toBe(17);
    expect(sinergia1Op.operarios).toBe(1);
    expect(sinergia1Op.bonoTandemHs).toBe(0);
    expect(sinergia1Op.ahorroSetupHs).toBeGreaterThan(0);
    expect(sinergia1Op.factorSinergia).toBeLessThan(1.0);
    expect(sinergia1Op.tiempoObraHorasReloj).toBe(sinergia1Op.horasFinales);
    expect(sinergia1Op.jornadasEstimadas).toBe(roundMoney(sinergia1Op.horasFinales / 7.0));
    expect(sinergia1Op.sonCompatibles).toBe(true);

    // 2 Operarios (setup consolidado + 10% bono tándem: 1 Oficial + 1 Ayudante)
    const mockCatMO: CategoriaManoDeObra[] = [
      { id: 'mo-of', nombre: 'Oficial Electricista', costoHora: 14000, rol: 'oficial', fechaActualizacion: '' },
      { id: 'mo-ay', nombre: 'Ayudante Práctico', costoHora: 10000, rol: 'ayudante', fechaActualizacion: '' }
    ];

    const sinergia2Ops = calcularSinergiaManoObra({
      items: mockItems,
      operarios: 2,
      horasEfectivasJornada: 7.0,
      categoriasManoObra: mockCatMO
    });

    expect(sinergia2Ops.horasTeoricasTotal).toBe(17);
    expect(sinergia2Ops.operarios).toBe(2);
    expect(sinergia2Ops.composicionCuadrillaTexto).toBe('1 Oficial + 1 Ayudante');
    expect(sinergia2Ops.tarifaPonderadaCuadrilla).toBe(12000); // (14000 + 10000) / 2
    expect(sinergia2Ops.bonoTandemHs).toBe(roundMoney(17 * 0.10));
    expect(sinergia2Ops.horasFinales).toBeLessThan(sinergia1Op.horasFinales);
    expect(sinergia2Ops.factorSinergia).toBeLessThan(1.0);
    expect(sinergia2Ops.tiempoObraHorasReloj).toBe(roundMoney(sinergia2Ops.horasFinales / 2));
    expect(sinergia2Ops.jornadasEstimadas).toBe(roundMoney(sinergia2Ops.horasFinales / 14.0));

    // 3 Operarios: 2 Oficiales + 1 Ayudante
    const sinergia3Ops = calcularSinergiaManoObra({
      items: mockItems,
      operarios: 3,
      horasEfectivasJornada: 7.0,
      categoriasManoObra: mockCatMO
    });

    expect(sinergia3Ops.operarios).toBe(3);
    expect(sinergia3Ops.composicionCuadrillaTexto).toBe('2 Oficiales + 1 Ayudante');
    expect(sinergia3Ops.tarifaPonderadaCuadrilla).toBe(roundMoney((2 * 14000 + 10000) / 3)); // 12666.67
    expect(sinergia3Ops.jornadasEstimadas).toBeLessThan(sinergia2Ops.jornadasEstimadas);

    // 4 Operarios (2 cuadrillas: 2 Oficiales + 2 Ayudantes)
    const sinergia4Ops = calcularSinergiaManoObra({
      items: mockItems,
      operarios: 4,
      horasEfectivasJornada: 7.0,
      categoriasManoObra: mockCatMO
    });

    expect(sinergia4Ops.operarios).toBe(4);
    expect(sinergia4Ops.composicionCuadrillaTexto).toBe('2 Oficiales + 2 Ayudantes');
    expect(sinergia4Ops.tarifaPonderadaCuadrilla).toBe(12000);
    expect(sinergia4Ops.tiempoObraHorasReloj).toBe(roundMoney(sinergia2Ops.tiempoObraHorasReloj / 2));
    expect(sinergia4Ops.jornadasEstimadas).toBe(roundMoney(sinergia2Ops.jornadasEstimadas / 2));
  });

  it('aplica el Margen de Riesgo Global sobre el Costo Directo en calcularTotalesPresupuesto', () => {
    const sinRiesgo = calcularTotalesPresupuesto({
      items: mockItems,
      margenPorcentaje: 30,
      margenRiesgoPorcentaje: 0,
      impuestosDetalle: [],
      factorSinergiaManoObra: 1.0
    });

    const conRiesgo20 = calcularTotalesPresupuesto({
      items: mockItems,
      margenPorcentaje: 30,
      margenRiesgoPorcentaje: 20,
      impuestosDetalle: [],
      factorSinergiaManoObra: 1.0
    });

    // Costo directo base (C base) sin riesgo
    const cBase = sinRiesgo.costoGlobal;
    expect(conRiesgo20.costoDirectoBase).toBe(cBase);
    expect(conRiesgo20.montoMargenRiesgo).toBe(roundMoney(cBase * 0.20));
    expect(conRiesgo20.costoGlobal).toBe(roundMoney(cBase * 1.20));
    expect(conRiesgo20.precioFinalGlobal).toBeGreaterThan(sinRiesgo.precioFinalGlobal);
  });

  it('integra factorSinergiaManoObra en calcularTotalesPresupuesto reduciendo el costo de MOD', () => {
    const sinSinergia = calcularTotalesPresupuesto({
      items: mockItems,
      margenPorcentaje: 30,
      impuestosDetalle: [],
      factorSinergiaManoObra: 1.0
    });

    const conSinergia = calcularTotalesPresupuesto({
      items: mockItems,
      margenPorcentaje: 30,
      impuestosDetalle: [],
      factorSinergiaManoObra: 0.85
    });

    // MOD con sinergia debe ser exactamente 85% de la teórica
    expect(conSinergia.subtotalManoObra).toBe(roundMoney(sinSinergia.subtotalManoObra * 0.85));
    expect(conSinergia.ahorroSinergiaManoObra).toBeGreaterThan(0);
    expect(conSinergia.totalARS).toBeLessThan(sinSinergia.totalARS);
  });

  it('no aplica sinergia por defecto cuando hay 1 solo ítem o ítems no compatibles', () => {
    const singleItem = [mockItems[0]];
    expect(sonItemsCompatiblesParaSinergia(singleItem)).toBe(false);

    const resSingle = calcularSinergiaManoObra({
      items: singleItem,
      operarios: 2
    });

    // Con 1 solo ítem, el factor de sinergia debe ser estrictamente 1.0
    expect(resSingle.factorSinergia).toBe(1.0);
    expect(resSingle.ahorroSetupHs).toBe(0);
    expect(resSingle.bonoTandemHs).toBe(0);
    expect(resSingle.sonCompatibles).toBe(false);
  });

  it('evalúa la tarea tipo por defecto de recableado con cuadrilla sincronizada e insumos condicionales', () => {
    const recableadoTask = INITIAL_TAREAS_TIPO.find(t => t.id === 'tt-cableado-vivienda-10kw');
    expect(recableadoTask).toBeDefined();
    if (!recableadoTask) return;

    // Crear catálogo mock para cables
    const mockCatalogo = new Map<string, Insumo>([
      ['mat-c-25-marron', { id: 'mat-c-25-marron', categoriaId: 'cat-cables', nombre: 'Cable 2.5 Marrón', unidad: 'm', precioActual: 300, alicuotaIVA: 21, atributos: [{ clave: 'tipo_cable', valor: 'Unipolar IRAM 247-3' }, { clave: 'seccion', valor: '2.5' }, { clave: 'color', valor: 'Marrón (Fase)' }] } as unknown as Insumo],
      ['mat-c-25-celeste', { id: 'mat-c-25-celeste', categoriaId: 'cat-cables', nombre: 'Cable 2.5 Celeste', unidad: 'm', precioActual: 300, alicuotaIVA: 21, atributos: [{ clave: 'tipo_cable', valor: 'Unipolar IRAM 247-3' }, { clave: 'seccion', valor: '2.5' }, { clave: 'color', valor: 'Celeste (Neutro)' }] } as unknown as Insumo],
      ['mat-c-25-tierra', { id: 'mat-c-25-tierra', categoriaId: 'cat-cables', nombre: 'Cable 2.5 Tierra', unidad: 'm', precioActual: 300, alicuotaIVA: 21, atributos: [{ clave: 'tipo_cable', valor: 'Unipolar IRAM 247-3' }, { clave: 'seccion', valor: '2.5' }, { clave: 'color', valor: 'Verde/Amarillo (Tierra)' }] } as unknown as Insumo],
      ['mat-c-15-marron', { id: 'mat-c-15-marron', categoriaId: 'cat-cables', nombre: 'Cable 1.5 Marrón', unidad: 'm', precioActual: 200, alicuotaIVA: 21, atributos: [{ clave: 'tipo_cable', valor: 'Unipolar IRAM 247-3' }, { clave: 'seccion', valor: '1.5' }, { clave: 'color', valor: 'Marrón (Fase)' }] } as unknown as Insumo],
      ['mat-c-15-celeste', { id: 'mat-c-15-celeste', categoriaId: 'cat-cables', nombre: 'Cable 1.5 Celeste', unidad: 'm', precioActual: 200, alicuotaIVA: 21, atributos: [{ clave: 'tipo_cable', valor: 'Unipolar IRAM 247-3' }, { clave: 'seccion', valor: '1.5' }, { clave: 'color', valor: 'Celeste (Neutro)' }] } as unknown as Insumo],
      ['mat-c-15-blanco', { id: 'mat-c-15-blanco', categoriaId: 'cat-cables', nombre: 'Cable 1.5 Blanco', unidad: 'm', precioActual: 200, alicuotaIVA: 21, atributos: [{ clave: 'tipo_cable', valor: 'Unipolar IRAM 247-3' }, { clave: 'seccion', valor: '1.5' }, { clave: 'color', valor: 'Blanco (Retorno)' }] } as unknown as Insumo],
      ['mat-c-15-tierra', { id: 'mat-c-15-tierra', categoriaId: 'cat-cables', nombre: 'Cable 1.5 Tierra', unidad: 'm', precioActual: 200, alicuotaIVA: 21, atributos: [{ clave: 'tipo_cable', valor: 'Unipolar IRAM 247-3' }, { clave: 'seccion', valor: '1.5' }, { clave: 'color', valor: 'Verde/Amarillo (Tierra)' }] } as unknown as Insumo]
    ]);

    const mockMO = new Map<string, CategoriaManoDeObra>([
      ['mo-ayudante', { id: 'mo-ayudante', nombre: 'Ayudante', costoHora: 8000, fechaActualizacion: '2026-08-28' }],
      ['mo-oficial-electricista', { id: 'mo-oficial-electricista', nombre: 'Oficial Electricista', costoHora: 14000, fechaActualizacion: '2026-08-28' }]
    ]);

    // Evaluación de recableado estándar (TUG=10, IUG=5, TUE=0, ESP=0)
    const evaluacion = calcularConsumosTareaTipo(
      recableadoTask,
      { tug: 10, iug: 5, tue: 0, esp: 0, superficie: 50, estado_caneria: 1 },
      mockCatalogo,
      mockMO
    );

    // 1. Los tiempos de oficial y ayudante deben ser EXACTAMENTE IDÉNTICOS (actúan como cuadrilla en tándem)
    const hsAyudante = evaluacion.manoObraSnapshot.find(m => m.categoriaId === 'mo-ayudante')?.horasTotales;
    const hsOficial = evaluacion.manoObraSnapshot.find(m => m.categoriaId === 'mo-oficial-electricista')?.horasTotales;
    expect(hsAyudante).toBeDefined();
    expect(hsOficial).toBeDefined();
    expect(hsAyudante).toBe(hsOficial);

    // 2. SIEMPRE se computa cable Verde/Amarillo (PE Puesta a Tierra) para los circuitos presentes
    const tierraItems = evaluacion.insumosSnapshot.filter(i => i.nombre.toLowerCase().includes('tierra'));
    expect(tierraItems.length).toBe(2); // 2.5mm² para TUG y 1.5mm² para IUG
    expect(tierraItems.some(i => i.nombre.includes('2.5'))).toBe(true);
    expect(tierraItems.some(i => i.nombre.includes('1.5'))).toBe(true);
  });
});

// ─── 15. Estructura de Gastos Directos (MO, Materiales, Servicios) vs Indirectos & Capítulos ──────

describe('15. Estructura de Gastos Directos vs Indirectos, Fórmulas Paramétricas y Capítulos', () => {
  it('aplica Cargas Sociales como gasto directo sobre Mano de Obra e impacta en el Subtotal MO', () => {
    const item = makeItem({
      insumosSnapshot: [],
      manoObraSnapshot: [],
      costoInsumos: 100000,
      costoManoObra: 50000,
      costoDirectoTotal: 150000,
      cantidad: 1
    });

    const gastos: GastoPresupuestoConfig[] = [
      {
        id: 'g-cs-mo',
        nombre: 'Cargas Sociales y ART (40% s/MO)',
        destino: 'mano_obra',
        modalidad: 'porcentual',
        valor: 40,
        aplica: true
      }
    ];

    const result = calcularTotalesPresupuesto({
      items: [item],
      gastosConfig: gastos,
      margenPorcentaje: 0,
      impuestosDetalle: []
    });

    // Base MO = 50.000 -> Gastos MO (40%) = 20.000 -> Subtotal MO = 70.000
    expect(result.subtotalManoObraBase).toBe(50000);
    expect(result.gastosManoObraTotal).toBe(20000);
    expect(result.subtotalManoObra).toBe(70000);
    expect(result.subtotalManoObraTotal).toBe(70000);

    // Materiales queda sin modificar (100.000)
    expect(result.subtotalInsumos).toBe(100000);
    expect(result.gastosMaterialesTotal).toBe(0);

    // Costo Directo Total (C) = 100.000 + 70.000 = 170.000
    expect(result.costoGlobal).toBe(170000);
  });

  it('aplica Garantía / Merma como gasto directo sobre Materiales', () => {
    const item = makeItem({
      insumosSnapshot: [],
      manoObraSnapshot: [],
      costoInsumos: 80000,
      costoManoObra: 20000,
      costoDirectoTotal: 100000,
      cantidad: 1
    });

    const gastos: GastoPresupuestoConfig[] = [
      {
        id: 'g-garantia-mat',
        nombre: 'Garantía y Roturas (10% s/Materiales)',
        destino: 'materiales',
        modalidad: 'porcentual',
        valor: 10,
        aplica: true
      }
    ];

    const result = calcularTotalesPresupuesto({
      items: [item],
      gastosConfig: gastos,
      margenPorcentaje: 0,
      impuestosDetalle: []
    });

    // Base Insumos = 80.000 -> Gastos Mat (10%) = 8.000 -> Subtotal Insumos = 88.000
    expect(result.subtotalInsumosBase).toBe(80000);
    expect(result.gastosMaterialesTotal).toBe(8000);
    expect(result.subtotalInsumos).toBe(88000);

    // Costo Directo Total (C) = 88.000 + 20.000 = 108.000
    expect(result.costoGlobal).toBe(108000);
  });

  it('calcula Gastos Directos en Servicios Tercerizados', () => {
    const item: ItemPresupuesto = {
      ...makeItem({
        insumosSnapshot: [],
        manoObraSnapshot: [],
        costoInsumos: 0,
        costoManoObra: 0,
        costoDirectoTotal: 50000,
        cantidad: 1
      }),
      tipoItem: 'servicio_tercerizado',
      costoServiciosTercerizados: 50000,
      serviciosTercerizados: [
        { id: 's-1', descripcion: 'Alquiler de Plataforma Elevadora', costo: 50000 }
      ]
    };

    const gastos: GastoPresupuestoConfig[] = [
      {
        id: 'g-combustible-serv',
        nombre: 'Combustible y Flete Elevador',
        destino: 'servicios',
        modalidad: 'monto_fijo',
        valor: 15000,
        aplica: true
      }
    ];

    const result = calcularTotalesPresupuesto({
      items: [item],
      gastosConfig: gastos,
      margenPorcentaje: 0,
      impuestosDetalle: []
    });

    expect(result.subtotalServiciosBase).toBe(50000);
    expect(result.gastosServiciosTotal).toBe(15000);
    expect(result.subtotalServiciosTotal).toBe(65000);
    expect(result.costoGlobal).toBe(65000);
  });

  it('evalúa fórmulas matemáticas paramétricas para gastos (ej: merma + flete fijo)', () => {
    const item = makeItem({
      insumosSnapshot: [],
      manoObraSnapshot: [],
      costoInsumos: 100000,
      costoManoObra: 40000,
      costoDirectoTotal: 140000,
      cantidad: 1
    });

    const gastos: GastoPresupuestoConfig[] = [
      {
        id: 'g-param',
        nombre: 'Merma 5% + Flete $3.000',
        destino: 'materiales',
        modalidad: 'parametrico',
        formula: 'materiales * 0.05 + 3000',
        valor: 0,
        aplica: true
      }
    ];

    const result = calcularTotalesPresupuesto({
      items: [item],
      gastosConfig: gastos,
      margenPorcentaje: 0,
      impuestosDetalle: []
    });

    // Fórmula: 100.000 * 0.05 + 3.000 = 5.000 + 3.000 = 8.000
    expect(result.gastosMaterialesTotal).toBe(8000);
    expect(result.subtotalInsumos).toBe(108000);
    expect(result.costoGlobal).toBe(148000);
  });

  it('organiza y calcula subtotales discriminados por Capítulos de Obra', () => {
    const itemCap1 = {
      ...makeItem({
        id: 'it-1',
        insumosSnapshot: [],
        manoObraSnapshot: [],
        costoInsumos: 30000,
        costoManoObra: 20000,
        costoDirectoTotal: 50000,
        cantidad: 1
      }),
      capituloId: 'cap-planta-baja'
    };

    const itemCap2 = {
      ...makeItem({
        id: 'it-2',
        insumosSnapshot: [],
        manoObraSnapshot: [],
        costoInsumos: 40000,
        costoManoObra: 30000,
        costoDirectoTotal: 70000,
        cantidad: 1
      }),
      capituloId: 'cap-planta-alta'
    };

    const capitulos: CapituloPresupuesto[] = [
      { id: 'cap-planta-baja', nombre: 'Planta Baja', orden: 1 },
      { id: 'cap-planta-alta', nombre: 'Planta Alta', orden: 2 }
    ];

    const result = calcularTotalesPresupuesto({
      items: [itemCap1, itemCap2],
      capitulos,
      margenPorcentaje: 20, // K = 1.20
      impuestosDetalle: []
    });

    // Costo Global = 50.000 + 70.000 = 120.000
    expect(result.costoGlobal).toBe(120000);
    expect(result.subtotalSinImpuestos).toBe(144000); // 120.000 * 1.20

    // Subtotales de cada Capítulo
    const cap1 = result.capitulosTotales['cap-planta-baja'];
    const cap2 = result.capitulosTotales['cap-planta-alta'];

    expect(cap1).toBeDefined();
    expect(cap1.costoDirectoTotal).toBe(50000);
    expect(cap1.precioVentaTotal).toBe(60000); // 50.000 * 1.20

    expect(cap2).toBeDefined();
    expect(cap2.costoDirectoTotal).toBe(70000);
    expect(cap2.precioVentaTotal).toBe(84000); // 70.000 * 1.20

    // Suma de Capítulos = Total Presupuesto
    expect(roundMoney(cap1.precioVentaTotal + cap2.precioVentaTotal)).toBe(result.precioFinalGlobal);
  });

  it('evalúa gastos paramétricos con parámetros personalizados de obra (ej: antigüedad y normas AEA)', () => {
    const item = makeItem({
      insumosSnapshot: [],
      manoObraSnapshot: [],
      costoInsumos: 60000,
      costoManoObra: 40000,
      costoDirectoTotal: 100000,
      cantidad: 1
    });

    const gastoContingencia: GastoPresupuestoConfig = {
      id: 'g-contingencia-aea',
      nombre: 'Contingencia por Instalación Existente',
      destino: 'costo_indirecto',
      modalidad: 'parametrico',
      // Fórmula: si cumple AEA (1) suma 5% de base, si no cumple (0) suma 20% de base + $500 por cada año de antigüedad
      formula: 'base * (cumple_aea == 1 ? 0.05 : 0.20) + antiguedad_anos * 500',
      parametros: [
        { id: 'cumple_aea', nombre: '¿Cumple AEA?', tipo: 'boolean', valorDefault: 1 },
        { id: 'antiguedad_anos', nombre: 'Antigüedad', tipo: 'numero', valorDefault: 20 }
      ],
      valoresParametros: {
        cumple_aea: 0, // No cumple AEA -> 20% de base
        antiguedad_anos: 30 // 30 años -> 30 * 500 = 15.000
      },
      valor: 0,
      aplica: true
    };

    const result = calcularTotalesPresupuesto({
      items: [item],
      gastosConfig: [gastoContingencia],
      margenPorcentaje: 0,
      impuestosDetalle: []
    });

    // Base directa = 100.000
    // GG = 100.000 * 0.20 + 30 * 500 = 20.000 + 15.000 = 35.000
    expect(result.costoGlobal).toBe(100000);
    expect(result.gastosGeneralesTotal).toBe(35000);
    expect(result.precioFinalGlobal).toBe(135000);

    const desg = result.gastosDesglosados.find(g => g.id === 'g-contingencia-aea');
    expect(desg).toBeDefined();
    expect(desg?.montoCalculado).toBe(35000);
    expect(desg?.valoresParametros).toEqual({
      cumple_aea: 0,
      antiguedad_anos: 30
    });
  });

  it('evalúa correctamente tareas tipo de naturaleza servicio profesional / protocolo (ej: SRT 900/15)', () => {
    const tareaSRT900: TareaTipo = {
      id: 'tt-protocolo-srt-900',
      nombre: 'Medición y Protocolo de Puesta a Tierra SRT 900/15',
      categoria: 'Medición / Protocolos',
      unidad: 'servicio',
      naturaleza: 'servicio_profesional',
      formulaHonorarios: '120000 + (cantidad_jabalinas > 1 ? (cantidad_jabalinas - 1) * 20000 : 0) + (cantidad_tableros * 10000) + (con_visado_colegial == 1 ? 35000 : 0)',
      parametros: [
        { id: 'cantidad_jabalinas', nombre: 'Cantidad de Jabalinas / Puntos PAT', tipo: 'numero', valorDefault: 1, unidad: 'jabalinas' },
        { id: 'cantidad_tableros', nombre: 'Cantidad de Tableros Eléctricos', tipo: 'numero', valorDefault: 2, unidad: 'tableros' },
        { id: 'con_visado_colegial', nombre: 'Requiere Visado Colegial', tipo: 'boolean', valorDefault: 1, unidad: 'Sí/No' }
      ],
      insumos: [],
      manoObra: []
    };

    // Caso 1: Valores default (1 jabalina, 2 tableros, con visado)
    // 120.000 + 0 + 2 * 10.000 + 35.000 = 175.000
    const consumos1 = calcularConsumosTareaTipo(tareaSRT900, {}, insumosMap, manoObraMap);
    expect(consumos1.costoServiciosTotal).toBe(175000);
    expect(consumos1.costoDirectoTotal).toBe(175000);
    expect(consumos1.costoInsumosTotal).toBe(0);
    expect(consumos1.costoManoObraTotal).toBe(0);

    // Caso 2: 3 jabalinas, 4 tableros, sin visado
    // 120.000 + (3 - 1) * 20.000 + 4 * 10.000 + 0 = 120.000 + 40.000 + 40.000 = 200.000
    const consumos2 = calcularConsumosTareaTipo(
      tareaSRT900,
      {
        cantidad_jabalinas: 3,
        cantidad_tableros: 4,
        con_visado_colegial: 0
      },
      insumosMap,
      manoObraMap
    );
    expect(consumos2.costoServiciosTotal).toBe(200000);
    expect(consumos2.costoDirectoTotal).toBe(200000);

    // Integración en Presupuesto: Congelar y calcular totales con margen
    const item: ItemPresupuesto = {
      id: 'item-srt',
      descripcion: tareaSRT900.nombre,
      unidad: 'servicio',
      cantidad: 1,
      naturaleza: 'servicio_profesional',
      costoServicios: consumos2.costoServiciosTotal,
      costoInsumos: 0,
      costoManoObra: 0,
      costoDirectoTotal: 200000,
      insumosSnapshot: [],
      manoObraSnapshot: [],
      precioVentaUnitario: 0,
      precioVentaTotal: 0
    };

    const itemCongelado = congelarItemPresupuesto(item, 2);
    expect(itemCongelado.cantidad).toBe(2);
    expect(itemCongelado.costoServicios).toBe(400000);
    expect(itemCongelado.costoDirectoTotal).toBe(400000);

    const totales = calcularTotalesPresupuesto({
      items: [itemCongelado],
      margenPorcentaje: 25, // 25% margen
      impuestosDetalle: []
    });

    expect(totales.subtotalServiciosBase).toBe(400000);
    expect(totales.costoGlobal).toBe(400000);
    expect(totales.precioFinalGlobal).toBe(500000); // 400.000 * 1.25
  });

  it('evalúa correctamente parámetros condicionales y dependientes en TareaTipo', () => {
    const testInsumosMap = new Map<string, Insumo>([
      ['mat-plano', { id: 'mat-plano', categoriaId: 'cat-doc', nombre: 'Plano Unifilar CAD', unidadVenta: 'u', atributos: [], activo: true, precioActual: 5000 }]
    ]);
    const testManoObraMap = new Map<string, CategoriaManoDeObra>([
      ['mo-ing', { id: 'mo-ing', nombre: 'Ingeniero', costoHora: 15000, fechaActualizacion: '' }]
    ]);

    const tareaCondicional: TareaTipo = {
      id: 'tt-test-condicional',
      nombre: 'Relevamiento y Planos',
      categoria: 'Ingeniería',
      unidad: 'global',
      parametros: [
        { id: 'requiere_unifilar', nombre: '¿Requiere Unifilar?', tipo: 'boolean', valorDefault: 0 },
        { id: 'cant_unifilares', nombre: 'Cantidad Unifilares', tipo: 'numero', valorDefault: 1, condicion: 'requiere_unifilar == 1' }
      ],
      variables: [
        { id: 'total_planos', nombre: 'Total Planos', formula: 'cant_unifilares' }
      ],
      insumos: [
        { materialId: 'mat-plano', cantidad: 1, formula: 'cant_unifilares', condicion: 'cant_unifilares > 0' }
      ],
      manoObra: [
        { categoriaId: 'mo-ing', horas: 2, formula: 'cant_unifilares * 2', condicion: 'cant_unifilares > 0' }
      ]
    };

    // Caso A: requiere_unifilar = 0 (inactivo). cant_unifilares debe forzarse a 0 aunque se pase un valor
    const resOff = calcularConsumosTareaTipo(tareaCondicional, { requiere_unifilar: 0, cant_unifilares: 5 }, testInsumosMap, testManoObraMap);
    expect(resOff.valoresParametros['requiere_unifilar']).toBe(0);
    expect(resOff.valoresParametros['cant_unifilares']).toBe(0);
    expect(resOff.valoresVariables['total_planos']).toBe(0);
    expect(resOff.insumosSnapshot.length).toBe(0);
    expect(resOff.manoObraSnapshot.length).toBe(0);
    expect(resOff.costoDirectoTotal).toBe(0);

    // Caso B: requiere_unifilar = 1 (activo). cant_unifilares = 3
    const resOn = calcularConsumosTareaTipo(tareaCondicional, { requiere_unifilar: 1, cant_unifilares: 3 }, testInsumosMap, testManoObraMap);
    expect(resOn.valoresParametros['requiere_unifilar']).toBe(1);
    expect(resOn.valoresParametros['cant_unifilares']).toBe(3);
    expect(resOn.valoresVariables['total_planos']).toBe(3);
    expect(resOn.insumosSnapshot.length).toBe(1);
    expect(resOn.insumosSnapshot[0].cantidadTotal).toBe(3);
    expect(resOn.costoInsumosTotal).toBe(15000); // 3 * 5000
    expect(resOn.manoObraSnapshot[0].horasTotales).toBe(6); // 3 * 2
    expect(resOn.costoManoObraTotal).toBe(90000); // 6 * 15000
  });

  it('debe incluir y evaluar correctamente la tarea tipo por defecto Protocolo SRT 900/15', () => {
    const srtTask = INITIAL_TAREAS_TIPO.find(t => t.id === 'tarea-fa255d31-2fa7-4c47-a67b-cba46f387140');
    expect(srtTask).toBeDefined();
    expect(srtTask?.nombre).toContain('Protocolo SRT 900/15');
    expect(srtTask?.naturaleza).toBe('servicio_profesional');

    const testManoObraMap = new Map<string, CategoriaManoDeObra>([
      ['mo-ayudante', { id: 'mo-ayudante', nombre: 'Ayudante', costoHora: 10000, fechaActualizacion: '' }],
      ['mo-tecnico-matriculado', { id: 'mo-tecnico-matriculado', nombre: 'Técnico Electricista Matriculado', costoHora: 20000, fechaActualizacion: '' }]
    ]);

    // Caso A: Con encomienda explícita = 30000
    const res = calcularConsumosTareaTipo(
      srtTask!,
      {
        bocas: 10,
        jabalinas: 1,
        int_diferenciales: 1,
        requiere_unifilar: 1,
        cnt_unifialres: 1,
        circuitos: 4,
        requiere_croquis: 0,
        encomienda: 30000
      },
      new Map(),
      testManoObraMap
    );

    expect(res.valoresVariables['valor_encomienda']).toBe(30000);
    expect(res.valoresVariables['stot_jabalina']).toBe(30000); // 1 jabalina = 1 * 30000
    expect(res.valoresVariables['stot_bocas']).toBe(90000); // (10/5 + 1) * 30000 = 3 * 30000 = 90000
    expect(res.valoresVariables['stot_unifilares']).toBe(60000); // (1 + 4/4) * 30000 * 1 = 2 * 30000 = 60000
    expect(res.valoresVariables['stot_relevamiento']).toBe(0); // requiere_croquis = 0
    expect(res.costoServiciosTotal).toBe(240000); // 30000 (jabalinas) + 90000 (bocas) + 60000 (diferenciales) + 60000 (unifilares) + 0
    expect(res.manoObraSnapshot[0].horasTotales).toBe(2.75); // (1 + 10) / 4 = 2.75

    // Caso B: Con encomienda = 0 (toma automáticamente 2 * tarifa_profesional = 2 * 20000 = 40000)
    const resAuto = calcularConsumosTareaTipo(
      srtTask!,
      {
        bocas: 10,
        jabalinas: 2,
        int_diferenciales: 1,
        requiere_unifilar: 0,
        requiere_croquis: 1,
        cnt_locales: 2,
        bocas_locales: 5,
        encomienda: 0
      },
      new Map(),
      testManoObraMap
    );

    expect(resAuto.valoresVariables['valor_encomienda']).toBe(40000); // 20000 * 2
    expect(resAuto.valoresVariables['stot_jabalina']).toBe(52000); // (1 + 1 * 0.3) * 40000 = 1.3 * 40000 = 52000
    expect(resAuto.valoresVariables['stot_bocas']).toBe(120000); // (10/5 + 1) * 40000 = 3 * 40000 = 120000
    expect(resAuto.valoresVariables['stot_unifilares']).toBe(0); // requiere_unifilar = 0
    expect(resAuto.valoresVariables['stot_relevamiento']).toBe(120000); // (1*2 + 5/5) * 40000 * 1 = 3 * 40000 = 120000
  });

  it('debe propagar la marca y productoId del insumosMap hacia insumosSnapshot al calcular consumos de TareaTipo', () => {
    const tarea: TareaTipo = {
      id: 'tarea-test-marca',
      nombre: 'Instalación Térmica',
      unidad: 'u',
      categoria: 'Tableros',
      insumos: [
        {
          materialId: 'mat-termica-20',
          cantidad: 1
        }
      ],
      manoObra: []
    };

    const mapInsumosConMarca = new Map<string, Insumo>([
      [
        'mat-termica-20',
        {
          id: 'mat-termica-20',
          categoriaId: 'cat-termicas',
          nombre: 'Termomagnética 1x20A C',
          unidadVenta: 'u',
          atributos: [],
          activo: true,
          precioActual: 8500,
          historialPrecios: [],
          marca: 'Schneider Electric',
          productoId: 'prod-schneider-act9'
        }
      ]
    ]);

    const res = calcularConsumosTareaTipo(tarea, {}, mapInsumosConMarca, new Map());
    expect(res.insumosSnapshot).toHaveLength(1);
    expect(res.insumosSnapshot[0].marca).toBe('Schneider Electric');
    expect(res.insumosSnapshot[0].productoId).toBe('prod-schneider-act9');
  });

  it('debe prorratear gastos directos focalizados estrictamente dentro de los ítems de su propio capítulo sin afectar a otros capítulos', () => {
    const capitulos: CapituloPresupuesto[] = [
      { id: 'cap-1', nombre: 'Capítulo 1: Tableros' },
      { id: 'cap-2', nombre: 'Capítulo 2: Iluminación' }
    ];

    const item1: ItemPresupuesto = {
      id: 'item-1',
      capituloId: 'cap-1',
      descripcion: 'Gabinete Tablero',
      cantidad: 1,
      unidad: 'u',
      costoInsumos: 100000,
      costoManoObra: 50000,
      costoDirectoTotal: 150000,
      precioVentaUnitario: 150000,
      precioVentaTotal: 150000,
      insumosSnapshot: [{ insumoId: 'ins-1', nombre: 'Gabinete', unidad: 'u', cantidadTotal: 1, precioUnitarioCongelado: 100000, alicuotaIVA: 0, subtotalInsumo: 100000, subtotalInsumoFinal: 100000 }],
      manoObraSnapshot: []
    };

    const item2: ItemPresupuesto = {
      id: 'item-2',
      capituloId: 'cap-2',
      descripcion: 'Bocas de Iluminación',
      cantidad: 1,
      unidad: 'u',
      costoInsumos: 100000,
      costoManoObra: 50000,
      costoDirectoTotal: 150000,
      precioVentaUnitario: 150000,
      precioVentaTotal: 150000,
      insumosSnapshot: [{ insumoId: 'ins-2', nombre: 'Cables e Iluminacion', unidad: 'u', cantidadTotal: 1, precioUnitarioCongelado: 100000, alicuotaIVA: 0, subtotalInsumo: 100000, subtotalInsumoFinal: 100000 }],
      manoObraSnapshot: []
    };

    // Gasto focalizado exclusivamente al Capítulo 2 (10% sobre materiales de Cap 2 = $10.000)
    const gastosConfig: GastoPresupuestoConfig[] = [
      {
        id: 'gasto-flete-cap2',
        nombre: 'Flete Exclusivo Iluminación',
        capituloId: 'cap-2',
        destino: 'materiales',
        modalidad: 'porcentual',
        valor: 10, // 10% sobre materiales del capítulo 2 = $10.000
        aplica: true
      }
    ];

    const res = calcularTotalesPresupuesto({
      items: [item1, item2],
      capitulos,
      gastosConfig,
      beneficioPorcentaje: 0,
      tipoFactura: 'Factura C',
      impuestosDetalle: []
    });

    // Total materiales = 100.000 + 100.000 + 10.000 (gasto cap 2) = 210.000
    expect(res.subtotalInsumos).toBe(210000);
    expect(res.subtotalManoObra).toBe(100000);
    expect(res.costoTotalObra).toBe(310000);

    // Item 1 (Capítulo 1): No debe tener gasto directo de materiales prorrateado (costo directo = 100.000 + 50.000 = 150.000)
    expect(res.itemsCalculados[0].costoDirectoTotal).toBe(150000);

    // Item 2 (Capítulo 2): Debe absorber los $10.000 del gasto de materiales de su capítulo (costo directo = 100.000 + 10.000 + 50.000 = 160.000)
    expect(res.itemsCalculados[1].costoDirectoTotal).toBe(160000);
  });

  it('debe actualizar los snapshots congelados de insumos con los precios vigentes del catálogo preservando cantidades', () => {
    const testInsumosMap = new Map<string, Insumo>([
      [
        'mat-cable-25',
        {
          id: 'mat-cable-25',
          nombre: 'Cable Unipolar 2.5 mm2 IRAM 247-3',
          categoriaId: 'cat-cables',
          unidadVenta: 'm',
          atributos: [],
          activo: true,
          precioActual: 1500, // Precio nuevo actualizado
          precioNeto: 1500,
          alicuotaIVA: 21,
          precioFinal: 1815
        }
      ]
    ]);

    const initialItem: ItemPresupuesto = {
      id: 'item-1',
      descripcion: 'Recableado Circuito Iluminación',
      cantidad: 2,
      unidad: 'circuito',
      costoInsumos: 100000,
      costoManoObra: 80000,
      costoDirectoTotal: 180000,
      precioVentaUnitario: 180000,
      precioVentaTotal: 360000,
      insumosSnapshot: [
        {
          materialId: 'mat-cable-25',
          nombre: 'Cable Unipolar 2.5 mm2 IRAM 247-3',
          unidad: 'm',
          cantidadTotal: 100,
          precioUnitarioCongelado: 1000, // Precio viejo congelado
          alicuotaIVA: 21,
          precioFinalUnitarioCongelado: 1210,
          subtotalInsumo: 100000,
          subtotalInsumoFinal: 121000
        }
      ],
      manoObraSnapshot: []
    };

    const res = actualizarSnapshotsInsumosConCatalogo([initialItem], testInsumosMap);

    expect(res.changesCount).toBe(1);
    expect(res.oldTotalCosto).toBe(100000);
    expect(res.newTotalCosto).toBe(150000); // 100m * 1500 = 150.000

    const updatedItem = res.updatedItems[0];
    expect(updatedItem.costoInsumos).toBe(150000);
    expect(updatedItem.costoDirectoTotal).toBe(230000); // 150.000 + 80.000 MO = 230.000
    expect(updatedItem.insumosSnapshot[0].precioUnitarioCongelado).toBe(150000 / 100);
    expect(updatedItem.insumosSnapshot[0].subtotalInsumo).toBe(150000);
    expect(updatedItem.insumosSnapshot[0].subtotalInsumoFinal).toBe(181500); // 150.000 * 1.21
  });
});

// ─── 22. Motor de Actualización Integral de Precios (Materiales, MO, Tareas Tipo, Indirectos, Dólar) ──

describe('22. Motor de Actualización Integral de Precios y Tarifas', () => {
  const testInsumosMap = new Map<string, Insumo>([
    ['mat-cable-25', {
      id: 'mat-cable-25',
      nombre: 'Cable Unipolar 2.5 mm2',
      unidad: 'm',
      precioActual: 1800, // Subió de 1000 a 1800
      precioFinal: 2178,
      alicuotaIVA: 21
    } as unknown as Insumo]
  ]);

  const testMOMap = new Map<string, CategoriaManoDeObra>([
    ['mo-oficial', {
      id: 'mo-oficial',
      nombre: 'Oficial Electricista',
      costoHora: 15000, // Subió de 10000 a 15000
      fechaActualizacion: '2026-08-28'
    }],
    ['mo-ayudante', {
      id: 'mo-ayudante',
      nombre: 'Ayudante',
      costoHora: 9000, // Subió de 6000 a 9000
      fechaActualizacion: '2026-08-28'
    }]
  ]);

  const testCostosIndirectos: CostoIndirecto[] = [
    {
      id: 'ci-movilidad',
      nombre: 'Movilidad y Combustible por Día',
      modalidad: 'monto_fijo',
      valor: 25000, // Subió de 18000 a 25000
      updatedAt: '2026-08-28'
    }
  ];

  const testItem: ItemPresupuesto = {
    id: 'item-1',
    descripcion: 'Instalación de bocas y circuitos',
    cantidad: 1,
    unidad: 'u',
    costoInsumos: 100000,
    costoManoObra: 100000,
    costoDirectoTotal: 200000,
    precioVentaUnitario: 260000,
    precioVentaTotal: 260000,
    insumosSnapshot: [
      {
        materialId: 'mat-cable-25',
        nombre: 'Cable Unipolar 2.5 mm2',
        unidad: 'm',
        cantidadTotal: 100,
        precioUnitarioCongelado: 1000,
        alicuotaIVA: 21,
        precioFinalUnitarioCongelado: 1210,
        subtotalInsumo: 100000,
        subtotalInsumoFinal: 121000
      }
    ],
    manoObraSnapshot: [
      {
        categoriaId: 'mo-oficial',
        nombreCategoria: 'Oficial Electricista',
        horasTotales: 10,
        costoHoraCongelado: 10000,
        subtotalManoObra: 100000
      }
    ]
  };

  const testGastos: GastoPresupuestoConfig[] = [
    {
      id: 'gasto-ci-movilidad',
      costoIndirectoId: 'ci-movilidad',
      nombre: 'Movilidad y Combustible por Día',
      valor: 18000,
      aplica: true
    }
  ];

  it('analiza exhaustivamente variaciones en todas las capas de costos', () => {
    const analisis = analizarCambiosPreciosPresupuesto({
      items: [testItem],
      gastosConfig: testGastos,
      cotizacionDolar: 1200,
      insumosMap: testInsumosMap,
      manoObraMap: testMOMap,
      costosIndirectosCatalog: testCostosIndirectos,
      configDolarReferenciaValor: 1350
    });

    expect(analisis.hayCambios).toBe(true);
    expect(analisis.materiales.count).toBe(1);
    expect(analisis.materiales.cambios[0].precioNuevo).toBe(1800);
    expect(analisis.materiales.totalImpacto).toBe(80000); // (1800 - 1000) * 100

    expect(analisis.manoObra.count).toBe(1);
    expect(analisis.manoObra.cambios[0].costoHoraNuevo).toBe(15000);
    expect(analisis.manoObra.totalImpacto).toBe(50000); // (15000 - 10000) * 10hs

    expect(analisis.costosIndirectos.count).toBe(1);
    expect(analisis.costosIndirectos.cambios[0].valorNuevo).toBe(25000);

    expect(analisis.dolar.cambio).not.toBeNull();
    expect(analisis.dolar.cambio?.valorNuevo).toBe(1350);
  });

  it('aplica actualización selectiva de capas según las opciones elegidas', () => {
    // Caso 1: Actualizar SOLO mano de obra (dejando insumos intactos)
    const resMOOnly = aplicarActualizacionPreciosPresupuesto({
      items: [testItem],
      gastosConfig: testGastos,
      cotizacionDolar: 1200,
      opciones: {
        actualizarMateriales: false,
        actualizarManoObra: true,
        actualizarTareasTipo: false,
        actualizarCostosIndirectos: false,
        actualizarDolar: false
      },
      insumosMap: testInsumosMap,
      manoObraMap: testMOMap,
      costosIndirectosCatalog: testCostosIndirectos,
      configDolarReferenciaValor: 1350
    });

    const itemMO = resMOOnly.updatedItems[0];
    expect(itemMO.costoInsumos).toBe(100000); // No cambió
    expect(itemMO.costoManoObra).toBe(150000); // 10hs * $15000
    expect(itemMO.costoDirectoTotal).toBe(250000);
    expect(resMOOnly.updatedGastosConfig[0].valor).toBe(18000); // No cambió
    expect(resMOOnly.updatedCotizacionDolar).toBe(1200); // No cambió

    // Caso 2: Actualizar TODAS las capas
    const resAll = aplicarActualizacionPreciosPresupuesto({
      items: [testItem],
      gastosConfig: testGastos,
      cotizacionDolar: 1200,
      opciones: {
        actualizarMateriales: true,
        actualizarManoObra: true,
        actualizarTareasTipo: false,
        actualizarCostosIndirectos: true,
        actualizarDolar: true
      },
      insumosMap: testInsumosMap,
      manoObraMap: testMOMap,
      costosIndirectosCatalog: testCostosIndirectos,
      configDolarReferenciaValor: 1350
    });

    const itemAll = resAll.updatedItems[0];
    expect(itemAll.costoInsumos).toBe(180000);
    expect(itemAll.costoManoObra).toBe(150000);
    expect(itemAll.costoDirectoTotal).toBe(330000);
    expect(resAll.updatedGastosConfig[0].valor).toBe(25000);
    expect(resAll.updatedCotizacionDolar).toBe(1350);
    expect(resAll.resumen.materialesCount).toBe(1);
    expect(resAll.resumen.manoObraCount).toBe(1);
    expect(resAll.resumen.indirectosCount).toBe(1);
    expect(resAll.resumen.dolarActualizado).toBe(true);
  });

  describe('estimarCuadrillaPorPlazo', () => {
    const testItems: ItemPresupuesto[] = [
      {
        id: 'it-1',
        tipoItem: 'tarea_tipo',
        descripcion: 'Bocas de Iluminación',
        unidad: 'u',
        cantidad: 10,
        insumosSnapshot: [],
        costoInsumos: 50000,
        costoManoObra: 100000,
        costoDirectoTotal: 150000,
        precioVentaUnitario: 15000,
        precioVentaTotal: 150000,
        manoObraSnapshot: [
          { categoriaId: 'oficial', nombreCategoria: 'Oficial', horasTotales: 20, costoHoraCongelado: 5000, subtotalManoObra: 100000 }
        ]
      },
      {
        id: 'it-2',
        tipoItem: 'tarea_tipo',
        descripcion: 'Tomacorrientes',
        unidad: 'u',
        cantidad: 5,
        insumosSnapshot: [],
        costoInsumos: 25000,
        costoManoObra: 40000,
        costoDirectoTotal: 65000,
        precioVentaUnitario: 13000,
        precioVentaTotal: 65000,
        manoObraSnapshot: [
          { categoriaId: 'oficial', nombreCategoria: 'Oficial', horasTotales: 7.5, costoHoraCongelado: 5000, subtotalManoObra: 40000 }
        ]
      }
    ];

    it('estima adecuadamente la cuadrilla cuando el plazo es holgado', () => {
      // Total horas brutas = 27.5 hs. Con 8h/día y 5 días de plazo (capacidad = 40 hs/op), 1 operario alcanza.
      const res = estimarCuadrillaPorPlazo({
        items: testItems,
        diasObjetivo: 5,
        horasEfectivasJornada: 8.0
      });

      expect(res.esFactible).toBe(true);
      expect(res.operariosSugeridos).toBe(1);
      expect(res.sinergiaSugerida.diasEnterosObra).toBeLessThanOrEqual(5);
    });

    it('sugiere cuadrilla mayor cuando el plazo es acotado', () => {
      // Con 1 día de plazo a 8h/día, 1 operario necesita ~26 hs de trabajo -> no llega en 1 día.
      // 2 operarios hacen ~12h reloj -> no llegan en 1 día a 8h/día.
      // Se requieren más operarios para entrar en 1 día.
      const res = estimarCuadrillaPorPlazo({
        items: testItems,
        diasObjetivo: 1,
        horasEfectivasJornada: 8.0
      });

      expect(res.operariosSugeridos).toBeGreaterThanOrEqual(3);
      expect(res.sinergiaSugerida.diasEnterosObra).toBeLessThanOrEqual(2);
    });

    it('ajusta la estimación según la ventana horaria (consorcio 4h vs normal 8h)', () => {
      // 3 días de obra:
      // A 8h/día -> capacidad 24 hs por operario -> 2 operarios alcanzan holgadamente
      const res8h = estimarCuadrillaPorPlazo({
        items: testItems,
        diasObjetivo: 3,
        horasEfectivasJornada: 8.0
      });

      // A 4h/día -> capacidad 12 hs por operario -> necesita más operarios para terminar en 3 días
      const res4h = estimarCuadrillaPorPlazo({
        items: testItems,
        diasObjetivo: 3,
        horasEfectivasJornada: 4.0
      });

      expect(res4h.operariosSugeridos).toBeGreaterThanOrEqual(res8h.operariosSugeridos);
    });

    it('maneja listas sin mano de obra sin lanzar excepciones', () => {
      const res = estimarCuadrillaPorPlazo({
        items: [],
        diasObjetivo: 3,
        horasEfectivasJornada: 8.0
      });

      expect(res.operariosSugeridos).toBe(1);
      expect(res.esFactible).toBe(true);
      expect(res.mensaje).toContain('No hay partidas');
    });
  });
});




