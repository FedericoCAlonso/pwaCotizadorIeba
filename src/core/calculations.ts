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
  ImpuestoItem,
  TipoFactura,
  RegistroTrabajo,
  AppConfig,
  ParametrosTrabajoTipo,
  NivelAntiguedadEstado,
  NivelAccesibilidad,
  NivelAltura,
  ParametrosEstimacionMaterial,
  FiltroMaterialEnTarea
} from './types';
import { evaluateMathExpression, evaluateCondition } from './mathEvaluator';

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
export function safeNum(value: unknown, allowNegative = false): number {
  const n = Number(value);
  if (!isFinite(n) || isNaN(n)) return 0;
  if (!allowNegative && n < 0) return 0;
  return n;
}

// ─── Helpers de Conversión de Precios e IVA (Canónico: GMT) ──────────────────
/**
 * Convierte un precio final con IVA a su base neta gravable.
 * precioNeto = precioFinal / (1 + alicuota / 100)
 */
export function calcularPrecioNeto(precioFinal: number, alicuotaIVA = 21): number {
  const alicuota = Math.max(0, safeNum(alicuotaIVA));
  return roundMoney(safeNum(precioFinal) / (1 + alicuota / 100));
}

/**
 * Convierte un precio neto a su precio final con IVA.
 * precioFinal = precioNeto * (1 + alicuota / 100)
 */
export function calcularPrecioFinal(precioNeto: number, alicuotaIVA = 21): number {
  const alicuota = Math.max(0, safeNum(alicuotaIVA));
  return roundMoney(safeNum(precioNeto) * (1 + alicuota / 100));
}

// ─── Presentaciones de Compra y Factores de Empaque ──────────────────────────

export interface PresentacionEmpaque {
  etiqueta: string;
  cantidad: number;
}

export const PRESENTACIONES_COMPRA_PRESETS: Record<string, PresentacionEmpaque[]> = {
  m: [
    { etiqueta: 'Por Metro Fraccionado (1 m)', cantidad: 1 },
    { etiqueta: 'Rollo / Caja x 100 m', cantidad: 100 },
    { etiqueta: 'Bobina x 500 m', cantidad: 500 },
    { etiqueta: 'Bobina x 1000 m', cantidad: 1000 },
    { etiqueta: 'Tira x 3 m (Caños/Perfiles)', cantidad: 3 },
    { etiqueta: 'Rollo x 25 m', cantidad: 25 },
    { etiqueta: 'Rollo x 50 m', cantidad: 50 }
  ],
  u: [
    { etiqueta: 'Unidad individual (1 u)', cantidad: 1 },
    { etiqueta: 'Caja x 100 u', cantidad: 100 },
    { etiqueta: 'Caja x 50 u', cantidad: 50 },
    { etiqueta: 'Pack / Blíster x 10 u', cantidad: 10 },
    { etiqueta: 'Caja x 200 u', cantidad: 200 },
    { etiqueta: 'Caja x 500 u', cantidad: 500 }
  ],
  kg: [
    { etiqueta: 'Por Kilogramo (1 kg)', cantidad: 1 },
    { etiqueta: 'Bolsa x 25 kg', cantidad: 25 },
    { etiqueta: 'Bolsa x 50 kg', cantidad: 50 }
  ]
};

/**
 * Retorna las opciones de empaque recomendadas según la unidad de venta del material.
 */
export function obtenerPresentacionesSugeridas(unidadVenta = 'u'): PresentacionEmpaque[] {
  const u = (unidadVenta || 'u').trim().toLowerCase();
  if (u === 'm' || u === 'metro' || u === 'metros') return PRESENTACIONES_COMPRA_PRESETS.m;
  if (u === 'kg' || u === 'kilo' || u === 'kilogramo') return PRESENTACIONES_COMPRA_PRESETS.kg;
  return PRESENTACIONES_COMPRA_PRESETS.u;
}

/**
 * Calcula el precio unitario base a partir del precio de un bulto/rollo completo.
 */
export function calcularPrecioUnitarioDesdePresentacion(precioBulto: number, cantidadPorBulto = 1): number {
  const qty = Math.max(1, safeNum(cantidadPorBulto));
  return roundMoney(safeNum(precioBulto) / qty);
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
  manoObraMap: Map<string, CategoriaManoDeObra>,
  options?: {
    tipoFactura?: TipoFactura;
    alicuotaIVADefault?: number;
  }
): {
  costoInsumosUnitario: number;
  costoManoObraUnitario: number;
  costoFijoOperativo?: number;
  costoDirectoUnitario: number;
  insumosSnapshotUnitario: InsumoSnapshot[];
  manoObraSnapshotUnitario: ManoObraSnapshot[];
} {
  const defaultParams: Record<string, number> = {};
  if (tarea.parametros) {
    tarea.parametros.forEach((p) => {
      defaultParams[p.id] = p.valorDefault ?? 1;
    });
  }

  const consumos = calcularConsumosTareaTipo(tarea, defaultParams, insumosMap, manoObraMap, options);

  return {
    costoInsumosUnitario: consumos.costoInsumosTotal,
    costoManoObraUnitario: consumos.costoManoObraTotal,
    costoFijoOperativo: consumos.costoFijoOperativo,
    costoDirectoUnitario: consumos.costoDirectoTotal,
    insumosSnapshotUnitario: consumos.insumosSnapshot,
    manoObraSnapshotUnitario: consumos.manoObraSnapshot
  };
}

// ─── Cláusulas y Modelado Paramétrico de Trabajos Tipo (Multi-Parámetro) ────────

export const DEFAULT_CLAUSULA_OBRA_EXISTENTE =
  'La cotización contempla el reemplazo de conductores a través de las canalizaciones existentes en condiciones transitables. En caso de detectarse cañerías obstruidas, colapsadas o cajas ciegas no accesibles que demanden apertura de mampostería o colocación de conductos a la vista, los trabajos de destape o recanalización se cotizarán como adicionales previa conformidad del cliente.';

/**
 * Obtiene el coeficiente de Antigüedad y Estado de la Instalación (K_estado).
 * Moderna (<15 años, caño corrugado PVC/hierro sano): 1.0 (sin recargo)
 * Intermedia (15 a 30 años, hierro semipesado / conductores envejecidos): 1.25 (+25% tiempo)
 * Antigua (>30 años, chapa fina/Bergman, tela/goma, signos de humedad): 1.60 (+60% tiempo)
 */
