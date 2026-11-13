/**
 * terminology.ts - Diccionario centralizado de rótulos visibles de la UI.
 *
 * Restricción del proyecto: la terminología de negocio (capítulos/partidas vs ítem/subítem)
 * está pendiente de definición final. Todos los textos visibles relacionados deben leerse
 * desde este archivo para poder ajustarlos en un único lugar sin renombrar entidades ni
 * campos de Dexie.
 */

export interface TerminologyDictionary {
  agrupadorSingular: string;
  agrupadorPlural: string;
  elementoSingular: string;
  elementoPlural: string;
  subElementoSingular: string;
  subElementoPlural: string;
  elementoLibre: string;
  trabajoTipoSingular: string;
  trabajoTipoPlural: string;
  estadoSinValorizar: string;
  estadoValorizada: string;
  seccionAlcanceYSupuestos: string;
  alcanceIncluye: string;
  alcanceExcluye: string;
  verCondiciones: string;
  advertenciaCliente: string;
  notaInterna: string;
  variableSingular: string;
  variablePlural: string;
  supuestoSingular: string;
  supuestoPlural: string;
  respaldarBackupJson: string;
  restaurarBackupJson: string;
}

export const TERMINOLOGY: TerminologyDictionary = {
  agrupadorSingular: 'Capítulo',
  agrupadorPlural: 'Capítulos',
  elementoSingular: 'Ítem',
  elementoPlural: 'Ítems',
  subElementoSingular: 'Subítem',
  subElementoPlural: 'Subítems',
  elementoLibre: 'Ítem libre',
  trabajoTipoSingular: 'Trabajo tipo',
  trabajoTipoPlural: 'Trabajos tipo',
  estadoSinValorizar: 'Sin valorizar',
  estadoValorizada: 'Valorizada',
  seccionAlcanceYSupuestos: 'Alcance y supuestos',
  alcanceIncluye: 'Incluye',
  alcanceExcluye: 'No incluye',
  verCondiciones: 'Ver condiciones',
  advertenciaCliente: 'Advertencia',
  notaInterna: 'Nota interna',
  variableSingular: 'Variable',
  variablePlural: 'Variables',
  supuestoSingular: 'Supuesto',
  supuestoPlural: 'Supuestos',
  respaldarBackupJson: 'Respaldar datos (JSON)',
  restaurarBackupJson: 'Restaurar datos (JSON)',
};
