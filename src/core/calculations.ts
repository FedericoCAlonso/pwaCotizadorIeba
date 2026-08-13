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
  CostoIndirectoItemConfig,
  TareaTipo,
  ItemPresupuesto,
  InsumoSnapshot,
  ManoObraSnapshot,
  CostoIndirectoSnapshot,
  Presupuesto,
  EsquemaPago,
  ImpuestoItem,
  TipoFactura,
  RegistroTrabajo,
  AppConfig
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
    const targetId = item.materialId || item.insumoId || '';
    const insumo = insumosMap.get(targetId);
    const precioUnitario = roundMoney(safeNum(insumo?.precioActual));
    const cantidad = safeNum(item.cantidad);
    const subtotal = roundMoney(precioUnitario * cantidad);
    costoInsumosUnitario = roundMoney(costoInsumosUnitario + subtotal);

    insumosSnapshotUnitario.push({
      materialId: targetId,
      insumoId: targetId,
      nombre: insumo ? (insumo.nombre || 'Insumo no encontrado') : 'Insumo no encontrado',
      unidad: insumo ? (insumo.unidadVenta || insumo.unidad || 'u') : 'u',
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

// ─── Funciones de especificación v2 (Ajustes de Calibración, Insumos y Servicios) ───

/**
 * Recalcula el factor de corrección EMA (Media Móvil Exponencial) para una TareaTipo
 * cuando se registra un nuevo trabajo real.
 * Spec v2 §1.1: factorNuevo = factorAnterior * (1 - α) + (horasReales / horasEstimadas) * α
 */
export function calcularNuevoFactorEMA(
  factorAnterior = 1.0,
  horasReales: number,
  horasEstimadas: number,
  alpha = 0.3
): number {
  const fAnt = safeNum(factorAnterior) || 1.0;
  const hReales = safeNum(horasReales);
  const hEst = safeNum(horasEstimadas);
  if (hEst <= 0) return fAnt;

  const ratio = hReales / hEst;
  const a = Math.min(1.0, Math.max(0.01, safeNum(alpha) || 0.3));
  const factorNuevo = fAnt * (1 - a) + ratio * a;

  // Limitar a un rango sano [0.1, 10.0] redondeado a 4 decimales
  return Math.round(Math.min(10.0, Math.max(0.1, factorNuevo)) * 10000) / 10000;
}

/**
 * Obtiene el multiplicador por Condición de Obra (Spec v2 §1.2).
 * Normal: 1.0 | Dificultosa: 1.25 | Favorable: 0.9
 */
export function obtenerMultiplicadorCondicion(
  condicion?: 'normal' | 'dificultosa' | 'favorable',
  customConfig?: {
    multiplicadorCondicionNormal?: number;
    multiplicadorCondicionDificultosa?: number;
    multiplicadorCondicionFavorable?: number;
  }
): number {
  if (condicion === 'dificultosa') return customConfig?.multiplicadorCondicionDificultosa ?? 1.25;
  if (condicion === 'favorable') return customConfig?.multiplicadorCondicionFavorable ?? 0.9;
  return customConfig?.multiplicadorCondicionNormal ?? 1.0;
}

/**
 * Determina el estado de vencimiento del precio de un insumo (Spec v2 §2.1).
 * Verde: <= 30 días | Amarillo: 31-60 días | Rojo: > 60 días
 */
export function obtenerEstadoVencimientoInsumo(
  fechaActualizacion: string,
  diasVerde = 30,
  diasAmarillo = 60
): 'verde' | 'amarillo' | 'rojo' {
  if (!fechaActualizacion) return 'rojo';
  const fecha = new Date(fechaActualizacion).getTime();
  if (isNaN(fecha)) return 'rojo';

  const diffMs = Date.now() - fecha;
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias <= diasVerde) return 'verde';
  if (diffDias <= diasAmarillo) return 'amarillo';
  return 'rojo';
}

/**
 * Alias de compatibilidad para determinar estado de vencimiento de una Oferta.
 */
export function obtenerEstadoVencimientoOferta(
  fechaActualizacion: string,
  diasVerde = 30,
  diasAmarillo = 60
): 'verde' | 'amarillo' | 'rojo' {
  return obtenerEstadoVencimientoInsumo(fechaActualizacion, diasVerde, diasAmarillo);
}

/**
 * Alias de dispersión simple para interfaz retrocompatible.
 */
export function calcularDispersionHorasTareaLegacy(
  registros: { tareaTipoId?: string; horasReales: number; cantidadEjecutada: number }[],
  tareaTipoId: string,
  horasEstimadasBase: number
): {
  count: number;
  minRatio: number;
  maxRatio: number;
  avgRatio: number;
  desvioEstandar: number;
} {
  const filtrados = registros.filter(
    r => r.tareaTipoId === tareaTipoId && r.cantidadEjecutada > 0 && r.horasReales > 0
  );

  if (filtrados.length === 0 || horasEstimadasBase <= 0) {
    return { count: 0, minRatio: 1, maxRatio: 1, avgRatio: 1, desvioEstandar: 0 };
  }

  const ratios = filtrados.map(r => r.horasReales / (r.cantidadEjecutada * horasEstimadasBase));
  const count = ratios.length;
  const minRatio = Math.min(...ratios);
  const maxRatio = Math.max(...ratios);
  const sum = ratios.reduce((acc, v) => acc + v, 0);
  const avgRatio = sum / count;

  const variance = ratios.reduce((acc, v) => acc + Math.pow(v - avgRatio, 2), 0) / count;
  const desvioEstandar = Math.sqrt(variance);

  return {
    count,
    minRatio: roundMoney(minRatio),
    maxRatio: roundMoney(maxRatio),
    avgRatio: roundMoney(avgRatio),
    desvioEstandar: roundMoney(desvioEstandar)
  };
}

// ─── Configuración de impuestos por tipo de factura (spec §5) ─────────────────

/**
 * Genera la configuración de impuestos por defecto según el Tipo de Factura seleccionado.
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

// ─── Cálculo de totales del presupuesto (spec §3, §1.3, §1.5 & v2 §3.3) ───────

/**
 * Calcula los totales completos de un presupuesto:
 * subtotales (insumos, mano de obra, servicios tercerizados), costos indirectos (snapshot),
 * margen, impuestos e IVA/IIBB.
 *
 * Spec v2 §3.3: Costo Directo = Σ(Insumos) + Σ(Mano Obra) + Σ(Servicios Tercerizados)
 */
export function calcularTotalesPresupuesto(params: {
  items: ItemPresupuesto[];
  costosIndirectosCatalog?: CostoIndirecto[];
  costosIndirectosConfig?: CostoIndirectoItemConfig[];
  margenPorcentaje: number;
  impuestosDetalle: ImpuestoItem[];
  cotizacionMonedaExtranjera?: number;
}): {
  subtotalInsumos: number;
  subtotalManoObra: number;
  subtotalServiciosTercerizados: number;
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
    costosIndirectosCatalog = [],
    costosIndirectosConfig,
    margenPorcentaje,
    impuestosDetalle,
    cotizacionMonedaExtranjera
  } = params;

  let subtotalInsumos = 0;
  let subtotalManoObra = 0;
  let subtotalServiciosTercerizados = 0;
  let subtotalCostosDirectos = 0;
  let subtotalPrecioVentaItems = 0;

  for (const item of items) {
    const cInsumos = safeNum(item.costoInsumos);
    const cManoObra = safeNum(item.costoManoObra);
    
    // Suma de servicios tercerizados si existen (spec v2 §3)
    let cServicios = 0;
    if (item.serviciosTercerizados && item.serviciosTercerizados.length > 0) {
      cServicios = roundMoney(
        item.serviciosTercerizados.reduce((acc, s) => acc + safeNum(s.costo), 0)
      );
    } else {
      cServicios = safeNum(item.costoServiciosTercerizados);
    }

    subtotalInsumos = roundMoney(subtotalInsumos + cInsumos);
    subtotalManoObra = roundMoney(subtotalManoObra + cManoObra);
    subtotalServiciosTercerizados = roundMoney(subtotalServiciosTercerizados + cServicios);

    const hasSnapshots = (item.insumosSnapshot && item.insumosSnapshot.length > 0) ||
                         (item.manoObraSnapshot && item.manoObraSnapshot.length > 0) ||
                         (item.serviciosTercerizados && item.serviciosTercerizados.length > 0);

    const itemCostoDirecto = hasSnapshots
      ? roundMoney(cInsumos + cManoObra + cServicios)
      : safeNum(item.costoDirectoTotal);

    subtotalCostosDirectos = roundMoney(subtotalCostosDirectos + itemCostoDirecto);
    subtotalPrecioVentaItems = roundMoney(subtotalPrecioVentaItems + safeNum(item.precioVentaTotal));
  }

  // ─── Costos indirectos — snapshot congelado (spec §1.3, §1.5) ───
  const costosIndirectosAplicados: CostoIndirectoSnapshot[] = [];
  let subtotalCostosIndirectos = 0;

  if (costosIndirectosConfig && costosIndirectosConfig.length > 0) {
    for (const c of costosIndirectosConfig) {
      if (c.aplica) {
        let montoCalculado = 0;
        if (c.tipo === 'porcentual_sobre_costo') {
          montoCalculado = roundMoney(subtotalCostosDirectos * (safeNum(c.valor) / 100));
        } else if (c.tipo === 'fijo_mensual' || c.tipo === 'por_visita') {
          montoCalculado = roundMoney(safeNum(c.valor));
        }

        subtotalCostosIndirectos = roundMoney(subtotalCostosIndirectos + montoCalculado);
        costosIndirectosAplicados.push({
          costoIndirectoId: c.id,
          nombre: c.nombre,
          tipo: c.tipo,
          valorAplicado: safeNum(c.valor),
          montoCalculado
        });
      }
    }
  } else {
    for (const c of costosIndirectosCatalog) {
      let montoCalculado = 0;
      if (c.tipo === 'porcentual_sobre_costo') {
        montoCalculado = roundMoney(subtotalCostosDirectos * (safeNum(c.valor) / 100));
      } else if (c.tipo === 'fijo_mensual' || c.tipo === 'por_visita') {
        montoCalculado = roundMoney(safeNum(c.valor));
      }

      subtotalCostosIndirectos = roundMoney(subtotalCostosIndirectos + montoCalculado);
      costosIndirectosAplicados.push({
        costoIndirectoId: c.id,
        nombre: c.nombre,
        tipo: c.tipo,
        valorAplicado: safeNum(c.valor),
        montoCalculado
      });
    }
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
    subtotalServiciosTercerizados,
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

// ─── Fase 4: Estadísticas de Dispersión, EMA & Auditoría de Rentabilidad ──────

export interface DispersionEstadisticaTarea {
  tareaId: string;
  nombreTarea: string;
  nMuestras: number;
  horasEstimadasBase: number;
  factorEMAActual: number;
  horasConFactorEMA: number;
  minHorasUnidad: number;
  maxHorasUnidad: number;
  promedioHorasUnidad: number;
  varianza: number;
  desviacionEstandar: number;
  emaHorasSugerido: number;
  factorEmaSugerido: number;
  desviacionPct: number;
}

/**
 * Calcula las métricas estadísticas completas (min, max, promedio, varianza, EMA)
 * de una TareaTipo basándose en los registros de trabajo de campo reales.
 */
export function calcularDispersionHorasTarea(
  tarea: TareaTipo,
  registros: RegistroTrabajo[],
  alpha = 0.3
): DispersionEstadisticaTarea {
  const logs = registros.filter((r) => r.tareaTipoId === tarea.id);
  const nMuestras = logs.length;
  const horasEstimadasBase = safeNum(tarea.manoObra.reduce((acc, m) => acc + m.horas, 0));
  const factorEMAActual = safeNum(tarea.factorCorreccion) || 1.0;
  const horasConFactorEMA = roundMoney(horasEstimadasBase * factorEMAActual);

  if (nMuestras === 0) {
    return {
      tareaId: tarea.id,
      nombreTarea: tarea.nombre,
      nMuestras: 0,
      horasEstimadasBase,
      factorEMAActual,
      horasConFactorEMA,
      minHorasUnidad: 0,
      maxHorasUnidad: 0,
      promedioHorasUnidad: 0,
      varianza: 0,
      desviacionEstandar: 0,
      emaHorasSugerido: horasEstimadasBase,
      factorEmaSugerido: factorEMAActual,
      desviacionPct: 0
    };
  }

  const horasUnitarias = logs.map((r) => {
    const cant = safeNum(r.cantidadEjecutada) || 1;
    return safeNum(r.horasReales) / cant;
  });

  const minHorasUnidad = Math.min(...horasUnitarias);
  const maxHorasUnidad = Math.max(...horasUnitarias);
  const suma = horasUnitarias.reduce((acc, h) => acc + h, 0);
  const promedioHorasUnidad = suma / nMuestras;

  const varianza = horasUnitarias.reduce((acc, h) => acc + Math.pow(h - promedioHorasUnidad, 2), 0) / nMuestras;
  const desviacionEstandar = Math.sqrt(varianza);

  // Cálculo secuencial de Media Móvil Exponencial (EMA)
  let emaCurrent = horasEstimadasBase > 0 ? horasEstimadasBase : promedioHorasUnidad;
  const a = Math.min(1.0, Math.max(0.01, safeNum(alpha) || 0.3));
  for (const hReal of horasUnitarias) {
    emaCurrent = emaCurrent * (1 - a) + hReal * a;
  }

  const emaHorasSugerido = Math.round(emaCurrent * 100) / 100;
  const factorEmaSugerido = horasEstimadasBase > 0
    ? Math.round((emaHorasSugerido / horasEstimadasBase) * 10000) / 10000
    : 1.0;

  const desviacionPct = horasEstimadasBase > 0
    ? roundMoney(((promedioHorasUnidad - horasEstimadasBase) / horasEstimadasBase) * 100)
    : 0;

  return {
    tareaId: tarea.id,
    nombreTarea: tarea.nombre,
    nMuestras,
    horasEstimadasBase,
    factorEMAActual,
    horasConFactorEMA,
    minHorasUnidad: roundMoney(minHorasUnidad),
    maxHorasUnidad: roundMoney(maxHorasUnidad),
    promedioHorasUnidad: roundMoney(promedioHorasUnidad),
    varianza: roundMoney(varianza),
    desviacionEstandar: roundMoney(desviacionEstandar),
    emaHorasSugerido,
    factorEmaSugerido,
    desviacionPct
  };
}

export interface ResultadoAuditoriaTarea {
  tarea: TareaTipo;
  costoDirecto: number;
  costoInsumos: number;
  costoManoObra: number;
  precioVentaSugerido: number;
  margenPorcentajeProyectado: number;
  estado: 'verde' | 'amarillo' | 'rojo';
  alertas: string[];
  insumosInactivos: string[];
  insumosIncompletos: string[];
}

/**
 * Escanea y audita la salud técnica y rentabilidad de una TareaTipo.
 * Detecta insumos discontinuados (`activo: false`), margen por debajo del umbral de seguridad,
 * o desvíos significativos en horas reales de obra.
 */
export function auditarRentabilidadTareaTipo(
  tarea: TareaTipo,
  insumosMap: Map<string, Insumo>,
  manoObraMap: Map<string, CategoriaManoDeObra>,
  config?: AppConfig
): ResultadoAuditoriaTarea {
  const costoData = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap);
  const costoDirecto = costoData.costoDirectoUnitario;
  const costoInsumos = costoData.costoInsumosUnitario;
  const costoManoObra = costoData.costoManoObraUnitario;

  const margenPctDefecto = safeNum(config?.margenPorDefectoPct) || 35;
  const umbralAdvertencia = safeNum(config?.umbralMargenMinimoAdvertencia) || 20;

  // Precio de venta proyectado aplicando margen estándar
  const factorMargen = 1 - (margenPctDefecto / 100);
  const precioVentaSugerido = factorMargen > 0 ? roundMoney(costoDirecto / factorMargen) : roundMoney(costoDirecto * 1.35);
  const margenPorcentajeProyectado = precioVentaSugerido > 0
    ? roundMoney(((precioVentaSugerido - costoDirecto) / precioVentaSugerido) * 100)
    : 0;

  const alertas: string[] = [];
  const insumosInactivos: string[] = [];
  const insumosIncompletos: string[] = [];

  // Check 1: Insumos descontinuados o incompletos
  for (const item of tarea.insumos) {
    const targetId = item.materialId || item.insumoId || '';
    const mat = insumosMap.get(targetId);
    if (!mat) {
      alertas.push(`Material no encontrado en catálogo (ID: ${targetId})`);
      insumosInactivos.push(targetId);
    } else {
      if (mat.activo === false) {
        alertas.push(`Material discontinuado/obsoleto: "${mat.nombre}"`);
        insumosInactivos.push(mat.nombre);
      }
      if (mat.fichaIncompleta) {
        alertas.push(`Ficha técnica incompleta: "${mat.nombre}"`);
        insumosIncompletos.push(mat.nombre);
      }
      if (!mat.precioActual || mat.precioActual <= 0) {
        alertas.push(`Material sin precio de oferta vigente: "${mat.nombre}"`);
      }
    }
  }

  // Check 2: Evaluación de margen mínimo
  if (margenPorcentajeProyectado < umbralAdvertencia) {
    alertas.push(`Margen proyectado (${margenPorcentajeProyectado}%) por debajo del umbral mínimo (${umbralAdvertencia}%)`);
  }

  // Check 3: Factor EMA muy elevado (> 1.25x indica sobrecosto recurrente de mano de obra)
  const factorEMA = safeNum(tarea.factorCorreccion) || 1.0;
  if (factorEMA > 1.25) {
    alertas.push(`Sobrecosto histórico de mano de obra: Factor EMA actual ${factorEMA.toFixed(2)}x`);
  }

  let estado: 'verde' | 'amarillo' | 'rojo' = 'verde';
  if (insumosInactivos.length > 0 || margenPorcentajeProyectado < umbralAdvertencia || costoDirecto === 0) {
    estado = 'rojo';
  } else if (insumosIncompletos.length > 0 || factorEMA > 1.2 || alertas.length > 0) {
    estado = 'amarillo';
  }

  return {
    tarea,
    costoDirecto,
    costoInsumos,
    costoManoObra,
    precioVentaSugerido,
    margenPorcentajeProyectado,
    estado,
    alertas,
    insumosInactivos,
    insumosIncompletos
  };
}
