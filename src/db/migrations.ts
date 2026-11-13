/**
 * migrations.ts - Funciones puras de migración de esquema Dexie (v8 -> v9).
 *
 * Todas las transformaciones son estrictamente aditivas y preservan intactos los campos
 * previos para evitar pérdida de datos.
 */

import {
  EstadoValorizacion,
  ItemPresupuesto,
  Presupuesto,
  TareaTipo,
  VariableCotizacion,
} from '../core/types';
import {
  evaluarVariablesCotizacion,
  slugifyIdentificador,
} from '../core/notebookDomain';

/**
 * Infiere el estado de valorización de un ítem existente (v8 o anterior).
 * Un ítem se considera 'valorizada' si ya posee snapshots, servicios, precio manual o costo directo > 0.
 */
export function inferEstadoValorizacion(item: ItemPresupuesto): EstadoValorizacion {
  const tieneInsumos = (item.insumosSnapshot?.length ?? 0) > 0;
  const tieneManoObra = (item.manoObraSnapshot?.length ?? 0) > 0;
  const tieneServicios = (item.serviciosTercerizados?.length ?? 0) > 0;
  const tienePrecioManual = (item.precioManual ?? 0) > 0;
  const tieneCostoDirecto = (item.costoDirectoTotal ?? 0) > 0;

  return tieneInsumos || tieneManoObra || tieneServicios || tienePrecioManual || tieneCostoDirecto
    ? 'valorizada'
    : 'sin_valorizar';
}

/**
 * Migra un registro de Trabajo Tipo al esquema v9 de forma aditiva y sin pérdida de datos.
 */
export function migrateTareaTipoToV9(tt: TareaTipo): TareaTipo {
  const slug = tt.slug && tt.slug.trim() ? tt.slug.trim() : slugifyIdentificador(tt.nombre);
  const alcance =
    tt.alcance ??
    (tt.clausulaExclusiones && tt.clausulaExclusiones.trim()
      ? {
          inclusiones: [],
          exclusiones: [
            {
              id: 'excl-legacy',
              texto: tt.clausulaExclusiones.trim(),
              tema: 'general',
            },
          ],
        }
      : undefined);

  return {
    ...tt,
    slug,
    version: tt.version ?? 1,
    ...(alcance ? { alcance } : {}),
    supuestos: tt.supuestos ?? [],
    advertenciasCondicionales: tt.advertenciasCondicionales ?? [],
    subTrabajos: tt.subTrabajos ?? [],
  };
}

function buildVariablesCotizacionFromLegacy(p: Presupuesto): VariableCotizacion[] {
  if (p.variablesCotizacion && p.variablesCotizacion.length > 0) {
    return p.variablesCotizacion;
  }

  const varsMap = new Map<string, VariableCotizacion>();
  let order = 0;

  for (const cell of p.calculatedCells ?? []) {
    if (!cell.name || varsMap.has(cell.name)) continue;
    varsMap.set(cell.name, {
      id: cell.name,
      nombre: cell.name,
      expresion: cell.rawExpression ?? String(cell.evaluatedValue ?? 0),
      valorEvaluado: cell.error ? undefined : cell.evaluatedValue,
      error: cell.error,
      orden: order++,
    });
  }

  if (p.calculosVariables) {
    for (const [key, val] of Object.entries(p.calculosVariables)) {
      if (!key || varsMap.has(key)) continue;
      varsMap.set(key, {
        id: key,
        nombre: key,
        expresion: String(val),
        orden: order++,
      });
    }
  }

  const list = Array.from(varsMap.values());
  if (list.length === 0) return [];
  return evaluarVariablesCotizacion(list).variables;
}

/**
 * Migra un registro de Presupuesto al esquema v9 de forma aditiva y sin pérdida de datos.
 */
export function migratePresupuestoToV9(p: Presupuesto): Presupuesto {
  const variablesCotizacion = buildVariablesCotizacionFromLegacy(p);

  const notasInternasLista =
    p.notasInternasLista ??
    (p.notasInternas && p.notasInternas.trim()
      ? [
          {
            id: 'nota-legacy',
            texto: p.notasInternas.trim(),
            createdAt: p.fechaModificacion || p.createdAt,
          },
        ]
      : []);

  const items = (p.items ?? []).map((item): ItemPresupuesto => {
    const estadoValorizacion = item.estadoValorizacion ?? inferEstadoValorizacion(item);
    const overridesParametros =
      item.overridesParametros ??
      (item.tareaTipoId && item.valoresParametros && Object.keys(item.valoresParametros).length > 0
        ? { ...item.valoresParametros }
        : undefined);

    return {
      ...item,
      estadoValorizacion,
      ...(overridesParametros ? { overridesParametros } : {}),
    };
  });

  return {
    ...p,
    items,
    variablesCotizacion,
    supuestos: p.supuestos ?? {},
    notasInternasLista,
  };
}
