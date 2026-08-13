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
  calcularDispersionHorasTareaLegacy,
  calcularDispersionHorasTarea
} from './calculations';
import { Insumo, CategoriaManoDeObra, CostoIndirecto, TareaTipo, ItemPresupuesto } from './types';

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

describe('calcularTotalesPresupuesto', () => {
  it('calcula subtotales, margen, costos indirectos e impuestos correctamente (happy path)', () => {
    const item = makeItem();
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
      margenPorcentaje: 40,
      impuestosDetalle: [],
      cotizacionMonedaExtranjera: 1350
    });

    expect(result.subtotalCostosDirectos).toBe(208500);
    expect(result.subtotalCostosIndirectos).toBe(20850);
    expect(result.costoTotalObra).toBe(229350);
    expect(result.precioVentaSinImpuestos).toBe(300000);
    expect(result.montoGanancia).toBe(70650);
    expect(result.totalARS).toBe(300000);
    expect(result.totalMonedaExtranjera).toBeCloseTo(222.22, 2);
  });

  it('maneja lista de ítems vacía (edge case: presupuesto vacío)', () => {
    const result = calcularTotalesPresupuesto({
      items: [],
      costosIndirectosCatalog: [],
      margenPorcentaje: 30,
      impuestosDetalle: []
    });

    expect(result.subtotalInsumos).toBe(0);
    expect(result.subtotalManoObra).toBe(0);
    expect(result.subtotalCostosDirectos).toBe(0);
    expect(result.costoTotalObra).toBe(0);
    expect(result.totalARS).toBe(0);
    expect(result.totalMonedaExtranjera).toBeUndefined();
  });

  it('costo indirecto tipo fijo_mensual — spec §1.3', () => {
    const item = makeItem({ costoInsumos: 50000, costoManoObra: 50000, costoDirectoTotal: 100000 });
    const indirectos: CostoIndirecto[] = [
      { id: 'ci-fijo', nombre: 'Seguro ART', tipo: 'fijo_mensual', valor: 15000 }
    ];

    const result = calcularTotalesPresupuesto({
      items: [item],
      costosIndirectosCatalog: indirectos,
      margenPorcentaje: 0,
      impuestosDetalle: []
    });

    expect(result.subtotalCostosIndirectos).toBe(15000);
    expect(result.costosIndirectosAplicados[0].montoCalculado).toBe(15000);
  });

  it('costo indirecto tipo por_visita — spec §1.3', () => {
    const item = makeItem({ costoInsumos: 50000, costoManoObra: 50000, costoDirectoTotal: 100000 });
    const indirectos: CostoIndirecto[] = [
      { id: 'ci-visita', nombre: 'Combustible Visita', tipo: 'por_visita', valor: 5000 }
    ];

    const result = calcularTotalesPresupuesto({
      items: [item],
      costosIndirectosCatalog: indirectos,
      margenPorcentaje: 0,
      impuestosDetalle: []
    });

    expect(result.subtotalCostosIndirectos).toBe(5000);
    expect(result.costosIndirectosAplicados[0].montoCalculado).toBe(5000);
  });

  it('costos indirectos se snapshottean (regla de oro §1.5 — auditoría #8)', () => {
    // El snapshot guarda el monto calculado al momento de emitir.
    // Modificar el catálogo DESPUÉS no debe afectar el snapshot ya calculado.
    const item = makeItem();
    const catalogOriginal: CostoIndirecto[] = [
      { id: 'ci-1', nombre: 'Amortización', tipo: 'porcentual_sobre_costo', valor: 5 }
    ];

    const result = calcularTotalesPresupuesto({
      items: [item],
      costosIndirectosCatalog: catalogOriginal,
      margenPorcentaje: 0,
      impuestosDetalle: []
    });

    // Guardamos el snapshot
    const snapshotGuardado = result.costosIndirectosAplicados[0].montoCalculado;

    // Simulamos que alguien modifica el catálogo
    catalogOriginal[0].valor = 50; // cambio drástico

    // El snapshot guardado NO debe cambiar
    expect(snapshotGuardado).toBe(roundMoney(208500 * 0.05)); // 10425
  });

  it('discrimina correctamente IVA e IIBB para Factura A', () => {
    const item = makeItem({
      insumosSnapshot: [],
      manoObraSnapshot: [],
      costoInsumos: 0,
      costoManoObra: 0,
      costoDirectoTotal: 100000,
      precioVentaUnitario: 200000,
      precioVentaTotal: 200000,
      cantidad: 1
    });

    const impuestosFacturaA = generarImpuestosPorDefecto('Factura A', 21, 3.5);

    const result = calcularTotalesPresupuesto({
      items: [item],
      costosIndirectosCatalog: [],
      margenPorcentaje: 50,
      impuestosDetalle: impuestosFacturaA
    });

    expect(result.precioVentaSinImpuestos).toBe(200000);
    // IVA 21% de 200000 = 42000
    // IIBB 3.5% de 200000 = 7000
    expect(result.montoImpuestosTotal).toBe(49000);
    expect(result.totalARS).toBe(249000);
    expect(result.impuestosCalculados.find(t => t.nombre.includes('IVA'))?.montoCalculado).toBe(42000);
    expect(result.impuestosCalculados.find(t => t.nombre.includes('IIBB'))?.montoCalculado).toBe(7000);
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