export function obtenerCoeficienteEstado(
  estado: NivelAntiguedadEstado = 'moderna',
  customVal?: number
): number {
  if (estado === 'intermedia') return 1.25;
  if (estado === 'antigua') return 1.60;
  if (estado === 'personalizado' && customVal !== undefined) return Math.max(0.1, safeNum(customVal));
  return 1.0;
}

/**
 * Obtiene el coeficiente de Accesibilidad y Obstrucción del Entorno (K_acceso).
 * Despejada / Vacía (obra desocupada / ambientes libres): 1.0
 * Habitada estándar (cuidado de mobiliario, protección de pisos): 1.15
 * Obstruida / Cajas no registrables (muebles empotrados, cielorrasos suspendidos sin registro): 1.35
 */
export function obtenerCoeficienteAccesibilidad(
  acceso: NivelAccesibilidad = 'despejada',
  customVal?: number
): number {
  if (acceso === 'habitada') return 1.15;
  if (acceso === 'obstruida') return 1.35;
  if (acceso === 'personalizado' && customVal !== undefined) return Math.max(0.1, safeNum(customVal));
  return 1.0;
}

/**
 * Obtiene el coeficiente de Altura y Logística Operativa (K_altura).
 * Altura estándar (<= 2.70 m, escalera tijera común): 1.0
 * Doble altura o techos altos (> 2.70 m hasta 4 m, escaleras extensibles o andamios livianos): 1.25
 * Gran altura (> 4 m, andamios tubulares pesados / elevador): 1.50
 */
export function obtenerCoeficienteAltura(
  altura: NivelAltura = 'estandar',
  customVal?: number
): number {
  if (altura === 'doble_altura') return 1.25;
  if (altura === 'gran_altura') return 1.50;
  if (altura === 'personalizado' && customVal !== undefined) return Math.max(0.1, safeNum(customVal));
  return 1.0;
}

/**
 * Calcula el coeficiente compuesto total de complejidad para la mano de obra:
 * K_total = K_estado * K_acceso * K_altura
 */
export function calcularCoeficienteComplejidad(
  kEstado: number,
  kAcceso: number,
  kAltura: number
): number {
  const kE = Math.max(0.1, safeNum(kEstado) || 1.0);
  const kA = Math.max(0.1, safeNum(kAcceso) || 1.0);
  const kH = Math.max(0.1, safeNum(kAltura) || 1.0);
  return Math.round(kE * kA * kH * 1000) / 1000;
}

/**
 * Calcula el costo completo de un Trabajo Tipo con modelado multi-paramétrico:
 * 1. Costo Base MO = Σ(horas_i * costoHora_i)
 * 2. Multiplicador de Complejidad K_comp = K_estado * K_acceso * K_altura
 * 3. Adicionales de Desarmado = cantArtefactos * costoUnitarioArtefacto
 * 4. Costo MO Total = (Costo Base MO * cantidad * K_comp) + Adicionales Desarmado
 * 5. Costo Insumos Total = (Costo Base Insumos * cantidad)
 * 6. Costo Directo Total = Costo Insumos Total + Costo MO Total
 */
