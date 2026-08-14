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
    // GG total = 10000 (GG%) + 15000 (GG fijo) = 25000
    expect(result.gastosGeneralesTotal).toBe(25000);
    expect(result.subtotalCostosIndirectos).toBe(25000);
    expect(result.costosIndirectosAplicados.find(c => c.costoIndirectoId === 'ci-pct')?.montoCalculado).toBe(10000);
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
    expect(dispersion.count).toBe(2);
    expect(dispersion.minRatio).toBe(1.0);
    expect(dispersion.maxRatio).toBe(1.5);
    expect(dispersion.avgRatio).toBe(1.25);
    expect(dispersion.desvioEstandar).toBeGreaterThan(0);
  });
});

