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
  FiltroMaterialEnTarea,
  EstrategiaCuadrilla,
  NivelConfianzaSinergia,
  OpcionCuadrillaSimulada,
  PlanificacionCuadrilla,
  SinergiaManoObraResultado,
  ModoPlanificacionCuadrilla,
  EstimacionCuadrillaPorPlazoResultado,
  NivelMargenRiesgo,
  CapituloPresupuesto,
  GastoPresupuestoConfig,
  ParametroTrabajoTipo,
  DestinoGasto,
  ModalidadGasto
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

export function roundMoney4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
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
  costoServiciosUnitario?: number;
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
    costoServiciosUnitario: consumos.costoServiciosTotal,
    costoFijoOperativo: consumos.costoFijoOperativo,
    costoDirectoUnitario: consumos.costoDirectoTotal,
    insumosSnapshotUnitario: consumos.insumosSnapshot,
    manoObraSnapshotUnitario: consumos.manoObraSnapshot
  };
}

// ─── Cláusulas y Modelado Paramétrico de Trabajos Tipo (Multi-Parámetro) ────────

export const DEFAULT_CLAUSULA_OBRA_EXISTENTE =
  'La cotización contempla el reemplazo de conductores a través de las canalizaciones existentes en condiciones transitables. En caso de detectarse cañerías obstruidas, colapsadas o cajas ciegas no accesibles que demanden apertura de mampostería o colocación de conductos a la vista, los trabajos de destape o recanalización se cotizarán como adicionales previa conformidad del cliente.';