export function calcularCostoParametricoTareaTipo(
  tarea: TareaTipo,
  parametros: ParametrosTrabajoTipo,
  insumosMap: Map<string, Insumo>,
  manoObraMap: Map<string, CategoriaManoDeObra>,
  options?: {
    tipoFactura?: TipoFactura;
    alicuotaIVADefault?: number;
  }
): {
  cantidad: number;
  costoInsumosUnitario: number;
  costoInsumosTotal: number;
  costoManoObraUnitario: number;
  costoManoObraTotal: number;
  adicionalesDesarmadoTotal: number;
  costoDirectoUnitario: number;
  costoDirectoTotal: number;
  coeficienteComplejidadTotal: number;
  insumosSnapshot: InsumoSnapshot[];
  manoObraSnapshot: ManoObraSnapshot[];
  clausulaTecnica?: string;
} {
  const cantidad = Math.max(0.0001, safeNum(parametros.cantidad) || 1);
  const costData = calcularCostoTareaTipo(tarea, insumosMap, manoObraMap, options);

  const kEstado = safeNum(parametros.coeficienteEstado) || obtenerCoeficienteEstado(parametros.estadoAntiguedad);
  const kAcceso = safeNum(parametros.coeficienteAccesibilidad) || obtenerCoeficienteAccesibilidad(parametros.accesibilidad);
  const kAltura = safeNum(parametros.coeficienteAltura) || obtenerCoeficienteAltura(parametros.altura);
  const kComplejidad = calcularCoeficienteComplejidad(kEstado, kAcceso, kAltura);

  const cantArtefactos = Math.max(0, safeNum(parametros.artefactosEspecialesCantidad) || 0);
  const costoArtefacto = Math.max(0, safeNum(parametros.artefactosEspecialesCostoUnitario) || 0);
  const adicionalesDesarmadoTotal = roundMoney(cantArtefactos * costoArtefacto);

  // Escala de insumos
  const costoInsumosUnitario = costData.costoInsumosUnitario;
  const costoInsumosTotal = roundMoney(costoInsumosUnitario * cantidad);

  // Escala de mano de obra con complejidad y adicionales
  const costoManoObraBaseUnitario = costData.costoManoObraUnitario;
  const costoManoObraAjustadoUnitario = roundMoney(costoManoObraBaseUnitario * kComplejidad);
  const costoManoObraTotal = roundMoney((costoManoObraAjustadoUnitario * cantidad) + adicionalesDesarmadoTotal);
  const costoManoObraUnitario = roundMoney(costoManoObraTotal / cantidad);

  const costoDirectoTotal = roundMoney(costoInsumosTotal + costoManoObraTotal);
  const costoDirectoUnitario = roundMoney(costoDirectoTotal / cantidad);

  // Generar snapshots completos multiplicados por la cantidad y factor de complejidad
  const insumosSnapshot: InsumoSnapshot[] = costData.insumosSnapshotUnitario.map(i => {
    const cantTot = roundMoney(i.cantidadTotal * cantidad);
    return {
      ...i,
      cantidadUnitaria: i.cantidadTotal,
      cantidadTotal: cantTot,
      subtotalInsumo: roundMoney(i.precioUnitarioCongelado * cantTot),
      subtotalInsumoFinal: roundMoney((i.precioFinalUnitarioCongelado || i.precioUnitarioCongelado) * cantTot)
    };
  });

  const manoObraSnapshot: ManoObraSnapshot[] = costData.manoObraSnapshotUnitario.map(m => {
    const horasTotales = roundMoney(m.horasTotales * cantidad * kComplejidad);
    return {
      ...m,
      horasUnitarias: m.horasTotales,
      horasTotales,
      subtotalManoObra: roundMoney(m.costoHoraCongelado * horasTotales)
    };
  });

  // Si hay adicionales de desarmado, se agrega una línea de snapshot para trazabilidad
  if (adicionalesDesarmadoTotal > 0) {
    manoObraSnapshot.push({
      categoriaId: 'mo-adicional-desarmado',
      nombreCategoria: `Adicional Desarmado: ${parametros.artefactosEspecialesDescripcion || 'Artefactos Especiales'} (${cantArtefactos} u)`,
      horasUnitarias: 0,
      horasTotales: 0,
      costoHoraCongelado: costoArtefacto,
      subtotalManoObra: adicionalesDesarmadoTotal
    });
  }

  return {
    cantidad,
    costoInsumosUnitario,
    costoInsumosTotal,
    costoManoObraUnitario,
    costoManoObraTotal,
    adicionalesDesarmadoTotal,
    costoDirectoUnitario,
    costoDirectoTotal,
    coeficienteComplejidadTotal: kComplejidad,
    insumosSnapshot,
    manoObraSnapshot,
    clausulaTecnica: parametros.incluirClausulaEnPresupuesto ? (parametros.clausulaTecnica || DEFAULT_CLAUSULA_OBRA_EXISTENTE) : undefined
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
  cantidad: number,
  tipoFactura?: TipoFactura
): ItemPresupuesto {
  const cantidadSana = safeNum(cantidad) || 1;
  const cantAnterior = safeNum(item.cantidad) || 1;
  const isFacturaC_or_X = tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';

  const insumosCongelados = item.insumosSnapshot.map(i => {
    const unitQty = i.cantidadUnitaria !== undefined
      ? i.cantidadUnitaria
      : (cantAnterior > 0 ? i.cantidadTotal / cantAnterior : i.cantidadTotal);
    const cantTotal = roundMoney(unitQty * cantidadSana);
    const alicuota = i.alicuotaIVA !== undefined ? safeNum(i.alicuotaIVA) : 21;
    const precioFinalUnit = i.precioFinalUnitarioCongelado ?? roundMoney(i.precioUnitarioCongelado * (1 + alicuota / 100));

    return {
      ...i,
      alicuotaIVA: alicuota,
      precioFinalUnitarioCongelado: precioFinalUnit,
      cantidadUnitaria: unitQty,
      cantidadTotal: cantTotal,
      subtotalInsumo: roundMoney(i.precioUnitarioCongelado * cantTotal),
      subtotalInsumoFinal: roundMoney(precioFinalUnit * cantTotal)
    };
  });

  const manoObraCongelada = item.manoObraSnapshot.map(m => {
    const unitHoras = m.horasUnitarias !== undefined
      ? m.horasUnitarias
      : (cantAnterior > 0 ? m.horasTotales / cantAnterior : m.horasTotales);
    const hTotales = roundMoney(unitHoras * cantidadSana);
    return {
      ...m,
      horasUnitarias: unitHoras,
      horasTotales: hTotales,
      subtotalManoObra: roundMoney(m.costoHoraCongelado * hTotales)
    };
  });

  const costoInsumosNeto = roundMoney(insumosCongelados.reduce((acc, i) => acc + i.subtotalInsumo, 0));
  const costoInsumosFinal = roundMoney(insumosCongelados.reduce((acc, i) => acc + (i.subtotalInsumoFinal ?? i.subtotalInsumo), 0));
  const costoInsumos = isFacturaC_or_X ? costoInsumosFinal : costoInsumosNeto;

  const costoManoObra = roundMoney(manoObraCongelada.reduce((acc, m) => acc + m.subtotalManoObra, 0));

  const hasSnapshots = item.insumosSnapshot.length > 0 || item.manoObraSnapshot.length > 0;
  const costoDirectoTotal = hasSnapshots
    ? roundMoney(costoInsumos + costoManoObra)
    : roundMoney((cantAnterior > 0 ? item.costoDirectoTotal / cantAnterior : item.costoDirectoTotal) * cantidadSana);

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
  const minRatio = ratios.reduce((min, v) => (v < min ? v : min), ratios[0]);
  const maxRatio = ratios.reduce((max, v) => (v > max ? v : max), ratios[0]);
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
  const isPresupuestoX = tipoFactura === 'Presupuesto X (Sin Factura)';

  return [
    {
      id: 'tax-iva',
      nombre: `IVA (${porcentajeIVA}%)`,
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

// ─── Cálculo de totales del presupuesto (Nuevo Motor: C → GG → B → S → Impuestos → Precio Final & K) ───────

export interface TotalesPresupuestoResultado {
  // ─── Modelo Estricto: C → GG → B → S → Impuestos → Precio Final & K ───
  costoGlobal: number; // Costo (C) = suma de insumos + mano de obra + servicios tercerizados
  gastosGeneralesTotal: number; // GG total = Σ(GG absolutos) + Σ(GG% × C)
  beneficioPorcentaje: number; // % beneficio calculado sobre (C + GG)
  beneficioMonto: number; // B = %beneficio × (C + GG)
  subtotalSinImpuestos: number; // Subtotal (S) = C + GG + B
  impuestosCalculados: ImpuestoItem[]; // Impuestos independientes calculados sobre S
  impuestosPorcentajeTotal: number;
  montoImpuestosTotal: number; // Σ(impuesto_i% × S)
  precioFinalGlobal: number; // Precio Final = S + Impuestos total
  coeficienteK: number; // K = Precio Final Global / Costo Global
  itemsCalculados: ItemPresupuesto[]; // Ítems con su costo y precio de venta unitario/total asignado (Costo × K)

  // Desgloses y compatibilidad retroactiva
  subtotalInsumos: number;
  subtotalManoObra: number;
  subtotalServiciosTercerizados: number;
  subtotalCostosDirectos: number; // Alias de C
  subtotalCostosIndirectos: number; // Alias de GG
  costosIndirectosAplicados: CostoIndirectoSnapshot[];
  costoTotalObra: number; // C + GG
  montoGanancia: number; // Alias de B
  precioVentaSinImpuestos: number; // Alias de S
  totalARS: number; // Alias de Precio Final
  totalMonedaExtranjera?: number;
}

/**
 * Calcula los totales completos de un presupuesto siguiendo el orden de dependencia estricto:
 * 1. Costo (C) = Σ(Insumos) + Σ(Mano de Obra) + Σ(Servicios Tercerizados)
 * 2. Gastos Generales (GG) = Σ(GG fijos) + Σ(GG% × C)
 * 3. Beneficio (B) = %beneficio × (C + GG)
 * 4. Subtotal (S) = C + GG + B
 * 5. Impuestos = Σ(impuesto_i% × S) (sin cascada entre ellos)
 * 6. Precio Final = S + Impuestos total
 * 7. Coeficiente de Venta K = Precio Final / Costo Global
 * 8. Precios de Venta por renglón = Costo de ítem × K
 */
export function calcularTotalesPresupuesto(params: {
  items: ItemPresupuesto[];
  costosIndirectosCatalog?: CostoIndirecto[];
  costosIndirectosConfig?: CostoIndirectoItemConfig[];
  margenPorcentaje?: number;
  beneficioPorcentaje?: number;
  impuestosDetalle: ImpuestoItem[];
  tipoFactura?: TipoFactura;
  cotizacionMonedaExtranjera?: number;
}): TotalesPresupuestoResultado {
  const {
    items = [],
    costosIndirectosCatalog = [],
    costosIndirectosConfig,
    margenPorcentaje,
    beneficioPorcentaje: beneficioInput,
    impuestosDetalle = [],
    tipoFactura,
    cotizacionMonedaExtranjera
  } = params;

  const isFacturaC_or_X = tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';

  // 1. Costo (C) por ítem y global
  let subtotalInsumos = 0;
  let subtotalManoObra = 0;
  let subtotalServiciosTercerizados = 0;
  let costoGlobal = 0;
  const itemCosts: number[] = [];

  for (const item of items) {
    let cInsumos = safeNum(item.costoInsumos);
    if (item.insumosSnapshot && item.insumosSnapshot.length > 0) {
      if (isFacturaC_or_X) {
        cInsumos = roundMoney(
          item.insumosSnapshot.reduce((acc, i) => {
            if (i.subtotalInsumoFinal !== undefined) return acc + safeNum(i.subtotalInsumoFinal);
            const alicuota = i.alicuotaIVA !== undefined ? safeNum(i.alicuotaIVA) : 21;
            const unitFinal = i.precioFinalUnitarioCongelado ?? roundMoney(i.precioUnitarioCongelado * (1 + alicuota / 100));
            return acc + roundMoney(unitFinal * i.cantidadTotal);
          }, 0)
        );
      } else {
        cInsumos = roundMoney(
          item.insumosSnapshot.reduce((acc, i) => acc + safeNum(i.subtotalInsumo), 0)
        );
      }
    }

    const cManoObra = safeNum(item.costoManoObra);

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

    const itemCosto = hasSnapshots
      ? roundMoney(cInsumos + cManoObra + cServicios)
      : roundMoney(safeNum(item.costoDirectoTotal) || safeNum(item.costoTotal));

    itemCosts.push(itemCosto);
    costoGlobal = roundMoney(costoGlobal + itemCosto);
  }

  // 2. Gastos Generales (GG):
  // - GG Absolutos: suma de montos fijos (seguros, fletes, etc.)
  // - GG Porcentuales: suma de porcentajes a aplicar sobre la base (C + GG_absolutos)
  let totalGGAbsolutos = 0;
  let porcentajeGGPct = 0;
  const costosIndirectosAplicados: CostoIndirectoSnapshot[] = [];

  const rawConfig = (costosIndirectosConfig && costosIndirectosConfig.length > 0)
    ? costosIndirectosConfig
    : costosIndirectosCatalog.map(c => ({ id: c.id, nombre: c.nombre, tipo: c.tipo, valor: c.valor, aplica: true }));

  for (const c of rawConfig) {
    if (c.aplica) {
      if (c.tipo === 'porcentual_sobre_costo') {
        porcentajeGGPct += safeNum(c.valor);
      } else {
        totalGGAbsolutos = roundMoney(totalGGAbsolutos + safeNum(c.valor));
      }
    }
  }

  // Base global = C + Total_GG_absolutos
  const baseGlobal = roundMoney(costoGlobal + totalGGAbsolutos);
  const ggPorcentualGlobal = roundMoney(baseGlobal * (porcentajeGGPct / 100));
  const gastosGeneralesTotal = roundMoney(totalGGAbsolutos + ggPorcentualGlobal);

  // Registro de snapshots de costos indirectos
  for (const c of rawConfig) {
    if (c.aplica) {
      let montoCalculado = 0;
      if (c.tipo === 'porcentual_sobre_costo') {
        montoCalculado = roundMoney(baseGlobal * (safeNum(c.valor) / 100));
      } else {
        montoCalculado = roundMoney(safeNum(c.valor));
      }
      costosIndirectosAplicados.push({
        costoIndirectoId: c.id,
        nombre: c.nombre,
        tipo: c.tipo,
        valorAplicado: safeNum(c.valor),
        montoCalculado
      });
    }
  }

  // 3. Beneficio (B): %beneficio sobre (Base + GG_porcentual) = (C + GG_total)
  const beneficioPct = safeNum(beneficioInput !== undefined ? beneficioInput : margenPorcentaje);
  const baseCostoMasGG = roundMoney(costoGlobal + gastosGeneralesTotal);
  const beneficioMonto = roundMoney(baseCostoMasGG * (beneficioPct / 100));

  // 4. Subtotal (S) = C + GG + B
  const subtotalSinImpuestos = roundMoney(costoGlobal + gastosGeneralesTotal + beneficioMonto);

  // 5. Impuestos: calculados sobre Subtotal (S), sin cascada entre ellos
  let montoImpuestosTotal = 0;
  let impuestosPorcentajeTotal = 0;

  const impuestosCalculados = (impuestosDetalle || []).map(tax => {
    let montoCalculado = 0;
    const taxApplies = isFacturaC_or_X && tax.id === 'tax-iva' ? false : tax.aplica;
    if (taxApplies) {
      montoCalculado = roundMoney(subtotalSinImpuestos * (safeNum(tax.porcentaje) / 100));
      montoImpuestosTotal = roundMoney(montoImpuestosTotal + montoCalculado);
      impuestosPorcentajeTotal = roundMoney(impuestosPorcentajeTotal + safeNum(tax.porcentaje));
    }
    return {
      ...tax,
      aplica: taxApplies,
      discriminar: tipoFactura === 'Factura A' ? true : (tipoFactura === 'Factura B' ? false : tax.discriminar),
      montoCalculado
    };
  });

  // 6. Precio Final Global = S + Impuestos
  const precioFinalGlobal = roundMoney(subtotalSinImpuestos + montoImpuestosTotal);

  // 7. Coeficiente de Venta Global (K = Precio Final / Costo Global)
  const coeficienteK = costoGlobal > 0 ? precioFinalGlobal / costoGlobal : 1;

  // 8. LÓGICA DE PRORRATEO APU (Análisis de Precios Unitarios en Cascada por Ítem)
  let accumulatedGGAbs = 0;
  let accumulatedBase = 0;
  let accumulatedGGPct = 0;
  let accumulatedBeneficio = 0;
  let accumulatedSubtotal = 0;
  let accumulatedImpuestos = 0;
  let accumulatedPrecioFinal = 0;

  const numItems = items.length;

  const itemsCalculados: ItemPresupuesto[] = items.map((item, idx) => {
    const cant = Math.max(0.0001, safeNum(item.cantidad) || 1);
    const itemC = itemCosts[idx];
    const isLast = idx === numItems - 1 && numItems > 1;

    // 1. Incidencia de costo del ítem
    const incidencia = costoGlobal > 0 ? (itemC / costoGlobal) : (numItems > 0 ? 1 / numItems : 1);

    // 2. Prorrateo de GG Absoluto
    let ggAbsolutoProrrateado = roundMoney(totalGGAbsolutos * incidencia);
    if (isLast && totalGGAbsolutos > 0) {
      const diffGGAbs = roundMoney(totalGGAbsolutos - (accumulatedGGAbs + ggAbsolutoProrrateado));
      if (Math.abs(diffGGAbs) <= 0.10) {
        ggAbsolutoProrrateado = roundMoney(ggAbsolutoProrrateado + diffGGAbs);
      }
    }
    accumulatedGGAbs = roundMoney(accumulatedGGAbs + ggAbsolutoProrrateado);

    // 3. Nueva Base de Costo del Ítem
    let baseCostoItem = roundMoney(itemC + ggAbsolutoProrrateado);
    if (isLast && baseGlobal > 0) {
      const diffBase = roundMoney(baseGlobal - (accumulatedBase + baseCostoItem));
      if (Math.abs(diffBase) <= 0.10) {
        baseCostoItem = roundMoney(baseCostoItem + diffBase);
      }
    }
    accumulatedBase = roundMoney(accumulatedBase + baseCostoItem);

    // 4. GG Porcentual del Ítem
    let ggPorcentualItem = roundMoney(baseCostoItem * (porcentajeGGPct / 100));
    if (isLast && ggPorcentualGlobal > 0) {
      const diffGGPct = roundMoney(ggPorcentualGlobal - (accumulatedGGPct + ggPorcentualItem));
      if (Math.abs(diffGGPct) <= 0.10) {
        ggPorcentualItem = roundMoney(ggPorcentualItem + diffGGPct);
      }
    }
    accumulatedGGPct = roundMoney(accumulatedGGPct + ggPorcentualItem);

    // 5. Beneficio del Ítem = (Base_item + GG_porcentual_item) * porcentaje_Beneficio
    let beneficioItem = roundMoney((baseCostoItem + ggPorcentualItem) * (beneficioPct / 100));
    if (isLast && beneficioMonto > 0) {
      const diffB = roundMoney(beneficioMonto - (accumulatedBeneficio + beneficioItem));
      if (Math.abs(diffB) <= 0.10) {
        beneficioItem = roundMoney(beneficioItem + diffB);
      }
    }
    accumulatedBeneficio = roundMoney(accumulatedBeneficio + beneficioItem);

    // 6. Subtotal del Ítem = Base_item + GG_porcentual_item + Beneficio_item
    let subtotalItem = roundMoney(baseCostoItem + ggPorcentualItem + beneficioItem);
    if (isLast && subtotalSinImpuestos > 0) {
      const diffS = roundMoney(subtotalSinImpuestos - (accumulatedSubtotal + subtotalItem));
      if (Math.abs(diffS) <= 0.10) {
        subtotalItem = roundMoney(subtotalItem + diffS);
      }
    }
    accumulatedSubtotal = roundMoney(accumulatedSubtotal + subtotalItem);

    // 7. Impuestos del Ítem = Σ(impuesto_i% * Subtotal_item)
    let impuestosItem = roundMoney(subtotalItem * (impuestosPorcentajeTotal / 100));
    if (isLast && montoImpuestosTotal > 0) {
      const diffImp = roundMoney(montoImpuestosTotal - (accumulatedImpuestos + impuestosItem));
      if (Math.abs(diffImp) <= 0.10) {
        impuestosItem = roundMoney(impuestosItem + diffImp);
      }
    }
    accumulatedImpuestos = roundMoney(accumulatedImpuestos + impuestosItem);

    // 8. Precio Final del Ítem = Subtotal_item + Impuestos_item
    let precioFinalItem = roundMoney(subtotalItem + impuestosItem);
    if (isLast && precioFinalGlobal > 0) {
      const diffPF = roundMoney(precioFinalGlobal - (accumulatedPrecioFinal + precioFinalItem));
      if (Math.abs(diffPF) <= 0.10) {
        precioFinalItem = roundMoney(precioFinalItem + diffPF);
      }
    }
    accumulatedPrecioFinal = roundMoney(accumulatedPrecioFinal + precioFinalItem);

    const precioVentaUnitarioItem = roundMoney(precioFinalItem / cant);

    return {
      ...item,
      costoInsumos: roundMoney(safeNum(item.costoInsumos)),
      costoManoObra: roundMoney(safeNum(item.costoManoObra)),
      costoServiciosTercerizados: roundMoney(safeNum(item.costoServiciosTercerizados)),
      costoDirectoTotal: itemC,
      costoUnitario: roundMoney(itemC / cant),
      costoTotal: itemC,

      // APU Prorrateado
      incidencia: Math.round(incidencia * 10000) / 10000,
      ggAbsolutoProrrateado,
      baseCostoItem,
      ggPorcentualItem,
      beneficioItem,
      subtotalItem,
      impuestosItem,
      precioFinalItem,

      // Precios de Venta Finales del Renglón
      precioVentaClienteTotal: precioFinalItem,
      precioVentaClienteUnitario: precioVentaUnitarioItem,
      precioVentaTotal: precioFinalItem,
      precioVentaUnitario: precioVentaUnitarioItem
    };
  });

  // Conversión a Moneda Extranjera
  let totalMonedaExtranjera: number | undefined = undefined;
  const cotizacion = safeNum(cotizacionMonedaExtranjera, true);
  if (cotizacion > 0) {
    totalMonedaExtranjera = roundMoney(precioFinalGlobal / cotizacion);
  }

  return {
    costoGlobal,
    gastosGeneralesTotal,
    beneficioPorcentaje: beneficioPct,
    beneficioMonto,
    subtotalSinImpuestos,
    impuestosCalculados,
    impuestosPorcentajeTotal,
    montoImpuestosTotal,
    precioFinalGlobal,
    coeficienteK,
    itemsCalculados,

    // Compatibilidad
    subtotalInsumos,
    subtotalManoObra,
    subtotalServiciosTercerizados,
    subtotalCostosDirectos: costoGlobal,
    subtotalCostosIndirectos: gastosGeneralesTotal,
    costosIndirectosAplicados,
    costoTotalObra: baseCostoMasGG,
    montoGanancia: beneficioMonto,
    precioVentaSinImpuestos: subtotalSinImpuestos,
    totalARS: precioFinalGlobal,
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

  // Precio de venta proyectado aplicando margen estándar (markup sobre costo directo)
  const precioVentaSugerido = roundMoney(costoDirecto * (1 + margenPctDefecto / 100));
  const margenPorcentajeProyectado = margenPctDefecto;

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

// ─── Cómputo Métrico Paramétrico de Materiales (Superficie, Trazado, Error) ───

/**
 * Realiza el cómputo métrico paramétrico de un material (cables, cañerías, cajas)
 * según el modelo seleccionado:
 * - Superficie (m²): Superficie × Factor m/m² × (1 + Desperdicio/Error %)
 * - Longitud de Cañería: Metros de cañería × Cantidad de hilos × (1 + % bajadas) × (1 + Desperdicio %)
 * - Bocas y Centros: Cantidad bocas × Distancia media × Hilos × (1 + Desperdicio %)
 * - Desperdicio Simple: Cantidad Base × (1 + Desperdicio %)
 */
export function calcularEstimacionParametricaMaterial(
  params: Partial<ParametrosEstimacionMaterial>,
  unidad = 'm'
): ParametrosEstimacionMaterial {
  const modelo = params.modelo || 'superficie_m2';
  const desperdicioPct = params.margenDesperdicioErrorPct !== undefined
    ? Math.max(0, safeNum(params.margenDesperdicioErrorPct))
    : 10; // Default 10%
  const factorDesperdicio = 1 + desperdicioPct / 100;

  let cantidadBase = 0;
  let formulaGenerada = '';
  let explicacionCalculo = '';

  switch (modelo) {
    case 'superficie_m2': {
      const sup = params.superficieM2 !== undefined ? Math.max(0, safeNum(params.superficieM2)) : 0;
      const densidad = params.factorDensidadM2 !== undefined ? Math.max(0.01, safeNum(params.factorDensidadM2)) : 3.5; // 3.5 m/m² default
      cantidadBase = sup * densidad;
      const total = roundMoney(cantidadBase * factorDesperdicio);
      formulaGenerada = `(${sup} * ${densidad}) * ${factorDesperdicio.toFixed(2)}`;
      explicacionCalculo = `${sup} m² × ${densidad} ${unidad}/m² (+${desperdicioPct}% desperdicio/curvas)`;
      return {
        modelo,
        superficieM2: sup,
        factorDensidadM2: densidad,
        margenDesperdicioErrorPct: desperdicioPct,
        cantidadEstimadaTotal: total,
        formulaGenerada,
        explicacionCalculo
      };
    }

    case 'longitud_caneria_fases': {
      const long = params.longitudCaneriaM !== undefined ? Math.max(0, safeNum(params.longitudCaneriaM)) : 0;
      const conductores = params.conductoresPorCaneria !== undefined ? Math.max(1, safeNum(params.conductoresPorCaneria)) : 3;
      const bajadasPct = params.adicionalBajadasPct !== undefined ? Math.max(0, safeNum(params.adicionalBajadasPct)) : 15; // +15% bajadas
      const factorBajadas = 1 + bajadasPct / 100;
      cantidadBase = long * conductores * factorBajadas;
      const total = roundMoney(cantidadBase * factorDesperdicio);
      formulaGenerada = `(${long} * ${conductores} * ${factorBajadas.toFixed(2)}) * ${factorDesperdicio.toFixed(2)}`;
      explicacionCalculo = `${long} m cañería × ${conductores} hilos (+${bajadasPct}% bajadas a cajas, +${desperdicioPct}% desperdicio)`;
      return {
        modelo,
        longitudCaneriaM: long,
        conductoresPorCaneria: conductores,
        adicionalBajadasPct: bajadasPct,
        margenDesperdicioErrorPct: desperdicioPct,
        cantidadEstimadaTotal: total,
        formulaGenerada,
        explicacionCalculo
      };
    }

    case 'bocas_distancia': {
      const bocas = params.cantidadBocas !== undefined ? Math.max(0, safeNum(params.cantidadBocas)) : 0;
      const dist = params.distanciaPromedioBocasM !== undefined ? Math.max(0, safeNum(params.distanciaPromedioBocasM)) : 4.0;
      const conductores = params.conductoresPorCaneria !== undefined ? Math.max(1, safeNum(params.conductoresPorCaneria)) : 3;
      cantidadBase = bocas * dist * conductores;
      const total = roundMoney(cantidadBase * factorDesperdicio);
      formulaGenerada = `(${bocas} * ${dist} * ${conductores}) * ${factorDesperdicio.toFixed(2)}`;
      explicacionCalculo = `${bocas} bocas × ${dist} m entre centros × ${conductores} hilos (+${desperdicioPct}% empalmes/cortes)`;
      return {
        modelo,
        cantidadBocas: bocas,
        distanciaPromedioBocasM: dist,
        conductoresPorCaneria: conductores,
        margenDesperdicioErrorPct: desperdicioPct,
        cantidadEstimadaTotal: total,
        formulaGenerada,
        explicacionCalculo
      };
    }

    case 'desperdicio_simple':
    default: {
      const base = params.cantidadEstimadaTotal !== undefined ? Math.max(0, safeNum(params.cantidadEstimadaTotal)) : 0;
      const total = roundMoney(base * factorDesperdicio);
      formulaGenerada = `${base} * ${factorDesperdicio.toFixed(2)}`;
      explicacionCalculo = `${base} ${unidad} base (+${desperdicioPct}% desperdicio/corte)`;
      return {
        modelo: 'desperdicio_simple',
        margenDesperdicioErrorPct: desperdicioPct,
        cantidadEstimadaTotal: total,
        formulaGenerada,
        explicacionCalculo
      };
    }
  }
}

// ─── Motor Universal de Fórmulas y Variables para Trabajos Tipo ──────────────

export interface ConsumosCalculadosResultado {
  cantidadPrincipal: number;
  valoresParametros: Record<string, number>;
  valoresVariables: Record<string, number>;
  scope: Record<string, number>;
  costoFijoOperativo: number;
  insumosSnapshot: InsumoSnapshot[];
  manoObraSnapshot: ManoObraSnapshot[];
  costoInsumosTotal: number;
  costoManoObraTotal: number;
  costoDirectoTotal: number;
  clausulaExclusiones?: string;
}

/**
 * Resuelve dinámicamente un material del catálogo a partir de una consulta/filtro de atributos técnicos y variables.
 */
export function resolverMaterialPorFiltro(
  filtro: FiltroMaterialEnTarea,
  variables: Record<string, number>,
  insumosMap: Map<string, Insumo>
): Insumo | null {
  if (!filtro || !filtro.categoriaId) return null;

  const candidatos: Insumo[] = [];

  for (const mat of insumosMap.values()) {
    if (mat.categoriaId !== filtro.categoriaId || mat.activo === false) {
      continue;
    }

    let coincide = true;

    for (const crit of filtro.criterios) {
      if (!crit.atributo) continue;
      const attr = mat.atributos?.find(a => a.clave.toLowerCase() === crit.atributo.toLowerCase());
      const attrVal = attr?.valor;

      // Evaluar el valor esperado (puede ser un literal como "2" o una expresión como "$calibre" o "4 + circuitos * 2")
      let targetVal: string | number = crit.valor;
      if (typeof targetVal === 'string') {
        const rawStr = targetVal.trim();
        if (rawStr.startsWith('$')) {
          const varKey = rawStr.slice(1).trim();
          targetVal = variables[varKey] !== undefined ? variables[varKey] : 0;
        } else {
          // Evaluar si es una fórmula aritmética
          const evalRes = evaluateMathExpression(rawStr, variables);
          if (evalRes.isValid && evalRes.value !== null && evalRes.isFormula) {
            targetVal = evalRes.value;
          }
        }
      }

      // Comparación numérica o textual
      const numAttr = typeof attrVal === 'number' ? attrVal : (attrVal !== undefined && attrVal !== null ? parseFloat(String(attrVal).replace(/[^0-9.-]/g, '')) : NaN);
      const numTarget = typeof targetVal === 'number' ? targetVal : parseFloat(String(targetVal).replace(/[^0-9.-]/g, ''));

      if (!isNaN(numAttr) && !isNaN(numTarget) && (crit.operador === '>=' || crit.operador === '<=' || crit.operador === '>' || crit.operador === '<')) {
        switch (crit.operador) {
          case '>=': if (!(numAttr >= numTarget - 1e-6)) coincide = false; break;
          case '<=': if (!(numAttr <= numTarget + 1e-6)) coincide = false; break;
          case '>': if (!(numAttr > numTarget + 1e-6)) coincide = false; break;
          case '<': if (!(numAttr < numTarget - 1e-6)) coincide = false; break;
        }
      } else {
        const strAttr = String(attrVal ?? '').trim().toLowerCase();
        const strTarget = String(targetVal ?? '').trim().toLowerCase();

        switch (crit.operador) {
          case '==':
            if (!isNaN(numAttr) && !isNaN(numTarget)) {
              if (Math.abs(numAttr - numTarget) >= 1e-6) coincide = false;
            } else {
              if (strAttr !== strTarget && !strAttr.includes(strTarget) && !strTarget.includes(strAttr)) coincide = false;
            }
            break;
          case '!=':
            if (!isNaN(numAttr) && !isNaN(numTarget)) {
              if (Math.abs(numAttr - numTarget) < 1e-6) coincide = false;
            } else {
              if (strAttr === strTarget) coincide = false;
            }
            break;
          default:
            coincide = false;
        }
      }

      if (!coincide) break;
    }

    if (coincide) {
      candidatos.push(mat);
    }
  }

  if (candidatos.length === 0) return null;

  // Ordenamiento según estrategia o atributo de orden
  const ordenKey = (filtro.atributoOrden || 'In').toLowerCase();
  const estrategia = filtro.estrategiaSeleccion || 'menor_valor_que_cumpla';

  if (estrategia === 'menor_valor_que_cumpla' || estrategia === 'mayor_valor_que_cumpla') {
    candidatos.sort((a, b) => {
      const valA = parseFloat(String(a.atributos?.find(at => at.clave.toLowerCase() === ordenKey)?.valor || '0').replace(/[^0-9.-]/g, '')) || 0;
      const valB = parseFloat(String(b.atributos?.find(at => at.clave.toLowerCase() === ordenKey)?.valor || '0').replace(/[^0-9.-]/g, '')) || 0;
      return estrategia === 'menor_valor_que_cumpla' ? valA - valB : valB - valA;
    });
  }

  return candidatos[0] || null;
}

/**
 * Evalúa los parámetros y variables calculadas de una TareaTipo en cascada,
 * calculando los consumos de insumos y mano de obra resultantes.
 */
export function calcularConsumosTareaTipo(
  tarea: TareaTipo,
  parametrosOVariables: Record<string, number>,
  insumosMap: Map<string, Insumo>,
  manoObraMap: Map<string, CategoriaManoDeObra>,
  options?: {
    tipoFactura?: TipoFactura;
    alicuotaIVADefault?: number;
  }
): ConsumosCalculadosResultado {
  const isFacturaC_or_X = options?.tipoFactura === 'Factura C' || options?.tipoFactura === 'Presupuesto X (Sin Factura)';
  const aliDefault = options?.alicuotaIVADefault ?? 21;
  const costoFijo = roundMoney(safeNum(tarea.costoFijoOperativo));

  // 1. Construir Scope Inicial con Parámetros
  const scope: Record<string, number> = {};
  const valoresParametros: Record<string, number> = {};

  if (tarea.parametros && tarea.parametros.length > 0) {
    tarea.parametros.forEach((p) => {
      const val = parametrosOVariables[p.id] !== undefined
        ? safeNum(parametrosOVariables[p.id])
        : (p.valorDefault ?? 1);
      scope[p.id] = val;
      valoresParametros[p.id] = val;
    });
  }

  // Copiar cualquier otra variable que se haya pasado explícitamente
  Object.entries(parametrosOVariables || {}).forEach(([k, v]) => {
    if (scope[k] === undefined) {
      scope[k] = safeNum(v);
      valoresParametros[k] = safeNum(v);
    }
  });

  // 2. Evaluar Variables Calculadas Internas en orden secuencial
  const valoresVariables: Record<string, number> = {};
  if (tarea.variables && tarea.variables.length > 0) {
    for (const v of tarea.variables) {
      if (v.id && v.formula && v.formula.trim()) {
        const evalRes = evaluateMathExpression(v.formula, scope);
        const valCalculado = (evalRes.isValid && evalRes.value !== null) ? evalRes.value : 0;
        scope[v.id] = valCalculado;
        valoresVariables[v.id] = valCalculado;
      }
    }
  }

  // 3. Evaluar Insumos usando el scope consolidado (parámetros + variables calculadas)
  let costoInsumosTotal = 0;
  const insumosSnapshot: InsumoSnapshot[] = [];

  for (const item of tarea.insumos) {
    // Evaluación de regla condicional de inclusión general (si existe)
    if (item.condicion && item.condicion.trim()) {
      const isIncluded = evaluateCondition(item.condicion, scope);
      if (!isIncluded) {
        continue; // Omitir este insumo de la cotización
      }
    }

    // Resolución del materialId (por Filtro de Categoría, por Reglas Dinámicas, o Material Directo)
    let targetId = item.materialId || item.insumoId || '';

    if (item.filtroMaterial) {
      const resolvedMat = resolverMaterialPorFiltro(item.filtroMaterial, scope, insumosMap);
      if (resolvedMat) {
        targetId = resolvedMat.id;
      } else {
        // No se encontró ningún material en el catálogo que cumpla los criterios
        continue;
      }
    } else if (item.reglasDinamicas && item.reglasDinamicas.length > 0) {
      const matchingRule = item.reglasDinamicas.find(regla =>
        !regla.condicion || evaluateCondition(regla.condicion, scope)
      );
      if (matchingRule) {
        targetId = matchingRule.materialId;
      } else {
        // Ninguna regla del slot dinámico coincidió con los parámetros actuales
        continue;
      }
    }

    if (!targetId) {
      continue;
    }

    const mat = insumosMap.get(targetId);
    const ali = mat?.alicuotaIVA ?? aliDefault;
    const precioNeto = roundMoney(safeNum(mat?.precioActual));
    const precioFinal = roundMoney(precioNeto * (1 + ali / 100));
    const precioUnitarioComputable = isFacturaC_or_X ? precioFinal : precioNeto;

    let cantEvaluada = item.cantidad ?? 1;
    if (item.formula && item.formula.trim()) {
      const evalRes = evaluateMathExpression(item.formula, scope);
      if (evalRes.isValid && evalRes.value !== null) {
        cantEvaluada = evalRes.value;
      }
    }

    // Si la cantidad evaluada es 0 o negativa, no genera costo
    if (cantEvaluada <= 0) {
      continue;
    }

    const subtotal = roundMoney(precioUnitarioComputable * cantEvaluada);
    costoInsumosTotal = roundMoney(costoInsumosTotal + subtotal);

    insumosSnapshot.push({
      materialId: targetId,
      insumoId: targetId,
      nombre: mat ? (mat.nombre || targetId) : 'Insumo no encontrado',
      marca: mat?.atributos?.find(a => a.clave.toLowerCase() === 'marca')?.valor,
      unidad: mat?.unidadVenta || mat?.unidad || 'u',
      cantidadUnitaria: cantEvaluada,
      cantidadTotal: cantEvaluada,
      precioUnitarioCongelado: precioNeto,
      alicuotaIVA: ali,
      precioFinalUnitarioCongelado: precioFinal,
      subtotalInsumo: subtotal,
      subtotalInsumoFinal: roundMoney(precioFinal * cantEvaluada),
      esAdHoc: false,
      requiereCotizacionDirecta: mat?.requiereCotizacionDirecta ?? false
    });
  }

  // 4. Evaluar Mano de Obra usando el scope consolidado
  let costoManoObraTotal = 0;
  const manoObraSnapshot: ManoObraSnapshot[] = [];

  for (const mo of tarea.manoObra) {
    // Evaluación de regla condicional de inclusión
    if (mo.condicion && mo.condicion.trim()) {
      const isIncluded = evaluateCondition(mo.condicion, scope);
      if (!isIncluded) {
        continue; // Omitir esta mano de obra
      }
    }

    const catMO = manoObraMap.get(mo.categoriaId);
    const costoHora = roundMoney(safeNum(catMO?.costoHora));

    let horasEvaluadas = mo.horas ?? 0;
    if (mo.formula && mo.formula.trim()) {
      const evalRes = evaluateMathExpression(mo.formula, scope);
      if (evalRes.isValid && evalRes.value !== null) {
        horasEvaluadas = evalRes.value;
      }
    }

    if (horasEvaluadas <= 0) {
      continue;
    }

    const subtotal = roundMoney(costoHora * horasEvaluadas);
    costoManoObraTotal = roundMoney(costoManoObraTotal + subtotal);

    manoObraSnapshot.push({
      categoriaId: mo.categoriaId,
      nombreCategoria: catMO?.nombre || 'Mano de Obra',
      horasUnitarias: horasEvaluadas,
      horasTotales: horasEvaluadas,
      costoHoraCongelado: costoHora,
      subtotalManoObra: subtotal
    });
  }

  const costoDirectoTotal = roundMoney(costoInsumosTotal + costoManoObraTotal + costoFijo);

  // Parámetro representativo principal (primer parámetro o fallback)
  const primerParam = tarea.parametros?.[0];
  const cantidadPrincipal = primerParam && scope[primerParam.id] !== undefined
    ? scope[primerParam.id]
    : (scope['cantidad'] || scope['bocas'] || scope['circuitos'] || scope['sup'] || 1);

  return {
    cantidadPrincipal,
    valoresParametros,
    valoresVariables,
    scope,
    costoFijoOperativo: costoFijo,
    insumosSnapshot,
    manoObraSnapshot,
    costoInsumosTotal,
    costoManoObraTotal,
    costoDirectoTotal,
    clausulaExclusiones: tarea.clausulaExclusiones || tarea.clausulaTecnicaDefault
  };
}


