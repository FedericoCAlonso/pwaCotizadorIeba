/**
 * @fileoverview Motor de cálculo del Cotizador Eléctrico IEBA
 *
 * Todas las funciones numéricas de dinero usan `roundMoney()` para evitar errores
 * de punto flotante acumulativos (IEEE 754). Referencia: auditoría externa #7.
 *
 * Referencias al spec: spec-cotizador-electrico.md
 */

import {
  Insumo,
  CategoriaManoDeObra,
  CostoIndirecto,
  TareaTipo,
  ItemPresupuesto,
  InsumoSnapshot,
  ManoObraSnapshot,
  CostoIndirectoSnapshot,
  Presupuesto,
  EsquemaPago,
  ImpuestoItem,
  TipoFactura
} from './types';

// ─── Helper monetario (auditoría #7: CRITICAL) ───────────────────────────────
/**
 * Redondea un valor monetario a 2 decimales de forma consistente.
 * Evita errores de acumulación de punto flotante en presupuestos con múltiples ítems.
 * Se usa en TODOS los cálculos intermedios y finales.
 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ─── Validación de inputs (auditoría #10) ────────────────────────────────────
/**
 * Sanea un número: retorna 0 si es NaN, Infinity, null o undefined; y 0 si es negativo (por defecto).
 */
function safeNum(value: unknown, allowNegative = false): number {
  const n = Number(value);
  if (!isFinite(n) || isNaN(n)) return 0;
  if (!allowNegative && n < 0) return 0;
  return n;
}

// ─── Cálculo de costo de TareaTipo (spec §1.6, §1.4) ────────────────────────

/**
 * Calcula el costo unitario desglosado de una TareaTipo basándose en los precios vigentes.
 * Genera los snapshots de insumos y mano de obra sin multiplicar por cantidad
 * (esa multiplicación la hace `congelarItemPresupuesto`).
 *
 * Spec: §1.6 (TareaTipo), §1.4 (Insumo con historialPrecios).
 */
export function calcularCostoTareaTipo(
  tarea: TareaTipo,
  insumosMap: Map<string, Insumo>,
  manoObraMap: Map<string, CategoriaManoDeObra>
): {
  costoInsumosUnitario: number;
  costoManoObraUnitario: number;
  costoDirectoUnitario: number;
  insumosSnapshotUnitario: InsumoSnapshot[];
  manoObraSnapshotUnitario: ManoObraSnapshot[];
} {
  let costoInsumosUnitario = 0;
  const insumosSnapshotUnitario: InsumoSnapshot[] = [];

  for (const item of tarea.insumos) {
    const insumo = insumosMap.get(item.insumoId);
    const precioUnitario = roundMoney(safeNum(insumo?.precioActual));
    const cantidad = safeNum(item.cantidad);
    const subtotal = roundMoney(precioUnitario * cantidad);
    costoInsumosUnitario = roundMoney(costoInsumosUnitario + subtotal);

    insumosSnapshotUnitario.push({
      insumoId: item.insumoId,
      nombre: insumo ? insumo.nombre : 'Insumo no encontrado',
      unidad: insumo ? insumo.unidad : 'u',
      cantidadTotal: cantidad,
      precioUnitarioCongelado: precioUnitario,
      subtotalInsumo: subtotal
    });
  }

  let costoManoObraUnitario = 0;
  const manoObraSnapshotUnitario: ManoObraSnapshot[] = [];

  for (const item of tarea.manoObra) {
    const cat = manoObraMap.get(item.categoriaId);
    const costoHora = roundMoney(safeNum(cat?.costoHora));
    const horas = safeNum(item.horas);
    const subtotal = roundMoney(costoHora * horas);
    costoManoObraUnitario = roundMoney(costoManoObraUnitario + subtotal);

    manoObraSnapshotUnitario.push({
      categoriaId: item.categoriaId,
      nombreCategoria: cat ? cat.nombre : 'Categoría no encontrada',
      horasTotales: horas,
      costoHoraCongelado: costoHora,
      subtotalManoObra: subtotal
    });
  }

  return {
    costoInsumosUnitario,
    costoManoObraUnitario,
    costoDirectoUnitario: roundMoney(costoInsumosUnitario + costoManoObraUnitario),
    insumosSnapshotUnitario,
    manoObraSnapshotUnitario
  };
}

// ─── Congelamiento de snapshot al emitir (spec §1.5 — "regla de oro") ────────

/**
 * Congela los precios de un item de presupuesto al ser emitido.
 * Una vez congelado, cambios posteriores en el catálogo de insumos NO afectan
 * este item. Esta es la "regla de oro" del spec (§1.5).
 *
 * Spec: §1.5 (Inmutabilidad de precios en presupuesto emitido).
 */
