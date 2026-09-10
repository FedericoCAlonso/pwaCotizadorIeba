/**
 * Reglas destiladas de la Reglamentación AEA 90364 (Secciones 770 y 771)
 * para dimensionamiento, verificación normativa y cómputo de presupuestos eléctricos.
 */

export type TipoCircuitoAEA =
  | 'IUG' // Iluminación de Uso General
  | 'TUG' // Tomacorrientes de Uso General
  | 'TUE' // Tomacorrientes de Uso Especial (Aires acondicionados, bombas, etc.)
  | 'IUE' // Iluminación de Uso Especial
  | 'ALIMENTADOR_SECCIONAL' // Línea principal / seccional de tablero
  | 'PAT'; // Conductor de Protección y Puesta a Tierra

export interface ReglaCircuitoAEA {
  tipo: TipoCircuitoAEA;
  nombre: string;
  seccionMinimaFaseMm2: number;
  seccionMinimaPEMm2: number;
  calibreTermicaMaxA: number;
  descripcionUso: string;
  limiteBocasPorCircuito?: number;
}

export const REGLAS_CIRCUITOS_AEA: Record<TipoCircuitoAEA, ReglaCircuitoAEA> = {
  IUG: {
    tipo: 'IUG',
    nombre: 'Iluminación de Uso General',
    seccionMinimaFaseMm2: 1.5,
    seccionMinimaPEMm2: 2.5,
    calibreTermicaMaxA: 10,
    descripcionUso: 'Bocas de iluminación fija interior/exterior. Carga máx 10A.',
    limiteBocasPorCircuito: 15,
  },
  TUG: {
    tipo: 'TUG',
    nombre: 'Tomacorrientes de Uso General',
    seccionMinimaFaseMm2: 2.5,
    seccionMinimaPEMm2: 2.5,
    calibreTermicaMaxA: 16,
    descripcionUso: 'Tomacorrientes estándar 10A (2P+T). Carga máx 16A.',
    limiteBocasPorCircuito: 15,
  },
  TUE: {
    tipo: 'TUE',
    nombre: 'Tomacorrientes de Uso Especial',
    seccionMinimaFaseMm2: 2.5,
    seccionMinimaPEMm2: 2.5,
    calibreTermicaMaxA: 20,
    descripcionUso: 'Tomas 20A para consumos unitarios > 10A (aires split, caloventores, anafes).',
    limiteBocasPorCircuito: 12,
  },
  IUE: {
    tipo: 'IUE',
    nombre: 'Iluminación de Uso Especial',
    seccionMinimaFaseMm2: 2.5,
    seccionMinimaPEMm2: 2.5,
    calibreTermicaMaxA: 16,
    descripcionUso: 'Intemperie, vidrieras o artefactos de alta potencia.',
    limiteBocasPorCircuito: 12,
  },
  ALIMENTADOR_SECCIONAL: {
    tipo: 'ALIMENTADOR_SECCIONAL',
    nombre: 'Alimentador Principal / Seccional',
    seccionMinimaFaseMm2: 4.0,
    seccionMinimaPEMm2: 4.0,
    calibreTermicaMaxA: 32,
    descripcionUso: 'Línea de interconexión entre medidor y tableros seccionales.',
  },
  PAT: {
    tipo: 'PAT',
    nombre: 'Conductor de Protección y Puesta a Tierra',
    seccionMinimaFaseMm2: 2.5,
    seccionMinimaPEMm2: 2.5,
    calibreTermicaMaxA: 0,
    descripcionUso: 'Conductor continuo de protección IRAM 2183/247-3 verde-amarillo.',
  },
};

/**
 * Tabla de coordinación conductor - interruptor termomagnético (Ib <= In <= Iz)
 * según norma IRAM NM 60898 y canalizaciones embutidas normales.
 */
export const COORDINACION_CONDUCTOR_TERMICA = [
  { seccionMm2: 1.5, corrienteAdmisibleAproxA: 13, termicaRecomendadaA: 10 },
  { seccionMm2: 2.5, corrienteAdmisibleAproxA: 18, termicaRecomendadaA: 16 },
  { seccionMm2: 4.0, corrienteAdmisibleAproxA: 24, termicaRecomendadaA: 20 },
  { seccionMm2: 6.0, corrienteAdmisibleAproxA: 31, termicaRecomendadaA: 25 },
  { seccionMm2: 10.0, corrienteAdmisibleAproxA: 42, termicaRecomendadaA: 32 },
  { seccionMm2: 16.0, corrienteAdmisibleAproxA: 56, termicaRecomendadaA: 50 },
];

/**
 * Reglas de Puesta a Tierra según AEA y protocolo SRT 900/15
 */
export const REGLAS_PUESTA_A_TIERRA = {
  resistenciaMaximaOhm: 40,
  resistenciaOptimaOhm: 10,
  normaJabalina: 'IRAM 2309 (Acero cobreado)',
  diametroMinimoJabalinaPulgadas: '1/2" (12.6 mm)',
  longitudEstandarJabalinaM: [1.5, 3.0],
  sensibilidadDiferencialMa: 30,
  seccionMinimaCableBajadaPatMm2: 4.0,
  accesoriosRequeridos: ['Caja de inspección de PVC o fundición', 'Tomacable reforzado de bronce'],
};

/**
 * Genera un resumen compacto en texto para ser inyectado en el System Prompt de IA
 */
export function generateAeaRulesDigest(): string {
  return `
NORMAS AEA 90364 PARA COTIZACIONES ELÉCTRICAS:
1. SECCIONES MÍNIMAS DE CONDUCTORES:
   - IUG (Iluminación general): Cable mínimo 1.5 mm² | Térmica máx 10A | Máx 15 bocas.
   - TUG (Tomas generales 10A): Cable mínimo 2.5 mm² | Térmica máx 16A | Máx 15 bocas.
   - TUE (Tomas especiales 20A / Aires / Bombas): Cable mínimo 2.5 mm² (rec. 4 mm²) | Térmica máx 20A.
   - Línea principal/seccional: Cable mínimo 4 mm² | Térmica máx 25A o 32A.
   - Puesta a tierra (PE verde/amarillo): Misma sección que fase (mínimo 2.5 mm²).

2. COORDINACIÓN PROTECCIÓN-CONDUCTOR (Ib <= In <= Iz):
   - 1.5 mm² -> Térmica de 10A
   - 2.5 mm² -> Térmica de 16A
   - 4.0 mm² -> Térmica de 20A o 25A
   - 6.0 mm² -> Térmica de 32A
   - Obligatorio Interruptor Diferencial de cabecera de 30mA (sensibilidad para protección de vidas).

3. PUESTA A TIERRA (PAT):
   - Jabalina acero-cobre IRAM 2309 (1/2" x 1.5m o 3m) + tomacable + caja de inspección.
   - Resistencia admisible <= 40 Ohm (óptimo <= 10 Ohm).

4. CÓMPUTO Y DESPERDICIO:
   - En conductores calcular siempre un +10% de desperdicio por replanteo y curvas.
   - En canalizaciones incluir cajas de paso cada 12 metros o cada 3 curvas de 90°.
`.trim();
}