export const DEFAULT_CLAUSULA_SRT_900 =
  'El servicio contempla la medición de resistencia de puesta a tierra (IRAM 2281), continuidad de masas y ensayo de disparo de interruptores diferenciales con instrumental calibrado bajo norma. Incluye la emisión del informe técnico oficial según Res. SRT 900/15 y croquis de ubicación. No incluye adecuaciones ni reemplazo de elementos no conformes.';

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

  const unitServicios = item.costoServicios !== undefined
    ? (cantAnterior > 0 ? item.costoServicios / cantAnterior : item.costoServicios)
    : (cantAnterior > 0 && item.costoServiciosTercerizados ? item.costoServiciosTercerizados / cantAnterior : (item.costoServiciosTercerizados || 0));
  const costoServicios = roundMoney(unitServicios * cantidadSana);

  const hasSnapshots = item.insumosSnapshot.length > 0 || item.manoObraSnapshot.length > 0 || costoServicios > 0;
  const costoDirectoTotal = hasSnapshots
    ? roundMoney(costoInsumos + costoManoObra + costoServicios)
    : roundMoney((cantAnterior > 0 ? item.costoDirectoTotal / cantAnterior : item.costoDirectoTotal) * cantidadSana);

  const precioVentaTotal = roundMoney(safeNum(item.precioVentaUnitario) * cantidadSana);

  return {
    ...item,
    cantidad: cantidadSana,
    insumosSnapshot: insumosCongelados,
    manoObraSnapshot: manoObraCongelada,
    costoInsumos,
    costoManoObra,
    costoServicios,
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

// ─── Actualización de Snapshots con Catálogo Vigente ───────────────────────────

export interface ActualizacionInsumosResultado {
  updatedItems: ItemPresupuesto[];
  changesCount: number;
  oldTotalCosto: number;
  newTotalCosto: number;
}

export interface CambioPrecioMaterial {
  itemId: string;
  itemDescripcion: string;
  insumoId: string;
  nombre: string;
  unidad: string;
  cantidadTotal: number;
  precioAnterior: number;
  precioNuevo: number;
  alicuotaAnterior: number;
  alicuotaNueva: number;
  impactoNeto: number;
}

export interface CambioTarifaManoObra {
  itemId: string;
  itemDescripcion: string;
  categoriaId: string;
  nombreCategoria: string;
  horasTotales: number;
  costoHoraAnterior: number;
  costoHoraNuevo: number;
  impactoNeto: number;
}

export interface CambioTareaTipoRecalculo {
  itemId: string;
  itemDescripcion: string;
  tareaTipoId: string;
  costoDirectoAnterior: number;
  costoDirectoNuevo: number;
  impactoNeto: number;
}

export interface CambioCostoIndirecto {
  gastoId: string;
  costoIndirectoId?: string;
  nombre: string;
  modalidad?: ModalidadGasto;
  valorAnterior: number;
  valorNuevo: number;
  impactoNeto: number;
}

export interface CambioCotizacionDolar {
  valorAnterior: number;
  valorNuevo: number;
}

export interface AnalisisCambiosPreciosPresupuesto {
  materiales: {
    cambios: CambioPrecioMaterial[];
    totalImpacto: number;
    count: number;
  };
  manoObra: {
    cambios: CambioTarifaManoObra[];
    totalImpacto: number;
    count: number;
  };
  tareasTipo: {
    cambios: CambioTareaTipoRecalculo[];
    totalImpacto: number;
    count: number;
  };
  costosIndirectos: {
    cambios: CambioCostoIndirecto[];
    totalImpacto: number;
    count: number;
  };
  dolar: {
    cambio: CambioCotizacionDolar | null;
  };
  hayCambios: boolean;
  totalImpactoEstimado: number;
}

export interface OpcionesActualizacionPrecios {
  actualizarMateriales: boolean;
  actualizarManoObra: boolean;
  actualizarTareasTipo: boolean;
  actualizarCostosIndirectos: boolean;
  actualizarDolar: boolean;
}

export interface ResultadoActualizacionPreciosPresupuesto {
  updatedItems: ItemPresupuesto[];
  updatedGastosConfig: GastoPresupuestoConfig[];
  updatedCotizacionDolar: number;
  resumen: {
    materialesCount: number;
    manoObraCount: number;
    tareasTipoCount: number;
    indirectosCount: number;
    dolarActualizado: boolean;
    totalImpactoNeto: number;
  };
}

/**
 * Analiza todas las capas de costo de una cotización (materiales, mano de obra, tareas tipo, indirectos, dólar)
 * y detecta diferencias con respecto a los valores vigentes del catálogo y configuración.
 */
export function analizarCambiosPreciosPresupuesto(params: {
  items: ItemPresupuesto[];
  gastosConfig?: GastoPresupuestoConfig[];
  cotizacionDolar?: number;
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
  costosIndirectosCatalog?: CostoIndirecto[];
  tareasTipoMap?: Map<string, TareaTipo>;
  configDolarReferenciaValor?: number;
}): AnalisisCambiosPreciosPresupuesto {
  const {
    items = [],
    gastosConfig = [],
    cotizacionDolar = 0,
    insumosMap,
    manoObraMap,
    costosIndirectosCatalog = [],
    tareasTipoMap = new Map(),
    configDolarReferenciaValor
  } = params;

  const cambiosMateriales: CambioPrecioMaterial[] = [];
  const cambiosManoObra: CambioTarifaManoObra[] = [];
  const cambiosTareasTipo: CambioTareaTipoRecalculo[] = [];
  const cambiosCostosIndirectos: CambioCostoIndirecto[] = [];

  let impactoMateriales = 0;
  let impactoManoObra = 0;
  let impactoTareasTipo = 0;
  let impactoCostosIndirectos = 0;

  // 1. Analizar Materiales e Insumos en Items
  for (const item of items) {
    if (item.insumosSnapshot && item.insumosSnapshot.length > 0) {
      for (const ins of item.insumosSnapshot) {
        if (ins.esAdHoc) continue;
        const matId = ins.materialId || ins.insumoId;
        if (!matId) continue;
        const cat = insumosMap.get(matId);
        if (!cat) continue;

        const currentNetPrice = safeNum(cat.precioActual ?? cat.precioNeto ?? 0);
        const currentAlicuota = cat.alicuotaIVA !== undefined ? safeNum(cat.alicuotaIVA) : (ins.alicuotaIVA ?? 21);

        const oldNetPrice = safeNum(ins.precioUnitarioCongelado);
        const oldAlicuota = ins.alicuotaIVA !== undefined ? safeNum(ins.alicuotaIVA) : 21;

        if (Math.abs(oldNetPrice - currentNetPrice) > 0.001 || Math.abs(oldAlicuota - currentAlicuota) > 0.001) {
          const cant = safeNum(ins.cantidadTotal);
          const impacto = roundMoney((currentNetPrice - oldNetPrice) * cant);
          impactoMateriales = roundMoney(impactoMateriales + impacto);
          cambiosMateriales.push({
            itemId: item.id,
            itemDescripcion: item.descripcion,
            insumoId: matId,
            nombre: cat.nombre || ins.nombre,
            unidad: ins.unidad,
            cantidadTotal: cant,
            precioAnterior: oldNetPrice,
            precioNuevo: currentNetPrice,
            alicuotaAnterior: oldAlicuota,
            alicuotaNueva: currentAlicuota,
            impactoNeto: impacto
          });
        }
      }
    }

    // 2. Analizar Mano de Obra en Items
    if (item.manoObraSnapshot && item.manoObraSnapshot.length > 0) {
      for (const mo of item.manoObraSnapshot) {
        const catMo = manoObraMap.get(mo.categoriaId);
        if (!catMo) continue;

        const currentCostoHora = safeNum(catMo.costoHora);
        const oldCostoHora = safeNum(mo.costoHoraCongelado);

        if (Math.abs(oldCostoHora - currentCostoHora) > 0.001) {
          const hs = safeNum(mo.horasTotales);
          const impacto = roundMoney((currentCostoHora - oldCostoHora) * hs);
          impactoManoObra = roundMoney(impactoManoObra + impacto);
          cambiosManoObra.push({
            itemId: item.id,
            itemDescripcion: item.descripcion,
            categoriaId: mo.categoriaId,
            nombreCategoria: catMo.nombre || mo.nombreCategoria,
            horasTotales: hs,
            costoHoraAnterior: oldCostoHora,
            costoHoraNuevo: currentCostoHora,
            impactoNeto: impacto
          });
        }
      }
    }

    // 3. Analizar Tareas Tipo Paramétricas
    if (item.tareaTipoId && tareasTipoMap.has(item.tareaTipoId)) {
      const tareaDef = tareasTipoMap.get(item.tareaTipoId)!;
      const calculos = calcularConsumosTareaTipo(
        tareaDef,
        item.valoresParametros || {},
        insumosMap,
        manoObraMap
      );
      const cant = safeNum(item.cantidad || 1);
      const costoDirectoNuevo = roundMoney(calculos.costoDirectoTotal * cant);
      const costoDirectoAnterior = safeNum(item.costoDirectoTotal);

      if (Math.abs(costoDirectoAnterior - costoDirectoNuevo) > 0.01) {
        const impacto = roundMoney(costoDirectoNuevo - costoDirectoAnterior);
        impactoTareasTipo = roundMoney(impactoTareasTipo + impacto);
        cambiosTareasTipo.push({
          itemId: item.id,
          itemDescripcion: item.descripcion || tareaDef.nombre,
          tareaTipoId: item.tareaTipoId,
          costoDirectoAnterior,
          costoDirectoNuevo,
          impactoNeto: impacto
        });
      }
    }
  }

  // 4. Analizar Costos Indirectos de Obra
  for (const gasto of gastosConfig) {
    const ciId = gasto.costoIndirectoId || gasto.id?.replace('gasto-', '');
    if (!ciId) continue;
    const catCI = costosIndirectosCatalog.find(c => c.id === ciId);
    if (!catCI || catCI.valor === undefined) continue;

    const oldVal = safeNum(gasto.valor);
    const newVal = safeNum(catCI.valor);

    if (Math.abs(oldVal - newVal) > 0.001) {
      const impacto = roundMoney(newVal - oldVal);
      impactoCostosIndirectos = roundMoney(impactoCostosIndirectos + impacto);
      cambiosCostosIndirectos.push({
        gastoId: gasto.id,
        costoIndirectoId: ciId,
        nombre: catCI.nombre || gasto.nombre,
        modalidad: gasto.modalidad,
        valorAnterior: oldVal,
        valorNuevo: newVal,
        impactoNeto: impacto
      });
    }
  }

  // 5. Analizar Dólar
  let cambioDolar: CambioCotizacionDolar | null = null;
  if (configDolarReferenciaValor !== undefined && configDolarReferenciaValor > 0) {
    if (Math.abs(safeNum(cotizacionDolar) - configDolarReferenciaValor) > 0.01) {
      cambioDolar = {
        valorAnterior: safeNum(cotizacionDolar),
        valorNuevo: configDolarReferenciaValor
      };
    }
  }

  const hayCambios = cambiosMateriales.length > 0 ||
                     cambiosManoObra.length > 0 ||
                     cambiosTareasTipo.length > 0 ||
                     cambiosCostosIndirectos.length > 0 ||
                     cambioDolar !== null;

  const totalImpactoEstimado = roundMoney(impactoMateriales + impactoManoObra + impactoCostosIndirectos);

  return {
    materiales: {
      cambios: cambiosMateriales,
      totalImpacto: impactoMateriales,
      count: cambiosMateriales.length
    },
    manoObra: {
      cambios: cambiosManoObra,
      totalImpacto: impactoManoObra,
      count: cambiosManoObra.length
    },
    tareasTipo: {
      cambios: cambiosTareasTipo,
      totalImpacto: impactoTareasTipo,
      count: cambiosTareasTipo.length
    },
    costosIndirectos: {
      cambios: cambiosCostosIndirectos,
      totalImpacto: impactoCostosIndirectos,
      count: cambiosCostosIndirectos.length
    },
    dolar: {
      cambio: cambioDolar
    },
    hayCambios,
    totalImpactoEstimado
  };
}

/**
 * Aplica la actualización de precios a las capas seleccionadas de la cotización.
 */
export function aplicarActualizacionPreciosPresupuesto(params: {
  items: ItemPresupuesto[];
  gastosConfig?: GastoPresupuestoConfig[];
  cotizacionDolar?: number;
  opciones: OpcionesActualizacionPrecios;
  insumosMap: Map<string, Insumo>;
  manoObraMap: Map<string, CategoriaManoDeObra>;
  costosIndirectosCatalog?: CostoIndirecto[];
  tareasTipoMap?: Map<string, TareaTipo>;
  configDolarReferenciaValor?: number;
}): ResultadoActualizacionPreciosPresupuesto {
  const {
    items = [],
    gastosConfig = [],
    cotizacionDolar = 0,
    opciones,
    insumosMap,
    manoObraMap,
    costosIndirectosCatalog = [],
    tareasTipoMap = new Map(),
    configDolarReferenciaValor
  } = params;

  let materialesCount = 0;
  let manoObraCount = 0;
  let tareasTipoCount = 0;
  let indirectosCount = 0;
  let dolarActualizado = false;
  let totalImpactoNeto = 0;

  const updatedItems: ItemPresupuesto[] = items.map(item => {
    // Si la opción de Tareas Tipo está activa y el ítem es una Tarea Tipo existente:
    if (opciones.actualizarTareasTipo && item.tareaTipoId && tareasTipoMap.has(item.tareaTipoId)) {
      const tareaDef = tareasTipoMap.get(item.tareaTipoId)!;
      const calculos = calcularConsumosTareaTipo(
        tareaDef,
        item.valoresParametros || {},
        insumosMap,
        manoObraMap
      );
      const cant = safeNum(item.cantidad || 1);
      const oldCostoDirecto = safeNum(item.costoDirectoTotal);
      const newCostoDirecto = roundMoney(calculos.costoDirectoTotal * cant);

      if (Math.abs(oldCostoDirecto - newCostoDirecto) > 0.01) {
        tareasTipoCount++;
        totalImpactoNeto = roundMoney(totalImpactoNeto + (newCostoDirecto - oldCostoDirecto));
      }

      const newInsumos = calculos.insumosSnapshot.map(i => {
        const uCant = i.cantidadUnitaria !== undefined ? i.cantidadUnitaria : i.cantidadTotal;
        return {
          ...i,
          cantidadUnitaria: uCant,
          cantidadTotal: roundMoney(uCant * cant),
          subtotalInsumo: roundMoney(i.precioUnitarioCongelado * uCant * cant),
          subtotalInsumoFinal: roundMoney((i.precioFinalUnitarioCongelado || i.precioUnitarioCongelado) * uCant * cant)
        };
      });

      const newMO = calculos.manoObraSnapshot.map(m => {
        const uHs = m.horasUnitarias !== undefined ? m.horasUnitarias : m.horasTotales;
        return {
          ...m,
          horasUnitarias: uHs,
          horasTotales: roundMoney(uHs * cant),
          subtotalManoObra: roundMoney(m.costoHoraCongelado * uHs * cant)
        };
      });

      const costoInsumos = roundMoney(calculos.costoInsumosTotal * cant);
      const costoManoObra = roundMoney(calculos.costoManoObraTotal * cant);
      const costoServicios = roundMoney((calculos.costoServiciosTotal || tareaDef.costoServicioDirecto || tareaDef.honorarioBase || 0) * cant);
      const costoFijoOperativo = roundMoney((calculos.costoFijoOperativo || 0) * cant);
      const costoDirectoTotal = roundMoney(costoInsumos + costoManoObra + costoServicios + costoFijoOperativo);

      return {
        ...item,
        costoUnitario: calculos.costoDirectoTotal,
        costoInsumos,
        costoManoObra,
        costoServicios,
        costoFijoOperativo,
        costoDirectoTotal,
        costoTotal: costoDirectoTotal,
        insumosSnapshot: newInsumos,
        manoObraSnapshot: newMO
      };
    }

    // Actualización granular de Materiales e Insumos
    let newInsumosSnapshot = item.insumosSnapshot || [];
    let costoInsumos = safeNum(item.costoInsumos);

    if (opciones.actualizarMateriales && newInsumosSnapshot.length > 0) {
      let newItemInsumosCosto = 0;
      newInsumosSnapshot = newInsumosSnapshot.map(ins => {
        if (ins.esAdHoc) {
          newItemInsumosCosto += safeNum(ins.subtotalInsumo);
          return ins;
        }

        const matId = ins.materialId || ins.insumoId;
        const catalogInsumo = matId ? insumosMap.get(matId) : undefined;
        if (!catalogInsumo) {
          newItemInsumosCosto += safeNum(ins.subtotalInsumo);
          return ins;
        }

        const currentNetPrice = safeNum(catalogInsumo.precioActual ?? catalogInsumo.precioNeto ?? 0);
        const currentAlicuota = catalogInsumo.alicuotaIVA !== undefined ? safeNum(catalogInsumo.alicuotaIVA) : (ins.alicuotaIVA ?? 21);
        const currentFinalPrice = catalogInsumo.precioFinal !== undefined ? safeNum(catalogInsumo.precioFinal) : calcularPrecioFinal(currentNetPrice, currentAlicuota);

        const isChanged = Math.abs(safeNum(ins.precioUnitarioCongelado) - currentNetPrice) > 0.001 ||
                          Math.abs(safeNum(ins.alicuotaIVA ?? 21) - currentAlicuota) > 0.001;

        if (isChanged) {
          materialesCount++;
          const cant = safeNum(ins.cantidadTotal);
          totalImpactoNeto = roundMoney(totalImpactoNeto + (currentNetPrice - safeNum(ins.precioUnitarioCongelado)) * cant);
        }

        const updatedSubtotalNeto = roundMoney(currentNetPrice * safeNum(ins.cantidadTotal));
        const updatedSubtotalFinal = roundMoney(currentFinalPrice * safeNum(ins.cantidadTotal));
        newItemInsumosCosto += updatedSubtotalNeto;

        return {
          ...ins,
          nombre: catalogInsumo.nombre || ins.nombre,
          precioUnitarioCongelado: currentNetPrice,
          alicuotaIVA: currentAlicuota,
          precioFinalUnitarioCongelado: currentFinalPrice,
          subtotalInsumo: updatedSubtotalNeto,
          subtotalInsumoFinal: updatedSubtotalFinal
        };
      });
      costoInsumos = roundMoney(newItemInsumosCosto);
    }

    // Actualización granular de Mano de Obra
    let newManoObraSnapshot = item.manoObraSnapshot || [];
    let costoManoObra = safeNum(item.costoManoObra);

    if (opciones.actualizarManoObra && newManoObraSnapshot.length > 0) {
      let newItemMOCosto = 0;
      newManoObraSnapshot = newManoObraSnapshot.map(mo => {
        const catalogMo = manoObraMap.get(mo.categoriaId);
        if (!catalogMo) {
          newItemMOCosto += safeNum(mo.subtotalManoObra);
          return mo;
        }

        const currentCostoHora = safeNum(catalogMo.costoHora);
        const isChanged = Math.abs(safeNum(mo.costoHoraCongelado) - currentCostoHora) > 0.001;

        if (isChanged) {
          manoObraCount++;
          const hs = safeNum(mo.horasTotales);
          totalImpactoNeto = roundMoney(totalImpactoNeto + (currentCostoHora - safeNum(mo.costoHoraCongelado)) * hs);
        }

        const updatedSubtotal = roundMoney(currentCostoHora * safeNum(mo.horasTotales));
        newItemMOCosto += updatedSubtotal;

        return {
          ...mo,
          nombreCategoria: catalogMo.nombre || mo.nombreCategoria,
          costoHoraCongelado: currentCostoHora,
          subtotalManoObra: updatedSubtotal
        };
      });
      costoManoObra = roundMoney(newItemMOCosto);
    }

    const costoServicios = safeNum(item.costoServicios ?? item.costoServiciosTercerizados);
    const costoFijoOperativo = safeNum(item.costoFijoOperativo);
    const costoDirectoTotal = roundMoney(costoInsumos + costoManoObra + costoServicios + costoFijoOperativo);
    const cant = Math.max(0.0001, item.cantidad || 1);

    return {
      ...item,
      costoInsumos,
      costoManoObra,
      costoDirectoTotal,
      costoTotal: costoDirectoTotal,
      costoUnitario: roundMoney(costoDirectoTotal / cant),
      insumosSnapshot: newInsumosSnapshot,
      manoObraSnapshot: newManoObraSnapshot
    };
  });

  // Actualizar Costos Indirectos
  let updatedGastosConfig = gastosConfig;
  if (opciones.actualizarCostosIndirectos && gastosConfig.length > 0) {
    updatedGastosConfig = gastosConfig.map(gasto => {
      const ciId = gasto.costoIndirectoId || gasto.id?.replace('gasto-', '');
      if (!ciId) return gasto;
      const catCI = costosIndirectosCatalog.find(c => c.id === ciId);
      if (!catCI || catCI.valor === undefined) return gasto;

      const isChanged = Math.abs(safeNum(gasto.valor) - safeNum(catCI.valor)) > 0.001;
      if (isChanged) {
        indirectosCount++;
        totalImpactoNeto = roundMoney(totalImpactoNeto + (safeNum(catCI.valor) - safeNum(gasto.valor)));
      }

      return {
        ...gasto,
        valor: safeNum(catCI.valor),
        formula: catCI.formula || gasto.formula
      };
    });
  }

  // Actualizar Dólar
  let updatedCotizacionDolar = cotizacionDolar;
  if (opciones.actualizarDolar && configDolarReferenciaValor !== undefined && configDolarReferenciaValor > 0) {
    if (Math.abs(safeNum(cotizacionDolar) - configDolarReferenciaValor) > 0.01) {
      updatedCotizacionDolar = configDolarReferenciaValor;
      dolarActualizado = true;
    }
  }

  return {
    updatedItems,
    updatedGastosConfig,
    updatedCotizacionDolar,
    resumen: {
      materialesCount,
      manoObraCount,
      tareasTipoCount,
      indirectosCount,
      dolarActualizado,
      totalImpactoNeto
    }
  };
}

/**
 * Actualiza los snapshots de insumos congelados de un presupuesto con los precios vigentes del catálogo.
 * Preserva intactas las cantidades, unidades, fórmulas, notas y estructura de capítulos.
 */
export function actualizarSnapshotsInsumosConCatalogo(
  items: ItemPresupuesto[],
  insumosMap: Map<string, Insumo>
): ActualizacionInsumosResultado {
  let changesCount = 0;
  let oldTotalCosto = 0;
  let newTotalCosto = 0;

  const updatedItems: ItemPresupuesto[] = items.map(item => {
    let newItemInsumosCosto = 0;

    const newInsumosSnapshot: InsumoSnapshot[] = (item.insumosSnapshot || []).map(ins => {
      oldTotalCosto += safeNum(ins.subtotalInsumo);

      if (ins.esAdHoc) {
        newItemInsumosCosto += safeNum(ins.subtotalInsumo);
        newTotalCosto += safeNum(ins.subtotalInsumo);
        return ins;
      }

      const matId = ins.materialId || ins.insumoId;
      const catalogInsumo = matId ? insumosMap.get(matId) : undefined;

      if (!catalogInsumo) {
        newItemInsumosCosto += safeNum(ins.subtotalInsumo);
        newTotalCosto += safeNum(ins.subtotalInsumo);
        return ins;
      }

      const currentNetPrice = safeNum(catalogInsumo.precioActual ?? catalogInsumo.precioNeto ?? 0);
      const currentAlicuota = catalogInsumo.alicuotaIVA !== undefined ? safeNum(catalogInsumo.alicuotaIVA) : (ins.alicuotaIVA ?? 21);
      const currentFinalPrice = catalogInsumo.precioFinal !== undefined ? safeNum(catalogInsumo.precioFinal) : calcularPrecioFinal(currentNetPrice, currentAlicuota);

      const isChanged = Math.abs(safeNum(ins.precioUnitarioCongelado) - currentNetPrice) > 0.001 ||
                        Math.abs(safeNum(ins.alicuotaIVA ?? 21) - currentAlicuota) > 0.001;

      if (isChanged) {
        changesCount++;
      }

      const updatedSubtotalNeto = roundMoney(currentNetPrice * safeNum(ins.cantidadTotal));
      const updatedSubtotalFinal = roundMoney(currentFinalPrice * safeNum(ins.cantidadTotal));

      newItemInsumosCosto += updatedSubtotalNeto;
      newTotalCosto += updatedSubtotalNeto;

      return {
        ...ins,
        nombre: catalogInsumo.nombre || ins.nombre,
        precioUnitarioCongelado: currentNetPrice,
        alicuotaIVA: currentAlicuota,
        precioFinalUnitarioCongelado: currentFinalPrice,
        subtotalInsumo: updatedSubtotalNeto,
        subtotalInsumoFinal: updatedSubtotalFinal
      };
    });

    const costoInsumos = roundMoney(newItemInsumosCosto);
    const costoManoObra = safeNum(item.costoManoObra);
    const costoServicios = safeNum(item.costoServicios ?? item.costoServiciosTercerizados);
    const costoDirectoTotal = roundMoney(costoInsumos + costoManoObra + costoServicios);

    return {
      ...item,
      insumosSnapshot: newInsumosSnapshot,
      costoInsumos,
      costoDirectoTotal,
      costoTotal: costoDirectoTotal
    };
  });

  return {
    updatedItems,
    changesCount,
    oldTotalCosto: roundMoney(oldTotalCosto),
    newTotalCosto: roundMoney(newTotalCosto)
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

export interface GastoDesglosadoResultado {
  id: string;
  nombre: string;
  destino: DestinoGasto;
  modalidad: ModalidadGasto;
  valor: number;
  formula?: string;
  parametros?: ParametroTrabajoTipo[];
  valoresParametros?: Record<string, number>;
  capituloId?: string;
  baseImponible: number;
  montoCalculado: number;
  aplica: boolean;
}

export interface CapituloTotalResultado {
  id: string;
  nombre: string;
  costoInsumos: number;
  costoManoObra: number;
  costoServicios: number;
  gastosDirectos: number;
  costoDirectoTotal: number;
  precioVentaTotal: number;
  itemsCount: number;
}

export interface TotalesPresupuestoResultado {
  // ─── Modelo Estricto: C → GG → B → S → Impuestos → Precio Final & K ───
  costoGlobal: number; // Costo (C) = suma de insumos + mano de obra + servicios tercerizados (incluyendo gastos directos)
  gastosGeneralesTotal: number; // GG total = Σ(GG fijos) + Σ(GG% × C)
  beneficioPorcentaje: number; // % beneficio calculado sobre (C + GG)
  beneficioMonto: number; // B = %beneficio × (C + GG)
  subtotalSinImpuestos: number; // Subtotal (S) = C + GG + B
  impuestosCalculados: ImpuestoItem[]; // Impuestos independientes calculados sobre S
  impuestosPorcentajeTotal: number;
  montoImpuestosTotal: number; // Σ(impuesto_i% × S)
  precioFinalGlobal: number; // Precio Final = S + Impuestos total
  coeficienteK: number; // K = Precio Final Global / Costo Global
  itemsCalculados: ItemPresupuesto[]; // Ítems con su costo y precio de venta unitario/total asignado (Costo × K)

  // ─── Desglose Detallado de Rubros Directos & Gastos ───
  subtotalInsumosBase: number;
  gastosMaterialesTotal: number;
  subtotalInsumos: number; // Insumos Base + Gastos directos de materiales
  subtotalInsumosTotal: number;

  subtotalManoObraTeorica: number; // Base antes de sinergia
  subtotalManoObraBase: number; // Base con sinergia
  ahorroSinergiaManoObra: number; // Descuento por sinergia de obra
  gastosManoObraTotal: number; // Cargas sociales, ART, EPP, etc.
  subtotalManoObra: number; // MO Base + Gastos directos de MO
  subtotalManoObraTotal: number;

  subtotalServiciosBase: number;
  gastosServiciosTotal: number;
  subtotalServiciosTercerizados: number; // Servicios Base + Gastos directos de servicios
  subtotalServiciosTotal: number;

  subtotalCostosDirectos: number; // Alias de C
  subtotalCostosIndirectos: number; // Alias de GG
  costosIndirectosAplicados: CostoIndirectoSnapshot[];
  gastosDesglosados: GastoDesglosadoResultado[];
  capitulosTotales: Record<string, CapituloTotalResultado>;

  // ─── Margen de Riesgo Global sobre Costo Directo ───
  costoDirectoBase?: number; // C base antes de riesgo
  margenRiesgoPorcentaje?: number; // % aplicado (ej: 20%)
  montoMargenRiesgo?: number; // Monto en ARS

  costoTotalObra: number; // C + GG
  montoGanancia: number; // Alias de B
  precioVentaSinImpuestos: number; // Alias de S
  totalARS: number; // Alias de Precio Final
  totalMonedaExtranjera?: number;
}

/**
 * Calcula los totales completos de un presupuesto siguiendo el orden de dependencia estricto:
 * 1. Costo Directo (C) = Total Materiales (Base + Gastos Mat) + Total MO (Base + Gastos MO) + Total Servicios (Base + Gastos Serv)
 *    + Margen de Riesgo Global (Contingencia / Imprevistos sobre Costo Directo)
 * 2. Costos Indirectos (GG) = Σ(GG fijos) + Σ(GG% × C)
 * 3. Beneficio (B) = %beneficio × (C + GG)
 * 4. Subtotal (S) = C + GG + B
 * 5. Impuestos = Σ(impuesto_i% × S) (sin cascada entre ellos)
 * 6. Precio Final = S + Impuestos total
 * 7. Coeficiente de Venta K = Precio Final / Costo Global
 * 8. Precios de Venta por renglón = Costo de ítem × K
 */
export function calcularTotalesPresupuesto(params: {
  items: ItemPresupuesto[];
  capitulos?: CapituloPresupuesto[];
  costosIndirectosCatalog?: CostoIndirecto[];
  costosIndirectosConfig?: CostoIndirectoItemConfig[];
  gastosConfig?: GastoPresupuestoConfig[];
  margenPorcentaje?: number;
  beneficioPorcentaje?: number;
  margenRiesgoPorcentaje?: number;
  impuestosDetalle: ImpuestoItem[];
  tipoFactura?: TipoFactura;
  cotizacionMonedaExtranjera?: number;
  factorSinergiaManoObra?: number;
}): TotalesPresupuestoResultado {
  const {
    items = [],
    capitulos = [],
    costosIndirectosCatalog = [],
    costosIndirectosConfig,
    gastosConfig,
    margenPorcentaje,
    beneficioPorcentaje: beneficioInput,
    margenRiesgoPorcentaje: margenRiesgoInput,
    impuestosDetalle = [],
    tipoFactura,
    cotizacionMonedaExtranjera,
    factorSinergiaManoObra
  } = params;

  const isFacturaC_or_X = tipoFactura === 'Factura C' || tipoFactura === 'Presupuesto X (Sin Factura)';
  const sinergiaFactor = factorSinergiaManoObra !== undefined && factorSinergiaManoObra > 0 && factorSinergiaManoObra <= 1.0
    ? safeNum(factorSinergiaManoObra)
    : 1.0;

  // 1. Costos Directos Base (Insumos, MO, Servicios)
  let subtotalInsumosBase = 0;
  let subtotalManoObraTeorica = 0;
  let subtotalManoObraBase = 0;
  let subtotalServiciosBase = 0;

  // Mapas por capítulo para distribución precisa
  const chapterBases: Record<string, { insumos: number; mo: number; moTeorica: number; servicios: number; itemsCount: number }> = {};

  for (const item of items) {
    const capId = item.capituloId || 'sin_capitulo';
    if (!chapterBases[capId]) {
      chapterBases[capId] = { insumos: 0, mo: 0, moTeorica: 0, servicios: 0, itemsCount: 0 };
    }
    chapterBases[capId].itemsCount++;

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

    const cManoObraTeorica = safeNum(item.costoManoObra);
    const cManoObra = roundMoney(cManoObraTeorica * sinergiaFactor);

    let cServicios = 0;
    if (item.serviciosTercerizados && item.serviciosTercerizados.length > 0) {
      cServicios = roundMoney(
        item.serviciosTercerizados.reduce((acc, s) => acc + safeNum(s.costo), 0)
      );
    } else if (item.costoServicios !== undefined && item.costoServicios > 0) {
      cServicios = safeNum(item.costoServicios);
    } else {
      cServicios = safeNum(item.costoServiciosTercerizados);
    }

    subtotalInsumosBase = roundMoney(subtotalInsumosBase + cInsumos);
    subtotalManoObraTeorica = roundMoney(subtotalManoObraTeorica + cManoObraTeorica);
    subtotalManoObraBase = roundMoney(subtotalManoObraBase + cManoObra);
    subtotalServiciosBase = roundMoney(subtotalServiciosBase + cServicios);

    chapterBases[capId].insumos = roundMoney(chapterBases[capId].insumos + cInsumos);
    chapterBases[capId].moTeorica = roundMoney(chapterBases[capId].moTeorica + cManoObraTeorica);
    chapterBases[capId].mo = roundMoney(chapterBases[capId].mo + cManoObra);
    chapterBases[capId].servicios = roundMoney(chapterBases[capId].servicios + cServicios);
  }

  const ahorroSinergiaManoObra = roundMoney(Math.max(0, subtotalManoObraTeorica - subtotalManoObraBase));

  // 2. Liquidación de Gastos Directos e Indirectos
  // Normalizar la lista de configuración de gastos
  const activeGastosConfig: GastoPresupuestoConfig[] = (gastosConfig && gastosConfig.length > 0)
    ? gastosConfig
    : (costosIndirectosConfig && costosIndirectosConfig.length > 0)
      ? costosIndirectosConfig
      : costosIndirectosCatalog
          .filter(c => c.incluirPorDefecto !== false)
          .map(c => ({
            id: c.id,
            nombre: c.nombre,
            destino: 'costo_indirecto' as DestinoGasto,
            modalidad: (c.tipo === 'porcentual_sobre_costo' ? 'porcentual' : 'monto_fijo') as ModalidadGasto,
            valor: c.valor,
            aplica: true
          }));

  let gastosMaterialesTotal = 0;
  let gastosMaterialesGlobales = 0;
  const chapterGastosMateriales: Record<string, number> = {};

  let gastosManoObraTotal = 0;
  let gastosManoObraGlobales = 0;
  const chapterGastosManoObra: Record<string, number> = {};

  let gastosServiciosTotal = 0;
  let gastosServiciosGlobales = 0;
  const chapterGastosServicios: Record<string, number> = {};

  let totalIndirectosAbsolutos = 0;
  let porcentajeIndirectosPct = 0;

  const gastosDesglosados: GastoDesglosadoResultado[] = [];
  const costosIndirectosAplicados: CostoIndirectoSnapshot[] = [];
  const chapterGastosDirectos: Record<string, number> = {};

  // Scope base para fórmulas paramétricas
  const formulaScopeBase = {
    materiales: subtotalInsumosBase,
    mano_obra: subtotalManoObraBase,
    servicios: subtotalServiciosBase,
    costo_directo_base: roundMoney(subtotalInsumosBase + subtotalManoObraBase + subtotalServiciosBase)
  };

  for (const g of activeGastosConfig) {
    if (!g.aplica) continue;

    const destino: DestinoGasto = g.destino || 'costo_indirecto';
    const modalidad: ModalidadGasto = g.modalidad || (
      g.tipo === 'porcentual_sobre_costo' ? 'porcentual' : 'monto_fijo'
    );
    const val = safeNum(g.valor);
    const capId = g.capituloId;

    // Determinar la base imponible correspondiente
    let baseImponible = 0;
    if (capId && chapterBases[capId]) {
      if (destino === 'materiales') baseImponible = chapterBases[capId].insumos;
      else if (destino === 'mano_obra') baseImponible = chapterBases[capId].mo;
      else if (destino === 'servicios') baseImponible = chapterBases[capId].servicios;
      else baseImponible = roundMoney(chapterBases[capId].insumos + chapterBases[capId].mo + chapterBases[capId].servicios);
    } else {
      if (destino === 'materiales') baseImponible = subtotalInsumosBase;
      else if (destino === 'mano_obra') baseImponible = subtotalManoObraBase;
      else if (destino === 'servicios') baseImponible = subtotalServiciosBase;
      else baseImponible = formulaScopeBase.costo_directo_base;
    }

    let montoCalculado = 0;
    const paramScope: Record<string, number> = {};

    if (g.parametros && g.parametros.length > 0) {
      g.parametros.forEach((p) => {
        let isVisible = true;
        if (p.condicion && p.condicion.trim()) {
          isVisible = evaluateCondition(p.condicion, { ...formulaScopeBase, ...paramScope });
        }
        const rawVal = g.valoresParametros?.[p.id] !== undefined
          ? safeNum(g.valoresParametros[p.id])
          : p.valorDefault;
        paramScope[p.id] = isVisible ? rawVal : 0;
      });
    } else if (g.valoresParametros) {
      Object.entries(g.valoresParametros).forEach(([k, v]) => {
        paramScope[k] = safeNum(v);
      });
    }

    if (modalidad === 'porcentual') {
      montoCalculado = roundMoney(baseImponible * (val / 100));
    } else if (modalidad === 'monto_fijo') {
      montoCalculado = roundMoney(val);
    } else if (modalidad === 'parametrico' && g.formula) {
      try {
        const evalRes = evaluateMathExpression(g.formula, {
          ...formulaScopeBase,
          ...paramScope,
          base: baseImponible,
          materiales: capId && chapterBases[capId] ? chapterBases[capId].insumos : subtotalInsumosBase,
          mano_obra: capId && chapterBases[capId] ? chapterBases[capId].mo : subtotalManoObraBase,
          servicios: capId && chapterBases[capId] ? chapterBases[capId].servicios : subtotalServiciosBase
        });
        montoCalculado = roundMoney(Math.max(0, evalRes.value ?? 0));
      } catch {
        montoCalculado = 0;
      }
    }

    // Acumular según destino
    if (destino === 'materiales') {
      gastosMaterialesTotal = roundMoney(gastosMaterialesTotal + montoCalculado);
      if (capId) {
        chapterGastosMateriales[capId] = roundMoney((chapterGastosMateriales[capId] || 0) + montoCalculado);
        chapterGastosDirectos[capId] = roundMoney((chapterGastosDirectos[capId] || 0) + montoCalculado);
      } else {
        gastosMaterialesGlobales = roundMoney(gastosMaterialesGlobales + montoCalculado);
      }
    } else if (destino === 'mano_obra') {
      gastosManoObraTotal = roundMoney(gastosManoObraTotal + montoCalculado);
      if (capId) {
        chapterGastosManoObra[capId] = roundMoney((chapterGastosManoObra[capId] || 0) + montoCalculado);
        chapterGastosDirectos[capId] = roundMoney((chapterGastosDirectos[capId] || 0) + montoCalculado);
      } else {
        gastosManoObraGlobales = roundMoney(gastosManoObraGlobales + montoCalculado);
      }
    } else if (destino === 'servicios') {
      gastosServiciosTotal = roundMoney(gastosServiciosTotal + montoCalculado);
      if (capId) {
        chapterGastosServicios[capId] = roundMoney((chapterGastosServicios[capId] || 0) + montoCalculado);
        chapterGastosDirectos[capId] = roundMoney((chapterGastosDirectos[capId] || 0) + montoCalculado);
      } else {
        gastosServiciosGlobales = roundMoney(gastosServiciosGlobales + montoCalculado);
      }
    } else {
      // Costo Indirecto
      if (modalidad === 'porcentual') {
        porcentajeIndirectosPct += val;
      } else {
        totalIndirectosAbsolutos = roundMoney(totalIndirectosAbsolutos + montoCalculado);
      }
      costosIndirectosAplicados.push({
        costoIndirectoId: g.id,
        nombre: g.nombre,
        tipo: g.tipo || (modalidad === 'porcentual' ? 'porcentual_sobre_costo' : 'fijo_mensual'),
        valorAplicado: val,
        montoCalculado
      });
    }

    gastosDesglosados.push({
      id: g.id,
      nombre: g.nombre,
      destino,
      modalidad,
      valor: val,
      formula: g.formula,
      parametros: g.parametros,
      valoresParametros: Object.keys(paramScope).length > 0 ? paramScope : undefined,
      capituloId: g.capituloId,
      baseImponible,
      montoCalculado,
      aplica: true
    });
  }

  // 3. Totales Directos Consolidados
  const subtotalInsumosTotal = roundMoney(subtotalInsumosBase + gastosMaterialesTotal);
  const subtotalManoObraTotal = roundMoney(subtotalManoObraBase + gastosManoObraTotal);
  const subtotalServiciosTotal = roundMoney(subtotalServiciosBase + gastosServiciosTotal);
  const costoDirectoBase = roundMoney(subtotalInsumosTotal + subtotalManoObraTotal + subtotalServiciosTotal);

  // Margen de Riesgo Global sobre Costos Directos (Contingencia / Imprevistos)
  const margenRiesgoPct = safeNum(margenRiesgoInput);
  const montoMargenRiesgo = margenRiesgoPct > 0 ? roundMoney(costoDirectoBase * (margenRiesgoPct / 100)) : 0;
  const costoGlobal = roundMoney(costoDirectoBase + montoMargenRiesgo);

  // 4. Costos Indirectos Globales (GG)
  const baseIndirectos = roundMoney(costoGlobal + totalIndirectosAbsolutos);
  const indirectosPorcentuales = roundMoney(baseIndirectos * (porcentajeIndirectosPct / 100));
  const gastosGeneralesTotal = roundMoney(totalIndirectosAbsolutos + indirectosPorcentuales);

  // Actualizar monto calculado en costosIndirectosAplicados con la base APU real
  costosIndirectosAplicados.forEach(c => {
    if (c.tipo === 'porcentual_sobre_costo') {
      c.montoCalculado = roundMoney(baseIndirectos * (c.valorAplicado / 100));
    }
  });

  // 5. Beneficio (B) = %beneficio × (C + GG)
  const beneficioPct = safeNum(beneficioInput !== undefined ? beneficioInput : margenPorcentaje);
  const baseCostoMasGG = roundMoney(costoGlobal + gastosGeneralesTotal);
  const beneficioMonto = roundMoney(baseCostoMasGG * (beneficioPct / 100));

  // 6. Subtotal Sin Impuestos (S) = C + GG + B
  const subtotalSinImpuestos = roundMoney(costoGlobal + gastosGeneralesTotal + beneficioMonto);

  // 7. Impuestos: calculados sobre Subtotal (S)
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

  // 8. Precio Final Global = S + Impuestos
  const precioFinalGlobal = roundMoney(subtotalSinImpuestos + montoImpuestosTotal);

  // 9. Coeficiente de Venta Global (K = Precio Final / Costo Global)
  const coeficienteK = costoGlobal > 0 ? roundMoney4(precioFinalGlobal / costoGlobal) : 1;

  // 10. APU y Precios de Venta por Ítem (Costo Directo del Ítem × K)
  let sumaGGAbsProrrateado = 0;
  let sumaSubtotalesItems = 0;
  let sumaPreciosFinalesItems = 0;

  const itemsCalculados: ItemPresupuesto[] = items.map((item, idx) => {
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

    const cManoObra = roundMoney(safeNum(item.costoManoObra) * sinergiaFactor);
    let cServicios = 0;
    if (item.serviciosTercerizados && item.serviciosTercerizados.length > 0) {
      cServicios = roundMoney(item.serviciosTercerizados.reduce((acc, s) => acc + safeNum(s.costo), 0));
    } else if (item.costoServicios !== undefined && item.costoServicios > 0) {
      cServicios = safeNum(item.costoServicios);
    } else {
      cServicios = safeNum(item.costoServiciosTercerizados);
    }

    // Prorrateo de gastos directos: combinación de gastos globales y gastos específicos del capítulo
    const capId = item.capituloId || 'sin_capitulo';
    const capInsumosBase = (chapterBases[capId] && chapterBases[capId].insumos > 0) ? chapterBases[capId].insumos : 0;
    const capMoBase = (chapterBases[capId] && chapterBases[capId].mo > 0) ? chapterBases[capId].mo : 0;
    const capServBase = (chapterBases[capId] && chapterBases[capId].servicios > 0) ? chapterBases[capId].servicios : 0;

    const matGlobalInc = subtotalInsumosBase > 0 ? cInsumos / subtotalInsumosBase : 0;
    const moGlobalInc = subtotalManoObraBase > 0 ? cManoObra / subtotalManoObraBase : 0;
    const servGlobalInc = subtotalServiciosBase > 0 ? cServicios / subtotalServiciosBase : 0;

    const matCapInc = capInsumosBase > 0 ? cInsumos / capInsumosBase : 0;
    const moCapInc = capMoBase > 0 ? cManoObra / capMoBase : 0;
    const servCapInc = capServBase > 0 ? cServicios / capServBase : 0;

    const gMatGlobalItem = roundMoney(gastosMaterialesGlobales * matGlobalInc);
    const gMatCapItem = roundMoney((chapterGastosMateriales[capId] || 0) * matCapInc);
    const gMatItem = roundMoney(gMatGlobalItem + gMatCapItem);

    const gMoGlobalItem = roundMoney(gastosManoObraGlobales * moGlobalInc);
    const gMoCapItem = roundMoney((chapterGastosManoObra[capId] || 0) * moCapInc);
    const gMoItem = roundMoney(gMoGlobalItem + gMoCapItem);

    const gServGlobalItem = roundMoney(gastosServiciosGlobales * servGlobalInc);
    const gServCapItem = roundMoney((chapterGastosServicios[capId] || 0) * servCapInc);
    const gServItem = roundMoney(gServGlobalItem + gServCapItem);

    const costoDirectoItem = roundMoney(cInsumos + gMatItem + cManoObra + gMoItem + cServicios + gServItem);
    const cant = safeNum(item.cantidad) > 0 ? safeNum(item.cantidad) : 1;

    // APU Cascade
    const incidencia = costoGlobal > 0 ? roundMoney4(costoDirectoItem / costoGlobal) : (items.length > 0 ? roundMoney4(1 / items.length) : 0);

    let ggAbsolutoProrrateado = roundMoney(totalIndirectosAbsolutos * incidencia);
    if (idx === items.length - 1 && items.length > 1) {
      ggAbsolutoProrrateado = roundMoney(totalIndirectosAbsolutos - sumaGGAbsProrrateado);
    }
    sumaGGAbsProrrateado = roundMoney(sumaGGAbsProrrateado + ggAbsolutoProrrateado);

    const baseCostoItem = roundMoney(costoDirectoItem + ggAbsolutoProrrateado);
    const ggPorcentualItem = roundMoney(baseCostoItem * (porcentajeIndirectosPct / 100));
    const beneficioItem = roundMoney((baseCostoItem + ggPorcentualItem) * (beneficioPct / 100));

    let subtotalItem = roundMoney(baseCostoItem + ggPorcentualItem + beneficioItem);
    if (idx === items.length - 1 && items.length > 1) {
      subtotalItem = roundMoney(subtotalSinImpuestos - sumaSubtotalesItems);
    }
    sumaSubtotalesItems = roundMoney(sumaSubtotalesItems + subtotalItem);

    const impuestosItem = roundMoney(subtotalItem * (impuestosPorcentajeTotal / 100));

    let precioFinalItem = roundMoney(subtotalItem + impuestosItem);
    if (idx === items.length - 1 && items.length > 1) {
      precioFinalItem = roundMoney(precioFinalGlobal - sumaPreciosFinalesItems);
    }
    sumaPreciosFinalesItems = roundMoney(sumaPreciosFinalesItems + precioFinalItem);

    const precioVentaTotal = precioFinalItem;
    const precioVentaUnitario = roundMoney(precioVentaTotal / cant);

    return {
      ...item,
      costoInsumos: cInsumos,
      costoManoObra: cManoObra,
      costoServiciosTercerizados: cServicios,
      costoDirectoTotal: costoDirectoItem,
      costoTotal: costoDirectoItem,
      incidencia,
      ggAbsolutoProrrateado,
      baseCostoItem,
      ggPorcentualItem,
      costoTotalItem: roundMoney(baseCostoItem + ggPorcentualItem),
      beneficioItem,
      subtotalItem,
      impuestosItem,
      precioFinalItem,
      precioVentaClienteTotal: precioVentaTotal,
      precioVentaUnitario,
      precioVentaTotal
    };
  });

  // 11. Totales por Capítulo
  const capitulosTotales: Record<string, CapituloTotalResultado> = {};
  const allCapitulos = [
    ...(capitulos || []),
    { id: 'sin_capitulo', nombre: 'Partidas Generales' }
  ];

  for (const cap of allCapitulos) {
    const base = chapterBases[cap.id] || { insumos: 0, mo: 0, moTeorica: 0, servicios: 0, itemsCount: 0 };
    const gDirectos = chapterGastosDirectos[cap.id] || 0;
    const cDirecto = roundMoney(base.insumos + base.mo + base.servicios + gDirectos);
    const pVenta = roundMoney(cDirecto * (coeficienteK || 1));

    capitulosTotales[cap.id] = {
      id: cap.id,
      nombre: cap.nombre,
      costoInsumos: base.insumos,
      costoManoObra: base.mo,
      costoServicios: base.servicios,
      gastosDirectos: gDirectos,
      costoDirectoTotal: cDirecto,
      precioVentaTotal: pVenta,
      itemsCount: base.itemsCount
    };
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

    subtotalInsumosBase,
    gastosMaterialesTotal,
    subtotalInsumos: subtotalInsumosTotal,
    subtotalInsumosTotal,

    subtotalManoObraTeorica,
    subtotalManoObraBase,
    ahorroSinergiaManoObra,
    gastosManoObraTotal,
    subtotalManoObra: subtotalManoObraTotal,
    subtotalManoObraTotal,

    subtotalServiciosBase,
    gastosServiciosTotal,
    subtotalServiciosTercerizados: subtotalServiciosTotal,
    subtotalServiciosTotal,

    subtotalCostosDirectos: costoGlobal,
    subtotalCostosIndirectos: gastosGeneralesTotal,
    costosIndirectosAplicados,
    gastosDesglosados,
    capitulosTotales,

    costoDirectoBase,
    margenRiesgoPorcentaje: margenRiesgoPct,
    montoMargenRiesgo,

    costoTotalObra: baseCostoMasGG,
    montoGanancia: beneficioMonto,
    precioVentaSinImpuestos: subtotalSinImpuestos,
    totalARS: precioFinalGlobal,
    totalMonedaExtranjera: cotizacionMonedaExtranjera && cotizacionMonedaExtranjera > 0
      ? roundMoney(precioFinalGlobal / cotizacionMonedaExtranjera)
      : undefined
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
  const resolvedInsumos = costoData.insumosSnapshotUnitario;

  if (resolvedInsumos && resolvedInsumos.length > 0) {
    for (const item of resolvedInsumos) {
      const matId = item.materialId || '';
      const mat = insumosMap.get(matId);
      if (!mat) {
        alertas.push(`Material no encontrado en catálogo (ID: ${matId})`);
        insumosInactivos.push(matId);
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
          insumosIncompletos.push(mat.nombre);
        }
      }
    }
  } else if (tarea.insumos && tarea.insumos.length > 0) {
    // Si no hubo ningún insumo resuelto y la tarea tenía insumos definidos, verificar slots
    for (const item of tarea.insumos) {
      if (item.materialId || item.insumoId) {
        const targetId = item.materialId || item.insumoId || '';
        const mat = insumosMap.get(targetId);
        if (!mat) {
          alertas.push(`Material no encontrado en catálogo (ID: ${targetId})`);
          insumosInactivos.push(targetId);
        }
      } else if (item.filtroMaterial || item.reglasDinamicas) {
        alertas.push(`No se encontró material en catálogo que cumpla los criterios para el slot: "${item.nombreSlot || 'Material dinámico'}"`);
        insumosInactivos.push(item.nombreSlot || 'Slot sin material');
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
  costoServiciosTotal?: number;
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

  // 1. Construir Scope Inicial con Parámetros y Tarifas Base
  const scope: Record<string, number> = {};
  const valoresParametros: Record<string, number> = {};

  // 1.1 Inyectar tarifas de mano de obra y costos del sistema en el scope para fórmulas dinámicas
  if (manoObraMap) {
    manoObraMap.forEach((mo) => {
      const rate = safeNum(mo.costoHora);
      const safeId = mo.id.replace(/-/g, '_');
      scope[safeId] = rate;
      scope[`costo_hora_${safeId}`] = rate;
      scope[`tarifa_${safeId}`] = rate;

      const normalizedName = mo.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normalizedName.includes('oficial') && !normalizedName.includes('ayudante')) {
        scope['costo_hora_oficial'] = rate;
        scope['tarifa_oficial'] = rate;
      } else if (normalizedName.includes('ayudante')) {
        scope['costo_hora_ayudante'] = rate;
        scope['tarifa_ayudante'] = rate;
      } else if (normalizedName.includes('tecnico') || normalizedName.includes('matriculado') || normalizedName.includes('profesional') || normalizedName.includes('proyectista')) {
        scope['costo_hora_tecnico'] = rate;
        scope['costo_hora_matriculado'] = rate;
        scope['costo_hora_profesional'] = rate;
        scope['tarifa_profesional'] = rate;
        scope['tarifa_tecnico'] = rate;
        scope['tarifa_matriculado'] = rate;
      }
    });
  }

  if (tarea.honorarioBase !== undefined) {
    scope['honorario_base'] = safeNum(tarea.honorarioBase);
    scope['honorarioBase'] = safeNum(tarea.honorarioBase);
    scope['honorario'] = safeNum(tarea.honorarioBase);
  }

  if (tarea.costoServicioDirecto !== undefined) {
    scope['costo_servicio'] = safeNum(tarea.costoServicioDirecto);
    scope['costoServicio'] = safeNum(tarea.costoServicioDirecto);
  }

  if (tarea.parametros && tarea.parametros.length > 0) {
    tarea.parametros.forEach((p) => {
      let isVisible = true;
      if (p.condicion && p.condicion.trim()) {
        isVisible = evaluateCondition(p.condicion, scope);
      }

      const rawVal = parametrosOVariables[p.id] !== undefined
        ? safeNum(parametrosOVariables[p.id])
        : (p.valorDefault ?? 1);

      const val = isVisible ? rawVal : 0;
      scope[p.id] = val;
      valoresParametros[p.id] = val;
    });
  }

  // Copiar cualquier otra variable que se haya pasado explícitamente (si no fue ya procesada)
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
      marca: mat?.marca || mat?.atributos?.find(a => a.clave.toLowerCase() === 'marca')?.valor,
      productoId: mat?.productoId,
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

  // 5. Evaluar Honorarios Profesionales / Costo de Servicios Técnicos
  let costoServiciosTotal = 0;
  if (tarea.formulaHonorarios && tarea.formulaHonorarios.trim()) {
    const evalRes = evaluateMathExpression(tarea.formulaHonorarios, scope);
    if (evalRes.isValid && evalRes.value !== null) {
      costoServiciosTotal = roundMoney(Math.max(0, evalRes.value));
    }
  } else if (tarea.honorarioBase !== undefined && tarea.honorarioBase > 0) {
    costoServiciosTotal = roundMoney(tarea.honorarioBase);
  } else if (tarea.costoServicioDirecto !== undefined && tarea.costoServicioDirecto > 0) {
    costoServiciosTotal = roundMoney(tarea.costoServicioDirecto);
  }

  const costoDirectoTotal = roundMoney(costoInsumosTotal + costoManoObraTotal + costoServiciosTotal + costoFijo);

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
    costoServiciosTotal,
    costoDirectoTotal,
    clausulaExclusiones: tarea.clausulaExclusiones || tarea.clausulaTecnicaDefault
  };
}

// ─── 14. Motor de Sinergia Determinística de Tareas & Margen de Riesgo ────────

/**
 * Evalúa si un conjunto de ítems de cotización es compatible y combinable (mergeable)
 * para generar sinergia real de tareas y reducción de tiempos muertos en obra.
 *
 * Criterios técnicos de compatibilidad:
 * 1. Debe haber más de 1 ítem (items.length > 1).
 * 2. Al menos 2 ítems deben requerir mano de obra real (manoObraSnapshot o costoManoObra > 0).
 */
export function sonItemsCompatiblesParaSinergia(items: ItemPresupuesto[]): boolean {
  if (!items || items.length <= 1) return false;

  const itemsConMO = items.filter(
    (it) =>
      (it.manoObraSnapshot && it.manoObraSnapshot.length > 0) ||
      (it.costoManoObra && it.costoManoObra > 0)
  );

  return itemsConMO.length >= 2;
}

/**
 * Calcula la sinergia determinística de mano de obra cuando se combinan múltiples tareas en obra.
 * - Consolidación de Setup (Alistamiento de Puesto): El setup se consolida en 1h base + 0.15h por tarea.
 * - Bono de Trabajo en Tándem: Si operarios >= 2, aplica un 10% de ganancia de productividad en tareas conjuntas.
 * No utiliza aproximaciones estocásticas ni iteraciones complejas; es 100% determinístico.
 */
export function calcularSinergiaManoObra(params: {
  items: ItemPresupuesto[];
  operarios?: number;
  horasEfectivasJornada?: number;
  categoriasManoObra?: CategoriaManoDeObra[];
}): SinergiaManoObraResultado {
  const { items = [], operarios = 2, horasEfectivasJornada: horasEfectivasInput, categoriasManoObra = [] } = params;
  const nOperarios = Math.max(1, Math.round(safeNum(operarios) || 2));
  const horasEfectivas = safeNum(horasEfectivasInput) > 0 ? safeNum(horasEfectivasInput) : 7.0;
  const sonCompatibles = sonItemsCompatiblesParaSinergia(items);

  const itemsCompatiblesList = items.filter(
    (it) => (it.manoObraSnapshot && it.manoObraSnapshot.length > 0) || (it.costoManoObra && it.costoManoObra > 0)
  );

  let horasTeoricasTotal = 0;
  let costoManoObraBase = 0;
  let setupAisladoTotal = 0;

  for (const item of items) {
    let itemHorasMO = 0;
    let itemCostoMO = 0;

    if (item.manoObraSnapshot && item.manoObraSnapshot.length > 0) {
      for (const mo of item.manoObraSnapshot) {
        itemHorasMO += safeNum(mo.horasTotales);
        itemCostoMO += safeNum(mo.subtotalManoObra);
      }
    } else if (item.costoManoObra) {
      itemCostoMO += safeNum(item.costoManoObra);
      const tarifaRef = 12000;
      itemHorasMO += safeNum(item.costoManoObra) / tarifaRef;
    }

    horasTeoricasTotal = roundMoney(horasTeoricasTotal + itemHorasMO);
    costoManoObraBase = roundMoney(costoManoObraBase + itemCostoMO);

    if (itemHorasMO > 0) {
      const setupItem = Math.min(1.0, Math.max(0.25, itemHorasMO * 0.15));
      setupAisladoTotal += setupItem;
    }
  }

  // 1. Tarifas de Oficial y Ayudante según roles del catálogo
  let tarifaOficial = 14000;
  let tarifaAyudante = 10000;

  if (categoriasManoObra.length > 0) {
    const ofCat = categoriasManoObra.find((c) => c.rol === 'oficial') ||
      categoriasManoObra.find((c) => c.nombre.toLowerCase().includes('oficial') && !c.nombre.toLowerCase().includes('medio')) ||
      categoriasManoObra[0];
    const ayCat = categoriasManoObra.find((c) => c.rol === 'ayudante') ||
      categoriasManoObra.find((c) => c.nombre.toLowerCase().includes('ayudante') || c.nombre.toLowerCase().includes('medio')) ||
      ofCat;

    if (ofCat && safeNum(ofCat.costoHora) > 0) tarifaOficial = safeNum(ofCat.costoHora);
    if (ayCat && safeNum(ayCat.costoHora) > 0) tarifaAyudante = safeNum(ayCat.costoHora);
  } else if (costoManoObraBase > 0 && horasTeoricasTotal > 0) {
    const tAvg = costoManoObraBase / horasTeoricasTotal;
    tarifaOficial = roundMoney(tAvg * 1.15);
    tarifaAyudante = roundMoney(tAvg * 0.85);
  }

  // 2. Composición de Cuadrilla (Oficiales vs Ayudantes)
  let nOficiales = 1;
  let nAyudantes = 0;
  let compTexto = '1 Oficial';

  if (nOperarios === 1) {
    nOficiales = 1;
    nAyudantes = 0;
    compTexto = '1 Oficial';
  } else if (nOperarios === 2) {
    nOficiales = 1;
    nAyudantes = 1;
    compTexto = '1 Oficial + 1 Ayudante';
  } else if (nOperarios === 3) {
    nOficiales = 2;
    nAyudantes = 1;
    compTexto = '2 Oficiales + 1 Ayudante';
  } else if (nOperarios === 4) {
    nOficiales = 2;
    nAyudantes = 2;
    compTexto = '2 Oficiales + 2 Ayudantes';
  } else {
    nOficiales = Math.ceil(nOperarios / 2);
    nAyudantes = Math.floor(nOperarios / 2);
    compTexto = `${nOficiales} Oficiales + ${nAyudantes} Ayudantes`;
  }

  const tarifaPonderadaCuadrilla = roundMoney(
    (nOficiales * tarifaOficial + nAyudantes * tarifaAyudante) / nOperarios
  );

  if (!sonCompatibles || horasTeoricasTotal <= 0) {
    const tiempoReloj = roundMoney(horasTeoricasTotal / nOperarios);
    const jornadas = roundMoney(horasTeoricasTotal / (nOperarios * horasEfectivas));
    const diasEnteros = Math.max(1, Math.ceil(jornadas || 1));
    const horasDevengadas = diasEnteros * nOperarios * 8.0;

    return {
      operarios: nOperarios,
      horasTeoricasTotal,
      horasSetupAislado: roundMoney(setupAisladoTotal),
      horasSetupConsolidado: roundMoney(setupAisladoTotal),
      ahorroSetupHs: 0,
      bonoTandemHs: 0,
      horasFinales: horasTeoricasTotal,
      horasEfectivasJornada: horasEfectivas,
      tiempoObraHorasReloj: tiempoReloj,
      jornadasEstimadas: jornadas,
      diasEnterosObra: diasEnteros,
      horasDevengadasJornal: horasDevengadas,
      tarifaPonderadaCuadrilla,
      composicionCuadrillaTexto: compTexto,
      factorSinergia: 1.0,
      costoManoObraBase,
      costoManoObraSinergico: costoManoObraBase,
      ahorroManoObraARS: 0,
      sonCompatibles: false,
      explicacion: 'Sinergia no aplicable (requiere al menos 2 partidas con mano de obra).'
    };
  }

  // 3. Ahorro de Setup Consolidado de Obra
  const setupConsolidado = 1.0 + 0.15 * (itemsCompatiblesList.length - 1);
  const ahorroSetupHs = Math.max(0, setupAisladoTotal - setupConsolidado);

  // 4. Bono de Trabajo en Tándem (si cuadrilla >= 2 operarios)
  const bonoTandemHs = nOperarios >= 2 ? (horasTeoricasTotal * 0.10) : 0;

  // 5. Horas Sinérgicas Finales y Factor de Reducción
  const horasFinales = roundMoney(Math.max(0.1, horasTeoricasTotal - ahorroSetupHs - bonoTandemHs));

  // 6. Tiempo de Obra y Jornadas Enteras de Convenio
  const tiempoObraHorasReloj = roundMoney(horasFinales / nOperarios);
  const jornadasEstimadas = roundMoney(horasFinales / (nOperarios * horasEfectivas));
  const diasEnterosObra = Math.max(1, Math.ceil(jornadasEstimadas));
  const horasDevengadasJornal = diasEnterosObra * nOperarios * 8.0;

  // Costo Real de Mano de Obra por Jornales Devengados Ponderados
  const costoManoObraSinergico = roundMoney(
    Math.min(
      costoManoObraBase,
      roundMoney(costoManoObraBase * (horasFinales / horasTeoricasTotal) * (tarifaPonderadaCuadrilla / (tarifaOficial || 1)))
    )
  );
  const factorSinergia = costoManoObraBase > 0
    ? roundMoney4(Math.min(1.0, Math.max(0.55, costoManoObraSinergico / costoManoObraBase)))
    : 1.0;
  const ahorroManoObraARS = roundMoney(Math.max(0, costoManoObraBase - costoManoObraSinergico));

  const duracionMsg = `Plazo: ${diasEnterosObra} ${diasEnterosObra === 1 ? 'jornada' : 'jornadas'} (${tiempoObraHorasReloj} hs reloj en sitio).`;
  const explicacion = `Cuadrilla de ${compTexto} (${formatARS(tarifaPonderadaCuadrilla)}/h). Ahorro setup: -${roundMoney(ahorroSetupHs)}h, tándem: -${roundMoney(bonoTandemHs)}h. ${duracionMsg}`;

  return {
    operarios: nOperarios,
    horasTeoricasTotal,
    horasSetupAislado: roundMoney(setupAisladoTotal),
    horasSetupConsolidado: roundMoney(setupConsolidado),
    ahorroSetupHs: roundMoney(ahorroSetupHs),
    bonoTandemHs: roundMoney(bonoTandemHs),
    horasFinales,
    horasEfectivasJornada: horasEfectivas,
    tiempoObraHorasReloj,
    jornadasEstimadas,
    diasEnterosObra,
    horasDevengadasJornal,
    tarifaPonderadaCuadrilla,
    composicionCuadrillaTexto: compTexto,
    factorSinergia,
    costoManoObraBase,
    costoManoObraSinergico,
    ahorroManoObraARS,
    sonCompatibles: true,
    explicacion
  };
}

/**
 * Estima la cuadrilla de operarios necesaria a partir de un plazo objetivo en días
 * y las horas efectivas disponibles por jornada (modo "El plazo manda").
 */
export function estimarCuadrillaPorPlazo(params: {
  items: ItemPresupuesto[];
  diasObjetivo: number;
  horasEfectivasJornada?: number;
  categoriasManoObra?: CategoriaManoDeObra[];
  maxOperarios?: number;
}): EstimacionCuadrillaPorPlazoResultado {
  const {
    items = [],
    diasObjetivo: diasInput,
    horasEfectivasJornada: horasEfectivasInput,
    categoriasManoObra = [],
    maxOperarios = 6
  } = params;

  const diasObjetivo = Math.max(0.5, safeNum(diasInput) || 1);
  const horasEfectivas = safeNum(horasEfectivasInput) > 0 ? safeNum(horasEfectivasInput) : 8.0;

  // Calculamos opciones para cuadrillas de 1 a maxOperarios
  const opciones: SinergiaManoObraResultado[] = [];
  for (let n = 1; n <= maxOperarios; n++) {
    opciones.push(
      calcularSinergiaManoObra({
        items,
        operarios: n,
        horasEfectivasJornada: horasEfectivas,
        categoriasManoObra
      })
    );
  }

  // Si no hay horas de MO en absoluto
  const primeraOpcion = opciones[0];
  if (!primeraOpcion || primeraOpcion.horasTeoricasTotal <= 0) {
    return {
      diasObjetivo,
      horasEfectivasJornada: horasEfectivas,
      operariosSugeridos: 1,
      sinergiaSugerida: primeraOpcion || calcularSinergiaManoObra({ items: [], operarios: 1, horasEfectivasJornada: horasEfectivas }),
      opciones,
      esFactible: true,
      cuadrillaExactaFraccional: 0,
      mensaje: 'No hay partidas con mano de obra suficiente para planificar.'
    };
  }

  // Buscamos la menor cuadrilla donde diasEnterosObra <= ceil(diasObjetivo)
  let opcionElegida = opciones.find((op) => op.diasEnterosObra <= Math.ceil(diasObjetivo));
  if (!opcionElegida) {
    // Si ninguna cumple en días enteros, verificamos si alguna fraccional lo cumple
    opcionElegida = opciones.find((op) => op.jornadasEstimadas <= diasObjetivo);
  }

  const esFactible = Boolean(opcionElegida);
  const sinergiaSugerida = opcionElegida || opciones[opciones.length - 1];
  const operariosSugeridos = sinergiaSugerida.operarios;

  const horasBase = sinergiaSugerida.horasFinales;
  const capacidadJornadaPorOp = diasObjetivo * horasEfectivas;
  const cuadrillaExactaFraccional = roundMoney(horasBase / (capacidadJornadaPorOp || 1));

  let mensaje = '';
  if (esFactible) {
    mensaje = `Para entregar en ${diasObjetivo} ${diasObjetivo === 1 ? 'día' : 'días'} (${horasEfectivas}h/día), se requiere una cuadrilla de ${operariosSugeridos} ${operariosSugeridos === 1 ? 'operario' : 'operarios'} (${sinergiaSugerida.composicionCuadrillaTexto}).`;
  } else {
    mensaje = `Plazo muy exigente: incluso con ${maxOperarios} operarios se requieren al menos ${sinergiaSugerida.diasEnterosObra} días a ${horasEfectivas}h/día.`;
  }

  return {
    diasObjetivo,
    horasEfectivasJornada: horasEfectivas,
    operariosSugeridos,
    sinergiaSugerida,
    opciones,
    esFactible,
    cuadrillaExactaFraccional,
    mensaje
  };
}

// ─── Compatibilidad retroactiva transitoria ───────────────────────────────────
export const Z_SCORES_CONFIANZA: Record<NivelConfianzaSinergia, number> = {
  50: 0.0,
  80: 0.8416,
  90: 1.2816,
  95: 1.6449
};

export interface ParametrosOptimizacionCuadrilla {
  items: ItemPresupuesto[];
  costosIndirectosCatalog?: CostoIndirecto[];
  costosIndirectosConfig?: CostoIndirectoItemConfig[];
  categoriasManoObra?: CategoriaManoDeObra[];
  costoDiarioMovilidadManual?: number;
  estrategiaSeleccionada?: EstrategiaCuadrilla;
  nivelConfianza?: NivelConfianzaSinergia;
  aplicarOptimizacion?: boolean;
}

export interface ResultadoOptimizacionCuadrilla {
  horasTeoricasTotal: number;
  horasSetupTotal: number;
  horasNetasTotal: number;
  desvioEstandarTotal: number;
  coeficienteVariacionPct: number;
  costoDiarioMovilidad: number;
  tarifaHoraPonderada: number;
  opciones: {
    minima: OpcionCuadrillaSimulada;
    optima: OpcionCuadrillaSimulada;
    rapida: OpcionCuadrillaSimulada;
  };
  estrategiaSeleccionada: EstrategiaCuadrilla;
  opcionActiva: OpcionCuadrillaSimulada;
  planificacion: PlanificacionCuadrilla;
}

/**
 * Adaptador de compatibilidad para componentes existentes.
 * Delega en calcularSinergiaManoObra sin maquinaria estocástica.
 */
export function calcularOptimizacionCuadrilla(params: ParametrosOptimizacionCuadrilla): ResultadoOptimizacionCuadrilla {
  const {
    items = [],
    costosIndirectosCatalog = [],
    costosIndirectosConfig,
    estrategiaSeleccionada = 'optima',
    aplicarOptimizacion = false
  } = params;

  const operariosMap: Record<EstrategiaCuadrilla, number> = {
    minima: 1,
    optima: 2,
    rapida: 4,
    personalizada: 2
  };
  const nOperarios = operariosMap[estrategiaSeleccionada] || 2;

  const sinergia = calcularSinergiaManoObra({ items, operarios: nOperarios });

  // Extraer costo diario de movilidad
  let costoDiarioMovilidad = safeNum(params.costoDiarioMovilidadManual);
  if (costoDiarioMovilidad <= 0) {
    const configs = (costosIndirectosConfig && costosIndirectosConfig.length > 0)
      ? costosIndirectosConfig
      : costosIndirectosCatalog.map(c => ({ id: c.id, nombre: c.nombre, tipo: c.tipo, valor: c.valor, aplica: true }));

    const indirectoMovilidad = configs.find(c =>
      c.aplica && (c.tipo === 'por_visita' || c.nombre.toLowerCase().includes('movilidad') || c.nombre.toLowerCase().includes('flete') || c.nombre.toLowerCase().includes('viatico'))
    );
    costoDiarioMovilidad = indirectoMovilidad ? safeNum(indirectoMovilidad.valor) : 15000;
  }

  const tarifaHoraPonderada = sinergia.horasTeoricasTotal > 0
    ? roundMoney(sinergia.costoManoObraBase / sinergia.horasTeoricasTotal)
    : 12000;

  const jornadasDias = Math.max(0.5, roundMoney(sinergia.horasFinales / (nOperarios * 8)));
  const costoLogisticaARS = roundMoney(Math.ceil(jornadasDias) * costoDiarioMovilidad);
  const costoTotalEjecucionARS = roundMoney(sinergia.costoManoObraSinergico + costoLogisticaARS);

  const opcionActiva: OpcionCuadrillaSimulada = {
    estrategia: estrategiaSeleccionada,
    titulo: `Cuadrilla (${nOperarios} Operarios)`,
    subtitulo: `${nOperarios === 1 ? '1 Oficial solo' : `${nOperarios} Operarios en tándem`}`,
    operariosOficiales: Math.ceil(nOperarios / 2),
    operariosAyudantes: Math.floor(nOperarios / 2),
    operariosTotales: nOperarios,
    factorSinergia: sinergia.factorSinergia,
    horasTotales: sinergia.horasFinales,
    horasBaseTeoricas: sinergia.horasTeoricasTotal,
    desvioEstandarHoras: 0,
    jornadasDias,
    costoManoObraARS: sinergia.costoManoObraSinergico,
    costoLogisticaARS,
    costoTotalEjecucionARS,
    ahorroRespectoBaseARS: sinergia.ahorroManoObraARS,
    nivelRiesgo: 'bajo',
    descripcionRiesgo: sinergia.explicacion,
    recomendado: nOperarios === 2
  };

  const planificacion: PlanificacionCuadrilla = {
    estrategia: estrategiaSeleccionada,
    nivelConfianza: 80,
    zScore: 0,
    desvioEstandarHoras: 0,
    coeficienteVariacionPct: 0,
    horasTeoricasTotal: sinergia.horasTeoricasTotal,
    horasSetupTotal: sinergia.horasSetupConsolidado,
    horasNetasTotal: sinergia.horasFinales,
    horasMediaEsperada: sinergia.horasFinales,
    factorSinergiaAplicado: sinergia.factorSinergia,
    horasFinalesOptimizadas: sinergia.horasFinales,
    operariosOficiales: opcionActiva.operariosOficiales,
    operariosAyudantes: opcionActiva.operariosAyudantes,
    operariosTotales: nOperarios,
    jornadasEstimadas: jornadasDias,
    costoManoObraEstimado: sinergia.costoManoObraSinergico,
    costoLogisticaEstimado: costoLogisticaARS,
    costoTotalEjecucion: costoTotalEjecucionARS,
    ahorroEstimadoARS: sinergia.ahorroManoObraARS,
    nivelRiesgoParate: 'bajo',
    explicacionOptimizacion: sinergia.explicacion,
    aplicarOptimizacionAlPresupuesto: aplicarOptimizacion
  };

  return {
    horasTeoricasTotal: sinergia.horasTeoricasTotal,
    horasSetupTotal: sinergia.horasSetupConsolidado,
    horasNetasTotal: sinergia.horasFinales,
    desvioEstandarTotal: 0,
    coeficienteVariacionPct: 0,
    costoDiarioMovilidad,
    tarifaHoraPonderada,
    opciones: {
      minima: { ...opcionActiva, estrategia: 'minima', operariosTotales: 1, titulo: '1 Operario' },
      optima: { ...opcionActiva, estrategia: 'optima', operariosTotales: 2, titulo: '2 Operarios' },
      rapida: { ...opcionActiva, estrategia: 'rapida', operariosTotales: 4, titulo: '4 Operarios' }
    },
    estrategiaSeleccionada,
    opcionActiva,
    planificacion
  };
}