export function congelarItemPresupuesto(
  item: ItemPresupuesto,
  cantidad: number
): ItemPresupuesto {
  const cantidadSana = safeNum(cantidad) || 1;

  const insumosCongelados = item.insumosSnapshot.map(i => ({
    ...i,
    cantidadTotal: roundMoney(i.cantidadTotal * cantidadSana),
    subtotalInsumo: roundMoney(i.precioUnitarioCongelado * (i.cantidadTotal * cantidadSana))
  }));

  const manoObraCongelada = item.manoObraSnapshot.map(m => ({
    ...m,
    horasTotales: roundMoney(m.horasTotales * cantidadSana),
    subtotalManoObra: roundMoney(m.costoHoraCongelado * (m.horasTotales * cantidadSana))
  }));

  const costoInsumos = roundMoney(insumosCongelados.reduce((acc, i) => acc + i.subtotalInsumo, 0));
  const costoManoObra = roundMoney(manoObraCongelada.reduce((acc, m) => acc + m.subtotalManoObra, 0));

  const hasSnapshots = item.insumosSnapshot.length > 0 || item.manoObraSnapshot.length > 0;
  const costoDirectoTotal = hasSnapshots
    ? roundMoney(costoInsumos + costoManoObra)
    : roundMoney(safeNum(item.costoDirectoTotal) * cantidadSana);

  const precioVentaTotal = roundMoney(safeNum(item.precioVentaUnitario) * cantidadSana);

  return {
    ...item,
    cantidad: cantidadSana,
    insumosSnapshot: insumosCongelados,
    manoObraSnapshot: manoObraCongelada,
    costoInsumos,
    costoManoObra,
    costoDirectoTotal,
    precioVentaTotal
  };
}

// ─── Configuración de impuestos por tipo de factura (spec §5) ─────────────────

/**
 * Genera la configuración de impuestos por defecto según el Tipo de Factura seleccionado.
 *
 * Reglas (spec §5):
 * - Factura A: IVA discriminado + IIBB discriminado
 * - Factura B: IVA incluido + IIBB incluido
 * - Factura C / Sin Factura: solo IIBB (monotributista)
 *
 * Spec: §5 (Impuestos y tipos de factura).
 */
export function generarImpuestosPorDefecto(
  tipoFactura: TipoFactura,
  porcentajeIVA = 21,
  porcentajeIIBB = 3.5
): ImpuestoItem[] {
  const isFacturaA = tipoFactura === 'Factura A';
  const isFacturaB = tipoFactura === 'Factura B';
  const isFacturaC = tipoFactura === 'Factura C';

  return [
    {
      id: 'tax-iva',
      nombre: 'IVA (21%)',
      porcentaje: porcentajeIVA,
      aplica: isFacturaA || isFacturaB,
      discriminar: isFacturaA,
      montoCalculado: 0
    },
    {
      id: 'tax-iibb',
      nombre: 'Ingresos Brutos (IIBB)',
      porcentaje: porcentajeIIBB,
      aplica: isFacturaA || isFacturaB || isFacturaC,
      discriminar: isFacturaA,
      montoCalculado: 0
    }
  ];
}

// ─── Cálculo de totales del presupuesto (spec §3, §1.3, §1.5) ────────────────

/**
 * Calcula los totales completos de un presupuesto:
 * subtotales, costos indirectos (snapshot), margen, impuestos e IVA/IIBB.
 *
 * Soporta los 3 tipos de `CostoIndirecto` (spec §1.3):
 * - `porcentual_sobre_costo`: % sobre el total de costos directos
 * - `fijo_mensual`: monto fijo independiente del proyecto
 * - `por_visita`: monto fijo por visita/trabajo
 *
 * Los costos indirectos se snapshottean en `costosIndirectosAplicados`
 * para cumplir la regla de oro de inmutabilidad (spec §1.5, auditoría #8).
 *
 * Spec: §3 (Presupuesto), §1.3 (CostoIndirecto), §1.5 (Inmutabilidad).
 */
export function calcularTotalesPresupuesto(params: {
  items: ItemPresupuesto[];
  costosIndirectosCatalog: CostoIndirecto[];
  margenPorcentaje: number;
  impuestosDetalle: ImpuestoItem[];
  cotizacionMonedaExtranjera?: number;
}): {
  subtotalInsumos: number;
  subtotalManoObra: number;
  subtotalCostosDirectos: number;
  subtotalCostosIndirectos: number;
  costosIndirectosAplicados: CostoIndirectoSnapshot[];
  costoTotalObra: number;
  montoGanancia: number;
  precioVentaSinImpuestos: number;
  impuestosCalculados: ImpuestoItem[];
  impuestosPorcentajeTotal: number;
  montoImpuestosTotal: number;
  totalARS: number;
  totalMonedaExtranjera?: number;
} {
  const {
    items,
    costosIndirectosCatalog,
    margenPorcentaje,
    impuestosDetalle,
    cotizacionMonedaExtranjera
  } = params;

  // Acumuladores con roundMoney en cada suma (auditoría #7: CRITICAL)
  let subtotalInsumos = 0;
  let subtotalManoObra = 0;
  let subtotalCostosDirectos = 0;
  let subtotalPrecioVentaItems = 0;

  for (const item of items) {
    subtotalInsumos = roundMoney(subtotalInsumos + safeNum(item.costoInsumos));
    subtotalManoObra = roundMoney(subtotalManoObra + safeNum(item.costoManoObra));

    const hasSnapshots = (item.insumosSnapshot && item.insumosSnapshot.length > 0) ||
                         (item.manoObraSnapshot && item.manoObraSnapshot.length > 0);

    const itemCostoDirecto = hasSnapshots
      ? roundMoney(safeNum(item.costoInsumos) + safeNum(item.costoManoObra))
      : safeNum(item.costoDirectoTotal);

    subtotalCostosDirectos = roundMoney(subtotalCostosDirectos + itemCostoDirecto);
    subtotalPrecioVentaItems = roundMoney(subtotalPrecioVentaItems + safeNum(item.precioVentaTotal));
  }

  // ─── Costos indirectos — snapshot congelado (spec §1.3, §1.5, auditorías #8 y #9) ───
  // Se soportan los 3 tipos definidos en TipoCostoIndirecto:
  //   · porcentual_sobre_costo → % sobre subtotalCostosDirectos
  //   · fijo_mensual           → valor fijo (costo mensual prorrateable)
  //   · por_visita             → valor fijo por trabajo/visita
  const costosIndirectosAplicados: CostoIndirectoSnapshot[] = [];
  let subtotalCostosIndirectos = 0;

  for (const c of costosIndirectosCatalog) {
    let montoCalculado = 0;
    if (c.tipo === 'porcentual_sobre_costo') {
      montoCalculado = roundMoney(subtotalCostosDirectos * (safeNum(c.valor) / 100));
    } else if (c.tipo === 'fijo_mensual' || c.tipo === 'por_visita') {
      montoCalculado = roundMoney(safeNum(c.valor));
    }

    subtotalCostosIndirectos = roundMoney(subtotalCostosIndirectos + montoCalculado);
    // El snapshot congela el monto calculado en el momento de emitir (auditoría #8)
    costosIndirectosAplicados.push({
      costoIndirectoId: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      valorAplicado: safeNum(c.valor),
      montoCalculado
    });
  }

  const costoTotalObra = roundMoney(subtotalCostosDirectos + subtotalCostosIndirectos);

  const precioVentaSinImpuestos = subtotalPrecioVentaItems;
  const montoGanancia = roundMoney(precioVentaSinImpuestos - costoTotalObra);

  // ─── Desglose de impuestos (spec §5) ─────────────────────────────────────────
  let montoImpuestosTotal = 0;
  let impuestosPorcentajeTotal = 0;

  const impuestosCalculados = (impuestosDetalle || []).map(tax => {
    let montoCalculado = 0;
    if (tax.aplica) {
      montoCalculado = roundMoney(precioVentaSinImpuestos * (safeNum(tax.porcentaje) / 100));
      montoImpuestosTotal = roundMoney(montoImpuestosTotal + montoCalculado);
      impuestosPorcentajeTotal = roundMoney(impuestosPorcentajeTotal + safeNum(tax.porcentaje));
    }
    return {
      ...tax,
      montoCalculado
    };
  });

  const totalARS = roundMoney(precioVentaSinImpuestos + montoImpuestosTotal);

  let totalMonedaExtranjera: number | undefined = undefined;
  const cotizacion = safeNum(cotizacionMonedaExtranjera, true);
  if (cotizacion > 0) {
    totalMonedaExtranjera = roundMoney(totalARS / cotizacion);
  }

  return {
    subtotalInsumos,
    subtotalManoObra,
    subtotalCostosDirectos,
    subtotalCostosIndirectos,
    costosIndirectosAplicados,
    costoTotalObra,
    montoGanancia,
    precioVentaSinImpuestos,
    impuestosCalculados,
    impuestosPorcentajeTotal,
    montoImpuestosTotal,
    totalARS,
    totalMonedaExtranjera
  };
}

// ─── Formateadores de moneda (spec §3, auditoría #27) ────────────────────────

/**
 * Formatea un monto como moneda argentina (ARS) con símbolo y separadores locales.
 * Usar siempre esta función para mostrar precios en la UI (auditoría #27).
 */
export function formatARS(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
  }).format(safeNum(amount, true));
}

/**
 * Formatea un monto en moneda extranjera (USD u otra) con símbolo configurable.
 */
export function formatUSD(amount: number, symbol = 'USD'): string {
  return `${symbol} $${safeNum(amount, true).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Formatea un número con separadores locales argentinos.
 */
export function formatNumber(val: number, decimals = 2): string {
  return safeNum(val, true).toLocaleString('es-AR', {
    maximumFractionDigits: decimals
  });
}
